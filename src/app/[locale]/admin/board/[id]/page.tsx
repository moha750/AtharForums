import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'

import { BoardForm } from '@/components/admin/board-form'
import { adminBoardMember } from '@/lib/admin-data'

export const dynamic = 'force-dynamic'

export default async function EditBoardMemberPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>
}) {
  const { locale, id } = await params
  const [t, member] = await Promise.all([getTranslations('admin'), adminBoardMember(id)])
  if (!member) notFound()

  return (
    <div>
      <h1 className="text-2xl font-semibold">{t('navBoard')}</h1>
      <div className="mt-6 rounded-2xl bg-[var(--surface)] p-5 ring-1 ring-[var(--border)] sm:p-6">
        <BoardForm member={member} locale={locale} />
      </div>
    </div>
  )
}
