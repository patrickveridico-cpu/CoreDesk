import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { WorkspaceTab } from '../shared/contracts'
import {
  MIRO_DASHBOARD_URL,
  MIRO_PARTITION,
  MIRO_TAB_ID,
  MIRO_VIEW_ID,
  classifyMiroNavigation,
  isMiroDownloadUrlAllowed,
} from '../shared/miro'
import { canStartManagedDownload } from '../shared/downloads'
import { PermissionService } from '../electron/core/permissions/PermissionService'
import {
  initialTabs,
  normalizeTabsStateForBootstrap,
  useTabsStore,
} from '../src/store/useTabsStore'

let persistError: ReturnType<typeof vi.spyOn>
let persistWarning: ReturnType<typeof vi.spyOn>

function normalized(input: unknown) {
  return normalizeTabsStateForBootstrap(input) as { tabs: WorkspaceTab[]; activeTabId: string }
}

describe('Miro workspace integration', () => {
  beforeEach(() => {
    persistError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    persistWarning = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    useTabsStore.setState({
      tabs: initialTabs.map((tab) => ({ ...tab })),
      activeTabId: 'home',
      closedWebTabs: [],
      previousTabIds: {},
    })
  })

  afterEach(() => {
    persistError.mockRestore()
    persistWarning.mockRestore()
  })

  it('defines a stable dedicated view, official dashboard and isolated partition', () => {
    expect(MIRO_TAB_ID).toBe('app-miro')
    expect(MIRO_VIEW_ID).toBe(MIRO_TAB_ID)
    expect(MIRO_DASHBOARD_URL).toBe('https://miro.com/app/dashboard/')
    expect(MIRO_PARTITION).toBe('persist:coredesk-miro')
    expect(MIRO_PARTITION).not.toMatch(/whatsapp|google|corechat/)
  })

  it('restores exactly one Miro tab while keeping Home active', () => {
    const duplicate = { ...initialTabs.find((tab) => tab.id === MIRO_TAB_ID)! }
    const first = normalized({ tabs: [initialTabs[0], duplicate, duplicate], activeTabId: MIRO_TAB_ID })
    const second = normalized(first)

    expect(first.activeTabId).toBe('home')
    expect(first.tabs.filter((tab) => tab.id === MIRO_TAB_ID)).toHaveLength(1)
    expect(second.tabs.filter((tab) => tab.id === MIRO_TAB_ID)).toHaveLength(1)
    expect(second.tabs.find((tab) => tab.id === MIRO_TAB_ID)).toMatchObject({
      url: MIRO_DASHBOARD_URL,
      partition: MIRO_PARTITION,
      closable: false,
      pinned: true,
    })
  })

  it('does not duplicate the Miro tab when selected repeatedly', () => {
    useTabsStore.getState().selectTab(MIRO_TAB_ID)
    useTabsStore.getState().selectTab(MIRO_TAB_ID)
    expect(useTabsStore.getState().activeTabId).toBe(MIRO_TAB_ID)
    expect(useTabsStore.getState().tabs.filter((tab) => tab.id === MIRO_TAB_ID)).toHaveLength(1)
  })
})

describe('Miro navigation policy', () => {
  it('allows the dashboard, boards and official Miro subdomains', () => {
    expect(classifyMiroNavigation(MIRO_DASHBOARD_URL).action).toBe('allow-internal')
    expect(classifyMiroNavigation('https://miro.com/app/board/uX-example=/')).toMatchObject({
      action: 'allow-internal',
      hostname: 'miro.com',
    })
    expect(classifyMiroNavigation('https://help.miro.com/hc/')).toMatchObject({
      action: 'allow-internal',
      hostname: 'help.miro.com',
    })
  })

  it('allows only observed standard authentication hosts and keeps other web links external', () => {
    expect(classifyMiroNavigation('https://accounts.google.com/o/oauth2/v2/auth').action).toBe('allow-auth')
    expect(classifyMiroNavigation('https://login.microsoftonline.com/common/oauth2/authorize').action).toBe('allow-auth')
    expect(classifyMiroNavigation('https://appleid.apple.com/auth/authorize').action).toBe('allow-auth')
    expect(classifyMiroNavigation('https://example.com/docs').action).toBe('open-external')
  })

  it('blocks dangerous, local and desktop-app protocols', () => {
    for (const url of [
      'javascript:alert(1)',
      'data:text/html,test',
      'file:///C:/secret.txt',
      'filesystem:https://miro.com/temporary/file',
      'miroapp://board/example',
      'miro://board/example',
    ]) {
      expect(classifyMiroNavigation(url).action).toBe('block')
    }
  })
})

describe('Miro download policy', () => {
  const source = {
    viewId: MIRO_VIEW_ID,
    partition: MIRO_PARTITION,
    type: 'web' as const,
    isVisible: () => true,
  }

  it('requires an active visible Miro view and explicit user gesture', () => {
    expect(canStartManagedDownload(source, 'https://miro.com/export/board.pdf', true)).toBe(true)
    expect(canStartManagedDownload(source, 'blob:https://miro.com/export-id', true)).toBe(true)
    expect(canStartManagedDownload(source, 'https://miro.com/export/board.pdf', false)).toBe(false)
    expect(canStartManagedDownload({ ...source, isVisible: () => false }, 'https://miro.com/export/board.pdf', true)).toBe(false)
  })

  it('rejects unobserved third-party download hosts and executable protocols', () => {
    expect(isMiroDownloadUrlAllowed('https://example.com/export.pdf')).toBe(false)
    expect(canStartManagedDownload(source, 'https://example.com/export.pdf', true)).toBe(false)
    expect(canStartManagedDownload(source, 'file:///C:/payload.exe', true)).toBe(false)
  })
})

describe('Miro sensitive permissions', () => {
  it('keeps clipboard reads and device permissions denied by the existing service', () => {
    const permissions = new PermissionService()
    for (const permission of [
      'clipboard-read',
      'notifications',
      'media',
      'display-capture',
      'geolocation',
      'midi',
      'serial',
      'usb',
      'bluetooth',
    ]) {
      expect(permissions.isPermissionAllowed(permission)).toBe(false)
    }
  })
})
