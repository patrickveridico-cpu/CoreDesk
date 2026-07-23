import { useCallback, useEffect, useState } from 'react'
import { OperationsNavigation, type OperationsSection } from '../components/OperationsNavigation'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { EmptyState } from '../components/EmptyState'
import { StatusBadge } from '../components/StatusBadge'
import type { OperationsSnapshot } from '../../../../shared/operations/contracts'
import type { OperationQuote } from '../../../../shared/operations/models'
import { BudgetPage } from './BudgetPage'
import { ConflictTablePage } from './ConflictTablePage'
import { useBudgetWorkspaceStore } from '../store/useBudgetWorkspaceStore'
import { EntityMaintenancePanel } from '../components/EntityMaintenancePanel'

const sectionMeta: Record<OperationsSection, { title: string; description: string }> = {
  quote: { title: 'Orçamento', description: '' },
  history: { title: 'Histórico', description: 'Consulte, copie ou restaure orçamentos salvos.' },
  companies: { title: 'Empresas', description: 'Gerencie as empresas operacionais disponíveis.' },
  bases: { title: 'Bases', description: 'Consulte as bases usadas nos atendimentos.' },
  insurers: { title: 'Seguradoras', description: 'Consulte as seguradoras cadastradas.' },
  specialties: { title: 'Especialidades', description: 'Consulte as especialidades atendidas.' },
  tables: { title: 'Tabelas', description: 'Consulte valores e conflitos das tabelas de preço.' },
  import: { title: 'Importação', description: 'Importe dados operacionais de forma controlada.' },
  backups: { title: 'Backups', description: 'Consulte e restaure snapshots operacionais.' },
  audit: { title: 'Auditoria', description: 'Acompanhe alterações registradas no módulo.' },
}

export function OperationsPageSafe() {
  const [section, setSection] = useState<OperationsSection>('quote')
  const [snapshot, setSnapshot] = useState<OperationsSnapshot>()
  const [notice, setNotice] = useState('')
  const [confirm, setConfirm] = useState(false)
  const [pendingBackup, setPendingBackup] = useState<string>()
  const restoreFromHistory = useBudgetWorkspaceStore((state) => state.restoreFromHistory)
  const reload = useCallback(() => window.coreDesk?.operations.getSnapshot().then(setSnapshot), [])

  useEffect(() => { void reload() }, [reload])

  const importData = async () => {
    setConfirm(false)
    await window.coreDesk?.operations.confirmImport()
    await reload()
    setNotice('Importação concluída.')
  }

  const restore = async () => {
    if (!pendingBackup) return
    setConfirm(false)
    await window.coreDesk?.operations.restoreBackup(pendingBackup)
    setPendingBackup(undefined)
    await reload()
    setNotice('Backup restaurado.')
  }

  const reopenQuote = (quote: OperationQuote) => {
    if (!snapshot) return
    restoreFromHistory(quote, snapshot)
    setSection('quote')
    setNotice('Orçamento restaurado do histórico.')
  }

  const content = section === 'quote'
    ? <BudgetPage snapshot={snapshot} onSaved={() => { void reload(); setNotice('Orçamento salvo no histórico.') }} onNotice={setNotice} />
    : section === 'tables'
      ? <ConflictTablePage onOperationsChanged={reload} />
      : section === 'companies'
        ? <CompaniesPanel />
        : section === 'history'
          ? <HistoryPanel snapshot={snapshot} onReopen={reopenQuote} onNotice={setNotice} />
          : section === 'import'
            ? <ImportPanel onConfirm={() => setConfirm(true)} />
            : section === 'backups'
              ? <BackupPanel onRestore={(name) => { setPendingBackup(name); setConfirm(true) }} />
              : section === 'audit'
                ? <AuditPanel />
                : <EntityMaintenancePanel section={section} snapshot={snapshot} onReload={reload} />

  return <main className="flex min-h-0 min-w-0 flex-1 flex-col bg-core-canvas text-sm text-slate-200">
    <OperationsNavigation active={section} onChange={setSection} />
    {section === 'quote'
      ? <section className="relative flex min-h-0 min-w-0 flex-1">
          {notice && <span className="absolute right-4 top-2 z-10 rounded bg-core-canvas/85 px-2 py-1 text-xs text-core-accent">{notice}</span>}
          {content}
        </section>
      : <section className="min-h-0 min-w-0 flex-1 overflow-y-auto">
          <div className="w-full p-4">
            {section !== 'tables' && <PageHeader section={section} notice={notice} />}
            {content}
          </div>
        </section>}
    <ConfirmDialog
      open={confirm}
      title={pendingBackup ? 'Restaurar backup' : 'Confirmar importação'}
      message={pendingBackup ? 'A restauração substitui os dados operacionais atuais.' : 'Os arquivos originais não serão alterados.'}
      confirmLabel={pendingBackup ? 'RESTAURAR' : 'Importar'}
      onCancel={() => { setConfirm(false); setPendingBackup(undefined) }}
      onConfirm={() => void (pendingBackup ? restore() : importData())}
    />
  </main>
}

function PageHeader({ section, notice }: { section: OperationsSection; notice: string }) {
  const meta = sectionMeta[section]
  return <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
    <div>
      <h1 className="text-xl font-semibold text-white">{meta.title}</h1>
      {meta.description && <p className="mt-1 text-xs text-slate-500">{meta.description}</p>}
    </div>
    {notice && <span className="text-xs text-core-accent">{notice}</span>}
  </header>
}

function CompaniesPanel() {
  const [items, setItems] = useState<Awaited<ReturnType<NonNullable<Window['coreDesk']>['operations']['listOperationalCompanies']>>>([])
  const [status, setStatus] = useState<'active' | 'archived'>('active')
  const [query, setQuery] = useState('')
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const load = useCallback(() => window.coreDesk!.operations.listOperationalCompanies(status).then(setItems), [status])
  useEffect(() => { void load() }, [load])
  const save = async () => {
    if (!name.trim() || !code.trim()) return
    await window.coreDesk!.operations.saveOperationalCompany({ name, code })
    setName('')
    setCode('')
    await load()
  }
  const toggleStatus = async (id: string) => {
    if (status === 'active') await window.coreDesk!.operations.archiveOperationalCompany(id)
    else await window.coreDesk!.operations.restoreOperationalCompany(id)
    await load()
  }
  const filtered = items.filter((item) => `${item.name} ${item.code}`.toLowerCase().includes(query.toLowerCase()))

  return <div className="w-full overflow-hidden rounded-lg border border-core-line bg-core-panel">
    <div className="grid gap-2 border-b border-core-line p-3 md:grid-cols-[minmax(220px,1fr)_160px]">
      <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Pesquisar empresas" aria-label="Pesquisar empresas" className="min-w-0 rounded border border-core-line bg-core-canvas px-3 py-2 text-xs text-white" />
      <select value={status} onChange={(event) => setStatus(event.target.value as 'active' | 'archived')} aria-label="Status das empresas" className="rounded border border-core-line bg-core-canvas px-3 py-2 text-xs text-white"><option value="active">Ativas</option><option value="archived">Arquivadas</option></select>
    </div>
    <div className="grid gap-2 border-b border-core-line bg-core-canvas/30 p-3 md:grid-cols-[minmax(180px,1fr)_minmax(140px,.6fr)_auto]">
      <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Nome" aria-label="Nome da empresa" className="rounded border border-core-line bg-core-canvas px-3 py-2 text-xs text-white" />
      <input value={code} onChange={(event) => setCode(event.target.value)} placeholder="Código" aria-label="Código da empresa" className="rounded border border-core-line bg-core-canvas px-3 py-2 text-xs text-white" />
      <button onClick={() => void save()} className="rounded bg-core-accent px-4 py-2 text-xs font-semibold text-slate-950">Adicionar empresa</button>
    </div>
    <div className="grid grid-cols-[minmax(0,1fr)_160px_120px] border-b border-core-line px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500"><span>Empresa</span><span>Status</span><span className="text-right">Ações</span></div>
    {filtered.map((item) => <div key={item.id} className="grid grid-cols-[minmax(0,1fr)_160px_120px] items-center border-b border-core-line/60 px-4 py-3 text-xs last:border-b-0"><span className="min-w-0 truncate font-medium text-slate-200">{item.name} <span className="ml-2 text-slate-500">{item.code}</span></span><StatusBadge status={item.status} /><button type="button" onClick={() => void toggleStatus(item.id)} className="justify-self-end rounded border border-core-line px-2 py-1 text-[11px] text-slate-300">{status === 'active' ? 'Arquivar' : 'Restaurar'}</button></div>)}
    {!filtered.length && <EmptyState text="Nenhuma empresa encontrada." />}
  </div>
}

function HistoryPanel({ snapshot, onReopen, onNotice }: { snapshot?: OperationsSnapshot; onReopen: (quote: OperationQuote) => void; onNotice: (message: string) => void }) {
  const [selectedId, setSelectedId] = useState<string>()
  const [viewingId, setViewingId] = useState<string>()
  const items = snapshot?.quotes ?? []
  const copyMessage = async (quote: OperationQuote) => {
    await navigator.clipboard.writeText(quote.workspaceSnapshot?.copiedMessage ?? quote.message)
    onNotice('Mensagem copiada do histórico.')
  }
  const name = (quote: OperationQuote, type: 'insurer' | 'specialty' | 'base') => {
    if (type === 'insurer') return quote.workspaceSnapshot?.insurerName ?? snapshot?.insurers.find((item) => item.id === quote.insurerId)?.name ?? 'Seguradora não encontrada'
    if (type === 'specialty') return quote.workspaceSnapshot?.specialtyName ?? snapshot?.specialties.find((item) => item.id === quote.specialtyId)?.name ?? 'Especialidade não encontrada'
    return quote.workspaceSnapshot?.baseName ?? snapshot?.bases.find((item) => item.id === quote.baseId)?.name ?? 'Base não encontrada'
  }

  return <div className="w-full overflow-hidden rounded-lg border border-core-line bg-core-panel">
    <div className="flex items-center justify-between border-b border-core-line px-4 py-3"><span className="text-xs text-slate-400">{items.length} orçamentos salvos</span></div>
    {items.map((item) => {
      const expanded = selectedId === item.id
      return <article key={item.id} className="border-b border-core-line/60 last:border-b-0">
        <button type="button" onClick={() => setSelectedId(expanded ? undefined : item.id)} className="grid w-full grid-cols-[minmax(0,1.4fr)_minmax(180px,.8fr)_130px_120px] items-center gap-3 px-4 py-3 text-left text-xs">
          <span className="min-w-0"><b className="block truncate text-slate-200">{item.origin} → {item.destination}</b><span className="text-slate-500">{name(item, 'insurer')} · {name(item, 'specialty')}</span></span>
          <span className="text-slate-400">{new Date(item.createdAt).toLocaleString('pt-BR')}</span>
          <b className="text-core-accent">R$ {item.calculation.total.toFixed(2)}</b>
          <StatusBadge status={item.status} />
        </button>
        {expanded && <div className="grid gap-3 border-t border-core-line/50 bg-core-canvas/45 px-4 py-3 text-xs md:grid-cols-[minmax(0,1fr)_auto]">
          <div className="grid gap-1 text-slate-400 sm:grid-cols-2"><p>Empresa: <b className="text-slate-200">{item.workspaceSnapshot?.companyName ?? 'Registro anterior'}</b></p><p>Base: <b className="text-slate-200">{name(item, 'base')}</b></p><p>Quilometragem: <b className="text-slate-200">{item.workspaceSnapshot?.distanceKm ?? item.route.totalKm} km</b></p><p>Total: <b className="text-core-accent">R$ {item.calculation.total.toFixed(2)}</b></p></div>
          <div className="flex flex-wrap items-center justify-end gap-2"><button type="button" onClick={() => setViewingId(viewingId === item.id ? undefined : item.id)} className="rounded border border-core-line px-3 py-2">Visualizar</button><button type="button" onClick={() => onReopen(item)} className="rounded bg-core-accent px-3 py-2 font-semibold text-slate-950">Reabrir orçamento</button><button type="button" onClick={() => void copyMessage(item)} className="rounded border border-core-line px-3 py-2">Copiar mensagem</button></div>
          {viewingId === item.id && <pre className="whitespace-pre-wrap rounded border border-core-line bg-core-canvas p-3 text-xs leading-5 text-slate-300 md:col-span-2">{item.workspaceSnapshot?.copiedMessage ?? item.message}</pre>}
        </div>}
      </article>
    })}
    {!items.length && <EmptyState text="Nenhum orçamento salvo." />}
  </div>
}

function ImportPanel({ onConfirm }: { onConfirm: () => void }) {
  return <div className="w-full rounded-lg border border-core-line bg-core-panel p-4"><p className="mb-3 text-xs text-slate-400">Importação somente leitura até a confirmação.</p><button onClick={onConfirm} className="rounded bg-core-accent px-3 py-2 text-xs font-semibold text-slate-950">Confirmar importação</button></div>
}

function BackupPanel({ onRestore }: { onRestore: (name: string) => void }) {
  const [items, setItems] = useState<string[]>([])
  useEffect(() => { void window.coreDesk?.operations.listBackups().then(setItems) }, [])
  return <div className="w-full rounded-lg border border-core-line bg-core-panel p-3">{items.map((name) => <div key={name} className="flex justify-between border-b border-core-line/60 px-2 py-2 text-xs"><span>{name}</span><button onClick={() => onRestore(name)} className="rounded border border-core-line px-2 py-1">Restaurar</button></div>)}{!items.length && <EmptyState text="Ainda não existem backups operacionais." />}</div>
}

function AuditPanel() {
  const [items, setItems] = useState<Array<{ id: string; timestamp: string; action: string; entity: string; summary: string }>>([])
  useEffect(() => { void window.coreDesk?.operations.listAudit().then(setItems) }, [])
  return <div className="w-full rounded-lg border border-core-line bg-core-panel p-3">{items.map((item) => <div key={item.id} className="border-b border-core-line/60 px-2 py-2 text-xs">{new Date(item.timestamp).toLocaleString('pt-BR')} · {item.action} · {item.entity} · {item.summary}</div>)}{!items.length && <EmptyState text="Ainda não existem alterações auditadas." />}</div>
}
