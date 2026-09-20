import { Check, X } from 'lucide-react'
import { getTranslations } from 'next-intl/server'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { decideApplication } from '@/actions/admin'
import { adminApplications } from '@/lib/admin-data'
import { formatDate, localized } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export default async function AdminApplicationsPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  const [t, applications] = await Promise.all([getTranslations('admin'), adminApplications()])

  return (
    <div>
      <h1 className="text-2xl font-semibold">{t('navApplications')}</h1>

      {applications.length === 0 ? (
        <p className="mt-6 rounded-xl bg-[var(--surface)] px-4 py-10 text-center text-sm text-[var(--fg-subtle)] ring-1 ring-[var(--border)]">
          {t('applicationsEmpty')}
        </p>
      ) : (
        <ul className="mt-6 space-y-4">
          {applications.map((app) => (
            <li
              key={app.id}
              className="rounded-2xl bg-[var(--surface)] p-5 ring-1 ring-[var(--border)]"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium">
                    {(locale === 'en'
                      ? app.profiles?.full_name_en
                      : app.profiles?.full_name_ar) ??
                      app.profiles?.email ??
                      '—'}
                  </p>
                  <p className="mt-0.5 text-sm text-[var(--fg-muted)]">
                    {app.profiles?.job_title}
                    {app.profiles?.department ? ` — ${app.profiles.department}` : ''}
                  </p>
                  <p className="font-latin mt-0.5 text-xs text-[var(--fg-subtle)]" dir="ltr">
                    {app.profiles?.email}
                  </p>
                </div>

                <div className="text-end">
                  {app.forums ? (
                    <Badge tone="teal">{localized(app.forums, 'name', locale)}</Badge>
                  ) : null}
                  <p className="mt-1.5 text-xs text-[var(--fg-subtle)]">
                    {t('appliedOn')} {formatDate(app.applied_at, locale)}
                  </p>
                </div>
              </div>

              {app.motivation ? (
                <div className="mt-4 rounded-xl bg-[var(--bg-subtle)] p-3.5">
                  <p className="text-xs font-medium text-[var(--fg-subtle)]">{t('motivation')}</p>
                  <p className="mt-1 whitespace-pre-line text-sm leading-relaxed">
                    {app.motivation}
                  </p>
                </div>
              ) : null}

              {app.relevant_skills.length > 0 ? (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="text-xs text-[var(--fg-subtle)]">{t('relevantSkills')}:</span>
                  {app.relevant_skills.map((skill) => (
                    <Badge key={skill} tone="neutral">
                      {skill}
                    </Badge>
                  ))}
                </div>
              ) : null}

              <div className="mt-4 flex gap-2 border-t border-[var(--border)] pt-4">
                <form action={decideApplication}>
                  <input type="hidden" name="id" value={app.id} />
                  <input type="hidden" name="decision" value="approved" />
                  <Button type="submit" size="sm">
                    <Check className="size-4" aria-hidden />
                    {t('approve')}
                  </Button>
                </form>
                <form action={decideApplication}>
                  <input type="hidden" name="id" value={app.id} />
                  <input type="hidden" name="decision" value="rejected" />
                  <Button type="submit" size="sm" variant="ghost">
                    <X className="size-4" aria-hidden />
                    {t('reject')}
                  </Button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
