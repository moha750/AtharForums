import * as React from 'react'
import { cn } from '@/lib/utils'

type Variant = 'primary' | 'secondary' | 'ghost' | 'accent' | 'danger'
type Size = 'sm' | 'md' | 'lg'

const base =
  'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-[background-color,color,box-shadow,transform] duration-150 ease-[var(--ease-out-soft)] disabled:pointer-events-none disabled:opacity-55 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)] active:translate-y-px whitespace-nowrap'

const variants: Record<Variant, string> = {
  primary:
    'bg-[var(--primary)] text-[var(--primary-fg)] hover:bg-[var(--primary-hover)] shadow-[0_1px_2px_rgb(2_101_113/0.16)]',
  secondary:
    'bg-[var(--surface)] text-[var(--fg)] ring-1 ring-inset ring-[var(--border-strong)] hover:bg-[var(--bg-subtle)]',
  ghost: 'text-[var(--fg-muted)] hover:bg-[var(--bg-subtle)] hover:text-[var(--fg)]',
  accent: 'bg-[var(--accent)] text-[var(--accent-fg)] hover:brightness-95',
  danger: 'bg-[var(--danger)] text-white hover:brightness-95',
}

const sizes: Record<Size, string> = {
  sm: 'h-9 px-3 text-sm',
  md: 'h-11 px-5 text-[0.95rem]',
  lg: 'h-13 px-7 text-base',
}

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = 'primary', size = 'md', type = 'button', ...props },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(base, variants[variant], sizes[size], className)}
      {...props}
    />
  )
})

export const buttonStyles = (variant: Variant = 'primary', size: Size = 'md', className?: string) =>
  cn(base, variants[variant], sizes[size], className)
