"""حساب تقريبي لمربّع إحاطة عناصر SVG — نحتاجه لفرز «تواصل .. معرفة .. أثر»
إلى كلمات. نقاط التحكّم تُدخَل في الحساب فيتّسع المربّع قليلًا، وهذا مقبول
لأنّ الغرض تجميع بالمواضع لا قياس دقيق."""
import math
import re

NUM = re.compile(r'[-+]?(?:\d*\.\d+|\d+)(?:[eE][-+]?\d+)?')
CMD = re.compile(r'([MmLlHhVvCcSsQqTtAaZz])')


def path_points(d):
    toks, pts = CMD.split(d), []
    x = y = sx = sy = 0.0
    i = 1
    while i < len(toks):
        c, args = toks[i], [float(n) for n in NUM.findall(toks[i + 1])]
        rel, C = c.islower(), c.upper()
        i += 2
        if C == 'Z':
            x, y = sx, sy
            continue
        step = {'M': 2, 'L': 2, 'H': 1, 'V': 1, 'C': 6, 'S': 4, 'Q': 4, 'T': 2, 'A': 7}[C]
        for k in range(0, len(args) - step + 1, step):
            a = args[k:k + step]
            if C in 'ML':
                nx, ny = (x + a[0], y + a[1]) if rel else (a[0], a[1])
            elif C == 'H':
                nx, ny = (x + a[0], y) if rel else (a[0], y)
            elif C == 'V':
                nx, ny = (x, y + a[0]) if rel else (x, a[0])
            elif C == 'A':
                nx, ny = (x + a[5], y + a[6]) if rel else (a[5], a[6])
            else:
                for j in range(0, step - 2, 2):
                    pts.append((x + a[j], y + a[j + 1]) if rel else (a[j], a[j + 1]))
                nx, ny = (x + a[step - 2], y + a[step - 1]) if rel else (a[step - 2], a[step - 1])
            pts.append((nx, ny))
            x, y = nx, ny
            if C == 'M' and k == 0:
                sx, sy = x, y
                C = 'L'  # إحداثيات M المتتابعة خطوط ضمنًا
    return pts


def parse_transform(t):
    """يعيد مصفوفة (a,b,c,d,e,f) لسلسلة translate/rotate/matrix/scale."""
    m = (1.0, 0.0, 0.0, 1.0, 0.0, 0.0)

    def mul(p, q):
        a1, b1, c1, d1, e1, f1 = p
        a2, b2, c2, d2, e2, f2 = q
        return (a1 * a2 + c1 * b2, b1 * a2 + d1 * b2,
                a1 * c2 + c1 * d2, b1 * c2 + d1 * d2,
                a1 * e2 + c1 * f2 + e1, b1 * e2 + d1 * f2 + f1)

    for name, body in re.findall(r'(\w+)\s*\(([^)]*)\)', t or ''):
        v = [float(n) for n in NUM.findall(body)]
        if name == 'translate':
            m = mul(m, (1, 0, 0, 1, v[0], v[1] if len(v) > 1 else 0))
        elif name == 'rotate':
            r = math.radians(v[0])
            rot = (math.cos(r), math.sin(r), -math.sin(r), math.cos(r), 0, 0)
            if len(v) == 3:
                m = mul(m, mul((1, 0, 0, 1, v[1], v[2]),
                               mul(rot, (1, 0, 0, 1, -v[1], -v[2]))))
            else:
                m = mul(m, rot)
        elif name == 'scale':
            m = mul(m, (v[0], 0, 0, v[1] if len(v) > 1 else v[0], 0, 0))
        elif name == 'matrix':
            m = mul(m, tuple(v))
    return m


def apply(m, p):
    a, b, c, d, e, f = m
    return (a * p[0] + c * p[1] + e, b * p[0] + d * p[1] + f)


def element_points(el):
    t = el.tagName
    if t == 'path':
        pts = path_points(el.getAttribute('d'))
    elif t == 'circle':
        cx, cy = float(el.getAttribute('cx')), float(el.getAttribute('cy'))
        r = float(el.getAttribute('r'))
        pts = [(cx - r, cy - r), (cx + r, cy + r)]
    elif t == 'rect':
        x, y = float(el.getAttribute('x')), float(el.getAttribute('y'))
        w, h = float(el.getAttribute('width')), float(el.getAttribute('height'))
        pts = [(x, y), (x + w, y + h)]
    elif t == 'polygon':
        v = [float(n) for n in NUM.findall(el.getAttribute('points'))]
        pts = list(zip(v[0::2], v[1::2]))
    else:
        return []
    m = parse_transform(el.getAttribute('transform'))
    return [apply(m, p) for p in pts]


def bbox(el):
    pts = element_points(el)
    if not pts:
        return None
    xs, ys = [p[0] for p in pts], [p[1] for p in pts]
    return min(xs), min(ys), max(xs), max(ys)
