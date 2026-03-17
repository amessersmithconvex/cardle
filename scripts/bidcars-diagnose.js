/**
 *  PASTE THIS INTO THE BROWSER CONSOLE ON bid.cars RESULTS PAGE
 *  It will print diagnostic info so we can fix the extractor.
 *  Copy the output and send it back.
 */
(function diagnose() {
  console.log('=== CARDLE DIAGNOSTIC ===');
  console.log('URL:', location.href);

  const body = document.body;
  const allText = body.innerText;

  // Count key patterns
  const prices = allText.match(/\$[\d,]+/g) || [];
  const vins = allText.match(/\b[A-HJ-NPR-Z0-9]{17}\b/g) || [];
  console.log('Prices on page:', prices.length, '- sample:', prices.slice(0, 3));
  console.log('VINs on page:', vins.length, '- sample:', vins.slice(0, 2));

  // Find repeating element patterns (what class appears 10+ times?)
  const classCounts = {};
  document.querySelectorAll('[class]').forEach(el => {
    const cls = el.className;
    if (typeof cls !== 'string') return;
    cls.split(/\s+/).forEach(c => {
      if (c.length < 3) return;
      classCounts[c] = (classCounts[c] || 0) + 1;
    });
  });

  const repeated = Object.entries(classCounts)
    .filter(([, count]) => count >= 5 && count <= 200)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 30);

  console.log('\nRepeated CSS classes (5-200 occurrences):');
  repeated.forEach(([cls, count]) => console.log(`  .${cls}  x${count}`));

  // Find the first VIN and show surrounding HTML
  if (vins.length > 0) {
    const firstVin = vins[0];
    // Find the element containing this VIN
    const walker = document.createTreeWalker(body, NodeFilter.SHOW_TEXT, null);
    let node;
    while ((node = walker.nextNode())) {
      if (node.textContent.includes(firstVin)) {
        let el = node.parentElement;
        // Walk up a few levels
        for (let i = 0; i < 6; i++) {
          if (!el.parentElement) break;
          el = el.parentElement;
          if (el.children.length >= 3 && el.offsetHeight > 100) break;
        }
        console.log('\nCard container for first VIN:', firstVin);
        console.log('Tag:', el.tagName, 'Class:', el.className);
        console.log('Children:', el.children.length);
        console.log('Height:', el.offsetHeight, 'Width:', el.offsetWidth);
        // Show the parent's class too
        if (el.parentElement) {
          console.log('Parent tag:', el.parentElement.tagName, 'Parent class:', el.parentElement.className);
          console.log('Siblings count:', el.parentElement.children.length);
        }
        console.log('Inner text (first 300 chars):', el.innerText.substring(0, 300));

        // Show the HTML structure (abbreviated)
        const html = el.outerHTML;
        console.log('HTML (first 500 chars):', html.substring(0, 500));
        break;
      }
    }
  }

  console.log('\n=== END DIAGNOSTIC ===');
  console.log('Copy everything above and share it so the extractor can be fixed.');
})();
