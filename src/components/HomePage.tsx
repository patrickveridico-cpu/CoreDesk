import { FilePlus2, MapPinned, MessageCircle, Route, Sparkles } from 'lucide-react'
import { getGreeting } from '../../shared/core/home'
import coreDeskLogo from '../assets/coredesk-logo.png'
import { Badge, Button, Divider, Surface } from '../design-system'
import { runHomeQuickAction, type HomeQuickAction } from '../utils/homeNavigation'

const quickActions = [
  { id: 'new-budget', label: 'Novo orçamento', description: 'Iniciar um atendimento', icon: FilePlus2 },
  { id: 'whatsapp', label: 'WhatsApp', description: 'Abrir comunicação', icon: MessageCircle },
  { id: 'maps', label: 'Google Maps', description: 'Consultar mapas e rotas', icon: MapPinned },
  { id: 'operations', label: 'Operações', description: 'Acessar o workspace', icon: Route },
] satisfies Array<{ id: HomeQuickAction; label: string; description: string; icon: typeof FilePlus2 }>

export function HomePage({ now }: { now?: Date }) {
  return (
    <div className="home-page h-full min-h-0 overflow-x-hidden overflow-y-auto px-4 py-6 sm:px-6 lg:px-8">
      <section aria-labelledby="home-title" className="mx-auto flex min-h-full w-full max-w-5xl flex-col justify-center">
        <div className="home-hero text-center">
          <img
            src={coreDeskLogo}
            alt="Logotipo completo do CoreDesk"
            className="home-logo home-logo-enter mx-auto block h-auto object-contain"
          />
          <div className="home-copy-enter">
            <p className="mt-4 text-xs font-semibold uppercase tracking-[0.24em] text-core-accent">{getGreeting(now).toUpperCase()}</p>
            <h1 id="home-title" className="mt-2 text-3xl font-semibold tracking-tight text-core-text sm:text-4xl">Bem-vindo ao CoreDesk.</h1>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-core-muted sm:text-base">
              <span className="block">Tudo o que você precisa.</span>
              <span className="block">Em um único lugar.</span>
            </p>
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
                <span className="home-shortcut-icon grid h-9 w-9 shrink-0 place-items-center rounded-md"><Icon aria-hidden="true" size={17} /></span>
                <span className="min-w-0"><strong className="block truncate text-xs text-core-text">{label}</strong><small className="mt-0.5 block truncate text-[10px] font-normal text-core-muted">{description}</small></span>
              </Button>
            ))}
          </div>
        </section>

        <Surface className="home-corechat mt-5 flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-core-accent/10 text-core-accent"><Sparkles aria-hidden="true" size={18} /></span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2"><h2 className="text-sm font-semibold text-core-text">CoreChat</h2><Badge>Em breve</Badge></div>
            <p className="mt-1 text-xs text-core-muted">Assistente inteligente do CoreDesk.</p>
          </div>
        </Surface>
      </section>
    </div>
  )
}
