const ONE_DAY = 1000 * 60 * 60 * 24;

// 统一搜索合同：兼容 V1/V2 查询参数与原版 filterRules 条件形状。
const TYPE_GROUPS = {
  image: new Set(['ai', 'bmp', 'cr2', 'dng', 'gif', 'heic', 'heif', 'ico', 'jpeg', 'jpg', 'nef', 'png', 'psd', 'raw', 'svg', 'tif', 'tiff', 'webp']),
  video: new Set(['avi', 'flv', 'm4v', 'mkv', 'mov', 'mp4', 'mpeg', 'mpg', 'webm', 'wmv']),
  audio: new Set(['aac', 'flac', 'm4a', 'mp3', 'ogg', 'wav', 'wma']),
  font: new Set(['eot', 'otf', 'ttf', 'woff', 'woff2']),
};

function normalizeArrayValue(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    if (value.startsWith('[')) {
      try {
        return JSON.parse(value);
      } catch (err) {
        return value.split(',').map((entry) => entry.trim()).filter(Boolean);
      }
    }
    return value.split(',').map((entry) => entry.trim()).filter(Boolean);
  }
  return [];
}

function parseColor(value) {
  if (Array.isArray(value)) return value.slice(0, 3).map(Number);
  const text = String(value || '').trim();
  if (text.startsWith('#')) {
    const hex = text.replace('#', '');
    if (hex.length === 6) {
      return [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)];
    }
  }
  const parts = text.split(',').map(Number);
  return parts.length >= 3 ? parts.slice(0, 3) : null;
}

function colorMatches(item, target, accuracy = 20) {
  const palettes = item.palettes || [];
  const threshold = Math.max(0, Number(accuracy) || 20);
  return palettes.some((palette) => {
    const color = Array.isArray(palette) ? palette : palette && palette.color;
    return Array.isArray(color) && color.length >= 3 &&
      Math.abs(Number(color[0]) - Number(target[0])) <= threshold &&
      Math.abs(Number(color[1]) - Number(target[1])) <= threshold &&
      Math.abs(Number(color[2]) - Number(target[2])) <= threshold;
  });
}

function isGrayItem(item) {
  const palettes = item.palettes || [];
  if (!Array.isArray(palettes) || palettes.length === 0) return false;
  return palettes.every((palette) => {
    const color = Array.isArray(palette) ? palette : palette && palette.color;
    return Array.isArray(color) && color.length >= 3 &&
      Math.abs(Number(color[0]) - Number(color[1])) <= 8 &&
      Math.abs(Number(color[1]) - Number(color[2])) <= 8;
  });
}

function includesText(value, keyword) {
  if (!keyword) return true;
  return String(value || '').toLowerCase().includes(String(keyword).toLowerCase());
}

function hasText(value) {
  return Boolean(String(value || '').trim());
}

function inRange(value, min, max) {
  const numeric = Number(value);
  if (min !== undefined && min !== null && !Number.isNaN(Number(min)) && numeric < Number(min)) return false;
  if (max !== undefined && max !== null && !Number.isNaN(Number(max)) && numeric > Number(max)) return false;
  return true;
}

function fileSizeInBytes(value, unit) {
  const size = Number(value);
  if (Number.isNaN(size)) return NaN;
  const normalized = String(unit || 'b').toLowerCase();
  if (normalized === 'kb') return size * 1024;
  if (normalized === 'mb') return size * 1024 * 1024;
  if (normalized === 'gb') return size * 1024 * 1024 * 1024;
  return size;
}

function matchesDateRule(timestamp, rule = {}) {
  if (!rule || typeof rule !== 'object') return true;
  const value = Number(timestamp);
  const now = Date.now();
  const type = rule.type;
  if (type && type !== 'undefined') {
    switch (type) {
      case 'today':
        return now - value < ONE_DAY;
      case 'yesterday':
        return now - value >= ONE_DAY && now - value < 2 * ONE_DAY;
      case '7day':
        return now - value < 7 * ONE_DAY;
      case '30day':
        return now - value < 30 * ONE_DAY;
      case '90day':
        return now - value < 90 * ONE_DAY;
      case '183day':
        return now - value < 183 * ONE_DAY;
      case '365day':
        return now - value < 365 * ONE_DAY;
      case 'range': {
        const range = Array.isArray(rule.range) ? rule.range : [];
        if (Number(range[0]) && Number(range[1])) {
          return Number(range[0]) <= value && value <= Number(range[1]) + ONE_DAY;
        }
        return true;
      }
      default:
        return true;
    }
  }
  if (rule.today) return now - value < ONE_DAY;
  if (rule.yesterday) return now - value >= ONE_DAY && now - value < 2 * ONE_DAY;
  if (rule.last7day) return now - value < 7 * ONE_DAY;
  if (rule.last30day) return now - value < 30 * ONE_DAY;
  if (rule.last90day) return now - value < 90 * ONE_DAY;
  if (rule.last365day) return now - value < 365 * ONE_DAY;
  return true;
}

function shapeMatches(item, rule = {}) {
  const width = Number(item.width);
  const height = Number(item.height);
  if (!width || !height) return true;
  const ratio = width / height;
  const checks = [];
  if (rule.portrait) checks.push(height > width);
  if (rule.landscape) checks.push(width > height);
  if (rule.square) checks.push(Math.abs(width - height) <= 1);
  if (rule.panoramicPortrait) checks.push(ratio < 9 / 16);
  if (rule.panoramicLandscape) checks.push(ratio > 16 / 9);
  if (rule['43']) checks.push(Math.abs(ratio - 4 / 3) < 0.05);
  if (rule['34']) checks.push(Math.abs(ratio - 3 / 4) < 0.05);
  if (rule['169']) checks.push(Math.abs(ratio - 16 / 9) < 0.05);
  if (rule['916']) checks.push(Math.abs(ratio - 9 / 16) < 0.05);
  if (rule.custom && Number(rule.width) && Number(rule.height)) {
    checks.push(Math.abs(ratio - Number(rule.width) / Number(rule.height)) < 0.05);
  }
  return checks.length === 0 || checks.some(Boolean);
}

function matchesFilterRules(item, filters = {}) {
  if (!filters || typeof filters !== 'object') return true;

  // 原版筛选器会把条件写入 eagle.filter.filterRules，这里按同一结构映射到后端。
  const typeRule = filters.type || {};
  const typeIncludes = Array.isArray(typeRule.includes) ? typeRule.includes : Object.keys(typeRule.includes || {});
  const typeExcludes = Array.isArray(typeRule.excludes) ? typeRule.excludes : Object.keys(typeRule.excludes || {});
  const ext = String(item.ext || item.medium || '').toLowerCase();
  if (typeIncludes.length > 0 && !typeIncludes.map((value) => String(value).toLowerCase()).includes(ext)) return false;
  if (typeExcludes.map((value) => String(value).toLowerCase()).includes(ext)) return false;

  const tagRule = filters.tag || {};
  const tags = item.tags || [];
  const tagIncludes = Array.isArray(tagRule.includes) ? tagRule.includes : [];
  const tagExcludes = Array.isArray(tagRule.excludes) ? tagRule.excludes : [];
  if (tagRule.no && tags.length > 0) return false;
  if (tagIncludes.length > 0) {
    const logic = String(tagRule.logic || 'OR').toUpperCase();
    const matched = logic === 'AND'
      ? tagIncludes.every((tag) => tags.includes(tag))
      : tagIncludes.some((tag) => tags.includes(tag));
    if (!matched) return false;
  }
  if (tagExcludes.some((tag) => tags.includes(tag))) return false;

  const folderRule = filters.folder || {};
  const folders = item.folders || [];
  const folderIncludes = Array.isArray(folderRule.includes) ? folderRule.includes : Object.keys(folderRule.includes || {});
  const folderExcludes = Array.isArray(folderRule.excludes) ? folderRule.excludes : Object.keys(folderRule.excludes || {});
  if (folderIncludes.length > 0 && !folderIncludes.some((folderId) => folders.includes(folderId))) return false;
  if (folderExcludes.some((folderId) => folders.includes(folderId))) return false;

  const ratingRule = filters.rating || {};
  const selectedRatings = Object.keys(ratingRule).filter((key) => ratingRule[key]);
  if (selectedRatings.length > 0 && !selectedRatings.includes(String(item.star ?? ''))) return false;

  const colorRule = filters.color || {};
  if (colorRule.gray && !isGrayItem(item)) return false;
  if (colorRule.value) {
    const target = parseColor(colorRule.value);
    if (!target || !colorMatches(item, target, colorRule.accuracy)) return false;
  }

  const resolution = filters.resolution || {};
  if (resolution.minW !== undefined && Number(item.width) < Number(resolution.minW)) return false;
  if (resolution.maxW !== undefined && Number(item.width) > Number(resolution.maxW)) return false;
  if (resolution.minH !== undefined && Number(item.height) < Number(resolution.minH)) return false;
  if (resolution.maxH !== undefined && Number(item.height) > Number(resolution.maxH)) return false;

  const file = filters.file || {};
  if (file.min !== undefined && Number.isFinite(fileSizeInBytes(file.min, file.unit)) && Number(item.size) < fileSizeInBytes(file.min, file.unit)) return false;
  if (file.max !== undefined && Number.isFinite(fileSizeInBytes(file.max, file.unit)) && Number(item.size) > fileSizeInBytes(file.max, file.unit)) return false;

  const duration = filters.duration || {};
  if (!inRange(item.duration, duration.min, duration.max)) return false;
  const bpm = filters.bpm || {};
  if (!inRange(item.bpm, bpm.min, bpm.max)) return false;

  const annotation = filters.annotation || {};
  const comments = Array.isArray(item.comments) ? item.comments : [];
  const commentText = comments.map((comment) => comment.text || comment.annotation || '').join(' ');
  if (annotation.has && comments.length === 0) return false;
  if (annotation.no && comments.length > 0) return false;
  if (annotation.keywords && !includesText(commentText, annotation.keywords)) return false;

  const note = filters.note || {};
  if (note.has && !hasText(item.annotation)) return false;
  if (note.no && hasText(item.annotation)) return false;
  if (note.keywords && !includesText(item.annotation, note.keywords)) return false;

  const url = filters.url || {};
  if (url.has && !hasText(item.url)) return false;
  if (url.no && hasText(item.url)) return false;
  if (url.keywords && !includesText(item.url, url.keywords)) return false;

  if (!matchesDateRule(item.modificationTime, filters.import || {})) return false;
  if (!matchesDateRule(item.modificationTime, filters.mtime || {})) return false;
  if (!shapeMatches(item, filters.shape || {})) return false;

  return true;
}

function matchesSimpleQuery(item, query = {}) {
  const keyword = String(query.keyword || query.search || '').toLowerCase();
  if (keyword) {
    const haystack = [
      item.name,
      item.annotation,
      item.url,
      (item.tags || []).join(' '),
      (item.comments || []).map((comment) => comment.text || comment.annotation || '').join(' '),
      (item.folders || []).join(' '),
    ].filter(Boolean).join(' ').toLowerCase();
    if (!haystack.includes(keyword)) return false;
  }

  const name = String(query.name || '').toLowerCase();
  if (name && !String(item.name || '').toLowerCase().includes(name)) return false;

  const tags = normalizeArrayValue(query.tags);
  if (tags.length > 0 && !tags.every((tag) => (item.tags || []).includes(tag))) return false;

  const folders = normalizeArrayValue(query.folders || query.folderIDs);
  if (folders.length > 0 && !folders.some((folderId) => (item.folders || []).includes(folderId))) return false;

  const star = Number(query.star);
  if (star && Number(item.star) !== star) return false;
  const rating = query.rating;
  if (rating && typeof rating === 'object' && !Array.isArray(rating)) {
    const selectedRatings = Object.keys(rating).filter((key) => rating[key]);
    if (selectedRatings.length > 0 && !selectedRatings.includes(String(item.star ?? ''))) return false;
  } else if (rating !== undefined && rating !== '') {
    const ratingValue = Number(rating);
    if (ratingValue && Number(item.star) !== ratingValue) return false;
  }

  const ext = String(query.ext || '').toLowerCase();
  if (ext && String(item.ext || item.medium || '').toLowerCase() !== ext) return false;

  const type = String(query.type || '').toLowerCase();
  if (type && type !== 'undefined') {
    const actualExt = String(item.ext || item.medium || '').toLowerCase();
    const group = TYPE_GROUPS[type];
    if (group) {
      if (!group.has(actualExt)) return false;
    } else if (actualExt !== type) {
      return false;
    }
  }

  const colors = query.colors ? normalizeArrayValue(query.colors) : query.color ? [query.color] : [];
  const parsedColors = colors.map(parseColor).filter(Boolean);
  if (parsedColors.length > 0 && !parsedColors.some((color) => colorMatches(item, color, query.colorAccuracy))) return false;

  if (!inRange(item.width, query.minWidth, query.maxWidth)) return false;
  if (!inRange(item.height, query.minHeight, query.maxHeight)) return false;
  if (!inRange(item.size, query.sizeMin, query.sizeMax)) return false;

  const dateFrom = query.dateFrom ? new Date(String(query.dateFrom)).getTime() : query.importFrom ? new Date(String(query.importFrom)).getTime() : NaN;
  const dateTo = query.dateTo ? new Date(String(query.dateTo)).getTime() : query.importTo ? new Date(String(query.importTo)).getTime() : NaN;
  if (!Number.isNaN(dateFrom) && Number(item.modificationTime) < dateFrom) return false;
  if (!Number.isNaN(dateTo) && Number(item.modificationTime) > dateTo) return false;

  const mtimeFrom = query.mtimeFrom ? new Date(String(query.mtimeFrom)).getTime() : NaN;
  const mtimeTo = query.mtimeTo ? new Date(String(query.mtimeTo)).getTime() : NaN;
  if (!Number.isNaN(mtimeFrom) && Number(item.lastModified || item.modificationTime) < mtimeFrom) return false;
  if (!Number.isNaN(mtimeTo) && Number(item.lastModified || item.modificationTime) > mtimeTo) return false;

  const commentsKeyword = String(query.comments || '').toLowerCase();
  const commentText = (item.comments || []).map((comment) => comment.text || comment.annotation || '').join(' ').toLowerCase();
  if (commentsKeyword && !commentText.includes(commentsKeyword)) return false;
  if ((query.hasComment === 'true' || query.hasComment === true) && (item.comments || []).length === 0) return false;
  if ((query.hasAnnotation === 'true' || query.hasAnnotation === true) && !hasText(item.annotation)) return false;
  if ((query.hasUrl === 'true' || query.hasUrl === true || query.urlRequired === 'true' || query.urlRequired === true) && !hasText(item.url)) return false;

  const deletedRaw = query.isDeleted;
  const isDeleted = deletedRaw === 'true' || deletedRaw === true
    ? true
    : deletedRaw === 'false' || deletedRaw === false
      ? false
      : undefined;
  if (isDeleted !== undefined && Boolean(item.isDeleted) !== isDeleted) return false;

  return true;
}

export function searchItems(items, query = {}) {
  const filters = query.filters && typeof query.filters === 'object' ? query.filters : {};
  const filtered = (items || []).filter((item) => matchesSimpleQuery(item, query) && matchesFilterRules(item, filters));

  const sortBy = String(query.sortBy || '');
  const sortIncrease = query.sortIncrease === 'true' || query.sortIncrease === true;
  if (sortBy) {
    filtered.sort((a, b) => {
      const left = a[sortBy] ?? '';
      const right = b[sortBy] ?? '';
      const result = typeof left === 'number' && typeof right === 'number' ? left - right : String(left).localeCompare(String(right));
      return sortIncrease ? result : -result;
    });
  }
  return filtered;
}

export function filterItems(items, query = {}) {
  return searchItems(items, query);
}

export function searchItemsByFilterRules(items, rules = {}, query = {}) {
  return searchItems(items, { ...query, filters: rules });
}
