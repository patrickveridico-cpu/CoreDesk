import { app, BrowserWindow, dialog, session } from 'electron'
import { copyFile, mkdir, readFile, rename, stat } from 'node:fs/promises'
import path from 'node:path'
import type {
  CreateWhatsAppProfileInput,
  IconSelection,
  UpdateWhatsAppProfileInput,
  WhatsAppProfile,
  WhatsAppProfileState,
} from '../../shared/whatsapp'
import { extractUnreadCount, validateIconFile, WHATSAPP_URL } from '../../shared/whatsapp'
import type { WebViewStateUpdate } from '../../shared/contracts'
import { WHATSAPP_CHANNELS } from '../channels'
import type { WebViewManager } from '../WebViewManager'
import { WhatsAppProfileStore } from './WhatsAppProfileStore'
import { performProfileRemoval } from './profile-removal'

export const whatsappTabId = (profileId: string) => `whatsapp:${profileId}`

export class WhatsAppProfileManager {
  private readonly runtime = new Map<string, WhatsAppProfileState>()
  private ready?: Promise<ReturnType<WhatsAppProfileStore['snapshot']>>

  constructor(
    private readonly window: BrowserWindow,
    private readonly store: WhatsAppProfileStore,
    private readonly views: WebViewManager,
    private readonly iconsDirectory = path.join(app.getPath('userData'), 'profile-icons'),
  ) {}

  async load() {
    if (!this.ready) {
      this.ready = (async () => {
        await mkdir(this.iconsDirectory, { recursive: true })
        return this.store.load()
      })()
    }
    return this.ready
  }

  async listProfiles() {
    await this.load()
    return this.resolveSnapshot()
  }

  async createProfile(input: CreateWhatsAppProfileInput) {
    await this.load()
    const pendingIcon = input.iconToken?.startsWith('pending-') ? input.iconToken : undefined
    const profile = await this.store.create({ ...input, iconToken: pendingIcon ? undefined : input.iconToken })
    if (pendingIcon) await this.attachPendingIcon(profile, pendingIcon)
    await this.store.setActive(profile.id)
    await this.emitProfiles()
    return this.resolveProfile(this.store.get(profile.id))
  }

  async updateProfile(id: string, input: UpdateWhatsAppProfileInput) {
    await this.load()
    const profile = await this.store.update(id, input)
    await this.emitProfiles()
    return this.resolveProfile(profile)
  }

  async reorderProfiles(ids: string[]) {
    await this.load()
    await this.store.reorder(ids)
    await this.emitProfiles()
    return (await this.resolveSnapshot()).profiles
  }

  async openProfile(id: string) {
    await this.load()
    const profile = await this.store.update(id, { open: true, suspended: false })
    await this.store.setActive(id)
    this.views.resume(whatsappTabId(id))
    await this.emitProfiles()
    return this.resolveProfile(profile)
  }

  async setOpen(id: string, open: boolean) {
    await this.load()
    const profile = await this.store.update(id, { open })
    if (open) await this.store.setActive(id)
    await this.emitProfiles()
    return this.resolveProfile(profile)
  }

  async suspendProfile(id: string) {
    await this.load()
    const profile = await this.store.update(id, { suspended: true })
    this.views.suspend(whatsappTabId(id))
    this.emitState({ profileId: id, loading: false, unreadCount: this.runtime.get(id)?.unreadCount ?? 0, connectionState: 'suspended' })
    await this.emitProfiles()
    return this.resolveProfile(profile)
  }

  async resumeProfile(id: string) {
    await this.load()
    const profile = await this.store.update(id, { suspended: false, open: true })
    this.views.resume(whatsappTabId(id))
    await this.store.setActive(id)
    await this.emitProfiles()
    return this.resolveProfile(profile)
  }

  async reloadProfile(id: string) {
    await this.load()
    this.store.get(id)
    this.views.reloadView(whatsappTabId(id))
  }

  async clearSession(id: string) {
    await this.load()
    const profile = this.store.get(id)
    await this.views.clearSessionData(whatsappTabId(id), profile.partition)
    this.emitState({ profileId: id, loading: true, unreadCount: 0, connectionState: 'loading' })
  }

  async removeProfile(id: string, clearSession: boolean) {
    await this.load()
    const profile = this.store.get(id)
    await performProfileRemoval(profile, clearSession, {
      destroyView: (tabId) => this.views.destroyView(tabId),
      clearPartition: async (partition) => {
        const isolatedSession = session.fromPartition(partition)
        await Promise.all([isolatedSession.clearStorageData(), isolatedSession.clearCache()])
      },
    })
    await this.store.remove(id)
    this.runtime.delete(id)
    await this.emitProfiles()
  }

  async selectIcon(profileId?: string): Promise<IconSelection> {
    await this.load()
    const result = await dialog.showOpenDialog(this.window, {
      title: 'Selecionar ícone do perfil',
      properties: ['openFile'],
      filters: [{ name: 'Imagens', extensions: ['png', 'jpg', 'jpeg', 'webp'] }],
    })
    if (result.canceled || !result.filePaths[0]) return { canceled: true }

    const sourcePath = result.filePaths[0]
    const metadata = await stat(sourcePath)
    const extension = validateIconFile(path.extname(sourcePath), metadata.size)
    const fileName = profileId ? `${profileId}${extension}` : `pending-${crypto.randomUUID()}${extension}`
    await copyFile(sourcePath, path.join(this.iconsDirectory, fileName))
    const iconUrl = await this.toDataUrl(fileName)

    if (!profileId) return { canceled: false, token: fileName, iconUrl }
    const profile = await this.store.update(profileId, { icon: fileName })
    await this.emitProfiles()
    return { canceled: false, iconUrl, profile: await this.resolveProfile(profile) }
  }

  handleViewState(update: WebViewStateUpdate) {
    if (!update.id.startsWith('whatsapp:')) return
    const profileId = update.id.slice('whatsapp:'.length)
    const previous = this.runtime.get(profileId)
    const loading = update.loading ?? previous?.loading ?? false
    const unreadCount = update.title === undefined ? (previous?.unreadCount ?? 0) : extractUnreadCount(update.title)
    const connectionState = update.error
      ? 'disconnected'
      : loading
        ? 'loading'
        : 'connected'
    this.emitState({ profileId, loading, unreadCount, connectionState })
  }

  private async attachPendingIcon(profile: WhatsAppProfile, token: string) {
    const safeToken = path.basename(token)
    if (!safeToken.startsWith('pending-')) throw new Error('Referência de ícone inválida.')
    const extension = path.extname(safeToken)
    const targetName = `${profile.id}${extension}`
    await rename(path.join(this.iconsDirectory, safeToken), path.join(this.iconsDirectory, targetName))
    await this.store.update(profile.id, { icon: targetName })
  }

  private async resolveSnapshot() {
    const snapshot = this.store.snapshot()
    return {
      activeProfileId: snapshot.activeProfileId,
      profiles: await Promise.all(snapshot.profiles.map((profile) => this.resolveProfile(profile))),
    }
  }

  private async resolveProfile(profile: WhatsAppProfile) {
    const managedFile = profile.icon && !profile.icon.startsWith('builtin:') && profile.icon !== 'initials'
    return { ...profile, iconUrl: managedFile ? await this.toDataUrl(profile.icon!) : undefined }
  }

  private async toDataUrl(fileName: string) {
    try {
      const extension = path.extname(fileName).toLowerCase()
      const mime = extension === '.png' ? 'image/png' : extension === '.webp' ? 'image/webp' : 'image/jpeg'
      return `data:${mime};base64,${(await readFile(path.join(this.iconsDirectory, path.basename(fileName)))).toString('base64')}`
    } catch {
      return undefined
    }
  }

  private async emitProfiles() {
    this.send(WHATSAPP_CHANNELS.profilesChanged, await this.resolveSnapshot())
  }

  private emitState(state: WhatsAppProfileState) {
    this.runtime.set(state.profileId, state)
    this.send(WHATSAPP_CHANNELS.stateChanged, state)
  }

  private send(channel: string, payload: unknown) {
    if (!this.window.isDestroyed() && !this.window.webContents.isDestroyed()) {
      this.window.webContents.send(channel, payload)
    }
  }
}

export function whatsappProfileDescriptor(profile: WhatsAppProfile) {
  return {
    id: whatsappTabId(profile.id),
    type: 'whatsapp' as const,
    title: profile.name,
    url: WHATSAPP_URL,
    partition: profile.partition,
    pinned: true,
    profileId: profile.id,
    suspended: profile.suspended,
  }
}
