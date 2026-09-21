import { headers } from 'next/headers'

import { recordConversion, type ConversionName } from '@/lib/analytics/record'

/**
 * يسجّل تحوّلًا من داخل Server Action.
 *
 * التحوّل هو ما يحوّل الإحصاءات من «كم زائرًا» إلى «كم زائرًا فعل شيئًا».
 * بدونه تعرف أن مئة فتحوا صفحة المنتدى، ولا تعرف أن اثنين فقط طلبوا الانضمام
 * — وهذا الرقم الثاني هو الذي يقول لك إن كانت الصفحة تعمل.
 *
 * لا يرمي أبدًا: فشل التسجيل لا يجوز أن يُفشِل فعلًا نجح بالفعل.
 */
export async function trackConversion(
  name: ConversionName,
  options: { entityId?: string | null; path?: string | null; locale?: string | null } = {}
): Promise<void> {
  try {
    const requestHeaders = await headers()

    await recordConversion({
      headers: requestHeaders,
      name,
      entityId: options.entityId ?? null,
      path: options.path ?? requestHeaders.get('x-athar-path'),
      locale: options.locale ?? null,
    })
  } catch (error) {
    console.error('[analytics] تعذّر تسجيل التحوّل', name, error)
  }
}
