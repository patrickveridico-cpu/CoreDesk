import { BellOff, Info, ShieldCheck } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { CoreConfig } from '../../shared/core/contracts'
import brandLogo from '../../assets/brand/CoreDesk-logo-conceito.png'

export function SettingsPage() {
  const [config, setConfig] = useState<CoreConfig>()
  useEffect(() => {
    const api = window.coreDesk?.core
    if (!api) return
    void api.getConfig().then(setConfig)
    return api.onConfigChanged(setConfig)
  }, [])
  const update = (patch: Partial<CoreConfig>) => void window.coreDesk?.core.updateConfig(patch).then(setConfig)
  return (
    <div className="h-full overflow-auto bg-core-canvas p-5">
      <div className="mx-auto max-w-3xl">
        <header className="mb-6 flex items-center gap-4 border-b border-core-line pb-4">
          <img src={brandLogo} alt="CoreDesk" className="h-16 w-auto" />
          <div><h1 className="text-base font-semibold text-white">Configurações</h1><p className="mt-1 text-xs text-slate-500">Preferências locais do núcleo operacional</p></div>
        </header>
        <section className="mb-4 rounded-lg border border-core-line bg-core-panel p-4">
          <div className="flex items-start gap-3"><BellOff className="mt-0.5 text-slate-500" size={17} /><div className="flex-1"><h2 className="text-sm text-white">Notificações dos perfis</h2><p className="mt-1 text-xs leading-5 text-slate-500">Permissões permanecem bloqueadas por padrão. A ativação explícita por perfil será disponibilizada em uma etapa futura.</p></div><span className="rounded-full border border-core-line px-2 py-1 text-[10px] text-slate-500">Desativado</span></div>
        </section>
        <section className="mb-4 rounded-lg border border-core-line bg-core-panel p-4">
          <h2 className="text-sm text-white">Preferências do núcleo</h2>
          <div className="mt-3 flex items-center justify-between text-xs text-slate-400"><span>Correção ortográfica</span><button onClick={() => update({ spellcheck: !config?.spellcheck })} className={`rounded-full px-2 py-1 ${config?.spellcheck ? 'bg-core-accent/15 text-core-accent' : 'border border-core-line text-slate-500'}`}>{config?.spellcheck ? 'Ativa' : 'Desativada'}</button></div>
          <div className="mt-3 flex items-center justify-between text-xs text-slate-400"><span>Restaurar workspace anterior</span><button onClick={() => update({ restoreWorkspace: !config?.restoreWorkspace })} className={`rounded-full px-2 py-1 ${config?.restoreWorkspace ? 'bg-core-accent/15 text-core-accent' : 'border border-core-line text-slate-500'}`}>{config?.restoreWorkspace ? 'Ativo' : 'Desativado'}</button></div>
        </section>
        <section className="rounded-lg border border-core-line bg-core-panel p-4">
          <div className="mb-4 flex items-center gap-2 text-sm text-white"><Info size={16} className="text-core-accent" /> Sobre o CoreDesk</div>
          <img src={brandLogo} alt="CoreDesk Operational Workspace" className="mx-auto h-52 max-w-full object-contain" />
          <div className="mt-4 flex items-center justify-center gap-2 text-xs text-slate-500"><ShieldCheck size={13} /> Electron isolado · dados locais · versão 0.1.0</div>
        </section>
      </div>
    </div>
  )
}
