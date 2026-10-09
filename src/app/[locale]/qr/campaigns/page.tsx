import { getTranslations, setRequestLocale } from 'next-intl/server'
import { FolderKanban } from 'lucide-react'

import { Link, redirect } from '@/i18n/navigation'
import { Badge } from '@/components/ui/badge'
import { CampaignCreate } from '@/components/qr/campaign-forms'
import { KpiRow } from '@/components/qr/kpi'
import { QrTabs } from '@/components/qr/qr-nav'
import { getQrPermissions, myCampaigns, myLinks } from '@/lib/qr/server'

export const dynamic = 'force-dynamic'

export default async function QrCampaignsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)

  const perms = await getQrPermissions()
  if (!perms.use) redirect({ href: '/qr/oversight', locale })

  const [t, campaigns, links] = await Promise.all([getTranslations('qr'), myCampaigns(), myLinks()])

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{t('campaigns.title')}</h1>
          <p className="mt-1 text-sm text-[var(--fg-muted)]">{t('campaigns.lead')}</p>
        </div>
      </header>

      <KpiRow
        items={[
          { label: t('kpi.links'), value: links.length },
          { label: t('kpi.scans'), value: links.reduce((sum, l) => sum + l.scan_count, 0) },
        ]}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <QrTabs current="campaigns" labels={{ singles: t('nav.singles'), campaigns: t('nav.campaigns') }} />
        <CampaignCreate locale={locale} />
      </div>

      {campaigns.length === 0 ? (
        <p className="rounded-2xl bg-[var(--surface)] px-6 py-14 text-center text-sm text-[var(--fg-muted)] ring-1 ring-[var(--border)]">
          {t('campaigns.empty')}
        </p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {campaigns.map((c) => (
            <li key={c.id}>
              <Link
                href={`/qr/campaigns/${c.id}`}
                className="flex h-full flex-col rounded-2xl bg-[var(--surface)] p-5 ring-1 ring-[var(--border)] transition-shadow hover:shadow-[var(--shadow-soft)]"
              >
                <div className="flex items-start justify-between gap-2">
                  <FolderKanban className="size-5 text-[var(--primary)]" aria-hidden />
                  {c.access === 'edit' ? <Badge tone="teal">{t('common.accessEdit')}</Badge> : null}
                  {c.access === 'read' ? <Badge>{t('common.accessRead')}</Badge> : null}
                </div>
                <p className="mt-3 font-medium">{c.name}</p>
                {c.note ? <p className="mt-1 line-clamp-2 text-sm text-[var(--fg-muted)]">{c.note}</p> : null}
                <div className="mt-auto flex items-center justify-between gap-2 pt-4 text-sm text-[var(--fg-muted)]">
                  <span>{t('campaigns.links', { count: c.links })}</span>
                  <span className="font-latin tabular-nums">{t('common.scans', { count: Number(c.scans) })}</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
