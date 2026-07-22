import type { QuoteCalculation, PricingTable } from './models'

export function roundMoney(value: number) { return Math.round((value + Number.EPSILON) * 100) / 100 }
export function calculateQuoteTotal(input: { kmTotal: number; table: Pick<PricingTable, 'exitValue' | 'kmFranchise' | 'kmValue' | 'workHourValue'>; workHours?: number; extras?: number; discount?: number }): QuoteCalculation {
  const kmTotal = Math.max(0, input.kmTotal); const franchise = Math.max(0, input.table.kmFranchise); const kmCharged = Math.max(0, kmTotal - franchise)
  const workHours = Math.max(0, input.workHours ?? 0); const workHourValue = Math.max(0, input.table.workHourValue ?? 0)
  const workHoursTotal = roundMoney(workHours * workHourValue); const extras = roundMoney(Math.max(0, input.extras ?? 0)); const discount = roundMoney(Math.max(0, input.discount ?? 0))
  const total = roundMoney(Math.max(0, input.table.exitValue + kmCharged * input.table.kmValue + workHoursTotal + extras - discount))
  return { kmTotal, franchise, kmCharged, exitValue: roundMoney(input.table.exitValue), kmValue: roundMoney(input.table.kmValue), workHours, workHourValue: roundMoney(workHourValue), workHoursTotal, extras, discount, total }
}

export function selectPricingTable(tables: PricingTable[], insurerId: string, specialtyId: string, at = new Date()) {
  return tables.find((table) => table.status === 'active' && table.insurerId === insurerId && table.specialtyId === specialtyId && (!table.validFrom || at >= new Date(table.validFrom)) && (!table.validUntil || at <= new Date(table.validUntil)))
}
export function findPricingTables(tables: PricingTable[], insurerId: string, specialtyId: string, at = new Date()) {
  return tables.filter((table) => table.status === 'active' && table.insurerId === insurerId && table.specialtyId === specialtyId && (!table.validFrom || at >= new Date(table.validFrom)) && (!table.validUntil || at <= new Date(table.validUntil)))
}
