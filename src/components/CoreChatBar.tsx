import { useEffect, useState } from 'react'
import { LoaderCircle, PanelLeftClose, PanelLeftOpen, RefreshCw, TriangleAlert, X } from 'lucide-react'
import type { WebViewStateUpdate } from '../../shared/contracts'
import { CORECHAT_VIEW_ID } from '../../shared/corechat'

const controlClass = 'ds-focus-ring inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-[11px] text-core-muted transition-colors hover:bg-white/5 hover:text-core-text disabled:cursor-not-allowed disabled:opacity-40'

export function CoreChatBar({ viewState, onClose }: { viewState: WebViewStateUpdate; onClose: () => void }) {
  const [compactEnabled, setCompactEnabled] = useState(true)
  const [changingMode, setChangingMode] = useState(false)

  useEffect(() => {
    let mounted = true
    void window.coreDesk?.coreChat.getCompact().then((enabled) => {
      if (mounted) setCompactEnabled(enabled)
    })
    return () => { mounted = false }
  }, [])

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

  const compactFallback = compactEnabled && viewState.coreChatCompact && !viewState.coreChatCompact.applied

  return (
    <header className="flex h-9 shrink-0 items-center gap-1 border-b border-core-line bg-core-panel px-2" aria-label="Controles do CoreChat">
      <strong className="px-1 text-xs font-semibold text-core-text">CoreChat</strong>
      <span className="min-w-0 flex-1 text-[10px] text-core-muted" role="status" aria-live="polite">
        {viewState.loading && <span className="inline-flex items-center gap-1"><LoaderCircle className="animate-spin text-core-accent" size={12} /> Carregando</span>}
        {viewState.error && <span className="inline-flex items-center gap-1 text-amber-300"><TriangleAlert size={12} /> Erro {viewState.error.code}</span>}
        {!viewState.loading && !viewState.error && compactFallback && <span title={viewState.coreChatCompact?.reason}>Interface completa (fallback seguro)</span>}
      </span>
      <button type="button" className={controlClass} onClick={() => window.coreDesk?.views.reload(CORECHAT_VIEW_ID)} aria-label="Recarregar CoreChat" title="Recarregar CoreChat"><RefreshCw size={13} /></button>
      <button type="button" className={controlClass} onClick={() => void toggleCompact()} disabled={changingMode} aria-pressed={compactEnabled} aria-label={compactEnabled ? 'Mostrar interface completa' : 'Usar modo compacto'} title={compactEnabled ? 'Mostrar interface completa' : 'Usar modo compacto'}>
        {compactEnabled ? <PanelLeftOpen size={14} /> : <PanelLeftClose size={14} />}
        <span className="hidden xl:inline">{compactEnabled ? 'Completa' : 'Compacta'}</span>
      </button>
      <button type="button" className={controlClass} onClick={onClose} aria-label="Fechar CoreChat" title="Fechar CoreChat"><X size={15} /></button>
    </header>
  )
}
