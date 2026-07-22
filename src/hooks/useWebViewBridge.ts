import { useEffect } from 'react'
import type { ShortcutCommand, WebTabDescriptor } from '../../shared/contracts'
import { useTabsStore } from '../store/useTabsStore'

export const REMOTE_SHORTCUT_EVENT = 'coredesk:remote-shortcut'

export function useWebViewBridge() {
  const tabs = useTabsStore((state) => state.tabs)
  const activeTabId = useTabsStore((state) => state.activeTabId)
  const applyWebViewState = useTabsStore((state) => state.applyWebViewState)
  const addWebTab = useTabsStore((state) => state.addWebTab)
  const viewsApi = window.coreDesk?.views

  useEffect(() => {
    if (!viewsApi) return
    const removeStateListener = viewsApi.onStateChange(applyWebViewState)
    const removeNewTabListener = viewsApi.onNewTabRequest(addWebTab)
    const removeShortcutListener = viewsApi.onShortcut((command: ShortcutCommand) => {
      window.dispatchEvent(new CustomEvent(REMOTE_SHORTCUT_EVENT, { detail: command }))
    })
    return () => {
      removeStateListener()
      removeNewTabListener()
      removeShortcutListener()
    }
  }, [addWebTab, applyWebViewState, viewsApi])

  useEffect(() => {
    if (!viewsApi) return
    const descriptors: WebTabDescriptor[] = tabs
      .filter((tab) => tab.type !== 'internal' && tab.url && tab.partition)
      .map((tab) => ({
        id: tab.id,
        title: tab.title,
        url: tab.url!,
        partition: tab.partition!,
        pinned: tab.pinned,
        type: tab.type as 'web' | 'whatsapp',
        profileId: tab.profileId,
        suspended: tab.connectionState === 'suspended',
      }))
    viewsApi.sync(descriptors, activeTabId)
  }, [activeTabId, tabs, viewsApi])

  useEffect(() => {
    const active = useTabsStore.getState().tabs.find((tab) => tab.id === activeTabId)
    if (active?.type === 'whatsapp' && active.profileId) {
      void window.coreDesk?.whatsapp.setOpen(active.profileId, true)
    }
  }, [activeTabId])
}
