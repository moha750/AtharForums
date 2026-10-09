'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'

import { Link, usePathname, useRouter } from '@/i18n/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/field'
import { STATS_RANGES, type StatsRangeKey } from '@/lib/qr/time'
import { cn } from '@/lib/utils'

/** مصفّي المدّة — في العنوان، فيُشارَك ويُحفظ. المخصّص طرفاه داخلان. */
export function RangeFilter({
  current,
  from,
  to,
}: {
  current: StatsRangeKey
  from: string | null
  to: string | null
}) {
  const t = useTranslations('qr.stats')
  const pathname = usePathname()
  const router = useRouter()
  const [open, setOpen] = useState(current === 'custom')
  const [start, setStart] = useState(current === 'custom' ? (from ?? '') : '')
  const [end, setEnd] = useState(current === 'custom' ? (to ?? '') : '')

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5" role="group" aria-label={t('range')}>
        {[...STATS_RANGES].map((key) => (
          <Link
            key={key}
            href={key === 'all' ? pathname : `${pathname}?range=${key}`}
            aria-current={current === key ? 'true' : undefined}
            className={cn(
              'rounded-full px-3 py-1.5 text-xs font-medium ring-1 ring-inset transition-colors',
              current === key
                ? 'bg-[var(--primary)] text-[var(--primary-fg)] ring-transparent'
                : 'bg-[var(--surface)] text-[var(--fg-muted)] ring-[var(--border-strong)] hover:text-[var(--fg)]'
            )}
          >
            {t(key)}
          </Link>
        ))}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className={cn(
            'rounded-full px-3 py-1.5 text-xs font-medium ring-1 ring-inset transition-colors',
            current === 'custom'
              ? 'bg-[var(--primary)] text-[var(--primary-fg)] ring-transparent'
              : 'bg-[var(--surface)] text-[var(--fg-muted)] ring-[var(--border-strong)] hover:text-[var(--fg)]'
          )}
        >
          {t('custom')}
        </button>
      </div>
      {open ? (
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            const params = new URLSearchParams({ range: 'custom' })
            if (start) params.set('from', start)
            if (end) params.set('to', end)
            router.push(`${pathname}?${params.toString()}`)
          }}
        >
          <label className="space-y-1 text-xs text-[var(--fg-muted)]">
            <span>{t('from')}</span>
            <Input type="date" dir="ltr" value={start} onChange={(e) => setStart(e.target.value)} className="h-10 w-40" />
          </label>
          <label className="space-y-1 text-xs text-[var(--fg-muted)]">
            <span>{t('to')}</span>
            <Input type="date" dir="ltr" value={end} onChange={(e) => setEnd(e.target.value)} className="h-10 w-40" />
          </label>
          <Button type="submit" size="sm" disabled={!start && !end}>
            {t('apply')}
          </Button>
        </form>
      ) : null}
    </div>
  )
}
