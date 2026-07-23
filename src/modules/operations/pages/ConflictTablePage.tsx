import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Pencil, Plus, Power, Trash2 } from 'lucide-react'
import type { OperationsSnapshot } from '../../../../shared/operations/contracts'
import type { EntityStatus, PricingTable } from '../../../../shared/operations/models'
import type { PriceTableConflictGroup } from '../../../../shared/operations/migration'
import { decideDeletion, effectiveStatus, getMaintenanceReferences, maintenanceSuccess, matchesStatusFilter, parseMaintenanceError, type StatusFilter } from '../../../../shared/operations/maintenance'
import { findApplicablePriceTable } from '../../../../shared/operations/pricing'
import { useBudgetWorkspaceStore } from '../store/useBudgetWorkspaceStore'
import { ConfirmDialog } from '../components/ConfirmDialog'

const inputClass = 'h-9 min-w-0 rounded border border-core-line bg-core-panel px-2 text-xs text-white outline-none focus-visible:ring-2 focus-visible:ring-core-accent/40'
const actionClass = 'inline-flex min-h-8 items-center gap-1.5 rounded border px-2.5 py-1.5 text-[11px] outline-none focus-visible:ring-2 focus-visible:ring-core-accent/50'

async function execute<T>(operation: () => Promise<T>) {
  try { return maintenanceSuccess(await operation()) } catch (error) { return parseMaintenanceError(error) }
}

type FormMode = 'create' | 'edit'

export function ConflictTablePage({ onOperationsChanged }: { onOperationsChanged?: () => void | Promise<unknown> }) {
  const [snapshot, setSnapshot] = useState<OperationsSnapshot>()
  const [conflicts, setConflicts] = useState<PriceTableConflictGroup[]>([])
  const [query, setQuery] = useState('')
  const [company, setCompany] = useState('')
  const [insurer, setInsurer] = useState('')
  const [specialty, setSpecialty] = useState('')
  const [status, setStatus] = useState<StatusFilter>('all')
  const [conflict, setConflict] = useState('all')
  const [selected, setSelected] = useState<PriceTableConflictGroup>()
  const [conflictKeepId, setConflictKeepId] = useState<string>()
  const [editing, setEditing] = useState<PricingTable>()
  const [formMode, setFormMode] = useState<FormMode>()
  const [draft, setDraft] = useState<Record<string, string>>({})
  const [initialDraft, setInitialDraft] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [confirmClose, setConfirmClose] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<{ table: PricingTable; action: 'delete' | 'inactivate'; message: string }>()
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const addButtonRef = useRef<HTMLButtonElement>(null)
  const budgetForm = useBudgetWorkspaceStore((state) => state.form)
  const load = useCallback(async (notifyParent = false) => {
    const api = window.coreDesk!.operations
    const [next, groups] = await Promise.all([api.getSnapshot(), api.listPriceTableConflicts()])
    setSnapshot(next)
    setConflicts(groups)
    if (notifyParent) await onOperationsChanged?.()
  }, [onOperationsChanged])
  useEffect(() => { void load() }, [load])

  const tables = snapshot?.pricingTables ?? []
  const companies = snapshot?.operationalCompanies ?? []
  const conflictIds = new Set(conflicts.flatMap((group) => group.priceTableIds))
  const companyName = (id?: string) => companies.find((item) => item.id === id)?.name ?? 'Empresa legada'
  const insurerName = (id: string) => snapshot?.insurers.find((item) => item.id === id)?.name ?? 'Seguradora não encontrada'
  const specialtyName = (id: string) => snapshot?.specialties.find((item) => item.id === id)?.name ?? 'Especialidade não encontrada'
  const currentTableId = useMemo(() => {
    if (!snapshot || !budgetForm.companyId || !budgetForm.insurerId || !budgetForm.specialtyId) return undefined
    const result = findApplicablePriceTable({ companyId: budgetForm.companyId, insurerId: budgetForm.insurerId, specialtyId: budgetForm.specialtyId, priceTables: snapshot.pricingTables, specialties: snapshot.specialties })
    return result.status === 'found' ? result.priceTable.id : undefined
  }, [budgetForm.companyId, budgetForm.insurerId, budgetForm.specialtyId, snapshot])
  const filtered = tables.filter((table) => {
    const text = `${companyName(table.companyId)} ${insurerName(table.insurerId)} ${specialtyName(table.specialtyId)} ${table.legacyId ?? ''}`.toLocaleLowerCase('pt-BR')
    return text.includes(query.trim().toLocaleLowerCase('pt-BR')) && (!company || table.companyId === company) && (!insurer || table.insurerId === insurer) && (!specialty || table.specialtyId === specialty) && matchesStatusFilter(table.status, status) && (conflict === 'all' || (conflict === 'yes' ? conflictIds.has(table.id) : !conflictIds.has(table.id)))
  })
  const groupForTable = (id: string) => conflicts.find((group) => group.priceTableIds.includes(id))

  const resolveConflict = async () => {
    if (!selected || !conflictKeepId) return
    await window.coreDesk!.operations.resolvePriceTableConflict(selected.id, conflictKeepId)
    setConflictKeepId(undefined)
    setSelected(undefined)
    setNotice('Conflito resolvido e tabelas atualizadas.')
    await load(true)
  }

  const openEditor = (table: PricingTable) => {
    const nextDraft = { companyId: table.companyId ?? '', insurerId: table.insurerId, specialtyId: table.specialtyId, exitValue: String(table.exitValue), kmFranchise: String(table.kmFranchise), kmValue: String(table.kmValue), workHourValue: String(table.workHourValue ?? 0), validFrom: table.validFrom ?? '', validUntil: table.validUntil ?? '', status: effectiveStatus(table.status) === 'active' ? 'active' : 'inactive', changeReason: table.changeReason ?? '' }
    setEditing(table)
    setFormMode('edit')
    setDraft(nextDraft)
    setInitialDraft(nextDraft)
    setError('')
  }

  const openCreator = () => {
    const nextDraft = { companyId: '', insurerId: '', specialtyId: '', exitValue: '', kmFranchise: '', kmValue: '', workHourValue: '', validFrom: '', validUntil: '', status: 'active', changeReason: '' }
    setEditing(undefined)
    setFormMode('create')
    setDraft(nextDraft)
    setInitialDraft(nextDraft)
    setNotice('')
    setError('')
  }

  const closeEditor = () => {
    setEditing(undefined)
    setFormMode(undefined)
    setDraft({})
    setInitialDraft({})
    setConfirmClose(false)
    queueMicrotask(() => addButtonRef.current?.focus())
  }

  const requestClose = () => {
    if (JSON.stringify(draft) !== JSON.stringify(initialDraft)) setConfirmClose(true)
    else closeEditor()
  }

  const saveTable = async () => {
    if (!formMode || saving) return
    if (!draft.companyId || !draft.insurerId || !draft.specialtyId || draft.exitValue === '' || draft.kmFranchise === '' || draft.kmValue === '') { setError('Empresa, Seguradora, Especialidade e valores financeiros são obrigatórios.'); return }
    setSaving(true)
    const result = await execute(() => window.coreDesk!.operations.savePricingTable({ ...(editing ?? {}), companyId: draft.companyId, insurerId: draft.insurerId, specialtyId: draft.specialtyId, exitValue: Number(draft.exitValue), kmFranchise: Number(draft.kmFranchise), kmValue: Number(draft.kmValue), workHourValue: Number(draft.workHourValue || 0), validFrom: draft.validFrom || undefined, validUntil: draft.validUntil || undefined, status: draft.status === 'inactive' ? 'inactive' : 'active', changeReason: draft.changeReason.trim() || undefined }))
    setSaving(false)
    if (!result.success) { setError(result.error?.message ?? 'Não foi possível atualizar a Tabela.'); return }
    const created = formMode === 'create'
    closeEditor()
    setNotice(created ? 'Tabela criada com sucesso.' : 'Registro atualizado com sucesso.')
    await load(true)
  }

  const requestDelete = (table: PricingTable) => {
    if (!snapshot) return
    const decision = decideDeletion('pricing-table', `a tabela ${table.legacyId ?? table.id}`, getMaintenanceReferences(snapshot, 'pricing-table', table.id, { 'pricing-table': currentTableId }))
    if (decision.action === 'blocked') { setNotice(''); setError(decision.message); return }
    setError('')
    setDeleteTarget({ table, action: decision.action, message: decision.message })
  }

  const deleteTable = async () => {
    if (!deleteTarget) return
    const result = await execute(() => window.coreDesk!.operations.savePricingTable({ ...deleteTarget.table, maintenanceAction: 'delete' }))
    const action = deleteTarget.action
    setDeleteTarget(undefined)
    if (!result.success) { setError(result.error?.message ?? 'Não foi possível excluir a Tabela.'); return }
    setNotice(action === 'inactivate' ? 'Tabela inativada para preservar o histórico.' : 'Tabela excluída com sucesso.')
    await load(true)
  }

  const toggleStatus = async (table: PricingTable) => {
    const nextStatus = effectiveStatus(table.status) === 'active' ? 'inactive' : 'active'
    const result = await execute(() => window.coreDesk!.operations.savePricingTable({ ...table, status: nextStatus }))
    if (!result.success) { setError(result.error?.message ?? 'Não foi possível alterar o status.'); return }
    setError('')
    setNotice(nextStatus === 'active' ? 'Tabela ativada com sucesso.' : 'Tabela inativada com sucesso.')
    await load(true)
  }

  return <div className="w-full text-sm text-slate-200">
    <header className="mb-4 flex flex-wrap items-start justify-between gap-3"><div><h1 className="text-xl font-semibold text-white">Tabelas de Preço</h1><p className="mt-1 text-xs text-slate-400">{tables.length} tabelas cadastradas · {conflicts.length} conflitos ativos · {conflicts.reduce((sum, group) => sum + group.count, 0)} registros aguardando revisão</p></div><div className="flex flex-wrap gap-2"><button ref={addButtonRef} type="button" onClick={openCreator} disabled={saving} aria-label="Adicionar Tabela" className="inline-flex items-center gap-2 rounded bg-core-accent px-3 py-2 text-xs font-semibold text-slate-950 outline-none transition hover:bg-cyan-300 focus-visible:ring-2 focus-visible:ring-core-accent/50 disabled:opacity-40"><Plus size={14} /> Adicionar Tabela</button><button type="button" onClick={() => setSelected(conflicts[0])} disabled={!conflicts.length} className="rounded border border-core-line px-3 py-2 text-xs font-semibold text-slate-200 outline-none transition hover:bg-white/5 focus-visible:ring-2 focus-visible:ring-core-accent/50 disabled:opacity-40">Revisar Conflitos</button></div></header>
    <div className="mb-3 grid gap-2 md:grid-cols-3 xl:grid-cols-6"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Pesquisar tabela" aria-label="Pesquisar tabela" className={inputClass} /><select value={company} onChange={(event) => setCompany(event.target.value)} aria-label="Filtrar por empresa" className={inputClass}><option value="">Todas as empresas</option>{companies.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><select value={insurer} onChange={(event) => setInsurer(event.target.value)} aria-label="Filtrar por seguradora" className={inputClass}><option value="">Todas as seguradoras</option>{snapshot?.insurers.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><select value={specialty} onChange={(event) => setSpecialty(event.target.value)} aria-label="Filtrar por especialidade" className={inputClass}><option value="">Todas as especialidades</option>{snapshot?.specialties.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><select value={status} onChange={(event) => setStatus(event.target.value as StatusFilter)} aria-label="Filtrar por status" className={inputClass}><option value="active">Ativas</option><option value="inactive">Inativas</option><option value="all">Todos os status</option></select><select value={conflict} onChange={(event) => setConflict(event.target.value)} aria-label="Filtrar por conflito" className={inputClass}><option value="all">Todos os conflitos</option><option value="none">Sem conflito</option><option value="yes">Aguardando revisão</option></select></div>
    {(notice || error) && <p className={`mb-3 rounded border border-core-line bg-core-panel px-3 py-2 text-xs ${error ? 'text-red-300' : 'text-core-accent'}`}>{error || notice}</p>}
    <div className="w-full overflow-x-auto rounded-lg border border-core-line bg-core-panel"><div className="min-w-[980px]"><div className="grid grid-cols-[minmax(150px,.8fr)_minmax(170px,1fr)_minmax(150px,.8fr)_110px_110px_120px_300px] border-b border-core-line px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500"><span>Empresa</span><span>Seguradora</span><span>Especialidade</span><span>Saída</span><span>KM incluído</span><span>Valor/KM</span><span className="text-right">Ações</span></div>{filtered.map((table) => <div key={table.id} className="grid grid-cols-[minmax(150px,.8fr)_minmax(170px,1fr)_minmax(150px,.8fr)_110px_110px_120px_300px] items-center border-b border-core-line/60 px-4 py-3 text-xs last:border-b-0"><span className="truncate">{companyName(table.companyId)}</span><span className="truncate">{insurerName(table.insurerId)}</span><span className="truncate">{specialtyName(table.specialtyId)}</span><span>R$ {table.exitValue.toFixed(2)}</span><span>{table.kmFranchise} km</span><span>R$ {table.kmValue.toFixed(2)}</span><div className="flex justify-end gap-1.5">{conflictIds.has(table.id) && <button type="button" onClick={() => setSelected(groupForTable(table.id))} className="rounded bg-red-500/20 px-2 py-1 text-[10px] font-bold text-red-300">CONFLITO</button>}<button type="button" title="Editar" aria-label={`Editar tabela ${table.legacyId ?? table.id}`} onClick={() => openEditor(table)} className={`${actionClass} border-core-line text-slate-300 hover:bg-white/5`}><Pencil size={13} /> Editar</button><button type="button" title={effectiveStatus(table.status) === 'active' ? 'Inativar' : 'Ativar'} aria-label={`${effectiveStatus(table.status) === 'active' ? 'Inativar' : 'Ativar'} tabela ${table.legacyId ?? table.id}`} onClick={() => void toggleStatus(table)} className={`${actionClass} border-core-line text-slate-300 hover:bg-white/5`}><Power size={13} /></button><button type="button" title="Excluir" aria-label={`Excluir tabela ${table.legacyId ?? table.id}`} onClick={() => requestDelete(table)} className={`${actionClass} border-red-500/30 text-red-300 hover:bg-red-500/10`}><Trash2 size={13} /></button></div></div>)}</div></div>
    {formMode && <TableEditor table={editing} mode={formMode} draft={draft} setDraft={setDraft} snapshot={snapshot} error={error} saving={saving} onCancel={requestClose} onSave={() => void saveTable()} />}
    {selected && <ConflictComparison group={selected} tables={tables} companyName={companyName} insurerName={insurerName} specialtyName={specialtyName} onClose={() => setSelected(undefined)} onKeep={setConflictKeepId} />}
    <ConfirmDialog open={Boolean(conflictKeepId)} title="Deseja manter esta tabela ativa?" message="As demais tabelas deste grupo serão arquivadas. Nenhum dado será excluído." onCancel={() => setConflictKeepId(undefined)} onConfirm={() => void resolveConflict()} />
    <ConfirmDialog open={Boolean(deleteTarget)} title={deleteTarget?.action === 'inactivate' ? 'Inativar Tabela?' : 'Excluir Tabela?'} message={deleteTarget?.message ?? ''} confirmLabel={deleteTarget?.action === 'inactivate' ? 'Inativar' : 'Excluir definitivamente'} danger onCancel={() => setDeleteTarget(undefined)} onConfirm={() => void deleteTable()} />
    <ConfirmDialog open={confirmClose} title="Descartar alterações?" message="Os dados preenchidos ainda não foram salvos." confirmLabel="Descartar" danger onCancel={() => setConfirmClose(false)} onConfirm={closeEditor} />
  </div>
}

function TableEditor({ table, mode, draft, setDraft, snapshot, error, saving, onCancel, onSave }: { table?: PricingTable; mode: FormMode; draft: Record<string, string>; setDraft: (draft: Record<string, string>) => void; snapshot?: OperationsSnapshot; error: string; saving: boolean; onCancel: () => void; onSave: () => void }) {
  const field = (key: string, value: string) => setDraft({ ...draft, [key]: value })
  const allowed = <T extends { id: string; status?: EntityStatus }>(items: T[], selectedId: string) => items.filter((item) => effectiveStatus(item.status) === 'active' || (mode === 'edit' && item.id === selectedId))
  if (mode === 'create') return <div role="dialog" aria-modal="true" aria-labelledby="new-table-title" onKeyDown={(event) => { if (event.key === 'Escape' && !saving) onCancel() }} className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4"><div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-xl border border-core-line bg-core-raised p-4 shadow-2xl"><header className="mb-4"><h2 id="new-table-title" className="text-base font-semibold text-white">Nova Tabela</h2><p className="mt-1 text-xs text-slate-500">Cadastre os valores reais utilizados pelo cálculo operacional.</p></header><div className="grid gap-3 sm:grid-cols-2"><Select autoFocus label="Empresa" value={draft.companyId} onChange={(value) => field('companyId', value)} options={allowed(snapshot?.operationalCompanies ?? [], draft.companyId).map((item) => [item.id, item.name])} /><Select label="Seguradora" value={draft.insurerId} onChange={(value) => field('insurerId', value)} options={allowed(snapshot?.insurers ?? [], draft.insurerId).map((item) => [item.id, item.name])} /><Select label="Especialidade" value={draft.specialtyId} onChange={(value) => field('specialtyId', value)} options={allowed(snapshot?.specialties ?? [], draft.specialtyId).map((item) => [item.id, item.name])} /><Select label="Status" value={draft.status} onChange={(value) => field('status', value)} options={[["active", "Ativa"], ["inactive", "Inativa"]]} /><Field label="Taxa de deslocamento (R$)" type="number" value={draft.exitValue} onChange={(value) => field('exitValue', value)} /><Field label="Quilometragem inicial/franquia" type="number" value={draft.kmFranchise} onChange={(value) => field('kmFranchise', value)} /><Field label="Valor por KM (R$)" type="number" value={draft.kmValue} onChange={(value) => field('kmValue', value)} /><Field label="Valor por hora (R$)" type="number" value={draft.workHourValue} onChange={(value) => field('workHourValue', value)} /><Field label="Vigência inicial" type="date" value={draft.validFrom} onChange={(value) => field('validFrom', value)} /><Field label="Vigência final" type="date" value={draft.validUntil} onChange={(value) => field('validUntil', value)} /><label className="grid gap-1 text-xs text-slate-400 sm:col-span-2"><span>Observações da tabela</span><textarea value={draft.changeReason} onChange={(event) => field('changeReason', event.target.value)} className="min-h-20 rounded border border-core-line bg-core-canvas p-3 text-xs text-white outline-none focus-visible:ring-2 focus-visible:ring-core-accent/40" /></label></div>{error && <p className="mt-3 text-xs text-red-300">{error}</p>}<div className="mt-5 flex justify-end gap-2"><button type="button" disabled={saving} onClick={onCancel} className={`${actionClass} border-core-line text-slate-300 disabled:opacity-40`}>Cancelar</button><button type="button" disabled={saving} onClick={onSave} className="rounded bg-core-accent px-4 py-2 text-xs font-semibold text-slate-950 outline-none focus-visible:ring-2 focus-visible:ring-core-accent/50 disabled:cursor-wait disabled:opacity-60">{saving ? 'Salvando...' : 'Salvar'}</button></div></div></div>
  if (!table) return null
  return <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4"><div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-xl border border-core-line bg-core-raised p-4 shadow-2xl"><header className="mb-4"><h2 className="text-base font-semibold text-white">Editar Tabela</h2><p className="mt-1 text-xs text-slate-500">ID preservado: {table.legacyId ?? table.id}</p></header><div className="grid gap-3 sm:grid-cols-2"><Select label="Empresa" value={draft.companyId} onChange={(value) => field('companyId', value)} options={snapshot?.operationalCompanies.map((item) => [item.id, item.name]) ?? []} /><Select label="Seguradora" value={draft.insurerId} onChange={(value) => field('insurerId', value)} options={snapshot?.insurers.map((item) => [item.id, item.name]) ?? []} /><Select label="Especialidade" value={draft.specialtyId} onChange={(value) => field('specialtyId', value)} options={snapshot?.specialties.map((item) => [item.id, item.name]) ?? []} /><Select label="Status" value={draft.status} onChange={(value) => field('status', value)} options={[['active', 'Ativa'], ['inactive', 'Inativa']]} /><Field label="Taxa de deslocamento (R$)" type="number" value={draft.exitValue} onChange={(value) => field('exitValue', value)} /><Field label="Quilometragem inicial/franquia" type="number" value={draft.kmFranchise} onChange={(value) => field('kmFranchise', value)} /><Field label="Valor por KM (R$)" type="number" value={draft.kmValue} onChange={(value) => field('kmValue', value)} /><Field label="Valor por hora (R$)" type="number" value={draft.workHourValue} onChange={(value) => field('workHourValue', value)} /><Field label="Vigência inicial" type="date" value={draft.validFrom} onChange={(value) => field('validFrom', value)} /><Field label="Vigência final" type="date" value={draft.validUntil} onChange={(value) => field('validUntil', value)} /><label className="grid gap-1 text-xs text-slate-400 sm:col-span-2"><span>Motivo da alteração</span><textarea value={draft.changeReason} onChange={(event) => field('changeReason', event.target.value)} className="min-h-20 rounded border border-core-line bg-core-canvas p-3 text-xs text-white outline-none focus-visible:ring-2 focus-visible:ring-core-accent/40" /></label></div>{error && <p className="mt-3 text-xs text-red-300">{error}</p>}<div className="mt-5 flex justify-end gap-2"><button type="button" onClick={onCancel} className={`${actionClass} border-core-line text-slate-300`}>Cancelar</button><button type="button" onClick={onSave} className="rounded bg-core-accent px-4 py-2 text-xs font-semibold text-slate-950 outline-none focus-visible:ring-2 focus-visible:ring-core-accent/50">Salvar alterações</button></div></div></div>
}

function ConflictComparison({ group, tables, companyName, insurerName, specialtyName, onClose, onKeep }: { group: PriceTableConflictGroup; tables: PricingTable[]; companyName: (id?: string) => string; insurerName: (id: string) => string; specialtyName: (id: string) => string; onClose: () => void; onKeep: (id: string) => void }) {
  return <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-6"><div className="max-h-[85vh] w-full max-w-5xl overflow-auto rounded-lg border border-core-line bg-core-panel p-4"><div className="mb-4 flex items-center justify-between"><div><h2 className="text-lg font-semibold text-white">Comparar conflito</h2><p className="text-xs text-slate-400">{companyName(group.companyId)} · {insurerName(group.insurerId)} · {specialtyName(group.specialtyKey)} · {group.count} tabelas</p></div><button onClick={onClose} className="text-slate-400">Fechar</button></div><div className="grid gap-3 md:grid-cols-2">{group.priceTableIds.map((id) => { const table = tables.find((item) => item.id === id); if (!table) return null; return <article key={id} className="rounded border border-core-line bg-core-canvas p-3 text-xs"><h3 className="mb-2 font-semibold text-white">Tabela {table.legacyId ?? table.id}</h3><p>Empresa: {companyName(table.companyId)}</p><p>Saída: R$ {table.exitValue.toFixed(2)}</p><p>KM incluído: {table.kmFranchise} km</p><p>Valor/KM: R$ {table.kmValue.toFixed(2)}</p><p>Valor/hora: R$ {(table.workHourValue ?? 0).toFixed(2)}</p><p>Status: {table.status}</p><button onClick={() => onKeep(id)} className="mt-3 rounded bg-core-accent px-3 py-2 font-semibold text-slate-950">Manter esta tabela</button></article> })}</div></div></div>
}

function Field({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (value: string) => void; type?: string }) { return <label className="grid gap-1 text-xs text-slate-400"><span>{label}</span><input type={type} min={type === 'number' ? 0 : undefined} step={type === 'number' ? '0.01' : undefined} value={value} onChange={(event) => onChange(event.target.value)} className={inputClass} /></label> }
function Select({ label, value, onChange, options, autoFocus = false }: { label: string; value: string; onChange: (value: string) => void; options: string[][]; autoFocus?: boolean }) { return <label className="grid gap-1 text-xs text-slate-400"><span>{label}</span><select autoFocus={autoFocus} value={value} onChange={(event) => onChange(event.target.value)} className={inputClass}><option value="">Selecione</option>{options.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label> }
