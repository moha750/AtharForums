import { cache } from 'react'

import { createClient } from '@/lib/supabase/server'
import { getCurrentProfile } from '@/lib/auth'
import { FILE_BUCKET } from '@/lib/qr/config'
import type {
  AppPermission,
  QrCampaign,
  QrCampaignListItem,
  QrCampaignShare,
  QrLink,
  QrLinkAccess,
  QrLinkEvent,
  QrLinkListItem,
  QrLinkShare,
  QrOverseeEvent,
  QrOverseeLink,
  QrPerson,
  QrSchedule,
  QrStats,
  QrAccess,
} from '@/lib/database.types'

/**
 * قراءة بيانات الباركود — بجلسة المستخدم دائمًا، فسياسات الصفوف هي التي
 * تقرّر ما يُرى. لا شيء هنا يتجاوزها.
 */

export type QrPermissions = { use: boolean; oversee: boolean; org: boolean; any: boolean }

export const getQrPermissions = cache(async (): Promise<QrPermissions> => {
  const none = { use: false, oversee: false, org: false, any: false }
  const profile = await getCurrentProfile()
  if (!profile || !profile.is_active) return none
  const supabase = await createClient()
  const { data } = await supabase
    .from('profile_permissions')
    .select('permission')
    .eq('profile_id', profile.id)
  const set = new Set<AppPermission>((data ?? []).map((row) => row.permission as AppPermission))
  const use = set.has('use_qr_generator')
  const oversee = set.has('oversee_qr')
  return { use, oversee, org: set.has('qr_org_account'), any: use || oversee }
})

export async function customCodesEnabled(): Promise<boolean> {
  const supabase = await createClient()
  const { data } = await supabase.rpc('qr_custom_codes_enabled')
  return data === true
}

export async function myLinks(): Promise<QrLinkListItem[]> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('qr_my_links')
  if (error) console.error('[qr] myLinks', error)
  return (data as QrLinkListItem[] | null) ?? []
}

export async function myCampaigns(): Promise<QrCampaignListItem[]> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('qr_my_campaigns')
  if (error) console.error('[qr] myCampaigns', error)
  return (data as QrCampaignListItem[] | null) ?? []
}

export type LinkWithAccess = { link: QrLink; access: QrLinkAccess }

/** null للمعدوم ولملك الغير سواء — رسالة واحدة «لم يُعثر على الباركود». */
export async function getLink(id: string): Promise<LinkWithAccess | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null
  const supabase = await createClient()
  const [{ data: link }, { data: access }] = await Promise.all([
    supabase.from('qr_links').select('*').eq('id', id).maybeSingle(),
    supabase.rpc('qr_link_access', { p_link: id }),
  ])
  if (!link || !access) return null
  return { link: link as QrLink, access: access as QrLinkAccess }
}

export async function linkSchedules(id: string): Promise<QrSchedule[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('qr_schedules')
    .select('*')
    .eq('link_id', id)
    .order('starts_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
  return (data as QrSchedule[] | null) ?? []
}

export async function linkShares(id: string): Promise<QrLinkShare[]> {
  const supabase = await createClient()
  const { data } = await supabase.from('qr_link_shares').select('*').eq('link_id', id).order('created_at')
  return (data as QrLinkShare[] | null) ?? []
}

export async function linkEvents(id: string, limit = 40): Promise<QrLinkEvent[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('qr_link_events')
    .select('*')
    .eq('link_id', id)
    .order('at', { ascending: false })
    .order('id', { ascending: false })
    .limit(limit)
  return (data as QrLinkEvent[] | null) ?? []
}

export async function people(ids: Array<string | null | undefined>): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter((id): id is string => Boolean(id)))]
  const map = new Map<string, string>()
  if (unique.length === 0) return map
  const supabase = await createClient()
  const { data } = await supabase.rpc('qr_people', { p_ids: unique })
  for (const person of (data as QrPerson[] | null) ?? []) map.set(person.id, person.name)
  return map
}

export async function shareCandidates(): Promise<QrPerson[]> {
  const supabase = await createClient()
  const { data } = await supabase.rpc('qr_share_candidates')
  return (data as QrPerson[] | null) ?? []
}

export async function generatorHolders(): Promise<QrPerson[]> {
  const supabase = await createClient()
  const { data } = await supabase.rpc('qr_generator_holders')
  return (data as QrPerson[] | null) ?? []
}

export type CampaignWithAccess = { campaign: QrCampaign; access: QrAccess }

export async function getCampaign(id: string): Promise<CampaignWithAccess | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null
  const supabase = await createClient()
  const [{ data: campaign }, { data: access }] = await Promise.all([
    supabase.from('qr_campaigns').select('*').eq('id', id).maybeSingle(),
    supabase.rpc('campaign_access', { p_campaign: id }),
  ])
  if (!campaign || !access) return null
  return { campaign: campaign as QrCampaign, access: access as QrAccess }
}

export async function campaignLinks(id: string): Promise<Array<Omit<QrLink, 'spec'>>> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('qr_links')
    .select('id, code, title, kind, target_url, file_path, owner_id, campaign_id, active, scan_count, created_at, updated_at')
    .eq('campaign_id', id)
    .order('scan_count', { ascending: false })
    .order('created_at', { ascending: false })
  return (data as Array<Omit<QrLink, 'spec'>> | null) ?? []
}

export async function campaignShares(id: string): Promise<QrCampaignShare[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('qr_campaign_shares')
    .select('*')
    .eq('campaign_id', id)
    .order('created_at')
  return (data as QrCampaignShare[] | null) ?? []
}

export async function linkStats(id: string, from: Date | null, to: Date | null): Promise<QrStats | null> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('qr_link_stats', {
    p_link: id,
    p_from: from?.toISOString() ?? null,
    p_to: to?.toISOString() ?? null,
  })
  if (error) {
    console.error('[qr] linkStats', error)
    return null
  }
  return data as unknown as QrStats
}

/**
 * كنس الملفّات اليتيمة بجلسة المشرف (لا مفتاح يتجاوز الأمان يكنسها في
 * الخلفية): ما خرج من صفّه ولم يُمحَ. فارغ في الغالب، فلا يكلّف الصفحة شيئًا.
 */
export async function sweepTrash(): Promise<void> {
  const supabase = await createClient()
  const { data } = await supabase.rpc('qr_trash_sweep', { p_limit: 50 })
  const paths = (data as string[] | null) ?? []
  if (paths.length === 0) return
  const { error } = await supabase.storage.from(FILE_BUCKET).remove(paths)
  if (error) console.error('[qr] trash sweep', error)
}

export async function overseeLinks(): Promise<QrOverseeLink[]> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('qr_oversee_links')
  if (error) console.error('[qr] overseeLinks', error)
  return (data as QrOverseeLink[] | null) ?? []
}

export async function overseeEvents(limit = 60): Promise<QrOverseeEvent[]> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('qr_oversee_events', { p_limit: limit })
  if (error) console.error('[qr] overseeEvents', error)
  return (data as QrOverseeEvent[] | null) ?? []
}
