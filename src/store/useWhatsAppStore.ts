import { create } from 'zustand'
import type {
  CreateWhatsAppProfileInput,
  UpdateWhatsAppProfileInput,
  WhatsAppProfile,
  WhatsAppProfilesSnapshot,
  WhatsAppProfileState,
} from '../../shared/whatsapp'
import { useTabsStore } from './useTabsStore'

interface WhatsAppState {
  profiles: WhatsAppProfile[]
  runtime: Record<string, WhatsAppProfileState>
  activeProfileId?: string
  loading: boolean
  createDialogOpen: boolean
  profileSwitcherOpen: boolean
  setCreateDialogOpen: (open: boolean) => void
  setProfileSwitcherOpen: (open: boolean) => void
  setSnapshot: (snapshot: WhatsAppProfilesSnapshot) => void
  setRuntime: (runtime: WhatsAppProfileState) => void
  hydrate: () => Promise<void>
  createProfile: (input: CreateWhatsAppProfileInput) => Promise<WhatsAppProfile>
  updateProfile: (id: string, input: UpdateWhatsAppProfileInput) => Promise<WhatsAppProfile>
  openProfile: (id: string) => Promise<void>
  suspendProfile: (id: string) => Promise<void>
  resumeProfile: (id: string) => Promise<void>
  reloadProfile: (id: string) => Promise<void>
  clearSession: (id: string) => Promise<void>
  removeProfile: (id: string, clearSession: boolean) => Promise<void>
  reorderProfiles: (ids: string[]) => Promise<void>
  selectIcon: (profileId?: string) => ReturnType<NonNullable<Window['coreDesk']>['whatsapp']['selectIcon']>
}

function reconcileTabs(snapshot: WhatsAppProfilesSnapshot) {
  const tabs = useTabsStore.getState()
  const profileById = new Map(snapshot.profiles.map((profile) => [profile.id, profile]))
  for (const tab of tabs.tabs) {
    if (tab.type !== 'whatsapp' || !tab.profileId) continue
    const profile = profileById.get(tab.profileId)
    if (!profile || !profile.open || !profile.enabled) tabs.removeWhatsAppTab(tab.profileId)
  }
  snapshot.profiles.forEach((profile) => {
    tabs.updateWhatsAppTab(profile)
    if (profile.open && profile.enabled) tabs.addWhatsAppTab(profile, false)
  })
  const active = snapshot.profiles.find((profile) => profile.id === snapshot.activeProfileId && profile.open)
  if (active) tabs.selectTab(`whatsapp:${active.id}`)
}

export const useWhatsAppStore = create<WhatsAppState>((set, get) => ({
  profiles: [],
  runtime: {},
  loading: true,
  createDialogOpen: false,
  profileSwitcherOpen: false,
  setCreateDialogOpen: (createDialogOpen) => set({ createDialogOpen }),
  setProfileSwitcherOpen: (profileSwitcherOpen) => set({ profileSwitcherOpen }),
  setSnapshot: (snapshot) => {
    set({ profiles: snapshot.profiles, activeProfileId: snapshot.activeProfileId, loading: false })
    reconcileTabs(snapshot)
  },
  setRuntime: (runtime) => {
    set((state) => ({ runtime: { ...state.runtime, [runtime.profileId]: runtime } }))
    useTabsStore.getState().applyWhatsAppState(runtime)
  },
  hydrate: async () => {
    const api = window.coreDesk?.whatsapp
    if (!api) { set({ loading: false }); return }
    get().setSnapshot(await api.listProfiles())
  },
  createProfile: async (input) => {
    const profile = await window.coreDesk!.whatsapp.createProfile(input)
    useTabsStore.getState().addWhatsAppTab(profile)
    return profile
  },
  updateProfile: async (id, input) => {
    const profile = await window.coreDesk!.whatsapp.updateProfile(id, input)
    useTabsStore.getState().updateWhatsAppTab(profile)
    return profile
  },
  openProfile: async (id) => {
    const profile = await window.coreDesk!.whatsapp.openProfile(id)
    useTabsStore.getState().addWhatsAppTab(profile)
  },
  suspendProfile: async (id) => {
    const profile = await window.coreDesk!.whatsapp.suspendProfile(id)
    useTabsStore.getState().updateWhatsAppTab(profile)
  },
  resumeProfile: async (id) => {
    const profile = await window.coreDesk!.whatsapp.resumeProfile(id)
    useTabsStore.getState().addWhatsAppTab(profile)
  },
  reloadProfile: async (id) => window.coreDesk!.whatsapp.reloadProfile(id),
  clearSession: async (id) => window.coreDesk!.whatsapp.clearSession(id),
  removeProfile: async (id, clearSession) => {
    await window.coreDesk!.whatsapp.removeProfile(id, clearSession)
    useTabsStore.getState().removeWhatsAppTab(id)
  },
  reorderProfiles: async (ids) => {
    const profiles = await window.coreDesk!.whatsapp.reorderProfiles(ids)
    set({ profiles })
  },
  selectIcon: (profileId) => window.coreDesk!.whatsapp.selectIcon(profileId),
}))
