import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { Resvg } from '@resvg/resvg-js'
import jsQR from 'jsqr'

import { downloadName, qrMatrix, renderSvg, weakContrast } from '@/lib/qr/render'
import { checkDesign, defaultDesign, defaultSpec, readSpec, type QrSpec } from '@/lib/qr/spec'

/**
 * الباركود المرسوم يُمسح فعلًا: نرسم الـSVG نفسه إلى PNG ونفكّه بقارئ مستقلّ،
 * بكل إطار وموضع ومقاس، وبتدرّج، وبشعار.
 */

const TEXT = 'https://athar.example.sa/q/k7m2p9x'

function scan(svg: string): string | null {
  const png = new Resvg(svg, { background: 'white' }).render()
  return jsQR(new Uint8ClampedArray(png.pixels), png.width, png.height)?.data ?? null
}

const logo = 'data:image/svg+xml;base64,' + readFileSync('public/athar-mark.svg').toString('base64')

test('يُمسح بكل إطار وموضع ومقاس', () => {
  const frames: QrSpec['frame'][] = [null]
  for (const style of ['band', 'ring', 'bubble'] as const) {
    for (const place of ['top', 'bottom'] as const) {
      frames.push({ style, place, color: '#144e46', caption: 'امسح الباركود', textColor: '#ffffff' })
    }
  }
  for (const frame of frames) {
    for (const width of [320, 1024, 2048]) {
      const spec = readSpec({ ...defaultDesign(), frame }, TEXT)
      assert.equal(scan(renderSvg(spec, { width })), TEXT, `${frame?.style}/${frame?.place}/${width}`)
    }
  }
})

test('يُمسح بالتدرّجين وبألوان العيون', () => {
  const paints = [
    { type: 'linear', from: '#144e46', to: '#3d866e', angle: 45 },
    { type: 'linear', from: '#09463f', to: '#41786f', angle: -90 },
    { type: 'radial', from: '#c59237', to: '#144e46', cx: 0.5, cy: 0.5 },
  ]
  for (const paint of paints) {
    const spec = readSpec(
      { ...defaultDesign(), dots: { shape: 'leaf', paint }, eye: { shape: 'leaf', color: '#144e46' }, pupil: { shape: 'leaf', color: '#c59237' } },
      TEXT
    )
    assert.equal(scan(renderSvg(spec, { width: 800 })), TEXT, paint.type)
  }
})

test('الشعار يفرض H ويُفرّغ ما تحته والعيون كاملة', () => {
  const spec = readSpec({ ...defaultDesign(), ecc: 'L', logo: { href: logo, scale: 0.9 } }, TEXT)
  assert.equal(spec.ecc, 'H')
  assert.equal(spec.logo?.scale, 0.3)
  const svg = renderSvg(spec, { width: 1024 })
  assert.match(svg, /<image xlink:href="data:image\/svg\+xml;base64,/)
  assert.equal(scan(svg), TEXT)
})

test('النصّ العربي يُرمَّز بايتات UTF-8', () => {
  const arabic = 'https://athar.example.sa/q/abc?ref=مساحة'
  const spec = defaultSpec(arabic)
  assert.equal(scan(renderSvg(spec, { width: 800 })), arabic)
})

test('عدد الوحدات ثابت: المعاينة هي المطبوع', () => {
  const a = qrMatrix(TEXT, 'M')
  const b = qrMatrix(TEXT, 'M')
  assert.equal(a.size, b.size)
  for (let r = 0; r < a.size; r++) for (let c = 0; c < a.size; c++) assert.equal(a.dark(r, c), b.dark(r, c))
  // ورسمتان بالمقاس نفسه متطابقتان حرفيًّا
  assert.equal(renderSvg(defaultSpec(TEXT)), renderSvg(defaultSpec(TEXT)))
})

test('التصدير ٢٠٤٨ والخلفية الافتراضية شفافة', () => {
  const svg = renderSvg(defaultSpec(TEXT))
  assert.match(svg, /width="2048" height="2048"/)
  assert.doesNotMatch(svg, /fill="#ffffff"/)
  assert.match(svg, /fill="#144e46"/)
})

test('ما يُحقن في SVG مُصدَّق: الألوان والشعار والنداء', () => {
  const evil = {
    ...defaultDesign(),
    bg: '#fff" onload="alert(1)',
    dots: { shape: 'leaf', paint: { type: 'solid', color: 'red;}</style><script>' } },
    logo: { href: 'https://evil.example/logo.png', scale: 0.3 },
    frame: { style: 'band', place: 'bottom', color: '#144e46', caption: '<script>alert(1)</script>', textColor: '#fff' },
  }
  const spec = readSpec(evil, TEXT)
  assert.equal(spec.bg, null)
  assert.equal(spec.logo, null)
  assert.deepEqual(spec.dots, defaultDesign().dots)
  const svg = renderSvg(spec)
  assert.doesNotMatch(svg, /<script/)
  assert.doesNotMatch(svg, /onload/)
  assert.match(svg, /&lt;script&gt;/)
  // وتصديق الخادم يرفضها رفضًا لا يرمّمها
  assert.equal(checkDesign(evil).ok, false)
})

test('تصديق الخادم: الحجم والمقاس', () => {
  assert.equal(checkDesign(defaultDesign()).ok, true)
  assert.equal(checkDesign({ ...defaultDesign(), size: 32 }).ok, false)
  assert.equal(checkDesign({ ...defaultDesign(), size: 5000 }).ok, false)
  const huge = 'data:image/png;base64,' + 'A'.repeat(1_300_000)
  const r = checkDesign({ ...defaultDesign(), logo: { href: huge, scale: 0.3 } })
  assert.deepEqual(r, { ok: false, issue: 'too-large' })
  const ring = checkDesign({ ...defaultDesign(), frame: { style: 'band', place: 'top', color: '#000', caption: '   ', textColor: '#fff' } })
  assert.ok(ring.ok && ring.design.frame?.caption === 'امسح الباركود')
})

test('تنبيه التباين وأسماء التنزيل', () => {
  assert.equal(weakContrast(defaultSpec(TEXT)), false)
  const pale = readSpec({ ...defaultDesign(), dots: { shape: 'leaf', paint: { type: 'solid', color: '#eeeeee' } } }, TEXT)
  assert.equal(weakContrast(pale), true)
  const goldPupil = readSpec({ ...defaultDesign(), pupil: { shape: 'leaf', color: '#c59237' } }, TEXT)
  assert.equal(weakContrast(goldPupil), false)
  assert.equal(downloadName('ملصق المدخل: الدور ٢', 'png'), 'ملصق المدخل الدور ٢.png')
  assert.equal(downloadName('   ', 'svg'), 'qr.svg')
})
