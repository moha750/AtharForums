import { notFound } from 'next/navigation'
import * as Icons from 'lucide-react'
import { CalendarDays, Lock, Users } from 'lucide-react'
import { getTranslations, setRequestLocale } from 'next-intl/server'

import { SiteShell } from '@/components/site/site-shell'
import { Link } from '@/i18n/navigation'
import { Badge } from '@/components/ui/badge'
import { buttonStyles } from '@/components/ui/button'
import { JoinForm } from '@/components/forums/join-form'
import { getForumBySlug, getForumMembers, getMyMembership, getUpcomingEvents } from '@/lib/data'
import { getCurrentProfile } from '@/lib/auth'
import { requireLaunched } from '@/lib/gate'
import { formatDateTime, localized } from '@/lib/utils'
import { isLocale } from '@/i18n/routing'

export const dynamic = 'force-dynamic'

const ACCENT_CHIP = {
  teal: 'bg-teal-50 text-teal-700 dark:bg-teal-950 dark:text-teal-300',
  sage: 'bg-sage-50 text-sage-700 dark:bg-sage-950 dark:text-sage-300',
  ember: 'bg-ember-50 text-ember-700 dark:bg-ember-950 dark:text-ember-300',
} as const

function ForumIcon({ name, className }: { name: string; className?: string }) {
  const Fallback = Icons.Sparkles
  const Component = (Icons as unknown as Record<string, typeof Fallback>)[name] ?? Fallback
  return <Component className={className} aria-hidden />
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>
}) {
  const { locale, slug } = await params
  if (!isLocale(locale)) return {}
  const forum = await getForumBySlug(slug)
  if (!forum) return {}
  return {
    title: localized(forum, 'name', locale),
    description: localized(forum, 'description', locale).slice(0, 180),
  }
}

export default async function ForumPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>
}) {
  const { locale, slug } = await params
  if (!isLocale(locale)) notFound()
  setRequestLocale(locale)

  const settings = await requireLaunched(locale)
  const forum = await getForumBySlug(slug)
  if (!forum || forum.status !== 'published') notFound()

  const [t, tNav, members, membership, profile, events] = await Promise.all([
    getTranslations('forums'),
    getTranslations('nav'),
    getForumMembers(slug),
    getMyMembership(forum.id),
    getCurrentProfile(),
    getUpcomingEvents(4, forum.id),
  ])

  const chip = ACCENT_CHIP[forum.color] ?? ACCENT_CHIP.teal
  const full = forum.capacity !== null && forum.members_count >= forum.capacity
  const canApply =
    forum.is_accepting &&
    !full &&
    (!membership || membership.status === 'withdrawn' || membership.status === 'rejected')

  const roleLabel = (role: string) =>
    role === 'lead' ? t('roleLead') : role === 'core' ? t('roleCore') : t('roleMember')

  return (
    <SiteShell locale={locale} settings={settings}>
      <div className="container-athar py-12 sm:py-16">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div>
            <div className="flex items-start gap-4">
              <span
                className={`inline-flex size-14 shrink-0 items-center justify-center rounded-2xl ${chip}`}
              >
                <ForumIcon name={forum.icon} className="size-7" />
              </span>
              <div>
                <h1 className="text-3xl font-bold sm:text-4xl">
                  {localized(forum, 'name', locale)}
                </h1>
                {localized(forum, 'tagline', locale) ? (
                  <p className="mt-1.5 text-[var(--primary)]">
                    {localized(forum, 'tagline', locale)}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-2">
              <Badge tone="neutral">
                <Users className="size-3.5" aria-hidden />
                {t('members', { count: forum.members_count })}
              </Badge>
              {full ? (
                <Badge tone="warning">{t('capacityFull')}</Badge>
              ) : forum.is_accepting ? (
                <Badge tone="success">{t('open')}</Badge>
              ) : (
                <Badge tone="neutral">{t('closed')}</Badge>
              )}
            </div>

            {localized(forum, 'description', locale) ? (
              <section className="mt-9" aria-labelledby="about-forum">
                <h2 id="about-forum" className="text-lg font-semibold">
                  {t('aboutHeading')}
                </h2>
                <p className="mt-2.5 whitespace-pre-line leading-relaxed text-[var(--fg-muted)]">
                  {localized(forum, 'description', locale)}
                </p>
              </section>
            ) : null}

            {localized(forum, 'mission', locale) ? (
              <section className="mt-8" aria-labelledby="mission-forum">
                <h2 id="mission-forum" className="text-lg font-semibold">
                  {t('missionHeading')}
                </h2>
                <p className="mt-2.5 whitespace-pre-line leading-relaxed text-[var(--fg-muted)]">
                  {localized(forum, 'mission', locale)}
                </p>
              </section>
            ) : null}

            {forum.skills.length > 0 ? (
              <section className="mt-8" aria-labelledby="skills-forum">
                <h2 id="skills-forum" className="text-lg font-semibold">
                  {t('skillsHeading')}
                </h2>
                <ul className="mt-3 flex flex-wrap gap-2">
                  {forum.skills.map((skill) => (
                    <li key={skill}>
                      <Badge tone="teal">{skill}</Badge>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {events.length > 0 ? (
              <section className="mt-10" aria-labelledby="events-forum">
                <h2 id="events-forum" className="flex items-center gap-2 text-lg font-semibold">
                  <CalendarDays className="size-5 text-[var(--primary)]" aria-hidden />
                  {t('eventsHeading')}
                </h2>
                <div className="mt-3 space-y-3">
                  {events.map((event) => (
                    <Link
                      key={event.id}
                      href={`/events/${event.slug}`}
                      className="block rounded-xl bg-[var(--surface)] p-4 ring-1 ring-[var(--border)] transition-shadow hover:shadow-[var(--shadow-soft)]"
                    >
                      <p className="text-xs text-[var(--fg-subtle)]">
                        {formatDateTime(event.starts_at, locale)}
                      </p>
                      <p className="mt-1 font-medium">{localized(event, 'title', locale)}</p>
                    </Link>
                  ))}
                </div>
              </section>
            ) : null}

            <section className="mt-10" aria-labelledby="members-forum">
              <h2 id="members-forum" className="text-lg font-semibold">
                {t('membersHeading')}
              </h2>
              {members.length === 0 ? (
                <p className="mt-3 rounded-xl bg-[var(--bg-subtle)] px-4 py-5 text-sm text-[var(--fg-subtle)]">
                  {/* دليل الأعضاء لا يُكشف للعموم — أسماء الموظفين ليست محتوى عامًا */}
                  {profile ? t('membersEmpty') : t('membersSignedOut')}
                </p>
              ) : (
                <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                  {members.map((member) => (
                    <li
                      key={member.profile_id}
                      className="flex items-center gap-3 rounded-xl bg-[var(--surface)] p-3 ring-1 ring-[var(--border)]"
                    >
                      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[var(--primary-soft)] text-sm font-semibold text-[var(--primary)]">
                        {(locale === 'en' ? member.full_name_en : member.full_name_ar)?.charAt(0) ??
                          '؟'}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {(locale === 'en' ? member.full_name_en : member.full_name_ar) ?? '—'}
                        </p>
                        <p className="truncate text-xs text-[var(--fg-subtle)]">
                          {member.job_title ?? roleLabel(member.membership_role)}
                        </p>
                      </div>
                      {member.membership_role !== 'member' ? (
                        <Badge tone="teal" className="ms-auto shrink-0">
                          {roleLabel(member.membership_role)}
                        </Badge>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          {/* بطاقة الانضمام */}
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <div className="rounded-2xl bg-[var(--surface)] p-5 shadow-[var(--shadow-soft)] ring-1 ring-[var(--border)]">
              {!profile ? (
                <div className="space-y-4 text-center">
                  <span className="mx-auto flex size-12 items-center justify-center rounded-xl bg-[var(--primary-soft)]">
                    <Lock className="size-5 text-[var(--primary)]" aria-hidden />
                  </span>
                  <p className="text-sm text-[var(--fg-muted)]">{t('loginToJoin')}</p>
                  <Link
                    href={`/login?next=/${locale}/forums/${slug}`}
                    className={`${buttonStyles('primary', 'md')} w-full`}
                  >
                    {tNav('login')}
                  </Link>
                </div>
              ) : membership && membership.status === 'approved' ? (
                <div className="rounded-xl bg-[var(--success-soft)] px-4 py-4 text-center text-sm text-[var(--success)]">
                  {t('joinApproved')}
                </div>
              ) : membership && membership.status === 'pending' ? (
                <div className="rounded-xl bg-[var(--warning-soft)] px-4 py-4 text-center text-sm text-[var(--warning)]">
                  {t('joinPending')}
                </div>
              ) : canApply ? (
                <>
                  <h2 className="text-lg font-semibold">{t('applyHeading')}</h2>
                  <p className="mt-1.5 text-sm text-[var(--fg-muted)]">{t('applyLead')}</p>
                  <div className="mt-4">
                    <JoinForm forumId={forum.id} slug={forum.slug} />
                  </div>
                </>
              ) : (
                <div className="rounded-xl bg-[var(--bg-subtle)] px-4 py-4 text-center text-sm text-[var(--fg-subtle)]">
                  {full ? t('capacityFull') : t('closed')}
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>
    </SiteShell>
  )
}
