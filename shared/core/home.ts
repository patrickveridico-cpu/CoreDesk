export const HOME_PHRASES = [
  'Tudo o que você precisa. Em um só lugar.',
  'Organize. Conecte. Resolva.',
  'Menos janelas. Mais produtividade.',
  'Comunicação, operações e inteligência em um único workspace.',
  'Sua equipe trabalha. O CoreDesk organiza.',
  'Projetado para operações que não podem parar.',
  'Mais foco. Menos cliques.',
  'O centro da sua operação.',
] as const

export function getGreeting(date = new Date()) {
  const hour = date.getHours()
  if (hour < 12) return 'Bom dia'
  if (hour < 18) return 'Boa tarde'
  return 'Boa noite'
}
