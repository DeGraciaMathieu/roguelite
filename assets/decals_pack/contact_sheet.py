#!/usr/bin/env python3
"""Planche de validation : tous les decals sur le sol de reference, par categorie.
lightSource composes en ADDITIF (comme en jeu) pour montrer le glow."""
import os, math
import numpy as np
from PIL import Image, ImageDraw, ImageFont

SRC = "/home/claude/assets/decals"
FLOOR = (34, 39, 46)
CATS = ["decals", "debris", "overhead", "lightSource", "overgrowth"]
TITLES = {"decals": "FLOOR DECALS", "debris": "DEBRIS", "overhead": "OVERHEAD / MURAL",
          "lightSource": "LIGHTSOURCE (additif)", "overgrowth": "OVERGROWTH"}
ZOOM = 3
PAD = 22
CELL_W = 150
LABEL_H = 16
COLS = 8

def font(sz):
    for p in ["/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf",
              "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"]:
        if os.path.exists(p): return ImageFont.truetype(p, sz)
    return ImageFont.load_default()

def floor_bg(w, h):
    rng = np.random.default_rng(1)
    base = np.array(FLOOR)
    n = rng.normal(0, 5, (h, w, 1))
    arr = np.clip(base[None, None, :] + n, 0, 255).astype(np.uint8)
    img = Image.fromarray(np.dstack([arr, np.full((h, w), 255, np.uint8)]), "RGBA")
    d = ImageDraw.Draw(img)
    for gx in range(0, w, 64):
        d.line([(gx, 0), (gx, h)], fill=(20, 24, 29, 120), width=1)
    for gy in range(0, h, 64):
        d.line([(0, gy), (w, gy)], fill=(20, 24, 29, 120), width=1)
    return img

# layout par categorie
rows_per_cat = {}
for c in CATS:
    files = sorted(os.listdir(os.path.join(SRC, c)))
    rows_per_cat[c] = math.ceil(len(files) / COLS)

cell_h = 130
total_h = PAD
for c in CATS:
    total_h += 30 + rows_per_cat[c] * cell_h + 18
W = PAD * 2 + COLS * CELL_W
H = total_h + PAD

sheet = floor_bg(W, H)
d = ImageDraw.Draw(sheet)
f_title = font(15)
f_lbl = font(11)
f_dim = font(9)

y = PAD
for c in CATS:
    d.text((PAD, y), TITLES[c], font=f_title, fill=(208, 196, 170, 255))
    y += 30
    files = sorted(os.listdir(os.path.join(SRC, c)))
    for i, fn in enumerate(files):
        col = i % COLS; row = i // COLS
        cx = PAD + col * CELL_W + CELL_W // 2
        cy = y + row * cell_h + (cell_h - LABEL_H) // 2
        im = Image.open(os.path.join(SRC, c, fn)).convert("RGBA")
        bw, bh = im.size
        im = im.resize((bw * ZOOM, bh * ZOOM), Image.NEAREST)
        px = int(cx - im.width / 2); py = int(cy - im.height / 2)
        if c == "lightSource":
            # composition additive sur le sol
            region = sheet.crop((px, py, px + im.width, py + im.height)).convert("RGB")
            ra = np.array(region, np.float32)
            ia = np.array(im, np.float32)
            alpha = ia[..., 3:4] / 255.0
            add = ra + ia[..., :3] * alpha * 1.15
            out = Image.fromarray(np.clip(add, 0, 255).astype(np.uint8), "RGB").convert("RGBA")
            sheet.paste(out, (px, py))
        else:
            sheet.alpha_composite(im, (px, py))
        name = fn.replace(".png", "")
        d.text((cx, y + row * cell_h + cell_h - LABEL_H), name, font=f_lbl,
               fill=(225, 225, 230, 255), anchor="ma")
        d.text((cx, y + row * cell_h + cell_h - 3), f"{bw}x{bh}", font=f_dim,
               fill=(150, 150, 158, 255), anchor="ma")
    y += rows_per_cat[c] * cell_h + 18

out = "/home/claude/assets/decals_contact_sheet.png"
sheet.convert("RGB").save(out)
print("saved", out, sheet.size)
