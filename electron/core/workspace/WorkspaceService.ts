import type { EventBus } from '../events/EventBus'

export class WorkspaceService {
  private activeTabId = 'home'
  private readonly history: string[] = []

  constructor(private readonly events: EventBus) {}

  getActive() { return this.activeTabId }
  setActive(id: string) {
    if (id === this.activeTabId) return
    this.history.unshift(this.activeTabId)
    this.history.splice(2)
    this.activeTabId = id
    this.events.emit('workspace:active-changed', id)
  }
  getRecent() { return [...this.history] }
  getHistory() { return this.getRecent() }
}
