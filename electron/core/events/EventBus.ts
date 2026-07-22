export type CoreEvents = {
  'app:ready': undefined
  'app:before-quit': undefined
  'window:created': Electron.BrowserWindow
  'window:resized': { width: number; height: number }
  'workspace:active-changed': string
  'webview:created': { id: string; type: string }
  'webview:destroyed': { id: string }
  'webview:state-changed': { id: string; state: unknown }
  'whatsapp:profile-created': { id: string }
  'whatsapp:profile-updated': { id: string }
  'whatsapp:profile-removed': { id: string }
  'whatsapp:profile-selected': { id: string }
  'whatsapp:profile-state-changed': { id: string; state: unknown }
  'config:changed': { key?: string }
  'command:executed': { id: string }
  'operations:base-created': { id: string }
  'operations:base-updated': { id: string }
  'operations:insurer-created': { id: string }
  'operations:pricing-table-updated': { id: string }
  'operations:route-calculated': { source: string; totalKm: number }
  'operations:quote-calculated': { id: string; total: number }
  'operations:quote-saved': { id: string }
  'operations:quote-copied': { id: string }
  'operations:quote-opened-in-whatsapp': { id: string; profileId: string }
  'operations:import-started': { counts: Record<string, number> }
  'operations:import-completed': { counts: Record<string, number> }
  'operations:import-failed': { reason: string }
  'operations:operational-company-created': { id?: string; name?: string; code?: string; origin?: string; previous?: unknown; current?: unknown }
  'operations:operational-company-updated': { id: string; previous?: unknown; current?: unknown; origin?: string }
  'operations:operational-company-archived': { id: string; previous?: unknown; current?: unknown; origin?: string }
  'operations:operational-company-restored': { id: string; previous?: unknown; current?: unknown; origin?: string }
}

type Listener<T> = (payload: T) => void

export class EventBus<Events extends Record<string, unknown> = CoreEvents> {
  private readonly listeners = new Map<keyof Events, Set<Listener<never>>>()

  on<Key extends keyof Events>(event: Key, listener: Listener<Events[Key]>) {
    const listeners = this.listeners.get(event) ?? new Set<Listener<never>>()
    listeners.add(listener as Listener<never>)
    this.listeners.set(event, listeners)
    return () => this.off(event, listener)
  }

  once<Key extends keyof Events>(event: Key, listener: Listener<Events[Key]>) {
    const unsubscribe = this.on(event, (payload) => {
      unsubscribe()
      listener(payload)
    })
    return unsubscribe
  }

  off<Key extends keyof Events>(event: Key, listener: Listener<Events[Key]>) {
    this.listeners.get(event)?.delete(listener as Listener<never>)
  }

  emit<Key extends keyof Events>(event: Key, payload: Events[Key]) {
    for (const listener of this.listeners.get(event) ?? []) listener(payload as never)
  }

  removeAllListeners<Key extends keyof Events>(event?: Key) {
    if (event === undefined) this.listeners.clear()
    else this.listeners.delete(event)
  }
}
