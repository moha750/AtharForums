import { getTranslations } from 'next-intl/server'
import { BoardForm } from '@/components/admin/board-form'

export const dynamic = 'force-dynamic'

export default async function NewBoardMemberPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const t = await getTranslations('admin')
  return (
    <div>
      <h1 className="text-2xl font-semibold">{t('boardNew')}</h1>
      <div className="mt-6 rounded-2xl bg-[var(--surface)] p-5 ring-1 ring-[var(--border)] sm:p-6">
        <BoardForm locale={locale} />
      </div>
    </div>
  )
}
