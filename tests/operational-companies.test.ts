import { describe, expect, it } from 'vitest'
import { DEFAULT_OPERATIONAL_COMPANIES, normalizeOperationalCompanyCode, normalizeOperationalCompanyName } from '../shared/operations/companies'
import { findApplicablePriceTable } from '../shared/operations/pricing'

describe('operational companies', () => {
  it('defines the three idempotent defaults', () => {
    expect(DEFAULT_OPERATIONAL_COMPANIES).toEqual([['Resgate 116', 'RESGATE_116'], ['Auto Elite', 'AUTO_ELITE'], ['Help Go', 'HELP_GO']])
  })
  it('normalizes names and codes for duplicate detection', () => {
    expect(normalizeOperationalCompanyName('  Áuto   Elite ')).toBe('auto elite')
    expect(normalizeOperationalCompanyCode(' auto elite ')).toBe('AUTO_ELITE')
  })
  it('requires the triple company, insurer and specialty and detects conflicts', () => {
    const base = { id: 't1', companyId: 'c1', insurerId: 'i1', specialtyId: 's1', exitValue: 180, kmFranchise: 40, kmValue: 2.8, status: 'active' as const }
    const specialties = [{ id: 's1', name: 'Utilitário', status: 'active' as const }]
    expect(findApplicablePriceTable({ companyId: 'c1', insurerId: 'i1', specialtyId: 's1', priceTables: [base], specialties }).status).toBe('found')
    expect(findApplicablePriceTable({ companyId: 'c2', insurerId: 'i1', specialtyId: 's1', priceTables: [base], specialties }).status).toBe('not-found')
    expect(findApplicablePriceTable({ companyId: 'c1', insurerId: 'i1', specialtyId: 's1', priceTables: [base, { ...base, id: 't2' }], specialties }).status).toBe('ambiguous')
  })
})
