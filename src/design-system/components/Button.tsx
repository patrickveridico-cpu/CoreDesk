import { forwardRef, type ButtonHTMLAttributes } from 'react'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', className = '', type = 'button', ...props },
  ref,
) {
  return <button ref={ref} type={type} data-variant={variant} className={`ds-button ds-focus-ring ${className}`.trim()} {...props} />
})
