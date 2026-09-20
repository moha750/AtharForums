'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export type JoinState = {
  status: 'idle' | 'success' | 'error'
  message?: string
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

  if (!parsed.success) {
    return { status: 'error', message: 'invalid' }
  }

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

  const { error } = await supabase.from('forum_memberships').insert({
    forum_id: parsed.data.forumId,
    profile_id: user.id,
    status: 'pending',
    role: 'member',
    motivation: parsed.data.motivation,
    relevant_skills: skills,
  })

  if (error) {
    return { status: 'error', message: error.code === '23505' ? 'duplicate' : 'failed' }
  }

  revalidatePath(`/forums/${parsed.data.slug}`)
  return { status: 'success' }
}

export async function withdrawFromForum(membershipId: string, slug: string) {
  const supabase = await createClient()
  await supabase
    .from('forum_memberships')
    .update({ status: 'withdrawn' })
    .eq('id', membershipId)
  revalidatePath(`/forums/${slug}`)
}
