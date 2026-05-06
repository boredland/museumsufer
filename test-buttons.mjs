import { chromium } from 'playwright';

const BASE_URL = 'http://localhost:8787';

async function testShareReportButtons() {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  try {
    console.log('🔍 Testing share/report buttons on museum page...\n');

    // Navigate to a museum page
    const museumPage = `${BASE_URL}/museum/staedel-museum`;
    console.log(`📍 Navigating to: ${museumPage}`);
    await page.goto(museumPage, { waitUntil: 'networkidle' });

    // Wait for the page to load
    await page.waitForLoadState('domcontentloaded');

    // Check if buttons exist
    console.log('\n🔎 Checking for share/report buttons...');
    const shareButtons = await page.locator('[data-share-type]').count();
    const reportButtons = await page.locator('[data-report-type]').count();
    console.log(`   Share buttons found: ${shareButtons}`);
    console.log(`   Report buttons found: ${reportButtons}`);

    // Check if the buttons are visible
    if (shareButtons > 0) {
      const firstShareBtn = page.locator('[data-share-type]').first();
      const isVisible = await firstShareBtn.isVisible();
      console.log(`\n📌 First share button visible: ${isVisible}`);
      
      // Try to click it
      try {
        console.log('   Clicking share button...');
        await firstShareBtn.click();
        console.log('   ✓ Share button clicked successfully');
        
        // Check if share URL was generated
        const url = page.url();
        console.log(`   Current URL: ${url}`);
      } catch (e) {
        console.log(`   ✗ Error clicking share button: ${e.message}`);
      }
    }

    if (reportButtons > 0) {
      const firstReportBtn = page.locator('[data-report-type]').first();
      const isVisible = await firstReportBtn.isVisible();
      console.log(`\n📌 First report button visible: ${isVisible}`);
      
      // Try to click it
      try {
        console.log('   Clicking report button...');
        await firstReportBtn.click();
        
        // Check if contact dialog opened
        const dialog = page.locator('#contact-dialog');
        const dialogVisible = await dialog.isVisible();
        console.log(`   ✓ Report button clicked, dialog visible: ${dialogVisible}`);
      } catch (e) {
        console.log(`   ✗ Error clicking report button: ${e.message}`);
      }
    }

    // Check client script state
    console.log('\n🔧 Checking client script state...');
    const hasT = await page.evaluate(() => typeof T !== 'undefined');
    const hasCurrentLang = await page.evaluate(() => typeof CURRENT_LANG !== 'undefined');
    const hasClientScript = await page.evaluate(() => typeof handleShareClick !== 'undefined');
    
    console.log(`   T translations defined: ${hasT}`);
    console.log(`   CURRENT_LANG defined: ${hasCurrentLang}`);
    console.log(`   handleShareClick function exists: ${hasClientScript}`);

    // Check for console errors
    console.log('\n📋 Checking for console errors...');
    const errors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    // Give a moment for any errors to appear
    await page.waitForTimeout(500);
    
    if (errors.length > 0) {
      errors.forEach(err => console.log(`   ⚠️  Console error: ${err}`));
    } else {
      console.log('   ✓ No console errors');
    }

    // Check HTML structure of buttons
    console.log('\n🏗️  Button HTML structure:');
    if (shareButtons > 0) {
      const shareHtml = await page.locator('[data-share-type]').first().evaluate(el => el.outerHTML);
      console.log(`   Share: ${shareHtml.substring(0, 200)}...`);
    }
    if (reportButtons > 0) {
      const reportHtml = await page.locator('[data-report-type]').first().evaluate(el => el.outerHTML);
      console.log(`   Report: ${reportHtml.substring(0, 200)}...`);
    }

  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    await browser.close();
  }
}

testShareReportButtons().catch(console.error);
