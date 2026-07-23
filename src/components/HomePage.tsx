import { Activity, FilePlus2, MapPinned, MessageCircle, Route, Send, Sparkles } from 'lucide-react'
import { getGreeting } from '../../shared/core/home'
import coreDeskLogo from '../assets/coredesk-logo.png'
import { Badge, Button, Divider, IconButton, Surface } from '../design-system'
import { useAppearanceStore, type ThemeMode } from '../store/useAppearanceStore'
import { runHomeQuickAction, type HomeQuickAction } from '../utils/homeNavigation'

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
  return (
    <div className="home-page h-full min-h-0 overflow-x-hidden overflow-y-auto px-4 py-6 sm:px-6 lg:px-8">
      <section aria-labelledby="home-title" className="mx-auto flex min-h-full w-full max-w-5xl flex-col justify-center">
        <div className="home-hero text-center">
          <div className="home-logo-frame home-logo-breathe mx-auto">
            <img
              src={coreDeskLogo}
              alt="Logotipo completo do CoreDesk"
              className="home-logo home-logo-enter block h-auto w-full object-contain"
            />
          </div>
          <div className="home-copy-enter">
            <p className="mt-4 text-xs font-semibold uppercase tracking-[0.24em] text-core-accent">{getGreeting(now).toUpperCase()}</p>
            <h1 id="home-title" className="mt-2 text-3xl font-semibold tracking-tight text-core-text sm:text-4xl">Bem-vindo ao CoreDesk</h1>
            <p className="mx-auto mt-3 max-w-xl text-sm font-medium leading-6 text-core-text sm:text-base">Sua central inteligente de operações.</p>
            <p className="mx-auto mt-1 max-w-2xl text-xs leading-5 text-core-muted sm:text-sm">Atendimentos, comunicação, rotas e orçamentos em um único lugar.</p>
          </div>
        </div>

        <Divider className="my-6 sm:my-8" />

        <section aria-labelledby="quick-access-title">
          <h2 id="quick-access-title" className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-core-muted">Acesso rápido</h2>
          <div className="home-shortcuts grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {quickActions.map(({ id, label, description, icon: Icon }) => (
              <Button
                key={id}
                variant="secondary"
                onClick={() => runHomeQuickAction(id)}
                aria-label={label}
                className="home-shortcut min-w-0 justify-start text-left"
              >
                <span className="home-shortcut-icon grid h-8 w-8 shrink-0 place-items-center rounded-md"><Icon aria-hidden="true" size={19} /></span>
                <span className="min-w-0"><strong className="block truncate text-xs text-core-text">{label}</strong><small className="mt-0.5 block truncate text-[10px] font-normal text-core-muted">{description}</small></span>
              </Button>
            ))}
          </div>
        </section>

        <div className="mt-5 grid min-w-0 gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(14rem,1fr)]">
          <Surface role="region" aria-labelledby="corechat-title" aria-describedby="corechat-unavailable" className="home-corechat min-w-0 p-4">
            <div className="flex items-start gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-core-accent/10 text-core-accent"><Sparkles aria-hidden="true" size={17} /></span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2"><h2 id="corechat-title" className="text-sm font-semibold text-core-text">CoreChat</h2><Badge>Em breve</Badge></div>
                <p className="mt-1 text-xs text-core-muted">Assistente inteligente do CoreDesk</p>
              </div>
            </div>
            <div className="mt-3 flex min-w-0 items-center gap-2">
              <label htmlFor="corechat-preview" className="sr-only">CoreChat indisponível</label>
              <input id="corechat-preview" disabled aria-describedby="corechat-unavailable" placeholder="Pergunte qualquer coisa ao CoreChat..." className="home-corechat-input min-w-0 flex-1" />
              <IconButton disabled label="Enviar mensagem — CoreChat em breve"><Send aria-hidden="true" size={15} /></IconButton>
            </div>
            <p id="corechat-unavailable" className="sr-only">O CoreChat ainda não está disponível.</p>
          </Surface>
          <SystemStatus />
        </div>
      </section>
    </div>
  )
}
