/**
 * P3-b：来源文件夹模式的侧栏 UI（React 渲染；交互全部为真实 onClick）。
 *
 * 结构/类名沿用原 shims 块的 DOM 契约（#eagle-source-mode-sidebar / .source-root-card /
 * .source-directory-row / .source-mode-tab …）——注入的样式（#eagle-source-mode-style）逐字
 * 迁移自 shims 的 ensureSourceModeStyles，保证观感与既有 CSS 一致。
 * 打开时把 .sidebar-footer 置为 source-mode-active、预留 .sidebar-container 底部空间；
 * 关闭时还原（原 shims show/destroySourceModeSidebar 的职责）。
 */
import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useSourceModeState, SourceRootNode, SourceDirectoryNode } from '../../store/sourceModeState';
import {
  closeSourceMode,
  toggleSourceRoot,
  selectSourceDirectory,
  rescanSourceRoot,
  removeSourceRoot,
} from '../../core/sourceMode';
import { t } from '../../global/eagleGlobals';

const SOURCE_MODE_CSS = `
#eagle-source-mode-sidebar {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 52px;
  display: flex;
  flex-direction: column;
  background: var(--sidebar-background-color, rgba(30,31,36,0.98));
  color: var(--sidebar-text, #e8e9ed);
  z-index: 10000;
  font-size: 12px;
  max-height: 70%;
  border-top: 1px solid rgba(255,255,255,0.08);
  border-bottom: 1px solid rgba(255,255,255,0.08);
  box-shadow: 0 -6px 24px rgba(0,0,0,0.25);
}
#eagle-source-mode-sidebar .source-mode-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 10px 12px;
  border-bottom: 1px solid rgba(255,255,255,0.08);
  flex-shrink: 0;
  font-weight: 600;
}
#eagle-source-mode-sidebar .source-mode-tabs {
  display: flex;
  gap: 4px;
  padding: 6px 10px;
  border-bottom: 1px solid rgba(255,255,255,0.08);
  flex-shrink: 0;
}
#eagle-source-mode-sidebar .source-mode-tab {
  flex: 1;
  border: 1px solid transparent;
  background: transparent;
  color: #9aa0ab;
  padding: 6px 0;
  border-radius: 8px;
  cursor: pointer;
}
#eagle-source-mode-sidebar .source-mode-tab.active {
  background: rgba(255,255,255,0.07);
  border-color: rgba(255,255,255,0.1);
  color: #fff;
}
#eagle-source-mode-sidebar .source-mode-body {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}
#eagle-source-mode-sidebar .source-mode-error {
  padding: 8px 10px;
  margin: 8px;
  border: 1px solid rgba(255,107,107,0.35);
  border-radius: 8px;
  background: rgba(255,107,107,0.1);
  color: #ff6b6b;
  font-size: 11px;
}
#eagle-source-mode-sidebar .source-root-card {
  margin-bottom: 8px;
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 10px;
  background: rgba(255,255,255,0.04);
  overflow: hidden;
}
#eagle-source-mode-sidebar .source-root-header {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  border: none;
  background: transparent;
  color: inherit;
  padding: 8px 10px;
  cursor: pointer;
  text-align: left;
}
#eagle-source-mode-sidebar .source-root-header:hover {
  background: rgba(255,255,255,0.06);
}
#eagle-source-mode-sidebar .source-root-name {
  min-width: 0;
  flex: 1;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
#eagle-source-mode-sidebar .source-root-path {
  display: block;
  color: #9aa0ab;
  font-size: 11px;
  margin-top: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
#eagle-source-mode-sidebar .source-scanning {
  color: #ffc24d;
  font-size: 11px;
  flex-shrink: 0;
}
#eagle-source-mode-sidebar .source-directory-row {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  border: none;
  background: transparent;
  color: inherit;
  padding: 5px 8px 5px 22px;
  cursor: pointer;
  text-align: left;
}
#eagle-source-mode-sidebar .source-directory-row:hover {
  background: rgba(255,255,255,0.06);
}
#eagle-source-mode-sidebar .source-directory-row.selected {
  background: rgba(91,140,255,0.18);
  color: #fff;
}
#eagle-source-mode-sidebar .source-mode-count {
  color: #9aa0ab;
  font-size: 11px;
  flex-shrink: 0;
  margin-left: auto;
  padding-right: 4px;
}
#eagle-source-mode-sidebar .source-mode-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  border: 1px solid rgba(255,255,255,0.1);
  background: transparent;
  color: inherit;
  border-radius: 8px;
  padding: 5px 9px;
  font-size: 12px;
  cursor: pointer;
}
#eagle-source-mode-sidebar .source-mode-button:hover {
  background: rgba(255,255,255,0.06);
}
#eagle-source-mode-sidebar .source-mode-button.primary {
  background: #5b8cff;
  border-color: transparent;
  color: #fff;
}
#eagle-source-mode-sidebar .source-mode-button.danger {
  color: #ff6b6b;
  border-color: rgba(255,107,107,0.35);
}
#eagle-source-mode-sidebar .source-mode-empty {
  padding: 24px 12px;
  text-align: center;
  color: #9aa0ab;
}
#eagle-source-mode-sidebar .source-manage-card {
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 10px;
  background: rgba(255,255,255,0.04);
  padding: 10px;
  margin-bottom: 8px;
}
#eagle-source-mode-sidebar .source-manage-card-title {
  font-weight: 600;
  margin-bottom: 2px;
}
#eagle-source-mode-sidebar .source-manage-card-path {
  color: #9aa0ab;
  font-size: 11px;
  word-break: break-all;
  margin-bottom: 6px;
}
#eagle-source-mode-sidebar .source-manage-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 6px;
}
.sidebar-footer.source-mode-active {
  height: auto;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.source-mode-footer-button {
  width: 100%;
  height: 28px;
  line-height: 28px;
  border: 1px solid var(--color-border-secondary);
  border-radius: 6px;
  background: var(--color-black-20, rgba(255,255,255,0.06));
  color: var(--color-text-primary);
  font-size: 12px;
  cursor: pointer;
  text-align: center;
}
.source-mode-footer-button:hover {
  border-color: var(--color-primary);
}
`;

let styleInstalled = false;
function installSourceModeStyle(): void {
  if (styleInstalled || typeof document === 'undefined') return;
  if (document.getElementById('eagle-source-mode-style')) { styleInstalled = true; return; }
  const style = document.createElement('style');
  style.id = 'eagle-source-mode-style';
  style.textContent = SOURCE_MODE_CSS;
  document.head.appendChild(style);
  styleInstalled = true;
}

function DirectoryRow({
  node, rootId, selectedRootId, selectedRelativePath, depth,
}: {
  node: SourceDirectoryNode; rootId: string; selectedRootId: string; selectedRelativePath: string; depth: number;
}) {
  const selected = selectedRootId === rootId && selectedRelativePath === node.relativePath;
  return (
    <>
      <button
        type="button"
        className={`source-directory-row${selected ? ' selected' : ''}`}
        data-source-root={rootId}
        data-source-relative-path={node.relativePath}
        style={{ paddingLeft: `${22 + depth * 14}px` }}
        onClick={() => { selectSourceDirectory(rootId, node.relativePath); }}
      >
        📁 {node.name}
        <span className="source-mode-count">{node.assetCount ?? ''}</span>
      </button>
      {(node.children || []).map((child) => (
        <DirectoryRow key={child.relativePath} node={child} rootId={rootId}
          selectedRootId={selectedRootId} selectedRelativePath={selectedRelativePath} depth={depth + 1} />
      ))}
    </>
  );
}

function SourceTree() {
  const st = useSourceModeState();
  if (st.roots.length === 0) {
    return <div className="source-mode-empty">还没有连接任何来源文件夹</div>;
  }
  return (
    <>
      {st.roots.map((root) => {
        const expanded = st.expanded[root.id] || st.roots.length === 1;
        const atRoot = st.selectedRootId === root.id && st.selectedRelativePath === '.';
        return (
          <div key={root.id} className="source-root-card">
            <button type="button" className="source-root-header" data-source-root={root.id} data-source-action="toggle-root" onClick={() => toggleSourceRoot(root.id)}>
              <span>{expanded ? '▾' : '▸'}</span>
              <span className="source-root-name">
                {root.name}
                <span className="source-root-path">{root.path}</span>
              </span>
              {st.scanning[root.id] ? <span className="source-scanning">扫描中…</span> : null}
              <span className="source-mode-count">{root.assetCount ?? ''}</span>
            </button>
            {expanded ? (
              <>
                <button
                  type="button"
                  className={`source-directory-row${atRoot ? ' selected' : ''}`}
                  data-source-root={root.id}
                  data-source-relative-path='.'
                  onClick={() => selectSourceDirectory(root.id, '.')}
                >
                  全部素材
                  <span className="source-mode-count">{root.assetCount ?? ''}</span>
                </button>
                {(root.directories || []).map((dir) => (
                  <DirectoryRow key={dir.relativePath} node={dir} rootId={root.id}
                    selectedRootId={st.selectedRootId} selectedRelativePath={st.selectedRelativePath} depth={1} />
                ))}
              </>
            ) : null}
          </div>
        );
      })}
    </>
  );
}

function SourceManage() {
  const st = useSourceModeState();
  if (st.roots.length === 0) {
    return <div className="source-mode-empty">还没有来源目录</div>;
  }
  return (
    <>
      {st.roots.map((root) => (
        <div key={root.id} className="source-manage-card">
          <div className="source-manage-card-title">{root.name}</div>
          <div className="source-manage-card-path">{root.path}</div>
          <div>
            {root.assetCount ?? 0} 个素材 · {root.missingCount ?? 0} 个丢失 · {root.watch ? '正在监控' : '未监控'}
            {st.scanning[root.id] ? ' · 扫描中…' : ''}
          </div>
          <div className="source-manage-actions">
            <button type="button" className="source-mode-button" data-source-folder={root.id} data-source-root={root.id} data-source-relative-path='.' onClick={() => selectSourceDirectory(root.id, '.')}>查看素材</button>
            <button type="button" className="source-mode-button" data-source-rescan={root.id} onClick={() => void rescanSourceRoot(root.id)}>重新扫描</button>
            <button type="button" className="source-mode-button danger" data-source-remove={root.id} onClick={() => void removeSourceRoot(root.id)}>移除此来源</button>
          </div>
        </div>
      ))}
    </>
  );
}

/** 来源模式侧栏面板（portal 到 sidebar-footer 内）；active=false 时不渲染（#eagle-source-mode-sidebar 消失）。 */
export function SourceModeSidebar() {
  const st = useSourceModeState();
  const ref = useRef<HTMLDivElement>(null);
  installSourceModeStyle();

  // 打开/关闭时的容器与 footer 布局同步（原 shims show/destroySourceModeSidebar）。
  useEffect(() => {
    const footer = document.querySelector('.sidebar-footer');
    const wrapper = document.getElementById('source-mode-footer-add');
    const container = document.querySelector('.sidebar-container') as HTMLElement | null;
    if (st.active) {
      if (footer) footer.classList.add('source-mode-active');
      if (wrapper) wrapper.style.display = 'block';
      if (container) {
        const footerHeight = footer ? footer.getBoundingClientRect().height : 64;
        container.style.bottom = `${Math.max(64, Math.ceil(footerHeight) + 16)}px`;
      }
    } else {
      if (footer) footer.classList.remove('source-mode-active');
      // 原版为静态 inline display:none（Sidebar 挂载时设过一次）；退出还原隐藏。
      if (wrapper) wrapper.style.display = 'none';
      if (container) container.style.bottom = '';
    }
  }, [st.active]);

  if (!st.active) return null;
  const host = document.getElementById('source-mode-footer-add');
  if (!host) return null;

  return createPortal(
    <div ref={ref} id="eagle-source-mode-sidebar" data-source-body="">
      <div className="source-mode-header">
        <span>{t('resources.sourceMode.title') || '来源文件夹模式'}</span>
        <button type="button" className="source-mode-button primary" onClick={() => void closeSourceMode()}>返回资源库</button>
      </div>
      <div className="source-mode-tabs">
        <button
          type="button"
          className={`source-mode-tab${st.view === 'tree' ? ' active' : ''}`}
          data-source-view="tree"
          onClick={() => useSourceModeState.setState({ view: 'tree' })}
        >
          目录
        </button>
        <button
          type="button"
          className={`source-mode-tab${st.view === 'manage' ? ' active' : ''}`}
          data-source-view="manage"
          onClick={() => useSourceModeState.setState({ view: 'manage' })}
        >
          管理
        </button>
      </div>
      {st.lastError ? (
        <div className="source-mode-error">{st.lastError}（可重试）</div>
      ) : null}
      <div className="source-mode-body">
        {st.view === 'tree' ? <SourceTree /> : <SourceManage />}
      </div>
    </div>,
    host,
  );
}