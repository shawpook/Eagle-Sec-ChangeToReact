const JSON_EXTENSIONS = ['.json', '.lottie'] as const
const GIF_EXTENSIONS = ['.gif'] as const
const VIDEO_EXTENSIONS = [
  '.3g2',
  '.3gp',
  '.amv',
  '.asf',
  '.avi',
  '.drc',
  '.dv',
  '.evo',
  '.f4v',
  '.flv',
  '.h264',
  '.h265',
  '.hevc',
  '.ismv',
  '.ivf',
  '.m1v',
  '.m2t',
  '.m2ts',
  '.m2v',
  '.m4v',
  '.mjpeg',
  '.mjpg',
  '.mkv',
  '.mod',
  '.mov',
  '.mp2v',
  '.mp4',
  '.mpe',
  '.mpeg',
  '.mpg',
  '.mts',
  '.mxf',
  '.nut',
  '.ogm',
  '.ogv',
  '.qt',
  '.rm',
  '.rmvb',
  '.roq',
  '.tod',
  '.ts',
  '.vob',
  '.webm',
  '.wmv',
  '.y4m',
] as const
const AUDIO_EXTENSIONS = [
  '.aac',
  '.ac3',
  '.aif',
  '.aifc',
  '.aiff',
  '.alac',
  '.amr',
  '.ape',
  '.au',
  '.caf',
  '.dts',
  '.eac3',
  '.flac',
  '.m4a',
  '.m4b',
  '.mka',
  '.mp2',
  '.mp3',
  '.mpa',
  '.oga',
  '.ogg',
  '.opus',
  '.ra',
  '.tak',
  '.tta',
  '.wav',
  '.weba',
  '.wma',
  '.wv',
] as const

const BROWSER_RENDERABLE_IMAGE_EXTENSIONS = [
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
  '.bmp',
  '.svg',
  '.avif',
] as const

const METADATA_IMAGE_EXTENSIONS = [
  '.psd',
  '.psb',
  '.tif',
  '.tiff',
  '.heic',
  '.heif',
  '.ico',
  '.icns',
  '.dds',
  '.tga',
  '.jp2',
  '.j2c',
  '.jxl',
] as const

const FULL_RESOLUTION_IMAGE_PREVIEW_EXTENSIONS = [
  '.ai',
  '.ait',
  '.afdesign',
  '.afphoto',
  '.afpub',
  '.dds',
  '.eps',
  '.fig',
  '.figma',
  '.heic',
  '.heif',
  '.icns',
  '.ico',
  '.idml',
  '.indd',
  '.indl',
  '.indt',
  '.ps',
  '.psb',
  '.psd',
  '.tga',
  '.tif',
  '.tiff',
  '.xd',
] as const

const DESIGN_DOCUMENT_EXTENSIONS = [
  '.ai',
  '.ait',
  '.eps',
  '.pdf',
  '.ps',
  '.sketch',
  '.xd',
  '.fig',
  '.figma',
  '.afdesign',
  '.afphoto',
  '.afpub',
  '.indd',
  '.indl',
  '.indt',
  '.idml',
] as const

const PROJECT_FILE_EXTENSIONS = [
  '.aep',
  '.aepx',
  '.prproj',
  '.pproj',
  '.prfpset',
  '.mogrt',
  '.drp',
  '.drb',
  '.drt',
  '.fcpxml',
  '.fcpxmld',
  '.otio',
] as const

const OFFICE_DOCUMENT_EXTENSIONS = [
  '.doc',
  '.docm',
  '.docx',
  '.dot',
  '.dotm',
  '.dotx',
  '.dps',
  '.et',
  '.key',
  '.numbers',
  '.odp',
  '.ods',
  '.odt',
  '.pages',
  '.pot',
  '.potm',
  '.potx',
  '.pps',
  '.ppsm',
  '.ppsx',
  '.ppt',
  '.pptm',
  '.pptx',
  '.wps',
  '.xla',
  '.xlam',
  '.xls',
  '.xlsb',
  '.xlsm',
  '.xlsx',
  '.xlt',
  '.xltm',
  '.xltx',
] as const

const PROJECT_PACKAGE_EXTENSIONS = [
  '.fcpbundle',
  '.fcpproject',
  '.imovielibrary',
  '.imovieproj',
  '.imovieproject',
  '.dra',
] as const

const FONT_EXTENSIONS = [
  '.ttf',
  '.otf',
  '.woff',
  '.woff2',
  '.ttc',
  '.eot',
  '.pfa',
  '.pfb',
  '.vfb',
] as const

const MODEL_3D_EXTENSIONS = [
  '.glb',
  '.gltf',
  '.obj',
  '.fbx',
  '.usd',
  '.usda',
  '.usdc',
  '.usdz',
  '.stl',
  '.blend',
  '.3ds',
  '.dae',
  '.abc',
  '.ply',
  '.wrl',
  '.vrml',
] as const

const DOCUMENT_EXTENSIONS_PLAIN = [
  '.md',
  '.markdown',
  '.rst',
  '.txt',
  '.epub',
  '.rtf',
  '.csv',
  '.tsv',
  '.xml',
  '.yaml',
  '.yml',
  '.log',
  ...OFFICE_DOCUMENT_EXTENSIONS,
] as const

const ARCHIVE_EXTENSIONS = [
  '.7z',
  '.arj',
  '.bz2',
  '.bzip2',
  '.cab',
  '.gz',
  '.gzip',
  '.lha',
  '.lzh',
  '.lz',
  '.lz4',
  '.rar',
  '.tar',
  '.tbz',
  '.tbz2',
  '.tgz',
  '.txz',
  '.tzst',
  '.xz',
  '.zip',
  '.zipx',
  '.zst',
] as const

const MARKDOWN_DOCUMENT_EXTENSIONS = [
  '.md',
  '.markdown',
] as const

const TEXT_EDITABLE_DOCUMENT_EXTENSIONS = [
  '.json',
  '.md',
  '.markdown',
  '.rst',
  '.txt',
  '.csv',
  '.tsv',
  '.xml',
  '.yaml',
  '.yml',
  '.log',
] as const

export const SUPPORTED_JSON_EXTENSIONS = [...JSON_EXTENSIONS]
export const SUPPORTED_GIF_EXTENSIONS = [...GIF_EXTENSIONS]
export const SUPPORTED_VIDEO_EXTENSIONS = [...VIDEO_EXTENSIONS]
export const SUPPORTED_AUDIO_EXTENSIONS = [...AUDIO_EXTENSIONS]
export const BROWSER_RENDERABLE_IMAGE_EXTENSION_LIST = [...BROWSER_RENDERABLE_IMAGE_EXTENSIONS]
export const METADATA_IMAGE_EXTENSION_LIST = [...METADATA_IMAGE_EXTENSIONS]
export const FULL_RESOLUTION_IMAGE_PREVIEW_EXTENSION_LIST = [...FULL_RESOLUTION_IMAGE_PREVIEW_EXTENSIONS]
export const DESIGN_DOCUMENT_EXTENSION_LIST = [...DESIGN_DOCUMENT_EXTENSIONS]
export const PROJECT_FILE_EXTENSION_LIST = [...PROJECT_FILE_EXTENSIONS]
export const PROJECT_PACKAGE_EXTENSION_LIST = [...PROJECT_PACKAGE_EXTENSIONS]
export const FONT_EXTENSION_LIST = [...FONT_EXTENSIONS]
export const MODEL_3D_EXTENSION_LIST = [...MODEL_3D_EXTENSIONS]
export const DOCUMENT_PLAIN_EXTENSION_LIST = [...DOCUMENT_EXTENSIONS_PLAIN]
export const ARCHIVE_EXTENSION_LIST = [...ARCHIVE_EXTENSIONS]
export const MARKDOWN_DOCUMENT_EXTENSION_LIST = [...MARKDOWN_DOCUMENT_EXTENSIONS]
export const TEXT_EDITABLE_DOCUMENT_EXTENSION_LIST = [...TEXT_EDITABLE_DOCUMENT_EXTENSIONS]
export const SUPPORTED_PROJECT_EXTENSIONS = [
  ...PROJECT_FILE_EXTENSION_LIST,
  ...PROJECT_PACKAGE_EXTENSION_LIST,
]
export const SUPPORTED_IMAGE_EXTENSIONS = [
  ...BROWSER_RENDERABLE_IMAGE_EXTENSION_LIST,
  ...METADATA_IMAGE_EXTENSION_LIST,
  ...DESIGN_DOCUMENT_EXTENSION_LIST,
]
export const FORMAT_FILTER_GROUPS = [
  { id: 'project', extensions: SUPPORTED_PROJECT_EXTENSIONS },
  { id: 'video', extensions: SUPPORTED_VIDEO_EXTENSIONS },
  { id: 'image', extensions: SUPPORTED_IMAGE_EXTENSIONS },
  { id: 'animation', extensions: SUPPORTED_GIF_EXTENSIONS },
  { id: 'lottie', extensions: SUPPORTED_JSON_EXTENSIONS },
  { id: 'audio', extensions: SUPPORTED_AUDIO_EXTENSIONS },
  { id: 'font', extensions: FONT_EXTENSION_LIST },
  { id: '3d-model', extensions: MODEL_3D_EXTENSION_LIST },
  { id: 'document', extensions: DOCUMENT_PLAIN_EXTENSION_LIST },
  { id: 'archive', extensions: ARCHIVE_EXTENSION_LIST },
] as const

const browserRenderableImageExtensionSet: Set<string> = new Set(BROWSER_RENDERABLE_IMAGE_EXTENSION_LIST)
const metadataImageExtensionSet: Set<string> = new Set(METADATA_IMAGE_EXTENSION_LIST)
const fullResolutionImagePreviewExtensionSet: Set<string> = new Set(FULL_RESOLUTION_IMAGE_PREVIEW_EXTENSION_LIST)
const designDocumentExtensionSet: Set<string> = new Set(DESIGN_DOCUMENT_EXTENSION_LIST)
const projectExtensionSet: Set<string> = new Set(SUPPORTED_PROJECT_EXTENSIONS)
const projectPackageExtensionSet: Set<string> = new Set(PROJECT_PACKAGE_EXTENSION_LIST)
const supportedImageExtensionSet: Set<string> = new Set(SUPPORTED_IMAGE_EXTENSIONS)
const supportedJsonExtensionSet: Set<string> = new Set(SUPPORTED_JSON_EXTENSIONS)
const supportedGifExtensionSet: Set<string> = new Set(SUPPORTED_GIF_EXTENSIONS)
const supportedVideoExtensionSet: Set<string> = new Set(SUPPORTED_VIDEO_EXTENSIONS)
const supportedAudioExtensionSet: Set<string> = new Set(SUPPORTED_AUDIO_EXTENSIONS)
const fontExtensionSet: Set<string> = new Set(FONT_EXTENSION_LIST)
const model3dExtensionSet: Set<string> = new Set(MODEL_3D_EXTENSION_LIST)
const documentPlainExtensionSet: Set<string> = new Set(DOCUMENT_PLAIN_EXTENSION_LIST)
const archiveExtensionSet: Set<string> = new Set(ARCHIVE_EXTENSION_LIST)
const markdownDocumentExtensionSet: Set<string> = new Set(MARKDOWN_DOCUMENT_EXTENSION_LIST)
const textEditableDocumentExtensionSet: Set<string> = new Set(TEXT_EDITABLE_DOCUMENT_EXTENSION_LIST)

export function isBrowserRenderableImageExtension(extension: string) {
  return browserRenderableImageExtensionSet.has(extension.toLowerCase())
}

export function isMetadataImageExtension(extension: string) {
  return metadataImageExtensionSet.has(extension.toLowerCase())
}

export function isFullResolutionImagePreviewExtension(extension: string) {
  return fullResolutionImagePreviewExtensionSet.has(extension.toLowerCase())
}

export function isDesignDocumentExtension(extension: string) {
  return designDocumentExtensionSet.has(extension.toLowerCase())
}

export function isProjectExtension(extension: string) {
  return projectExtensionSet.has(extension.toLowerCase())
}

export function isProjectPackageExtension(extension: string) {
  return projectPackageExtensionSet.has(extension.toLowerCase())
}

export function isSupportedImageExtension(extension: string) {
  return supportedImageExtensionSet.has(extension.toLowerCase())
}

export function isSupportedJsonExtension(extension: string) {
  return supportedJsonExtensionSet.has(extension.toLowerCase())
}

export function isSupportedGifExtension(extension: string) {
  return supportedGifExtensionSet.has(extension.toLowerCase())
}

export function isSupportedVideoExtension(extension: string) {
  return supportedVideoExtensionSet.has(extension.toLowerCase())
}

export function isSupportedAudioExtension(extension: string) {
  return supportedAudioExtensionSet.has(extension.toLowerCase())
}

export function isSupportedFontExtension(extension: string) {
  return fontExtensionSet.has(extension.toLowerCase())
}

export function isSupported3dModelExtension(extension: string) {
  return model3dExtensionSet.has(extension.toLowerCase())
}

export function isSupportedDocumentExtension(extension: string) {
  return documentPlainExtensionSet.has(extension.toLowerCase())
}

export function isSupportedArchiveExtension(extension: string) {
  return archiveExtensionSet.has(extension.toLowerCase())
}

export function isMarkdownDocumentExtension(extension: string) {
  return markdownDocumentExtensionSet.has(extension.toLowerCase())
}

export function isTextEditableDocumentExtension(extension: string) {
  return textEditableDocumentExtensionSet.has(extension.toLowerCase())
}

export function getSupportedAssetExtensions() {
  return [
    ...SUPPORTED_JSON_EXTENSIONS,
    ...SUPPORTED_IMAGE_EXTENSIONS,
    ...SUPPORTED_GIF_EXTENSIONS,
    ...SUPPORTED_VIDEO_EXTENSIONS,
    ...SUPPORTED_AUDIO_EXTENSIONS,
    ...SUPPORTED_PROJECT_EXTENSIONS,
    ...FONT_EXTENSION_LIST,
    ...MODEL_3D_EXTENSION_LIST,
    ...DOCUMENT_PLAIN_EXTENSION_LIST,
    ...ARCHIVE_EXTENSION_LIST,
  ]
}

/**
 * 检查扩展名是否由插件支持。
 * 注意：此函数在 shared 层无法查询运行时注册表，
 * 实际查询请使用 renderer 的 getAssetFormatForExtension()。
 */
export function isPluginSupportedExtension(): boolean {
  return false
}
