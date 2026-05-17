#!/usr/bin/env python3
"""
Regenerate the 8 Caff-Infinite science pack cans with two reference images
pinned to the model so they share scale, framing, and branding:

  1. data/icon_imgs/caffactory/caffactory_can_rainbow.png  → size + framing ref
  2. data/icon_imgs/caffactory/Caf_logo.png                → brand ref

All cans are placed on a pure white background and each can body is single-color
(no contrasting panels or trim).

Outputs to:  data/icon_imgs/caffactory/regen/
The originals in data/icon_imgs/caffactory/ are NOT touched — review the regen
folder and copy the ones you prefer over the originals manually.

Usage:
    cd C:\\Users\\malco\\factorio-idle
    python temp_python_scripts/regenerate_cans.py
    # Only one color:
    python temp_python_scripts/regenerate_cans.py --only blue
    # Pick a specific Gemini model:
    python temp_python_scripts/regenerate_cans.py --model gemini-2.5-flash-image
"""
import argparse, sys, time
from pathlib import Path
from io import BytesIO

try:
    from google import genai
    from google.genai import types
    from PIL import Image
except ImportError:
    sys.exit("Run: pip install google-genai pillow")

API_KEY     = "AIzaSyDcC3sDlhYGupPiDfOdFtl0wrJdy3f-l8c"
ROOT        = Path(__file__).resolve().parent.parent
CAFF_DIR    = ROOT / 'data' / 'icon_imgs' / 'caffactory'
OUTPUT_DIR  = CAFF_DIR / 'regen'
LOGO_PATH   = CAFF_DIR / 'Caf_logo.png'
SIZE_REF    = CAFF_DIR / 'caffactory_can_rainbow.png'
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

GEMINI_MODELS = [
    'gemini-2.5-flash-image',                    # stable, free tier
    'gemini-2.0-flash-preview-image-generation',
    'gemini-2.0-flash-exp-image-generation',
]

# Per-can: (filename, body color description, label text, optional extra graphic)
CANS = [
    ('caffactory_can_red.png',     'uniformly bright red',          'ORIGINAL',        None),
    ('caffactory_can_green.png',   'uniformly green',               'SHIPPED',         'a small shipping-label icon below the C-monogram'),
    ('caffactory_can_blue.png',    'uniformly deep blue',           'BLUE 40',         'a small chemistry beaker icon below the C-monogram'),
    ('caffactory_can_black.png',   'uniformly matte black',         'TACTICAL',        'a thin red stenciled stripe across the bottom of the label'),
    ('caffactory_can_purple.png',  'uniformly purple',              'OVERTIME',        None),
    ('caffactory_can_yellow.png',  'uniformly bright yellow',       'HAPPINESS',       None),
    ('caffactory_can_white.png',   'uniformly off-white / silver',  'ZERO-G',          'a few small stars scattered around the label'),
    ('caffactory_can_rainbow.png', 'iridescent holographic (this one IS allowed multicolor shimmer — it is the limited edition variant)', 'LIMITED EDITION', None),
]

BASE_PROMPT = (
    'Generate an aluminum energy drink can as a square game icon. '
    'IMPORTANT framing rules:\n'
    '  • Match the can size, isometric angle, and framing of the FIRST reference image. '
    'The can should fill the same proportion of the canvas as in that reference.\n'
    '  • Background: pure white, NO plinth, NO grid, NO decorative scenery, NO shadows on the ground.\n'
    '  • The can body is {body_color} — single solid color across the entire body. '
    'No contrasting trim panels, no two-tone design, no different-colored stripes other than what is listed below.\n'
    '  • Print on the can body: the exact Caff-Infinite C-monogram logo from the SECOND reference image '
    '(blue diamond chevron frame, white C in center) prominently centered, '
    'AND the all-caps text label "{label}" directly under the C-monogram.\n'
    '{extra_line}'
    '  • Style: isometric pixel art game icon, clean detail, slight condensation droplets on the can.'
)

def _save_bytes_as_png(data: bytes, out_path: Path):
    Image.open(BytesIO(data)).save(out_path, 'PNG')

def _is_rate_limit(err):
    msg = str(err).lower()
    return any(x in msg for x in ('429', 'quota', 'rate', 'resource_exhausted'))

def pick_model(client, refs):
    """Find first model in GEMINI_MODELS that accepts image-mode generation."""
    for m in GEMINI_MODELS:
        try:
            r = client.models.generate_content(
                model=m,
                contents=['Test ping — respond with an image of a single red dot.', refs[0]],
                config=types.GenerateContentConfig(response_modalities=['IMAGE', 'TEXT']),
            )
            if r.candidates:
                for p in r.candidates[0].content.parts:
                    if getattr(p, 'inline_data', None):
                        return m
        except Exception as e:
            print(f"  probe {m}: {type(e).__name__}: {str(e)[:80]}")
    return GEMINI_MODELS[0]

def gen_one(client, model, prompt, size_ref, logo_ref):
    """Call Gemini with both reference images plus the prompt."""
    contents = [
        'FIRST reference — use this as the framing/size/angle template:',
        size_ref,
        'SECOND reference — the Caff-Infinite C-monogram logo to place on the can:',
        logo_ref,
        prompt,
    ]
    delay = 4.0
    for attempt in range(4):
        try:
            r = client.models.generate_content(
                model=model, contents=contents,
                config=types.GenerateContentConfig(response_modalities=['IMAGE', 'TEXT']),
            )
            if not r.candidates: return None
            for p in r.candidates[0].content.parts:
                if getattr(p, 'inline_data', None) and p.inline_data.data:
                    return p.inline_data.data
            return None
        except Exception as e:
            if _is_rate_limit(e) and attempt < 3:
                print(f"    rate-limited, waiting {delay:.0f}s ..."); time.sleep(delay); delay = min(delay * 2, 60); continue
            raise

def build_prompt(body_color, label, extra):
    extra_line = ''
    if extra:
        extra_line = f"  • Additionally: {extra}.\n"
    return BASE_PROMPT.format(body_color=body_color, label=label, extra_line=extra_line)

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--only', type=str, default=None, help='Substring filter (e.g. "blue", "yellow")')
    ap.add_argument('--model', type=str, default=None, help='Force a specific Gemini model name')
    args = ap.parse_args()

    for p in [LOGO_PATH, SIZE_REF]:
        if not p.exists(): sys.exit(f"Missing reference: {p}")

    client   = genai.Client(api_key=API_KEY)
    size_ref = Image.open(SIZE_REF).convert('RGBA')
    logo_ref = Image.open(LOGO_PATH).convert('RGBA')
    print(f"Size ref:  {SIZE_REF.name} ({size_ref.size[0]}x{size_ref.size[1]})")
    print(f"Logo ref:  {LOGO_PATH.name} ({logo_ref.size[0]}x{logo_ref.size[1]})")

    if args.model:
        model = args.model
    else:
        print("Probing Gemini image-gen models...")
        model = pick_model(client, [size_ref, logo_ref])
    print(f"Using model: {model}")
    print(f"Output dir:  {OUTPUT_DIR}\n")

    items = CANS
    if args.only:
        items = [c for c in CANS if args.only in c[0]]
    print(f"Generating {len(items)} cans...\n")

    ok = err = 0
    for i, (fname, body_color, label, extra) in enumerate(items, 1):
        print(f"[{i}/{len(items)}] {fname}  (body={body_color[:40]}..., label={label!r})")
        try:
            prompt = build_prompt(body_color, label, extra)
            data = gen_one(client, model, prompt, size_ref, logo_ref)
            if data is None:
                print(f"    SKIP (no image returned)\n"); err += 1; continue
            out = OUTPUT_DIR / fname
            _save_bytes_as_png(data, out)
            print(f"    saved {out.name} ({out.stat().st_size//1024} KB)\n"); ok += 1
        except Exception as e:
            print(f"    FAIL: {type(e).__name__}: {e}\n"); err += 1
        if i < len(items): time.sleep(1.5)

    print(f"\nDone. {ok} ok, {err} failed.")
    print(f"Compare {OUTPUT_DIR}/ against the originals in {CAFF_DIR}/ and copy in the winners.")

if __name__ == '__main__':
    main()
