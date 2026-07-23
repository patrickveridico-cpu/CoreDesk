export type WhatsAppExternalLinkDecision =
  | { action: 'allow-internal'; protocol: string; hostname: string }
  | { action: 'open-popup'; protocol: 'http:' | 'https:'; hostname: string }
  | { action: 'open-system'; protocol: 'mailto:' | 'tel:'; hostname: string }
  | { action: 'block'; protocol: string; hostname: string; reason: string }

const WHATSAPP_HOSTS = ['whatsapp.com', 'whatsapp.net'] as const

function isOfficialWhatsAppHost(hostname: string) {
  const normalized = hostname.toLocaleLowerCase('en-US')
  return WHATSAPP_HOSTS.some((host) => normalized === host || normalized.endsWith(`.${host}`))
}

export function isWhatsAppInternalUrl(value: string) {
  try {
    const parsed = new URL(value)
    if (parsed.protocol === 'about:' && parsed.pathname === 'blank') return true
    if (parsed.protocol === 'blob:') return isWhatsAppInternalUrl(value.slice('blob:'.length))
    return (parsed.protocol === 'https:' || parsed.protocol === 'http:') && isOfficialWhatsAppHost(parsed.hostname)
  } catch {
    return false
  }
}

export function classifyWhatsAppExternalLink(value: string): WhatsAppExternalLinkDecision {
  try {
    const parsed = new URL(value)
    if (parsed.protocol === 'blob:') {
      return { action: 'block', protocol: 'blob:', hostname: '', reason: 'download-protocol-not-navigation' }
    }
  } catch {
    return { action: 'block', protocol: 'invalid', hostname: '', reason: 'invalid-url' }
  }
  if (isWhatsAppInternalUrl(value)) {
    try {
      const parsed = new URL(value)
      return { action: 'allow-internal', protocol: parsed.protocol, hostname: parsed.hostname }
    } catch {
      return { action: 'allow-internal', protocol: 'about:', hostname: '' }
    }
  }
  try {
    const parsed = new URL(value)
    const protocol = parsed.protocol.toLocaleLowerCase('en-US')
    const hostname = parsed.hostname.toLocaleLowerCase('en-US')
    if (protocol === 'http:' || protocol === 'https:') return { action: 'open-popup', protocol, hostname }
    if (protocol === 'mailto:' || protocol === 'tel:') return { action: 'open-system', protocol, hostname }
    return { action: 'block', protocol, hostname, reason: 'protocol-not-allowed' }
  } catch {
    return { action: 'block', protocol: 'invalid', hostname: '', reason: 'invalid-url' }
  }
}
