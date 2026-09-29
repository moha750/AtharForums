#!/usr/bin/env python3
"""
يبني design/hero-logo-preview.html — صفحة مستقلّة لمعاينة حركة شعار الهيرو
بنفس الـ SVG ونفس قواعد الـ CSS المستعملة في الموقع، بلا تشغيل Next.

  python3 design/build-hero-preview.py
"""
import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent

art = (ROOT / 'src/components/home/hero-logo-art.ts').read_text(encoding='utf-8')
svg = json.loads(art.split('= ', 1)[1].strip())

css = (ROOT / 'src/app/globals.css').read_text(encoding='utf-8')
start = css.index('  /* ── شعار الهيرو')
kf = css.index('@keyframes athar-pop')

# قواعد الهيرو داخل @layer utilities: نقتطعها ونزيل قوس إغلاق الطبقة
rules = re.sub(r'^  ', '', css[start:kf].rstrip().rstrip('}').rstrip(), flags=re.M)
keyframes = css[kf:].strip()

for needle in ('athar-hero-logo', 'athar-hero-glow'):
    if needle not in rules:
        sys.exit(f'لم أجد {needle} في globals.css — تغيّر موضع القواعد.')
if 'athar-glow' not in keyframes:
    sys.exit('لم أجد إطارات الحركة.')

HTML = f'''<!doctype html>
<html lang="ar" dir="rtl" data-theme="light">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>معاينة حركة الشعار — مساحة أثر</title>
<style>
:root {{ --accent:#c59237; --bg:#fff; --fg:#0d1b18; --muted:#5b6b66; --line:#e3ebe8 }}
:root[data-theme=dark] {{ --accent:#d9a54c; --bg:#0b1513; --fg:#e8f1ee; --muted:#93a8a2; --line:#1e2e2a }}
* {{ box-sizing:border-box }}
body {{
  margin:0; background:var(--bg); color:var(--fg);
  font-family:system-ui,-apple-system,"SF Arabic","Segoe UI",sans-serif;
  transition:background .25s,color .25s;
}}
.bar {{
  position:sticky; top:0; z-index:9; display:flex; gap:.7rem; align-items:center;
  justify-content:center; flex-wrap:wrap; padding:.85rem 1rem; font-size:.85rem;
  background:color-mix(in srgb,var(--bg) 88%,transparent);
  backdrop-filter:blur(10px); border-bottom:1px solid var(--line);
}}
.bar button {{
  font:inherit; cursor:pointer; padding:.4rem .9rem; border-radius:999px;
  border:1px solid var(--line); background:transparent; color:var(--fg);
}}
.bar button:hover {{ border-color:var(--accent) }}
.spacer {{
  height:85vh; display:grid; place-content:center; text-align:center;
  color:var(--muted); font-size:.9rem; padding:2rem;
}}
.stage {{ display:grid; place-items:center; padding:3rem 1rem }}
.note {{ margin:1.5rem 0 0; color:var(--muted); font-size:.82rem; text-align:center }}

{rules}

{keyframes}
</style>
</head>
<body>
  <div class="bar">
    <strong style="color:var(--accent)">نسخة ٥ — المعتمَدة</strong>
    <button id="theme">الوضع الداكن</button>
    <button id="again">إعادة التشغيل</button>
    <span id="diag" style="color:var(--muted)">…</span>
  </div>

  <div class="spacer">↓ مرّر لأسفل</div>

  <div class="stage">
    <div class="athar-hero-logo" id="logo" style="position:relative;height:min(58vw,300px)">
      <span aria-hidden="true" class="athar-hero-glow"></span>
      <div role="img" aria-label="مساحة أثر" style="position:relative;height:100%">{svg}</div>
    </div>
  </div>
  <p class="note">الدوائر الثلاث ← البتلات ← الاسم ← السطر السفلي</p>

  <div class="spacer">↑ ارجع لأعلى لترى الحركة تُعاد</div>
  <div class="spacer">مساحة إضافية للتجربة</div>

<script>
  var logo = document.getElementById('logo'), root = document.documentElement;
  function replay() {{
    var list = logo.getAnimations({{ subtree: true }});
    for (var i = 0; i < list.length; i++) {{ list[i].cancel(); list[i].play(); }}
  }}
  document.getElementById('again').onclick = replay;
  document.getElementById('theme').onclick = function () {{
    var dark = root.dataset.theme === 'dark';
    root.dataset.theme = dark ? 'light' : 'dark';
    this.textContent = dark ? 'الوضع الداكن' : 'الوضع الفاتح';
  }};
  // تشخيص ذاتي: إن كان العدد صفرًا فالقواعد لم تُطبَّق أصلًا
  var diag = document.getElementById('diag');
  function report() {{
    var n = logo.getAnimations({{ subtree: true }}).length;
    diag.textContent = n
      ? n + ' حركة تعمل — مرّر لأسفل ثمّ ارجع'
      : '\u26a0 صفر حركات — القواعد لم تُطبَّق';
    diag.style.color = n ? 'var(--muted)' : '#c0392b';
  }}
  report();
  setTimeout(report, 400);

  var first = true;
  new IntersectionObserver(function (e) {{
    if (first) {{ first = false; if (e[0].isIntersecting) return; }}
    if (e[0].isIntersecting) replay();
  }}, {{ threshold: 0.4 }}).observe(logo);
</script>
</body>
</html>
'''

out = ROOT / 'design/hero-logo-preview.html'
out.write_text(HTML, encoding='utf-8')
print(f'✓ {out.relative_to(ROOT)} — {len(HTML):,} حرفًا')
