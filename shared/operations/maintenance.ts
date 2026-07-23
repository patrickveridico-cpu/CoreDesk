import type { MaintenanceErrorCode, MaintenanceResult } from './contracts'
import type { EntityStatus, OperationsData, PricingTable } from './models'

export type MaintenanceEntityKind = 'base' | 'insurer' | 'specialty' | 'pricing-table'
export type StatusFilter = 'active' | 'inactive' | 'all'

export interface MaintenanceReferences {
  tables: number
  quotes: number
  currentBudget: number
}

export interface DeletionDecision {
  action: 'delete' | 'inactivate' | 'blocked'
  message: string
  references: MaintenanceReferences
}

export const effectiveStatus = (status?: EntityStatus): EntityStatus => status ?? 'active'
export const matchesStatusFilter = (status: EntityStatus | undefined, filter: StatusFilter) => filter === 'all' || (filter === 'active' ? effectiveStatus(status) === 'active' : effectiveStatus(status) !== 'active')

export function getMaintenanceReferences(data: OperationsData, kind: MaintenanceEntityKind, id: string, currentIds: Partial<Record<MaintenanceEntityKind, string>> = {}): MaintenanceReferences {
  const tables = kind === 'base'
    ? data.pricingTables.filter((table) => (table as PricingTable & { baseId?: string }).baseId === id).length
    : kind === 'insurer'
      ? data.pricingTables.filter((table) => table.insurerId === id).length
      : kind === 'specialty'
        ? data.pricingTables.filter((table) => table.specialtyId === id).length
        : 0
  const quotes = kind === 'base'
    ? data.quotes.filter((quote) => quote.baseId === id).length
    : kind === 'insurer'
      ? data.quotes.filter((quote) => quote.insurerId === id).length
      : kind === 'specialty'
        ? data.quotes.filter((quote) => quote.specialtyId === id).length
        : data.quotes.filter((quote) => quote.financialSnapshot?.tableId === id || matchesHistoricalTable(quote, data.pricingTables.find((table) => table.id === id))).length
  return { tables, quotes, currentBudget: currentIds[kind] === id ? 1 : 0 }
}

function matchesHistoricalTable(quote: OperationsData['quotes'][number], table?: PricingTable) {
  if (!table || quote.insurerId !== table.insurerId || quote.specialtyId !== table.specialtyId) return false
  return quote.calculation.exitValue === table.exitValue && quote.calculation.kmValue === table.kmValue && quote.calculation.franchise === table.kmFranchise
}

export function decideDeletion(kind: MaintenanceEntityKind, name: string, references: MaintenanceReferences): DeletionDecision {
  if (references.currentBudget > 0) return { action: 'blocked', message: `${name} está sendo utilizado no orçamento em andamento. Inicie um novo orçamento antes da exclusão definitiva.`, references }
  if (kind !== 'pricing-table' && references.tables > 0) return { action: 'blocked', message: `Não é possível excluir ${name} porque o registro está vinculado a ${references.tables} ${references.tables === 1 ? 'tabela' : 'tabelas'}.`, references }
  if (references.quotes > 0) return { action: 'inactivate', message: `${name} já foi utilizado em ${references.quotes} ${references.quotes === 1 ? 'orçamento' : 'orçamentos'}. O registro será inativado para preservar o histórico.`, references }
  return { action: 'delete', message: `Excluir ${name}? Esta ação não poderá ser desfeita.`, references }
}

export function maintenanceSuccess<T>(data: T): MaintenanceResult<T> { return { success: true, data } }
export function maintenanceFailure<T>(code: MaintenanceErrorCode, message: string): MaintenanceResult<T> { return { success: false, error: { code, message } } }

export function parseMaintenanceError(error: unknown): MaintenanceResult<never> {
  const message = error instanceof Error ? error.message : String(error)
  const match = message.match(/^([A-Z_]+):\s*(.+)$/s)
  const known: MaintenanceErrorCode[] = ['VALIDATION_ERROR', 'DUPLICATE_CODE', 'DUPLICATE_RECORD', 'DUPLICATE_COMBINATION', 'RECORD_IN_USE', 'RECORD_NOT_FOUND', 'RELATED_RECORD_NOT_FOUND', 'INACTIVE_REFERENCE', 'PERSISTENCE_ERROR']
  const code = match && known.includes(match[1] as MaintenanceErrorCode) ? match[1] as MaintenanceErrorCode : 'PERSISTENCE_ERROR'
  return maintenanceFailure(code, match?.[2] ?? message)
}

export function validateNonNegativeValues(values: Record<string, number>): MaintenanceResult<true> {
  const invalid = Object.entries(values).find(([, value]) => !Number.isFinite(value) || value < 0)
  return invalid ? maintenanceFailure('VALIDATION_ERROR', `${invalid[0]} deve ser um número finito e não negativo.`) : maintenanceSuccess(true)
}
