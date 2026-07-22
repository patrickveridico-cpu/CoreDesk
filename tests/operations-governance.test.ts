import { describe, expect, it } from 'vitest'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { EventBus } from '../electron/core/events/EventBus'
import { LoggerService } from '../electron/core/logging/LoggerService'
import { StorageService } from '../electron/core/storage/StorageService'
import { OperationsGovernanceService } from '../electron/modules/operations/services/OperationsGovernanceService'
import { emptyOperationsData } from '../shared/operations/schemas'

describe('operations governance', () => {
  it('records audit and creates/list backups', async () => { const dir = await mkdtemp(path.join(os.tmpdir(), 'coredesk-governance-')); const events = new EventBus(); const governance = new OperationsGovernanceService(dir, new StorageService(new LoggerService(dir, 'test', false)), events); await governance.initialize(); await governance.record('test', 'operations', undefined, 'Teste'); const backup = await governance.createBackup(emptyOperationsData()); expect((await governance.listAudit()).length).toBeGreaterThanOrEqual(2); expect((await governance.listBackups())).toContain(backup.name); await rm(dir, { recursive: true, force: true }) })
})
