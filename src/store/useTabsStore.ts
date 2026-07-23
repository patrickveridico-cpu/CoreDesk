import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { NewTabRequest, WebViewStateUpdate, WorkspaceTab } from '../../shared/contracts'
import { CORECHAT_VIEW_ID } from '../../shared/corechat'
import type { WhatsAppProfile, WhatsAppProfileState } from '../../shared/whatsapp'
import { WHATSAPP_URL } from '../../shared/whatsapp'

const cleanWebState = {
  loading: false,
  canGoBack: false,
  canGoForward: false,
}

export const initialTabs: WorkspaceTab[] = [
  {
    id: 'home', type: 'internal', title: 'Início', closable: false, pinned: true,
    ...cleanWebState,
  },
  {
    id: 'communication', type: 'internal', title: 'Comunicação', closable: false, pinned: true,
    ...cleanWebState,
  },
  {
    id: 'app-example', type: 'web', title: 'Página de teste', url: 'https://example.com',
    partition: 'persist:coredesk-test', closable: true, pinned: true, ...cleanWebState,
  },
]

interface TabsState {
  tabs: WorkspaceTab[]
  activeTabId: string
  closedWebTabs: WorkspaceTab[]
  addWebTab: (request?: Partial<NewTabRequest>) => void
  addWhatsAppTab: (profile: WhatsAppProfile, select?: boolean) => void
  updateWhatsAppTab: (profile: WhatsAppProfile) => void
  removeWhatsAppTab: (profileId: string) => void
  applyWhatsAppState: (state: WhatsAppProfileState) => void
  openInternalTab: (id: 'communication' | 'settings' | 'about' | 'routes', title: string) => void
  restoreClosedTab: () => void
  selectTab: (id: string) => void
  closeTab: (id: string) => void
  closeActiveTab: () => void
  selectByIndex: (index: number) => void
  selectRelative: (offset: number) => void
  applyWebViewState: (update: WebViewStateUpdate) => void
  openWorkspaceWebTab: (id: 'app-google' | 'app-maps') => void
  toggleWebTabPinned: (id: 'app-google' | 'app-maps') => void
  previousTabIds: Record<string, string>
}

export function migratePersistedTabsState(persistedState: unknown) {
  if (!persistedState || typeof persistedState !== 'object') return persistedState
  const persisted = persistedState as Partial<Pick<TabsState, 'tabs' | 'activeTabId'>>
  if (!Array.isArray(persisted.tabs)) return persistedState
  const tabs = persisted.tabs.filter((tab) => tab.id !== CORECHAT_VIEW_ID)
  const activeTabId = persisted.activeTabId === CORECHAT_VIEW_ID
    ? (tabs.find((tab) => tab.id === 'home')?.id ?? tabs[0]?.id ?? 'home')
    : persisted.activeTabId
  return { ...persistedState, tabs, activeTabId }
}

export function normalizeTabsStateForBootstrap(persistedState: unknown) {
  if (!persistedState || typeof persistedState !== 'object') {
    return { tabs: initialTabs, activeTabId: 'home' }
  }
  const persisted = persistedState as Partial<Pick<TabsState, 'tabs' | 'activeTabId'>>
  const persistedTabs = Array.isArray(persisted.tabs) ? persisted.tabs : initialTabs
  const workspaceTabs = persistedTabs.filter((tab) => tab.id !== CORECHAT_VIEW_ID)
  const persistedHome = workspaceTabs.find((tab) => tab.id === 'home')
  const homeTab: WorkspaceTab = {
    ...initialTabs[0],
    ...persistedHome,
    id: 'home',
    type: 'internal',
    title: persistedHome?.title ?? initialTabs[0].title,
    closable: false,
    pinned: true,
    ...cleanWebState,
  }
  const tabs = [homeTab, ...workspaceTabs.filter((tab) => tab.id !== 'home')]
  return { ...persistedState, tabs, activeTabId: 'home' }
}

function createWebTab(request: Partial<NewTabRequest> = {}): WorkspaceTab {
  return {
    id: crypto.randomUUID(),
    type: 'web',
    title: 'Nova aba',
    url: request.url ?? 'https://www.google.com',
    partition: request.partition ?? 'persist:coredesk-browsing',
    closable: true,
    pinned: false,
    ...cleanWebState,
  }
}

export const useTabsStore = create<TabsState>()(
  persist(
    (set, get) => ({
      tabs: initialTabs,
      activeTabId: initialTabs[0].id,
      closedWebTabs: [],
      previousTabIds: {},
      addWebTab: (request) => set((state) => {
        const tab = createWebTab(request)
        return { tabs: [...state.tabs, tab], activeTabId: tab.id }
      }),
      addWhatsAppTab: (profile, select = true) => set((state) => {
        const id = `whatsapp:${profile.id}`
        const existing = state.tabs.find((tab) => tab.id === id)
        if (existing) {
          return {
            tabs: state.tabs.map((tab) => tab.id === id ? {
              ...tab,
              title: profile.name,
              fixedTitle: profile.name,
              icon: profile.iconUrl,
              accentColor: profile.accentColor,
              partition: profile.partition,
            } : tab),
            activeTabId: select ? id : state.activeTabId,
          }
        }
        const tab: WorkspaceTab = {
          id,
          type: 'whatsapp',
          profileId: profile.id,
          title: profile.name,
          fixedTitle: profile.name,
          url: WHATSAPP_URL,
          partition: profile.partition,
          icon: profile.iconUrl,
          accentColor: profile.accentColor,
          unreadCount: 0,
          connectionState: profile.suspended ? 'suspended' : 'loading',
          closable: true,
          pinned: true,
          ...cleanWebState,
        }
        return { tabs: [...state.tabs, tab], activeTabId: select ? id : state.activeTabId }
      }),
      updateWhatsAppTab: (profile) => set((state) => ({
        tabs: state.tabs.map((tab) => tab.profileId === profile.id ? {
          ...tab,
          title: profile.name,
          fixedTitle: profile.name,
          icon: profile.iconUrl,
          accentColor: profile.accentColor,
          connectionState: profile.suspended ? 'suspended' : tab.connectionState,
        } : tab),
      })),
      removeWhatsAppTab: (profileId) => set((state) => {
        const id = `whatsapp:${profileId}`
        const tabs = state.tabs.filter((tab) => tab.id !== id)
        return { tabs, activeTabId: state.activeTabId === id ? 'communication' : state.activeTabId }
      }),
      applyWhatsAppState: (runtime) => set((state) => ({
        tabs: state.tabs.map((tab) => tab.profileId === runtime.profileId ? {
          ...tab,
          loading: runtime.loading,
          unreadCount: runtime.unreadCount,
          connectionState: runtime.connectionState,
        } : tab),
      })),
      openInternalTab: (id, title) => set((state) => state.tabs.some((tab) => tab.id === id)
        ? { activeTabId: id }
        : {
            tabs: [...state.tabs, { id, type: 'internal', title, closable: true, pinned: false, ...cleanWebState }],
            activeTabId: id,
          }),
      restoreClosedTab: () => set((state) => {
        const [tab, ...closedWebTabs] = state.closedWebTabs
        if (!tab) return state
        const restored = state.tabs.some((item) => item.id === tab.id)
          ? { ...tab, id: crypto.randomUUID() }
          : tab
        return {
          tabs: [...state.tabs, { ...restored, ...cleanWebState, error: undefined }],
          activeTabId: restored.id,
          closedWebTabs,
        }
      }),
      selectTab: (id) => set((state) => {
        if (!state.tabs.some((tab) => tab.id === id)) return state
        return id === 'app-google' || id === 'app-maps'
          ? { activeTabId: id, previousTabIds: { ...state.previousTabIds, [id]: state.activeTabId } }
          : { activeTabId: id }
      }),
      closeTab: (id) => set((state) => {
        const index = state.tabs.findIndex((tab) => tab.id === id)
        const tab = state.tabs[index]
        if (!tab?.closable) return state

        const tabs = state.tabs.filter((item) => item.id !== id)
        const activeTabId = state.activeTabId === id
          ? (state.previousTabIds[id] && tabs.some((item) => item.id === state.previousTabIds[id]) ? state.previousTabIds[id] : (tabs[Math.min(index, tabs.length - 1)]?.id ?? 'home'))
          : state.activeTabId
        if (tab.type === 'whatsapp' && tab.profileId) {
          void window.coreDesk?.whatsapp.setOpen(tab.profileId, false)
        }
        const closedWebTabs = tab.type === 'web'
          ? [tab, ...state.closedWebTabs].slice(0, 8)
          : state.closedWebTabs
        return { tabs, activeTabId, closedWebTabs }
      }),
      closeActiveTab: () => get().closeTab(get().activeTabId),
      selectByIndex: (index) => {
        const tab = get().tabs[index]
        if (tab) set({ activeTabId: tab.id })
      },
      selectRelative: (offset) => {
        const { tabs, activeTabId } = get()
        if (tabs.length === 0) return
        const current = Math.max(0, tabs.findIndex((tab) => tab.id === activeTabId))
        const next = (current + offset + tabs.length) % tabs.length
        set({ activeTabId: tabs[next].id })
      },
      applyWebViewState: (update) => set((state) => ({
        tabs: state.tabs.map((tab) => {
          if (tab.id !== update.id || tab.type === 'internal') return tab
          const title = update.title && !tab.pinned ? update.title : tab.title
          return {
            ...tab,
            ...update,
            title,
            error: update.error === null ? undefined : (update.error ?? tab.error),
          }
        }),
      })),
      openWorkspaceWebTab: (id) => set((state) => {
        if (state.tabs.some((tab) => tab.id === id)) return { activeTabId: id, previousTabIds: { ...state.previousTabIds, [id]: state.activeTabId } }
        const tab: WorkspaceTab = id === 'app-google'
          ? { id, type: 'web', title: 'Google', url: 'https://www.google.com', partition: 'persist:coredesk-google', closable: true, pinned: false, ...cleanWebState }
          : { id, type: 'web', title: 'Maps', url: 'https://www.google.com/maps', partition: 'persist:coredesk-google', closable: true, pinned: false, ...cleanWebState }
        return tab ? { tabs: [...state.tabs, tab], activeTabId: id, previousTabIds: { ...state.previousTabIds, [id]: state.activeTabId } } : state
      }),
      toggleWebTabPinned: (id) => set((state) => ({ tabs: state.tabs.map((tab) => tab.id === id ? { ...tab, pinned: !tab.pinned } : tab) })),
    }),
    {
      name: 'coredesk-workspace',
      version: 3,
      migrate: migratePersistedTabsState,
      merge: (persistedState, currentState) => ({
        ...currentState,
        ...normalizeTabsStateForBootstrap(persistedState),
      }),
      partialize: ({ tabs, activeTabId }) => ({
        tabs: tabs.map((tab) => ({
          ...tab,
          ...cleanWebState,
          icon: undefined,
          error: undefined,
        })),
        activeTabId,
      }),
    },
  ),
)
