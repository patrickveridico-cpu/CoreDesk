import { BrowserWindow, session, shell } from 'electron'
import type { BrowserWindowConstructorOptions, Event, Session } from 'electron'
import { classifyWhatsAppExternalLink } from './external-link-policy'

const MAX_EXTERNAL_POPUPS = 10
const EXTERNAL_LINK_PARTITION = 'persist:coredesk-external-links'

export interface ExternalLinkSource {
  profileId?: string
  target: string
}

interface ExternalLinkDependencies {
  createWindow: (options: BrowserWindowConstructorOptions) => BrowserWindow
  openSystemUrl: (url: string) => Promise<void>
  getSession: () => Session
}

const defaultDependencies: ExternalLinkDependencies = {
  createWindow: (options) => new BrowserWindow(options),
  openSystemUrl: (url) => shell.openExternal(url),
  getSession: () => session.fromPartition(EXTERNAL_LINK_PARTITION),
}

export class WhatsAppExternalLinkManager {
  private readonly popups = new Set<BrowserWindow>()
  private sessionConfigured = false

  constructor(
    private readonly owner: BrowserWindow,
    private zoomFactor: number,
    private readonly dependencies: ExternalLinkDependencies = defaultDependencies,
  ) {}

  handle(url: string, source: ExternalLinkSource) {
    const decision = classifyWhatsAppExternalLink(url)
    const context = { target: source.target, profileId: source.profileId, protocol: decision.protocol, hostname: decision.hostname }
    if (decision.action === 'allow-internal') return decision
    if (decision.action === 'block') {
      console.warn('[WhatsApp External Link] blocked', { ...context, reason: decision.reason })
      return decision
    }
    console.log('[WhatsApp External Link] intercepted', context)
    if (decision.action === 'open-system') {
      void this.dependencies.openSystemUrl(url).catch((error) => {
        console.error('[WhatsApp External Link] failed', { ...context, reason: error instanceof Error ? error.name : 'UnknownError' })
      })
      return decision
    }
    this.openPopup(url, source, context)
    return decision
  }

  setZoomFactor(factor: number) {
    this.zoomFactor = factor
    for (const popup of this.popups) {
      if (!popup.isDestroyed() && !popup.webContents.isDestroyed()) popup.webContents.setZoomFactor(factor)
    }
  }

  closeAll() {
    for (const popup of [...this.popups]) {
      if (!popup.isDestroyed()) popup.close()
    }
    this.popups.clear()
  }

  get size() { return this.popups.size }

  private openPopup(url: string, source: ExternalLinkSource, context: Record<string, unknown>) {
    this.removeDestroyedPopups()
    if (this.popups.size >= MAX_EXTERNAL_POPUPS) {
      const existing = [...this.popups].at(-1)
      if (existing && !existing.isDestroyed()) existing.focus()
      console.warn('[WhatsApp External Link] blocked', { ...context, reason: 'popup-limit', limit: MAX_EXTERNAL_POPUPS })
      return
    }
    this.configureSession()
    const ownerBounds = this.owner.getBounds()
    const width = Math.min(1100, ownerBounds.width)
    const height = Math.min(760, ownerBounds.height)
    const popup = this.dependencies.createWindow({
      parent: this.owner,
      modal: false,
      width,
      height,
      minWidth: 720,
      minHeight: 520,
      x: Math.round(ownerBounds.x + (ownerBounds.width - width) / 2),
      y: Math.round(ownerBounds.y + (ownerBounds.height - height) / 2),
      show: false,
      frame: true,
      resizable: true,
      minimizable: true,
      maximizable: true,
      closable: true,
      backgroundColor: '#0b0e12',
      title: 'CoreDesk — Link externo',
      webPreferences: {
        partition: EXTERNAL_LINK_PARTITION,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        webSecurity: true,
        allowRunningInsecureContent: false,
      },
    })
    this.popups.add(popup)
    popup.webContents.setZoomFactor(this.zoomFactor)
    popup.once('ready-to-show', () => {
      if (popup.isDestroyed()) return
      popup.show()
      popup.focus()
    })
    popup.once('closed', () => {
      this.popups.delete(popup)
      console.log('[WhatsApp External Link] popup-closed', { popupId: popup.id, target: source.target, profileId: source.profileId })
    })
    this.configurePopupNavigation(popup, source)
    console.log('[WhatsApp External Link] popup-created', { ...context, popupId: popup.id })
    void popup.loadURL(url).catch((error) => {
      console.error('[WhatsApp External Link] failed', { ...context, popupId: popup.id, reason: error instanceof Error ? error.name : 'UnknownError' })
      if (!popup.isDestroyed()) popup.close()
    })
  }

  private configurePopupNavigation(popup: BrowserWindow, source: ExternalLinkSource) {
    popup.webContents.setWindowOpenHandler(({ url }) => {
      const decision = classifyWhatsAppExternalLink(url)
      if (decision.action === 'allow-internal' && (decision.protocol === 'http:' || decision.protocol === 'https:')) {
        const context = { target: source.target, profileId: source.profileId, protocol: decision.protocol, hostname: decision.hostname }
        console.log('[WhatsApp External Link] intercepted', context)
        this.openPopup(url, source, context)
      } else {
        this.handle(url, source)
      }
      return { action: 'deny' }
    })
    const guardNavigation = (event: Event, url: string) => {
      const decision = classifyWhatsAppExternalLink(url)
      if (decision.action === 'open-popup' || decision.action === 'allow-internal') return
      event.preventDefault()
      if (decision.action === 'open-system') this.handle(url, source)
      else if (decision.action === 'block') console.warn('[WhatsApp External Link] blocked', { target: source.target, profileId: source.profileId, protocol: decision.protocol, hostname: decision.hostname, reason: decision.reason })
    }
    popup.webContents.on('will-navigate', guardNavigation)
    popup.webContents.on('will-redirect', guardNavigation)
  }

  private configureSession() {
    if (this.sessionConfigured) return
    this.sessionConfigured = true
    const externalSession = this.dependencies.getSession()
    externalSession.setPermissionCheckHandler(() => false)
    externalSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false))
  }

  private removeDestroyedPopups() {
    for (const popup of this.popups) {
      if (popup.isDestroyed()) this.popups.delete(popup)
    }
  }
}

export { EXTERNAL_LINK_PARTITION, MAX_EXTERNAL_POPUPS }
