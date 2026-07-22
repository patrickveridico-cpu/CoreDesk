import { useState } from 'react'
import { ArrowDown, ArrowUp, MoreHorizontal, Pause, Pencil, Play, Plus, RefreshCw, Trash2 } from 'lucide-react'
import type { WhatsAppProfile } from '../../../shared/whatsapp'
import { formatUnreadCount } from '../../../shared/whatsapp'
import brandLogo from '../../../assets/brand/CoreDesk-logo-conceito.png'
import { useWhatsAppStore } from '../../store/useWhatsAppStore'
import { ProfileAvatar } from './ProfileAvatar'
import { ProfileModal } from './ProfileModal'

const stateLabel = { loading: 'Carregando', 'login-required': 'Aguardando login', connected: 'Conectado', disconnected: 'Desconectado', unknown: 'Estado desconhecido', suspended: 'Suspenso' } as const

export function CommunicationPage() {
  const profiles = useWhatsAppStore((state) => state.profiles)
  const runtime = useWhatsAppStore((state) => state.runtime)
  const createDialogOpen = useWhatsAppStore((state) => state.createDialogOpen)
  const setCreateDialogOpen = useWhatsAppStore((state) => state.setCreateDialogOpen)
  const openProfile = useWhatsAppStore((state) => state.openProfile)
  const suspendProfile = useWhatsAppStore((state) => state.suspendProfile)
  const resumeProfile = useWhatsAppStore((state) => state.resumeProfile)
  const reloadProfile = useWhatsAppStore((state) => state.reloadProfile)
  const removeProfile = useWhatsAppStore((state) => state.removeProfile)
  const reorderProfiles = useWhatsAppStore((state) => state.reorderProfiles)
  const [editing, setEditing] = useState<WhatsAppProfile>()
  const [menuFor, setMenuFor] = useState<string>()

  const move = (index: number, offset: number) => {
    const next = [...profiles]
    const target = index + offset
    if (!next[target]) return
    ;[next[index], next[target]] = [next[target], next[index]]
    void reorderProfiles(next.map((profile) => profile.id))
  }

  const remove = async (profile: WhatsAppProfile) => {
    const erase = window.confirm('Deseja apagar também todos os dados da sessão?\n\nOK: remover e apagar a sessão.\nCancelar: manter o perfil.')
    if (!erase) {
      const preserve = window.confirm('Remover o perfil preservando os dados da sessão? Esta é a opção mais segura.')
      if (!preserve) return
    }
    await removeProfile(profile.id, erase)
  }

  return (
    <div className="h-full overflow-auto bg-core-canvas p-5">
      <div className="mx-auto max-w-4xl">
        <div className="mb-5 flex items-center justify-between"><div><h1 className="text-base font-semibold text-white">Comunicação</h1><p className="mt-1 text-xs text-slate-500">Perfis independentes do WhatsApp Web</p></div><button onClick={() => setCreateDialogOpen(true)} className="flex items-center gap-2 rounded-md bg-core-accent px-3 py-2 text-xs font-semibold text-slate-950"><Plus size={14} /> Adicionar perfil</button></div>
        {profiles.length === 0 ? (
          <div className="flex min-h-[480px] flex-col items-center justify-center rounded-lg border border-dashed border-core-line bg-core-panel/30 text-center">
            <img src={brandLogo} alt="CoreDesk" className="mb-6 h-32 w-auto opacity-80" />
            <h2 className="text-sm font-medium text-white">Nenhum perfil de comunicação configurado.</h2><p className="mt-2 text-xs text-slate-500">Adicione uma conta para começar.</p>
            <button onClick={() => setCreateDialogOpen(true)} className="mt-5 flex items-center gap-2 rounded-md border border-core-accent/40 px-3 py-2 text-xs text-core-accent hover:bg-core-accent/10"><Plus size={14} /> Adicionar perfil</button>
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-core-line bg-core-panel">
            {profiles.map((profile, index) => {
              const status = runtime[profile.id]
              const connectionState = profile.suspended ? 'suspended' : (status?.connectionState ?? 'unknown')
              return <div key={profile.id} className="relative flex items-center gap-3 border-b border-core-line px-4 py-3 last:border-0">
                <ProfileAvatar profile={profile} />
                <div className="min-w-0 flex-1"><div className="flex items-center gap-2"><span className="truncate text-sm font-medium text-white">{profile.name}</span>{Boolean(status?.unreadCount) && <span className="rounded-full bg-core-accent px-1.5 py-0.5 text-[9px] font-bold text-slate-950">{formatUnreadCount(status.unreadCount)}</span>}</div><div className="mt-1 flex items-center gap-2 text-[11px] text-slate-500"><span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: profile.accentColor }} />{stateLabel[connectionState]}</div></div>
                <button onClick={() => void openProfile(profile.id)} className="flex items-center gap-1 rounded-md border border-core-line px-2.5 py-1.5 text-xs text-slate-300 hover:bg-white/5"><Play size={12} /> Abrir</button>
                <button onClick={() => move(index, -1)} disabled={index === 0} className="rounded p-1.5 text-slate-500 hover:bg-white/5 disabled:opacity-20" aria-label="Mover para cima"><ArrowUp size={14} /></button><button onClick={() => move(index, 1)} disabled={index === profiles.length - 1} className="rounded p-1.5 text-slate-500 hover:bg-white/5 disabled:opacity-20" aria-label="Mover para baixo"><ArrowDown size={14} /></button>
                <button onClick={() => setMenuFor(menuFor === profile.id ? undefined : profile.id)} onContextMenu={(event) => { event.preventDefault(); setMenuFor(profile.id) }} className="rounded p-1.5 text-slate-500 hover:bg-white/5" aria-label={`Menu de ${profile.name}`}><MoreHorizontal size={15} /></button>
                {menuFor === profile.id && <div className="absolute right-3 top-11 z-20 w-44 rounded-md border border-core-line bg-core-raised p-1 text-xs shadow-xl">
                  <button onClick={() => { setEditing(profile); setMenuFor(undefined) }} className="flex w-full items-center gap-2 rounded px-2 py-2 text-slate-300 hover:bg-white/5"><Pencil size={13} /> Renomear / cor</button>
                  <button onClick={() => void reloadProfile(profile.id)} className="flex w-full items-center gap-2 rounded px-2 py-2 text-slate-300 hover:bg-white/5"><RefreshCw size={13} /> Recarregar</button>
                  <button onClick={() => void (profile.suspended ? resumeProfile(profile.id) : suspendProfile(profile.id))} className="flex w-full items-center gap-2 rounded px-2 py-2 text-slate-300 hover:bg-white/5">{profile.suspended ? <Play size={13} /> : <Pause size={13} />}{profile.suspended ? 'Retomar' : 'Suspender'}</button>
                  <button onClick={() => void remove(profile)} className="flex w-full items-center gap-2 rounded px-2 py-2 text-red-400 hover:bg-red-500/10"><Trash2 size={13} /> Remover perfil</button>
                </div>}
              </div>
            })}
          </div>
        )}
      </div>
      {(createDialogOpen || editing) && <ProfileModal profile={editing} onClose={() => { setEditing(undefined); setCreateDialogOpen(false) }} />}
    </div>
  )
}
