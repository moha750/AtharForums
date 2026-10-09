import { test } from 'node:test'
import assert from 'node:assert/strict'

import { validateTarget } from '@/lib/qr/target'
import {
  customCodeIssue,
  generateCode,
  isCodeShape,
  looksGenerated,
  normalizeCustomCode,
} from '@/lib/qr/code'
import { classifyScan, deviceOf, isBotUserAgent, referrerHost } from '@/lib/qr/ua'
import { fileKindOf, filePathOwner, isFilePath } from '@/lib/qr/file-path'
import { CODE_ALPHABET } from '@/lib/qr/config'

const ORIGIN = 'https://athar.example.sa'

/* ── تصديق الوجهة ─────────────────────────────────────────────────────────── */

test('الوجهة: الصالح يمرّ ويُطبَّع', () => {
  const r = validateTarget('  https://example.org/path?a=1  ', ORIGIN)
  assert.deepEqual(r, { ok: true, url: 'https://example.org/path?a=1' })
  assert.equal(validateTarget('http://xn--mgbh0fb.xn--mgberp4a5d4ar/', ORIGIN).ok, true)
  assert.equal(validateTarget('https://forms.gle/AbC123', ORIGIN).ok, true)
})

test('الوجهة: لكل سبب رسالته', () => {
  const issue = (v: string) => {
    const r = validateTarget(v, ORIGIN)
    return r.ok ? 'ok' : r.issue
  }
  assert.equal(issue(''), 'empty')
  assert.equal(issue('   '), 'empty')
  assert.equal(issue('https://example.org/' + 'a'.repeat(2000)), 'too-long')
  assert.equal(issue('example.org'), 'protocol')
  assert.equal(issue('ftp://example.org'), 'protocol')
  assert.equal(issue('javascript:alert(1)'), 'protocol')
  assert.equal(issue('https://'), 'invalid')
  assert.equal(issue('https://user:pass@example.org'), 'invalid')
  assert.equal(issue('http://localhost:3000'), 'local')
  assert.equal(issue('http://app.localhost'), 'local')
  assert.equal(issue('http://127.0.0.1'), 'local')
  assert.equal(issue('http://127.8.9.1/x'), 'local')
  assert.equal(issue('http://0.0.0.0'), 'local')
  assert.equal(issue('http://[::1]/'), 'local')
  assert.equal(issue('http://10.1.2.3'), 'private')
  assert.equal(issue('http://172.16.0.1'), 'private')
  assert.equal(issue('http://172.31.255.255'), 'private')
  assert.equal(issue('http://192.168.1.1'), 'private')
  assert.equal(issue('http://169.254.169.254/latest'), 'private')
  assert.equal(issue('http://printer.local'), 'private')
  assert.equal(issue('http://172.32.0.1'), 'tld') // عام لكنه رقمي بلا امتداد
  assert.equal(issue('http://intranet'), 'tld')
  assert.equal(issue('http://example.c'), 'tld')
  assert.equal(issue('http://example.123'), 'invalid') // يرفضه محلّل WHATWG نفسه
  assert.equal(issue(`${ORIGIN}/q/abc1234`), 'loop')
  assert.equal(issue('https://www.athar.example.sa/q/abc1234'), 'loop')
  assert.equal(issue(`${ORIGIN}/ar/forums`), 'ok')
})

/* ── الرمز ─────────────────────────────────────────────────────────────────── */

test('الرمز المولَّد: ٧ محارف من الأبجدية الآمنة', () => {
  for (let i = 0; i < 2000; i++) {
    const code = generateCode()
    assert.equal(code.length, 7)
    assert.ok(looksGenerated(code), code)
    assert.ok(!/[01ilo]/.test(code))
    assert.ok(isCodeShape(code))
  }
})

test('الرمز المولَّد: يرفض البايتات المائلة فيتساوى الاحتمال', () => {
  // كل البايتات ≥ ٢٤٨ تُرفض؛ ثم ٢٤٧ → آخر محرف في الأبجدية
  let calls = 0
  const code = generateCode((b) => {
    calls++
    b.fill(calls === 1 ? 250 : 247)
    return b
  })
  assert.equal(code, CODE_ALPHABET[247 % 31]!.repeat(7))
  assert.equal(calls, 2)
})

test('الرمز المختار: تطبيع ثم فحص', () => {
  assert.equal(normalizeCustomCode('  Ramadan Night 2026 '), 'ramadan-night-2026')
  assert.equal(customCodeIssue('ramadan-night-2026'), null)
  assert.equal(customCodeIssue('ab'), 'too-short')
  assert.equal(customCodeIssue('a'.repeat(33)), 'too-long')
  assert.equal(customCodeIssue('رمضان'), 'chars')
  assert.equal(customCodeIssue('abc_def'), 'chars')
  assert.equal(customCodeIssue('-abc'), 'dash')
  assert.equal(customCodeIssue('abc-'), 'dash')
  assert.equal(customCodeIssue('ab--cd'), 'dash')
  for (const reserved of ['unavailable', 'new', 'admin', 'api']) {
    assert.equal(customCodeIssue(reserved), 'reserved')
  }
  assert.equal(isCodeShape('unavailable'), false)
  assert.equal(isCodeShape('ABC'), false)
  assert.equal(isCodeShape('a/b'), false)
})

/* ── الآلات والجهاز ────────────────────────────────────────────────────────── */

const IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'
const ANDROID =
  'Mozilla/5.0 (Linux; Android 15; SM-S928B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36'
const ANDROID_TAB =
  'Mozilla/5.0 (Linux; Android 14; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36'
const IPAD =
  'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
const MAC =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15'
const WINDOWS =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36'

test('الجهاز من User-Agent', () => {
  assert.equal(deviceOf(IPHONE), 'mobile')
  assert.equal(deviceOf(ANDROID), 'mobile')
  assert.equal(deviceOf(ANDROID_TAB), 'tablet')
  assert.equal(deviceOf(IPAD), 'tablet')
  assert.equal(deviceOf(MAC), 'desktop')
  assert.equal(deviceOf(WINDOWS), 'desktop')
  assert.equal(deviceOf(''), 'unknown')
  assert.equal(deviceOf('SomethingOdd/1.0'), 'unknown')
})

test('الآلة: الفارغ، والزواحف، ومعاينات المراسلة', () => {
  for (const ua of [
    '',
    '   ',
    'WhatsApp/2.24.18.80 A',
    'TelegramBot (like TwitterBot)',
    'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
    'Twitterbot/1.0',
    'Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)',
    'Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)',
    'LinkedInBot/1.0 (compatible; Mozilla/5.0; Apache-HttpClient +http://www.linkedin.com)',
    'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
    'curl/8.4.0',
    'Wget/1.21',
    'python-requests/2.32',
    'axios/1.7.2',
    'node-fetch/1.0',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/129.0 Safari/537.36',
    'Mozilla/5.0 (compatible; Embedly/0.2)',
    'Chrome-Lighthouse',
  ]) {
    assert.ok(isBotUserAgent(ua), ua)
  }
  const SNAPCHAT =
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Snapchat/13.10.0.40 (like Safari/8618.1.15.10.15, panda)'
  const PINTEREST =
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [Pinterest/iOS]'
  assert.ok(isBotUserAgent('Snap URL Preview Service; bot; snapchat; https://developers.snap.com/robots'))
  for (const ua of [IPHONE, ANDROID, IPAD, MAC, WINDOWS, SNAPCHAT, PINTEREST]) {
    assert.equal(isBotUserAgent(ua), false, ua)
  }
  assert.deepEqual(classifyScan('curl/8.4.0'), { device: 'unknown', isBot: true })
  assert.deepEqual(classifyScan(IPHONE), { device: 'mobile', isBot: false })
})

test('المُحيل: اسم المضيف فقط', () => {
  assert.equal(referrerHost('https://l.instagram.com/?u=https%3A%2F%2Fx&e=AT0'), 'l.instagram.com')
  assert.equal(referrerHost('android-app://com.google.android.gm/'), 'com.google.android.gm')
  assert.equal(referrerHost('not a url'), null)
  assert.equal(referrerHost(null), null)
})

/* ── مسار الملف ───────────────────────────────────────────────────────────── */

test('شكل مسار الملف', () => {
  const user = '0f8fad5b-d9cb-469f-a165-70867728950e'
  const file = '7c9e6679-7425-40de-944b-e07fc1f90ae7'
  for (const ext of ['webp', 'jpg', 'png', 'pdf']) {
    assert.ok(isFilePath(`${user}/${file}.${ext}`), ext)
  }
  assert.equal(isFilePath(`${user}/${file}.jpeg`), false)
  assert.equal(isFilePath(`${user}/${file}.svg`), false)
  assert.equal(isFilePath(`${user}/${file}.PNG`), false)
  assert.equal(isFilePath(`${file}.png`), false)
  assert.equal(isFilePath(`${user}/sub/${file}.png`), false)
  assert.equal(isFilePath(`../${user}/${file}.png`), false)
  assert.equal(isFilePath(`${user}/${file}.png?x=1`), false)
  assert.equal(filePathOwner(`${user}/${file}.png`), user)
  assert.equal(fileKindOf(`${user}/${file}.pdf`), 'pdf')
  assert.equal(fileKindOf(`${user}/${file}.webp`), 'image')
})
