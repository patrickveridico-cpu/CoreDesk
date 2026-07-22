import { Globe, MessageCircle, Pin, Plus, X } from 'lucide-react'
import { formatUnreadCount } from '../../shared/whatsapp'
import { useTabsStore } from '../store/useTabsStore'

export function TabStrip() {
  const { tabs, activeTabId, addWebTab, selectTab, closeTab } = useTabsStore()

  return (
    <nav className="window-interactive flex min-w-0 flex-1 items-end self-stretch overflow-x-auto" aria-label="Abas do workspace">
      {tabs.map((tab, index) => {
        const active = tab.id === activeTabId
        return (
          <div
            key={tab.id}
            role="tab"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            onClick={() => selectTab(tab.id)}
            onKeyDown={(event) => event.key === 'Enter' && selectTab(tab.id)}
            className={`group relative flex h-10 min-w-28 max-w-48 cursor-default items-center gap-2 border-r border-core-line px-3 text-xs transition-colors ${active ? 'bg-core-canvas text-white' : 'bg-core-panel text-slate-400 hover:bg-core-raised hover:text-slate-200'}`}
          >
            {active && <span className="absolute inset-x-0 top-0 h-0.5" style={{ backgroundColor: tab.accentColor ?? '#1cc8ee' }} />}
            {tab.icon ? (
              <img className="h-3.5 w-3.5 rounded-sm" src={tab.icon} alt="" />
            ) : tab.type === 'web' ? (
              <Globe size={12} className="text-slate-500" />
            ) : tab.type === 'whatsapp' ? (
              <MessageCircle size={12} style={{ color: tab.accentColor }} />
            ) : (
              <span className="text-[10px] text-slate-600">{index + 1}</span>
            )}
            <span className="min-w-0 flex-1 truncate">{tab.title}</span>
            {tab.pinned && <Pin size={10} className="shrink-0 text-slate-600" />}
            {Boolean(tab.unreadCount) && <span className="rounded-full bg-core-accent px-1 text-[8px] font-bold leading-4 text-slate-950">{formatUnreadCount(tab.unreadCount!)}</span>}
            {tab.closable && (
              <button
                className="rounded p-0.5 opacity-0 hover:bg-white/10 group-hover:opacity-100 focus:opacity-100"
                onClick={(event) => { event.stopPropagation(); closeTab(tab.id) }}
                aria-label={`Fechar ${tab.title}`}
              >
                <X size={12} />
              </button>
            )}
          </div>
        )
      })}
      <button className="grid h-10 w-10 shrink-0 place-items-center text-slate-500 hover:bg-core-raised hover:text-core-accent" onClick={() => addWebTab()} aria-label="Criar aba web">
        <Plus size={16} />
      </button>
    </nav>
  )
}
