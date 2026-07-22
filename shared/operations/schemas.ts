import type { OperationsData } from './models'
export const emptyOperationsData = (): OperationsData => ({ schemaVersion: 3, operationalCompanies: [], bases: [], insurers: [], specialties: [], pricingTables: [], quotes: [], legacyHistory: [], audit: [], idMap: {} })
export function validateOperationsData(value: unknown): OperationsData {
  const source = value && typeof value === 'object' ? value as Partial<OperationsData> : {}
  return { ...emptyOperationsData(), ...source, schemaVersion: 3, operationalCompanies: Array.isArray(source.operationalCompanies) ? source.operationalCompanies : [], bases: Array.isArray(source.bases) ? source.bases : [], insurers: Array.isArray(source.insurers) ? source.insurers : [], specialties: Array.isArray(source.specialties) ? source.specialties : [], pricingTables: Array.isArray(source.pricingTables) ? source.pricingTables : [], quotes: Array.isArray(source.quotes) ? source.quotes : [], legacyHistory: Array.isArray(source.legacyHistory) ? source.legacyHistory : [], audit: Array.isArray(source.audit) ? source.audit : [], idMap: source.idMap && typeof source.idMap === 'object' ? source.idMap : {} }
}
