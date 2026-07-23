import { useTabsStore } from '../store/useTabsStore'
import { WebErrorOverlay } from './WebErrorOverlay'
import { CommunicationPage } from './communication/CommunicationPage'
import { SettingsPage } from './SettingsPage'
import { OperationsPage } from '../modules/operations/pages/OperationsPage'
import { HomePage } from './HomePage'

export function WorkspaceContent() {
  const tabs = useTabsStore((state) => state.tabs)
  const activeTabId = useTabsStore((state) => state.activeTabId)
  const tab = tabs.find((item) => item.id === activeTabId) ?? tabs[0]
  const visible = (id: string) => tab?.id === id ? '' : 'hidden'
  const web = Boolean(tab && tab.type !== 'internal')
  return <main id="workspace-content" className="min-h-0 min-w-0 flex-1 overflow-hidden bg-core-canvas">
    <div className={`h-full min-h-0 ${visible('communication')}`}><CommunicationPage /></div>
    <div className={`h-full min-h-0 ${visible('routes')} flex`}><OperationsPage /></div>
    <div className={`h-full min-h-0 ${tab?.id === 'settings' || tab?.id === 'about' ? '' : 'hidden'}`}><SettingsPage /></div>
    <div className={`h-full min-h-0 ${web || !tab || tab.type === 'internal' && !['communication', 'routes', 'settings', 'about'].includes(tab.id) ? '' : 'hidden'}`}>{(!tab || tab.type === 'internal') && <HomePage />}{web && tab?.loading && <div className="grid h-full place-items-center text-sm text-slate-400">Carregando {tab.id === 'app-maps' ? 'Google Maps' : 'Google'}...</div>}{web && tab?.error && <WebErrorOverlay tab={tab} />}</div>
  </main>
}
