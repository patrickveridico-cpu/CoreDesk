export type EntityStatus = 'active' | 'inactive' | 'archived'
export type OperationalCompanyStatus = 'active' | 'archived'
export interface OperationalCompany { id: string; name: string; normalizedName: string; code: string; status: OperationalCompanyStatus; notes?: string; createdAt: string; updatedAt: string; archivedAt?: string }
export type DistanceSource = 'automatic' | 'manual' | 'imported'

export interface OperationBase { id: string; name: string; address: string; city?: string; state?: string; latitude?: number; longitude?: number; specialties?: string[]; status: EntityStatus; notes?: string; legacyId?: string }
export interface OperationInsurer { id: string; name: string; company?: string; code?: string; status: EntityStatus; notes?: string; legacyId?: string }
export interface OperationSpecialty { id: string; name: string; category?: string; status: EntityStatus; legacyId?: string }
export interface PricingTable { id: string; company?: string; insurerId: string; specialtyId: string; exitValue: number; kmFranchise: number; kmValue: number; workHourValue?: number; validFrom?: string; validUntil?: string; status: EntityStatus; legacyId?: string; version?: number; versionOf?: string; changeReason?: string; createdAt?: string; updatedAt?: string }
export interface RouteCalculation { origin: string; destination: string; stops: string[]; totalKm: number; durationMinutes?: number; provider: string; source: DistanceSource; calculatedAt: string }
export interface QuoteCalculation { kmTotal: number; franchise: number; kmCharged: number; exitValue: number; kmValue: number; workHours: number; workHourValue: number; workHoursTotal: number; extras: number; discount: number; total: number }
export interface FinancialSnapshot { tableId: string; tableVersion?: number; exitValue: number; kmFranchise: number; kmValue: number; workHourValue: number; extras: number; discount: number; formula: string }
export interface OperationQuote { id: string; code?: string; insurerId: string; specialtyId: string; baseId: string; origin: string; destination: string; stops: string[]; route: RouteCalculation; calculation: QuoteCalculation; financialSnapshot?: FinancialSnapshot; message: string; originalMessage?: string; editedMessage?: string; status: 'draft' | 'saved' | 'cancelled' | 'archived'; revision?: number; revisionOf?: string; revisionReason?: string; legacyId?: string; observations?: string; createdAt: string; updatedAt: string }
export interface LegacyHistoryRecord { id: string; legacyId: string; raw: Record<string, unknown>; convertedQuoteId?: string; conversionStatus: 'converted' | 'partial' | 'pending'; warnings: string[] }
export interface AuditEntry { id: string; timestamp: string; action: string; entity: string; entityId?: string; summary: string; changedFields?: string[]; origin: string; correlationId: string }
export interface OperationsData { schemaVersion: 3; operationalCompanies: OperationalCompany[]; bases: OperationBase[]; insurers: OperationInsurer[]; specialties: OperationSpecialty[]; pricingTables: PricingTable[]; quotes: OperationQuote[]; legacyHistory: LegacyHistoryRecord[]; audit: AuditEntry[]; idMap: Record<string, string> }
