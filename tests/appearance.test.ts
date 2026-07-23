import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { ConfigService, DEFAULT_CORE_CONFIG } from '../electron/core/config/ConfigService'
import { EventBus } from '../electron/core/events/EventBus'
import { LoggerService } from '../electron/core/logging/LoggerService'
import { StorageService } from '../electron/core/storage/StorageService'
import {
  appearanceFromConfig,
  applyAppearanceAttributes,
  resolveTheme,
  shouldReduceMotion,
} from '../src/store/useAppearanceStore'

const directories: string[] = []

afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })))
})

describe('CoreDesk Design System Foundation', () => {
  it('resolve o tema Sistema de acordo com a preferência do sistema operacional', () => {
    expect(resolveTheme('system', true)).toBe('dark')
    expect(resolveTheme('system', false)).toBe('light')
    expect(resolveTheme('dark', false)).toBe('dark')
    expect(resolveTheme('light', true)).toBe('light')
  })

  it('combina a preferência de movimento com prefers-reduced-motion', () => {
    expect(shouldReduceMotion(true, false)).toBe(false)
    expect(shouldReduceMotion(false, false)).toBe(true)
    expect(shouldReduceMotion(true, true)).toBe(true)
  })

  it('mantém sons desativados por padrão', () => {
    expect(DEFAULT_CORE_CONFIG.soundEnabled).toBe(false)
  })

  it('aplica tema, destaque e redução de movimento como atributos globais', () => {
    const root = { dataset: {}, style: {} } as unknown as HTMLElement
    const preferences = appearanceFromConfig(
      { theme: 'system', accentColor: 'violet', motionEnabled: true, soundEnabled: false },
      false,
      true,
    )
    applyAppearanceAttributes(preferences, root)
    expect(root.dataset).toMatchObject({
      theme: 'light',
      accent: 'violet',
      motion: 'reduced',
      sound: 'disabled',
    })
    expect(root.style.colorScheme).toBe('light')
  })

  it('persiste e restaura todas as preferências pelo ConfigService existente', async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'coredesk-appearance-'))
    directories.push(directory)
    const events = new EventBus()
    const logger = new LoggerService(directory, 'appearance-test', false)
    const storage = new StorageService(logger)
    const service = new ConfigService(directory, events, logger, storage)
    await service.load()
    await service.update({
      theme: 'system',
      accentColor: 'gold',
      motionEnabled: false,
      soundEnabled: true,
    })

    const restoredService = new ConfigService(directory, events, logger, storage)
    const restored = await restoredService.load()
    expect(restored).toMatchObject({
      theme: 'system',
      accentColor: 'gold',
      motionEnabled: false,
      soundEnabled: true,
    })
    expect(appearanceFromConfig(restored, true, false)).toMatchObject({
      themeMode: 'system',
      resolvedTheme: 'dark',
      accentColor: 'gold',
      motionEnabled: false,
      soundEnabled: true,
    })
  })
})
