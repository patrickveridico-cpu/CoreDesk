import { describe, expect, it } from 'vitest'
import { calculateQuoteTotal, findPricingTables, selectPricingTable } from '../shared/operations/calculations'
import { EventBus } from '../electron/core/events/EventBus'
import { LoggerService } from '../electron/core/logging/LoggerService'
import { StorageService } from '../electron/core/storage/StorageService'
import { OperationsService } from '../electron/modules/operations/services/OperationsService'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

describe('TechRoute-compatible operations', () => {
  it('preserves franchise and excess formula', () => { const table = { exitValue: 100, kmFranchise: 40, kmValue: 2, workHourValue: 50 }; expect(calculateQuoteTotal({ kmTotal: 30, table }).total).toBe(100); expect(calculateQuoteTotal({ kmTotal: 60, table }).total).toBe(140) })
  it('selects only active and currently valid tables', () => { const table = { id: 't', insurerId: 'i', specialtyId: 's', exitValue: 0, kmFranchise: 40, kmValue: 1, status: 'active' as const, validFrom: '2020-01-01' }; expect(selectPricingTable([table], 'i', 's', new Date('2024-01-01'))).toBe(table); expect(selectPricingTable([{ ...table, status: 'inactive' as const }], 'i', 's')).toBeUndefined() })
  it('reports multiple applicable tables instead of silently selecting one', () => { const tables = [{ id: 'a', insurerId: 'i', specialtyId: 's', exitValue: 1, kmFranchise: 1, kmValue: 1, status: 'active' as const }, { id: 'b', insurerId: 'i', specialtyId: 's', exitValue: 2, kmFranchise: 1, kmValue: 1, status: 'active' as const }]; expect(findPricingTables(tables, 'i', 's')).toHaveLength(2) })
  it('creates quote and emits route/quote events', async () => { const dir = await mkdtemp(path.join(os.tmpdir(), 'coredesk-ops-')); const events = new EventBus(); const seen: string[] = []; events.on('operations:quote-calculated', () => seen.push('quote')); const service = new OperationsService(dir, new StorageService(), events, new LoggerService(dir, 'test', false)); await service.initialize(); const company = await service.saveOperationalCompany({ name: 'Empresa', code: 'EMP' }); const base = await service.saveBase({ name: 'Base', address: 'Rua A' }); const insurer = await service.saveInsurer({ name: 'Seguradora' }); const specialty = await service.saveSpecialty({ name: 'Reboque Leve' }); await service.savePricingTable({ companyId: company.id, insurerId: insurer.id, specialtyId: specialty.id, exitValue: 100, kmFranchise: 40, kmValue: 2 }); const route = service.calculateRoute({ origin: 'A', destination: 'B', totalKm: 60 }); const result = await service.calculateQuote({ insurerId: insurer.id, specialtyId: specialty.id, baseId: base.id, origin: 'A', destination: 'B', route }); expect(result.calculation.total).toBe(140); expect(seen).toEqual(['quote']); await rm(dir, { recursive: true, force: true }) })
})
