import { NavigationBar } from './components/NavigationBar'
import { ProfileSwitcher } from './components/communication/ProfileSwitcher'
import { GlobalTopBar } from './components/Sidebar'
import { TitleBar } from './components/TitleBar'
import { WorkspaceContent } from './components/WorkspaceContent'
import { useTabShortcuts } from './hooks/useTabShortcuts'
import { useWebViewBridge } from './hooks/useWebViewBridge'
import { useWhatsAppProfiles } from './hooks/useWhatsAppProfiles'

export default function App() {
  useWebViewBridge()
  useWhatsAppProfiles()
  useTabShortcuts()

  return (
    <div data-testid="coredesk-shell" data-debug="coredesk-shell" className="relative flex h-screen flex-col overflow-hidden bg-core-canvas text-slate-100">
      <TitleBar />
      <GlobalTopBar />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <NavigationBar />
        <WorkspaceContent />
      </div>
      <ProfileSwitcher />
    </div>
  )
}
