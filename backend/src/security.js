import path from 'node:path';

export function isLocalRequest(req) {
  const host = String(req.headers.host || '').split(':')[0].toLowerCase();
  return host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '0.0.0.0';
}

export function getRequestToken(req) {
  return req.query.token || req.body?.token || '';
}

export function safeResolve(root, target) {
  const resolvedRoot = path.resolve(root);
  const resolvedTarget = path.resolve(resolvedRoot, String(target || ''));
  if (resolvedTarget !== resolvedRoot && !resolvedTarget.startsWith(resolvedRoot + path.sep)) {
    throw new Error(`Unsafe path: ${target}`);
  }
  return resolvedTarget;
}
