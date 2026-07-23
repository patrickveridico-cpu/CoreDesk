import { app, dialog } from 'electron'
import type { BrowserWindow, DownloadItem, Event } from 'electron'
import path from 'node:path'
import {
  canStartManagedDownload,
  classifyDownloadUrl,
  isPotentiallyDangerousDownload,
  sanitizeDownloadFileName,
  type DownloadSource,
  type DownloadStatus,
} from '../../shared/downloads'

interface DownloadServiceDependencies {
  chooseSavePath: (window: BrowserWindow, fileName: string) => string | undefined
  confirmDangerousFile: (window: BrowserWindow, fileName: string) => boolean
  emitStatus: (status: DownloadStatus) => void
  createId: () => string
}

const defaultDependencies: DownloadServiceDependencies = {
  chooseSavePath: (window, fileName) => dialog.showSaveDialogSync(window, {
    title: 'Salvar arquivo do WhatsApp',
    defaultPath: path.join(app.getPath('downloads'), fileName),
    buttonLabel: 'Salvar',
    properties: ['showOverwriteConfirmation', 'createDirectory'],
  }),
  confirmDangerousFile: (window, fileName) => dialog.showMessageBoxSync(window, {
    type: 'warning',
    title: 'Confirmar download',
    message: 'Este tipo de arquivo pode alterar ou executar conteúdo no computador.',
    detail: `${fileName}\n\nSalve somente se você confia na origem. O CoreDesk não abrirá o arquivo automaticamente.`,
    buttons: ['Cancelar', 'Salvar mesmo assim'],
    defaultId: 0,
    cancelId: 0,
    noLink: true,
  }) === 1,
  emitStatus: () => undefined,
  createId: () => crypto.randomUUID(),
}

export class DownloadService {
  private readonly dependencies: DownloadServiceDependencies
  private readonly activeViewIds = new Set<string>()

  constructor(
    private readonly window: BrowserWindow,
    dependencies: Partial<DownloadServiceDependencies> = {},
  ) {
    this.dependencies = { ...defaultDependencies, ...dependencies }
  }

  handle(event: Event, item: DownloadItem, source: DownloadSource) {
    const url = item.getURL()
    const fileName = sanitizeDownloadFileName(item.getFilename())
    const classification = classifyDownloadUrl(url)
    const hasUserGesture = item.hasUserGesture()
    const id = this.dependencies.createId()
    const extension = path.extname(fileName).slice(0, 21).toLocaleLowerCase('en-US')
    const context = {
      id,
      viewId: source.viewId,
      profileId: source.profileId,
      partition: source.partition,
      protocol: classification.protocol,
      hostname: classification.hostname,
      mimeType: item.getMimeType(),
      fileExtension: extension,
      fileNameLength: fileName.length,
      hasUserGesture,
    }

    if (!canStartManagedDownload(source, url, hasUserGesture) || this.activeViewIds.has(source.viewId)) {
      event.preventDefault()
      console.warn('[CoreDesk Download] bloqueado', {
        ...context,
        reason: this.activeViewIds.has(source.viewId)
          ? 'download-already-active'
          : !hasUserGesture
            ? 'user-gesture-required'
          : source.type !== 'whatsapp'
          ? 'source-not-allowed'
          : !source.isVisible()
            ? 'source-not-visible'
            : 'protocol-not-allowed',
      })
      return
    }

    this.emit({ id, source, fileName, state: 'preparing', item })
    console.log('[CoreDesk Download] solicitado', context)

    if (isPotentiallyDangerousDownload(fileName) && !this.dependencies.confirmDangerousFile(this.window, fileName)) {
      event.preventDefault()
      this.emit({ id, source, fileName, state: 'cancelled', item, message: 'Download cancelado.' })
      console.log('[CoreDesk Download] cancelado', { ...context, stage: 'dangerous-file-confirmation' })
      return
    }

    const savePath = this.dependencies.chooseSavePath(this.window, fileName)
    if (!savePath) {
      event.preventDefault()
      this.emit({ id, source, fileName, state: 'cancelled', item, message: 'Download cancelado.' })
      console.log('[CoreDesk Download] cancelado', { ...context, stage: 'save-dialog' })
      return
    }

    item.setSavePath(savePath)
    this.activeViewIds.add(source.viewId)
    this.emit({ id, source, fileName, state: 'progressing', item })
    let lastProgress = -1
    item.on('updated', (_updatedEvent, state) => {
      if (state !== 'progressing') return
      const totalBytes = item.getTotalBytes()
      const progress = totalBytes > 0 ? Math.floor(item.getReceivedBytes() * 100 / totalBytes) : 0
      if (progress === lastProgress) return
      lastProgress = progress
      this.emit({ id, source, fileName, state: 'progressing', item })
    })
    item.once('done', (_doneEvent, state) => {
      this.activeViewIds.delete(source.viewId)
      const finalState = state === 'completed' ? 'completed' : state === 'cancelled' ? 'cancelled' : 'failed'
      const message = finalState === 'completed'
        ? 'Arquivo salvo.'
        : finalState === 'cancelled'
          ? 'Download cancelado.'
          : 'Não foi possível salvar o arquivo.'
      this.emit({ id, source, fileName, state: finalState, item, message })
      const log = finalState === 'failed' ? console.error : console.log
      log('[CoreDesk Download] finalizado', { ...context, state: finalState })
    })
  }

  private emit(input: {
    id: string
    source: DownloadSource
    fileName: string
    state: DownloadStatus['state']
    item: DownloadItem
    message?: string
  }) {
    this.dependencies.emitStatus({
      id: input.id,
      viewId: input.source.viewId,
      fileName: input.fileName,
      state: input.state,
      receivedBytes: input.item.getReceivedBytes(),
      totalBytes: input.item.getTotalBytes(),
      message: input.message,
    })
  }
}
