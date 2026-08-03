const imageExtensions = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'tif', 'tiff', 'heic', 'raw', 'cr2', 'nef', 'arw']);
const videoExtensions = new Set(['mp4', 'webm', 'mov', 'mkv', 'avi', 'm4v']);
const audioExtensions = new Set(['mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a', 'wma']);
const fontExtensions = new Set(['ttf', 'otf', 'woff', 'woff2']);
const modelExtensions = new Set(['obj', 'glb', 'gltf', 'stl', 'ply', 'fbx', '3ds', 'dae']);
const textExtensions = new Set(['txt', 'md', 'json', 'csv', 'log', 'rtf']);
const documentExtensions = new Set(['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx']);
const archiveExtensions = new Set(['zip', 'rar', '7z', 'tar', 'gz', 'eaglepack']);

export function detectMediaType(item) {
  const ext = String(item.ext || '').toLowerCase();
  if (imageExtensions.has(ext)) return { type: 'image', label: 'Image' };
  if (videoExtensions.has(ext)) return { type: 'video', label: 'Video' };
  if (audioExtensions.has(ext)) return { type: 'audio', label: 'Audio' };
  if (fontExtensions.has(ext)) return { type: 'font', label: 'Font' };
  if (modelExtensions.has(ext)) return { type: 'model', label: '3D Model' };
  if (textExtensions.has(ext)) return { type: 'text', label: 'Text' };
  if (documentExtensions.has(ext)) return { type: 'document', label: 'Document' };
  if (archiveExtensions.has(ext)) return { type: 'archive', label: 'Archive' };
  return { type: 'other', label: 'Other' };
}

export function getMediaInfo(library, item) {
  return {
    id: item.id,
    name: item.name,
    ext: item.ext,
    size: item.size,
    width: item.width,
    height: item.height,
    ...detectMediaType(item),
    viewer: detectMediaType(item).type === 'image' ? 'preview-window' : detectMediaType(item).type,
  };
}
