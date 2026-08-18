import express from 'express';

function ok(data) {
  return { status: 'success', data };
}

function fail(message) {
  return { status: 'error', message };
}

function asyncRoute(handler) {
  return (req, res, next) => {
    Promise.resolve(handler(req, res)).catch(next);
  };
}

export function createSourceModeRouter({ service }) {
  const router = express.Router();

  router.get('/api/source-mode/state', (req, res) => {
    res.json(ok(service.getState()));
  });

  router.get('/api/source-mode/virtual-library', (req, res) => {
    res.json(ok(service.getVirtualLibrary(req.query.sourceRootId || '')));
  });

  router.post('/api/source-mode/state', (req, res) => {
    const next = service.setState({
      mode: req.body.mode === 'source' ? 'source' : 'library',
      selectedSourceRootId: req.body.selectedSourceRootId || '',
      selectedRelativePath: req.body.selectedRelativePath || '',
    });
    res.json(ok(next));
  });

  router.get('/api/source-roots', (req, res) => {
    res.json(ok(service.indexer.buildTree()));
  });

  router.post('/api/source-roots/addPath', asyncRoute(async (req, res) => {
    const paths = Array.isArray(req.body.paths) ? req.body.paths : [req.body.path].filter(Boolean);
    const roots = [];
    for (const filePath of paths) {
      const root = service.indexer.addSourceRoot(filePath);
      service.watcher.watch(root.id);
      roots.push(root);
    }
    for (const root of roots) {
      service.scanRoot(root.id).catch((err) => {
        console.warn('[source-mode] background scan failed:', root.id, err && err.message);
      });
    }
    res.status(201).json(ok(roots.length === 1 ? roots[0] : roots));
  }));

  router.post('/api/source-roots/remove', (req, res) => {
    const id = req.body.id;
    if (!id) {
      res.status(400).json(fail('id is required'));
      return;
    }
    service.watcher.unwatch(id);
    const removed = service.indexer.removeSourceRoot(id);
    res.json(ok({ removed }));
  });

  router.post('/api/source-roots/rescan', asyncRoute(async (req, res) => {
    const id = req.body.id;
    if (!id) {
      res.status(400).json(fail('id is required'));
      return;
    }
    const result = await service.scanRoot(id, req.body.relativePath || null);
    res.json(ok(result));
  }));

  router.post('/api/source-roots/reconcile', asyncRoute(async (req, res) => {
    const id = req.body.id;
    if (!id) {
      res.status(400).json(fail('id is required'));
      return;
    }
    const result = await service.scanRoot(id, req.body.relativePath || null);
    res.json(ok({ reconciled: true, ...result }));
  }));

  router.get('/api/source-roots/:id/tree', (req, res) => {
    const root = service.indexer.getSourceRoot(req.params.id);
    if (!root) {
      res.status(404).json(fail('Source root not found'));
      return;
    }
    res.json(ok(root));
  });

  router.get('/api/source-assets', (req, res) => {
    const result = service.indexer.listAssets({
      sourceRootId: req.query.sourceRootId,
      relativePath: req.query.relativePath,
      search: req.query.search,
      limit: req.query.limit,
      offset: req.query.offset,
    });
    res.json(ok(result));
  });

  router.get('/api/source-assets/:id/thumbnail', asyncRoute(async (req, res) => {
    const asset = service.indexer.getAssetById(req.params.id);
    if (!asset) {
      res.status(404).json(fail('Source asset not found'));
      return;
    }
    const thumbnail = await service.thumbnails.ensureThumbnail(asset);
    if (thumbnail) {
      res.sendFile(thumbnail);
      return;
    }
    const original = service.thumbnails.originalPath(asset);
    if (original && service.thumbnails.isBrowserRenderableImage(asset)) {
      res.sendFile(original);
      return;
    }
    res.status(404).json(fail('Thumbnail not available'));
  }));

  router.get('/api/source-assets/:id/original', (req, res) => {
    const asset = service.indexer.getAssetById(req.params.id);
    if (!asset) {
      res.status(404).json(fail('Source asset not found'));
      return;
    }
    const original = service.thumbnails.originalPath(asset);
    if (!original) {
      res.status(410).json(fail('Source file is missing'));
      return;
    }
    res.sendFile(original);
  });

  return router;
}
