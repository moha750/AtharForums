import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'

import { ForumForm } from '@/components/admin/forum-form'
import { adminForum } from '@/lib/admin-data'

export const dynamic = 'force-dynamic'

export default async function EditForumPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>
}) {
  const { locale, id } = await params
  const [t, forum] = await Promise.all([getTranslations('admin'), adminForum(id)])
  if (!forum) notFound()

  return (
    <div>
      <h1 className="text-2xl font-semibold">{t('editForum')}</h1>
      <div className="mt-6 rounded-2xl bg-[var(--surface)] p-5 ring-1 ring-[var(--border)] sm:p-6">
        <ForumForm forum={forum} locale={locale} />
      </div>
    </div>
  )
}
