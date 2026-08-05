// 智能文件夹规则合同，来源为原版 smart-folder-rules.js 的可序列化规则定义。
const STRING_METHODS = ['equal', 'startWith', 'endWith', 'contain', 'uncontain', 'empty', 'not-empty', 'regex'];
const NUMERIC_METHODS = ['=', '>=', '<=', '>', '<', 'between'];
const DATE_METHODS = ['on', 'before', 'after', 'between', 'within'];
const SET_METHODS = ['union', 'intersection', 'equal', 'identity', 'empty', 'not-empty'];

const PROPERTY_RULES = {
  name: { category: 'STRING', methods: STRING_METHODS, valueType: 'string', noValueMethods: ['empty', 'not-empty'] },
  url: { category: 'STRING', methods: STRING_METHODS, valueType: 'string', noValueMethods: ['empty', 'not-empty'] },
  annotation: { category: 'STRING', methods: STRING_METHODS, valueType: 'string', noValueMethods: ['empty', 'not-empty'] },
  comments: { category: 'STRING', methods: STRING_METHODS, valueType: 'string', noValueMethods: ['empty', 'not-empty'] },
  camera: { category: 'STRING', methods: STRING_METHODS, valueType: 'string', noValueMethods: ['empty', 'not-empty'] },
  folderName: { category: 'STRING', methods: STRING_METHODS, valueType: 'string', noValueMethods: ['empty', 'not-empty'] },

  width: { category: 'NUMERIC', methods: NUMERIC_METHODS, valueType: 'number_pair' },
  height: { category: 'NUMERIC', methods: NUMERIC_METHODS, valueType: 'number_pair' },
  iso: { category: 'NUMERIC', methods: NUMERIC_METHODS, valueType: 'number_pair' },
  aperture: { category: 'NUMERIC', methods: NUMERIC_METHODS, valueType: 'number_pair' },
  focalLength: { category: 'NUMERIC', methods: NUMERIC_METHODS, valueType: 'number_pair' },
  shutter: { category: 'NUMERIC', methods: NUMERIC_METHODS, valueType: 'number_pair' },
  bpm: { category: 'NUMERIC', methods: NUMERIC_METHODS, valueType: 'number_pair' },

  fileSize: {
    category: 'NUMERIC_WITH_UNIT',
    methods: NUMERIC_METHODS,
    valueType: 'number_pair',
    extraFields: { unit: { options: ['kb', 'mb'], required: true } },
  },
  duration: {
    category: 'NUMERIC_WITH_UNIT',
    methods: NUMERIC_METHODS,
    valueType: 'number_pair',
    extraFields: { unit: { options: ['s', 'm', 'h'], required: true } },
  },

  createTime: { category: 'DATE', methods: DATE_METHODS, valueType: 'number_pair' },
  mtime: { category: 'DATE', methods: DATE_METHODS, valueType: 'number_pair' },
  btime: { category: 'DATE', methods: DATE_METHODS, valueType: 'number_pair' },
  timestamp: { category: 'DATE', methods: DATE_METHODS, valueType: 'number_pair' },

  tags: { category: 'SET', methods: SET_METHODS, valueType: 'string_array', noValueMethods: ['empty', 'not-empty'] },
  folders: { category: 'SET', methods: SET_METHODS, valueType: 'string_array', noValueMethods: ['empty', 'not-empty'] },

  type: {
    category: 'SPECIAL',
    methods: ['equal', 'unequal'],
    valueType: 'string',
    options: ['video', 'audio', 'font', 'jpg', 'png', 'gif', 'svg', 'psd', 'ai', 'pdf', 'bmp', 'ico', 'tif', 'webp', 'avif', 'base', 'raw', 'riff', 'office'],
  },
  rating: {
    category: 'SPECIAL',
    methods: ['equal', 'unequal', 'contain'],
    valueType: 'string',
    options: ['none', '1', '2', '3', '4', '5'],
  },
  shape: {
    category: 'SPECIAL',
    methods: ['equal', 'unequal'],
    valueType: 'string',
    options: ['landscape', 'portrait', 'square', 'panoramic-landscape', 'panoramic-portrait', 'custom'],
    extraFields: {
      width: { type: 'number', requiredWhen: 'custom' },
      height: { type: 'number', requiredWhen: 'custom' },
    },
  },
  color: {
    category: 'SPECIAL',
    methods: ['similar', 'accuracy', 'grayscale'],
    valueType: 'string',
    noValueMethods: ['grayscale'],
  },
  fontActivated: {
    category: 'SPECIAL',
    methods: ['activate', 'deactivate'],
    valueType: null,
  },
};

export function validateRule(rule) {
  if (!rule || !rule.property || !PROPERTY_RULES[rule.property]) {
    return { valid: false, error: `invalid property: ${rule && rule.property}. Valid properties: ${Object.keys(PROPERTY_RULES).join(', ')}` };
  }
  const def = PROPERTY_RULES[rule.property];
  if (!rule.method || !def.methods.includes(rule.method)) {
    return { valid: false, error: `invalid method '${rule.method}' for property '${rule.property}'` };
  }
  if (def.noValueMethods && def.noValueMethods.includes(rule.method)) return { valid: true };
  if (def.valueType === null) return { valid: true };
  if (rule.value === undefined || rule.value === null) {
    return { valid: false, error: `value is required for property '${rule.property}' with method '${rule.method}'` };
  }
  if (def.valueType === 'string' && typeof rule.value !== 'string') {
    return { valid: false, error: `value must be a string for property '${rule.property}'` };
  }
  if (def.valueType === 'number_pair') {
    const values = Array.isArray(rule.value) ? rule.value : [rule.value];
    if (rule.method === 'between' && values.length < 2) {
      return { valid: false, error: `value must be [number, number] for property '${rule.property}' with method 'between'` };
    }
    if (!values.every((entry) => typeof entry === 'number')) {
      return { valid: false, error: `value must be numbers for property '${rule.property}'` };
    }
  }
  if (def.valueType === 'string_array' && (!Array.isArray(rule.value) || !rule.value.every((entry) => typeof entry === 'string'))) {
    return { valid: false, error: `value must be an array of strings for property '${rule.property}'` };
  }
  if (def.extraFields) {
    for (const [fieldName, fieldDef] of Object.entries(def.extraFields)) {
      if (fieldDef.required && (rule[fieldName] === undefined || (fieldDef.options && !fieldDef.options.includes(rule[fieldName])))) {
        return { valid: false, error: `'${fieldName}' is required for property '${rule.property}'` };
      }
      if (fieldDef.requiredWhen && rule.value === fieldDef.requiredWhen && (typeof rule[fieldName] !== 'number')) {
        return { valid: false, error: `'${fieldName}' (number) is required for property '${rule.property}' when value is '${fieldDef.requiredWhen}'` };
      }
    }
  }
  return { valid: true };
}

export function validateConditions(conditions) {
  if (!Array.isArray(conditions) || conditions.length === 0) throw new Error('conditions must be a non-empty array');
  if (conditions.length > 30) throw new Error('max 30 conditions');
  for (const condition of conditions) {
    if (!condition.rules || !Array.isArray(condition.rules) || condition.rules.length === 0) {
      throw new Error('each condition must have non-empty rules array');
    }
    if (condition.rules.length > 30) throw new Error('max 30 rules per condition');
    if (condition.match && !['AND', 'OR'].includes(condition.match)) throw new Error('match must be "AND" or "OR"');
    if (condition.boolean && !['TRUE', 'FALSE'].includes(condition.boolean)) throw new Error('boolean must be "TRUE" or "FALSE"');
    for (const rule of condition.rules) {
      const result = validateRule(rule);
      if (!result.valid) throw new Error(result.error);
    }
  }
}

let cachedRules = null;
export function getSerializableRules() {
  if (cachedRules) return cachedRules;
  cachedRules = {};
  for (const [property, def] of Object.entries(PROPERTY_RULES)) {
    const out = {
      category: def.category,
      methods: def.methods,
      valueType: def.valueType,
    };
    if (def.noValueMethods) out.noValueMethods = def.noValueMethods;
    if (def.options) out.options = def.options;
    if (def.extraFields) out.extraFields = def.extraFields;
    cachedRules[property] = out;
  }
  return cachedRules;
}
