/**
 * M5-1（F17）：`/workbench.html` 的 React 接管实现——URL、DOM id/class 契约与
 * 请求契约均与迁移前的 public 页一致（`tests/workbench-interactions.mjs`、
 * `tests/screenshot-regression.mjs` 直接按 id/class 断言）。
 *
 * 三条与旧内联脚本有意保持一致的实现约束：
 *  1) 表单字段是**非受控**的（`defaultValue` + callback ref）。旧脚本一律 `$el.value` 直读；
 *     React 的 `inputValueTracking` 会吞掉「先 `.value =` 再派发 input」的合成事件，
 *     改成受控字段会让外部驱动（含测试）静默失效。
 *  2) `document` 级监听（快捷键 / 拖放 / 点击收起菜单）用原生 `addEventListener`：
 *     在 document 上派发的事件不会下行到 React 根容器，合成事件收不到。
 *  3) 媒体取址改走**后端受控接口**（`GET /api/library/current` 的 `imagesDir` +
 *     缩略图服务的 `/file/<绝对路径>` 通用路由），不再拼接 `mock-library/...` 常量——
 *     后者在构建产物里被剪除，生产环境必然断链。
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { apiBaseUrl, libraryFileUrl, requestApi } from '../shared/runtimeAddress'
import { LabeledInput, LabeledSelect, LabeledTextarea, StatusLine, useFieldBag } from '../shared/formFields'

interface LibraryItem {
  id: string
  name: string
  ext: string
  size?: number
  width?: number
  height?: number
  star?: number
  tags?: string[]
  url?: string
}

interface LibraryInfo {
  library: { name: string; path: string }
}

interface SmartFolder {
  id: string
  name: string
}

interface PluginEntry {
  id: string
  name: string
  url: string
}

interface DuplicateGroup {
  items: LibraryItem[]
}

type ManageRow =
  | { kind: 'duplicate'; index: number; ids: string[]; count: number }
  | { kind: 'plugin'; id: string; name: string; url: string }

const IMAGE_EXTS = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'tif', 'tiff', 'heic']
const VIDEO_EXTS = ['mp4', 'webm', 'mov', 'mkv', 'avi', 'm4v']
const AUDIO_EXTS = ['mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a']
const FONT_EXTS = ['ttf', 'otf', 'woff', 'woff2']
const MODEL_EXTS = ['obj', 'glb', 'gltf', 'stl', 'ply', 'fbx', '3ds']
const TEXT_EXTS = ['txt', 'md', 'json', 'csv', 'log']
const DOC_EXTS = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx']

/** Escape 清空的 7 个状态位（与旧脚本逐字一致；`inspectorStatus` 不在其中）。 */
const ESCAPE_STATUS_IDS = [
  'uploadStatus', 'exportStatus', 'searchStatus', 'smartStatus', 'statsStatus', 'migrateStatus', 'manageList',
]

function mediaLabel(item: LibraryItem): string {
  const ext = String(item.ext || '').toLowerCase()
  if (IMAGE_EXTS.includes(ext)) return 'Image'
  if (VIDEO_EXTS.includes(ext)) return 'Video'
  if (AUDIO_EXTS.includes(ext)) return 'Audio'
  if (FONT_EXTS.includes(ext)) return 'Font'
  if (MODEL_EXTS.includes(ext)) return '3D'
  if (TEXT_EXTS.includes(ext)) return 'Text'
  if (DOC_EXTS.includes(ext)) return 'Doc'
  return 'Other'
}

export function Workbench() {
  const { fieldRef, readValue, readFiles, setValue, focus, click } = useFieldBag()

  const [theme, setTheme] = useState(() => localStorage.getItem('eagle-reverse-theme') || 'dark')
  const [viewMode, setViewMode] = useState(() => localStorage.getItem('eagle-reverse-view') || 'grid')
  const [libraryLabel, setLibraryLabel] = useState('Library')
  const [items, setItems] = useState<LibraryItem[]>([])
  const [selected, setSelected] = useState<LibraryItem | null>(null)
  const [stats, setStats] = useState<[string, string | number][] | null>(null)
  const [smartFolders, setSmartFolders] = useState<SmartFolder[]>([])
  const [status, setStatus] = useState<Record<string, string>>({})
  const [manageRows, setManageRows] = useState<ManageRow[]>([])
  const [menuOpen, setMenuOpen] = useState(false)
  const [dropActive, setDropActive] = useState(false)
  const [imagesDir, setImagesDir] = useState('')
  const smartFolderId = useRef('')

  const say = useCallback((id: string, text: string) => {
    setStatus((prev) => ({ ...prev, [id]: text }))
    if (id === 'manageList') setManageRows([])
  }, [])

  const showRows = useCallback((rows: ManageRow[]) => {
    setStatus((prev) => ({ ...prev, manageList: '' }))
    setManageRows(rows)
  }, [])

  // 缩略图仍走当前后端（与旧页逐字一致）；原图/音视频预览改走缩略图服务的通用文件路由。
  const mediaPath = useCallback((item: LibraryItem): string => (
    imagesDir ? libraryFileUrl(imagesDir, item) : ''
  ), [imagesDir])

  const mediaLink = useCallback((item: LibraryItem): string => {
    const ext = String(item.ext || '').toLowerCase()
    const target = mediaPath(item)
    if (target) {
      if (VIDEO_EXTS.includes(ext)) return `/media-viewer/video.html?path=${encodeURIComponent(target)}`
      if (AUDIO_EXTS.includes(ext)) return `/media-viewer/audio.html?path=${encodeURIComponent(target)}`
    }
    // imagesDir 尚未取到（或图库不可用）时回落到按 id 解析的通用查看器：
    // 既不硬编码任何演示库路径，也仍然打开真实条目。
    return `/src/app/preview-window.html?id=${encodeURIComponent(item.id)}`
  }, [mediaPath])

  const loadItems = useCallback(async () => {
    setItems(await requestApi<LibraryItem[]>(apiBaseUrl(), '/api/item/list'))
  }, [])

  const refreshLibrary = useCallback(async () => {
    const info = await requestApi<LibraryInfo>(apiBaseUrl(), '/api/library/info')
    setLibraryLabel(`${info.library.name} (${info.library.path})`)
  }, [])

  const loadLibraryPaths = useCallback(async () => {
    const current = await requestApi<{ imagesDir?: string }>(apiBaseUrl(), '/api/library/current')
    setImagesDir(String(current.imagesDir || ''))
  }, [])

  const loadStats = useCallback(async () => {
    const data = await requestApi<Record<string, string | number>>(apiBaseUrl(), '/api/library/stats')
    setStats(Object.entries(data))
  }, [])

  const loadSmartFolders = useCallback(async () => {
    setSmartFolders(await requestApi<SmartFolder[]>(apiBaseUrl(), '/api/v2/smartFolder/all'))
  }, [])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem('eagle-reverse-theme', theme)
  }, [theme])

  useEffect(() => {
    localStorage.setItem('eagle-reverse-view', viewMode)
  }, [viewMode])

  // 菜单收起：document 级监听用原生 API（React 根容器收不到 document 自身派发的事件）。
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null
      if (target?.id !== 'menuButton') setMenuOpen(false)
    }
    document.addEventListener('click', onClick)
    return () => document.removeEventListener('click', onClick)
  }, [])

  useEffect(() => {
    const onDragOver = (event: DragEvent) => {
      event.preventDefault()
      setDropActive(true)
    }
    const onDragLeave = (event: DragEvent) => {
      if (!event.relatedTarget) setDropActive(false)
    }
    const onDrop = async (event: DragEvent) => {
      event.preventDefault()
      setDropActive(false)
      const files = Array.from(event.dataTransfer?.files || [])
      if (files.length > 0) await uploadFiles(files)
    }
    document.addEventListener('dragover', onDragOver)
    document.addEventListener('dragleave', onDragLeave)
    document.addEventListener('drop', onDrop)
    return () => {
      document.removeEventListener('dragover', onDragOver)
      document.removeEventListener('dragleave', onDragLeave)
      document.removeEventListener('drop', onDrop)
    }
    // uploadFiles 每次渲染重建，但只读非受控字段与 ref，注册一次即可（与旧脚本同为常驻监听）。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        focus('searchKeyword')
      }
      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
        event.preventDefault()
        click('uploadButton')
      }
      if (event.key === 'Escape') {
        setStatus((prev) => {
          const next = { ...prev }
          for (const id of ESCAPE_STATUS_IDS) next[id] = ''
          return next
        })
        setManageRows([])
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    (async () => {
      await refreshLibrary()
      await loadItems()
      await loadLibraryPaths()
      await loadStats()
      await loadSmartFolders()
    })().catch((err: unknown) => {
      say('statsStatus', err instanceof Error ? err.message : String(err))
    })
    // 首次挂载装配：与旧脚本的启动 IIFE 同序（库信息 -> 条目 -> 统计 -> 智能文件夹）。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function api<T>(path: string, init?: RequestInit): Promise<T> {
    return requestApi<T>(apiBaseUrl(), path, init)
  }

  async function uploadFiles(files: File[]): Promise<void> {
    for (const file of files) {
      const form = new FormData()
      form.append('file', file)
      form.append('tags', readValue('uploadTags'))
      form.append('annotation', readValue('uploadAnnotation'))
      const res = await fetch(`${apiBaseUrl()}/api/item/upload`, { method: 'POST', body: form })
      const body = (await res.json().catch(() => ({}))) as { message?: string }
      if (!res.ok) {
        say('uploadStatus', body.message || 'Upload failed')
        return
      }
    }
    say('uploadStatus', `Uploaded ${files.length} files`)
    await loadItems()
  }

  function selectItem(item: LibraryItem): void {
    setSelected(item)
  }

  const selectedId = selected?.id ?? null

  return (
    <>
      <header>
        <div className="row">
          <button
            className="icon-btn"
            id="menuButton"
            title="Menu"
            aria-label="Menu"
            onClick={(event) => {
              // 与旧脚本同为 stopPropagation：否则点击 svg 内的 path 时 target 不是按钮，
              // 紧随其后的 document 收起监听会把刚打开的菜单立刻关掉。
              event.stopPropagation()
              setMenuOpen((open) => !open)
            }}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
              <path d="M2 4.5h14M2 9h14M2 13.5h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
          <h1 style={{ margin: 0 }}>Eagle Reverse Workbench</h1>
          <span className="muted" id="libraryName">{libraryLabel}</span>
          <button
            className="secondary"
            id="switchLibrary"
            onClick={async () => {
              await api('/api/library/switch', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ libraryPath: 'Demo.library' }),
              })
              await refreshLibrary()
              await loadItems()
            }}
          >
            Switch to Demo
          </button>
          <button className="icon-btn" id="themeToggle" title="Toggle theme" onClick={() => setTheme((value) => (value === 'dark' ? 'light' : 'dark'))}>A</button>
        </div>
      </header>
      <div id="menuPopover" className={menuOpen ? 'visible' : ''}>
        <button
          id="menuRoadmap"
          onClick={() => {
            setMenuOpen(false)
            window.open('/roadmap.html', '_blank')
          }}
        >
          路线图
        </button>
        <button
          id="menuSettings"
          onClick={() => {
            setMenuOpen(false)
            window.open('/src/app/preferences.html', '_blank')
          }}
        >
          设置
        </button>
        <button
          id="menuExtension"
          onClick={() => {
            setMenuOpen(false)
            window.open('/browser-extension/popup.html', '_blank')
          }}
        >
          浏览器扩展
        </button>
        <button
          id="menuRefresh"
          onClick={async () => {
            setMenuOpen(false)
            await Promise.all([refreshLibrary(), loadItems(), loadStats()])
          }}
        >
          刷新
        </button>
      </div>
      <div id="dropOverlay" className={dropActive ? 'visible' : ''}>Drop files to import</div>
      <div className="layout">
        <aside>
          <section>
            <h2>Search</h2>
            <LabeledInput id="searchKeyword" label="Keyword" refFn={fieldRef('searchKeyword')} placeholder="name / annotation / url" />
            <LabeledInput id="searchTags" label="Tags" refFn={fieldRef('searchTags')} placeholder="UI, 收藏" />
            <LabeledInput id="searchStar" label="Min Star" refFn={fieldRef('searchStar')} type="number" min="0" max="5" defaultValue="0" />
            <LabeledInput id="searchColor" label="Color" refFn={fieldRef('searchColor')} type="color" defaultValue="#4f8cff" />
            <div className="row">
              <div style={{ flex: 1 }}>
                <LabeledInput id="searchMinWidth" label="Min Width" refFn={fieldRef('searchMinWidth')} type="number" min="0" defaultValue="0" />
              </div>
              <div style={{ flex: 1 }}>
                <LabeledInput id="searchMinHeight" label="Min Height" refFn={fieldRef('searchMinHeight')} type="number" min="0" defaultValue="0" />
              </div>
            </div>
            <div className="row">
              <div style={{ flex: 1 }}>
                <LabeledInput id="searchDateFrom" label="From" refFn={fieldRef('searchDateFrom')} type="date" />
              </div>
              <div style={{ flex: 1 }}>
                <LabeledInput id="searchDateTo" label="To" refFn={fieldRef('searchDateTo')} type="date" />
              </div>
            </div>
            <LabeledSelect id="searchSort" label="Sort" refFn={fieldRef('searchSort')} defaultValue="">
              <option value="">Default</option>
              <option value="name">Name</option>
              <option value="size">Size</option>
              <option value="star">Star</option>
              <option value="modificationTime">Modified</option>
            </LabeledSelect>
            <div className="row" style={{ marginTop: 10 }}>
              <button
                id="searchButton"
                onClick={async () => {
                  const params = new URLSearchParams()
                  if (readValue('searchKeyword')) params.set('keyword', readValue('searchKeyword'))
                  if (readValue('searchTags')) params.set('tags', readValue('searchTags'))
                  if (Number(readValue('searchStar')) > 0) params.set('star', readValue('searchStar'))
                  if (readValue('searchColor') && readValue('searchColor') !== '#4f8cff') params.set('color', readValue('searchColor'))
                  if (Number(readValue('searchMinWidth')) > 0) params.set('minWidth', readValue('searchMinWidth'))
                  if (Number(readValue('searchMinHeight')) > 0) params.set('minHeight', readValue('searchMinHeight'))
                  if (readValue('searchDateFrom')) params.set('dateFrom', readValue('searchDateFrom'))
                  if (readValue('searchDateTo')) params.set('dateTo', readValue('searchDateTo'))
                  if (readValue('searchSort')) params.set('sortBy', readValue('searchSort'))
                  const found = await api<LibraryItem[]>(`/api/item/search?${params.toString()}`)
                  setItems(found)
                  say('searchStatus', `Found ${found.length}`)
                }}
              >
                Search
              </button>
              <button
                className="secondary"
                id="resetSearch"
                onClick={async () => {
                  for (const id of ['searchKeyword', 'searchTags', 'searchDateFrom', 'searchDateTo']) setValue(id, '')
                  setValue('searchStar', '0')
                  setValue('searchMinWidth', '0')
                  setValue('searchMinHeight', '0')
                  setValue('searchColor', '#4f8cff')
                  setValue('searchSort', '')
                  await loadItems()
                }}
              >
                Reset
              </button>
            </div>
            <StatusLine id="searchStatus" text={status.searchStatus ?? ''} />
          </section>

          <section>
            <h2>Import</h2>
            <LabeledInput id="uploadFile" label="File" refFn={fieldRef('uploadFile')} type="file" />
            <LabeledInput id="uploadTags" label="Tags" refFn={fieldRef('uploadTags')} placeholder="UI, 导入" />
            <LabeledTextarea id="uploadAnnotation" label="Annotation" refFn={fieldRef('uploadAnnotation')} />
            <button
              id="uploadButton"
              style={{ marginTop: 10 }}
              onClick={async () => {
                const file = readFiles('uploadFile')[0]
                if (!file) {
                  say('uploadStatus', 'Choose a file first')
                  return
                }
                const form = new FormData()
                form.append('file', file)
                form.append('tags', readValue('uploadTags'))
                form.append('annotation', readValue('uploadAnnotation'))
                const res = await fetch(`${apiBaseUrl()}/api/item/upload`, { method: 'POST', body: form })
                const body = (await res.json().catch(() => ({}))) as { message?: string; data?: { name?: string } }
                if (!res.ok) {
                  say('uploadStatus', body.message || 'Upload failed')
                  return
                }
                say('uploadStatus', `Uploaded ${body.data?.name ?? ''}`)
                await loadItems()
              }}
            >
              Upload Item
            </button>
            <LabeledInput id="importFolderPath" label="Folder Path" refFn={fieldRef('importFolderPath')} placeholder={'C:\\folder\\images'} />
            <button
              id="importFolderButton"
              style={{ marginTop: 8 }}
              onClick={async () => {
                const folderPath = readValue('importFolderPath')
                if (!folderPath) {
                  say('uploadStatus', 'Enter folder path')
                  return
                }
                const data = await api<{ count: number }>('/api/item/importFolder', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ folderPath }),
                })
                say('uploadStatus', `Imported ${data.count} items`)
                await loadItems()
              }}
            >
              Import Folder
            </button>
            <LabeledTextarea id="importBase64Data" label="Base64 Data URI" refFn={fieldRef('importBase64Data')} />
            <button
              id="importBase64Button"
              style={{ marginTop: 8 }}
              onClick={async () => {
                const data = readValue('importBase64Data')
                if (!data) {
                  say('uploadStatus', 'Enter base64 data URI')
                  return
                }
                await api('/api/item/importBase64', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ data }),
                })
                say('uploadStatus', 'Imported base64 item')
                await loadItems()
              }}
            >
              Import Base64
            </button>
            <StatusLine id="uploadStatus" text={status.uploadStatus ?? ''} />
          </section>

          <section>
            <h2>Export</h2>
            <div className="row">
              <button
                className="secondary"
                id="exportCsv"
                onClick={() => {
                  window.open(`${apiBaseUrl()}/api/export/csv`, '_blank')
                  say('exportStatus', 'CSV download started')
                }}
              >
                CSV
              </button>
              <button
                className="secondary"
                id="exportEaglepack"
                onClick={async () => {
                  const data = await api<{ count: number; path: string }>('/api/export/eaglepack', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({}),
                  })
                  say('exportStatus', `Packed ${data.count} items -> ${data.path}`)
                }}
              >
                Eaglepack
              </button>
              <button
                className="secondary"
                id="backupLibrary"
                onClick={async () => {
                  const data = await api<{ path: string }>('/api/library/backup', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({}),
                  })
                  say('exportStatus', `Backup -> ${data.path}`)
                }}
              >
                Backup
              </button>
              <button
                className="secondary"
                id="restoreLibrary"
                onClick={async () => {
                  const file = window.prompt('Backup file path')
                  if (!file) return
                  await api('/api/library/restore', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ file }),
                  })
                  say('exportStatus', 'Restored')
                }}
              >
                Restore
              </button>
            </div>
            <StatusLine id="exportStatus" text={status.exportStatus ?? ''} />
          </section>

          <section>
            <h2>Library Stats</h2>
            <div className="muted" id="statsList">
              {stats
                ? stats.map(([key, value]) => (
                  <div className="list-item" key={key}><span>{key}</span><span>{String(value)}</span></div>
                ))
                : 'Loading...'}
            </div>
            <div className="row" style={{ marginTop: 10 }}>
              <button className="secondary" id="statsButton" onClick={() => { void loadStats() }}>Refresh</button>
              <button
                className="danger"
                id="repairButton"
                onClick={async () => {
                  const report = await api<{ repairedMetadata: number; repairedThumbnails: number }>('/api/library/repair', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({}),
                  })
                  say('statsStatus', `Repaired ${report.repairedMetadata} metadata, ${report.repairedThumbnails} thumbnails`)
                  await Promise.all([loadStats(), loadItems()])
                }}
              >
                Repair
              </button>
            </div>
            <StatusLine id="statsStatus" text={status.statsStatus ?? ''} />
          </section>

          <section>
            <h2>Library Migration</h2>
            <LabeledInput id="migrateSource" label="Source Path" refFn={fieldRef('migrateSource')} placeholder={'C:\\path\\source.library'} />
            <LabeledInput id="migrateDest" label="Dest Dir" refFn={fieldRef('migrateDest')} placeholder={'C:\\path\\dest'} />
            <div className="row" style={{ marginTop: 10 }}>
              <button
                className="secondary"
                id="scanLibraryButton"
                onClick={async () => {
                  const source = readValue('migrateSource')
                  if (!source) {
                    say('migrateStatus', 'Enter source library path')
                    return
                  }
                  const result = await api<{ name: string; itemCount: number; issues: unknown[] }>(`/api/library/scan?path=${encodeURIComponent(source)}`)
                  say('migrateStatus', `Scan: ${result.name}, ${result.itemCount} items, issues ${result.issues.length}`)
                }}
              >
                Scan
              </button>
              <button
                id="migrateLibraryButton"
                onClick={async () => {
                  const sourcePath = readValue('migrateSource')
                  const destDir = readValue('migrateDest')
                  if (!sourcePath) {
                    say('migrateStatus', 'Enter source library path')
                    return
                  }
                  const result = await api<{ library: { itemCount: number }; destination: string }>('/api/library/migrate', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ sourcePath, destDir }),
                  })
                  say('migrateStatus', `Migrated ${result.library.itemCount} items -> ${result.destination}`)
                }}
              >
                Migrate
              </button>
            </div>
            <StatusLine id="migrateStatus" text={status.migrateStatus ?? ''} />
          </section>

          <section>
            <h2>Smart Folder</h2>
            <LabeledInput id="smartName" label="Name" refFn={fieldRef('smartName')} placeholder="Five Star" />
            <LabeledSelect id="smartField" label="Field" refFn={fieldRef('smartField')} defaultValue="star">
              <option value="star">star</option>
              <option value="size">size</option>
              <option value="width">width</option>
              <option value="height">height</option>
              <option value="tags">tags</option>
              <option value="ext">ext</option>
            </LabeledSelect>
            <LabeledSelect id="smartOperator" label="Operator" refFn={fieldRef('smartOperator')} defaultValue="=">
              <option value="=">=</option>
              <option value={'>'}>{'>'}</option>
              <option value={'<'}>{'<'}</option>
              <option value={'>='}>{'>='}</option>
              <option value={'<='}>{'<='}</option>
              <option value="contains">contains</option>
            </LabeledSelect>
            <LabeledInput id="smartValue" label="Value" refFn={fieldRef('smartValue')} placeholder="5" />
            <LabeledTextarea id="smartConditions" label="Conditions JSON" refFn={fieldRef('smartConditions')} defaultValue='[{"field":"star","operator":"=","value":5}]' />
            <label>Existing Smart Folders</label>
            <select id="smartList" ref={fieldRef('smartList')}>
              {smartFolders.map((folder) => <option value={folder.id} key={folder.id}>{folder.name}</option>)}
            </select>
            <div className="row" style={{ marginTop: 10 }}>
              <button
                id="createSmart"
                onClick={async () => {
                  let conditions: unknown[] = []
                  try {
                    conditions = JSON.parse(readValue('smartConditions') || '[]') as unknown[]
                  } catch {
                    say('smartStatus', 'Invalid conditions JSON')
                    return
                  }
                  const data = await api<{ id: string; name: string }>('/api/v2/smartFolder/create', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: readValue('smartName') || 'Smart Folder', conditions }),
                  })
                  smartFolderId.current = data.id
                  say('smartStatus', `Created ${data.name} (${data.id})`)
                  await loadSmartFolders()
                }}
              >
                Create
              </button>
              <button
                className="secondary"
                id="querySmart"
                onClick={async () => {
                  if (!smartFolderId.current) {
                    say('smartStatus', 'Create a smart folder first')
                    return
                  }
                  const found = await api<LibraryItem[]>(`/api/v2/smartFolder/getItems?id=${encodeURIComponent(smartFolderId.current)}`)
                  setItems(found)
                  say('smartStatus', `Smart folder returned ${found.length} items`)
                }}
              >
                Query
              </button>
              <button
                className="secondary"
                id="useSmart"
                onClick={async () => {
                  smartFolderId.current = readValue('smartList')
                  if (smartFolderId.current) {
                    const found = await api<LibraryItem[]>(`/api/v2/smartFolder/getItems?id=${encodeURIComponent(smartFolderId.current)}`)
                    setItems(found)
                    say('smartStatus', `Smart folder returned ${found.length} items`)
                  }
                }}
              >
                Use
              </button>
            </div>
            <StatusLine id="smartStatus" text={status.smartStatus ?? ''} />
          </section>

          <section>
            <h2>Manage</h2>
            <div className="row">
              <button
                className="secondary"
                id="duplicatesButton"
                onClick={async () => {
                  const groups = await api<DuplicateGroup[]>('/api/item/duplicates')
                  if (groups.length === 0) {
                    say('manageList', 'No duplicates found')
                    return
                  }
                  showRows(groups.slice(0, 5).map((group, index) => ({
                    kind: 'duplicate' as const,
                    index,
                    count: group.items.length,
                    ids: group.items.map((entry) => entry.id),
                  })))
                }}
              >
                Duplicates
              </button>
              <button
                className="secondary"
                id="pluginsButton"
                onClick={async () => {
                  const plugins = await api<PluginEntry[]>('/api/plugins')
                  showRows(plugins.map((plugin) => ({ kind: 'plugin' as const, id: plugin.id, name: plugin.name, url: plugin.url })))
                }}
              >
                Plugins
              </button>
            </div>
            <LabeledInput id="pluginPackFile" label="Plugin Package Path" refFn={fieldRef('pluginPackFile')} placeholder={'C:\\path\\plugin.eagleplugin'} />
            <button
              id="installPluginButton"
              style={{ marginTop: 8 }}
              onClick={async () => {
                const file = readValue('pluginPackFile')
                if (!file) {
                  say('manageList', 'Enter plugin package path')
                  return
                }
                await api('/api/plugins/install', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ file }),
                })
                say('manageList', 'Installed')
              }}
            >
              Install Plugin
            </button>
            <div id="manageList" className="status">
              {status.manageList ?? ''}
              {manageRows.map((row) => (row.kind === 'duplicate' ? (
                <div className="list-item" key={`duplicate-${row.index}`}>
                  <span>Group {row.index + 1}: {row.count} items</span>
                  <button
                    className="danger"
                    onClick={async () => {
                      await api('/api/item/mergeDuplicates', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ ids: row.ids }),
                      })
                      say('manageList', 'Merged')
                      await loadItems()
                    }}
                  >
                    Merge
                  </button>
                </div>
              ) : (
                <div className="list-item" key={`plugin-${row.id}`}>
                  <span>{row.name}</span>
                  <a href={`${apiBaseUrl()}${row.url}`} target="_blank" rel="noreferrer">Open</a>
                  <button
                    className="danger"
                    onClick={async () => {
                      await api('/api/plugins/uninstall', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ id: row.id }),
                      })
                      say('manageList', 'Uninstalled')
                    }}
                  >
                    Uninstall
                  </button>
                  <button
                    className="secondary"
                    onClick={async () => {
                      await api('/api/plugins/disable', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ id: row.id }),
                      })
                      say('manageList', 'Disabled')
                    }}
                  >
                    Disable
                  </button>
                </div>
              )))}
            </div>
          </section>
        </aside>

        <main>
          <section>
            <div className="toolbar">
              <span className="muted" id="itemCount">{items.length} items</span>
              <button
                className={`icon-btn${viewMode === 'grid' ? ' active' : ''}`}
                id="gridButton"
                title="Grid"
                onClick={() => setViewMode('grid')}
              >
                <img src="/src/app/assets/images/dark/icons/ic-layout-grid.svg" />
              </button>
              <button
                className={`icon-btn${viewMode === 'list' ? ' active' : ''}`}
                id="listButton"
                title="List"
                onClick={() => setViewMode('list')}
              >
                <img src="/src/app/assets/images/dark/icons/ic-layout-list.svg" />
              </button>
              <button
                className="secondary"
                id="refreshItems"
                onClick={async () => {
                  await Promise.all([refreshLibrary(), loadItems()])
                }}
              >
                Refresh
              </button>
            </div>
            <div className={`grid${viewMode === 'list' ? ' list-view' : ''}`} id="itemGrid">
              {items.length === 0
                ? <div className="muted">No items</div>
                : items.map((item) => (
                  <div
                    className={`item-card${selectedId === item.id ? ' selected' : ''}`}
                    data-id={item.id}
                    key={item.id}
                    onClick={() => selectItem(item)}
                  >
                    <img src={`${apiBaseUrl()}/api/item/thumbnail?id=${encodeURIComponent(item.id)}`} alt={item.name} loading="lazy" />
                    <div className="meta">
                      <div className="name">{item.name}</div>
                      <div className="tags">
                        <span className="pill">{mediaLabel(item)}</span>
                        {' '}
                        {(item.tags || []).map((tag) => <span className="pill" key={tag}>{tag}</span>)}
                      </div>
                      <a href={mediaLink(item)} target="_blank" rel="noreferrer" style={{ fontSize: 12 }}>Preview</a>
                    </div>
                  </div>
                ))}
            </div>
          </section>
        </main>
        <aside className="right-inspector">
          <section>
            <h2>Inspector</h2>
            <div id="inspector" className="muted">
              {selected ? (
                <>
                  <div className="list-item"><span>Name</span><span>{selected.name}</span></div>
                  <div className="list-item"><span>Type</span><span>{mediaLabel(selected)}</span></div>
                  <div className="list-item"><span>Size</span><span>{selected.size || 0} bytes</span></div>
                  <div className="list-item"><span>Dimensions</span><span>{selected.width || 0} x {selected.height || 0}</span></div>
                  <div className="list-item"><span>Star</span><span>{selected.star || 0}</span></div>
                  <div className="list-item"><span>Tags</span><span>{(selected.tags || []).join(', ') || '-'}</span></div>
                  <div className="list-item"><span>URL</span><span>{selected.url || '-'}</span></div>
                  <div className="row" style={{ marginTop: 10 }}>
                    <a className="pill" href={mediaLink(selected)} target="_blank" rel="noreferrer">Preview</a>
                    <button
                      className="danger"
                      id="trashItemButton"
                      onClick={async () => {
                        await api('/api/item/moveToTrash', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ id: selected.id }),
                        })
                        say('inspectorStatus', 'Moved to trash')
                        setSelected(null)
                        await loadItems()
                      }}
                    >
                      Trash
                    </button>
                    <button
                      className="secondary"
                      id="copyUrlButton"
                      onClick={async () => {
                        if (selected.url) await navigator.clipboard.writeText(selected.url)
                        say('inspectorStatus', selected.url ? 'URL copied' : 'No URL')
                      }}
                    >
                      Copy URL
                    </button>
                  </div>
                  <StatusLine id="inspectorStatus" text={status.inspectorStatus ?? ''} />
                </>
              ) : <div className="muted">Select an item</div>}
            </div>
          </section>
        </aside>
      </div>
    </>
  )
}
