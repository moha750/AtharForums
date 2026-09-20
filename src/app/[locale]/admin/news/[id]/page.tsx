import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { PostForm } from '@/components/admin/post-form'
import { adminForums, adminPost } from '@/lib/admin-data'

export const dynamic = 'force-dynamic'

export default async function EditPostPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>
}) {
  const { locale, id } = await params
  const [t, post, forums] = await Promise.all([
    getTranslations('admin'),
    adminPost(id),
    adminForums(),
  ])
  if (!post) notFound()

  return (
    <div>
      <h1 className="text-2xl font-semibold">{t('navNews')}</h1>
      <div className="mt-6 rounded-2xl bg-[var(--surface)] p-5 ring-1 ring-[var(--border)] sm:p-6">
        <PostForm post={post} forums={forums} locale={locale} />
      </div>
    </div>
  )
}
