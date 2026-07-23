import { readFileSync } from 'node:fs'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { getGreeting } from '../shared/core/home'
import { HomePage } from '../src/components/HomePage'
import { runHomeQuickAction, type HomeNavigation } from '../src/utils/homeNavigation'

describe('CoreDesk home copy', () => {
  it('greets by local time', () => {
    expect(getGreeting(new Date(2024, 0, 1, 8))).toBe('Bom dia')
    expect(getGreeting(new Date(2024, 0, 1, 11, 59))).toBe('Bom dia')
    expect(getGreeting(new Date(2024, 0, 1, 12))).toBe('Boa tarde')
    expect(getGreeting(new Date(2024, 0, 1, 14))).toBe('Boa tarde')
    expect(getGreeting(new Date(2024, 0, 1, 18))).toBe('Boa noite')
    expect(getGreeting(new Date(2024, 0, 1, 20))).toBe('Boa noite')
  })

  it('renders the complete logo and approved content without iframe', () => {
    const markup = renderToStaticMarkup(createElement(HomePage, { now: new Date(2024, 0, 1, 8) }))
    expect(markup).toContain('alt="Logotipo completo do CoreDesk"')
    expect(markup).toContain('object-contain')
    expect(markup).not.toContain('object-cover')
    expect(markup).toContain('BOM DIA')
    expect(markup).toContain('Bem-vindo ao CoreDesk.')
    expect(markup).toContain('Tudo o que você precisa.')
    expect(markup).toContain('Assistente inteligente do CoreDesk.')
    expect(markup).not.toContain('<iframe')
  })

  it('reuses the existing navigation for every quick action', () => {
    const calls: string[] = []
    const navigation: HomeNavigation = {
      executeCommand: (id) => { calls.push(`command:${id}`) },
      openInternalTab: (id, title) => { calls.push(`internal:${id}:${title}`) },
      openWorkspaceWebTab: (id) => { calls.push(`web:${id}`) },
    }
    runHomeQuickAction('new-budget', navigation)
    runHomeQuickAction('whatsapp', navigation)
    runHomeQuickAction('maps', navigation)
    runHomeQuickAction('operations', navigation)
    expect(calls).toEqual([
      'command:operations.new-quote',
      'internal:communication:Comunicação',
      'web:app-maps',
      'internal:routes:Operações',
    ])
  })

  it('uses finite entrance animations governed by the global motion infrastructure', () => {
    const homeStyles = readFileSync('src/styles.css', 'utf8')
    const motionStyles = readFileSync('src/design-system/motion.css', 'utf8')
    expect(homeStyles).toContain('home-logo-enter')
    expect(homeStyles).toContain('home-shortcut-enter')
    expect(homeStyles).not.toMatch(/home-(?:logo-enter|copy-enter|shortcut-enter)[^{]*\{[^}]*infinite/)
    expect(motionStyles).toContain('prefers-reduced-motion: reduce')
    expect(motionStyles).toContain('[data-motion="reduced"]')
  })
})
