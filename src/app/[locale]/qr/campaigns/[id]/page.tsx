import { getTranslations, setRequestLocale } from 'next-intl/server'
import { Plus } from 'lucide-react'

import { Link } from '@/i18n/navigation'
import { Badge } from '@/components/ui/badge'
import { buttonStyles } from '@/components/ui/button'
import { AddToCampaign, CampaignOwnerBar, CampaignRoomList, type RoomRow } from '@/components/qr/campaign-forms'
import { KpiRow } from '@/components/qr/kpi'
import { SharePanel } from '@/components/qr/schedule-share'
import { campaignLinks, campaignShares, getCampaign, myCampaigns, myLinks, people, shareCandidates } from '@/lib/qr/server'
import { shortLink } from '@/lib/qr/origin'
import { hostOf } from '@/lib/qr/target'

export const dynamic = 'force-dynamic'

/**
 * غرفة الحملة: مجموع المسحات، وعدد الباركودات، والأنشط، ثم الباركودات
 * مرتّبة بالمسحات مع نصيب كلٍّ. المجاميع تُحسب هنا ولا تُخزَّن.
 */
export default async function QrCampaignRoom({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params
  setRequestLocale(locale)

  const [t, found] = await Promise.all([getTranslations('qr'), getCampaign(id)])
  if (!found) {
    return (
      <p className="rounded-xl bg-[var(--surface)] p-8 text-center text-[var(--fg-muted)] ring-1 ring-[var(--border)]">
        {t('campaignNotFound')}
      </p>
    )
  }

  const { campaign, access } = found
  const isOwner = access === 'owner'

  const [links, shares, candidates, campaigns, mine] = await Promise.all([
    campaignLinks(id),
    isOwner ? campaignShares(id) : Promise.resolve([]),
    isOwner ? shareCandidates() : Promise.resolve([]),
    isOwner ? myCampaigns() : Promise.resolve([]),
    isOwner ? myLinks() : Promise.resolve([]),
  ])
  const names = await people(shares.map((s) => s.user_id))

  const total = links.reduce((sum, l) => sum + l.scan_count, 0)
  const top = links.length > 0 && links[0]!.scan_count > 0 ? links[0]! : null
  const rows: RoomRow[] = links.map((l) => ({
    id: l.id,
    title: l.title,
    scans: l.scan_count,
    // لا نصيب لحملة فارغة: صفر من صفر ليس صفرًا بالمئة
    share: total > 0 ? Math.round((l.scan_count / total) * 1000) / 10 : null,
    active: l.active,
    kind: l.kind,
    host: hostOf(l.target_url),
    shortLink: shortLink(l.code),
  }))
  const singles = mine
    .filter((l) => l.access === 'owner' && !l.campaign_id)
    .map((l) => ({ id: l.id, title: l.title }))
  const otherCampaigns = campaigns.filter((c) => c.access === 'owner' && c.id !== id).map((c) => ({ id: c.id, name: c.name }))

  return (
    <div className="space-y-6">
      <header className="space-y-3">
        <Link href="/qr/campaigns" className="text-sm text-[var(--fg-subtle)] hover:text-[var(--fg)]">
          ← {t('campaigns.title')}
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold">{campaign.name}</h1>
          {access === 'edit' ? <Badge tone="teal">{t('common.accessEdit')}</Badge> : null}
          {access === 'read' ? <Badge>{t('common.accessRead')}</Badge> : null}
        </div>
        {campaign.note ? <p className="text-sm text-[var(--fg-muted)]">{campaign.note}</p> : null}
        {isOwner ? <CampaignOwnerBar id={id} name={campaign.name} note={campaign.note} locale={locale} /> : null}
      </header>

      <KpiRow
        items={[
          { label: t('campaigns.total'), value: total },
          { label: t('campaigns.count'), value: links.length },
          { label: t('campaigns.top'), value: top ? top.scan_count : '—', hint: top ? top.title : t('campaigns.topNone') },
        ]}
      />

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-semibold">{t('campaigns.room')}</h2>
          {isOwner ? (
            <div className="flex flex-wrap gap-2">
              <AddToCampaign campaignId={id} singles={singles} />
              <Link href={`/qr/new?campaign=${id}`} className={buttonStyles('primary', 'sm')}>
                <Plus className="size-4" aria-hidden />
                {t('campaigns.createInside')}
              </Link>
            </div>
          ) : null}
        </div>
        <CampaignRoomList rows={rows} otherCampaigns={otherCampaigns} canManage={isOwner} labels={{ empty: t('campaigns.emptyRoom') }} />
      </section>

      {isOwner ? (
        <section className="rounded-2xl bg-[var(--surface)] p-5 ring-1 ring-[var(--border)] sm:p-6">
          <h2 className="text-base font-semibold">{t('share.title')}</h2>
          <div className="mt-3">
            <SharePanel
              target={{ kind: 'campaign', id }}
              rows={shares.map((s) => ({ userId: s.user_id, name: names.get(s.user_id) ?? '—', access: s.access }))}
              candidates={candidates}
              lead={t('share.campaignLead')}
            />
          </div>
        </section>
      ) : null}
    </div>
  )
}
