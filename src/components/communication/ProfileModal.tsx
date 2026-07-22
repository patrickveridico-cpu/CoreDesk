import { useEffect, useState } from 'react'
import { ImagePlus, MessageCircle, Type, X } from 'lucide-react'
import type { WhatsAppProfile } from '../../../shared/whatsapp'
import { useWhatsAppStore } from '../../store/useWhatsAppStore'

const colors = ['#1cc8ee', '#22c55e', '#a78bfa', '#f59e0b', '#f43f5e', '#64748b']

export function ProfileModal({ profile, onClose }: { profile?: WhatsAppProfile; onClose: () => void }) {
  const createProfile = useWhatsAppStore((state) => state.createProfile)
  const updateProfile = useWhatsAppStore((state) => state.updateProfile)
  const selectIcon = useWhatsAppStore((state) => state.selectIcon)
  const [name, setName] = useState(profile?.name ?? '')
  const [accentColor, setAccentColor] = useState(profile?.accentColor ?? colors[0])
  const [iconToken, setIconToken] = useState(profile?.icon ?? 'initials')
  const [iconPreview, setIconPreview] = useState(profile?.iconUrl)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => document.getElementById('profile-name')?.focus(), [])

  const chooseImportedIcon = async () => {
    const selection = await selectIcon(profile?.id)
    if (selection.canceled) return
    if (profile && selection.profile) {
      setIconToken(selection.profile.icon ?? 'initials')
    } else {
      setIconToken(selection.token ?? 'initials')
    }
    setIconPreview(selection.iconUrl)
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      if (profile) await updateProfile(profile.id, { name, accentColor })
      else await createProfile({ name, accentColor, iconToken })
      onClose()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível salvar o perfil.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-6" role="dialog" aria-modal="true" aria-label={profile ? 'Editar perfil' : 'Adicionar perfil'}>
      <form onSubmit={submit} className="w-full max-w-md rounded-xl border border-core-line bg-core-panel p-5 shadow-2xl">
        <div className="mb-5 flex items-center justify-between">
          <div><h2 className="text-sm font-semibold text-white">{profile ? 'Editar perfil' : 'Adicionar perfil'}</h2><p className="mt-1 text-xs text-slate-500">Sessão isolada do WhatsApp Web</p></div>
          <button type="button" className="rounded p-1 text-slate-500 hover:bg-white/5 hover:text-white" onClick={onClose}><X size={16} /></button>
        </div>
        <label className="text-xs text-slate-400" htmlFor="profile-name">Nome do perfil</label>
        <input id="profile-name" value={name} onChange={(event) => setName(event.target.value)} maxLength={48} className="mt-2 h-9 w-full rounded-md border border-core-line bg-core-canvas px-3 text-sm text-white outline-none focus:border-core-accent/60" placeholder="Ex.: Atendimento" />

        <p className="mb-2 mt-4 text-xs text-slate-400">Cor de identificação</p>
        <div className="flex gap-2">{colors.map((color) => <button type="button" key={color} onClick={() => setAccentColor(color)} className={`h-7 w-7 rounded-full border-2 ${accentColor === color ? 'border-white' : 'border-transparent'}`} style={{ backgroundColor: color }} aria-label={`Cor ${color}`} />)}</div>

        <p className="mb-2 mt-4 text-xs text-slate-400">Ícone</p>
        <div className="grid grid-cols-3 gap-2">
          <button type="button" onClick={() => { setIconToken('builtin:message'); setIconPreview(undefined) }} className={`flex h-16 flex-col items-center justify-center gap-1 rounded-md border text-xs ${iconToken === 'builtin:message' ? 'border-core-accent text-core-accent' : 'border-core-line text-slate-400'}`}><MessageCircle size={18} /> Padrão</button>
          <button type="button" onClick={() => { setIconToken('initials'); setIconPreview(undefined) }} className={`flex h-16 flex-col items-center justify-center gap-1 rounded-md border text-xs ${iconToken === 'initials' ? 'border-core-accent text-core-accent' : 'border-core-line text-slate-400'}`}><Type size={18} /> Iniciais</button>
          <button type="button" onClick={() => void chooseImportedIcon()} className={`flex h-16 flex-col items-center justify-center gap-1 rounded-md border text-xs ${iconPreview ? 'border-core-accent text-core-accent' : 'border-core-line text-slate-400'}`}>{iconPreview ? <img src={iconPreview} alt="" className="h-7 w-7 rounded object-cover" /> : <ImagePlus size={18} />} Importar</button>
        </div>
        {error && <p className="mt-3 text-xs text-red-400">{error}</p>}
        <div className="mt-6 flex justify-end gap-2"><button type="button" onClick={onClose} className="rounded-md border border-core-line px-3 py-2 text-xs text-slate-300 hover:bg-white/5">Cancelar</button><button disabled={saving} className="rounded-md bg-core-accent px-3 py-2 text-xs font-semibold text-slate-950 disabled:opacity-50">{saving ? 'Salvando…' : profile ? 'Salvar' : 'Criar perfil'}</button></div>
      </form>
    </div>
  )
}
