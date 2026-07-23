export const HOME_IMPACT_PHRASES = [
  'Tudo o que importa, em um só lugar.',
  'Mais agilidade para cada decisão.',
  'Sua operação, mais simples e inteligente.',
  'Menos cliques. Mais produtividade.',
  'Informação certa, no momento certo.',
  'Conecte tarefas, pessoas e resultados.',
  'Trabalhe com foco. O CoreDesk cuida do fluxo.',
  'Uma central feita para o seu ritmo.',
  'Organize hoje. Avance amanhã.',
  'Tecnologia que acompanha sua operação.',
] as const

export const HOME_IMPACT_ROTATION_MS = 10_000

export function getHomeLogoMotionClass(reducedMotion: boolean) {
  return reducedMotion ? 'home-logo-static' : 'home-logo-breathe'
}

export function startHomeImpactPhraseRotation(
  onRotate: () => void,
  isVisible: () => boolean = () => true,
) {
  const interval = globalThis.setInterval(() => {
    if (isVisible()) onRotate()
  }, HOME_IMPACT_ROTATION_MS)

  return () => globalThis.clearInterval(interval)
}

export function getGreeting(date = new Date()) {
  const hour = date.getHours()
  if (hour < 12) return 'Bom dia'
  if (hour < 18) return 'Boa tarde'
  return 'Boa noite'
}
