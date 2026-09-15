/**
 * M5-1（F17）：`/roadmap.html` 的 React 接管实现——六个面板的 DOM id/class、
 * `?api=` 覆盖契约与请求契约均与迁移前的 public 页一致
 * （`tests/roadmap-panels.mjs` 按 `#panel-*`/`.panel.active`/`[data-tab]`/`#batchItems option`
 * /`.plugin-card`/`#quickResults .result-item` 直接断言）。
 *
 * 实现约束与 workbench 同源（见 `../shared/formFields.tsx`）：表单字段非受控、
 * `document` 级监听用原生 `addEventListener`。
 *
 * 与旧内联脚本的唯一语义差异是**渲染方式**：旧页靠字符串拼 innerHTML（自带 escapeHtml
 * 手写转义），这里由 JSX 承担转义，XSS 面因此按构造消失，业务分支逐条保持。
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { resolveApiBaseOverride, requestApi } from '../shared/runtimeAddress'
import { LabeledInput, LabeledSelect, LabeledTextarea, StatusLine, useFieldBag } from '../shared/formFields'

/** 本页的接口基址：历史 `?api=` loopback 覆盖优先，否则用统一的运行期地址。 */
export const API_BASE = resolveApiBaseOverride()

interface LibraryItem {
  id: string
  name: string
  ext: string
  annotation?: string
  url?: string
  tags?: string[]
  star?: number
  comments?: { text?: string }[]
  folders?: string[]
}

interface FolderNode {
  id: string
  name: string
  children?: FolderNode[]
}

interface FlatFolder extends FolderNode {
  depth: number
}

interface PluginEntry {
  id: string
  name: string
  version?: string
  installed?: boolean
}

interface PluginCenter {
  plugins?: PluginEntry[]
}

interface DuplicateGroup {
  items: { id: string; name: string; size: number }[]
}

interface JobInfo {
  type: string
  status: string
  message: string
  progress?: number
  result?: unknown
}

interface StatusEntry {
  text: string
  error: boolean
}

const TABS: { key: string; label: string }[] = [
  { key: 'A', label: 'A 批量管理' },
  { key: 'B', label: 'B 重复扫描' },
  { key: 'C', label: 'C Inspector' },
  { key: 'D', label: 'D 筛选搜索' },
  { key: 'E', label: 'E Eaglepack' },
  { key: 'F', label: 'F 插件中心' },
]

function flattenFolders(tree: FolderNode[], depth = 0): FlatFolder[] {
  return tree.flatMap((folder) => [
    { id: folder.id, name: folder.name, depth },
    ...flattenFolders(folder.children || [], depth + 1),
  ])
}

function parseCsv(value: string): string[] {
  return String(value || '').split(',').map((entry) => entry.trim()).filter(Boolean)
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

export function Roadmap() {
  const { fieldRef, readValue, readChecked, selectedValues, setValue, setChecked, focus } = useFieldBag()

  const [activeTab, setActiveTab] = useState('A')
  const [items, setItems] = useState<LibraryItem[]>([])
  const [folders, setFolders] = useState<FolderNode[]>([])
  const [plugins, setPlugins] = useState<PluginEntry[]>([])
  const [pluginDetail, setPluginDetail] = useState('Select a plugin')
  const [duplicateGroups, setDuplicateGroups] = useState<DuplicateGroup[] | null>(null)
  const [duplicateProgress, setDuplicateProgress] = useState(0)
  const [jobProgress, setJobProgress] = useState(0)
  const [quickResults, setQuickResults] = useState<LibraryItem[] | null>(null)
  const [filterResults, setFilterResults] = useState<LibraryItem[] | null>(null)
  const [filterCount, setFilterCount] = useState('')
  const [status, setStatus] = useState<Record<string, StatusEntry>>({})
  const libraryStatus = `Library: ${items.length} items`

  const duplicateTimer = useRef<number | null>(null)
  const jobTimer = useRef<number | null>(null)

  const say = useCallback((id: string, text: string, error = false) => {
    setStatus((prev) => ({ ...prev, [id]: { text, error } }))
  }, [])
  const textOf = (id: string) => status[id]?.text ?? ''
  const errorOf = (id: string) => status[id]?.error ?? false

  const api = useCallback(async <T,>(path: string, init?: RequestInit): Promise<T> => (
    requestApi<T>(API_BASE, path, init)
  ), [])

  const jsonInit = (body: unknown): RequestInit => ({
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  const loadItems = useCallback(async () => {
    setItems(await api<LibraryItem[]>('/api/item/list'))
  }, [api])

  const loadFolders = useCallback(async () => {
    setFolders(await api<FolderNode[]>('/api/folder/list'))
  }, [api])

  const loadPlugins = useCallback(async () => {
    const data = await api<PluginCenter>('/api/plugins/center')
    setPlugins(data.plugins || [])
  }, [api])

  useEffect(() => {
    (async () => {
      await Promise.all([loadItems(), loadFolders(), loadPlugins()])
    })().catch((err: unknown) => say('panelAStatus', errorMessage(err), true))
    // 首次挂载：与旧脚本的启动 IIFE 同序（条目/文件夹/插件并发）。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 旧脚本在首批数据到位后对 #inspectorItem 补派发一次 change 来填充表单；
  // 这里直接调用同一段填充逻辑（非冒泡的原生 change 事件不会到达 React 根容器）。
  useEffect(() => {
    if (items.length > 0) fillInspector(items[0].id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length > 0])

  useEffect(() => () => {
    if (duplicateTimer.current !== null) window.clearInterval(duplicateTimer.current)
    if (jobTimer.current !== null) window.clearInterval(jobTimer.current)
  }, [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setActiveTab('D')
        focus('quickKeyword')
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function fillInspector(id: string): void {
    const item = items.find((entry) => entry.id === id)
    if (!item) return
    setValue('inspectorName', item.name || '')
    setValue('inspectorAnnotation', item.annotation || '')
    setValue('inspectorUrl', item.url || '')
    setValue('inspectorTags', (item.tags || []).join(', '))
    setValue('inspectorStar', String(item.star || 0))
    setValue('inspectorComments', (item.comments || []).map((comment) => comment.text || '').join('\n'))
    setValue('inspectorItem', id)
    // 多选：逐个 option 对齐，与旧脚本一致。
    const el = document.getElementById('inspectorFolders')
    if (el instanceof HTMLSelectElement) {
      for (const option of Array.from(el.options)) option.selected = (item.folders || []).includes(option.value)
    }
  }

  const flatFolders = flattenFolders(folders)

  const pollJob = useCallback((jobId: string) => {
    if (jobTimer.current !== null) window.clearInterval(jobTimer.current)
    jobTimer.current = window.setInterval(async () => {
      try {
        const job = await api<JobInfo>(`/api/jobs/${encodeURIComponent(jobId)}`)
        setJobProgress(job.progress || 0)
        say('jobStatus', `${job.type} ${job.status}: ${job.message}`)
        if (job.status === 'complete' || job.status === 'error') {
          if (jobTimer.current !== null) window.clearInterval(jobTimer.current)
          jobTimer.current = null
          setJobProgress(100)
          if (job.result) say('jobStatus', JSON.stringify(job.result))
        }
      } catch (err) {
        if (jobTimer.current !== null) window.clearInterval(jobTimer.current)
        jobTimer.current = null
        say('jobStatus', errorMessage(err), true)
      }
    }, 300)
  }, [api, say])

  async function searchResults(target: 'quick' | 'filter', list: LibraryItem[]): Promise<void> {
    if (target === 'quick') setQuickResults(list)
    else setFilterResults(list)
  }

  function renderResults(list: LibraryItem[] | null) {
    if (!list) return null
    if (list.length === 0) return <div className="muted">No results</div>
    return list.map((item) => (
      <div className="result-item" key={item.id}>
        <div>
          <div>{item.name}</div>
          <div className="muted">{(item.tags || []).join(', ')}</div>
        </div>
        <a className="pill" href={`/src/app/preview-window.html?id=${encodeURIComponent(item.id)}`} target="_blank" rel="noreferrer">Preview</a>
      </div>
    ))
  }

  return (
    <>
      <header>
        <div>
          <h1>Eagle Roadmap Panels</h1>
          <div className="muted" id="libraryStatus">{items.length > 0 ? libraryStatus : 'Loading library'}</div>
        </div>
        <div className="links">
          <a href="/pages.html">Pages</a>
          <a href="/workbench.html">Workbench</a>
          <a href="/src/app/index.html" target="_blank" rel="noreferrer">Main UI</a>
          <a href="/src/app/preferences.html" target="_blank" rel="noreferrer">Preferences</a>
        </div>
      </header>
      <nav id="tabs" aria-label="Roadmap tasks">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            className={activeTab === tab.key ? 'active' : ''}
            data-tab={tab.key}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </nav>
      <main>
        <section id="panel-A" className={`panel${activeTab === 'A' ? ' active' : ''}`}>
          <div className="card">
            <h2>Batch Management</h2>
            <div className="grid3">
              <div>
                <label>Items</label>
                <select id="batchItems" multiple ref={fieldRef('batchItems')}>
                  {items.map((item) => <option value={item.id} key={item.id}>{item.name} [{item.ext}]</option>)}
                </select>
                <div className="row" style={{ marginTop: 8 }}>
                  <button
                    className="secondary small"
                    id="selectAllItems"
                    onClick={() => {
                      for (const option of Array.from(fieldRefOptions('batchItems'))) option.selected = true
                    }}
                  >
                    All
                  </button>
                  <button
                    className="secondary small"
                    id="clearItems"
                    onClick={() => {
                      for (const option of Array.from(fieldRefOptions('batchItems'))) option.selected = false
                    }}
                  >
                    Clear
                  </button>
                </div>
              </div>
              <div>
                <h2>Rename</h2>
                <LabeledSelect id="renameMode" label="Mode" refFn={fieldRef('renameMode')} defaultValue="format">
                  <option value="format">Format</option>
                  <option value="replace">Replace</option>
                </LabeledSelect>
                <LabeledInput id="renameFormat" label="Format / Replace" refFn={fieldRef('renameFormat')} defaultValue="* - %NN" placeholder="* - %NN" />
                <LabeledInput id="renameStart" label="Start Index" refFn={fieldRef('renameStart')} type="number" min="0" defaultValue="1" />
                <LabeledInput id="renameFind" label="Find" refFn={fieldRef('renameFind')} placeholder="old" />
                <LabeledInput id="renameReplace" label="Replace" refFn={fieldRef('renameReplace')} placeholder="new" />
                <LabeledSelect id="renameTextCase" label="Text Case" refFn={fieldRef('renameTextCase')} defaultValue="none">
                  <option value="none">None</option>
                  <option value="uppercase">Uppercase</option>
                  <option value="lowercase">Lowercase</option>
                  <option value="capitalize">Capitalize</option>
                </LabeledSelect>
                <button
                  id="batchRenameButton"
                  style={{ marginTop: 10 }}
                  onClick={async () => {
                    const ids = selectedValues('batchItems')
                    if (ids.length === 0) { say('panelAStatus', 'Select items first', true); return }
                    try {
                      const changed = await api<LibraryItem[]>('/api/item/batchRename', jsonInit({
                        ids,
                        mode: readValue('renameMode'),
                        format: readValue('renameFormat'),
                        startAt: Number(readValue('renameStart')),
                        find: readValue('renameFind'),
                        replace: readValue('renameReplace'),
                        textCase: readValue('renameTextCase'),
                      }))
                      say('panelAStatus', `Renamed ${changed.length} items`)
                      await loadItems()
                    } catch (err) {
                      say('panelAStatus', errorMessage(err), true)
                    }
                  }}
                >
                  Batch Rename
                </button>
              </div>
              <div>
                <h2>Update</h2>
                <LabeledInput id="batchTags" label="Tags" refFn={fieldRef('batchTags')} placeholder="UI, 收藏" />
                <LabeledTextarea id="batchAnnotation" label="Annotation" refFn={fieldRef('batchAnnotation')} />
                <LabeledInput id="batchUrl" label="URL" refFn={fieldRef('batchUrl')} placeholder="https://" />
                <LabeledInput id="batchStar" label="Star" refFn={fieldRef('batchStar')} type="number" min="0" max="5" defaultValue="" />
                <button
                  id="batchUpdateButton"
                  style={{ marginTop: 10 }}
                  onClick={async () => {
                    const ids = selectedValues('batchItems')
                    if (ids.length === 0) { say('panelAStatus', 'Select items first', true); return }
                    const patch: Record<string, unknown> = {}
                    const tags = parseCsv(readValue('batchTags'))
                    const annotation = readValue('batchAnnotation')
                    const url = readValue('batchUrl')
                    const star = readValue('batchStar')
                    if (tags.length > 0) patch.tags = tags
                    if (annotation !== '') patch.annotation = annotation
                    if (url !== '') patch.url = url
                    if (star !== '') patch.star = Number(star)
                    if (Object.keys(patch).length === 0) { say('panelAStatus', 'Enter at least one update field', true); return }
                    try {
                      const changed = await api<LibraryItem[]>('/api/item/batchUpdate', jsonInit({ ids, patch }))
                      say('panelAStatus', `Updated ${changed.length} items`)
                      await loadItems()
                    } catch (err) {
                      say('panelAStatus', errorMessage(err), true)
                    }
                  }}
                >
                  Batch Update
                </button>
              </div>
            </div>
          </div>
          <div className="card">
            <h2>Folders &amp; Password</h2>
            <div className="grid3">
              <div>
                <label>Target Folder</label>
                <select id="folderSelect" ref={fieldRef('folderSelect')}>
                  {flatFolders.map((folder) => (
                    <option value={folder.id} key={folder.id}>{'  '.repeat(folder.depth)}{folder.name}</option>
                  ))}
                </select>
                <LabeledSelect id="folderMode" label="Assignment" refFn={fieldRef('folderMode')} defaultValue="add">
                  <option value="add">Add</option>
                  <option value="move">Move</option>
                </LabeledSelect>
                <button
                  id="assignFolderButton"
                  style={{ marginTop: 10 }}
                  onClick={async () => {
                    const ids = selectedValues('batchItems')
                    const folderId = readValue('folderSelect')
                    if (ids.length === 0 || !folderId) { say('panelAStatus', 'Select items and folder', true); return }
                    try {
                      const changed = await api<LibraryItem[]>('/api/item/addToFolder', jsonInit({
                        ids, folderID: folderId, mode: readValue('folderMode'),
                      }))
                      say('panelAStatus', `Assigned ${changed.length} items`)
                      await loadItems()
                    } catch (err) {
                      say('panelAStatus', errorMessage(err), true)
                    }
                  }}
                >
                  Assign Folder
                </button>
              </div>
              <div>
                <LabeledInput id="folderPassword" label="New Password" refFn={fieldRef('folderPassword')} type="password" />
                <LabeledInput id="folderCurrentPassword" label="Current Password" refFn={fieldRef('folderCurrentPassword')} type="password" />
                <div className="row" style={{ marginTop: 10 }}>
                  <button
                    className="secondary"
                    id="setFolderPassword"
                    onClick={() => {
                      const folderId = readValue('folderSelect')
                      const password = readValue('folderPassword')
                      if (!folderId || !password) { say('panelAStatus', 'Select folder and enter password', true); return }
                      void folderPasswordAction('/api/folder/setPassword', { folderID: folderId, password })
                    }}
                  >
                    Set
                  </button>
                  <button
                    className="secondary"
                    id="verifyFolderPassword"
                    onClick={async () => {
                      const folderId = readValue('folderSelect')
                      const password = readValue('folderPassword')
                      if (!folderId || !password) { say('panelAStatus', 'Select folder and enter password', true); return }
                      try {
                        const valid = await api<boolean>('/api/folder/verifyPassword', jsonInit({ folderID: folderId, password }))
                        say('panelAStatus', valid ? 'Password valid' : 'Password invalid', !valid)
                      } catch (err) {
                        say('panelAStatus', errorMessage(err), true)
                      }
                    }}
                  >
                    Verify
                  </button>
                  <button
                    className="secondary"
                    id="changeFolderPassword"
                    onClick={() => {
                      const folderId = readValue('folderSelect')
                      const password = readValue('folderPassword')
                      const currentPassword = readValue('folderCurrentPassword')
                      if (!folderId || !password || !currentPassword) { say('panelAStatus', 'Enter current and new password', true); return }
                      void folderPasswordAction('/api/folder/changePassword', { folderID: folderId, currentPassword, password })
                    }}
                  >
                    Change
                  </button>
                  <button
                    className="danger"
                    id="removeFolderPassword"
                    onClick={() => {
                      const folderId = readValue('folderSelect')
                      if (!folderId) { say('panelAStatus', 'Select folder', true); return }
                      void folderPasswordAction('/api/folder/removePassword', { folderID: folderId })
                    }}
                  >
                    Remove
                  </button>
                </div>
              </div>
              <div>
                <h2>Tags</h2>
                <LabeledInput id="tagSource" label="Tag Name" refFn={fieldRef('tagSource')} placeholder="UI" />
                <LabeledInput id="tagTarget" label="New Name / Merge Target" refFn={fieldRef('tagTarget')} placeholder="Interface" />
                <div className="row" style={{ marginTop: 10 }}>
                  <button
                    className="secondary"
                    id="renameTagButton"
                    onClick={async () => {
                      const source = readValue('tagSource')
                      const target = readValue('tagTarget')
                      if (!source || !target) { say('panelAStatus', 'Enter tag names', true); return }
                      try {
                        await api('/api/tag/update', jsonInit({ name: source, newName: target }))
                        say('panelAStatus', `Renamed tag ${source}`)
                        await loadItems()
                      } catch (err) {
                        say('panelAStatus', errorMessage(err), true)
                      }
                    }}
                  >
                    Rename
                  </button>
                  <button
                    className="secondary"
                    id="mergeTagButton"
                    onClick={async () => {
                      const source = readValue('tagSource')
                      const target = readValue('tagTarget')
                      if (!source || !target) { say('panelAStatus', 'Enter tag names', true); return }
                      try {
                        await api('/api/tag/merge', jsonInit({ source, target }))
                        say('panelAStatus', `Merged tag ${source} into ${target}`)
                        await loadItems()
                      } catch (err) {
                        say('panelAStatus', errorMessage(err), true)
                      }
                    }}
                  >
                    Merge
                  </button>
                </div>
              </div>
            </div>
            <StatusLine id="panelAStatus" text={textOf('panelAStatus')} error={errorOf('panelAStatus')} />
          </div>
        </section>

        <section id="panel-B" className={`panel${activeTab === 'B' ? ' active' : ''}`}>
          <div className="card">
            <h2>Duplicate Scan &amp; Merge</h2>
            <div className="grid2">
              <div>
                <LabeledSelect id="duplicateMethod" label="Method" refFn={fieldRef('duplicateMethod')} defaultValue="same">
                  <option value="same">Exact</option>
                  <option value="similar">Similar</option>
                </LabeledSelect>
                <LabeledInput id="duplicateThreshold" label="Similarity Threshold" refFn={fieldRef('duplicateThreshold')} type="number" min="0" max="1" step="0.05" defaultValue="0.55" />
                <button
                  id="scanDuplicatesButton"
                  style={{ marginTop: 10 }}
                  onClick={async () => {
                    const ids = selectedValues('batchItems')
                    setDuplicateProgress(0)
                    say('duplicateStatus', 'Scanning...')
                    if (duplicateTimer.current !== null) window.clearInterval(duplicateTimer.current)
                    duplicateTimer.current = window.setInterval(() => {
                      setDuplicateProgress((current) => Math.min(92, current + 14))
                    }, 120)
                    try {
                      const data = await api<{ scanned: number; groups: DuplicateGroup[] }>('/api/item/duplicates/scan', jsonInit({
                        method: readValue('duplicateMethod'),
                        threshold: Number(readValue('duplicateThreshold')),
                        ids,
                      }))
                      if (duplicateTimer.current !== null) window.clearInterval(duplicateTimer.current)
                      duplicateTimer.current = null
                      setDuplicateProgress(100)
                      setDuplicateGroups(data.groups)
                      say('duplicateStatus', `Scanned ${data.scanned} items, ${data.groups.length} groups`)
                    } catch (err) {
                      if (duplicateTimer.current !== null) window.clearInterval(duplicateTimer.current)
                      duplicateTimer.current = null
                      say('duplicateStatus', errorMessage(err), true)
                    }
                  }}
                >
                  Scan Duplicates
                </button>
              </div>
              <div>
                <div className="progress-shell"><div className="progress-bar" id="duplicateProgress" style={{ width: `${duplicateProgress}%` }} /></div>
                <StatusLine id="duplicateStatus" text={textOf('duplicateStatus')} error={errorOf('duplicateStatus')} />
              </div>
            </div>
            <div id="duplicateGroups">
              {duplicateGroups === null ? null : (duplicateGroups.length === 0
                ? <div className="muted">No duplicate groups</div>
                : duplicateGroups.map((group, index) => (
                  <div className="group" key={`group-${index}`}>
                    <div className="row" style={{ justifyContent: 'space-between' }}>
                      <strong>Group {index + 1}</strong>
                      <span className="muted">{group.items.length} items</span>
                    </div>
                    {group.items.map((entry) => (
                      <div className="list-item" key={entry.id}>
                        <span>{entry.name}</span><span className="pill">{entry.size}</span>
                      </div>
                    ))}
                    <div className="row" style={{ marginTop: 8 }}>
                      <label style={{ margin: 0 }}>Keep</label>
                      <select id={`keep-${index}`} ref={fieldRef(`keep-${index}`)} style={{ maxWidth: 260 }}>
                        {group.items.map((entry) => <option value={entry.id} key={entry.id}>{entry.name}</option>)}
                      </select>
                      <button
                        className="danger small"
                        onClick={async () => {
                          const keepId = readValue(`keep-${index}`)
                          const ids = group.items.map((entry) => entry.id)
                          try {
                            await api('/api/item/mergeDuplicates', jsonInit({ ids, keepId }))
                            say('duplicateStatus', 'Merged')
                            await loadItems()
                            const scanButton = document.getElementById('scanDuplicatesButton')
                            if (scanButton instanceof HTMLButtonElement) scanButton.click()
                          } catch (err) {
                            say('duplicateStatus', errorMessage(err), true)
                          }
                        }}
                      >
                        Merge
                      </button>
                    </div>
                  </div>
                )))}
            </div>
          </div>
        </section>

        <section id="panel-C" className={`panel${activeTab === 'C' ? ' active' : ''}`}>
          <div className="card">
            <h2>Inspector Edit</h2>
            <div className="grid2">
              <div>
                <label>Item</label>
                <select id="inspectorItem" ref={fieldRef('inspectorItem')} onChange={() => fillInspector(readValue('inspectorItem'))}>
                  {items.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}
                </select>
                <LabeledInput id="inspectorName" label="Name" refFn={fieldRef('inspectorName')} />
                <LabeledTextarea id="inspectorAnnotation" label="Annotation" refFn={fieldRef('inspectorAnnotation')} />
                <LabeledInput id="inspectorUrl" label="URL" refFn={fieldRef('inspectorUrl')} />
              </div>
              <div>
                <LabeledInput id="inspectorTags" label="Tags" refFn={fieldRef('inspectorTags')} placeholder="UI, 收藏" />
                <label>Folders</label>
                <select id="inspectorFolders" multiple ref={fieldRef('inspectorFolders')}>
                  {flatFolders.map((folder) => (
                    <option value={folder.id} key={folder.id}>{'  '.repeat(folder.depth)}{folder.name}</option>
                  ))}
                </select>
                <LabeledInput id="inspectorStar" label="Star" refFn={fieldRef('inspectorStar')} type="number" min="0" max="5" defaultValue="0" />
                <LabeledTextarea id="inspectorComments" label="Comments" refFn={fieldRef('inspectorComments')} placeholder="one comment per line" />
                <button
                  id="saveInspectorButton"
                  style={{ marginTop: 10 }}
                  onClick={async () => {
                    const id = readValue('inspectorItem')
                    if (!id) { say('inspectorStatus', 'Select an item', true); return }
                    try {
                      const comments = readValue('inspectorComments').split('\n').map((text) => text.trim()).filter(Boolean)
                        .map((text) => ({ id: `COMMENT-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, text, modificationTime: Date.now() }))
                      await api('/api/item/update', jsonInit({
                        id,
                        name: readValue('inspectorName'),
                        annotation: readValue('inspectorAnnotation'),
                        url: readValue('inspectorUrl'),
                        tags: parseCsv(readValue('inspectorTags')),
                        folders: selectedValues('inspectorFolders'),
                        star: Number(readValue('inspectorStar')),
                        comments,
                      }))
                      say('inspectorStatus', 'Saved')
                      await loadItems()
                    } catch (err) {
                      say('inspectorStatus', errorMessage(err), true)
                    }
                  }}
                >
                  Save Inspector
                </button>
              </div>
            </div>
            <StatusLine id="inspectorStatus" text={textOf('inspectorStatus')} error={errorOf('inspectorStatus')} />
          </div>
        </section>

        <section id="panel-D" className={`panel${activeTab === 'D' ? ' active' : ''}`}>
          <div className="card">
            <h2>Quick Search</h2>
            <div className="row">
              <input
                id="quickKeyword"
                ref={fieldRef('quickKeyword')}
                placeholder="name / tag / annotation / url"
                style={{ maxWidth: 420 }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') document.getElementById('quickSearchButton')?.click()
                }}
              />
              <button
                id="quickSearchButton"
                onClick={async () => {
                  const keyword = readValue('quickKeyword')
                  await searchResults('quick', await api<LibraryItem[]>(`/api/item/search?keyword=${encodeURIComponent(keyword)}`))
                }}
              >
                Search
              </button>
            </div>
            <div id="quickResults" className="result-list">{renderResults(quickResults)}</div>
          </div>
          <div className="card">
            <h2>Filters</h2>
            <div className="grid3">
              <div>
                <LabeledInput id="filterKeyword" label="Keyword" refFn={fieldRef('filterKeyword')} />
                <LabeledInput id="filterTags" label="Tags" refFn={fieldRef('filterTags')} />
                <LabeledInput id="filterColor" label="Color" refFn={fieldRef('filterColor')} type="color" defaultValue="#4f8cff" />
                <LabeledSelect id="filterExt" label="Type" refFn={fieldRef('filterExt')} defaultValue="">
                  <option value="">Any</option>
                  <option value="png">PNG</option>
                  <option value="jpg">JPG</option>
                  <option value="gif">GIF</option>
                  <option value="webp">WebP</option>
                  <option value="mp4">Video</option>
                  <option value="mp3">Audio</option>
                  <option value="ttf">Font</option>
                  <option value="pdf">PDF</option>
                </LabeledSelect>
              </div>
              <div>
                <LabeledInput id="filterMinWidth" label="Min Width" refFn={fieldRef('filterMinWidth')} type="number" min="0" defaultValue="" />
                <LabeledInput id="filterMaxWidth" label="Max Width" refFn={fieldRef('filterMaxWidth')} type="number" min="0" defaultValue="" />
                <LabeledInput id="filterMinHeight" label="Min Height" refFn={fieldRef('filterMinHeight')} type="number" min="0" defaultValue="" />
                <LabeledInput id="filterMaxHeight" label="Max Height" refFn={fieldRef('filterMaxHeight')} type="number" min="0" defaultValue="" />
              </div>
              <div>
                <LabeledInput id="filterStar" label="Star" refFn={fieldRef('filterStar')} type="number" min="0" max="5" defaultValue="" />
                <LabeledInput id="filterDateFrom" label="Date From" refFn={fieldRef('filterDateFrom')} type="date" />
                <LabeledInput id="filterDateTo" label="Date To" refFn={fieldRef('filterDateTo')} type="date" />
                <label>Options</label>
                <div className="row">
                  <label style={{ margin: 0 }}><input id="filterHasAnnotation" type="checkbox" ref={fieldRef('filterHasAnnotation')} /> Annotation</label>
                  <label style={{ margin: 0 }}><input id="filterHasUrl" type="checkbox" ref={fieldRef('filterHasUrl')} /> URL</label>
                </div>
              </div>
            </div>
            <div className="row" style={{ marginTop: 10 }}>
              <button
                id="applyFilters"
                onClick={async () => {
                  const params = new URLSearchParams()
                  const set = (key: string, value: string) => { if (value !== '' && value != null) params.set(key, value) }
                  set('keyword', readValue('filterKeyword'))
                  set('tags', readValue('filterTags'))
                  const color = readValue('filterColor')
                  if (color && color !== '#4f8cff') set('color', color)
                  set('ext', readValue('filterExt'))
                  set('minWidth', readValue('filterMinWidth'))
                  set('maxWidth', readValue('filterMaxWidth'))
                  set('minHeight', readValue('filterMinHeight'))
                  set('maxHeight', readValue('filterMaxHeight'))
                  set('star', readValue('filterStar'))
                  set('dateFrom', readValue('filterDateFrom'))
                  set('dateTo', readValue('filterDateTo'))
                  if (readChecked('filterHasAnnotation')) params.set('hasAnnotation', 'true')
                  if (readChecked('filterHasUrl')) params.set('hasUrl', 'true')
                  const results = await api<LibraryItem[]>(`/api/item/search?${params.toString()}`)
                  setFilterCount(`${results.length} items`)
                  await searchResults('filter', results)
                }}
              >
                Apply Filters
              </button>
              <button
                className="secondary"
                id="resetFilters"
                onClick={() => {
                  for (const id of ['filterKeyword', 'filterTags', 'filterMinWidth', 'filterMaxWidth', 'filterMinHeight', 'filterMaxHeight', 'filterStar', 'filterDateFrom', 'filterDateTo']) setValue(id, '')
                  setValue('filterColor', '#4f8cff')
                  setValue('filterExt', '')
                  setChecked('filterHasAnnotation', false)
                  setChecked('filterHasUrl', false)
                  setFilterCount('')
                  setFilterResults(null)
                }}
              >
                Reset
              </button>
              <span className="muted" id="filterCount">{filterCount}</span>
            </div>
            <div id="filterResults" className="result-list">{renderResults(filterResults)}</div>
          </div>
        </section>

        <section id="panel-E" className={`panel${activeTab === 'E' ? ' active' : ''}`}>
          <div className="card">
            <h2>Eaglepack Progress</h2>
            <div className="grid2">
              <div>
                <LabeledInput id="eaglepackDest" label="Export Destination" refFn={fieldRef('eaglepackDest')} placeholder="optional absolute path" />
                <button
                  id="startExportJob"
                  style={{ marginTop: 10 }}
                  onClick={async () => {
                    try {
                      const data = await api<{ job: { id: string } }>('/api/export/eaglepack/start', jsonInit({
                        destFile: readValue('eaglepackDest') || undefined,
                      }))
                      pollJob(data.job.id)
                    } catch (err) {
                      say('jobStatus', errorMessage(err), true)
                    }
                  }}
                >
                  Start Export Job
                </button>
              </div>
              <div>
                <LabeledInput id="eaglepackImportFile" label="Import File" refFn={fieldRef('eaglepackImportFile')} placeholder={'C:\\path\\library.eaglepack'} />
                <LabeledSelect id="eaglepackMode" label="Mode" refFn={fieldRef('eaglepackMode')} defaultValue="replace">
                  <option value="replace">Replace</option>
                  <option value="merge">Merge</option>
                </LabeledSelect>
                <button
                  id="startImportJob"
                  style={{ marginTop: 10 }}
                  onClick={async () => {
                    const file = readValue('eaglepackImportFile')
                    if (!file) { say('jobStatus', 'Enter import file path', true); return }
                    try {
                      const data = await api<{ job: { id: string } }>('/api/import/eaglepack/start', jsonInit({
                        file, mode: readValue('eaglepackMode'),
                      }))
                      pollJob(data.job.id)
                    } catch (err) {
                      say('jobStatus', errorMessage(err), true)
                    }
                  }}
                >
                  Start Import Job
                </button>
              </div>
            </div>
            <div className="progress-shell"><div className="progress-bar" id="jobProgress" style={{ width: `${jobProgress}%` }} /></div>
            <StatusLine id="jobStatus" text={textOf('jobStatus')} error={errorOf('jobStatus')} />
          </div>
        </section>

        <section id="panel-F" className={`panel${activeTab === 'F' ? ' active' : ''}`}>
          <div className="card">
            <h2>Plugin Center</h2>
            <div className="grid2">
              <div>
                <button className="secondary" id="refreshPlugins" onClick={() => { void loadPlugins() }}>Refresh</button>
                <div id="pluginList" className="plugin-list">
                  {plugins.length === 0 ? <div className="muted">No plugins found</div> : plugins.map((plugin) => (
                    <div className="plugin-card" key={plugin.id}>
                      <div className="name">{plugin.name}</div>
                      <div className="meta">{plugin.id} · {plugin.version || '-'}{plugin.installed ? ' · installed' : ''}</div>
                      <div className="row">
                        <button
                          className="secondary small"
                          onClick={async () => {
                            try {
                              const data = await api<{ url: string }>('/api/plugins/open', jsonInit({ id: plugin.id }))
                              window.open(data.url, '_blank')
                              say('pluginStatus', `Opened ${plugin.id}`)
                            } catch (err) {
                              say('pluginStatus', errorMessage(err), true)
                            }
                          }}
                        >
                          Open
                        </button>
                        <button
                          className="secondary small"
                          onClick={async () => {
                            const found = plugins.find((entry) => entry.id === plugin.id)
                            const detail = found || await api<PluginEntry>(`/api/plugins/${encodeURIComponent(plugin.id)}`)
                            setPluginDetail(JSON.stringify(detail, null, 2))
                          }}
                        >
                          Detail
                        </button>
                        {plugin.installed ? (
                          <button
                            className="danger small"
                            onClick={async () => {
                              try {
                                await api('/api/plugins/uninstall', jsonInit({ id: plugin.id }))
                                say('pluginStatus', `Uninstalled ${plugin.id}`)
                                await loadPlugins()
                              } catch (err) {
                                say('pluginStatus', errorMessage(err), true)
                              }
                            }}
                          >
                            Uninstall
                          </button>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h2>Detail</h2>
                <pre id="pluginDetail" className="muted" style={{ whiteSpace: 'pre-wrap', minHeight: 120 }}>{pluginDetail}</pre>
                <LabeledInput id="pluginPackagePath" label="Plugin Package Path" refFn={fieldRef('pluginPackagePath')} placeholder={'C:\\path\\plugin.eagleplugin'} />
                <button
                  id="installPluginButton"
                  style={{ marginTop: 10 }}
                  onClick={async () => {
                    const file = readValue('pluginPackagePath')
                    if (!file) { say('pluginStatus', 'Enter plugin package path', true); return }
                    try {
                      const installed = await api<PluginEntry>('/api/plugins/install', jsonInit({ file }))
                      say('pluginStatus', `Installed ${installed.name || installed.id}`)
                      await loadPlugins()
                    } catch (err) {
                      say('pluginStatus', errorMessage(err), true)
                    }
                  }}
                >
                  Install
                </button>
                <LabeledInput id="pluginSourceDir" label="Source Directory" refFn={fieldRef('pluginSourceDir')} placeholder={'C:\\path\\plugin-source'} />
                <button
                  id="packPluginButton"
                  style={{ marginTop: 10 }}
                  onClick={async () => {
                    const sourceDir = readValue('pluginSourceDir')
                    if (!sourceDir) { say('pluginStatus', 'Enter plugin source directory', true); return }
                    try {
                      const data = await api<{ path: string }>('/api/plugins/pack', jsonInit({ sourceDir }))
                      say('pluginStatus', `Packed -> ${data.path}`)
                    } catch (err) {
                      say('pluginStatus', errorMessage(err), true)
                    }
                  }}
                >
                  Pack
                </button>
              </div>
            </div>
            <StatusLine id="pluginStatus" text={textOf('pluginStatus')} error={errorOf('pluginStatus')} />
          </div>
        </section>
      </main>
    </>
  )

  async function folderPasswordAction(action: string, body: unknown): Promise<void> {
    try {
      const data = await api<unknown>(action, jsonInit(body))
      say('panelAStatus', JSON.stringify(data))
    } catch (err) {
      say('panelAStatus', errorMessage(err), true)
    }
  }

  function fieldRefOptions(id: string): HTMLOptionElement[] {
    const el = document.getElementById(id)
    return el instanceof HTMLSelectElement ? Array.from(el.options) : []
  }
}
