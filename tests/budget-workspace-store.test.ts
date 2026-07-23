import { beforeEach, describe, expect, it } from 'vitest'
import type { OperationQuote, OperationsData } from '../shared/operations/models'
import { createQuoteWorkspaceSnapshot, restoreBudgetFromHistory, useBudgetWorkspaceStore } from '../src/modules/operations/store/useBudgetWorkspaceStore'

const quote: OperationQuote = {
  id: 'quote-1',
  insurerId: 'insurer-1',
  specialtyId: 'specialty-1',
  baseId: 'base-1',
  origin: 'Origem antiga',
  destination: 'Destino antigo',
  stops: [],
  route: { origin: 'Origem antiga', destination: 'Destino antigo', stops: [], totalKm: 291, provider: 'Google Maps', source: 'imported', calculatedAt: '2026-07-22T10:00:00.000Z' },
  calculation: { kmTotal: 291, franchise: 40, kmCharged: 251, exitValue: 100, kmValue: 2.5, workHours: 0, workHourValue: 0, workHoursTotal: 0, extras: 15, discount: 0, total: 742.5 },
  message: 'ORÇAMENTO DE SERVIÇO',
  status: 'saved',
  observations: 'Observação preservada',
  createdAt: '2026-07-22T10:00:00.000Z',
  updatedAt: '2026-07-22T10:00:00.000Z',
}

const snapshot: OperationsData = {
  schemaVersion: 3,
  operationalCompanies: [{ id: 'company-1', name: 'Resgate 116', normalizedName: 'resgate 116', code: 'RESGATE_116', status: 'active', createdAt: '', updatedAt: '' }],
  insurers: [{ id: 'insurer-1', name: 'Seguradora', status: 'active' }],
  specialties: [{ id: 'specialty-1', name: 'Guincho', status: 'active' }],
  bases: [{ id: 'base-1', name: 'Mafra R', address: 'Rua da Base, 10', city: 'Mafra', state: 'SC', status: 'active' }],
  pricingTables: [{ id: 'table-1', insurerId: 'insurer-1', specialtyId: 'specialty-1', exitValue: 100, kmFranchise: 40, kmValue: 2.5, status: 'active', companyId: 'company-1' } as OperationsData['pricingTables'][number] & { companyId: string }],
  quotes: [quote],
  legacyHistory: [],
  audit: [],
  idMap: {},
}

describe('workspace do orçamento', () => {
  beforeEach(() => useBudgetWorkspaceStore.getState().resetBudget())

  it('preserva o estado enquanto páginas React são desmontadas e remontadas', () => {
    const state = useBudgetWorkspaceStore.getState()
    state.updateForm('companyId', 'company-1')
    state.updateForm('km', '291')
    state.setQuote(quote)
    expect(useBudgetWorkspaceStore.getState().form).toMatchObject({ companyId: 'company-1', km: '291' })
    expect(useBudgetWorkspaceStore.getState().quote?.id).toBe('quote-1')
  })

  it('restaura campos financeiros e operacionais de um registro com metadados', () => {
    const restored = restoreBudgetFromHistory({ ...quote, workspaceSnapshot: { companyId: 'company-1', baseAddress: 'Endereço salvo', originText: 'Origem salva', destinationTexts: ['Destino salvo'], distanceKm: 332, additionalAmount: 15, source: 'google-maps' } }, snapshot)
    expect(restored.form).toMatchObject({ companyId: 'company-1', insurerId: 'insurer-1', specialtyId: 'specialty-1', baseId: 'base-1', origin: 'Origem salva', destination: 'Destino salvo', km: '332', extras: '15' })
    expect(restored.baseAddress).toBe('Endereço salvo')
    expect(restored.distanceSource).toBe('history')
    expect(restored.quote.calculation.total).toBe(742.5)
  })

  it('normaliza registro antigo sem apagar dados e infere empresa quando não há ambiguidade', () => {
    const restored = restoreBudgetFromHistory(quote, snapshot)
    expect(restored.form.companyId).toBe('company-1')
    expect(restored.form.km).toBe('291')
    expect(restored.baseAddress).toBe('Rua da Base, 10, Mafra, SC')
    expect(restored.quote.message).toBe(quote.message)
  })

  it('gera metadados opcionais para novos registros e permite reset explícito', () => {
    const workspaceSnapshot = createQuoteWorkspaceSnapshot({ quote, snapshot, form: { companyId: 'company-1', insurerId: 'insurer-1', specialtyId: 'specialty-1', baseId: 'base-1', origin: quote.origin, destination: quote.destination, km: '291', extras: '15', observations: quote.observations ?? '' }, baseAddress: 'Rua da Base, 10, Mafra, SC', distanceSource: 'google-maps' })
    expect(workspaceSnapshot).toMatchObject({ companyId: 'company-1', companyName: 'Resgate 116', distanceKm: 291, pricePerKm: 2.5, displacementFee: 100, totalAmount: 742.5 })
    useBudgetWorkspaceStore.setState({ quote, distanceSource: 'history' })
    useBudgetWorkspaceStore.getState().resetBudget()
    expect(useBudgetWorkspaceStore.getState()).toMatchObject({ quote: undefined, distanceSource: null, baseAddress: '', restoredFromHistoryId: undefined })
  })
})
