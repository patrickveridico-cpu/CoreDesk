import { readFileSync } from 'node:fs'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { getGreeting } from '../shared/core/home'
import { HomePage } from '../src/components/HomePage'
import { useAppearanceStore } from '../src/store/useAppearanceStore'
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
    expect(markup).toContain('Bem-vindo ao CoreDesk</h1>')
    expect(markup).not.toContain('Bem-vindo ao CoreDesk.</h1>')
    expect(markup).toContain('Sua central inteligente de operações.')
    expect(markup).toContain('Atendimentos, comunicação, rotas e orçamentos em um único lugar.')
    expect(markup).toContain('Assistente inteligente do CoreDesk')
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

  it('keeps CoreChat unavailable without fake actions or external integration', () => {
    const markup = renderToStaticMarkup(createElement(HomePage))
    expect(markup).toContain('placeholder="Pergunte qualquer coisa ao CoreChat..."')
    expect(markup).toContain('disabled=""')
    expect(markup).toContain('aria-label="Enviar mensagem — CoreChat em breve"')
    expect(markup).toContain('O CoreChat ainda não está disponível.')
    expect(markup).not.toContain('<iframe')
    expect(markup).not.toContain('<form')
  })

  it('shows only real appearance preferences in system status', () => {
    const markup = renderToStaticMarkup(createElement(HomePage))
    const homeSource = readFileSync('src/components/HomePage.tsx', 'utf8')
    expect(markup).toContain('Status do sistema')
    expect(markup).toContain('Tema</dt>')
    expect(markup).toContain('Animações</dt>')
    expect(markup).toContain('Sons</dt>')
    expect(homeSource).toContain('state.themeMode')
    expect(homeSource).toContain('state.motionEnabled')
    expect(homeSource).toContain('state.soundEnabled')
    expect(useAppearanceStore.getInitialState()).toMatchObject({
      themeMode: expect.any(String),
      motionEnabled: expect.any(Boolean),
      soundEnabled: expect.any(Boolean),
    })
    expect(markup).not.toMatch(/Banco conectado|Sincronizado|Online|Agent disponível/)
  })

  it('uses finite entrance animations and a subtle reducible logo breath', () => {
    const homeStyles = readFileSync('src/styles.css', 'utf8')
    const motionStyles = readFileSync('src/design-system/motion.css', 'utf8')
    const homeSource = readFileSync('src/components/HomePage.tsx', 'utf8')
    expect(homeStyles).toContain('home-logo-enter')
    expect(homeStyles).toContain('home-shortcut-enter')
    for (const className of ['home-logo-enter', 'home-copy-enter', 'home-shortcuts > *']) {
      const escapedClassName = className.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const declaration = homeStyles.match(new RegExp(`\\.${escapedClassName}\\s*\\{([^}]*)\\}`))?.[1] ?? ''
      expect(declaration).not.toContain('infinite')
    }
    expect(homeStyles).toContain('animation: home-logo-breathe 6s')
    expect(homeStyles).toContain(':root[data-motion="reduced"] .home-logo-breathe')
    expect(homeStyles).toMatch(/@media \(prefers-reduced-motion: reduce\)[\s\S]*\.home-logo-breathe \{ animation: none; \}/)
    const breathe = homeStyles.match(/@keyframes home-logo-breathe\s*\{([\s\S]*?)\n\}/)?.[1] ?? ''
    expect(breathe).not.toMatch(/transform|scale|translate/)
    expect(homeSource).not.toMatch(/setInterval|setTimeout/)
    expect(motionStyles).toContain('prefers-reduced-motion: reduce')
    expect(motionStyles).toContain('[data-motion="reduced"]')
  })

  it('softens only the lower logo reflection through CSS composition', () => {
    const homeStyles = readFileSync('src/styles.css', 'utf8')
    const homeSource = readFileSync('src/components/HomePage.tsx', 'utf8')
    expect(homeStyles).toContain('.home-logo-frame::after')
    expect(homeStyles).toContain('linear-gradient(to bottom, transparent')
    expect(homeSource).toContain('object-contain')
  })
})
