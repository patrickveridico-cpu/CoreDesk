import { useEffect, useMemo, useState } from 'react'
import { Home, Map, MessageSquare, Minus, Pin, Plus, Route, Search, Settings, X } from 'lucide-react'
import { SHELL_LAYOUT } from '../../shared/layout'
import { formatUnreadCount } from '../../shared/whatsapp'
import { useTabsStore } from '../store/useTabsStore'
import { useWhatsAppStore } from '../store/useWhatsAppStore'
import { ProfileAvatar } from './communication/ProfileAvatar'
import { buildGoogleSearchUrl } from '../utils/moduleNavigation'

const moduleButton = 'module-button toolbar-icon-button relative grid h-10 w-10 shrink-0 place-items-center rounded-md text-slate-500 hover:bg-white/5 hover:text-slate-200'

function WebGuideTabs() {
  const allTabs = useTabsStore((state) => state.tabs)
  const tabs = useMemo(
    () => allTabs.filter((tab) => tab.id === 'app-google' || tab.id === 'app-maps'),
    [allTabs],
  )
  const activeTabId = useTabsStore((state) => state.activeTabId)
  const openWorkspaceWebTab = useTabsStore((state) => state.openWorkspaceWebTab)
  const toggleWebTabPinned = useTabsStore((state) => state.toggleWebTabPinned)
  const closeTab = useTabsStore((state) => state.closeTab)
  const navigate = (id: string, query: string) => { const url = buildGoogleSearchUrl(query); if (url) window.coreDesk?.views.navigate(id, url) }
  const [query, setQuery] = useState('')
  if (!tabs.length) return <div className="min-w-0 flex-1" />
  return <div className="flex min-w-0 flex-1 items-center justify-center gap-1 overflow-x-auto px-2" role="tablist" aria-label="Guias web">
    {tabs.map((tab) => { const active = activeTabId === tab.id; const google = tab.id === 'app-google'; return <div key={tab.id} role="tab" aria-selected={active} aria-controls="workspace-content" data-active={active} title={tab.title} className={`web-guide-tab group relative flex h-8 max-w-56 min-w-0 items-center gap-1 rounded-md border px-2 text-xs ${active ? 'border-core-accent/60 bg-core-accent/10 text-white' : 'border-transparent text-slate-400 hover:bg-white/5'}`}>
      <button onClick={() => openWorkspaceWebTab(tab.id as 'app-google' | 'app-maps')} className="flex min-w-0 items-center gap-1.5" aria-label={`Abrir ${tab.title}`}><span>{google ? '⌕' : '⌖'}</span><span className="truncate">{google ? 'Google' : 'Maps'}</span></button>
      {active && google && <form onSubmit={(event) => { event.preventDefault(); navigate(tab.id, query) }}><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Pesquisar" aria-label="Pesquisar no Google" className="w-24 min-w-0 bg-transparent text-[11px] text-white outline-none placeholder:text-slate-600" /></form>}
      <button onClick={() => toggleWebTabPinned(tab.id as 'app-google' | 'app-maps')} aria-label={tab.pinned ? 'Desafixar guia' : 'Fixar guia'} title={tab.pinned ? 'Desafixar' : 'Fixar'} data-pinned={tab.pinned} className={`tab-action grid h-6 w-6 place-items-center rounded hover:bg-white/10 ${tab.pinned ? 'text-core-accent' : 'text-slate-600'}`}><Pin size={12} /></button>
      <button onClick={() => closeTab(tab.id)} aria-label={`Fechar ${tab.title}`} title="Fechar" className="tab-action tab-close-action grid h-6 w-6 place-items-center rounded text-slate-500 hover:bg-white/10 hover:text-white"><X size={13} /></button>
    </div> })}
  </div>
}

function ZoomControls() {
  const [factor, setFactor] = useState(1)
  useEffect(() => {
    let mounted = true
    void window.coreDesk?.zoom.get().then((value) => { if (mounted) setFactor(value) })
    const remove = window.coreDesk?.zoom.onChanged(setFactor)
    return () => { mounted = false; remove?.() }
  }, [])
  const setZoom = (value: number) => { void window.coreDesk?.zoom.set(Math.min(1.5, Math.max(0.7, Math.round(value * 10) / 10))).then(setFactor) }
  const percentage = Math.round(factor * 100)
  return <div className="toolbar-control flex h-8 shrink-0 items-center rounded-md border border-core-line bg-core-canvas/60" role="group" aria-label="Zoom da interface">
    <button type="button" onClick={() => setZoom(factor - 0.1)} disabled={factor <= 0.7} className="grid h-8 w-8 place-items-center text-slate-400 hover:bg-white/5 hover:text-white disabled:cursor-not-allowed disabled:opacity-35" title="Diminuir zoom (Ctrl+-)" aria-label="Diminuir zoom"><Minus size={13} /></button>
    <button type="button" onClick={() => setZoom(1)} className="h-8 min-w-12 border-x border-core-line px-2 text-[10px] font-semibold text-slate-300 hover:bg-white/5 hover:text-white" title="Restaurar zoom para 100% (Ctrl+0)" aria-label={`Restaurar zoom para 100%. Zoom atual ${percentage}%`}>{percentage}%</button>
    <button type="button" onClick={() => setZoom(factor + 0.1)} disabled={factor >= 1.5} className="grid h-8 w-8 place-items-center text-slate-400 hover:bg-white/5 hover:text-white disabled:cursor-not-allowed disabled:opacity-35" title="Aumentar zoom (Ctrl++)" aria-label="Aumentar zoom"><Plus size={13} /></button>
  </div>
}

export function GlobalTopBar() {
  const { activeTabId, selectTab, openInternalTab, openWorkspaceWebTab } = useTabsStore()
  const profiles = useWhatsAppStore((state) => state.profiles)
  const runtime = useWhatsAppStore((state) => state.runtime)
  const openProfile = useWhatsAppStore((state) => state.openProfile)
  const suspendProfile = useWhatsAppStore((state) => state.suspendProfile)
  const resumeProfile = useWhatsAppStore((state) => state.resumeProfile)
  const reloadProfile = useWhatsAppStore((state) => state.reloadProfile)
  const clearSession = useWhatsAppStore((state) => state.clearSession)
  const removeProfile = useWhatsAppStore((state) => state.removeProfile)
  const updateProfile = useWhatsAppStore((state) => state.updateProfile)
  const selectIcon = useWhatsAppStore((state) => state.selectIcon)
  const setCreateDialogOpen = useWhatsAppStore((state) => state.setCreateDialogOpen)
  const [menuProfileId, setMenuProfileId] = useState<string>()
  const openCommunication = () => openInternalTab('communication', 'Comunicação')
  const addProfile = () => { openCommunication(); setCreateDialogOpen(true) }
  const openGoogle = () => openWorkspaceWebTab('app-google')
  const openMaps = () => openWorkspaceWebTab('app-maps')
  const remove = async (id: string) => { const clear = window.confirm('Apagar também todos os dados da sessão?'); if (!clear && !window.confirm('Remover preservando os dados da sessão?')) return; await removeProfile(id, clear) }
  return <aside data-testid="coredesk-topbar" data-debug="coredesk-topbar" className="core-toolbar relative z-[100] flex shrink-0 items-center gap-2 border-b border-core-line bg-core-panel px-2 text-slate-100" style={{ height: SHELL_LAYOUT.globalBarHeight }} onClick={() => menuProfileId && setMenuProfileId(undefined)}>
    <button onClick={() => selectTab('home')} data-active={activeTabId === 'home'} className={`${moduleButton} ${activeTabId === 'home' ? 'bg-core-accent/10 text-core-accent' : ''}`} title="Início" aria-label="Início"><Home size={18} /></button>
    <div className="mx-1 h-6 w-px shrink-0 bg-core-line" />
    <div className="flex min-w-0 shrink-0 items-center gap-2 overflow-x-auto px-1">{profiles.map((profile) => { const active = activeTabId === `whatsapp:${profile.id}`; const status = runtime[profile.id]; return <button key={profile.id} data-active={active} title={`${profile.name} · ${profile.suspended ? 'Suspenso' : status?.connectionState ?? 'Sessão ativa'}`} aria-label={profile.name} onClick={(event) => { event.stopPropagation(); void (profile.suspended ? resumeProfile(profile.id) : openProfile(profile.id)) }} onContextMenu={(event) => { event.preventDefault(); event.stopPropagation(); setMenuProfileId(profile.id) }} className={`profile-tab relative grid h-10 w-10 shrink-0 place-items-center rounded-md ${active ? 'bg-white/8 ring-1 ring-core-accent/50' : 'hover:bg-white/5'}`}>{active && <span className="active-tab-indicator absolute -bottom-1 left-2 h-0.5 w-6 rounded bg-core-accent" />}<ProfileAvatar profile={profile} size="sm" /><span className={`absolute bottom-1 right-1 h-2 w-2 rounded-full border border-core-panel ${profile.suspended ? 'bg-slate-500' : status?.connectionState === 'disconnected' ? 'bg-red-400' : status?.connectionState === 'loading' ? 'bg-amber-300' : 'bg-cyan-400'}`} />{Boolean(status?.unreadCount) && <span key={status?.unreadCount} className="unread-badge absolute right-0 top-0 min-w-4 rounded-full bg-core-accent px-1 text-[8px] font-bold leading-4 text-slate-950">{formatUnreadCount(status.unreadCount)}</span>}</button> })}<button onClick={addProfile} className="toolbar-icon-button grid h-10 w-10 shrink-0 place-items-center rounded-md border border-dashed border-core-line text-slate-600 hover:border-core-accent/50 hover:text-core-accent" title="Adicionar perfil" aria-label="Adicionar perfil"><Plus size={16} /></button></div>
    <WebGuideTabs />
    <div className="mx-1 h-6 w-px shrink-0 bg-core-line" />
    <button onClick={openCommunication} data-active={activeTabId === 'communication'} className={`${moduleButton} ${activeTabId === 'communication' ? 'bg-core-accent/10 text-core-accent' : ''}`} title="Comunicação" aria-label="Comunicação"><MessageSquare size={18} /></button>
    <button onClick={() => openInternalTab('routes', 'Operações')} data-active={activeTabId === 'routes'} className={`${moduleButton} ${activeTabId === 'routes' ? 'bg-core-accent/10 text-core-accent' : ''}`} title="Operações" aria-label="Operações"><Route size={18} /></button>
    <button onClick={openMaps} data-active={activeTabId === 'app-maps'} className={`${moduleButton} ${activeTabId === 'app-maps' ? 'bg-core-accent/10 text-core-accent' : ''}`} title="Abrir Maps" aria-label="Abrir Maps"><Map size={18} /></button>
    <button onClick={openGoogle} data-active={activeTabId === 'app-google'} className={`${moduleButton} ${activeTabId === 'app-google' ? 'bg-core-accent/10 text-core-accent' : ''}`} title="Abrir Google" aria-label="Abrir Google"><Search size={18} /></button>
    <ZoomControls />
    <button onClick={() => openInternalTab('settings', 'Configurações')} data-active={activeTabId === 'settings'} className={`${moduleButton} ${activeTabId === 'settings' ? 'bg-core-accent/10 text-core-accent' : ''}`} title="Configurações" aria-label="Configurações"><Settings size={18} /></button>
    {menuProfileId && (() => { const profile = profiles.find((item) => item.id === menuProfileId); if (!profile) return null; return <div onClick={(event) => event.stopPropagation()} className="profile-menu absolute right-2 top-11 z-50 w-48 rounded-md border border-core-line bg-core-raised p-1 text-xs"><button onClick={() => void openProfile(profile.id)} className="w-full rounded px-2 py-2 text-left text-slate-300 hover:bg-white/5">Abrir</button><button onClick={() => { const name = window.prompt('Novo nome', profile.name); if (name) void updateProfile(profile.id, { name }) }} className="w-full rounded px-2 py-2 text-left text-slate-300 hover:bg-white/5">Renomear</button><button onClick={() => void selectIcon(profile.id)} className="w-full rounded px-2 py-2 text-left text-slate-300 hover:bg-white/5">Alterar ícone</button><button onClick={() => { const accentColor = window.prompt('Cor hexadecimal', profile.accentColor); if (accentColor) void updateProfile(profile.id, { accentColor }) }} className="w-full rounded px-2 py-2 text-left text-slate-300 hover:bg-white/5">Alterar cor</button><button onClick={() => void reloadProfile(profile.id)} className="w-full rounded px-2 py-2 text-left text-slate-300 hover:bg-white/5">Recarregar</button><button onClick={() => void (profile.suspended ? resumeProfile(profile.id) : suspendProfile(profile.id))} className="w-full rounded px-2 py-2 text-left text-slate-300 hover:bg-white/5">{profile.suspended ? 'Retomar' : 'Suspender'}</button><button onClick={() => { if (window.confirm('Esta ação desconectará o WhatsApp deste perfil.')) void clearSession(profile.id) }} className="w-full rounded px-2 py-2 text-left text-amber-300 hover:bg-amber-500/10">Sair da conta</button><button onClick={() => void remove(profile.id)} className="w-full rounded px-2 py-2 text-left text-red-400 hover:bg-red-500/10">Remover perfil</button></div> })()}
  </aside>
}
