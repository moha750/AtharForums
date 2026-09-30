import NextImage from 'next/image'
import { Plus, Star } from 'lucide-react'
import { getTranslations } from 'next-intl/server'

import { Link } from '@/i18n/navigation'
import { Badge } from '@/components/ui/badge'
import { Button, buttonStyles } from '@/components/ui/button'
import { deleteBoardMember } from '@/actions/admin'
import { adminBoard } from '@/lib/admin-data'
import { localized } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export default async function AdminBoardPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const [t, tCommon, members] = await Promise.all([
    getTranslations('admin'),
    getTranslations('common'),
    adminBoard(),
  ])

  const tone = { published: 'success', draft: 'warning', archived: 'neutral' } as const
  const label = {
    published: t('statusPublished'),
    draft: t('statusDraft'),
    archived: t('statusArchived'),
  } as const

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{t('navBoard')}</h1>
          <p className="mt-1 text-sm text-[var(--fg-muted)]">{t('boardLead')}</p>
        </div>
        <Link href="/admin/board/new" className={buttonStyles('primary', 'sm')}>
          <Plus className="size-4" aria-hidden />
          {t('boardNew')}
        </Link>
      </div>

      {members.length === 0 ? (
        <p className="mt-8 rounded-xl bg-[var(--bg-subtle)] p-8 text-center text-sm text-[var(--fg-muted)] ring-1 ring-[var(--border)]">
          {t('boardEmpty')}
        </p>
      ) : (
        <ul className="mt-6 space-y-3">
          {members.map((member) => {
            const name = localized(member, 'name', locale)
            return (
              <li
                key={member.id}
                className="flex flex-wrap items-center gap-3 rounded-xl bg-[var(--surface)] p-4 ring-1 ring-[var(--border)]"
              >
                {member.photo_url ? (
                  <span className="relative size-12 shrink-0 overflow-hidden rounded-full ring-1 ring-[var(--border)]">
                    <NextImage src={member.photo_url} alt="" fill sizes="48px" className="object-cover" />
                  </span>
                ) : (
                  <span
                    aria-hidden
                    className="grid size-12 shrink-0 place-items-center rounded-full bg-[var(--primary-soft)] text-lg font-semibold text-[var(--primary)]"
                  >
                    {Array.from(name.trim())[0] ?? ''}
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{name}</p>
                    <Badge tone={tone[member.status]}>{label[member.status]}</Badge>
                    {member.is_featured ? (
                      <span className="inline-flex items-center gap-1 text-xs text-[var(--accent)]">
                        <Star className="size-3.5 fill-current" aria-hidden />
                        {t('boardFeatured')}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-0.5 text-sm text-[var(--fg-muted)]">
                    {localized(member, 'position', locale)}
                  </p>
                  <p className="mt-0.5 text-xs text-[var(--fg-subtle)]">
                    {t('boardTierN', { n: String(member.tier) })}
                    {' · '}
                    {t('bannerOrder')} <span className="font-latin">{member.sort_order}</span>
                    {member.photo_url ? null : ` · ${t('boardNoPhoto')}`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Link href={`/admin/board/${member.id}`} className={buttonStyles('secondary', 'sm')}>
                    {tCommon('edit')}
                  </Link>
                  <form action={deleteBoardMember}>
                    <input type="hidden" name="id" value={member.id} />
                    <Button type="submit" variant="ghost" size="sm">
                      {tCommon('delete')}
                    </Button>
                  </form>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
