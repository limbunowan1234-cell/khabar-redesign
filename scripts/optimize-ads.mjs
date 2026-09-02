// scripts/optimize-ads.mjs
// Resizes/compresses source ad creative into the desktop/tablet/mobile
// variants each placement needs, matching lib/adConfig.ts's image paths
// and the dimension spec from the original ad-system brief.
//
// Usage: drop one full-resolution source image per placement into
// scripts/ad-sources/<placement-folder>/source.jpg (or .png), then run:
//   node scripts/optimize-ads.mjs
// Output lands in public/ads/subha-russia-jobs/<placement-folder>/{desktop,tablet,mobile}.jpg
//
// Does nothing (skips with a message) for any placement whose source
// file doesn't exist yet -- safe to run before all creative has arrived.

import sharp from 'sharp';
import { existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SOURCES_DIR = join(__dirname, 'ad-sources');
const OUTPUT_DIR = join(__dirname, '..', 'public', 'ads', 'subha-russia-jobs');

// [width, height, jpeg quality] per placement/device -- matches the
// dimensions in the original ad-system spec.
const SPECS = {
  'hero-banner': {
    desktop: [1200, 400, 82],
    tablet: [768, 320, 80],
    mobile: [375, 300, 78],
  },
  sidebar: {
    desktop: [300, 600, 82],
    tablet: [300, 400, 80],
    mobile: [320, 400, 78],
  },
};

async function findSource(placementDir) {
  for (const ext of ['jpg', 'jpeg', 'png']) {
    const p = join(SOURCES_DIR, placementDir, `source.${ext}`);
    if (existsSync(p)) return p;
  }
  return null;
}

async function run() {
  for (const [placementDir, devices] of Object.entries(SPECS)) {
    const source = await findSource(placementDir);
    if (!source) {
      console.log(`skip: ${placementDir} — no scripts/ad-sources/${placementDir}/source.(jpg|png) yet`);
      continue;
    }

    const outDir = join(OUTPUT_DIR, placementDir);
    mkdirSync(outDir, { recursive: true });

    for (const [device, [width, height, quality]] of Object.entries(devices)) {
      const outPath = join(outDir, `${device}.jpg`);
      await sharp(source)
        .resize(width, height, { fit: 'cover', position: 'centre' })
        .jpeg({ quality, mozjpeg: true })
        .withMetadata({}) // strip EXIF, per the original spec's optimization requirements
        .toFile(outPath);
      console.log(`wrote: ${outPath} (${width}x${height}, q${quality})`);
    }
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
