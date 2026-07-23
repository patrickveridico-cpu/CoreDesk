import { useEffect } from 'react'
import { NavigationBar } from './components/NavigationBar'
import { ProfileSwitcher } from './components/communication/ProfileSwitcher'
import { GlobalTopBar } from './components/Sidebar'
import { TitleBar } from './components/TitleBar'
import { WorkspaceContent } from './components/WorkspaceContent'
import { useTabShortcuts } from './hooks/useTabShortcuts'
import { useWebViewBridge } from './hooks/useWebViewBridge'
import { useWhatsAppProfiles } from './hooks/useWhatsAppProfiles'

function logComputed(label: string, selector: string) {
  const element = document.querySelector<HTMLElement>(selector)
  if (!element) { console.log(`[CoreDesk CSS Diagnostic] ${label}`, { found: false, selector }); return }
  const computed = window.getComputedStyle(element)
  const rect = element.getBoundingClientRect()
  console.log(`[CoreDesk CSS Diagnostic] ${label}`, {
    found: true,
    tagName: element.tagName,
    className: element.className,
    rect: { x: rect.x, y: rect.y, top: rect.top, right: rect.right, bottom: rect.bottom, left: rect.left, width: rect.width, height: rect.height },
    display: computed.display,
    visibility: computed.visibility,
    opacity: computed.opacity,
    position: computed.position,
    zIndex: computed.zIndex,
    width: computed.width,
    height: computed.height,
    minHeight: computed.minHeight,
    flexDirection: computed.flexDirection,
    flexShrink: computed.flexShrink,
    overflow: computed.overflow,
    color: computed.color,
    backgroundColor: computed.backgroundColor,
    borderBottomWidth: computed.borderBottomWidth,
    borderBottomColor: computed.borderBottomColor,
    fontSize: computed.fontSize,
  })
}

function runCssDiagnostic() {
  logComputed('shell', '[data-testid="coredesk-shell"]')
  logComputed('titlebar', '[data-testid="coredesk-titlebar"]')
  logComputed('topbar', '[data-testid="coredesk-topbar"]')
  logComputed('workspace', '#workspace-content')
  for (const [label, element] of [['body', document.body], ['root', document.querySelector<HTMLElement>('#root')]] as const) {
    if (!element) continue
    const computed = window.getComputedStyle(element)
    const rect = element.getBoundingClientRect()
    console.log(`[CoreDesk CSS Diagnostic] ${label}`, { tagName: element.tagName, className: element.className, rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height }, display: computed.display, visibility: computed.visibility, opacity: computed.opacity, overflow: computed.overflow, backgroundColor: computed.backgroundColor })
  }
  const stylesheets = [...document.styleSheets].map((sheet) => {
    try { return { href: sheet.href, cssRules: sheet.cssRules.length } } catch { return { href: sheet.href, cssRules: 'SecurityError' } }
  })
  console.log('[CoreDesk CSS Diagnostic] stylesheets', { count: document.styleSheets.length, stylesheets })
  const classes = ['.flex', '.h-12', '.shrink-0', '.items-center', '.text-slate-100', '.bg-core-panel', '.border-core-line', '.z-\\[100\\]']
  for (const className of classes) {
    let found = false
    for (const sheet of [...document.styleSheets]) {
      try {
        for (const rule of [...sheet.cssRules]) if (rule.cssText.includes(className)) found = true
      } catch { /* stylesheet access can be restricted */ }
    }
    console.log('[CoreDesk CSS Diagnostic] class-check', { className, found })
  }
}

export default function App() {
  useWebViewBridge()
  useWhatsAppProfiles()
  useTabShortcuts()
  useEffect(() => {
    let firstFrame = 0
    let secondFrame = 0
    firstFrame = window.requestAnimationFrame(() => { secondFrame = window.requestAnimationFrame(runCssDiagnostic) })
    return () => { window.cancelAnimationFrame(firstFrame); window.cancelAnimationFrame(secondFrame) }
  }, [])

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
