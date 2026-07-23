import { EventEmitter } from 'node:events'
import type { BrowserWindow, BrowserWindowConstructorOptions, Session } from 'electron'
import { describe, expect, it, vi } from 'vitest'
import { classifyWhatsAppExternalLink, isWhatsAppInternalUrl } from '../electron/whatsapp/external-link-policy'
import { MAX_EXTERNAL_POPUPS, WhatsAppExternalLinkManager } from '../electron/whatsapp/WhatsAppExternalLinkManager'

class FakeWebContents extends EventEmitter {
  destroyed = false
  zoomFactors: number[] = []
  windowOpenHandler?: (details: { url: string }) => { action: string }
  setZoomFactor(factor: number) { this.zoomFactors.push(factor) }
  isDestroyed() { return this.destroyed }
  setWindowOpenHandler(handler: (details: { url: string }) => { action: string }) { this.windowOpenHandler = handler }
}

class FakePopup extends EventEmitter {
  static nextId = 1
  readonly id = FakePopup.nextId++
  readonly webContents = new FakeWebContents()
  destroyed = false
  shown = false
  focused = false
  loadedUrl?: string
  async loadURL(url: string) { this.loadedUrl = url }
  isDestroyed() { return this.destroyed }
  show() { this.shown = true }
  focus() { this.focused = true }
  close() { if (this.destroyed) return; this.destroyed = true; this.emit('closed') }
}

function createHarness() {
  const popups: FakePopup[] = []
  const options: BrowserWindowConstructorOptions[] = []
  const systemUrls: string[] = []
  const permissionChecks: unknown[] = []
  const permissionRequests: unknown[] = []
  const owner = { getBounds: () => ({ x: 100, y: 50, width: 1400, height: 900 }) } as BrowserWindow
  const manager = new WhatsAppExternalLinkManager(owner, 1.1, {
    createWindow: (value) => { options.push(value); const popup = new FakePopup(); popups.push(popup); return popup as unknown as BrowserWindow },
    openSystemUrl: async (url) => { systemUrls.push(url) },
    getSession: () => ({
      setPermissionCheckHandler: (handler: unknown) => permissionChecks.push(handler),
      setPermissionRequestHandler: (handler: unknown) => permissionRequests.push(handler),
    }) as unknown as Session,
  })
  return { manager, popups, options, systemUrls, permissionChecks, permissionRequests }
}

describe('política de links externos do WhatsApp', () => {
  it('distingue URLs internas oficiais sem usar correspondência parcial insegura', () => {
    expect(isWhatsAppInternalUrl('https://web.whatsapp.com/')).toBe(true)
    expect(isWhatsAppInternalUrl('https://static.whatsapp.net/asset')).toBe(true)
    expect(isWhatsAppInternalUrl('blob:https://web.whatsapp.com/uuid')).toBe(true)
    expect(isWhatsAppInternalUrl('about:blank')).toBe(true)
    expect(isWhatsAppInternalUrl('about:blank#temporary')).toBe(true)
    expect(isWhatsAppInternalUrl('https://whatsapp.com.evil.example/')).toBe(false)
  })

  it('aceita HTTP(S), encaminha mailto/tel e bloqueia protocolos perigosos ou inválidos', () => {
    expect(classifyWhatsAppExternalLink('https://example.com/a?token=secret')).toMatchObject({ action: 'open-popup', protocol: 'https:', hostname: 'example.com' })
    expect(classifyWhatsAppExternalLink('http://example.com')).toMatchObject({ action: 'open-popup', protocol: 'http:' })
    expect(classifyWhatsAppExternalLink('mailto:atendimento@example.com')).toMatchObject({ action: 'open-system', protocol: 'mailto:' })
    expect(classifyWhatsAppExternalLink('tel:+5547999999999')).toMatchObject({ action: 'open-system', protocol: 'tel:' })
    for (const url of ['javascript:alert(1)', 'file:///C:/secret.txt', 'data:text/html,test', 'chrome://settings', 'devtools://devtools', 'não é url']) {
      expect(classifyWhatsAppExternalLink(url).action).toBe('block')
    }
  })
})

describe('gerenciador de popups externas do WhatsApp', () => {
  it('cria popup segura, separada, centralizada e aplica o zoom atual', () => {
    const harness = createHarness()
    harness.manager.handle('https://example.com/document.pdf?token=secret', { target: 'whatsapp:profile-1', profileId: 'profile-1' })
    expect(harness.manager.size).toBe(1)
    expect(harness.popups[0].loadedUrl).toBe('https://example.com/document.pdf?token=secret')
    expect(harness.popups[0].webContents.zoomFactors).toEqual([1.1])
    expect(harness.options[0]).toMatchObject({ show: false, frame: true, resizable: true, modal: false, width: 1100, height: 760, x: 250, y: 120 })
    expect(harness.options[0].webPreferences).toMatchObject({ partition: 'persist:coredesk-external-links', contextIsolation: true, nodeIntegration: false, sandbox: true, webSecurity: true, allowRunningInsecureContent: false })
    expect(harness.options[0].webPreferences).not.toHaveProperty('preload')
    expect(harness.permissionChecks).toHaveLength(1)
    expect(harness.permissionRequests).toHaveLength(1)
    harness.popups[0].emit('ready-to-show')
    expect(harness.popups[0]).toMatchObject({ shown: true, focused: true })
  })

  it('controla target blank, permite navegação HTTP(S) na popup e bloqueia protocolo perigoso', () => {
    const harness = createHarness()
    harness.manager.handle('https://first.example', { target: 'whatsapp:p' })
    expect(harness.popups[0].webContents.windowOpenHandler?.({ url: 'https://second.example' })).toEqual({ action: 'deny' })
    expect(harness.popups).toHaveLength(2)
    expect(harness.popups[0].webContents.windowOpenHandler?.({ url: 'https://web.whatsapp.com/' })).toEqual({ action: 'deny' })
    expect(harness.popups).toHaveLength(3)
    const allowedEvent = { preventDefault: vi.fn() }
    harness.popups[0].webContents.emit('will-navigate', allowedEvent, 'https://other.example/path')
    expect(allowedEvent.preventDefault).not.toHaveBeenCalled()
    const redirectEvent = { preventDefault: vi.fn() }
    harness.popups[0].webContents.emit('will-redirect', redirectEvent, 'https://web.whatsapp.com/')
    expect(redirectEvent.preventDefault).not.toHaveBeenCalled()
    const blockedEvent = { preventDefault: vi.fn() }
    harness.popups[0].webContents.emit('will-navigate', blockedEvent, 'file:///C:/secret.txt')
    expect(blockedEvent.preventDefault).toHaveBeenCalledOnce()
  })

  it('usa o sistema somente para mailto/tel e não cria BrowserWindow', async () => {
    const harness = createHarness()
    harness.manager.handle('mailto:operador@example.com', { target: 'whatsapp:p' })
    harness.manager.handle('tel:+5547999999999', { target: 'whatsapp:p' })
    await Promise.resolve()
    expect(harness.systemUrls).toEqual(['mailto:operador@example.com', 'tel:+5547999999999'])
    expect(harness.popups).toHaveLength(0)
  })

  it('remove referências ao fechar e atualiza o zoom das popups abertas', () => {
    const harness = createHarness()
    harness.manager.handle('https://one.example', { target: 'whatsapp:p' })
    harness.manager.handle('https://two.example', { target: 'whatsapp:p' })
    harness.manager.setZoomFactor(1.4)
    expect(harness.popups.every((popup) => popup.webContents.zoomFactors.at(-1) === 1.4)).toBe(true)
    harness.popups[0].close()
    expect(harness.manager.size).toBe(1)
  })

  it('limita popups simultâneas e foca uma existente ao atingir o limite', () => {
    const harness = createHarness()
    for (let index = 0; index < MAX_EXTERNAL_POPUPS; index += 1) harness.manager.handle(`https://example.com/${index}`, { target: 'whatsapp:p' })
    harness.manager.handle('https://example.com/blocked', { target: 'whatsapp:p' })
    expect(harness.popups).toHaveLength(MAX_EXTERNAL_POPUPS)
    expect(harness.popups.at(-1)?.focused).toBe(true)
  })

  it('fecha todas as popups quando o ciclo de vida da janela principal termina', () => {
    const harness = createHarness()
    harness.manager.handle('https://one.example', { target: 'whatsapp:p' })
    harness.manager.handle('https://two.example', { target: 'whatsapp:p' })
    harness.manager.closeAll()
    expect(harness.manager.size).toBe(0)
    expect(harness.popups.every((popup) => popup.destroyed)).toBe(true)
  })
})
