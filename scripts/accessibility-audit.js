const { chromium } = require('playwright');

const baseUrl = process.env.AUDIT_URL || 'http://127.0.0.1:3020/';
const executablePath = process.env.PLAYWRIGHT_EXECUTABLE_PATH || undefined;

async function login(page) {
  if (!(await page.locator('#loginWall.open').count())) return;
  if (await page.locator('#bookingWall.open').count()) await page.locator('#adminAccessBtn').click();
  await page.locator('#loginPin').fill('1209');
  await page.getByRole('button', { name: 'Entrar' }).click();
  await page.waitForFunction(() => !document.getElementById('loginWall').classList.contains('open'));
}

async function auditPage(page, name) {
  const violations = await page.evaluate(() => {
    const visible = (element) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
    };
    const nameOf = (element) => {
      const labelledBy = element.getAttribute('aria-labelledby');
      const labelledText = labelledBy ? labelledBy.split(/\s+/).map((id) => document.getElementById(id)?.textContent || '').join(' ') : '';
      const label = element.closest('label')?.textContent || (element.id ? document.querySelector(`label[for="${CSS.escape(element.id)}"]`)?.textContent || '' : '');
      return (element.getAttribute('aria-label') || labelledText || label || element.textContent || element.getAttribute('title') || '').replace(/\s+/g, ' ').trim();
    };
    const issues = [];
    const ids = new Set();
    document.querySelectorAll('[id]').forEach((element) => {
      if (ids.has(element.id)) issues.push(`id duplicado: ${element.id}`);
      ids.add(element.id);
    });
    document.querySelectorAll('img').forEach((element) => {
      if (visible(element) && !element.hasAttribute('alt')) issues.push(`imagem sem alt: ${element.src}`);
    });
    document.querySelectorAll('button, a[href], input:not([type="hidden"]), select, textarea').forEach((element) => {
      if (!visible(element) || element.disabled) return;
      if (!nameOf(element)) issues.push(`controle sem nome: ${element.tagName.toLowerCase()}#${element.id || 'sem-id'}`);
    });
    document.querySelectorAll('[role="dialog"]').forEach((element) => {
      if (visible(element) && !element.getAttribute('aria-label') && !element.getAttribute('aria-labelledby')) issues.push(`dialog sem rotulo: #${element.id || 'sem-id'}`);
    });
    return issues;
  });
  if (violations.length) throw new Error(`${name}: ${violations.join(' | ')}`);
}

async function auditSkipLink(page) {
  await page.keyboard.press('Tab');
  const target = await page.evaluate(() => ({
    href: document.activeElement?.getAttribute('href') || '',
    text: document.activeElement?.textContent?.trim() || ''
  }));
  if (target.href !== '#mainContent' || !target.text) throw new Error('atalho de conteudo principal ausente ou sem foco');
}

async function audit() {
  const browser = await chromium.launch({ headless: true, executablePath });
  try {
    const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
    mobile.setDefaultTimeout(5000);
    await mobile.goto(`${baseUrl}?audit=public-mobile`, { waitUntil: 'domcontentloaded', timeout: 10000 });
    await mobile.waitForTimeout(350);
    await auditSkipLink(mobile);
    await auditPage(mobile, 'public-mobile-guest');
    await mobile.locator('[data-public-tab="student"]').click();
    await auditPage(mobile, 'public-mobile-student');
    await mobile.locator('#adminAccessBtn').click();
    await login(mobile);
    for (const pageName of ['dashboard', 'actions', 'students', 'classes', 'payments', 'bookings', 'waitlist', 'plans', 'reports', 'settings']) {
      await mobile.evaluate((target) => window.setPage(target), pageName);
      await mobile.waitForTimeout(120);
      await auditPage(mobile, `admin-mobile-${pageName}`);
    }
    await mobile.evaluate(() => window.setPage('students'));
    await mobile.waitForSelector('#page-students.active .student-row [data-edit-student]', { timeout: 5000 });
    await mobile.locator('#page-students.active [data-edit-student]').first().click();
    await mobile.waitForSelector('#studentModal.open');
    await auditPage(mobile, 'admin-mobile-student-modal');
    await mobile.locator('#studentModal button.close').click();
    await mobile.close();

    const desktop = await browser.newPage({ viewport: { width: 1440, height: 950 } });
    desktop.setDefaultTimeout(5000);
    await desktop.goto(`${baseUrl}?audit=admin-desktop`, { waitUntil: 'domcontentloaded', timeout: 10000 });
    await desktop.waitForTimeout(350);
    await login(desktop);
    await desktop.waitForTimeout(200);
    await auditPage(desktop, 'admin-desktop-dashboard');
    await desktop.close();
    console.log('Accessibility audit ok: 14 estados verificados');
    process.exit(0);
  } finally {
    await Promise.race([browser.close(), new Promise((resolve) => setTimeout(resolve, 1500))]);
  }
}

audit().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
