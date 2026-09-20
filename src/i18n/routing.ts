import { defineRouting } from 'next-intl/routing'

export const locales = ['ar', 'en'] as const
export type Locale = (typeof locales)[number]
export const defaultLocale: Locale = 'ar'

export const routing = defineRouting({
  locales,
  defaultLocale,
  // كل رابط يحمل لغته صراحةً: /ar و /en — لا لبس ولا اعتماد على تخمين.
  localePrefix: 'always',
  // لا نعتمد على لغة متصفّح الزائر: كثير من أجهزة العمل لغتها الإنجليزية
  // وأصحابها يقرؤون العربية. الجذر يذهب إلى العربية دائمًا، والتبديل يدوي.
  localeDetection: false,
})

export const localeDirection: Record<Locale, 'rtl' | 'ltr'> = {
  ar: 'rtl',
  en: 'ltr',
}

export const localeLabels: Record<Locale, string> = {
  ar: 'العربية',
  en: 'English',
}

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (locales as readonly string[]).includes(value)
}
