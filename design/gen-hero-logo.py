#!/usr/bin/env python3
"""
يولّد src/components/home/hero-logo-art.ts من ملفّي الشعار.

لماذا نضمّن الـ SVG في الكود بدل <img>؟ لأنّ الحركة تمسّ أجزاء الشعار نفسها —
الدوائر، ثمّ البتلات، ثمّ الاسم، ثمّ السطر السفلي كلمةً كلمة — وهذا مستحيل
عبر <img>.

التقسيم بالمواضع المرسومة لا بترتيب العناصر في الملف: ترتيب المستند مبعثر،
فأربع قطع من «تواصل .. معرفة .. أثر» تأتي فيه بعد الاسم لا معه. الاعتماد على
الترتيب أعطى في نسخة سابقة سطرًا يظهر ناقصًا.

نضمّن النسخة الفاتحة وحدها ونقلب ألوانها في الوضع الداكن بقواعد CSS مُولَّدة
من الملفّ الداكن. المحدِّدات بلا علامات اقتباس عمدًا: محلّل HTML لا يفكّ
الكيانات داخل <style>، فأي " مهرَّبة تقتل القاعدة بصمت (انظر الحارس أدناه).

  python3 design/gen-hero-logo.py
"""
import json
import pathlib
import re
import sys
import xml.dom.minidom as md

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from _bbox import bbox  # noqa: E402

ROOT = pathlib.Path(__file__).resolve().parent.parent
LIGHT = ROOT / 'public' / 'athar-logo.svg'
DARK = ROOT / 'public' / 'athar-logo-dark.svg'
OUT = ROOT / 'src' / 'components' / 'home' / 'hero-logo-art.ts'

FILL_RE = re.compile(r'\.(st\d+)\s*\{\s*fill:\s*([^;]+);')

# حدود أفقية بين طبقات الشعار (إحداثيات viewBox، ارتفاعه 1254)
Y_WORDMARK = 700   # فوقه الرمز
Y_TAGLINE = 1060   # فوقه «مساحة أثر»
Y_DIVIDER = 1190   # تحته الخطّان والمعيَّن
X_GAP = 20         # أصغر فجوة تفصل كلمةً عن جارتها


def fills(path):
    return dict(FILL_RE.findall(path.read_text(encoding='utf-8')))


light, dark = fills(LIGHT), fills(DARK)
if not light or set(light) != set(dark):
    sys.exit('أصناف الملفّين غير متطابقة — أعد توليد الشعار الداكن أوّلًا.')

doc = md.parse(str(LIGHT))
svg = doc.documentElement

for tag in ('defs', 'style'):
    for node in list(svg.getElementsByTagName(tag)):
        node.parentNode.removeChild(node)


def leaves(node):
    out = []
    for c in node.childNodes:
        if c.nodeType != 1:
            continue
        out += leaves(c) if c.tagName == 'g' else [c]
    return out


def box(node):
    bs = [b for b in (bbox(e) for e in (leaves(node) if node.tagName == 'g' else [node])) if b]
    if not bs:
        sys.exit(f'تعذّر حساب موضع <{node.tagName}>.')
    return (min(b[0] for b in bs), min(b[1] for b in bs),
            max(b[2] for b in bs), max(b[3] for b in bs))


kids = [n for n in svg.childNodes if n.nodeType == 1]
layers = {'emblem': [], 'word': [], 'line': [], 'divider': []}
for k in kids:
    x0, y0, x1, y1 = box(k)
    mid = (y0 + y1) / 2
    layers['emblem' if mid < Y_WORDMARK else
           'word' if mid < Y_TAGLINE else
           'line' if mid < Y_DIVIDER else 'divider'].append(k)

for name, want in (('emblem', 1), ('word', 3), ('line', 6), ('divider', 3)):
    if len(layers[name]) < want:
        sys.exit(f'طبقة {name}: {len(layers[name])} عنصرًا فقط — راجع الحدود الأفقية.')


def wrap(nodes, attrs, parent=None, before=None):
    g = doc.createElement('g')
    for k, v in attrs.items():
        g.setAttribute(k, str(v))
    anchor = before or nodes[0]
    (parent or anchor.parentNode).insertBefore(g, anchor)
    for n in nodes:
        n.parentNode.removeChild(n)
        g.appendChild(n)
    return g


# ── الرمز: الدوائر الثلاث ثمّ البتلات ────────────────────────────────────
emblem = layers['emblem'][0]
circles, paths = emblem.getElementsByTagName('circle'), emblem.getElementsByTagName('path')
if len(circles) != 3 or not paths:
    sys.exit('مجموعة الرمز ليست 3 دوائر وبتلات — راجع الشعار.')
for i, c in enumerate(sorted(circles, key=lambda c: -float(c.getAttribute('cx')))):
    c.setAttribute('data-a', 'node')
    c.setAttribute('style', f'--i:{i}')
for i, p in enumerate(paths):
    p.setAttribute('data-a', 'petal')
    p.setAttribute('style', f'--i:{i}')

wrap(layers['word'], {'data-a': 'word'})

# ── السطر السفلي: عناقيد بالفجوات الأفقية ────────────────────────────────
items = sorted(((box(n), n) for n in layers['line']), key=lambda t: t[0][0])
clusters = [[items[0]]]
for b, n in items[1:]:
    if b[0] - max(c[0][2] for c in clusters[-1]) >= X_GAP:
        clusters.append([])
    clusters[-1].append((b, n))

# من اليمين إلى اليسار كاتجاه القراءة
clusters.reverse()

words = seps = 0
for cl in clusters:
    nodes = [n for _, n in cl]
    only_circles = all(n.tagName == 'circle' for n in nodes)
    ymid = sum((b[1] + b[3]) / 2 for b, _ in cl) / len(cl)
    if only_circles and ymid > 1130:
        # النقطتان الفاصلتان «..» بين كلمة وأخرى
        wrap(nodes, {'data-a': 'tl-sep', 'style': f'--w:{seps}'})
        seps += 1
        continue
    # نقاط الحروف تأتي مع كلمتها، كلٌّ بعد جسمها بقليل
    dots = [n for n in nodes if n.tagName == 'circle']
    body = [n for n in nodes if n.tagName != 'circle']
    holder = wrap(nodes, {'data-a': 'tl-word'})
    wrap(body, {'data-a': 'tl-body', 'style': f'--w:{words}'}, parent=holder, before=body[0])
    for i, dot in enumerate(sorted(dots, key=lambda d: -float(d.getAttribute('cx')))):
        dot.setAttribute('data-a', 'tl-dot')
        dot.setAttribute('style', f'--w:{words};--i:{i}')
    words += 1

if (words, seps) != (3, 2):
    sys.exit(f'السطر السفلي: {words} كلمات و{seps} فاصلًا — المتوقَّع 3 و2.')

# ── الخطّان والمعيَّن: المعيَّن أوّلًا ثمّ يمتدّ الخطّان من عنده ──────────
mid_x = next((box(n)[0] + box(n)[2]) / 2
             for n in layers['divider'] if n.tagName == 'polygon')
for n in layers['divider']:
    if n.tagName == 'polygon':
        n.setAttribute('data-a', 'tl-diamond')
    else:
        # الرسم يحمل transform كسمة، وخاصيّة transform في CSS تلغيها —
        # فنغلّفه بمجموعة ونحرّك المجموعة.
        inner = 0 if (box(n)[0] + box(n)[2]) / 2 > mid_x else 100
        wrap([n], {'data-a': 'tl-rule', 'style': f'--o:{inner}%'})

for el in svg.getElementsByTagName('*'):
    cls = el.getAttribute('class')
    if cls.startswith('st'):
        el.setAttribute('class', 'al-' + cls[2:])

svg.setAttribute('id', 'athar-hero-logo')
svg.removeAttribute('xmlns')


def rules(palette, prefix=''):
    head = prefix + ' ' if prefix else ''
    return ''.join(f'{head}#athar-hero-logo .al-{k[2:]}{{fill:{palette[k]}}}'
                   for k in light if not prefix or palette[k] != light[k])


style = (rules(light)
         + '@media (prefers-color-scheme:dark){'
         + rules(dark, ':root:not([data-theme=light])') + '}'
         + rules(dark, ':root[data-theme=dark]'))

style_el = doc.createElement('style')
style_el.appendChild(doc.createTextNode(style))
svg.insertBefore(style_el, svg.firstChild)

markup = re.sub(r'>\s+<', '><', svg.toxml()).strip()

opened = markup.index('<style>') + len('<style>')
if any(e in markup[opened:markup.index('</style>')]
       for e in ('&quot;', '&amp;', '&lt;', '&gt;')):
    sys.exit('محرف مهرَّب داخل <style> — تخلّص من علامات الاقتباس في المحدِّدات.')

OUT.write_text(
    '// مولَّد آليًّا — لا تحرّره بيدك.\n'
    '// المصدر: public/athar-logo.svg + athar-logo-dark.svg\n'
    '// أعد التوليد بعد أي تغيير في الشعار: python3 design/gen-hero-logo.py\n'
    f'// المتحرّك: 3 دوائر، {len(paths)} بتلة، الاسم، '
    f'{words} كلمات و{seps} فاصل في السطر السفلي، خطّان ومعيَّن.\n\n'
    'export const heroLogoArt = ' + json.dumps(markup, ensure_ascii=False) + '\n',
    encoding='utf-8')
print(f'✓ {OUT.relative_to(ROOT)} — {len(markup):,} حرفًا | '
      f'{words} كلمات، {seps} فاصل، '
      f'{markup.count(chr(34) + "tl-dot" + chr(34))} نقطة حرف')
