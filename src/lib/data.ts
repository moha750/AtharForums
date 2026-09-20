import { createClient } from '@/lib/supabase/server'
import {
  fixtureEvents,
  fixtureForums,
  fixtureMembers,
  fixturePosts,
  fixtureStats,
  previewMode,
} from '@/lib/fixtures'
import type {
  AtharEvent,
  Forum,
  ForumMemberPublic,
  ForumMembership,
  PlatformStats,
  Post,
} from '@/lib/database.types'

export async function getPublishedForums(): Promise<Forum[]> {
  if (previewMode) return fixtureForums
  const supabase = await createClient()
  const { data } = await supabase
    .from('forums')
    .select('*')
    .eq('status', 'published')
    .order('sort_order', { ascending: true })
  return (data as Forum[]) ?? []
}

export async function getForumBySlug(slug: string): Promise<Forum | null> {
  if (previewMode) return fixtureForums.find((f) => f.slug === slug) ?? null
  const supabase = await createClient()
  const { data } = await supabase.from('forums').select('*').eq('slug', slug).maybeSingle()
  return (data as Forum) ?? null
}

export async function getForumMembers(slug: string): Promise<ForumMemberPublic[]> {
  if (previewMode) return fixtureMembers
  const supabase = await createClient()
  const { data } = await supabase.rpc('forum_members_public', { target_slug: slug })
  return (data as ForumMemberPublic[]) ?? []
}

export async function getMyMembership(forumId: string): Promise<ForumMembership | null> {
  if (previewMode) return null
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('forum_memberships')
    .select('*')
    .eq('forum_id', forumId)
    .eq('profile_id', user.id)
    .maybeSingle()
  return (data as ForumMembership) ?? null
}

export async function getMyMemberships(): Promise<Array<ForumMembership & { forums: Forum }>> {
  if (previewMode) return []
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return []

  const { data } = await supabase
    .from('forum_memberships')
    .select('*, forums(*)')
    .eq('profile_id', user.id)
    .order('applied_at', { ascending: false })
  return (data as unknown as Array<ForumMembership & { forums: Forum }>) ?? []
}

export async function getUpcomingEvents(limit = 6, forumId?: string): Promise<AtharEvent[]> {
  if (previewMode)
    return fixtureEvents.filter((e) => !forumId || e.forum_id === forumId).slice(0, limit)
  const supabase = await createClient()
  let query = supabase
    .from('events')
    .select('*')
    .eq('status', 'published')
    .gte('starts_at', new Date().toISOString())
    .order('starts_at', { ascending: true })
    .limit(limit)
  if (forumId) query = query.eq('forum_id', forumId)
  const { data } = await query
  return (data as AtharEvent[]) ?? []
}

export async function getPublishedPosts(limit = 6, forumId?: string): Promise<Post[]> {
  if (previewMode)
    return fixturePosts.filter((p) => !forumId || p.forum_id === forumId).slice(0, limit)
  const supabase = await createClient()
  let query = supabase
    .from('posts')
    .select('*')
    .eq('status', 'published')
    .order('published_at', { ascending: false })
    .limit(limit)
  if (forumId) query = query.eq('forum_id', forumId)
  const { data } = await query
  return (data as Post[]) ?? []
}

export async function getPlatformStats(): Promise<PlatformStats> {
  if (previewMode) return fixtureStats
  const supabase = await createClient()
  const { data } = await supabase.rpc('platform_stats')
  const fallback: PlatformStats = { forums: 0, members: 0, events: 0, upcoming_events: 0 }
  if (!data) return fallback
  return { ...fallback, ...(data as unknown as PlatformStats) }
}

export async function getEventBySlug(slug: string): Promise<AtharEvent | null> {
  if (previewMode) return fixtureEvents.find((e) => e.slug === slug) ?? null
  const supabase = await createClient()
  const { data } = await supabase.from('events').select('*').eq('slug', slug).maybeSingle()
  return (data as AtharEvent) ?? null
}

export async function getPastEvents(limit = 12): Promise<AtharEvent[]> {
  if (previewMode) return []
  const supabase = await createClient()
  const { data } = await supabase
    .from('events')
    .select('*')
    .eq('status', 'published')
    .lt('starts_at', new Date().toISOString())
    .order('starts_at', { ascending: false })
    .limit(limit)
  return (data as AtharEvent[]) ?? []
}

export async function getPostBySlug(slug: string): Promise<Post | null> {
  if (previewMode) return fixturePosts.find((p) => p.slug === slug) ?? null
  const supabase = await createClient()
  const { data } = await supabase.from('posts').select('*').eq('slug', slug).maybeSingle()
  return (data as Post) ?? null
}

export async function getForumsById(ids: string[]): Promise<Map<string, Forum>> {
  const unique = [...new Set(ids.filter(Boolean))]
  if (unique.length === 0) return new Map()
  if (previewMode) {
    return new Map(fixtureForums.filter((f) => unique.includes(f.id)).map((f) => [f.id, f]))
  }
  const supabase = await createClient()
  const { data } = await supabase.from('forums').select('*').in('id', unique)
  return new Map(((data as Forum[]) ?? []).map((f) => [f.id, f]))
}

export async function getMyEventRegistrations(): Promise<
  Array<{ id: string; status: string; events: AtharEvent }>
> {
  if (previewMode) return []
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return []
  const { data } = await supabase
    .from('event_registrations')
    .select('id, status, events(*)')
    .eq('profile_id', user.id)
    .order('created_at', { ascending: false })
  return (data as unknown as Array<{ id: string; status: string; events: AtharEvent }>) ?? []
}
