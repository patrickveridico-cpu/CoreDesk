import { forwardRef, type ButtonHTMLAttributes } from 'react'

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, className = '', title, type = 'button', ...props },
  ref,
) {
  return <button ref={ref} type={type} aria-label={label} title={title ?? label} className={`ds-icon-button ds-focus-ring ${className}`.trim()} {...props} />
})
