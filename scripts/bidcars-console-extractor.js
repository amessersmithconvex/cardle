/**
 * ============================================================
 *  Cardle - bid.cars Console Extractor  (v5 - Final Bid match)
 * ============================================================
 *
 *  HOW TO USE:
 *  1. Go to bid.cars archived results in your browser
 *  2. Scroll down to load as many results as you want
 *  3. Press F12 → Console tab
 *  4. Paste this entire script and press Enter
 *  5. JSON file downloads automatically
 *
 *  v5 FIX: Specifically matches "Final bid: $X,XXX" text from
 *  each car listing instead of grabbing any dollar amount.
 * ============================================================
 */
(function cardleV5() {
  'use strict';
  console.log('%c🚗 Cardle Extractor v5 (Final Bid match)', 'font-size:18px;font-weight:bold;color:#f97316');

  const pageText = document.body.innerText || '';

  // ---- STEP 1: Find all VINs on the page ----
  // VINs are 17 chars, A-HJ-NPR-Z0-9 (no I, O, Q)
  const vinRx = /\b[A-HJ-NPR-Z0-9]{17}\b/g;
  const allVins = new Set();
  let vm;
  while ((vm = vinRx.exec(pageText)) !== null) {
    allVins.add(vm[0]);
  }
  console.log(`  Found ${allVins.size} unique VINs on page`);

  // ---- STEP 2: Find image URLs from page HTML ----
  const pageHtml = document.documentElement.innerHTML;
  const imgUrlRx = /https?:\/\/mercury\.bid\.cars\/([\d-]+)\/([\w-]+?)\.(?:jpg|jpeg|png|webp)/gi;
  const vinImages = new Map();

  let m;
  while ((m = imgUrlRx.exec(pageHtml)) !== null) {
    const url = m[0];
    const filename = m[2];
    const parts = filename.split('-');
    if (parts.length < 4) continue;

    for (let i = parts.length - 2; i >= 1; i--) {
      if (/^[A-HJ-NPR-Z0-9]{17}$/i.test(parts[i])) {
        const vin = parts[i].toUpperCase();
        if (!vinImages.has(vin)) vinImages.set(vin, []);
        const imgs = vinImages.get(vin);
        if (!imgs.includes(url)) imgs.push(url);
        break;
      }
    }
  }
  console.log(`  Found images for ${vinImages.size} cars`);

  // ---- STEP 3: Split page into car blocks and extract data ----
  // Each car block on bid.cars follows this pattern:
  //   [YEAR MAKE MODEL]
  //   VIN   LOT-NUMBER
  //   [auction house]
  //   [specs]
  //   - Status: ...
  //   - Damage: ...
  //   - Location: ...
  //   - Sale doc.: ...
  //   - Seller: ...
  //   - Milage: ...
  //   Final bid: $X,XXX  (or "Final bid: ---")

  const lines = pageText.split('\n');
  const cars = [];
  let id = 1;

  for (const vin of allVins) {
    // Find the line containing this VIN
    let vinLineIdx = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes(vin)) {
        vinLineIdx = i;
        break;
      }
    }
    if (vinLineIdx < 0) continue;

    // Lines AFTER the VIN — "Final bid" always appears below the VIN on bid.cars
    const afterVin = lines.slice(vinLineIdx, Math.min(lines.length, vinLineIdx + 20)).join('\n');
    // Lines BEFORE the VIN — for car title, make/model context
    const beforeVin = lines.slice(Math.max(0, vinLineIdx - 5), vinLineIdx + 1).join('\n');
    const block = beforeVin + '\n' + afterVin;

    // Extract "Final bid: $X,XXX" ONLY from lines after the VIN
    const bidMatch = afterVin.match(/Final\s+bid:?\s*\$\s*([\d,]+)/i);
    if (!bidMatch) continue;

    const soldPrice = parseInt(bidMatch[1].replace(/,/g, ''), 10);
    if (!soldPrice || soldPrice < 50) continue;

    // Parse year/make/model from image URL filename (most reliable source)
    let year = 0, make = '', model = '';
    const images = (vinImages.get(vin) || []).sort();

    if (images.length > 0) {
      const firstImg = images[0];
      const fMatch = firstImg.match(/mercury\.bid\.cars\/[\d-]+\/([\w-]+?)\./);
      if (fMatch) {
        const parts = fMatch[1].split('-');
        year = parseInt(parts[0], 10) || 0;
        let vinPartIdx = -1;
        for (let i = parts.length - 2; i >= 1; i--) {
          if (/^[A-HJ-NPR-Z0-9]{17}$/i.test(parts[i])) { vinPartIdx = i; break; }
        }
        if (vinPartIdx >= 2) {
          make = parts[1].replace(/-/g, ' ');
          model = parts.slice(2, vinPartIdx).join(' ').replace(/-/g, ' ');
        }
      }
    }

    // Fallback: parse year from lines above VIN
    if (!year) {
      for (let i = vinLineIdx; i >= Math.max(0, vinLineIdx - 3); i--) {
        const ym = lines[i].match(/\b(19|20)\d{2}\b/);
        if (ym) { year = parseInt(ym[0], 10); break; }
      }
    }
    if (!year) continue;

    // Extract other details from the block
    const kv = (label) => {
      const rx = new RegExp(label + ':?\\s*(.+?)(?:\\n|$)', 'i');
      const match = block.match(rx);
      return match ? match[1].trim() : '';
    };

    const damage = kv('Damage');
    const status = kv('Status');
    const location = kv('Location');
    const seller = kv('Seller');
    const saleDoc = kv('Sale doc');

    let mileage = 0;
    const mileM = block.match(/Milage:?\s*(\d[\d,]*)\s*k?\s*miles/i)
      || block.match(/(\d[\d,]*)\s*k?\s*miles/i);
    if (mileM) {
      const raw = mileM[1].replace(/,/g, '');
      mileage = raw.includes('k') ? parseInt(raw, 10) * 1000 : parseInt(raw, 10);
      if (mileage < 500) mileage *= 1000;
    }

    let auctionHouse = '';
    if (/\biaai\b/i.test(block)) auctionHouse = 'IAAI';
    else if (/\bcopart\b/i.test(block)) auctionHouse = 'Copart';

    let drivetrain = '';
    if (/\bAWD\b|All\s*wheel/i.test(block)) drivetrain = 'AWD';
    else if (/\bFWD\b|Front\s*wheel/i.test(block)) drivetrain = 'FWD';
    else if (/\bRWD\b|Rear\s*wheel/i.test(block)) drivetrain = 'RWD';
    else if (/\b4WD\b|Four\s*wheel/i.test(block)) drivetrain = '4WD';

    let engine = '';
    const engParts = [];
    const disp = block.match(/(\d+\.\d+)\s*L/i); if (disp) engParts.push(disp[0]);
    const cyl = block.match(/(\d+)\s*cyl\.?/i); if (cyl) engParts.push(cyl[0]);
    const hp = block.match(/(\d{2,4})\s*HP/i); if (hp) engParts.push(hp[0]);
    if (engParts.length) engine = engParts.join(' ');

    const highlights = [];
    if (drivetrain) highlights.push(drivetrain);
    if (status && status !== 'Unknown' && status !== 'No information') highlights.push(status);
    if (damage) highlights.push(damage);
    if (auctionHouse) highlights.push(auctionHouse);

    let notes = '';
    if (damage) notes += 'Damage: ' + damage + '. ';
    if (status && status !== 'No information') notes += 'Status: ' + status + '. ';
    if (seller) notes += 'Seller: ' + seller + '. ';
    if (saleDoc) notes += 'Sale Doc: ' + saleDoc + '. ';

    cars.push({
      id: id++,
      year,
      make,
      model,
      trim: '',
      vin,
      mileage,
      exteriorColor: '',
      interiorColor: '',
      engine,
      transmission: '',
      drivetrain,
      condition: status || 'Unknown',
      damage,
      seller,
      saleDocument: saleDoc,
      location,
      mechanicalNotes: notes.trim(),
      highlights,
      soldPrice,
      soldDate: '',
      auctionHouse,
      auctionSource: auctionHouse ? auctionHouse + ' via bid.cars' : 'bid.cars',
      images,
      sourceUrl: '',
    });
  }

  console.log(`  Extracted ${cars.length} cars with Final Bid prices`);

  // Verify: check for price accuracy
  const priceCount = {};
  cars.forEach(c => { priceCount[c.soldPrice] = (priceCount[c.soldPrice] || 0) + 1; });
  const dupeCount = Object.values(priceCount).filter(n => n >= 4).reduce((s, n) => s + n, 0);
  if (dupeCount > cars.length * 0.2) {
    console.log(`%c⚠ ${dupeCount} cars share a price with 4+ others — may still have issues`, 'color:orange');
  } else {
    console.log(`  ✓ Price quality looks good`);
  }

  // Show sample for verification
  console.log('  Sample (first 5):');
  cars.slice(0, 5).forEach(c => {
    console.log(`    ${c.year} ${c.make} ${c.model} | $${c.soldPrice.toLocaleString()} | ${c.damage || 'no damage'} | ${c.vin}`);
  });

  if (cars.length === 0) {
    console.log('%c❌ No cars with "Final bid" prices found.', 'color:red;font-size:14px');
    console.log('  Make sure you are on bid.cars ARCHIVED results (not current auctions).');
    return;
  }

  // ---- STEP 4: Download ----
  const json = JSON.stringify(cars, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'cardle-bidcars-' + new Date().toISOString().split('T')[0] + '-' + cars.length + 'cars.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  console.log(`%c✅ Downloaded ${cars.length} cars!`, 'font-size:16px;font-weight:bold;color:#22c55e');
  console.log(`  With images: ${cars.filter(c => c.images?.length > 0).length} cars`);
  console.log('%cNext steps:', 'color:#fbbf24;font-weight:bold');
  console.log('  1. node scripts/import-scraped.js "<path>.json"');
  console.log('  2. npm run merge-data');
  console.log('  3. npm run dev');

})();
