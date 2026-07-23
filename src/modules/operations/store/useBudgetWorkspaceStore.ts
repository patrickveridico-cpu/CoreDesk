import { create } from 'zustand'
import type { SetStateAction } from 'react'
import type { BudgetMapsRoutePayload } from '../../../../shared/contracts'
import type { OperationQuote, OperationsData, QuoteWorkspaceSnapshot } from '../../../../shared/operations/models'

export interface BudgetFormState {
  companyId: string
  insurerId: string
  specialtyId: string
  baseId: string
  origin: string
  destination: string
  km: string
  extras: string
  observations: string
}

export type BudgetDistanceSource = 'google-maps' | 'history' | null

const emptyForm = (): BudgetFormState => ({
  companyId: '',
  insurerId: '',
  specialtyId: '',
  baseId: '',
  origin: '',
  destination: '',
  km: '',
  extras: '',
  observations: '',
})

export interface RestoredBudgetState {
  form: BudgetFormState
  quote: OperationQuote
  mapsRoute?: BudgetMapsRoutePayload
  routeSource: 'manual' | 'imported'
  distanceSource: BudgetDistanceSource
  baseAddress: string
  feedback: string
  restoredFromHistoryId: string
  calculationKey?: string
}

function resolveCompanyId(quote: OperationQuote, snapshot: OperationsData): string {
  if (quote.workspaceSnapshot?.companyId) return quote.workspaceSnapshot.companyId
  const table = quote.financialSnapshot?.tableId
    ? snapshot.pricingTables.find((item) => item.id === quote.financialSnapshot?.tableId)
    : undefined
  const tableCompanyId = (table as typeof table & { companyId?: string } | undefined)?.companyId
  if (tableCompanyId) return tableCompanyId
  const candidates = snapshot.pricingTables
    .filter((item) => item.insurerId === quote.insurerId && item.specialtyId === quote.specialtyId)
    .map((item) => (item as typeof item & { companyId?: string }).companyId)
    .filter((id): id is string => Boolean(id))
  const unique = [...new Set(candidates)]
  return unique.length === 1 ? unique[0] : ''
}

export function restoreBudgetFromHistory(quote: OperationQuote, snapshot: OperationsData): RestoredBudgetState {
  const base = snapshot.bases.find((item) => item.id === quote.baseId)
  const distanceKm = quote.workspaceSnapshot?.distanceKm ?? quote.route?.totalKm ?? quote.calculation.kmTotal
  return {
    form: {
      companyId: resolveCompanyId(quote, snapshot),
      insurerId: quote.insurerId,
      specialtyId: quote.specialtyId,
      baseId: quote.baseId,
      origin: quote.workspaceSnapshot?.originText ?? quote.origin ?? quote.route.origin,
      destination: quote.workspaceSnapshot?.destinationTexts?.[0] ?? quote.destination ?? quote.route.destination,
      km: Number.isFinite(distanceKm) ? String(distanceKm) : '',
      extras: String(quote.workspaceSnapshot?.additionalAmount ?? quote.calculation.extras ?? 0),
      observations: quote.observations ?? '',
    },
    quote: structuredClone(quote),
    mapsRoute: undefined,
    routeSource: 'imported',
    distanceSource: 'history',
    baseAddress: quote.workspaceSnapshot?.baseAddress ?? (base ? [base.address, base.city, base.state].filter(Boolean).join(', ') : ''),
    feedback: 'Orçamento restaurado do histórico.',
    restoredFromHistoryId: quote.id,
    calculationKey: undefined,
  }
}

export function createQuoteWorkspaceSnapshot(input: {
  quote: OperationQuote
  snapshot?: OperationsData
  form: BudgetFormState
  baseAddress: string
  distanceSource: BudgetDistanceSource
  mapsRoute?: BudgetMapsRoutePayload
}): QuoteWorkspaceSnapshot {
  const { quote, snapshot, form, baseAddress, distanceSource, mapsRoute } = input
  return {
    companyId: form.companyId || undefined,
    companyName: snapshot?.operationalCompanies.find((item) => item.id === form.companyId)?.name,
    insurerName: snapshot?.insurers.find((item) => item.id === form.insurerId)?.name,
    specialtyName: snapshot?.specialties.find((item) => item.id === form.specialtyId)?.name,
    baseName: snapshot?.bases.find((item) => item.id === form.baseId)?.name,
    baseAddress: baseAddress || undefined,
    originText: form.origin || quote.origin,
    destinationTexts: [form.destination || quote.destination, ...quote.stops].filter(Boolean),
    distanceKm: Number(form.km) || quote.route.totalKm,
    distanceText: mapsRoute?.distanceText ?? `${quote.route.totalKm} km`,
    pricePerKm: quote.calculation.kmValue,
    displacementFee: quote.calculation.exitValue,
    additionalAmount: quote.calculation.extras,
    totalAmount: quote.calculation.total,
    copiedMessage: quote.message,
    routeText: mapsRoute?.routeText ?? undefined,
    source: distanceSource ?? undefined,
  }
}

interface BudgetWorkspaceState {
  form: BudgetFormState
  quote?: OperationQuote
  mapsRoute?: BudgetMapsRoutePayload
  routeSource: 'manual' | 'imported'
  distanceSource: BudgetDistanceSource
  baseAddress: string
  feedback: string
  restoredFromHistoryId?: string
  calculationKey?: string
  setForm: (value: SetStateAction<BudgetFormState>) => void
  updateForm: (key: keyof BudgetFormState, value: string) => void
  setQuote: (value: SetStateAction<OperationQuote | undefined>) => void
  setMapsRoute: (value: BudgetMapsRoutePayload | undefined) => void
  setRouteSource: (value: 'manual' | 'imported') => void
  setDistanceSource: (value: BudgetDistanceSource) => void
  setBaseAddress: (value: string) => void
  setFeedback: (value: string) => void
  setCalculationKey: (value: string | undefined) => void
  restoreFromHistory: (quote: OperationQuote, snapshot: OperationsData) => void
  resetBudget: () => void
}

export const useBudgetWorkspaceStore = create<BudgetWorkspaceState>((set) => ({
  form: emptyForm(),
  routeSource: 'manual',
  distanceSource: null,
  baseAddress: '',
  feedback: '',
  setForm: (value) => set((state) => ({ form: typeof value === 'function' ? value(state.form) : value })),
  updateForm: (key, value) => set((state) => ({ form: { ...state.form, [key]: value } })),
  setQuote: (value) => set((state) => ({ quote: typeof value === 'function' ? value(state.quote) : value })),
  setMapsRoute: (mapsRoute) => set({ mapsRoute }),
  setRouteSource: (routeSource) => set({ routeSource }),
  setDistanceSource: (distanceSource) => set({ distanceSource }),
  setBaseAddress: (baseAddress) => set({ baseAddress }),
  setFeedback: (feedback) => set({ feedback }),
  setCalculationKey: (calculationKey) => set({ calculationKey }),
  restoreFromHistory: (quote, snapshot) => set(restoreBudgetFromHistory(quote, snapshot)),
  resetBudget: () => set({ form: emptyForm(), quote: undefined, mapsRoute: undefined, routeSource: 'manual', distanceSource: null, baseAddress: '', feedback: '', restoredFromHistoryId: undefined, calculationKey: undefined }),
}))
