const { chromium } = require('playwright');
const { spawn } = require('node:child_process');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const PORT = 3088;

async function run() {
  console.log('--- TESTANDO ABAS DO ADMIN NO PLAYWRIGHT ---');
  const server = spawn(process.execPath, ['server/index.js'], {
    cwd: ROOT,
    env: { ...process.env, PORT: String(PORT), DB_PATH: ':memory:' },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  await new Promise((r) => setTimeout(r, 1600));
  const browser = await chromium.launch({ channel: 'msedge', headless: true });

  try {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 }, // iPhone 14
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
    });

    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => {
      console.log('[BROWSER PAGE ERROR]:', e);
      errors.push(e.message);
    });
    page.on('console', (m) => {
      if (m.type() === 'error') {
        console.log('[BROWSER CONSOLE ERROR]:', m.text());
        errors.push(m.text());
      }
    });

    await page.goto(`http://127.0.0.1:${PORT}`, { waitUntil: 'networkidle' });

    // Se estiver com bookingWall ou loginWall
    if (await page.locator('#adminAccessBtn').isVisible()) {
      console.log('Clicando em Acesso ao Painel...');
      await page.click('#adminAccessBtn');
      await page.waitForTimeout(300);
    }

    const pinInput = page.locator('#loginPin');
    if (await pinInput.isVisible()) {
      console.log('Inserindo PIN de login...');
      await pinInput.fill('1209');
      await page.click('#loginForm button[type="submit"]');
      await page.waitForTimeout(1000);
    }

    // Verificar se as 5 abas principais do mobile existem
    const tabs = ['dashboard', 'classes', 'students', 'payments', 'more'];
    for (const tab of tabs) {
      console.log(`Navegando para a aba: ${tab}...`);
      const btn = page.locator(`nav.nav button[data-page="${tab}"]`);
      await btn.first().click();
      await page.waitForTimeout(400);

      const debugInfo = await page.evaluate((t) => {
        const el = document.getElementById(`page-${t}`);
        return {
          currentDatasetPage: document.documentElement.dataset.page,
          elementExists: !!el,
          className: el ? el.className : null,
          display: el ? window.getComputedStyle(el).display : null,
          visibility: el ? window.getComputedStyle(el).visibility : null,
          offsetWidth: el ? el.offsetWidth : null,
          offsetHeight: el ? el.offsetHeight : null
        };
      }, tab);
      console.log(`Debug info para ${tab}:`, JSON.stringify(debugInfo));

      // Verificar que a página correspondente está ativa
      const activePage = page.locator(`#page-${tab}`);
      const isVisible = await activePage.isVisible();
      console.log(`Página #page-${tab} visível:`, isVisible);
      if (!isVisible) throw new Error(`Aba #page-${tab} não ficou visível`);
    }

    // Na aba 'more', testar navegação para 'settings'
    console.log('Testando navegação para configurações...');
    const settingsCard = page.locator('[data-more-page="settings"]');
    if (await settingsCard.isVisible()) {
      await settingsCard.click();
      await page.waitForTimeout(400);
      const settingsPage = page.locator('#page-settings');
      console.log('Página #page-settings visível:', await settingsPage.isVisible());
    }

    console.log('Erros no console capturados:', errors.length);
    if (errors.length > 0) {
      console.error('Erros encontrados:', errors);
      throw new Error('Erros de JS detectados no console!');
    }

    console.log('>>> TODAS AS ABAS E TELAS NAVEGADAS COM 0 ERROS NO PLAYWRIGHT! <<<');
  } finally {
    await browser.close();
    server.kill();
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
