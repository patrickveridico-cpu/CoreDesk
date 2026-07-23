import type { HTMLAttributes } from 'react'

export interface SurfaceProps extends HTMLAttributes<HTMLDivElement> {
  elevation?: 'base' | 'raised'
}

export function Surface({ elevation = 'base', className = '', ...props }: SurfaceProps) {
  return <div data-elevation={elevation} className={`ds-surface ${className}`.trim()} {...props} />
}

export const Card = Surface
