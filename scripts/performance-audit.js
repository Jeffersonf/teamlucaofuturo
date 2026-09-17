const { chromium } = require('playwright');

const baseUrl = process.env.AUDIT_URL || 'http://127.0.0.1:3020/';
const executablePath = process.env.PLAYWRIGHT_EXECUTABLE_PATH || undefined;

async function checkPage(page, name, loginRequired = false) {
  page.setDefaultTimeout(5000);
  const failed = [];
  page.on('requestfailed', (request) => failed.push(`${request.url()} (${request.failure()?.errorText || 'falhou'})`));
  page.on('response', (response) => {
    if (response.status() >= 400) failed.push(`${response.status()} ${response.url()}`);
  });
  await page.goto(`${baseUrl}?performance=${name}`, { waitUntil: 'load', timeout: 10000 });
  await page.waitForTimeout(350);
  if (loginRequired) {
    if (await page.locator('#bookingWall.open').count()) await page.locator('#adminAccessBtn').click();
    await page.locator('#loginPin').fill('1209');
    await page.getByRole('button', { name: 'Entrar' }).click();
    await page.waitForFunction(() => !document.getElementById('loginWall').classList.contains('open'));
    await page.waitForTimeout(350);
  }
  const metrics = await page.evaluate(() => {
    const navigation = performance.getEntriesByType('navigation')[0];
    const resources = performance.getEntriesByType('resource').filter((entry) => /(?:app|styles|service-worker|manifest|team-lucao-logo)/.test(entry.name));
    return {
      domContentLoaded: Math.round(navigation?.domContentLoadedEventEnd || 0),
      load: Math.round(navigation?.loadEventEnd || 0),
      resources: resources.map((entry) => ({ name: entry.name.split('/').pop(), duration: Math.round(entry.duration), size: entry.transferSize || entry.encodedBodySize || 0 })),
      overflow: document.documentElement.scrollWidth > window.innerWidth + 1
    };
  });
  if (failed.length) throw new Error(`${name}: recursos com falha: ${failed.join(' | ')}`);
  if (metrics.overflow) throw new Error(`${name}: overflow horizontal no documento`);
  if (metrics.domContentLoaded > 3000 || metrics.load > 5000) throw new Error(`${name}: carregamento lento (${metrics.domContentLoaded}ms DOM, ${metrics.load}ms load)`);
  return { name, ...metrics };
}

async function audit() {
  const browser = await chromium.launch({ headless: true, executablePath });
  try {
    const publicPage = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const adminPage = await browser.newPage({ viewport: { width: 1440, height: 950 } });
    const results = [
      await checkPage(publicPage, 'public-mobile'),
      await checkPage(adminPage, 'admin-desktop', true)
    ];
    const assetBytes = await adminPage.evaluate(() => performance.getEntriesByType('resource')
      .filter((entry) => /app\.js|styles\.css/.test(entry.name))
      .reduce((total, entry) => total + (entry.transferSize || entry.encodedBodySize || 0), 0));
    if (assetBytes > 350000) throw new Error(`assets principais acima do limite: ${assetBytes} bytes`);
    console.log(JSON.stringify({ ok: true, pages: results, principalAssetsBytes: assetBytes }, null, 2));
    process.exit(0);
  } finally {
    await Promise.race([browser.close(), new Promise((resolve) => setTimeout(resolve, 1500))]);
  }
}

audit().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
