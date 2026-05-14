"""
generate_turrets.py
-------------------
Generates turret overlay tiles (30x30 RGBA, transparent background).

Each turret barrel: 4 gray -> 2 black -> 1 red (7px, tip at tile edge).
Levels and turret counts:  20%=1  40%=2  60%=3  80%=4  100%=5
Turrets are evenly spaced and centred along the wall edge.

Straight tiles: turret_right/bottom/left/top_{level}.png
Corner tiles:   turret_corner_br/tr/bl/tl_{level}.png
  (corners always have 1 diagonal turret pointing outward, all levels)

Combo examples: concrete + wall + turret composited together.

Output: data/map_imgs/
"""
import os, argparse
import numpy as np
from PIL import Image

TILE  = 30
GRAY  = (148, 148, 152, 255)
BLACK = ( 20,  20,  20, 255)
RED   = (220,  40,  40, 255)
TRANS = (  0,   0,   0,   0)

LEVELS = {20: 1, 40: 2, 60: 3, 80: 4, 100: 5}

def turret_positions(n, size=TILE):
    spacing = size / n
    return [int(spacing * (i + 0.5)) for i in range(n)]

# Barrel layout for right-facing: body at LEFT side (col 0-6), tip at col 6.
# This places the turret on the OPPOSITE (interior) side from the right wall.
BARREL = [(0, GRAY),(1, GRAY),(2, GRAY),(3, GRAY),(4, BLACK),(5, BLACK),(6, RED)]

def make_right_turret(n):
    arr = np.zeros((TILE, TILE, 4), dtype=np.uint8)
    for row in turret_positions(n):
        # Barrel row
        for col, color in BARREL:
            arr[row, col] = color
        # 2D body: gray row below the barrel
        if row + 1 < TILE:
            for col, _ in BARREL:
                arr[row + 1, col] = GRAY
    return arr

def rotate_cw(arr, steps):
    return np.rot90(arr, k=(4 - steps) % 4)

def make_corner_br():
    # Diagonal barrel from top-left toward bottom-right interior corner.
    # Placed near top-left so it sits on the inside of the br corner wall.
    arr = np.zeros((TILE, TILE, 4), dtype=np.uint8)
    for i, color in enumerate([GRAY, GRAY, GRAY, GRAY, BLACK, BLACK, RED]):
        p = i  # cols/rows 0-6, diagonal from top-left
        arr[p, p] = color
        # 2D body: neighbor pixel (offset one row down) all gray
        if p + 1 < TILE:
            arr[p + 1, p] = GRAY
    return arr

def flip_h(arr):
    return arr[:, ::-1, :]

def flip_v(arr):
    return arr[::-1, :, :]

def make_corner(name):
    br = make_corner_br()
    if name == "br": return br
    if name == "bl": return flip_h(br)
    if name == "tr": return flip_v(br)
    if name == "tl": return flip_h(flip_v(br))

def save(arr, path):
    Image.fromarray(arr, "RGBA").save(path)

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--output-dir", default=os.path.join("data","map_imgs"))
    args = parser.parse_args()
    d = args.output_dir
    os.makedirs(d, exist_ok=True)

    dir_rotations = {"right":0, "bottom":1, "left":2, "top":3}
    count = 0

    for level, n in LEVELS.items():
        right = make_right_turret(n)
        for dname, steps in dir_rotations.items():
            arr = rotate_cw(right, steps)
            save(arr, os.path.join(d, "turret_"+dname+"_"+str(level)+".png"))
            count += 1
        for cname in ["br","tr","bl","tl"]:
            arr = make_corner(cname)
            save(arr, os.path.join(d, "turret_corner_"+cname+"_"+str(level)+".png"))
            count += 1

    print("Turret tiles: " + str(count))

    # --- Combo examples: concrete + wall + turret ---
    concrete_src = None
    for candidate in ["concrete_tile_cropped.png", "concrete_tile.png", "concrete_tile_cropped_orange.png"]:
        cand_path = os.path.join(d, candidate)
        if os.path.exists(cand_path):
            concrete_src = cand_path
            break
    if concrete_src is None:
        print("Concrete tile not found, skipping combos")
        return

    concrete = Image.open(concrete_src).convert("RGBA").resize((TILE,TILE), Image.LANCZOS)

    # combos: (direction, wall_level, turret_level, filename)
    combos = [
        ("right",     40,  40,  "combo_example_1.png"),
        ("right",     60,  60,  "combo_example_2.png"),
        ("right",     80,  80,  "combo_example_3.png"),
        ("right",     80, 100,  "combo_example_4.png"),  # max wall + max turrets
        ("bottom",    60,  60,  "combo_example_5.png"),
        ("corner_br", 60,  60,  "combo_example_6.png"),
    ]

    for (direction, wlevel, tlevel, fname) in combos:
        if "corner" in direction:
            wall_name  = "wall_"    + direction + "_" + str(wlevel) + ".png"
            turr_name  = "turret_"  + direction + "_" + str(tlevel) + ".png"
        else:
            wall_name  = "wall_"    + direction + "_" + str(wlevel) + ".png"
            turr_name  = "turret_"  + direction + "_" + str(tlevel) + ".png"

        wall_path = os.path.join(d, wall_name)
        turr_path = os.path.join(d, turr_name)
        if not os.path.exists(wall_path) or not os.path.exists(turr_path):
            print("Skipping " + fname + " (missing " + wall_name + " or " + turr_name + ")")
            continue

        wall = Image.open(wall_path).convert("RGBA")
        turr = Image.open(turr_path).convert("RGBA")

        comp = concrete.copy()
        comp.paste(wall, (0,0), wall)
        comp.paste(turr, (0,0), turr)
        comp.save(os.path.join(d, fname))
        print("Combo: " + fname + "  (" + direction + " w=" + str(wlevel) + "% t=" + str(tlevel) + "%)")

    print("Done!")

if __name__ == "__main__":
    main()
