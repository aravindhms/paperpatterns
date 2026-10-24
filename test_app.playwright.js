const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const SCREENSHOT_DIR = path.join(__dirname, 'screenshots');
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

(async () => {
  console.log('🚀 Starting PaperPatterns Playwright Test Suite...');
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    acceptDownloads: true
  });
  const page = await context.newPage();

  const consoleLogs = [];
  const errors = [];

  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push(`Console Error: ${msg.text()}`);
      console.error('❌ Console Error:', msg.text());
    } else {
      consoleLogs.push(msg.text());
    }
  });

  page.on('pageerror', err => {
    errors.push(`Page Error: ${err.message}`);
    console.error('❌ Unhandled Page Exception:', err.message);
  });

  try {
    // ---------------------------------------------------------------
    // 1. Navigation & Initial Load
    // ---------------------------------------------------------------
    console.log('\n--- 1. Testing Page Load ---');
    await page.goto('http://localhost:8000/', { waitUntil: 'networkidle' });
    const title = await page.title();
    console.log(`Page title: "${title}"`);
    if (!title.includes('PaperPatterns')) {
      throw new Error(`Unexpected page title: ${title}`);
    }

    // Check header elements
    const brandName = await page.locator('.brand-name').textContent();
    console.log(`Brand: ${brandName}`);

    // Wait for pattern cards to render
    await page.waitForSelector('.pattern-card');
    const totalCards = await page.locator('.pattern-card').count();
    console.log(`Rendered pattern cards count: ${totalCards}`);
    if (totalCards !== 91) {
      throw new Error(`Expected 91 pattern cards, found ${totalCards}`);
    }

    // Verify SVG rendered in canvas
    const initialSvg = await page.locator('#paperSvg svg, #paperSvg').innerHTML();
    console.log(`Initial paper SVG has content: ${initialSvg.length > 100}`);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '01_initial_load.png') });

    // ---------------------------------------------------------------
    // 2. Testing Category Filters
    // ---------------------------------------------------------------
    console.log('\n--- 2. Testing Category Filtering ---');
    // Click "Journaling & Dots"
    await page.click('button.cat-pill:has-text("Journaling & Dots")');
    await page.waitForTimeout(300);
    const journalCount = await page.locator('.pattern-card').count();
    console.log(`Journaling & Dots count: ${journalCount}`);
    if (journalCount < 5) throw new Error(`Unexpected count for Journaling: ${journalCount}`);

    // Click "Games & RPGs"
    await page.click('button.cat-pill:has-text("Games & RPGs")');
    await page.waitForTimeout(300);
    const gamesCount = await page.locator('.pattern-card').count();
    console.log(`Games & RPGs count: ${gamesCount}`);
    if (gamesCount < 10) throw new Error(`Unexpected count for Games: ${gamesCount}`);

    // Click "Project & Assignment Borders"
    await page.click('button.cat-pill:has-text("Project & Assignment Borders")');
    await page.waitForTimeout(300);
    const borderCatCount = await page.locator('.pattern-card').count();
    console.log(`Project & Assignment Borders category count: ${borderCatCount}`);
    if (borderCatCount < 6) throw new Error(`Expected at least 6 project border patterns, got ${borderCatCount}`);

    // Click "All Patterns"
    await page.click('button.cat-pill:has-text("All Patterns")');
    await page.waitForTimeout(300);
    const allCount = await page.locator('.pattern-card').count();
    console.log(`Reset back to all count: ${allCount}`);

    // ---------------------------------------------------------------
    // 3. Testing Search Filtering
    // ---------------------------------------------------------------
    console.log('\n--- 3. Testing Real-time Search ---');
    const searchInput = page.locator('#patternSearch');
    await searchInput.fill('hex');
    await page.waitForTimeout(300);
    const hexCount = await page.locator('.pattern-card').count();
    console.log(`Search "hex" matched cards: ${hexCount}`);
    if (hexCount < 2) throw new Error(`Expected at least 2 cards matching 'hex', got ${hexCount}`);

    // Clear search
    await searchInput.fill('');
    await page.waitForTimeout(300);

    // ---------------------------------------------------------------
    // 4. Testing Pattern Selection & Parameter Customization
    // ---------------------------------------------------------------
    console.log('\n--- 4. Testing Pattern Selection & Parameters ---');
    // Select "Hexagonal" pattern
    const hexCard = page.locator('.pattern-card[data-id="hexagonal"]');
    await hexCard.click();
    await page.waitForTimeout(300);

    const activeTitle = await page.locator('#inspectorPatternName').textContent();
    console.log(`Active pattern after click: ${activeTitle}`);
    if (!activeTitle.includes('Hexagonal')) throw new Error(`Expected Hexagonal active, got ${activeTitle}`);

    // Check spec badge
    const specSpacing = await page.locator('#specSpacing').textContent();
    console.log(`Spec badge spacing: ${specSpacing}`);

    // Change Page Size to A4
    await page.selectOption('#pageSizeSelect', 'a4');
    await page.waitForTimeout(200);

    // Change orientation to Landscape
    await page.click('#orientLandscapeBtn');
    await page.waitForTimeout(200);
    const specDims = await page.locator('#specDimensions').textContent();
    console.log(`Dimensions in Landscape: ${specDims}`);

    // Toggle orientation back to Portrait
    await page.click('#orientPortraitBtn');
    await page.waitForTimeout(200);

    // Change Spacing via Number input
    const spacingInput = page.locator('#spacingNumber');
    await spacingInput.fill('8');
    await spacingInput.dispatchEvent('input');
    await page.waitForTimeout(200);
    const updatedSpacing = await page.locator('#specSpacing').textContent();
    console.log(`Updated spacing badge: ${updatedSpacing}`);

    // Change Color Swatch to Blueprint Cyan (#b3b3ff)
    await page.click('.color-swatch-btn[data-color="b3b3ff"]');
    await page.waitForTimeout(200);

    // Change Paper Background to Warm Ivory (#fffbf0)
    await page.click('.color-swatch-btn[data-bgcolor="fffbf0"]');
    await page.waitForTimeout(200);

    // Test Page Border Feature
    console.log('Testing Border Selection (Double Line Formal Frame)...');
    await page.selectOption('#borderStyleSelect', 'double');
    await page.waitForTimeout(200);
    const borderOptsVisible = await page.locator('#borderOptionsContainer').isVisible();
    console.log(`Border options container visible: ${borderOptsVisible}`);
    if (!borderOptsVisible) throw new Error('Expected border options container to be visible');

    // Change Border Weight to 2 pt
    const borderWeightInput = page.locator('#borderWeightNumber');
    await borderWeightInput.fill('2');
    await borderWeightInput.dispatchEvent('input');
    await page.waitForTimeout(200);

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '02_hexagonal_customized.png') });

    // ---------------------------------------------------------------
    // 5. Testing Quick Presets (Quick Picks)
    // ---------------------------------------------------------------
    console.log('\n--- 5. Testing Quick Presets ---');
    // Switch to Cross Grid (squarecross)
    await page.click('.pattern-card[data-id="squarecross"]');
    await page.waitForTimeout(300);

    const pickBtns = page.locator('.quick-pick-btn');
    const pickCount = await pickBtns.count();
    console.log(`Quick picks available for Cross Grid: ${pickCount}`);
    if (pickCount > 0) {
      await pickBtns.first().click();
      await page.waitForTimeout(200);
      console.log('Clicked first quick pick preset');
    }
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '03_cross_grid_preset.png') });

    // ---------------------------------------------------------------
    // 6. Testing Theme Toggle (Dark Mode)
    // ---------------------------------------------------------------
    console.log('\n--- 6. Testing Theme Toggle ---');
    await page.click('#themeToggleBtn');
    await page.waitForTimeout(300);
    const themeAttr = await page.getAttribute('html', 'data-theme');
    console.log(`Theme after toggle: ${themeAttr}`);
    if (themeAttr !== 'dark') throw new Error(`Expected dark theme, got ${themeAttr}`);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '04_dark_mode.png') });

    // Switch theme back to light
    await page.click('#themeToggleBtn');
    await page.waitForTimeout(200);

    // ---------------------------------------------------------------
    // 7. Testing Zoom Controls
    // ---------------------------------------------------------------
    console.log('\n--- 7. Testing Zoom & Pan HUD ---');
    const initialZoom = await page.locator('#zoomLevelDisplay').textContent();
    await page.click('#zoomInBtn');
    await page.waitForTimeout(100);
    const zoomedIn = await page.locator('#zoomLevelDisplay').textContent();
    console.log(`Zoom changed: ${initialZoom} -> ${zoomedIn}`);

    await page.click('#zoomFitBtn');
    await page.waitForTimeout(100);
    const fitZoom = await page.locator('#zoomLevelDisplay').textContent();
    console.log(`Zoom after fit: ${fitZoom}`);

    // Verify download icon removed from top right
    const topDownloadCount = await page.locator('#downloadAppBtn').count();
    console.log(`Top right download button count (should be 0): ${topDownloadCount}`);
    if (topDownloadCount !== 0) throw new Error('Expected top right download button to be removed');

    // ---------------------------------------------------------------
    // 8. Testing Multi-Page Notebook Options & Dynamic Page Stepper
    // ---------------------------------------------------------------
    console.log('\n--- 8. Testing Document & Multi-Page Options ---');

    // Verify initial button text is "Download PDF (1 Page)"
    const initialBtnText = await page.locator('#exportPdfBtnText').textContent();
    console.log(`Initial PDF button label: "${initialBtnText}"`);
    if (!initialBtnText.includes('1 Page')) throw new Error(`Expected 1 Page label, got ${initialBtnText}`);

    // Click "+" stepper twice
    await page.click('#pageStepPlus');
    await page.waitForTimeout(50);
    await page.click('#pageStepPlus');
    await page.waitForTimeout(50);
    const steppedBtnText = await page.locator('#exportPdfBtnText').textContent();
    console.log(`After stepping +2: "${steppedBtnText}"`);
    if (!steppedBtnText.includes('3 Pages')) throw new Error(`Expected 3 Pages label, got ${steppedBtnText}`);

    // Click 5 pages pill
    await page.click('.page-preset-pills button[data-pages="5"]');
    await page.waitForTimeout(50);
    const pillBtnText = await page.locator('#exportPdfBtnText').textContent();
    console.log(`After clicking 5-page pill: "${pillBtnText}"`);
    if (!pillBtnText.includes('5 Pages')) throw new Error(`Expected 5 Pages label, got ${pillBtnText}`);

    // Type arbitrary custom page count (e.g. 7) into stepper input
    const stepperInput = page.locator('#pageStepperInput');
    await stepperInput.fill('7');
    await stepperInput.dispatchEvent('change');
    await page.waitForTimeout(50);
    const customBtnText = await page.locator('#exportPdfBtnText').textContent();
    console.log(`After typing 7: "${customBtnText}"`);
    if (!customBtnText.includes('7 Pages')) throw new Error(`Expected 7 Pages label, got ${customBtnText}`);

    // Toggle Header Title
    await page.click('label:has(#headerToggle)');
    await page.waitForTimeout(100);
    await page.fill('#headerTextInput', 'Project Laboratory Notebook');
    await page.dispatchEvent('#headerTextInput', 'input');

    // Toggle Date Field & Page Numbers
    await page.click('label:has(#dateToggle)');
    await page.click('label:has(#pageNumToggle)');
    await page.waitForTimeout(100);

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '05_multipage_stepper.png') });

    // ---------------------------------------------------------------
    // 9. Testing Export Downloads (PDF, SVG, PNG)
    // ---------------------------------------------------------------
    console.log('\n--- 9. Testing Export Pipelines ---');

    // Test PDF Download
    const [pdfDownload] = await Promise.all([
      page.waitForEvent('download'),
      page.click('#exportPdfBtn')
    ]);
    const pdfPath = path.join(SCREENSHOT_DIR, pdfDownload.suggestedFilename());
    await pdfDownload.saveAs(pdfPath);
    const pdfStat = fs.statSync(pdfPath);
    console.log(`✅ PDF downloaded successfully: "${pdfDownload.suggestedFilename()}" (${pdfStat.size} bytes)`);
    if (pdfStat.size < 500) throw new Error('PDF file size is suspiciously small');

    // Test SVG Download
    const [svgDownload] = await Promise.all([
      page.waitForEvent('download'),
      page.click('#exportSvgBtn')
    ]);
    const svgPath = path.join(SCREENSHOT_DIR, svgDownload.suggestedFilename());
    await svgDownload.saveAs(svgPath);
    const svgStat = fs.statSync(svgPath);
    console.log(`✅ SVG downloaded successfully: "${svgDownload.suggestedFilename()}" (${svgStat.size} bytes)`);
    if (svgStat.size < 200) throw new Error('SVG file size is suspiciously small');

    // Test PNG Download
    const [pngDownload] = await Promise.all([
      page.waitForEvent('download'),
      page.click('#exportPngBtn')
    ]);
    const pngPath = path.join(SCREENSHOT_DIR, pngDownload.suggestedFilename());
    await pngDownload.saveAs(pngPath);
    const pngStat = fs.statSync(pngPath);
    console.log(`✅ PNG downloaded successfully: "${pngDownload.suggestedFilename()}" (${pngStat.size} bytes)`);
    if (pngStat.size < 1000) throw new Error('PNG file size is suspiciously small');

    // ---------------------------------------------------------------
    // 10. Summary & Results
    // ---------------------------------------------------------------
    console.log('\n=================================================');
    console.log('🎉 ALL PLAYWRIGHT TESTS PASSED SUCCESSFULLY!');
    console.log(`Total errors encountered: ${errors.length}`);
    console.log('=================================================\n');

  } catch (err) {
    console.error('\n❌ TEST RUN FAILED:', err);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'error_state.png') });
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();
