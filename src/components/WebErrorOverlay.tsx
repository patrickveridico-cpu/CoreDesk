import { ArrowLeft, RefreshCw, TriangleAlert } from 'lucide-react'
import type { WorkspaceTab } from '../../shared/contracts'

export function WebErrorOverlay({ tab }: { tab: WorkspaceTab }) {
  if (!tab.error) return null
  const views = window.coreDesk?.views

  return (
    <div className="flex h-full items-center justify-center bg-core-canvas p-8">
      <section className="max-w-lg text-center">
        <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-xl border border-amber-400/20 bg-amber-400/10 text-amber-300">
          <TriangleAlert size={22} />
        </div>
        <h1 className="text-xl font-medium text-white">Não foi possível abrir esta página</h1>
        <p className="mt-2 text-sm text-slate-400">Verifique sua conexão ou tente novamente em alguns instantes.</p>
        <p className="mt-4 break-all rounded-md border border-core-line bg-core-panel px-3 py-2 text-xs text-slate-500">{tab.error.url}</p>
        <p className="mt-2 text-xs text-slate-600">Erro {tab.error.code}: {tab.error.description}</p>
        <div className="mt-6 flex justify-center gap-2">
          <button className="flex items-center gap-2 rounded-md bg-core-accent px-3 py-2 text-xs font-medium text-slate-950 hover:bg-cyan-300" onClick={() => views?.retry(tab.id)}>
            <RefreshCw size={14} /> Tentar novamente
          </button>
          <button className="flex items-center gap-2 rounded-md border border-core-line bg-core-panel px-3 py-2 text-xs text-slate-300 hover:bg-core-raised" onClick={() => views?.back(tab.id)} disabled={!tab.canGoBack}>
            <ArrowLeft size={14} /> Voltar
          </button>
        </div>
      </section>
    </div>
  )
}
