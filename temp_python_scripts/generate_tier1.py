#!/usr/bin/env python3
"""
Caffactory rebrand — Tier 1 image generation.

Default mode: Gemini 2.5 Flash Image with Caf_logo.png passed in as a
reference so generated icons share a consistent color palette / branding
treatment. Set USE_LOGO=False (or pass --imagen-only) to fall back to the
original Imagen 4.0 text-only pipeline for higher per-image quality without
brand consistency.

Outputs land in data/icon_imgs/ (overwriting any same-named PNG).

Requires: pip install google-genai pillow

Usage:
    cd C:\\Users\\malco\\factorio-idle
    python temp_python_scripts/generate_tier1.py
    # Resume after a crash:
    python temp_python_scripts/generate_tier1.py --start 12
    # Only regenerate one:
    python temp_python_scripts/generate_tier1.py --only coffee_boiler
    # Skip reference image (higher quality, no logo consistency):
    python temp_python_scripts/generate_tier1.py --imagen-only
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

API_KEY    = "AIzaSyDcC3sDlhYGupPiDfOdFtl0wrJdy3f-l8c"
ROOT       = Path(__file__).resolve().parent.parent
OUTPUT_DIR = ROOT / 'data' / 'icon_imgs'
LOGO_PATH  = OUTPUT_DIR / 'Caf_logo.png'
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

# Gemini model candidates — tried in order. Names change as Google updates;
# if all fail run with --list-models to see what your key has access to,
# then update this list.
#
# History (as of 2026-05):
#   - gemini-2.5-flash-image-preview  → retired 2026-01-15
#   - gemini-2.5-flash-image          → current stable, free tier (500/day)
#   - gemini-3-pro-image-preview      → "Nano Banana Pro", PAID ONLY
#   - gemini-3.1-flash-image-preview  → "Nano Banana 2", PAID
GEMINI_MODELS = [
    'gemini-2.5-flash-image',                    # current stable, free tier
    'gemini-2.0-flash-preview-image-generation', # older fallback (free)
    'gemini-2.0-flash-exp-image-generation',     # oldest fallback (free)
]
IMAGEN_MODEL = 'imagen-4.0-generate-001'

# (filename, prompt, needs_logo)
#   needs_logo=True  → Gemini call includes the logo + the instruction to use it
#   needs_logo=False → the logo is still passed as a style anchor, but the prompt
#                      doesn't ask the model to place the logo on the item.
TIER1 = [
    # ── Energy-drink science cans (8) — logo critical ─────────────────────────
    #('caffactory_can_red.png',     'Red aluminum energy drink can with the Caffactory C-monogram logo printed on the side, classic red, condensation droplets, isometric pixel art square game icon', True),
    ('caffactory_can_green.png',   'Green energy drink can with the Caffactory C-monogram logo and a "SHIPPED" label with shipping graphics on the side, isometric pixel art square game icon', True),
    ('caffactory_can_blue.png',    'Blue energy drink can with the Caffactory C-monogram logo, a chemistry beaker icon, and a "BLUE 40" label, slightly glowing, isometric pixel art square game icon', True),
    ('caffactory_can_black.png',   'Black matte energy drink can with the Caffactory C-monogram logo, a red stripe, and "TACTICAL" stencil text, military-surplus look, isometric pixel art square game icon', True),
    ('caffactory_can_purple.png',  'Purple energy drink can with the Caffactory C-monogram logo and an "OVERTIME" label, slightly battered, isometric pixel art square game icon', True),
    ('caffactory_can_yellow.png',  'Yellow energy drink can with the Caffactory C-monogram logo, a sunburst graphic, and a "SUNSHINE" label, cheerful corporate art, isometric pixel art square game icon', True),
    ('caffactory_can_white.png',   'White energy drink can with the Caffactory C-monogram logo, a star pattern, and a "ZERO-G" label, slightly floating, isometric pixel art square game icon', True),
    ('caffactory_can_rainbow.png', 'Iridescent holographic energy drink can with the Caffactory C-monogram logo and a "LIMITED EDITION" foil label, rainbow gradient, isometric pixel art square game icon', True),

    # ── Buildings (15) ────────────────────────────────────────────────────────
    ('unpaid_intern.png',          'Tired-looking intern at a desk wearing a polo with the Caffactory C-monogram logo, energy drink in hand, surrounded by papers and a laptop, isometric pixel art square game icon', True),
    ('intern_pod_1.png',           'Cubicle workstation with one intern assembling things at a desk, simple grey wall partitions, small Caffactory logo on the cubicle wall, isometric pixel art square game icon', True),
    ('intern_pod_2.png',           'Larger cubicle with one intern and dual monitors, slightly nicer chair, Caffactory logo on the back wall, isometric pixel art square game icon', True),
    ('intern_pod_3.png',           'Glass-walled office cubicle with intern at standing desk, three monitors, plant in corner, Caffactory logo on glass, isometric pixel art square game icon', True),
    ('microwave.png',              'Beat-up office break-room microwave on a small wooden stand, slightly stained, isometric pixel art square game icon', False),
    ('microwave_industrial.png',   'Larger commercial-grade microwave with stainless steel exterior on a metal cart, isometric pixel art square game icon', False),
    ('espresso_machine.png',       'Large chrome commercial espresso machine with multiple steam wands and digital display, isometric pixel art square game icon', False),
    ('cubicle_rummager.png',       'Janitor with cart digging through office supply cabinets, dusty, isometric pixel art square game icon', False),
    ('janitor_bot.png',            'Roomba-style cleaning robot with mechanical arms collecting items, isometric pixel art square game icon', False),
    ('coffee_boiler.png',          'Industrial coffee urn with steam vents, the Caffactory C-monogram logo branded on the side, isometric pixel art square game icon', True),
    ('steam_engine.png',           'Brass steam-powered electrical generator, slightly retro-industrial, isometric pixel art square game icon', False),
    ('skylight.png',               'Office skylight panel with sun rays coming through, isometric pixel art square game icon', False),
    ('power_bank.png',             'Large industrial USB power bank labelled with the Caffactory C-monogram logo, glowing LED indicators, isometric pixel art square game icon', True),
    ('flavor_lab.png',             'R&D laboratory with beakers of colorful liquids, scientist silhouettes, "Caffactory R&D" sign with the C-monogram logo, isometric pixel art square game icon', True),
    ('surveillance_tower.png',     'Office surveillance camera on a tall pole with WiFi signals radiating, isometric pixel art square game icon', False),

    # ── Resources (4) ─────────────────────────────────────────────────────────
    ('coffee_grounds.png',         'Pile of damp dark coffee grounds on a paper filter, isometric pixel art square game icon', False),
    ('crushed_cans.png',           'Pile of crushed empty energy drink cans being recycled, mixed colors, slight gleam, isometric pixel art square game icon', False),
    ('e_waste.png',                'Pile of broken phones, old laptops, and tangled cables in a recycling bin, isometric pixel art square game icon', False),
    ('drywall_chunks.png',         'Chunks of broken office drywall and gypsum board on a pallet, isometric pixel art square game icon', False),

    # ── Components (5) ────────────────────────────────────────────────────────
    ('aluminum_sheet.png',         'Stack of clean aluminum sheets with riveted corners, slight reflection, isometric pixel art square game icon', False),
    ('wire_spool.png',             'Industrial spool of stripped copper wire, neat coils, slight oxidation, isometric pixel art square game icon', False),
    ('reinforced_tray.png',        'Stack of reinforced industrial steel cafeteria trays, isometric pixel art square game icon', False),
    ('office_cog.png',             'Small metal cog with corporate finish, slightly worn, isometric pixel art square game icon', False),
    ('phone_cables.png',           'Tangled bundle of phone charging cables in various colors, isometric pixel art square game icon', False),

    # ── UM chip family (3) ────────────────────────────────────────────────────
    ('um_100.png',                 'Small green printed circuit board, 1990s style, single small chip, simple traces, "UM 100" silkscreen, isometric pixel art square game icon', False),
    ('um_200.png',                 'Black printed circuit board with mid-size chip, several capacitors and gold contacts, "UM 200" silkscreen, isometric pixel art square game icon', False),
    ('um_300.png',                 'Dark printed circuit board with massive CPU chip under a finned aluminum heatsink, RGB accent strip, "UM 300" silkscreen, isometric pixel art square game icon', False),
]

# ── Generation backends ───────────────────────────────────────────────────────

def _save_bytes_as_png(data: bytes, out_path: Path):
    """Re-encode whatever bytes the API gave us as a real PNG."""
    img = Image.open(BytesIO(data))
    img.save(out_path, 'PNG')

def gen_with_gemini(client, prompt, logo_img, needs_logo, model):
    """Uses Gemini multimodal generate_content with the logo as a reference."""
    contents = []
    if needs_logo:
        contents.append('Reference logo — use this exact Caffactory C-monogram logo (blue diamond chevron frame, white C in center) wherever the prompt mentions branding:')
        contents.append(logo_img)
        contents.append('Now generate this asset, keeping a consistent dark-blue corporate palette: ' + prompt)
    else:
        contents.append('Style reference (palette/feel only — do NOT include this logo in the output):')
        contents.append(logo_img)
        contents.append('Generate this asset matching the same corporate visual language: ' + prompt)

    resp = client.models.generate_content(
        model=model,
        contents=contents,
        config=types.GenerateContentConfig(response_modalities=['IMAGE', 'TEXT']),
    )
    if not resp.candidates:
        return None
    for part in resp.candidates[0].content.parts:
        if getattr(part, 'inline_data', None) and part.inline_data.data:
            return part.inline_data.data
    return None

def gen_with_imagen(client, prompt):
    """Fallback — Imagen 4.0 text-only, original behavior."""
    resp = client.models.generate_images(
        model=IMAGEN_MODEL,
        prompt=prompt,
        config=types.GenerateImagesConfig(number_of_images=1),
    )
    if not resp.generated_images:
        return None
    img = resp.generated_images[0].image
    buf = BytesIO()
    img.save(buf, format='PNG')
    return buf.getvalue()

# ── Driver ────────────────────────────────────────────────────────────────────

def _is_rate_limit(err):
    msg = str(err).lower()
    return any(x in msg for x in ('429', 'quota', 'rate', 'resource_exhausted'))

def gen_one(client, prompt, logo_img, needs_logo, use_imagen, gemini_model):
    delay = 4.0
    for attempt in range(4):
        try:
            if use_imagen:
                return gen_with_imagen(client, prompt)
            return gen_with_gemini(client, prompt, logo_img, needs_logo, gemini_model)
        except Exception as e:
            if _is_rate_limit(e) and attempt < 3:
                print(f"    rate-limited, waiting {delay:.0f}s ...", flush=True)
                time.sleep(delay)
                delay = min(delay * 2, 60)
                continue
            raise

def pick_gemini_model(client, logo_img):
    """Probe the model list to find one that accepts image-mode generation.
    Falls back to the first if all probes error out (so the real run still tries)."""
    for m in GEMINI_MODELS:
        try:
            r = client.models.generate_content(
                model=m,
                contents=['Test ping — respond with an image of a single red dot.', logo_img],
                config=types.GenerateContentConfig(response_modalities=['IMAGE', 'TEXT']),
            )
            if r.candidates:
                for p in r.candidates[0].content.parts:
                    if getattr(p, 'inline_data', None):
                        print(f"Using Gemini model: {m}\n")
                        return m
        except Exception as e:
            print(f"  probe {m}: {type(e).__name__}: {str(e)[:80]}")
    print(f"WARNING: no Gemini model probed successfully; will try {GEMINI_MODELS[0]} anyway.\n")
    return GEMINI_MODELS[0]

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--start',       type=int, default=0)
    ap.add_argument('--only',        type=str, default=None)
    ap.add_argument('--imagen-only', action='store_true', help='Skip the logo reference; use Imagen 4.0 text-only.')
    ap.add_argument('--list-models', action='store_true', help='List every model your API key can access (for debugging 404s) and exit.')
    args = ap.parse_args()

    if args.list_models:
        client = genai.Client(api_key=API_KEY)
        print("Models available to your API key (filter for ones supporting generateContent):\n")
        for m in client.models.list():
            name = getattr(m, 'name', '?')
            methods = getattr(m, 'supported_actions', None) or getattr(m, 'supported_generation_methods', None) or []
            tag = ''
            if 'image' in name.lower():
                tag = '   <-- image model'
            print(f"  {name}{tag}")
        return

    if not LOGO_PATH.exists() and not args.imagen_only:
        sys.exit(f"Logo not found at {LOGO_PATH}. Place it there or use --imagen-only.")

    client = genai.Client(api_key=API_KEY)
    logo_img = None
    gemini_model = None
    if not args.imagen_only:
        logo_img = Image.open(LOGO_PATH).convert('RGBA')
        print(f"Loaded logo: {LOGO_PATH.name} ({logo_img.size[0]}x{logo_img.size[1]})")
        print("Probing Gemini image-gen models...")
        gemini_model = pick_gemini_model(client, logo_img)

    items = TIER1[args.start:]
    if args.only:
        items = [t for t in items if args.only in t[0]]

    print(f"Generating {len(items)} icons → {OUTPUT_DIR}")
    print(f"Mode: {'Imagen 4.0 (no reference)' if args.imagen_only else f'Gemini ({gemini_model}) with logo'}\n")

    ok = err = 0
    for i, (fname, prompt, needs_logo) in enumerate(items, 1):
        print(f"[{i}/{len(items)}] {fname}{'  (logo on item)' if needs_logo and not args.imagen_only else ''}")
        try:
            data = gen_one(client, prompt, logo_img, needs_logo, args.imagen_only, gemini_model)
            if data is None:
                print(f"    SKIP (no image returned)\n"); err += 1; continue
            out = OUTPUT_DIR / fname
            _save_bytes_as_png(data, out)
            print(f"    saved {out.name} ({out.stat().st_size} bytes)\n")
            ok += 1
        except Exception as e:
            print(f"    FAIL: {type(e).__name__}: {e}\n"); err += 1
        if i < len(items):
            time.sleep(1.5)
        

    print(f"\nDone. {ok} ok, {err} failed. Total: {len(items)}")
    if err:
        print("Resume failed items: --only <filename-substring>")
        print("Or skip the reference image entirely: --imagen-only")

if __name__ == '__main__':
    main()
