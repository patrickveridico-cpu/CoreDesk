import type {
  CreateWhatsAppProfileInput,
  IconSelection,
  UpdateWhatsAppProfileInput,
  WhatsAppConnectionState,
  WhatsAppProfile,
  WhatsAppProfilesSnapshot,
  WhatsAppProfileState,
} from './whatsapp'
import type { CoreCommandInfo, CoreConfig } from './core/contracts'
import type { OperationsApi } from './operations/contracts'
import type { CoreChatCompactResult } from './corechat'
import type { DownloadStatus } from './downloads'

export type TabType = 'internal' | 'web' | 'whatsapp'

export interface WebLoadError {
  code: number
  description: string
  url: string
}

export interface WorkspaceTab {
  id: string
  type: TabType
  title: string
  url?: string
  icon?: string
  partition?: string
  closable: boolean
  pinned: boolean
  loading: boolean
  canGoBack: boolean
  canGoForward: boolean
  error?: WebLoadError
  profileId?: string
  fixedTitle?: string
  accentColor?: string
  unreadCount?: number
  connectionState?: WhatsAppConnectionState
  coreChatCompact?: CoreChatCompactResult
}

export interface WebTabDescriptor {
  id: string
  title: string
  url: string
  partition: string
  pinned: boolean
  type: 'web' | 'whatsapp'
  profileId?: string
  suspended?: boolean
}

export interface WebViewStateUpdate {
  id: string
  url?: string
  title?: string
  icon?: string
  loading?: boolean
  canGoBack?: boolean
  canGoForward?: boolean
  error?: WebLoadError | null
  coreChatCompact?: CoreChatCompactResult
}

export interface BudgetMapsRoutePayload {
  distanceKm: number | null
  distanceText: string | null
  durationText: string | null
  durationMinutes: number | null
  routeText: string | null
  origin?: string | null
  destination?: string | null
  hasTolls: boolean | null
  confidence: 'high' | 'medium' | 'low'
  score: number
  routeVisible: boolean
  source: 'google-maps-dom'
  capturedAt: string
}

export interface NewTabRequest {
  url: string
  partition: string
}

export type ShortcutCommand =
  | { type: 'select-index'; index: number }
  | { type: 'select-next' }
  | { type: 'select-previous' }
  | { type: 'focus-address' }
  | { type: 'reload' }
  | { type: 'close-tab' }
  | { type: 'new-tab' }
  | { type: 'restore-tab' }
  | { type: 'back' }
  | { type: 'forward' }
  | { type: 'stop' }
  | { type: 'open-whatsapp-switcher' }
  | { type: 'select-whatsapp-profile'; index: number }
  | { type: 'toggle-last-whatsapp-profile' }

export interface CoreDeskApi {
  window: {
    minimize: () => void
    toggleMaximize: () => void
    close: () => void
    isMaximized: () => Promise<boolean>
    onMaximizedChange: (callback: (maximized: boolean) => void) => () => void
  }
  views: {
    sync: (tabs: WebTabDescriptor[], activeTabId: string) => void
    setEmbedded: (
      id: string,
      bounds: { x: number; y: number; width: number; height: number } | null,
      options?: { visible?: boolean },
    ) => void
    navigate: (id: string, url: string) => void
    back: (id: string) => void
    forward: (id: string) => void
    reload: (id: string) => void
    stop: (id: string) => void
    retry: (id: string) => void
    onStateChange: (callback: (update: WebViewStateUpdate) => void) => () => void
    onNewTabRequest: (callback: (request: NewTabRequest) => void) => () => void
    onShortcut: (callback: (command: ShortcutCommand) => void) => () => void
  }
  coreChat: {
    getCompact: () => Promise<boolean>
    setCompact: (enabled: boolean) => Promise<CoreChatCompactResult>
  }
  budgetMaps: {
    onRouteUpdated: (callback: (payload: BudgetMapsRoutePayload) => void) => () => void
  }
  downloads: {
    onStatusChanged: (callback: (status: DownloadStatus) => void) => () => void
  }
  zoom: {
    get: () => Promise<number>
    set: (factor: number) => Promise<number>
    onChanged: (callback: (factor: number) => void) => () => void
  }
  core: {
    getConfig: () => Promise<CoreConfig>
    updateConfig: (patch: Partial<CoreConfig>) => Promise<CoreConfig>
    getCommands: () => Promise<CoreCommandInfo[]>
    executeCommand: (id: string) => Promise<void>
    onConfigChanged: (callback: (config: CoreConfig) => void) => () => void
    onCommandRequested: (callback: (id: string) => void) => () => void
  }
  operations: OperationsApi
  whatsapp: {
    listProfiles: () => Promise<WhatsAppProfilesSnapshot>
    createProfile: (input: CreateWhatsAppProfileInput) => Promise<WhatsAppProfile>
    updateProfile: (id: string, input: UpdateWhatsAppProfileInput) => Promise<WhatsAppProfile>
    removeProfile: (id: string, clearSession: boolean) => Promise<void>
    reorderProfiles: (ids: string[]) => Promise<WhatsAppProfile[]>
    openProfile: (id: string) => Promise<WhatsAppProfile>
    setOpen: (id: string, open: boolean) => Promise<WhatsAppProfile>
    suspendProfile: (id: string) => Promise<WhatsAppProfile>
    resumeProfile: (id: string) => Promise<WhatsAppProfile>
    reloadProfile: (id: string) => Promise<void>
    clearSession: (id: string) => Promise<void>
    selectIcon: (profileId?: string) => Promise<IconSelection>
    onProfilesChanged: (callback: (snapshot: WhatsAppProfilesSnapshot) => void) => () => void
    onStateChanged: (callback: (state: WhatsAppProfileState) => void) => () => void
  }
}
