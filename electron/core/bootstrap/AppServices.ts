import { app } from 'electron'
import path from 'node:path'
import { CommandRegistry } from '../commands/CommandRegistry'
import { ConfigService } from '../config/ConfigService'
import { EventBus } from '../events/EventBus'
import { LoggerService } from '../logging/LoggerService'
import { PermissionService } from '../permissions/PermissionService'
import { StorageService } from '../storage/StorageService'
import { WorkspaceService } from '../workspace/WorkspaceService'
import { OperationsService } from '../../modules/operations/services/OperationsService'
import { OperationsGovernanceService } from '../../modules/operations/services/OperationsGovernanceService'

export interface AppServices { logger: LoggerService; events: EventBus; config: ConfigService; permissions: PermissionService; commands: CommandRegistry; workspace: WorkspaceService; storage: StorageService; operations: OperationsService; operationsGovernance: OperationsGovernanceService; initialize: () => Promise<void>; shutdown: () => Promise<void> }
export function createAppServices(): AppServices {
  const logger = new LoggerService(path.join(app.getPath('userData'), 'logs')); const events = new EventBus(); const storage = new StorageService(logger.child('storage')); const config = new ConfigService(app.getPath('userData'), events, logger, storage); const permissions = new PermissionService(); const commands = new CommandRegistry(events); const workspace = new WorkspaceService(events); const operations = new OperationsService(app.getPath('userData'), storage, events, logger.child('operations')); const operationsGovernance = new OperationsGovernanceService(app.getPath('userData'), storage, events)
  return { logger, events, config, permissions, commands, workspace, storage, operations, operationsGovernance, initialize: async () => { await config.load(); await operations.initialize(); await operationsGovernance.initialize(); events.emit('app:ready', undefined); logger.info('Serviços centrais inicializados') }, shutdown: async () => { events.emit('app:before-quit', undefined); logger.info('Serviços centrais encerrados') } }
}
