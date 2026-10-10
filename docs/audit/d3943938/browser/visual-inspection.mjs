// Visual inspection script for card anatomy issues
// Captures screenshots of problematic routes with measurements

import { chromium } from '@playwright/test';
import { writeFileSync } from 'node:fs';

const BASE = 'https://project-audit-79.preview.emergentagent.com';
const DOMAIN = new URL(BASE).hostname;

const b = await chromium.launch();
const ctx = await b.newContext({ 
  viewport: { width: 1920, height: 800 },
  ignoreHTTPSErrors: true
});

// Set cookies for authentication
await ctx.addCookies([
  { name: 'cfb_session', value: 'preview-demo', domain: DOMAIN, path: '/', secure: true, sameSite: 'Lax' },
  { name: 'cfb_preview_demo', value: '1', domain: DOMAIN, path: '/', secure: true, sameSite: 'Lax' },
  { name: 'cfb_primary_role', value: 'existing_founder', domain: DOMAIN, path: '/', secure: true, sameSite: 'Lax' },
  { name: 'cfb_cookie_consent', value: 'true', domain: DOMAIN, path: '/', secure: true, sameSite: 'Lax' },
  { name: 'cfb_demo_data', value: '1', domain: DOMAIN, path: '/', secure: true, sameSite: 'Lax' },
]);

await ctx.addInitScript(() => {
  try {
    localStorage.setItem('user', JSON.stringify({ id: 'preview-demo-user', email: 'probe@cofounderbay.test', role: 'founder' }));
    localStorage.setItem('cfb_demo_data', '1');
    localStorage.setItem('cfb_cookie_consent', 'true');
    localStorage.setItem('cfb.dashboard.founder.full', '1');
    localStorage.setItem('cfb:primary-language', 'en');
    localStorage.setItem('cfb_locale', 'en');
    // Mark all tours as done
    const get = Storage.prototype.getItem;
    Storage.prototype.getItem = function (k) { return /^cfb[.:]tour/i.test(k) ? 'done' : get.call(this, k); };
  } catch (e) { 
    console.error('Init script error:', e);
  }
});

const page = await ctx.newPage();

const routes = [
  { path: '/fundraising', width: 390, name: 'fundraising-mobile', issues: 'escape (36), offAxis (4), lower (1)' },
  { path: '/fundraising', width: 1440, name: 'fundraising-desktop', issues: 'none detected' },
  { path: '/connections', width: 390, name: 'connections-mobile', issues: 'offAxis (1)' },
  { path: '/programs', width: 1440, name: 'programs-desktop', issues: 'centered (7)' },
  { path: '/scout', width: 1440, name: 'scout-desktop', issues: 'escape (10)' },
  { path: '/members', width: 390, name: 'members-mobile', issues: 'baseline check' },
  { path: '/members', width: 1440, name: 'members-desktop', issues: 'baseline check' },
  { path: '/opportunities', width: 390, name: 'opportunities-mobile', issues: 'baseline check' },
  { path: '/opportunities', width: 1440, name: 'opportunities-desktop', issues: 'baseline check' },
];

const results = [];

for (const route of routes) {
  console.log(`\nCapturing ${route.path} at ${route.width}px (${route.issues})...`);
  
  try {
    // Navigate
    await page.setViewportSize({ width: route.width, height: route.width === 390 ? 844 : 900 });
    await page.goto(BASE + route.path, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(2000);
    
    // Measure cards
    const measurement = await page.evaluate(() => {
      const cards = document.querySelectorAll('[data-card]');
      const cardData = [];
      
      cards.forEach((card, idx) => {
        const rect = card.getBoundingClientRect();
        const title = card.querySelector('h1, h2, h3, h4, h5, [role=heading], .person-name');
        const titleText = title ? title.textContent.trim().slice(0, 50) : 'No title';
        const titleStyle = title ? getComputedStyle(title) : null;
        
        cardData.push({
          index: idx,
          title: titleText,
          rect: { left: rect.left, top: rect.top, width: rect.width, height: rect.height },
          titleStyle: titleStyle ? {
            fontSize: titleStyle.fontSize,
            fontWeight: titleStyle.fontWeight,
            lineHeight: titleStyle.lineHeight,
            color: titleStyle.color
          } : null
        });
      });
      
      return {
        cardCount: cards.length,
        cards: cardData,
        viewport: { width: window.innerWidth, height: window.innerHeight }
      };
    });
    
    // Take screenshot
    await page.screenshot({ 
      path: `/app/docs/audit/d3943938/browser/${route.name}.png`,
      type: 'png'
    });
    
    results.push({
      route: route.path,
      width: route.width,
      name: route.name,
      issues: route.issues,
      measurement,
      status: 'success'
    });
    
    console.log(`  ✓ Captured ${route.name}.png (${measurement.cardCount} cards)`);
    
  } catch (e) {
    console.error(`  ✗ Failed: ${e.message}`);
    results.push({
      route: route.path,
      width: route.width,
      name: route.name,
      issues: route.issues,
      error: e.message,
      status: 'failed'
    });
  }
}

// Save results
writeFileSync('/app/docs/audit/d3943938/browser/visual-inspection-results.json', JSON.stringify(results, null, 2));
console.log('\n✓ Visual inspection complete. Results saved to visual-inspection-results.json');

await b.close();
