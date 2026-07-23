import { EventEmitter } from 'node:events'
import { describe, expect, it, vi } from 'vitest'
import { MIRO_DASHBOARD_URL, MIRO_PARTITION, MIRO_VIEW_ID } from '../shared/miro'
import { SHELL_LAYOUT } from '../shared/layout'

const fakeState = vi.hoisted(() => ({
  views: [] as Array<{ options: Electron.WebContentsViewConstructorOptions; webContents: FakeWebContents; bounds?: Electron.Rectangle }>,
}))

class FakeWebContents extends EventEmitter {
  readonly session = {}
  readonly navigationHistory = {
    canGoBack: () => false,
    canGoForward: () => false,
    goBack: vi.fn(),
    goForward: vi.fn(),
  }
  currentUrl = ''
  destroyed = false
  windowOpenHandler?: (details: { url: string }) => { action: string; overrideBrowserWindowOptions?: Electron.BrowserWindowConstructorOptions }
  setZoomFactor = vi.fn()
  setUserAgent() {}
  setAudioMuted() {}
  isDestroyed() { return this.destroyed }
  isLoading() { return false }
  getURL() { return this.currentUrl }
  async loadURL(url: string) { this.currentUrl = url }
  reload() {}
  stop() {}
  close() { this.destroyed = true }
  setWindowOpenHandler(handler: typeof this.windowOpenHandler) { this.windowOpenHandler = handler }
}

class FakeView {
  readonly webContents = new FakeWebContents()
  bounds?: Electron.Rectangle
  constructor(readonly options: Electron.WebContentsViewConstructorOptions) {
    fakeState.views.push(this)
  }
  setBounds(bounds: Electron.Rectangle) { this.bounds = bounds }
}

vi.mock('electron', () => ({
  app: { isPackaged: true },
  BrowserWindow: class {},
  WebContentsView: FakeView,
  session: { fromPartition: () => ({ clearStorageData: vi.fn(), clearCache: vi.fn() }) },
}))

describe('Miro WebContentsView', () => {
  it('creates one secure isolated view, reveals it after loading, hides it on Home and reuses it', async () => {
    fakeState.views.length = 0
    const { WebViewManager } = await import('../electron/WebViewManager')
    const window = {
      isDestroyed: () => false,
      getContentSize: () => [1200, 800],
      contentView: { addChildView: vi.fn(), removeChildView: vi.fn() },
      webContents: { isDestroyed: () => false, send: vi.fn(), focus: vi.fn() },
    }
    const permissions = {
      configureSession: vi.fn(),
      registerDownloadSource: vi.fn(),
      unregisterDownloadSource: vi.fn(),
      isAllowedUrl: () => true,
    }
    const externalLink = vi.fn()
    const manager = new WebViewManager(window as never, undefined, permissions as never, undefined, 1, undefined, externalLink)
    const descriptor = {
      id: MIRO_VIEW_ID,
      title: 'Miro',
      url: MIRO_DASHBOARD_URL,
      partition: MIRO_PARTITION,
      pinned: true,
      type: 'web' as const,
    }

    manager.sync([descriptor], 'home')
    expect(fakeState.views).toHaveLength(1)
    const miro = fakeState.views[0]
    expect(miro.options.webPreferences).toMatchObject({
      partition: MIRO_PARTITION,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    })
    expect(miro.options.webPreferences).not.toHaveProperty('preload')
    expect(window.contentView.addChildView).not.toHaveBeenCalled()

    manager.sync([descriptor], MIRO_VIEW_ID)
    expect(window.contentView.addChildView).not.toHaveBeenCalled()
    miro.webContents.emit('did-finish-load')
    expect(window.contentView.addChildView).toHaveBeenCalledWith(miro)
    expect(miro.bounds).toEqual({
      x: 0,
      y: SHELL_LAYOUT.titleBarHeight + SHELL_LAYOUT.globalBarHeight + SHELL_LAYOUT.navigationBarHeight,
      width: 1200,
      height: 800 - SHELL_LAYOUT.titleBarHeight - SHELL_LAYOUT.globalBarHeight - SHELL_LAYOUT.navigationBarHeight,
    })

    manager.sync([descriptor], 'home')
    expect(window.contentView.removeChildView).toHaveBeenCalledWith(miro)
    expect(miro.webContents.destroyed).toBe(false)
    manager.sync([descriptor], MIRO_VIEW_ID)
    expect(fakeState.views).toHaveLength(1)
    expect(window.contentView.addChildView.mock.calls.filter(([view]) => view === miro)).toHaveLength(2)
  })

  it('keeps auth in an isolated popup, blocks desktop protocols and preserves the main view', async () => {
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
    manager.sync([{
      id: MIRO_VIEW_ID,
      title: 'Miro',
      url: MIRO_DASHBOARD_URL,
      partition: MIRO_PARTITION,
      pinned: true,
      type: 'web',
    }], MIRO_VIEW_ID)
    const miro = fakeState.views[0]

    expect(miro.webContents.windowOpenHandler?.({ url: 'https://accounts.google.com/o/oauth2/auth' })).toMatchObject({
      action: 'allow',
      overrideBrowserWindowOptions: {
        webPreferences: {
          partition: MIRO_PARTITION,
          contextIsolation: true,
          nodeIntegration: false,
          sandbox: true,
        },
      },
    })
    expect(miro.webContents.windowOpenHandler?.({ url: 'https://miro.com/app/board/uX-example=/' })).toEqual({ action: 'deny' })
    expect(miro.webContents.currentUrl).toBe('https://miro.com/app/board/uX-example=/')
    expect(miro.webContents.windowOpenHandler?.({ url: 'miroapp://board/example' })).toEqual({ action: 'deny' })
    expect(miro.webContents.windowOpenHandler?.({ url: 'https://example.com/article' })).toEqual({ action: 'deny' })
    expect(externalLink).toHaveBeenCalledWith('https://example.com/article', { target: MIRO_VIEW_ID })
    expect(miro.webContents.destroyed).toBe(false)
  })
})
