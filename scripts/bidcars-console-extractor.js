/**
 * ============================================================
 *  Cardle - bid.cars Console Extractor  (v4 - DOM-based)
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
  console.log('%c🚗 Cardle Extractor v4 (DOM-based)', 'font-size:18px;font-weight:bold;color:#f97316');

  // ---- STEP 1: Find all car image elements in the DOM ----
  const imgElements = document.querySelectorAll('img[src*="mercury.bid.cars"]');
  console.log(`  Found ${imgElements.length} bid.cars image elements`);

  // ---- STEP 2: Group images by VIN, tracking their DOM containers ----
  const vinMap = new Map();

  for (const img of imgElements) {
    const src = img.src || img.getAttribute('data-src') || '';
    const parsed = src.match(
      /mercury\.bid\.cars\/([\d]+-[\d]+)\/((\d{4})-([\w-]+?)-([\w-]+?)-(\w{17}))-(\d+)\.(?:jpg|jpeg|png|webp)/i
    );
    if (!parsed) continue;

    const lotId = parsed[1];
    const year = parseInt(parsed[3], 10);
    const filename = parsed[2];
    const vin = parsed[6].toUpperCase();
    const parts = filename.split('-');

    let vinPartIdx = -1;
    for (let i = parts.length - 2; i >= 0; i--) {
      if (/^[A-HJ-NPR-Z0-9]{17}$/i.test(parts[i])) {
        vinPartIdx = i;
        break;
      }
    }
    if (vinPartIdx < 2) continue;

    const makeModelParts = parts.slice(1, vinPartIdx);
    const make = makeModelParts[0] || '';
    const model = makeModelParts.slice(1).join(' ') || '';

    if (!vinMap.has(vin)) {
      vinMap.set(vin, { lotId, year, make, model, vin, images: [], imgElements: [] });
    }
    const entry = vinMap.get(vin);
    if (!entry.images.includes(src)) {
      entry.images.push(src);
    }
    entry.imgElements.push(img);
  }

  // Also scan HTML source for images not rendered as <img> (background-image, lazy-load, etc.)
  const pageHtml = document.documentElement.innerHTML;
  const imgUrlRx = /https?:\/\/mercury\.bid\.cars\/([\d]+-[\d]+)\/((\d{4})-([\w-]+?)-([\w-]+?)-(\w{17}))-(\d+)\.(?:jpg|jpeg|png|webp)/gi;
  let m;
  while ((m = imgUrlRx.exec(pageHtml)) !== null) {
    const url = m[0];
    const vin = m[6].toUpperCase();
    const year = parseInt(m[3], 10);
    const filename = m[2];
    const parts = filename.split('-');
    let vinPartIdx = -1;
    for (let i = parts.length - 2; i >= 0; i--) {
      if (/^[A-HJ-NPR-Z0-9]{17}$/i.test(parts[i])) { vinPartIdx = i; break; }
    }
    if (vinPartIdx < 2) continue;
    const makeModelParts = parts.slice(1, vinPartIdx);

    if (!vinMap.has(vin)) {
      vinMap.set(vin, {
        lotId: m[1], year, make: makeModelParts[0] || '',
        model: makeModelParts.slice(1).join(' ') || '',
        vin, images: [], imgElements: [],
      });
    }
    const entry = vinMap.get(vin);
    if (!entry.images.includes(url)) entry.images.push(url);
  }

  console.log(`  Identified ${vinMap.size} unique cars`);
  if (vinMap.size === 0) {
    console.log('%c❌ No cars found. Are you on a bid.cars results page?', 'color:red;font-size:14px');
    return;
  }

  // ---- STEP 3: For each car, find its DOM card and extract price ----

  function findCardContainer(imgEl) {
    let el = imgEl.parentElement;
    let depth = 0;
    while (el && el !== document.body && depth < 15) {
      const text = el.innerText || '';
      const hasMoney = /\$[\d,]+/.test(text);
      if (hasMoney && text.length < 3000) {
        const priceMatches = text.match(/\$[\d,]+/g) || [];
        const prices = priceMatches.map(p => parseInt(p.replace(/[$,]/g, ''), 10)).filter(p => p > 100);
        if (prices.length >= 1 && prices.length <= 5) {
          return el;
        }
      }
      el = el.parentElement;
      depth++;
    }
    return null;
  }

  function extractFromCard(cardEl) {
    const text = cardEl.innerText || '';
    const data = {};

    const prices = (text.match(/\$[\d,]+/g) || [])
      .map(p => parseInt(p.replace(/[$,]/g, ''), 10))
      .filter(p => p > 100);

    if (prices.length === 1) {
      data.soldPrice = prices[0];
    } else if (prices.length > 1) {
      data.soldPrice = prices[prices.length - 1];
    }

    if (/\bIAAI\b/.test(text)) data.auctionHouse = 'IAAI';
    else if (/\bCopart\b/.test(text)) data.auctionHouse = 'Copart';

    if (/\bAWD\b/.test(text)) data.drivetrain = 'AWD';
    else if (/\bFWD\b/.test(text)) data.drivetrain = 'FWD';
    else if (/\bRWD\b/.test(text)) data.drivetrain = 'RWD';
    else if (/\b4WD\b/.test(text)) data.drivetrain = '4WD';

    const eng = [];
    const disp = text.match(/(\d+\.\d+)\s*L/i);  if (disp) eng.push(disp[0]);
    const cyl = text.match(/(\d+)\s*cyl\.?/i);    if (cyl) eng.push(cyl[0]);
    const hp = text.match(/(\d{2,4})\s*HP/i);     if (hp) eng.push(hp[0]);
    if (eng.length) data.engine = eng.join(' ');

    const mile = text.match(/(\d[\d,]*)\s*miles?/i);
    if (mile) data.mileage = parseInt(mile[1].replace(/,/g, ''), 10);

    const kv = (label) => {
      const rx = new RegExp(label + ':?\\s*(.+?)(?:\\n|$)', 'i');
      const match = text.match(rx);
      return match ? match[1].trim() : '';
    };

    data.damage = kv('Damage');
    data.seller = kv('Seller');
    data.saleDocument = kv('Sale doc\\.?') || kv('Sale document');
    data.location = kv('Location');

    if (!data.damage) {
      const dmg = text.match(/Collision\s*\|?\s*[\w\s]*/i) ||
        text.match(/(Flood|Fire|Vandalism|Theft|Hail|Mechanical|Water|Rollover|All Over)/i);
      if (dmg) data.damage = dmg[0].trim();
    }

    const statuses = ['Run and Drive', 'Does Not Run', 'Starts', 'Stationary', 'Enhanced'];
    for (const s of statuses) {
      if (text.includes(s)) { data.condition = s; break; }
    }

    const dateM = text.match(
      /(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\w*[\s,]+(\d{1,2}\s+\w+,?\s+\d{4})/i
    ) || text.match(/(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*,?\s+\d{4})/i);
    if (dateM) {
      try {
        const d = new Date(dateM[1] || dateM[0]);
        if (!isNaN(d.getTime())) data.soldDate = d.toISOString().split('T')[0];
      } catch { /* skip */ }
    }

    return data;
  }

  // ---- STEP 4: Build car objects ----
  const cars = [];
  let domMatched = 0;
  let textFallback = 0;
  let noPrice = 0;

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

    let extracted = null;

    // Primary: DOM-based extraction via image element's parent card
    if (info.imgElements.length > 0) {
      for (const imgEl of info.imgElements) {
        const card = findCardContainer(imgEl);
        if (card) {
          extracted = extractFromCard(card);
          if (extracted.soldPrice) {
            domMatched++;
            break;
          }
        }
      }
    }

    // Fallback: search page text, but use SMALL window and take CLOSEST price (not max)
    if (!extracted || !extracted.soldPrice) {
      const pageText = document.body.innerText || '';
      const vinIdx = pageText.indexOf(info.vin);
      if (vinIdx >= 0) {
        const start = Math.max(0, vinIdx - 300);
        const end = Math.min(pageText.length, vinIdx + 300);
        const chunk = pageText.substring(start, end);

        const priceRx = /\$[\d,]+/g;
        let closest = null;
        let closestDist = Infinity;
        let pm;
        while ((pm = priceRx.exec(chunk)) !== null) {
          const val = parseInt(pm[0].replace(/[$,]/g, ''), 10);
          if (val < 100) continue;
          const dist = Math.abs(pm.index - (vinIdx - start));
          if (dist < closestDist) {
            closestDist = dist;
            closest = val;
          }
        }

        if (!extracted) extracted = {};
        if (closest) {
          extracted.soldPrice = closest;
          textFallback++;
        }
      }
    }

    if (extracted) {
      Object.assign(car, {
        soldPrice: extracted.soldPrice || 0,
        auctionHouse: extracted.auctionHouse || '',
        drivetrain: extracted.drivetrain || '',
        engine: extracted.engine || '',
        mileage: extracted.mileage || 0,
        damage: extracted.damage || '',
        seller: extracted.seller || '',
        saleDocument: extracted.saleDocument || '',
        location: extracted.location || '',
        condition: extracted.condition || 'Unknown',
        soldDate: extracted.soldDate || '',
      });
    }

    // Build highlights
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
      noPrice++;
    }
  }

  // Assign sequential IDs
  cars.forEach((c, i) => { c.id = i + 1; });

  console.log(`  DOM-matched prices: ${domMatched}`);
  console.log(`  Text-fallback prices: ${textFallback}`);
  console.log(`  No price found: ${noPrice}`);
  console.log(`  Total cars with prices: ${cars.length}`);

  // Sanity check: warn about duplicate prices
  const priceCount = {};
  cars.forEach(c => { priceCount[c.soldPrice] = (priceCount[c.soldPrice] || 0) + 1; });
  const dupeCount = Object.values(priceCount).filter(n => n >= 3).reduce((s, n) => s + n, 0);
  if (dupeCount > cars.length * 0.3) {
    console.log(`%c⚠ Warning: ${dupeCount} cars share prices with 3+ others. Prices may still be inaccurate.`, 'color:orange;font-weight:bold');
    console.log('  Try scrolling slower so each car card fully renders before loading more.');
  }

  // ---- STEP 5: Download ----
  if (cars.length === 0) {
    console.log('%c❌ Found cars but no prices. The page might need to fully render.', 'color:red');
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
