import { notFound } from 'next/navigation'
import { getTranslations, setRequestLocale } from 'next-intl/server'

import { SiteShell } from '@/components/site/site-shell'
import { Link } from '@/i18n/navigation'
import { Badge } from '@/components/ui/badge'
import { getForumsById, getPostBySlug } from '@/lib/data'
import { requireLaunched } from '@/lib/gate'
import { formatDate, localized } from '@/lib/utils'
import { isLocale } from '@/i18n/routing'

export const dynamic = 'force-dynamic'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>
}) {
  const { locale, slug } = await params
  if (!isLocale(locale)) return {}
  const post = await getPostBySlug(slug)
  if (!post) return {}
  return {
    title: localized(post, 'title', locale),
    description: localized(post, 'excerpt', locale).slice(0, 180),
  }
}

export default async function PostPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>
}) {
  const { locale, slug } = await params
  if (!isLocale(locale)) notFound()
  setRequestLocale(locale)

  const settings = await requireLaunched(locale)
  const post = await getPostBySlug(slug)
  if (!post || post.status !== 'published') notFound()

  const [t, forums] = await Promise.all([
    getTranslations('news'),
    getForumsById(post.forum_id ? [post.forum_id] : []),
  ])
  const forum = post.forum_id ? forums.get(post.forum_id) : undefined
  const body = localized(post, 'body', locale)

  return (
    <SiteShell locale={locale} settings={settings}>
      <article className="container-athar max-w-3xl py-12 sm:py-16">
        {forum ? (
          <Link href={`/forums/${forum.slug}`}>
            <Badge tone="teal">{localized(forum, 'name', locale)}</Badge>
          </Link>
        ) : null}

        <h1 className="mt-4 text-balance text-3xl font-bold sm:text-4xl">
          {localized(post, 'title', locale)}
        </h1>

        {post.published_at ? (
          <p className="mt-3 text-sm text-[var(--fg-subtle)]">
            {t('publishedOn')} {formatDate(post.published_at, locale)}
          </p>
        ) : null}

        {localized(post, 'excerpt', locale) ? (
          <p className="mt-6 border-s-2 border-[var(--primary)] ps-4 text-lg leading-relaxed text-[var(--fg-muted)]">
            {localized(post, 'excerpt', locale)}
          </p>
        ) : null}

        {body ? (
          <div className="mt-8 space-y-4 leading-[1.9] text-[var(--fg)]">
            {body.split(/\n{2,}/).map((para, i) => (
              <p key={i} className="whitespace-pre-line">
                {para}
              </p>
            ))}
          </div>
        ) : null}
      </article>
    </SiteShell>
  )
}
