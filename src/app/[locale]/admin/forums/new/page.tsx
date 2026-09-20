import { getTranslations } from 'next-intl/server'
import { ForumForm } from '@/components/admin/forum-form'

export const dynamic = 'force-dynamic'

export default async function NewForumPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const t = await getTranslations('admin')
  return (
    <div>
      <h1 className="text-2xl font-semibold">{t('newForum')}</h1>
      <div className="mt-6 rounded-2xl bg-[var(--surface)] p-5 ring-1 ring-[var(--border)] sm:p-6">
        <ForumForm locale={locale} />
      </div>
    </div>
  )
}
