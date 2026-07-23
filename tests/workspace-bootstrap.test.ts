import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { WorkspaceTab } from '../shared/contracts'
import type { WhatsAppProfile, WhatsAppProfilesSnapshot } from '../shared/whatsapp'
import {
  initialTabs,
  normalizeTabsStateForBootstrap,
  useTabsStore,
} from '../src/store/useTabsStore'
import { reconcileWhatsAppTabs } from '../src/store/useWhatsAppStore'

let persistError: ReturnType<typeof vi.spyOn>
let persistWarning: ReturnType<typeof vi.spyOn>

const profile: WhatsAppProfile = {
  id: 'commercial',
  name: 'Comercial',
  partition: 'persist:coredesk-whatsapp-commercial',
  order: 0,
  enabled: true,
  open: true,
  suspended: false,
  notificationsEnabled: true,
  createdAt: '2026-07-23T10:00:00.000Z',
  updatedAt: '2026-07-23T10:00:00.000Z',
}

const snapshot: WhatsAppProfilesSnapshot = {
  profiles: [profile],
  activeProfileId: profile.id,
}

function resetTabs() {
  useTabsStore.setState({
    tabs: initialTabs.map((tab) => ({ ...tab })),
    activeTabId: 'home',
    closedWebTabs: [],
    previousTabIds: {},
  })
}

describe('workspace bootstrap', () => {
  beforeEach(() => {
    persistError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    persistWarning = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    resetTabs()
  })
  afterEach(() => {
    resetTabs()
    persistError.mockRestore()
    persistWarning.mockRestore()
  })

  it('keeps hydrated WhatsApp profiles available without selecting or duplicating them', () => {
    reconcileWhatsAppTabs(snapshot, false)
    reconcileWhatsAppTabs(snapshot, false)

    const state = useTabsStore.getState()
    expect(state.activeTabId).toBe('home')
    expect(state.tabs.filter((tab) => tab.id === `whatsapp:${profile.id}`)).toHaveLength(1)
  })

  it('allows normal navigation during the session and selects Home again on a new bootstrap', () => {
    const whatsappTab: WorkspaceTab = {
      id: `whatsapp:${profile.id}`,
      type: 'whatsapp',
      profileId: profile.id,
      title: profile.name,
      url: 'https://web.whatsapp.com/',
      partition: profile.partition,
      closable: true,
      pinned: true,
      loading: false,
      canGoBack: false,
      canGoForward: false,
    }
    const mapsTab: WorkspaceTab = {
      id: 'app-maps',
      type: 'web',
      title: 'Maps',
      url: 'https://www.google.com/maps',
      partition: 'persist:coredesk-google',
      closable: true,
      pinned: false,
      loading: false,
      canGoBack: false,
      canGoForward: false,
    }
    useTabsStore.setState({
      tabs: [initialTabs[0], whatsappTab, mapsTab],
      activeTabId: 'home',
    })

    useTabsStore.getState().selectTab(whatsappTab.id)
    expect(useTabsStore.getState().activeTabId).toBe(whatsappTab.id)
    useTabsStore.getState().selectTab(mapsTab.id)
    expect(useTabsStore.getState().activeTabId).toBe(mapsTab.id)

    const restarted = normalizeTabsStateForBootstrap({
      tabs: useTabsStore.getState().tabs,
      activeTabId: useTabsStore.getState().activeTabId,
    }) as { tabs: WorkspaceTab[]; activeTabId: string }
    expect(restarted.activeTabId).toBe('home')
    expect(restarted.tabs.map((tab) => tab.id)).toEqual(['home', whatsappTab.id, mapsTab.id])
  })
})
