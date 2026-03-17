/**
 * ============================================================
 *  Cardle - bid.cars Browser Console Data Extractor
 * ============================================================
 *
 *  HOW TO USE:
 *  1. Open bid.cars in your browser and pass any CAPTCHA
 *  2. Go to: https://bid.cars/en/search/archived/results?search-type=filters&status=All&type=Automobile
 *  3. Scroll down to load as many results as you want
 *  4. Open browser DevTools: press F12 (or Ctrl+Shift+I)
 *  5. Click the "Console" tab
 *  6. Copy ALL of this file's content and paste it into the console
 *  7. Press Enter
 *  8. A JSON file will automatically download with all the car data
 *
 *  To get MORE cars:
 *  - Scroll down on bid.cars until more results load (infinite scroll)
 *  - Or navigate to different pages and run this script on each page
 *  - Use the import-scraped.js script to combine multiple files
 *
 *  This also captures IMAGE URLS for each car.
 * ============================================================
 */

(function cardleExtractor() {
  console.log('%c🚗 Cardle Data Extractor Starting...', 'font-size:18px;font-weight:bold;color:#f97316');

  function extractCarsFromPage() {
    const cars = [];

    // Strategy 1: Find car cards by looking for elements with lot links
    const allLinks = document.querySelectorAll('a[href]');
    const lotLinks = Array.from(allLinks).filter(a =>
      /\/lot\/|\/vehicle\/|\/en\/\d+\//.test(a.href)
    );

    // Group links by their parent container (each car card)
    const processedContainers = new Set();

    lotLinks.forEach(link => {
      // Walk up to find the card container
      let container = link;
      for (let i = 0; i < 8; i++) {
        if (!container.parentElement) break;
        container = container.parentElement;
        // Stop at a reasonable card-level container
        if (container.children.length >= 3 &&
            container.offsetHeight > 80 &&
            container.offsetWidth > 200) {
          break;
        }
      }

      if (processedContainers.has(container)) return;
      processedContainers.add(container);

      const text = container.innerText || '';
      const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

      if (lines.length < 3) return;

      // Extract image URLs from img tags within this container
      const images = [];
      container.querySelectorAll('img').forEach(img => {
        const src = img.src || img.dataset.src || img.getAttribute('data-lazy-src') || '';
        if (src && !src.includes('logo') && !src.includes('icon') && !src.includes('svg') &&
            !src.includes('placeholder') && src.startsWith('http')) {
          images.push(src);
        }
      });

      // Also check for background images
      container.querySelectorAll('[style*="background"]').forEach(el => {
        const match = el.style.backgroundImage?.match(/url\(['"]?(https?[^'")\s]+)/);
        if (match) images.push(match[1]);
      });

      // Parse the text content
      const car = parseCarText(text, lines, images);
      car.sourceUrl = link.href;

      if (car.year && car.make) {
        cars.push(car);
      }
    });

    // Strategy 2: If strategy 1 found nothing, try broader selectors
    if (cars.length === 0) {
      console.log('%c  Trying alternative extraction...', 'color:#fbbf24');
      const articles = document.querySelectorAll(
        'article, [class*="card"], [class*="item"], [class*="lot"], [class*="result"], [class*="vehicle"]'
      );

      articles.forEach(el => {
        if (el.offsetHeight < 50) return;
        const text = el.innerText || '';
        const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
        if (lines.length < 3) return;

        const images = [];
        el.querySelectorAll('img').forEach(img => {
          const src = img.src || img.dataset.src || '';
          if (src && src.startsWith('http') && !src.includes('logo')) {
            images.push(src);
          }
        });

        const car = parseCarText(text, lines, images);
        const link = el.querySelector('a[href]');
        if (link) car.sourceUrl = link.href;

        if (car.year && car.make && car.soldPrice > 0) {
          cars.push(car);
        }
      });
    }

    return cars;
  }

  function parseCarText(fullText, lines, images) {
    const car = {
      year: 0,
      make: '',
      model: '',
      trim: '',
      vin: '',
      mileage: 0,
      engine: '',
      drivetrain: '',
      horsepower: '',
      condition: '',
      damage: '',
      status: '',
      seller: '',
      saleDocument: '',
      location: '',
      soldPrice: 0,
      soldDate: '',
      auctionHouse: '',
      images: [],
      sourceUrl: '',
    };

    car.images = [...new Set(images)]; // deduplicate

    // VIN
    const vinMatch = fullText.match(/\b([A-HJ-NPR-Z0-9]{17})\b/i);
    if (vinMatch) car.vin = vinMatch[1].toUpperCase();

    // Auction house
    if (/IAAI/i.test(fullText)) car.auctionHouse = 'IAAI';
    else if (/Copart/i.test(fullText)) car.auctionHouse = 'Copart';

    // Price - find the largest dollar amount (usually the final bid)
    const priceMatches = fullText.match(/\$[\d,]+/g);
    if (priceMatches) {
      const prices = priceMatches.map(p => parseInt(p.replace(/[$,]/g, ''), 10)).filter(p => p > 0);
      if (prices.length > 0) car.soldPrice = Math.max(...prices);
    }

    // Date
    const dateMatch = fullText.match(
      /(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\w*\s+\d{1,2}\s+\w+,?\s+\d{4}/i
    ) || fullText.match(/\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*,?\s+\d{4}/i);
    if (dateMatch) {
      try {
        const d = new Date(dateMatch[0].replace(/,/g, ''));
        if (!isNaN(d.getTime())) car.soldDate = d.toISOString().split('T')[0];
      } catch { /* ignore */ }
    }

    // Drivetrain
    if (/\bAWD\b/i.test(fullText)) car.drivetrain = 'AWD';
    else if (/\b4WD\b|4x4/i.test(fullText)) car.drivetrain = '4WD';
    else if (/\bFWD\b/i.test(fullText)) car.drivetrain = 'FWD';
    else if (/\bRWD\b/i.test(fullText)) car.drivetrain = 'RWD';

    // Engine
    const engineMatch = fullText.match(/(\d+\.\d+)\s*L/i);
    const cylMatch = fullText.match(/(\d+)\s*cyl/i);
    const hpMatch = fullText.match(/(\d+)\s*HP/i);
    const engineParts = [];
    if (engineMatch) engineParts.push(engineMatch[0]);
    if (cylMatch) engineParts.push(cylMatch[0]);
    if (hpMatch) engineParts.push(hpMatch[0]);
    if (engineParts.length) car.engine = engineParts.join(' ');

    // Mileage
    const mileMatch = fullText.match(/(\d+k?)\s*miles?\s*\((\d+k?)\s*km\)/i) ||
                       fullText.match(/Mil[ea]ge:?\s*(\d+k?)\s*miles/i) ||
                       fullText.match(/(\d+[,.]?\d*k?)\s*miles/i);
    if (mileMatch) {
      let val = mileMatch[1].toLowerCase().replace(/,/g, '');
      if (val.includes('k')) car.mileage = Math.round(parseFloat(val) * 1000);
      else car.mileage = parseInt(val, 10) || 0;
    }

    // Damage
    const damageMatch = fullText.match(/Damage:?\s*(.+?)(?:\n|$)/i);
    if (damageMatch) car.damage = damageMatch[1].trim();
    else {
      const dmg = fullText.match(/Collision\s*\|?\s*[\w\s]*/i) ||
                  fullText.match(/(Flood|Fire|Vandalism|Theft|Hail|Mechanical|Water|Rollover)/i);
      if (dmg) car.damage = dmg[0].trim();
    }

    // Status
    const statusPatterns = ['Run and Drive', 'Does Not Run', 'Starts', 'Enhanced Vehicles', 'Stationary'];
    for (const s of statusPatterns) {
      if (fullText.includes(s)) { car.status = s; break; }
    }

    // Seller
    const sellerMatch = fullText.match(/Seller:?\s*(.+?)(?:\n|$)/i);
    if (sellerMatch) car.seller = sellerMatch[1].trim();

    // Sale doc
    const saleDocMatch = fullText.match(/Sale doc\.?:?\s*(.+?)(?:\n|$)/i);
    if (saleDocMatch) car.saleDocument = saleDocMatch[1].trim();

    // Location
    const locMatch = fullText.match(/Location:?\s*(.+?)(?:\n|$)/i);
    if (locMatch) car.location = locMatch[1].trim();

    // Year, Make, Model from title (first meaningful line)
    for (const line of lines) {
      const match = line.match(/(\d{4})\s+(\S+)\s+(.+)/);
      if (match && parseInt(match[1], 10) >= 1920 && parseInt(match[1], 10) <= 2027) {
        car.year = parseInt(match[1], 10);
        car.make = match[2].replace(/,/g, '').trim();
        const rest = match[3].trim();
        // Split model and trim at comma or bullet
        const sepIdx = rest.search(/[,•·]/);
        if (sepIdx > 0) {
          car.model = rest.substring(0, sepIdx).trim();
          car.trim = rest.substring(sepIdx + 1).trim();
        } else {
          car.model = rest;
        }
        break;
      }
    }

    return car;
  }

  // RUN THE EXTRACTION
  const cars = extractCarsFromPage();

  if (cars.length === 0) {
    console.log('%c❌ No cars found! Make sure you are on the bid.cars search results page.', 'color:red;font-size:14px');
    console.log('Expected URL: https://bid.cars/en/search/archived/results?...');
    return;
  }

  // Format for the game
  const formatted = cars.map((car, i) => {
    const highlights = [];
    if (car.drivetrain) highlights.push(car.drivetrain);
    if (car.status) highlights.push(car.status);
    if (car.damage) highlights.push(car.damage);
    if (car.auctionHouse) highlights.push(car.auctionHouse);

    let notes = '';
    if (car.damage) notes += `Damage: ${car.damage}. `;
    if (car.status) notes += `Status: ${car.status}. `;
    if (car.seller) notes += `Seller: ${car.seller}. `;
    if (car.saleDocument) notes += `Sale Doc: ${car.saleDocument}. `;

    return {
      id: i + 1,
      year: car.year,
      make: car.make,
      model: car.model,
      trim: car.trim,
      vin: car.vin,
      mileage: car.mileage,
      exteriorColor: '',
      interiorColor: '',
      engine: car.engine,
      transmission: '',
      drivetrain: car.drivetrain,
      condition: car.status || 'Unknown',
      damage: car.damage || 'None reported',
      seller: car.seller,
      saleDocument: car.saleDocument,
      location: car.location,
      mechanicalNotes: notes.trim(),
      highlights,
      soldPrice: car.soldPrice,
      soldDate: car.soldDate,
      auctionHouse: car.auctionHouse,
      auctionSource: car.auctionHouse ? `${car.auctionHouse} via bid.cars` : 'bid.cars',
      images: car.images,
      sourceUrl: car.sourceUrl,
    };
  });

  // Create downloadable JSON file
  const json = JSON.stringify(formatted, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `cardle-bidcars-${new Date().toISOString().split('T')[0]}-${cars.length}cars.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  console.log(`%c✅ Extracted ${cars.length} cars! JSON file downloaded.`, 'font-size:16px;font-weight:bold;color:#22c55e');
  console.log('%cWith images:', 'color:#60a5fa', cars.filter(c => c.images.length > 0).length, 'cars have image URLs');
  console.log('%cNext steps:', 'color:#fbbf24;font-weight:bold');
  console.log('  1. Save the downloaded JSON file into your project: server/data/');
  console.log('  2. Run: node scripts/import-scraped.js <filename>.json');
  console.log('  3. Run: npm run merge-data');
  console.log('  4. Restart the game server');

  // Also copy to clipboard for convenience
  navigator.clipboard.writeText(json).then(() => {
    console.log('%c📋 Also copied to clipboard!', 'color:#a78bfa');
  }).catch(() => {});

})();
