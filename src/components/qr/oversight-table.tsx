'use client'

import { useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { ExternalLink, Search } from 'lucide-react'

import { Link } from '@/i18n/navigation'
import { Badge } from '@/components/ui/badge'
import { buttonStyles } from '@/components/ui/button'
import { Input } from '@/components/ui/field'
import { OverseerActions } from './settings-panels'
import { Segmented } from './ui'

export type OverseeRow = {
  id: string
  code: string
  title: string
  kind: 'link' | 'file'
  host: string
  active: boolean
  scans: number
  ownerId: string
  ownerName: string
}

/** كل الباركودات مع المالك ومضيف الوجهة والحالة والمسحات. */
export function OversightTable({
  rows,
  holders,
  locale,
}: {
  rows: OverseeRow[]
  holders: Array<{ id: string; name: string }>
  locale: string
}) {
  const t = useTranslations('qr')
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<'all' | 'active' | 'paused'>('all')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return rows.filter((r) => {
      if (status === 'active' && !r.active) return false
      if (status === 'paused' && r.active) return false
      return !q || [r.title, r.code, r.host, r.ownerName].some((v) => v.toLowerCase().includes(q))
    })
  }, [rows, query, status])

  if (rows.length === 0) {
    return (
      <p className="rounded-2xl bg-[var(--surface)] px-6 py-12 text-center text-sm text-[var(--fg-muted)] ring-1 ring-[var(--border)]">
        {t('oversight.empty')}
      </p>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-0 flex-1 basis-60">
          <Search className="pointer-events-none absolute inset-y-0 start-3 my-auto size-4 text-[var(--fg-subtle)]" aria-hidden />
          <Input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('common.search')} aria-label={t('common.search')} className="ps-9" />
        </div>
        <Segmented
          label={t('oversight.status')}
          value={status}
          onChange={setStatus}
          options={[
            { value: 'all', label: t('common.statusAll') },
            { value: 'active', label: t('common.statusActive') },
            { value: 'paused', label: t('common.statusPaused') },
          ]}
        />
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-xl bg-[var(--surface)] px-4 py-10 text-center text-sm text-[var(--fg-subtle)] ring-1 ring-[var(--border)]">
          {t('common.noMatch')}
        </p>
      ) : (
        <ul className="space-y-3">
          {filtered.map((row) => (
            <li key={row.id} className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-xl bg-[var(--surface)] p-4 ring-1 ring-[var(--border)]">
              <div className="min-w-0 flex-1 basis-64">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{row.title}</span>
                  <Badge tone={row.active ? 'success' : 'warning'}>{row.active ? t('common.active') : t('common.paused')}</Badge>
                </div>
                <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-[var(--fg-muted)]">
                  <span>
                    {t('oversight.owner')}: <span className="text-[var(--fg)]">{row.ownerName}</span>
                  </span>
                  <bdi dir="ltr" className="font-latin">/q/{row.code}</bdi>
                  <bdi className="font-latin">{row.kind === 'file' ? t('common.file') : row.host}</bdi>
                </p>
              </div>
              <span className="font-latin text-sm tabular-nums text-[var(--fg-muted)]">{t('common.scans', { count: row.scans })}</span>
              <Link href={`/qr/${row.id}`} className={buttonStyles('ghost', 'sm')}>
                <ExternalLink className="size-4" aria-hidden />
                {t('oversight.open')}
              </Link>
              <OverseerActions
                linkId={row.id}
                title={row.title}
                active={row.active}
                holders={holders}
                ownerId={row.ownerId}
                locale={locale}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
