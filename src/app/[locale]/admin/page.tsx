import { CalendarDays, LayoutGrid, Mail, UserCheck, Users } from 'lucide-react'
import { getTranslations } from 'next-intl/server'

import { Link } from '@/i18n/navigation'
import { adminOverview } from '@/lib/admin-data'

export const dynamic = 'force-dynamic'

export default async function AdminOverviewPage() {
  const [t, stats] = await Promise.all([getTranslations('admin'), adminOverview()])

  const cards = [
    { value: stats.forums, label: t('statForums'), href: '/admin/forums', Icon: LayoutGrid },
    {
      value: stats.pending,
      label: t('statPending'),
      href: '/admin/applications',
      Icon: UserCheck,
      highlight: stats.pending > 0,
    },
    { value: stats.members, label: t('statMembers'), href: '/admin/members', Icon: Users },
    { value: stats.waitlist, label: t('statWaitlist'), href: '/admin/waitlist', Icon: Mail },
  ]

  return (
    <div>
      <h1 className="text-2xl font-semibold">{t('navOverview')}</h1>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(({ value, label, href, Icon, highlight }) => (
          <Link
            key={href}
            href={href}
            className={`rounded-2xl bg-[var(--surface)] p-5 ring-1 transition-shadow hover:shadow-[var(--shadow-soft)] ${
              highlight ? 'ring-2 ring-[var(--accent)]' : 'ring-[var(--border)]'
            }`}
          >
            <Icon className="size-5 text-[var(--primary)]" aria-hidden />
            <p className="font-latin mt-3 text-3xl font-semibold tabular-nums">{value}</p>
            <p className="mt-1 text-sm text-[var(--fg-muted)]">{label}</p>
          </Link>
        ))}
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <Link
          href="/admin/forums/new"
          className="rounded-2xl bg-[var(--surface)] p-5 ring-1 ring-[var(--border)] transition-shadow hover:shadow-[var(--shadow-soft)]"
        >
          <LayoutGrid className="size-5 text-[var(--primary)]" aria-hidden />
          <p className="mt-3 font-medium">{t('newForum')}</p>
        </Link>
        <Link
          href="/admin/events/new"
          className="rounded-2xl bg-[var(--surface)] p-5 ring-1 ring-[var(--border)] transition-shadow hover:shadow-[var(--shadow-soft)]"
        >
          <CalendarDays className="size-5 text-[var(--primary)]" aria-hidden />
          <p className="mt-3 font-medium">{t('navEvents')}</p>
        </Link>
      </div>
    </div>
  )
}
