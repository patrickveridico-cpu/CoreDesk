import { app, BrowserWindow, session, WebContentsView } from 'electron'
import type { BrowserWindowConstructorOptions, Event, Input, Session } from 'electron'
import type {
  NewTabRequest,
  ShortcutCommand,
  WebTabDescriptor,
  WebViewStateUpdate,
} from '../shared/contracts'
import { SHELL_LAYOUT } from '../shared/layout'
import { VIEW_CHANNELS } from './channels'
import type { PermissionService } from './core/permissions/PermissionService'
import { createBudgetMapsDistanceExtractorScript } from '../shared/maps/distanceExtraction'
import { classifyWhatsAppExternalLink } from './whatsapp/external-link-policy'
import type { ExternalLinkSource } from './whatsapp/WhatsAppExternalLinkManager'
import {
  CORECHAT_PARTITION,
  CORECHAT_VIEW_ID,
  classifyCoreChatNavigation,
  createCoreChatCompactScript,
  type CoreChatCompactResult,
} from '../shared/corechat'

const ALLOWED_PROTOCOLS = new Set(['http:', 'https:'])

interface ManagedView {
  descriptor: WebTabDescriptor
  view: WebContentsView
  cleanup: Array<() => void>
  failed: boolean
  loading: boolean
  suspended: boolean
  loadTimer?: NodeJS.Timeout
  budgetRouteTimer?: NodeJS.Timeout
  budgetRouteInstallToken?: number
  coreChatCompactRetryTimer?: NodeJS.Timeout
  coreChatCompactRetryCount?: number
}

function isAllowedUrl(value: string) {
  try {
    return ALLOWED_PROTOCOLS.has(new URL(value).protocol)
  } catch {
    return false
  }
}

function coreChatPopupOptions(parent: BrowserWindow): BrowserWindowConstructorOptions {
  return {
    parent,
    modal: false,
    show: true,
    frame: true,
    resizable: true,
    width: 720,
    height: 760,
    minWidth: 560,
    minHeight: 520,
    backgroundColor: '#0b0e12',
    webPreferences: {
      partition: CORECHAT_PARTITION,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
    },
  }
}

export class WebViewManager {
  private readonly views = new Map<string, ManagedView>()
  private readonly configuredPartitions = new Set<string>()
  private activeId: string | null = null
  private attachedId: string | null = null
  private readonly embedded = new Set<string>()
  private zoomFactor: number
  private coreChatCompactEnabled = true

  constructor(
    private readonly window: BrowserWindow,
    private readonly onViewState?: (update: WebViewStateUpdate) => void,
    private readonly permissions?: PermissionService,
    private readonly onBudgetMapsRoute?: (payload: unknown) => void,
    initialZoomFactor = 1,
    private readonly onZoomShortcut?: (action: 'decrease' | 'reset' | 'increase') => void,
    private readonly onWhatsAppExternalLink?: (url: string, source: ExternalLinkSource) => void,
  ) {
    this.zoomFactor = initialZoomFactor
  }

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
      if (!incomingIds.has(id) && existing?.descriptor.type !== 'whatsapp' && id !== 'app-google' && id !== 'app-maps' && id !== 'budget-google-maps' && id !== CORECHAT_VIEW_ID) {
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
    const [contentWidth, contentHeight] = this.window.getContentSize()
    const clampedBounds = {
      x: Math.max(0, Math.min(contentWidth, Math.round(bounds.x))),
      y: Math.max(0, Math.min(contentHeight, Math.round(bounds.y))),
      width: 0,
      height: 0,
    }
    clampedBounds.width = Math.max(0, Math.min(Math.floor(bounds.width), contentWidth - clampedBounds.x))
    clampedBounds.height = Math.max(0, Math.min(Math.floor(bounds.height), contentHeight - clampedBounds.y))
    if (clampedBounds.width === 0 || clampedBounds.height === 0) return
    const wasEmbedded = this.embedded.has(id)
    this.embedded.add(id)
    entry.view.webContents.setZoomFactor(this.zoomFactor)
    entry.view.setBounds(clampedBounds)
    if (!this.window.isDestroyed() && !wasEmbedded) this.window.contentView.addChildView(entry.view)
  }

  setZoomFactor(factor: number) {
    this.zoomFactor = factor
    for (const entry of this.views.values()) {
      if (!entry.view.webContents.isDestroyed()) entry.view.webContents.setZoomFactor(factor)
    }
    this.updateBounds()
  }

  ensureView(descriptor: WebTabDescriptor) {
    const current = this.views.get(descriptor.id)
    if (current) return
    this.create(descriptor)
  }

  navigate(id: string, url: string) {
    const entry = this.views.get(id)
    if (!entry || !this.isAllowedUrl(url)) return
    if (id === CORECHAT_VIEW_ID) {
      const decision = classifyCoreChatNavigation(url)
      if (decision.action !== 'allow-internal' && decision.action !== 'allow-auth') return
    }
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

  getCoreChatCompact() {
    return this.coreChatCompactEnabled
  }

  async setCoreChatCompact(enabled: boolean): Promise<CoreChatCompactResult> {
    this.coreChatCompactEnabled = enabled
    const entry = this.views.get(CORECHAT_VIEW_ID)
    if (!entry || entry.view.webContents.isDestroyed()) {
      return { enabled, applied: false, reason: 'view-not-ready', hiddenElements: 0 }
    }
    if (entry.coreChatCompactRetryTimer) clearTimeout(entry.coreChatCompactRetryTimer)
    entry.coreChatCompactRetryCount = 0
    return this.applyCoreChatCompactMode(entry)
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
    const shellHeight = SHELL_LAYOUT.titleBarHeight + SHELL_LAYOUT.globalBarHeight + (entry.descriptor.type === 'whatsapp' || entry.descriptor.id === 'app-google' || entry.descriptor.id === 'app-maps' ? 0 : SHELL_LAYOUT.navigationBarHeight)
    const y = Math.round(shellHeight * this.zoomFactor)
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
    view.webContents.setZoomFactor(this.zoomFactor)
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
      if (id === 'budget-google-maps') this.installBudgetMapsObserver(entry)
      if (id === CORECHAT_VIEW_ID) {
        if (entry.coreChatCompactRetryTimer) clearTimeout(entry.coreChatCompactRetryTimer)
        entry.coreChatCompactRetryCount = 0
        void this.applyCoreChatCompactMode(entry)
      }
    }
    const onNavigate = (_event: Event, url: string) => {
      entry.descriptor = { ...entry.descriptor, url }
      this.emitNavigationState(entry)
      if (id === 'budget-google-maps') this.installBudgetMapsObserver(entry)
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
    const handleManagedNavigation = (eventName: 'will-navigate' | 'will-redirect', event: Event, legacyUrl: string, legacyIsMainFrame?: boolean) => {
      const details = event as Event & { url?: string; isMainFrame?: boolean }
      const url = details.url ?? legacyUrl
      const isMainFrame = details.isMainFrame ?? legacyIsMainFrame ?? true
      const decision = classifyWhatsAppExternalLink(url)
      if (entry.descriptor.type === 'whatsapp') {
        const current = classifyWhatsAppExternalLink(webContents.getURL())
        const navigationDecision = !isMainFrame
          ? { action: 'allow', reason: 'subframe-navigation' }
          : eventName === 'will-redirect'
            ? decision.action === 'block' || decision.action === 'open-system'
              ? { action: 'block', reason: `redirect-${decision.action}` }
              : { action: 'allow', reason: 'automatic-http-redirect' }
            : decision.action === 'allow-internal'
              ? { action: 'allow', reason: 'whatsapp-internal-navigation' }
              : decision.action === 'block'
                ? { action: 'block', reason: decision.reason }
                : { action: 'popup', reason: 'external-main-frame-navigation' }
        if (!app.isPackaged && process.env.NODE_ENV !== 'production') {
          console.log('[WhatsApp Navigation Debug]', {
            event: eventName,
            mainFrame: isMainFrame,
            protocol: decision.protocol,
            hostname: decision.hostname,
            decision: navigationDecision.action,
            reason: navigationDecision.reason,
            currentHostname: current.hostname,
            userGesture: 'unavailable',
            target: id,
            profileId: entry.descriptor.profileId,
          })
        }
        if (!isMainFrame) return
        if (eventName === 'will-redirect') {
          if (decision.action === 'block' || decision.action === 'open-system') event.preventDefault()
          return
        }
        if (decision.action === 'allow-internal') return
        event.preventDefault()
        this.onWhatsAppExternalLink?.(url, { target: id, profileId: entry.descriptor.profileId })
        return
      }
      if (id === CORECHAT_VIEW_ID) {
        if (!isMainFrame) return
        const coreChatDecision = classifyCoreChatNavigation(url)
        if (coreChatDecision.action === 'allow-internal' || coreChatDecision.action === 'allow-auth') return
        event.preventDefault()
        this.devLog('corechat-navigation-blocked', {
          target: id,
          event: eventName,
          protocol: coreChatDecision.protocol,
          hostname: coreChatDecision.hostname,
          reason: coreChatDecision.action === 'block' ? coreChatDecision.reason : 'external-main-frame-navigation',
        })
        return
      }
      if (!this.isAllowedUrl(url)) event.preventDefault()
    }
    const onWillNavigate = (event: Event, url: string, _isInPlace?: boolean, isMainFrame?: boolean) => handleManagedNavigation('will-navigate', event, url, isMainFrame)
    const onWillRedirect = (event: Event, url: string, _isInPlace?: boolean, isMainFrame?: boolean) => handleManagedNavigation('will-redirect', event, url, isMainFrame)
    const onBeforeInput = (event: Event, input: Input) => {
      const zoomAction = this.toZoomShortcut(input)
      if (zoomAction) {
        event.preventDefault()
        this.onZoomShortcut?.(zoomAction)
        return
      }
      const command = this.toShortcut(input, entry)
      if (!command) return
      event.preventDefault()
      if (command.type === 'focus-address') this.window.webContents.focus()
      this.send(VIEW_CHANNELS.shortcut, command)
    }
    const onDidCreateWindow = (child: BrowserWindow) => {
      if (id !== CORECHAT_VIEW_ID) return
      const guardPopupNavigation = (event: Event, url: string) => {
        const decision = classifyCoreChatNavigation(url)
        if (decision.action === 'allow-internal' || decision.action === 'allow-auth') return
        event.preventDefault()
        this.devLog('corechat-auth-popup-navigation-blocked', {
          target: id,
          protocol: decision.protocol,
          hostname: decision.hostname,
          reason: decision.action === 'block' ? decision.reason : 'external-navigation',
        })
      }
      child.webContents.on('will-navigate', guardPopupNavigation)
      child.webContents.on('will-redirect', guardPopupNavigation)
      child.webContents.setWindowOpenHandler(({ url }) => {
        const decision = classifyCoreChatNavigation(url)
        if (decision.action === 'allow-internal' || decision.action === 'allow-auth') {
          return { action: 'allow', overrideBrowserWindowOptions: coreChatPopupOptions(this.window) }
        }
        if (decision.action === 'open-external') {
          this.onWhatsAppExternalLink?.(url, { target: CORECHAT_VIEW_ID })
        }
        return { action: 'deny' }
      })
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
    webContents.on('will-redirect', onWillRedirect)
    webContents.on('before-input-event', onBeforeInput)
    webContents.on('did-create-window', onDidCreateWindow)
    webContents.setWindowOpenHandler(({ url }) => {
      if (entry.descriptor.type === 'whatsapp') {
        const decision = classifyWhatsAppExternalLink(url)
        if (decision.action === 'allow-internal') {
          if (decision.protocol === 'http:' || decision.protocol === 'https:') void webContents.loadURL(url)
        } else {
          this.onWhatsAppExternalLink?.(url, { target: id, profileId: entry.descriptor.profileId })
        }
        return { action: 'deny' }
      }
      if (id === CORECHAT_VIEW_ID) {
        const decision = classifyCoreChatNavigation(url)
        if (decision.action === 'allow-internal' || decision.action === 'allow-auth') {
          return {
            action: 'allow',
            overrideBrowserWindowOptions: coreChatPopupOptions(this.window),
          }
        }
        if (decision.action === 'open-external') {
          this.onWhatsAppExternalLink?.(url, { target: CORECHAT_VIEW_ID })
        } else {
          this.devLog('corechat-popup-blocked', {
            target: id,
            protocol: decision.protocol,
            hostname: decision.hostname,
            reason: decision.action === 'block' ? decision.reason : 'popup-not-allowed',
          })
        }
        return { action: 'deny' }
      }
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
      () => webContents.off('will-redirect', onWillRedirect),
      () => webContents.off('before-input-event', onBeforeInput),
      () => webContents.off('did-create-window', onDidCreateWindow),
    )
  }

  private async applyCoreChatCompactMode(entry: ManagedView): Promise<CoreChatCompactResult> {
    if (entry.descriptor.id !== CORECHAT_VIEW_ID || entry.view.webContents.isDestroyed()) {
      return { enabled: this.coreChatCompactEnabled, applied: false, reason: 'view-not-ready', hiddenElements: 0 }
    }
    try {
      const result = await entry.view.webContents.executeJavaScript(
        createCoreChatCompactScript(this.coreChatCompactEnabled),
      ) as CoreChatCompactResult
      const retryable = result.reason === 'composer-not-found' || result.reason === 'secondary-navigation-not-found'
      const retryCount = entry.coreChatCompactRetryCount ?? 0
      if (this.coreChatCompactEnabled && !result.applied && retryable && retryCount < 2) {
        entry.coreChatCompactRetryCount = retryCount + 1
        entry.coreChatCompactRetryTimer = setTimeout(() => {
          entry.coreChatCompactRetryTimer = undefined
          void this.applyCoreChatCompactMode(entry)
        }, 700)
      } else if (this.coreChatCompactEnabled && !result.applied) {
        console.warn('[CoreChat] compact-mode-fallback', { reason: result.reason })
      }
      this.emitState({ id: CORECHAT_VIEW_ID, coreChatCompact: result })
      return result
    } catch (error) {
      const result: CoreChatCompactResult = {
        enabled: this.coreChatCompactEnabled,
        applied: false,
        reason: 'script-execution-failed',
        hiddenElements: 0,
      }
      console.warn('[CoreChat] compact-mode-fallback', {
        reason: result.reason,
        error: error instanceof Error ? error.name : 'UnknownError',
      })
      try {
        await entry.view.webContents.executeJavaScript(createCoreChatCompactScript(false))
      } catch {
        // A página completa permanece como fallback mesmo quando a limpeza não pode ser executada.
      }
      this.emitState({ id: CORECHAT_VIEW_ID, coreChatCompact: result })
      return result
    }
  }

  private installBudgetMapsObserver(entry: ManagedView) {
    if (entry.descriptor.id !== 'budget-google-maps' || entry.view.webContents.isDestroyed()) return
    if (entry.budgetRouteTimer) clearInterval(entry.budgetRouteTimer)
    if (entry.coreChatCompactRetryTimer) clearTimeout(entry.coreChatCompactRetryTimer)
    const installToken = (entry.budgetRouteInstallToken ?? 0) + 1
    entry.budgetRouteInstallToken = installToken
    const script = createBudgetMapsDistanceExtractorScript()
    void entry.view.webContents.executeJavaScript(script).then(() => {
      if (entry.budgetRouteInstallToken !== installToken) return
      console.log('[Budget Maps Route] observer-installed')
      entry.budgetRouteTimer = setInterval(() => {
        if (entry.view.webContents.isDestroyed()) return
        void entry.view.webContents.executeJavaScript('window.__coreDeskBudgetMapsRoute ?? null').then((payload) => {
          if (payload) this.onBudgetMapsRoute?.(payload)
        }).catch((error) => console.error('[Budget Maps Route] extraction-error', error instanceof Error ? error.message : String(error)))
      }, 750)
    }).catch((error) => console.error('[Budget Maps Route] extraction-error', error instanceof Error ? error.message : String(error)))
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

  private toZoomShortcut(input: Input): 'decrease' | 'reset' | 'increase' | null {
    if (!(input.control || input.meta)) return null
    if (input.key === '-') return 'decrease'
    if (input.key === '0') return 'reset'
    if (input.key === '+' || input.key === '=') return 'increase'
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
      next.view.webContents.setZoomFactor(this.zoomFactor)
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
    if (entry.budgetRouteTimer) clearInterval(entry.budgetRouteTimer)
    this.embedded.delete(id)
    if (!entry.view.webContents.isDestroyed()) {
      entry.view.webContents.close({ waitForBeforeUnload: false })
    }
    this.views.delete(id)
    if (this.activeId === id) this.activeId = null
  }
}
