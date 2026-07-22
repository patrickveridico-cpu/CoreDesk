export const WHATSAPP_URL = 'https://web.whatsapp.com/'
export const MAX_PROFILE_NAME_LENGTH = 48
export const MAX_PROFILE_ICON_BYTES = 2 * 1024 * 1024
export const ALLOWED_PROFILE_ICON_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp'])

export type WhatsAppConnectionState = 'loading' | 'login-required' | 'connected' | 'disconnected' | 'unknown' | 'suspended'

export interface WhatsAppProfile {
  id: string
  name: string
  partition: string
  icon?: string
  iconUrl?: string
  accentColor?: string
  order: number
  enabled: boolean
  open: boolean
  suspended: boolean
  notificationsEnabled: boolean
  createdAt: string
  updatedAt: string
}

export interface WhatsAppProfileState {
  profileId: string
  loading: boolean
  unreadCount: number
  connectionState: WhatsAppConnectionState
}

export interface CreateWhatsAppProfileInput {
  name: string
  accentColor?: string
  iconToken?: string
}

export interface UpdateWhatsAppProfileInput {
  name?: string
  accentColor?: string
  enabled?: boolean
  open?: boolean
  notificationsEnabled?: boolean
}

export interface WhatsAppProfilesSnapshot {
  profiles: WhatsAppProfile[]
  activeProfileId?: string
}

export interface IconSelection {
  canceled: boolean
  token?: string
  iconUrl?: string
  profile?: WhatsAppProfile
}

export function createProfileIdentity(uuid: string = crypto.randomUUID()) {
  const id = uuid.toLowerCase()
  return { id, partition: `persist:coredesk-whatsapp-${id}` }
}

export function normalizeProfileName(value: string) {
  return value.trim().replace(/\s+/g, ' ')
}

export function validateProfileName(value: string) {
  const normalized = normalizeProfileName(value)
  if (!normalized) throw new Error('O nome do perfil é obrigatório.')
  if (normalized.length > MAX_PROFILE_NAME_LENGTH) {
    throw new Error(`O nome deve ter no máximo ${MAX_PROFILE_NAME_LENGTH} caracteres.`)
  }
  return normalized
}

export function validateAccentColor(value?: string) {
  if (!value) return '#1cc8ee'
  if (!/^#[0-9a-f]{6}$/i.test(value)) throw new Error('Cor de identificação inválida.')
  return value.toLowerCase()
}

export function validateIconFile(extension: string, size: number) {
  const normalized = extension.toLowerCase()
  if (!ALLOWED_PROFILE_ICON_EXTENSIONS.has(normalized)) throw new Error('Use PNG, JPG, JPEG ou WEBP.')
  if (size <= 0 || size > MAX_PROFILE_ICON_BYTES) throw new Error('O ícone deve ter no máximo 2 MB.')
  return normalized
}

export function extractUnreadCount(title: string) {
  const match = title.match(/(?:^|\s)\((\d{1,6})\)(?:\s|$)/)
  if (!match) return 0
  const count = Number.parseInt(match[1], 10)
  return Number.isFinite(count) ? Math.max(0, count) : 0
}

export function formatUnreadCount(count: number) {
  return count > 99 ? '99+' : String(Math.max(0, count))
}

export function sortWhatsAppProfiles(profiles: WhatsAppProfile[]) {
  return [...profiles].sort((left, right) => left.order - right.order || left.createdAt.localeCompare(right.createdAt))
}

export function assertUniquePartitions(profiles: WhatsAppProfile[]) {
  const partitions = new Set<string>()
  for (const profile of profiles) {
    if (partitions.has(profile.partition)) throw new Error('Partition duplicada detectada.')
    partitions.add(profile.partition)
  }
}
