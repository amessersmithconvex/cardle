/**
 * ============================================================
 *  Cardle - bid.cars Console Extractor  (v4.1 - DOM-based)
 * ============================================================
 *
 *  HOW TO USE:
 *  1. Go to bid.cars archived results in your browser
 *  2. Scroll down to load as many results as you want
 *  3. Press F12 → Console tab
 *  4. Paste this entire script and press Enter
 *  5. JSON file downloads automatically
 *
 *  v4 FIX: Uses DOM structure to match prices to the correct
 *  car card, instead of searching raw page text (which caused
 *  prices to bleed between neighboring listings).
 * ============================================================
 */
(function cardleV4() {
  'use strict';
  console.log('%c🚗 Cardle Extractor v4.1 (DOM-based)', 'font-size:18px;font-weight:bold;color:#f97316');

  // ---- STEP 1: Find all bid.cars image URLs from page HTML ----
  // Use the same loose regex from v3 that successfully found URLs,
  // then parse the filename with JS string splitting.
  const pageHtml = document.documentElement.innerHTML;
  const imgUrlRx = /https?:\/\/mercury\.bid\.cars\/([\d-]+)\/([\w-]+?)\.(?:jpg|jpeg|png|webp)/gi;

  const allImageUrls = [];
  let m;
  while ((m = imgUrlRx.exec(pageHtml)) !== null) {
    allImageUrls.push({ url: m[0], lotId: m[1], filename: m[2] });
  }

  console.log(`  Found ${allImageUrls.length} bid.cars image URLs in page`);

  // ---- STEP 2: Group images by VIN, parse car info from filenames ----
  const vinMap = new Map();

  for (const { url, lotId, filename } of allImageUrls) {
    const parts = filename.split('-');
    if (parts.length < 4) continue;

    const year = parseInt(parts[0], 10);
    if (year < 1900 || year > 2030) continue;

    // VIN is always 17 alphanumeric chars — find it by scanning parts backwards
    let vin = '';
    let vinPartIdx = -1;
    for (let i = parts.length - 2; i >= 1; i--) {
      if (/^[A-HJ-NPR-Z0-9]{17}$/i.test(parts[i])) {
        vin = parts[i].toUpperCase();
        vinPartIdx = i;
        break;
      }
    }
    if (!vin || vinPartIdx < 2) continue;

    const make = parts[1] || '';
    const model = parts.slice(2, vinPartIdx).join(' ') || '';

    if (!vinMap.has(vin)) {
      vinMap.set(vin, { lotId, year, make, model, vin, images: [] });
    }
    const entry = vinMap.get(vin);
    if (!entry.images.includes(url)) {
      entry.images.push(url);
    }
  }

  console.log(`  Identified ${vinMap.size} unique cars from image URLs`);

  if (vinMap.size === 0) {
    console.log('%c❌ No cars found. Make sure you are on a bid.cars results page with car images visible.', 'color:red;font-size:14px');
    console.log('  Try scrolling down to load some results first.');
    return;
  }

  // ---- STEP 3: Build a VIN→DOM-card map using image elements ----
  // Find <img> elements that contain each car's VIN, then walk up to card container
  const vinToCard = new Map();

  for (const [vin] of vinMap) {
    // Find any img element whose src contains this VIN
    const imgEl = document.querySelector(
      `img[src*="${vin}"], img[data-src*="${vin}"], img[data-lazy*="${vin}"]`
    );
    if (!imgEl) continue;

    // Walk up DOM to find the card container
    let el = imgEl.parentElement;
    let depth = 0;
    while (el && el !== document.body && depth < 20) {
      const text = el.innerText || '';
      if (text.length > 50 && text.length < 4000) {
        const hasMoney = /\$[\d,]+/.test(text);
        if (hasMoney) {
          // Check this isn't too big (containing many cars)
          const vinCount = Array.from(vinMap.keys()).filter(v => text.includes(v)).length;
          if (vinCount <= 2) {
            vinToCard.set(vin, el);
            break;
          }
        }
      }
      el = el.parentElement;
      depth++;
    }
  }

  console.log(`  DOM-matched ${vinToCard.size} cars to their card elements`);

  // ---- STEP 4: Extract data for each car ----
  const pageText = document.body.innerText || '';
  const cars = [];
  let domPriced = 0;
  let textPriced = 0;
  let noPriced = 0;

  for (const [vin, info] of vinMap) {
    const car = {
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

    let chunk = '';

    // PRIMARY: Get text from the DOM card (scoped to this car only)
    const cardEl = vinToCard.get(vin);
    if (cardEl) {
      chunk = cardEl.innerText || '';
    }

    // FALLBACK: Small text window around VIN (if no DOM card found)
    if (!chunk) {
      const vinIdx = pageText.indexOf(vin);
      if (vinIdx >= 0) {
        const start = Math.max(0, vinIdx - 250);
        const end = Math.min(pageText.length, vinIdx + 250);
        chunk = pageText.substring(start, end);
      }
    }

    if (chunk) {
      // Price: from DOM card, take last price (usually the sold/final bid).
      // From text fallback, take the price closest to the VIN.
      if (cardEl) {
        const prices = (chunk.match(/\$[\d,]+/g) || [])
          .map(p => parseInt(p.replace(/[$,]/g, ''), 10))
          .filter(p => p >= 100);
        if (prices.length === 1) {
          car.soldPrice = prices[0];
          domPriced++;
        } else if (prices.length > 1) {
          // On bid.cars cards, the final/sold price is typically the last one shown
          car.soldPrice = prices[prices.length - 1];
          domPriced++;
        }
      } else {
        // Text fallback: find the price closest to the VIN position
        const vinPos = chunk.indexOf(vin);
        const priceRx = /\$[\d,]+/g;
        let closest = null;
        let closestDist = Infinity;
        let pm;
        while ((pm = priceRx.exec(chunk)) !== null) {
          const val = parseInt(pm[0].replace(/[$,]/g, ''), 10);
          if (val < 100) continue;
          const dist = Math.abs(pm.index - (vinPos >= 0 ? vinPos : chunk.length / 2));
          if (dist < closestDist) {
            closestDist = dist;
            closest = val;
          }
        }
        if (closest) {
          car.soldPrice = closest;
          textPriced++;
        }
      }

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
      const mile = chunk.match(/(\d[\d,]*)\s*miles?/i);
      if (mile) car.mileage = parseInt(mile[1].replace(/,/g, ''), 10);
      if (!car.mileage) {
        const mileK = chunk.match(/(\d+)k\s*miles/i);
        if (mileK) car.mileage = parseInt(mileK[1], 10) * 1000;
      }

      // Key-value fields
      const kv = (label) => {
        const rx = new RegExp(label + ':?\\s*(.+?)(?:\\n|$)', 'i');
        const match = chunk.match(rx);
        return match ? match[1].trim() : '';
      };

      car.damage = kv('Damage');
      car.seller = kv('Seller');
      car.saleDocument = kv('Sale doc\\.?') || kv('Sale document');
      car.location = kv('Location');

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

    if (car.soldPrice > 0) {
      cars.push(car);
    } else {
      noPriced++;
    }
  }

  // Assign sequential IDs
  cars.forEach((c, i) => { c.id = i + 1; });

  console.log(`  Prices via DOM card: ${domPriced}`);
  console.log(`  Prices via text fallback: ${textPriced}`);
  console.log(`  No price found: ${noPriced}`);
  console.log(`  Total cars with prices: ${cars.length}`);

  // Sanity check: warn about duplicate prices
  const priceCount = {};
  cars.forEach(c => { priceCount[c.soldPrice] = (priceCount[c.soldPrice] || 0) + 1; });
  const dupeCount = Object.values(priceCount).filter(n => n >= 3).reduce((s, n) => s + n, 0);
  if (dupeCount > cars.length * 0.3) {
    console.log(`%c⚠ Warning: ${dupeCount} cars share a price with 3+ others. Prices may still be off.`, 'color:orange;font-weight:bold');
    console.log('  Try scrolling more slowly so each card fully renders.');
  } else {
    console.log(`  ✓ Price quality looks good (${dupeCount} duplicates out of ${cars.length})`);
  }

  // ---- STEP 5: Download ----
  if (cars.length === 0) {
    console.log('%c❌ Found cars but could not extract prices.', 'color:red');
    console.log('  Try scrolling so car listings are visible, then re-run.');
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
    console.log('     node scripts/import-scraped.js "<path-to-downloaded-file>.json"');
    console.log('  2. npm run merge-data');
    console.log('  3. npm run dev  (restart game)');
    console.log('  4. (optional) node scripts/download-images.js');
  }

})();
