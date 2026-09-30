import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'

import { BannerForm } from '@/components/admin/banner-form'
import { adminBanner } from '@/lib/admin-data'
import { toRiyadhInput } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export default async function EditBannerPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>
}) {
  const { locale, id } = await params
  const [t, banner] = await Promise.all([getTranslations('admin'), adminBanner(id)])
  if (!banner) notFound()

  return (
    <div>
      <h1 className="text-2xl font-semibold">{t('navBanners')}</h1>
      <div className="mt-6 rounded-2xl bg-[var(--surface)] p-5 ring-1 ring-[var(--border)] sm:p-6">
        {/* التواريخ تُحوَّل هنا لا في المكوّن: الخادم والمتصفّح يجب أن
            يكتبا نفس القيمة حرفًا بحرف وإلا انكسر الترطيب. */}
        <BannerForm
          banner={banner}
          locale={locale}
          startsAt={toRiyadhInput(banner.starts_at)}
          endsAt={toRiyadhInput(banner.ends_at)}
        />
      </div>
    </div>
  )
}
