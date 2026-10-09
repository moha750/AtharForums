import { cn } from '@/lib/utils'

/** عنوان الإنشاء بخطوتيه: الاسم والوجهة ← التصميم. */
export function StepHeader({
  title,
  subtitle,
  steps,
  current,
}: {
  title: string
  subtitle?: string
  steps: string[]
  current: number
}) {
  return (
    <header className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-[var(--fg-muted)]">{subtitle}</p> : null}
      </div>
      <ol className="flex flex-wrap items-center gap-2 text-sm">
        {steps.map((step, index) => (
          <li key={step} className="flex items-center gap-2">
            <span
              className={cn(
                'font-latin grid size-6 place-items-center rounded-full text-xs font-semibold',
                index <= current
                  ? 'bg-[var(--primary)] text-[var(--primary-fg)]'
                  : 'bg-[var(--bg-subtle)] text-[var(--fg-subtle)] ring-1 ring-[var(--border)]'
              )}
            >
              {index + 1}
            </span>
            <span className={index === current ? 'font-medium' : 'text-[var(--fg-muted)]'}>{step}</span>
            {index < steps.length - 1 ? <span className="mx-1 h-px w-6 bg-[var(--border-strong)]" aria-hidden /> : null}
          </li>
        ))}
      </ol>
    </header>
  )
}
