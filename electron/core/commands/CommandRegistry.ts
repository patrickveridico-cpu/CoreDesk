export interface CoreCommand {
  id: string
  title: string
  category: string
  shortcut?: string
  execute: () => Promise<void> | void
  isEnabled?: () => boolean
}

import type { CoreCommandInfo as CommandInfo } from '../../../shared/core/contracts'
import type { EventBus } from '../events/EventBus'

export class CommandRegistry {
  private readonly commands = new Map<string, CoreCommand>()
  constructor(private readonly events?: EventBus) {}

  register(command: CoreCommand) { this.commands.set(command.id, command); return () => this.remove(command.id) }
  remove(id: string) { this.commands.delete(id) }
  list(): CommandInfo[] { return [...this.commands.values()].map(({ id, title, category, shortcut, isEnabled }) => ({ id, title, category, shortcut, enabled: isEnabled?.() ?? true })) }
  async execute(id: string) {
    const command = this.commands.get(id)
    if (!command) throw new Error(`Comando não encontrado: ${id}`)
    if (command.isEnabled && !command.isEnabled()) throw new Error(`Comando indisponível: ${id}`)
    await command.execute()
    this.events?.emit('command:executed', { id })
    return true
  }
}
