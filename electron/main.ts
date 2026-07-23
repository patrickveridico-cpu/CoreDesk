import { app, BrowserWindow, ipcMain } from 'electron'
import path from 'node:path'
import type { BudgetMapsRoutePayload, WebTabDescriptor } from '../shared/contracts'
import type { CoreConfig } from '../shared/core/contracts'
import type { CreateWhatsAppProfileInput, UpdateWhatsAppProfileInput } from '../shared/whatsapp'
import { CORECHAT_PARTITION, CORECHAT_URL, CORECHAT_VIEW_ID } from '../shared/corechat'
import { BUDGET_MAPS_CHANNELS, CORE_CHANNELS, CORECHAT_CHANNELS, DOWNLOAD_CHANNELS, OPERATIONS_CHANNELS, VIEW_CHANNELS, WHATSAPP_CHANNELS, WINDOW_CHANNELS, ZOOM_CHANNELS } from './channels'
import { WebViewManager } from './WebViewManager'
import { createAppServices } from './core/bootstrap/AppServices'
import type { AppServices } from './core/bootstrap/AppServices'
import { WhatsAppProfileManager } from './whatsapp/WhatsAppProfileManager'
import { WhatsAppProfileStore } from './whatsapp/WhatsAppProfileStore'
import { WhatsAppExternalLinkManager } from './whatsapp/WhatsAppExternalLinkManager'
import { DownloadService } from './downloads/DownloadService'

function logBootstrap(message: string, details?: unknown) {
  if (details === undefined) {
    console.log(`[CoreDesk] ${message}`)
    return
  }
  console.error(`[CoreDesk] ${message}`, details)
}

function describeError(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

function isValidBudgetMapsRoutePayload(value: unknown): value is BudgetMapsRoutePayload {
  if (!value || typeof value !== 'object') return false
  const payload = value as Partial<BudgetMapsRoutePayload>
  const validNumber = (item: unknown, min = 0, max = 100000) => item === null || (typeof item === 'number' && Number.isFinite(item) && item >= min && item <= max)
  const validText = (item: unknown, maxLength: number) => item === null || (typeof item === 'string' && item.length <= maxLength)
  return validNumber(payload.distanceKm) && validText(payload.distanceText, 200) && validText(payload.durationText, 200) && validNumber(payload.durationMinutes, 0, 100000) && validText(payload.routeText, 500) && validText(payload.origin, 300) && validText(payload.destination, 300) && (payload.hasTolls === null || typeof payload.hasTolls === 'boolean') && ['high', 'medium', 'low'].includes(payload.confidence ?? '') && typeof payload.score === 'number' && Number.isFinite(payload.score) && payload.score >= -1000 && payload.score <= 1000 && typeof payload.routeVisible === 'boolean' && payload.source === 'google-maps-dom' && typeof payload.capturedAt === 'string' && payload.capturedAt.length <= 64
}

app.commandLine.appendSwitch('disable-gpu')
app.commandLine.appendSwitch('in-process-gpu')
app.disableHardwareAcceleration()

let mainWindow: BrowserWindow | null = null
let viewManager: WebViewManager | null = null
let whatsappManager: WhatsAppProfileManager | null = null
let whatsappExternalLinks: WhatsAppExternalLinkManager | null = null
let splashWindow: BrowserWindow | null = null
let appServices: AppServices | null = null
let lastBudgetMapsRouteKey: string | null = null
let uiZoomFactor = 1

function normalizeZoomFactor(value: unknown) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0.7 || value > 1.5) return null
  return Math.round(value * 10) / 10
}

function applyZoomFactor(factor: number) {
  uiZoomFactor = factor
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.setZoomFactor(factor)
    mainWindow.webContents.send(ZOOM_CHANNELS.changed, factor)
  }
  viewManager?.setZoomFactor(factor)
  whatsappExternalLinks?.setZoomFactor(factor)
}

function changeZoom(action: 'decrease' | 'reset' | 'increase') {
  const target = action === 'reset' ? 1 : uiZoomFactor + (action === 'increase' ? 0.1 : -0.1)
  const normalized = normalizeZoomFactor(Math.min(1.5, Math.max(0.7, target))) ?? 1
  applyZoomFactor(normalized)
  void appServices?.storage.write(path.join(app.getPath('userData'), 'coredesk-ui-zoom.json'), normalized, 1)
}

function emitMaximizedState(window: BrowserWindow) {
  window.webContents.send(WINDOW_CHANNELS.maximizedChanged, window.isMaximized())
}

function createWindow() {
  const iconPath = path.join(__dirname, '../assets/brand/coredesk.ico')
  splashWindow = new BrowserWindow({
    width: 560,
    height: 360,
    frame: false,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    backgroundColor: '#080b10',
    icon: iconPath,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
  })
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    frame: false,
    resizable: true,
    show: false,
    backgroundColor: '#0b0e12',
    icon: iconPath,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      // O renderer principal precisa iniciar também no modo de desenvolvimento do Windows;
      // contextIsolation e nodeIntegration continuam protegendo a ponte IPC.
      sandbox: !process.env.VITE_DEV_SERVER_URL,
    },
  })
  mainWindow.webContents.setZoomFactor(uiZoomFactor)
  logBootstrap('Janela principal criada')

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
    splashWindow?.close()
    splashWindow = null
  })
  whatsappExternalLinks = new WhatsAppExternalLinkManager(mainWindow, uiZoomFactor)
  const downloadService = new DownloadService(mainWindow, {
    emitStatus: (status) => {
      const targetWindow = mainWindow
      if (targetWindow && !targetWindow.isDestroyed() && !targetWindow.webContents.isDestroyed()) {
        targetWindow.webContents.send(DOWNLOAD_CHANNELS.statusChanged, status)
      }
    },
  })
  appServices?.permissions.setDownloadHandler((event, item, source) => downloadService.handle(event, item, source))
  viewManager = new WebViewManager(mainWindow, (update) => whatsappManager?.handleViewState(update), appServices?.permissions, (payload) => {
    if (!isValidBudgetMapsRoutePayload(payload) || !mainWindow || mainWindow.isDestroyed()) return
    const safePayload: BudgetMapsRoutePayload = {
      distanceKm: payload.distanceKm,
      distanceText: payload.distanceText,
      durationText: payload.durationText,
      durationMinutes: payload.durationMinutes,
      routeText: payload.routeText,
      hasTolls: payload.hasTolls,
      origin: payload.origin,
      destination: payload.destination,
      confidence: payload.confidence,
      score: payload.score,
      routeVisible: payload.routeVisible,
      source: payload.source,
      capturedAt: payload.capturedAt,
    }
    const stable = { ...safePayload, capturedAt: undefined }
    const key = JSON.stringify(stable)
    if (key === lastBudgetMapsRouteKey) return
    lastBudgetMapsRouteKey = key
    console.log('[Budget Maps Route] emitted', { distanceKm: safePayload.distanceKm, distanceText: safePayload.distanceText, durationText: safePayload.durationText, routeText: safePayload.routeText, confidence: safePayload.confidence, score: safePayload.score })
    mainWindow.webContents.send(BUDGET_MAPS_CHANNELS.routeUpdated, safePayload)
  }, uiZoomFactor, changeZoom, (url, source) => { whatsappExternalLinks?.handle(url, source) })
  const profileStore = new WhatsAppProfileStore(path.join(app.getPath('userData'), 'whatsapp-profiles.json'), undefined, appServices?.storage)
  whatsappManager = new WhatsAppProfileManager(mainWindow, profileStore, viewManager)
  void whatsappManager.load()
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (!(input.control || input.meta)) return
    const action = input.key === '-' ? 'decrease' : input.key === '0' ? 'reset' : input.key === '+' || input.key === '=' ? 'increase' : null
    if (!action) return
    event.preventDefault()
    changeZoom(action)
  })
  mainWindow.webContents.on('console-message', (_event, level, message, line, sourceId) => {
    console.log('[CoreDesk Renderer Console]', { level, message, line, sourceId })
  })
  mainWindow.webContents.on('dom-ready', () => {
    void mainWindow?.webContents.executeJavaScript(`(() => {
      if (window.__coreDeskErrorDiagnosticsInstalled) return
      window.__coreDeskErrorDiagnosticsInstalled = true
      window.addEventListener('error', (event) => {
        const error = event.error
        console.error('[CoreDesk Window Error]', {
          message: event.message,
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
          error: error ? { name: error.name, message: error.message, stack: error.stack } : undefined,
        })
      })
      window.addEventListener('unhandledrejection', (event) => {
        const reason = event.reason
        console.error('[CoreDesk Unhandled Rejection]', {
          reason,
          name: reason?.name,
          message: reason?.message,
          stack: reason?.stack,
        })
      })
      return true
    })()`).catch((error) => logBootstrap('Falha ao instalar diagnóstico global do renderer', describeError(error)))
  })
  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow?.webContents.setZoomFactor(uiZoomFactor)
    viewManager?.setZoomFactor(uiZoomFactor)
    mainWindow?.webContents.send(ZOOM_CHANNELS.changed, uiZoomFactor)
    logBootstrap('Renderer carregado')
    const diagnostics = [100, 700, 2000, 5000]
    for (const delay of diagnostics) {
      setTimeout(() => {
        void (async () => {
          try {
            if (!mainWindow || mainWindow.isDestroyed()) return
            const result = await mainWindow.webContents.executeJavaScript(`(() => {
              const root = document.getElementById('root')
              return {
                href: location.href,
                documentReadyState: document.readyState,
                rootExists: Boolean(root),
                rootChildCount: root?.childElementCount ?? -1,
                rootInnerHTML: root?.innerHTML.slice(0, 1000) ?? null,
                bodyInnerHTML: document.body.innerHTML.slice(0, 2000),
                scriptTags: [...document.scripts].map((script) => ({ src: script.src, type: script.type, async: script.async, defer: script.defer })),
                modulePreloads: [...document.querySelectorAll('link[rel="modulepreload"]')].map((link) => link.href),
                resources: performance.getEntriesByType('resource').map((entry) => ({ name: entry.name, initiatorType: entry.initiatorType, duration: entry.duration, transferSize: 'transferSize' in entry ? entry.transferSize : undefined })),
                viteClientPresent: [...document.scripts].some((script) => script.src.includes('@vite/client')),
                mainModulePresent: [...document.scripts].some((script) => script.src.includes('/src/main.tsx')),
              }
            })()`)
            console.log(`[CoreDesk React Mount Diagnostic ${delay}ms]`)
            console.dir(result, { depth: null })
          } catch (error) {
            console.error(`[CoreDesk React Mount Diagnostic ${delay}ms] FAILED`, { message: describeError(error) })
          }
        })()
      }, delay)
    }
  })
  mainWindow.webContents.on('did-fail-provisional-load', (_event, errorCode, errorDescription, validatedURL) => console.error('[CoreDesk Renderer did-fail-provisional-load]', { errorCode, errorDescription, validatedURL }))
  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL, isMainFrame) => console.error('[CoreDesk Renderer did-fail-load]', { errorCode, errorDescription, validatedURL, isMainFrame }))
  mainWindow.webContents.on('render-process-gone', (_event, details) => console.error('[CoreDesk Renderer render-process-gone]', details))
  mainWindow.webContents.on('preload-error', (_event, preloadPath, error) => console.error('[CoreDesk Renderer preload-error]', { preloadPath, name: error.name, message: error.message, stack: error.stack }))
  mainWindow.webContents.on('unresponsive', () => console.error('[CoreDesk Renderer unresponsive]'))
  mainWindow.webContents.on('responsive', () => console.log('[CoreDesk Renderer responsive]'))
  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription) => {
    logBootstrap(`Falha ao carregar renderer (${errorCode})`, errorDescription)
  })
  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    logBootstrap(`Processo do renderer encerrado (${details.reason})`, details.exitCode)
  })
  mainWindow.webContents.on('will-navigate', (event, url) => {
    const developmentUrl = process.env.VITE_DEV_SERVER_URL
    const allowedRendererUrl = developmentUrl ? url.startsWith(developmentUrl) : url.startsWith('file:')
    if (!allowedRendererUrl) event.preventDefault()
  })
  appServices?.events.emit('window:created', mainWindow)
  mainWindow.on('resize', () => {
    viewManager?.updateBounds()
    const [width, height] = mainWindow?.getContentSize() ?? [0, 0]
    appServices?.events.emit('window:resized', { width, height })
  })
  mainWindow.on('maximize', () => {
    if (mainWindow) emitMaximizedState(mainWindow)
    viewManager?.updateBounds()
  })
  mainWindow.on('unmaximize', () => {
    if (mainWindow) emitMaximizedState(mainWindow)
    viewManager?.updateBounds()
  })
  mainWindow.on('close', () => {
    whatsappExternalLinks?.closeAll()
    whatsappExternalLinks = null
    viewManager?.dispose()
    viewManager = null
    whatsappManager = null
  })
  mainWindow.on('closed', () => {
    logBootstrap('Janela fechada')
    mainWindow = null
    if (process.platform !== 'darwin') app.quit()
  })

  const developmentUrl = process.env.VITE_DEV_SERVER_URL
  console.log('[CoreDesk Renderer Load Strategy]', { strategy: developmentUrl ? 'loadURL' : 'loadFile', value: developmentUrl ?? path.join(__dirname, '../dist/index.html'), viteDevServerUrlDefined: Boolean(developmentUrl), viteDevServerUrl: developmentUrl ?? null })
  if (developmentUrl) {
    void splashWindow.loadURL(`${developmentUrl}/splash.html`)
    void mainWindow.loadURL(developmentUrl)
  } else {
    void splashWindow.loadFile(path.join(__dirname, '../dist/splash.html'))
    void mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }
  mainWindow.webContents.on('did-finish-load', () => console.log('[CoreDesk Renderer URL]', mainWindow?.webContents.getURL()))
}

function registerWindowControls() {
  ipcMain.on(WINDOW_CHANNELS.minimize, (event) => BrowserWindow.fromWebContents(event.sender)?.minimize())
  ipcMain.on(WINDOW_CHANNELS.toggleMaximize, (event) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    if (!window) return
    if (window.isMaximized()) {
      window.unmaximize()
    } else {
      window.maximize()
    }
  })
  ipcMain.on(WINDOW_CHANNELS.close, (event) => BrowserWindow.fromWebContents(event.sender)?.close())
  ipcMain.handle(WINDOW_CHANNELS.getMaximized, (event) => BrowserWindow.fromWebContents(event.sender)?.isMaximized() ?? false)
}

function registerZoomControls() {
  ipcMain.handle(ZOOM_CHANNELS.get, (event) => isTrustedRenderer(event.sender) ? uiZoomFactor : Promise.reject(new Error('Origem IPC não autorizada.')))
  ipcMain.handle(ZOOM_CHANNELS.set, async (event, value: unknown) => {
    if (!isTrustedRenderer(event.sender)) throw new Error('Origem IPC não autorizada.')
    const factor = normalizeZoomFactor(value)
    if (factor === null) throw new Error('Fator de zoom inválido.')
    applyZoomFactor(factor)
    await appServices?.storage.write(path.join(app.getPath('userData'), 'coredesk-ui-zoom.json'), factor, 1)
    return factor
  })
}

function isTrustedRenderer(sender: Electron.WebContents) {
  return mainWindow?.webContents === sender
}

function registerViewControls() {
  ipcMain.handle(CORECHAT_CHANNELS.getCompact, (event) => {
    if (!isTrustedRenderer(event.sender)) throw new Error('Origem IPC não autorizada.')
    return viewManager?.getCoreChatCompact() ?? true
  })
  ipcMain.handle(CORECHAT_CHANNELS.setCompact, async (event, enabled: unknown) => {
    if (!isTrustedRenderer(event.sender)) throw new Error('Origem IPC não autorizada.')
    if (typeof enabled !== 'boolean') throw new Error('Preferência de modo compacto inválida.')
    return viewManager?.setCoreChatCompact(enabled) ?? {
      enabled,
      applied: false,
      reason: 'view-not-ready',
      hiddenElements: 0,
    }
  })
  ipcMain.on(VIEW_CHANNELS.sync, (event, tabs: WebTabDescriptor[], activeTabId: string) => {
    if (isTrustedRenderer(event.sender) && Array.isArray(tabs) && typeof activeTabId === 'string') {
      viewManager?.sync(tabs, activeTabId)
      appServices?.workspace.setActive(activeTabId)
    }
  })
  ipcMain.on(VIEW_CHANNELS.setEmbedded, (
    event,
    id: string,
    bounds: { x: number; y: number; width: number; height: number } | null,
    options?: { visible?: unknown },
  ) => {
    if (!isTrustedRenderer(event.sender) || !['app-maps', 'budget-google-maps', CORECHAT_VIEW_ID].includes(id)) return
    if (bounds && (!Number.isFinite(bounds.x) || !Number.isFinite(bounds.y) || !Number.isFinite(bounds.width) || !Number.isFinite(bounds.height) || bounds.x < 0 || bounds.y < 0 || bounds.width <= 0 || bounds.height <= 0 || bounds.width > 10000 || bounds.height > 10000)) return
    if (id === 'budget-google-maps') {
      viewManager?.ensureView({ id, title: 'Google Maps', url: 'https://www.google.com/maps', partition: 'persist:coredesk-budget-maps', pinned: false, type: 'web' })
    }
    if (id === CORECHAT_VIEW_ID && bounds) {
      viewManager?.ensureView({ id, title: 'CoreChat', url: CORECHAT_URL, partition: CORECHAT_PARTITION, pinned: true, type: 'web' })
    }
    const visible = options?.visible === undefined ? true : options.visible === true
    viewManager?.setEmbedded(id, bounds, visible)
  })

  const actions = [
    [VIEW_CHANNELS.navigate, (id: string, url: string) => viewManager?.navigate(id, url)],
    [VIEW_CHANNELS.back, (id: string) => viewManager?.back(id)],
    [VIEW_CHANNELS.forward, (id: string) => viewManager?.forward(id)],
    [VIEW_CHANNELS.reload, (id: string) => viewManager?.reload(id)],
    [VIEW_CHANNELS.stop, (id: string) => viewManager?.stop(id)],
    [VIEW_CHANNELS.retry, (id: string) => viewManager?.retry(id)],
  ] as const

  for (const [channel, action] of actions) {
    ipcMain.on(channel, (event, id: string, value?: string) => {
      if (!isTrustedRenderer(event.sender) || typeof id !== 'string') return
      action(id, value as string)
    })
  }
}

function requestRendererCommand(id: string) {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send(CORE_CHANNELS.commandRequested, id)
}

function registerCoreControls() {
  if (!appServices) return
  const services = appServices
  ipcMain.handle(CORE_CHANNELS.getConfig, (event) => isTrustedRenderer(event.sender) ? appServices!.config.get() : Promise.reject(new Error('Origem IPC não autorizada.')))
  ipcMain.handle(CORE_CHANNELS.updateConfig, async (event, patch: Partial<CoreConfig>) => {
    if (!isTrustedRenderer(event.sender)) throw new Error('Origem IPC não autorizada.')
    return appServices!.config.update(patch)
  })
  ipcMain.handle(CORE_CHANNELS.getCommands, (event) => isTrustedRenderer(event.sender) ? appServices!.commands.list() : Promise.reject(new Error('Origem IPC não autorizada.')))
  ipcMain.handle(CORE_CHANNELS.executeCommand, async (event, id: string) => {
    if (!isTrustedRenderer(event.sender)) throw new Error('Origem IPC não autorizada.')
    await appServices!.commands.execute(id)
  })
  appServices.events.on('config:changed', async () => {
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send(CORE_CHANNELS.configChanged, await appServices!.config.get())
  })
  const registerRendererCommand = (id: string, title: string, category: string, shortcut?: string) => appServices!.commands.register({ id, title, category, shortcut, execute: () => requestRendererCommand(id) })
  registerRendererCommand('workspace.open-home', 'Abrir início', 'Workspace', 'Ctrl+1')
  registerRendererCommand('browser.new-tab', 'Nova aba', 'Navegador', 'Ctrl+T')
  registerRendererCommand('browser.reload-active', 'Recarregar aba', 'Navegador', 'Ctrl+R')
  registerRendererCommand('browser.close-active', 'Fechar aba', 'Navegador', 'Ctrl+W')
  registerRendererCommand('browser.focus-address', 'Focar endereço', 'Navegador', 'Ctrl+L')
  registerRendererCommand('browser.go-back', 'Voltar', 'Navegador', 'Alt+Left')
  registerRendererCommand('browser.go-forward', 'Avançar', 'Navegador', 'Alt+Right')
  registerRendererCommand('whatsapp.new-profile', 'Novo perfil WhatsApp', 'Comunicação')
  registerRendererCommand('whatsapp.open-profile-selector', 'Seletor de perfis', 'Comunicação', 'Ctrl+Shift+W')
  for (let index = 1; index <= 9; index += 1) registerRendererCommand(`whatsapp.activate-profile-${index}`, `Ativar perfil ${index}`, 'Comunicação', `Alt+${index}`)
  registerRendererCommand('whatsapp.toggle-last-profile', 'Alternar últimos perfis', 'Comunicação', 'Ctrl+Alt+W')
  registerRendererCommand('app.open-settings', 'Abrir configurações', 'Aplicativo')
  appServices.commands.register({ id: 'app.quit', title: 'Sair', category: 'Aplicativo', execute: () => app.quit() })
  for (const id of ['operations.save-quote', 'operations.open-import', 'operations.open-audit', 'operations.focus-search', 'operations.duplicate-quote', 'operations.create-revision']) appServices.commands.register({ id, title: id.replace('operations.', ''), category: 'Operações', execute: () => requestRendererCommand(id) })
  for (const [id, title] of [['operations.open', 'Abrir Operações'], ['operations.new-quote', 'Novo orçamento'], ['operations.open-bases', 'Abrir bases'], ['operations.open-insurers', 'Abrir seguradoras'], ['operations.open-specialties', 'Abrir especialidades'], ['operations.open-pricing-tables', 'Abrir tabelas'], ['operations.open-history', 'Abrir histórico'], ['operations.calculate-route', 'Calcular rota'], ['operations.calculate-quote', 'Calcular orçamento'], ['operations.copy-message', 'Copiar mensagem'], ['operations.open-whatsapp-profile', 'Abrir perfil WhatsApp']] as const) registerRendererCommand(id, title, 'Operações')
  const trusted = <TArgs extends unknown[], TResult>(handler: (...args: TArgs) => TResult) => (event: Electron.IpcMainInvokeEvent, ...args: unknown[]) => { if (!isTrustedRenderer(event.sender)) throw new Error('Origem IPC não autorizada.'); return handler(...args as TArgs) }
  ipcMain.handle(OPERATIONS_CHANNELS.snapshot, trusted(() => services.operations.snapshot()))
  ipcMain.handle(OPERATIONS_CHANNELS.diagnostics, trusted(() => services.operations.diagnostics()))
  ipcMain.handle(OPERATIONS_CHANNELS.listPriceTableConflicts, trusted(() => services.operations.listPriceTableConflicts()))
  ipcMain.handle(OPERATIONS_CHANNELS.resolvePriceTableConflict, trusted((conflictId, keepId) => services.operations.resolvePriceTableConflict(conflictId as string, keepId as string)))
  ipcMain.handle(OPERATIONS_CHANNELS.previewLegacyPriceTableCompanyMigration, trusted(() => services.operations.previewLegacyPriceTableCompanyMigration()))
  ipcMain.handle(OPERATIONS_CHANNELS.applyLegacyPriceTableCompanyMigration, trusted(() => services.operations.applyLegacyPriceTableCompanyMigration()))
  ipcMain.handle(OPERATIONS_CHANNELS.listOperationalCompanies, trusted((status) => services.operations.listOperationalCompanies(status as Parameters<typeof services.operations.listOperationalCompanies>[0])))
  ipcMain.handle(OPERATIONS_CHANNELS.getOperationalCompany, trusted((id) => services.operations.getOperationalCompany(id as string)))
  ipcMain.handle(OPERATIONS_CHANNELS.saveOperationalCompany, trusted((input) => services.operations.saveOperationalCompany(input as Parameters<typeof services.operations.saveOperationalCompany>[0])))
  ipcMain.handle(OPERATIONS_CHANNELS.archiveOperationalCompany, trusted((id) => services.operations.archiveOperationalCompany(id as string)))
  ipcMain.handle(OPERATIONS_CHANNELS.restoreOperationalCompany, trusted((id) => services.operations.restoreOperationalCompany(id as string)))
  ipcMain.handle(OPERATIONS_CHANNELS.saveBase, trusted((input) => services.operations.saveBase(input as Parameters<typeof services.operations.saveBase>[0])))
  ipcMain.handle(OPERATIONS_CHANNELS.saveInsurer, trusted((input) => services.operations.saveInsurer(input as Parameters<typeof services.operations.saveInsurer>[0])))
  ipcMain.handle(OPERATIONS_CHANNELS.saveSpecialty, trusted((input) => services.operations.saveSpecialty(input as Parameters<typeof services.operations.saveSpecialty>[0])))
  ipcMain.handle(OPERATIONS_CHANNELS.savePricingTable, trusted((input) => services.operations.savePricingTable(input as Parameters<typeof services.operations.savePricingTable>[0])))
  ipcMain.handle(OPERATIONS_CHANNELS.calculateRoute, trusted((input) => services.operations.calculateRoute(input as Parameters<typeof services.operations.calculateRoute>[0])))
  ipcMain.handle(OPERATIONS_CHANNELS.calculateQuote, trusted((input) => services.operations.calculateQuote(input as Parameters<typeof services.operations.calculateQuote>[0])))
  ipcMain.handle(OPERATIONS_CHANNELS.saveQuote, trusted((quote) => services.operations.saveQuote(quote as Parameters<typeof services.operations.saveQuote>[0])))
  ipcMain.handle(OPERATIONS_CHANNELS.deleteQuote, trusted((id) => services.operations.deleteQuote(id as string)))
  ipcMain.handle(OPERATIONS_CHANNELS.previewImport, trusted((source) => services.operations.previewImport(source as string | undefined)))
  ipcMain.handle(OPERATIONS_CHANNELS.confirmImport, trusted((source) => services.operations.confirmImport(source as string | undefined)))
  ipcMain.handle(OPERATIONS_CHANNELS.listAudit, trusted(() => services.operationsGovernance.listAudit()))
  ipcMain.handle(OPERATIONS_CHANNELS.listBackups, trusted(() => services.operationsGovernance.listBackups()))
  ipcMain.handle(OPERATIONS_CHANNELS.createBackup, trusted(() => services.operationsGovernance.createBackup(services.operations.snapshot())))
  ipcMain.handle(OPERATIONS_CHANNELS.restoreBackup, trusted((name) => services.operationsGovernance.restoreBackup(name as string)))
}

function registerWhatsAppControls() {
  const trusted = <TArgs extends unknown[], TResult>(handler: (...args: TArgs) => TResult) => (
    event: Electron.IpcMainInvokeEvent,
    ...args: unknown[]
  ) => {
    if (!isTrustedRenderer(event.sender)) throw new Error('Origem IPC não autorizada.')
    return handler(...args as TArgs)
  }

  ipcMain.handle(WHATSAPP_CHANNELS.listProfiles, trusted(() => whatsappManager?.listProfiles()))
  ipcMain.handle(WHATSAPP_CHANNELS.createProfile, trusted((input: CreateWhatsAppProfileInput) => whatsappManager?.createProfile(input)))
  ipcMain.handle(WHATSAPP_CHANNELS.updateProfile, trusted((id: string, input: UpdateWhatsAppProfileInput) => whatsappManager?.updateProfile(id, input)))
  ipcMain.handle(WHATSAPP_CHANNELS.removeProfile, trusted((id: string, clearSession: boolean) => whatsappManager?.removeProfile(id, clearSession)))
  ipcMain.handle(WHATSAPP_CHANNELS.reorderProfiles, trusted((ids: string[]) => whatsappManager?.reorderProfiles(ids)))
  ipcMain.handle(WHATSAPP_CHANNELS.openProfile, trusted((id: string) => whatsappManager?.openProfile(id)))
  ipcMain.handle(WHATSAPP_CHANNELS.setOpen, trusted((id: string, open: boolean) => whatsappManager?.setOpen(id, open)))
  ipcMain.handle(WHATSAPP_CHANNELS.suspendProfile, trusted((id: string) => whatsappManager?.suspendProfile(id)))
  ipcMain.handle(WHATSAPP_CHANNELS.resumeProfile, trusted((id: string) => whatsappManager?.resumeProfile(id)))
  ipcMain.handle(WHATSAPP_CHANNELS.reloadProfile, trusted((id: string) => whatsappManager?.reloadProfile(id)))
  ipcMain.handle(WHATSAPP_CHANNELS.clearSession, trusted((id: string) => whatsappManager?.clearSession(id)))
  ipcMain.handle(WHATSAPP_CHANNELS.selectIcon, trusted((profileId?: string) => whatsappManager?.selectIcon(profileId)))
}

const hasSingleInstanceLock = app.requestSingleInstanceLock()
if (!hasSingleInstanceLock) {
  logBootstrap('Instância adicional bloqueada')
  app.quit()
} else {
  app.on('second-instance', () => {
    if (!mainWindow || mainWindow.isDestroyed()) return
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.show()
    mainWindow.focus()
  })
}

app.whenReady().then(async () => {
  if (!hasSingleInstanceLock) return false
  logBootstrap('Electron pronto')
  appServices = createAppServices()
  await appServices.initialize()
  uiZoomFactor = await appServices.storage.read(path.join(app.getPath('userData'), 'coredesk-ui-zoom.json'), 1, {
    schemaVersion: 1,
    validate: (value) => normalizeZoomFactor(value) ?? 1,
    backupInvalid: false,
  })
  return true
}).then((initialized) => {
  if (!initialized) return
  registerWindowControls()
  registerZoomControls()
  registerViewControls()
  registerWhatsAppControls()
  registerCoreControls()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
}).catch((error: unknown) => {
  logBootstrap('Falha na inicialização', describeError(error))
  app.quit()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => { void appServices?.shutdown() })
app.on('child-process-gone', (_event, details) => console.error('[CoreDesk child-process-gone]', details))

process.on('unhandledRejection', (reason: unknown) => {
  logBootstrap('Promise rejeitada sem tratamento', describeError(reason))
})
process.on('uncaughtException', (error: unknown) => {
  logBootstrap('Exceção não capturada', describeError(error))
})
