export interface CoreConfig {
  schemaVersion: number
  theme: 'dark' | 'light' | 'system'
  language: 'pt-BR' | 'en-US'
  startBehavior: 'restore' | 'home'
  restoreWorkspace: boolean
  startMinimized: boolean
  confirmBeforeQuit: boolean
  spellcheck: boolean
  shortcuts: Record<string, string>
  notificationsEnabled: boolean
  downloadsDirectory?: string
  manualSuspensionEnabled: boolean
  lastVersion: string
}

export interface CoreCommandInfo {
  id: string
  title: string
  category: string
  shortcut?: string
  enabled: boolean
}
