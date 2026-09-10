(() => {
  const params = new URLSearchParams(window.location.search);
  const itemId = params.get('id') || params.get('itemId') || params.get('itemID') || '';
  const apiBase = window.__EAGLE_API_BASE_URL || params.get('api') || 'http://127.0.0.1:41695';
  const preview = document.getElementById('preview');
  const editor = document.getElementById('editor');
  const fileTitle = document.getElementById('fileTitle');
  const meta = document.getElementById('meta');
  const status = document.getElementById('status');
  const pager = document.getElementById('pager');
  const loadMore = document.getElementById('loadMore');
  const loadAll = document.getElementById('loadAll');
  const pageInfo = document.getElementById('pageInfo');
  const editButton = document.getElementById('editButton');
  const saveButton = document.getElementById('saveButton');
  const cancelButton = document.getElementById('cancelButton');
  const undoButton = document.getElementById('undoButton');
  const DEFAULT_LIMIT = 1024 * 1024;

  const state = {
    id: itemId,
    ext: '',
    encoding: '',
    name: '',
    content: '',
    endOffset: 0,
    hasMore: false,
    loadedFully: false,
    expectedMtimeMs: 0,
    totalBytes: 0,
    loading: false,
    editing: false,
  };

  function showStatus(message, kind = '') {
    status.hidden = false;
    status.textContent = message;
    status.className = `status${kind ? ` ${kind}` : ''}`;
  }

  function hideStatus() {
    status.hidden = true;
    status.textContent = '';
    status.className = 'status';
  }

  function formatBytes(value) {
    if (!Number.isFinite(value)) return '';
    if (value < 1024) return `${value} B`;
    if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
    return `${(value / (1024 * 1024)).toFixed(1)} MB`;
  }

  function updateMeta(data) {
    state.name = data.name || '';
    state.ext = data.ext || '';
    state.encoding = data.encoding || 'utf-8';
    state.expectedMtimeMs = data.mtimeMs || 0;
    fileTitle.textContent = `${data.name || 'Text file'}.${data.ext || ''}`;
    const modified = new Date(Number(data.mtimeMs) || Date.now()).toLocaleString();
    meta.textContent = [
      data.mimeType || 'text/plain',
      state.encoding,
      formatBytes(data.size),
      `modified ${modified}`,
    ].join(' · ');
  }

  function clearPreview() {
    preview.replaceChildren();
  }

  function appendText(content) {
    let pre = preview.querySelector('pre');
    if (!pre) {
      pre = document.createElement('pre');
      preview.appendChild(pre);
    }
    pre.append(content);
  }

  function isMarkdown(ext) {
    return ext === 'md' || ext === 'markdown';
  }

  function renderMarkdown(source) {
    clearPreview();
    let pre = null;
    let inCode = false;
    const tableRows = [];

    const flushTable = () => {
      if (tableRows.length === 0) return;
      const table = document.createElement('table');
      const isHeader = tableRows[0].some((cell) => /^:?-{2,}:?$/.test(cell));
      const rows = isHeader ? tableRows.slice(1) : tableRows;
      if (rows.length > 0) {
        const head = document.createElement('thead');
        const headRow = document.createElement('tr');
        for (const cell of rows[0]) {
          const th = document.createElement('th');
          th.textContent = cell;
          headRow.appendChild(th);
        }
        head.appendChild(headRow);
        table.appendChild(head);
      }
      const body = document.createElement('tbody');
      for (const row of rows.slice(1)) {
        const tr = document.createElement('tr');
        for (const cell of row) {
          const td = document.createElement('td');
          td.textContent = cell;
          tr.appendChild(td);
        }
        body.appendChild(tr);
      }
      table.appendChild(body);
      preview.appendChild(table);
      tableRows.length = 0;
    };

    for (const rawLine of source.split('\n')) {
      const line = rawLine.trimEnd();
      if (line.trim().startsWith('```')) {
        flushTable();
        if (inCode) {
          inCode = false;
          pre = null;
        } else {
          inCode = true;
          pre = document.createElement('pre');
          const code = document.createElement('code');
          pre.appendChild(code);
          preview.appendChild(pre);
        }
        continue;
      }
      if (inCode && pre) {
        const code = pre.querySelector('code');
        code.append(`${line}\n`);
        continue;
      }

      const trimmed = line.trim();
      if (!trimmed) {
        flushTable();
        continue;
      }

      const heading = trimmed.match(/^(#{1,6})\s+(.*)$/);
      if (heading) {
        flushTable();
        const tag = `h${heading[1].length}`;
        const el = document.createElement(tag);
        el.textContent = heading[2];
        preview.appendChild(el);
        continue;
      }

      const quote = trimmed.match(/^>\s?(.*)$/);
      if (quote) {
        flushTable();
        const block = document.createElement('blockquote');
        const p = document.createElement('p');
        p.textContent = quote[1];
        block.appendChild(p);
        preview.appendChild(block);
        continue;
      }

      const task = trimmed.match(/^([-*+])\s+\[( |x|X)\]\s+(.*)$/);
      if (task) {
        flushTable();
        const div = document.createElement('div');
        div.className = 'task';
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = task[2].toLowerCase() === 'x';
        checkbox.disabled = true;
        const label = document.createElement('span');
        label.textContent = task[3];
        div.append(checkbox, label);
        preview.appendChild(div);
        continue;
      }

      const bullet = trimmed.match(/^([-*+])\s+(.*)$/);
      const numbered = trimmed.match(/^(\d+)[.)]\s+(.*)$/);
      if (bullet || numbered) {
        flushTable();
        const listType = numbered ? 'ol' : 'ul';
        let list = preview.lastElementChild;
        if (!list || list.tagName.toLowerCase() !== listType) {
          list = document.createElement(listType);
          preview.appendChild(list);
        }
        const li = document.createElement('li');
        li.textContent = (bullet ? bullet[2] : numbered[2]);
        list.appendChild(li);
        continue;
      }

      if (trimmed.includes('|') && trimmed.split('|').filter((cell) => cell.trim()).length >= 2) {
        const cells = trimmed
          .replace(/^\|/, '')
          .replace(/\|$/, '')
          .split('|')
          .map((cell) => cell.trim());
        tableRows.push(cells);
        continue;
      }

      if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
        flushTable();
        preview.appendChild(document.createElement('hr'));
        continue;
      }

      flushTable();
      const p = document.createElement('p');
      p.textContent = markdownInlineText(trimmed);
      preview.appendChild(p);
    }
    flushTable();
  }

  function markdownInlineText(value) {
    const image = value.match(/^!\[([^\]]*)\]\([^)]*\)$/);
    if (image) return `[Image] ${image[1]}`;
    const link = value.match(/^\[([^\]]+)\]\([^)]*\)$/);
    if (link) return link[1];
    return value.replace(/`([^`]+)`/g, '$1');
  }

  function renderContent(data, append) {
    if (!append) clearPreview();
    state.content += data.content || '';
    if (isMarkdown(state.ext)) {
      renderMarkdown(state.content);
    } else if (append) {
      appendText(data.content || '');
    } else {
      appendText(data.content || '');
      if (!data.content && data.totalBytes === 0) {
        showStatus('Empty text file', 'empty');
      }
    }
    if (!state.editing) editor.value = state.content;
  }

  function updatePager(data) {
    state.endOffset = data.endOffset;
    state.hasMore = data.hasMore;
    state.loadedFully = !data.hasMore;
    state.totalBytes = data.totalBytes;
    pager.hidden = state.editing || !data.hasMore;
    loadMore.hidden = state.editing;
    loadAll.hidden = state.editing;
    loadMore.disabled = false;
    loadAll.disabled = false;
    pageInfo.textContent = `${formatBytes(state.endOffset)} / ${formatBytes(data.totalBytes)}`;
    editButton.disabled = state.editing || !state.loadedFully || state.loading;
  }

  function enterEdit() {
    if (!state.loadedFully) {
      showStatus('Load the full file before editing');
      return;
    }
    state.editing = true;
    preview.hidden = true;
    editor.hidden = false;
    editor.value = state.content;
    editButton.hidden = true;
    saveButton.hidden = false;
    cancelButton.hidden = false;
    undoButton.hidden = false;
    pager.hidden = true;
    hideStatus();
  }

  function exitEdit() {
    state.editing = false;
    preview.hidden = false;
    editor.hidden = true;
    editButton.hidden = false;
    saveButton.hidden = true;
    cancelButton.hidden = true;
    undoButton.hidden = true;
  }

  async function load(offset = 0, append = false) {
    if (state.loading) return;
    state.loading = true;
    loadMore.disabled = true;
    loadAll.disabled = true;
    editButton.disabled = true;
    if (!append) {
      state.content = '';
      showStatus('Loading...', 'loading');
    }
    try {
      const response = await fetch(`${apiBase}/api/v2/item/textDetail?id=${encodeURIComponent(state.id)}&offset=${offset}&limit=${DEFAULT_LIMIT}`);
      const body = await response.json();
      if (!response.ok || body.status !== 'success') {
        throw Object.assign(new Error(body.message || `HTTP ${response.status}`), { code: body.code });
      }
      const data = body.data;
      updateMeta(data);
      renderContent(data, append);
      updatePager(data);
      hideStatus();
    } catch (err) {
      clearPreview();
      pager.hidden = true;
      state.loadedFully = false;
      showStatus(`${err.code || 'TEXT_DETAIL_READ_FAILED'}: ${err.message}`);
    } finally {
      state.loading = false;
      loadMore.disabled = !state.hasMore;
      loadAll.disabled = !state.hasMore;
      editButton.disabled = state.editing || !state.loadedFully;
    }
  }

  async function loadAllRemaining() {
    loadAll.disabled = true;
    while (state.hasMore && !state.loading) {
      await load(state.endOffset, true);
      if (!state.hasMore) break;
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
  }

  async function save() {
    try {
      const response = await fetch(`${apiBase}/api/v2/item/textSave`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: state.id,
          content: editor.value,
          expectedMtimeMs: state.expectedMtimeMs,
        }),
      });
      const body = await response.json();
      if (!response.ok || body.status !== 'success') {
        throw Object.assign(new Error(body.message || `HTTP ${response.status}`), { code: body.code });
      }
      exitEdit();
      await load(0, false);
    } catch (err) {
      showStatus(`${err.code || 'TEXT_SAVE_FAILED'}: ${err.message}`);
    }
  }

  async function undo() {
    try {
      const response = await fetch(`${apiBase}/api/v2/item/textUndo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: state.id }),
      });
      const body = await response.json();
      if (!response.ok || body.status !== 'success') {
        throw Object.assign(new Error(body.message || `HTTP ${response.status}`), { code: body.code });
      }
      exitEdit();
      await load(0, false);
    } catch (err) {
      showStatus(`${err.code || 'TEXT_UNDO_FAILED'}: ${err.message}`);
    }
  }

  loadMore.addEventListener('click', () => load(state.endOffset, true));
  loadAll.addEventListener('click', loadAllRemaining);
  editButton.addEventListener('click', enterEdit);
  cancelButton.addEventListener('click', () => {
    exitEdit();
    load(0, false);
  });
  saveButton.addEventListener('click', save);
  undoButton.addEventListener('click', undo);

  if (!state.id) {
    showStatus('ITEM_ID_REQUIRED: item id is required');
  } else {
    load();
  }
})();
