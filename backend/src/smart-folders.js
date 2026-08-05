// 原版智能文件夹条件执行器：按 conditions[].rules[] 结构在真实条目上求值。
const ONE_DAY = 1000 * 60 * 60 * 24;

const TYPE_GROUPS = {
  video: new Set(['avi', 'flv', 'm4v', 'mkv', 'mov', 'mp4', 'mpeg', 'mpg', 'webm', 'wmv']),
  audio: new Set(['aac', 'flac', 'm4a', 'mp3', 'ogg', 'wav', 'wma']),
  font: new Set(['eot', 'otf', 'ttf', 'woff', 'woff2']),
  image: new Set(['ai', 'bmp', 'cr2', 'dng', 'gif', 'heic', 'heif', 'ico', 'jpeg', 'jpg', 'nef', 'png', 'psd', 'raw', 'svg', 'tif', 'tiff', 'webp']),
};

function lower(value) {
  return String(value == null ? '' : value).toLowerCase();
}

function paletteColor(palette) {
  return Array.isArray(palette) ? palette : palette && palette.color;
}

function colorMatches(item, target, accuracy = 20) {
  const threshold = Math.max(0, Number(accuracy) || 20);
  return (item.palettes || []).some((palette) => {
    const color = paletteColor(palette);
    return Array.isArray(color) && color.length >= 3 &&
      Math.abs(Number(color[0]) - Number(target[0])) <= threshold &&
      Math.abs(Number(color[1]) - Number(target[1])) <= threshold &&
      Math.abs(Number(color[2]) - Number(target[2])) <= threshold;
  });
}

function parseColor(value) {
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

function isGrayItem(item) {
  const palettes = item.palettes || [];
  if (palettes.length === 0) return false;
  return palettes.every((palette) => {
    const color = paletteColor(palette);
    return Array.isArray(color) && color.length >= 3 &&
      Math.abs(Number(color[0]) - Number(color[1])) <= 8 &&
      Math.abs(Number(color[1]) - Number(color[2])) <= 8;
  });
}

function commentsText(item) {
  return (item.comments || []).map((comment) => comment.text || comment.annotation || '').join(' ');
}

function folderNames(item, library) {
  const names = [];
  for (const folderId of item.folders || []) {
    const folder = library && library.folders ? findInTree(library.folders, folderId) : null;
    if (folder) names.push(folder.name);
  }
  return names.join(' ');
}

function findInTree(tree, id) {
  for (const node of tree || []) {
    if (node.id === id) return node;
    const child = findInTree(node.children || [], id);
    if (child) return child;
  }
  return null;
}

function stringValue(item, property, library) {
  switch (property) {
    case 'name': return item.name;
    case 'url': return item.url;
    case 'annotation': return item.annotation;
    case 'comments': return commentsText(item);
    case 'camera': return (item.rawMetas && item.rawMetas.camera) || item.camera || '';
    case 'folderName': return folderNames(item, library);
    default: return item[property] == null ? '' : String(item[property]);
  }
}

function numericValue(item, property) {
  switch (property) {
    case 'fileSize': return Number(item.size);
    case 'duration': return Number(item.duration);
    case 'bpm': return Number(item.bpm);
    case 'width': return Number(item.width);
    case 'height': return Number(item.height);
    case 'iso':
    case 'aperture':
    case 'focalLength':
    case 'shutter':
      return Number((item.rawMetas && item.rawMetas[property]) || item[property]);
    default: return Number(item[property]);
  }
}

function dateValue(item, property) {
  switch (property) {
    case 'mtime':
    case 'btime':
    case 'timestamp':
      return Number(item.lastModified || item.modificationTime);
    default:
      return Number(item.modificationTime);
  }
}

function setValue(item, property) {
  if (property === 'tags') return item.tags || [];
  if (property === 'folders') return item.folders || [];
  return [];
}

function compareString(actual, method, value) {
  const text = lower(actual);
  const target = lower(value);
  switch (method) {
    case 'equal': return text === target;
    case 'startWith': return text.startsWith(target);
    case 'endWith': return text.endsWith(target);
    case 'contain': return text.includes(target);
    case 'uncontain': return !text.includes(target);
    case 'empty': return !text;
    case 'not-empty': return Boolean(text);
    case 'regex':
      try { return new RegExp(target).test(text); } catch (err) { return false; }
    default: return false;
  }
}

function compareNumeric(actual, method, value) {
  if (!Number.isFinite(actual)) return false;
  const values = Array.isArray(value) ? value.map(Number) : [Number(value)];
  const left = values[0];
  switch (method) {
    case '=': return actual === left;
    case '>=': return actual >= left;
    case '<=': return actual <= left;
    case '>': return actual > left;
    case '<': return actual < left;
    case 'between': return Number.isFinite(values[1]) && actual >= left && actual <= values[1];
    default: return false;
  }
}

function compareDate(actual, method, value) {
  if (!Number.isFinite(actual)) return false;
  const values = Array.isArray(value) ? value.map(Number) : [Number(value)];
  const left = values[0];
  switch (method) {
    case 'on': {
      const date = new Date(left);
      const target = new Date(actual);
      return date.getFullYear() === target.getFullYear() &&
        date.getMonth() === target.getMonth() &&
        date.getDate() === target.getDate();
    }
    case 'before': return actual < left;
    case 'after': return actual > left;
    case 'between': return Number.isFinite(values[1]) && actual >= left && actual <= values[1] + ONE_DAY;
    case 'within': return Number.isFinite(left) && actual >= Date.now() - left * ONE_DAY;
    default: return false;
  }
}

function compareSet(actual, method, value) {
  const left = Array.isArray(actual) ? actual : [];
  const right = Array.isArray(value) ? value : [];
  switch (method) {
    case 'union': return right.some((entry) => left.includes(entry));
    case 'intersection': return right.length > 0 && right.every((entry) => left.includes(entry));
    case 'equal':
    case 'identity': {
      const a = [...new Set(left)];
      const b = [...new Set(right)];
      return a.length === b.length && a.every((entry) => b.includes(entry));
    }
    case 'empty': return left.length === 0;
    case 'not-empty': return left.length > 0;
    default: return false;
  }
}

function shapeName(item) {
  const width = Number(item.width);
  const height = Number(item.height);
  if (!width || !height) return '';
  const ratio = width / height;
  if (Math.abs(width - height) <= 1) return 'square';
  if (ratio > 16 / 9) return 'panoramic-landscape';
  if (ratio < 9 / 16) return 'panoramic-portrait';
  return ratio > 1 ? 'landscape' : 'portrait';
}

function compareSpecial(item, rule, library) {
  const value = rule.value;
  switch (rule.property) {
    case 'type': {
      const actualExt = lower(item.ext || item.medium || '');
      const group = TYPE_GROUPS[value];
      const actual = group ? group.has(actualExt) : actualExt === lower(value);
      return rule.method === 'unequal' ? !actual : actual;
    }
    case 'rating': {
      const actual = String(item.star == null ? 'none' : item.star);
      if (rule.method === 'contain') return String(value) === actual;
      return rule.method === 'unequal' ? String(value) !== actual : String(value) === actual;
    }
    case 'shape': {
      const actual = shapeName(item);
      if (value === 'custom' && Number(rule.width) && Number(rule.height)) {
        const ratio = Number(item.width) / Number(item.height);
        const custom = Math.abs(ratio - Number(rule.width) / Number(rule.height)) < 0.05;
        return rule.method === 'unequal' ? !custom : custom;
      }
      return rule.method === 'unequal' ? actual !== value : actual === value;
    }
    case 'color': {
      if (rule.method === 'grayscale') return isGrayItem(item);
      const target = parseColor(value);
      if (!target) return false;
      const accuracy = Number(rule.accuracy || rule.value) || 20;
      return colorMatches(item, target, accuracy);
    }
    case 'fontActivated':
      return rule.method === 'activate' ? Boolean(item.fontMetas) : !item.fontMetas;
    default:
      return false;
  }
}

function matchesRule(item, rule, library) {
  // 按原版 property/method/value 合同映射到条目字段，避免用假成功替代真实筛选。
  if (!rule || !rule.property) return false;
  const def = {
    STRING: ['name', 'url', 'annotation', 'comments', 'camera', 'folderName'],
    NUMERIC: ['width', 'height', 'iso', 'aperture', 'focalLength', 'shutter', 'bpm'],
    NUMERIC_WITH_UNIT: ['fileSize', 'duration'],
    DATE: ['createTime', 'mtime', 'btime', 'timestamp'],
    SET: ['tags', 'folders'],
    SPECIAL: ['type', 'rating', 'shape', 'color', 'fontActivated'],
  };
  const property = rule.property;
  if (def.STRING.includes(property)) return compareString(stringValue(item, property, library), rule.method, rule.value);
  if (def.NUMERIC.includes(property) || def.NUMERIC_WITH_UNIT.includes(property)) {
    const value = rule.value;
    const normalized = Array.isArray(value) ? value : [value];
    if (def.NUMERIC_WITH_UNIT.includes(property)) {
      if (property === 'fileSize' && rule.unit) {
        const unit = lower(rule.unit);
        const multiplier = unit === 'mb' ? 1024 * 1024 : unit === 'kb' ? 1024 : unit === 'h' ? 60 * 60 * 1000 : unit === 'm' ? 60 * 1000 : 1;
        const scaled = normalized.map((entry) => Number(entry) * multiplier);
        return compareNumeric(numericValue(item, property), rule.method, scaled);
      }
      if (property === 'duration' && rule.unit) {
        const unit = lower(rule.unit);
        const multiplier = unit === 'h' ? 3600 : unit === 'm' ? 60 : 1;
        return compareNumeric(numericValue(item, property), rule.method, normalized.map((entry) => Number(entry) * multiplier));
      }
    }
    return compareNumeric(numericValue(item, property), rule.method, normalized);
  }
  if (def.DATE.includes(property)) return compareDate(dateValue(item, property), rule.method, rule.value);
  if (def.SET.includes(property)) return compareSet(setValue(item, property), rule.method, rule.value);
  if (def.SPECIAL.includes(property)) return compareSpecial(item, rule, library);
  return false;
}

function matchesCondition(item, condition, library) {
  const rules = condition.rules || [];
  if (rules.length === 0) return false;
  const match = condition.match === 'AND' ? 'AND' : 'OR';
  const result = match === 'AND'
    ? rules.every((rule) => matchesRule(item, rule, library))
    : rules.some((rule) => matchesRule(item, rule, library));
  return condition.boolean === 'FALSE' ? !result : result;
}

export function smartFolderMatches(smartFolder, item, library = null) {
  const conditions = Array.isArray(smartFolder.conditions) ? smartFolder.conditions : [];
  if (conditions.length === 0) return false;
  return conditions.every((condition) => matchesCondition(item, condition, library));
}

export function getSmartFolderItems(library, smartFolder) {
  return (library.items || []).filter((item) => smartFolderMatches(smartFolder, item, library));
}
