import { EventEmitter } from 'node:events'
import { describe, expect, it, vi } from 'vitest'
import {
  canStartManagedDownload,
  classifyDownloadUrl,
  isPotentiallyDangerousDownload,
  sanitizeDownloadFileName,
  type DownloadSource,
  type DownloadStatus,
} from '../shared/downloads'
import { classifyWhatsAppExternalLink } from '../electron/whatsapp/external-link-policy'
import { PermissionService } from '../electron/core/permissions/PermissionService'

vi.mock('electron', () => ({
  app: { getPath: () => 'C:\\Downloads' },
  dialog: {
    showSaveDialogSync: vi.fn(),
    showMessageBoxSync: vi.fn(),
  },
}))

class FakeDownloadItem extends EventEmitter {
  receivedBytes = 0
  totalBytes = 100
  savePath?: string

  constructor(
    readonly url = 'https://mmg.whatsapp.net/file',
    readonly fileName = 'documento.pdf',
    readonly mimeType = 'application/pdf',
    readonly userGesture = true,
  ) {
    super()
  }

  getURL() { return this.url }
  getFilename() { return this.fileName }
  getMimeType() { return this.mimeType }
  hasUserGesture() { return this.userGesture }
  getReceivedBytes() { return this.receivedBytes }
  getTotalBytes() { return this.totalBytes }
  setSavePath(value: string) { this.savePath = value }
}

const whatsappSource = (visible = true): DownloadSource => ({
  viewId: 'whatsapp:profile-1',
  partition: 'persist:whatsapp-profile-1',
  type: 'whatsapp',
  profileId: 'profile-1',
  isVisible: () => visible,
})

describe('download security policy', () => {
  it('accepts HTTPS and blob only for a visible WhatsApp download source', () => {
    expect(canStartManagedDownload(whatsappSource(), 'https://mmg.whatsapp.net/file', true)).toBe(true)
    expect(canStartManagedDownload(whatsappSource(), 'blob:https://web.whatsapp.com/id', true)).toBe(true)
    expect(canStartManagedDownload(whatsappSource(false), 'https://mmg.whatsapp.net/file', true)).toBe(false)
    expect(canStartManagedDownload({ ...whatsappSource(), type: 'web' }, 'https://example.com/file', true)).toBe(false)
    expect(canStartManagedDownload(whatsappSource(), 'https://mmg.whatsapp.net/file', false)).toBe(false)
    for (const url of ['javascript:alert(1)', 'data:text/plain,file', 'file:///C:/secret.txt', 'filesystem:https://web.whatsapp.com/file']) {
      expect(classifyDownloadUrl(url).allowed).toBe(false)
    }
  })

  it('keeps blob and dangerous protocols blocked as ordinary WhatsApp navigation', () => {
    for (const url of ['blob:https://web.whatsapp.com/id', 'javascript:alert(1)', 'data:text/plain,file', 'file:///C:/secret.txt']) {
      expect(classifyWhatsAppExternalLink(url).action).toBe('block')
    }
  })

  it('sanitizes the suggested name and identifies potentially executable files', () => {
    expect(sanitizeDownloadFileName('..\\relatório:final?.pdf')).toBe('relatório_final_.pdf')
    expect(sanitizeDownloadFileName('   ')).toBe('download')
    expect(isPotentiallyDangerousDownload('instalador.EXE')).toBe(true)
    expect(isPotentiallyDangerousDownload('documento.pdf')).toBe(false)
  })
})

describe('PermissionService download registration', () => {
  it('registers one listener per session and routes only registered WebContents', () => {
    const listeners: Array<(...args: never[]) => void> = []
    const session = {
      setPermissionCheckHandler: vi.fn(),
      setPermissionRequestHandler: vi.fn(),
      on: vi.fn((_name: string, listener: (...args: never[]) => void) => listeners.push(listener)),
    }
    const permissions = new PermissionService()
    const downloadHandler = vi.fn()
    permissions.setDownloadHandler(downloadHandler)
    permissions.configureSession(session as never)
    permissions.configureSession(session as never)
    expect(session.on).toHaveBeenCalledTimes(1)

    const contents = {}
    const source = whatsappSource()
    permissions.registerDownloadSource(contents as never, source)
    const allowedEvent = { preventDefault: vi.fn() }
    const item = new FakeDownloadItem()
    listeners[0](allowedEvent as never, item as never, contents as never)
    expect(downloadHandler).toHaveBeenCalledWith(allowedEvent, item, source)
    expect(allowedEvent.preventDefault).not.toHaveBeenCalled()

    const unknownEvent = { preventDefault: vi.fn() }
    listeners[0](unknownEvent as never, item as never, {} as never)
    expect(unknownEvent.preventDefault).toHaveBeenCalledOnce()
  })
})

describe('DownloadService', () => {
  it('opens the save dialog, preserves the suggested name, reports progress, and completes', async () => {
    const { DownloadService } = await import('../electron/downloads/DownloadService')
    const statuses: DownloadStatus[] = []
    const chooseSavePath = vi.fn(() => 'C:\\chosen\\documento.pdf')
    const service = new DownloadService({} as never, {
      chooseSavePath,
      emitStatus: (status) => statuses.push(status),
      createId: () => 'download-1',
    })
    const event = { preventDefault: vi.fn() }
    const item = new FakeDownloadItem()
    service.handle(event as never, item as never, whatsappSource())

    expect(chooseSavePath).toHaveBeenCalledWith({}, 'documento.pdf')
    expect(item.savePath).toBe('C:\\chosen\\documento.pdf')
    expect(event.preventDefault).not.toHaveBeenCalled()
    item.receivedBytes = 50
    item.emit('updated', {}, 'progressing')
    item.receivedBytes = 100
    item.emit('done', {}, 'completed')
    expect(statuses.map((status) => status.state)).toEqual(['preparing', 'progressing', 'progressing', 'completed'])
    expect(statuses.at(-1)).toMatchObject({ fileName: 'documento.pdf', receivedBytes: 100, totalBytes: 100 })
  })

  it('cancels safely when the save dialog is dismissed', async () => {
    const { DownloadService } = await import('../electron/downloads/DownloadService')
    const statuses: DownloadStatus[] = []
    const service = new DownloadService({} as never, {
      chooseSavePath: () => undefined,
      emitStatus: (status) => statuses.push(status),
      createId: () => 'download-cancelled',
    })
    const event = { preventDefault: vi.fn() }
    service.handle(event as never, new FakeDownloadItem() as never, whatsappSource())
    expect(event.preventDefault).toHaveBeenCalledOnce()
    expect(statuses.at(-1)?.state).toBe('cancelled')
  })

  it('requires an extra confirmation for executable files', async () => {
    const { DownloadService } = await import('../electron/downloads/DownloadService')
    const chooseSavePath = vi.fn()
    const service = new DownloadService({} as never, {
      confirmDangerousFile: () => false,
      chooseSavePath,
      createId: () => 'dangerous-download',
    })
    const event = { preventDefault: vi.fn() }
    service.handle(event as never, new FakeDownloadItem('https://mmg.whatsapp.net/file', 'setup.exe') as never, whatsappSource())
    expect(event.preventDefault).toHaveBeenCalledOnce()
    expect(chooseSavePath).not.toHaveBeenCalled()
  })

  it('blocks background, Maps, CoreChat, and disallowed-protocol downloads before showing a dialog', async () => {
    const { DownloadService } = await import('../electron/downloads/DownloadService')
    const chooseSavePath = vi.fn()
    const service = new DownloadService({} as never, { chooseSavePath, createId: () => 'blocked-download' })
    const sources = [
      whatsappSource(false),
      { ...whatsappSource(), viewId: 'app-maps', type: 'web' as const },
      { ...whatsappSource(), viewId: 'coredesk-corechat', type: 'web' as const },
    ]
    for (const source of sources) {
      const event = { preventDefault: vi.fn() }
      service.handle(event as never, new FakeDownloadItem() as never, source)
      expect(event.preventDefault).toHaveBeenCalledOnce()
    }
    const invalidEvent = { preventDefault: vi.fn() }
    service.handle(invalidEvent as never, new FakeDownloadItem('data:text/plain,file') as never, whatsappSource())
    expect(invalidEvent.preventDefault).toHaveBeenCalledOnce()
    expect(chooseSavePath).not.toHaveBeenCalled()
  })

  it('blocks a second automatic download while the first item is still active', async () => {
    const { DownloadService } = await import('../electron/downloads/DownloadService')
    const chooseSavePath = vi.fn(() => 'C:\\chosen\\file.pdf')
    const service = new DownloadService({} as never, {
      chooseSavePath,
      createId: () => 'single-download',
    })
    const firstItem = new FakeDownloadItem()
    service.handle({ preventDefault: vi.fn() } as never, firstItem as never, whatsappSource())
    const secondEvent = { preventDefault: vi.fn() }
    service.handle(secondEvent as never, new FakeDownloadItem() as never, whatsappSource())
    expect(secondEvent.preventDefault).toHaveBeenCalledOnce()
    expect(chooseSavePath).toHaveBeenCalledTimes(1)
    firstItem.emit('done', {}, 'completed')
  })

  it('blocks a DownloadItem without a Chromium user gesture', async () => {
    const { DownloadService } = await import('../electron/downloads/DownloadService')
    const chooseSavePath = vi.fn()
    const service = new DownloadService({} as never, {
      chooseSavePath,
      createId: () => 'automatic-download',
    })
    const event = { preventDefault: vi.fn() }
    const item = new FakeDownloadItem('https://mmg.whatsapp.net/file', 'automatic.pdf', 'application/pdf', false)
    service.handle(event as never, item as never, whatsappSource())
    expect(event.preventDefault).toHaveBeenCalledOnce()
    expect(chooseSavePath).not.toHaveBeenCalled()
  })

  it.each([
    ['cancelled', 'cancelled'],
    ['interrupted', 'failed'],
  ] as const)('reports a %s DownloadItem as %s', async (doneState, expectedState) => {
    const { DownloadService } = await import('../electron/downloads/DownloadService')
    const statuses: DownloadStatus[] = []
    const service = new DownloadService({} as never, {
      chooseSavePath: () => 'C:\\chosen\\file.zip',
      emitStatus: (status) => statuses.push(status),
      createId: () => `download-${doneState}`,
    })
    const item = new FakeDownloadItem('blob:https://web.whatsapp.com/id', 'file.zip', 'application/zip')
    service.handle({ preventDefault: vi.fn() } as never, item as never, whatsappSource())
    item.emit('done', {}, doneState)
    expect(statuses.at(-1)?.state).toBe(expectedState)
  })
})
