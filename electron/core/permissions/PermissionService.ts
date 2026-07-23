import type { DownloadItem, Event, Session, WebContents } from 'electron'
import type { DownloadSource } from '../../../shared/downloads'

const ALLOWED_PROTOCOLS = new Set(['http:', 'https:'])

export class PermissionService {
  private readonly configured = new Set<Session>()
  private readonly downloadSources = new WeakMap<WebContents, DownloadSource>()
  private downloadHandler?: (event: Event, item: DownloadItem, source: DownloadSource) => void

  setDownloadHandler(handler: (event: Event, item: DownloadItem, source: DownloadSource) => void) {
    this.downloadHandler = handler
  }

  registerDownloadSource(contents: WebContents, source: DownloadSource) {
    this.downloadSources.set(contents, source)
  }

  unregisterDownloadSource(contents: WebContents) {
    this.downloadSources.delete(contents)
  }

  configureSession(electronSession: Session) {
    if (this.configured.has(electronSession)) return
    this.configured.add(electronSession)
    electronSession.setPermissionCheckHandler(() => false)
    electronSession.setPermissionRequestHandler((_contents, _permission, callback) => {
      void _contents
      void _permission
      callback(false)
    })
    electronSession.on('will-download', (event, item, contents) => {
      const source = this.downloadSources.get(contents)
      if (!source || !this.downloadHandler) {
        event.preventDefault()
        return
      }
      this.downloadHandler(event, item, source)
    })
  }

  isAllowedUrl(value: string) {
    try { return ALLOWED_PROTOCOLS.has(new URL(value).protocol) } catch { return false }
  }

  shouldOpenNewWindow(url: string) { return this.isAllowedUrl(url) }
  isPermissionAllowed(permission: string) {
    void permission
    return false
  }
  shouldAllowDownload() { return false }
  shouldAllowFullscreen() { return false }
  isTrustedWebContents(contents: WebContents) { void contents; return true }
}
