import fs from 'node:fs';
import path from 'node:path';
import AdmZip from 'adm-zip';

function zipModule() {
  return AdmZip.default || AdmZip;
}

function safeJoin(root, target) {
  const resolvedRoot = path.resolve(root);
  const resolvedTarget = path.resolve(resolvedRoot, target);
  if (resolvedTarget !== resolvedRoot && !resolvedTarget.startsWith(resolvedRoot + path.sep)) {
    throw new Error(`Unsafe plugin path: ${target}`);
  }
  return resolvedTarget;
}

export function packPlugin(pluginDir, destFile) {
  const Zip = zipModule();
  const zip = new Zip();
  zip.addLocalFolder(pluginDir, '.');
  fs.mkdirSync(path.dirname(destFile), { recursive: true });
  zip.writeZip(destFile);
  return destFile;
}

export function installPlugin(zipFile, pluginsDir) {
  const Zip = zipModule();
  const zip = new Zip(zipFile);
  const manifestEntry = zip.getEntry('manifest.json');
  if (!manifestEntry) throw new Error('Plugin manifest.json is missing');
  const manifest = JSON.parse(manifestEntry.getData().toString('utf8'));
  if (!manifest.id || !manifest.version) throw new Error('Plugin manifest is invalid');
  const targetDir = safeJoin(pluginsDir, manifest.id);
  fs.mkdirSync(targetDir, { recursive: true });
  zip.extractAllTo(targetDir, true);
  return { manifest, path: targetDir };
}

export function uninstallPlugin(pluginsDir, id) {
  const targetDir = safeJoin(pluginsDir, id);
  if (fs.existsSync(targetDir)) fs.rmSync(targetDir, { recursive: true, force: true });
  return true;
}

export function listInstalledPlugins(pluginsDir) {
  if (!fs.existsSync(pluginsDir)) return [];
  return fs
    .readdirSync(pluginsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const manifestFile = path.join(pluginsDir, entry.name, 'manifest.json');
      if (!fs.existsSync(manifestFile)) return null;
      try {
        return { ...JSON.parse(fs.readFileSync(manifestFile, 'utf8')), path: path.join(pluginsDir, entry.name) };
      } catch (err) {
        return null;
      }
    })
    .filter(Boolean);
}
