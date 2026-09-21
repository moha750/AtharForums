import { NextResponse, type NextRequest } from 'next/server'

import { analyticsEnabled, recordEngagement } from '@/lib/analytics/record'

/**
 * يستقبل زمن البقاء وعمق التمرير من المتصفّح.
 *
 * لا يستقبل معرّف زيارة: الخادم يستنتج الزيارة من بصمة الزائر نفسها. فلا يملك
 * أحد معرّفًا يزوّره، ولا نحتاج كوكي تتبّع.
 *
 * يعيد 204 دائمًا — المتصفّح لا ينتظر ردًّا، ورسائل الخطأ هنا لا تفيد أحدًا
 * سوى من يريد استكشاف النظام.
 */

const NO_CONTENT = new NextResponse(null, { status: 204 })

function clamp(value: unknown, min: number, max: number): number | null {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return null
  return Math.min(Math.max(Math.round(n), min), max)
}

export async function POST(request: NextRequest) {
  if (!analyticsEnabled) return NO_CONTENT

  try {
    const body = (await request.json()) as Record<string, unknown>
    const path = typeof body.path === 'string' ? body.path : ''
    const durationMs = clamp(body.durationMs, 0, 3_600_000)

    if (!path.startsWith('/') || durationMs === null || durationMs < 1000) {
      // أقل من ثانية ليس بقاءً — غالبًا ارتداد فوري أو خطأ في القياس
      return NO_CONTENT
    }

    await recordEngagement({
      headers: request.headers,
      path,
      durationMs,
      scrollPct: clamp(body.scrollPct, 0, 100),
      screenWidth: clamp(body.screenWidth, 0, 10_000),
    })
  } catch {
    // مُهمَل عمدًا: بيانات تالفة من المتصفّح لا تستحقّ ضجيجًا في السجلّ
  }

  return NO_CONTENT
}
