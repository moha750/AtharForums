import { getTranslations } from 'next-intl/server'
import { PostForm } from '@/components/admin/post-form'
import { adminForums } from '@/lib/admin-data'

export const dynamic = 'force-dynamic'

export default async function NewPostPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const [t, forums] = await Promise.all([getTranslations('admin'), adminForums()])
  return (
    <div>
      <h1 className="text-2xl font-semibold">{t('navNews')}</h1>
      <div className="mt-6 rounded-2xl bg-[var(--surface)] p-5 ring-1 ring-[var(--border)] sm:p-6">
        <PostForm forums={forums} locale={locale} />
      </div>
    </div>
  )
}
