import { getTranslations } from 'next-intl/server'
import type { RankTitles } from '@/lib/board'
import { BoardForm } from '@/components/admin/board-form'

export const dynamic = 'force-dynamic'

async function rankTitles(locale: 'ar' | 'en'): Promise<RankTitles> {
  const t = await getTranslations({ locale, namespace: 'board' })
  return {
    general_manager: t('rankGeneralManager'),
    chair: t('rankChair'),
    member: t('rankMember'),
  }
}

export default async function NewBoardMemberPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const [t, ar, en] = await Promise.all([
    getTranslations('admin'),
    rankTitles('ar'),
    rankTitles('en'),
  ])
  return (
    <div>
      <h1 className="text-2xl font-semibold">{t('boardNew')}</h1>
      <div className="mt-6 rounded-2xl bg-[var(--surface)] p-5 ring-1 ring-[var(--border)] sm:p-6">
        <BoardForm locale={locale} titles={{ ar, en }} />
      </div>
    </div>
  )
}
