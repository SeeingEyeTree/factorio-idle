#!/usr/bin/env python3
"""
Generate game icons using Google's Imagen 4.0 API
Requires: pip install google-genai pillow
"""

import csv
import time
from pathlib import Path
from google import genai
from google.genai import types
from PIL import Image
from io import BytesIO

# Your API key
API_KEY = "AIzaSyDcC3sDlhYGupPiDfOdFtl0wrJdy3f-l8c"

# Initialize client
client = genai.Client(api_key=API_KEY)

# Read items from your CSV
CSV_FILE = "icon_list.csv"
OUTPUT_DIR = "generated_icons"

def load_icon_list(csv_path):
    """Load items from the CSV file"""
    items = []
    try:
        with open(csv_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                if row.get('Display Name') and row.get('Description'):
                    items.append({
                        'key': row.get('Item Key'),
                        'name': row.get('Display Name'),
                        'description': row.get('Description'),
                        'filename': row.get('Expected Filename')
                    })
    except FileNotFoundError:
        print(f"CSV file not found: {csv_path}")
    return items

def generate_image(prompt, api_key):
    """Generate a single image using Imagen 4.0 API"""
    try:
        response = client.models.generate_images(
            model='imagen-4.0-generate-001',
            prompt=prompt,
            config=types.GenerateImagesConfig(
                number_of_images=1,
            )
        )

        # Extract the image from response
        if response.generated_images:
            return response.generated_images[0].image
        else:
            return None

    except Exception as e:
        print(f"API Error: {e}")
        return None

def main():
    # Create output directory
    Path(OUTPUT_DIR).mkdir(exist_ok=True)

    # Load items
    items = load_icon_list(CSV_FILE)
    print(f"Found {len(items)} items to generate icons for\n")

    if not items:
        print("No items found in CSV")
        return

    # TEST MODE: Only generate first item
    #items = items[:1]  # Comment this out to generate all items

    # Generate icons
    success_count = 0
    failed_count = 0

    for i, item in enumerate(items, 1):
        # Create prompt
        prompt = f"{item['description']} pixel art, square game icon"

        print(f"[{i}/{len(items)}] Generating: {item['name']}")
        print(f"    Prompt: {prompt}")

        # Generate image
        image = generate_image(prompt, API_KEY)

        if image:
            # Save image
            output_path = Path(OUTPUT_DIR) / item['filename']
            image.save(output_path)
            print(f"    ✓ Saved to: {output_path}\n")
            success_count += 1
        else:
            print(f"    ✗ Failed to generate\n")
            failed_count += 1

        # Be respectful of API rate limits
        if i < len(items):
            time.sleep(1)

    print(f"\n{'='*50}")
    print(f"Complete! Generated {success_count} icons, {failed_count} failed")
    print(f"Icons saved to: {OUTPUT_DIR}/")

if __name__ == "__main__":
    main()
