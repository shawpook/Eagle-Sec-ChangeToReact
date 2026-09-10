/* ==========================================================================
   Eagle Browser Tab Bar — 浏览器/Figma 风格标签栏核心逻辑
   注入路径: frontend/public/tab-bar.js（由 vite.preview.config.mjs 注入）
   设计：
   - 不修改原版压缩 bundle（app.bundle.js），通过 Angular scope 公开方法完成状态
     快照的采集与恢复，与 shims.js 的既有注入模式一致。
   - 一个标签页 = 一组导航状态快照（viewMode / folder / smartFolder / keyword /
     scrollTop），切换时保存当前标签、恢复目标标签。
   - 筛选器（eagle.filter）保持 Eagle 原生语义：全局状态，不随标签页隔离。
   ========================================================================== */
(function () {
  'use strict';

  if (window.__eagleTabBarLoaded) return;
  window.__eagleTabBarLoaded = true;

  const pagePath = window.location.pathname || '';
  if (!pagePath.endsWith('/src/app/index.html')) return;

  const STORAGE_KEY = 'eagle.tab-bar.v1';
  const MAX_TABS = 16;
  const CAPTURE_INTERVAL = 300; // 活动标签状态轮询周期
  const RESTORE_SETTLE_MS = 600; // 切换后跳过采集的时间窗，避免存到中间状态
  const ENABLE_CTRL_W_CLOSE = false; // Ctrl+W 是 Eagle 原生「关闭窗口」加速键，默认不占用

  const VIEW_LABEL_KEYS = {
    all: 'general.pages.all',
    unfiled: 'general.pages.unfiled',
    untagged: 'general.pages.untagged',
    recent: 'general.pages.recent',
    random: 'general.pages.random',
    alltags: 'general.pages.allTags',
    trash: 'general.pages.trash',
    community: 'preferencesWindow.sidebar.community',
  };

  const OPENERS = {
    all: 'openAll',
    unfiled: 'openUnfiled',
    untagged: 'openUntagged',
    recent: 'openRecent',
    random: 'openRandom',
    alltags: 'openAllTags',
    trash: 'openTrash',
    community: 'openCommunity',
  };

  const FALLBACK_LABELS = {
    'general.pages.all': '全部图片',
    'general.pages.unfiled': '未分类',
    'general.pages.untagged': '未标记',
    'general.pages.recent': '最近加入',
    'general.pages.random': '随机',
    'general.pages.allTags': '全部标签',
    'general.pages.trash': '垃圾桶',
    'preferencesWindow.sidebar.community': '社区',
  };

  let tabs = [];
  let activeId = null;
  let bar = null;
  let restoreSettleUntil = 0;
  let scrollRestorePending = false;

  /* ---------- Angular 帮助函数 ---------- */

  function getScope() {
    return window.angular && document.body ? angular.element(document.body).scope() : null;
  }

  function translate(key) {
    try {
      const injector = window.angular ? angular.element(document.body).injector() : null;
      const filter = injector && injector.get('$filter');
      const text = filter && filter('i18n')(key);
      if (typeof text === 'string' && text && text !== key) return text;
    } catch (err) {
      // 注入器不可用时回退到内置文案
    }
    return FALLBACK_LABELS[key] || key;
  }

  /* ---------- 状态采集 ---------- */

  function computeLabel(scope, state) {
    if (state.smartFolderId && scope.smartFolderMappings && scope.smartFolderMappings[state.smartFolderId]) {
      return scope.smartFolderMappings[state.smartFolderId].name;
    }
    if (state.folderId && scope.folderMappings && scope.folderMappings[state.folderId]) {
      return scope.folderMappings[state.folderId].name;
    }
    if (state.viewMode && VIEW_LABEL_KEYS[state.viewMode]) {
      return translate(VIEW_LABEL_KEYS[state.viewMode]);
    }
    return translate('general.pages.all');
  }

  function captureActive() {
    const scope = getScope();
    if (!scope) return null;
    const state = {
      viewMode: typeof scope.viewMode === 'string' ? scope.viewMode : '',
      folderId: (scope.currentFolder && scope.currentFolder.id) || null,
      smartFolderId: (scope.currentSmartFolder && scope.currentSmartFolder.id) || null,
      keyword: typeof scope.keyword === 'string' ? scope.keyword : '',
      scrollTop: 0,
    };
    // 网格滚动位置：仅当容器可见且没有正在进行的恢复时才采集
    const container = document.querySelector('#box-container');
    const inDetailMode = Boolean(scope.isDetailMode);
    if (container && !scrollRestorePending && !inDetailMode) {
      state.scrollTop = container.scrollTop;
    }
    return { state, label: computeLabel(scope, state) };
  }

  /* ---------- 状态恢复 ---------- */

  function restoreScroll(target) {
    scrollRestorePending = Boolean(target);
    if (!target) return;
    const container = document.querySelector('#box-container');
    if (!container) return;
    const deadline = Date.now() + 5000;
    const finish = () => { scrollRestorePending = false; };
    const attempt = () => {
      if (Date.now() > deadline) { finish(); return; }
      if (container.scrollHeight >= target && container.scrollHeight > container.clientHeight) {
        container.scrollTop = target;
        finish();
        return;
      }
      setTimeout(attempt, 50);
    };
    setTimeout(attempt, 80);
  }

  function applyState(tab) {
    const scope = getScope();
    if (!scope) return;
    const st = (tab && tab.state) || {};
    restoreSettleUntil = Date.now() + RESTORE_SETTLE_MS;
    try {
      scope.$evalAsync(() => {
        if (typeof scope.resetKeyword === 'function') {
          try { scope.resetKeyword(); } catch (err) { /* 关键词可能尚未就绪 */ }
        }
        let navigated = false;
        if (st.smartFolderId && scope.smartFolderMappings && scope.smartFolderMappings[st.smartFolderId]) {
          scope.openSmartFolder(scope.smartFolderMappings[st.smartFolderId], true, '');
          navigated = true;
        } else if (st.folderId && scope.folderMappings && scope.folderMappings[st.folderId]) {
          scope.openFolder(scope.folderMappings[st.folderId], true, '', false);
          navigated = true;
        } else if (st.viewMode && OPENERS[st.viewMode] && typeof scope[OPENERS[st.viewMode]] === 'function') {
          scope[OPENERS[st.viewMode]]();
          navigated = true;
        }
        if (!navigated && typeof scope.openAll === 'function') scope.openAll();
      });
    } catch (err) {
      console.warn('[eagle-tab-bar] restore failed', err);
    }
    // 关键词在导航之后单独恢复（search 内部有 debounce）
    setTimeout(() => {
      const s2 = getScope();
      if (!s2) return;
      try {
        s2.$evalAsync(() => {
          if (typeof st.keyword === 'string' && st.keyword && typeof s2.search === 'function') {
            s2.keyword = st.keyword;
            s2.search();
          }
        });
      } catch (err) {
        console.warn('[eagle-tab-bar] keyword restore failed', err);
      }
    }, 150);
    restoreScroll(st.scrollTop || 0);
  }

  /* ---------- 标签操作 ---------- */

  function activeTab() {
    return tabs.find((tab) => tab.id === activeId) || null;
  }

  function saveCurrentTab() {
    const tab = activeTab();
    if (!tab) return;
    const captured = captureActive();
    if (captured) {
      tab.state = captured.state;
      tab.label = captured.label;
    }
  }

  function switchTo(id) {
    const dbg = (window.__tabBarDbg = window.__tabBarDbg || { log: [] });
    dbg.log.push({ at: 'switchTo:enter', id, activeId });
    try {
      if (id === activeId || !tabs.some((tab) => tab.id === id)) {
        dbg.log.push({ at: 'switchTo:early-return', id, activeId });
        return;
      }
      saveCurrentTab();
      activeId = id;
      render();
      applyState(activeTab());
      save();
      dbg.log.push({ at: 'switchTo:done', id });
    } catch (err) {
      dbg.log.push({ at: 'switchTo:error', id, error: String(err && err.stack || err) });
      console.warn('[eagle-tab-bar] switchTo error', err);
    }
  }

  function addTab() {
    saveCurrentTab();
    if (tabs.length >= MAX_TABS) return;
    tabs.push({
      id: newId(),
      customName: null,
      label: translate('general.pages.all'),
      state: { viewMode: 'all', folderId: null, smartFolderId: null, keyword: '', scrollTop: 0 },
    });
    activeId = tabs[tabs.length - 1].id;
    render();
    applyState(activeTab());
    save();
  }

  function closeTab(id) {
    const index = tabs.findIndex((tab) => tab.id === id);
    if (index < 0 || tabs.length <= 1) return; // 保留至少一个标签
    tabs.splice(index, 1);
    if (id === activeId) {
      const next = tabs[Math.min(index, tabs.length - 1)];
      activeId = next.id;
      render();
      applyState(activeTab());
    } else {
      render();
    }
    save();
  }

  function renameTab(id, name) {
    const tab = tabs.find((entry) => entry.id === id);
    if (!tab) return;
    tab.customName = name && name.trim() ? name.trim() : null;
    render();
    save();
  }

  /* ---------- DOM ---------- */

  function buildDom() {
    bar = document.createElement('div');
    bar.id = 'eagle-tab-bar';
    bar.innerHTML =
      '<div class="eagle-tab-list"></div>' +
      '<button type="button" class="eagle-tab-add" tabindex="-1" title="新标签页 (Ctrl+T)"></button>';
    document.body.appendChild(bar);

    bar.addEventListener('click', (event) => {
      if (event.target.closest('.eagle-tab-add')) { addTab(); return; }
      const tabElement = event.target.closest('.eagle-tab');
      if (!tabElement) return;
      const id = tabElement.dataset.id;
      if (event.target.closest('.eagle-tab-close')) closeTab(id);
      else switchTo(id);
    });

    bar.addEventListener('dblclick', (event) => {
      const labelElement = event.target.closest('.eagle-tab-label');
      const tabElement = event.target.closest('.eagle-tab');
      if (labelElement && tabElement) startRename(tabElement.dataset.id);
    });

    // 浏览器惯例：中键关闭标签
    bar.addEventListener('auxclick', (event) => {
      if (event.button !== 1) return;
      const tabElement = event.target.closest('.eagle-tab');
      if (tabElement) {
        event.preventDefault();
        closeTab(tabElement.dataset.id);
      }
    });
  }

  function render() {
    if (!bar) return;
    const list = bar.querySelector('.eagle-tab-list');
    list.textContent = '';
    tabs.forEach((tab) => {
      const item = document.createElement('div');
      item.className = 'eagle-tab' + (tab.id === activeId ? ' active' : '');
      item.dataset.id = tab.id;
      const label = document.createElement('span');
      label.className = 'eagle-tab-label';
      label.textContent = tab.customName || tab.label || '…';
      const close = document.createElement('button');
      close.type = 'button';
      close.className = 'eagle-tab-close';
      close.textContent = '×';
      close.title = '关闭标签页';
      close.tabIndex = -1;
      item.appendChild(label);
      item.appendChild(close);
      list.appendChild(item);
    });
    const addButton = bar.querySelector('.eagle-tab-add');
    if (addButton) addButton.textContent = '+';
  }

  function startRename(id) {
    const itemElement = bar.querySelector(`.eagle-tab[data-id="${id}"]`);
    const labelElement = itemElement && itemElement.querySelector('.eagle-tab-label');
    if (!itemElement || !labelElement) return;
    const tab = tabs.find((entry) => entry.id === id);
    if (!tab) return;
    const input = document.createElement('input');
    input.className = 'eagle-tab-rename';
    input.value = tab.customName || tab.label || '';
    input.maxLength = 60;
    labelElement.replaceWith(input);
    input.focus();
    input.select();
    let done = false;
    const commit = (persist) => {
      if (done) return;
      done = true;
      if (persist) renameTab(id, input.value);
      else render(); // 取消重命名
    };
    input.addEventListener('blur', () => commit(true));
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') { event.preventDefault(); commit(true); }
      else if (event.key === 'Escape') { event.preventDefault(); commit(false); }
    });
  }

  /* ---------- 快捷键 ---------- */

  function isTypingTarget(target) {
    if (!target || typeof target.closest !== 'function') return false;
    return Boolean(target.closest('input, textarea, [contenteditable="true"]'));
  }

  function handleKeydown(event) {
    if (!(event.ctrlKey || event.metaKey)) return;
    const key = (event.key || '').toLowerCase();
    if (key === 't' && !isTypingTarget(event.target)) {
      event.preventDefault();
      addTab();
    } else if (key === 'w' && ENABLE_CTRL_W_CLOSE && !isTypingTarget(event.target)) {
      event.preventDefault();
      const tab = activeTab();
      if (tab) closeTab(tab.id);
    }
  }

  /* ---------- 持久化 ---------- */

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        activeId,
        tabs: tabs.map((tab) => ({ id: tab.id, customName: tab.customName, label: tab.label, state: tab.state })),
      }));
    } catch (err) {
      // localStorage 不可用时静默降级
    }
  }

  function loadPersisted() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || !Array.isArray(parsed.tabs) || parsed.tabs.length === 0) return null;
      return parsed;
    } catch (err) {
      return null;
    }
  }

  function sanitizeTab(raw) {
    const state = raw && raw.state && typeof raw.state === 'object' ? raw.state : {};
    return {
      id: typeof raw.id === 'string' && raw.id ? raw.id : newId(),
      customName: typeof raw.customName === 'string' ? raw.customName : null,
      label: typeof raw.label === 'string' && raw.label ? raw.label : translate('general.pages.all'),
      state: {
        viewMode: typeof state.viewMode === 'string' ? state.viewMode : 'all',
        folderId: state.folderId || null,
        smartFolderId: state.smartFolderId || null,
        keyword: typeof state.keyword === 'string' ? state.keyword : '',
        scrollTop: Number(state.scrollTop) || 0,
      },
    };
  }

  /* ---------- 启动 ---------- */

  function newId() {
    return 'tab-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
  }

  function startPolling() {
    setInterval(() => {
      if (Date.now() < restoreSettleUntil) return;
      const tab = activeTab();
      if (!tab) return;
      const captured = captureActive();
      if (!captured) return;
      const labelChanged = !tab.label || tab.label !== captured.label;
      tab.state = captured.state;
      tab.label = captured.label;
      if (labelChanged && bar) {
        const labelElement = bar.querySelector(`.eagle-tab[data-id="${tab.id}"] .eagle-tab-label`);
        if (labelElement) labelElement.textContent = tab.customName || tab.label;
      }
    }, CAPTURE_INTERVAL);
  }

  function startPeriodicSave() {
    setInterval(save, 5000);
    window.addEventListener('beforeunload', save);
  }

  function waitForReady(callback, timeout) {
    const started = Date.now();
    const tick = () => {
      const scope = getScope();
      // isUILoaded 在后台资源库加载完成后才置位，是比 folderMappings 更准确的就绪信号
      // （空文件夹的资源库 folderMappings 可能为空对象，不能作为就绪条件）
      const ready = Boolean(
        scope &&
        scope.isUILoaded === true &&
        !scope.isLoading &&
        typeof scope.openAll === 'function'
      );
      if (ready) { callback(scope); return; }
      if (Date.now() - started > timeout) {
        console.warn('[eagle-tab-bar] waitForReady timeout');
        return;
      }
      setTimeout(tick, 120);
    };
    setTimeout(tick, 150);
  }

  function init() {
    buildDom();
    const persisted = loadPersisted();
    if (persisted) {
      tabs = persisted.tabs.map(sanitizeTab);
      activeId = persisted.activeId && tabs.some((tab) => tab.id === persisted.activeId)
        ? persisted.activeId
        : tabs[0].id;
    } else {
      const current = captureActive();
      const initial = current || {
        label: translate('general.pages.all'),
        state: { viewMode: 'all', folderId: null, smartFolderId: null, keyword: '', scrollTop: 0 },
      };
      tabs = [{ id: newId(), customName: null, label: initial.label, state: initial.state }];
      activeId = tabs[0].id;
    }
    render();
    save();
    startPolling();
    startPeriodicSave();
    document.addEventListener('keydown', handleKeydown, true);
    applyState(activeTab());
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => waitForReady(init, 20000), { once: true });
  } else {
    waitForReady(init, 20000);
  }
})();
