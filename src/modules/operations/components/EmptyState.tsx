import { ChevronRight } from 'lucide-react'
export function EmptyState({ text, action }: { text: string; action?: React.ReactNode }) { return <div className="flex min-h-32 items-center justify-center gap-2 p-6 text-xs text-slate-500"><ChevronRight size={14} />{text}{action}</div> }
