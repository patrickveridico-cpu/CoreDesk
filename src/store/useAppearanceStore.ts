import { create } from 'zustand'
import type { CoreConfig } from '../../shared/core/contracts'

export type ThemeMode = CoreConfig['theme']
export type ResolvedTheme = 'light' | 'dark'
export type AccentColor = CoreConfig['accentColor']

export interface AppearancePreferences {
  themeMode: ThemeMode
  resolvedTheme: ResolvedTheme
  accentColor: AccentColor
  motionEnabled: boolean
  soundEnabled: boolean
  systemReducedMotion: boolean
}

interface AppearanceState extends AppearancePreferences {
  initialized: boolean
  setThemeMode: (themeMode: ThemeMode) => Promise<void>
  setAccentColor: (accentColor: AccentColor) => Promise<void>
  setMotionEnabled: (motionEnabled: boolean) => Promise<void>
  setSoundEnabled: (soundEnabled: boolean) => Promise<void>
}

export const DEFAULT_APPEARANCE: AppearancePreferences = {
  themeMode: 'dark',
  resolvedTheme: 'dark',
  accentColor: 'blue',
  motionEnabled: true,
  soundEnabled: false,
  systemReducedMotion: false,
}

export function resolveTheme(themeMode: ThemeMode, systemPrefersDark: boolean): ResolvedTheme {
  return themeMode === 'system' ? (systemPrefersDark ? 'dark' : 'light') : themeMode
}

export function shouldReduceMotion(motionEnabled: boolean, systemReducedMotion: boolean) {
  return !motionEnabled || systemReducedMotion
}

export function appearanceFromConfig(
  config: Pick<CoreConfig, 'theme' | 'accentColor' | 'motionEnabled' | 'soundEnabled'>,
  systemPrefersDark: boolean,
  systemReducedMotion: boolean,
): AppearancePreferences {
  return {
    themeMode: config.theme,
    resolvedTheme: resolveTheme(config.theme, systemPrefersDark),
    accentColor: config.accentColor,
    motionEnabled: config.motionEnabled,
    soundEnabled: config.soundEnabled,
    systemReducedMotion,
  }
}

export function applyAppearanceAttributes(preferences: AppearancePreferences, root?: HTMLElement) {
  const target = root ?? (typeof document === 'undefined' ? undefined : document.documentElement)
  if (!target) return
  target.dataset.theme = preferences.resolvedTheme
  target.dataset.accent = preferences.accentColor
  target.dataset.motion = shouldReduceMotion(preferences.motionEnabled, preferences.systemReducedMotion) ? 'reduced' : 'full'
  target.dataset.sound = preferences.soundEnabled ? 'enabled' : 'disabled'
  target.style.colorScheme = preferences.resolvedTheme
}

function currentSystemPreferences() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return { dark: true, reducedMotion: false }
  return {
    dark: window.matchMedia('(prefers-color-scheme: dark)').matches,
    reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  }
}

function applyCurrentState() {
  const state = useAppearanceStore.getState()
  applyAppearanceAttributes(state)
}

async function persistAppearance(patch: Partial<Pick<CoreConfig, 'theme' | 'accentColor' | 'motionEnabled' | 'soundEnabled'>>) {
  try {
    await window.coreDesk?.core.updateConfig(patch)
  } catch (error) {
    console.error('[CoreDesk Appearance] Não foi possível persistir a preferência.', error)
  }
}

export const useAppearanceStore = create<AppearanceState>((set) => ({
  ...DEFAULT_APPEARANCE,
  initialized: false,
  setThemeMode: async (themeMode) => {
    const system = currentSystemPreferences()
    set({ themeMode, resolvedTheme: resolveTheme(themeMode, system.dark) })
    applyCurrentState()
    await persistAppearance({ theme: themeMode })
  },
  setAccentColor: async (accentColor) => {
    set({ accentColor })
    applyCurrentState()
    await persistAppearance({ accentColor })
  },
  setMotionEnabled: async (motionEnabled) => {
    set({ motionEnabled })
    applyCurrentState()
    await persistAppearance({ motionEnabled })
  },
  setSoundEnabled: async (soundEnabled) => {
    set({ soundEnabled })
    applyCurrentState()
    await persistAppearance({ soundEnabled })
  },
}))

let initializePromise: Promise<void> | undefined

export function initializeAppearanceStore() {
  initializePromise ??= initializeAppearance()
  return initializePromise
}

async function initializeAppearance() {
  const system = currentSystemPreferences()
  try {
    const config = await window.coreDesk?.core.getConfig()
    const preferences = config
      ? appearanceFromConfig(config, system.dark, system.reducedMotion)
      : { ...DEFAULT_APPEARANCE, resolvedTheme: resolveTheme(DEFAULT_APPEARANCE.themeMode, system.dark), systemReducedMotion: system.reducedMotion }
    useAppearanceStore.setState({ ...preferences, initialized: true })
  } catch (error) {
    console.error('[CoreDesk Appearance] Falha ao restaurar preferências; usando padrões seguros.', error)
    useAppearanceStore.setState({ ...DEFAULT_APPEARANCE, systemReducedMotion: system.reducedMotion, initialized: true })
  }
  applyCurrentState()

  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
  const colorScheme = window.matchMedia('(prefers-color-scheme: dark)')
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
  const updateSystemPreferences = () => {
    const state = useAppearanceStore.getState()
    useAppearanceStore.setState({
      resolvedTheme: resolveTheme(state.themeMode, colorScheme.matches),
      systemReducedMotion: reducedMotion.matches,
    })
    applyCurrentState()
  }
  colorScheme.addEventListener('change', updateSystemPreferences)
  reducedMotion.addEventListener('change', updateSystemPreferences)
  window.coreDesk?.core.onConfigChanged((config) => {
    const preferences = appearanceFromConfig(config, colorScheme.matches, reducedMotion.matches)
    useAppearanceStore.setState({ ...preferences, initialized: true })
    applyCurrentState()
  })
}
