'use server'

import { revalidatePath } from 'next/cache'
import { after } from 'next/server'

import { createClient } from '@/lib/supabase/server'
import { getCurrentProfile, isAdmin } from '@/lib/auth'
import { previewMode } from '@/lib/fixtures'
import type { AppPermission, QrLink, QrShareAccess } from '@/lib/database.types'
import { drainAlerts } from '@/lib/qr/alerts'
import { customCodeIssue, generateCode, normalizeCustomCode, type CustomCodeIssue } from '@/lib/qr/code'
import {
  CAMPAIGN_NOTE_MAX,
  CODE_MAX_ATTEMPTS,
  FILE_BUCKET,
  FILE_IMAGE_MAX,
  FILE_PDF_MAX,
  NOTE_MAX,
  TITLE_MAX,
} from '@/lib/qr/config'
import { MIME_EXT, filePathOwner, isFilePath } from '@/lib/qr/file-path'
import { qrOrigin, shortLink, viewLink } from '@/lib/qr/origin'
import { defaultSpec } from '@/lib/qr/spec'
import { validateTarget } from '@/lib/qr/target'
import { zonedToUtc } from '@/lib/qr/time'

/**
 * أفعال الباركود — كلها بجلسة المستخدم، فسياسات الصفوف والحرّاس في القاعدة
 * هي الحَكَم الأخير. ما هنا يعطي رسالة واضحة قبل أن تصل القاعدة، لا بدلًا منها.
 *
 * كل فعل يُرجع { ok } أو { ok: false, error } بمفتاح رسالة تترجمه الواجهة.
 */

export type QrActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string }

const ok = <T>(data: T): QrActionResult<T> => ({ ok: true, data })
const fail = (error: string): QrActionResult<never> => ({ ok: false, error })

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const PERMISSIONS: AppPermission[] = ['use_qr_generator', 'oversee_qr', 'qr_org_account']

type PgError = { code?: string; message?: string } | null

/** خطأ القاعدة ← مفتاح رسالة. */
function dbError(error: PgError, fallback = 'generic'): string {
  if (!error) return fallback
  if (error.code === '42501') return 'forbidden'
  if (error.code === 'P0002' || error.code === 'PGRST116') return 'not-found'
  if (error.code === '54000') return 'rate'
  if (error.code === '23505') return error.message?.includes('code') ? 'code-taken' : 'duplicate'
  if (error.code === '23514' || error.code === '22023' || error.code === '23503') return 'invalid'
  console.error('[qr]', error)
  return fallback
}

async function session() {
  if (previewMode) return null
  const profile = await getCurrentProfile()
  if (!profile || !profile.is_active) return null
  const supabase = await createClient()
  return { profile, supabase }
}

type Session = NonNullable<Awaited<ReturnType<typeof session>>>

async function withPermission(permission: AppPermission): Promise<Session | null> {
  const s = await session()
  if (!s) return null
  const { data } = await s.supabase
    .from('profile_permissions')
    .select('permission')
    .eq('profile_id', s.profile.id)
    .eq('permission', permission)
    .maybeSingle()
  return data ? s : null
}

function refresh() {
  revalidatePath('/[locale]/qr', 'layout')
}

/**
 * التنبيه بعد الاستجابة: لا يُبطئ الحفظ، ولا ينتظر المُجدوِل. وحتى إن كان
 * الإرسال مطفأً يُحسم الصفّ (off) ليعرف المشرف أن أحدًا لم يُبلَّغ.
 */
function scheduleAlerts() {
  after(() => drainAlerts().catch((error) => console.error('[qr] alerts', error)))
}

function cleanTitle(raw: unknown): string | null {
  const title = String(raw ?? '').replace(/\s+/g, ' ').trim()
  return title.length >= 1 && title.length <= TITLE_MAX ? title : null
}

async function removeFile(s: Session, path: string | null | undefined) {
  if (!path || !isFilePath(path)) return
  const { error } = await s.supabase.storage.from(FILE_BUCKET).remove([path])
  if (error) console.error('[qr] تعذّر محو الملف', path, error)
}

/* ── الرمز ─────────────────────────────────────────────────────────────────── */

export type CodeCheck =
  | { state: 'available'; code: string }
  | { state: 'taken'; code: string }
  | { state: 'invalid'; code: string; issue: CustomCodeIssue }
  | { state: 'disabled'; code: string }

/** فحص التوفّر اللحظي: وجودٌ فقط، لأن السياسات تخفي رموز الآخرين. */
export async function checkCode(raw: string): Promise<CodeCheck> {
  const code = normalizeCustomCode(String(raw ?? ''))
  const issue = customCodeIssue(code)
  if (issue) return { state: 'invalid', code, issue }
  const s = await withPermission('use_qr_generator')
  if (!s) return { state: 'disabled', code }
  const { data: enabled } = await s.supabase.rpc('qr_custom_codes_enabled')
  if (!enabled) return { state: 'disabled', code }
  const { data: taken } = await s.supabase.rpc('qr_code_taken', { p_code: code })
  return taken ? { state: 'taken', code } : { state: 'available', code }
}

/* ── الرفع ─────────────────────────────────────────────────────────────────── */

/**
 * يفحص الصلاحية والنوع والحجم، ويصكّ المسار {userId}/{uuid}.{ext}، ويُرجع
 * رابط رفع موقَّعًا. المتصفّح يرفع مباشرةً ثم يُرسل المسار.
 */
export async function prepareUpload(
  mime: string,
  bytes: number
): Promise<QrActionResult<{ path: string; token: string }>> {
  const s = await withPermission('use_qr_generator')
  if (!s) return fail('forbidden')
  const ext = MIME_EXT[mime]
  if (!ext) return fail('file-type')
  if (!Number.isInteger(bytes) || bytes <= 0) return fail('file-size')
  if (bytes > (ext === 'pdf' ? FILE_PDF_MAX : FILE_IMAGE_MAX)) return fail('file-size')

  const { data: path, error } = await s.supabase.rpc('qr_issue_upload_ticket', {
    p_mime: mime,
    p_bytes: bytes,
  })
  if (error || !path) return fail(dbError(error, 'upload'))

  const { data, error: signError } = await s.supabase.storage
    .from(FILE_BUCKET)
    .createSignedUploadUrl(path as string)
  if (signError || !data) {
    console.error('[qr] createSignedUploadUrl', signError)
    return fail('upload')
  }
  return ok({ path: data.path, token: data.token })
}

/** رفعٌ لم يكتمل حفظه: يُمحى. القاعدة لا تسمح إلا بملفّ المستخدم غير المرتبط. */
export async function discardUpload(path: string): Promise<QrActionResult<undefined>> {
  const s = await session()
  if (!s) return fail('forbidden')
  if (!isFilePath(path) || filePathOwner(path) !== s.profile.id) return fail('invalid')
  await removeFile(s, path)
  return ok(undefined)
}

/* ── الإنشاء ───────────────────────────────────────────────────────────────── */

export type CreateInput = {
  title: string
  kind: 'link' | 'file'
  target?: string
  filePath?: string
  customCode?: string
  campaignId?: string | null
}

export async function createLink(input: CreateInput): Promise<QrActionResult<{ id: string }>> {
  const s = await withPermission('use_qr_generator')
  const uploaded = input.kind === 'file' ? input.filePath : undefined
  const abort = async (error: string) => {
    // أي فشل بعد الرفع يمحو المرفوع
    if (s && uploaded && isFilePath(uploaded) && filePathOwner(uploaded) === s.profile.id) {
      await removeFile(s, uploaded)
    }
    return fail(error)
  }
  if (!s) return fail('forbidden')

  const title = cleanTitle(input.title)
  if (!title) return abort('title')

  let target: string | null = null
  if (input.kind === 'link') {
    const checked = validateTarget(String(input.target ?? ''), qrOrigin())
    if (!checked.ok) return abort(`target-${checked.issue}`)
    target = checked.url
  } else if (input.kind === 'file') {
    if (!uploaded || !isFilePath(uploaded) || filePathOwner(uploaded) !== s.profile.id) {
      return abort('file-missing')
    }
  } else {
    return abort('invalid')
  }

  let campaignId: string | null = null
  if (input.campaignId) {
    if (!UUID.test(input.campaignId)) return abort('campaign')
    const { data: access } = await s.supabase.rpc('campaign_access', { p_campaign: input.campaignId })
    if (access !== 'owner') return abort('campaign')
    campaignId = input.campaignId
  }

  const custom = input.customCode?.trim() ? normalizeCustomCode(input.customCode) : null
  if (custom) {
    const issue = customCodeIssue(custom)
    if (issue) return abort(`code-${issue}`)
    const { data: enabled } = await s.supabase.rpc('qr_custom_codes_enabled')
    if (!enabled) return abort('code-disabled')
  }

  // المولَّد يُعاد حتى ٧ مرّات عند التصادم، والمختار له محاولة واحدة.
  // قيد التفرّد في القاعدة هو الحَكَم، لا فحصٌ مسبق قد يسبقه غيرنا.
  const attempts = custom ? 1 : CODE_MAX_ATTEMPTS
  for (let attempt = 0; attempt < attempts; attempt++) {
    const code = custom ?? generateCode()
    const { data, error } = await s.supabase
      .from('qr_links')
      .insert({
        code,
        title,
        kind: input.kind,
        target_url: input.kind === 'file' ? viewLink(code) : target!,
        file_path: input.kind === 'file' ? uploaded! : null,
        spec: defaultSpec(shortLink(code)),
        owner_id: s.profile.id,
        campaign_id: campaignId,
      })
      .select('id')
      .single()

    if (!error && data) {
      refresh()
      return ok({ id: data.id as string })
    }
    const codeClash = error?.code === '23505' && error.message?.includes('qr_links_code_key')
    if (!codeClash) return abort(dbError(error))
    if (custom) return abort('code-taken')
  }
  return abort('code-exhausted')
}

/* ── التعديل ──────────────────────────────────────────────────────────────── */

async function loadForEdit(s: Session, id: string) {
  if (!UUID.test(id)) return null
  const { data } = await s.supabase
    .from('qr_links')
    .select('id, code, kind, file_path, owner_id')
    .eq('id', id)
    .maybeSingle()
  return data as { id: string; code: string; kind: 'link' | 'file'; file_path: string | null; owner_id: string } | null
}

/** تحديث يُرجع صفًّا أو لا شيء — صفر صفوف يعني أن السياسة رفضت بصمت. */
async function updateLink(s: Session, id: string, values: Partial<QrLink>) {
  const { data, error } = await s.supabase.from('qr_links').update(values).eq('id', id).select('id')
  if (error) return dbError(error)
  if (!data || data.length === 0) return 'forbidden'
  return null
}

export async function renameLink(id: string, rawTitle: string): Promise<QrActionResult<undefined>> {
  const s = await withPermission('use_qr_generator')
  if (!s) return fail('forbidden')
  const title = cleanTitle(rawTitle)
  if (!title) return fail('title')
  const error = await updateLink(s, id, { title })
  if (error) return fail(error)
  refresh()
  return ok(undefined)
}

/** تعديل الوجهة — الفعل الأبرز. الملصق المطبوع لا يتغيّر. */
export async function setLinkTarget(id: string, rawTarget: string): Promise<QrActionResult<undefined>> {
  const s = await withPermission('use_qr_generator')
  if (!s) return fail('forbidden')
  const checked = validateTarget(rawTarget, qrOrigin())
  if (!checked.ok) return fail(`target-${checked.issue}`)

  const link = await loadForEdit(s, id)
  if (!link) return fail('not-found')

  // ملف ← رابط بتحديث واحد: يُفرَّغ المسار، ثم يُمحى الملف بعد قبول القاعدة
  const error = await updateLink(s, id, { kind: 'link', file_path: null, target_url: checked.url })
  if (error) return fail(error)
  if (link.kind === 'file') await removeFile(s, link.file_path)
  scheduleAlerts()
  refresh()
  return ok(undefined)
}

/** رابط ← ملف، أو استبدال الملف: الجديد يُكتب أولًا، والقديم يُمحى بعد القبول. */
export async function setLinkFile(id: string, path: string): Promise<QrActionResult<undefined>> {
  const s = await withPermission('use_qr_generator')
  const abort = async (error: string) => {
    if (s && isFilePath(path) && filePathOwner(path) === s.profile.id) await removeFile(s, path)
    return fail(error)
  }
  if (!s) return fail('forbidden')
  if (!isFilePath(path) || filePathOwner(path) !== s.profile.id) return abort('file-missing')

  const link = await loadForEdit(s, id)
  if (!link) return abort('not-found')

  const error = await updateLink(s, id, { kind: 'file', file_path: path, target_url: viewLink(link.code) })
  if (error) return abort(error)
  if (link.file_path && link.file_path !== path) await removeFile(s, link.file_path)
  if (link.kind === 'link') scheduleAlerts()
  refresh()
  return ok(undefined)
}

export async function setLinkActive(id: string, active: boolean): Promise<QrActionResult<undefined>> {
  const s = await withPermission('use_qr_generator')
  if (!s) return fail('forbidden')
  const error = await updateLink(s, id, { active: Boolean(active) })
  if (error) return fail(error)
  refresh()
  return ok(undefined)
}

/** الحذف نهائي: يأخذ معه المسحات والجدولة والملف. واقعته تبقى في السجل. */
export async function deleteLink(id: string): Promise<QrActionResult<undefined>> {
  const s = await withPermission('use_qr_generator')
  if (!s) return fail('forbidden')
  const link = await loadForEdit(s, id)
  if (!link || link.owner_id !== s.profile.id) return fail('not-found')
  const { data, error } = await s.supabase.from('qr_links').delete().eq('id', id).select('id')
  if (error) return fail(dbError(error))
  if (!data || data.length === 0) return fail('forbidden')
  await removeFile(s, link.file_path)
  refresh()
  return ok(undefined)
}

/* ── الجدولة ──────────────────────────────────────────────────────────────── */

export type ScheduleInput = { target: string; starts: string; ends: string; note: string }

function parseSchedule(input: ScheduleInput):
  | { ok: true; values: { target_url: string; starts_at: string | null; ends_at: string | null; note: string | null } }
  | { ok: false; error: string } {
  const checked = validateTarget(input.target, qrOrigin())
  if (!checked.ok) return { ok: false, error: `target-${checked.issue}` }
  const starts = input.starts ? zonedToUtc(input.starts) : null
  const ends = input.ends ? zonedToUtc(input.ends) : null
  if ((input.starts && !starts) || (input.ends && !ends)) return { ok: false, error: 'window' }
  if (starts && ends && ends <= starts) return { ok: false, error: 'window' }
  const note = input.note.replace(/\s+/g, ' ').trim()
  if (note.length > NOTE_MAX) return { ok: false, error: 'note' }
  return {
    ok: true,
    values: {
      target_url: checked.url,
      starts_at: starts?.toISOString() ?? null,
      ends_at: ends?.toISOString() ?? null,
      note: note || null,
    },
  }
}

export async function addSchedule(linkId: string, input: ScheduleInput): Promise<QrActionResult<undefined>> {
  const s = await withPermission('use_qr_generator')
  if (!s) return fail('forbidden')
  if (!UUID.test(linkId)) return fail('not-found')
  const parsed = parseSchedule(input)
  if (!parsed.ok) return fail(parsed.error)
  const { error } = await s.supabase.from('qr_schedules').insert({ link_id: linkId, ...parsed.values })
  if (error) return fail(dbError(error))
  scheduleAlerts()
  refresh()
  return ok(undefined)
}

export async function updateSchedule(id: string, input: ScheduleInput): Promise<QrActionResult<undefined>> {
  const s = await withPermission('use_qr_generator')
  if (!s) return fail('forbidden')
  if (!UUID.test(id)) return fail('not-found')
  const parsed = parseSchedule(input)
  if (!parsed.ok) return fail(parsed.error)
  const { data, error } = await s.supabase.from('qr_schedules').update(parsed.values).eq('id', id).select('id')
  if (error) return fail(dbError(error))
  if (!data?.length) return fail('forbidden')
  scheduleAlerts()
  refresh()
  return ok(undefined)
}

export async function deleteSchedule(id: string): Promise<QrActionResult<undefined>> {
  const s = await withPermission('use_qr_generator')
  if (!s) return fail('forbidden')
  if (!UUID.test(id)) return fail('not-found')
  const { data, error } = await s.supabase.from('qr_schedules').delete().eq('id', id).select('id')
  if (error) return fail(dbError(error))
  if (!data?.length) return fail('forbidden')
  refresh()
  return ok(undefined)
}

/* ── المشاركة ─────────────────────────────────────────────────────────────── */

type ShareTarget = { kind: 'link' | 'campaign'; id: string }

function isAccess(value: string): value is QrShareAccess {
  return value === 'read' || value === 'edit'
}

/** الجدولان متماثلان؛ نفرّع صراحةً حتى تبقى الأنواع صادقة. */
function sharesOf(s: Session, target: ShareTarget) {
  return target.kind === 'link'
    ? {
        insert: (userId: string, access: QrShareAccess) =>
          s.supabase.from('qr_link_shares').insert({ link_id: target.id, user_id: userId, access }),
        update: (userId: string, access: QrShareAccess) =>
          s.supabase
            .from('qr_link_shares')
            .update({ access })
            .eq('link_id', target.id)
            .eq('user_id', userId)
            .select('user_id'),
        remove: (userId: string) =>
          s.supabase.from('qr_link_shares').delete().eq('link_id', target.id).eq('user_id', userId).select('user_id'),
      }
    : {
        insert: (userId: string, access: QrShareAccess) =>
          s.supabase.from('qr_campaign_shares').insert({ campaign_id: target.id, user_id: userId, access }),
        update: (userId: string, access: QrShareAccess) =>
          s.supabase
            .from('qr_campaign_shares')
            .update({ access })
            .eq('campaign_id', target.id)
            .eq('user_id', userId)
            .select('user_id'),
        remove: (userId: string) =>
          s.supabase
            .from('qr_campaign_shares')
            .delete()
            .eq('campaign_id', target.id)
            .eq('user_id', userId)
            .select('user_id'),
      }
}

export async function addShare(target: ShareTarget, userId: string, access: string): Promise<QrActionResult<undefined>> {
  const s = await withPermission('use_qr_generator')
  if (!s) return fail('forbidden')
  if (!UUID.test(target.id) || !UUID.test(userId) || !isAccess(access)) return fail('invalid')
  const { error } = await sharesOf(s, target).insert(userId, access)
  if (error) return fail(error.code === '23505' ? 'share-exists' : dbError(error, 'share'))
  refresh()
  return ok(undefined)
}

/** تبديل إذن شريك قائم — فعل مستقلّ برسالته. */
export async function changeShare(target: ShareTarget, userId: string, access: string): Promise<QrActionResult<undefined>> {
  const s = await withPermission('use_qr_generator')
  if (!s) return fail('forbidden')
  if (!UUID.test(target.id) || !UUID.test(userId) || !isAccess(access)) return fail('invalid')
  const { data, error } = await sharesOf(s, target).update(userId, access)
  if (error) return fail(dbError(error, 'share'))
  if (!data?.length) return fail('forbidden')
  refresh()
  return ok(undefined)
}

export async function removeShare(target: ShareTarget, userId: string): Promise<QrActionResult<undefined>> {
  const s = await withPermission('use_qr_generator')
  if (!s) return fail('forbidden')
  if (!UUID.test(target.id) || !UUID.test(userId)) return fail('invalid')
  const { data, error } = await sharesOf(s, target).remove(userId)
  if (error) return fail(dbError(error, 'share'))
  if (!data?.length) return fail('forbidden')
  refresh()
  return ok(undefined)
}

/* ── الحملات ──────────────────────────────────────────────────────────────── */

function cleanCampaign(name: string, note: string) {
  const n = name.replace(/\s+/g, ' ').trim()
  const d = note.replace(/\s+/g, ' ').trim()
  if (n.length < 1 || n.length > TITLE_MAX) return { error: 'campaign-name' as const }
  if (d.length > CAMPAIGN_NOTE_MAX) return { error: 'campaign-note' as const }
  return { name: n, note: d || null }
}

export async function createCampaign(name: string, note: string): Promise<QrActionResult<{ id: string }>> {
  const s = await withPermission('use_qr_generator')
  if (!s) return fail('forbidden')
  const clean = cleanCampaign(name, note)
  if ('error' in clean) return fail(clean.error!)
  const { data, error } = await s.supabase
    .from('qr_campaigns')
    .insert({ name: clean.name, note: clean.note, owner_id: s.profile.id })
    .select('id')
    .single()
  if (error || !data) return fail(dbError(error))
  refresh()
  return ok({ id: data.id as string })
}

export async function updateCampaign(id: string, name: string, note: string): Promise<QrActionResult<undefined>> {
  const s = await withPermission('use_qr_generator')
  if (!s) return fail('forbidden')
  if (!UUID.test(id)) return fail('not-found')
  const clean = cleanCampaign(name, note)
  if ('error' in clean) return fail(clean.error!)
  const { data, error } = await s.supabase
    .from('qr_campaigns')
    .update({ name: clean.name, note: clean.note })
    .eq('id', id)
    .select('id')
  if (error) return fail(dbError(error))
  if (!data?.length) return fail('forbidden')
  refresh()
  return ok(undefined)
}

/** حذف الحملة يُخرج باركوداتها وتبقى تعمل. */
export async function deleteCampaign(id: string): Promise<QrActionResult<undefined>> {
  const s = await withPermission('use_qr_generator')
  if (!s) return fail('forbidden')
  if (!UUID.test(id)) return fail('not-found')
  const { data, error } = await s.supabase.from('qr_campaigns').delete().eq('id', id).select('id')
  if (error) return fail(dbError(error))
  if (!data?.length) return fail('forbidden')
  refresh()
  return ok(undefined)
}

/** الضمّ والإخراج والنقل بين الحملات — جماعيًّا، وللمالك وحده. */
export async function assignLinks(linkIds: string[], campaignId: string | null): Promise<QrActionResult<{ count: number }>> {
  const s = await withPermission('use_qr_generator')
  if (!s) return fail('forbidden')
  const ids = [...new Set(linkIds)].filter((id) => UUID.test(id)).slice(0, 500)
  if (ids.length === 0) return fail('invalid')
  if (campaignId !== null) {
    if (!UUID.test(campaignId)) return fail('campaign')
    const { data: access } = await s.supabase.rpc('campaign_access', { p_campaign: campaignId })
    if (access !== 'owner') return fail('campaign')
  }
  const { data, error } = await s.supabase
    .from('qr_links')
    .update({ campaign_id: campaignId })
    .in('id', ids)
    .eq('owner_id', s.profile.id)
    .select('id')
  if (error) return fail(dbError(error, 'campaign'))
  refresh()
  return ok({ count: data?.length ?? 0 })
}

/* ── الإشراف ──────────────────────────────────────────────────────────────── */

export async function overseeSetActive(id: string, active: boolean): Promise<QrActionResult<undefined>> {
  const s = await withPermission('oversee_qr')
  if (!s) return fail('forbidden')
  if (!UUID.test(id)) return fail('not-found')
  const { error } = await s.supabase.rpc('qr_oversee_set_active', { p_link: id, p_active: Boolean(active) })
  if (error) return fail(dbError(error))
  refresh()
  return ok(undefined)
}

export async function overseeDelete(id: string): Promise<QrActionResult<undefined>> {
  const s = await withPermission('oversee_qr')
  if (!s) return fail('forbidden')
  if (!UUID.test(id)) return fail('not-found')
  const { data: path, error } = await s.supabase.rpc('qr_oversee_delete', { p_link: id })
  if (error) return fail(dbError(error))
  await removeFile(s, path as string | null)
  refresh()
  return ok(undefined)
}

export async function overseeTransfer(id: string, ownerId: string): Promise<QrActionResult<undefined>> {
  const s = await withPermission('oversee_qr')
  if (!s) return fail('forbidden')
  if (!UUID.test(id) || !UUID.test(ownerId)) return fail('invalid')
  const { error } = await s.supabase.rpc('qr_oversee_transfer', { p_link: id, p_owner: ownerId })
  if (error) return fail(error.code === '22023' ? 'transfer-target' : dbError(error))
  refresh()
  return ok(undefined)
}

/* ── منح الصلاحيات (المشرفون) ─────────────────────────────────────────────── */

async function requireAdminSession(): Promise<Session | null> {
  const s = await session()
  return s && isAdmin(s.profile) ? s : null
}

export async function setPermission(
  profileId: string,
  permission: string,
  granted: boolean
): Promise<QrActionResult<undefined>> {
  const s = await requireAdminSession()
  if (!s) return fail('forbidden')
  if (!UUID.test(profileId) || !PERMISSIONS.includes(permission as AppPermission)) return fail('invalid')
  const perm = permission as AppPermission
  const { error } = granted
    ? await s.supabase.from('profile_permissions').insert({ profile_id: profileId, permission: perm })
    : await s.supabase.from('profile_permissions').delete().eq('profile_id', profileId).eq('permission', perm)
  if (error) {
    if (error.code === '23505') return fail(perm === 'qr_org_account' ? 'org-exists' : 'duplicate')
    return fail(dbError(error))
  }
  revalidatePath('/[locale]/admin/qr-access', 'page')
  return ok(undefined)
}

export async function setCustomCodes(enabled: boolean): Promise<QrActionResult<undefined>> {
  const s = await requireAdminSession()
  if (!s) return fail('forbidden')
  const { error } = await s.supabase.from('site_settings').update({ qr_custom_codes: Boolean(enabled) }).eq('id', true)
  if (error) return fail(dbError(error))
  revalidatePath('/[locale]/admin/qr-access', 'page')
  return ok(undefined)
}
