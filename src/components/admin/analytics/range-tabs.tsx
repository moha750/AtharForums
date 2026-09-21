'use client'

import { Link, usePathname } from '@/i18n/navigation'
import { useSearchParams } from 'next/navigation'
import { cn } from '@/lib/utils'

/** اختيار المدى الزمني. روابط لا أزرار: المدى يبقى في الرابط فيُشارَك ويُحفظ. */
export function RangeTabs({
  options,
  current,
}: {
  options: Array<{ value: string; label: string }>
  current: string
}) {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  return (
    <div
      className="inline-flex rounded-xl bg-[var(--bg-subtle)] p-1 ring-1 ring-[var(--border)]"
      role="group"
    >
      {options.map((option) => {
        const params = new URLSearchParams(searchParams.toString())
        params.set('range', option.value)

        return (
          <Link
            key={option.value}
            href={`${pathname}?${params.toString()}`}
            aria-current={option.value === current ? 'true' : undefined}
            className={cn(
              'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
              option.value === current
                ? 'bg-[var(--surface)] text-[var(--fg)] shadow-[var(--shadow-soft)]'
                : 'text-[var(--fg-muted)] hover:text-[var(--fg)]'
            )}
          >
            {option.label}
          </Link>
        )
      })}
    </div>
  )
}
