import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, LoaderCircle, Plus, RotateCw, X } from 'lucide-react'
import { SHELL_LAYOUT } from '../../shared/layout'
import { FOCUS_ADDRESS_EVENT } from '../hooks/useTabShortcuts'
import { useTabsStore } from '../store/useTabsStore'
import { toNavigableUrl } from '../utils/navigation'
import { CORECHAT_VIEW_ID } from '../../shared/corechat'

const controlClass = 'grid h-7 w-7 shrink-0 place-items-center rounded text-slate-400 transition-colors hover:bg-white/5 hover:text-white disabled:pointer-events-none disabled:opacity-30'

export function NavigationBar() {
  const tabs = useTabsStore((state) => state.tabs)
  const activeTabId = useTabsStore((state) => state.activeTabId)
  const addWebTab = useTabsStore((state) => state.addWebTab)
  const tab = tabs.find((item) => item.id === activeTabId)
  const [address, setAddress] = useState(tab?.url ?? '')
  const addressRef = useRef<HTMLInputElement>(null)
  const views = window.coreDesk?.views

  useEffect(() => setAddress(tab?.url ?? ''), [tab?.url, tab?.id])
  useEffect(() => {
    const focusAddress = () => {
      addressRef.current?.focus()
      addressRef.current?.select()
    }
    window.addEventListener(FOCUS_ADDRESS_EVENT, focusAddress)
    return () => window.removeEventListener(FOCUS_ADDRESS_EVENT, focusAddress)
  }, [])

  if (tab?.type !== 'web' || tab.id === CORECHAT_VIEW_ID) return null

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    const url = toNavigableUrl(address)
    setAddress(url)
    views?.navigate(tab.id, url)
  }

  return (
    <div
      className="relative flex shrink-0 items-center gap-1 border-b border-core-line bg-core-panel px-2"
      style={{ height: SHELL_LAYOUT.navigationBarHeight }}
    >
      <button className={controlClass} disabled={!tab.canGoBack} onClick={() => views?.back(tab.id)} aria-label="Voltar"><ArrowLeft size={15} /></button>
      <button className={controlClass} disabled={!tab.canGoForward} onClick={() => views?.forward(tab.id)} aria-label="Avançar"><ArrowRight size={15} /></button>
      <button className={controlClass} onClick={() => tab.loading ? views?.stop(tab.id) : views?.reload(tab.id)} aria-label={tab.loading ? 'Parar' : 'Atualizar'}>
        {tab.loading ? <X size={15} /> : <RotateCw size={14} />}
      </button>
      <form className="mx-1 min-w-0 flex-1" onSubmit={submit}>
        <div className="flex h-7 items-center rounded-md border border-core-line bg-core-canvas px-2 focus-within:border-core-accent/60">
          {tab.loading && <LoaderCircle className="mr-2 animate-spin text-core-accent" size={13} />}
          <input
            ref={addressRef}
            value={address}
            onChange={(event) => setAddress(event.target.value)}
            className="min-w-0 flex-1 bg-transparent text-xs text-slate-300 outline-none placeholder:text-slate-600"
            placeholder="Pesquise ou digite um endereço"
            spellCheck={false}
            aria-label="Endereço"
          />
        </div>
      </form>
      <button className={controlClass} onClick={() => addWebTab()} aria-label="Nova aba"><Plus size={16} /></button>
      {tab.loading && <span className="absolute inset-x-0 bottom-0 h-px animate-pulse bg-core-accent" />}
    </div>
  )
}
