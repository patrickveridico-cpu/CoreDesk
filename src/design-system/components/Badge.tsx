import type { HTMLAttributes } from 'react'

export function Badge({ className = '', ...props }: HTMLAttributes<HTMLSpanElement>) {
  return <span className={`ds-badge ${className}`.trim()} {...props} />
}
