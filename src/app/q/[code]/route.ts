import type { NextRequest } from 'next/server'

import { isCodeShape } from '@/lib/qr/code'
import { anonRpc, QR_SERVER_KEY } from '@/lib/qr/rpc'
import { classifyScan, referrerHost } from '@/lib/qr/ua'
import { requestIp, visitorHash } from '@/lib/qr/visitor'

/**
 * باب المسح: GET /q/{code}
 *
 * معالج مسار لا صفحة — يُرجع 307 بلا جسم. 307 لا 308: الوجهة تتغيّر،
 * و308 دائم يحفظه المتصفّح فلا يعود إلينا أبدًا. ولا تخزين مؤقّت للسبب نفسه.
 *
 * المجهول والموقوف وعطل القراءة كلها تذهب إلى صفحة واحدة لا تكشف أيّها.
 */

export const dynamic = 'force-dynamic'

const NO_STORE = 'no-store, max-age=0'

function redirectTo(location: string): Response {
  return new Response(null, {
    status: 307,
    headers: {
      Location: location,
      'Cache-Control': NO_STORE,
      'X-Robots-Tag': 'noindex, nofollow',
    },
  })
}

const unavailable = () => redirectTo('/q/unavailable')

async function handle(request: NextRequest, rawCode: string, forceBot: boolean): Promise<Response> {
  // المعامل يصل مفكوكًا؛ فكّه ثانيةً قد يرمي (/q/%25) — وكل ما لا يُفهم «غير متاح»
  let code: string
  try {
    code = decodeURIComponent(rawCode).trim().toLowerCase()
  } catch {
    return unavailable()
  }
  // الشكل قبل أي استعلام: ما لا يمكن أن يكون رمزًا لا يكلّف القاعدة شيئًا
  if (!isCodeShape(code)) return unavailable()

  if (!QR_SERVER_KEY) {
    console.error('[qr] QR_SERVER_KEY غير مضبوط — كل مسح يذهب إلى «غير متاح».')
    return unavailable()
  }

  const { device, isBot } = classifyScan(request.headers.get('user-agent'))

  try {
    const target = await anonRpc<string | null>('qr_resolve', {
      p_secret: QR_SERVER_KEY,
      p_code: code,
      p_visitor: visitorHash(requestIp(request.headers)),
      p_referrer: referrerHost(request.headers.get('referer')),
      p_device: device,
      p_is_bot: isBot || forceBot,
    })
    // لا تحويل مفتوح: ما يخرج من هنا وجهةٌ صُدّقت عند حفظها، ونعيد فحص شكلها
    if (!target || !/^https?:\/\/\S+$/i.test(target)) return unavailable()
    return redirectTo(target)
  } catch (error) {
    console.error('[qr] تعذّر حلّ الرمز', error)
    return unavailable()
  }
}

export async function GET(request: NextRequest, context: { params: Promise<{ code: string }> }) {
  const { code } = await context.params
  return handle(request, code, false)
}

/** HEAD يرسله المعاين والفاحص لا الإنسان: يُحوَّل ويُحفظ صفّ آلة لا يُعدّ. */
export async function HEAD(request: NextRequest, context: { params: Promise<{ code: string }> }) {
  const { code } = await context.params
  return handle(request, code, true)
}
