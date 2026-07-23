import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Copy, MapPinned, Wallet } from 'lucide-react'
import type { OperationsSnapshot } from '../../../../shared/operations/contracts'
import { findApplicablePriceTable } from '../../../../shared/operations/pricing'
import { SAFE_DISTANCE_SCORE } from '../../../../shared/maps/distanceExtraction'
import { useTabsStore } from '../../../store/useTabsStore'
import { createQuoteWorkspaceSnapshot, useBudgetWorkspaceStore } from '../store/useBudgetWorkspaceStore'

function Choice({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: readonly (readonly [string, string])[] }) {
  return <label className="grid gap-1.5 text-xs text-slate-400"><span>{label}</span><select value={value} onChange={(event) => onChange(event.target.value)} className="h-9 rounded-lg border border-core-line bg-core-canvas px-3 text-sm text-white outline-none"><option value="">Selecione</option>{options.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>
}

export function BudgetPage({ snapshot, onSaved, onNotice }: { snapshot?: OperationsSnapshot; onSaved: () => void; onNotice: (message: string) => void }) {
  const form = useBudgetWorkspaceStore((state) => state.form)
  const quote = useBudgetWorkspaceStore((state) => state.quote)
  const mapsRoute = useBudgetWorkspaceStore((state) => state.mapsRoute)
  const routeSource = useBudgetWorkspaceStore((state) => state.routeSource)
  const distanceSource = useBudgetWorkspaceStore((state) => state.distanceSource)
  const baseAddress = useBudgetWorkspaceStore((state) => state.baseAddress)
  const feedback = useBudgetWorkspaceStore((state) => state.feedback)
  const calculationKey = useBudgetWorkspaceStore((state) => state.calculationKey)
  const setForm = useBudgetWorkspaceStore((state) => state.setForm)
  const updateForm = useBudgetWorkspaceStore((state) => state.updateForm)
  const setQuote = useBudgetWorkspaceStore((state) => state.setQuote)
  const setMapsRoute = useBudgetWorkspaceStore((state) => state.setMapsRoute)
  const setRouteSource = useBudgetWorkspaceStore((state) => state.setRouteSource)
  const setDistanceSource = useBudgetWorkspaceStore((state) => state.setDistanceSource)
  const setBaseAddress = useBudgetWorkspaceStore((state) => state.setBaseAddress)
  const setFeedback = useBudgetWorkspaceStore((state) => state.setFeedback)
  const setCalculationKey = useBudgetWorkspaceStore((state) => state.setCalculationKey)
  const [busy, setBusy] = useState(false)
  const pageRef = useRef<HTMLDivElement>(null)
  const mapsContainerRef = useRef<HTMLDivElement>(null)
  const lastBoundsRef = useRef<{ x: number; y: number; width: number; height: number } | null>(null)
  const boundsFrameRef = useRef(0)
  const missingRouteTimerRef = useRef<number | undefined>(undefined)
  const [zoomFactor, setZoomFactor] = useState<number | null>(null)
  const activeTabId = useTabsStore((state) => state.activeTabId)
  const update = (key: keyof typeof form, value: string) => updateForm(key, value)
  const active = (item: { status: string }) => item.status === 'active'
  const options = {
    companies: snapshot?.operationalCompanies.filter(active).map((x) => [x.id, x.name] as const) ?? [],
    insurers: snapshot?.insurers.filter(active).map((x) => [x.id, x.name] as const) ?? [],
    specialties: snapshot?.specialties.filter(active).map((x) => [x.id, x.name] as const) ?? [],
    bases: snapshot?.bases.filter(active).map((x) => [x.id, x.name] as const) ?? [],
  }
  const tableResult = useMemo(() => snapshot && form.companyId && form.insurerId && form.specialtyId ? findApplicablePriceTable({ companyId: form.companyId, insurerId: form.insurerId, specialtyId: form.specialtyId, priceTables: snapshot.pricingTables, specialties: snapshot.specialties }) : undefined, [snapshot, form.companyId, form.insurerId, form.specialtyId])
  const table = tableResult?.status === 'found' ? tableResult.priceTable : undefined
  const selectedBase = snapshot?.bases.find((item) => item.id === form.baseId)
  const currentCalculationKey = [form.companyId, form.insurerId, form.specialtyId, form.baseId, form.origin, form.destination, form.km, form.extras, form.observations, routeSource].join('|')

  useEffect(() => {
    if (selectedBase) {
      if (distanceSource === 'history' && baseAddress && selectedBase.id === quote?.baseId) return
      setBaseAddress([selectedBase.address, selectedBase.city, selectedBase.state].filter(Boolean).join(', '))
    }
    else if (!form.baseId) setBaseAddress('')
  }, [baseAddress, distanceSource, form.baseId, quote?.baseId, selectedBase, setBaseAddress])

  useEffect(() => {
    let mounted = true
    void window.coreDesk?.zoom.get().then((factor) => { if (mounted) setZoomFactor(factor) })
    const remove = window.coreDesk?.zoom.onChanged(setZoomFactor)
    return () => { mounted = false; remove?.() }
  }, [])

  useEffect(() => {
    const element = mapsContainerRef.current
    if (!element) return
    if (activeTabId !== 'routes' || zoomFactor === null) {
      lastBoundsRef.current = null
      window.coreDesk?.views.setEmbedded('budget-google-maps', null)
      return
    }
    let active = true
    const measure = async () => {
      if (!active) return
      const currentZoomFactor = await window.coreDesk?.zoom.get()
      if (!active || currentZoomFactor !== zoomFactor) return
      const rect = element.getBoundingClientRect()
      const summaryRect = pageRef.current?.querySelector('.budget-summary')?.getBoundingClientRect()
      const left = Math.max(0, rect.left)
      const top = Math.max(0, rect.top)
      const right = Math.min(rect.right, summaryRect?.left ?? window.innerWidth, window.innerWidth)
      const bottom = Math.min(rect.bottom, window.innerHeight)
      const cssWidth = Math.max(0, right - left)
      const cssHeight = Math.max(0, bottom - top)
      const bounds = {
        x: Math.round(left * zoomFactor),
        y: Math.round(top * zoomFactor),
        width: Math.max(0, Math.floor(cssWidth * zoomFactor)),
        height: Math.max(0, Math.floor(cssHeight * zoomFactor)),
      }
      if (bounds.width <= 0 || bounds.height <= 0) {
        lastBoundsRef.current = null
        window.coreDesk?.views.setEmbedded('budget-google-maps', null)
        return
      }
      const previous = lastBoundsRef.current
      if (previous && previous.x === bounds.x && previous.y === bounds.y && previous.width === bounds.width && previous.height === bounds.height) return
      lastBoundsRef.current = bounds
      window.coreDesk?.views.setEmbedded('budget-google-maps', bounds)
    }
    const scheduleMeasure = () => {
      window.cancelAnimationFrame(boundsFrameRef.current)
      boundsFrameRef.current = window.requestAnimationFrame(() => { void measure() })
    }
    const observer = new ResizeObserver(scheduleMeasure)
    observer.observe(element)
    if (pageRef.current) observer.observe(pageRef.current)
    window.addEventListener('resize', scheduleMeasure)
    scheduleMeasure()
    return () => {
      active = false
      observer.disconnect()
      window.removeEventListener('resize', scheduleMeasure)
      window.cancelAnimationFrame(boundsFrameRef.current)
      lastBoundsRef.current = null
      window.coreDesk?.views.setEmbedded('budget-google-maps', null)
    }
  }, [activeTabId, zoomFactor])

  useEffect(() => {
    const remove = window.coreDesk?.budgetMaps.onRouteUpdated((payload) => {
      const trustedDistance = payload.distanceKm !== null && (payload.confidence === 'high' || payload.score >= SAFE_DISTANCE_SCORE)
      if (trustedDistance) {
        window.clearTimeout(missingRouteTimerRef.current)
        setMapsRoute(payload)
        setForm((current) => ({ ...current, origin: payload.origin ?? current.origin, destination: payload.destination ?? current.destination, km: String(payload.distanceKm) }))
        setRouteSource('imported')
        setDistanceSource('google-maps')
        return
      }
      if (payload.routeVisible) {
        window.clearTimeout(missingRouteTimerRef.current)
        return
      }
      window.clearTimeout(missingRouteTimerRef.current)
      missingRouteTimerRef.current = window.setTimeout(() => {
        if (useBudgetWorkspaceStore.getState().distanceSource === 'history') return
        setMapsRoute(payload)
        setForm((current) => ({ ...current, km: '' }))
        setRouteSource('manual')
        setDistanceSource(null)
        setCalculationKey(undefined)
        setQuote(undefined)
      }, 1200)
    })
    return () => { remove?.(); window.clearTimeout(missingRouteTimerRef.current) }
  }, [setCalculationKey, setDistanceSource, setForm, setMapsRoute, setQuote, setRouteSource])

  const calculate = useCallback(async () => {
    if (!table || !snapshot || !form.baseId || !form.origin || !form.destination || !Number(form.km)) return
    setBusy(true)
    try {
      const route = await window.coreDesk!.operations.calculateRoute({ origin: form.origin, destination: form.destination, totalKm: Number(form.km), source: routeSource })
      const result = await window.coreDesk!.operations.calculateQuote({ insurerId: form.insurerId, specialtyId: form.specialtyId, baseId: form.baseId, origin: form.origin, destination: form.destination, route, extras: Number(form.extras) || 0, observations: form.observations })
      setQuote(result.quote)
      setCalculationKey(currentCalculationKey)
    } catch (error) { onNotice(error instanceof Error ? error.message : 'Não foi possível calcular.') } finally { setBusy(false) }
  }, [currentCalculationKey, form, onNotice, routeSource, setCalculationKey, setQuote, snapshot, table])

  useEffect(() => {
    if (distanceSource === 'history') return
    if (calculationKey === currentCalculationKey && quote) return
    const trustedDistance = mapsRoute?.distanceKm !== null && mapsRoute?.distanceKm !== undefined && (mapsRoute.confidence === 'high' || mapsRoute.score >= SAFE_DISTANCE_SCORE)
    if (activeTabId !== 'routes' || !trustedDistance || !form.companyId || !form.insurerId || !form.specialtyId || !form.baseId || !form.origin || !form.destination) {
      if (!form.companyId || !form.insurerId || !form.specialtyId || !mapsRoute?.distanceKm) setQuote(undefined)
      return
    }
    void calculate()
  }, [activeTabId, calculate, calculationKey, currentCalculationKey, distanceSource, form.baseId, form.companyId, form.destination, form.insurerId, form.origin, form.specialtyId, mapsRoute?.confidence, mapsRoute?.distanceKm, mapsRoute?.score, quote, setQuote])

  const save = async () => { if (quote) { const saved = await window.coreDesk!.operations.saveQuote({ ...quote, workspaceSnapshot: createQuoteWorkspaceSnapshot({ quote, snapshot, form, baseAddress, distanceSource, mapsRoute }) }); setQuote(saved); onSaved() } }
  const copy = async () => { if (quote) { await navigator.clipboard.writeText(quote.message); onNotice('Orçamento copiado.') } }
  const copyBaseAddress = async () => { if (!baseAddress) return; await navigator.clipboard.writeText(baseAddress); setFeedback('✓ Endereço copiado.') }
  const copyBudget = async () => {
    const company = snapshot?.operationalCompanies.find((item) => item.id === form.companyId)?.name ?? ''
    const insurer = snapshot?.insurers.find((item) => item.id === form.insurerId)?.name ?? ''
    const specialty = snapshot?.specialties.find((item) => item.id === form.specialtyId)?.name ?? ''
    const lines = ['ORÇAMENTO DE GUINCHO', '', 'Empresa:', company, '', 'Seguradora:', insurer, '', 'Especialidade:', specialty, '', 'Base:', selectedBase?.name ?? '', '', 'Origem:', form.origin, '', 'Destino:', form.destination, '', 'Quilometragem:', distanceLabel]
    if (quote) lines.push('', 'Valor por KM:', `R$ ${quote.calculation.kmValue.toFixed(2)}`, '', 'Taxa de deslocamento:', `R$ ${quote.calculation.exitValue.toFixed(2)}`, '', 'Adicionais:', `R$ ${quote.calculation.extras.toFixed(2)}`, '', 'TOTAL:', `R$ ${quote.calculation.total.toFixed(2)}`)
    await navigator.clipboard.writeText(lines.join('\n'))
    setFeedback('✓ Orçamento copiado para a área de transferência.')
  }
  const distanceValue = distanceSource === 'history' ? Number(form.km) : mapsRoute?.distanceKm
  const distanceLabel = Number.isFinite(distanceValue) && Number(distanceValue) >= 0 ? `${Number(distanceValue).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} km` : 'Aguardando rota no Google Maps'
  const distanceOriginLabel = distanceSource === 'history' ? 'Origem: Histórico salvo' : 'Origem: Google Maps'

  return <div ref={pageRef} className="budget-page flex h-full min-h-0 min-w-0 flex-1 gap-3 overflow-hidden">
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 overflow-hidden">
      <section className="shrink-0 rounded-xl border border-core-line bg-core-panel p-3 shadow-lg shadow-black/10"><header className="mb-3 flex items-center gap-2"><span className="grid h-7 w-7 place-items-center rounded-lg bg-core-accent/10 text-core-accent"><Wallet size={14} /></span><h2 className="text-sm font-semibold text-white">Dados do atendimento</h2></header><div className="grid gap-2 sm:grid-cols-2"><Choice label="Empresa" value={form.companyId} onChange={(value) => update('companyId', value)} options={options.companies} /><Choice label="Seguradora" value={form.insurerId} onChange={(value) => update('insurerId', value)} options={options.insurers} /><Choice label="Especialidade" value={form.specialtyId} onChange={(value) => update('specialtyId', value)} options={options.specialties} /><Choice label="Base" value={form.baseId} onChange={(value) => update('baseId', value)} options={options.bases} /></div>{baseAddress && <div className="mt-2 flex items-center gap-3 rounded-lg border border-core-line/70 bg-core-canvas/60 px-3 py-2 text-xs text-slate-300"><span className="text-base">📍</span><div className="min-w-0 flex-1"><p className="font-medium text-slate-400">Endereço da Base</p><p className="truncate text-[11px] text-slate-300">{baseAddress}</p></div><button type="button" onClick={() => void copyBaseAddress()} className="inline-flex shrink-0 items-center gap-1 rounded border border-core-line px-2 py-1 text-[11px] text-core-accent hover:bg-core-accent/10"><Copy size={12} /> Copiar endereço</button></div>}</section>
      <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-core-line bg-core-panel shadow-lg shadow-black/10"><header className="flex shrink-0 items-center gap-3 border-b border-core-line px-4 py-3"><span className="grid h-8 w-8 place-items-center rounded-lg bg-core-accent/10 text-core-accent"><MapPinned size={16} /></span><h2 className="text-sm font-semibold text-white">Google Maps</h2></header><div ref={mapsContainerRef} data-testid="budget-maps-container" className="relative h-full min-h-0 w-full flex-1 overflow-hidden bg-[#101419]"><span className="pointer-events-none absolute inset-0 grid place-items-center text-xs text-slate-600">Carregando Google Maps...</span></div></section>
    </div>
    <aside className="budget-summary min-w-0 rounded-xl border border-core-line bg-core-panel p-4 shadow-lg shadow-black/10"><header className="mb-4"><h2 className="text-lg font-semibold text-white">Resumo Financeiro</h2></header><div className="mb-4 space-y-3 border-b border-core-line pb-4 text-xs text-slate-300"><div><span className="text-slate-500">Quilometragem total</span><p className="mt-1 text-xl font-semibold text-white">{distanceLabel}</p><span className="text-[10px] text-core-accent">{distanceOriginLabel}</span></div>{quote && <><p className="flex justify-between"><span>Valor por KM</span><b>R$ {quote.calculation.kmValue.toFixed(2)}</b></p><p className="flex justify-between"><span>Taxa de deslocamento</span><b>R$ {quote.calculation.exitValue.toFixed(2)}</b></p>{quote.calculation.extras > 0 && <p className="flex justify-between"><span>Adicionais</span><b>R$ {quote.calculation.extras.toFixed(2)}</b></p>}<p className="flex justify-between border-t border-core-line pt-3 text-lg font-semibold text-core-accent"><span>TOTAL DO ORÇAMENTO</span><b>R$ {quote.calculation.total.toFixed(2)}</b></p><button type="button" onClick={() => void copyBudget()} className="mt-2 w-full rounded-lg bg-core-accent px-3 py-2 text-xs font-semibold text-slate-950">Copiar orçamento</button></>}</div>{feedback && <p className="mb-3 text-xs text-core-accent">{feedback}</p>}{busy && <p className="text-xs text-slate-500">Atualizando orçamento...</p>}{quote && <div className="space-y-3"><textarea value={quote.message} onChange={(event) => setQuote({ ...quote, message: event.target.value, editedMessage: event.target.value })} className="min-h-28 w-full rounded-lg border border-core-line bg-core-canvas p-2 text-xs text-slate-300" /><div className="flex gap-2"><button onClick={() => void save()} className="rounded-lg bg-core-accent px-3 py-2 text-xs font-semibold text-slate-950">Salvar</button><button onClick={() => void copy()} className="rounded-lg border border-core-line px-3 py-2 text-xs">Copiar mensagem</button></div></div>}</aside>
  </div>
}
