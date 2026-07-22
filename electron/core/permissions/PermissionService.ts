import type { Session, WebContents } from 'electron'

const ALLOWED_PROTOCOLS = new Set(['http:', 'https:'])

export class PermissionService {
  private readonly configured = new Set<Session>()

  configureSession(electronSession: Session) {
    if (this.configured.has(electronSession)) return
    this.configured.add(electronSession)
    electronSession.setPermissionCheckHandler(() => false)
    electronSession.setPermissionRequestHandler((_contents, _permission, callback) => {
      void _contents
      void _permission
      callback(false)
    })
    electronSession.on('will-download', (event) => event.preventDefault())
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
