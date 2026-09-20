import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** يحوّل نصًا عربيًا أو إنجليزيًا إلى slug لاتيني صالح للروابط. */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[ً-ْ]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

export function emailDomain(email: string): string {
  return email.trim().toLowerCase().split('@')[1] ?? ''
}

export function isAllowedDomain(email: string, domains: string[]): boolean {
  const domain = emailDomain(email)
  return domains.some((d) => d.trim().toLowerCase() === domain)
}

/** يختار الحقل العربي أو الإنجليزي مع رجوع آمن إلى العربية. */
export function localized<T extends Record<string, unknown>>(
  row: T,
  base: string,
  locale: string
): string {
  const key = locale === 'en' ? `${base}_en` : `${base}_ar`
  const value = row[key]
  if (typeof value === 'string' && value.trim() !== '') return value
  const fallback = row[`${base}_ar`]
  return typeof fallback === 'string' ? fallback : ''
}

export function formatDate(value: string | Date, locale: string): string {
  const date = typeof value === 'string' ? new Date(value) : value
  return new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : 'ar-SA-u-nu-latn', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Riyadh',
  }).format(date)
}

export function formatDateTime(value: string | Date, locale: string): string {
  const date = typeof value === 'string' ? new Date(value) : value
  return new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : 'ar-SA-u-nu-latn', {
    day: 'numeric',
    month: 'long',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'Asia/Riyadh',
  }).format(date)
}
