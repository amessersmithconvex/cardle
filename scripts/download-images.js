/**
 * Cardle - Image Downloader
 *
 * Downloads car images from URLs in cars.json and saves them locally.
 * Images are saved to public/images/{carId}/ folder.
 *
 * Usage:
 *   node scripts/download-images.js              # download all missing images
 *   node scripts/download-images.js --limit 50   # only first 50 cars
 *   node scripts/download-images.js --force       # re-download existing
 */

import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CARS_PATH = path.join(__dirname, '..', 'server', 'data', 'cars.json');
const IMAGES_DIR = path.join(__dirname, '..', 'public', 'images');

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    const file = fs.createWriteStream(dest);

    const request = client.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'image/*,*/*',
        'Referer': 'https://bid.cars/',
      },
      timeout: 15000,
    }, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        const redirectUrl = response.headers.location;
        if (redirectUrl) {
          file.close();
          fs.unlinkSync(dest);
          return download(redirectUrl, dest).then(resolve).catch(reject);
        }
      }
      if (response.statusCode !== 200) {
        file.close();
        fs.unlinkSync(dest);
        reject(new Error(`HTTP ${response.statusCode}`));
        return;
      }
      response.pipe(file);
      file.on('finish', () => { file.close(); resolve(); });
    });

    request.on('error', (err) => {
      file.close();
      if (fs.existsSync(dest)) fs.unlinkSync(dest);
      reject(err);
    });

    request.on('timeout', () => {
      request.destroy();
      if (fs.existsSync(dest)) fs.unlinkSync(dest);
      reject(new Error('Timeout'));
    });
  });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getExtension(url) {
  const match = url.match(/\.(jpe?g|png|webp|gif|avif)/i);
  return match ? match[0].toLowerCase() : '.jpg';
}

async function main() {
  const args = process.argv.slice(2);
  const force = args.includes('--force');
  let limit = Infinity;
  const limitIdx = args.indexOf('--limit');
  if (limitIdx >= 0 && args[limitIdx + 1]) {
    limit = parseInt(args[limitIdx + 1], 10);
  }

  if (!fs.existsSync(CARS_PATH)) {
    console.log('No cars.json found. Run merge-data first.');
    process.exit(1);
  }

  const cars = JSON.parse(fs.readFileSync(CARS_PATH, 'utf-8'));
  const carsWithImages = cars.filter(c => c.images && c.images.length > 0).slice(0, limit);

  console.log(`🖼  Cardle Image Downloader`);
  console.log(`   Cars with image URLs: ${carsWithImages.length}`);
  console.log(`   Output: ${IMAGES_DIR}\n`);

  if (!fs.existsSync(IMAGES_DIR)) {
    fs.mkdirSync(IMAGES_DIR, { recursive: true });
  }

  let downloaded = 0;
  let skipped = 0;
  let failed = 0;

  for (const car of carsWithImages) {
    const carDir = path.join(IMAGES_DIR, String(car.id));
    if (!fs.existsSync(carDir)) {
      fs.mkdirSync(carDir, { recursive: true });
    }

    for (let i = 0; i < car.images.length; i++) {
      const url = car.images[i];
      const ext = getExtension(url);
      const filename = `${i + 1}${ext}`;
      const dest = path.join(carDir, filename);

      if (fs.existsSync(dest) && !force) {
        skipped++;
        continue;
      }

      try {
        await download(url, dest);
        downloaded++;
        // Update the image path in the car data to use local path
        car.images[i] = `/images/${car.id}/${filename}`;
        process.stdout.write(`  ✅ Car ${car.id} image ${i + 1}\r`);
      } catch (err) {
        failed++;
        process.stdout.write(`  ❌ Car ${car.id} image ${i + 1}: ${err.message}\r`);
      }

      await sleep(200 + Math.random() * 300);
    }
  }

  // Save updated cars.json with local image paths
  fs.writeFileSync(CARS_PATH, JSON.stringify(cars, null, 2));

  console.log(`\n\n🏁 Image Download Complete`);
  console.log(`   Downloaded: ${downloaded}`);
  console.log(`   Skipped (existing): ${skipped}`);
  console.log(`   Failed: ${failed}`);
  console.log(`   cars.json updated with local image paths.`);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
