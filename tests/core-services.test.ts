import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { EventBus } from '../electron/core/events/EventBus'
import { LoggerService, sanitizeLogData } from '../electron/core/logging/LoggerService'
import { StorageService } from '../electron/core/storage/StorageService'
import { CommandRegistry } from '../electron/core/commands/CommandRegistry'
import { WorkspaceService } from '../electron/core/workspace/WorkspaceService'
import { PermissionService } from '../electron/core/permissions/PermissionService'
import { ConfigService } from '../electron/core/config/ConfigService'

describe('core services', () => {
  it('emits, once and removes typed event listeners', () => {
    const bus = new EventBus(); let count = 0
    const listener = () => { count += 1 }
    bus.on('app:ready', listener); bus.once('app:ready', listener)
    bus.emit('app:ready', undefined); bus.emit('app:ready', undefined)
    expect(count).toBe(3); bus.off('app:ready', listener); bus.emit('app:ready', undefined); expect(count).toBe(3)
  })

  it('writes atomically and backs up invalid JSON', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'coredesk-storage-')); const file = path.join(dir, 'state.json')
    const storage = new StorageService(); await storage.write(file, { ok: true }, 1)
    expect((await storage.read(file, { ok: false }, { schemaVersion: 1 })).ok).toBe(true)
    await (await import('node:fs/promises')).writeFile(file, '{bad')
    expect((await storage.read(file, { ok: false }, { schemaVersion: 1 })).ok).toBe(false)
    expect((await readdir(dir)).some((name) => name.includes('.invalid-'))).toBe(true)
    await rm(dir, { recursive: true, force: true })
  })

  it('sanitizes secrets and logs JSONL', async () => {
    expect(sanitizeLogData({ token: 'secret', nested: { password: 'pw' }, message: 'hello' })).toMatchObject({ token: '[REDACTED]', nested: { password: '[REDACTED]' }, message: '[REDACTED]' })
    const dir = await mkdtemp(path.join(os.tmpdir(), 'coredesk-log-')); const logger = new LoggerService(dir, 'test', false)
    logger.info('started', { token: 'secret' }); await new Promise((resolve) => setTimeout(resolve, 20))
    expect((await readFile(path.join(dir, 'coredesk.log'), 'utf8'))).toContain('[REDACTED]'); await rm(dir, { recursive: true, force: true })
  })

  it('registers and executes commands with availability metadata', async () => {
    const registry = new CommandRegistry(); let called = false
    registry.register({ id: 'test.command', title: 'Test', execute: () => { called = true }, isAvailable: () => true })
    expect(registry.list()[0].id).toBe('test.command'); expect(await registry.execute('test.command')).toBe(true); expect(called).toBe(true)
  })

  it('tracks active workspace history and enforces navigation policy', () => {
    const bus = new EventBus(); const workspace = new WorkspaceService(bus)
    workspace.setActive('a'); workspace.setActive('b'); workspace.setActive('c'); expect(workspace.getHistory()).toEqual(['b', 'a'])
    const permissions = new PermissionService(); expect(permissions.isAllowedUrl('https://example.com')).toBe(true); expect(permissions.isAllowedUrl('file:///tmp')).toBe(false); expect(permissions.isPermissionAllowed('media')).toBe(false)
  })

  it('loads defaults, persists typed config and emits changes', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'coredesk-config-')); const bus = new EventBus(); let changed = 0
    bus.on('config:changed', () => { changed += 1 })
    const config = new ConfigService(dir, bus, new LoggerService(dir, 'test', false)); await config.load()
    expect(config.get().theme).toBe('dark'); await config.update({ spellcheck: false, language: 'en-US' })
    expect(config.get()).toMatchObject({ spellcheck: false, language: 'en-US' }); expect(changed).toBe(1)
    const second = new ConfigService(dir, bus, new LoggerService(dir, 'test', false)); await second.load(); expect(second.get().spellcheck).toBe(false)
    await rm(dir, { recursive: true, force: true })
  })
})
