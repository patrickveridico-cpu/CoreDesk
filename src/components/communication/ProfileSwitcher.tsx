import { useEffect } from 'react'
import { useWhatsAppStore } from '../../store/useWhatsAppStore'
import { ProfileAvatar } from './ProfileAvatar'

export function ProfileSwitcher() {
  const open = useWhatsAppStore((state) => state.profileSwitcherOpen)
  const profiles = useWhatsAppStore((state) => state.profiles)
  const setOpen = useWhatsAppStore((state) => state.setProfileSwitcherOpen)
  const openProfile = useWhatsAppStore((state) => state.openProfile)
  useEffect(() => {
    if (!open) return
    const close = (event: KeyboardEvent) => event.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', close)
    return () => window.removeEventListener('keydown', close)
  }, [open, setOpen])
  if (!open) return null
  return <div className="fixed inset-0 z-[60] grid place-items-center bg-black/50" onClick={() => setOpen(false)}><div className="w-80 rounded-xl border border-core-line bg-core-panel p-3 shadow-2xl" onClick={(event) => event.stopPropagation()}><p className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Perfis do WhatsApp</p>{profiles.map((profile, index) => <button key={profile.id} onClick={() => { void openProfile(profile.id); setOpen(false) }} className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-left hover:bg-white/5"><ProfileAvatar profile={profile} /><span className="min-w-0 flex-1 truncate text-sm text-white">{profile.name}</span>{index < 9 && <kbd className="text-[10px] text-slate-600">Alt+{index + 1}</kbd>}</button>)}{profiles.length === 0 && <p className="px-2 py-6 text-center text-xs text-slate-500">Nenhum perfil configurado.</p>}</div></div>
}
