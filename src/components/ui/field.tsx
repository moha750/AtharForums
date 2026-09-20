import * as React from 'react'
import { cn } from '@/lib/utils'

const fieldBase =
  'w-full rounded-lg bg-[var(--surface)] px-3.5 text-[0.95rem] text-[var(--fg)] ring-1 ring-inset ring-[var(--border-strong)] transition-shadow placeholder:text-[var(--fg-subtle)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)] disabled:opacity-60'

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return <input ref={ref} className={cn(fieldBase, 'h-11', className)} {...props} />
  }
)

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, ...props }, ref) {
  return <textarea ref={ref} className={cn(fieldBase, 'min-h-28 py-2.5', className)} {...props} />
})

export function Label({
  className,
  children,
  hint,
  ...props
}: React.LabelHTMLAttributes<HTMLLabelElement> & { hint?: string }) {
  return (
    <label className={cn('flex flex-col gap-1.5', className)} {...props}>
      <span className="text-sm font-medium text-[var(--fg)]">
        {children}
        {hint ? (
          <span className="ms-1.5 font-normal text-[var(--fg-subtle)]">{hint}</span>
        ) : null}
      </span>
    </label>
  )
}

export function FieldError({ children }: { children: React.ReactNode }) {
  if (!children) return null
  return (
    <p role="alert" className="text-sm text-[var(--danger)]">
      {children}
    </p>
  )
}
