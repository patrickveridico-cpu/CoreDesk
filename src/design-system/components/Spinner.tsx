import type { HTMLAttributes } from 'react'

export interface SpinnerProps extends HTMLAttributes<HTMLSpanElement> {
  label?: string
}

export function Spinner({ label = 'Carregando', className = '', ...props }: SpinnerProps) {
  return <span role="status" aria-label={label} className={`ds-spinner ${className}`.trim()} {...props} />
}
