'use server'

import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { getCurrentProfile } from '@/lib/auth'
import { previewMode } from '@/lib/fixtures'
import { trackConversion } from '@/lib/analytics/server'
import { CONVERSIONS } from '@/lib/analytics/record'
import { CONTACT_TOPICS } from '@/lib/contact'

type Field = 'name' | 'email' | 'body'

export type ContactState = {
  status: 'idle' | 'success' | 'error'
  /** مفتاح ترجمة تحت contact.* — لا نُعيد نصًا جاهزًا حتى تبقى الرسالة بلغة الواجهة */
  key?: 'success' | 'errorRate' | 'errorGeneric'
  fields?: Partial<Record<Field, true>>
  /**
   * ما كتبه المرسل، يعود مع الخطأ. React يُفرّغ النموذج بعد كل إرسال، فبدون
   * هذا تضيع رسالة طويلة كاملة لأنّ الاسم كان ناقصًا.
   */
  values?: { name: string; email: string; topic: string; body: string }
}

const schema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().email().max(254),
  topic: z.enum(CONTACT_TOPICS),
  body: z.string().trim().min(10).max(4000),
})

export async function sendContactMessage(
  _prev: ContactState,
  formData: FormData
): Promise<ContactState> {
  // مصيدة الروبوتات: حقل مخفي يملؤه الآلي ولا يراه الإنسان
  if ((formData.get('company') as string | null)?.trim()) {
    return { status: 'success', key: 'success' }
  }

  const profile = await getCurrentProfile()
  const values = {
    name: String(formData.get('name') ?? ''),
    // المسجَّل دخوله: البريد من حسابه، والدالّة في القاعدة تفرض هذا أيضًا
    email: profile?.email ?? String(formData.get('email') ?? ''),
    topic: String(formData.get('topic') ?? 'inquiry'),
    body: String(formData.get('body') ?? ''),
  }
  const locale = formData.get('locale') === 'en' ? 'en' : 'ar'

  const parsed = schema.safeParse(values)
  if (!parsed.success) {
    const fields: ContactState['fields'] = {}
    for (const issue of parsed.error.issues) {
      const field = issue.path[0]
      if (field === 'name' || field === 'email' || field === 'body') fields[field] = true
    }
    return { status: 'error', fields, values }
  }

  // وضع المعاينة للعرض فقط — النموذج يُجرَّب ولا يُكتب شيء
  if (previewMode) return { status: 'success', key: 'success' }

  try {
    const supabase = await createClient()
    const { error } = await supabase.rpc('submit_contact_message', {
      sender_name: parsed.data.name,
      sender_email: parsed.data.email,
      message_topic: parsed.data.topic,
      message_body: parsed.data.body,
      message_locale: locale,
    })

    if (error) {
      if (error.code === '54000') return { status: 'error', key: 'errorRate', values }
      if (error.code === '22023') {
        const field = error.message as Field
        if (field === 'name' || field === 'email' || field === 'body') {
          return { status: 'error', fields: { [field]: true }, values }
        }
      }
      console.error('[athar] sendContactMessage failed', error)
      return { status: 'error', key: 'errorGeneric', values }
    }

    await trackConversion(CONVERSIONS.contactMessage)

    return { status: 'success', key: 'success' }
  } catch (error) {
    console.error('[athar] sendContactMessage threw', error)
    return { status: 'error', key: 'errorGeneric', values }
  }
}
