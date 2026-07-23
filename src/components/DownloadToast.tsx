import { useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle2, Download, XCircle } from 'lucide-react'
import type { DownloadStatus } from '../../shared/downloads'

const labels = {
  preparing: 'Preparando download',
  progressing: 'Baixando arquivo',
  completed: 'Download concluído',
  failed: 'Falha no download',
  cancelled: 'Download cancelado',
} as const

function progress(status: DownloadStatus) {
  if (status.totalBytes <= 0) return undefined
  return Math.min(100, Math.round(status.receivedBytes * 100 / status.totalBytes))
}

export function DownloadToast() {
  const [status, setStatus] = useState<DownloadStatus>()

  useEffect(() => window.coreDesk?.downloads.onStatusChanged(setStatus), [])

  useEffect(() => {
    if (!status || status.state === 'preparing' || status.state === 'progressing') return
    const timer = window.setTimeout(() => setStatus((current) => current?.id === status.id ? undefined : current), 5000)
    return () => window.clearTimeout(timer)
  }, [status])

  if (!status) return null
  const percentage = progress(status)
  const Icon = status.state === 'completed'
    ? CheckCircle2
    : status.state === 'failed'
      ? AlertTriangle
      : status.state === 'cancelled'
        ? XCircle
        : Download

  return (
    <div role="status" aria-live="polite" className="pointer-events-none fixed bottom-4 right-4 z-[300] w-[min(22rem,calc(100vw-2rem))] rounded-lg border border-core-line bg-core-raised p-3 text-core-text shadow-2xl">
      <div className="flex min-w-0 items-start gap-2.5">
        <Icon aria-hidden="true" size={18} className="mt-0.5 shrink-0 text-core-accent" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold">{labels[status.state]}</p>
          <p className="mt-0.5 truncate text-[11px] text-core-muted" title={status.fileName}>{status.fileName}</p>
          {status.message && <p className="mt-1 text-[10px] text-core-muted">{status.message}</p>}
          {status.state === 'progressing' && percentage !== undefined && (
            <div className="mt-2 h-1 overflow-hidden rounded-full bg-core-canvas" aria-label={`${percentage}% concluído`}>
              <div className="h-full rounded-full bg-core-accent transition-[width]" style={{ width: `${percentage}%` }} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
