import { useMemo, useRef, useState } from 'react'
import { Pencil, Plus, Power, Trash2 } from 'lucide-react'
import type { MaintenanceResult } from '../../../../shared/operations/contracts'
import type { OperationBase, OperationInsurer, OperationsData, OperationSpecialty } from '../../../../shared/operations/models'
import { decideDeletion, effectiveStatus, getMaintenanceReferences, maintenanceSuccess, matchesStatusFilter, parseMaintenanceError, type StatusFilter } from '../../../../shared/operations/maintenance'
import { useBudgetWorkspaceStore } from '../store/useBudgetWorkspaceStore'
import { ConfirmDialog } from './ConfirmDialog'
import { EmptyState } from './EmptyState'
import { StatusBadge } from './StatusBadge'

type EntitySection = 'bases' | 'insurers' | 'specialties'
type EntityRecord = OperationBase | OperationInsurer | OperationSpecialty
type FormMode = 'create' | 'edit'

const inputClass = 'h-9 rounded border border-core-line bg-core-canvas px-3 text-xs text-white outline-none focus-visible:ring-2 focus-visible:ring-core-accent/40'
const actionClass = 'inline-flex min-h-8 items-center gap-1.5 rounded border px-2.5 py-1.5 text-[11px] outline-none focus-visible:ring-2 focus-visible:ring-core-accent/50'

async function executeMaintenance<T>(operation: () => Promise<T>): Promise<MaintenanceResult<T>> {
  try { return maintenanceSuccess(await operation()) } catch (error) { return parseMaintenanceError(error) }
}

export function EntityMaintenancePanel({ section, snapshot, onReload }: { section: EntitySection; snapshot?: OperationsData; onReload: () => void | Promise<unknown> }) {
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active')
  const [formMode, setFormMode] = useState<FormMode>()
  const [editing, setEditing] = useState<EntityRecord>()
  const [draft, setDraft] = useState<Record<string, string>>({})
  const [initialDraft, setInitialDraft] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<{ item: EntityRecord; action: 'delete' | 'inactivate'; message: string }>()
  const [confirmClose, setConfirmClose] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const addButtonRef = useRef<HTMLButtonElement>(null)
  const budgetForm = useBudgetWorkspaceStore((state) => state.form)
  const items: EntityRecord[] = useMemo(() => section === 'bases' ? snapshot?.bases ?? [] : section === 'insurers' ? snapshot?.insurers ?? [] : snapshot?.specialties ?? [], [section, snapshot])
  const kind = section === 'bases' ? 'base' : section === 'insurers' ? 'insurer' : 'specialty'
  const currentIds = { base: budgetForm.baseId, insurer: budgetForm.insurerId, specialty: budgetForm.specialtyId }
  const visibleItems = useMemo(() => items.filter((item) => matchesStatusFilter(item.status, statusFilter) && searchableText(item).includes(query.trim().toLocaleLowerCase('pt-BR'))), [items, query, statusFilter])

  const openEditor = (item: EntityRecord) => {
    const values = toDraft(item)
    setEditing(item)
    setFormMode('edit')
    setDraft(values)
    setInitialDraft(JSON.stringify(values))
    setFeedback('')
    setError('')
  }

  const openCreateInsurer = () => {
    const values = { name: '', code: '', company: '', status: 'active', notes: '' }
    setEditing(undefined)
    setFormMode('create')
    setDraft(values)
    setInitialDraft(JSON.stringify(values))
    setFeedback('')
    setError('')
  }

  const closeEditor = () => {
    setFormMode(undefined)
    setEditing(undefined)
    queueMicrotask(() => addButtonRef.current?.focus())
  }

  const requestClose = () => {
    if (JSON.stringify(draft) !== initialDraft) setConfirmClose(true)
    else closeEditor()
  }

  const save = async () => {
    if (!formMode || (formMode === 'edit' && !editing) || saving) return
    setError('')
    setSaving(true)
    const result = section === 'bases'
      ? await executeMaintenance(() => window.coreDesk!.operations.saveBase({ ...(editing as OperationBase), name: draft.name ?? '', address: draft.address ?? '', city: draft.city || undefined, state: draft.state || undefined, notes: draft.notes || undefined, status: draft.status === 'inactive' ? 'inactive' : 'active' }))
      : section === 'insurers'
        ? await executeMaintenance(() => window.coreDesk!.operations.saveInsurer({ ...(formMode === 'edit' ? editing as OperationInsurer : {}), name: draft.name ?? '', code: draft.code || undefined, company: draft.company || undefined, notes: draft.notes || undefined, status: draft.status === 'inactive' ? 'inactive' : 'active' }))
        : await executeMaintenance(() => window.coreDesk!.operations.saveSpecialty({ ...(editing as OperationSpecialty), name: draft.name ?? '', category: draft.category || undefined, status: draft.status === 'inactive' ? 'inactive' : 'active' }))
    setSaving(false)
    if (!result.success) { setError(result.error?.message ?? `Não foi possível ${formMode === 'create' ? 'criar' : 'atualizar'} o registro.`); return }
    const created = formMode === 'create'
    closeEditor()
    setFeedback(created ? 'Seguradora criada com sucesso.' : 'Registro atualizado com sucesso.')
    await onReload()
  }

  const requestDelete = (item: EntityRecord) => {
    if (!snapshot) return
    const references = getMaintenanceReferences(snapshot, kind, item.id, currentIds)
    const decision = decideDeletion(kind, item.name, references)
    if (decision.action === 'blocked') { setFeedback(''); setError(decision.message); return }
    setError('')
    setDeleteTarget({ item, action: decision.action, message: decision.message })
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    const item = deleteTarget.item
    const result = section === 'bases'
      ? await executeMaintenance(() => window.coreDesk!.operations.saveBase({ ...(item as OperationBase), maintenanceAction: 'delete' }))
      : section === 'insurers'
        ? await executeMaintenance(() => window.coreDesk!.operations.saveInsurer({ ...(item as OperationInsurer), maintenanceAction: 'delete' }))
        : await executeMaintenance(() => window.coreDesk!.operations.saveSpecialty({ ...(item as OperationSpecialty), maintenanceAction: 'delete' }))
    setDeleteTarget(undefined)
    if (!result.success) { setError(result.error?.message ?? 'Não foi possível excluir o registro.'); return }
    setFeedback(deleteTarget.action === 'inactivate' ? 'Registro inativado para preservar o histórico.' : 'Registro excluído com sucesso.')
    await onReload()
  }

  const toggleStatus = async (item: EntityRecord) => {
    const status = effectiveStatus(item.status) === 'active' ? 'inactive' : 'active'
    const result = section === 'bases'
      ? await executeMaintenance(() => window.coreDesk!.operations.saveBase({ ...(item as OperationBase), status }))
      : section === 'insurers'
        ? await executeMaintenance(() => window.coreDesk!.operations.saveInsurer({ ...(item as OperationInsurer), status }))
        : await executeMaintenance(() => window.coreDesk!.operations.saveSpecialty({ ...(item as OperationSpecialty), status }))
    if (!result.success) { setError(result.error?.message ?? 'Não foi possível alterar o status.'); return }
    setError('')
    setFeedback(status === 'active' ? 'Registro ativado com sucesso.' : 'Registro inativado com sucesso.')
    await onReload()
  }

  return <div className="w-full overflow-hidden rounded-lg border border-core-line bg-core-panel">
    <div className="grid gap-2 border-b border-core-line p-3 sm:grid-cols-[minmax(220px,1fr)_170px_auto_auto]">
      <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Pesquisar ${sectionLabel(section).toLocaleLowerCase('pt-BR')}`} aria-label={`Pesquisar ${sectionLabel(section)}`} className={inputClass} />
      <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as StatusFilter)} aria-label="Filtrar por status" className={inputClass}><option value="active">Ativos</option><option value="inactive">Inativos</option><option value="all">Todos</option></select>
      <span className="self-center justify-self-end text-xs text-slate-400">{visibleItems.length} de {items.length}</span>
      {section === 'insurers' && <button ref={addButtonRef} type="button" aria-label="Adicionar Seguradora" disabled={saving} onClick={openCreateInsurer} className="inline-flex min-h-9 items-center justify-center gap-2 rounded bg-core-accent px-3 py-2 text-xs font-semibold text-slate-950 outline-none transition hover:bg-cyan-300 focus-visible:ring-2 focus-visible:ring-core-accent/50 disabled:cursor-wait disabled:opacity-60"><Plus size={14} /> Adicionar Seguradora</button>}
    </div>
    {(feedback || error) && <div className={`border-b border-core-line px-4 py-2 text-xs ${error ? 'text-red-300' : 'text-core-accent'}`}>{error || feedback}</div>}
    <div className="grid grid-cols-[minmax(160px,.7fr)_minmax(220px,1.4fr)_110px_270px] border-b border-core-line px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500"><span>Nome</span><span>Detalhes</span><span>Status</span><span className="text-right">Ações</span></div>
    {visibleItems.map((item) => <div key={item.id} className="grid grid-cols-[minmax(160px,.7fr)_minmax(220px,1.4fr)_110px_270px] items-center border-b border-core-line/60 px-4 py-3 text-xs last:border-b-0"><span className="min-w-0 truncate font-medium text-slate-200">{item.name}</span><span className="min-w-0 truncate pr-3 text-slate-500">{detailsText(item)}</span><StatusBadge status={effectiveStatus(item.status)} /><div className="flex justify-end gap-1.5"><button type="button" title="Editar" aria-label={`Editar ${item.name}`} onClick={() => openEditor(item)} className={`${actionClass} border-core-line text-slate-300 hover:bg-white/5`}><Pencil size={13} /> Editar</button><button type="button" title={effectiveStatus(item.status) === 'active' ? 'Inativar' : 'Ativar'} aria-label={`${effectiveStatus(item.status) === 'active' ? 'Inativar' : 'Ativar'} ${item.name}`} onClick={() => void toggleStatus(item)} className={`${actionClass} border-core-line text-slate-300 hover:bg-white/5`}><Power size={13} /> {effectiveStatus(item.status) === 'active' ? 'Inativar' : 'Ativar'}</button><button type="button" title="Excluir" aria-label={`Excluir ${item.name}`} onClick={() => requestDelete(item)} className={`${actionClass} border-red-500/30 text-red-300 hover:bg-red-500/10`}><Trash2 size={13} /> Excluir</button></div></div>)}
    {!visibleItems.length && <EmptyState text="Nenhum registro encontrado." />}
    {formMode && <EditorDialog section={section} mode={formMode} draft={draft} setDraft={setDraft} error={error} saving={saving} onCancel={requestClose} onSave={() => void save()} />}
    <ConfirmDialog open={Boolean(deleteTarget)} title={deleteTarget?.action === 'inactivate' ? `Inativar ${deleteTarget?.item.name}?` : `Excluir ${deleteTarget?.item.name}?`} message={deleteTarget?.message ?? ''} confirmLabel={deleteTarget?.action === 'inactivate' ? 'Inativar' : 'Excluir definitivamente'} danger onCancel={() => setDeleteTarget(undefined)} onConfirm={() => void confirmDelete()} />
    <ConfirmDialog open={confirmClose} title="Descartar alterações?" message="As alterações não salvas serão perdidas." confirmLabel="Descartar" danger onCancel={() => setConfirmClose(false)} onConfirm={() => { setConfirmClose(false); closeEditor() }} />
  </div>
}

function EditorDialog({ section, mode, draft, setDraft, error, saving, onCancel, onSave }: { section: EntitySection; mode: FormMode; draft: Record<string, string>; setDraft: (draft: Record<string, string>) => void; error: string; saving: boolean; onCancel: () => void; onSave: () => void }) {
  const field = (key: string, value: string) => setDraft({ ...draft, [key]: value })
  return <div role="dialog" aria-modal="true" onKeyDown={(event) => { if (event.key === 'Escape' && !saving) onCancel() }} className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4"><div className="max-h-[calc(100vh-2rem)] w-full max-w-2xl overflow-y-auto rounded-xl border border-core-line bg-core-raised p-4 shadow-2xl"><header className="mb-4"><h2 className="text-base font-semibold text-white">{mode === 'create' ? 'Nova Seguradora' : `Editar ${sectionLabel(section).slice(0, -1)}`}</h2><p className="mt-1 text-xs text-slate-500">{mode === 'create' ? 'Cadastre somente os dados reais da Seguradora.' : 'O identificador original será preservado.'}</p></header><div className="grid gap-3 sm:grid-cols-2"><Field autoFocus label="Nome" value={draft.name ?? ''} onChange={(value) => field('name', value)} />{section === 'bases' && <><Field label="Endereço completo" value={draft.address ?? ''} onChange={(value) => field('address', value)} wide /><Field label="Cidade" value={draft.city ?? ''} onChange={(value) => field('city', value)} /><Field label="UF" value={draft.state ?? ''} maxLength={2} onChange={(value) => field('state', value.toUpperCase())} /></>}{section === 'insurers' && <><Field label="Código" value={draft.code ?? ''} onChange={(value) => field('code', value)} /><Field label="Empresa vinculada (texto legado)" value={draft.company ?? ''} onChange={(value) => field('company', value)} /></>}{section === 'specialties' && <Field label="Categoria" value={draft.category ?? ''} onChange={(value) => field('category', value)} />}<label className="grid gap-1 text-xs text-slate-400"><span>Status</span><select value={draft.status ?? 'active'} onChange={(event) => field('status', event.target.value)} className={inputClass}><option value="active">Ativo</option><option value="inactive">Inativo</option></select></label>{section !== 'specialties' && <label className="grid gap-1 text-xs text-slate-400 sm:col-span-2"><span>Observações</span><textarea value={draft.notes ?? ''} onChange={(event) => field('notes', event.target.value)} className="min-h-20 rounded border border-core-line bg-core-canvas p-3 text-xs text-white outline-none focus-visible:ring-2 focus-visible:ring-core-accent/40" /></label>}</div>{error && <p className="mt-3 text-xs text-red-300">{error}</p>}<div className="mt-5 flex justify-end gap-2"><button type="button" disabled={saving} onClick={onCancel} className={`${actionClass} border-core-line text-slate-300 disabled:opacity-50`}>Cancelar</button><button type="button" disabled={saving} onClick={onSave} className="rounded bg-core-accent px-4 py-2 text-xs font-semibold text-slate-950 outline-none focus-visible:ring-2 focus-visible:ring-core-accent/50 disabled:cursor-wait disabled:opacity-60">{saving ? 'Salvando...' : mode === 'create' ? 'Salvar' : 'Salvar alterações'}</button></div></div></div>
}

function Field({ label, value, onChange, wide, maxLength, autoFocus }: { label: string; value: string; onChange: (value: string) => void; wide?: boolean; maxLength?: number; autoFocus?: boolean }) {
  return <label className={`grid gap-1 text-xs text-slate-400 ${wide ? 'sm:col-span-2' : ''}`}><span>{label}</span><input autoFocus={autoFocus} value={value} maxLength={maxLength} onChange={(event) => onChange(event.target.value)} className={inputClass} /></label>
}

function toDraft(item: EntityRecord) {
  return { name: item.name, status: effectiveStatus(item.status) === 'active' ? 'active' : 'inactive', address: 'address' in item ? item.address : '', city: 'city' in item ? item.city ?? '' : '', state: 'state' in item ? item.state ?? '' : '', notes: 'notes' in item ? item.notes ?? '' : '', code: 'code' in item ? item.code ?? '' : '', company: 'company' in item ? item.company ?? '' : '', category: 'category' in item ? item.category ?? '' : '' }
}

function searchableText(item: EntityRecord) { return `${item.name} ${detailsText(item)}`.toLocaleLowerCase('pt-BR') }
function detailsText(item: EntityRecord) { if ('address' in item) return [item.address, item.city, item.state].filter(Boolean).join(', '); if ('company' in item) return [item.company, item.code].filter(Boolean).join(' · '); return 'category' in item ? item.category ?? 'Sem categoria' : '' }
function sectionLabel(section: EntitySection) { return section === 'bases' ? 'Bases' : section === 'insurers' ? 'Seguradoras' : 'Especialidades' }
