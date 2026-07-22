import { useEffect } from 'react'
import type { ShortcutCommand } from '../../shared/contracts'
import { useTabsStore } from '../store/useTabsStore'
import { useWhatsAppStore } from '../store/useWhatsAppStore'
import { REMOTE_SHORTCUT_EVENT } from './useWebViewBridge'

export const FOCUS_ADDRESS_EVENT = 'coredesk:focus-address'
const recentProfileIds: string[] = []

function commandFromKeyboard(event: KeyboardEvent): ShortcutCommand | null {
  const key = event.key.toLowerCase()
  const ctrl = event.ctrlKey || event.metaKey
  if (ctrl && event.shiftKey && key === 'w') return { type: 'open-whatsapp-switcher' }
  if (event.altKey && /^[1-9]$/.test(key)) return { type: 'select-whatsapp-profile', index: Number(key) - 1 }
  if (ctrl && event.altKey && key === 'w') return { type: 'toggle-last-whatsapp-profile' }
  if (ctrl && /^[1-9]$/.test(key)) return { type: 'select-index', index: Number(key) - 1 }
  if (ctrl && key === 'tab') return { type: event.shiftKey ? 'select-previous' : 'select-next' }
  if (ctrl && event.shiftKey && key === 't') return { type: 'restore-tab' }
  if (ctrl && key === 'l') return { type: 'focus-address' }
  if (ctrl && key === 'r') return { type: 'reload' }
  if (ctrl && key === 'w') return { type: 'close-tab' }
  if (ctrl && key === 't') return { type: 'new-tab' }
  if (event.altKey && key === 'arrowleft') return { type: 'back' }
  if (event.altKey && key === 'arrowright') return { type: 'forward' }
  if (key === 'f5') return { type: 'reload' }
  if (key === 'escape') return { type: 'stop' }
  return null
}

function executeCommand(command: ShortcutCommand) {
  const store = useTabsStore.getState()
  const active = store.tabs.find((tab) => tab.id === store.activeTabId)
  const views = window.coreDesk?.views

  switch (command.type) {
    case 'select-index': store.selectByIndex(command.index); break
    case 'select-next': store.selectRelative(1); break
    case 'select-previous': store.selectRelative(-1); break
    case 'focus-address': window.dispatchEvent(new Event(FOCUS_ADDRESS_EVENT)); break
    case 'close-tab': store.closeActiveTab(); break
    case 'new-tab': store.addWebTab(); break
    case 'restore-tab': store.restoreClosedTab(); break
    case 'reload': if (active && active.type !== 'internal') views?.reload(active.id); break
    case 'back': if (active?.type === 'web') views?.back(active.id); break
    case 'forward': if (active?.type === 'web') views?.forward(active.id); break
    case 'stop': if (active && active.type !== 'internal' && active.loading) views?.stop(active.id); break
    case 'open-whatsapp-switcher': useWhatsAppStore.getState().setProfileSwitcherOpen(true); break
    case 'select-whatsapp-profile': {
      const profile = useWhatsAppStore.getState().profiles[command.index]
      if (profile) void useWhatsAppStore.getState().openProfile(profile.id)
      break
    }
    case 'toggle-last-whatsapp-profile': {
      const target = recentProfileIds.find((id) => id !== active?.profileId)
      if (target) void useWhatsAppStore.getState().openProfile(target)
      break
    }
  }
}

function executeCommandId(id: string) {
  const profileMatch = id.match(/^whatsapp\.activate-profile-(\d+)$/)
  if (profileMatch) return executeCommand({ type: 'select-whatsapp-profile', index: Number(profileMatch[1]) - 1 })
  if (id === 'workspace.open-home') return useTabsStore.getState().selectTab('home')
  if (id === 'whatsapp.new-profile') {
    useTabsStore.getState().openInternalTab('communication', 'Comunicação')
    useWhatsAppStore.getState().setCreateDialogOpen(true)
    return
  }
  if (id === 'app.open-settings') {
    useTabsStore.getState().openInternalTab('settings', 'Configurações')
    return
  }
  if (id.startsWith('operations.')) {
    const section = id === 'operations.open-bases' ? 'bases' : id === 'operations.open-insurers' ? 'insurers' : id === 'operations.open-specialties' ? 'specialties' : id === 'operations.open-pricing-tables' ? 'tables' : id === 'operations.open-history' ? 'history' : 'quote'
    useTabsStore.getState().openInternalTab('routes', 'Operações')
    window.dispatchEvent(new CustomEvent('coredesk:operations-section', { detail: section }))
    return
  }
  const commands: Record<string, ShortcutCommand> = {
    'browser.new-tab': { type: 'new-tab' },
    'browser.reload-active': { type: 'reload' },
    'browser.close-active': { type: 'close-tab' },
    'browser.focus-address': { type: 'focus-address' },
    'browser.go-back': { type: 'back' },
    'browser.go-forward': { type: 'forward' },
    'whatsapp.open-profile-selector': { type: 'open-whatsapp-switcher' },
    'whatsapp.toggle-last-profile': { type: 'toggle-last-whatsapp-profile' },
  }
  const command = commands[id]
  if (command) executeCommand(command)
}

export function useTabShortcuts() {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const command = commandFromKeyboard(event)
      if (!command) return
      event.preventDefault()
      executeCommand(command)
    }
    const handleRemote = (event: Event) => executeCommand((event as CustomEvent<ShortcutCommand>).detail)
    const removeCommandListener = window.coreDesk?.core.onCommandRequested(executeCommandId)

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener(REMOTE_SHORTCUT_EVENT, handleRemote)
    const unsubscribe = useTabsStore.subscribe((state, previous) => {
      if (state.activeTabId === previous.activeTabId) return
      const profileId = state.tabs.find((tab) => tab.id === state.activeTabId)?.profileId
      if (!profileId) return
      const existing = recentProfileIds.indexOf(profileId)
      if (existing >= 0) recentProfileIds.splice(existing, 1)
      recentProfileIds.unshift(profileId)
      recentProfileIds.splice(2)
    })
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener(REMOTE_SHORTCUT_EVENT, handleRemote)
      unsubscribe()
      removeCommandListener?.()
    }
  }, [])
}
