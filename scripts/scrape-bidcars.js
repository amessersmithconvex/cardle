/**
 * Cardle - bid.cars Archived Auction Scraper
 *
 * Scrapes vehicle data from bid.cars archived auctions.
 * Uses Playwright with a visible browser so you can handle CAPTCHAs
 * or cookie banners manually if they appear.
 *
 * Usage:
 *   npx playwright install chromium   (first time only)
 *   node scripts/scrape-bidcars.js [pages] [startPage]
 *
 * Examples:
 *   node scripts/scrape-bidcars.js 100        # scrape 100 pages (~2000 cars)
 *   node scripts/scrape-bidcars.js 50 10      # scrape pages 10-59
 */

import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = path.join(__dirname, '..', 'server', 'data', 'scraped-cars.json');
const MERGED_PATH = path.join(__dirname, '..', 'server', 'data', 'cars.json');

const BASE_URL = 'https://bid.cars/en/search/archived/results';
const SEARCH_PARAMS = 'search-type=filters&status=All&type=Automobile&make=All&model=All&year-from=1900&year-to=2027&auction-type=All';

const DELAY_BETWEEN_PAGES = 2000 + Math.random() * 2000;

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parsePrice(text) {
  if (!text) return 0;
  const match = text.replace(/[^0-9.]/g, '');
  return parseInt(match, 10) || 0;
}

function parseMileage(text) {
  if (!text) return 0;
  const cleaned = text.toLowerCase().replace(/[^0-9k.]/g, '');
  if (cleaned.includes('k')) {
    return Math.round(parseFloat(cleaned.replace('k', '')) * 1000);
  }
  return parseInt(cleaned, 10) || 0;
}

async function scrapeCurrentPage(page) {
  await page.waitForTimeout(1500);

  const cars = await page.evaluate(() => {
    const results = [];

    // bid.cars uses card elements for each vehicle
    // Try multiple common selector patterns
    const cards = document.querySelectorAll(
      '.vehicle-card, .lot-item, .search-result-item, ' +
      '[class*="vehicle"], [class*="lot-card"], [class*="search-item"], ' +
      'article, .card, [data-lot-id]'
    );

    if (cards.length === 0) {
      // Fallback: try to find any repeating element structure
      const allLinks = document.querySelectorAll('a[href*="/lot/"], a[href*="/vehicle/"]');
      const processed = new Set();

      allLinks.forEach((link) => {
        const card = link.closest('div[class]') || link.parentElement;
        if (!card || processed.has(card)) return;
        processed.add(card);

        const text = card.innerText || '';
        const entry = { rawText: text, url: link.href };
        results.push(entry);
      });

      return results;
    }

    cards.forEach((card) => {
      const text = card.innerText || '';
      const links = card.querySelectorAll('a');
      const url = Array.from(links).find((a) => a.href && (a.href.includes('/lot/') || a.href.includes('/vehicle/')));

      results.push({
        rawText: text,
        url: url ? url.href : '',
      });
    });

    return results;
  });

  return cars;
}

function parseCardText(rawText, url) {
  const lines = rawText.split('\n').map((l) => l.trim()).filter(Boolean);

  let entry = {
    rawText,
    url: url || '',
    year: 0,
    make: '',
    model: '',
    trim: '',
    vin: '',
    auctionHouse: '',
    drivetrain: '',
    engine: '',
    horsepower: '',
    cylinders: '',
    mileage: 0,
    seller: '',
    saleDocument: '',
    location: '',
    damage: '',
    status: '',
    soldPrice: 0,
    soldDate: '',
  };

  const fullText = rawText;

  // Extract VIN (17 alphanumeric characters)
  const vinMatch = fullText.match(/\b([A-HJ-NPR-Z0-9]{17})\b/i);
  if (vinMatch) entry.vin = vinMatch[1].toUpperCase();

  // Extract lot ID
  const lotMatch = fullText.match(/0-(\d{8})/);
  if (lotMatch) entry.lotId = lotMatch[0];

  // Extract auction house (IAAI / Copart)
  if (/IAAI/i.test(fullText)) entry.auctionHouse = 'IAAI';
  else if (/Copart/i.test(fullText)) entry.auctionHouse = 'Copart';

  // Extract final bid / price
  const priceMatch = fullText.match(/\$[\d,]+/g);
  if (priceMatch) {
    const prices = priceMatch.map((p) => parsePrice(p)).filter((p) => p > 0);
    if (prices.length > 0) entry.soldPrice = Math.max(...prices);
  }

  // Extract date
  const dateMatch = fullText.match(/(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+\d{1,2}\s+\w+,?\s+\d{4}/i);
  if (dateMatch) {
    try {
      const d = new Date(dateMatch[0].replace(/,/g, ''));
      if (!isNaN(d)) entry.soldDate = d.toISOString().split('T')[0];
    } catch { /* ignore parse errors */ }
  }

  // Extract drivetrain
  if (/\bAWD\b/i.test(fullText)) entry.drivetrain = 'AWD';
  else if (/\b4WD\b|4x4/i.test(fullText)) entry.drivetrain = '4WD';
  else if (/\bFWD\b/i.test(fullText)) entry.drivetrain = 'FWD';
  else if (/\bRWD\b/i.test(fullText)) entry.drivetrain = 'RWD';

  // Extract engine displacement
  const engineMatch = fullText.match(/(\d+\.\d+)\s*L/i);
  if (engineMatch) entry.engine = `${engineMatch[1]}L`;

  // Extract cylinders
  const cylMatch = fullText.match(/(\d+)\s*cyl/i);
  if (cylMatch) entry.cylinders = `${cylMatch[1]} cyl`;

  // Extract horsepower
  const hpMatch = fullText.match(/(\d+)\s*HP/i);
  if (hpMatch) entry.horsepower = `${hpMatch[1]}HP`;

  // Combine engine string
  if (entry.engine || entry.cylinders || entry.horsepower) {
    entry.engine = [entry.engine, entry.cylinders, entry.horsepower].filter(Boolean).join(' ');
  }

  // Extract mileage
  const mileMatch = fullText.match(/(\d+k?)\s*miles?\s*\((\d+k?)\s*km\)/i) ||
                     fullText.match(/Milage:?\s*(\d+k?)\s*miles/i) ||
                     fullText.match(/(\d+[,.]?\d*k?)\s*miles/i);
  if (mileMatch) entry.mileage = parseMileage(mileMatch[1]);

  // Extract damage
  const damageMatch = fullText.match(/Damage:?\s*(.+?)(?:\n|$)/i);
  if (damageMatch) entry.damage = damageMatch[1].trim();
  else {
    const dmgPatterns = [
      /Collision\s*\|\s*[\w\s]+/i,
      /Flood/i, /Fire/i, /Vandalism/i,
      /Theft/i, /Hail/i, /Mechanical/i,
    ];
    for (const pattern of dmgPatterns) {
      const m = fullText.match(pattern);
      if (m) { entry.damage = m[0].trim(); break; }
    }
  }

  // Extract status
  const statusPatterns = ['Run and Drive', 'Does Not Run', 'Starts', 'Enhanced Vehicles', 'Stationary'];
  for (const s of statusPatterns) {
    if (fullText.includes(s)) { entry.status = s; break; }
  }

  // Extract seller
  const sellerMatch = fullText.match(/Seller:?\s*(.+?)(?:\n|$)/i);
  if (sellerMatch) entry.seller = sellerMatch[1].trim();

  // Extract sale document
  const saleDocMatch = fullText.match(/Sale doc\.?:?\s*(.+?)(?:\n|$)/i);
  if (saleDocMatch) entry.saleDocument = saleDocMatch[1].trim();

  // Extract location
  const locMatch = fullText.match(/Location:?\s*(.+?)(?:\n|$)/i);
  if (locMatch) entry.location = locMatch[1].trim();

  // Extract year, make, model from the first line (usually the title)
  const titleLine = lines[0] || '';
  const yearMakeModel = titleLine.match(/(\d{4})\s+(\w+(?:\s*-\s*\w+)?)\s+([\w\s]+?)(?:\s*[•·]|$)/);
  if (yearMakeModel) {
    entry.year = parseInt(yearMakeModel[1], 10);
    entry.make = yearMakeModel[2].trim();
    entry.model = yearMakeModel[3].trim();
  } else {
    // Simpler pattern
    const simpleMatch = titleLine.match(/(\d{4})\s+(\S+)\s+(.+)/);
    if (simpleMatch) {
      entry.year = parseInt(simpleMatch[1], 10);
      entry.make = simpleMatch[2].trim();
      const rest = simpleMatch[3].trim();
      const commaIdx = rest.indexOf(',');
      if (commaIdx > 0) {
        entry.model = rest.substring(0, commaIdx).trim();
        entry.trim = rest.substring(commaIdx + 1).trim();
      } else {
        entry.model = rest;
      }
    }
  }

  return entry;
}

function formatForGame(entry, id) {
  const engineStr = entry.engine || 'Unknown';
  const condition = entry.status || 'Unknown';
  const damage = entry.damage || 'None reported';

  let mechNotes = '';
  if (damage !== 'None reported') mechNotes += `Damage: ${damage}. `;
  if (condition) mechNotes += `Status: ${condition}. `;
  if (entry.seller) mechNotes += `Seller: ${entry.seller}. `;
  if (entry.saleDocument) mechNotes += `Sale Document: ${entry.saleDocument}. `;
  if (entry.auctionHouse) mechNotes += `Auction: ${entry.auctionHouse}.`;

  const highlights = [];
  if (entry.drivetrain) highlights.push(entry.drivetrain);
  if (entry.status) highlights.push(entry.status);
  if (entry.damage && entry.damage !== 'None reported') highlights.push(entry.damage);
  if (entry.auctionHouse) highlights.push(entry.auctionHouse);

  return {
    id,
    year: entry.year,
    make: entry.make,
    model: entry.model,
    trim: entry.trim || '',
    vin: entry.vin || '',
    mileage: entry.mileage || 0,
    exteriorColor: '',
    interiorColor: '',
    engine: engineStr,
    transmission: '',
    drivetrain: entry.drivetrain || '',
    condition,
    damage,
    seller: entry.seller || '',
    saleDocument: entry.saleDocument || '',
    location: entry.location || '',
    mechanicalNotes: mechNotes.trim(),
    highlights,
    soldPrice: entry.soldPrice,
    soldDate: entry.soldDate || '',
    auctionHouse: entry.auctionHouse || '',
    auctionSource: entry.auctionHouse ? `${entry.auctionHouse} via bid.cars` : 'bid.cars',
    sourceUrl: entry.url || '',
  };
}

async function main() {
  const totalPages = parseInt(process.argv[2], 10) || 10;
  const startPage = parseInt(process.argv[3], 10) || 1;

  console.log(`\n🚗 Cardle bid.cars Scraper`);
  console.log(`   Scraping pages ${startPage} to ${startPage + totalPages - 1}`);
  console.log(`   Output: ${OUTPUT_PATH}\n`);

  let existingData = [];
  if (fs.existsSync(OUTPUT_PATH)) {
    existingData = JSON.parse(fs.readFileSync(OUTPUT_PATH, 'utf-8'));
    console.log(`   Found ${existingData.length} existing entries\n`);
  }

  const existingVins = new Set(existingData.filter((c) => c.vin).map((c) => c.vin));
  let nextId = existingData.length > 0
    ? Math.max(...existingData.map((c) => c.id)) + 1
    : 1;

  const browser = await chromium.launch({
    headless: false,
    slowMo: 100,
  });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 900 },
  });
  const page = await context.newPage();

  let newCars = [];

  try {
    for (let p = startPage; p < startPage + totalPages; p++) {
      const url = `${BASE_URL}?${SEARCH_PARAMS}&page=${p}`;
      console.log(`📄 Page ${p}/${startPage + totalPages - 1}: ${url}`);

      try {
        await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
      } catch {
        console.log(`   ⚠ Page load timeout, waiting for manual interaction...`);
        await page.waitForTimeout(10000);
      }

      // Wait for content to appear
      await page.waitForTimeout(2000);

      // Check if we got a CAPTCHA or block page
      const bodyText = await page.evaluate(() => document.body.innerText.substring(0, 200));
      if (/captcha|verify|blocked|access denied/i.test(bodyText)) {
        console.log(`   🔒 CAPTCHA/block detected. Please solve it in the browser.`);
        console.log(`   Waiting 30 seconds for manual resolution...`);
        await page.waitForTimeout(30000);
      }

      const rawCards = await scrapeCurrentPage(page);
      console.log(`   Found ${rawCards.length} raw entries`);

      for (const raw of rawCards) {
        const parsed = parseCardText(raw.rawText, raw.url);

        if (!parsed.year || !parsed.make || parsed.soldPrice <= 0) continue;
        if (parsed.vin && existingVins.has(parsed.vin)) continue;

        const formatted = formatForGame(parsed, nextId++);
        newCars.push(formatted);

        if (parsed.vin) existingVins.add(parsed.vin);
      }

      console.log(`   ✅ ${newCars.length} total new cars so far\n`);

      // Save progress after each page
      const allData = [...existingData, ...newCars];
      fs.writeFileSync(OUTPUT_PATH, JSON.stringify(allData, null, 2));

      await sleep(DELAY_BETWEEN_PAGES);
    }
  } finally {
    await browser.close();
  }

  const finalData = [...existingData, ...newCars];
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(finalData, null, 2));

  // Filter for valid game entries (must have year, make, model, and price > 0)
  const validEntries = finalData.filter(
    (c) => c.year > 1900 && c.make && c.model && c.soldPrice > 0
  );

  console.log(`\n🏁 Scraping Complete!`);
  console.log(`   New cars scraped: ${newCars.length}`);
  console.log(`   Total in scraped-cars.json: ${finalData.length}`);
  console.log(`   Valid game entries: ${validEntries.length}`);
  console.log(`\n   Run 'node scripts/merge-data.js' to update the game dataset.`);
}

main().catch((err) => {
  console.error('Scraper error:', err);
  process.exit(1);
});
