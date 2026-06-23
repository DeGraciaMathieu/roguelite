#!/usr/bin/env python3
"""
Pack de DECALS / decorations top-down pour le rogue-lite (style Dino Crisis).
Meme recette que le pack d'assets existant :
  - PIL + numpy, supersampling x4, downscale LANCZOS
  - contour par dilatation (MaxFilter) couleur OUTLINE = (26,22,36)
  - flat shading sur palette industrielle sombre (~#22272e)
  - tout ce qui s'oriente : "avant" vers le haut
Les lightSource sont EMISSIFS (pas de contour) -> a blitter en ADD dans Pixi.
"""
import os, math
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

SS = 4
OUTLINE = (26, 22, 36, 255)
OUT = "/home/claude/assets/decals"

# ---------- palette commune (coherente avec le tileset) ----------
FLOOR      = (34, 39, 46)        # sol de reference (pour le mockup)
GROOVE     = (20, 24, 29)
METAL_D    = (50, 56, 66)
METAL      = (90, 98, 110)
METAL_L    = (132, 142, 156)
BLOOD_D    = (66, 16, 20)
BLOOD      = (108, 26, 30)
BLOOD_L    = (150, 44, 46)
OIL_D      = (14, 15, 20)
OIL        = (24, 26, 34)
OIL_SHEEN  = (46, 58, 70)
AMBER      = (196, 150, 48)
AMBER_D    = (120, 90, 28)
RUST       = (122, 70, 42)
RUST_D     = (78, 44, 28)
PAPER      = (198, 194, 178)
PAPER_SH   = (150, 146, 130)
WOOD       = (122, 88, 52)
WOOD_D     = (82, 58, 34)
WOOD_L     = (152, 114, 72)
BRASS      = (176, 146, 70)
BRASS_L    = (214, 188, 112)
GLASS      = (172, 200, 210)
SOOT       = (22, 22, 26)
CHAR       = (54, 46, 42)
MOSS_D     = (40, 70, 36)
MOSS       = (72, 112, 56)
MOSS_L     = (104, 146, 72)
IVY        = (60, 104, 52)
ROOT       = (96, 84, 54)
ROOT_D     = (64, 54, 34)

os.makedirs(OUT, exist_ok=True)
rng_global = np.random.default_rng(7)

# ============================ helpers ============================
def cv(tw, th):
    W, H = tw * SS, th * SS
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    return img, ImageDraw.Draw(img), W, H

def add_outline(img, px=5, color=OUTLINE):
    a = img.split()[3]
    d = a
    for _ in range(int(px)):
        d = d.filter(ImageFilter.MaxFilter(3))
    out = Image.new("RGBA", img.size, color)
    out.putalpha(d)
    out.alpha_composite(img)
    return out

def finish(img, tw, th, outline=True, px=5, color=OUTLINE):
    if outline:
        img = add_outline(img, px, color)
    return img.resize((tw, th), Image.LANCZOS)

def save(img, cat, name):
    d = os.path.join(OUT, cat)
    os.makedirs(d, exist_ok=True)
    img.save(os.path.join(d, name + ".png"))
    return img

def blob(d, cx, cy, r, fill, seed, jag=0.34, n=18):
    """polygone organique (tache) centre cx,cy rayon r."""
    rng = np.random.default_rng(seed)
    pts = []
    for i in range(n):
        a = 2 * math.pi * i / n
        rr = r * (1 + rng.uniform(-jag, jag))
        pts.append((cx + math.cos(a) * rr, cy + math.sin(a) * rr * 0.92))
    d.polygon(pts, fill=fill)

def radial_glow(tw, th, color, falloff=2.2, cx=0.5, cy=0.5, rx=0.5, ry=0.5, gamma=1.0):
    """nappe lumineuse emissive (alpha radial), pour les lightSource."""
    W, H = tw * SS, th * SS
    xs = (np.linspace(0, 1, W) - cx) / max(rx, 1e-3)
    ys = (np.linspace(0, 1, H) - cy) / max(ry, 1e-3)
    X, Y = np.meshgrid(xs, ys)
    d = np.sqrt(X * X + Y * Y)
    a = np.clip(1 - d, 0, 1) ** falloff
    a = a ** gamma
    arr = np.zeros((H, W, 4), np.uint8)
    arr[..., 0] = color[0]; arr[..., 1] = color[1]; arr[..., 2] = color[2]
    arr[..., 3] = (a * 255).astype(np.uint8)
    return Image.fromarray(arr, "RGBA").resize((tw, th), Image.LANCZOS)

# ============================ FLOOR DECALS ============================
def bloodStain(tw=48, th=40):
    img, d, W, H = cv(tw, th)
    cx, cy = W * 0.5, H * 0.52
    blob(d, cx, cy, H * 0.40, BLOOD_D + (255,), seed=11, jag=0.40)
    blob(d, cx, cy, H * 0.32, BLOOD + (255,), seed=12, jag=0.34)
    blob(d, cx - W * 0.05, cy - H * 0.06, H * 0.16, BLOOD_L + (210,), seed=13, jag=0.30)
    rng = np.random.default_rng(14)
    for _ in range(9):  # spatter
        a = rng.uniform(0, 2 * math.pi); rr = rng.uniform(H * 0.30, H * 0.52)
        x, y = cx + math.cos(a) * rr, cy + math.sin(a) * rr * 0.9
        s = rng.uniform(2, 5) * SS / 2
        d.ellipse([x - s, y - s, x + s, y + s], fill=BLOOD_D + (255,))
    return save(finish(img, tw, th, px=3, color=(40, 8, 12, 255)), "decals", "bloodStain")

def bloodTrail(tw=80, th=24):
    img, d, W, H = cv(tw, th)
    cy = H * 0.5
    rng = np.random.default_rng(21)
    # smear principal qui s'estompe de droite (sombre) a gauche
    for i in range(60):
        t = i / 59
        x = W * (0.08 + 0.86 * t)
        bw = H * (0.34 - 0.18 * t) * (1 + rng.uniform(-0.15, 0.15))
        col = tuple(int(a + (b - a) * t) for a, b in zip(BLOOD, BLOOD_D))
        d.ellipse([x - bw, cy - bw, x + bw, cy + bw], fill=col + (255,))
    for _ in range(5):  # stries de doigts
        yo = rng.uniform(-H * 0.22, H * 0.22)
        d.line([(W * 0.16, cy + yo), (W * 0.9, cy + yo * 0.4)],
               fill=BLOOD_D + (200,), width=SS)
    return save(finish(img, tw, th, px=2, color=(40, 8, 12, 255)), "decals", "bloodTrail")

def clawMarks(tw=40, th=40):
    img, d, W, H = cv(tw, th)
    rng = np.random.default_rng(31)
    for k in range(4):  # 4 gouges paralleles diagonales
        off = (k - 1.5) * W * 0.16
        x0, y0 = W * 0.18 + off, H * 0.86
        x1, y1 = W * 0.74 + off, H * 0.10
        cxp, cyp = (x0 + x1) / 2 + W * 0.08, (y0 + y1) / 2
        pts = [(x0, y0)]
        for s in np.linspace(0.15, 0.85, 6):
            bx = (1 - s) ** 2 * x0 + 2 * (1 - s) * s * cxp + s * s * x1
            by = (1 - s) ** 2 * y0 + 2 * (1 - s) * s * cyp + s * s * y1
            pts.append((bx + rng.uniform(-2, 2) * SS, by))
        pts.append((x1, y1))
        # bord clair (metal raye) puis creux sombre
        d.line(pts, fill=(70, 78, 90, 255), width=int(4.2 * SS), joint="curve")
        d.line(pts, fill=(18, 20, 26, 255), width=int(2.2 * SS), joint="curve")
    return save(finish(img, tw, th, outline=False), "decals", "clawMarks")

def concreteCrack(tw=64, th=16):
    img, d, W, H = cv(tw, th)
    rng = np.random.default_rng(41)
    cy = H * 0.5
    pts = [(0, cy + rng.uniform(-2, 2) * SS)]
    x = 0
    while x < W:
        x += rng.uniform(0.06, 0.14) * W
        pts.append((min(x, W), cy + rng.uniform(-H * 0.28, H * 0.28)))
    d.line(pts, fill=(16, 18, 22, 255), width=int(1.8 * SS), joint="curve")
    for px, py in pts[1:-1]:  # branches
        if rng.random() < 0.6:
            d.line([(px, py), (px + rng.uniform(-8, 8) * SS, py + rng.uniform(-6, 6) * SS)],
                   fill=(16, 18, 22, 255), width=SS)
    return save(finish(img, tw, th, outline=False), "decals", "concreteCrack")

def oilSpill(tw=56, th=48):
    img, d, W, H = cv(tw, th)
    cx, cy = W * 0.5, H * 0.52
    blob(d, cx, cy, H * 0.42, OIL_D + (255,), seed=51, jag=0.38)
    blob(d, cx, cy, H * 0.33, OIL + (255,), seed=52, jag=0.30)
    blob(d, cx - W * 0.06, cy - H * 0.08, H * 0.14, OIL_SHEEN + (150,), seed=53, jag=0.4)
    blob(d, cx + W * 0.10, cy + H * 0.04, H * 0.07, (60, 80, 88, 130), seed=54, jag=0.4)
    return save(finish(img, tw, th, px=3, color=(8, 9, 13, 255)), "decals", "oilSpill")

def drainGrate(tw=32, th=32):
    img, d, W, H = cv(tw, th)
    m = W * 0.08
    d.rounded_rectangle([m, m, W - m, H - m], radius=int(2 * SS), fill=METAL_D + (255,))
    d.rounded_rectangle([m + 2 * SS, m + 2 * SS, W - m - 2 * SS, H - m - 2 * SS],
                        radius=int(1.5 * SS), fill=(14, 16, 20, 255))
    bars = 5
    for i in range(bars):
        x = m + 4 * SS + i * (W - m * 2 - 8 * SS) / (bars - 1)
        d.line([(x, m + 3 * SS), (x, H - m - 3 * SS)], fill=METAL + (255,), width=int(1.6 * SS))
    d.rectangle([m, m, W - m, m + 1.5 * SS], fill=METAL_L + (200,))  # liseret haut
    return save(finish(img, tw, th, px=3), "decals", "drainGrate")

def hazardStripes(tw=96, th=24):
    img, d, W, H = cv(tw, th)
    d.rounded_rectangle([0, H * 0.12, W, H * 0.88], radius=int(2 * SS), fill=(28, 26, 22, 255))
    sw = H * 0.55
    x = -H
    while x < W + H:
        d.polygon([(x, H * 0.12), (x + sw, H * 0.12), (x + sw - H, H * 0.88), (x - H, H * 0.88)],
                  fill=AMBER + (255,))
        x += sw * 2
    # usure
    rng = np.random.default_rng(61)
    for _ in range(40):
        x, y = rng.uniform(0, W), rng.uniform(H * 0.12, H * 0.88)
        s = rng.uniform(1, 3) * SS
        d.ellipse([x, y, x + s, y + s], fill=(28, 26, 22, 180))
    return save(finish(img, tw, th, px=3), "decals", "hazardStripes")

def scorchMark(tw=44, th=44):
    img, d, W, H = cv(tw, th)
    cx, cy = W * 0.5, H * 0.5
    blob(d, cx, cy, H * 0.44, CHAR + (180,), seed=71, jag=0.42)
    blob(d, cx, cy, H * 0.32, SOOT + (235,), seed=72, jag=0.34)
    blob(d, cx, cy, H * 0.18, (8, 8, 10, 255), seed=73, jag=0.3)
    rng = np.random.default_rng(74)
    for _ in range(16):  # eclats de suie
        a = rng.uniform(0, 2 * math.pi); rr = rng.uniform(H * 0.30, H * 0.50)
        x, y = cx + math.cos(a) * rr, cy + math.sin(a) * rr
        s = rng.uniform(1, 3) * SS
        d.ellipse([x, y, x + s, y + s], fill=SOOT + (200,))
    return save(finish(img, tw, th, outline=False), "decals", "scorchMark")

# ============================ DEBRIS ============================
def _casing(d, x, y, ang, scale):
    L, Wd = 9 * SS * scale, 3.4 * SS * scale
    ca, sa = math.cos(ang), math.sin(ang)
    def R(dx, dy): return (x + dx * ca - dy * sa, y + dx * sa + dy * ca)
    d.polygon([R(-L/2, -Wd/2), R(L/2, -Wd/2), R(L/2, Wd/2), R(-L/2, Wd/2)], fill=BRASS + (255,))
    d.line([R(-L/2, 0), R(L/2, 0)], fill=BRASS_L + (255,), width=max(1, int(0.8 * SS)))
    px, py = R(L/2 - 0.6*SS, 0); pr = 1.6*SS  # primer/culot
    d.ellipse([px-pr, py-pr, px+pr, py+pr], fill=(120, 96, 44, 255))

def bulletCasings(tw=28, th=28):
    img, d, W, H = cv(tw, th)
    rng = np.random.default_rng(81)
    for _ in range(5):
        _casing(d, rng.uniform(W*0.25, W*0.75), rng.uniform(H*0.25, H*0.75),
                rng.uniform(0, math.pi), rng.uniform(0.85, 1.1))
    return save(finish(img, tw, th, px=3), "debris", "bulletCasings")

def rubble(tw=52, th=40):
    img, d, W, H = cv(tw, th)
    rng = np.random.default_rng(91)
    chunks = []
    for _ in range(11):
        cx, cy = rng.uniform(W*0.2, W*0.8), rng.uniform(H*0.3, H*0.8)
        r = rng.uniform(H*0.10, H*0.24)
        n = rng.integers(4, 6)
        pts = [(cx + math.cos(2*math.pi*i/n + rng.uniform(0,1)) * r * rng.uniform(0.7,1.2),
                cy + math.sin(2*math.pi*i/n + rng.uniform(0,1)) * r * rng.uniform(0.7,1.2))
               for i in range(n)]
        chunks.append((cy, pts))
    for cy, pts in sorted(chunks):  # plus bas dessine au-dessus
        base = rng.integers(78, 96)
        d.polygon([(x+1.5*SS, y+1.5*SS) for x, y in pts], fill=(24, 26, 30, 255))  # ombre
        d.polygon(pts, fill=(base, base+6, base+12, 255))
        top = [(x, y) for x, y in pts if y < cy]
        if len(top) >= 2:
            d.line(top, fill=(base+30, base+34, base+40, 255), width=SS)
    return save(finish(img, tw, th, px=3), "debris", "rubble")

def scatteredPapers(tw=40, th=32):
    img, d, W, H = cv(tw, th)
    rng = np.random.default_rng(101)
    for _ in range(5):
        cx, cy = rng.uniform(W*0.3, W*0.7), rng.uniform(H*0.3, H*0.7)
        ang = rng.uniform(0, math.pi)
        pw, ph = W*0.34, H*0.40
        ca, sa = math.cos(ang), math.sin(ang)
        def R(dx, dy): return (cx + dx*ca - dy*sa, cy + dx*sa + dy*ca)
        corners = [R(-pw/2,-ph/2), R(pw/2,-ph/2), R(pw/2,ph/2), R(-pw/2,ph/2)]
        d.polygon([(x+1.5*SS, y+1.5*SS) for x,y in corners], fill=(20,22,26,150))
        d.polygon(corners, fill=PAPER + (255,))
        for ln in range(3):  # lignes de texte
            yy = -ph/2 + ph*(0.28 + 0.22*ln)
            d.line([R(-pw*0.34, yy), R(pw*0.34, yy)], fill=PAPER_SH + (200,), width=max(1,int(0.7*SS)))
    return save(finish(img, tw, th, px=3), "debris", "scatteredPapers")

def brokenCrate(tw=44, th=44):
    img, d, W, H = cv(tw, th)
    m = W*0.14
    d.polygon([(m,m),(W-m,m+2*SS),(W-m*0.8,H-m),(m+1.5*SS,H-m*0.8)], fill=(18,20,24,255))  # interieur sombre
    rng = np.random.default_rng(111)
    planks = [((m, m), (W-m, m+1.5*SS)), ((m+1*SS, H-m), (W-m*1.1, H-m+1*SS))]
    for (ax, ay), (bx, by) in planks:  # planches haut/bas restantes
        th_p = 5*SS
        d.line([(ax, ay+th_p/2), (bx, by+th_p/2)], fill=WOOD + (255,), width=int(th_p))
        d.line([(ax, ay+1.5*SS), (bx, by+1.5*SS)], fill=WOOD_L + (255,), width=SS)
    # planches brisees / eclats
    for _ in range(5):
        x0 = rng.uniform(m, W-m); y0 = rng.uniform(m, H-m)
        ang = rng.uniform(0, math.pi); ln = rng.uniform(W*0.18, W*0.34)
        x1, y1 = x0+math.cos(ang)*ln, y0+math.sin(ang)*ln
        d.line([(x0,y0),(x1,y1)], fill=WOOD_D + (255,), width=int(3*SS))
        d.line([(x0,y0),(x1,y1)], fill=WOOD + (255,), width=SS)
    return save(finish(img, tw, th, px=3), "debris", "brokenCrate")

def brokenPallet(tw=60, th=40):
    img, d, W, H = cv(tw, th)
    rng = np.random.default_rng(121)
    # 2 longerons + lattes transversales, certaines cassees
    for ry in (H*0.22, H*0.78):
        d.line([(W*0.06, ry), (W*0.94, ry)], fill=WOOD_D + (255,), width=int(4*SS))
    n = 7
    for i in range(n):
        x = W*0.08 + i*(W*0.84)/(n-1)
        broken = rng.random() < 0.3
        y1 = H*0.16
        y2 = H*0.84 if not broken else rng.uniform(H*0.40, H*0.62)
        d.line([(x, y1), (x, y2)], fill=WOOD + (255,), width=int(3.4*SS))
        d.line([(x-0.6*SS, y1), (x-0.6*SS, y2)], fill=WOOD_L + (200,), width=SS)
        if broken:  # bout casse qui traine
            d.line([(x+rng.uniform(-4,4)*SS, y2+2*SS), (x+rng.uniform(-6,6)*SS, H*0.86)],
                   fill=WOOD_D + (255,), width=int(3*SS))
    return save(finish(img, tw, th, px=3), "debris", "brokenPallet")

def shatteredGlass(tw=36, th=36):
    img, d, W, H = cv(tw, th)
    rng = np.random.default_rng(131)
    cx, cy = W*0.5, H*0.5
    for _ in range(13):
        a = rng.uniform(0, 2*math.pi); rr = rng.uniform(H*0.06, H*0.46)
        x, y = cx+math.cos(a)*rr, cy+math.sin(a)*rr
        s = rng.uniform(2.5, 6)*SS
        n = rng.integers(3, 4)
        pts = [(x+math.cos(2*math.pi*i/n+a)*s*rng.uniform(0.5,1),
                y+math.sin(2*math.pi*i/n+a)*s*rng.uniform(0.5,1)) for i in range(n)]
        d.polygon(pts, fill=GLASS + (110,))
        d.line([pts[0], pts[1]], fill=(235, 248, 252, 230), width=max(1,int(0.8*SS)))  # glint
    return save(finish(img, tw, th, px=2, color=(40, 60, 70, 255)), "debris", "shatteredGlass")

# ============================ OVERHEAD ============================
def hangingCable(tw=16, th=72):
    img, d, W, H = cv(tw, th)
    rng = np.random.default_rng(141)
    pts = [(W*0.5, 0)]
    for t in np.linspace(0.1, 1, 12):
        sway = math.sin(t*3.2) * W*0.22 + rng.uniform(-1,1)*SS
        pts.append((W*0.5 + sway*t, H*t))
    d.line(pts, fill=(22, 24, 30, 255), width=int(2.4*SS), joint="curve")
    d.line(pts, fill=(60, 66, 76, 255), width=SS, joint="curve")
    # connecteur en haut + bout denude
    d.rectangle([W*0.32, 0, W*0.68, H*0.06], fill=METAL_D + (255,))
    ex, ey = pts[-1]
    for _ in range(3):
        d.line([(ex, ey), (ex+rng.uniform(-4,4)*SS, ey+rng.uniform(-2,3)*SS)],
               fill=(150, 120, 60, 255), width=max(1,int(0.8*SS)))
    return save(finish(img, tw, th, px=2), "overhead", "hangingCable")

def ventDuct(tw=64, th=40):
    img, d, W, H = cv(tw, th)
    m = W*0.05
    d.rounded_rectangle([m, m, W-m, H-m], radius=int(2*SS), fill=METAL_D + (255,))
    d.rounded_rectangle([m+2.5*SS, m+2.5*SS, W-m-2.5*SS, H-m-2.5*SS],
                        radius=int(1.5*SS), fill=(34, 38, 44, 255))
    slats = 6
    for i in range(slats):
        y = m+5*SS + i*(H-m*2-10*SS)/(slats-1)
        d.line([(m+5*SS, y), (W-m-5*SS, y)], fill=METAL + (255,), width=int(1.8*SS))
        d.line([(m+5*SS, y-0.8*SS), (W-m-5*SS, y-0.8*SS)], fill=METAL_L + (160,), width=max(1,int(0.7*SS)))
    for cx, cy in [(m+3*SS, m+3*SS), (W-m-3*SS, m+3*SS), (m+3*SS, H-m-3*SS), (W-m-3*SS, H-m-3*SS)]:
        d.ellipse([cx-1.4*SS, cy-1.4*SS, cx+1.4*SS, cy+1.4*SS], fill=(20,22,28,255))
    return save(finish(img, tw, th, px=3), "overhead", "ventDuct")

def pipeRun(tw=120, th=20):
    img, d, W, H = cv(tw, th)
    cy = H*0.5; r = H*0.30
    d.rectangle([0, cy-r, W, cy+r], fill=METAL_D + (255,))
    d.rectangle([0, cy-r, W, cy-r*0.2], fill=METAL + (255,))      # bande lumiere
    d.rectangle([0, cy-r*0.9, W, cy-r*0.55], fill=METAL_L + (220,))
    for bx in (W*0.18, W*0.5, W*0.82):  # brides
        d.rectangle([bx-2*SS, cy-r-1.5*SS, bx+2*SS, cy+r+1.5*SS], fill=(58,64,74,255))
        d.rectangle([bx-2*SS, cy-r-1.5*SS, bx+2*SS, cy-r*0.4], fill=METAL + (255,))
    d.ellipse([W*0.5-r*1.3, cy-r*1.3, W*0.5+r*1.3, cy+r*1.3], outline=(40,44,52,255), width=int(1.5*SS))  # valve
    return save(finish(img, tw, th, px=3), "overhead", "pipeRun")

def wallStain(tw=48, th=64):
    img, d, W, H = cv(tw, th)
    cx = W*0.5
    blob(d, cx, H*0.22, W*0.34, RUST_D + (170,), seed=151, jag=0.42)
    blob(d, cx, H*0.20, W*0.24, RUST + (160,), seed=152, jag=0.36)
    rng = np.random.default_rng(153)
    for _ in range(7):  # coulures qui descendent
        x = cx + rng.uniform(-W*0.28, W*0.28)
        y0 = H*0.22 + rng.uniform(0, H*0.1)
        y1 = rng.uniform(H*0.55, H*0.96)
        w = rng.uniform(1.4, 3.2)*SS
        col = RUST_D if rng.random() < 0.5 else (70, 52, 36)
        d.line([(x, y0), (x+rng.uniform(-3,3)*SS, y1)], fill=col + (150,), width=int(w))
    return save(finish(img, tw, th, px=2, color=(30, 22, 16, 255)), "overhead", "wallStain")

# ============================ LIGHTSOURCE (emissif, ADD) ============================
def neonLight(tw=72, th=12):
    base = radial_glow(tw, th, (150, 210, 240), falloff=1.6, ry=0.85, rx=0.5)
    img = base.copy()
    d = ImageDraw.Draw(img)
    W, H = tw, th
    d.rounded_rectangle([W*0.06, H*0.34, W*0.94, H*0.66], radius=int(H*0.3),
                        fill=(214, 238, 252, 255))  # tube
    d.rounded_rectangle([W*0.06, H*0.40, W*0.5, H*0.6], radius=int(H*0.25),
                        fill=(120, 170, 200, 180))   # segment qui faiblit
    return save(img, "lightSource", "neonLight")

def alarmLight(tw=24, th=24):
    img = radial_glow(tw, th, (235, 60, 48), falloff=2.4, gamma=0.9)
    d = ImageDraw.Draw(img)
    W, H = tw, th
    d.ellipse([W*0.34, H*0.34, W*0.66, H*0.66], fill=(255, 150, 140, 255))  # coeur chaud
    d.ellipse([W*0.42, H*0.42, W*0.58, H*0.58], fill=(255, 235, 230, 255))
    return save(img, "lightSource", "alarmLight")

def emergencyLamp(tw=20, th=28):
    img = radial_glow(tw, th, (255, 176, 70), falloff=2.0, cy=0.42, ry=0.55)
    d = ImageDraw.Draw(img)
    W, H = tw, th
    d.rectangle([W*0.18, H*0.06, W*0.82, H*0.22], fill=(48, 44, 40, 255))   # boitier
    d.rectangle([W*0.26, H*0.10, W*0.74, H*0.19], fill=(255, 210, 130, 255))  # ampoule
    return save(img, "lightSource", "emergencyLamp")

def doorGlow(tw=48, th=24):
    """lumiere chaude qui filtre sous une porte : bande horizontale degradee."""
    W, H = tw * SS, th * SS
    xs = np.linspace(-1, 1, W)
    ys = np.linspace(-1, 1, H)
    X, Y = np.meshgrid(xs, ys)
    a = np.clip(1 - np.abs(Y) ** 1.4, 0, 1) * np.clip(1 - np.abs(X) ** 2.2, 0, 1)
    arr = np.zeros((H, W, 4), np.uint8)
    arr[..., 0] = 255; arr[..., 1] = 196; arr[..., 2] = 120
    arr[..., 3] = (a * 235).astype(np.uint8)
    img = Image.fromarray(arr, "RGBA").resize((tw, th), Image.LANCZOS)
    d = ImageDraw.Draw(img)
    d.rectangle([tw*0.1, th*0.46, tw*0.9, th*0.54], fill=(255, 232, 190, 255))  # raie centrale
    return save(img, "lightSource", "doorGlow")

# ============================ OVERGROWTH ============================
def roots(tw=64, th=56):
    img, d, W, H = cv(tw, th)
    rng = np.random.default_rng(161)
    cx, cy = W*0.5, H*0.5
    def grow(x, y, ang, ln, w, depth):
        if depth <= 0 or w < 0.6*SS: return
        x2 = x + math.cos(ang)*ln; y2 = y + math.sin(ang)*ln
        d.line([(x, y), (x2, y2)], fill=ROOT_D + (255,), width=int(w))
        d.line([(x, y), (x2, y2)], fill=ROOT + (255,), width=max(1, int(w*0.45)))
        for _ in range(rng.integers(1, 3)):
            grow(x2, y2, ang + rng.uniform(-0.9, 0.9), ln*rng.uniform(0.6,0.85),
                 w*rng.uniform(0.55,0.75), depth-1)
    for k in range(5):
        grow(cx, cy, 2*math.pi*k/5 + rng.uniform(-0.3,0.3), H*0.20, 4.2*SS, 4)
    return save(finish(img, tw, th, outline=False), "overgrowth", "roots")

def moss(tw=40, th=40):
    img, d, W, H = cv(tw, th)
    cx, cy = W*0.5, H*0.52
    blob(d, cx, cy, H*0.42, MOSS_D + (255,), seed=171, jag=0.40)
    blob(d, cx, cy, H*0.34, MOSS + (255,), seed=172, jag=0.34)
    rng = np.random.default_rng(173)
    for _ in range(60):  # mouchetis
        a = rng.uniform(0, 2*math.pi); rr = rng.uniform(0, H*0.36)
        x, y = cx+math.cos(a)*rr, cy+math.sin(a)*rr*0.92
        s = rng.uniform(1, 3)*SS
        col = MOSS_L if rng.random() < 0.6 else MOSS_D
        d.ellipse([x, y, x+s, y+s], fill=col + (220,))
    return save(finish(img, tw, th, px=2, color=(24, 44, 22, 255)), "overgrowth", "moss")

def _leaf(d, x, y, ang, s):
    ca, sa = math.cos(ang), math.sin(ang)
    def R(dx, dy): return (x + dx*ca - dy*sa, y + dx*sa + dy*ca)
    d.polygon([R(0, 0), R(s*0.5, -s*0.4), R(s, 0), R(s*0.5, s*0.4)], fill=IVY + (255,))
    d.line([R(0, 0), R(s, 0)], fill=(40, 80, 38, 255), width=1)

def ivy(tw=32, th=80):
    img, d, W, H = cv(tw, th)
    rng = np.random.default_rng(181)
    pts = [(W*0.5, H)]
    for t in np.linspace(0.1, 1, 14):
        x = W*0.5 + math.sin(t*5)*W*0.26
        pts.append((x, H*(1-t)))
    d.line(pts, fill=(46, 84, 42, 255), width=int(2.2*SS), joint="curve")  # tige
    for (x, y) in pts[1:]:
        if rng.random() < 0.8:
            _leaf(d, x, y, rng.uniform(0, 2*math.pi), rng.uniform(5, 8)*SS)
    return save(finish(img, tw, th, px=2, color=(24, 46, 22, 255)), "overgrowth", "ivy")

def crackWeeds(tw=36, th=28):
    img, d, W, H = cv(tw, th)
    rng = np.random.default_rng(191)
    d.line([(W*0.1, H*0.82), (W*0.9, H*0.86)], fill=(16, 18, 22, 255), width=int(1.6*SS))  # fissure
    for _ in range(11):  # brins d'herbe
        x0 = rng.uniform(W*0.2, W*0.8); y0 = H*0.84
        ang = -math.pi/2 + rng.uniform(-0.5, 0.5)
        ln = rng.uniform(H*0.30, H*0.66)
        x1, y1 = x0+math.cos(ang)*ln, y0+math.sin(ang)*ln
        cxp = (x0+x1)/2 + rng.uniform(-4,4)*SS
        d.line([(x0,y0),(cxp,(y0+y1)/2),(x1,y1)],
               fill=(rng.integers(60,90), rng.integers(110,140), rng.integers(54,70), 255),
               width=max(1,int(1.6*SS)), joint="curve")
    return save(finish(img, tw, th, outline=False), "overgrowth", "crackWeeds")

# ============================ run ============================
FUNCS = [bloodStain, bloodTrail, clawMarks, concreteCrack, oilSpill, drainGrate,
         hazardStripes, scorchMark, bulletCasings, rubble, scatteredPapers,
         brokenCrate, brokenPallet, shatteredGlass, hangingCable, ventDuct,
         pipeRun, wallStain, neonLight, alarmLight, emergencyLamp, doorGlow,
         roots, moss, ivy, crackWeeds]

if __name__ == "__main__":
    for f in FUNCS:
        f()
        print("ok", f.__name__)
    print("DONE", len(FUNCS), "decals ->", OUT)
