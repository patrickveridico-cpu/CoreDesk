import { contextBridge, ipcRenderer } from 'electron'
import type {
  CoreDeskApi,
  NewTabRequest,
  ShortcutCommand,
  WebTabDescriptor,
  WebViewStateUpdate,
  BudgetMapsRoutePayload,
} from '../shared/contracts'
import type { DownloadStatus } from '../shared/downloads'
import type { CreateWhatsAppProfileInput, UpdateWhatsAppProfileInput, WhatsAppProfilesSnapshot, WhatsAppProfileState } from '../shared/whatsapp'
import type { CoreCommandInfo, CoreConfig } from '../shared/core/contracts'
import type { OperationsApi } from '../shared/operations/contracts'

// Sandboxed preloads can only require a small set of Electron/Node modules.
// Keep this channel map self-contained instead of importing a local module.
const WINDOW_CHANNELS = {
  minimize: 'window:minimize',
  toggleMaximize: 'window:toggle-maximize',
  close: 'window:close',
  getMaximized: 'window:get-maximized',
  maximizedChanged: 'window:maximized-changed',
} as const

const VIEW_CHANNELS = {
  setEmbedded: 'views:set-embedded',
  sync: 'views:sync',
  navigate: 'views:navigate',
  back: 'views:back',
  forward: 'views:forward',
  reload: 'views:reload',
  stop: 'views:stop',
  retry: 'views:retry',
  stateChanged: 'views:state-changed',
  newTabRequested: 'views:new-tab-requested',
  shortcut: 'views:shortcut',
} as const
const BUDGET_MAPS_CHANNELS = { routeUpdated: 'budget-maps:route-updated' } as const
const DOWNLOAD_CHANNELS = { statusChanged: 'downloads:status-changed' } as const
const CORECHAT_CHANNELS = { getCompact: 'corechat:get-compact', setCompact: 'corechat:set-compact' } as const
const ZOOM_CHANNELS = { get: 'zoom:get', set: 'zoom:set', changed: 'zoom:changed' } as const

const WHATSAPP_CHANNELS = {
  listProfiles: 'whatsapp:list-profiles', createProfile: 'whatsapp:create-profile',
  updateProfile: 'whatsapp:update-profile', removeProfile: 'whatsapp:remove-profile',
  reorderProfiles: 'whatsapp:reorder-profiles', openProfile: 'whatsapp:open-profile',
  setOpen: 'whatsapp:set-open', suspendProfile: 'whatsapp:suspend-profile',
  resumeProfile: 'whatsapp:resume-profile', reloadProfile: 'whatsapp:reload-profile',
  clearSession: 'whatsapp:clear-session', selectIcon: 'whatsapp:select-icon',
  profilesChanged: 'whatsapp:profiles-changed', stateChanged: 'whatsapp:state-changed',
} as const

const CORE_CHANNELS = {
  getConfig: 'core:get-config', updateConfig: 'core:update-config', getCommands: 'core:get-commands',
  executeCommand: 'core:execute-command', configChanged: 'core:config-changed', commandRequested: 'core:command-requested',
} as const
const OPERATIONS_CHANNELS = { snapshot: 'operations:get-snapshot', saveBase: 'operations:save-base', saveInsurer: 'operations:save-insurer', saveSpecialty: 'operations:save-specialty', savePricingTable: 'operations:save-pricing-table', calculateRoute: 'operations:calculate-route', calculateQuote: 'operations:calculate-quote', saveQuote: 'operations:save-quote', deleteQuote: 'operations:delete-quote', previewImport: 'operations:preview-import', confirmImport: 'operations:confirm-import', listAudit: 'operations:list-audit', listBackups: 'operations:list-backups', createBackup: 'operations:create-backup', restoreBackup: 'operations:restore-backup', copyMessage: 'operations:copy-message', operationsChanged: 'operations:changed' } as const

const OPERATIONAL_COMPANY_CHANNELS = { list: 'operations:list-operational-companies', get: 'operations:get-operational-company', save: 'operations:save-operational-company', archive: 'operations:archive-operational-company', restore: 'operations:restore-operational-company' } as const
const MIGRATION_CHANNELS = { preview: 'operations:preview-legacy-company-migration', apply: 'operations:apply-legacy-company-migration' } as const
const CONFLICT_CHANNELS = { list: 'operations:list-price-table-conflicts', resolve: 'operations:resolve-price-table-conflict' } as const
const DIAGNOSTICS_CHANNEL = 'operations:get-diagnostics'

const api = {
  window: {
    minimize: () => ipcRenderer.send(WINDOW_CHANNELS.minimize),
    toggleMaximize: () => ipcRenderer.send(WINDOW_CHANNELS.toggleMaximize),
    close: () => ipcRenderer.send(WINDOW_CHANNELS.close),
    isMaximized: () => ipcRenderer.invoke(WINDOW_CHANNELS.getMaximized) as Promise<boolean>,
    onMaximizedChange: (callback: (maximized: boolean) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, maximized: boolean) => callback(maximized)
      ipcRenderer.on(WINDOW_CHANNELS.maximizedChanged, listener)
      return () => ipcRenderer.removeListener(WINDOW_CHANNELS.maximizedChanged, listener)
    },
  },
  views: {
    sync: (tabs: WebTabDescriptor[], activeTabId: string) => ipcRenderer.send(VIEW_CHANNELS.sync, tabs, activeTabId),
    setEmbedded: (
      id: string,
      bounds: { x: number; y: number; width: number; height: number } | null,
      options?: { visible?: boolean },
    ) => ipcRenderer.send(VIEW_CHANNELS.setEmbedded, id, bounds, options),
    navigate: (id: string, url: string) => ipcRenderer.send(VIEW_CHANNELS.navigate, id, url),
    back: (id: string) => ipcRenderer.send(VIEW_CHANNELS.back, id),
    forward: (id: string) => ipcRenderer.send(VIEW_CHANNELS.forward, id),
    reload: (id: string) => ipcRenderer.send(VIEW_CHANNELS.reload, id),
    stop: (id: string) => ipcRenderer.send(VIEW_CHANNELS.stop, id),
    retry: (id: string) => ipcRenderer.send(VIEW_CHANNELS.retry, id),
    onStateChange: (callback: (update: WebViewStateUpdate) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, update: WebViewStateUpdate) => callback(update)
      ipcRenderer.on(VIEW_CHANNELS.stateChanged, listener)
      return () => ipcRenderer.removeListener(VIEW_CHANNELS.stateChanged, listener)
    },
    onNewTabRequest: (callback: (request: NewTabRequest) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, request: NewTabRequest) => callback(request)
      ipcRenderer.on(VIEW_CHANNELS.newTabRequested, listener)
      return () => ipcRenderer.removeListener(VIEW_CHANNELS.newTabRequested, listener)
    },
    onShortcut: (callback: (command: ShortcutCommand) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, command: ShortcutCommand) => callback(command)
      ipcRenderer.on(VIEW_CHANNELS.shortcut, listener)
      return () => ipcRenderer.removeListener(VIEW_CHANNELS.shortcut, listener)
    },
  },
  budgetMaps: {
    onRouteUpdated: (callback: (payload: BudgetMapsRoutePayload) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, payload: BudgetMapsRoutePayload) => callback(payload)
      ipcRenderer.on(BUDGET_MAPS_CHANNELS.routeUpdated, listener)
      return () => ipcRenderer.removeListener(BUDGET_MAPS_CHANNELS.routeUpdated, listener)
    },
  },
  downloads: {
    onStatusChanged: (callback: (status: DownloadStatus) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, status: DownloadStatus) => callback(status)
      ipcRenderer.on(DOWNLOAD_CHANNELS.statusChanged, listener)
      return () => ipcRenderer.removeListener(DOWNLOAD_CHANNELS.statusChanged, listener)
    },
  },
  coreChat: {
    getCompact: () => ipcRenderer.invoke(CORECHAT_CHANNELS.getCompact) as Promise<boolean>,
    setCompact: (enabled: boolean) => ipcRenderer.invoke(CORECHAT_CHANNELS.setCompact, enabled),
  },
  zoom: {
    get: () => ipcRenderer.invoke(ZOOM_CHANNELS.get) as Promise<number>,
    set: (factor: number) => ipcRenderer.invoke(ZOOM_CHANNELS.set, factor) as Promise<number>,
    onChanged: (callback: (factor: number) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, factor: number) => callback(factor)
      ipcRenderer.on(ZOOM_CHANNELS.changed, listener)
      return () => ipcRenderer.removeListener(ZOOM_CHANNELS.changed, listener)
    },
  },
  whatsapp: {
    listProfiles: () => ipcRenderer.invoke(WHATSAPP_CHANNELS.listProfiles),
    createProfile: (input: CreateWhatsAppProfileInput) => ipcRenderer.invoke(WHATSAPP_CHANNELS.createProfile, input),
    updateProfile: (id: string, input: UpdateWhatsAppProfileInput) => ipcRenderer.invoke(WHATSAPP_CHANNELS.updateProfile, id, input),
    removeProfile: (id: string, clearSession: boolean) => ipcRenderer.invoke(WHATSAPP_CHANNELS.removeProfile, id, clearSession),
    reorderProfiles: (ids: string[]) => ipcRenderer.invoke(WHATSAPP_CHANNELS.reorderProfiles, ids),
    openProfile: (id: string) => ipcRenderer.invoke(WHATSAPP_CHANNELS.openProfile, id),
    setOpen: (id: string, open: boolean) => ipcRenderer.invoke(WHATSAPP_CHANNELS.setOpen, id, open),
    suspendProfile: (id: string) => ipcRenderer.invoke(WHATSAPP_CHANNELS.suspendProfile, id),
    resumeProfile: (id: string) => ipcRenderer.invoke(WHATSAPP_CHANNELS.resumeProfile, id),
    reloadProfile: (id: string) => ipcRenderer.invoke(WHATSAPP_CHANNELS.reloadProfile, id),
    clearSession: (id: string) => ipcRenderer.invoke(WHATSAPP_CHANNELS.clearSession, id),
    selectIcon: (profileId?: string) => ipcRenderer.invoke(WHATSAPP_CHANNELS.selectIcon, profileId),
    onProfilesChanged: (callback: (snapshot: WhatsAppProfilesSnapshot) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, snapshot: WhatsAppProfilesSnapshot) => callback(snapshot)
      ipcRenderer.on(WHATSAPP_CHANNELS.profilesChanged, listener)
      return () => ipcRenderer.removeListener(WHATSAPP_CHANNELS.profilesChanged, listener)
    },
    onStateChanged: (callback: (state: WhatsAppProfileState) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, state: WhatsAppProfileState) => callback(state)
      ipcRenderer.on(WHATSAPP_CHANNELS.stateChanged, listener)
      return () => ipcRenderer.removeListener(WHATSAPP_CHANNELS.stateChanged, listener)
    },
  },
  core: {
    getConfig: () => ipcRenderer.invoke(CORE_CHANNELS.getConfig) as Promise<CoreConfig>,
    updateConfig: (patch: Partial<CoreConfig>) => ipcRenderer.invoke(CORE_CHANNELS.updateConfig, patch) as Promise<CoreConfig>,
    getCommands: () => ipcRenderer.invoke(CORE_CHANNELS.getCommands) as Promise<CoreCommandInfo[]>,
    executeCommand: (id: string) => ipcRenderer.invoke(CORE_CHANNELS.executeCommand, id) as Promise<void>,
    onConfigChanged: (callback: (config: CoreConfig) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, config: CoreConfig) => callback(config)
      ipcRenderer.on(CORE_CHANNELS.configChanged, listener)
      return () => ipcRenderer.removeListener(CORE_CHANNELS.configChanged, listener)
    },
    onCommandRequested: (callback: (id: string) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, id: string) => callback(id)
      ipcRenderer.on(CORE_CHANNELS.commandRequested, listener)
      return () => ipcRenderer.removeListener(CORE_CHANNELS.commandRequested, listener)
    },
  },
  operations: {
    getDiagnostics: () => ipcRenderer.invoke(DIAGNOSTICS_CHANNEL),
    listPriceTableConflicts: () => ipcRenderer.invoke(CONFLICT_CHANNELS.list),
    resolvePriceTableConflict: (conflictId: string, keepId: string) => ipcRenderer.invoke(CONFLICT_CHANNELS.resolve, conflictId, keepId),
    previewLegacyPriceTableCompanyMigration: () => ipcRenderer.invoke(MIGRATION_CHANNELS.preview),
    applyLegacyPriceTableCompanyMigration: () => ipcRenderer.invoke(MIGRATION_CHANNELS.apply),
    getSnapshot: () => ipcRenderer.invoke(OPERATIONS_CHANNELS.snapshot),
    listOperationalCompanies: (status?: Parameters<OperationsApi['listOperationalCompanies']>[0]) => ipcRenderer.invoke(OPERATIONAL_COMPANY_CHANNELS.list, status),
    getOperationalCompany: (id: string) => ipcRenderer.invoke(OPERATIONAL_COMPANY_CHANNELS.get, id),
    saveOperationalCompany: (input: Parameters<OperationsApi['saveOperationalCompany']>[0]) => ipcRenderer.invoke(OPERATIONAL_COMPANY_CHANNELS.save, input),
    archiveOperationalCompany: (id: string) => ipcRenderer.invoke(OPERATIONAL_COMPANY_CHANNELS.archive, id),
    restoreOperationalCompany: (id: string) => ipcRenderer.invoke(OPERATIONAL_COMPANY_CHANNELS.restore, id),
    saveBase: (input: Parameters<OperationsApi['saveBase']>[0]) => ipcRenderer.invoke(OPERATIONS_CHANNELS.saveBase, input),
    saveInsurer: (input: Parameters<OperationsApi['saveInsurer']>[0]) => ipcRenderer.invoke(OPERATIONS_CHANNELS.saveInsurer, input),
    saveSpecialty: (input: Parameters<OperationsApi['saveSpecialty']>[0]) => ipcRenderer.invoke(OPERATIONS_CHANNELS.saveSpecialty, input),
    savePricingTable: (input: Parameters<OperationsApi['savePricingTable']>[0]) => ipcRenderer.invoke(OPERATIONS_CHANNELS.savePricingTable, input),
    calculateRoute: (input: Parameters<OperationsApi['calculateRoute']>[0]) => ipcRenderer.invoke(OPERATIONS_CHANNELS.calculateRoute, input),
    calculateQuote: (input: Parameters<OperationsApi['calculateQuote']>[0]) => ipcRenderer.invoke(OPERATIONS_CHANNELS.calculateQuote, input),
    saveQuote: (quote: Parameters<OperationsApi['saveQuote']>[0]) => ipcRenderer.invoke(OPERATIONS_CHANNELS.saveQuote, quote),
    deleteQuote: (id: string) => ipcRenderer.invoke(OPERATIONS_CHANNELS.deleteQuote, id),
    previewImport: (sourcePath?: string) => ipcRenderer.invoke(OPERATIONS_CHANNELS.previewImport, sourcePath),
    confirmImport: (sourcePath?: string) => ipcRenderer.invoke(OPERATIONS_CHANNELS.confirmImport, sourcePath),
    listAudit: () => ipcRenderer.invoke(OPERATIONS_CHANNELS.listAudit), listBackups: () => ipcRenderer.invoke(OPERATIONS_CHANNELS.listBackups), createBackup: () => ipcRenderer.invoke(OPERATIONS_CHANNELS.createBackup), restoreBackup: (name: string) => ipcRenderer.invoke(OPERATIONS_CHANNELS.restoreBackup, name),
  } satisfies OperationsApi,
} satisfies CoreDeskApi

contextBridge.exposeInMainWorld('coreDesk', api)
