const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ viewport: { width: 1400, height: 950 } });

  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
      console.error('[Browser Error]', msg.text());
    }
  });
  page.on('pageerror', err => {
    errors.push(err.message);
    console.error('[Page Exception]', err.message);
  });

  console.log('1. Navigating to #proj_front (Assignment Front Page)...');
  await page.goto('http://localhost:8000/#proj_front', { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);

  // Check initial SVG contains submission text
  let svgContent = await page.locator('#paperSvg').innerHTML();
  console.log('Initial SVG contains SUBMITTED TO:', svgContent.includes('SUBMITTED TO'));
  if (!svgContent.includes('SUBMITTED TO')) {
    throw new Error('Expected initial Assignment Front Page to contain submission block text!');
  }
  await page.screenshot({ path: 'verify_proj_front_with_submission.png' });

  // Toggle OFF Student Submission Box
  console.log('2. Toggling OFF Student Submission Box...');
  await page.click('label:has(#extra-show_submission)');
  await page.waitForTimeout(400);

  svgContent = await page.locator('#paperSvg').innerHTML();
  console.log('After toggle OFF, contains SUBMITTED TO:', svgContent.includes('SUBMITTED TO'));
  console.log('After toggle OFF, contains NAME:', svgContent.includes('NAME:'));
  if (svgContent.includes('SUBMITTED TO') || svgContent.includes('NAME:')) {
    throw new Error('FAIL: Submission box was not removed after toggling off!');
  }
  await page.screenshot({ path: 'verify_proj_front_without_submission.png' });

  // Also toggle OFF Title & Topic Banner
  console.log('3. Toggling OFF Title Banner...');
  await page.click('label:has(#extra-show_banner)');
  await page.waitForTimeout(400);
  svgContent = await page.locator('#paperSvg').innerHTML();
  console.log('After banner toggle OFF, contains PROJECT / ASSIGNMENT:', svgContent.includes('PROJECT / ASSIGNMENT'));
  if (svgContent.includes('PROJECT / ASSIGNMENT')) {
    throw new Error('FAIL: Title banner was not removed after toggling off!');
  }
  await page.screenshot({ path: 'verify_proj_front_frame_only.png' });

  // 4. Test Engineering Project Sheet
  console.log('4. Navigating to #proj_eng (Engineering Project Sheet)...');
  await page.goto('http://localhost:8000/#proj_eng', { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);

  svgContent = await page.locator('#paperSvg').innerHTML();
  console.log('Initial Engineering Sheet contains DRAWN BY:', svgContent.includes('DRAWN BY'));

  // Toggle OFF Title Block
  await page.click('label:has(#extra-show_titleblock)');
  await page.waitForTimeout(400);
  svgContent = await page.locator('#paperSvg').innerHTML();
  console.log('After toggle OFF, contains DRAWN BY:', svgContent.includes('DRAWN BY'));
  if (svgContent.includes('DRAWN BY')) {
    throw new Error('FAIL: ISO Title Block was not removed after toggling off!');
  }

  // 5. Test border dropdown contextual sub-options on Plain Grid
  console.log('5. Testing border contextual options on Plain Grid...');
  await page.goto('http://localhost:8000/#plain', { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);

  // Select diploma_seal border
  await page.selectOption('#borderStyleSelect', 'diploma_seal');
  await page.waitForTimeout(400);

  svgContent = await page.locator('#paperSvg').innerHTML();
  console.log('Plain grid with diploma seal contains MERIT:', svgContent.includes('MERIT'));
  if (!svgContent.includes('MERIT')) {
    throw new Error('FAIL: Diploma seal was not drawn on plain grid!');
  }

  // Toggle OFF Certificate Rosette Seal in contextual sub-options
  console.log('6. Toggling OFF Diploma Rosette Seal in Border Options...');
  await page.click('label:has(#border-sub-showSeal)');
  await page.waitForTimeout(400);

  svgContent = await page.locator('#paperSvg').innerHTML();
  console.log('After toggle OFF, contains MERIT:', svgContent.includes('MERIT'));
  if (svgContent.includes('MERIT')) {
    throw new Error('FAIL: Certificate Rosette Seal was not removed after toggling off in border sub-options!');
  }

  console.log('Total console/page errors:', errors.length);
  if (errors.length > 0) {
    throw new Error('Browser errors detected during test: ' + JSON.stringify(errors));
  }

  console.log('ALL REMOVABLE ITEM TESTS PASSED 100%!');
  await browser.close();
})();
