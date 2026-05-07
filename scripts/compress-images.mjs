/**
 * compress-images.mjs
 * 
 * Compresses all PNG images in the public/ directory:
 *  1. Generates optimized WebP versions (lossy, quality 80) — ~60-70% smaller
 *  2. Overwrites original PNGs with optimized versions (max compression)
 * 
 * Usage: node scripts/compress-images.mjs
 * Requires: npm install --save-dev sharp
 */

import sharp from 'sharp';
import { readdir, stat } from 'fs/promises';
import { join, basename, extname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const PUBLIC_DIR = join(__dirname, '..', 'public');

// Skip PWA icons — they need to remain as PNGs at exact sizes
const SKIP_FILES = new Set(['pwa-192x192.png', 'pwa-512x512.png']);

async function getImageFiles() {
  const entries = await readdir(PUBLIC_DIR);
  return entries.filter(f => 
    extname(f).toLowerCase() === '.png' && !SKIP_FILES.has(f)
  );
}

async function compressImage(filename) {
  const inputPath = join(PUBLIC_DIR, filename);
  const webpPath = join(PUBLIC_DIR, filename.replace(/\.png$/i, '.webp'));
  
  const originalStats = await stat(inputPath);
  const originalSize = originalStats.size;

  // Read the image once
  const image = sharp(inputPath);
  const metadata = await image.metadata();

  // 1. Generate WebP version (lossy, quality 80 — great balance for photos)
  await sharp(inputPath)
    .webp({ quality: 80, effort: 6 })
    .toFile(webpPath);

  // 2. Optimize the original PNG (max compression level)
  const optimizedPng = await sharp(inputPath)
    .png({ 
      compressionLevel: 9,
      adaptiveFiltering: true,
      palette: false  // Keep as truecolor for photo quality
    })
    .toBuffer();

  // Write the optimized PNG back
  const { writeFile } = await import('fs/promises');
  await writeFile(inputPath, optimizedPng);

  const newPngStats = await stat(inputPath);
  const webpStats = await stat(webpPath);

  return {
    filename,
    originalSize,
    pngSize: newPngStats.size,
    webpSize: webpStats.size,
    pngSavings: ((1 - newPngStats.size / originalSize) * 100).toFixed(1),
    webpSavings: ((1 - webpStats.size / originalSize) * 100).toFixed(1),
    dimensions: `${metadata.width}×${metadata.height}`
  };
}

function formatBytes(bytes) {
  if (bytes < 1024) return bytes + ' B';
  const kb = bytes / 1024;
  if (kb < 1024) return kb.toFixed(1) + ' KB';
  return (kb / 1024).toFixed(2) + ' MB';
}

async function main() {
  console.log('🖼️  Image Compression Tool');
  console.log('========================\n');

  const files = await getImageFiles();
  console.log(`Found ${files.length} PNG images to compress (skipping PWA icons)\n`);

  let totalOriginal = 0;
  let totalPng = 0;
  let totalWebp = 0;

  const results = [];

  for (const file of files) {
    process.stdout.write(`  Compressing ${file}...`);
    const result = await compressImage(file);
    results.push(result);
    totalOriginal += result.originalSize;
    totalPng += result.pngSize;
    totalWebp += result.webpSize;
    console.log(` ✅  PNG: -${result.pngSavings}%  |  WebP: -${result.webpSavings}%`);
  }

  console.log('\n────────────────────────────────────────────────────────');
  console.log('📊 Results Summary\n');

  // Table
  console.log('  File                          Original     PNG         WebP');
  console.log('  ──────────────────────────────────────────────────────────────');
  for (const r of results) {
    const name = r.filename.padEnd(30);
    const orig = formatBytes(r.originalSize).padEnd(12);
    const png = `${formatBytes(r.pngSize)} (-${r.pngSavings}%)`.padEnd(18);
    const webp = `${formatBytes(r.webpSize)} (-${r.webpSavings}%)`;
    console.log(`  ${name} ${orig} ${png} ${webp}`);
  }

  console.log('\n  ──────────────────────────────────────────────────────────────');
  console.log(`  TOTALS:`.padEnd(32) + 
    `${formatBytes(totalOriginal).padEnd(12)} ` +
    `${formatBytes(totalPng)} (-${((1 - totalPng / totalOriginal) * 100).toFixed(1)}%)`.padEnd(18) + ' ' +
    `${formatBytes(totalWebp)} (-${((1 - totalWebp / totalOriginal) * 100).toFixed(1)}%)`
  );

  console.log('\n✅ Done! WebP files created alongside original PNGs.');
  console.log('💡 Use <picture> elements or .webp URLs for maximum Android performance.');
}

main().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
