export type DownloadState = 'preparing' | 'progressing' | 'completed' | 'failed' | 'cancelled'

export interface DownloadStatus {
  id: string
  viewId: string
  fileName: string
  state: DownloadState
  receivedBytes: number
  totalBytes: number
  message?: string
}

export interface DownloadSource {
  viewId: string
  partition: string
  type: 'web' | 'whatsapp'
  profileId?: string
  isVisible: () => boolean
}

const ALLOWED_DOWNLOAD_PROTOCOLS = new Set(['https:', 'blob:'])
const DANGEROUS_EXTENSIONS = new Set([
  'bat', 'cmd', 'com', 'cpl', 'exe', 'hta', 'js', 'jse', 'lnk', 'msi', 'msp',
  'pif', 'ps1', 'reg', 'scr', 'vbe', 'vbs', 'wsf', 'wsh',
])

export function classifyDownloadUrl(value: string) {
  try {
    const parsed = new URL(value)
    return {
      allowed: ALLOWED_DOWNLOAD_PROTOCOLS.has(parsed.protocol),
      protocol: parsed.protocol,
      hostname: parsed.protocol === 'https:' ? parsed.hostname : '',
    }
  } catch {
    return { allowed: false, protocol: 'invalid', hostname: '' }
  }
}

export function sanitizeDownloadFileName(value: string) {
  const withoutPath = value.replace(/^.*[\\/]/, '')
  const withoutControlCharacters = [...withoutPath]
    .map((character) => character.charCodeAt(0) < 32 ? '_' : character)
    .join('')
  const sanitized = withoutControlCharacters
    .replace(/[<>:"/\\|?*]/g, '_')
    .replace(/[. ]+$/g, '')
    .trim()
  if (!sanitized) return 'download'
  if (sanitized.length <= 180) return sanitized
  const extensionIndex = sanitized.lastIndexOf('.')
  const extension = extensionIndex > 0 ? sanitized.slice(extensionIndex, extensionIndex + 21) : ''
  return `${sanitized.slice(0, Math.max(1, 180 - extension.length))}${extension}`
}

export function isPotentiallyDangerousDownload(fileName: string) {
  const extension = fileName.split('.').at(-1)?.toLocaleLowerCase('en-US') ?? ''
  return DANGEROUS_EXTENSIONS.has(extension)
}

export function canStartManagedDownload(source: DownloadSource, url: string, hasUserGesture: boolean) {
  if (!hasUserGesture || !source.isVisible() || !classifyDownloadUrl(url).allowed) return false
  if (source.type === 'whatsapp') return true
  return source.viewId === MIRO_VIEW_ID && isMiroDownloadUrlAllowed(url)
}
import { MIRO_VIEW_ID, isMiroDownloadUrlAllowed } from './miro'
