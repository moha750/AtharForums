import { z } from 'zod'

import { BRAND_INK, CAPTION_MAX, LOGO_SCALE, QR_EXPORT_SIZE, SPEC_MAX_BYTES } from './config'

/**
 * وصفة رسم الباركود — محفوظة في الصفّ لتُعيد رسمه حرفيًّا بعد سنوات.
 *
 * شكل الوحدات والعيون واحد («ورقة»، من أوراق شعار أثر) بدل قائمة أشكال.
 * يبقى اسمه في الوصفة حتى يعرف الراسم بعد سنوات أيّ شكل رُسم.
 */

export type HexColor = string
export type Ecc = 'L' | 'M' | 'Q' | 'H'
export type Shape = 'leaf'

export type Paint =
  | { type: 'solid'; color: HexColor }
  | { type: 'linear'; from: HexColor; to: HexColor; angle: number }
  | { type: 'radial'; from: HexColor; to: HexColor; cx: number; cy: number }

export type FrameStyle = 'band' | 'ring' | 'bubble'
export type FramePlace = 'top' | 'bottom'

export type QrFrame = {
  style: FrameStyle
  place: FramePlace
  color: HexColor
  caption: string
  textColor: HexColor
}

export type QrLogo = { href: string; scale: number }

export type QrSpec = {
  text: string
  size: number
  ecc: Ecc
  dots: { shape: Shape; paint: Paint }
  eye: { shape: Shape; color: HexColor | null }
  pupil: { shape: Shape; color: HexColor | null }
  bg: HexColor | null
  logo: QrLogo | null
  frame: QrFrame | null
}

/** الوصفة بلا نصّ: ما يرسله المحرّر. النصّ يكتبه الخادم من رمز الصفّ. */
export type QrDesign = Omit<QrSpec, 'text'>

export const DEFAULT_CAPTION_AR = 'امسح الباركود'

/** صارم: يُحقن في سمات SVG، فلا يُقبل إلا ستّ عشريّ خالص. */
export const HEX = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/

/** الشعار مضمَّن لا رابط خارجي، وبمحارف base64 وحدها فلا يكسر السمة. */
export const LOGO_DATA_URL = /^data:image\/(png|jpeg|webp|svg\+xml);base64,[A-Za-z0-9+/]+={0,2}$/

const hex = z.string().regex(HEX)
const shape = z.literal('leaf')

const paint = z.discriminatedUnion('type', [
  z.object({ type: z.literal('solid'), color: hex }),
  z.object({
    type: z.literal('linear'),
    from: hex,
    to: hex,
    angle: z.number().finite().min(-360).max(360),
  }),
  z.object({
    type: z.literal('radial'),
    from: hex,
    to: hex,
    cx: z.number().finite().min(0).max(1),
    cy: z.number().finite().min(0).max(1),
  }),
])

const frame = z.object({
  style: z.enum(['band', 'ring', 'bubble']),
  place: z.enum(['top', 'bottom']),
  color: hex,
  caption: z.string().max(CAPTION_MAX * 2),
  textColor: hex,
})

/** تصديق الخادم قبل الحفظ. */
export const designSchema = z.object({
  size: z.number().int().min(64).max(4096),
  ecc: z.enum(['L', 'M', 'Q', 'H']),
  dots: z.object({ shape, paint }),
  eye: z.object({ shape, color: hex.nullable() }),
  pupil: z.object({ shape, color: hex.nullable() }),
  bg: hex.nullable(),
  logo: z
    .object({ href: z.string().startsWith('data:image/').regex(LOGO_DATA_URL), scale: z.number() })
    .nullable(),
  frame: frame.nullable(),
})

export function defaultDesign(): QrDesign {
  return {
    size: QR_EXPORT_SIZE,
    ecc: 'M',
    dots: { shape: 'leaf', paint: { type: 'solid', color: BRAND_INK } },
    eye: { shape: 'leaf', color: null },
    pupil: { shape: 'leaf', color: null },
    bg: null,
    logo: null,
    frame: null,
  }
}

export function defaultSpec(text: string): QrSpec {
  return { text, ...defaultDesign() }
}

function cleanCaption(caption: string): string {
  const value = caption.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim()
  return (value || DEFAULT_CAPTION_AR).slice(0, CAPTION_MAX)
}

/**
 * يطبّق القواعد المثبّتة: الشعار يفرض تصحيح H، وضلعه ٠٫٣ دائمًا، والنداء
 * الفارغ يصير الافتراضي. تُطبَّق في المحرّر والخادم معًا فتتطابق المعاينة.
 */
export function normalizeDesign(design: QrDesign): QrDesign {
  return {
    ...design,
    ecc: design.logo ? 'H' : design.ecc,
    logo: design.logo ? { href: design.logo.href, scale: LOGO_SCALE } : null,
    frame: design.frame
      ? {
          ...design.frame,
          caption: design.frame.style === 'ring' ? '' : cleanCaption(design.frame.caption),
        }
      : null,
  }
}

export type DesignCheck =
  | { ok: true; design: QrDesign; bytes: number }
  | { ok: false; issue: 'invalid' | 'too-large' }

/** تصديق الخادم: الشكل صارم، والحجم ≤ ١٫٢ ميغابايت. */
export function checkDesign(input: unknown): DesignCheck {
  const parsed = designSchema.safeParse(input)
  if (!parsed.success) return { ok: false, issue: 'invalid' }
  const design = normalizeDesign(parsed.data as QrDesign)
  const bytes = new TextEncoder().encode(JSON.stringify(design)).length
  if (bytes > SPEC_MAX_BYTES) return { ok: false, issue: 'too-large' }
  return { ok: true, design, bytes }
}

/**
 * قراءة متسامحة لوصفة مخزّنة: ما فسد من حقل يرجع إلى الافتراضي بدل أن
 * يُرفض الرسم كلّه. الراسم لا يرى إلا ما مرّ من هنا، فلا يُحقن في SVG شيءٌ
 * لم يُصدَّق — حتى لو كُتب في القاعدة من خارج التطبيق.
 */
export function readSpec(raw: unknown, text: string): QrSpec {
  const base = defaultDesign()
  const obj = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const pick = <T>(schema: z.ZodType<T>, value: unknown, fallback: T): T => {
    const parsed = schema.safeParse(value)
    return parsed.success ? parsed.data : fallback
  }

  const design: QrDesign = {
    size: pick(designSchema.shape.size, obj.size, base.size),
    ecc: pick(designSchema.shape.ecc, obj.ecc, base.ecc),
    dots: pick(designSchema.shape.dots, obj.dots, base.dots) as QrDesign['dots'],
    eye: pick(designSchema.shape.eye, obj.eye, base.eye) as QrDesign['eye'],
    pupil: pick(designSchema.shape.pupil, obj.pupil, base.pupil) as QrDesign['pupil'],
    bg: pick(designSchema.shape.bg, obj.bg, base.bg),
    logo: pick(designSchema.shape.logo, obj.logo, base.logo),
    frame: pick(designSchema.shape.frame, obj.frame, base.frame) as QrFrame | null,
  }
  return { text, ...normalizeDesign(design) }
}

export function designOf(spec: QrSpec): QrDesign {
  const design: Partial<QrSpec> = { ...spec }
  delete design.text
  return design as QrDesign
}
