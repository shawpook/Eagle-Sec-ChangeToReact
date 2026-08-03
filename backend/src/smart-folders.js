function getField(item, field) {
  if (field === 'tags' || field === 'folders') return item[field] || [];
  return item[field];
}

function matchesRule(item, rule = {}) {
  const field = rule.field;
  const operator = rule.operator || '=';
  const value = rule.value;
  const actual = getField(item, field);

  if (operator === 'exists') return actual !== undefined && actual !== null && actual !== '';
  if (operator === 'not exists') return actual === undefined || actual === null || actual === '';

  if (Array.isArray(actual)) {
    if (operator === 'contains') return actual.includes(value);
    if (operator === 'not contains') return !actual.includes(value);
    if (operator === 'in') return value.some((entry) => actual.includes(entry));
    return actual.includes(value);
  }

  if (typeof actual === 'number' || typeof value === 'number' || !Number.isNaN(Number(value))) {
    const left = Number(actual);
    const right = Number(value);
    if (Number.isNaN(left) || Number.isNaN(right)) return false;
    switch (operator) {
      case '>':
        return left > right;
      case '<':
        return left < right;
      case '>=':
        return left >= right;
      case '<=':
        return left <= right;
      case '!=':
        return left !== right;
      default:
        return left === right;
    }
  }

  const left = String(actual || '');
  const right = String(value || '');
  switch (operator) {
    case 'contains':
      return left.toLowerCase().includes(right.toLowerCase());
    case 'not contains':
      return !left.toLowerCase().includes(right.toLowerCase());
    case '!=':
      return left !== right;
    default:
      return left === right;
  }
}

export function smartFolderMatches(smartFolder, item) {
  const conditions = Array.isArray(smartFolder.conditions) ? smartFolder.conditions : [];
  if (conditions.length === 0) return false;
  return conditions.every((rule) => matchesRule(item, rule));
}

export function getSmartFolderItems(library, smartFolder) {
  return library.items.filter((item) => smartFolderMatches(smartFolder, item));
}
