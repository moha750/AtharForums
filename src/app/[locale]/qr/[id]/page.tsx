import { getTranslations, setRequestLocale } from 'next-intl/server'
import { BarChart3, Paintbrush } from 'lucide-react'

import { Link } from '@/i18n/navigation'
import { Badge } from '@/components/ui/badge'
import { buttonStyles } from '@/components/ui/button'
import { EventLog } from '@/components/qr/event-log'
import { StoredQrCard } from '@/components/qr/qr-preview'
import { SchedulePanel, SharePanel, type ScheduleRow } from '@/components/qr/schedule-share'
import {
  CampaignSelect,
  DangerZone,
  DestinationPanel,
  OverseerActions,
  StatusControl,
  TitleForm,
} from '@/components/qr/settings-panels'
import { CopyButton, ShortLink } from '@/components/qr/ui'
import { env } from '@/lib/env'
import { FILE_BUCKET } from '@/lib/qr/config'
import { fileKindOf } from '@/lib/qr/file-path'
import { qrOrigin, shortLink } from '@/lib/qr/origin'
import {
  generatorHolders,
  getLink,
  getQrPermissions,
  linkEvents,
  linkSchedules,
  linkShares,
  myCampaigns,
  people,
  shareCandidates,
} from '@/lib/qr/server'
import { utcToZonedInput } from '@/lib/qr/time'
import { formatDateTime } from '@/lib/utils'
import type { QrSchedule } from '@/lib/database.types'

export const dynamic = 'force-dynamic'

function Section({ id, title, lead, children }: { id?: string; title: string; lead?: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-8 rounded-2xl bg-[var(--surface)] p-5 ring-1 ring-[var(--border)] sm:p-6">
      <h2 className="text-base font-semibold">{title}</h2>
      {lead ? <p className="mt-1 text-sm text-[var(--fg-muted)]">{lead}</p> : null}
      <div className="mt-4">{children}</div>
    </section>
  )
}

export default async function QrSettingsPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params
  setRequestLocale(locale)

  const [t, found, perms] = await Promise.all([getTranslations('qr'), getLink(id), getQrPermissions()])
  if (!found) {
    return (
      <p className="rounded-xl bg-[var(--surface)] p-8 text-center text-[var(--fg-muted)] ring-1 ring-[var(--border)]">
        {t('notFound')}
      </p>
    )
  }

  const { link, access } = found
  const isOwner = access === 'owner'
  const canEdit = isOwner || access === 'edit'
  const canSeeLog = isOwner || perms.oversee
  const short = shortLink(link.code)
  const storedText = (link.spec as { text?: string } | null)?.text ?? short

  const [schedules, shares, events, campaigns, candidates, holders] = await Promise.all([
    linkSchedules(id),
    isOwner ? linkShares(id) : Promise.resolve([]),
    canSeeLog ? linkEvents(id) : Promise.resolve([]),
    isOwner ? myCampaigns() : Promise.resolve([]),
    isOwner ? shareCandidates() : Promise.resolve([]),
    perms.oversee ? generatorHolders() : Promise.resolve([]),
  ])

  const names = await people([
    link.owner_id,
    ...shares.map((s) => s.user_id),
    ...events.map((e) => e.actor_id),
    ...events.filter((e) => e.kind === 'owner').flatMap((e) => [e.old_value, e.new_value]),
  ])

  const scheduleRows = toScheduleRows(schedules, locale)

  const fileUrl = link.file_path
    ? `${env.supabaseUrl}/storage/v1/object/public/${FILE_BUCKET}/${link.file_path}`
    : null
  const ownCampaigns = campaigns.filter((c) => c.access === 'owner').map((c) => ({ id: c.id, name: c.name }))
  const accessBadge =
    access === 'edit' ? t('common.accessEdit') : access === 'read' ? t('common.accessRead') : access === 'oversee' ? t('common.accessOversee') : null

  return (
    <div className="space-y-6">
      <header className="space-y-3">
        {/* المشرف بلا مشاركة يرجع إلى شاشته، وغيره إلى قائمته */}
        <Link href={access === 'oversee' ? '/qr/oversight' : '/qr'} className="text-sm text-[var(--fg-subtle)] hover:text-[var(--fg)]">
          ← {access === 'oversee' ? t('nav.oversight') : t('nav.singles')}
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold">{link.title}</h1>
          <Badge tone={link.active ? 'success' : 'warning'}>{link.active ? t('common.active') : t('common.paused')}</Badge>
          {accessBadge ? <Badge tone={access === 'edit' ? 'teal' : 'neutral'}>{accessBadge}</Badge> : null}
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <span className="inline-flex items-center gap-1.5 text-[var(--fg-muted)]">
            <span className="text-sm">{t('settings.shortLink')}:</span>
            <ShortLink href={short} />
            <CopyButton value={short} />
          </span>
          <span className="font-latin text-sm tabular-nums text-[var(--fg-muted)]">
            {t('common.scans', { count: link.scan_count })}
          </span>
          {perms.oversee && !isOwner ? (
            <span className="text-sm text-[var(--fg-muted)]">
              {t('common.owner')}: <span className="font-medium text-[var(--fg)]">{names.get(link.owner_id) ?? t('common.deletedAccount')}</span>
            </span>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/qr/${id}/stats`} className={buttonStyles('secondary', 'sm')}>
            <BarChart3 className="size-4" aria-hidden />
            {t('common.stats')}
          </Link>
          {canEdit ? (
            <Link href={`/qr/${id}/design`} className={buttonStyles('secondary', 'sm')}>
              <Paintbrush className="size-4" aria-hidden />
              {t('settings.editDesign')}
            </Link>
          ) : null}
        </div>
        {access === 'read' ? <p className="text-sm text-[var(--fg-muted)]">{t('settings.readOnlyNote')}</p> : null}
        {access === 'oversee' ? <p className="text-sm text-[var(--fg-muted)]">{t('settings.overseeNote')}</p> : null}
      </header>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-6">
          <Section id="destination" title={t('settings.destination')} lead={canEdit ? t('settings.destinationLead') : undefined}>
            <DestinationPanel
              linkId={id}
              kind={link.kind}
              target={link.target_url}
              fileUrl={fileUrl}
              fileKind={link.file_path ? fileKindOf(link.file_path) : null}
              origin={qrOrigin()}
              canEdit={canEdit}
            />
          </Section>

          <Section title={t('schedule.title')} lead={t('schedule.lead')}>
            <SchedulePanel linkId={id} rows={scheduleRows} canEdit={canEdit} origin={qrOrigin()} />
          </Section>

          {canEdit ? (
            <Section title={t('settings.titleSection')}>
              <TitleForm linkId={id} title={link.title} />
            </Section>
          ) : null}

          {canEdit ? (
            <Section title={t('settings.statusSection')}>
              <StatusControl linkId={id} title={link.title} active={link.active} />
            </Section>
          ) : null}

          {isOwner ? (
            <Section title={t('settings.campaignSection')} lead={t('settings.campaignLead')}>
              <CampaignSelect linkId={id} current={link.campaign_id} campaigns={ownCampaigns} />
            </Section>
          ) : null}

          {isOwner ? (
            <Section id="share" title={t('share.title')}>
              <SharePanel
                target={{ kind: 'link', id }}
                rows={shares.map((s) => ({ userId: s.user_id, name: names.get(s.user_id) ?? '—', access: s.access }))}
                candidates={candidates}
                lead={t('share.lead')}
              />
            </Section>
          ) : null}

          {canSeeLog ? (
            <Section title={t('settings.events')}>
              <EventLog events={events} names={names} locale={locale} emptyLabel={t('settings.eventsEmpty')} />
            </Section>
          ) : null}

          {perms.oversee && !isOwner ? (
            <Section title={t('oversight.title')}>
              <OverseerActions
                linkId={id}
                title={link.title}
                active={link.active}
                holders={holders}
                ownerId={link.owner_id}
                locale={locale}
                afterDelete="/qr/oversight"
              />
            </Section>
          ) : null}

          {isOwner ? (
            <section className="rounded-2xl p-5 ring-1 ring-[var(--danger)]/40 sm:p-6">
              <h2 className="text-base font-semibold text-[var(--danger)]">{t('settings.dangerZone')}</h2>
              <p className="mt-1 text-sm text-[var(--fg-muted)]">{t('settings.dangerLead')}</p>
              <div className="mt-4">
                <DangerZone linkId={id} title={link.title} locale={locale} />
              </div>
            </section>
          ) : null}
        </div>

        <aside className="space-y-4 xl:sticky xl:top-8 xl:self-start">
          <div className="rounded-2xl bg-[var(--surface)] p-5 ring-1 ring-[var(--border)]">
            <h2 className="sr-only">{t('settings.preview')}</h2>
            <StoredQrCard raw={link.spec} text={storedText} title={link.title} label={t('design.previewLabel')} />
            <dl className="mt-4 space-y-1 text-xs text-[var(--fg-subtle)]">
              <div className="flex justify-between gap-2">
                <dt>{t('settings.created')}</dt>
                <dd>{formatDateTime(link.created_at, locale)}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt>{t('settings.updated')}</dt>
                <dd>{formatDateTime(link.updated_at, locale)}</dd>
              </div>
            </dl>
          </div>
        </aside>
      </div>
    </div>
  )
}

/**
 * التواريخ تُنسَّق على الخادم: نصّ واحد للخادم والمتصفّح فلا ينكسر الترطيب.
 * والحالة (جارية/قادمة/انتهت) بساعة الخادم لحظة العرض.
 */
function toScheduleRows(schedules: QrSchedule[], locale: string): ScheduleRow[] {
  const now = Date.now()
  return schedules.map((s) => {
    const starts = s.starts_at ? new Date(s.starts_at).getTime() : -Infinity
    const ends = s.ends_at ? new Date(s.ends_at).getTime() : Infinity
    return {
      id: s.id,
      target: s.target_url,
      startsLocal: utcToZonedInput(s.starts_at),
      endsLocal: utcToZonedInput(s.ends_at),
      startsLabel: s.starts_at ? formatDateTime(s.starts_at, locale) : null,
      endsLabel: s.ends_at ? formatDateTime(s.ends_at, locale) : null,
      note: s.note,
      state: now < starts ? 'upcoming' : now >= ends ? 'ended' : 'live',
    }
  })
}
