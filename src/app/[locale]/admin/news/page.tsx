import { Plus } from 'lucide-react'
import { getTranslations } from 'next-intl/server'

import { Link } from '@/i18n/navigation'
import { Badge } from '@/components/ui/badge'
import { Button, buttonStyles } from '@/components/ui/button'
import { deletePost } from '@/actions/admin'
import { adminPosts } from '@/lib/admin-data'
import { formatDate, localized } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export default async function AdminNewsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const [t, tCommon, posts] = await Promise.all([
    getTranslations('admin'),
    getTranslations('common'),
    adminPosts(),
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
        <h1 className="text-2xl font-semibold">{t('navNews')}</h1>
        <Link href="/admin/news/new" className={buttonStyles('primary', 'sm')}>
          <Plus className="size-4" aria-hidden />
          {t('navNews')}
        </Link>
      </div>

      <ul className="mt-6 space-y-3">
        {posts.map((post) => (
          <li
            key={post.id}
            className="flex flex-wrap items-center gap-3 rounded-xl bg-[var(--surface)] p-4 ring-1 ring-[var(--border)]"
          >
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium">{localized(post, 'title', locale)}</p>
                <Badge tone={tone[post.status]}>{label[post.status]}</Badge>
              </div>
              <p className="font-latin mt-1 text-xs text-[var(--fg-subtle)]" dir="ltr">
                /{post.slug}
                {post.published_at ? ` · ${formatDate(post.published_at, locale)}` : ''}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Link href={`/admin/news/${post.id}`} className={buttonStyles('secondary', 'sm')}>
                {tCommon('edit')}
              </Link>
              <form action={deletePost}>
                <input type="hidden" name="id" value={post.id} />
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
