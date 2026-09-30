import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import type { RankTitles } from '@/lib/board'

import { BoardForm } from '@/components/admin/board-form'
import { adminBoardMember } from '@/lib/admin-data'

export const dynamic = 'force-dynamic'

async function rankTitles(locale: 'ar' | 'en'): Promise<RankTitles> {
  const t = await getTranslations({ locale, namespace: 'board' })
  return {
    general_manager: t('rankGeneralManager'),
    chair: t('rankChair'),
    member: t('rankMember'),
  }
}

export default async function EditBoardMemberPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>
}) {
  const { locale, id } = await params
  const [t, member, ar, en] = await Promise.all([
    getTranslations('admin'),
    adminBoardMember(id),
    rankTitles('ar'),
    rankTitles('en'),
  ])
  if (!member) notFound()

  return (
    <div>
      <h1 className="text-2xl font-semibold">{t('navBoard')}</h1>
      <div className="mt-6 rounded-2xl bg-[var(--surface)] p-5 ring-1 ring-[var(--border)] sm:p-6">
        <BoardForm member={member} locale={locale} titles={{ ar, en }} />
      </div>
    </div>
  )
}
