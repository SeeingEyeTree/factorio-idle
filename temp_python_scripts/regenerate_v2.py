#!/usr/bin/env python3
"""
Caff-Infinite — regenerate the specific items the user flagged for redo.

Outputs to:  data/icon_imgs/caffactory/regen/   (does NOT overwrite originals)

Each call passes the Caf_logo.png as a reference so branding stays consistent.

Usage:
    cd C:\\Users\\malco\\factorio-idle
    python temp_python_scripts/regenerate_v2.py
    python temp_python_scripts/regenerate_v2.py --only mines
    python temp_python_scripts/regenerate_v2.py --model gemini-2.5-flash-image
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
CAFF_DIR   = ROOT / 'data' / 'icon_imgs' / 'caffactory'
OUTPUT_DIR = CAFF_DIR / 'regen'
LOGO_PATH  = CAFF_DIR / 'Caf_logo.png'
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

GEMINI_MODELS = [
    'gemini-2.5-flash-image',
    'gemini-2.0-flash-preview-image-generation',
    'gemini-2.0-flash-exp-image-generation',
]

# (filename, needs_logo_on_item, prompt)
ITEMS = [
    # ── Miners: mine-entrance signs ───────────────────────────────────────────
    ('burner_mining_drill.png', True,
     'A small wooden mine shaft entrance dug into the ground with wooden support beams forming a square frame, '
     'a hand-painted wooden sign hung above the entrance reading "MINES" in chunky letters, '
     'the Caff-Infinite C-monogram logo nailed to the right support beam, '
     'a pickaxe leaning against the entrance and a small pile of ore beside it. '
     'White background, no decorative scenery beyond the immediate scene, isometric pixel art square game icon.'),

    ('electric_mining_drill.png', True,
     'A larger industrial mine shaft entrance with reinforced steel beams and arc lighting, '
     'a clean corporate-styled aluminum sign mounted above reading "MINES (safety optional)" in stencil text, '
     'the Caff-Infinite C-monogram logo prominent on the steel frame, '
     'exposed electrical cables dangling, a forgotten yellow hard hat on the ground, '
     'a small "violation pending" notice taped to one beam. '
     'White background, isometric pixel art square game icon.'),

    # ── Carbon Composite (was Low Density Structure / Hollow Marketing Material)
    ('lds.png', False,
     'Stack of thin brown corrugated cardboard panels neatly piled on a pallet, '
     'visible flute/wave pattern in the cardboard cross-section, '
     'matte brown color similar in tone to coffee grounds, slight wear at the corners, '
     'absolutely no blue tones anywhere — this is a brown / kraft-paper item. '
     'A small Caff-Infinite C-monogram logo stamped on the top panel. '
     'White background, isometric pixel art square game icon.'),

    # ── Furnaces: real industrial smelting equipment with corporate branding ──
    ('stone_furnace.png', True,
     'A small industrial blast furnace with a stacked-stone and brick base, '
     'a tall brick chimney emitting a faint glow of orange embers, '
     'a small glowing red view-port window near the bottom, '
     'a metal nameplate with the Caff-Infinite C-monogram logo bolted to the front. '
     'White background, isometric pixel art square game icon.'),

    ('steel_furnace.png', True,
     'A larger industrial pressure forge — a riveted steel frame with two big hydraulic press pistons '
     'on top driving a heated platen down into a glowing red molten metal chamber, '
     'visible steam vents on the sides, a control panel with gauges, '
     'the Caff-Infinite C-monogram logo branded on the side plate. '
     'White background, isometric pixel art square game icon.'),

    ('electric_furnace.png', True,
     'A modern industrial vacuum furnace — a polished stainless-steel horizontal cylindrical chamber on a stand, '
     'a sealed circular glass viewing port on the front glowing soft red from inside, '
     'a digital control panel beside the chamber, electrical conduit and cooling pipes running into the back, '
     'the Caff-Infinite C-monogram logo etched into the metal beside the viewing port. '
     'White background, isometric pixel art square game icon.'),

    # ── Auto-stapler with explicit staple-exit holes ──────────────────────────
    ('gun_turret.png', True,
     'A mounted defensive turret made from a giant industrial stapler on a rotating swivel base, '
     'IMPORTANT: there are four clearly visible round staple-exit holes/ports along the front of the stapler head '
     'where the staples shoot out, like the muzzles of a small gatling gun, '
     'the Caff-Infinite C-monogram logo stenciled in white on the side of the stapler body, '
     'yellow caution-stripe accents on the base. '
     'White background, isometric pixel art square game icon.'),

    # ── Battery Pack — exactly 4 AAs, correctly labeled ──────────────────────
    ('battery.png', True,
     'A retail blister pack of EXACTLY 4 AA batteries in a row, no more no less, '
     'clear plastic blister bubbles over a white cardboard backing, '
     'each AA is standard alkaline design with a silver positive terminal cap and colored body, '
     'a clear "x4" label printed prominently on the cardboard, '
     'the Caff-Infinite C-monogram logo at the top of the package. '
     'White background, isometric pixel art square game icon.'),

    # ── Caffeine Brick — never generated last time ────────────────────────────
    ('soild_fuel.png', True,
     'A compressed rectangular brick of caffeine pills shrink-wrapped in transparent plastic, '
     'hundreds of small round white tablets visible through the clear wrap forming a dense brick shape, '
     'a small white shipping label on the front with the Caff-Infinite C-monogram logo and a "WARNING" stamp, '
     'slightly menacing vibe. '
     'White background, isometric pixel art square game icon.'),

    # ── Coffee Motor — remove the dangling blue wire ──────────────────────────
    # ('coffee_motor.png', False,
    #  'A small electric motor pulled from a coffee machine, exposed copper coil windings around an iron core, '
    #  'two small flat metal contact terminals on the top of the motor casing, '
    #  'IMPORTANT: NO trailing wires, NO blue cable, NO hanging cords — just the bare motor unit, '
    #  'slight industrial wear, mounted on a small base. '
    #  'White background, isometric pixel art square game icon.'),
    # ── Plastic Bags — replaces cup_stock.png ─────────────────────────────────
    ('plastic_bar.png', False,
     'A bundle of crumpled translucent plastic shopping bags loosely tied together with a twist tie, '
     'visible Caff-Infinite C-monogram logo faintly printed on the bags in light blue, '
     'a couple of the bags look damp / sea-tossed with bits of seaweed, '
     'environmental gallows humor, but kept as a clean inventory icon. '
     'White background, isometric pixel art square game icon.'),

    # ── Senior Intern Pod — head was backwards ────────────────────────────────
    ('amk3.png', True,
     'A glass-walled corner office cubicle floating in the air, an intern standing at a standing desk facing the desk with their body '
     #'AND head BOTH oriented forward toward the monitors (the face must be visible to the viewer, NOT turned around), '
     'three flat-panel monitors arranged in an arc on the desk, a small potted plant in the corner, '
     'the Caff-Infinite C-monogram logo on the frosted glass wall, soft warm lighting. '
     'White background, isometric pixel art square game icon.'),

    # ── Iron Gear: cog in the machine sculpture (per reference image) ─────────
    ('iron_gear.png', False,
     'A sculpture of a small human figure inside a large circular bronze cog/gear, '
     'the figure pushing against the inside of the gear like a hamster running in a wheel, '
     'represents the soul-crushing grind of corporate labor. '
     'White background, isometric pixel art square game icon.'),
    
    # ── Sour Powder (sulfur) ─────────────────────────────────────────────────
    ('sulfur.png', True,
     'A clear plastic bowl of bright yellow sulfer with C-monogram, '
     'some yellow powder spilled around the base, '
     'the Caff-Infinite C-monogram logo on the front label, '
     'a smaller warning label reading "" in bright red, vaguely concerning. '
     'White background, isometric pixel art square game icon.'),

    # ── Pre-Workout Powder (sulfuric acid) ───────────────────────────────────
    ('sulfuric_acid.png', True,
     'A chemistry lab flask two third full of screaming yellow liquid, '
     'aggressive corporate label reading "Acid" with the Caff-Infinite C-monogram logo prominent, '
     'lots of fine print warnings, '
     'unapologetic chemistry aesthetic. '
     'White background, isometric pixel art square game icon.'),
    
    # ── Stapler Cartridge (firearm magazine) — yellow trim ───────────────────
    ('firearm_magazine.png', True,
     'A standard office stapler refill cartridge box, mostly white with bright yellow trim bands and yellow corner accents, '
     'the Caff-Infinite C-monogram logo printed on the top, label reads "Standard Staples — 50 ct", '
     'a few loose silver staples spilling out the corner of the box. '
     'White background, isometric pixel art square game icon.'),

    # ── Heavy-Duty Stapler Pack (piercing rounds) — red trim, ACTUAL STAPLES ─
    ('piercing_rounds.png', True,
     'IMPORTANT: this image shows ACTUAL STAPLES (not a stapler) — a strip of heavy-duty metal staples ready to load, '
     'each staple slightly oversized and reinforced, the strip tinted a slight copper-red sheen, '
     'wrapped in a small white paper wrapper with red trim bands and red corner accents, '
     'the wrapper has the Caff-Infinite C-monogram logo and "Heavy-Duty Pack" in red. '
     'White background, isometric pixel art square game icon.'),

    # ── Temp Worker Arm (inserter) — retry ───────────────────────────────────
    ('inserter.png', False,
     'An arm in a fabric sleeve printed with the Caff-Infinite C-monogram logo, '
     'clean engineered look. '
     'White background, isometric pixel art square game icon.'),
    # ── Office Aroma Diffuser (beacon) ───────────────────────────────────────
    # ('aroma_diffuser.png', True,
    #  'A corporate-styled tall aroma diffuser machine standing in the middle of an open office floor, '
    #  'sleek white cylindrical body with a thin LED status strip, '
    #  'faint amber mist puffing out from vents around the top of the unit, '
    #  'a small touchscreen control panel on the front showing the Caff-Infinite C-monogram logo, '
    #  'subtle soft glow. '
    #  'White background, isometric pixel art square game icon.'),
]

def _save(data: bytes, path: Path):
    Image.open(BytesIO(data)).save(path, 'PNG')

def _rate_limit(e):
    s = str(e).lower()
    return any(x in s for x in ('429','quota','rate','resource_exhausted'))

def pick_model(client, logo):
    for m in GEMINI_MODELS:
        try:
            r = client.models.generate_content(
                model=m,
                contents=['Test — respond with an image of a red dot.', logo],
                config=types.GenerateContentConfig(response_modalities=['IMAGE','TEXT']),
            )
            if r.candidates:
                for p in r.candidates[0].content.parts:
                    if getattr(p, 'inline_data', None):
                        return m
        except Exception as e:
            print(f"  probe {m}: {type(e).__name__}: {str(e)[:80]}")
    return GEMINI_MODELS[0]

def gen_one(client, model, prompt, logo, needs_logo):
    contents = []
    if needs_logo:
        contents.append('Reference: use this exact Caff-Infinite C-monogram logo (blue diamond chevron frame, white C in center) wherever the prompt references branding:')
        contents.append(logo)
        contents.append(prompt)
    else:
        contents.append('Style reference (palette/feel only — do NOT include this logo in the output):')
        contents.append(logo)
        contents.append(prompt)

    delay = 4.0
    for attempt in range(4):
        try:
            r = client.models.generate_content(
                model=model, contents=contents,
                config=types.GenerateContentConfig(response_modalities=['IMAGE','TEXT']),
            )
            if not r.candidates: return None
            for p in r.candidates[0].content.parts:
                if getattr(p,'inline_data',None) and p.inline_data.data:
                    return p.inline_data.data
            return None
        except Exception as e:
            if _rate_limit(e) and attempt < 3:
                print(f"    rate-limited, waiting {delay:.0f}s ..."); time.sleep(delay); delay = min(delay*2, 60); continue
            raise

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--only',  type=str, default=None)
    ap.add_argument('--model', type=str, default=None)
    args = ap.parse_args()

    if not LOGO_PATH.exists():
        sys.exit(f"Missing logo at {LOGO_PATH}")
    client = genai.Client(api_key=API_KEY)
    logo = Image.open(LOGO_PATH).convert('RGBA')
    print(f"Logo: {LOGO_PATH.name} ({logo.size[0]}x{logo.size[1]})")

    if args.model:
        model = args.model
    else:
        print("Probing Gemini image-gen models...")
        model = pick_model(client, logo)
    print(f"Using model: {model}")
    print(f"Output dir: {OUTPUT_DIR}\n")

    items = ITEMS if not args.only else [t for t in ITEMS if args.only in t[0]]
    print(f"Generating {len(items)} items...\n")

    ok = err = 0
    for i, (fname, needs_logo, prompt) in enumerate(items, 1):
        tag = '  (logo on item)' if needs_logo else ''
        print(f"[{i}/{len(items)}] {fname}{tag}")
        try:
            data = gen_one(client, model, prompt, logo, needs_logo)
            if data is None:
                print("    SKIP (no image returned)\n"); err += 1; continue
            out = OUTPUT_DIR / fname
            _save(data, out)
            print(f"    saved {out.name} ({out.stat().st_size//1024} KB)\n"); ok += 1
        except Exception as e:
            print(f"    FAIL: {type(e).__name__}: {e}\n"); err += 1
        if i < len(items): time.sleep(1.5)

    print(f"\nDone. {ok} ok, {err} failed.")
    print(f"Compare {OUTPUT_DIR}/ against the originals in {CAFF_DIR}/ and copy in the winners.")

if __name__ == '__main__':
    main()
