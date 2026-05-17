"""
remove_bg.py - Edge-seeded flood fill to remove white backgrounds.
Starts from all border pixels that are near-white, floods inward
along connected near-white pixels, then sets them transparent.
Saves results as .png (replaces originals or converts jpg->png).
"""
import os, sys
from collections import deque
import numpy as np
from PIL import Image

THRESHOLD = 30   # max per-channel distance from (255,255,255) to count as bg
SRC_DIR   = os.path.dirname(os.path.abspath(__file__))

def is_near_white(r, g, b, thr=THRESHOLD):
    return (255 - int(r)) + (255 - int(g)) + (255 - int(b)) < thr * 3

def flood_fill_bg(arr):
    """Return boolean mask of background pixels via edge-seeded BFS."""
    h, w = arr.shape[:2]
    visited = np.zeros((h, w), dtype=bool)
    q = deque()
    # Seed from all 4 border edges
    for x in range(w):
        for y in [0, h-1]:
            r, g, b = arr[y, x, 0], arr[y, x, 1], arr[y, x, 2]
            if not visited[y, x] and is_near_white(r, g, b):
                visited[y, x] = True
                q.append((y, x))
    for y in range(h):
        for x in [0, w-1]:
            r, g, b = arr[y, x, 0], arr[y, x, 1], arr[y, x, 2]
            if not visited[y, x] and is_near_white(r, g, b):
                visited[y, x] = True
                q.append((y, x))
    while q:
        y, x = q.popleft()
        for dy, dx in ((-1,0),(1,0),(0,-1),(0,1)):
            ny, nx = y+dy, x+dx
            if 0 <= ny < h and 0 <= nx < w and not visited[ny, nx]:
                r, g, b = arr[ny, nx, 0], arr[ny, nx, 1], arr[ny, nx, 2]
                if is_near_white(r, g, b):
                    visited[ny, nx] = True
                    q.append((ny, nx))
    return visited

def process(path):
    img  = Image.open(path).convert('RGBA')
    arr  = np.array(img)
    # Quick check: is any border pixel near-white?
    h, w = arr.shape[:2]
    corners = [arr[0,0], arr[0,w-1], arr[h-1,0], arr[h-1,w-1]]
    if not any(is_near_white(c[0],c[1],c[2]) for c in corners):
        return False  # nothing to do
    bg = flood_fill_bg(arr)
    arr[bg] = [0, 0, 0, 0]
    # Save as png (drop .jpg/.jpeg extension)
    base = os.path.splitext(path)[0]
    out_path = base + '.png'
    Image.fromarray(arr, 'RGBA').save(out_path)
    # Remove original jpg if different filename
    if out_path != path and os.path.exists(path):
        os.remove(path)
    return True, bg.sum(), h*w

if __name__ == '__main__':
    exts = {'.png', '.jpg', '.jpeg'}
    files = sorted(f for f in os.listdir(SRC_DIR)
                   if os.path.splitext(f)[1].lower() in exts
                   and f != 'remove_bg.py')
    done = 0
    for fname in files:
        path = os.path.join(SRC_DIR, fname)
        result = process(path)
        if result and result is not False:
            _, bg_px, total = result
            print(f'  {fname}: removed {bg_px}/{total} bg pixels')
            done += 1
        else:
            print(f'  {fname}: skipped (no white border)')
    print(f'\nDone: {done} files processed.')
