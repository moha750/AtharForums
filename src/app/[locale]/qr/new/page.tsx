import { getTranslations, setRequestLocale } from 'next-intl/server'

import { redirect } from '@/i18n/navigation'
import { CreateForm } from '@/components/qr/create-form'
import { StepHeader } from '@/components/qr/step-header'
import { customCodesEnabled, getCampaign, getQrPermissions } from '@/lib/qr/server'
import { qrOrigin } from '@/lib/qr/origin'

export const dynamic = 'force-dynamic'

export default async function QrNewPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ campaign?: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  const { campaign: campaignParam } = await searchParams

  const perms = await getQrPermissions()
  if (!perms.use) redirect({ href: '/qr', locale })

  const [t, custom, campaign] = await Promise.all([
    getTranslations('qr'),
    customCodesEnabled(),
    campaignParam ? getCampaign(campaignParam) : Promise.resolve(null),
  ])
  // الإنشاء داخل الحملة لمالكها وحده
  const inCampaign = campaign && campaign.access === 'owner' ? campaign.campaign : null

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <StepHeader
        title={t('create.title')}
        subtitle={inCampaign ? t('create.inCampaign', { name: inCampaign.name }) : undefined}
        steps={[t('create.step1'), t('create.step2')]}
        current={0}
      />
      <div className="rounded-2xl bg-[var(--surface)] p-5 ring-1 ring-[var(--border)] sm:p-6">
        <CreateForm origin={qrOrigin()} locale={locale} customCodes={custom} campaignId={inCampaign?.id ?? null} />
      </div>
    </div>
  )
}
