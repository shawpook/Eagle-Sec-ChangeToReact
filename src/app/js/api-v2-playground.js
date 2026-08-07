/**
 * Eagle API v2 Playground
 *
 * Interactive API testing interface (similar to Swagger UI).
 * Mounts a self-contained HTML page at /api/v2/playground via addHandler.
 */

function initPlayground(APIServer) {
	const config = require('./api-v2-playground-config');
	let cachedHTML = null;

	APIServer.addHandler('/api/v2/playground', (args, response) => {
		if (!cachedHTML) cachedHTML = generateHTML(config);
		response.writeHead(200, {
			'Content-Type': 'text/html; charset=utf-8',
			'Access-Control-Allow-Origin': '*'
		});
		response.end(cachedHTML);
	});
}

function generateHTML(config) {
	const { getSerializableRules } = require('./plugin/handlers/smart-folder-rules');
	const endpointsJSON = JSON.stringify(config.groups);
	const rulesJSON = JSON.stringify(getSerializableRules());

	return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Eagle API v2 Playground</title>
<style>
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

:root {
	--bg-primary: #ffffff;
	--bg-secondary: #f7f8fa;
	--bg-tertiary: #eef1f5;
	--bg-input: #ffffff;
	--bg-hover: #f0f2f5;
	--text-primary: #1a1a1a;
	--text-secondary: #555566;
	--text-muted: #8c8ca0;
	--border: #e0e0e8;
	--border-focus: #3b82f6;
	--accent: #3b82f6;
	--accent-hover: #2563eb;
	--get-color: #16a34a;
	--get-bg: rgba(22, 163, 74, 0.08);
	--post-color: #2563eb;
	--post-bg: rgba(37, 99, 235, 0.08);
	--success-color: #16a34a;
	--error-color: #dc2626;
	--warning-color: #d97706;
	--scrollbar-bg: #f7f8fa;
	--scrollbar-thumb: #c8c8d4;
	--font-mono: 'SF Mono', Monaco, 'Cascadia Code', Consolas, 'Courier New', monospace;
}

body {
	font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
	background: var(--bg-primary);
	color: var(--text-primary);
	height: 100vh;
	overflow: hidden;
}

::-webkit-scrollbar { width: 6px; height: 6px; }
::-webkit-scrollbar-track { background: var(--scrollbar-bg); }
::-webkit-scrollbar-thumb { background: var(--scrollbar-thumb); border-radius: 3px; }
::-webkit-scrollbar-thumb:hover { background: #a0a0b4; }

/* Header */
.header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 12px 20px;
	background: var(--bg-secondary);
	border-bottom: 1px solid var(--border);
	height: 52px;
}
.header-left { display: flex; align-items: center; gap: 12px; }
.header h1 { font-size: 16px; font-weight: 600; letter-spacing: 0.3px; }
.header h1 span { color: var(--accent); }
.status-badge {
	display: flex;
	align-items: center;
	gap: 6px;
	font-size: 12px;
	color: var(--text-secondary);
	padding: 4px 10px;
	background: var(--bg-primary);
	border-radius: 12px;
}
.status-dot {
	width: 7px; height: 7px;
	border-radius: 50%;
	background: var(--success-color);
	animation: pulse 2s infinite;
}
.status-dot.error { background: var(--error-color); animation: none; }
@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
.base-url {
	font-size: 12px;
	color: var(--text-muted);
	font-family: var(--font-mono);
}

/* Layout */
.container {
	display: flex;
	height: calc(100vh - 52px);
}

/* Sidebar */
.sidebar {
	width: 260px;
	min-width: 260px;
	background: var(--bg-secondary);
	border-right: 1px solid var(--border);
	display: flex;
	flex-direction: column;
	overflow: hidden;
}
.search-box {
	padding: 12px;
	border-bottom: 1px solid var(--border);
}
.search-box input {
	width: 100%;
	padding: 8px 12px;
	border: 1px solid var(--border);
	border-radius: 6px;
	background: var(--bg-input);
	color: var(--text-primary);
	font-size: 13px;
	outline: none;
	transition: border-color 0.2s;
}
.search-box input:focus { border-color: var(--border-focus); }
.search-box input::placeholder { color: var(--text-muted); }

.endpoint-list {
	flex: 1;
	overflow-y: auto;
	padding: 8px 0;
}
.group-header {
	display: flex;
	align-items: center;
	gap: 6px;
	padding: 8px 16px;
	font-size: 11px;
	font-weight: 600;
	text-transform: uppercase;
	letter-spacing: 0.8px;
	color: var(--text-muted);
	cursor: pointer;
	user-select: none;
}
.group-header:hover { color: var(--text-secondary); }
.group-arrow {
	font-size: 10px;
	transition: transform 0.2s;
	display: inline-block;
}
.group-header.collapsed .group-arrow { transform: rotate(-90deg); }
.group-endpoints { overflow: hidden; }
.group-header.collapsed + .group-endpoints { display: none; }

.endpoint-item {
	display: flex;
	align-items: center;
	gap: 8px;
	padding: 6px 16px;
	cursor: pointer;
	font-size: 13px;
	font-family: var(--font-mono);
	color: var(--text-secondary);
	transition: background 0.15s;
	border-left: 2px solid transparent;
}
.endpoint-item:hover { background: var(--bg-hover); }
.endpoint-item.active {
	background: var(--bg-hover);
	color: var(--text-primary);
	border-left-color: var(--accent);
}
.method-badge {
	font-size: 10px;
	font-weight: 700;
	padding: 2px 6px;
	border-radius: 3px;
	font-family: var(--font-mono);
	min-width: 38px;
	text-align: center;
}
.method-badge.GET { background: var(--get-bg); color: var(--get-color); }
.method-badge.POST { background: var(--post-bg); color: var(--post-color); }
.endpoint-path {
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
	font-family: var(--font-mono);
	font-size: 11.5px;
}

/* Main area — split left/right */
.main {
	flex: 1;
	display: flex;
	overflow: hidden;
}
.empty-state {
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	width: 100%;
	height: 100%;
	color: var(--text-muted);
	font-size: 14px;
	gap: 8px;
}
.empty-state .icon { font-size: 48px; opacity: 0.3; }

/* Left pane — params */
.pane-left {
	flex: 1;
	min-width: 0;
	display: flex;
	flex-direction: column;
	border-right: 1px solid var(--border);
	overflow: hidden;
}
.pane-left-scroll {
	flex: 1;
	overflow-y: auto;
	padding: 24px 24px;
	min-height: 0;
}
.pane-left-footer {
	padding: 12px 24px;
	border-top: 1px solid var(--border);
	background: var(--bg-secondary);
	flex-shrink: 0;
}

/* Right pane — response */
.pane-right {
	flex: 1;
	min-width: 0;
	overflow-y: auto;
	padding: 24px 24px;
	display: flex;
	flex-direction: column;
}

/* Endpoint detail */
.detail-header { margin-bottom: 20px; }
.detail-method-path {
	display: flex;
	align-items: center;
	gap: 12px;
	margin-bottom: 6px;
}
.detail-method-path .method-badge { font-size: 13px; padding: 4px 10px; }
.detail-method-path .path {
	font-family: var(--font-mono);
	font-size: 15px;
	font-weight: 500;
}
.detail-description {
	color: var(--text-secondary);
	font-size: 13px;
	line-height: 1.5;
}

/* Params form */
.params-section { margin-bottom: 20px; }
.params-title {
	font-size: 13px;
	font-weight: 600;
	color: var(--text-secondary);
	margin-bottom: 12px;
	text-transform: uppercase;
	letter-spacing: 0.5px;
}
.param-row {
	display: grid;
	grid-template-columns: 140px 1fr;
	gap: 8px;
	align-items: start;
	padding: 8px 0;
	border-bottom: 1px solid var(--border);
}
.param-row:last-child { border-bottom: none; }
.param-label {
	font-family: var(--font-mono);
	font-size: 12px;
	padding-top: 8px;
}
.param-label .required { color: var(--error-color); margin-left: 2px; }
.param-type {
	font-size: 10px;
	color: var(--text-muted);
	display: block;
	margin-top: 2px;
}
.param-desc {
	font-size: 11px;
	color: var(--text-muted);
	margin-top: 2px;
}
.param-input input,
.param-input textarea,
.param-input select {
	width: 100%;
	padding: 7px 10px;
	border: 1px solid var(--border);
	border-radius: 6px;
	background: var(--bg-input);
	color: var(--text-primary);
	font-size: 12.5px;
	font-family: var(--font-mono);
	outline: none;
	transition: border-color 0.2s;
}
.param-input select { cursor: pointer; }
.param-input input:focus,
.param-input textarea:focus,
.param-input select:focus { border-color: var(--border-focus); }
.param-input textarea { resize: vertical; min-height: 52px; }
.param-input input[type="checkbox"] {
	width: auto;
	margin: 8px 0;
}

/* Send button */
.send-btn {
	display: inline-flex;
	align-items: center;
	gap: 8px;
	padding: 10px 24px;
	background: var(--accent);
	color: #fff;
	border: none;
	border-radius: 8px;
	font-size: 14px;
	font-weight: 600;
	cursor: pointer;
	transition: background 0.2s, transform 0.1s;
}
.send-btn:hover { background: var(--accent-hover); }
.send-btn:active { transform: scale(0.98); }
.send-btn:disabled { opacity: 0.6; cursor: not-allowed; }
.send-btn.loading { pointer-events: none; }

/* Response pane */
.response-header {
	display: flex;
	align-items: center;
	gap: 12px;
	margin-bottom: 12px;
}
.response-title {
	font-size: 13px;
	font-weight: 600;
	color: var(--text-secondary);
	text-transform: uppercase;
	letter-spacing: 0.5px;
}
.response-status {
	font-size: 12px;
	font-weight: 600;
	padding: 2px 8px;
	border-radius: 4px;
}
.response-status.success { background: var(--get-bg); color: var(--get-color); }
.response-status.error { background: rgba(220, 38, 38, 0.08); color: var(--error-color); }
.response-time {
	font-size: 11px;
	color: var(--text-muted);
	font-family: var(--font-mono);
}
.response-body {
	flex: 1;
	background: var(--bg-secondary);
	border: 1px solid var(--border);
	border-radius: 8px;
	padding: 16px;
	overflow: auto;
	font-family: var(--font-mono);
	font-size: 12.5px;
	line-height: 1.6;
	white-space: pre-wrap;
	word-break: break-all;
	min-height: 0;
}
.response-empty {
	flex: 1;
	display: flex;
	align-items: center;
	justify-content: center;
	color: var(--text-muted);
	font-size: 13px;
	border: 1px dashed var(--border);
	border-radius: 8px;
}

/* Code snippet */
.snippet-section { margin-bottom: 16px; }
.snippet-header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	margin-bottom: 8px;
}
.snippet-title {
	font-size: 13px;
	font-weight: 600;
	color: var(--text-secondary);
	text-transform: uppercase;
	letter-spacing: 0.5px;
}
.copy-btn {
	padding: 4px 12px;
	background: var(--bg-tertiary);
	color: var(--text-secondary);
	border: 1px solid var(--border);
	border-radius: 4px;
	font-size: 11px;
	cursor: pointer;
	transition: background 0.2s, color 0.2s;
}
.copy-btn:hover { background: var(--accent); color: #fff; border-color: var(--accent); }
.copy-btn.copied { background: var(--success-color); color: #fff; border-color: var(--success-color); }
.snippet-body {
	background: var(--bg-secondary);
	border: 1px solid var(--border);
	border-radius: 8px;
	padding: 14px 16px;
	font-family: var(--font-mono);
	font-size: 12px;
	line-height: 1.6;
	white-space: pre-wrap;
	word-break: break-all;
	overflow: auto;
	max-height: 220px;
	color: var(--text-primary);
}
.snippet-body .s-kw { color: #7c3aed; }
.snippet-body .s-fn { color: #2563eb; }
.snippet-body .s-str { color: #16a34a; }
.snippet-body .s-key { color: #c2410c; }
.snippet-body .s-cmt { color: #9ca3af; font-style: italic; }

/* JSON Syntax highlight */
.json-key { color: #2563eb; }
.json-string { color: #16a34a; }
.json-number { color: #c2410c; }
.json-boolean { color: #7c3aed; }
.json-null { color: #9ca3af; }

/* Count badge */
.endpoint-count {
	font-size: 10px;
	color: var(--text-muted);
	margin-left: auto;
	background: var(--bg-primary);
	padding: 1px 6px;
	border-radius: 8px;
}

/* Conditions Builder */
.cb-wrap { border: 1px solid var(--border); border-radius: 8px; padding: 12px; }
.cb-toolbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
.cb-toolbar button {
	padding: 5px 12px; border: 1px solid var(--border); border-radius: 6px;
	background: var(--bg-tertiary); color: var(--text-secondary); cursor: pointer;
	font-size: 12px; transition: background 0.2s;
}
.cb-toolbar button:hover { background: var(--accent); color: #fff; border-color: var(--accent); }
.cb-toggle-raw { font-size: 12px; color: var(--text-secondary); display: flex; align-items: center; gap: 4px; cursor: pointer; }
.cb-toggle-raw input { cursor: pointer; }
.cb-condition {
	background: var(--bg-secondary); border: 1px solid var(--border); border-radius: 6px;
	padding: 10px; margin-bottom: 8px;
}
.cb-condition-header { display: flex; gap: 8px; align-items: center; margin-bottom: 8px; }
.cb-condition-header select {
	padding: 4px 8px; border: 1px solid var(--border); border-radius: 4px;
	background: var(--bg-input); color: var(--text-primary); font-size: 12px; font-family: var(--font-mono);
}
.cb-condition-header .cb-remove-condition {
	margin-left: auto; background: none; border: none; color: var(--error-color);
	cursor: pointer; font-size: 16px; padding: 2px 6px; border-radius: 4px;
}
.cb-condition-header .cb-remove-condition:hover { background: rgba(220,38,38,0.1); }
.cb-condition-header .cb-add-rule {
	padding: 3px 10px; border: 1px solid var(--border); border-radius: 4px;
	background: var(--bg-input); color: var(--text-secondary); cursor: pointer; font-size: 11px;
}
.cb-condition-header .cb-add-rule:hover { background: var(--accent); color: #fff; border-color: var(--accent); }
.cb-rule { display: flex; gap: 6px; align-items: center; margin-bottom: 6px; flex-wrap: wrap; }
.cb-prop, .cb-method {
	width: 140px; padding: 5px 8px; border: 1px solid var(--border); border-radius: 4px;
	background: var(--bg-input); color: var(--text-primary); font-size: 12px; font-family: var(--font-mono);
}
.cb-value { flex: 1; display: flex; gap: 4px; align-items: center; min-width: 120px; }
.cb-value input, .cb-value select {
	width: 100%; padding: 5px 8px; border: 1px solid var(--border); border-radius: 4px;
	background: var(--bg-input); color: var(--text-primary); font-size: 12px; font-family: var(--font-mono);
}
.cb-value .cb-sep { color: var(--text-muted); font-size: 12px; flex-shrink: 0; }
.cb-extra select {
	width: 70px; padding: 5px 6px; border: 1px solid var(--border); border-radius: 4px;
	background: var(--bg-input); color: var(--text-primary); font-size: 12px; font-family: var(--font-mono);
}
.cb-remove-rule {
	background: none; border: none; color: var(--error-color); cursor: pointer;
	font-size: 16px; padding: 2px 6px; border-radius: 4px; flex-shrink: 0;
}
.cb-remove-rule:hover { background: rgba(220,38,38,0.1); }
.cb-raw {
	width: 100%; min-height: 120px; font-family: var(--font-mono); font-size: 12px;
	padding: 10px; border: 1px solid var(--border); border-radius: 6px;
	background: var(--bg-input); color: var(--text-primary); resize: vertical;
}
.cb-visual-empty { color: var(--text-muted); font-size: 12px; padding: 8px 0; text-align: center; }
</style>
</head>
<body>
<div class="header">
	<div class="header-left">
		<h1>Eagle API <span>v2</span> Playground</h1>
		<div class="status-badge">
			<div class="status-dot" id="statusDot"></div>
			<span id="statusText">Checking...</span>
		</div>
	</div>
	<div class="base-url" id="baseUrl"></div>
</div>
<div class="container">
	<div class="sidebar">
		<div class="search-box">
			<input type="text" id="searchInput" placeholder="Search endpoints...">
		</div>
		<div class="endpoint-list" id="endpointList"></div>
	</div>
	<div class="main" id="mainPanel">
		<div class="empty-state">
			<div class="icon">&#9889;</div>
			<div>Select an endpoint from the sidebar to get started</div>
		</div>
	</div>
</div>

<script>
const ENDPOINTS = ${endpointsJSON};
const RULES = ${rulesJSON};
const BASE_URL = window.location.origin;

let activeEndpoint = null;

// --- Init ---
document.getElementById('baseUrl').textContent = BASE_URL;
checkConnection();
renderSidebar();

async function checkConnection() {
	try {
		const res = await fetch(BASE_URL + '/api/v2/app/info');
		const data = await res.json();
		if (data.status === 'success') {
			document.getElementById('statusDot').className = 'status-dot';
			document.getElementById('statusText').textContent = 'Connected — v' + (data.data.version || '?');
		} else { throw new Error(); }
	} catch {
		document.getElementById('statusDot').className = 'status-dot error';
		document.getElementById('statusText').textContent = 'Disconnected';
	}
}

// --- Sidebar ---
function renderSidebar(filter) {
	const list = document.getElementById('endpointList');
	list.innerHTML = '';
	const lf = (filter || '').toLowerCase();

	ENDPOINTS.forEach(group => {
		const filtered = group.endpoints.filter(ep => {
			if (!lf) return true;
			return ep.path.toLowerCase().includes(lf) ||
				ep.description.toLowerCase().includes(lf) ||
				ep.method.toLowerCase().includes(lf);
		});
		if (filtered.length === 0) return;

		const header = document.createElement('div');
		header.className = 'group-header';
		header.innerHTML = '<span class="group-arrow">&#9660;</span> ' +
			group.name +
			' <span class="endpoint-count">' + filtered.length + '</span>';
		header.onclick = function() {
			this.classList.toggle('collapsed');
		};
		list.appendChild(header);

		const container = document.createElement('div');
		container.className = 'group-endpoints';

		filtered.forEach(ep => {
			const item = document.createElement('div');
			item.className = 'endpoint-item';
			const shortPath = ep.path.replace('/api/v2/', '');
			item.innerHTML = '<span class="method-badge ' + ep.method + '">' + ep.method + '</span>' +
				'<span class="endpoint-path" title="' + ep.path + '">' + shortPath + '</span>';
			item.onclick = () => selectEndpoint(ep, item);
			container.appendChild(item);
		});

		list.appendChild(container);
	});
}

document.getElementById('searchInput').addEventListener('input', function() {
	renderSidebar(this.value);
});

// --- Select endpoint ---
function selectEndpoint(ep, itemEl) {
	document.querySelectorAll('.endpoint-item.active').forEach(el => el.classList.remove('active'));
	if (itemEl) itemEl.classList.add('active');
	activeEndpoint = ep;
	renderDetail(ep);
}

// --- Detail panel (left/right split) ---
function renderDetail(ep) {
	const main = document.getElementById('mainPanel');

	// Left pane — header + params (scrollable) + send (fixed footer)
	let left = '<div class="pane-left">';
	left += '<div class="pane-left-scroll">';
	left += '<div class="detail-header">';
	left += '<div class="detail-method-path">';
	left += '<span class="method-badge ' + ep.method + '">' + ep.method + '</span>';
	left += '<span class="path">' + ep.path + '</span>';
	left += '</div>';
	left += '<div class="detail-description">' + escapeHtml(ep.description) + '</div>';
	left += '</div>';

	if (ep.params && ep.params.length > 0) {
		left += '<div class="params-section">';
		left += '<div class="params-title">Parameters</div>';

		ep.params.forEach(p => {
			left += '<div class="param-row">';
			left += '<div class="param-label">' + escapeHtml(p.name);
			if (p.required) left += '<span class="required">*</span>';
			left += '<span class="param-type">' + p.type + '</span>';
			left += '</div>';
			left += '<div class="param-input">';

			if (p.type === 'conditions-builder') {
				left += '<div class="cb-wrap" id="param-' + p.name + '" data-param="' + p.name + '" data-type="conditions-builder">';
				left += '<div class="cb-toolbar">';
				left += '<button type="button" onclick="cbAddCondition(this.closest(\\'.cb-wrap\\').querySelector(\\'.cb-visual\\'))">+ Add Condition Group</button>';
				left += '<label class="cb-toggle-raw"><input type="checkbox" onchange="cbToggleRaw(this)"> Raw JSON</label>';
				left += '</div>';
				left += '<div class="cb-visual"><div class="cb-visual-empty">Click "+ Add Condition Group" to start building conditions</div></div>';
				left += '<textarea class="cb-raw" style="display:none" placeholder=\\'[{"rules":[{"property":"name","method":"contain","value":"..."}],"match":"OR"}]\\'></textarea>';
				left += '</div>';
			} else if (p.type === 'select') {
				left += '<select id="param-' + p.name + '" data-param="' + p.name + '" data-type="select">';
				(p.options || []).forEach((opt, i) => {
					const label = (p.optionLabels && p.optionLabels[i]) || opt || '(none)';
					left += '<option value="' + escapeHtml(opt) + '">' + escapeHtml(label) + '</option>';
				});
				left += '</select>';
			} else if (p.type === 'boolean') {
				left += '<input type="checkbox" id="param-' + p.name + '" data-param="' + p.name + '" data-type="boolean">';
			} else if (p.type === 'array' || p.type === 'object') {
				left += '<textarea id="param-' + p.name + '" data-param="' + p.name + '" data-type="' + p.type + '" placeholder="' + escapeHtml(p.example || (p.type === 'array' ? '["value1","value2"]' : '{"key":"value"}')) + '"></textarea>';
			} else if (p.type === 'number') {
				left += '<input type="number" id="param-' + p.name + '" data-param="' + p.name + '" data-type="number" placeholder="' + escapeHtml(p.example || '') + '">';
			} else {
				left += '<input type="text" id="param-' + p.name + '" data-param="' + p.name + '" data-type="string" placeholder="' + escapeHtml(p.example || '') + '">';
			}

			left += '<div class="param-desc">' + escapeHtml(p.description) + '</div>';
			left += '</div>';
			left += '</div>';
		});

		left += '</div>';
	}

	left += '</div>'; // close pane-left-scroll
	left += '<div class="pane-left-footer">';
	left += '<button class="send-btn" id="sendBtn" onclick="sendRequest()" style="width:100%;justify-content:center;">&#128640; Send Request</button>';
	left += '</div>';
	left += '</div>'; // close pane-left

	// Right pane — code snippet + response
	let right = '<div class="pane-right">';

	// Code snippet
	right += '<div class="snippet-section">';
	right += '<div class="snippet-header">';
	right += '<span class="snippet-title">Code Snippet</span>';
	right += '<button class="copy-btn" id="copyBtn" onclick="copySnippet()">Copy</button>';
	right += '</div>';
	right += '<div class="snippet-body" id="snippetBody"></div>';
	right += '</div>';

	// Response
	right += '<div class="response-header">';
	right += '<span class="response-title">Response</span>';
	right += '<span class="response-status" id="responseStatus"></span>';
	right += '<span class="response-time" id="responseTime"></span>';
	right += '</div>';
	right += '<div class="response-empty" id="responseEmpty">Send a request to see the response</div>';
	right += '<div class="response-body" id="responseBody" style="display:none;"></div>';
	right += '</div>';

	main.innerHTML = left + right;

	// Bind input events to update code snippet live
	document.querySelectorAll('[data-param]').forEach(el => {
		const evt = (el.type === 'checkbox' || el.tagName === 'SELECT') ? 'change' : 'input';
		el.addEventListener(evt, updateCodeSnippet);
	});
	updateCodeSnippet();
}

// --- Code Snippet ---
let _cbSuppressSnippet = false;
function updateCodeSnippet() {
	if (_cbSuppressSnippet) return;
	const el = document.getElementById('snippetBody');
	if (!el || !activeEndpoint) return;
	const params = collectParams();
	el.innerHTML = generateCodeSnippet(activeEndpoint, params);
}

function generateCodeSnippet(ep, params) {
	const url = BASE_URL + ep.path;
	let raw = '';

	if (ep.method === 'GET') {
		const qs = buildQueryString(params);
		const fullUrl = url + (qs ? '?' + qs : '');
		raw = 'const res = await fetch("' + fullUrl + '");\\n';
		raw += 'const data = await res.json();\\n';
		raw += 'console.log(data);';

		// Highlighted version
		let h = '';
		h += '<span class="s-kw">const</span> res = <span class="s-kw">await</span> <span class="s-fn">fetch</span>(<span class="s-str">"' + escapeHtml(fullUrl) + '"</span>);\\n';
		h += '<span class="s-kw">const</span> data = <span class="s-kw">await</span> res.<span class="s-fn">json</span>();\\n';
		h += 'console.<span class="s-fn">log</span>(data);';
		return h;
	}

	// POST
	const bodyStr = JSON.stringify(params, null, 2);
	const bodyLines = escapeHtml(bodyStr).split('\\n');

	let h = '';
	h += '<span class="s-kw">const</span> res = <span class="s-kw">await</span> <span class="s-fn">fetch</span>(<span class="s-str">"' + escapeHtml(url) + '"</span>, {\\n';
	h += '  <span class="s-key">method</span>: <span class="s-str">"POST"</span>,\\n';
	h += '  <span class="s-key">headers</span>: { <span class="s-str">"Content-Type"</span>: <span class="s-str">"application/json"</span> },\\n';
	h += '  <span class="s-key">body</span>: JSON.<span class="s-fn">stringify</span>(';

	if (bodyLines.length === 1) {
		h += bodyLines[0];
	} else {
		h += bodyLines.join('\\n  ');
	}

	h += ')\\n';
	h += '});\\n';
	h += '<span class="s-kw">const</span> data = <span class="s-kw">await</span> res.<span class="s-fn">json</span>();\\n';
	h += 'console.<span class="s-fn">log</span>(data);';
	return h;
}

function copySnippet() {
	if (!activeEndpoint) return;
	const params = collectParams();
	const ep = activeEndpoint;
	let raw = '';

	if (ep.method === 'GET') {
		const qs = buildQueryString(params);
		const fullUrl = BASE_URL + ep.path + (qs ? '?' + qs : '');
		raw = 'const res = await fetch("' + fullUrl + '");\\n';
		raw += 'const data = await res.json();\\n';
		raw += 'console.log(data);';
	} else {
		const bodyStr = JSON.stringify(params, null, 2);
		raw = 'const res = await fetch("' + BASE_URL + ep.path + '", {\\n';
		raw += '  method: "POST",\\n';
		raw += '  headers: { "Content-Type": "application/json" },\\n';
		raw += '  body: JSON.stringify(' + bodyStr.split('\\n').join('\\n  ') + ')\\n';
		raw += '});\\n';
		raw += 'const data = await res.json();\\n';
		raw += 'console.log(data);';
	}

	navigator.clipboard.writeText(raw).then(() => {
		const btn = document.getElementById('copyBtn');
		btn.textContent = 'Copied!';
		btn.classList.add('copied');
		setTimeout(() => {
			btn.textContent = 'Copy';
			btn.classList.remove('copied');
		}, 1500);
	});
}

// --- Send Request ---
async function sendRequest() {
	if (!activeEndpoint) return;

	const btn = document.getElementById('sendBtn');
	btn.disabled = true;
	btn.classList.add('loading');
	btn.innerHTML = '&#9203; Sending...';

	const ep = activeEndpoint;
	const params = collectParams();

	const startTime = performance.now();

	try {
		let res;
		if (ep.method === 'GET') {
			const qs = buildQueryString(params);
			res = await fetch(BASE_URL + ep.path + (qs ? '?' + qs : ''));
		} else {
			res = await fetch(BASE_URL + ep.path, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(params),
			});
		}

		const elapsed = Math.round(performance.now() - startTime);
		let data;
		const contentType = res.headers.get('content-type') || '';
		if (contentType.includes('json')) {
			data = await res.json();
		} else {
			data = await res.text();
		}

		showResponse(res.status, elapsed, data);
	} catch (err) {
		const elapsed = Math.round(performance.now() - startTime);
		showResponse(0, elapsed, { error: err.message });
	}

	btn.disabled = false;
	btn.classList.remove('loading');
	btn.innerHTML = '&#128640; Send Request';
}

function collectParams() {
	const params = {};
	document.querySelectorAll('[data-param]').forEach(el => {
		const name = el.dataset.param;
		const type = el.dataset.type;
		let value;

		if (type === 'conditions-builder') {
			const rawTextarea = el.querySelector('.cb-raw');
			if (rawTextarea && rawTextarea.style.display !== 'none') {
				try { params[name] = JSON.parse(rawTextarea.value); } catch {}
			} else {
				const result = cbCollect(el);
				if (result && result.length > 0) params[name] = result;
			}
			return;
		}

		if (type === 'boolean') {
			if (el.checked) params[name] = true;
			return;
		}

		value = el.value.trim();
		if (!value) return;

		if (type === 'number') {
			params[name] = Number(value);
		} else if (type === 'array' || type === 'object') {
			try {
				params[name] = JSON.parse(value);
			} catch {
				params[name] = value;
			}
		} else {
			params[name] = value;
		}
	});
	return params;
}

function buildQueryString(params) {
	const parts = [];
	for (const [k, v] of Object.entries(params)) {
		if (typeof v === 'object') {
			parts.push(encodeURIComponent(k) + '=' + encodeURIComponent(JSON.stringify(v)));
		} else {
			parts.push(encodeURIComponent(k) + '=' + encodeURIComponent(v));
		}
	}
	return parts.join('&');
}

function showResponse(status, elapsed, data) {
	const emptyEl = document.getElementById('responseEmpty');
	const bodyEl = document.getElementById('responseBody');
	if (emptyEl) emptyEl.style.display = 'none';
	if (bodyEl) bodyEl.style.display = '';

	const statusEl = document.getElementById('responseStatus');
	const isOk = status >= 200 && status < 300;
	statusEl.className = 'response-status ' + (isOk ? 'success' : 'error');
	statusEl.textContent = status === 0 ? 'Network Error' : status + (isOk ? ' OK' : ' Error');

	document.getElementById('responseTime').textContent = elapsed + 'ms';

	if (typeof data === 'string') {
		bodyEl.innerHTML = escapeHtml(data);
	} else {
		bodyEl.innerHTML = syntaxHighlight(JSON.stringify(data, null, 2));
	}
}

// --- Utilities ---
function escapeHtml(str) {
	if (!str) return '';
	return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function syntaxHighlight(json) {
	if (!json) return '';
	json = escapeHtml(json);
	return json.replace(
		/("(\\\\u[a-zA-Z0-9]{4}|\\\\[^u]|[^\\\\"])*"(\\s*:)?|\\b(true|false|null)\\b|-?\\d+(?:\\.\\d*)?(?:[eE][+\\-]?\\d+)?)/g,
		function(match) {
			let cls = 'json-number';
			if (/^"/.test(match)) {
				if (/:$/.test(match)) {
					cls = 'json-key';
				} else {
					cls = 'json-string';
				}
			} else if (/true|false/.test(match)) {
				cls = 'json-boolean';
			} else if (/null/.test(match)) {
				cls = 'json-null';
			}
			return '<span class="' + cls + '">' + match + '</span>';
		}
	);
}

// ─── Conditions Builder ──────────────────────────────────────
const CB_PROPERTY_KEYS = Object.keys(RULES);
const CB_NO_VALUE_METHODS = [...new Set(CB_PROPERTY_KEYS.flatMap(p => RULES[p].noValueMethods || [])
	.concat(CB_PROPERTY_KEYS.filter(p => RULES[p].valueType === null).flatMap(p => RULES[p].methods)))];

function cbPropertyOptions() {
	let html = '';
	CB_PROPERTY_KEYS.forEach(p => {
		html += '<option value="' + p + '">' + p + ' (' + RULES[p].category + ')</option>';
	});
	return html;
}

function cbMethodOptions(property) {
	const def = RULES[property];
	if (!def) return '';
	let html = '';
	def.methods.forEach(m => {
		html += '<option value="' + escapeHtml(m) + '">' + escapeHtml(m) + '</option>';
	});
	return html;
}

function cbValueHTML(property, method) {
	const def = RULES[property];
	if (!def) return '';

	// No-value methods
	if (CB_NO_VALUE_METHODS.includes(method)) return '';
	if (def.valueType === null) return '';

	// Properties with predefined options → render as <select>
	if (def.options && (property === 'type' || property === 'rating' || property === 'shape')) {
		const onchange = property === 'shape' ? ' onchange="cbOnShapeChange(this)"' : '';
		let h = '<select class="cb-val"' + onchange + '>';
		def.options.forEach(o => { h += '<option value="' + o + '">' + o + '</option>'; });
		h += '</select>';
		return h;
	}
	// Special: color
	if (property === 'color') {
		return '<input type="color" class="cb-val" value="#FF0000" style="width:40px;height:30px;padding:2px;cursor:pointer;">' +
			'<input type="text" class="cb-val-text" placeholder="#FF0000" style="width:80px;">';
	}

	switch (def.valueType) {
		case 'string':
			return '<input type="text" class="cb-val" placeholder="value">';
		case 'number_pair':
			if (def.category === 'DATE') {
				if (method === 'within') {
					return '<input type="number" class="cb-val" placeholder="days" min="1">' +
						'<span class="cb-sep">days</span>';
				}
				let h = '<input type="date" class="cb-val">';
				if (method === 'between') {
					h += '<span class="cb-sep">~</span><input type="date" class="cb-val2">';
				}
				return h;
			}
			{
				let h = '<input type="number" class="cb-val" placeholder="value">';
				if (method === 'between') {
					h += '<span class="cb-sep">~</span><input type="number" class="cb-val2" placeholder="value">';
				}
				return h;
			}
		case 'string_array':
			return '<input type="text" class="cb-val" placeholder="tag1, tag2, ...">';
		default:
			return '';
	}
}

function cbExtraHTML(property) {
	const def = RULES[property];
	if (!def || !def.extraFields) return '';
	let html = '';
	for (const [key, fieldDef] of Object.entries(def.extraFields)) {
		if (fieldDef.options) {
			html += '<select class="cb-extra-field" data-field="' + key + '">';
			fieldDef.options.forEach(o => { html += '<option value="' + o + '">' + o + '</option>'; });
			html += '</select>';
		}
	}
	return html;
}

function cbCreateRuleRow(property) {
	property = property || CB_PROPERTY_KEYS[0];
	const def = RULES[property];
	const method = def ? def.methods[0] : '';

	let html = '<div class="cb-rule">';
	html += '<select class="cb-prop" onchange="cbOnPropertyChange(this)">' + cbPropertyOptions() + '</select>';
	html += '<select class="cb-method" onchange="cbOnMethodChange(this)">' + cbMethodOptions(property) + '</select>';
	html += '<div class="cb-value">' + cbValueHTML(property, method) + '</div>';
	html += '<div class="cb-extra">' + cbExtraHTML(property) + '</div>';
	html += '<button type="button" class="cb-remove-rule" onclick="cbRemoveRule(this.closest(\\'.cb-rule\\'))">&times;</button>';
	html += '</div>';
	return html;
}

function cbAddCondition(visualEl) {
	const emptyMsg = visualEl.querySelector('.cb-visual-empty');
	if (emptyMsg) emptyMsg.remove();

	let html = '<div class="cb-condition">';
	html += '<div class="cb-condition-header">';
	html += '<span style="font-size:11px;color:var(--text-muted);">Match:</span>';
	html += '<select class="cb-match"><option value="AND">AND</option><option value="OR">OR</option></select>';
	html += '<span style="font-size:11px;color:var(--text-muted);">Boolean:</span>';
	html += '<select class="cb-boolean"><option value="">(default)</option><option value="TRUE">TRUE</option><option value="FALSE">FALSE</option></select>';
	html += '<button type="button" class="cb-add-rule" onclick="cbAddRule(this.closest(\\'.cb-condition\\'))">+ Rule</button>';
	html += '<button type="button" class="cb-remove-condition" onclick="cbRemoveCondition(this.closest(\\'.cb-condition\\'))">&times;</button>';
	html += '</div>';
	html += '<div class="cb-rules">' + cbCreateRuleRow() + '</div>';
	html += '</div>';

	const temp = document.createElement('div');
	temp.innerHTML = html;
	visualEl.appendChild(temp.firstElementChild);
	updateCodeSnippet();
}

function cbAddRule(conditionEl) {
	const rulesContainer = conditionEl.querySelector('.cb-rules');
	const temp = document.createElement('div');
	temp.innerHTML = cbCreateRuleRow();
	rulesContainer.appendChild(temp.firstElementChild);
	updateCodeSnippet();
}

function cbRemoveRule(ruleEl) {
	const conditionEl = ruleEl.closest('.cb-condition');
	ruleEl.remove();
	// Remove condition if no rules left
	if (conditionEl && conditionEl.querySelectorAll('.cb-rule').length === 0) {
		cbRemoveCondition(conditionEl);
	}
	updateCodeSnippet();
}

function cbRemoveCondition(conditionEl) {
	const visualEl = conditionEl.closest('.cb-visual');
	conditionEl.remove();
	if (visualEl && visualEl.querySelectorAll('.cb-condition').length === 0) {
		visualEl.innerHTML = '<div class="cb-visual-empty">Click "+ Add Condition Group" to start building conditions</div>';
	}
	updateCodeSnippet();
}

function cbOnPropertyChange(selectEl) {
	const ruleEl = selectEl.closest('.cb-rule');
	const property = selectEl.value;
	const def = RULES[property];

	// Update method dropdown
	const methodSelect = ruleEl.querySelector('.cb-method');
	methodSelect.innerHTML = cbMethodOptions(property);
	const method = def ? def.methods[0] : '';

	// Update value area
	const valueDiv = ruleEl.querySelector('.cb-value');
	valueDiv.innerHTML = cbValueHTML(property, method);

	// Update extra fields
	const extraDiv = ruleEl.querySelector('.cb-extra');
	extraDiv.innerHTML = cbExtraHTML(property);

	// Bind color input sync
	cbBindColorSync(ruleEl);
	updateCodeSnippet();
}

function cbOnMethodChange(selectEl) {
	const ruleEl = selectEl.closest('.cb-rule');
	const property = ruleEl.querySelector('.cb-prop').value;
	const method = selectEl.value;

	const valueDiv = ruleEl.querySelector('.cb-value');
	valueDiv.innerHTML = cbValueHTML(property, method);

	cbBindColorSync(ruleEl);
	updateCodeSnippet();
}

function cbOnShapeChange(selectEl) {
	const ruleEl = selectEl.closest('.cb-rule');
	const extraDiv = ruleEl.querySelector('.cb-extra');
	if (selectEl.value === 'custom') {
		extraDiv.innerHTML =
			'<input type="number" class="cb-extra-field" data-field="width" placeholder="W" style="width:50px;">' +
			'<span class="cb-sep">×</span>' +
			'<input type="number" class="cb-extra-field" data-field="height" placeholder="H" style="width:50px;">';
	} else {
		extraDiv.innerHTML = '';
	}
	updateCodeSnippet();
}

function cbBindColorSync(ruleEl) {
	const colorInput = ruleEl.querySelector('input[type="color"].cb-val');
	const textInput = ruleEl.querySelector('.cb-val-text');
	if (colorInput && textInput) {
		// Clone nodes to remove stale listeners from prior property/method changes
		const newColor = colorInput.cloneNode(true);
		const newText = textInput.cloneNode(true);
		colorInput.replaceWith(newColor);
		textInput.replaceWith(newText);
		newColor.addEventListener('input', function() {
			newText.value = this.value.toUpperCase();
			updateCodeSnippet();
		});
		newText.addEventListener('input', function() {
			if (/^#[0-9A-Fa-f]{6}$/.test(this.value)) newColor.value = this.value;
			updateCodeSnippet();
		});
	}
}

function cbToggleRaw(checkbox) {
	const wrap = checkbox.closest('.cb-wrap');
	const visual = wrap.querySelector('.cb-visual');
	const raw = wrap.querySelector('.cb-raw');

	if (checkbox.checked) {
		// Visual → Raw: serialize
		const conditions = cbCollect(wrap);
		raw.value = JSON.stringify(conditions, null, 2);
		visual.style.display = 'none';
		raw.style.display = '';
	} else {
		// Raw → Visual: parse and rebuild
		visual.style.display = '';
		raw.style.display = 'none';
		try {
			const conditions = JSON.parse(raw.value);
			cbPopulate(visual, conditions);
		} catch {}
	}
	updateCodeSnippet();
}

function cbCollect(wrapEl) {
	const conditions = [];
	wrapEl.querySelectorAll('.cb-condition').forEach(condEl => {
		const match = condEl.querySelector('.cb-match')?.value || 'AND';
		const boolVal = condEl.querySelector('.cb-boolean')?.value || '';
		const rules = [];

		condEl.querySelectorAll('.cb-rule').forEach(ruleEl => {
			const property = ruleEl.querySelector('.cb-prop')?.value;
			const method = ruleEl.querySelector('.cb-method')?.value;
			if (!property || !method) return;

			const def = RULES[property];
			const rule = { property: property, method: method };

			// Skip value for no-value methods
			if (!CB_NO_VALUE_METHODS.includes(method) && def && def.valueType !== null) {
				if (def.valueType === 'string_array') {
					const valInput = ruleEl.querySelector('.cb-val');
					if (valInput && valInput.value.trim()) {
						rule.value = valInput.value.split(',').map(s => s.trim()).filter(Boolean);
					} else {
						rule.value = [];
					}
				} else if (def.valueType === 'number_pair') {
					const isDate = def.category === 'DATE' && method !== 'within';
					const inputs = ruleEl.querySelectorAll('.cb-val, .cb-val2');
					const vals = [];
					inputs.forEach(inp => {
						if (inp.value !== '') vals.push(isDate ? new Date(inp.value).getTime() : Number(inp.value));
					});
					rule.value = vals;
				} else if (def.valueType === 'string') {
					const valEl = ruleEl.querySelector('.cb-val');
					if (valEl) rule.value = valEl.value;
				}

				// Color: prefer text input
				if (property === 'color') {
					const textInput = ruleEl.querySelector('.cb-val-text');
					const colorInput = ruleEl.querySelector('input[type="color"].cb-val');
					rule.value = (textInput && textInput.value) || (colorInput && colorInput.value) || '';
				}
			}

			// Extra fields
			ruleEl.querySelectorAll('.cb-extra-field').forEach(extraEl => {
				const field = extraEl.dataset.field;
				if (field && extraEl.value !== '') {
					rule[field] = extraEl.type === 'number' ? Number(extraEl.value) : extraEl.value;
				}
			});

			rules.push(rule);
		});

		const condition = { rules: rules, match: match };
		if (boolVal) condition.boolean = boolVal;
		conditions.push(condition);
	});
	return conditions;
}

function cbPopulate(visualEl, conditions) {
	_cbSuppressSnippet = true;
	visualEl.innerHTML = '';
	if (!Array.isArray(conditions) || conditions.length === 0) {
		visualEl.innerHTML = '<div class="cb-visual-empty">Click "+ Add Condition Group" to start building conditions</div>';
		_cbSuppressSnippet = false;
		return;
	}
	conditions.forEach(cond => {
		cbAddCondition(visualEl);
		const condEl = visualEl.lastElementChild;
		if (cond.match) {
			const matchSel = condEl.querySelector('.cb-match');
			if (matchSel) matchSel.value = cond.match;
		}
		if (cond.boolean) {
			const boolSel = condEl.querySelector('.cb-boolean');
			if (boolSel) boolSel.value = cond.boolean;
		}
		// Remove default rule
		const defaultRule = condEl.querySelector('.cb-rule');
		if (defaultRule) defaultRule.remove();
		// Add rules
		if (Array.isArray(cond.rules)) {
			cond.rules.forEach(rule => {
				cbAddRule(condEl);
				const ruleEl = condEl.querySelector('.cb-rules').lastElementChild;
				const propSel = ruleEl.querySelector('.cb-prop');
				propSel.value = rule.property || CB_PROPERTY_KEYS[0];
				cbOnPropertyChange(propSel);
				const methodSel = ruleEl.querySelector('.cb-method');
				methodSel.value = rule.method || '';
				cbOnMethodChange(methodSel);

				// Set value
				const def = RULES[rule.property];
				if (rule.value !== undefined && def) {
					if (rule.property === 'color') {
						const textInput = ruleEl.querySelector('.cb-val-text');
						const colorInput = ruleEl.querySelector('input[type="color"].cb-val');
						if (textInput) textInput.value = rule.value;
						if (colorInput && /^#[0-9A-Fa-f]{6}$/.test(rule.value)) colorInput.value = rule.value;
					} else if (def.valueType === 'string_array' && Array.isArray(rule.value)) {
						const valInput = ruleEl.querySelector('.cb-val');
						if (valInput) valInput.value = rule.value.join(', ');
					} else if (def.valueType === 'number_pair' && Array.isArray(rule.value)) {
						const inputs = ruleEl.querySelectorAll('.cb-val, .cb-val2');
						rule.value.forEach((v, i) => {
							if (inputs[i]) {
								if (def.category === 'DATE') {
									inputs[i].value = new Date(v).toISOString().split('T')[0];
								} else {
									inputs[i].value = v;
								}
							}
						});
					} else {
						const valInput = ruleEl.querySelector('.cb-val');
						if (valInput) valInput.value = rule.value;
					}
				}

				// Set extra fields
				ruleEl.querySelectorAll('.cb-extra-field').forEach(extraEl => {
					const field = extraEl.dataset.field;
					if (field && rule[field] !== undefined) {
						extraEl.value = rule[field];
					}
				});

				// Shape custom
				if (rule.property === 'shape' && rule.value === 'custom') {
					cbOnShapeChange(ruleEl.querySelector('.cb-val'));
					const wEl = ruleEl.querySelector('.cb-extra-field[data-field="width"]');
					const hEl = ruleEl.querySelector('.cb-extra-field[data-field="height"]');
					if (wEl && rule.width) wEl.value = rule.width;
					if (hEl && rule.height) hEl.value = rule.height;
				}
			});
		}
	});
	_cbSuppressSnippet = false;
	updateCodeSnippet();
}
</script>
</body>
</html>`;
}

module.exports = { initPlayground };
