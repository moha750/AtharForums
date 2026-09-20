import { chromium } from 'playwright'
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const base = 'http://localhost:3212'
const shots = [
  ['admin-overview', '/ar/admin', { viewport: { width: 1280, height: 900 }, colorScheme: 'light' }],
  ['admin-forums', '/ar/admin/forums', { viewport: { width: 1280, height: 1000 }, colorScheme: 'light' }],
  ['admin-applications', '/ar/admin/applications', { viewport: { width: 1280, height: 900 }, colorScheme: 'light' }],
  ['admin-settings', '/ar/admin/settings', { viewport: { width: 1280, height: 1300 }, colorScheme: 'light' }],
  ['admin-forum-edit', '/ar/admin/forums/11111111-1111-1111-1111-111111111111', { viewport: { width: 1280, height: 1900 }, colorScheme: 'light' }],
  ['me-ar', '/ar/me', { viewport: { width: 1280, height: 1200 }, colorScheme: 'light' }],
  ['login-ar', '/ar/login', { viewport: { width: 1280, height: 850 }, colorScheme: 'light' }],
  ['admin-dark', '/ar/admin/forums', { viewport: { width: 1280, height: 1000 }, colorScheme: 'dark' }],
]
const errors = []
for (const [name, path, opts] of shots) {
  const ctx = await b.newContext(opts)
  const p = await ctx.newPage()
  p.on('pageerror', e => errors.push(`${name}: ${e.message}`))
  const r = await p.goto(base + path, { waitUntil: 'load', timeout: 45000 })
  if (r.status() >= 400) errors.push(`${name}: HTTP ${r.status()}`)
  await p.waitForTimeout(1000)
  await p.screenshot({ path: `/tmp/${name}.png`, fullPage: true })
  await ctx.close()
}
await b.close()
console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no errors')
