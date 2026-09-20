import { cn } from '@/lib/utils'

type Tone = 'neutral' | 'teal' | 'sage' | 'ember' | 'success' | 'warning' | 'danger'

const tones: Record<Tone, string> = {
  neutral: 'bg-[var(--bg-subtle)] text-[var(--fg-muted)] ring-[var(--border)]',
  teal: 'bg-teal-50 text-teal-800 ring-teal-200 dark:bg-teal-950 dark:text-teal-200 dark:ring-teal-800',
  sage: 'bg-sage-50 text-sage-800 ring-sage-200 dark:bg-sage-950 dark:text-sage-200 dark:ring-sage-800',
  ember:
    'bg-ember-50 text-ember-800 ring-ember-200 dark:bg-ember-950 dark:text-ember-200 dark:ring-ember-800',
  success: 'bg-[var(--success-soft)] text-[var(--success)] ring-transparent',
  warning: 'bg-[var(--warning-soft)] text-[var(--warning)] ring-transparent',
  danger: 'bg-[var(--danger-soft)] text-[var(--danger)] ring-transparent',
}

export function Badge({
  children,
  tone = 'neutral',
  className,
}: {
  children: React.ReactNode
  tone?: Tone
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset',
        tones[tone],
        className
      )}
    >
      {children}
    </span>
  )
}
