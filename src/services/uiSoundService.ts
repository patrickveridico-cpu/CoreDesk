import { useAppearanceStore } from '../store/useAppearanceStore'

export type UISoundEvent = 'ui-click' | 'ui-success' | 'ui-error' | 'ui-notification'

class UISoundService {
  private readonly sources = new Map<UISoundEvent, string>()

  register(event: UISoundEvent, source: string) {
    if (source.trim()) this.sources.set(event, source)
  }

  unregister(event: UISoundEvent) {
    this.sources.delete(event)
  }

  async play(event: UISoundEvent) {
    if (!useAppearanceStore.getState().soundEnabled) return
    const source = this.sources.get(event)
    if (!source || typeof Audio === 'undefined') return
    try {
      const audio = new Audio(source)
      audio.preload = 'auto'
      await audio.play()
    } catch {
      // UI audio is optional and must never interrupt the operator workflow.
    }
  }
}

export const uiSoundService = new UISoundService()
