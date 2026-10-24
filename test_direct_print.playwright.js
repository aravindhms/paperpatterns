const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch({
    channel: 'msedge',
    headless: true
  });
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await context.newPage();

  // Stub window.print before navigation so it doesn't open modal dialog in headless test
  await page.addInitScript(() => {
    Window.prototype.print = () => { console.log('[Browser] window.print() called'); };
  });

  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
      console.error('[Browser Error]', msg.text());
    }
  });

  console.log('1. Navigating to http://localhost:8000/#proj_front...');
  await page.goto('http://localhost:8000/#proj_front', { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);

  // Set to A4 and Portrait
  await page.selectOption('#pageSizeSelect', 'a4');
  await page.waitForTimeout(300);

  // Ensure border style is set to a visible border, e.g., diploma_seal
  await page.selectOption('#borderStyleSelect', 'diploma_seal');
  await page.waitForTimeout(300);

  // Verify direct print button click triggers prepareAndPrint and populates #printContainer
  console.log('2. Clicking directPrintBtn...');
  // We can hook or check printContainer content before or after window.print
  await page.evaluate(() => {
    // Call populatePrintContainer directly to inspect DOM
    window.populatePrintContainer?.() || document.getElementById('directPrintBtn').click();
  });
  await page.waitForTimeout(300);

  const printPagesCount = await page.locator('.print-page').count();
  console.log(`Print pages generated in #printContainer: ${printPagesCount}`);
  if (printPagesCount !== 1) {
    throw new Error(`Expected 1 print page, got ${printPagesCount}`);
  }

  // Check dynamic print style element
  const dynamicPrintStyle = await page.locator('#dynamicPrintStyle').textContent();
  console.log('Dynamic print style content:', dynamicPrintStyle.replace(/\s+/g, ' ').trim());

  if (!dynamicPrintStyle.includes('210mm 297mm') || !dynamicPrintStyle.includes('margin: 0mm')) {
    throw new Error(`Dynamic print style does not have 210mm 297mm or margin 0mm: ${dynamicPrintStyle}`);
  }

  // Check .print-page dimensions and svg viewBox
  const printPageSvg = page.locator('.print-page svg');
  const viewBox = await printPageSvg.getAttribute('viewBox');
  console.log('SVG viewBox:', viewBox);
  if (!viewBox.includes('595.28') || !viewBox.includes('841.89')) {
    throw new Error(`SVG viewBox does not match A4 dimensions: ${viewBox}`);
  }

  // Test print media emulation
  console.log('3. Emulating print media...');
  await page.emulateMedia({ media: 'print' });
  await page.waitForTimeout(400);

  const appDisplay = await page.evaluate(() => getComputedStyle(document.getElementById('app')).display);
  const printContainerDisplay = await page.evaluate(() => getComputedStyle(document.getElementById('printContainer')).display);
  console.log(`In print media: #app display=${appDisplay}, #printContainer display=${printContainerDisplay}`);

  if (appDisplay !== 'none') {
    throw new Error(`Expected #app to be display: none in print media, got ${appDisplay}`);
  }
  if (printContainerDisplay !== 'block') {
    throw new Error(`Expected #printContainer to be display: block in print media, got ${printContainerDisplay}`);
  }

  // Capture screenshot of print page
  const printPageEl = page.locator('.print-page');
  await printPageEl.screenshot({ path: 'verify_print_page_a4.png' });
  console.log('Saved verify_print_page_a4.png');

  // Test multi-page print (e.g. 3 pages with page numbering)
  console.log('4. Testing multi-page printing with 3 pages and numbering...');
  await page.emulateMedia({ media: 'screen' });
  await page.waitForTimeout(200);

  // Set page count to 3
  await page.fill('#pageStepperInput', '3');
  await page.dispatchEvent('#pageStepperInput', 'change');
  await page.waitForTimeout(300);

  // Enable page numbering
  await page.click('label:has(#pageNumToggle)');
  await page.waitForTimeout(300);

  // Trigger print populate
  await page.evaluate(() => {
    // Direct call to populatePrintContainer
    const btn = document.getElementById('directPrintBtn');
    btn.click();
  });
  await page.waitForTimeout(300);

  const multiPagesCount = await page.locator('.print-page').count();
  console.log(`Multi-page print pages count: ${multiPagesCount}`);
  if (multiPagesCount !== 3) {
    throw new Error(`Expected 3 print pages, got ${multiPagesCount}`);
  }

  // Verify page numbering texts: "1 / 3", "2 / 3", "3 / 3"
  const p1Text = await page.locator('.print-page').nth(0).textContent();
  const p2Text = await page.locator('.print-page').nth(1).textContent();
  const p3Text = await page.locator('.print-page').nth(2).textContent();
  console.log('Page 1 contains "1 / 3":', p1Text.includes('1 / 3'));
  console.log('Page 2 contains "2 / 3":', p2Text.includes('2 / 3'));
  console.log('Page 3 contains "3 / 3":', p3Text.includes('3 / 3'));

  if (!p1Text.includes('1 / 3') || !p2Text.includes('2 / 3') || !p3Text.includes('3 / 3')) {
    throw new Error('Multi-page numbering failed: text not found on print pages');
  }

  // Test landscape print
  console.log('5. Testing landscape orientation print...');
  await page.click('#orientLandscapeBtn');
  await page.waitForTimeout(300);

  await page.evaluate(() => document.getElementById('directPrintBtn').click());
  await page.waitForTimeout(300);

  const landscapeStyle = await page.locator('#dynamicPrintStyle').textContent();
  console.log('Landscape print style:', landscapeStyle.replace(/\s+/g, ' ').trim());
  if (!landscapeStyle.includes('297mm 210mm')) {
    throw new Error(`Expected landscape print style to have 297mm 210mm, got ${landscapeStyle}`);
  }

  // Generate actual PDF through Playwright Chromium print pipeline
  console.log('6. Generating test PDF via page.pdf({ preferCSSPageSize: true })...');
  await page.pdf({
    path: 'test_direct_print_output.pdf',
    preferCSSPageSize: true,
    printBackground: true
  });
  const pdfStat = fs.statSync('test_direct_print_output.pdf');
  console.log(`Generated test_direct_print_output.pdf successfully (${pdfStat.size} bytes)!`);

  if (errors.length > 0) {
    throw new Error(`Console errors during test: ${errors.join(', ')}`);
  }

  console.log('ALL DIRECT PRINT TESTS PASSED WITH 100% SUCCESS!');
  await browser.close();
})();
