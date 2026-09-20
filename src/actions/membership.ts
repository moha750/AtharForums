'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export type JoinState = {
  status: 'idle' | 'success' | 'error'
  message?: 'invalid' | 'unauthenticated' | 'closed' | 'full' | 'failed'
}

const schema = z.object({
  forumId: z.string().uuid(),
  slug: z.string().min(1).max(120),
  motivation: z.string().trim().min(10).max(1200),
  skills: z.string().trim().max(400).optional(),
})

export async function applyToForum(_prev: JoinState, formData: FormData): Promise<JoinState> {
  const parsed = schema.safeParse({
    forumId: formData.get('forumId'),
    slug: formData.get('slug'),
    motivation: formData.get('motivation'),
    skills: formData.get('skills') || undefined,
  })

  if (!parsed.success) return { status: 'error', message: 'invalid' }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { status: 'error', message: 'unauthenticated' }

  const skills = (parsed.data.skills ?? '')
    .split(/[،,]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 12)

  // من سبق أن انسحب أو رُفض له صف قائم: نعيد فتحه بدل الإدراج، لأن القيد
  // الفريد (forum_id, profile_id) يمنع صفًّا ثانيًا — وهذا ما كان يسدّ باب
  // إعادة التقديم إلى الأبد.
  const { data: existing } = await supabase
    .from('forum_memberships')
    .select('id, status')
    .eq('forum_id', parsed.data.forumId)
    .eq('profile_id', user.id)
    .maybeSingle()

  if (existing) {
    const current = existing as { id: string; status: string }
    if (current.status === 'approved' || current.status === 'pending') {
      return { status: 'success' }
    }

    const { error } = await supabase
      .from('forum_memberships')
      .update({
        status: 'pending',
        motivation: parsed.data.motivation,
        relevant_skills: skills,
      })
      .eq('id', current.id)

    if (error) {
      console.error('[athar] re-apply failed', error)
      return { status: 'error', message: 'failed' }
    }
  } else {
    const { error } = await supabase.from('forum_memberships').insert({
      forum_id: parsed.data.forumId,
      profile_id: user.id,
      status: 'pending',
      role: 'member',
      motivation: parsed.data.motivation,
      relevant_skills: skills,
    })

    if (error) {
      console.error('[athar] apply failed', error)
      // 42501 = رفضته سياسة الأمان (منتدى مغلق أو حساب موقوف)
      // 23514 = اكتملت الطاقة الاستيعابية
      const message =
        error.code === '42501' ? 'closed' : error.code === '23514' ? 'full' : 'failed'
      return { status: 'error', message }
    }
  }

  revalidatePath('/', 'layout')
  return { status: 'success' }
}

export async function withdrawFromForum(membershipId: string, slug: string) {
  const supabase = await createClient()
  const { error, count } = await supabase
    .from('forum_memberships')
    .update({ status: 'withdrawn' }, { count: 'exact' })
    .eq('id', membershipId)

  if (error || count === 0) {
    console.error('[athar] withdraw failed', { error, count, slug })
  }

  revalidatePath('/', 'layout')
}
