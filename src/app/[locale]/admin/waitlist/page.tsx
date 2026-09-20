import { Download } from 'lucide-react'
import { getTranslations } from 'next-intl/server'

import { buttonStyles } from '@/components/ui/button'
import { adminWaitlist } from '@/lib/admin-data'
import { formatDate } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export default async function AdminWaitlistPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  const [t, rows] = await Promise.all([getTranslations('admin'), adminWaitlist()])

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">
          {t('navWaitlist')}{' '}
          <span className="font-latin text-[var(--fg-subtle)]">({rows.length})</span>
        </h1>
        {rows.length > 0 ? (
          <a href="/api/admin/waitlist.csv" className={buttonStyles('secondary', 'sm')} download>
            <Download className="size-4" aria-hidden />
            {t('exportCsv')}
          </a>
        ) : null}
      </div>

      {rows.length === 0 ? (
        <p className="mt-6 rounded-xl bg-[var(--surface)] px-4 py-10 text-center text-sm text-[var(--fg-subtle)] ring-1 ring-[var(--border)]">
          {t('waitlistEmpty')}
        </p>
      ) : (
        <div className="mt-6 overflow-hidden rounded-2xl ring-1 ring-[var(--border)]">
          <table className="w-full bg-[var(--surface)] text-sm">
            <thead className="bg-[var(--bg-subtle)] text-start text-xs text-[var(--fg-subtle)]">
              <tr>
                <th className="px-4 py-3 text-start font-medium">#</th>
                <th className="px-4 py-3 text-start font-medium">Email</th>
                <th className="px-4 py-3 text-start font-medium">Name</th>
                <th className="px-4 py-3 text-start font-medium">Date</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={row.id} className="border-t border-[var(--border)]">
                  <td className="font-latin px-4 py-3 text-[var(--fg-subtle)]">{i + 1}</td>
                  <td className="font-latin px-4 py-3" dir="ltr">
                    {row.email}
                  </td>
                  <td className="px-4 py-3">{row.full_name ?? '—'}</td>
                  <td className="px-4 py-3 text-[var(--fg-subtle)]">
                    {formatDate(row.created_at, locale)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
