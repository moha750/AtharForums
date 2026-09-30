import { getTranslations } from 'next-intl/server'
import { BannerForm } from '@/components/admin/banner-form'

export const dynamic = 'force-dynamic'

export default async function NewBannerPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  const t = await getTranslations('admin')
  return (
    <div>
      <h1 className="text-2xl font-semibold">{t('bannerNew')}</h1>
      <div className="mt-6 rounded-2xl bg-[var(--surface)] p-5 ring-1 ring-[var(--border)] sm:p-6">
        <BannerForm locale={locale} startsAt="" endsAt="" />
      </div>
    </div>
  )
}
