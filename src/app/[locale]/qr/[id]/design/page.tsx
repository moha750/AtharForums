import { getTranslations, setRequestLocale } from 'next-intl/server'

import { Link, redirect } from '@/i18n/navigation'
import { DesignEditor } from '@/components/qr/design-editor'
import { StepHeader } from '@/components/qr/step-header'
import { getLink } from '@/lib/qr/server'
import { shortLink } from '@/lib/qr/origin'
import { designOf, readSpec } from '@/lib/qr/spec'

export const dynamic = 'force-dynamic'

export default async function QrDesignPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; id: string }>
  searchParams: Promise<{ new?: string }>
}) {
  const { locale, id } = await params
  setRequestLocale(locale)
  const { new: fresh } = await searchParams

  const [t, found] = await Promise.all([getTranslations('qr'), getLink(id)])
  if (!found) {
    return <p className="rounded-xl bg-[var(--surface)] p-8 text-center ring-1 ring-[var(--border)]">{t('notFound')}</p>
  }
  // المحرّر لمن يعدّل؛ من يقرأ فقط يرى الباركود في صفحته
  if (found.access !== 'owner' && found.access !== 'edit') {
    redirect({ href: `/qr/${id}`, locale })
  }

  const { link } = found
  const text = shortLink(link.code)
  // الوصفة المخزّنة تُقرأ بنصّها المخزَّن (قد يكون أصلًا قديمًا) — الملصق المطبوع لا يتغيّر
  const stored = readSpec(link.spec, (link.spec as { text?: string } | null)?.text ?? text)

  return (
    <div className="space-y-6">
      {fresh ? (
        <StepHeader title={t('create.title')} steps={[t('create.step1'), t('create.step2')]} current={1} />
      ) : (
        <header>
          <Link href={`/qr/${id}`} className="text-sm text-[var(--fg-subtle)] hover:text-[var(--fg)]">
            ← {link.title}
          </Link>
          <h1 className="mt-1 text-2xl font-semibold">{t('design.title', { title: link.title })}</h1>
        </header>
      )}
      <p className="text-sm text-[var(--fg-muted)]">{t('design.lead')}</p>
      <DesignEditor
        linkId={link.id}
        title={link.title}
        text={stored.text}
        initial={designOf(stored)}
        doneHref={`/${locale}/qr/${id}`}
      />
    </div>
  )
}
