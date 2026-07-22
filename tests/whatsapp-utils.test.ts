import { describe, expect, it } from 'vitest'
import {
  createProfileIdentity,
  extractUnreadCount,
  formatUnreadCount,
  sortWhatsAppProfiles,
  validateIconFile,
  validateProfileName,
  type WhatsAppProfile,
} from '../shared/whatsapp'

const profile = (id: string, order: number): WhatsAppProfile => ({
  id, partition: `persist:coredesk-whatsapp-${id}`, name: id, order,
  enabled: true, open: true, suspended: false, notificationsEnabled: false,
  createdAt: `2026-01-0${order + 1}T00:00:00.000Z`, updatedAt: '2026-01-01T00:00:00.000Z',
})

describe('modelo de perfis WhatsApp', () => {
  it('gera id estável e partition derivada do id', () => {
    expect(createProfileIdentity('ABC-123')).toEqual({ id: 'abc-123', partition: 'persist:coredesk-whatsapp-abc-123' })
  })

  it('valida e normaliza o nome', () => {
    expect(validateProfileName('  Atendimento   Norte ')).toBe('Atendimento Norte')
    expect(() => validateProfileName('  ')).toThrow('obrigatório')
    expect(() => validateProfileName('x'.repeat(49))).toThrow('48')
  })

  it('valida formato e limite do ícone', () => {
    expect(validateIconFile('.PNG', 1024)).toBe('.png')
    expect(() => validateIconFile('.svg', 1024)).toThrow('PNG')
    expect(() => validateIconFile('.jpg', 2 * 1024 * 1024 + 1)).toThrow('2 MB')
  })

  it('lê contador pelo título com fallback seguro e limite visual', () => {
    expect(extractUnreadCount('(18) WhatsApp')).toBe(18)
    expect(extractUnreadCount('WhatsApp')).toBe(0)
    expect(extractUnreadCount('(texto) WhatsApp')).toBe(0)
    expect(formatUnreadCount(150)).toBe('99+')
  })

  it('ordena sem mutar a lista original', () => {
    const input = [profile('c', 2), profile('a', 0), profile('b', 1)]
    expect(sortWhatsAppProfiles(input).map((item) => item.id)).toEqual(['a', 'b', 'c'])
    expect(input[0].id).toBe('c')
  })
})
