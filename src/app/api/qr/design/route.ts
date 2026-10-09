import type { NextRequest } from 'next/server'

import { createClient } from '@/lib/supabase/server'
import { getCurrentProfile } from '@/lib/auth'
import { previewMode } from '@/lib/fixtures'
import { shortLink } from '@/lib/qr/origin'
import { checkDesign } from '@/lib/qr/spec'

/**
 * حفظ تصميم الباركود — معالج مسار لا فعل خادم، لأن المحرّر يحفظ أيضًا عند
 * إخفاء التبويب ومغادرة الصفحة (fetch مع keepalive).
 *
 * الخادم يكتب spec.text بنفسه من رمز الصفّ، ولا يثق بنصّ المتصفّح. والسياسات
 * تقرّر من يحقّ له الحفظ: المالك أو الشريك المحرِّر.
 */

export const dynamic = 'force-dynamic'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } })

export async function POST(request: NextRequest) {
  if (previewMode) return json({ error: 'forbidden' }, 403)
  // نفس الموقع فقط. نقارن المضيف لا الأصل كاملًا: خلف وسيط ينهي TLS قد يرى
  // الخادم http والمتصفّح https للمضيف نفسه.
  const origin = request.headers.get('origin')
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host')
  if (origin && host) {
    let originHost = ''
    try {
      originHost = new URL(origin).host
    } catch {}
    if (originHost !== host.split(',')[0]!.trim()) return json({ error: 'forbidden' }, 403)
  }

  const profile = await getCurrentProfile()
  if (!profile || !profile.is_active) return json({ error: 'forbidden' }, 401)

  let body: { id?: unknown; design?: unknown }
  try {
    body = await request.json()
  } catch {
    return json({ error: 'invalid' }, 400)
  }
  const id = String(body.id ?? '')
  if (!UUID.test(id)) return json({ error: 'not-found' }, 404)

  const checked = checkDesign(body.design)
  if (!checked.ok) return json({ error: checked.issue }, 400)

  const supabase = await createClient()
  const { data: link } = await supabase.from('qr_links').select('code').eq('id', id).maybeSingle()
  if (!link) return json({ error: 'not-found' }, 404)

  const spec = { text: shortLink(link.code as string), ...checked.design }
  const { data, error } = await supabase.from('qr_links').update({ spec }).eq('id', id).select('updated_at')
  if (error) {
    console.error('[qr] design save', error)
    return json({ error: error.code === '23514' ? 'invalid' : 'generic' }, 400)
  }
  if (!data?.length) return json({ error: 'forbidden' }, 403)
  return json({ ok: true, updatedAt: data[0]!.updated_at })
}
