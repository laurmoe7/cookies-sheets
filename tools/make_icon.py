"""Generates web/icon.ico and web/icon.png: a shaded gold d20 showing "20" on a crimson tile.

Standard library only. Each size is rendered separately (with simpler detail at 16-32 px) and
anti-aliased by supersampling.
"""
import math
import os
import struct
import zlib

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SIZES = [16, 24, 32, 48, 64, 128, 256]

TILE_TOP, TILE_BOTTOM = (184, 36, 40), (96, 14, 20)
TILE_RIM = (226, 92, 84)
EDGE = (74, 40, 6)
INK = (110, 16, 20)
# Facet tones, lit from the upper left.
FACES = {
    'center': (246, 204, 104), 'top_l': (255, 228, 146), 'top_r': (228, 172, 70),
    'left': (232, 178, 76), 'right': (190, 128, 40), 'low_l': (200, 140, 48),
    'low_r': (150, 96, 26), 'bot_l': (176, 114, 34), 'bot_c': (136, 86, 22), 'bot_r': (112, 68, 16),
}


def lerp(a, b, t):
    return tuple(a[i] + (b[i] - a[i]) * t for i in range(3))


def seg_dist(px, py, ax, ay, bx, by):
    dx, dy = bx - ax, by - ay
    L = dx * dx + dy * dy
    t = 0 if L == 0 else max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / L))
    return math.hypot(px - (ax + t * dx), py - (ay + t * dy))


def in_tri(px, py, a, b, c):
    d1 = (px - b[0]) * (a[1] - b[1]) - (a[0] - b[0]) * (py - b[1])
    d2 = (px - c[0]) * (b[1] - c[1]) - (b[0] - c[0]) * (py - c[1])
    d3 = (px - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (py - a[1])
    return not ((d1 < 0 or d2 < 0 or d3 < 0) and (d1 > 0 or d2 > 0 or d3 > 0))


def arc(cx, cy, rx, ry, a0, a1, steps=10):
    return [(cx + rx * math.cos(math.radians(a0 + (a1 - a0) * i / steps)),
             cy - ry * math.sin(math.radians(a0 + (a1 - a0) * i / steps))) for i in range(steps + 1)]


def digit_strokes(ch, x, y, w, h):
    """Polylines for a rounded '2' or '0' in the box (x, y, w, h)."""
    if ch == '0':
        rx, ry = w / 2, h / 2
        pts = arc(x + rx, y + ry, rx, ry, 0, 360, 28)
        return [pts]
    # '2': top arc, diagonal down to bottom-left, flat base
    rx, ry = w / 2, h * 0.27
    top = arc(x + rx, y + ry, rx, ry, 160, -40, 14)
    return [top + [(x, y + h), (x + w, y + h)]]


def build_scene(n, detailed):
    cx, cy, r = n / 2, n * 0.515, n * 0.385
    H = [(cx + r * math.cos(math.radians(90 - 60 * i)), cy - r * math.sin(math.radians(90 - 60 * i))) for i in range(6)]
    h0, h1, h2, h3, h4, h5 = H  # top, upper-right, lower-right, bottom, lower-left, upper-left
    i0 = (cx, cy - r * 0.50)
    i1 = (cx - r * 0.66, cy + r * 0.40)
    i2 = (cx + r * 0.66, cy + r * 0.40)
    faces = [
        (FACES['center'], (i0, i1, i2)), (FACES['top_l'], (h0, i0, h5)), (FACES['top_r'], (h0, h1, i0)),
        (FACES['left'], (h5, i0, i1)), (FACES['right'], (i0, h1, i2)), (FACES['low_l'], (h5, i1, h4)),
        (FACES['low_r'], (h1, h2, i2)), (FACES['bot_l'], (h4, i1, h3)), (FACES['bot_c'], (i1, i2, h3)),
        (FACES['bot_r'], (i2, h2, h3)),
    ]
    edges = [(H[i], H[(i + 1) % 6]) for i in range(6)] + [
        (i0, i1), (i1, i2), (i2, i0), (h0, i0), (h5, i0), (h1, i0), (h5, i1), (h4, i1), (h3, i1),
        (h3, i2), (h2, i2), (h1, i2)]
    strokes = []
    if detailed:
        # "20" centred on the front face
        fh = r * 0.36
        fw = fh * 0.56
        gap = fw * 0.32
        x0 = cx - (2 * fw + gap) / 2
        # Centre the numerals on the front face's centroid (the triangle's visual middle).
        face_cy = (i0[1] + i1[1] + i2[1]) / 3
        y0 = face_cy - fh / 2
        for k, ch in enumerate('20'):
            strokes += digit_strokes(ch, x0 + k * (fw + gap), y0, fw, fh)
    return {
        'hex': H, 'faces': faces, 'edges': edges, 'strokes': strokes,
        'edge_w': max(1.0, n * (0.020 if detailed else 0.05)),
        'outline_w': max(1.4, n * (0.034 if detailed else 0.07)),
        'ink_w': n * 0.030,
        'bbox': (min(p[0] for p in H) - n * 0.04, min(p[1] for p in H) - n * 0.04,
                 max(p[0] for p in H) + n * 0.04, max(p[1] for p in H) + n * 0.04),
        'shadow': (cx + n * 0.02, cy + r * 0.92, r * 0.80, r * 0.16),
    }


def sample(px, py, n, sc):
    rad = n * 0.21
    qx = max(abs(px - n / 2) - (n / 2 - rad), 0)
    qy = max(abs(py - n / 2) - (n / 2 - rad), 0)
    dcorner = math.hypot(qx, qy) - rad
    if dcorner > 0:
        return None
    # tile: vertical gradient, light rim just inside the edge, soft shadow under the die
    col = lerp(TILE_TOP, TILE_BOTTOM, py / n)
    if dcorner > -max(1.0, n * 0.022) and py < n * 0.55:
        col = lerp(col, TILE_RIM, 0.55 * (1 - py / (n * 0.55)))
    sx, sy, srx, sry = sc['shadow']
    e = ((px - sx) / srx) ** 2 + ((py - sy) / sry) ** 2
    if e < 1:
        col = lerp(col, (40, 4, 8), 0.45 * (1 - e))
    x0, y0, x1, y1 = sc['bbox']
    if not (x0 <= px <= x1 and y0 <= py <= y1):
        return col
    # die outline (drawn slightly outside the silhouette)
    H = sc['hex']
    outline = min(seg_dist(px, py, *H[i], *H[(i + 1) % 6]) for i in range(6))
    inside = any(in_tri(px, py, *f) for _, f in sc['faces'])
    if inside or outline < sc['outline_w'] / 2:
        face = next((c for c, f in sc['faces'] if in_tri(px, py, *f)), None)
        col = face if face else EDGE
        if face and outline < sc['outline_w'] / 2:
            col = EDGE
        elif face and min(seg_dist(px, py, *a, *b) for a, b in sc['edges']) < sc['edge_w'] / 2:
            col = EDGE
        for line in sc['strokes']:
            if any(seg_dist(px, py, *line[i], *line[i + 1]) < sc['ink_w'] / 2 for i in range(len(line) - 1)):
                col = INK
                break
    return col


def render(n):
    sc = build_scene(n, detailed=n >= 48)
    ss = 4 if n <= 64 else 3
    raw = bytearray()
    for y in range(n):
        raw.append(0)
        for x in range(n):
            acc_r = acc_g = acc_b = 0.0
            hits = 0
            for sy in range(ss):
                for sx in range(ss):
                    c = sample(x + (sx + .5) / ss, y + (sy + .5) / ss, n, sc)
                    if c is not None:
                        acc_r += c[0]; acc_g += c[1]; acc_b += c[2]
                        hits += 1
            if hits:
                raw += bytes((int(acc_r / hits), int(acc_g / hits), int(acc_b / hits), round(255 * hits / (ss * ss))))
            else:
                raw += bytes(4)

    def chunk(t, d):
        return struct.pack('>I', len(d)) + t + d + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)
    return b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', n, n, 8, 6, 0, 0, 0)) + \
        chunk(b'IDAT', zlib.compress(bytes(raw), 9)) + chunk(b'IEND', b'')


def main():
    pngs = [render(s) for s in SIZES]
    header = struct.pack('<HHH', 0, 1, len(SIZES))
    offset = 6 + 16 * len(SIZES)
    entries = b''
    for s, p in zip(SIZES, pngs):
        entries += struct.pack('<BBBBHHII', s % 256, s % 256, 0, 0, 1, 32, len(p), offset)
        offset += len(p)
    with open(os.path.join(ROOT, 'web', 'icon.ico'), 'wb') as f:
        f.write(header + entries + b''.join(pngs))
    with open(os.path.join(ROOT, 'web', 'icon.png'), 'wb') as f:
        f.write(pngs[-1])
    preview = os.environ.get('ICON_PREVIEW_DIR')  # optional: also write each size as a PNG for checking
    if preview:
        for s, p in zip(SIZES, pngs):
            with open(os.path.join(preview, f'icon-{s}.png'), 'wb') as f:
                f.write(p)


if __name__ == '__main__':
    main()
