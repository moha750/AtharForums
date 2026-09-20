'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export type ProfileState = { status: 'idle' | 'success' | 'error' }

const schema = z.object({
  full_name_ar: z.string().trim().max(120).optional(),
  full_name_en: z.string().trim().max(120).optional(),
  job_title: z.string().trim().max(160).optional(),
  department: z.string().trim().max(160).optional(),
  sector: z.string().trim().max(160).optional(),
  work_location: z.string().trim().max(160).optional(),
  employee_no: z.string().trim().max(40).optional(),
  phone: z.string().trim().max(40).optional(),
  bio: z.string().trim().max(600).optional(),
  skills: z.string().trim().max(400).optional(),
})

const clean = (v: string | undefined) => (v && v.length > 0 ? v : null)

export async function updateProfile(
  _prev: ProfileState,
  formData: FormData
): Promise<ProfileState> {
  const parsed = schema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { status: 'error' }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { status: 'error' }

  const skills = (parsed.data.skills ?? '')
    .split(/[،,]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 20)

  const { error } = await supabase
    .from('profiles')
    .update({
      full_name_ar: clean(parsed.data.full_name_ar),
      full_name_en: clean(parsed.data.full_name_en),
      job_title: clean(parsed.data.job_title),
      department: clean(parsed.data.department),
      sector: clean(parsed.data.sector),
      work_location: clean(parsed.data.work_location),
      employee_no: clean(parsed.data.employee_no),
      phone: clean(parsed.data.phone),
      bio: clean(parsed.data.bio),
      skills,
      onboarded_at: new Date().toISOString(),
    })
    .eq('id', user.id)

  if (error) return { status: 'error' }

  revalidatePath('/me')
  return { status: 'success' }
}
