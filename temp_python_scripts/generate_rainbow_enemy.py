"""
generate_rainbow_enemy.py
-------------------------
Takes data/map_imgs/rainbow.png, crops/scales it to a 30x30 square,
adds random pixel noise in rainbow colors, and saves enemy_rainbow.png.
"""
import os
import numpy as np
from PIL import Image

TILE = 30
NOISE_DENSITY = 0.000001  # fraction of pixels to add noise dots to

def main():
    src = os.path.join('data', 'map_imgs', 'rainbow.png')
    dst = os.path.join('data', 'map_imgs', 'enemy_rainbow.png')

    img = Image.open(src).convert('RGBA')

    # Crop to square from center, then resize to TILE x TILE
    w, h = img.size
    side = min(w, h)
    left  = (w - side) // 2
    top   = (h - side) // 2
    img   = img.crop((left, top, left + side, top + side))
    img   = img.resize((TILE, TILE), Image.LANCZOS)

    arr = np.array(img, dtype=np.uint8)

    # Add rainbow noise pixels
    rng = np.random.default_rng(42)
    n_noise = max(1, int(TILE * TILE * NOISE_DENSITY))
    rows = rng.integers(0, TILE, size=n_noise)
    cols = rng.integers(0, TILE, size=n_noise)
    hues = rng.integers(0, 360, size=n_noise)

    for i in range(n_noise):
        h_deg = int(hues[i])
        # Convert HSL (hue, 100%, 60%) to RGB
        c = 0.8   # chroma at L=0.6, S=1.0: C = (1 - |2L-1|) * S = 0.8
        x = c * (1 - abs((h_deg / 60) % 2 - 1))
        m = 0.6 - c / 2  # L - C/2 = 0.6 - 0.4 = 0.2
        sector = h_deg // 60
        if   sector == 0: r1,g1,b1 = c, x, 0
        elif sector == 1: r1,g1,b1 = x, c, 0
        elif sector == 2: r1,g1,b1 = 0, c, x
        elif sector == 3: r1,g1,b1 = 0, x, c
        elif sector == 4: r1,g1,b1 = x, 0, c
        else:             r1,g1,b1 = c, 0, x
        arr[rows[i], cols[i]] = [
            int((r1 + m) * 255),
            int((g1 + m) * 255),
            int((b1 + m) * 255),
            230,
        ]

    Image.fromarray(arr, 'RGBA').save(dst)
    print(f'Saved: {dst}')

if __name__ == '__main__':
    main()
