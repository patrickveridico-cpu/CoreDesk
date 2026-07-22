import { useEffect, useState } from 'react'
import { useTabsStore } from '../store/useTabsStore'
import { WebErrorOverlay } from './WebErrorOverlay'
import { CommunicationPage } from './communication/CommunicationPage'
import { SettingsPage } from './SettingsPage'
import brandSymbol from '../../assets/brand/derived/coredesk-symbol-256.png'
import { HOME_PHRASES, getGreeting } from '../../shared/core/home'
import { OperationsPage } from '../modules/operations/pages/OperationsPage'

function HomePage() {
  const [phraseIndex, setPhraseIndex] = useState(0)
  const [rotating, setRotating] = useState(false)
  useEffect(() => { if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return; let interval: number | undefined; const start = window.setTimeout(() => { setRotating(true); interval = window.setInterval(() => setPhraseIndex((index) => (index + 1) % HOME_PHRASES.length), 4000) }, 2000); return () => { window.clearTimeout(start); if (interval) window.clearInterval(interval) } }, [])
  return <div className="flex h-full items-center justify-center p-8"><section className="w-full max-w-3xl"><img src={brandSymbol} alt="CoreDesk" className="mb-5 h-20 w-20 object-contain" /><p className="mb-2 text-xs font-semibold uppercase tracking-[0.24em] text-core-accent">{getGreeting()}</p><h1 className="text-4xl font-semibold tracking-tight text-white">Bem-vindo ao CoreDesk.</h1><p className={`mt-4 max-w-2xl text-base leading-7 text-slate-400 ${rotating ? 'home-phrase' : ''}`}>{HOME_PHRASES[phraseIndex]}</p></section></div>
}

export function WorkspaceContent() {
  const tabs = useTabsStore((state) => state.tabs)
  const activeTabId = useTabsStore((state) => state.activeTabId)
  const tab = tabs.find((item) => item.id === activeTabId) ?? tabs[0]
  const visible = (id: string) => tab?.id === id ? '' : 'hidden'
  const web = Boolean(tab && tab.type !== 'internal')
  return <main id="workspace-content" className="min-h-0 min-w-0 flex-1 overflow-hidden bg-core-canvas">
    <div className={`h-full min-h-0 ${visible('communication')}`}><CommunicationPage /></div>
    <div className={`h-full min-h-0 ${visible('routes')}`}><OperationsPage /></div>
    <div className={`h-full min-h-0 ${tab?.id === 'settings' || tab?.id === 'about' ? '' : 'hidden'}`}><SettingsPage /></div>
    <div className={`h-full min-h-0 ${web || !tab || tab.type === 'internal' && !['communication', 'routes', 'settings', 'about'].includes(tab.id) ? '' : 'hidden'}`}>{(!tab || tab.type === 'internal') && <HomePage />}{web && tab?.loading && <div className="grid h-full place-items-center text-sm text-slate-400">Carregando {tab.id === 'app-maps' ? 'Google Maps' : 'Google'}...</div>}{web && tab?.error && <WebErrorOverlay tab={tab} />}</div>
  </main>
}
