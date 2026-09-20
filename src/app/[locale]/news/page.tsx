import { notFound } from 'next/navigation'
import { getTranslations, setRequestLocale } from 'next-intl/server'

import { SiteShell } from '@/components/site/site-shell'
import { Link } from '@/i18n/navigation'
import { Badge } from '@/components/ui/badge'
import { getForumsById, getPublishedPosts } from '@/lib/data'
import { requireLaunched } from '@/lib/gate'
import { formatDate, localized } from '@/lib/utils'
import { isLocale } from '@/i18n/routing'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  if (!isLocale(locale)) return {}
  const t = await getTranslations({ locale, namespace: 'news' })
  return { title: t('heading'), description: t('lead') }
}

export default async function NewsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  setRequestLocale(locale)

  const settings = await requireLaunched(locale)
  const [t, posts] = await Promise.all([getTranslations('news'), getPublishedPosts(30)])
  const forums = await getForumsById(
    posts.map((p) => p.forum_id).filter((id): id is string => Boolean(id))
  )

  return (
    <SiteShell locale={locale} settings={settings}>
      <div className="container-athar py-12 sm:py-16">
        <header className="max-w-2xl">
          <h1 className="text-3xl font-bold sm:text-4xl">{t('heading')}</h1>
          <p className="mt-3 leading-relaxed text-[var(--fg-muted)]">{t('lead')}</p>
        </header>

        {posts.length === 0 ? (
          <p className="mt-10 rounded-xl bg-[var(--bg-subtle)] px-4 py-10 text-center text-sm text-[var(--fg-subtle)]">
            {t('empty')}
          </p>
        ) : (
          <div className="mt-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {posts.map((post) => {
              const forum = post.forum_id ? forums.get(post.forum_id) : undefined
              return (
                <Link
                  key={post.id}
                  href={`/news/${post.slug}`}
                  className="group flex flex-col rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 transition-shadow hover:shadow-[var(--shadow-soft)]"
                >
                  {forum ? (
                    <Badge tone="teal" className="w-fit">
                      {localized(forum, 'name', locale)}
                    </Badge>
                  ) : null}
                  <h2 className="mt-3 text-lg font-semibold group-hover:text-[var(--primary)]">
                    {localized(post, 'title', locale)}
                  </h2>
                  {localized(post, 'excerpt', locale) ? (
                    <p className="mt-2 line-clamp-3 flex-1 text-sm leading-relaxed text-[var(--fg-muted)]">
                      {localized(post, 'excerpt', locale)}
                    </p>
                  ) : null}
                  {post.published_at ? (
                    <p className="mt-4 border-t border-[var(--border)] pt-3.5 text-xs text-[var(--fg-subtle)]">
                      {formatDate(post.published_at, locale)}
                    </p>
                  ) : null}
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </SiteShell>
  )
}
