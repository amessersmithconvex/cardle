/**
 * Cardle - Import Scraped JSON Data
 *
 * Imports JSON files downloaded via the browser console extractor.
 * Merges new entries with existing scraped data, deduplicates by VIN.
 *
 * Usage:
 *   node scripts/import-scraped.js file1.json [file2.json ...]
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCRAPED_PATH = path.join(__dirname, '..', 'server', 'data', 'scraped-cars.json');

function main() {
  const files = process.argv.slice(2);

  if (files.length === 0) {
    console.log('Usage: node scripts/import-scraped.js <file1.json> [file2.json ...]');
    console.log('  Import JSON files from the browser console extractor.');
    process.exit(1);
  }

  let existing = [];
  if (fs.existsSync(SCRAPED_PATH)) {
    existing = JSON.parse(fs.readFileSync(SCRAPED_PATH, 'utf-8'));
  }

  const existingVins = new Set(existing.filter(c => c.vin).map(c => c.vin));
  let nextId = existing.length > 0 ? Math.max(...existing.map(c => c.id)) + 1 : 1;
  let totalNew = 0;

  for (const filePath of files) {
    const resolved = path.resolve(filePath);
    if (!fs.existsSync(resolved)) {
      console.log(`  ⚠ File not found: ${resolved}`);
      continue;
    }

    const data = JSON.parse(fs.readFileSync(resolved, 'utf-8'));
    const entries = Array.isArray(data) ? data : [data];
    let added = 0;

    for (const entry of entries) {
      if (!entry.year || !entry.make || !entry.soldPrice || entry.soldPrice <= 0) continue;
      if (entry.vin && existingVins.has(entry.vin)) continue;

      entry.id = nextId++;
      existing.push(entry);
      if (entry.vin) existingVins.add(entry.vin);
      added++;
    }

    console.log(`  📥 ${path.basename(resolved)}: +${added} cars`);
    totalNew += added;
  }

  fs.writeFileSync(SCRAPED_PATH, JSON.stringify(existing, null, 2));
  console.log(`\n✅ Added ${totalNew} new cars. Total in scraped-cars.json: ${existing.length}`);
  console.log('   Run "npm run merge-data" to update the game dataset.');
}

main();
