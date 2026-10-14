"""Writes web/css/theme-tome.css (the Dusty tome theme).

The paper and leather textures are SVG filters (feTurbulence). Drawn live they are re-rendered every time the browser repaints a tile
(a hover is enough), which made this theme several times dearer than Dark; so they are baked once into web/css/tome/*.png|jpg by
tools/bake_tome_textures.mjs and the CSS only points at those files. This script owns the SVG sources (`--dump` lists them for the baker).
Everything is drawn with normal blending (no blend modes, no fixed backgrounds) so scrolling stays cheap.
Run:  python tools/make_tome_css.py   (then node tools/bake_tome_textures.mjs when a texture changed)
"""
import json
import os
import re
import sys

OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'web', 'css', 'theme-tome.css')


TEXTURES = {}  # name -> source of the baked image


def uri(svg, name, ext='png', scale=1):
    """Registers an SVG texture and returns the CSS url() of its baked image (drawn at `scale` times its size; the CSS gives the size)."""
    m = re.search(r"width='(\d+)' height='(\d+)'", svg)
    TEXTURES[name] = dict(svg=svg, w=int(m.group(1)), h=int(m.group(2)), ext=ext, scale=scale)
    return f'url("tome/{name}.{ext}")'


def paper(seed, azimuth, freq, scale, size=520):
    """One sheet of dim parchment (opaque): the same colour every time, with its own crumples and fibres."""
    return uri(
        f"<svg xmlns='http://www.w3.org/2000/svg' width='{size}' height='{size}'><filter id='c' x='0' y='0' width='100%' height='100%' color-interpolation-filters='sRGB'>"
        f"<feTurbulence type='fractalNoise' baseFrequency='{freq}' numOctaves='3' seed='{seed}' stitchTiles='stitch' result='n'/>"
        f"<feDiffuseLighting in='n' surfaceScale='{scale}' diffuseConstant='1' lighting-color='#fff'><feDistantLight azimuth='{azimuth}' elevation='58'/></feDiffuseLighting>"
        "<feColorMatrix values='1.2 0 0 0 -.3786  0 1.2 0 0 -.4416  0 0 1.2 0 -.5666  0 0 0 0 1'/></filter>"
        "<rect width='100%' height='100%' filter='url(#c)'/></svg>", f'paper{seed}', 'jpg')


GRAIN = uri(
    "<svg xmlns='http://www.w3.org/2000/svg' width='220' height='220'><filter id='g'>"
    "<feTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='2' seed='5' stitchTiles='stitch'/>"
    "<feColorMatrix values='0 0 0 0 .12  0 0 0 0 .07  0 0 0 0 .02  .5 0 0 0 -.12'/></filter><rect width='100%' height='100%' filter='url(#g)'/></svg>", 'grain', 'webp', 2)

LEATHER = uri(
    "<svg xmlns='http://www.w3.org/2000/svg' width='900' height='900'>"
    "<filter id='m' x='0' y='0' width='100%' height='100%'><feTurbulence type='fractalNoise' baseFrequency='.0045 .006' numOctaves='3' seed='8' stitchTiles='stitch'/>"
    "<feColorMatrix values='0 0 0 0 .09  0 0 0 0 .05  0 0 0 0 .02  1.5 0 0 0 -.42'/></filter>"
    "<filter id='w' x='0' y='0' width='100%' height='100%'><feTurbulence type='fractalNoise' baseFrequency='.02 .03' numOctaves='5' seed='3' stitchTiles='stitch'/>"
    "<feColorMatrix values='0 0 0 0 .66  0 0 0 0 .40  0 0 0 0 .15  8 0 0 0 -5.6'/></filter>"
    "<filter id='k' x='0' y='0' width='100%' height='100%'><feTurbulence type='fractalNoise' baseFrequency='.008 .09' numOctaves='3' seed='12' stitchTiles='stitch'/>"
    "<feColorMatrix values='0 0 0 0 .06  0 0 0 0 .03  0 0 0 0 .01  3.2 0 0 0 -1.5'/></filter>"
    "<filter id='p' x='0' y='0' width='100%' height='100%'><feTurbulence type='fractalNoise' baseFrequency='.42' numOctaves='2' seed='21' stitchTiles='stitch'/>"
    "<feColorMatrix values='0 0 0 0 .04  0 0 0 0 .02  0 0 0 0 .01  7 0 0 0 -3.6'/></filter>"
    "<filter id='f' x='0' y='0' width='100%' height='100%'><feTurbulence type='fractalNoise' baseFrequency='.55' numOctaves='2' seed='5' stitchTiles='stitch'/>"
    "<feColorMatrix values='0 0 0 0 .55  0 0 0 0 .38  0 0 0 0 .22  1.1 0 0 0 -.45'/></filter>"
    "<rect width='100%' height='100%' filter='url(#m)'/><rect width='100%' height='100%' filter='url(#w)' opacity='.24'/>"
    "<rect width='100%' height='100%' filter='url(#k)' opacity='.16'/><rect width='100%' height='100%' filter='url(#p)' opacity='.16'/>"
    "<rect width='100%' height='100%' filter='url(#f)' opacity='.3'/></svg>", 'leather', 'webp')

def burn(corner, seed, size=170, faint=False):
    """A scorched corner: charred, ragged, with a brown scorch rim. Drawn once at a fixed size and tucked into a corner of a page."""
    cx, cy = {'tl': (0, 0), 'tr': (1, 0), 'bl': (0, 1), 'br': (1, 1)}[corner]
    k = .5 if faint else 1  # faint stains are lighter and softer still
    blur = 4.2 if faint else 2.8
    return uri(
        f"<svg xmlns='http://www.w3.org/2000/svg' width='{size}' height='{size}'><defs>"
        f"<radialGradient id='g' cx='{cx}' cy='{cy}' r='1' gradientUnits='objectBoundingBox'><stop offset='.05' stop-color='#000' stop-opacity='{.8 * k:.2f}'/><stop offset='.55' stop-color='#000' stop-opacity='0'/></radialGradient>"
        "<filter id='b' x='0' y='0' width='100%' height='100%' color-interpolation-filters='sRGB'>"
        f"<feTurbulence type='fractalNoise' baseFrequency='.045' numOctaves='4' seed='{seed}' result='n'/>"
        "<feColorMatrix in='n' type='matrix' values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  1 0 0 0 0' result='na'/>"
        "<feComposite in='SourceGraphic' in2='na' operator='arithmetic' k1='0' k2='1.6' k3='-.8' k4='0' result='m'/>"
        "<feComponentTransfer in='m' result='char'><feFuncA type='linear' slope='4' intercept='-.55'/></feComponentTransfer>"
        "<feComponentTransfer in='m' result='rim'><feFuncA type='linear' slope='3' intercept='-.05'/></feComponentTransfer>"
        f"<feFlood flood-color='#6a3a14' flood-opacity='{.34 * k:.2f}' result='f1'/><feComposite in='f1' in2='rim' operator='in' result='r1'/>"
        f"<feFlood flood-color='#2a1608' flood-opacity='{.48 * k:.2f}' result='f2'/><feComposite in='f2' in2='char' operator='in' result='c1'/>"
        f"<feMerge result='all'><feMergeNode in='r1'/><feMergeNode in='c1'/></feMerge><feGaussianBlur in='all' stdDeviation='{blur}'/></filter></defs>"
        "<rect width='100%' height='100%' fill='url(#g)' filter='url(#b)'/></svg>", f"burn-{'f' if faint else ''}{corner}{seed}")


def brass(size=48):
    """A strip of brushed, slightly tarnished brass for frames (used as a border image)."""
    return uri(
        f"<svg xmlns='http://www.w3.org/2000/svg' width='{size}' height='{size}'><defs>"
        "<linearGradient id='b' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='#e6c978'/><stop offset='.28' stop-color='#b98d37'/>"
        "<stop offset='.55' stop-color='#7d5c1c'/><stop offset='.8' stop-color='#c79f4a'/><stop offset='1' stop-color='#8a6a25'/></linearGradient>"
        "<filter id='n' x='0' y='0' width='100%' height='100%' color-interpolation-filters='sRGB'><feTurbulence type='fractalNoise' baseFrequency='.012 .9' numOctaves='2' seed='4' stitchTiles='stitch'/>"
        "<feColorMatrix values='0 0 0 0 .13  0 0 0 0 .08  0 0 0 0 .02  1.1 0 0 0 -.4'/></filter></defs>"
        f"<rect width='{size}' height='{size}' fill='url(#b)'/><rect width='{size}' height='{size}' filter='url(#n)' opacity='.8'/>"
        f"<rect x='.5' y='.5' width='{size - 1}' height='{size - 1}' fill='none' stroke='#3b2808' stroke-opacity='.7'/>"
        f"<rect x='2.5' y='2.5' width='{size - 5}' height='{size - 5}' fill='none' stroke='#f3dc98' stroke-opacity='.35'/></svg>", 'brass')


# Pages of one book: the same paper colour, but each sheet has its own crumples, light direction and burnt side.
EDGE = 'rgba(255,238,196,.16) 0%, rgba(0,0,0,0) 40%, rgba(24,12,3,.5) 100%'
PAPERS = [
    dict(at='50% 38%', seed=11, az=225, freq='.011', scale=1.2, burn='inset 0 0 40px 2px rgba(25,12,4,.5)', marks=[]),
    dict(at='34% 54%', seed=23, az=300, freq='.014', scale=1.5, burn='inset 14px -8px 44px -6px rgba(25,12,4,.5)', marks=[('br', 7, 130)]),
    dict(at='64% 42%', seed=37, az=140, freq='.009', scale=1.0, burn='inset -14px 10px 44px -8px rgba(25,12,4,.45)', marks=[]),
    dict(at='42% 60%', seed=52, az=20, freq='.016', scale=1.3, burn='inset 0 12px 40px -4px rgba(25,12,4,.45), inset 0 -8px 28px -8px rgba(25,12,4,.3)', marks=[]),
    dict(at='58% 34%', seed=66, az=200, freq='.012', scale=1.1, burn='inset 10px 6px 40px -6px rgba(25,12,4,.45)', marks=[('bl', 19, 110)]),
    dict(at='36% 48%', seed=81, az=330, freq='.013', scale=1.4, burn='inset -8px -10px 42px -6px rgba(25,12,4,.5)', marks=[('tl', 31, 90)]),
]


# Extra faint stains, tucked into corners at different sizes; each page gets a few of them.
FAINT = [('tr', 41, 150), ('bl', 43, 170), ('br', 47, 140), ('tl', 53, 160), ('tr', 59, 120), ('bl', 61, 150), ('br', 67, 180), ('tl', 71, 130)]
VARIANTS = 12  # a tab never shows the same page twice until it has more than this many cards


def _flip_at(at):
    x, y = (float(v.rstrip('%')) for v in at.split())
    return f"{100 - x:.0f}% {100 - y:.0f}%"


def _flip_burn(burn_css):
    return re.sub(r"inset (-?\d+)(px)? (-?\d+)(px)?", lambda m: f"inset {-int(m.group(1))}{m.group(2) or ''} {-int(m.group(3))}{m.group(4) or ''}", burn_css)


def variant(k):
    """Page number k of VARIANTS: the first six are the papers as they are, the rest the same sheets turned over (other light, other crumples, other marks)."""
    p = dict(PAPERS[k % len(PAPERS)])
    p['pos'] = ''
    if k >= len(PAPERS):
        p['at'] = _flip_at(p['at'])
        p['burn'] = _flip_burn(p['burn'])
        p['pos'] = f" {-97 - 41 * k}px {-211 + 29 * k}px"
        flip = {'tl': 'br', 'br': 'tl', 'tr': 'bl', 'bl': 'tr'}
        p['marks'] = [(flip[c], sd + 100, size) for c, sd, size in p['marks']]
    p['faint'] = [FAINT[(k * 3) % len(FAINT)], FAINT[(k * 3 + 2) % len(FAINT)], FAINT[(k * 5 + 1) % len(FAINT)]]
    p['edge'] = p['seed'] + 7 * k
    return p


# Old paper is never cut straight: every edge has a slight roughness and a few chips, with the corners knocked off a little.
# The outline is a clip-path on the page, so the leather shows through the nicks. Nothing goes deeper than MAX_NICK px, which is less than the page's padding,
# so text and buttons are never touched.
import math
import random

MAX_NICK = 8.0


def _wander(rng, n=6):
    """Smooth random curve on 0..1 (cosine-interpolated control points)."""
    c = [rng.uniform(.25, 1) for _ in range(n + 1)]

    def f(t):
        x = min(max(t, 0), 1) * n
        i = min(int(x), n - 1)
        u = (1 - math.cos((x - i) * math.pi)) / 2
        return c[i] * (1 - u) + c[i + 1] * u
    return f


def _edge_depths(rng, n):
    """Depth in px of the nicks at n+1 points along one edge: a faint wobble, plus a few blocky chips with steep sides and uneven floors."""
    low = _wander(rng, 6)
    depth = [2.2 * low(i / n) + rng.uniform(0, 1.6) for i in range(n + 1)]
    for _ in range(rng.choice([1, 2, 2, 3, 4])):
        centre, width, deep = rng.uniform(.06, .94), rng.uniform(.012, .045), rng.uniform(3.5, MAX_NICK - .5)
        skew = rng.uniform(.25, .75)
        for i in range(n + 1):
            u = (i / n - (centre - width * skew)) / width
            if 0 < u < 1:
                wall = min(u / skew, (1 - u) / (1 - skew)) if skew < 1 else u
                depth[i] = max(depth[i], deep * min(1.0, wall * 5) * rng.uniform(.82, 1.0))
    return [min(d, MAX_NICK) for d in depth]


def rough_polygon(seed, nx=54, ny=30):
    """The outline of a page of old paper (a clip-path polygon) with a rough edge all round."""
    rng = random.Random(seed)

    def pts(n, mk, reverse=False):
        d = _edge_depths(rng, n)
        ts = [min(max(i / n + rng.uniform(-.3, .3) / n, 0), 1) for i in range(n + 1)]
        ts = [0.0] + sorted(ts[1:-1]) + [1.0]
        out = [mk(ts[i], d[i]) for i in range(1, n)]
        return out[::-1] if reverse else out

    pc = lambda t: f"{t * 100:.2f}%"
    cut = lambda: rng.uniform(2.5, 8.5)
    top = pts(nx, lambda t, d: f"{pc(t)} {d:.1f}px")
    right = pts(ny, lambda t, d: f"calc(100% - {d:.1f}px) {pc(t)}")
    bottom = pts(nx, lambda t, d: f"{pc(t)} calc(100% - {d:.1f}px)", True)
    left = pts(ny, lambda t, d: f"{d:.1f}px {pc(t)}", True)
    a, b, c, e, f, g, h, k = (cut() for _ in range(8))
    corners = (
        [f"0 {a:.1f}px", f"{b:.1f}px 0"],
        [f"calc(100% - {c:.1f}px) 0", f"100% {e:.1f}px"],
        [f"100% calc(100% - {f:.1f}px)", f"calc(100% - {g:.1f}px) 100%"],
        [f"{h:.1f}px 100%", f"0 calc(100% - {k:.1f}px)"],
    )
    return 'polygon(' + ', '.join(corners[0] + top + corners[1] + right + corners[2] + bottom + corners[3] + left) + ')'


POS = {'tl': 'top left', 'tr': 'top right', 'bl': 'bottom left', 'br': 'bottom right'}


def paper_rules():
    out = []
    n = len(PAPERS)
    nth = lambda cls, i: f'html[data-theme="tome"] .{cls}:nth-of-type({n}n+{i})' if i < n else f'html[data-theme="tome"] .{cls}:nth-of-type({n}n)'
    for i, p in enumerate(PAPERS, 1):
        layers = []
        for corner, seed, size in p['marks']:
            pos = {'tl': 'top left', 'tr': 'top right', 'bl': 'bottom left', 'br': 'bottom right'}[corner]
            layers.append(f"{burn(corner, seed, size)} no-repeat {pos} / {size}px {size}px")
        base = f"radial-gradient(ellipse at {p['at']}, {EDGE}), var(--grain) 0 0 / 220px 220px, {paper(p['seed'], p['az'], p['freq'], p['scale'])}"
        # the Characters page's cards are small, so they get the paper and the burnt edge but no big burn marks and no rough outline
        out.append(f"{nth('char-card', i)} {{ background: {base}; box-shadow: {p['burn'].replace('44px', '22px').replace('40px', '20px')}, var(--shadow); }}")
        # the Compendium's two panes are pages of their own, but their rows run to the edge, so they are not cut
        comp = {1: 'comp-list', 4: 'comp-pane'}.get(i)
        if comp:
            out.append(f"html[data-theme=\"tome\"] .{comp} {{ background: {base}; box-shadow: {p['burn']}, var(--shadow); }}")
        out.append(f"{nth('card', i)} {{ background: {', '.join(layers + [base])}; clip-path: {rough_polygon(p['seed'])}; box-shadow: {p['burn']}, var(--shadow); }}")
    # The numbered pages: the app gives each card on a tab its own number in order (data-paper), so no two pages on a tab look alike
    for k in range(VARIANTS):
        v = variant(k)
        marks = [f"{burn(c, sd, size)} no-repeat {POS[c]} / {size}px {size}px" for c, sd, size in v['marks']]
        faint = [f"{burn(c, sd, size, faint=True)} no-repeat {POS[c]} / {size}px {size}px" for c, sd, size in v['faint']]
        base = f"radial-gradient(ellipse at {v['at']}, {EDGE}), var(--grain) 0 0 / 220px 220px, {paper(v['seed'], v['az'], v['freq'], v['scale'])}{v['pos']}"
        out.append(f"html[data-theme=\"tome\"] .card[data-paper=\"{k}\"] {{ background: {', '.join(marks + faint + [base])}; clip-path: {rough_polygon(v['edge'])}; box-shadow: {v['burn']}, var(--shadow); }}")
    return '\n'.join(out)


def sheet(i=0):
    p = PAPERS[i]
    return f"radial-gradient(ellipse at {p['at']}, {EDGE}), var(--grain) 0 0 / 220px 220px, {paper(p['seed'], p['az'], p['freq'], p['scale'])}"


CSS = '''/* Dusty tome: dim parchment pages on dark leather. Generated by tools/make_tome_css.py; edit the script, not this file. */
html[data-theme="tome"] {
  --bg: #1a120b;
  --panel: #4a3c26;
  --panel-2: #54452b;
  --ink: #e6d7b2;
  --muted: #b7a37a;
  --line: #75603c;
  --accent: #cf6347;
  --accent-soft: #4d2c20;
  --accent-ink: #f6ead0;
  --gold: #cfa84f;
  --good: #9ab566;
  --warn: #e0ae48;
  --bad: #e5755a;
  --nav: #231910;
  --input: #2a2013;
  --shadow: 0 1px 3px rgba(0, 0, 0, .55);
  --font: Georgia, "Palatino Linotype", "Book Antiqua", serif;
  --serif: Georgia, "Palatino Linotype", "Book Antiqua", serif;
  --radius: 4px;
  --grain: @GRAIN@;
  --leather: @LEATHER@;
  --brass: @BRASS@;
}
html[data-theme="tome"] body { background: var(--bg); }
/* dark leather: a little lighter in the middle, darker toward the edges */
html[data-theme="tome"] #main { background: radial-gradient(ellipse at 50% 35%, rgba(70,48,28,.35), rgba(0,0,0,.45) 100%), var(--leather), #26190f; }
/* The leather is not opaque, so the browser repainted the whole scroller on every scroll step (about 14 times slower than the dark theme in a headless test). Giving #main its own layer paints it once. */
html[data-theme="tome"] #main { will-change: transform; }
html[data-theme="tome"] h3 { font-variant: small-caps; letter-spacing: .04em; font-weight: 500; }
html[data-theme="tome"] h1, html[data-theme="tome"] h2 { font-weight: 500; }

/* leather spine with stitching */
html[data-theme="tome"] #nav { background: var(--leather), linear-gradient(180deg, #33241a, #1f150d); border-right: 3px solid #0e0905; position: relative; }
html[data-theme="tome"] #nav::after { content: ""; position: absolute; top: 8px; bottom: 8px; right: 6px; border-right: 2px dashed #6b5030; pointer-events: none; }
html[data-theme="tome"] #nav button { border-radius: 3px; }
html[data-theme="tome"] #nav button.active { background: #8a3326; color: #f6ead0; }
html[data-theme="tome"] #topbar { background: var(--leather), #2c1f14; border-bottom: 2px solid #0e0905; }

/* parchment pages: light in the middle, burnt toward the edges, each with its own crumples */
html[data-theme="tome"] .card, html[data-theme="tome"] .modal, html[data-theme="tome"] #drawer, html[data-theme="tome"] .comp-list, html[data-theme="tome"] .comp-pane, html[data-theme="tome"] .char-card { background-color: var(--panel); border: 1px solid #1f160c; box-shadow: var(--shadow); }
html[data-theme="tome"] .card, html[data-theme="tome"] .modal, html[data-theme="tome"] #drawer, html[data-theme="tome"] .comp-list, html[data-theme="tome"] .comp-pane, html[data-theme="tome"] .char-card {
  --ink: #261a0b; --muted: #3f2f18; --accent: #7a2415; --accent-soft: #c9b48a; --gold: #6b4f10; --good: #3b5714; --warn: #80520a; --bad: #8a2616;
  --line: #5a4a2c; --panel: #9a8b68; --panel-2: #8d7f5d; --input: #3a2c19; color: var(--ink); }
/* the inner frame line is a pseudo-element: as an outline it made every hover or scroll step repaint the whole card (3x the raster work) */
html[data-theme="tome"] .card { position: relative; padding: 17px 19px; }
html[data-theme="tome"] .card::before { content: ""; position: absolute; inset: 4px; border: 1px solid #2c1f10; pointer-events: none; }
html[data-theme="tome"] .card .card::before { display: none; }
html[data-theme="tome"] .comp-list, html[data-theme="tome"] .comp-pane { position: relative; }
html[data-theme="tome"] .comp-list::before, html[data-theme="tome"] .comp-pane::before { content: ""; position: absolute; inset: 4px; border: 1px solid #2c1f10; pointer-events: none; z-index: 1; }
@PAPERS@
html[data-theme="tome"] .char-card { clip-path: none; position: relative; }
html[data-theme="tome"] .char-card::before { content: ""; position: absolute; inset: 4px; border: 1px solid #2c1f10; border-radius: 3px; pointer-events: none; }
html[data-theme="tome"] .char-card h3 { color: var(--ink); }
html[data-theme="tome"] .char-card:hover, html[data-theme="tome"] .char-card.current { border-color: #7a2415; }
html[data-theme="tome"] .modal, html[data-theme="tome"] #drawer { background-image: @SHEET@; }
html[data-theme="tome"] .card .card { clip-path: none; background-image: none; box-shadow: none; background-color: #0000001f; }
html[data-theme="tome"] .stat, html[data-theme="tome"] .summon-card, html[data-theme="tome"] .mod { background-color: #00000026; border-color: #5a4a30; }
html[data-theme="tome"] input, html[data-theme="tome"] select, html[data-theme="tome"] textarea { background: var(--input); border-color: #5a4a30; color: #f0e3c0; font-family: inherit; }
html[data-theme="tome"] .btn { background: #9a8b66; border-color: #5a4a2c; color: #261a0b; font-style: italic; }
html[data-theme="tome"] .btn.primary { background: #8a3326; border-color: #8a3326; color: #f6ead0; font-style: normal; }
html[data-theme="tome"] .hp-bar, html[data-theme="tome"] .res-bar { border-color: #5a4a30; background: #2a1d10; border-radius: 2px; }
html[data-theme="tome"] #hp-fill, html[data-theme="tome"] .comp-top .hp-bar > div { background: #8a3326; }
/* brass dividers: the same metal as the frame, darkening where they meet the top and bottom of it so they blend in */
html[data-theme="tome"] .segs i::after { width: 4px; background: linear-gradient(180deg, rgba(92,66,16,.95) 0, rgba(92,66,16,0) 4px, rgba(92,66,16,0) calc(100% - 4px), rgba(92,66,16,.95) 100%),
  linear-gradient(90deg, #8a6a25, #dcbb66 50%, #8a6a25); }
html[data-theme="tome"] .tbl th, html[data-theme="tome"] .tbl td { border-color: #6f5e3c; }
html[data-theme="tome"] .portrait-frame, html[data-theme="tome"] .pic-frame, html[data-theme="tome"] .char-icon.has { border-color: #b08a3e; outline: 1px solid #3a2a18; outline-offset: 2px; }

/* satin bookmark ribbons as tabs: smooth, with soft lengthwise highlights and gold piping along both edges, and a V-cut tail */
html[data-theme="tome"] .tabs { border-bottom: 2px solid #6a5535; padding-left: 8px; gap: 4px; }
html[data-theme="tome"] .page > .tabs { background: #2b1d12; box-shadow: 0 6px 10px -4px rgba(0,0,0,.55); }
html[data-theme="tome"] .tab { position: relative; border-radius: 0; margin-top: 16px; padding: 19px 11px 9px; color: #f6ecce; text-shadow: 0 1px 1px rgba(30,16,4,.7);
  clip-path: polygon(0 0, 50% 14px, 100% 0, 100% 100%, 0 100%);
  background-color: #7b6741;
  background-image: linear-gradient(90deg, transparent 0, transparent 5px, rgba(226,190,108,.85) 5px, rgba(226,190,108,.85) 6px, transparent 6px,
      transparent calc(100% - 6px), rgba(226,190,108,.85) calc(100% - 6px), rgba(226,190,108,.85) calc(100% - 5px), transparent calc(100% - 5px)),
    linear-gradient(90deg, rgba(0,0,0,.30) 0%, rgba(255,246,220,.18) 20%, rgba(0,0,0,.02) 42%, rgba(255,246,220,.14) 66%, rgba(0,0,0,.30) 100%); }
html[data-theme="tome"] .tab:hover { background-color: #94804f; color: #fff6dc; }
html[data-theme="tome"] .tab.active { margin-top: 0; padding-top: 35px; animation: tab-rise .42s cubic-bezier(.22, .9, .3, 1); }
@keyframes tab-rise { from { clip-path: polygon(0 16px, 50% 30px, 100% 16px, 100% 100%, 0 100%); } to { clip-path: polygon(0 0, 50% 14px, 100% 0, 100% 100%, 0 100%); } }
html[data-theme="tome"] .tab.active, html[data-theme="tome"] .tab.active:hover { background-color: #8e3427; color: #fbefd2;
  background-image: linear-gradient(90deg, transparent 0, transparent 5px, rgba(240,200,110,.95) 5px, rgba(240,200,110,.95) 6px, transparent 6px,
      transparent calc(100% - 6px), rgba(240,200,110,.95) calc(100% - 6px), rgba(240,200,110,.95) calc(100% - 5px), transparent calc(100% - 5px)),
    linear-gradient(90deg, rgba(0,0,0,.34) 0%, rgba(255,190,160,.26) 20%, rgba(0,0,0,.02) 42%, rgba(255,190,160,.2) 66%, rgba(0,0,0,.34) 100%); }

/* the rest of the furniture: window headers, toasts, tooltips, form controls */
html[data-theme="tome"] .modal header, html[data-theme="tome"] #drawer header { border-bottom: 3px double #5a4a2c; }
html[data-theme="tome"] .modal header h2 { font-variant: small-caps; letter-spacing: .05em; color: var(--accent); }
html[data-theme="tome"] .seg { border-color: #5a4a2c; }
html[data-theme="tome"] .seg-btn { background: #a39472; color: #261a0b; border-right-color: #5a4a2c; }
html[data-theme="tome"] .seg-btn.on { background: #8a3326; color: #f6ead0; }
html[data-theme="tome"] .toast { background: #2a1d10; color: #f0e3c0; border: 1px solid #6a5535; font-style: italic; }
html[data-theme="tome"] .toast.good { background: #3a4a18; } html[data-theme="tome"] .toast.err { background: #6a2218; }
html[data-theme="tome"] #tooltip { background: #2a1d10; color: #f0e3c0; border: 1px solid #6a5535; font-style: italic; }
html[data-theme="tome"] input[type=checkbox], html[data-theme="tome"] input[type=range] { accent-color: #8a3326; }
html[data-theme="tome"] :focus-visible { outline: 2px solid #cfa84f; outline-offset: 1px; }
html[data-theme="tome"] ::selection { background: #8a3326; color: #f6ead0; }
html[data-theme="tome"] .opt-row { border-bottom: 1px dotted #5a4a2c; }
html[data-theme="tome"] .swatch.on { border-color: #261a0b; }

/* brass frames: bars and pictures sit in brushed brass, like fittings on an old book */
html[data-theme="tome"] .hp-bar, html[data-theme="tome"] .res-bar { height: 20px; border: 3px solid #a9812f; border-image: var(--brass) 12 / 3px stretch; border-radius: 0; box-shadow: 0 1px 2px rgba(0,0,0,.55); }
html[data-theme="tome"] .portrait-frame:not(.empty), html[data-theme="tome"] .pic-frame { border: 6px solid #a9812f; border-image: var(--brass) 14 / 6px stretch; border-radius: 0; outline: 1px solid #2c1f10; outline-offset: 0; box-shadow: 0 2px 6px rgba(0,0,0,.6); }
html[data-theme="tome"] .char-icon.has { border: 4px solid #a9812f; border-image: var(--brass) 12 / 4px stretch; border-radius: 0; }
html[data-theme="tome"] .char-icon { width: 68px; height: 68px; } /* bigger, so the picture inside the brass frame is still about the same size */

/* tome scroll bars: leather track, brass thumb */
html[data-theme="tome"] ::-webkit-scrollbar-track { background: #1a1209; border-left: 1px solid #0e0905; }
html[data-theme="tome"] ::-webkit-scrollbar-thumb { background: #6a5535; border: 2px solid #1a1209; border-radius: 6px; }
html[data-theme="tome"] ::-webkit-scrollbar-thumb:hover { background: #b08a3e; }

/* The page turn: the old page is cut into a dozen overlapping strips, each hinged to the one before, so the sheet curves as it swings over
   from the spine, then tilts, skews and wobbles so it reads as floppy paper. The shadow it casts falls on the page underneath.
   Going back a tab plays the same turn in reverse (the new page swings back over the old one).
   --c is how much the sheet is bending right now; --i is a strip's position along the page (0 to 1). */
@property --c { syntax: '<number>'; inherits: true; initial-value: 0; }
.page-turn { position: absolute; z-index: 6; pointer-events: none; perspective: 1800px; perspective-origin: 15% 40%; }
.pt-under, .pt-shadow { position: absolute; inset: 0; overflow: hidden; }

.pt-shadow { background: linear-gradient(90deg, rgba(0,0,0,.55), rgba(0,0,0,0) 75%); opacity: 0; }
.pt-sheet { position: absolute; inset: 0; transform-origin: left center; transform-style: preserve-3d; will-change: transform; }
.pt-strip { position: absolute; top: 0; height: 100%; transform-style: preserve-3d; transform-origin: left center; transform: rotateY(calc(var(--c) * var(--k, -1.2deg))); }
.pt-strip.first { left: 0; transform: none; }
.pt-strip .pt-strip { left: calc(100% - 3px); }
.pt-face { position: absolute; inset: 0; overflow: hidden; backface-visibility: hidden; }
.pt-front, .pt-under { background-color: #26190f; background-repeat: no-repeat, repeat;
  background-image: radial-gradient(ellipse at 50% 35%, rgba(70,48,28,.35), rgba(0,0,0,.45) 100%), var(--leather);
  background-size: var(--mw, 100%) var(--mh, 100%), auto;
  background-position: calc(0px - var(--bx, 0px) - var(--sx, 0px)) calc(0px - var(--by, 0px)), calc(0px - var(--bx, 0px) - var(--sx, 0px)) calc(0px - var(--by, 0px)); }
.pt-back { transform: rotateY(180deg); background-color: #4f4129; background-image: var(--grain); background-size: 220px 220px; background-position: calc(0px - var(--sx, 0px)) 0; }
.pt-front::after, .pt-back::after { content: ""; position: absolute; inset: 0; background: #000; pointer-events: none; opacity: calc(var(--c) * (.03 + var(--i, 0) * .34)); }
/* --c (how far the sheet is bent) is animated on the sheet and inherits; without --c: 0 here the page copies inside the strips restyled every element of every copy on every frame */
.pt-clone { position: absolute; top: 0; --c: 0; }
/* the copies keep the paper, but not the big blurred inner shadow: it is the dearest thing to draw and the gradient already darkens the edges */
.pt-clone .card { box-shadow: var(--shadow) !important; }
.page-turn.go .pt-sheet { animation: leaf-flip .64s cubic-bezier(.45, .05, .4, 1) forwards, leaf-bend .64s ease-in-out forwards; }
.page-turn.go .pt-shadow { animation: leaf-shadow .64s ease-in-out forwards; }
.page-turn.go .pt-face { animation: leaf-fade .64s linear forwards; }
.page-turn.rev.go .pt-sheet { animation: leaf-flip-rev .58s cubic-bezier(.4, .05, .45, 1) forwards, leaf-bend .58s ease-in-out forwards; }
.page-turn.rev.go .pt-shadow { animation: leaf-shadow-rev .58s ease-in-out forwards; }
.page-turn.rev.go .pt-face { animation: leaf-fade-rev .58s linear forwards; }
@keyframes leaf-flip {
  0%   { transform: rotateY(0deg) skewY(0deg); }
  50%  { transform: rotateY(-90deg) skewY(1.8deg); }
  100% { transform: rotateY(-180deg) skewY(0deg); }
}
@keyframes leaf-flip-rev {
  0%   { transform: rotateY(-150deg) skewY(0deg); }
  50%  { transform: rotateY(-72deg) skewY(1.8deg); }
  100% { transform: rotateY(0deg) skewY(0deg); }
}
@keyframes leaf-fade { 0%, 60% { opacity: 1; } 90%, 100% { opacity: 0; } }
@keyframes leaf-fade-rev { 0% { opacity: 0; } 16%, 100% { opacity: 1; } }
@keyframes leaf-shadow { 0% { opacity: 0; } 40% { opacity: .7; } 100% { opacity: 0; } }
@keyframes leaf-shadow-rev { 0% { opacity: 0; } 55% { opacity: .7; } 100% { opacity: 0; } }
@keyframes leaf-bend { 0% { --c: 0; } 38% { --c: 1; } 75% { --c: .55; } 100% { --c: 0; } }
@keyframes leaf-shadow { 0% { opacity: 0; } 35% { opacity: .75; } 100% { opacity: 0; } }
'''


def main():
    css = (CSS.replace('@GRAIN@', GRAIN).replace('@LEATHER@', LEATHER).replace('@BRASS@', brass())
           .replace('@PAPERS@', paper_rules()).replace('@SHEET@', sheet(0)))
    with open(OUT, 'w', encoding='utf-8', newline='\n') as f:
        f.write(css)
    print('wrote', OUT, len(css), 'bytes')


if __name__ == '__main__':
    if '--dump' in sys.argv:
        main()
        json.dump(TEXTURES, sys.stdout)
    else:
        main()
