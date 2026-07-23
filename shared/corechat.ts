export const CORECHAT_VIEW_ID = 'coredesk-corechat'
export const CORECHAT_URL = 'https://chatgpt.com/'
export const CORECHAT_PARTITION = 'persist:coredesk-corechat'

export type CoreChatPanelPhase = 'closed' | 'opening' | 'open' | 'closing'
export type CoreChatPanelEvent = 'open' | 'frame' | 'close' | 'transition-end'

export function reduceCoreChatPanelPhase(
  phase: CoreChatPanelPhase,
  event: CoreChatPanelEvent,
  reducedMotion = false,
): CoreChatPanelPhase {
  if (event === 'open') return reducedMotion ? 'open' : 'opening'
  if (event === 'frame' && phase === 'opening') return 'open'
  if (event === 'close') return reducedMotion ? 'closed' : 'closing'
  if (event === 'transition-end' && phase === 'closing') return 'closed'
  return phase
}

export interface CoreChatCompactResult {
  enabled: boolean
  applied: boolean
  reason: string
  hiddenElements: number
}

export type CoreChatNavigationDecision =
  | { action: 'allow-internal' | 'allow-auth' | 'open-external'; protocol: string; hostname: string }
  | { action: 'block'; protocol: string; hostname: string; reason: string }

const CORECHAT_HOSTS = ['chatgpt.com', 'openai.com', 'oaistatic.com', 'oaiusercontent.com'] as const
const AUTH_HOSTS = [
  'accounts.google.com',
  'gstatic.com',
  'googleusercontent.com',
  'login.microsoftonline.com',
  'microsoft.com',
  'login.live.com',
  'appleid.apple.com',
  'apple.com',
] as const

function matchesHost(hostname: string, allowed: readonly string[]) {
  const normalized = hostname.toLocaleLowerCase('en-US')
  return allowed.some((host) => normalized === host || normalized.endsWith(`.${host}`))
}

export function classifyCoreChatNavigation(value: string): CoreChatNavigationDecision {
  if (value === 'about:blank' || value.startsWith('about:blank#')) {
    return { action: 'allow-auth', protocol: 'about:', hostname: '' }
  }
  try {
    const parsed = new URL(value)
    const protocol = parsed.protocol.toLocaleLowerCase('en-US')
    const hostname = parsed.hostname.toLocaleLowerCase('en-US')
    if (protocol !== 'http:' && protocol !== 'https:') {
      return { action: 'block', protocol, hostname, reason: 'protocol-not-allowed' }
    }
    if (matchesHost(hostname, CORECHAT_HOSTS)) return { action: 'allow-internal', protocol, hostname }
    if (matchesHost(hostname, AUTH_HOSTS)) return { action: 'allow-auth', protocol, hostname }
    return { action: 'open-external', protocol, hostname }
  } catch {
    return { action: 'block', protocol: 'invalid', hostname: '', reason: 'invalid-url' }
  }
}

const COMPOSER_SELECTORS = [
  'main textarea',
  'main [contenteditable="true"][role="textbox"]',
  'main [contenteditable="true"]',
] as const

const SIDEBAR_SELECTORS = [
  '[data-testid="history-sidebar"]',
  'aside:has(nav[aria-label*="chat history" i])',
  'nav[aria-label*="chat history" i]',
  'aside:has(nav[aria-label*="histórico" i])',
  'nav[aria-label*="histórico" i]',
] as const

export function createCoreChatCompactScript(enabled: boolean) {
  const composerSelectors = JSON.stringify(COMPOSER_SELECTORS)
  const sidebarSelectors = JSON.stringify(SIDEBAR_SELECTORS)
  return `(() => {
    const STYLE_ID = 'coredesk-corechat-compact-style';
    const HIDDEN_ATTRIBUTE = 'data-coredesk-compact-hidden';
    const cleanup = () => {
      document.getElementById(STYLE_ID)?.remove();
      document.querySelectorAll('[' + HIDDEN_ATTRIBUTE + ']').forEach((element) => element.removeAttribute(HIDDEN_ATTRIBUTE));
    };
    cleanup();
    if (!${JSON.stringify(enabled)}) {
      return { enabled: false, applied: false, reason: 'disabled', hiddenElements: 0 };
    }
    try {
      const composer = ${composerSelectors}.map((selector) => document.querySelector(selector)).find(Boolean);
      if (!composer) {
        return { enabled: true, applied: false, reason: 'composer-not-found', hiddenElements: 0 };
      }
      const candidates = [...new Set(${sidebarSelectors}.map((selector) => document.querySelector(selector)).filter(Boolean))];
      if (candidates.length === 0) {
        return { enabled: true, applied: false, reason: 'secondary-navigation-not-found', hiddenElements: 0 };
      }
      candidates.forEach((element) => element.setAttribute(HIDDEN_ATTRIBUTE, 'true'));
      const style = document.createElement('style');
      style.id = STYLE_ID;
      style.textContent = '[' + HIDDEN_ATTRIBUTE + '="true"] { display: none !important; }';
      document.head.appendChild(style);
      const computed = getComputedStyle(composer);
      const rect = composer.getBoundingClientRect();
      const composerVisible = computed.display !== 'none' && computed.visibility !== 'hidden' && Number(computed.opacity) > 0 && rect.width > 0 && rect.height > 0;
      if (!composerVisible) {
        cleanup();
        return { enabled: true, applied: false, reason: 'composer-hidden-after-apply', hiddenElements: 0 };
      }
      return { enabled: true, applied: true, reason: 'applied', hiddenElements: candidates.length };
    } catch (error) {
      cleanup();
      return {
        enabled: true,
        applied: false,
        reason: error instanceof Error ? 'script-error:' + error.name : 'script-error',
        hiddenElements: 0,
      };
    }
  })()`
}
