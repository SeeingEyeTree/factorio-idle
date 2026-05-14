"""
generate_enemies.py
-------------------
Generates enemy biter tile sprites (30x30 RGBA, transparent background).
4 variants per tier color at max-density fill.
Used by _drawAttackOverlay when biter count per section saturates the tile.

Output: data/map_imgs/enemy_{color}_v{1-4}.png
Colors: red, green, blue, purple, yellow
"""
import os
import numpy as np
from PIL import Image

TILE = 30
DOT  = 3    # size of each biter "pixel" in the sprite
FILL = 0.88 # fraction of dot grid cells to fill

COLORS = {
    'red':    (255,  60,  60, 230),
    'green':  ( 60, 220,  60, 230),
    'blue':   ( 60, 120, 255, 230),
    'purple': (180,  60, 220, 230),
    'yellow': (220, 180,  40, 230),
}

def make_sprite(color_rgba, seed):
    rng = np.random.default_rng(seed)
    arr = np.zeros((TILE, TILE, 4), dtype=np.uint8)

    # Grid of non-overlapping DOT×DOT cell top-left corners
    positions = [(r, c)
                 for r in range(0, TILE - DOT + 1, DOT)
                 for c in range(0, TILE - DOT + 1, DOT)]
    n_fill = max(1, int(len(positions) * FILL))
    chosen_idx = rng.choice(len(positions), size=n_fill, replace=False)

    for idx in chosen_idx:
        r, c = positions[idx]
        arr[r:r + DOT, c:c + DOT] = color_rgba

    return arr

def main():
    d = os.path.join('data', 'map_imgs')
    os.makedirs(d, exist_ok=True)
    count = 0
    for color_name, rgba in COLORS.items():
        for v in range(1, 5):
            # Each variant uses a different seed for distinct patterns
            seed = hash((color_name, v)) & 0xFFFFFFFF
            arr = make_sprite(rgba, seed)
            path = os.path.join(d, f'enemy_{color_name}_v{v}.png')
            Image.fromarray(arr, 'RGBA').save(path)
            print(f'  {path}')
            count += 1
    print(f'Done: {count} sprites')

if __name__ == '__main__':
    main()
