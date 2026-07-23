import { BellOff, Info, ShieldCheck } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { CoreConfig } from '../../shared/core/contracts'
import brandLogo from '../../assets/brand/CoreDesk-logo-conceito.png'
import { useAppearanceStore, type AccentColor, type ThemeMode } from '../store/useAppearanceStore'

const fieldClass = 'h-9 rounded-md border border-core-line bg-core-canvas px-3 text-xs text-core-text outline-none focus-visible:ring-2 focus-visible:ring-core-accent/40'
const accents: Array<{ value: AccentColor; label: string }> = [
  { value: 'blue', label: 'Azul' },
  { value: 'violet', label: 'Violeta' },
  { value: 'green', label: 'Verde' },
  { value: 'orange', label: 'Laranja' },
  { value: 'red', label: 'Vermelho' },
  { value: 'gold', label: 'Dourado' },
]

export function SettingsPage() {
  const [config, setConfig] = useState<CoreConfig>()
  const themeMode = useAppearanceStore((state) => state.themeMode)
  const resolvedTheme = useAppearanceStore((state) => state.resolvedTheme)
  const accentColor = useAppearanceStore((state) => state.accentColor)
  const motionEnabled = useAppearanceStore((state) => state.motionEnabled)
  const soundEnabled = useAppearanceStore((state) => state.soundEnabled)
  const setThemeMode = useAppearanceStore((state) => state.setThemeMode)
  const setAccentColor = useAppearanceStore((state) => state.setAccentColor)
  const setMotionEnabled = useAppearanceStore((state) => state.setMotionEnabled)
  const setSoundEnabled = useAppearanceStore((state) => state.setSoundEnabled)
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
          <h2 className="text-sm text-core-text">Aparência</h2>
          <p className="mt-1 text-xs text-core-muted">Preferências visuais locais restauradas na inicialização.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1 text-xs text-core-muted"><span>Tema</span><select value={themeMode} onChange={(event) => void setThemeMode(event.target.value as ThemeMode)} className={fieldClass}><option value="dark">Escuro</option><option value="light">Claro</option><option value="system">Sistema</option></select><small className="text-[10px] text-core-muted">Tema aplicado: {resolvedTheme === 'dark' ? 'Escuro' : 'Claro'}</small></label>
            <label className="grid gap-1 text-xs text-core-muted"><span>Cor de destaque</span><select value={accentColor} onChange={(event) => void setAccentColor(event.target.value as AccentColor)} className={fieldClass}>{accents.map((accent) => <option key={accent.value} value={accent.value}>{accent.label}</option>)}</select></label>
          </div>
          <div className="mt-4 grid gap-2 text-xs text-core-muted">
            <label className="flex items-center justify-between gap-3"><span>Movimentos e transições</span><input type="checkbox" checked={motionEnabled} onChange={(event) => void setMotionEnabled(event.target.checked)} className="h-4 w-4 accent-[rgb(var(--core-accent))]" /></label>
            <label className="flex items-center justify-between gap-3"><span>Sons da interface</span><input type="checkbox" checked={soundEnabled} onChange={(event) => void setSoundEnabled(event.target.checked)} className="h-4 w-4 accent-[rgb(var(--core-accent))]" /></label>
          </div>
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
