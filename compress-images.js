const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const IMAGE_DIRS = [
  'data/icon_imgs',
  'data/map_imgs',
];

const SKIP_DIRS = new Set(['regen', 'Old', 'normalized']);

// Max dimension for icons — largest display size is 140px, 300px covers 2x retina
const MAX_DIM = 300;
const JPEG_QUALITY = 80;

let totalBefore = 0;
let totalAfter = 0;
let count = 0;

async function compressFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (!['.png', '.jpg', '.jpeg'].includes(ext)) return;

  const before = fs.statSync(filePath).size;
  const tmp = filePath + '.tmp';

  try {
    const meta = await sharp(filePath).metadata();
    const needsResize = meta.width > MAX_DIM || meta.height > MAX_DIM;

    let pipeline = sharp(filePath);
    if (needsResize) {
      pipeline = pipeline.resize(MAX_DIM, MAX_DIM, { fit: 'inside', withoutEnlargement: true });
    }

    if (ext === '.png') {
      pipeline = pipeline.png({ compressionLevel: 9 });
    } else {
      pipeline = pipeline.jpeg({ quality: JPEG_QUALITY, mozjpeg: true });
    }

    await pipeline.toFile(tmp);

    const after = fs.statSync(tmp).size;

    if (after < before) {
      fs.renameSync(tmp, filePath);
      totalBefore += before;
      totalAfter += after;
      count++;
      const saved = ((before - after) / before * 100).toFixed(1);
      const resizeNote = needsResize ? ` [${meta.width}x${meta.height}→${MAX_DIM}]` : '';
      console.log(`  ${path.relative('.', filePath)}: ${kb(before)} → ${kb(after)} (-${saved}%)${resizeNote}`);
    } else {
      fs.unlinkSync(tmp);
    }
  } catch (e) {
    if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
    console.warn(`  SKIP ${filePath}: ${e.message}`);
  }
}

function kb(bytes) {
  return (bytes / 1024).toFixed(0) + 'K';
}

async function walkDir(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      await walkDir(path.join(dir, entry.name));
    } else {
      await compressFile(path.join(dir, entry.name));
    }
  }
}

(async () => {
  for (const dir of IMAGE_DIRS) {
    if (fs.existsSync(dir)) await walkDir(dir);
  }
  const savedMB = ((totalBefore - totalAfter) / 1024 / 1024).toFixed(1);
  const savedPct = totalBefore ? ((totalBefore - totalAfter) / totalBefore * 100).toFixed(1) : 0;
  console.log(`\nDone: ${count} files compressed, saved ${savedMB} MB (${savedPct}%)`);
})();
