/**
 * Smart Folder — PROPERTY_RULES schema (single source of truth)
 *
 * Defines all property → method → value legal combinations.
 * Used by smart-folder-handlers.js for strict validation
 * and exposed via smartFolder.getRules for API discoverability.
 */

const STRING_METHODS = ['equal', 'startWith', 'endWith', 'contain', 'uncontain', 'empty', 'not-empty', 'regex'];
const NUMERIC_METHODS = ['=', '>=', '<=', '>', '<', 'between'];
const DATE_METHODS = ['on', 'before', 'after', 'between', 'within'];
const SET_METHODS = ['union', 'intersection', 'equal', 'identity', 'empty', 'not-empty'];

const PROPERTY_RULES = {
	// ── STRING ──
	name:       { category: 'STRING', methods: STRING_METHODS, valueType: 'string', noValueMethods: ['empty', 'not-empty'] },
	url:        { category: 'STRING', methods: STRING_METHODS, valueType: 'string', noValueMethods: ['empty', 'not-empty'] },
	annotation: { category: 'STRING', methods: STRING_METHODS, valueType: 'string', noValueMethods: ['empty', 'not-empty'] },
	comments:   { category: 'STRING', methods: STRING_METHODS, valueType: 'string', noValueMethods: ['empty', 'not-empty'] },
	camera:     { category: 'STRING', methods: STRING_METHODS, valueType: 'string', noValueMethods: ['empty', 'not-empty'] },
	folderName: { category: 'STRING', methods: STRING_METHODS, valueType: 'string', noValueMethods: ['empty', 'not-empty'] },

	// ── NUMERIC ──
	width:       { category: 'NUMERIC', methods: NUMERIC_METHODS, valueType: 'number_pair' },
	height:      { category: 'NUMERIC', methods: NUMERIC_METHODS, valueType: 'number_pair' },
	iso:         { category: 'NUMERIC', methods: NUMERIC_METHODS, valueType: 'number_pair' },
	aperture:    { category: 'NUMERIC', methods: NUMERIC_METHODS, valueType: 'number_pair' },
	focalLength: { category: 'NUMERIC', methods: NUMERIC_METHODS, valueType: 'number_pair' },
	shutter:     { category: 'NUMERIC', methods: NUMERIC_METHODS, valueType: 'number_pair' },
	bpm:         { category: 'NUMERIC', methods: NUMERIC_METHODS, valueType: 'number_pair' },

	// ── NUMERIC_WITH_UNIT ──
	fileSize: {
		category: 'NUMERIC_WITH_UNIT', methods: NUMERIC_METHODS, valueType: 'number_pair',
		extraFields: { unit: { options: ['kb', 'mb'], required: true } }
	},
	duration: {
		category: 'NUMERIC_WITH_UNIT', methods: NUMERIC_METHODS, valueType: 'number_pair',
		extraFields: { unit: { options: ['s', 'm', 'h'], required: true } }
	},

	// ── DATE ──
	createTime: { category: 'DATE', methods: DATE_METHODS, valueType: 'number_pair', noValueMethods: [] },
	mtime:      { category: 'DATE', methods: DATE_METHODS, valueType: 'number_pair', noValueMethods: [] },
	btime:      { category: 'DATE', methods: DATE_METHODS, valueType: 'number_pair', noValueMethods: [] },
	timestamp:  { category: 'DATE', methods: DATE_METHODS, valueType: 'number_pair', noValueMethods: [] },

	// ── SET ──
	tags:    { category: 'SET', methods: SET_METHODS, valueType: 'string_array', noValueMethods: ['empty', 'not-empty'] },
	folders: { category: 'SET', methods: SET_METHODS, valueType: 'string_array', noValueMethods: ['empty', 'not-empty'] },

	// ── SPECIAL ──
	type: {
		category: 'SPECIAL', methods: ['equal', 'unequal'], valueType: 'string',
		options: ['video', 'audio', 'font', 'jpg', 'png', 'gif', 'svg', 'psd', 'ai', 'pdf', 'bmp', 'ico', 'tif', 'webp', 'avif', 'base', 'raw', 'riff', 'office']
	},
	rating: {
		category: 'SPECIAL', methods: ['equal', 'unequal', 'contain'], valueType: 'string',
		options: ['none', '1', '2', '3', '4', '5']
	},
	shape: {
		category: 'SPECIAL', methods: ['equal', 'unequal'], valueType: 'string',
		options: ['landscape', 'portrait', 'square', 'panoramic-landscape', 'panoramic-portrait', 'custom'],
		extraFields: {
			width:  { type: 'number', requiredWhen: 'custom' },
			height: { type: 'number', requiredWhen: 'custom' }
		}
	},
	color: {
		category: 'SPECIAL', methods: ['similar', 'accuracy', 'grayscale'], valueType: 'string',
		noValueMethods: ['grayscale']
	},
	fontActivated: {
		category: 'SPECIAL', methods: ['activate', 'deactivate'], valueType: null
	},
};

/**
 * Validate a single rule object.
 * @param {object} rule - { property, method, value, ...extra }
 * @returns {{ valid: boolean, error?: string }}
 */
function validateRule(rule) {
	// 1. property exists
	if (!rule.property || !PROPERTY_RULES[rule.property]) {
		return { valid: false, error: "invalid property: " + rule.property + ". Valid properties: " + Object.keys(PROPERTY_RULES).join(', ') };
	}

	const def = PROPERTY_RULES[rule.property];

	// 2. method valid for this property
	if (!rule.method || !def.methods.includes(rule.method)) {
		return { valid: false, error: "invalid method '" + rule.method + "' for property '" + rule.property + "'. Valid methods: " + def.methods.join(', ') };
	}

	// 3. noValueMethods → skip value check
	if (def.noValueMethods && def.noValueMethods.includes(rule.method)) {
		return { valid: true };
	}

	// 4. valueType null → no value needed (e.g. fontActivated)
	if (def.valueType === null) {
		return { valid: true };
	}

	// 5. value required from here on
	if (rule.value === undefined || rule.value === null) {
		return { valid: false, error: "value is required for property '" + rule.property + "' with method '" + rule.method + "'" };
	}

	// 6. validate by valueType
	switch (def.valueType) {
		case 'string':
			if (typeof rule.value !== 'string') {
				return { valid: false, error: "value must be a string for property '" + rule.property + "', got " + typeof rule.value };
			}
			if (def.options && !def.options.includes(rule.value)) {
				// options are suggestions, not strict for string types
			}
			break;

		case 'number_pair':
			if (!Array.isArray(rule.value)) {
				// Allow single number (auto-wrap)
				if (typeof rule.value === 'number') {
					break;
				}
				return { valid: false, error: "value must be [number, ...] for property '" + rule.property + "', got " + typeof rule.value };
			}
			if (rule.value.length < 1) {
				return { valid: false, error: "value array must have at least 1 element for property '" + rule.property + "'" };
			}
			if (rule.method === 'between' && rule.value.length < 2) {
				return { valid: false, error: "value must be [number, number] for property '" + rule.property + "' with method 'between'" };
			}
			for (let i = 0; i < rule.value.length; i++) {
				if (typeof rule.value[i] !== 'number') {
					return { valid: false, error: "value[" + i + "] must be a number for property '" + rule.property + "', got " + typeof rule.value[i] };
				}
			}
			break;

		case 'string_array':
			if (!Array.isArray(rule.value)) {
				return { valid: false, error: "value must be an array of strings for property '" + rule.property + "', got " + typeof rule.value };
			}
			for (let i = 0; i < rule.value.length; i++) {
				if (typeof rule.value[i] !== 'string') {
					return { valid: false, error: "value[" + i + "] must be a string for property '" + rule.property + "', got " + typeof rule.value[i] };
				}
			}
			break;
	}

	// 7. extraFields validation
	if (def.extraFields) {
		for (const [fieldName, fieldDef] of Object.entries(def.extraFields)) {
			if (fieldDef.required) {
				if (rule[fieldName] === undefined || rule[fieldName] === null) {
					return { valid: false, error: "'" + fieldName + "' is required for property '" + rule.property + "'. Valid values: " + (fieldDef.options || []).join(', ') };
				}
				if (fieldDef.options && !fieldDef.options.includes(rule[fieldName])) {
					return { valid: false, error: "invalid '" + fieldName + "' value '" + rule[fieldName] + "' for property '" + rule.property + "'. Valid values: " + fieldDef.options.join(', ') };
				}
			}
			if (fieldDef.requiredWhen && rule.value === fieldDef.requiredWhen) {
				if (rule[fieldName] === undefined || rule[fieldName] === null || typeof rule[fieldName] !== 'number') {
					return { valid: false, error: "'" + fieldName + "' (number) is required for property '" + rule.property + "' when value is '" + fieldDef.requiredWhen + "'" };
				}
			}
		}
	}

	return { valid: true };
}

/**
 * Validate full conditions array (replaces the old weak validation).
 * @param {Array} conditions
 * @throws {Error} on first validation failure
 */
function validateConditions(conditions) {
	if (!Array.isArray(conditions) || conditions.length === 0) {
		throw new Error('conditions must be a non-empty array');
	}
	if (conditions.length > 30) {
		throw new Error('max 30 conditions');
	}
	for (let c of conditions) {
		if (!c.rules || !Array.isArray(c.rules) || c.rules.length === 0) {
			throw new Error('each condition must have non-empty rules array');
		}
		if (c.rules.length > 30) {
			throw new Error('max 30 rules per condition');
		}
		if (c.match && !['AND', 'OR'].includes(c.match)) {
			throw new Error('match must be "AND" or "OR"');
		}
		if (c.boolean && !['TRUE', 'FALSE'].includes(c.boolean)) {
			throw new Error('boolean must be "TRUE" or "FALSE"');
		}
		for (let r of c.rules) {
			const result = validateRule(r);
			if (!result.valid) {
				throw new Error(result.error);
			}
		}
	}
}

/**
 * Return a JSON-serializable version of PROPERTY_RULES (no functions).
 * Cached since PROPERTY_RULES is a module-level constant.
 */
let _cachedSerializable = null;
function getSerializableRules() {
	if (_cachedSerializable) return _cachedSerializable;
	const out = {};
	for (const [prop, def] of Object.entries(PROPERTY_RULES)) {
		out[prop] = {
			category: def.category,
			methods: def.methods,
			valueType: def.valueType,
		};
		if (def.noValueMethods && def.noValueMethods.length > 0) {
			out[prop].noValueMethods = def.noValueMethods;
		}
		if (def.options) {
			out[prop].options = def.options;
		}
		if (def.extraFields) {
			out[prop].extraFields = {};
			for (const [k, v] of Object.entries(def.extraFields)) {
				out[prop].extraFields[k] = { ...v };
			}
		}
	}
	_cachedSerializable = out;
	return out;
}

module.exports = { PROPERTY_RULES, validateRule, validateConditions, getSerializableRules };
