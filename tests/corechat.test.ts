import { EventEmitter } from 'node:events'
import { describe, expect, it, vi } from 'vitest'
import {
  CORECHAT_PARTITION,
  CORECHAT_URL,
  CORECHAT_VIEW_ID,
  classifyCoreChatNavigation,
  createCoreChatCompactScript,
} from '../shared/corechat'

function runCompactScript(options: { composer?: boolean; sidebar?: boolean; composerVisible?: boolean }, enabled = true) {
  let styleElement: { id: string; textContent: string; remove: () => void } | undefined
  const attributes = new Set<string>()
  const composer = options.composer ? {
    getBoundingClientRect: () => ({
      width: options.composerVisible === false ? 0 : 640,
      height: options.composerVisible === false ? 0 : 48,
    }),
  } : undefined
  const sidebar = options.sidebar ? {
    setAttribute: (name: string) => attributes.add(name),
    removeAttribute: (name: string) => attributes.delete(name),
  } : undefined
  const documentMock = {
    getElementById: () => styleElement,
    querySelector: (selector: string) => selector.startsWith('main ') ? composer : sidebar,
    querySelectorAll: () => sidebar && attributes.has('data-coredesk-compact-hidden') ? [sidebar] : [],
    createElement: () => {
      const created = {
        id: '',
        textContent: '',
        remove: () => { if (styleElement === created) styleElement = undefined },
      }
      return created
    },
    head: { appendChild: (element: typeof styleElement) => { styleElement = element } },
  }
  const getComputedStyle = () => ({
    display: 'block',
    visibility: 'visible',
    opacity: options.composerVisible === false ? '0' : '1',
  })
  const execute = new Function('document', 'getComputedStyle', `return ${createCoreChatCompactScript(enabled)}`)
  const result = execute(documentMock, getComputedStyle)
  return { result, attributes, hasStyle: Boolean(styleElement) }
}

describe('CoreChat navigation policy', () => {
  it('uses a dedicated persistent session and official initial URL', () => {
    expect(CORECHAT_VIEW_ID).toBe('coredesk-corechat')
    expect(CORECHAT_URL).toBe('https://chatgpt.com/')
    expect(CORECHAT_PARTITION).toBe('persist:coredesk-corechat')
    expect(CORECHAT_PARTITION).not.toBe('persist:coredesk-google')
    expect(CORECHAT_PARTITION).not.toContain('whatsapp')
  })

  it('allows official and authentication hosts while separating external links', () => {
    expect(classifyCoreChatNavigation('https://chatgpt.com/c/123').action).toBe('allow-internal')
    expect(classifyCoreChatNavigation('https://auth.openai.com/authorize').action).toBe('allow-internal')
    expect(classifyCoreChatNavigation('https://accounts.google.com/o/oauth2/v2/auth').action).toBe('allow-auth')
    expect(classifyCoreChatNavigation('https://login.microsoftonline.com/common/oauth2').action).toBe('allow-auth')
    expect(classifyCoreChatNavigation('https://example.com/result').action).toBe('open-external')
  })

  it('blocks dangerous and invalid protocols', () => {
    for (const url of ['javascript:alert(1)', 'data:text/html,test', 'file:///C:/secret.txt', 'not a url']) {
      expect(classifyCoreChatNavigation(url).action).toBe('block')
    }
  })
})

describe('CoreChat compact mode', () => {
  it('falls back to the complete interface when the composer is missing', () => {
    const execution = runCompactScript({ sidebar: true })
    expect(execution.result).toMatchObject({ enabled: true, applied: false, reason: 'composer-not-found' })
    expect(execution.hasStyle).toBe(false)
    expect(execution.attributes.size).toBe(0)
  })

  it('hides only identified secondary navigation when essentials remain visible', () => {
    const execution = runCompactScript({ composer: true, sidebar: true })
    expect(execution.result).toMatchObject({ enabled: true, applied: true, reason: 'applied', hiddenElements: 1 })
    expect(execution.hasStyle).toBe(true)
    expect(execution.attributes.has('data-coredesk-compact-hidden')).toBe(true)
  })

  it('removes injected changes if the composer becomes unavailable', () => {
    const execution = runCompactScript({ composer: true, sidebar: true, composerVisible: false })
    expect(execution.result).toMatchObject({ enabled: true, applied: false, reason: 'composer-hidden-after-apply' })
    expect(execution.hasStyle).toBe(false)
    expect(execution.attributes.size).toBe(0)
  })

  it('restores the complete interface when compact mode is disabled', () => {
    const execution = runCompactScript({ composer: true, sidebar: true }, false)
    expect(execution.result).toMatchObject({ enabled: false, applied: false, reason: 'disabled' })
    expect(execution.hasStyle).toBe(false)
    expect(execution.attributes.size).toBe(0)
  })
})

const fakeState = vi.hoisted(() => ({
  views: [] as Array<{ options: Electron.WebContentsViewConstructorOptions; webContents: FakeWebContents }>,
}))

class FakeWebContents extends EventEmitter {
  readonly session = {}
  readonly navigationHistory = {
    canGoBack: () => false,
    canGoForward: () => false,
    goBack: vi.fn(),
    goForward: vi.fn(),
  }
  windowOpenHandler?: (details: { url: string }) => { action: string; overrideBrowserWindowOptions?: Electron.BrowserWindowConstructorOptions }
  currentUrl = ''
  setZoomFactor() {}
  setUserAgent() {}
  setAudioMuted() {}
  isDestroyed() { return false }
  isLoading() { return false }
  getURL() { return this.currentUrl }
  async loadURL(url: string) { this.currentUrl = url }
  reload() {}
  stop() {}
  close() {}
  setWindowOpenHandler(handler: typeof this.windowOpenHandler) { this.windowOpenHandler = handler }
  async executeJavaScript(script: string) {
    return script.includes('if (!false)')
      ? { enabled: false, applied: false, reason: 'disabled', hiddenElements: 0 }
      : { enabled: true, applied: true, reason: 'applied', hiddenElements: 1 }
  }
}

class FakeView {
  readonly webContents = new FakeWebContents()
  constructor(readonly options: Electron.WebContentsViewConstructorOptions) {
    fakeState.views.push(this)
  }
  setBounds() {}
}

vi.mock('electron', () => ({
  app: { isPackaged: true },
  BrowserWindow: class {},
  WebContentsView: FakeView,
  session: { fromPartition: () => ({ clearStorageData: vi.fn(), clearCache: vi.fn() }) },
}))

describe('CoreChat WebContentsView', () => {
  it('creates an isolated secure view and keeps Maps and WhatsApp partitions independent', async () => {
    fakeState.views.length = 0
    const { WebViewManager } = await import('../electron/WebViewManager')
    const externalLink = vi.fn()
    const window = {
      isDestroyed: () => false,
      getContentSize: () => [1200, 800],
      contentView: { addChildView: vi.fn(), removeChildView: vi.fn() },
      webContents: { isDestroyed: () => false, send: vi.fn(), focus: vi.fn() },
    }
    const permissions = { configureSession: vi.fn(), isAllowedUrl: () => true }
    const manager = new WebViewManager(window as never, undefined, permissions as never, undefined, 1, undefined, externalLink)
    manager.sync([
      { id: CORECHAT_VIEW_ID, title: 'CoreChat', url: CORECHAT_URL, partition: CORECHAT_PARTITION, pinned: true, type: 'web' },
      { id: 'app-maps', title: 'Maps', url: 'https://www.google.com/maps', partition: 'persist:coredesk-google', pinned: false, type: 'web' },
      { id: 'whatsapp:p1', profileId: 'p1', title: 'Perfil', url: 'https://web.whatsapp.com/', partition: 'persist:whatsapp-p1', pinned: true, type: 'whatsapp' },
    ], CORECHAT_VIEW_ID)

    const coreChat = fakeState.views.find((view) => view.webContents.currentUrl === CORECHAT_URL)
    expect(coreChat?.options.webPreferences).toMatchObject({
      partition: CORECHAT_PARTITION,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    })
    expect(coreChat?.options.webPreferences).not.toHaveProperty('preload')
    expect(fakeState.views.map((view) => view.options.webPreferences?.partition)).toEqual([
      CORECHAT_PARTITION,
      'persist:coredesk-google',
      'persist:whatsapp-p1',
    ])

    expect(coreChat?.webContents.windowOpenHandler?.({ url: 'https://accounts.google.com/o/oauth2/auth' })).toMatchObject({
      action: 'allow',
      overrideBrowserWindowOptions: { webPreferences: { partition: CORECHAT_PARTITION, nodeIntegration: false, contextIsolation: true, sandbox: true } },
    })
    expect(coreChat?.webContents.windowOpenHandler?.({ url: 'https://example.com/article' })).toEqual({ action: 'deny' })
    expect(externalLink).toHaveBeenCalledWith('https://example.com/article', { target: CORECHAT_VIEW_ID })

    const navigation = { preventDefault: vi.fn() }
    coreChat?.webContents.emit('will-navigate', navigation, 'https://example.com/replacement')
    expect(navigation.preventDefault).toHaveBeenCalledOnce()

    const compact = await manager.setCoreChatCompact(false)
    expect(compact).toMatchObject({ enabled: false, applied: false, reason: 'disabled' })
  })
})
