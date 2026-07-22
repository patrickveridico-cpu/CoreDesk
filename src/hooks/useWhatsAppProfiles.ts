import { useEffect } from 'react'
import { useWhatsAppStore } from '../store/useWhatsAppStore'

export function useWhatsAppProfiles() {
  const hydrate = useWhatsAppStore((state) => state.hydrate)
  const setSnapshot = useWhatsAppStore((state) => state.setSnapshot)
  const setRuntime = useWhatsAppStore((state) => state.setRuntime)

  useEffect(() => {
    const api = window.coreDesk?.whatsapp
    if (!api) { void hydrate(); return }
    const removeProfiles = api.onProfilesChanged(setSnapshot)
    const removeState = api.onStateChanged(setRuntime)
    void hydrate()
    return () => { removeProfiles(); removeState() }
  }, [hydrate, setRuntime, setSnapshot])
}
