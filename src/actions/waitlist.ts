'use server'

import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { getPublicSettings } from '@/lib/settings'
import { isAllowedDomain } from '@/lib/utils'

export type WaitlistState = {
  status: 'idle' | 'success' | 'error'
  /** مفتاح ترجمة تحت teaser.* — لا نُعيد نصًا جاهزًا حتى تبقى الرسالة بلغة الواجهة */
  key?: 'success' | 'alreadyRegistered' | 'errorInvalid' | 'errorDomain' | 'errorGeneric'
}

const schema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  name: z.string().trim().max(120).optional(),
})

export async function joinWaitlist(
  _prev: WaitlistState,
  formData: FormData
): Promise<WaitlistState> {
  // مصيدة الروبوتات: حقل مخفي يملؤه الآلي ولا يراه الإنسان
  if ((formData.get('company') as string | null)?.trim()) {
    return { status: 'success', key: 'success' }
  }

  const parsed = schema.safeParse({
    email: formData.get('email'),
    name: formData.get('name') || undefined,
  })

  if (!parsed.success) {
    return { status: 'error', key: 'errorInvalid' }
  }

  const settings = await getPublicSettings()
  if (!isAllowedDomain(parsed.data.email, settings.allowed_email_domains)) {
    return { status: 'error', key: 'errorDomain' }
  }

  try {
    const supabase = await createClient()
    const { error } = await supabase.rpc('join_waitlist', {
      subscriber_email: parsed.data.email,
      subscriber_name: parsed.data.name ?? null,
      subscriber_source: 'teaser',
    })

    if (error) {
      return { status: 'error', key: 'errorGeneric' }
    }

    return { status: 'success', key: 'success' }
  } catch {
    return { status: 'error', key: 'errorGeneric' }
  }
}
