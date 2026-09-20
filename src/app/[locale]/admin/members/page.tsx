import { getTranslations } from 'next-intl/server'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { removeMembership, setMembershipRole } from '@/actions/admin'
import { adminMembers, adminForums } from '@/lib/admin-data'
import { localized } from '@/lib/utils'
import { Link } from '@/i18n/navigation'

export const dynamic = 'force-dynamic'

export default async function AdminMembersPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ forum?: string }>
}) {
  const { locale } = await params
  const { forum: forumId } = await searchParams

  const [t, tForums, members, forums] = await Promise.all([
    getTranslations('admin'),
    getTranslations('forums'),
    adminMembers(forumId),
    adminForums(),
  ])

  const roleLabel = {
    lead: tForums('roleLead'),
    core: tForums('roleCore'),
    member: tForums('roleMember'),
  } as const

  return (
    <div>
      <h1 className="text-2xl font-semibold">{t('navMembers')}</h1>

      <div className="mt-5 flex flex-wrap gap-2">
        <Link
          href="/admin/members"
          className={`rounded-full px-3 py-1.5 text-xs font-medium ring-1 ring-inset transition-colors ${
            !forumId
              ? 'bg-[var(--primary)] text-[var(--primary-fg)] ring-transparent'
              : 'bg-[var(--surface)] text-[var(--fg-muted)] ring-[var(--border-strong)]'
          }`}
        >
          {tForums('filterAll')}
        </Link>
        {forums.map((f) => (
          <Link
            key={f.id}
            href={`/admin/members?forum=${f.id}`}
            className={`rounded-full px-3 py-1.5 text-xs font-medium ring-1 ring-inset transition-colors ${
              forumId === f.id
                ? 'bg-[var(--primary)] text-[var(--primary-fg)] ring-transparent'
                : 'bg-[var(--surface)] text-[var(--fg-muted)] ring-[var(--border-strong)]'
            }`}
          >
            {localized(f, 'name', locale)}
          </Link>
        ))}
      </div>

      {members.length === 0 ? (
        <p className="mt-6 rounded-xl bg-[var(--surface)] px-4 py-10 text-center text-sm text-[var(--fg-subtle)] ring-1 ring-[var(--border)]">
          {t('membersEmpty')}
        </p>
      ) : (
        <ul className="mt-6 space-y-3">
          {members.map((m) => (
            <li
              key={m.id}
              className="flex flex-wrap items-center gap-3 rounded-xl bg-[var(--surface)] p-4 ring-1 ring-[var(--border)]"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">
                    {(locale === 'en' ? m.profiles?.full_name_en : m.profiles?.full_name_ar) ??
                      m.profiles?.email ??
                      '—'}
                  </p>
                  <Badge tone={m.role === 'lead' ? 'teal' : m.role === 'core' ? 'sage' : 'neutral'}>
                    {roleLabel[m.role]}
                  </Badge>
                  {m.forums ? (
                    <span className="text-xs text-[var(--fg-subtle)]">
                      {localized(m.forums, 'name', locale)}
                    </span>
                  ) : null}
                </div>
                <p className="font-latin mt-0.5 text-xs text-[var(--fg-subtle)]" dir="ltr">
                  {m.profiles?.email}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                {m.role !== 'lead' ? (
                  <form action={setMembershipRole}>
                    <input type="hidden" name="id" value={m.id} />
                    <input type="hidden" name="role" value="lead" />
                    <Button type="submit" size="sm" variant="ghost">
                      {t('makeLead')}
                    </Button>
                  </form>
                ) : null}
                {m.role !== 'core' ? (
                  <form action={setMembershipRole}>
                    <input type="hidden" name="id" value={m.id} />
                    <input type="hidden" name="role" value="core" />
                    <Button type="submit" size="sm" variant="ghost">
                      {t('makeCore')}
                    </Button>
                  </form>
                ) : null}
                {m.role !== 'member' ? (
                  <form action={setMembershipRole}>
                    <input type="hidden" name="id" value={m.id} />
                    <input type="hidden" name="role" value="member" />
                    <Button type="submit" size="sm" variant="ghost">
                      {t('makeMember')}
                    </Button>
                  </form>
                ) : null}
                <form action={removeMembership}>
                  <input type="hidden" name="id" value={m.id} />
                  <Button type="submit" size="sm" variant="ghost">
                    {t('removeMember')}
                  </Button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
