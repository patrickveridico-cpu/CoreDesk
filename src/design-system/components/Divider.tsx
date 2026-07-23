import type { HTMLAttributes } from 'react'

export interface DividerProps extends HTMLAttributes<HTMLHRElement> {
  orientation?: 'horizontal' | 'vertical'
}

export function Divider({ orientation = 'horizontal', className = '', ...props }: DividerProps) {
  return <hr aria-orientation={orientation} data-orientation={orientation} className={`ds-divider ${className}`.trim()} {...props} />
}
