import { Plus } from 'lucide-react'
import { getTranslations } from 'next-intl/server'

import { Link } from '@/i18n/navigation'
import { Badge } from '@/components/ui/badge'
import { Button, buttonStyles } from '@/components/ui/button'
import { deleteForum } from '@/actions/admin'
import { adminForums } from '@/lib/admin-data'
import { localized } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export default async function AdminForumsPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  const [t, tCommon, forums] = await Promise.all([
    getTranslations('admin'),
    getTranslations('common'),
    adminForums(),
  ])

  const statusTone = { published: 'success', draft: 'warning', archived: 'neutral' } as const
  const statusLabel = {
    published: t('statusPublished'),
    draft: t('statusDraft'),
    archived: t('statusArchived'),
  } as const

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">{t('navForums')}</h1>
        <Link href="/admin/forums/new" className={buttonStyles('primary', 'sm')}>
          <Plus className="size-4" aria-hidden />
          {t('newForum')}
        </Link>
      </div>

      <ul className="mt-6 space-y-3">
        {forums.map((forum) => (
          <li
            key={forum.id}
            className="flex flex-wrap items-center gap-3 rounded-xl bg-[var(--surface)] p-4 ring-1 ring-[var(--border)]"
          >
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium">{localized(forum, 'name', locale)}</p>
                <Badge tone={statusTone[forum.status]}>{statusLabel[forum.status]}</Badge>
                {!forum.is_accepting ? <Badge tone="neutral">{t('forumAccepting')}: ✕</Badge> : null}
              </div>
              <p className="mt-1 font-latin text-xs text-[var(--fg-subtle)]" dir="ltr">
                /{forum.slug} · {forum.members_count}
                {forum.capacity ? `/${forum.capacity}` : ''}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Link href={`/admin/forums/${forum.id}`} className={buttonStyles('secondary', 'sm')}>
                {tCommon('edit')}
              </Link>
              <form action={deleteForum}>
                <input type="hidden" name="id" value={forum.id} />
                <Button type="submit" variant="ghost" size="sm">
                  {tCommon('delete')}
                </Button>
              </form>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
