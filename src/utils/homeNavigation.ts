import { useTabsStore } from '../store/useTabsStore'
import { CORECHAT_VIEW_ID } from '../../shared/corechat'

export type HomeQuickAction = 'new-budget' | 'whatsapp' | 'maps' | 'operations'

export interface HomeNavigation {
  executeCommand: (id: string) => void | Promise<unknown>
  openInternalTab: (id: 'communication' | 'routes', title: string) => void
  openWorkspaceWebTab: (id: 'app-maps' | typeof CORECHAT_VIEW_ID) => void
}

export function openCoreChatFromHome(navigation = currentNavigation()) {
  navigation.openWorkspaceWebTab(CORECHAT_VIEW_ID)
}

function currentNavigation(): HomeNavigation {
  const tabs = useTabsStore.getState()
  return {
    executeCommand: (id) => window.coreDesk?.core.executeCommand(id),
    openInternalTab: tabs.openInternalTab,
    openWorkspaceWebTab: tabs.openWorkspaceWebTab,
  }
}

export function runHomeQuickAction(action: HomeQuickAction, navigation = currentNavigation()) {
  if (action === 'new-budget') {
    void navigation.executeCommand('operations.new-quote')
    return
  }
  if (action === 'whatsapp') {
    navigation.openInternalTab('communication', 'Comunicação')
    return
  }
  if (action === 'maps') {
    navigation.openWorkspaceWebTab('app-maps')
    return
  }
  navigation.openInternalTab('routes', 'Operações')
}
