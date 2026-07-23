import { EventEmitter } from 'node:events'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const fakeState = vi.hoisted(() => ({ views: [] as FakeView[] }))

class FakeWebContents extends EventEmitter {
  readonly session = {}
  readonly navigationHistory = { canGoBack: () => false, canGoForward: () => false }
  windowOpenHandler?: (details: { url: string }) => { action: string }
  currentUrl = ''
  destroyed = false
  setZoomFactor() {}
  setUserAgent() {}
  setAudioMuted() {}
  isDestroyed() { return this.destroyed }
  isLoading() { return false }
  getURL() { return this.currentUrl }
  async loadURL(url: string) { this.currentUrl = url }
  setWindowOpenHandler(handler: (details: { url: string }) => { action: string }) { this.windowOpenHandler = handler }
  close() { this.destroyed = true }
}

class FakeView {
  readonly webContents = new FakeWebContents()
  bounds?: Electron.Rectangle
  constructor() { fakeState.views.push(this) }
  setBounds(bounds: Electron.Rectangle) { this.bounds = bounds }
}

vi.mock('electron', () => ({
  app: { isPackaged: true },
  BrowserWindow: class {},
  WebContentsView: FakeView,
  session: { fromPartition: () => ({}) },
}))

describe('interceptação das navegações da WebContentsView WhatsApp', () => {
  beforeEach(() => { fakeState.views.length = 0 })

  it('intercepta navegação direta, mas permite redirects HTTP(S) automáticos do bootstrap', async () => {
    const { WebViewManager } = await import('../electron/WebViewManager')
    const intercepted = vi.fn()
    const window = {
      isDestroyed: () => false,
      getContentSize: () => [1200, 800],
      contentView: { addChildView: vi.fn(), removeChildView: vi.fn() },
      webContents: { isDestroyed: () => false, send: vi.fn(), focus: vi.fn() },
    }
    const permissions = { configureSession: vi.fn(), isAllowedUrl: () => true }
    const manager = new WebViewManager(window as never, undefined, permissions as never, undefined, 1, undefined, intercepted)
    manager.sync([{ id: 'whatsapp:profile-1', profileId: 'profile-1', title: 'Perfil', url: 'https://web.whatsapp.com/', partition: 'persist:whatsapp-profile-1', pinned: true, type: 'whatsapp' }], 'whatsapp:profile-1')
    const contents = fakeState.views[0].webContents
    const directEvent = { preventDefault: vi.fn() }
    contents.emit('will-navigate', directEvent, 'https://example.com/document?token=secret')
    expect(directEvent.preventDefault).toHaveBeenCalledOnce()
    expect(intercepted).toHaveBeenCalledWith('https://example.com/document?token=secret', { target: 'whatsapp:profile-1', profileId: 'profile-1' })
    const redirectEvent = { preventDefault: vi.fn() }
    contents.emit('will-redirect', redirectEvent, 'https://maps.google.com/')
    expect(redirectEvent.preventDefault).not.toHaveBeenCalled()
    const loginRedirectEvent = { preventDefault: vi.fn() }
    contents.emit('will-redirect', loginRedirectEvent, 'https://static.xx.fbcdn.net/login-bootstrap')
    expect(loginRedirectEvent.preventDefault).not.toHaveBeenCalled()
    expect(intercepted).toHaveBeenCalledTimes(1)
    expect(contents.currentUrl).toBe('https://web.whatsapp.com/')
    expect(contents.destroyed).toBe(false)
  })

  it('não interfere em subframes e bloqueia protocolo perigoso em redirect de frame principal', async () => {
    const { WebViewManager } = await import('../electron/WebViewManager')
    const intercepted = vi.fn()
    const window = {
      isDestroyed: () => false,
      getContentSize: () => [1200, 800],
      contentView: { addChildView: vi.fn(), removeChildView: vi.fn() },
      webContents: { isDestroyed: () => false, send: vi.fn(), focus: vi.fn() },
    }
    const permissions = { configureSession: vi.fn(), isAllowedUrl: () => true }
    const manager = new WebViewManager(window as never, undefined, permissions as never, undefined, 1, undefined, intercepted)
    manager.sync([{ id: 'whatsapp:profile-frames', profileId: 'profile-frames', title: 'Perfil', url: 'https://web.whatsapp.com/', partition: 'persist:whatsapp-profile-frames', pinned: true, type: 'whatsapp' }], 'whatsapp:profile-frames')
    const contents = fakeState.views[0].webContents
    const subframeEvent = { preventDefault: vi.fn(), url: 'https://cdn.example/frame', isMainFrame: false }
    contents.emit('will-navigate', subframeEvent, subframeEvent.url)
    expect(subframeEvent.preventDefault).not.toHaveBeenCalled()
    expect(intercepted).not.toHaveBeenCalled()
    const dangerousRedirect = { preventDefault: vi.fn(), url: 'javascript:alert(1)', isMainFrame: true }
    contents.emit('will-redirect', dangerousRedirect, dangerousRedirect.url)
    expect(dangerousRedirect.preventDefault).toHaveBeenCalledOnce()
    expect(intercepted).not.toHaveBeenCalled()
  })

  it('intercepta target blank externo e mantém navegação oficial interna permitida', async () => {
    const { WebViewManager } = await import('../electron/WebViewManager')
    const intercepted = vi.fn()
    const window = {
      isDestroyed: () => false,
      getContentSize: () => [1200, 800],
      contentView: { addChildView: vi.fn(), removeChildView: vi.fn() },
      webContents: { isDestroyed: () => false, send: vi.fn(), focus: vi.fn() },
    }
    const permissions = { configureSession: vi.fn(), isAllowedUrl: () => true }
    const manager = new WebViewManager(window as never, undefined, permissions as never, undefined, 1, undefined, intercepted)
    manager.sync([{ id: 'whatsapp:profile-2', profileId: 'profile-2', title: 'Perfil', url: 'https://web.whatsapp.com/', partition: 'persist:whatsapp-profile-2', pinned: true, type: 'whatsapp' }], 'whatsapp:profile-2')
    const contents = fakeState.views[0].webContents
    expect(contents.windowOpenHandler?.({ url: 'https://example.com' })).toEqual({ action: 'deny' })
    expect(intercepted).toHaveBeenCalledWith('https://example.com', { target: 'whatsapp:profile-2', profileId: 'profile-2' })
    const internalEvent = { preventDefault: vi.fn() }
    contents.emit('will-navigate', internalEvent, 'https://web.whatsapp.com/')
    expect(internalEvent.preventDefault).not.toHaveBeenCalled()
  })
})
