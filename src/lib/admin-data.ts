import 'server-only'

import { createClient } from '@/lib/supabase/server'
import {
  fixtureApplications,
  fixtureEvents,
  fixtureForums,
  fixturePosts,
  fixtureSettings,
  fixtureWaitlist,
  previewMode,
} from '@/lib/fixtures'
import type {
  AtharEvent,
  Forum,
  ForumMembership,
  Post,
  Profile,
  WaitlistSubscriber,
} from '@/lib/database.types'

export type ApplicationRow = ForumMembership & {
  forums: Pick<Forum, 'id' | 'slug' | 'name_ar' | 'name_en'> | null
  profiles: Pick<
    Profile,
    'id' | 'email' | 'full_name_ar' | 'full_name_en' | 'job_title' | 'department' | 'skills'
  > | null
}

const MEMBER_SELECT =
  '*, forums(id, slug, name_ar, name_en), profiles(id, email, full_name_ar, full_name_en, job_title, department, skills)'

export async function adminForums(): Promise<Forum[]> {
  if (previewMode) return fixtureForums
  const supabase = await createClient()
  const { data } = await supabase
    .from('forums')
    .select('*')
    .order('sort_order', { ascending: true })
  return (data as Forum[]) ?? []
}

export async function adminForum(id: string): Promise<Forum | null> {
  if (previewMode) return fixtureForums.find((f) => f.id === id) ?? null
  const supabase = await createClient()
  const { data } = await supabase.from('forums').select('*').eq('id', id).maybeSingle()
  return (data as Forum) ?? null
}

export async function adminApplications(): Promise<ApplicationRow[]> {
  if (previewMode) return fixtureApplications as unknown as ApplicationRow[]
  const supabase = await createClient()
  const { data } = await supabase
    .from('forum_memberships')
    .select(MEMBER_SELECT)
    .eq('status', 'pending')
    .order('applied_at', { ascending: true })
  return (data as unknown as ApplicationRow[]) ?? []
}

export async function adminMembers(forumId?: string): Promise<ApplicationRow[]> {
  if (previewMode)
    return fixtureApplications.map((a) => ({ ...a, status: 'approved' as const })) as unknown as ApplicationRow[]
  const supabase = await createClient()
  let query = supabase
    .from('forum_memberships')
    .select(MEMBER_SELECT)
    .eq('status', 'approved')
    .order('decided_at', { ascending: false })
  if (forumId) query = query.eq('forum_id', forumId)
  const { data } = await query
  return (data as unknown as ApplicationRow[]) ?? []
}

export async function adminEvents(): Promise<AtharEvent[]> {
  if (previewMode) return fixtureEvents
  const supabase = await createClient()
  const { data } = await supabase
    .from('events')
    .select('*')
    .order('starts_at', { ascending: false })
  return (data as AtharEvent[]) ?? []
}

export async function adminEvent(id: string): Promise<AtharEvent | null> {
  if (previewMode) return fixtureEvents.find((e) => e.id === id) ?? null
  const supabase = await createClient()
  const { data } = await supabase.from('events').select('*').eq('id', id).maybeSingle()
  return (data as AtharEvent) ?? null
}

export async function adminPosts(): Promise<Post[]> {
  if (previewMode) return fixturePosts
  const supabase = await createClient()
  const { data } = await supabase
    .from('posts')
    .select('*')
    .order('created_at', { ascending: false })
  return (data as Post[]) ?? []
}

export async function adminPost(id: string): Promise<Post | null> {
  if (previewMode) return fixturePosts.find((p) => p.id === id) ?? null
  const supabase = await createClient()
  const { data } = await supabase.from('posts').select('*').eq('id', id).maybeSingle()
  return (data as Post) ?? null
}

export async function adminWaitlist(): Promise<WaitlistSubscriber[]> {
  if (previewMode) return fixtureWaitlist
  const supabase = await createClient()
  const { data } = await supabase
    .from('waitlist_subscribers')
    .select('*')
    .order('created_at', { ascending: false })
  return (data as WaitlistSubscriber[]) ?? []
}

export async function adminSettings() {
  if (previewMode)
    return {
      ...fixtureSettings,
      id: true,
      bootstrap_admin_emails: ['admin@hrsd.gov.sa'],
      updated_at: '2026-09-01T00:00:00Z',
      updated_by: null,
    }
  const supabase = await createClient()
  const { data } = await supabase.from('site_settings').select('*').eq('id', true).maybeSingle()
  return data
}

export async function adminOverview() {
  if (previewMode)
    return { forums: fixtureForums.length, pending: 1, members: 177, waitlist: 2 }
  const supabase = await createClient()
  const [forums, pending, members, waitlist] = await Promise.all([
    supabase.from('forums').select('id', { count: 'exact', head: true }).eq('status', 'published'),
    supabase
      .from('forum_memberships')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending'),
    supabase
      .from('forum_memberships')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'approved'),
    supabase.from('waitlist_subscribers').select('id', { count: 'exact', head: true }),
  ])

  return {
    forums: forums.count ?? 0,
    pending: pending.count ?? 0,
    members: members.count ?? 0,
    waitlist: waitlist.count ?? 0,
  }
}
