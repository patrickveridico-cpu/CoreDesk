import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const styles = readFileSync('src/styles.css', 'utf8')
const componentStyles = readFileSync('src/design-system/components.css', 'utf8')
const tokens = readFileSync('src/design-system/tokens.css', 'utf8')

describe('CoreDesk visual polish', () => {
  it('provides reusable depth, glow, motion, and easing tokens', () => {
    for (const token of [
      '--core-shadow-xs',
      '--core-shadow-sm',
      '--core-shadow-md',
      '--core-glow-accent-soft',
      '--core-glow-accent-medium',
      '--core-transition-fast',
      '--core-transition-normal',
      '--core-easing-standard',
      '--core-easing-emphasized',
    ]) expect(tokens).toContain(token)
    expect(tokens).toContain('rgb(var(--core-accent)')
  })

  it('gives Button and IconButton specific hover, active, focus, and disabled behavior', () => {
    expect(componentStyles).toContain('.ds-button:hover:not(:disabled)')
    expect(componentStyles).toContain('.ds-icon-button:hover:not(:disabled)')
    expect(componentStyles).toContain('transform: translateY(-1px)')
    expect(componentStyles).toContain('transform: translateY(0) scale(0.99)')
    expect(componentStyles).toContain('.ds-button:disabled')
    expect(componentStyles).toContain('.ds-focus-ring:focus-visible')
  })

  it('adds interaction-only card effects without layout changes or continuous shimmer', () => {
    expect(styles).toContain('.home-shortcut::after')
    expect(styles).toContain('.home-shortcut:hover:not(:disabled)::after')
    expect(styles).toContain('.home-shortcut:focus-visible::after')
    expect(styles).toContain('box-shadow: var(--core-shadow-sm), var(--core-glow-accent-soft)')
    expect(styles).not.toMatch(/\.home-shortcut::after\s*\{[^}]*animation:/)
  })

  it('animates tab indicators and one-shot badge state without mass continuous animation', () => {
    expect(styles).toContain('.web-guide-tab[data-active="true"]::after')
    expect(styles).toContain('.active-tab-indicator')
    expect(styles).toContain('@keyframes badge-pop')
    expect(styles).not.toContain('unread-pulse')
    expect(styles).not.toMatch(/\.unread-badge\s*\{[^}]*infinite/)
  })

  it('provides toast entrance, exit, progress, and semantic borders', () => {
    const toastSource = readFileSync('src/components/DownloadToast.tsx', 'utf8')
    expect(toastSource).toContain('data-exiting={dismissing}')
    expect(toastSource).toContain('data-state={status.state}')
    expect(styles).toContain('@keyframes toast-enter')
    expect(styles).toContain('.download-toast[data-exiting="true"]')
    expect(styles).toContain('.download-toast[data-state="completed"]')
    expect(styles).toContain('.download-toast[data-state="failed"]')
    expect(styles).toContain('.download-progress')
  })

  it('gives dropdowns, panels, and dialogs a shared elevated surface entrance', () => {
    expect(styles).toContain('.profile-menu')
    expect(styles).toContain('[role="dialog"] > form')
    expect(styles).toContain('[role="dialog"] > div')
    expect(styles).toContain('@keyframes floating-surface-enter')
    expect(styles).toContain('box-shadow: var(--core-shadow-md)')
  })

  it('limits page transitions to renderer pages and respects both reduced-motion mechanisms', () => {
    const workspaceSource = readFileSync('src/components/WorkspaceContent.tsx', 'utf8')
    const motionStyles = readFileSync('src/design-system/motion.css', 'utf8')
    expect(workspaceSource).toContain('workspace-page workspace-page-active')
    expect(workspaceSource).toContain("!web ? 'workspace-page workspace-page-active' : ''")
    expect(styles).toContain('@keyframes workspace-page-enter')
    expect(styles).toContain('@media (prefers-reduced-motion: reduce)')
    expect(styles).toContain(':root[data-motion="reduced"] .workspace-page-active')
    expect(motionStyles).toContain(':root[data-motion="reduced"]')
    expect(motionStyles).toContain('@media (prefers-reduced-motion: reduce)')
  })

  it('never uses a global transition-all shortcut', () => {
    expect(`${styles}\n${componentStyles}\n${tokens}`).not.toMatch(/transition\s*:\s*all\b/)
  })
})
