#!/usr/bin/env python3
"""
Caff-Infinite rebrand — image generation for Tier 1 / 2 / 3 items.

All outputs land in:
    data/icon_imgs/caffactory/

Default: Gemini 2.5 Flash Image with data/icon_imgs/caffactory/Caf_logo.png
passed in as a reference so generated icons share consistent branding.
Use --imagen-only to fall back to Imagen 4.0 text-only.

Requires: pip install google-genai pillow

Usage:
    cd C:\\Users\\malco\\factorio-idle
    python temp_python_scripts/generate_icons.py             # all tiers
    python temp_python_scripts/generate_icons.py --tier 2    # only tier 2
    python temp_python_scripts/generate_icons.py --tier 2 --tier 3
    python temp_python_scripts/generate_icons.py --only stapler
    python temp_python_scripts/generate_icons.py --start 5 --tier 2
    python temp_python_scripts/generate_icons.py --list-models
    python temp_python_scripts/generate_icons.py --imagen-only
"""
import argparse, os, sys, time
from pathlib import Path
from io import BytesIO

try:
    from google import genai
    from google.genai import types
    from PIL import Image
except ImportError:
    sys.exit("Run: pip install google-genai pillow")

API_KEY    = os.environ.get('GEMINI_API_KEY') or sys.exit('Set GEMINI_API_KEY environment variable')
ROOT       = Path(__file__).resolve().parent.parent
OUTPUT_DIR = ROOT / 'data' / 'icon_imgs' / 'caffactory'
LOGO_PATH  = OUTPUT_DIR / 'Caf_logo.png'
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

# Gemini model candidates — tried in order.
#   gemini-2.5-flash-image-preview  → retired 2026-01-15
#   gemini-2.5-flash-image          → current stable, free tier (500/day)
#   gemini-3-pro-image-preview      → "Nano Banana Pro", PAID ONLY
#   gemini-3.1-flash-image-preview  → "Nano Banana 2", PAID
GEMINI_MODELS = [
    'gemini-2.5-flash-image',                    # current stable, free tier
    'gemini-2.0-flash-preview-image-generation',
    'gemini-2.0-flash-exp-image-generation',
]
IMAGEN_MODEL = 'imagen-4.0-generate-001'

# (needs_logo, filename, prompt)
#   needs_logo=True  → Gemini call instructs to place the Caff-Infinite logo on the item.
#   needs_logo=False → logo is still passed as a palette/style anchor only.

TIER1 = [
    (True, 'caffactory_can_red.png', 'Red aluminum energy drink can with Caff-Infinite logo, classic red, condensation droplets, isometric pixel art, square game icon'),  # Caff-Infinite Original
    (False, 'caffactory_can_green.png', 'Green energy drink can labelled "SHIPPED" with shipping label graphics on side, isometric pixel art game icon'),  # Caff-Infinite Shipped
    (False, 'caffactory_can_blue.png', 'Blue energy drink can with chemistry beaker icon and "BLUE 40" label, slightly glowing, isometric pixel art game icon'),  # Caff-Infinite BLUE 40
    (False, 'caffactory_can_black.png', 'Black matte energy drink can with red stripe and "TACTICAL" stencil text, military-surplus look, isometric pixel art game icon'),  # Caff-Infinite Tactical
    (False, 'caffactory_can_purple.png', 'Purple energy drink can with "OVERTIME" label, slightly battered, isometric pixel art game icon'),  # Caff-Infinite Overtime
    (False, 'caffactory_can_yellow.png', 'Yellow energy drink can with sunburst graphic, "HAPPINESS" label, cheerful corporate art, isometric pixel art game icon'),  # Caff-Infinite Happiness
    (False, 'caffactory_can_white.png', 'White energy drink can with star pattern and "ZERO-G" label, slightly floating, isometric pixel art game icon'),  # Caff-Infinite Zero-G
    (False, 'caffactory_can_rainbow.png', 'Iridescent holographic energy drink can with "LIMITED EDITION" foil label, rainbow gradient, isometric pixel art game icon'),  # Caff-Infinite Limited Edition
    (True, 'unpaid_intern.png', 'Tired-looking intern at a desk wearing a Caff-Infinite branded polo, energy drink in hand, surrounded by papers and a laptop, isometric pixel art game icon'),  # Unpaid Intern
    (False, 'intern_pod_1.png', 'Cubicle workstation with one intern assembling things at a desk, simple grey wall partitions, isometric pixel art game icon'),  # Junior Intern Pod
    (False, 'intern_pod_2.png', 'Larger cubicle with one intern and dual monitors, slightly nicer chair, isometric pixel art game icon'),  # Mid-Level Intern Pod
    (False, 'intern_pod_3.png', 'Glass-walled office cubicle with intern at standing desk, three monitors, plant in corner, isometric pixel art game icon'),  # Senior Intern Pod
    (False, 'microwave.png', 'Beat-up office break-room microwave on a small wooden stand, slightly stained, isometric pixel art game icon'),  # Microwave
    (False, 'microwave_industrial.png', 'Larger commercial-grade microwave with stainless steel exterior, on a metal cart, isometric pixel art game icon'),  # Industrial Microwave
    (False, 'espresso_machine.png', 'Large chrome commercial espresso machine with multiple steam wands and digital display, isometric pixel art game icon'),  # Industrial Espresso Machine
    (False, 'cubicle_rummager.png', 'Janitor with cart digging through office supply cabinets, dusty, isometric pixel art game icon'),  # Cubicle Rummager
    (False, 'janitor_bot.png', 'Roomba-style cleaning robot with mechanical arms collecting items, isometric pixel art game icon'),  # Automated Janitor
    (True, 'coffee_boiler.png', 'Industrial coffee urn with steam vents, branded "Caff-Infinite" on side, isometric pixel art game icon'),  # Coffee Boiler
    (False, 'steam_engine.png', 'Brass steam-powered electrical generator, slightly retro-industrial, isometric pixel art game icon'),  # Steam Generator
    (False, 'skylight.png', 'Office skylight panel with sun rays coming through, isometric pixel art game icon'),  # Open-Plan Skylight
    (True, 'power_bank.png', 'Large industrial USB power bank labelled "Caff-Infinite Battery", glowing LED indicators, isometric pixel art game icon'),  # Power Bank
    (True, 'flavor_lab.png', 'R&D laboratory with beakers of colorful liquids, scientist silhouettes, "Caff-Infinite R&D" sign, isometric pixel art game icon'),  # Flavor Lab
    (False, 'surveillance_tower.png', 'Office surveillance camera on tall pole with WiFi signals radiating, isometric pixel art game icon'),  # Surveillance Tower
    (False, 'coffee_grounds.png', 'Pile of damp dark coffee grounds on a paper filter, isometric pixel art game icon'),  # Used Coffee Grounds
    (False, 'crushed_cans.png', 'Pile of crushed empty energy drink cans being recycled, mixed colors, slight gleam, isometric pixel art game icon'),  # Crushed Cans
    (False, 'e_waste.png', 'Pile of broken phones, old laptops, and tangled cables in a recycling bin, isometric pixel art game icon'),  # E-Waste
    (False, 'drywall_chunks.png', 'Chunks of broken office drywall and gypsum board on a pallet, isometric pixel art game icon'),  # Drywall Chunks
    (False, 'aluminum_sheet.png', 'Stack of clean aluminum sheets with riveted corners, slight reflection, isometric pixel art game icon'),  # Aluminum Sheet
    (False, 'wire_spool.png', 'Industrial spool of stripped copper wire, neat coils, slight oxidation, isometric pixel art game icon'),  # Wire Spool
    (False, 'reinforced_tray.png', 'Stack of reinforced industrial steel cafeteria trays, isometric pixel art game icon'),  # Reinforced Tray
    (False, 'office_cog.png', 'Small metal cog/gear with corporate finish, slightly worn, isometric pixel art game icon'),  # Office Cog
    (False, 'phone_cables.png', 'Tangled bundle of phone charging cables in various colors, isometric pixel art game icon'),  # Phone Cables
    (False, 'um_100.png', 'Small green printed circuit board, 1990s style, single small chip, simple traces, "UM 100" silkscreen, isometric pixel art square game icon'),  # UM 100
    (False, 'um_200.png', 'Black printed circuit board with mid-size chip, several capacitors and gold contacts, "UM 200" silkscreen, isometric pixel art square game icon'),  # UM 200
    (False, 'um_300.png', 'Dark printed circuit board with massive CPU chip under a finned aluminum heatsink, RGB accent strip, "UM 300" silkscreen, isometric pixel art square game icon'),  # UM 300
]

TIER2 = [
    (False, 'syrup_concentrate.png', 'Dark sticky syrup in a clear barrel labelled "BASE FORMULA - HAZMAT", isometric pixel art game icon'),  # Drink Syrup Concentrate
    (False, 'concentrate_heavy.png', 'Dark thick syrup in a metal canister, viscous, isometric pixel art game icon'),  # Heavy Concentrate
    (False, 'concentrate_light.png', 'Pale yellow flavor syrup in glass bottle, isometric pixel art game icon'),  # Light Concentrate
    (False, 'carbonation.png', 'Clear pressurized CO2 canister with bubble graphics, isometric pixel art game icon'),  # Carbonation
    (False, 'sour_powder.png', 'Yellow sour candy powder in a small pouch, isometric pixel art game icon'),  # Sour Powder
    (False, 'pre_workout.png', 'Bright yellow powder in a tub labelled "PRE-WORKOUT — DO NOT INHALE", isometric pixel art game icon'),  # Pre-Workout Powder
    (False, 'cup_stock.png', 'Plastic bags in the ocane with a turtle in destress'),  # Plastic Bags
    (False, 'battery_pack.png', 'Standard AA battery pack still in retail packaging, isometric pixel art game icon'),  # AA Battery Pack
    (False, 'coffee_motor.png', 'Small motor unit pulled from a coffee machine with copper coils, isometric pixel art game icon'),  # Coffee Maker Motor
    (False, 'espresso_motor.png', 'Industrial espresso machine pump motor with copper windings, isometric pixel art game icon'),  # Espresso Pump Motor
    (False, 'drone_frame.png', 'Black quadcopter delivery drone chassis without rotors, isometric pixel art game icon'),  # Scamazon Drone Frame
    (False, 'water_cooler.png', 'Large office water cooler with full 5-gallon jug, isometric pixel art game icon'),  # Water Cooler
    (False, 'syrup_extractor.png', 'Industrial syrup pump unit with branded barrel, isometric pixel art game icon'),  # Syrup Extractor
    (True, 'beverage_plant.png', 'Large industrial drink processing plant with multiple tanks and pipes, "Caff-Infinite Bottling" sign, isometric pixel art game icon'),  # Beverage Plant
    (True, 'qa_spinner.png', 'Industrial centrifuge with blue and yellow Caff-Infinite branding, "QC Lab" label, isometric pixel art game icon'),  # QA Spinner
    (True, 'marketing_silo.png', 'Massive marketing rocket on a corporate launchpad, "Caff-Infinite" branding on side, isometric pixel art game icon'),  # Marketing Launchpad
    (False, 'data_center.png', 'Gas turrbine with smog'),  # Invers data center
    (False, 'triple_shot_1.png', 'Small espresso shot glass module Mk1, isometric pixel art game icon'),  # Signal Shot
    (False, 'triple_shot_2.png', 'Medium espresso shot module Mk2, glowing, isometric pixel art game icon'),  # Double Shot
    (False, 'triple_shot_3.png', 'Large glowing energy module with espresso symbol Mk3, isometric pixel art game icon'),  # Nuclear Espresso
    (False, 'perf_review_1.png', 'Pink module with bar chart and "Q1" label Mk1, isometric pixel art game icon'),  # Performance Review
    (False, 'perf_review_2.png', 'Pink module with rising chart Mk2, isometric pixel art game icon'),  # Quarterly Review
    (False, 'perf_review_3.png', 'Glowing pink module with explosive chart Mk3, isometric pixel art game icon'),  # Annual Review
    (True, 'temp_arm.png', 'Robotic arm in a Caff-Infinite branded sleeve picking items, isometric pixel art game icon'),  # Temp Worker Arm
    (False, 'cubicle_panel.png', 'Grey fabric-covered cubicle wall panel section, isometric pixel art game icon'),  # Cubicle Panel
    (False, 'stylus.png', 'Metal stylus or pen-like stick, slightly tarnished, isometric pixel art game icon'),  # Stylus
]

TIER3 = [
    (False, 'banned_powder.png', 'Glowing green powder in a bag labelled "RECALLED — DO NOT INGEST", isometric pixel art game icon'),  # Banned Energy Powder
    (False, 'discontinued_drink.png', 'Energy drink can with "RECALL" sticker and warning labels, slightly leaking, isometric pixel art game icon'),  # Discontinued Energy Drink
    (False, 'rocket_fuel_drink.png', 'Energy drink can labelled "ROCKET FUEL — for marketing department use only", glowing, isometric pixel art game icon'),  # Rocket Fuel
    (False, 'marketing_panel.png', 'Stack of hollow plastic display panels with marketing copy, isometric pixel art game icon'),  # Hollow Marketing Material
    (True, 'ad_satellite.png', 'Communication satellite with "Caff-Infinite Targeted Ads" branding and dish, isometric pixel art game icon'),  # Ad Network Satellite
    (False, 'caffeine_crystal_pure.png', 'Glowing green crystalline caffeine powder, isometric pixel art game icon'),  # Pure Caffeine Crystal
    (False, 'caffeine_crystal.png', 'Pale green crystalline caffeine powder (less pure), isometric pixel art game icon'),  # Caffeine Crystal
    (False, 'caffeine_capsule.png', 'Yellow glowing capsule with green liquid inside, energy drink theme, isometric pixel art game icon'),  # Caffeine Capsule
    (False, 'concrete.png', 'Grey concrete tile slab, plain, isometric pixel art game icon'),  # Concrete
    (True, 'stapler_ammo.png', 'Box of stapler refills, "Caff-Infinite Office Supplies" branding, isometric pixel art game icon'),  # Stapler Cartridge
    (False, 'stapler_heavy.png', 'Industrial stapler refill cartridge with metal plating, isometric pixel art game icon'),  # Heavy-Duty Stapler Pack
    (False, 'stapler_uranium.png', 'Glowing green stapler cartridge with hazard warnings, isometric pixel art game icon'),  # Radioactive Stapler Pack
    (False, 'marketing_missile.png', 'Large marketing-themed projectile labelled "BRAND AWARENESS - DO NOT IGNORE", isometric pixel art game icon'),  # Marketing Missile
    (False, 'atomic_drink.png', 'Massive collectible energy drink can shaped like a bomb, "LIMITED EDITION" foil, isometric pixel art game icon'),  # Limited Edition Drop
    (True, 'auto_stapler.png', 'Mounted defensive turret made from a giant industrial stapler with a rotating base, "Caff-Infinite" stencil on side, isometric pixel art game icon'),  # Auto-Stapler Sentry
    (False, 'briefing_beam.png', 'Defensive turret built from a giant red laser pointer on a swivel mount with a presentation projector base, isometric pixel art game icon'),  # Briefing Beam
    (True, 'pr_howitzer.png', 'Massive cannon-shaped turret labelled "Caff-Infinite PR Department", pointed skyward, marketing posters around base, isometric pixel art game icon'),  # PR Howitzer
    (False, 'cubicle_wall.png', 'Section of grey fabric-covered office cubicle wall standing as a defensive barrier, slight scuff marks, isometric pixel art game icon'),  # Cubicle Wall
]

ALL_ITEMS = {1: TIER1, 2: TIER2, 3: TIER3}

# ── Generation backends ────────────────────────────────────────────────────────
def _save_bytes_as_png(data: bytes, out_path: Path):
    Image.open(BytesIO(data)).save(out_path, 'PNG')

def gen_with_gemini(client, prompt, logo_img, needs_logo, model):
    contents = []
    if needs_logo:
        contents.append('Reference logo — use this exact Caff-Infinite C-monogram logo (blue diamond chevron frame, white C in center) wherever the prompt mentions branding:')
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
    if not resp.candidates: return None
    for part in resp.candidates[0].content.parts:
        if getattr(part, 'inline_data', None) and part.inline_data.data:
            return part.inline_data.data
    return None

def gen_with_imagen(client, prompt):
    resp = client.models.generate_images(
        model=IMAGEN_MODEL, prompt=prompt,
        config=types.GenerateImagesConfig(number_of_images=1),
    )
    if not resp.generated_images: return None
    buf = BytesIO()
    resp.generated_images[0].image.save(buf, format='PNG')
    return buf.getvalue()

# ── Driver ──────────────────────────────────────────────────────────────────────
def _is_rate_limit(err):
    msg = str(err).lower()
    return any(x in msg for x in ('429', 'quota', 'rate', 'resource_exhausted'))

def gen_one(client, prompt, logo_img, needs_logo, use_imagen, model):
    delay = 4.0
    for attempt in range(4):
        try:
            if use_imagen:
                return gen_with_imagen(client, prompt)
            return gen_with_gemini(client, prompt, logo_img, needs_logo, model)
        except Exception as e:
            if _is_rate_limit(e) and attempt < 3:
                print(f"    rate-limited, waiting {delay:.0f}s ...", flush=True)
                time.sleep(delay); delay = min(delay * 2, 60)
                continue
            raise

def pick_gemini_model(client, logo_img):
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
                        print(f"Using Gemini model: {m}\n"); return m
        except Exception as e:
            print(f"  probe {m}: {type(e).__name__}: {str(e)[:80]}")
    print(f"WARNING: no Gemini model probed successfully; will try {GEMINI_MODELS[0]} anyway.\n")
    return GEMINI_MODELS[0]

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--start',       type=int, default=0)
    ap.add_argument('--only',        type=str, default=None)
    ap.add_argument('--tier',        type=int, action='append', choices=[1,2,3], default=None,
                    help='Restrict to one or more tiers. Repeatable. Default: all tiers.')
    ap.add_argument('--imagen-only', action='store_true')
    ap.add_argument('--list-models', action='store_true')
    args = ap.parse_args()

    if args.list_models:
        client = genai.Client(api_key=API_KEY)
        print("Models available to your API key:")
        for m in client.models.list():
            name = getattr(m, 'name', '?')
            tag = '   <-- image model' if 'image' in name.lower() else ''
            print(f"  {name}{tag}")
        return

    if not LOGO_PATH.exists() and not args.imagen_only:
        sys.exit(f"Logo not found at {LOGO_PATH}. Place it there or use --imagen-only.")

    client = genai.Client(api_key=API_KEY)
    logo_img = None
    model = None
    if not args.imagen_only:
        logo_img = Image.open(LOGO_PATH).convert('RGBA')
        print(f"Loaded logo: {LOGO_PATH.name} ({logo_img.size[0]}x{logo_img.size[1]})")
        print("Probing Gemini image-gen models...")
        model = pick_gemini_model(client, logo_img)

    # Assemble item list from selected tiers.
    tiers = sorted(args.tier) if args.tier else [1, 2, 3]
    items = []
    for t in tiers:
        items.extend(ALL_ITEMS[t])
    items = items[args.start:]
    if args.only:
        items = [t for t in items if args.only in t[1]]

    print(f"Generating {len(items)} icons from tiers {tiers} -> {OUTPUT_DIR}")
    print(f"Mode: {'Imagen 4.0 (no reference)' if args.imagen_only else f'Gemini ({model}) with logo'}\n")

    ok = err = 0
    for i, (needs_logo, fname, prompt) in enumerate(items, 1):
        tag = '  (logo on item)' if needs_logo and not args.imagen_only else ''
        print(f"[{i}/{len(items)}] {fname}{tag}")
        try:
            data = gen_one(client, prompt, logo_img, needs_logo, args.imagen_only, model)
            if data is None:
                print(f"    SKIP (no image returned)\n"); err += 1; continue
            out = OUTPUT_DIR / fname
            _save_bytes_as_png(data, out)
            print(f"    saved {out.name} ({out.stat().st_size} bytes)\n"); ok += 1
        except Exception as e:
            print(f"    FAIL: {type(e).__name__}: {e}\n"); err += 1
        if i < len(items): time.sleep(1.5)

    print(f"\nDone. {ok} ok, {err} failed. Total: {len(items)}")
    if err:
        print("Resume failed items: --only <filename-substring>")

if __name__ == '__main__':
    main()
)
