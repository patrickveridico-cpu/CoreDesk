import { mkdir, readdir, readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import crypto from 'node:crypto'
import type { EventBus } from '../../../core/events/EventBus'
import type { StorageService } from '../../../core/storage/StorageService'
import type { AuditEntry, OperationsData } from '../../../../shared/operations/models'

export class OperationsGovernanceService {
  private readonly directory: string
  private audit: AuditEntry[] = []
  constructor(private readonly userDataPath: string, private readonly storage: StorageService, private readonly events: EventBus) { this.directory = path.join(userDataPath, 'operations') }
  async initialize() { this.audit = await this.storage.readRaw(path.join(this.directory, 'audit.json'), [], (value) => Array.isArray(value) ? value as AuditEntry[] : []); this.subscribe() }
  listAudit() { return structuredClone(this.audit).reverse() }
  async record(action: string, entity: string, entityId: string | undefined, summary: string, changedFields: string[] = [], origin = 'coredesk') { const entry: AuditEntry = { id: crypto.randomUUID(), timestamp: new Date().toISOString(), action, entity, entityId, summary, changedFields, origin, correlationId: crypto.randomUUID() }; this.audit.push(entry); await this.storage.writeRaw(path.join(this.directory, 'audit.json'), this.audit); return entry }
  async createBackup(data: OperationsData) { await mkdir(this.directory, { recursive: true }); const name = `operations-${new Date().toISOString().replace(/[:.]/g, '-')}.backup.json`; const file = path.join(this.directory, name); await this.storage.writeRaw(file, data); await this.record('backup-created', 'operations', undefined, 'Backup operacional criado'); return { name, file, createdAt: new Date().toISOString() } }
  async listBackups() { await mkdir(this.directory, { recursive: true }); return (await readdir(this.directory)).filter((name) => name.endsWith('.backup.json')).sort().reverse() }
  async restoreBackup(name: string) { if (!/^operations-[\w.-]+\.backup\.json$/.test(name)) throw new Error('Backup inválido.'); const file = path.join(this.directory, name); const parsed = JSON.parse(await readFile(file, 'utf8')) as OperationsData; await stat(file); await this.record('backup-restored', 'operations', undefined, `Backup ${name} restaurado`); return parsed }
  private subscribe() { this.events.on('operations:base-created', (event) => void this.record('created', 'base', event.id, 'Base criada')); this.events.on('operations:base-updated', (event) => void this.record('updated', 'base', event.id, 'Base atualizada')); this.events.on('operations:insurer-created', (event) => void this.record('created', 'insurer', event.id, 'Seguradora salva')); this.events.on('operations:pricing-table-updated', (event) => void this.record('versioned', 'pricing-table', event.id, 'Tabela de preço salva')); this.events.on('operations:route-calculated', (event) => void this.record('calculated', 'route', undefined, `Rota ${event.source}`, ['totalKm'])); this.events.on('operations:quote-calculated', (event) => void this.record('calculated', 'quote', event.id, 'Orçamento calculado', ['total'])); this.events.on('operations:quote-saved', (event) => void this.record('saved', 'quote', event.id, 'Orçamento salvo')); this.events.on('operations:import-completed', (event) => void this.record('imported', 'operations', undefined, 'Importação concluída', Object.keys(event.counts))) }
}
