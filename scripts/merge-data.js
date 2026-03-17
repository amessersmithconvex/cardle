/**
 * Cardle - Data Merge Tool
 *
 * Merges scraped data into the game's cars.json dataset.
 * Validates entries, deduplicates by VIN, and assigns sequential IDs.
 *
 * Usage:
 *   node scripts/merge-data.js                      # merge scraped data into cars.json
 *   node scripts/merge-data.js --min-price 500      # only include cars sold for $500+
 *   node scripts/merge-data.js --max-price 200000   # cap at $200k
 *   node scripts/merge-data.js --stats               # show dataset statistics
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCRAPED_PATH = path.join(__dirname, '..', 'server', 'data', 'scraped-cars.json');
const MANUAL_PATH = path.join(__dirname, '..', 'server', 'data', 'manual-cars.json');
const OUTPUT_PATH = path.join(__dirname, '..', 'server', 'data', 'cars.json');

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { minPrice: 100, maxPrice: Infinity, stats: false };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--min-price' && args[i + 1]) opts.minPrice = parseInt(args[i + 1], 10);
    if (args[i] === '--max-price' && args[i + 1]) opts.maxPrice = parseInt(args[i + 1], 10);
    if (args[i] === '--stats') opts.stats = true;
  }

  return opts;
}

function loadJson(filePath) {
  if (!fs.existsSync(filePath)) return [];
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch {
    console.warn(`  Warning: Could not parse ${filePath}`);
    return [];
  }
}

function isValidEntry(car, opts) {
  if (!car.year || car.year < 1900 || car.year > 2030) return false;
  if (!car.make || !car.model) return false;
  if (!car.soldPrice || car.soldPrice < opts.minPrice || car.soldPrice > opts.maxPrice) return false;
  return true;
}

function printStats(cars) {
  console.log('\n📊 Dataset Statistics:');
  console.log(`   Total entries: ${cars.length}`);

  if (cars.length === 0) return;

  const prices = cars.map((c) => c.soldPrice).sort((a, b) => a - b);
  console.log(`   Price range: $${prices[0].toLocaleString()} - $${prices[prices.length - 1].toLocaleString()}`);
  console.log(`   Median price: $${prices[Math.floor(prices.length / 2)].toLocaleString()}`);
  console.log(`   Average price: $${Math.round(prices.reduce((a, b) => a + b, 0) / prices.length).toLocaleString()}`);

  const makes = {};
  cars.forEach((c) => { makes[c.make] = (makes[c.make] || 0) + 1; });
  const sortedMakes = Object.entries(makes).sort((a, b) => b[1] - a[1]).slice(0, 15);
  console.log(`\n   Top makes:`);
  sortedMakes.forEach(([make, count]) => {
    console.log(`     ${make}: ${count}`);
  });

  const years = cars.map((c) => c.year);
  const decades = {};
  years.forEach((y) => {
    const decade = `${Math.floor(y / 10) * 10}s`;
    decades[decade] = (decades[decade] || 0) + 1;
  });
  console.log(`\n   By decade:`);
  Object.entries(decades).sort().forEach(([decade, count]) => {
    console.log(`     ${decade}: ${count}`);
  });

  console.log(`\n   Daily games possible: ${Math.floor(cars.length / 5)}`);
}

function main() {
  const opts = parseArgs();

  console.log('🔄 Cardle Data Merge Tool\n');

  const manualCars = loadJson(MANUAL_PATH);
  const scrapedCars = loadJson(SCRAPED_PATH);
  const existingCars = loadJson(OUTPUT_PATH);

  console.log(`   Manual entries: ${manualCars.length}`);
  console.log(`   Scraped entries: ${scrapedCars.length}`);
  console.log(`   Current cars.json: ${existingCars.length}`);

  // Combine all sources, manual first (higher quality)
  const allCars = [...manualCars, ...scrapedCars];

  // Deduplicate by VIN
  const seen = new Set();
  const deduped = [];
  for (const car of allCars) {
    const key = car.vin && car.vin.length === 17 ? car.vin : `${car.year}-${car.make}-${car.model}-${car.soldPrice}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(car);
  }

  // Validate and filter
  const valid = deduped.filter((c) => isValidEntry(c, opts));

  // Assign sequential IDs
  valid.forEach((car, i) => { car.id = i + 1; });

  if (opts.stats) {
    printStats(valid);
    return;
  }

  // Write merged data
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(valid, null, 2));

  console.log(`\n✅ Merged ${valid.length} entries into cars.json`);
  console.log(`   (${deduped.length - valid.length} entries filtered out)`);

  printStats(valid);
}

main();
