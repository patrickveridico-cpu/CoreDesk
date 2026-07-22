import { describe, expect, it } from 'vitest'
import { getGreeting, HOME_PHRASES } from '../shared/core/home'

describe('CoreDesk home copy', () => {
  it('keeps the approved phrase set', () => { expect(HOME_PHRASES).toHaveLength(8); expect(HOME_PHRASES[0]).toContain('Tudo') })
  it('greets by local time', () => {
    expect(getGreeting(new Date(2024, 0, 1, 8))).toBe('Bom dia')
    expect(getGreeting(new Date(2024, 0, 1, 14))).toBe('Boa tarde')
    expect(getGreeting(new Date(2024, 0, 1, 20))).toBe('Boa noite')
  })
})
