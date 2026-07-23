import { useEffect, useState } from 'react'
import { ArrowLeft, LoaderCircle, PanelLeftClose, PanelLeftOpen, RefreshCw, TriangleAlert } from 'lucide-react'
import { CORECHAT_VIEW_ID } from '../../shared/corechat'
import { SHELL_LAYOUT } from '../../shared/layout'
import { useTabsStore } from '../store/useTabsStore'

const controlClass = 'ds-focus-ring inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-[11px] text-core-muted transition-colors hover:bg-white/5 hover:text-core-text disabled:cursor-not-allowed disabled:opacity-40'

export function CoreChatBar() {
  const activeTabId = useTabsStore((state) => state.activeTabId)
  const tab = useTabsStore((state) => state.tabs.find((item) => item.id === CORECHAT_VIEW_ID))
  const selectTab = useTabsStore((state) => state.selectTab)
  const [compactEnabled, setCompactEnabled] = useState(true)
  const [changingMode, setChangingMode] = useState(false)

  useEffect(() => {
    if (activeTabId !== CORECHAT_VIEW_ID) return
    let mounted = true
    void window.coreDesk?.coreChat.getCompact().then((enabled) => {
      if (mounted) setCompactEnabled(enabled)
    })
    return () => { mounted = false }
  }, [activeTabId])

  if (activeTabId !== CORECHAT_VIEW_ID || !tab) return null

  const toggleCompact = async () => {
    if (!window.coreDesk?.coreChat) return
    setChangingMode(true)
    try {
      const result = await window.coreDesk.coreChat.setCompact(!compactEnabled)
      setCompactEnabled(result.enabled)
    } finally {
      setChangingMode(false)
    }
  }

  const compactFallback = compactEnabled && tab.coreChatCompact && !tab.coreChatCompact.applied

  return (
    <div className="relative flex shrink-0 items-center gap-1 border-b border-core-line bg-core-panel px-2" style={{ height: SHELL_LAYOUT.navigationBarHeight }} aria-label="Controles do CoreChat">
      <button type="button" className={controlClass} onClick={() => selectTab('home')} aria-label="Voltar para a Home" title="Voltar para a Home"><ArrowLeft size={14} /> Home</button>
      <button type="button" className={controlClass} onClick={() => window.coreDesk?.views.reload(CORECHAT_VIEW_ID)} aria-label="Recarregar CoreChat" title="Recarregar CoreChat"><RefreshCw size={13} /> Recarregar</button>
      <button type="button" className={controlClass} onClick={() => void toggleCompact()} disabled={changingMode} aria-pressed={compactEnabled} aria-label={compactEnabled ? 'Mostrar interface completa' : 'Usar modo compacto'} title={compactEnabled ? 'Mostrar interface completa' : 'Usar modo compacto'}>
        {compactEnabled ? <PanelLeftOpen size={14} /> : <PanelLeftClose size={14} />}
        {compactEnabled ? 'Interface completa' : 'Modo compacto'}
      </button>
      <span className="ml-auto flex min-w-0 items-center gap-1.5 text-[10px] text-core-muted" role="status">
        {tab.loading && <><LoaderCircle className="animate-spin text-core-accent" size={12} /> Carregando</>}
        {tab.error && <><TriangleAlert className="text-amber-300" size={12} /> Erro {tab.error.code}</>}
        {!tab.loading && !tab.error && compactFallback && <span title={tab.coreChatCompact?.reason}>Interface completa (fallback seguro)</span>}
      </span>
    </div>
  )
}
