'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCurrentProfile, isAdmin } from '@/lib/auth'

export type AdminState = { status: 'idle' | 'success' | 'error'; message?: string }

const slug = z
  .string()
  .trim()
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'slug')
  .max(120)

const optional = (max: number) => z.string().trim().max(max).optional()
const clean = (v: string | undefined) => (v && v.length > 0 ? v : null)
const listOf = (v: string | undefined, limit = 20) =>
  (v ?? '')
    .split(/[،,]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, limit)

/** اللغة تأتي من النموذج حتى تبقى إعادة التوجيه داخل نفس اللغة. */
function localeOf(formData: FormData): string {
  const value = String(formData.get('locale') ?? '')
  return value === 'en' ? 'en' : 'ar'
}

async function requireAdmin() {
  const profile = await getCurrentProfile()
  if (!isAdmin(profile)) throw new Error('forbidden')
  return profile!
}

/* ── المنتديات ──────────────────────────────────────────────────────────── */

const forumSchema = z.object({
  id: z.string().uuid().optional(),
  slug,
  name_ar: z.string().trim().min(2).max(160),
  name_en: optional(160),
  tagline_ar: optional(200),
  tagline_en: optional(200),
  description_ar: optional(2000),
  description_en: optional(2000),
  mission_ar: optional(2000),
  mission_en: optional(2000),
  icon: optional(60),
  color: z.enum(['teal', 'sage', 'ember']),
  skills: optional(600),
  capacity: optional(8),
  sort_order: optional(8),
  status: z.enum(['draft', 'published', 'archived']),
  auto_approve: z.coerce.boolean().optional(),
  is_accepting: z.coerce.boolean().optional(),
})

export async function saveForum(_prev: AdminState, formData: FormData): Promise<AdminState> {
  try {
    await requireAdmin()
  } catch {
    return { status: 'error', message: 'forbidden' }
  }

  const raw = Object.fromEntries(formData)
  const parsed = forumSchema.safeParse({
    ...raw,
    auto_approve: formData.get('auto_approve') === 'on',
    is_accepting: formData.get('is_accepting') === 'on',
  })
  if (!parsed.success) return { status: 'error', message: 'invalid' }

  const d = parsed.data
  const payload = {
    slug: d.slug,
    name_ar: d.name_ar,
    name_en: clean(d.name_en),
    tagline_ar: clean(d.tagline_ar),
    tagline_en: clean(d.tagline_en),
    description_ar: clean(d.description_ar),
    description_en: clean(d.description_en),
    mission_ar: clean(d.mission_ar),
    mission_en: clean(d.mission_en),
    icon: clean(d.icon) ?? 'Sparkles',
    color: d.color,
    skills: listOf(d.skills),
    capacity: d.capacity && d.capacity !== '' ? Number(d.capacity) : null,
    sort_order: d.sort_order && d.sort_order !== '' ? Number(d.sort_order) : 0,
    status: d.status,
    auto_approve: Boolean(d.auto_approve),
    is_accepting: Boolean(d.is_accepting),
  }

  const supabase = await createClient()
  const { error } = d.id
    ? await supabase.from('forums').update(payload).eq('id', d.id)
    : await supabase.from('forums').insert(payload)

  if (error) {
    return { status: 'error', message: error.code === '23505' ? 'duplicate-slug' : error.message }
  }

  revalidatePath('/', 'layout')
  redirect(`/${localeOf(formData)}/admin/forums`)
}

export async function deleteForum(formData: FormData) {
  await requireAdmin()
  const id = String(formData.get('id') ?? '')
  if (!id) return
  const supabase = await createClient()
  await supabase.from('forums').delete().eq('id', id)
  revalidatePath('/', 'layout')
}

/* ── طلبات الانضمام والأعضاء ────────────────────────────────────────────── */

export async function decideApplication(formData: FormData) {
  const profile = await requireAdmin()
  const id = String(formData.get('id') ?? '')
  const decision = String(formData.get('decision') ?? '')
  if (!id || !['approved', 'rejected'].includes(decision)) return

  const supabase = await createClient()
  await supabase
    .from('forum_memberships')
    .update({
      status: decision as 'approved' | 'rejected',
      decided_at: new Date().toISOString(),
      decided_by: profile.id,
      decision_note: (formData.get('note') as string | null) || null,
    })
    .eq('id', id)

  revalidatePath('/', 'layout')
}

export async function setMembershipRole(formData: FormData) {
  await requireAdmin()
  const id = String(formData.get('id') ?? '')
  const role = String(formData.get('role') ?? '')
  if (!id || !['member', 'core', 'lead'].includes(role)) return

  const supabase = await createClient()
  await supabase
    .from('forum_memberships')
    .update({ role: role as 'member' | 'core' | 'lead' })
    .eq('id', id)
  revalidatePath('/', 'layout')
}

export async function removeMembership(formData: FormData) {
  await requireAdmin()
  const id = String(formData.get('id') ?? '')
  if (!id) return
  const supabase = await createClient()
  await supabase.from('forum_memberships').update({ status: 'removed' }).eq('id', id)
  revalidatePath('/', 'layout')
}

/* ── الإعدادات ──────────────────────────────────────────────────────────── */

const settingsSchema = z.object({
  launch_at: z.string().min(1),
  about_ar: optional(2000),
  about_en: optional(2000),
  contact_email: z.string().trim().email().max(254).or(z.literal('')).optional(),
  allowed_email_domains: z.string().trim().max(400),
})

export async function updateSettings(
  _prev: AdminState,
  formData: FormData
): Promise<AdminState> {
  try {
    await requireAdmin()
  } catch {
    return { status: 'error', message: 'forbidden' }
  }

  const parsed = settingsSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { status: 'error', message: 'invalid' }

  const domains = listOf(parsed.data.allowed_email_domains, 10).map((d) =>
    d.toLowerCase().replace(/^@/, '')
  )
  if (domains.length === 0) return { status: 'error', message: 'domains-required' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('site_settings')
    .update({
      launch_at: new Date(parsed.data.launch_at).toISOString(),
      teaser_mode: formData.get('teaser_mode') === 'on',
      registration_open: formData.get('registration_open') === 'on',
      allowed_email_domains: domains,
      about_ar: clean(parsed.data.about_ar),
      about_en: clean(parsed.data.about_en),
      contact_email: clean(parsed.data.contact_email),
    })
    .eq('id', true)

  if (error) return { status: 'error', message: error.message }

  revalidatePath('/', 'layout')
  return { status: 'success' }
}

/* ── الفعاليات ──────────────────────────────────────────────────────────── */

const eventSchema = z.object({
  id: z.string().uuid().optional(),
  slug,
  forum_id: z.string().uuid().or(z.literal('')).optional(),
  title_ar: z.string().trim().min(2).max(200),
  title_en: optional(200),
  description_ar: optional(3000),
  description_en: optional(3000),
  starts_at: z.string().min(1),
  ends_at: z.string().optional(),
  mode: z.enum(['onsite', 'online', 'hybrid']),
  location_ar: optional(200),
  location_en: optional(200),
  meeting_url: z.string().trim().url().or(z.literal('')).optional(),
  capacity: optional(8),
  status: z.enum(['draft', 'published', 'archived']),
})

export async function saveEvent(_prev: AdminState, formData: FormData): Promise<AdminState> {
  try {
    await requireAdmin()
  } catch {
    return { status: 'error', message: 'forbidden' }
  }

  const parsed = eventSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { status: 'error', message: 'invalid' }
  const d = parsed.data

  const payload = {
    slug: d.slug,
    forum_id: d.forum_id && d.forum_id !== '' ? d.forum_id : null,
    title_ar: d.title_ar,
    title_en: clean(d.title_en),
    description_ar: clean(d.description_ar),
    description_en: clean(d.description_en),
    starts_at: new Date(d.starts_at).toISOString(),
    ends_at: d.ends_at && d.ends_at !== '' ? new Date(d.ends_at).toISOString() : null,
    mode: d.mode,
    location_ar: clean(d.location_ar),
    location_en: clean(d.location_en),
    meeting_url: clean(d.meeting_url),
    capacity: d.capacity && d.capacity !== '' ? Number(d.capacity) : null,
    registration_open: formData.get('registration_open') === 'on',
    members_only: formData.get('members_only') === 'on',
    status: d.status,
  }

  const supabase = await createClient()
  const { error } = d.id
    ? await supabase.from('events').update(payload).eq('id', d.id)
    : await supabase.from('events').insert(payload)

  if (error) {
    return { status: 'error', message: error.code === '23505' ? 'duplicate-slug' : error.message }
  }

  revalidatePath('/', 'layout')
  redirect(`/${localeOf(formData)}/admin/events`)
}

export async function deleteEvent(formData: FormData) {
  await requireAdmin()
  const id = String(formData.get('id') ?? '')
  if (!id) return
  const supabase = await createClient()
  await supabase.from('events').delete().eq('id', id)
  revalidatePath('/', 'layout')
}

/* ── الأخبار ────────────────────────────────────────────────────────────── */

const postSchema = z.object({
  id: z.string().uuid().optional(),
  slug,
  forum_id: z.string().uuid().or(z.literal('')).optional(),
  title_ar: z.string().trim().min(2).max(200),
  title_en: optional(200),
  excerpt_ar: optional(400),
  excerpt_en: optional(400),
  body_ar: optional(20000),
  body_en: optional(20000),
  status: z.enum(['draft', 'published', 'archived']),
  published_at: z.string().optional(),
})

export async function savePost(_prev: AdminState, formData: FormData): Promise<AdminState> {
  let profileId: string
  try {
    const profile = await requireAdmin()
    profileId = profile.id
  } catch {
    return { status: 'error', message: 'forbidden' }
  }

  const parsed = postSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { status: 'error', message: 'invalid' }
  const d = parsed.data

  const payload = {
    slug: d.slug,
    forum_id: d.forum_id && d.forum_id !== '' ? d.forum_id : null,
    title_ar: d.title_ar,
    title_en: clean(d.title_en),
    excerpt_ar: clean(d.excerpt_ar),
    excerpt_en: clean(d.excerpt_en),
    body_ar: clean(d.body_ar),
    body_en: clean(d.body_en),
    status: d.status,
    published_at:
      d.status === 'published'
        ? d.published_at && d.published_at !== ''
          ? new Date(d.published_at).toISOString()
          : new Date().toISOString()
        : null,
    author_id: profileId,
  }

  const supabase = await createClient()
  const { error } = d.id
    ? await supabase.from('posts').update(payload).eq('id', d.id)
    : await supabase.from('posts').insert(payload)

  if (error) {
    return { status: 'error', message: error.code === '23505' ? 'duplicate-slug' : error.message }
  }

  revalidatePath('/', 'layout')
  redirect(`/${localeOf(formData)}/admin/news`)
}

export async function deletePost(formData: FormData) {
  await requireAdmin()
  const id = String(formData.get('id') ?? '')
  if (!id) return
  const supabase = await createClient()
  await supabase.from('posts').delete().eq('id', id)
  revalidatePath('/', 'layout')
}
