import { create } from 'qrcode'

import { QR_EXPORT_SIZE, QUIET_ZONE } from './config'
import type { Ecc, Paint, QrSpec } from './spec'

/**
 * راسم الباركود — SVG هو المصدر الوحيد.
 *
 * المعاينة في الصفحة والملف المنزَّل والـPNG (يُرسم هذا الـSVG نفسه على
 * canvas) كلّها من هذه الدالّة، فالمعاينة هي المُنزَّل نفسه وحدةً بوحدة.
 *
 * الوحدة هنا وحدة الباركود (module): كل الإحداثيات بها، والمقاس بالبكسل
 * يأتي من width في الجذر.
 */

export type Matrix = { size: number; version: number; dark: (row: number, col: number) => boolean }

/** النصّ يُرمَّز بايتات UTF-8 صراحةً، فيعمل العربي. */
export function qrMatrix(text: string, ecc: Ecc): Matrix {
  const qr = create([{ data: new TextEncoder().encode(text), mode: 'byte' }], { errorCorrectionLevel: ecc })
  const { size, data } = qr.modules
  return { size, version: qr.version, dark: (r, c) => data[r * size + c] === 1 }
}

const f = (v: number) => String(Math.round(v * 1000) / 1000)

export function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/** مستطيل بأنصاف أقطار لكل زاوية: [أعلى-يسار، أعلى-يمين، أسفل-يمين، أسفل-يسار]. */
function rrect(x: number, y: number, w: number, h: number, r: [number, number, number, number]): string {
  const [tl, tr, br, bl] = r.map((v) => Math.max(0, Math.min(v, w / 2, h / 2))) as [
    number,
    number,
    number,
    number,
  ]
  return (
    `M${f(x + tl)} ${f(y)}H${f(x + w - tr)}` +
    (tr ? `A${f(tr)} ${f(tr)} 0 0 1 ${f(x + w)} ${f(y + tr)}` : '') +
    `V${f(y + h - br)}` +
    (br ? `A${f(br)} ${f(br)} 0 0 1 ${f(x + w - br)} ${f(y + h)}` : '') +
    `H${f(x + bl)}` +
    (bl ? `A${f(bl)} ${f(bl)} 0 0 1 ${f(x)} ${f(y + h - bl)}` : '') +
    `V${f(y + tl)}` +
    (tl ? `A${f(tl)} ${f(tl)} 0 0 1 ${f(x + tl)} ${f(y)}` : '') +
    'Z'
  )
}

/** ورقة: زاويتان متقابلتان مستديرتان تمامًا، والأخريان شبه حادّتين. */
function leaf(x: number, y: number, s: number, big: number, small: number, mirror: boolean): string {
  return rrect(x, y, s, s, mirror ? [small, big, small, big] : [big, small, big, small])
}

/**
 * وحدة متّصلة بجاراتها: مربّع كامل، وزواياه المكشوفة وحدها تستدير — الزاويتان
 * المتقابلتان (أعلى-يسار وأسفل-يمين) استدارة ورقة، والأخريان استدارة خفيفة.
 * الوحدات المتجاورة تلتحم بلا شقوق، فيقرأ الماسح خطوطًا متّصلة لا نقاطًا.
 */
function moduleLeaf(x: number, y: number, up: boolean, right: boolean, down: boolean, left: boolean): string {
  const big = 0.5
  const small = 0.18
  const tl = !up && !left ? big : 0
  const tr = !up && !right ? small : 0
  const br = !down && !right ? big : 0
  const bl = !down && !left ? small : 0
  if (!tl && !tr && !br && !bl) return `M${f(x)} ${f(y)}h1v1h-1z`
  return rrect(x, y, 1, 1, [tl, tr, br, bl])
}

function inFinder(r: number, c: number, n: number): boolean {
  return (r < 7 && c < 7) || (r < 7 && c >= n - 7) || (r >= n - 7 && c < 7)
}

function paintDef(id: string, paint: Paint, n: number): string {
  if (paint.type === 'solid') return ''
  const span = n
  const cx = QUIET_ZONE + span / 2
  const cy = QUIET_ZONE + span / 2
  if (paint.type === 'linear') {
    const rad = (paint.angle * Math.PI) / 180
    const cos = Math.cos(rad)
    const sin = Math.sin(rad)
    const half = (span / 2) * (Math.abs(cos) + Math.abs(sin))
    return (
      `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" ` +
      `x1="${f(cx - cos * half)}" y1="${f(cy - sin * half)}" x2="${f(cx + cos * half)}" y2="${f(cy + sin * half)}">` +
      `<stop offset="0" stop-color="${paint.from}"/><stop offset="1" stop-color="${paint.to}"/></linearGradient>`
    )
  }
  const px = QUIET_ZONE + paint.cx * span
  const py = QUIET_ZONE + paint.cy * span
  const r = Math.max(
    Math.hypot(px - QUIET_ZONE, py - QUIET_ZONE),
    Math.hypot(px - QUIET_ZONE - span, py - QUIET_ZONE),
    Math.hypot(px - QUIET_ZONE, py - QUIET_ZONE - span),
    Math.hypot(px - QUIET_ZONE - span, py - QUIET_ZONE - span)
  )
  return (
    `<radialGradient id="${id}" gradientUnits="userSpaceOnUse" cx="${f(px)}" cy="${f(py)}" r="${f(r)}">` +
    `<stop offset="0" stop-color="${paint.from}"/><stop offset="1" stop-color="${paint.to}"/></radialGradient>`
  )
}

export type FrameLayout = {
  width: number
  height: number
  codeX: number
  codeY: number
  /** شكل الإطار (يُملأ بلون الإطار)، ومعه قاعدة الملء. */
  framePath: string | null
  /** خلفية الصورة: مستطيل بزوايا تطابق الإطار. */
  bgPath: string
  caption: { x: number; y: number; size: number; maxWidth: number } | null
}

/** النصّ لا يُقاس بلا متصفّح؛ نقدّر عرض المحرف ونصغّر الخطّ حتى يتّسع. */
function captionSize(text: string, height: number, maxWidth: number): number {
  let em = 0
  for (const ch of text) {
    if (/\s/.test(ch)) em += 0.28
    else if (/[\u0600-\u06ff\u0750-\u077f\ufb50-\ufdff\ufe70-\ufeff]/.test(ch)) em += 0.5
    else em += 0.58
  }
  return Math.min(height * 0.46, maxWidth / Math.max(em, 1))
}

export function frameLayout(spec: QrSpec, n: number): FrameLayout {
  const N = n + QUIET_ZONE * 2
  const frame = spec.frame
  const square = rrect(0, 0, N, N, [0, 0, 0, 0])
  if (!frame) {
    return { width: N, height: N, codeX: 0, codeY: 0, framePath: null, bgPath: square, caption: null }
  }

  const t = Math.max(1.4, N * 0.045)
  const innerR = N * 0.07
  const outerR = innerR + t

  if (frame.style === 'ring') {
    const W = N + t * 2
    const outer = rrect(0, 0, W, W, [outerR, outerR, outerR, outerR])
    const inner = rrect(t, t, N, N, [innerR, innerR, innerR, innerR])
    return { width: W, height: W, codeX: t, codeY: t, framePath: outer + inner, bgPath: outer, caption: null }
  }

  if (frame.style === 'band') {
    const strip = N * 0.2
    const W = N + t * 2
    const H = N + t + strip
    const codeY = frame.place === 'top' ? strip : t
    const outer = rrect(0, 0, W, H, [outerR, outerR, outerR, outerR])
    const inner = rrect(t, codeY, N, N, [innerR, innerR, innerR, innerR])
    const capY = frame.place === 'top' ? strip / 2 : codeY + N + strip / 2
    const maxWidth = W * 0.84
    return {
      width: W,
      height: H,
      codeX: t,
      codeY,
      framePath: outer + inner,
      bgPath: outer,
      caption: { x: W / 2, y: capY, size: captionSize(frame.caption, strip, maxWidth), maxWidth },
    }
  }

  // فقاعة كلام بذيل يشير إلى الباركود — الذيل يقف عند حدّ الهامش الصامت
  const bh = N * 0.2
  const bw = N * 0.86
  const tail = N * 0.06
  const H = N + tail + bh
  const bx = (N - bw) / 2
  const codeY = frame.place === 'top' ? tail + bh : 0
  const by = frame.place === 'top' ? 0 : N + tail
  const r = bh * 0.32
  const bubble = rrect(bx, by, bw, bh, [r, r, r, r])
  const mid = N / 2
  const half = tail * 0.9
  const tailPath =
    frame.place === 'top'
      ? `M${f(mid - half)} ${f(bh - 0.01)}L${f(mid)} ${f(bh + tail)}L${f(mid + half)} ${f(bh - 0.01)}Z`
      : `M${f(mid - half)} ${f(by + 0.01)}L${f(mid)} ${f(N)}L${f(mid + half)} ${f(by + 0.01)}Z`
  const maxWidth = bw * 0.86
  return {
    width: N,
    height: H,
    codeX: 0,
    codeY,
    framePath: bubble + tailPath,
    bgPath: rrect(0, 0, N, H, [0, 0, 0, 0]),
    caption: { x: mid, y: by + bh / 2, size: captionSize(frame.caption, bh, maxWidth), maxWidth },
  }
}

export type RenderOptions = {
  /** بادئة معرّفات التدرّج — فريدة إن اجتمع أكثر من باركود في صفحة. */
  idPrefix?: string
  /** عرض الصورة بالبكسل. التصدير ٢٠٤٨ دائمًا. */
  width?: number
  /** @font-face مضمَّن (data URL) للنداء — للتنزيل، حيث لا خطوط للصفحة. */
  fontCss?: string
}

const CAPTION_FONT = "'QR Caption', 'IBM Plex Sans Arabic', 'IBM Plex Sans', 'Segoe UI', Tahoma, sans-serif"

export function renderSvg(spec: QrSpec, options: RenderOptions = {}): string {
  const matrix = qrMatrix(spec.text, spec.ecc)
  const n = matrix.size
  const layout = frameLayout(spec, n)
  const id = (options.idPrefix ?? 'qr').replace(/[^a-zA-Z0-9_-]/g, '')
  const width = options.width ?? spec.size ?? QR_EXPORT_SIZE
  const height = Math.round((width * layout.height) / layout.width)

  const paintId = `${id}-paint`
  const dotsFill = spec.dots.paint.type === 'solid' ? spec.dots.paint.color : `url(#${paintId})`
  const eyeFill = spec.eye.color ?? dotsFill
  const pupilFill = spec.pupil.color ?? dotsFill

  // الشعار يفرّغ ما تحته بحاشية وحدة واحدة ولا يغطّيه
  const logoSide = spec.logo ? n * spec.logo.scale : 0
  const logoAt = (n - logoSide) / 2
  const cleared = (r: number, c: number) =>
    spec.logo !== null &&
    c + 1 > logoAt - 1 &&
    c < logoAt + logoSide + 1 &&
    r + 1 > logoAt - 1 &&
    r < logoAt + logoSide + 1

  const on = (r: number, c: number) =>
    r >= 0 && c >= 0 && r < n && c < n && matrix.dark(r, c) && !inFinder(r, c, n) && !cleared(r, c)

  let dots = ''
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (!on(r, c)) continue
      dots += moduleLeaf(QUIET_ZONE + c, QUIET_ZONE + r, on(r - 1, c), on(r, c + 1), on(r + 1, c), on(r, c - 1))
    }
  }

  // العيون الثلاث تُرسم كاملة دائمًا، والورقة تتّجه نحو زاوية الباركود
  const eyes = [
    { r: 0, c: 0, mirror: false },
    { r: 0, c: n - 7, mirror: true },
    { r: n - 7, c: 0, mirror: true },
  ]
  let eyePath = ''
  let pupilPath = ''
  for (const e of eyes) {
    const x = QUIET_ZONE + e.c
    const y = QUIET_ZONE + e.r
    eyePath += leaf(x, y, 7, 2.6, 0.6, e.mirror) + leaf(x + 1, y + 1, 5, 1.8, 0.25, e.mirror)
    pupilPath += leaf(x + 2, y + 2, 3, 1.25, 0.3, e.mirror)
  }

  const parts: string[] = []
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" ` +
      `viewBox="0 0 ${f(layout.width)} ${f(layout.height)}" width="${width}" height="${height}">`
  )

  const defs = paintDef(paintId, spec.dots.paint, n) + (options.fontCss && layout.caption ? `<style>${options.fontCss}</style>` : '')
  if (defs) parts.push(`<defs>${defs}</defs>`)

  if (spec.bg) parts.push(`<path d="${layout.bgPath}" fill="${spec.bg}"/>`)
  if (layout.framePath && spec.frame) {
    parts.push(`<path d="${layout.framePath}" fill="${spec.frame.color}" fill-rule="evenodd"/>`)
  }

  parts.push(`<g transform="translate(${f(layout.codeX)} ${f(layout.codeY)})">`)
  if (dots) parts.push(`<path d="${dots}" fill="${dotsFill}"/>`)
  parts.push(`<path d="${eyePath}" fill="${eyeFill}" fill-rule="evenodd"/>`)
  parts.push(`<path d="${pupilPath}" fill="${pupilFill}"/>`)
  if (spec.logo) {
    const x = QUIET_ZONE + logoAt
    parts.push(
      `<image xlink:href="${spec.logo.href}" x="${f(x)}" y="${f(x)}" width="${f(logoSide)}" height="${f(logoSide)}" preserveAspectRatio="xMidYMid meet"/>`
    )
  }
  parts.push('</g>')

  if (layout.caption && spec.frame && spec.frame.caption) {
    const rtl = /[֐-ࣿ]/.test(spec.frame.caption)
    const cap = layout.caption
    parts.push(
      `<text x="${f(cap.x)}" y="${f(cap.y)}" fill="${spec.frame.textColor}" font-family="${CAPTION_FONT.replace(/"/g, '')}" ` +
        `font-weight="600" font-size="${f(cap.size)}" text-anchor="middle" dominant-baseline="central"` +
        `${rtl ? ' direction="rtl"' : ''}>${escapeXml(spec.frame.caption)}</text>`
    )
  }

  parts.push('</svg>')
  return parts.join('')
}

/** موضع الشعار ومقاسه بوحدات viewBox — لرسمه منفصلًا إن رفض المتصفّح ذلك داخل SVG. */
export function logoBox(spec: QrSpec): { x: number; y: number; size: number; width: number; height: number } | null {
  if (!spec.logo) return null
  const n = qrMatrix(spec.text, spec.ecc).size
  const layout = frameLayout(spec, n)
  const side = n * spec.logo.scale
  const at = QUIET_ZONE + (n - side) / 2
  return { x: layout.codeX + at, y: layout.codeY + at, size: side, width: layout.width, height: layout.height }
}

/** اسم ملف التنزيل من اسم الباركود. */
export function downloadName(title: string, ext: 'png' | 'svg'): string {
  const base = title
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80)
  return `${base || 'qr'}.${ext}`
}

/* ── التباين ──────────────────────────────────────────────────────────────── */

function channel(v: number): number {
  const s = v / 255
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
}

export function luminance(hex: string): number {
  let h = hex.replace('#', '')
  if (h.length === 3) h = h.split('').map((c) => c + c).join('')
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

export function contrastRatio(a: string, b: string): number {
  const la = luminance(a)
  const lb = luminance(b)
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}

/**
 * هل التباين ضعيف إلى حدّ قد تتعثّر معه الكاميرات؟ الخلفية الشفافة تُعامَل
 * بيضاء (ورق الطباعة). الوحدات تحتاج تباينًا أعلى (٣:١) من العيون (٢:١)،
 * لأن الماسح يحدّد العيون بالشكل قبل اللون — البؤبؤ الذهبي على الأبيض يُقرأ.
 */
export function weakContrast(spec: QrSpec): boolean {
  const bg = spec.bg ?? '#ffffff'
  const p = spec.dots.paint
  const dots = p.type === 'solid' ? [p.color] : [p.from, p.to]
  const eyes = [spec.eye.color, spec.pupil.color].filter((c): c is string => Boolean(c))
  return dots.some((c) => contrastRatio(c, bg) < 3) || eyes.some((c) => contrastRatio(c, bg) < 2)
}
