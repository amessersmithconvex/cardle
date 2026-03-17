/**
 * ============================================================
 *  Cardle - bid.cars Console Extractor  (v3 - image-URL based)
 * ============================================================
 *
 *  HOW TO USE:
 *  1. Go to bid.cars archived results in your browser
 *  2. Scroll down to load as many results as you want
 *  3. Press F12 → Console tab
 *  4. Paste this entire script and press Enter
 *  5. JSON file downloads automatically
 *
 * ============================================================
 */
(function cardleV3() {
  'use strict';
  console.log('%c🚗 Cardle Extractor v3', 'font-size:18px;font-weight:bold;color:#f97316');

  // ---- STEP 1: Collect all bid.cars image URLs ----
  // Image URLs encode: lot-id, year, make, model, VIN
  // Pattern: https://mercury.bid.cars/{lotId}/{year}-{make}-{model}-{vin}-{n}.jpg

  const imgUrlRx = /https?:\/\/mercury\.bid\.cars\/([\d-]+)\/([\w-]+?)\.(?:jpg|jpeg|png|webp)/gi;
  const pageHtml = document.documentElement.innerHTML;

  const allImageUrls = [];
  let m;
  while ((m = imgUrlRx.exec(pageHtml)) !== null) {
    allImageUrls.push(m[0]);
  }

  console.log(`  Found ${allImageUrls.length} bid.cars image URLs`);

  // ---- STEP 2: Group images by lot ID and parse car info ----

  const lotMap = new Map(); // lotId -> { images, year, make, model, vin }

  for (const url of allImageUrls) {
    const parsed = url.match(
      /mercury\.bid\.cars\/([\d]+-[\d]+)\/((\d{4})-([\w-]+?)-([\w-]+?)-(\d+))\.(?:jpg|jpeg|png|webp)/i
    );
    if (!parsed) continue;

    const lotId = parsed[1];
    const year = parseInt(parsed[3], 10);
    // The filename is: YEAR-MAKE-MODEL-VIN-NUM
    // But make/model can have hyphens. VIN is always 17 chars at the end before -NUM
    const filename = parsed[2]; // e.g. "2024-Audi-S5-WAUC4CF5XRA025224-1"
    const parts = filename.split('-');

    // Last part is image number, second to last 17 chars is VIN
    // Work backwards to find VIN
    let vin = '';
    let vinPartIdx = -1;
    for (let i = parts.length - 2; i >= 0; i--) {
      if (/^[A-HJ-NPR-Z0-9]{17}$/i.test(parts[i])) {
        vin = parts[i].toUpperCase();
        vinPartIdx = i;
        break;
      }
    }

    if (!vin || vinPartIdx < 2) continue;

    // parts[0] = year, parts[1..vinPartIdx-1] = make+model
    const makeModelParts = parts.slice(1, vinPartIdx);
    const make = makeModelParts[0] || '';
    const model = makeModelParts.slice(1).join(' ') || '';

    if (!lotMap.has(lotId)) {
      lotMap.set(lotId, { lotId, year, make, model, vin, images: [] });
    }
    lotMap.get(lotId).images.push(url);
  }

  console.log(`  Identified ${lotMap.size} unique cars from images`);

  if (lotMap.size === 0) {
    console.log('%c❌ No cars found. Are you on a bid.cars results page with car images?', 'color:red;font-size:14px');
    return;
  }

  // ---- STEP 3: Get page text and match each car to its details ----

  const pageText = document.body.innerText || '';

  const cars = [];
  let id = 1;

  for (const [lotId, info] of lotMap) {
    const car = {
      id: id++,
      year: info.year,
      make: info.make.replace(/-/g, ' '),
      model: info.model.replace(/-/g, ' '),
      trim: '',
      vin: info.vin,
      mileage: 0,
      exteriorColor: '',
      interiorColor: '',
      engine: '',
      transmission: '',
      drivetrain: '',
      condition: 'Unknown',
      damage: '',
      seller: '',
      saleDocument: '',
      location: '',
      mechanicalNotes: '',
      highlights: [],
      soldPrice: 0,
      soldDate: '',
      auctionHouse: '',
      auctionSource: 'bid.cars',
      images: info.images.sort(),
      sourceUrl: '',
    };

    // Find this car's text section by searching for its VIN in the page text
    const vinIdx = pageText.indexOf(info.vin);
    if (vinIdx >= 0) {
      // Grab ~1500 chars around the VIN (the card's text)
      const start = Math.max(0, vinIdx - 600);
      const end = Math.min(pageText.length, vinIdx + 900);
      const chunk = pageText.substring(start, end);

      // Price
      const prices = (chunk.match(/\$[\d,]+/g) || [])
        .map(p => parseInt(p.replace(/[$,]/g, ''), 10))
        .filter(p => p > 0);
      if (prices.length) car.soldPrice = Math.max(...prices);

      // Auction house
      if (/\bIAAI\b/.test(chunk)) car.auctionHouse = 'IAAI';
      else if (/\bCopart\b/.test(chunk)) car.auctionHouse = 'Copart';

      // Drivetrain
      if (/\bAWD\b/.test(chunk)) car.drivetrain = 'AWD';
      else if (/\bFWD\b/.test(chunk)) car.drivetrain = 'FWD';
      else if (/\bRWD\b/.test(chunk)) car.drivetrain = 'RWD';
      else if (/\b4WD\b/.test(chunk)) car.drivetrain = '4WD';

      // Engine
      const eng = [];
      const disp = chunk.match(/(\d+\.\d+)\s*L/i);  if (disp) eng.push(disp[0]);
      const cyl = chunk.match(/(\d+)\s*cyl\.?/i);    if (cyl) eng.push(cyl[0]);
      const hp = chunk.match(/(\d{2,4})\s*HP/i);     if (hp) eng.push(hp[0]);
      if (eng.length) car.engine = eng.join(' ');

      // Mileage
      const mile = chunk.match(/(\d[\d,]*)\s*miles/i);
      if (mile) car.mileage = parseInt(mile[1].replace(/,/g, ''), 10);
      if (!car.mileage) {
        const mileK = chunk.match(/(\d+)k\s*miles/i);
        if (mileK) car.mileage = parseInt(mileK[1], 10) * 1000;
      }

      // Key-value fields
      const kv = (label, text) => {
        const rx = new RegExp(label + ':?\\s*(.+?)(?:\\n|$)', 'i');
        const match = text.match(rx);
        return match ? match[1].trim() : '';
      };

      car.damage = kv('Damage', chunk);
      car.seller = kv('Seller', chunk);
      car.saleDocument = kv('Sale doc\\.?', chunk) || kv('Sale document', chunk);
      car.location = kv('Location', chunk);

      // Damage fallback
      if (!car.damage) {
        const dmg = chunk.match(/Collision\s*\|?\s*[\w\s]*/i) ||
          chunk.match(/(Flood|Fire|Vandalism|Theft|Hail|Mechanical|Water|Rollover|All Over)/i);
        if (dmg) car.damage = dmg[0].trim();
      }

      // Status
      const statuses = ['Run and Drive', 'Does Not Run', 'Starts', 'Stationary', 'Enhanced'];
      for (const s of statuses) {
        if (chunk.includes(s)) { car.condition = s; break; }
      }

      // Date
      const dateM = chunk.match(
        /(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\w*[\s,]+(\d{1,2}\s+\w+,?\s+\d{4})/i
      ) || chunk.match(/(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*,?\s+\d{4})/i);
      if (dateM) {
        try {
          const d = new Date(dateM[1] || dateM[0]);
          if (!isNaN(d.getTime())) car.soldDate = d.toISOString().split('T')[0];
        } catch { /* skip */ }
      }

      // Trim from first line containing the year
      const lines = chunk.split('\n');
      for (const line of lines) {
        if (line.includes(String(info.year)) && line.includes(info.make.replace(/-/g, ' '))) {
          const afterModel = line.split(info.model.replace(/-/g, ' '))[1];
          if (afterModel) {
            const trim = afterModel.replace(/[•·]/g, ',').split(',')[0].trim()
              .replace(info.vin, '').replace(/0-\d{7,}/, '').trim();
            if (trim.length > 1 && trim.length < 40) car.trim = trim;
          }
          break;
        }
      }
    }

    // Build highlights & notes
    if (car.drivetrain) car.highlights.push(car.drivetrain);
    if (car.condition && car.condition !== 'Unknown') car.highlights.push(car.condition);
    if (car.damage) car.highlights.push(car.damage);
    if (car.auctionHouse) car.highlights.push(car.auctionHouse);

    let notes = '';
    if (car.damage) notes += 'Damage: ' + car.damage + '. ';
    if (car.condition !== 'Unknown') notes += 'Status: ' + car.condition + '. ';
    if (car.seller) notes += 'Seller: ' + car.seller + '. ';
    if (car.saleDocument) notes += 'Sale Doc: ' + car.saleDocument + '. ';
    car.mechanicalNotes = notes.trim();
    car.auctionSource = car.auctionHouse ? car.auctionHouse + ' via bid.cars' : 'bid.cars';

    // Only include cars with a valid price
    if (car.soldPrice > 0) {
      cars.push(car);
    }
  }

  console.log(`  Parsed ${cars.length} cars with valid prices (out of ${lotMap.size} total)`);

  // ---- STEP 4: Also include cars without price (mark them) ----
  const carsNoPrice = [];
  for (const [lotId, info] of lotMap) {
    const already = cars.find(c => c.vin === info.vin);
    if (!already) {
      carsNoPrice.push({
        year: info.year, make: info.make, model: info.model,
        vin: info.vin, images: info.images, note: 'price not found on page',
      });
    }
  }

  if (carsNoPrice.length > 0) {
    console.log(`  ${carsNoPrice.length} cars had no price (might need individual page scraping)`);
  }

  // ---- STEP 5: Download ----
  if (cars.length === 0) {
    console.log('%c❌ Found car images but no prices. The page might show prices differently.', 'color:red');
    console.log('  Try clicking into a few car pages, or try a different filter.');
    // Still download what we have for debugging
    if (lotMap.size > 0) {
      const debugData = Array.from(lotMap.values()).map((info, i) => ({
        id: i + 1, year: info.year, make: info.make.replace(/-/g, ' '),
        model: info.model.replace(/-/g, ' '), vin: info.vin,
        images: info.images.sort(), soldPrice: 0,
      }));
      downloadJson(debugData, 'debug');
    }
    return;
  }

  downloadJson(cars, cars.length + 'cars');

  function downloadJson(data, suffix) {
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'cardle-bidcars-' + new Date().toISOString().split('T')[0] + '-' + suffix + '.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    console.log(`%c✅ Downloaded ${data.length} cars!`, 'font-size:16px;font-weight:bold;color:#22c55e');
    console.log(`  With images: ${data.filter(c => c.images?.length > 0).length} cars`);
    console.log('%cNext steps:', 'color:#fbbf24;font-weight:bold');
    console.log('  1. Run in your project terminal:');
    console.log('     node scripts/import-scraped.js "C:\\Users\\Messersmith\\Downloads\\<filename>.json"');
    console.log('  2. npm run merge-data');
    console.log('  3. npm run dev  (restart game)');
    console.log('  4. (optional) node scripts/download-images.js   ← saves images locally');

    try { navigator.clipboard.writeText(json); } catch {}
  }

})();
