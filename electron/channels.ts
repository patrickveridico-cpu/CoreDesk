export const WINDOW_CHANNELS = {
  minimize: 'window:minimize',
  toggleMaximize: 'window:toggle-maximize',
  close: 'window:close',
  getMaximized: 'window:get-maximized',
  maximizedChanged: 'window:maximized-changed',
} as const

export const VIEW_CHANNELS = {
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

export const WHATSAPP_CHANNELS = {
  listProfiles: 'whatsapp:list-profiles',
  createProfile: 'whatsapp:create-profile',
  updateProfile: 'whatsapp:update-profile',
  removeProfile: 'whatsapp:remove-profile',
  reorderProfiles: 'whatsapp:reorder-profiles',
  openProfile: 'whatsapp:open-profile',
  setOpen: 'whatsapp:set-open',
  suspendProfile: 'whatsapp:suspend-profile',
  resumeProfile: 'whatsapp:resume-profile',
  reloadProfile: 'whatsapp:reload-profile',
  clearSession: 'whatsapp:clear-session',
  selectIcon: 'whatsapp:select-icon',
  profilesChanged: 'whatsapp:profiles-changed',
  stateChanged: 'whatsapp:state-changed',
} as const

export const CORE_CHANNELS = {
  getConfig: 'core:get-config',
  updateConfig: 'core:update-config',
  getCommands: 'core:get-commands',
  executeCommand: 'core:execute-command',
  configChanged: 'core:config-changed',
  commandRequested: 'core:command-requested',
} as const

export const OPERATIONS_CHANNELS = {
  diagnostics: 'operations:get-diagnostics',
  listPriceTableConflicts: 'operations:list-price-table-conflicts', resolvePriceTableConflict: 'operations:resolve-price-table-conflict',
  previewLegacyPriceTableCompanyMigration: 'operations:preview-legacy-company-migration', applyLegacyPriceTableCompanyMigration: 'operations:apply-legacy-company-migration',
  listOperationalCompanies: 'operations:list-operational-companies', getOperationalCompany: 'operations:get-operational-company', saveOperationalCompany: 'operations:save-operational-company', archiveOperationalCompany: 'operations:archive-operational-company', restoreOperationalCompany: 'operations:restore-operational-company',
  snapshot: 'operations:get-snapshot', saveBase: 'operations:save-base', saveInsurer: 'operations:save-insurer', saveSpecialty: 'operations:save-specialty', savePricingTable: 'operations:save-pricing-table', calculateRoute: 'operations:calculate-route', calculateQuote: 'operations:calculate-quote', saveQuote: 'operations:save-quote', deleteQuote: 'operations:delete-quote', previewImport: 'operations:preview-import', confirmImport: 'operations:confirm-import', listAudit: 'operations:list-audit', listBackups: 'operations:list-backups', createBackup: 'operations:create-backup', restoreBackup: 'operations:restore-backup', copyMessage: 'operations:copy-message', operationsChanged: 'operations:changed',
} as const
