import { app } from 'electron'
import { readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import type { EventBus } from '../../../core/events/EventBus'
import type { LoggerService } from '../../../core/logging/LoggerService'
import type { StorageService } from '../../../core/storage/StorageService'
import { OperationsRepository } from '../repositories/OperationsRepository'
import { calculateQuoteTotal, selectPricingTable } from '../../../../shared/operations/calculations'
import type { OperationalCompany, OperationBase, OperationInsurer, OperationQuote, OperationSpecialty, OperationsData, PricingTable, RouteCalculation } from '../../../../shared/operations/models'
import { emptyOperationsData } from '../../../../shared/operations/schemas'
import type { OperationsPreview, SaveBaseInput, SaveInsurerInput, SavePricingTableInput, SaveSpecialtyInput } from '../../../../shared/operations/contracts'
import { applyLegacyPriceTableCompanyMigration, detectActivePriceTableConflicts, previewLegacyPriceTableCompanyMigration, resolvePriceTableConflict, type LegacyCompanyMigrationReport } from '../../../../shared/operations/migration'
import { decideDeletion, getMaintenanceReferences } from '../../../../shared/operations/maintenance'

const uid = () => crypto.randomUUID()
const text = (value: unknown) => typeof value === 'string' ? value : ''
const normalizeCompanyName = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('pt-BR')
const maintenanceError = (code: string, message: string) => new Error(`${code}: ${message}`)
async function parseDb(filePath: string) { try { return (await readFile(filePath, 'utf8')).split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line) as Record<string, unknown>) } catch { return [] } }

export class OperationsService {
  private data: OperationsData = emptyOperationsData()
  private readonly repository: OperationsRepository
  constructor(private readonly userDataPath: string, private readonly storage: StorageService, private readonly events: EventBus, private readonly logger: LoggerService) { this.repository = new OperationsRepository(userDataPath, storage) }
  async initialize() { const before = await this.repository.inspect(); this.data = await this.repository.load(); this.logger.info('Arquivo operacional carregado', { filePath: this.repository.getPath(), found: before.found, tables: this.data.pricingTables.length, companies: this.data.operationalCompanies.length, withoutCompanyId: this.data.pricingTables.filter((item) => !('companyId' in item) || !(item as PricingTable & { companyId?: string }).companyId).length }); const defaults: Array<[string, string]> = [['Resgate 116', 'RESGATE_116'], ['Auto Elite', 'AUTO_ELITE'], ['Help Go', 'HELP_GO']]; let changed = false; for (const [name, code] of defaults) { if (!this.data.operationalCompanies.some((item) => item.normalizedName === normalizeCompanyName(name) || item.code === code)) { const now = new Date().toISOString(); this.data.operationalCompanies.push({ id: uid(), name, normalizedName: normalizeCompanyName(name), code, status: 'active', createdAt: now, updatedAt: now }); changed = true; this.events.emit('operations:operational-company-created', { name, code, origin: 'migration' }) } } if (changed && (!before.found || (before.valid && this.data.pricingTables.length > 0))) await this.persist(); if (!before.valid && before.found) { this.logger.error('Migração bloqueada: arquivo operacional inválido', { filePath: this.repository.getPath(), reason: before.error }); return this.snapshot() } if (before.found && this.data.pricingTables.length === 0) { this.logger.warn('Migração bloqueada: arquivo operacional encontrado sem tabelas', { filePath: this.repository.getPath() }); return this.snapshot() } const pending = this.data.pricingTables.filter((item) => !(item as PricingTable & { companyId?: string }).companyId); if (this.data.pricingTables.length && pending.length && this.data.operationalCompanies.length) { const migration = applyLegacyPriceTableCompanyMigration({ priceTables: this.data.pricingTables, operationalCompanies: this.data.operationalCompanies }); const unresolved = migration.report.needsReview + migration.report.ambiguous; if (migration.report.autoMapped > 0 && unresolved === 0) { const backupPath = await this.repository.backupBeforeMigration(); this.data.pricingTables = migration.tables; await this.persist(); this.logger.info('Migração de empresas aplicada', { filePath: this.repository.getPath(), backupPath, tablesAfter: this.data.pricingTables.length, conflicts: migration.report.conflicts, conflictingRecords: migration.report.conflictingRecords }) } else { this.logger.warn('Migração bloqueada: prévia não determinística', { needsReview: migration.report.needsReview, ambiguous: migration.report.ambiguous }) } } return this.snapshot() }
  async diagnostics() { const inspection = await this.repository.inspect(); const tables = inspection.data?.pricingTables ?? this.data.pricingTables; const conflicts = detectActivePriceTableConflicts(tables); return { filePath: this.repository.getPath(), found: inspection.found, valid: inspection.valid, fileSize: inspection.fileSize, modifiedAt: inspection.modifiedAt, companies: inspection.data?.operationalCompanies.length ?? this.data.operationalCompanies.length, insurers: inspection.data?.insurers.length ?? this.data.insurers.length, specialties: inspection.data?.specialties.length ?? this.data.specialties.length, bases: inspection.data?.bases.length ?? this.data.bases.length, tables: tables.length, withCompanyId: tables.filter((item) => (item as PricingTable & { companyId?: string }).companyId).length, withoutCompanyId: tables.filter((item) => !(item as PricingTable & { companyId?: string }).companyId).length, conflicts: conflicts.length, conflictingRecords: conflicts.reduce((sum, group) => sum + group.count, 0) } }
  snapshot() { return structuredClone(this.data) }
  private async persist() { await this.repository.save(this.data) }
  previewLegacyPriceTableCompanyMigration() { return previewLegacyPriceTableCompanyMigration({ priceTables: this.data.pricingTables, operationalCompanies: this.data.operationalCompanies }) }
  async applyLegacyPriceTableCompanyMigration() { const result = applyLegacyPriceTableCompanyMigration({ priceTables: this.data.pricingTables, operationalCompanies: this.data.operationalCompanies }); if (result.report.autoMapped > 0) { await this.storage.writeRaw(path.join(this.userDataPath, 'operations', 'pricing-company-migration.backup.json'), this.data); this.data.pricingTables = result.tables; await this.persist(); await this.storage.writeRaw(path.join(this.userDataPath, 'operations', 'pricing-company-migration-report.json'), result.report) } return result.report as LegacyCompanyMigrationReport }
  listPriceTableConflicts() { return detectActivePriceTableConflicts(this.data.pricingTables) }
  async resolvePriceTableConflict(conflictId: string, keepId: string) { const conflict = this.listPriceTableConflicts().find((item) => item.id === conflictId); if (!conflict) throw new Error('Conflito não encontrado.'); this.data.pricingTables = resolvePriceTableConflict(this.data.pricingTables, conflict, keepId); await this.persist(); return conflict }
  listOperationalCompanies(status?: OperationalCompany['status']) { return this.data.operationalCompanies.filter((item) => !status || item.status === status).map((item) => ({ ...item })) }
  getOperationalCompany(id: string) { const item = this.data.operationalCompanies.find((entry) => entry.id === id); return item ? { ...item } : undefined }
  async saveOperationalCompany(input: Partial<OperationalCompany> & Pick<OperationalCompany, 'name' | 'code'>) { const name = input.name.trim().replace(/\s+/g, ' '); const code = input.code.trim().toUpperCase().replace(/\s+/g, '_'); const normalizedName = normalizeCompanyName(name); if (!name || !code) throw new Error('Nome e código são obrigatórios.'); if (name.length > 120 || code.length > 48) throw new Error('Nome ou código excede o limite permitido.'); const duplicate = this.data.operationalCompanies.find((item) => item.id !== input.id && (item.normalizedName === normalizedName || item.code === code)); if (duplicate) throw new Error('Já existe uma empresa com este nome ou código.'); const previous = input.id ? this.data.operationalCompanies.find((item) => item.id === input.id) : undefined; const now = new Date().toISOString(); const item: OperationalCompany = { id: previous?.id ?? uid(), name, normalizedName, code, status: input.status === 'archived' ? 'archived' : previous?.status ?? 'active', notes: input.notes?.trim() || undefined, createdAt: previous?.createdAt ?? now, updatedAt: now, archivedAt: previous?.archivedAt }; this.data.operationalCompanies = [...this.data.operationalCompanies.filter((entry) => entry.id !== item.id), item]; await this.persist(); this.events.emit(previous ? 'operations:operational-company-updated' : 'operations:operational-company-created', { id: item.id, previous, current: item, origin: 'renderer' }); return { ...item } }
  async archiveOperationalCompany(id: string) { const item = this.data.operationalCompanies.find((entry) => entry.id === id); if (!item) throw new Error('Empresa não encontrada.'); const updated = { ...item, status: 'archived' as const, archivedAt: new Date().toISOString(), updatedAt: new Date().toISOString() }; this.data.operationalCompanies = this.data.operationalCompanies.map((entry) => entry.id === id ? updated : entry); await this.persist(); this.events.emit('operations:operational-company-archived', { id, previous: item, current: updated, origin: 'renderer' }); return updated }
  async restoreOperationalCompany(id: string) { const item = this.data.operationalCompanies.find((entry) => entry.id === id); if (!item) throw new Error('Empresa não encontrada.'); const updated = { ...item, status: 'active' as const, archivedAt: undefined, updatedAt: new Date().toISOString() }; this.data.operationalCompanies = this.data.operationalCompanies.map((entry) => entry.id === id ? updated : entry); await this.persist(); this.events.emit('operations:operational-company-restored', { id, previous: item, current: updated, origin: 'renderer' }); return updated }
  async saveBase(input: SaveBaseInput) {
    const previous = input.id ? this.data.bases.find((item) => item.id === input.id) : undefined
    if (input.maintenanceAction === 'delete') {
      if (!previous) throw maintenanceError('RECORD_NOT_FOUND', 'Base não encontrada.')
      const decision = decideDeletion('base', previous.name, getMaintenanceReferences(this.data, 'base', previous.id))
      if (decision.action === 'blocked') throw maintenanceError('RECORD_IN_USE', decision.message)
      if (decision.action === 'inactivate') {
        const updated = { ...previous, status: 'inactive' as const, archivedAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
        this.data.bases = this.data.bases.map((item) => item.id === updated.id ? updated : item)
        await this.persist()
        this.events.emit('operations:base-updated', { id: updated.id })
        return updated
      }
      this.data.bases = this.data.bases.filter((item) => item.id !== previous.id)
      await this.persist()
      this.events.emit('operations:base-updated', { id: previous.id })
      return previous
    }
    const name = input.name.trim()
    const address = input.address.trim()
    const state = input.state?.trim().toUpperCase() || undefined
    if (!name || !address) throw maintenanceError('VALIDATION_ERROR', 'Nome e endereço são obrigatórios.')
    if (state && !/^[A-Z]{2}$/.test(state)) throw maintenanceError('VALIDATION_ERROR', 'UF deve possuir duas letras.')
    if (this.data.bases.some((item) => item.id !== input.id && item.name.trim().toLocaleLowerCase('pt-BR') === name.toLocaleLowerCase('pt-BR'))) throw maintenanceError('DUPLICATE_CODE', 'Já existe uma Base com este nome.')
    const now = new Date().toISOString()
    const status = input.status ?? previous?.status ?? 'active'
    const item: OperationBase = { id: previous?.id ?? uid(), name, address, city: input.city?.trim() || undefined, state, latitude: input.latitude, longitude: input.longitude, specialties: input.specialties ?? previous?.specialties ?? [], status, notes: input.notes?.trim() || undefined, legacyId: previous?.legacyId ?? input.legacyId, createdAt: previous?.createdAt ?? now, updatedAt: now, archivedAt: status === 'active' ? undefined : previous?.archivedAt ?? now }
    this.data.bases = [...this.data.bases.filter((entry) => entry.id !== item.id), item]
    await this.persist()
    this.events.emit(previous ? 'operations:base-updated' : 'operations:base-created', { id: item.id })
    return item
  }

  async saveInsurer(input: SaveInsurerInput) {
    const previous = input.id ? this.data.insurers.find((item) => item.id === input.id) : undefined
    if (input.maintenanceAction === 'delete') {
      if (!previous) throw maintenanceError('RECORD_NOT_FOUND', 'Seguradora não encontrada.')
      const decision = decideDeletion('insurer', previous.name, getMaintenanceReferences(this.data, 'insurer', previous.id))
      if (decision.action === 'blocked') throw maintenanceError('RECORD_IN_USE', decision.message)
      if (decision.action === 'inactivate') {
        const updated = { ...previous, status: 'inactive' as const, archivedAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
        this.data.insurers = this.data.insurers.map((item) => item.id === updated.id ? updated : item)
        await this.persist()
        this.events.emit('operations:insurer-created', { id: updated.id })
        return updated
      }
      this.data.insurers = this.data.insurers.filter((item) => item.id !== previous.id)
      await this.persist()
      this.events.emit('operations:insurer-created', { id: previous.id })
      return previous
    }
    const name = input.name.trim()
    const code = input.code?.trim().toUpperCase() || undefined
    if (!name) throw maintenanceError('VALIDATION_ERROR', 'Nome é obrigatório.')
    if (this.data.insurers.some((item) => item.id !== input.id && item.name.trim().toLocaleLowerCase('pt-BR') === name.toLocaleLowerCase('pt-BR'))) throw maintenanceError('DUPLICATE_RECORD', 'Já existe uma Seguradora com este nome.')
    if (code && this.data.insurers.some((item) => item.id !== input.id && item.code?.toUpperCase() === code)) throw maintenanceError('DUPLICATE_CODE', 'Já existe uma Seguradora com este código.')
    const now = new Date().toISOString()
    const status = input.status ?? previous?.status ?? 'active'
    const item: OperationInsurer = { id: previous?.id ?? uid(), name, company: input.company?.trim() || undefined, code, status, notes: input.notes?.trim() || undefined, legacyId: previous?.legacyId ?? input.legacyId, createdAt: previous?.createdAt ?? now, updatedAt: now, archivedAt: status === 'active' ? undefined : previous?.archivedAt ?? now }
    this.data.insurers = [...this.data.insurers.filter((entry) => entry.id !== item.id), item]
    await this.persist()
    this.events.emit('operations:insurer-created', { id: item.id })
    return item
  }

  async saveSpecialty(input: SaveSpecialtyInput) {
    const previous = input.id ? this.data.specialties.find((item) => item.id === input.id) : undefined
    if (input.maintenanceAction === 'delete') {
      if (!previous) throw maintenanceError('RECORD_NOT_FOUND', 'Especialidade não encontrada.')
      const decision = decideDeletion('specialty', previous.name, getMaintenanceReferences(this.data, 'specialty', previous.id))
      if (decision.action === 'blocked') throw maintenanceError('RECORD_IN_USE', decision.message)
      if (decision.action === 'inactivate') {
        const updated = { ...previous, status: 'inactive' as const, archivedAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
        this.data.specialties = this.data.specialties.map((item) => item.id === updated.id ? updated : item)
        await this.persist()
        return updated
      }
      this.data.specialties = this.data.specialties.filter((item) => item.id !== previous.id)
      await this.persist()
      return previous
    }
    const name = input.name.trim()
    if (!name) throw maintenanceError('VALIDATION_ERROR', 'Nome é obrigatório.')
    if (this.data.specialties.some((item) => item.id !== input.id && item.name.trim().toLocaleLowerCase('pt-BR') === name.toLocaleLowerCase('pt-BR'))) throw maintenanceError('DUPLICATE_CODE', 'Já existe uma Especialidade com este nome.')
    const now = new Date().toISOString()
    const status = input.status ?? previous?.status ?? 'active'
    const item: OperationSpecialty = { id: previous?.id ?? uid(), name, category: input.category?.trim() || undefined, status, legacyId: previous?.legacyId ?? input.legacyId, createdAt: previous?.createdAt ?? now, updatedAt: now, archivedAt: status === 'active' ? undefined : previous?.archivedAt ?? now }
    this.data.specialties = [...this.data.specialties.filter((entry) => entry.id !== item.id), item]
    await this.persist()
    return item
  }

  async savePricingTable(input: SavePricingTableInput) {
    const previous = input.id ? this.data.pricingTables.find((item) => item.id === input.id) : undefined
    if (input.maintenanceAction === 'delete') {
      if (!previous) throw maintenanceError('RECORD_NOT_FOUND', 'Tabela não encontrada.')
      const decision = decideDeletion('pricing-table', `a tabela ${previous.legacyId ?? previous.id}`, getMaintenanceReferences(this.data, 'pricing-table', previous.id))
      if (decision.action === 'inactivate') {
        const updated = { ...previous, status: 'inactive' as const, archivedAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
        this.data.pricingTables = this.data.pricingTables.map((item) => item.id === updated.id ? updated : item)
        await this.persist()
        this.events.emit('operations:pricing-table-updated', { id: updated.id })
        return updated
      }
      this.data.pricingTables = this.data.pricingTables.filter((item) => item.id !== previous.id)
      await this.persist()
      this.events.emit('operations:pricing-table-updated', { id: previous.id })
      return previous
    }
    const values = [input.exitValue, input.kmFranchise, input.kmValue, input.workHourValue ?? 0]
    if (!values.every((value) => Number.isFinite(value) && value >= 0)) throw maintenanceError('VALIDATION_ERROR', 'Valores da tabela devem ser finitos e não negativos.')
    const insurer = this.data.insurers.find((item) => item.id === input.insurerId)
    const specialty = this.data.specialties.find((item) => item.id === input.specialtyId)
    const company = input.companyId ? this.data.operationalCompanies.find((item) => item.id === input.companyId) : undefined
    if (!previous && !input.companyId) throw maintenanceError('VALIDATION_ERROR', 'Empresa é obrigatória.')
    if (!insurer || !specialty || (input.companyId && !company)) throw maintenanceError('RELATED_RECORD_NOT_FOUND', 'Empresa, Seguradora ou Especialidade não encontrada.')
    const referencesChanged = !previous || previous.companyId !== input.companyId || previous.insurerId !== input.insurerId || previous.specialtyId !== input.specialtyId || (previous.status !== 'active' && (input.status ?? 'active') === 'active')
    if (referencesChanged && (insurer.status !== 'active' || specialty.status !== 'active' || company?.status !== 'active')) throw maintenanceError('INACTIVE_REFERENCE', 'Empresa, Seguradora e Especialidade devem estar ativas.')
    if (input.validFrom && input.validUntil && new Date(input.validFrom) > new Date(input.validUntil)) throw maintenanceError('VALIDATION_ERROR', 'A vigência inicial não pode ser posterior à vigência final.')
    const status = input.status ?? previous?.status ?? 'active'
    const combinationChanged = !previous || previous.companyId !== input.companyId || previous.insurerId !== input.insurerId || previous.specialtyId !== input.specialtyId || (previous.status !== 'active' && status === 'active')
    if (status === 'active' && combinationChanged && this.data.pricingTables.some((item) => item.id !== input.id && item.status === 'active' && item.companyId === input.companyId && item.insurerId === input.insurerId && item.specialtyId === input.specialtyId)) throw maintenanceError('DUPLICATE_COMBINATION', 'Já existe uma Tabela ativa para esta combinação de Empresa, Seguradora e Especialidade.')
    const now = new Date().toISOString()
    const { maintenanceAction: _maintenanceAction, ...valuesInput } = input
    void _maintenanceAction
    const item: PricingTable = { ...valuesInput, id: previous?.id ?? uid(), status, workHourValue: input.workHourValue ?? 0, legacyId: previous?.legacyId ?? input.legacyId, createdAt: previous?.createdAt ?? input.createdAt ?? now, updatedAt: now, archivedAt: status === 'active' ? undefined : previous?.archivedAt ?? now }
    this.data.pricingTables = [...this.data.pricingTables.filter((entry) => entry.id !== item.id), item]
    await this.persist()
    this.events.emit('operations:pricing-table-updated', { id: item.id })
    return item
  }
  calculateRoute(input: { origin: string; destination: string; stops?: string[]; totalKm: number; source?: RouteCalculation['source'] }): RouteCalculation { if (!input.origin.trim() || !input.destination.trim() || !Number.isFinite(input.totalKm) || input.totalKm < 0) throw new Error('Origem, destino e distância válida são obrigatórios.'); const route: RouteCalculation = { origin: input.origin.trim(), destination: input.destination.trim(), stops: input.stops ?? [], totalKm: input.totalKm, provider: input.source === 'manual' ? 'manual' : 'Google Maps', source: input.source ?? 'manual', calculatedAt: new Date().toISOString() }; this.events.emit('operations:route-calculated', { source: route.source, totalKm: route.totalKm }); return route }
  async calculateQuote(input: { insurerId: string; specialtyId: string; baseId: string; origin: string; destination: string; stops?: string[]; route: RouteCalculation; workHours?: number; extras?: number; discount?: number; observations?: string }) { const insurer = this.data.insurers.find((x) => x.id === input.insurerId && x.status === 'active'); const specialty = this.data.specialties.find((x) => x.id === input.specialtyId && x.status === 'active'); const base = this.data.bases.find((x) => x.id === input.baseId && x.status === 'active'); if (!insurer || !specialty || !base) throw new Error('Base, seguradora e especialidade ativas são obrigatórias.'); const table = selectPricingTable(this.data.pricingTables, input.insurerId, input.specialtyId); if (!table) throw new Error('Nenhuma tabela de preço vigente foi encontrada.'); const calculation = calculateQuoteTotal({ kmTotal: input.route.totalKm, table, workHours: input.workHours, extras: input.extras, discount: input.discount }); const quote: OperationQuote = { id: uid(), insurerId: insurer.id, specialtyId: specialty.id, baseId: base.id, origin: input.origin, destination: input.destination, stops: input.stops ?? [], route: input.route, calculation, message: this.generateMessage(insurer, specialty, base, calculation), status: 'draft', observations: input.observations, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }; this.events.emit('operations:quote-calculated', { id: quote.id, total: calculation.total }); return { quote, calculation } }
  async saveQuote(quote: OperationQuote) { const saved = { ...quote, status: 'saved' as const, updatedAt: new Date().toISOString() }; this.data.quotes = [saved, ...this.data.quotes.filter((x) => x.id !== saved.id)]; await this.persist(); this.events.emit('operations:quote-saved', { id: saved.id }); return saved }
  async deleteQuote(id: string) { this.data.quotes = this.data.quotes.filter((x) => x.id !== id); await this.persist() }
  private generateMessage(insurer: OperationInsurer, specialty: OperationSpecialty, base: OperationBase, c: OperationQuote['calculation']) { const money = (value: number) => `R$ ${value.toFixed(2).replace('.', ',')}`; return `*ORÇAMENTO DE SERVIÇO*\n----------------------------------\n*Seguradora:* ${insurer.name}\n*Especialidade:* ${specialty.name}\n*Base:* ${base.name}\n----------------------------------\n*KM Total:* ${c.kmTotal.toFixed(1)} km\n*Km Saída:* ${c.franchise.toFixed(1)} km\n*KM Excedente:* ${c.kmCharged.toFixed(1)} km\n----------------------------------\n*Saída:* ${money(c.exitValue)}\n*KM Rodado:* ${money(c.kmValue)}\n----------------------------------\n*TOTAL: ${money(c.total)}*\n\n_Gerado por CoreDesk_` }
  async previewImport(sourcePath = path.join(app.getPath('appData'), 'techroute')) { return this.importData(sourcePath, false) }
  async confirmImport(sourcePath = path.join(app.getPath('appData'), 'techroute')) { return this.importData(sourcePath, true) }
  private async importData(sourcePath: string, commit: boolean): Promise<OperationsPreview> { const dir = (await stat(sourcePath).catch(() => null))?.isDirectory() ? sourcePath : path.dirname(sourcePath); const [bases, insurers, tables, history] = await Promise.all(['bases.db', 'insurers.db', 'price_tables.db', 'history.db'].map((name) => parseDb(path.join(dir, name)))); const imported: OperationsData = { ...emptyOperationsData(), bases: bases.map((x) => ({ id: uid(), legacyId: text(x._id), name: text(x.name), address: text(x.address), status: 'active' as const })), insurers: insurers.map((x) => ({ id: uid(), legacyId: text(x._id), name: text(x.name), company: text(x.company), status: 'active' as const })) }
    imported.legacyHistory = history.map((raw) => ({ id: uid(), legacyId: text(raw._id), raw, conversionStatus: 'partial' as const, warnings: ['Registro legado preservado; rota e snapshot financeiro não estão completos no formato original.'] }))
    const specialtyMap = new Map<string, string>()
    for (const row of tables) { const name = text(row.specialty); if (!name) continue; if (!specialtyMap.has(name)) { const id = uid(); specialtyMap.set(name, id); imported.specialties.push({ id, name, status: 'active' }) } const insurer = imported.insurers.find((x) => x.legacyId === text(row.insurer_id)); if (!insurer) continue; imported.pricingTables.push({ id: uid(), legacyId: text(row._id), company: text(row.company), insurerId: insurer.id, specialtyId: specialtyMap.get(name)!, exitValue: Number(row.exit_value) || 0, kmFranchise: Number(row.km_franchise) || 0, kmValue: Number(row.km_value) || 0, workHourValue: Number(row.ht_value) || 0, status: 'active' }) }
    for (const item of [...imported.bases, ...imported.insurers, ...imported.pricingTables]) if (item.legacyId) imported.idMap[item.legacyId] = item.id
    const duplicates = imported.pricingTables.filter((x, i, all) => all.findIndex((y) => y.insurerId === x.insurerId && y.specialtyId === x.specialtyId && y.company === x.company) !== i).map((x) => x.legacyId ?? x.id)
    const preview: OperationsPreview = { sourcePath: dir, counts: { bases: imported.bases.length, insurers: imported.insurers.length, specialties: imported.specialties.length, pricingTables: imported.pricingTables.length, history: history.length }, duplicates, warnings: history.length ? ['Histórico antigo requer revisão manual; registros não são convertidos automaticamente.'] : [], data: imported }
    this.events.emit(commit ? 'operations:import-completed' : 'operations:import-started', { counts: preview.counts }); if (commit) { await this.storage.writeRaw(path.join(this.userDataPath, 'operations', `techroute-import.backup-${Date.now()}.json`), this.data); const merge = <T extends { id: string; legacyId?: string }>(current: T[], incoming: T[]) => [...current, ...incoming.filter((item) => !current.some((existing) => (item.legacyId && existing.legacyId === item.legacyId) || existing.id === item.id))]; this.data = { ...this.data, schemaVersion: 3, bases: merge(this.data.bases, imported.bases), insurers: merge(this.data.insurers, imported.insurers), specialties: merge(this.data.specialties, imported.specialties), pricingTables: merge(this.data.pricingTables, imported.pricingTables), legacyHistory: [...this.data.legacyHistory, ...imported.legacyHistory], idMap: { ...this.data.idMap, ...imported.idMap } }; await this.persist() } this.logger.info('Importação TechRoute processada', { counts: preview.counts, duplicates: duplicates.length }); return preview }
}
