# Building the Project

## Prerequisites

- Node.js installed
- Run `npm install` once to install dependencies (includes `electron`, `electron-packager`, `sharp`)

## Build Steps

### 1. Compress images (first time, or after adding new images)

```bash
npm run compress-images
```

This resizes all images in `data/icon_imgs/` and `data/map_imgs/` to a max of 300px on their longest dimension (covers the largest 140px display size at 2× retina), then recompresses them in-place. Run this once after adding any new images — it modifies the source files directly.

Skips dev-only subfolders (`regen/`, `Old/`, `normalized/`) since those aren't used by the game.

### 2. Package the app

```bash
npm run dist
```

Produces `dist/Caff-Infinit-win32-x64/` with the packaged Electron app.

The dist command automatically excludes:
- `node_modules/`, `dist/` — build artifacts
- `data/icon_imgs/caffactory/regen/`, `Old/`, `normalized/` — image generation artifacts
- `examples/`, `temp_python_scripts/` — dev-only files
- `caffactory_rebrand.xlsx` — planning spreadsheet

## Output

The packaged app lives at `dist/Caff-Infinit-win32-x64/Caff-Infinit.exe`.

## Notes

- `compress-images.js` is the script behind `npm run compress-images`. It uses `sharp` and only writes a file if the compressed version is actually smaller than the original.
- Do not commit compressed images and then run compression again — the script is idempotent but repeated runs on already-small images won't gain anything.
- The `.claude` directory and `node_modules` are excluded from packaging automatically.
