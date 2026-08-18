import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const THUMBNAIL_MAX_SIZE = 320;

export class SourceThumbnailService {
  constructor(db) {
    this.db = db;
  }

  thumbnailPath(asset) {
    return path.join(this.db.thumbsPath, `${asset.id}.png`);
  }

  async ensureThumbnail(asset) {
    if (!asset || asset.missing) return null;
    const target = this.thumbnailPath(asset);
    if (fs.existsSync(target)) return target;
    if (asset.kind !== 'image') return null;
    try {
      const input = await sharp(asset.absolutePath, { failOn: 'none' })
        .rotate()
        .resize(THUMBNAIL_MAX_SIZE, THUMBNAIL_MAX_SIZE, { fit: 'inside', withoutEnlargement: true })
        .png()
        .toBuffer();
      fs.writeFileSync(target, input);
      return target;
    } catch (err) {
      console.warn('[source-thumbnails] image thumbnail failed:', asset.absolutePath, err && err.message);
      return null;
    }
  }

  isBrowserRenderableImage(asset) {
    return asset && asset.kind === 'image' && ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg', 'avif'].includes(asset.ext);
  }

  originalPath(asset) {
    if (!asset || asset.missing || !fs.existsSync(asset.absolutePath)) return null;
    return asset.absolutePath;
  }
}
