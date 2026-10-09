'use client'

import { discardUpload, prepareUpload } from '@/actions/qr'
import { createClient } from '@/lib/supabase/client'
import {
  FILE_BUCKET,
  FILE_IMAGE_EDGE,
  FILE_IMAGE_MAX,
  FILE_IMAGE_SOURCE_MAX,
  FILE_PDF_MAX,
  LOGO_EDGE,
  LOGO_SOURCE_MAX,
} from '@/lib/qr/config'

/**
 * تجهيز الملفات في المتصفّح قبل الرفع.
 *
 * الصورة تُصغَّر إلى ضلع أقصاه ٢٠٤٨ وتُرمَّز WEBP — ومن عجز متصفّحه عن ترميز
 * WEBP (سفاري) فـJPEG على أرض بيضاء، لأن JPEG لا يحمل شفافية فتسودّ.
 * الـPDF يمرّ كما هو. ولا يُرفع شيء هنا: الرفع عند «إنشاء/حفظ» وحده.
 */

export type PreparedFile = { blob: Blob; mime: string; kind: 'image' | 'pdf'; name: string; previewUrl: string | null }

export type FileIssue = 'badType' | 'tooBigImage' | 'tooBigPdf' | 'decodeFailed'

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']

async function decode(file: Blob): Promise<ImageBitmap | HTMLImageElement> {
  try {
    return await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    const url = URL.createObjectURL(file)
    try {
      return await new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image()
        img.onload = () => resolve(img)
        img.onerror = () => reject(new Error('decode'))
        img.src = url
      })
    } finally {
      URL.revokeObjectURL(url)
    }
  }
}

function size(source: ImageBitmap | HTMLImageElement) {
  return 'naturalWidth' in source
    ? { w: source.naturalWidth, h: source.naturalHeight }
    : { w: source.width, h: source.height }
}

function encode(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality))
}

async function draw(
  source: ImageBitmap | HTMLImageElement,
  edge: number,
  background?: string
): Promise<HTMLCanvasElement> {
  const { w, h } = size(source)
  const scale = Math.min(1, edge / Math.max(w, h))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(w * scale))
  canvas.height = Math.max(1, Math.round(h * scale))
  const ctx = canvas.getContext('2d')!
  if (background) {
    ctx.fillStyle = background
    ctx.fillRect(0, 0, canvas.width, canvas.height)
  }
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height)
  return canvas
}

export async function prepareFile(file: File): Promise<PreparedFile | { issue: FileIssue }> {
  if (file.type === 'application/pdf') {
    if (file.size > FILE_PDF_MAX) return { issue: 'tooBigPdf' }
    return { blob: file, mime: 'application/pdf', kind: 'pdf', name: file.name, previewUrl: null }
  }
  if (!IMAGE_TYPES.includes(file.type)) return { issue: 'badType' }
  if (file.size > FILE_IMAGE_SOURCE_MAX) return { issue: 'tooBigImage' }

  let source: ImageBitmap | HTMLImageElement
  try {
    source = await decode(file)
  } catch {
    return { issue: 'decodeFailed' }
  }

  let edge = FILE_IMAGE_EDGE
  for (let round = 0; round < 4; round++) {
    let canvas = await draw(source, edge)
    let blob = await encode(canvas, 'image/webp', 0.86)
    if (!blob || blob.type !== 'image/webp') {
      canvas = await draw(source, edge, '#ffffff')
      blob = await encode(canvas, 'image/jpeg', 0.88)
    }
    if (blob && blob.size <= FILE_IMAGE_MAX) {
      if ('close' in source) source.close()
      return { blob, mime: blob.type, kind: 'image', name: file.name, previewUrl: URL.createObjectURL(blob) }
    }
    edge = Math.round(edge * 0.8)
  }
  return { issue: 'tooBigImage' }
}

/**
 * يرفع ملفًّا مجهّزًا: الخادم يصكّ المسار ويُرجع رابطًا موقَّعًا، والمتصفّح
 * يرفع إليه مباشرةً. يُرجع المسار ليُرسل مع الحفظ.
 */
export async function uploadPrepared(file: PreparedFile): Promise<{ path: string } | { error: string }> {
  const ticket = await prepareUpload(file.mime, file.blob.size)
  if (!ticket.ok) return { error: ticket.error }
  const supabase = createClient()
  const { error } = await supabase.storage
    .from(FILE_BUCKET)
    .uploadToSignedUrl(ticket.data.path, ticket.data.token, file.blob, {
      contentType: file.mime,
      // ساعة لا سنة: الملف المستبدَل أو المحذوف يجب ألّا يبقى في ذاكرة المتصفّحات طويلًا
      cacheControl: '3600',
    })
  if (error) {
    await discardUpload(ticket.data.path).catch(() => undefined)
    return { error: 'upload' }
  }
  return { path: ticket.data.path }
}

/* ── الشعار ───────────────────────────────────────────────────────────────── */

export type LogoIssue = 'logoBadType' | 'logoTooBig' | 'logoFailed'

function readAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

/**
 * الشعار يُضمَّن data URL، ولا يُقبل رابط خارجي. النقطي يُصغَّر إلى ٦٤٠
 * بصيغة WEBP ويبقى الأصل إن كان أخفّ، وSVG يبقى كما هو.
 */
export async function prepareLogo(file: File): Promise<{ href: string } | { issue: LogoIssue }> {
  const types = ['image/png', 'image/svg+xml', 'image/webp', 'image/jpeg']
  if (!types.includes(file.type)) return { issue: 'logoBadType' }
  if (file.size > LOGO_SOURCE_MAX) return { issue: 'logoTooBig' }

  try {
    if (file.type === 'image/svg+xml') {
      const href = await readAsDataUrl(file)
      return { href: href.replace(/^data:image\/svg\+xml[^,]*,/, 'data:image/svg+xml;base64,') }
    }
    const source = await decode(file)
    const canvas = await draw(source, LOGO_EDGE)
    let blob = await encode(canvas, 'image/webp', 0.9)
    // بلا WEBP نحفظ PNG لا JPEG: الشعار غالبًا شفاف
    if (!blob || blob.type !== 'image/webp') blob = await encode(canvas, 'image/png', 1)
    const { w, h } = size(source)
    const keepOriginal = !blob || (file.size <= blob.size && Math.max(w, h) <= LOGO_EDGE)
    return { href: await readAsDataUrl(keepOriginal ? file : blob!) }
  } catch {
    return { issue: 'logoFailed' }
  }
}
