import 'server-only'

import { createClient } from '@/lib/supabase/server'
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
  const supabase = await createClient()
  const { data } = await supabase
    .from('forums')
    .select('*')
    .order('sort_order', { ascending: true })
  return (data as Forum[]) ?? []
}

export async function adminForum(id: string): Promise<Forum | null> {
  const supabase = await createClient()
  const { data } = await supabase.from('forums').select('*').eq('id', id).maybeSingle()
  return (data as Forum) ?? null
}

export async function adminApplications(): Promise<ApplicationRow[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('forum_memberships')
    .select(MEMBER_SELECT)
    .eq('status', 'pending')
    .order('applied_at', { ascending: true })
  return (data as unknown as ApplicationRow[]) ?? []
}

export async function adminMembers(forumId?: string): Promise<ApplicationRow[]> {
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
  const supabase = await createClient()
  const { data } = await supabase
    .from('events')
    .select('*')
    .order('starts_at', { ascending: false })
  return (data as AtharEvent[]) ?? []
}

export async function adminEvent(id: string): Promise<AtharEvent | null> {
  const supabase = await createClient()
  const { data } = await supabase.from('events').select('*').eq('id', id).maybeSingle()
  return (data as AtharEvent) ?? null
}

export async function adminPosts(): Promise<Post[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('posts')
    .select('*')
    .order('created_at', { ascending: false })
  return (data as Post[]) ?? []
}

export async function adminPost(id: string): Promise<Post | null> {
  const supabase = await createClient()
  const { data } = await supabase.from('posts').select('*').eq('id', id).maybeSingle()
  return (data as Post) ?? null
}

export async function adminWaitlist(): Promise<WaitlistSubscriber[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('waitlist_subscribers')
    .select('*')
    .order('created_at', { ascending: false })
  return (data as WaitlistSubscriber[]) ?? []
}

export async function adminSettings() {
  const supabase = await createClient()
  const { data } = await supabase.from('site_settings').select('*').eq('id', true).maybeSingle()
  return data
}

export async function adminOverview() {
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
