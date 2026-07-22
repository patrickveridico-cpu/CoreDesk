import path from 'node:path'
import type { CreateWhatsAppProfileInput, UpdateWhatsAppProfileInput, WhatsAppProfile, WhatsAppProfilesSnapshot } from '../../shared/whatsapp'
import {
  assertUniquePartitions,
  createProfileIdentity,
  normalizeProfileName,
  sortWhatsAppProfiles,
  validateAccentColor,
  validateProfileName,
} from '../../shared/whatsapp'
import { StorageService } from '../core/storage/StorageService'

interface StoredProfilesFile extends WhatsAppProfilesSnapshot {
  version: 1
}

export class WhatsAppProfileStore {
  private state: StoredProfilesFile = { version: 1, profiles: [] }

  constructor(
    private readonly filePath: string,
    private readonly idFactory: () => string = () => crypto.randomUUID(),
    private readonly storage: StorageService = new StorageService(),
  ) {}

  async load() {
    const fallback: StoredProfilesFile = { version: 1, profiles: [] }
    const parsed = await this.storage.readRaw(this.filePath, fallback, (value) => {
      const source = value as Partial<StoredProfilesFile>
      const profiles = sortWhatsAppProfiles(Array.isArray(source.profiles) ? source.profiles : [])
      assertUniquePartitions(profiles)
      return { version: 1 as const, profiles, activeProfileId: source.activeProfileId }
    })
    this.state = parsed
    return this.snapshot()
  }

  snapshot(): WhatsAppProfilesSnapshot {
    return {
      profiles: this.state.profiles.map((profile) => ({ ...profile })),
      activeProfileId: this.state.activeProfileId,
    }
  }

  get(id: string) {
    const profile = this.state.profiles.find((item) => item.id === id)
    if (!profile) throw new Error('Perfil não encontrado.')
    return profile
  }

  async create(input: CreateWhatsAppProfileInput) {
    const name = validateProfileName(input.name)
    let identity = createProfileIdentity(this.idFactory())
    while (this.state.profiles.some((profile) => profile.id === identity.id || profile.partition === identity.partition)) {
      identity = createProfileIdentity(this.idFactory())
    }
    const now = new Date().toISOString()
    const profile: WhatsAppProfile = {
      ...identity,
      name,
      accentColor: validateAccentColor(input.accentColor),
      icon: input.iconToken,
      order: this.state.profiles.length,
      enabled: true,
      open: true,
      suspended: false,
      notificationsEnabled: false,
      createdAt: now,
      updatedAt: now,
    }
    this.state.profiles.push(profile)
    this.state.activeProfileId = profile.id
    await this.save()
    return { ...profile }
  }

  async update(id: string, input: UpdateWhatsAppProfileInput & { icon?: string; suspended?: boolean }) {
    const current = this.get(id)
    if (input.name !== undefined) current.name = validateProfileName(input.name)
    if (input.accentColor !== undefined) current.accentColor = validateAccentColor(input.accentColor)
    if (input.enabled !== undefined) current.enabled = input.enabled
    if (input.open !== undefined) current.open = input.open
    if (input.notificationsEnabled !== undefined) current.notificationsEnabled = input.notificationsEnabled
    if (input.suspended !== undefined) current.suspended = input.suspended
    if (input.icon !== undefined) current.icon = input.icon
    current.updatedAt = new Date().toISOString()
    await this.save()
    return { ...current }
  }

  async reorder(ids: string[]) {
    const known = new Set(this.state.profiles.map((profile) => profile.id))
    if (ids.length !== known.size || ids.some((id) => !known.has(id)) || new Set(ids).size !== ids.length) {
      throw new Error('Ordem de perfis inválida.')
    }
    const rank = new Map(ids.map((id, index) => [id, index]))
    this.state.profiles.forEach((profile) => { profile.order = rank.get(profile.id)! })
    this.state.profiles = sortWhatsAppProfiles(this.state.profiles)
    await this.save()
    return this.snapshot().profiles
  }

  async setActive(id?: string) {
    if (id) this.get(id)
    this.state.activeProfileId = id
    await this.save()
  }

  async remove(id: string) {
    this.get(id)
    this.state.profiles = this.state.profiles.filter((profile) => profile.id !== id)
    this.state.profiles.forEach((profile, index) => { profile.order = index })
    if (this.state.activeProfileId === id) this.state.activeProfileId = undefined
    await this.save()
  }

  private async save() {
    await this.storage.writeRaw(this.filePath, this.state)
  }
}

export function sanitizeStoredIconReference(value?: string) {
  if (!value) return undefined
  const normalized = path.basename(value)
  return normalizeProfileName(normalized) ? normalized : undefined
}
