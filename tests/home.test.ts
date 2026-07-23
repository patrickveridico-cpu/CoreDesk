import { readFileSync } from 'node:fs'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  getGreeting,
  getHomeLogoMotionClass,
  HOME_IMPACT_PHRASES,
  HOME_IMPACT_ROTATION_MS,
  startHomeImpactPhraseRotation,
} from '../shared/core/home'
import { CoreChatBar } from '../src/components/CoreChatBar'
import { HomePage } from '../src/components/HomePage'
import { useAppearanceStore } from '../src/store/useAppearanceStore'
import { runHomeQuickAction, type HomeNavigation } from '../src/utils/homeNavigation'

describe('CoreDesk home copy', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

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
    expect(markup).toContain('Pesquisas rápidas com IA')
    expect(markup).not.toMatch(/ChatGPT|OpenAI/i)
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

  it('presents QuillBot as an embedded Home panel while preserving technical identifiers', () => {
    const markup = renderToStaticMarkup(createElement(HomePage))
    const barMarkup = renderToStaticMarkup(createElement(CoreChatBar, {
      viewState: { id: 'coredesk-corechat' },
      onClose: () => undefined,
    }))
    const homeSource = readFileSync('src/components/HomePage.tsx', 'utf8')
    expect(markup).toContain('Abrir QuillBot')
    expect(markup).toContain('>QuillBot</h2>')
    expect(markup).toContain('Pesquisas rápidas com IA')
    expect(barMarkup).toContain('>QuillBot</strong>')
    expect(barMarkup).toContain('Chat com IA')
    expect(`${markup}${barMarkup}`).not.toContain('>CoreChat<')
    expect(`${markup}${barMarkup}`).not.toContain('Abrir CoreChat')
    expect(`${markup}${barMarkup}`).not.toMatch(/ChatGPT|OpenAI/i)
    expect(markup).not.toContain('Em breve')
    expect(markup).not.toContain('Pergunte qualquer coisa ao CoreChat')
    expect(markup).not.toContain('<iframe')
    expect(markup).toContain('aria-expanded="false"')
    expect(markup).toContain('aria-controls="corechat-panel"')
    expect(markup).toContain('id="corechat-panel"')
    expect(markup).toContain('aria-hidden="true"')
    expect(homeSource).not.toContain('openWorkspaceWebTab')
    expect(homeSource).not.toContain('openCoreChatFromHome')
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

  it('uses finite entrance animations and a visible reducible logo pulse', () => {
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
    expect(homeStyles).toContain('animation: home-logo-halo 4.4s')
    expect(homeStyles).toContain('animation: home-logo-main-pulse 4.4s')
    expect(homeStyles).toContain('animation: home-logo-reflection 4.4s')
    expect(homeStyles).toContain(':root[data-motion="reduced"] .home-logo-halo-layer')
    expect(homeStyles).toMatch(/@media \(prefers-reduced-motion: reduce\)[\s\S]*\.home-logo-halo-layer, \.home-logo-reflection-layer, \.home-logo-main-layer \{ animation: none; \}/)
    const mainPulse = homeStyles.match(/@keyframes home-logo-main-pulse\s*\{([\s\S]*?)\n\}/)?.[1] ?? ''
    const halo = homeStyles.match(/@keyframes home-logo-halo\s*\{([\s\S]*?)\n\}/)?.[1] ?? ''
    expect(mainPulse).toContain('scale(1.014)')
    expect(halo).toContain('opacity: 0.68')
    expect(halo).toContain('scale(1.12)')
    expect(homeStyles).toContain('rgb(var(--core-accent)')
    expect(homeSource).toContain('getHomeLogoMotionClass(reducedMotion)')
    expect(motionStyles).toContain('prefers-reduced-motion: reduce')
    expect(motionStyles).toContain('[data-motion="reduced"]')
  })

  it('renders a static logo treatment when motion is reduced', () => {
    expect(getHomeLogoMotionClass(true)).toBe('home-logo-static')
    expect(getHomeLogoMotionClass(false)).toBe('home-logo-breathe')
  })

  it('rotates the approved impact phrases every ten seconds and cleans one interval', () => {
    vi.useFakeTimers()
    const intervalSpy = vi.spyOn(globalThis, 'setInterval')
    const clearIntervalSpy = vi.spyOn(globalThis, 'clearInterval')
    const rotate = vi.fn()
    let visible = true
    const stop = startHomeImpactPhraseRotation(rotate, () => visible)

    expect(HOME_IMPACT_PHRASES).toHaveLength(10)
    expect(intervalSpy).toHaveBeenCalledOnce()
    vi.advanceTimersByTime(HOME_IMPACT_ROTATION_MS - 1)
    expect(rotate).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(rotate).toHaveBeenCalledOnce()

    visible = false
    vi.advanceTimersByTime(HOME_IMPACT_ROTATION_MS)
    expect(rotate).toHaveBeenCalledOnce()

    visible = true
    stop()
    expect(clearIntervalSpy).toHaveBeenCalledOnce()
    vi.advanceTimersByTime(HOME_IMPACT_ROTATION_MS)
    expect(rotate).toHaveBeenCalledOnce()
  })

  it('paints an opening preparation frame before animating and reveals the native view only when open', () => {
    const homeSource = readFileSync('src/components/HomePage.tsx', 'utf8')
    const hookSource = readFileSync('src/hooks/useCoreChatPanelView.ts', 'utf8')
    const homeStyles = readFileSync('src/styles.css', 'utf8')
    expect(homeSource).toContain('panelPreparationFrameRef.current = window.requestAnimationFrame')
    expect(homeSource).toContain('panelAnimationFrameRef.current = window.requestAnimationFrame')
    expect(homeSource).toContain('setPanelTransitionReady(true)')
    expect(homeSource).toContain('data-transition-ready={panelTransitionReady}')
    expect(homeSource).toContain("event.propertyName !== 'transform'")
    expect(hookSource).toContain("const shouldRevealView = phase === 'open'")
    expect(hookSource).toContain('{ visible: shouldRevealView }')
    expect(homeStyles).toContain('flex-basis 360ms cubic-bezier(0.22, 1, 0.36, 1)')
    expect(homeStyles).toContain('opacity 200ms')
    expect(homeStyles).not.toContain('grid-template-rows')
  })

  it('keeps a fixed-height two-line phrase region without layout shift', () => {
    const homeStyles = readFileSync('src/styles.css', 'utf8')
    const markup = renderToStaticMarkup(createElement(HomePage))
    expect(markup).toContain('home-impact-phrase')
    expect(markup).toContain(HOME_IMPACT_PHRASES[0])
    expect(homeStyles).toMatch(/\.home-impact-phrase\s*\{[\s\S]*height: 2\.5rem;[\s\S]*min-height: 2\.5rem;/)
    expect(homeStyles).toContain('-webkit-line-clamp: 2')
  })

  it('builds the logo from explicit sharp, halo, and lower-reflection layers', () => {
    const homeStyles = readFileSync('src/styles.css', 'utf8')
    const homeSource = readFileSync('src/components/HomePage.tsx', 'utf8')
    const markup = renderToStaticMarkup(createElement(HomePage))
    expect(markup).toContain('home-logo-halo-layer')
    expect(markup).toContain('home-logo-reflection-layer')
    expect(markup).toContain('home-logo-main-layer')
    expect(homeStyles).toContain('.home-logo-reflection-layer')
    expect(homeStyles).toContain('.home-logo-main-layer')
    expect(homeStyles).not.toContain('.home-logo-frame::before')
    expect(homeStyles).not.toContain('.home-logo-frame::after')
    expect(homeSource).toContain("document.addEventListener('visibilitychange'")
    expect(homeSource).toContain('object-contain')
  })
})
