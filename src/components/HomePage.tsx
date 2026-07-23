import { useEffect, useRef, useState } from 'react'
import { Activity, FilePlus2, MapPinned, MessageCircle, Route, Sparkles } from 'lucide-react'
import { getGreeting } from '../../shared/core/home'
import { CORECHAT_VIEW_ID, reduceCoreChatPanelPhase, type CoreChatPanelPhase } from '../../shared/corechat'
import coreDeskLogo from '../assets/coredesk-logo.png'
import { Button, Divider, Surface } from '../design-system'
import { useCoreChatPanelView } from '../hooks/useCoreChatPanelView'
import { useAppearanceStore, type ThemeMode } from '../store/useAppearanceStore'
import { runHomeQuickAction, type HomeQuickAction } from '../utils/homeNavigation'
import { CoreChatBar } from './CoreChatBar'

const quickActions = [
  { id: 'new-budget', label: 'Novo orçamento', description: 'Iniciar um atendimento', icon: FilePlus2 },
  { id: 'whatsapp', label: 'WhatsApp', description: 'Abrir comunicação', icon: MessageCircle },
  { id: 'maps', label: 'Google Maps', description: 'Consultar mapas e rotas', icon: MapPinned },
  { id: 'operations', label: 'Operações', description: 'Acessar o workspace', icon: Route },
] satisfies Array<{ id: HomeQuickAction; label: string; description: string; icon: typeof FilePlus2 }>

const themeLabels: Record<ThemeMode, string> = { dark: 'Escuro', light: 'Claro', system: 'Sistema' }

function SystemStatus() {
  const themeMode = useAppearanceStore((state) => state.themeMode)
  const motionEnabled = useAppearanceStore((state) => state.motionEnabled)
  const soundEnabled = useAppearanceStore((state) => state.soundEnabled)
  return (
    <Surface role="region" aria-labelledby="system-status-title" className="home-status p-4">
      <div className="flex items-center gap-2"><Activity aria-hidden="true" size={16} className="text-core-accent" /><h2 id="system-status-title" className="text-sm font-semibold text-core-text">Status do sistema</h2></div>
      <dl className="mt-3 grid gap-2 text-xs">
        <div className="flex items-center justify-between gap-3"><dt className="text-core-muted">Tema</dt><dd className="font-medium text-core-text">{themeLabels[themeMode]}</dd></div>
        <div className="flex items-center justify-between gap-3"><dt className="text-core-muted">Animações</dt><dd className="font-medium text-core-text">{motionEnabled ? 'Ativadas' : 'Desativadas'}</dd></div>
        <div className="flex items-center justify-between gap-3"><dt className="text-core-muted">Sons</dt><dd className="font-medium text-core-text">{soundEnabled ? 'Ativados' : 'Desativados'}</dd></div>
      </dl>
    </Surface>
  )
}

export function HomePage({ now }: { now?: Date }) {
  const [coreChatPhase, setCoreChatPhase] = useState<CoreChatPanelPhase>('closed')
  const coreChatContainerRef = useRef<HTMLDivElement>(null)
  const openCoreChatButtonRef = useRef<HTMLButtonElement>(null)
  const shouldReturnFocusRef = useRef(false)
  const motionEnabled = useAppearanceStore((state) => state.motionEnabled)
  const systemReducedMotion = useAppearanceStore((state) => state.systemReducedMotion)
  const reducedMotion = !motionEnabled || systemReducedMotion
  const panelVisible = coreChatPhase !== 'closed'
  const panelExpanded = coreChatPhase === 'opening' || coreChatPhase === 'open'
  const coreChatViewState = useCoreChatPanelView(coreChatPhase, coreChatContainerRef)

  useEffect(() => {
    if (coreChatPhase !== 'opening') return
    const frame = window.requestAnimationFrame(() => {
      setCoreChatPhase((phase) => reduceCoreChatPanelPhase(phase, 'frame', reducedMotion))
    })
    return () => window.cancelAnimationFrame(frame)
  }, [coreChatPhase, reducedMotion])

  useEffect(() => {
    if (coreChatPhase !== 'closed' || !shouldReturnFocusRef.current) return
    shouldReturnFocusRef.current = false
    openCoreChatButtonRef.current?.focus()
  }, [coreChatPhase])

  const openCoreChat = () => {
    shouldReturnFocusRef.current = true
    setCoreChatPhase((phase) => reduceCoreChatPanelPhase(phase, 'open', reducedMotion))
  }

  const closeCoreChat = () => {
    setCoreChatPhase((phase) => reduceCoreChatPanelPhase(phase, 'close', reducedMotion))
  }

  const finishClosingTransition = (event: React.TransitionEvent<HTMLDivElement>) => {
    if (event.currentTarget !== event.target || coreChatPhase !== 'closing') return
    setCoreChatPhase((phase) => reduceCoreChatPanelPhase(phase, 'transition-end', reducedMotion))
  }

  return (
    <div className="home-page h-full min-h-0 overflow-x-hidden overflow-y-auto p-3 sm:p-4 lg:p-5">
      <div className="home-split mx-auto grid min-h-full w-full max-w-[90rem] min-w-0" data-open={panelExpanded} data-phase={coreChatPhase} onTransitionEnd={finishClosingTransition}>
        <section aria-labelledby="home-title" className={`home-split-main flex min-h-0 min-w-0 flex-col justify-center overflow-y-auto ${panelVisible ? 'px-2 py-3 sm:px-3' : 'mx-auto w-full max-w-5xl px-1 py-2'}`}>
          <div className="home-hero text-center">
            <div className={`home-logo-frame home-logo-breathe mx-auto ${panelVisible ? 'home-logo-frame-compact' : ''}`}>
              <img src={coreDeskLogo} alt="Logotipo completo do CoreDesk" className="home-logo home-logo-enter block h-auto w-full object-contain" />
            </div>
            <div className="home-copy-enter">
              <p className={`${panelVisible ? 'mt-2' : 'mt-4'} text-xs font-semibold uppercase tracking-[0.24em] text-core-accent`}>{getGreeting(now).toUpperCase()}</p>
              <h1 id="home-title" className={`${panelVisible ? 'mt-1 text-2xl sm:text-3xl' : 'mt-2 text-3xl sm:text-4xl'} font-semibold tracking-tight text-core-text`}>Bem-vindo ao CoreDesk</h1>
              <p className="mx-auto mt-3 max-w-xl text-sm font-medium leading-6 text-core-text sm:text-base">Sua central inteligente de operações.</p>
              {!panelVisible && <p className="mx-auto mt-1 max-w-2xl text-xs leading-5 text-core-muted sm:text-sm">Atendimentos, comunicação, rotas e orçamentos em um único lugar.</p>}
            </div>
          </div>

          <Divider className={panelVisible ? 'my-4' : 'my-6 sm:my-8'} />

          <section aria-labelledby="quick-access-title">
            <h2 id="quick-access-title" className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-core-muted">Acesso rápido</h2>
            <div className={`home-shortcuts grid gap-2 ${panelVisible ? 'grid-cols-2' : 'sm:grid-cols-2 lg:grid-cols-4'}`}>
              {quickActions.map(({ id, label, description, icon: Icon }) => (
                <Button key={id} variant="secondary" onClick={() => runHomeQuickAction(id)} aria-label={label} className="home-shortcut min-w-0 justify-start text-left">
                  <span className="home-shortcut-icon grid h-8 w-8 shrink-0 place-items-center rounded-md"><Icon aria-hidden="true" size={19} /></span>
                  <span className="min-w-0"><strong className="block truncate text-xs text-core-text">{label}</strong>{!panelVisible && <small className="mt-0.5 block truncate text-[10px] font-normal text-core-muted">{description}</small>}</span>
                </Button>
              ))}
            </div>
          </section>

          {!panelVisible && <div className="mt-5 grid min-w-0 gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(14rem,1fr)]">
            <Surface role="region" aria-labelledby="corechat-title" className="home-corechat min-w-0 p-4">
              <div className="flex items-start gap-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-core-accent/10 text-core-accent"><Sparkles aria-hidden="true" size={17} /></span>
                <div className="min-w-0 flex-1"><h2 id="corechat-title" className="text-sm font-semibold text-core-text">CoreChat</h2><p className="mt-1 text-xs text-core-muted">Pesquisas rápidas com ChatGPT</p></div>
              </div>
              <Button ref={openCoreChatButtonRef} variant="primary" onClick={openCoreChat} className="mt-3" aria-expanded={panelExpanded} aria-controls="corechat-panel">Abrir CoreChat</Button>
            </Surface>
            <SystemStatus />
          </div>}
        </section>

        <aside id="corechat-panel" aria-label="CoreChat" aria-hidden={!panelVisible} className="home-corechat-panel min-h-0 min-w-0 overflow-hidden rounded-xl border border-core-line bg-core-panel shadow-xl shadow-black/20">
          {panelVisible && <CoreChatBar viewState={coreChatViewState} onClose={closeCoreChat} />}
          <div ref={coreChatContainerRef} data-testid="corechat-view-container" className="relative min-h-0 w-full flex-1 overflow-hidden bg-core-canvas">
            {panelVisible && !coreChatViewState.error && <span role="status" aria-live="polite" className="pointer-events-none absolute inset-0 grid place-items-center text-xs text-core-muted">Carregando CoreChat...</span>}
            {panelVisible && coreChatViewState.error && <div className="grid h-full place-items-center p-5 text-center"><div><p className="text-sm font-medium text-core-text">Não foi possível carregar o CoreChat.</p><p className="mt-1 text-xs text-core-muted">Erro {coreChatViewState.error.code}: {coreChatViewState.error.description}</p><Button className="mt-3" onClick={() => window.coreDesk?.views.retry(CORECHAT_VIEW_ID)}>Tentar novamente</Button></div></div>}
          </div>
        </aside>
      </div>
    </div>
  )
}
