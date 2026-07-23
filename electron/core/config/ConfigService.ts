import path from 'node:path'
import type { CoreConfig } from '../../../shared/core/contracts'
import type { EventBus } from '../events/EventBus'
import type { LoggerService } from '../logging/LoggerService'
import { StorageService } from '../storage/StorageService'

export const DEFAULT_CORE_CONFIG: CoreConfig = {
  schemaVersion: 1,
  theme: 'dark', accentColor: 'blue', motionEnabled: true, soundEnabled: false,
  language: 'pt-BR', startBehavior: 'restore', restoreWorkspace: true,
  startMinimized: false, confirmBeforeQuit: false, spellcheck: true, shortcuts: {},
  notificationsEnabled: false, manualSuspensionEnabled: true, lastVersion: '0.1.0',
}

export class ConfigService {
  private config = DEFAULT_CORE_CONFIG
  private readonly storage: StorageService

  constructor(
    userDataPath: string,
    private readonly events: EventBus,
    logger: LoggerService,
    storage?: StorageService,
  ) { this.storage = storage ?? new StorageService(logger.child('config')); this.filePath = path.join(userDataPath, 'core-config.json') }

  private readonly filePath: string

  async load() {
    this.config = await this.storage.read(this.filePath, DEFAULT_CORE_CONFIG, { schemaVersion: 1, validate: (value) => this.validate(value) })
    return this.get()
  }

  get(): CoreConfig { return { ...this.config, shortcuts: { ...this.config.shortcuts } } }

  async update(patch: Partial<CoreConfig>) {
    this.config = this.validate({ ...this.config, ...patch, schemaVersion: 1 })
    await this.storage.write(this.filePath, this.config, 1)
    this.events.emit('config:changed', {})
    return this.get()
  }

  private validate(value: unknown): CoreConfig {
    const source = value && typeof value === 'object' ? value as Partial<CoreConfig> : {}
    const theme = source.theme === 'light' || source.theme === 'system' ? source.theme : 'dark'
    const accentColor = ['blue', 'violet', 'green', 'orange', 'red', 'gold'].includes(source.accentColor ?? '') ? source.accentColor as CoreConfig['accentColor'] : 'blue'
    const language = source.language === 'en-US' ? 'en-US' : 'pt-BR'
    return {
      ...DEFAULT_CORE_CONFIG,
      ...source,
      theme,
      accentColor,
      motionEnabled: source.motionEnabled !== false,
      soundEnabled: source.soundEnabled === true,
      language,
      schemaVersion: 1,
      shortcuts: { ...(source.shortcuts ?? {}) },
    }
  }
}
