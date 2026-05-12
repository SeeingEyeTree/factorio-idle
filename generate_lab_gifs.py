"""
generate_lab_gifs.py - lab colour-cycle GIFs with transparent background.
Loads dome mask from data/map_imgs/lab_mask.png (white=dome, black=background).
Falls back to Gaussian-blur BFS flood-fill if the mask file is absent.
"""
import os, colorsys, argparse
from collections import deque
import numpy as np
from PIL import Image, ImageFilter
from scipy.ndimage import binary_fill_holes, binary_erosion, binary_dilation
from scipy.ndimage import label as scipy_label

NAMED = {
    "red":    (220,  50,  50),
    "green":  ( 50, 200,  80),
    "blue":   ( 60, 100, 220),
    "gray":   (140, 140, 145),
    "purple": (140,  50, 220),
    "yellow": (230, 200,  40),
}

GIFS = [
    ("lab_red",                          ["red"]),
    ("lab_red_green",                    ["red", "green"]),
    ("lab_red_green_blue",               ["red", "green", "blue"]),
    ("lab_red_green_blue_purple",        ["red", "green", "blue", "purple"]),
    ("lab_red_green_blue_purple_yellow", ["red", "green", "blue", "purple", "yellow"]),
    ("lab_rainbow",                      None),
]


def make_bg_mask(img_rgb, mask_path=None):
    """
    Return boolean mask: True=background (transparent), False=dome (opaque).
    If mask_path exists, loads it directly (white=dome, black=bg).
    Otherwise falls back to Gaussian-blur BFS flood-fill.
    """
    if mask_path and os.path.exists(mask_path):
        mask_img = Image.open(mask_path).convert("L")
        mask_img = mask_img.resize(img_rgb.size, Image.LANCZOS)
        dome = np.array(mask_img) > 127
        print("  Loaded mask from " + mask_path)
        return ~dome

    # Fallback: Gaussian-blur BFS flood-fill
    blurred = img_rgb.filter(ImageFilter.GaussianBlur(radius=8))
    arr_b = np.array(blurred, dtype=np.int32)
    h, w = arr_b.shape[:2]
    bw = 12
    border = np.concatenate([arr_b[:bw,:].reshape(-1,3), arr_b[-bw:,:].reshape(-1,3),
                              arr_b[:,:bw].reshape(-1,3), arr_b[:,-bw:].reshape(-1,3)])
    bg_ref = border.mean(axis=0)
    dist = np.sqrt(((arr_b - bg_ref)**2).sum(axis=2))
    threshold = 55
    visited = np.zeros((h, w), dtype=bool)
    q = deque()
    for x in range(w):
        for y in [0, h-1]:
            if dist[y,x] < threshold:
                visited[y,x] = True; q.append((y,x))
    for y in range(h):
        for x in [0, w-1]:
            if dist[y,x] < threshold:
                visited[y,x] = True; q.append((y,x))
    while q:
        y, x = q.popleft()
        for dy, dx in ((-1,0),(1,0),(0,-1),(0,1)):
            ny, nx = y+dy, x+dx
            if 0<=ny<h and 0<=nx<w and not visited[ny,nx] and dist[ny,nx]<threshold:
                visited[ny,nx] = True; q.append((ny,nx))
    dome = binary_fill_holes(~visited)
    dome = binary_erosion(dome, iterations=3)
    dome = binary_dilation(dome, iterations=2)
    labeled, n = scipy_label(dome)
    if n > 1:
        sizes = [(labeled==i).sum() for i in range(1, n+1)]
        dome = labeled == (np.argmax(sizes)+1)
    return ~dome


def frame_to_gif_palette(frame_rgb, bg_mask):
    arr = np.array(frame_rgb).copy()
    arr[bg_mask] = [0, 0, 0]
    p_img = Image.fromarray(arr).quantize(colors=255, dither=0)
    p_arr = np.array(p_img, dtype=np.uint8)
    p_arr[bg_mask] = 255
    pal = p_img.getpalette()
    pal[255*3:256*3] = [0, 0, 0]
    result = Image.fromarray(p_arr, mode="P")
    result.putpalette(pal)
    return result


def make_blue_mask(img_rgb):
    arr = np.array(img_rgb, dtype=np.float32) / 255.0
    r, g, b = arr[:,:,0], arr[:,:,1], arr[:,:,2]
    cmax = np.maximum(np.maximum(r,g),b)
    cmin = np.minimum(np.minimum(r,g),b)
    delta = cmax - cmin
    hue = np.zeros_like(r)
    eps = 1e-6
    m_r = (cmax==r)&(delta>eps)
    m_g = (cmax==g)&(delta>eps)
    m_b = (cmax==b)&(delta>eps)
    hue[m_r] = (60.0*((g[m_r]-b[m_r])/delta[m_r]))%360.0
    hue[m_g] = (60.0*((b[m_g]-r[m_g])/delta[m_g])+120.0)
    hue[m_b] = (60.0*((r[m_b]-g[m_b])/delta[m_b])+240.0)
    sat = np.where(cmax>eps, delta/cmax, 0.0)
    return (hue>=185)&(hue<=270)&(sat>0.18)&(cmax>0.12)


def recolor(base_arr, mask, luma, ref, tint_rgb):
    tr, tg, tb = tint_rgb
    scale = 1.0 / max(ref, 1.0)
    out = base_arr.copy()
    out[mask,0] = np.clip(luma[mask]*tr*scale, 0, 255)
    out[mask,1] = np.clip(luma[mask]*tg*scale, 0, 255)
    out[mask,2] = np.clip(luma[mask]*tb*scale, 0, 255)
    return out


def lerp_color(c1, c2, t):
    return (int(c1[0]+(c2[0]-c1[0])*t), int(c1[1]+(c2[1]-c1[1])*t), int(c1[2]+(c2[2]-c1[2])*t))


def hue_to_rgb(hue_deg, sat=0.90, val=0.85):
    r, g, b = colorsys.hsv_to_rgb(hue_deg/360.0, sat, val)
    return (int(r*255), int(g*255), int(b*255))


def build_frames_colors(base_arr, mask, luma, ref, color_list, fpc):
    frames = []
    n = len(color_list)
    if n == 1:
        arr = recolor(base_arr, mask, luma, ref, color_list[0])
        frames.append(Image.fromarray(arr.astype(np.uint8), "RGB"))
        return frames
    for i in range(n):
        c1 = color_list[i]
        c2 = color_list[(i+1)%n]
        for f in range(fpc):
            t = f/fpc
            arr = recolor(base_arr, mask, luma, ref, lerp_color(c1, c2, t))
            frames.append(Image.fromarray(arr.astype(np.uint8), "RGB"))
    return frames


def build_frames_rainbow(base_arr, mask, luma, ref, total_frames=72):
    frames = []
    for i in range(total_frames):
        arr = recolor(base_arr, mask, luma, ref, hue_to_rgb(360.0*i/total_frames))
        frames.append(Image.fromarray(arr.astype(np.uint8), "RGB"))
    return frames


def save_gif(frames, path, duration_ms, bg_mask):
    palette_frames = [frame_to_gif_palette(f, bg_mask) for f in frames]
    palette_frames[0].save(path, save_all=True, append_images=palette_frames[1:],
                           loop=0, duration=duration_ms, optimize=False,
                           transparency=255, disposal=2)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input",            default=os.path.join("data","map_imgs","lab.png"))
    parser.add_argument("--mask",             default=os.path.join("data","map_imgs","lab_mask.png"))
    parser.add_argument("--output-dir",       default=os.path.join("data","map_imgs"))
    parser.add_argument("--frames-per-color", type=int, default=18)
    parser.add_argument("--fps",              type=int, default=12)
    args = parser.parse_args()
    duration_ms = max(1, int(1000/args.fps))
    img = Image.open(args.input).convert("RGB")
    base_arr = np.array(img, dtype=np.float32)
    print("Computing background mask...")
    bg_mask   = make_bg_mask(img, mask_path=args.mask)
    blue_mask = make_blue_mask(img)
    print("BG: " + str(bg_mask.sum()) + " px  Blue panels: " + str(blue_mask.sum()) + " px")
    luma = 0.299*base_arr[:,:,0] + 0.587*base_arr[:,:,1] + 0.114*base_arr[:,:,2]
    ref  = float(luma[blue_mask].mean()) if blue_mask.any() else 128.0
    os.makedirs(args.output_dir, exist_ok=True)
    for stem, color_keys in GIFS:
        if color_keys is None:
            frames = build_frames_rainbow(base_arr, blue_mask, luma, ref,
                                          total_frames=args.frames_per_color*6)
        else:
            frames = build_frames_colors(base_arr, blue_mask, luma, ref,
                                         [NAMED[k] for k in color_keys], args.frames_per_color)
        out_path = os.path.join(args.output_dir, stem+".gif")
        save_gif(frames, out_path, duration_ms, bg_mask)
        print("Saved " + out_path + " (" + str(len(frames)) + " frames)")
    print("Done!")

if __name__ == "__main__":
    main()
