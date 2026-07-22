import { app, BrowserWindow, session, WebContentsView } from 'electron'
import type { Event, Input, Session } from 'electron'
import type {
  NewTabRequest,
  ShortcutCommand,
  WebTabDescriptor,
  WebViewStateUpdate,
} from '../shared/contracts'
import { SHELL_LAYOUT } from '../shared/layout'
import { VIEW_CHANNELS } from './channels'
import type { PermissionService } from './core/permissions/PermissionService'

const ALLOWED_PROTOCOLS = new Set(['http:', 'https:'])

interface ManagedView {
  descriptor: WebTabDescriptor
  view: WebContentsView
  cleanup: Array<() => void>
  failed: boolean
  loading: boolean
  suspended: boolean
  loadTimer?: NodeJS.Timeout
}

function isAllowedUrl(value: string) {
  try {
    return ALLOWED_PROTOCOLS.has(new URL(value).protocol)
  } catch {
    return false
  }
}

export class WebViewManager {
  private readonly views = new Map<string, ManagedView>()
  private readonly configuredPartitions = new Set<string>()
  private activeId: string | null = null
  private attachedId: string | null = null
  private readonly embedded = new Set<string>()

  constructor(
    private readonly window: BrowserWindow,
    private readonly onViewState?: (update: WebViewStateUpdate) => void,
    private readonly permissions?: PermissionService,
  ) {}

  private devLog(message: string, details: Record<string, unknown>) {
    if (!app.isPackaged && process.env.NODE_ENV !== 'production') {
      console.log(`[WebViewManager] ${message}`, details)
    }
  }

  sync(tabs: WebTabDescriptor[], activeTabId: string) {
    const validTabs = tabs.filter((tab) => tab.id && tab.partition && this.isAllowedUrl(tab.url))
    const incomingIds = new Set(validTabs.map((tab) => tab.id))

    for (const id of this.views.keys()) {
      const existing = this.views.get(id)
      if (!incomingIds.has(id) && existing?.descriptor.type !== 'whatsapp' && id !== 'app-google' && id !== 'app-maps') {
        this.destroy(id)
      }
    }

    for (const descriptor of validTabs) {
      const current = this.views.get(descriptor.id)
      if (current && current.descriptor.partition !== descriptor.partition) {
        this.destroy(descriptor.id)
      }
      const entry = this.views.get(descriptor.id)
      if (entry) {
        entry.descriptor = descriptor
        entry.suspended = Boolean(descriptor.suspended)
      } else {
        this.create(descriptor)
      }
    }

    this.activeId = this.views.has(activeTabId) ? activeTabId : null
    this.showActive()
  }

  setEmbedded(id: string, bounds: { x: number; y: number; width: number; height: number } | null) {
    const entry = this.views.get(id)
    if (!entry) return
    if (!bounds) {
      if (this.embedded.delete(id) && !this.window.isDestroyed()) this.window.contentView.removeChildView(entry.view)
      this.showActive()
      return
    }
    if (this.attachedId && this.attachedId !== id) {
      const attached = this.views.get(this.attachedId)
      if (attached && !this.window.isDestroyed()) this.window.contentView.removeChildView(attached.view)
      this.attachedId = null
    }
    this.embedded.add(id)
    entry.view.setBounds(bounds)
    if (!this.window.isDestroyed() && this.attachedId !== id) this.window.contentView.addChildView(entry.view)
  }

  navigate(id: string, url: string) {
    const entry = this.views.get(id)
    if (!entry || !this.isAllowedUrl(url)) return
    entry.failed = false
    this.emitState({ id, error: null })
    if (id === this.activeId) this.showActive()
    void entry.view.webContents.loadURL(url)
  }

  back(id: string) {
    const entry = this.views.get(id)
    if (!entry) return
    entry.failed = false
    if (entry.view.webContents.navigationHistory.canGoBack()) {
      entry.view.webContents.navigationHistory.goBack()
      if (id === this.activeId) this.showActive()
    }
  }

  forward(id: string) {
    const entry = this.views.get(id)
    if (!entry) return
    entry.failed = false
    if (entry.view.webContents.navigationHistory.canGoForward()) {
      entry.view.webContents.navigationHistory.goForward()
      if (id === this.activeId) this.showActive()
    }
  }

  reload(id: string) {
    const entry = this.views.get(id)
    if (!entry) return
    entry.failed = false
    this.emitState({ id, error: null })
    if (id === this.activeId) this.showActive()
    entry.view.webContents.reload()
  }

  stop(id: string) {
    this.views.get(id)?.view.webContents.stop()
  }

  retry(id: string) {
    const entry = this.views.get(id)
    if (!entry) return
    this.navigate(id, entry.view.webContents.getURL() || entry.descriptor.url)
  }

  suspend(id: string) {
    const entry = this.views.get(id)
    if (!entry) return
    entry.suspended = true
    entry.view.webContents.setAudioMuted(true)
    if (this.attachedId === id) this.showActive()
  }

  resume(id: string) {
    const entry = this.views.get(id)
    if (!entry) return
    entry.suspended = false
    entry.view.webContents.setAudioMuted(false)
    if (this.activeId === id) this.showActive()
  }

  reloadView(id: string) {
    this.reload(id)
  }

  destroyView(id: string) {
    this.destroy(id)
  }

  async clearSessionData(id: string, partition: string) {
    const descriptor = this.views.get(id)?.descriptor
    const wasActive = this.activeId === id
    this.destroy(id)
    const isolatedSession = session.fromPartition(partition)
    await Promise.all([isolatedSession.clearStorageData(), isolatedSession.clearCache()])
    if (descriptor) {
      this.create(descriptor)
      if (wasActive) this.activeId = id
      this.showActive()
    }
  }

  updateBounds() {
    if (!this.attachedId) return
    const entry = this.views.get(this.attachedId)
    if (!entry) return
    const [width, height] = this.window.getContentSize()
    const y = SHELL_LAYOUT.titleBarHeight + SHELL_LAYOUT.globalBarHeight + (entry.descriptor.type === 'whatsapp' || entry.descriptor.id === 'app-google' || entry.descriptor.id === 'app-maps' ? 0 : SHELL_LAYOUT.navigationBarHeight)
    const bounds = {
      x: 0,
      y,
      width: Math.max(0, width),
      height: Math.max(0, height - y),
    }
    entry.view.setBounds(bounds)
    this.devLog('setBounds', { target: entry.descriptor.id, bounds })
  }

  dispose() {
    for (const id of [...this.views.keys()]) this.destroy(id)
  }

  private create(descriptor: WebTabDescriptor) {
    const view = new WebContentsView({
      webPreferences: {
        partition: descriptor.partition,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        webSecurity: true,
        allowRunningInsecureContent: false,
        spellcheck: true,
      },
    })
    const entry: ManagedView = {
      descriptor,
      view,
      cleanup: [],
      failed: false,
      loading: false,
      suspended: Boolean(descriptor.suspended),
    }
    if (descriptor.type === 'whatsapp') {
      view.webContents.setUserAgent(
        `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${process.versions.chrome} Safari/537.36`,
      )
    }
    view.webContents.setAudioMuted(entry.suspended)
    this.views.set(descriptor.id, entry)
    this.devLog('createView', { target: descriptor.id, reused: false })
    this.configureSession(view.webContents.session, descriptor.partition)
    this.registerViewEvents(entry)
    void view.webContents.loadURL(descriptor.url)
  }

  private configureSession(electronSession: Session, partition: string) {
    if (this.permissions) {
      this.permissions.configureSession(electronSession)
      return
    }
    if (this.configuredPartitions.has(partition)) return
    this.configuredPartitions.add(partition)
    electronSession.setPermissionCheckHandler(() => false)
    electronSession.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false))
    electronSession.on('will-download', (event) => event.preventDefault())
  }

  private registerViewEvents(entry: ManagedView) {
    const { webContents } = entry.view
    const id = entry.descriptor.id

    const onStart = () => {
      this.devLog('load-start', { viewId: id, domain: this.safeDomain(entry.descriptor.url) })
      entry.loading = true
      entry.failed = false
      this.emitState({ id, loading: true, error: null })
      if (entry.loadTimer) clearTimeout(entry.loadTimer)
      entry.loadTimer = setTimeout(() => {
        if (!entry.loading) return
        entry.loading = false
        entry.failed = true
        this.emitState({ id, loading: false, error: { code: -408, description: 'Tempo limite de carregamento excedido.', url: entry.descriptor.url } })
        if (id === this.activeId) this.showActive()
      }, 30000)
      if (id === this.activeId) this.showActive()
    }
    const onStop = () => {
      entry.loading = false
      if (entry.loadTimer) clearTimeout(entry.loadTimer)
      this.emitNavigationState(entry)
    }
    const onReady = () => {
      this.devLog('load-finish', { viewId: id, domain: this.safeDomain(entry.descriptor.url) })
      entry.loading = false
      if (entry.loadTimer) clearTimeout(entry.loadTimer)
      this.emitState({ id, loading: false, error: null })
    }
    const onNavigate = (_event: Event, url: string) => {
      entry.descriptor = { ...entry.descriptor, url }
      this.emitNavigationState(entry)
    }
    const onTitle = (event: Event, title: string) => {
      event.preventDefault()
      this.emitState({ id, title })
    }
    const onFavicon = (_event: Event, favicons: string[]) => this.emitState({ id, icon: favicons[0] })
    const onFail = (
      _event: Event,
      errorCode: number,
      errorDescription: string,
      validatedUrl: string,
      isMainFrame: boolean,
    ) => {
      if (!isMainFrame || errorCode === -3) return
      this.devLog('load-failed', { viewId: id, errorCode, errorDescription, domain: this.safeDomain(validatedUrl) })
      entry.failed = true
      entry.loading = false
      if (entry.loadTimer) clearTimeout(entry.loadTimer)
      this.emitState({
        id,
        loading: false,
        error: { code: errorCode, description: errorDescription, url: validatedUrl },
      })
      if (id === this.activeId) this.showActive()
    }
    const onWillNavigate = (event: Event, url: string) => {
      if (!this.isAllowedUrl(url)) event.preventDefault()
    }
    const onBeforeInput = (event: Event, input: Input) => {
      const command = this.toShortcut(input, entry)
      if (!command) return
      event.preventDefault()
      if (command.type === 'focus-address') this.window.webContents.focus()
      this.send(VIEW_CHANNELS.shortcut, command)
    }

    webContents.on('did-start-loading', onStart)
    webContents.on('did-stop-loading', onStop)
    webContents.on('dom-ready', onReady)
    webContents.on('did-finish-load', onReady)
    webContents.on('render-process-gone', () => {
      entry.failed = true
      entry.loading = false
      if (entry.loadTimer) clearTimeout(entry.loadTimer)
      this.emitState({ id, loading: false, error: { code: -409, description: 'A sessão foi encerrada pelo processo de renderização.', url: entry.descriptor.url } })
      if (id === this.activeId) this.showActive()
    })
    webContents.on('did-navigate', onNavigate)
    webContents.on('did-navigate-in-page', onNavigate)
    webContents.on('page-title-updated', onTitle)
    webContents.on('page-favicon-updated', onFavicon)
    webContents.on('did-fail-load', onFail)
    webContents.on('will-navigate', onWillNavigate)
    webContents.on('before-input-event', onBeforeInput)
    webContents.setWindowOpenHandler(({ url }) => {
      if (this.isAllowedUrl(url)) {
        const request: NewTabRequest = { url, partition: entry.descriptor.partition }
        this.send(VIEW_CHANNELS.newTabRequested, request)
      }
      return { action: 'deny' }
    })

    entry.cleanup.push(
      () => webContents.off('did-start-loading', onStart),
      () => webContents.off('did-stop-loading', onStop),
      () => webContents.off('dom-ready', onReady),
      () => webContents.off('did-finish-load', onReady),
      () => webContents.off('did-navigate', onNavigate),
      () => webContents.off('did-navigate-in-page', onNavigate),
      () => webContents.off('page-title-updated', onTitle),
      () => webContents.off('page-favicon-updated', onFavicon),
      () => webContents.off('did-fail-load', onFail),
      () => webContents.off('will-navigate', onWillNavigate),
      () => webContents.off('before-input-event', onBeforeInput),
    )
  }

  private safeDomain(value: string) {
    try { return new URL(value).hostname } catch { return 'unknown' }
  }

  private toShortcut(input: Input, entry: ManagedView): ShortcutCommand | null {
    const key = input.key.toLowerCase()
    const ctrl = input.control || input.meta
    if (ctrl && input.shift && key === 'w') return { type: 'open-whatsapp-switcher' }
    if (input.alt && /^[1-9]$/.test(key)) return { type: 'select-whatsapp-profile', index: Number(key) - 1 }
    if (ctrl && input.alt && key === 'w') return { type: 'toggle-last-whatsapp-profile' }
    if (ctrl && /^[1-9]$/.test(key)) return { type: 'select-index', index: Number(key) - 1 }
    if (ctrl && key === 'tab') return { type: input.shift ? 'select-previous' : 'select-next' }
    if (ctrl && input.shift && key === 't') return { type: 'restore-tab' }
    if (ctrl && key === 'l') return { type: 'focus-address' }
    if (ctrl && key === 'r') return { type: 'reload' }
    if (ctrl && key === 'w') return { type: 'close-tab' }
    if (ctrl && key === 't') return { type: 'new-tab' }
    if (input.alt && key === 'arrowleft') return { type: 'back' }
    if (input.alt && key === 'arrowright') return { type: 'forward' }
    if (key === 'f5') return { type: 'reload' }
    if (key === 'escape' && entry.loading) return { type: 'stop' }
    return null
  }

  private emitNavigationState(entry: ManagedView) {
    const { webContents } = entry.view
    this.emitState({
      id: entry.descriptor.id,
      url: webContents.getURL(),
      loading: webContents.isLoading(),
      canGoBack: webContents.navigationHistory.canGoBack(),
      canGoForward: webContents.navigationHistory.canGoForward(),
    })
  }

  private emitState(update: WebViewStateUpdate) {
    this.onViewState?.(update)
    this.send(VIEW_CHANNELS.stateChanged, update)
  }

  private send(channel: string, payload: unknown) {
    if (!this.window.isDestroyed() && !this.window.webContents.isDestroyed()) {
      this.window.webContents.send(channel, payload)
    }
  }

  private isAllowedUrl(url: string) {
    return this.permissions?.isAllowedUrl(url) ?? isAllowedUrl(url)
  }

  private showActive() {
    const next = this.activeId ? this.views.get(this.activeId) : undefined
    const shouldAttach = next && !next.failed && !next.suspended ? next.descriptor.id : null

    if (this.attachedId && this.attachedId !== shouldAttach) {
      const previousId = this.attachedId
      const attached = this.views.get(this.attachedId)
      if (attached) this.window.contentView.removeChildView(attached.view)
      this.attachedId = null
      this.devLog('hideView', { target: previousId })
    }

    if (next && shouldAttach && this.attachedId !== shouldAttach && !this.embedded.has(shouldAttach)) {
      this.window.contentView.addChildView(next.view)
      this.attachedId = shouldAttach
      this.devLog('showView', { target: shouldAttach, reused: true })
    }
    this.updateBounds()
  }

  private destroy(id: string) {
    const entry = this.views.get(id)
    if (!entry) return
    if (this.attachedId === id) {
      if (!this.window.isDestroyed()) this.window.contentView.removeChildView(entry.view)
      this.attachedId = null
    }
    entry.cleanup.forEach((cleanup) => cleanup())
    this.embedded.delete(id)
    if (!entry.view.webContents.isDestroyed()) {
      entry.view.webContents.close({ waitForBeforeUnload: false })
    }
    this.views.delete(id)
    if (this.activeId === id) this.activeId = null
  }
}
