import { getTranslations, setRequestLocale } from 'next-intl/server'
import { Plus } from 'lucide-react'

import { Link, redirect } from '@/i18n/navigation'
import { buttonStyles } from '@/components/ui/button'
import { LinkList, type ListItem } from '@/components/qr/link-list'
import { QrTabs } from '@/components/qr/qr-nav'
import { KpiRow } from '@/components/qr/kpi'
import { getQrPermissions, myCampaigns, myLinks } from '@/lib/qr/server'
import { qrOrigin, shortLink } from '@/lib/qr/origin'
import { hostOf } from '@/lib/qr/target'

export const dynamic = 'force-dynamic'

/**
 * «الباركودات المفردة»: ما لا حملة له فقط — ما في الحملات موضعه غرفتها.
 * باركود شُورك معك وحده وحملته لم تُشارَك يظهر هنا، وإلا لما وجدته.
 * مؤشّرات الرأس تحسب الكل.
 */
export default async function QrSinglesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)

  const perms = await getQrPermissions()
  if (!perms.use) {
    redirect({ href: '/qr/oversight', locale })
  }

  const [t, links, campaigns] = await Promise.all([getTranslations('qr'), myLinks(), myCampaigns()])
  const visibleCampaigns = new Set(campaigns.map((c) => c.id))
  const singles = links.filter((l) => !l.campaign_id || !visibleCampaigns.has(l.campaign_id))

  const items: ListItem[] = singles.map((l) => ({
    id: l.id,
    code: l.code,
    title: l.title,
    kind: l.kind,
    target: l.target_url,
    host: hostOf(l.target_url),
    active: l.active,
    scans: l.scan_count,
    access: l.access,
    shortLink: shortLink(l.code),
  }))

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{t('heading')}</h1>
          <p className="mt-1 text-sm text-[var(--fg-muted)]">{t('subheading')}</p>
        </div>
        <Link href="/qr/new" className={buttonStyles('primary', 'md')}>
          <Plus className="size-4" aria-hidden />
          {t('common.create')}
        </Link>
      </header>

      <KpiRow
        items={[
          { label: t('kpi.links'), value: links.length },
          { label: t('kpi.scans'), value: links.reduce((sum, l) => sum + l.scan_count, 0) },
        ]}
      />

      <QrTabs current="singles" labels={{ singles: t('nav.singles'), campaigns: t('nav.campaigns') }} />

      <LinkList
        items={items}
        campaigns={campaigns.filter((c) => c.access === 'owner').map((c) => ({ id: c.id, name: c.name }))}
        origin={qrOrigin()}
      />
    </div>
  )
}
