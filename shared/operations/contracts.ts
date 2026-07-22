import type { AuditEntry, OperationalCompany, OperationBase, OperationInsurer, OperationQuote, OperationSpecialty, OperationsData, PricingTable, QuoteCalculation, RouteCalculation } from './models'
import type { PriceTableConflictGroup } from './migration'
export type OperationsSnapshot = OperationsData
export interface OperationsDiagnostics { filePath: string; found: boolean; valid: boolean; fileSize: number; modifiedAt?: string; companies: number; insurers: number; specialties: number; bases: number; tables: number; withCompanyId: number; withoutCompanyId: number; conflicts: number; conflictingRecords: number }
export interface OperationsPreview { sourcePath: string; counts: Record<string, number>; duplicates: string[]; warnings: string[]; data: OperationsData }
export interface OperationsApi {
  getDiagnostics: () => Promise<OperationsDiagnostics>
  listPriceTableConflicts: () => Promise<PriceTableConflictGroup[]>
  resolvePriceTableConflict: (conflictId: string, keepId: string) => Promise<PriceTableConflictGroup>
  previewLegacyPriceTableCompanyMigration: () => Promise<import('./migration').LegacyCompanyMigrationReport>
  applyLegacyPriceTableCompanyMigration: () => Promise<import('./migration').LegacyCompanyMigrationReport>
  getSnapshot: () => Promise<OperationsSnapshot>
  listOperationalCompanies: (status?: OperationalCompany['status']) => Promise<OperationalCompany[]>
  getOperationalCompany: (id: string) => Promise<OperationalCompany | undefined>
  saveOperationalCompany: (input: Partial<OperationalCompany> & Pick<OperationalCompany, 'name' | 'code'>) => Promise<OperationalCompany>
  archiveOperationalCompany: (id: string) => Promise<OperationalCompany>
  restoreOperationalCompany: (id: string) => Promise<OperationalCompany>
  saveBase: (base: Partial<OperationBase> & Pick<OperationBase, 'name' | 'address'>) => Promise<OperationBase>
  saveInsurer: (insurer: Partial<OperationInsurer> & Pick<OperationInsurer, 'name'>) => Promise<OperationInsurer>
  saveSpecialty: (specialty: Partial<OperationSpecialty> & Pick<OperationSpecialty, 'name'>) => Promise<OperationSpecialty>
  savePricingTable: (table: Omit<PricingTable, 'id' | 'status'> & { id?: string }) => Promise<PricingTable>
  calculateRoute: (input: { origin: string; destination: string; stops?: string[]; totalKm: number; source?: 'manual' | 'automatic' | 'imported' }) => Promise<RouteCalculation>
  calculateQuote: (input: { insurerId: string; specialtyId: string; baseId: string; origin: string; destination: string; stops?: string[]; route: RouteCalculation; workHours?: number; extras?: number; discount?: number; observations?: string }) => Promise<{ quote: OperationQuote; calculation: QuoteCalculation }>
  saveQuote: (quote: OperationQuote) => Promise<OperationQuote>
  deleteQuote: (id: string) => Promise<void>
  previewImport: (sourcePath?: string) => Promise<OperationsPreview>
  confirmImport: (sourcePath?: string) => Promise<OperationsPreview>
  listAudit: () => Promise<AuditEntry[]>
  listBackups: () => Promise<string[]>
  createBackup: () => Promise<{ name: string; file: string; createdAt: string }>
  restoreBackup: (name: string) => Promise<OperationsSnapshot>
}
