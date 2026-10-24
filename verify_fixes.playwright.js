const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({
    channel: 'msedge',
    headless: true
  });
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await context.newPage();

  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
      console.error('[Browser Error]', msg.text());
    }
  });

  console.log('1. Navigating to http://localhost:8000/#hexagonal...');
  await page.goto('http://localhost:8000/#hexagonal', { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);

  // Switch to Inch if not already
  await page.click('button[data-unit="inch"]');
  await page.waitForTimeout(400);

  const specBadge = await page.textContent('#canvasSpecBadge');
  console.log('Canvas Spec Badge text:', specBadge.replace(/\s+/g, ' ').trim());

  const primitivesHex = await page.textContent('#specLineCount');
  console.log('Primitives on #hexagonal:', primitivesHex);

  if (/\b0 primitives\b/.test(primitivesHex)) {
    throw new Error('FAIL: Hexagonal still renders 0 primitives!');
  }

  await page.screenshot({ path: 'verify_hexagonal_inch.png' });

  // 2. Click category tab "Project & Assignment Borders"
  console.log('2. Clicking Project & Assignment Borders tab...');
  await page.click('.cat-pill:has-text("Project & Assignment Borders")');
  await page.waitForTimeout(400);

  const borderCards = await page.$$('.pattern-card');
  console.log('Found border cards in catalog:', borderCards.length);

  // 3. Click and test each of the project border patterns
  const testIds = ['proj_front', 'proj_eng', 'proj_academic_ruled', 'proj_academic_blank', 'proj_floral', 'proj_tech'];
  for (const pid of testIds) {
    console.log(`Testing pattern ${pid}...`);
    await page.click(`.pattern-card[data-id="${pid}"]`);
    await page.waitForTimeout(300);

    const title = await page.textContent('#inspectorPatternName');
    const count = await page.textContent('#specLineCount');
    console.log(`  -> ${title}: ${count}`);

    if (/\b0 primitives\b/.test(count)) {
      throw new Error(`FAIL: Pattern ${pid} rendered 0 primitives!`);
    }
  }

  // Screenshot academic ruled
  await page.screenshot({ path: 'verify_proj_academic_ruled.png' });

  // Click front page and screenshot
  await page.click('.pattern-card[data-id="proj_front"]');
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'verify_proj_front.png' });

  console.log('Console errors encountered:', errors.length);
  if (errors.length > 0) {
    console.error('Errors list:', errors);
    throw new Error('Browser errors detected during test!');
  }

  console.log('ALL VERIFICATIONS PASSED SUCCESSFULLY!');
  await browser.close();
})();
