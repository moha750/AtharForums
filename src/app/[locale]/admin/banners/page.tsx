import Image from 'next/image'
import { Plus } from 'lucide-react'
import { getTranslations } from 'next-intl/server'

import { Link } from '@/i18n/navigation'
import { Badge } from '@/components/ui/badge'
import { Button, buttonStyles } from '@/components/ui/button'
import { deleteBanner } from '@/actions/admin'
import { adminBanners } from '@/lib/admin-data'
import { formatDate, localized } from '@/lib/utils'
import type { Banner } from '@/lib/database.types'

export const dynamic = 'force-dynamic'

/**
 * الحالة كما يراها الزائر الآن — لا كما هي في العمود status وحده.
 *
 * الساعة تُقرأ داخل الدالة لا في جسم المكوّن: قاعدة نقاء المكوّنات تمنع
 * الدوال غير النقيّة أثناء الرسم. والصفحة ديناميكية فتُحسب مع كل طلب.
 */
function liveState(banner: Banner) {
  const now = Date.now()
  if (banner.status !== 'published') return banner.status
  if (banner.starts_at && new Date(banner.starts_at).getTime() > now) return 'scheduled'
  if (banner.ends_at && new Date(banner.ends_at).getTime() <= now) return 'expired'
  return 'live'
}

export default async function AdminBannersPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  const [t, tCommon, banners] = await Promise.all([
    getTranslations('admin'),
    getTranslations('common'),
    adminBanners(),
  ])

  const tone = {
    live: 'success',
    scheduled: 'warning',
    expired: 'neutral',
    draft: 'warning',
    archived: 'neutral',
    published: 'success',
  } as const
  const label = {
    live: t('bannerStateLive'),
    scheduled: t('bannerStateScheduled'),
    expired: t('bannerStateExpired'),
    draft: t('statusDraft'),
    archived: t('statusArchived'),
    published: t('statusPublished'),
  } as const

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{t('navBanners')}</h1>
          <p className="mt-1 text-sm text-[var(--fg-muted)]">{t('bannersLead')}</p>
        </div>
        <Link href="/admin/banners/new" className={buttonStyles('primary', 'sm')}>
          <Plus className="size-4" aria-hidden />
          {t('bannerNew')}
        </Link>
      </div>

      {banners.length === 0 ? (
        <p className="mt-8 rounded-xl bg-[var(--bg-subtle)] p-8 text-center text-sm text-[var(--fg-muted)] ring-1 ring-[var(--border)]">
          {t('bannersEmpty')}
        </p>
      ) : (
        <ul className="mt-6 space-y-3">
          {banners.map((banner) => {
            const state = liveState(banner)
            return (
              <li
                key={banner.id}
                className="flex flex-wrap items-center gap-4 rounded-xl bg-[var(--surface)] p-4 ring-1 ring-[var(--border)]"
              >
                <div className="relative aspect-[16/6] w-28 shrink-0 overflow-hidden rounded-lg bg-[var(--bg-subtle)]">
                  <Image
                    src={banner.image_url}
                    alt=""
                    fill
                    sizes="7rem"
                    className="object-cover"
                  />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{localized(banner, 'title', locale)}</p>
                    <Badge tone={tone[state]}>{label[state]}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-[var(--fg-subtle)]">
                    {t('bannerOrder')}: {banner.sort_order}
                    {banner.starts_at
                      ? ` · ${t('bannerStartsAt')} ${formatDate(banner.starts_at, locale)}`
                      : ''}
                    {banner.ends_at
                      ? ` · ${t('bannerEndsAt')} ${formatDate(banner.ends_at, locale)}`
                      : ''}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Link
                    href={`/admin/banners/${banner.id}`}
                    className={buttonStyles('secondary', 'sm')}
                  >
                    {tCommon('edit')}
                  </Link>
                  <form action={deleteBanner}>
                    <input type="hidden" name="id" value={banner.id} />
                    <Button type="submit" variant="ghost" size="sm">
                      {tCommon('delete')}
                    </Button>
                  </form>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
