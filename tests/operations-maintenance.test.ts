import { mkdtemp, readFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { EventBus } from '../electron/core/events/EventBus'
import { LoggerService } from '../electron/core/logging/LoggerService'
import { StorageService } from '../electron/core/storage/StorageService'
import { OperationsService } from '../electron/modules/operations/services/OperationsService'
import { calculateQuoteTotal, selectPricingTable } from '../shared/operations/calculations'
import { decideDeletion, getMaintenanceReferences } from '../shared/operations/maintenance'
import type { OperationQuote, OperationsData, PricingTable } from '../shared/operations/models'
import { findApplicablePriceTable } from '../shared/operations/pricing'
import { emptyOperationsData, validateOperationsData } from '../shared/operations/schemas'
import { useBudgetWorkspaceStore } from '../src/modules/operations/store/useBudgetWorkspaceStore'

const directories: string[] = []
async function createService(seed?: OperationsData) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'coredesk-maintenance-'))
  directories.push(directory)
  const storage = new StorageService()
  if (seed) await storage.write(path.join(directory, 'operations', 'operations.json'), seed, 3)
  const service = new OperationsService(directory, storage, new EventBus(), new LoggerService(directory, 'test', false))
  await service.initialize()
  return service
}
afterEach(async () => { await new Promise((resolve) => setTimeout(resolve, 30)); await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true, maxRetries: 4, retryDelay: 25 }))) })

async function createCombination(service: OperationsService) {
  const company = await service.saveOperationalCompany({ name: 'Empresa A', code: 'EMP_A' })
  const base = await service.saveBase({ name: 'Base Mafra', address: 'Rua A' })
  const insurer = await service.saveInsurer({ name: 'Seguradora A', code: 'SEG_A' })
  const specialty = await service.saveSpecialty({ name: 'Guincho Leve' })
  const table = await service.savePricingTable({ companyId: company.id, insurerId: insurer.id, specialtyId: specialty.id, exitValue: 100, kmFranchise: 40, kmValue: 2 })
  return { company, base, insurer, specialty, table }
}

describe('manutenção operacional com integridade', () => {
  it('trata registros antigos sem status como ativos sem migração destrutiva', () => {
    const legacy = validateOperationsData({
      bases: [{ id: 'b', name: 'Base antiga', address: 'Rua antiga' }],
      insurers: [{ id: 'i', name: 'Seguradora antiga' }],
      specialties: [{ id: 's', name: 'Especialidade antiga' }],
      pricingTables: [{ id: 't', insurerId: 'i', specialtyId: 's', exitValue: 10, kmFranchise: 0, kmValue: 1 }],
    })
    expect(legacy.bases[0].status).toBe('active')
    expect(legacy.insurers[0].status).toBe('active')
    expect(legacy.specialties[0].status).toBe('active')
    expect(legacy.pricingTables[0].status).toBe('active')
  })

  it('bloqueia exclusão física do item selecionado no orçamento atual', () => {
    const data = emptyOperationsData()
    const references = getMaintenanceReferences(data, 'base', 'base-atual', { base: 'base-atual' })
    expect(decideDeletion('base', 'Base atual', references)).toMatchObject({
      action: 'blocked',
      references: { currentBudget: 1 },
    })
  })

  it('edita Base mantendo ID, persiste endereço e impede nome duplicado', async () => {
    const service = await createService()
    const first = await service.saveBase({ name: 'Base A', address: 'Rua A' })
    await service.saveBase({ name: 'Base B', address: 'Rua B' })
    const updated = await service.saveBase({ ...first, name: 'Base A Atualizada', address: 'Rua Nova, 100', city: 'Mafra', state: 'SC' })
    expect(updated).toMatchObject({ id: first.id, name: 'Base A Atualizada', address: 'Rua Nova, 100', state: 'SC' })
    await expect(service.saveBase({ ...updated, name: 'Base B' })).rejects.toThrow('DUPLICATE_CODE')
  })

  it('exclui Base sem referências e inativa Base que possui histórico', async () => {
    const service = await createService()
    const unused = await service.saveBase({ name: 'Base sem uso', address: 'Rua Livre' })
    await service.saveBase({ ...unused, maintenanceAction: 'delete' })
    expect(service.snapshot().bases.some((item) => item.id === unused.id)).toBe(false)
    const { base, insurer, specialty } = await createCombination(service)
    const route = service.calculateRoute({ origin: 'A', destination: 'B', totalKm: 60 })
    const { quote } = await service.calculateQuote({ insurerId: insurer.id, specialtyId: specialty.id, baseId: base.id, origin: 'A', destination: 'B', route })
    await service.saveQuote(quote)
    const inactivated = await service.saveBase({ ...base, maintenanceAction: 'delete' })
    expect(inactivated.status).toBe('inactive')
    expect(service.snapshot().quotes[0].calculation.total).toBe(140)
  })

  it('detecta Base vinculada a Tabela legada como referência bloqueante', () => {
    const data = emptyOperationsData()
    data.pricingTables.push({ id: 'table', baseId: 'base', insurerId: 'i', specialtyId: 's', exitValue: 0, kmFranchise: 0, kmValue: 0, status: 'active' } as PricingTable & { baseId: string })
    const references = getMaintenanceReferences(data, 'base', 'base')
    expect(decideDeletion('base', 'Base', references)).toMatchObject({ action: 'blocked', references: { tables: 1 } })
  })

  it('edita, inativa e exclui Seguradora sem uso; bloqueia exclusão quando vinculada', async () => {
    const service = await createService()
    const insurer = await service.saveInsurer({ name: 'Seguradora', code: 'SEG' })
    const edited = await service.saveInsurer({ ...insurer, name: 'Seguradora Atualizada', status: 'inactive' })
    expect(edited).toMatchObject({ id: insurer.id, name: 'Seguradora Atualizada', status: 'inactive' })
    await service.saveInsurer({ ...edited, maintenanceAction: 'delete' })
    expect(service.snapshot().insurers.some((item) => item.id === insurer.id)).toBe(false)
    const combination = await createCombination(service)
    await expect(service.saveInsurer({ ...combination.insurer, maintenanceAction: 'delete' })).rejects.toThrow('RECORD_IN_USE')
  })

  it('edita, inativa e exclui Especialidade sem uso; bloqueia exclusão quando vinculada', async () => {
    const service = await createService()
    const specialty = await service.saveSpecialty({ name: 'Especialidade' })
    const edited = await service.saveSpecialty({ ...specialty, category: 'Pesados', status: 'inactive' })
    expect(edited).toMatchObject({ id: specialty.id, category: 'Pesados', status: 'inactive' })
    await service.saveSpecialty({ ...edited, maintenanceAction: 'delete' })
    expect(service.snapshot().specialties.some((item) => item.id === specialty.id)).toBe(false)
    const combination = await createCombination(service)
    await expect(service.saveSpecialty({ ...combination.specialty, maintenanceAction: 'delete' })).rejects.toThrow('RECORD_IN_USE')
  })

  it('edita valores da Tabela, impede combinação nova duplicada e exclui Tabela sem uso', async () => {
    const service = await createService()
    const { table, company, insurer, specialty } = await createCombination(service)
    const edited = await service.savePricingTable({ ...table, exitValue: 125, kmValue: 3.5 })
    expect(edited).toMatchObject({ id: table.id, exitValue: 125, kmValue: 3.5 })
    await expect(service.savePricingTable({ companyId: company.id, insurerId: insurer.id, specialtyId: specialty.id, exitValue: 1, kmFranchise: 1, kmValue: 1 })).rejects.toThrow('DUPLICATE_COMBINATION')
    await service.savePricingTable({ ...edited, maintenanceAction: 'delete' })
    expect(service.snapshot().pricingTables.some((item) => item.id === table.id)).toBe(false)
  })

  it('inativa Tabela usada no histórico e novos cálculos ignoram Tabela inativa', async () => {
    const service = await createService()
    const { base, insurer, specialty, table } = await createCombination(service)
    const route = service.calculateRoute({ origin: 'A', destination: 'B', totalKm: 60 })
    const { quote } = await service.calculateQuote({ insurerId: insurer.id, specialtyId: specialty.id, baseId: base.id, origin: 'A', destination: 'B', route })
    await service.saveQuote(quote)
    const inactivated = await service.savePricingTable({ ...table, maintenanceAction: 'delete' })
    expect(inactivated.status).toBe('inactive')
    expect(selectPricingTable(service.snapshot().pricingTables, insurer.id, specialty.id)).toBeUndefined()
    expect(service.snapshot().quotes[0]).toMatchObject({ id: quote.id, calculation: { total: 140 } })
    expect(calculateQuoteTotal({ kmTotal: 60, table: { exitValue: 100, kmFranchise: 40, kmValue: 2 } }).total).toBe(140)
  })

  it('mantém nomes e valores históricos mesmo quando os cadastros estão inativos', async () => {
    const data = emptyOperationsData()
    data.insurers = [{ id: 'i', name: 'Seguradora histórica', status: 'inactive' }]
    data.specialties = [{ id: 's', name: 'Especialidade histórica', status: 'inactive' }]
    data.bases = [{ id: 'b', name: 'Base histórica', address: 'Rua antiga', status: 'inactive' }]
    const quote: OperationQuote = { id: 'q', insurerId: 'i', specialtyId: 's', baseId: 'b', origin: 'A', destination: 'B', stops: [], route: { origin: 'A', destination: 'B', stops: [], totalKm: 10, provider: 'manual', source: 'manual', calculatedAt: '' }, calculation: { kmTotal: 10, franchise: 0, kmCharged: 10, exitValue: 50, kmValue: 2, workHours: 0, workHourValue: 0, workHoursTotal: 0, extras: 0, discount: 0, total: 70 }, message: 'Mensagem preservada', status: 'saved', createdAt: '', updatedAt: '' }
    data.quotes = [quote]
    const service = await createService(data)
    expect(service.snapshot()).toMatchObject({ insurers: [{ name: 'Seguradora histórica', status: 'inactive' }], specialties: [{ name: 'Especialidade histórica', status: 'inactive' }], bases: [{ name: 'Base histórica', status: 'inactive' }], quotes: [{ message: 'Mensagem preservada', calculation: { total: 70 } }] })
  })

  it('cria Seguradora normalizada, ativa, persistida e impede duplicidades', async () => {
    const service = await createService()
    const created = await service.saveInsurer({ name: '  Seguradora Teste  ', code: ' seg_teste ', notes: '  operação local  ' })
    expect(created).toMatchObject({ name: 'Seguradora Teste', code: 'SEG_TESTE', notes: 'operação local', status: 'active' })
    expect(created.id).toMatch(/^[0-9a-f-]{36}$/i)
    expect(service.snapshot().insurers).toContainEqual(created)
    const persisted = (JSON.parse(await readFile(path.join(directories.at(-1)!, 'operations', 'operations.json'), 'utf8')) as { data: OperationsData }).data
    expect(persisted.insurers).toContainEqual(created)
    await expect(service.saveInsurer({ name: 'Seguradora Teste' })).rejects.toThrow('DUPLICATE_RECORD')
    await expect(service.saveInsurer({ name: 'Outro nome', code: 'SEG_TESTE' })).rejects.toThrow('DUPLICATE_CODE')
    await expect(service.saveInsurer({ name: '   ' })).rejects.toThrow('VALIDATION_ERROR')
  })

  it('protege criação concorrente contra duplicidade e preserva o orçamento em andamento', async () => {
    const service = await createService()
    useBudgetWorkspaceStore.getState().setForm((form) => ({ ...form, companyId: 'empresa-atual', insurerId: 'seguradora-atual', km: '75' }))
    const formBefore = structuredClone(useBudgetWorkspaceStore.getState().form)
    const attempts = await Promise.allSettled([service.saveInsurer({ name: 'Seguradora Única', code: 'UNICA' }), service.saveInsurer({ name: 'Seguradora Duplicada', code: 'UNICA' })])
    expect(attempts.filter((item) => item.status === 'fulfilled')).toHaveLength(1)
    expect(service.snapshot().insurers.filter((item) => item.code === 'UNICA')).toHaveLength(1)
    expect(useBudgetWorkspaceStore.getState().form).toEqual(formBefore)
    useBudgetWorkspaceStore.getState().resetBudget()
  })

  it('cria Tabela válida, persiste relações e a disponibiliza para novo cálculo', async () => {
    const service = await createService()
    const company = await service.saveOperationalCompany({ name: 'Empresa Teste', code: 'EMP_TESTE' })
    const insurer = await service.saveInsurer({ name: 'Seguradora Teste' })
    const specialty = await service.saveSpecialty({ name: 'Especialidade Teste' })
    const table = await service.savePricingTable({ companyId: company.id, insurerId: insurer.id, specialtyId: specialty.id, exitValue: 80, kmFranchise: 20, kmValue: 3.25, workHourValue: 15 })
    expect(table).toMatchObject({ companyId: company.id, insurerId: insurer.id, specialtyId: specialty.id, status: 'active' })
    expect(service.snapshot().pricingTables).toContainEqual(table)
    const persisted = (JSON.parse(await readFile(path.join(directories.at(-1)!, 'operations', 'operations.json'), 'utf8')) as { data: OperationsData }).data
    expect(persisted.pricingTables).toContainEqual(table)
    const resolved = findApplicablePriceTable({ companyId: company.id, insurerId: insurer.id, specialtyId: specialty.id, priceTables: service.snapshot().pricingTables, specialties: service.snapshot().specialties })
    expect(resolved.status).toBe('found')
    if (resolved.status === 'found') expect(calculateQuoteTotal({ kmTotal: 30, table: resolved.priceTable }).total).toBe(112.5)
    const inactive = await service.savePricingTable({ ...table, status: 'inactive' })
    expect(findApplicablePriceTable({ companyId: company.id, insurerId: insurer.id, specialtyId: specialty.id, priceTables: [inactive], specialties: service.snapshot().specialties }).status).toBe('not-found')
  })

  it('rejeita referências ausentes ou inativas e dados inválidos na criação da Tabela', async () => {
    const service = await createService()
    const company = await service.saveOperationalCompany({ name: 'Empresa Válida', code: 'EMP_VALID' })
    const insurer = await service.saveInsurer({ name: 'Seguradora Válida' })
    const specialty = await service.saveSpecialty({ name: 'Especialidade Válida' })
    await expect(service.savePricingTable({ companyId: 'inexistente', insurerId: insurer.id, specialtyId: specialty.id, exitValue: 1, kmFranchise: 0, kmValue: 1 })).rejects.toThrow('RELATED_RECORD_NOT_FOUND')
    await expect(service.savePricingTable({ companyId: company.id, insurerId: insurer.id, specialtyId: specialty.id, exitValue: -1, kmFranchise: 0, kmValue: 1 })).rejects.toThrow('VALIDATION_ERROR')
    await expect(service.savePricingTable({ companyId: company.id, insurerId: insurer.id, specialtyId: specialty.id, exitValue: 1, kmFranchise: 0, kmValue: 1, validFrom: '2026-12-31', validUntil: '2026-01-01' })).rejects.toThrow('VALIDATION_ERROR')
    const inactiveInsurer = await service.saveInsurer({ ...insurer, status: 'inactive' })
    await expect(service.savePricingTable({ companyId: company.id, insurerId: inactiveInsurer.id, specialtyId: specialty.id, exitValue: 1, kmFranchise: 0, kmValue: 1 })).rejects.toThrow('INACTIVE_REFERENCE')
  })
})
