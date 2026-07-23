export const MIRO_TAB_ID = 'app-miro'
export const MIRO_VIEW_ID = MIRO_TAB_ID
export const MIRO_PARTITION = 'persist:coredesk-miro'
export const MIRO_DASHBOARD_URL = 'https://miro.com/app/dashboard/'

const MIRO_WEB_HOST = /(^|\.)miro\.com$/i
const MIRO_AUTH_HOSTS = new Set([
  'accounts.google.com',
  'appleid.apple.com',
  'login.microsoftonline.com',
])
const SAFE_WEB_PROTOCOLS = new Set(['http:', 'https:'])

export type MiroNavigationDecision =
  | { action: 'allow-internal' | 'allow-auth'; protocol: string; hostname: string }
  | { action: 'open-external'; protocol: string; hostname: string }
  | { action: 'block'; protocol: string; hostname: string; reason: string }

export function classifyMiroNavigation(value: string): MiroNavigationDecision {
  let parsed: URL
  try {
    parsed = new URL(value)
  } catch {
    return { action: 'block', protocol: 'invalid', hostname: '', reason: 'invalid-url' }
  }

  const protocol = parsed.protocol.toLowerCase()
  const hostname = parsed.hostname.toLowerCase()
  if (!SAFE_WEB_PROTOCOLS.has(protocol)) {
    return { action: 'block', protocol, hostname, reason: 'unsupported-protocol' }
  }
  if (MIRO_WEB_HOST.test(hostname)) return { action: 'allow-internal', protocol, hostname }
  if (MIRO_AUTH_HOSTS.has(hostname)) return { action: 'allow-auth', protocol, hostname }
  return { action: 'open-external', protocol, hostname }
}

export function isMiroDownloadUrlAllowed(value: string) {
  try {
    const parsed = new URL(value)
    if (parsed.protocol === 'blob:') return true
    return parsed.protocol === 'https:' && MIRO_WEB_HOST.test(parsed.hostname)
  } catch {
    return false
  }
}
