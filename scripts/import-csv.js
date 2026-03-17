/**
 * Cardle - CSV Import Tool
 *
 * Imports car data from a CSV file into the game's JSON format.
 * Useful for importing data from spreadsheets or other scraped sources.
 *
 * CSV columns (flexible - uses best match):
 *   year, make, model, trim, vin, mileage, engine, transmission, drivetrain,
 *   exteriorColor, interiorColor, condition, damage, status, seller,
 *   saleDocument, location, price/soldPrice/finalBid, soldDate, auctionHouse,
 *   notes/mechanicalNotes
 *
 * Usage:
 *   node scripts/import-csv.js path/to/data.csv
 *   node scripts/import-csv.js path/to/data.csv --append   # add to existing scraped data
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = path.join(__dirname, '..', 'server', 'data', 'scraped-cars.json');

function parseCSV(text) {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) return [];

  const headers = parseCSVLine(lines[0]).map((h) => h.toLowerCase().trim());
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const row = {};
    headers.forEach((h, idx) => {
      row[h] = values[idx] || '';
    });
    rows.push(row);
  }

  return rows;
}

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

function findColumn(row, ...names) {
  for (const name of names) {
    for (const key of Object.keys(row)) {
      if (key.replace(/[_\s-]/g, '').toLowerCase() === name.replace(/[_\s-]/g, '').toLowerCase()) {
        return row[key];
      }
    }
  }
  return '';
}

function parsePrice(val) {
  if (!val) return 0;
  return parseInt(String(val).replace(/[$,\s]/g, ''), 10) || 0;
}

function parseMileage(val) {
  if (!val) return 0;
  const str = String(val).toLowerCase().replace(/[,\s]/g, '');
  if (str.includes('k')) return Math.round(parseFloat(str) * 1000);
  return parseInt(str, 10) || 0;
}

function rowToGameEntry(row, id) {
  const year = parseInt(findColumn(row, 'year', 'modelyear', 'yr'), 10) || 0;
  const make = findColumn(row, 'make', 'manufacturer', 'brand');
  const model = findColumn(row, 'model', 'modelname');
  const trim = findColumn(row, 'trim', 'trimlevel', 'variant', 'submodel');
  const vin = findColumn(row, 'vin', 'vehicleid');
  const mileage = parseMileage(findColumn(row, 'mileage', 'miles', 'milage', 'odometer'));
  const engine = findColumn(row, 'engine', 'enginesize', 'displacement', 'motor');
  const transmission = findColumn(row, 'transmission', 'trans', 'gearbox');
  const drivetrain = findColumn(row, 'drivetrain', 'drive', 'drivetype');
  const exteriorColor = findColumn(row, 'exteriorcolor', 'extcolor', 'color', 'bodycolor');
  const interiorColor = findColumn(row, 'interiorcolor', 'intcolor');
  const condition = findColumn(row, 'condition', 'status', 'vehiclestatus');
  const damage = findColumn(row, 'damage', 'damagetype', 'primarydamage', 'damagedescription');
  const seller = findColumn(row, 'seller', 'sellername', 'insurance');
  const saleDocument = findColumn(row, 'saledocument', 'saledoc', 'title', 'titletype', 'titledoc');
  const location = findColumn(row, 'location', 'city', 'yardlocation', 'lot_location');
  const soldPrice = parsePrice(findColumn(row, 'soldprice', 'price', 'finalbid', 'finalprice', 'bid', 'saleprice', 'amount'));
  const soldDate = findColumn(row, 'solddate', 'saledate', 'auctiondate', 'date', 'enddate');
  const auctionHouse = findColumn(row, 'auctionhouse', 'auction', 'source', 'platform');
  const notes = findColumn(row, 'notes', 'mechanicalnotes', 'description', 'comments');

  const highlights = [];
  if (drivetrain) highlights.push(drivetrain);
  if (condition) highlights.push(condition);
  if (damage) highlights.push(damage);
  if (auctionHouse) highlights.push(auctionHouse);

  let mechanicalNotes = notes;
  if (!mechanicalNotes) {
    const parts = [];
    if (damage) parts.push(`Damage: ${damage}.`);
    if (condition) parts.push(`Status: ${condition}.`);
    if (seller) parts.push(`Seller: ${seller}.`);
    mechanicalNotes = parts.join(' ');
  }

  return {
    id,
    year,
    make,
    model,
    trim,
    vin,
    mileage,
    exteriorColor,
    interiorColor,
    engine,
    transmission,
    drivetrain,
    condition: condition || 'Unknown',
    damage: damage || 'None reported',
    seller,
    saleDocument,
    location,
    mechanicalNotes,
    highlights,
    soldPrice,
    soldDate,
    auctionHouse,
    auctionSource: auctionHouse || 'CSV Import',
  };
}

function main() {
  const csvPath = process.argv[2];
  const append = process.argv.includes('--append');

  if (!csvPath) {
    console.log('Usage: node scripts/import-csv.js <path-to-csv> [--append]');
    process.exit(1);
  }

  if (!fs.existsSync(csvPath)) {
    console.error(`File not found: ${csvPath}`);
    process.exit(1);
  }

  console.log(`📥 Importing from ${csvPath}\n`);

  const text = fs.readFileSync(csvPath, 'utf-8');
  const rows = parseCSV(text);
  console.log(`   Parsed ${rows.length} rows from CSV`);

  let existing = [];
  let nextId = 1;
  if (append && fs.existsSync(OUTPUT_PATH)) {
    existing = JSON.parse(fs.readFileSync(OUTPUT_PATH, 'utf-8'));
    nextId = existing.length > 0 ? Math.max(...existing.map((c) => c.id)) + 1 : 1;
    console.log(`   Appending to ${existing.length} existing entries`);
  }

  const entries = [];
  let skipped = 0;
  for (const row of rows) {
    const entry = rowToGameEntry(row, nextId);
    if (entry.year > 1900 && entry.make && entry.model && entry.soldPrice > 0) {
      entries.push(entry);
      nextId++;
    } else {
      skipped++;
    }
  }

  const allData = [...existing, ...entries];
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(allData, null, 2));

  console.log(`\n✅ Imported ${entries.length} valid entries (${skipped} skipped)`);
  console.log(`   Total in scraped-cars.json: ${allData.length}`);
  console.log(`\n   Run 'npm run merge-data' to update the game dataset.`);
}

main();
