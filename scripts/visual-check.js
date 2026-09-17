const { chromium } = require('playwright');
const fs = require('fs');

const baseUrl = process.env.VISUAL_CHECK_URL || 'http://127.0.0.1:4280/';
const outDir = 'tmp-visual-check';
const expectedAssetVersion = process.env.VISUAL_CHECK_VERSION || '20260908-ui2';
const expectedStyleVersion = process.env.VISUAL_STYLE_VERSION || '20260908-ui2';
const executablePath = process.env.PLAYWRIGHT_EXECUTABLE_PATH || undefined;

const cases = [
  { name: 'mobile-booking', viewport: { width: 390, height: 844 }, page: null },
  { name: 'mobile-student-page', viewport: { width: 390, height: 844 }, path: 'aluno' },
  { name: 'mobile-authorize-page', viewport: { width: 390, height: 844 }, path: 'autorizar' },
  { name: 'mobile-public-student-flow', viewport: { width: 390, height: 844 }, page: null, action: 'public-student-flow' },
  { name: 'mobile-student-confirm-public', viewport: { width: 390, height: 844 }, page: null, action: 'public-student-tab' },
  { name: 'desktop-booking', viewport: { width: 1440, height: 950 }, page: null },
  { name: 'desktop-public-student-flow', viewport: { width: 1440, height: 950 }, page: null, action: 'public-student-flow' },
  { name: 'mobile-dashboard', viewport: { width: 390, height: 844 }, page: 'dashboard' },
  { name: 'mobile-narrow-dashboard', viewport: { width: 320, height: 700 }, page: 'dashboard' },
  { name: 'mobile-global-search', viewport: { width: 390, height: 844 }, page: 'dashboard', action: 'global-search' },
  { name: 'mobile-theme-toggle', viewport: { width: 390, height: 844 }, page: 'dashboard', action: 'theme-toggle' },
  { name: 'mobile-dashboard-dark', viewport: { width: 390, height: 844 }, page: 'dashboard', theme: 'dark' },
  { name: 'mobile-actions', viewport: { width: 390, height: 844 }, page: 'actions' },
  { name: 'mobile-students', viewport: { width: 390, height: 844 }, page: 'students' },
  { name: 'mobile-classes', viewport: { width: 390, height: 844 }, page: 'classes' },
  { name: 'mobile-payments', viewport: { width: 390, height: 844 }, page: 'payments' },
  { name: 'mobile-payment-modal', viewport: { width: 390, height: 844 }, page: 'payments', action: 'payment-modal' },
  { name: 'mobile-bookings', viewport: { width: 390, height: 844 }, page: 'bookings' },
  { name: 'mobile-student-modal', viewport: { width: 390, height: 844 }, page: 'students', action: 'student-modal' },
  { name: 'mobile-student-report', viewport: { width: 390, height: 844 }, page: 'students', action: 'student-report' },
  { name: 'mobile-attendance', viewport: { width: 390, height: 844 }, page: 'classes', action: 'attendance' },
  { name: 'mobile-reports', viewport: { width: 390, height: 844 }, page: 'reports' },
  { name: 'mobile-class-modal', viewport: { width: 390, height: 844 }, page: 'classes', action: 'class-modal' },
  { name: 'mobile-more', viewport: { width: 390, height: 844 }, page: 'more' },
  { name: 'mobile-settings', viewport: { width: 390, height: 844 }, page: 'settings' },
  { name: 'tablet-dashboard', viewport: { width: 768, height: 1024 }, page: 'dashboard' },
  { name: 'desktop-compact-dashboard', viewport: { width: 1024, height: 768 }, page: 'dashboard' },
  { name: 'desktop-settings', viewport: { width: 1440, height: 950 }, page: 'settings', action: 'settings-theme-cycle' },
  { name: 'desktop-class-operations', viewport: { width: 1440, height: 950 }, page: 'classes', action: 'class-operations' },
  { name: 'desktop-dashboard', viewport: { width: 1440, height: 950 }, page: 'dashboard' },
  { name: 'desktop-dashboard-dark', viewport: { width: 1440, height: 950 }, page: 'dashboard', theme: 'dark' },
  { name: 'desktop-actions', viewport: { width: 1440, height: 950 }, page: 'actions' },
  { name: 'desktop-students', viewport: { width: 1440, height: 950 }, page: 'students' },
  { name: 'desktop-bookings', viewport: { width: 1440, height: 950 }, page: 'bookings' },
  { name: 'desktop-student-report', viewport: { width: 1440, height: 950 }, page: 'students', action: 'student-report' },
  { name: 'desktop-attendance', viewport: { width: 1440, height: 950 }, page: 'classes', action: 'attendance' }
];

const selectedCases = process.env.VISUAL_CASE
  ? cases.filter((item) => item.name === process.env.VISUAL_CASE)
  : cases;

async function login(page) {
  const bookingOpen = await page.locator('#bookingWall.open').count();
  if (bookingOpen) await page.locator('#adminAccessBtn').click();
  await page.locator('#loginPin').fill('1209');
  await page.getByRole('button', { name: 'Entrar' }).click();
  await page.waitForFunction(() => !document.getElementById('loginWall').classList.contains('open'), null, { timeout: 5000 });
}

async function assertModalFocus(page, modalSelector, triggerSelector) {
  const focusables = page.locator(`${modalSelector}.open button:not([disabled]), ${modalSelector}.open input:not([disabled]), ${modalSelector}.open select:not([disabled]), ${modalSelector}.open textarea:not([disabled])`);
  const count = await focusables.count();
  if (count < 2) throw new Error(`${modalSelector}: foco nao possui elementos suficientes para teste`);
  const firstId = await focusables.first().evaluate((element) => element.id || element.textContent.trim());
  const lastId = await focusables.last().evaluate((element) => element.id || element.textContent.trim());
  await focusables.last().focus();
  await page.keyboard.press('Tab');
  const forwardId = await page.evaluate(() => document.activeElement?.id || document.activeElement?.textContent.trim());
  if (forwardId !== firstId) throw new Error(`${modalSelector}: Tab nao voltou ao primeiro controle`);
  await focusables.first().focus();
  await page.keyboard.press('Shift+Tab');
  const backwardId = await page.evaluate(() => document.activeElement?.id || document.activeElement?.textContent.trim());
  if (backwardId !== lastId) throw new Error(`${modalSelector}: Shift+Tab nao voltou ao ultimo controle`);
  await page.locator(`${modalSelector} button.close`).click();
  const restored = await page.evaluate(() => document.activeElement?.dataset.editStudent || document.activeElement?.id || '');
  if (!restored) throw new Error(`${modalSelector}: foco nao foi restaurado ao fechar`);
  await page.locator(triggerSelector).first().click();
  await page.waitForSelector(`${modalSelector}.open`);
  const scrollTop = await page.locator(`${modalSelector}.open .modal`).evaluate((element) => element.scrollTop);
  if (scrollTop !== 0) throw new Error(`${modalSelector}: modal reabriu fora do topo`);
}

async function runCaseAction(page, action) {
  if (action === 'public-student-flow') {
    const initial = await page.evaluate(() => ({
      selected: document.querySelector('[data-public-tab="student"]')?.getAttribute('aria-selected'),
      pane: document.querySelector('[data-public-pane="student"]')?.classList.contains('active'),
      experimental: document.getElementById('studentBookingList') !== null,
      columns: getComputedStyle(document.getElementById('studentPane')).gridTemplateColumns
    }));
    if (initial.selected !== 'true' || !initial.pane || !initial.experimental) throw new Error(`Fluxo experimental de aluno nao iniciou primeiro (${JSON.stringify(initial)})`);
    const expectedColumns = page.viewportSize().width > 760 ? 2 : 1;
    if (initial.columns.split(' ').length !== expectedColumns) throw new Error(`Blocos publicos nao se organizaram corretamente (${JSON.stringify(initial)})`);
    await page.locator('#studentLookupPhone').fill('(15) 99110028');
    await page.locator('#studentLookupForm').evaluate((form) => form.requestSubmit());
    await page.waitForFunction(() => {
      const status = document.getElementById('studentConfirmStatus')?.textContent || '';
      return status && status !== 'Buscando suas aulas...';
    }, null, { timeout: 5000 });
    const result = await page.evaluate(() => ({
      status: document.getElementById('studentConfirmStatus')?.textContent || '',
      hasScheduleAction: Boolean(document.querySelector('#studentBookingList [data-student-booking]'))
    }));
    if (!result.hasScheduleAction && !/nenhuma|nao encontrado|modo demo/i.test(result.status)) throw new Error(`Busca publica nao carregou o estado esperado (${JSON.stringify(result)})`);
    if (page.viewportSize().width <= 760) {
      await page.locator('#guestTab').click();
      if (await page.locator('#guestPane.active').count() !== 1) throw new Error('Aba publica de agendamento nao abriu');
      await page.locator('#studentTab').click();
    }
  }
  if (action === 'class-operations') {
    await page.locator('[data-open-schedule]').click();
    const slots = await page.locator('[data-schedule-slot]').count();
    if (slots !== 19) throw new Error(`Grade padrao deveria ter 19 horarios (${slots})`);
    await page.locator('#scheduleWeeks').fill('2');
    await page.locator('[data-close="scheduleModal"]').click();
    await page.locator('[data-open-group-message]').first().click();
    if (await page.locator('#groupMessageTemplate option').count() !== 5) throw new Error('Modelos de mensagem para grupo incompletos');
    await page.locator('#groupMessageTemplate').selectOption('cancel');
    const message = await page.locator('#groupMessageText').inputValue();
    if (!message.includes('Pessoal')) throw new Error('Mensagem de grupo nao foi gerada');
    await page.locator('[data-close="groupMessageModal"]').click();
    await page.locator('#page-classes.active [data-edit-class]').first().click();
    await page.locator('#classStatus').selectOption('Cancelada');
    if (await page.locator('#classNotice').count() !== 1 || await page.locator('#classRecurrence').count() !== 1) throw new Error('Opcoes de cancelamento/recorrencia ausentes');
    await page.locator('[data-close="classModal"]').click();
  }
  if (action === 'global-search') {
    const input = page.locator('#globalSearch');
    await input.fill('Ana');
    await page.waitForSelector('#globalResults.open [role="option"]');
    const expanded = await input.getAttribute('aria-expanded');
    if (expanded !== 'true') throw new Error('Busca global nao marcou aria-expanded ao abrir');
    await page.keyboard.press('Escape');
    if (await page.locator('#globalResults.open').count()) throw new Error('Busca global nao fechou com Escape');
    if (await input.getAttribute('aria-expanded') !== 'false') throw new Error('Busca global nao sincronizou aria-expanded ao fechar');
  }
  if (action === 'theme-toggle') {
    const before = await page.evaluate(() => document.documentElement.dataset.theme || 'light');
    if (page.viewportSize().width <= 520) {
      await page.locator('.nav-item[data-page="more"]').click();
      await page.locator('[data-more-action="theme"]').click();
    } else {
      await page.locator('#themeBtn').click();
    }
    const state = await page.evaluate(() => ({
      theme: document.documentElement.dataset.theme || 'light',
      pressed: document.getElementById('themeBtn')?.getAttribute('aria-pressed'),
      icon: document.querySelectorAll('#themeBtn .theme-icon').length
    }));
    if (state.theme === before || state.icon !== 1 || state.pressed !== (state.theme === 'dark' ? 'true' : 'false')) {
      throw new Error(`Tema nao alternou corretamente (${JSON.stringify(state)})`);
    }
    await page.waitForTimeout(250);
  }
  if (action === 'public-student-tab') {
    await page.locator('[data-public-tab="student"]').click();
    const tabState = await page.evaluate(() => ({
      guest: { selected: document.querySelector('[data-public-tab="guest"]')?.getAttribute('aria-selected'), hidden: document.getElementById('guestPane')?.getAttribute('aria-hidden') },
      student: { selected: document.querySelector('[data-public-tab="student"]')?.getAttribute('aria-selected'), hidden: document.getElementById('studentPane')?.getAttribute('aria-hidden') }
    }));
    if (tabState.guest.selected !== 'false' || tabState.guest.hidden !== 'true' || tabState.student.selected !== 'true' || tabState.student.hidden !== 'false') {
      throw new Error('Abas publicas com estados ARIA inconsistentes');
    }
  }
  if (action === 'student-report') {
    await page.locator('#page-students.active .student-row [data-report-student]').first().click();
    await page.waitForSelector('#studentReportModal.open', { timeout: 5000 });
  }
  if (action === 'student-modal') {
    await page.locator('#page-students.active .student-row [data-edit-student]').first().click();
    await page.waitForSelector('#studentModal.open', { timeout: 5000 });
    if (await page.locator('[data-fixed-schedule-row]').count() !== 1) throw new Error('Agenda fixa inicial nao foi exibida');
    await page.locator('#addStudentFixedSchedule').click();
    if (await page.locator('[data-fixed-schedule-row]').count() !== 2) throw new Error('Segundo dia fixo nao foi adicionado');
    await assertModalFocus(page, '#studentModal', '#page-students.active .student-row [data-edit-student]');
  }
  if (action === 'settings-theme-cycle') {
    const themes = ['light', 'dark'];
    const signatures = new Set();
    const choiceCount = await page.locator('[data-theme-choice]').count();
    if (choiceCount !== 2) throw new Error(`Configuração deveria exibir 2 opções (${choiceCount})`);
    for (const theme of themes) {
      await page.locator(`[data-theme-choice="${theme}"]`).click();
      const actual = await page.evaluate(() => {
        const style = getComputedStyle(document.documentElement);
        return `${document.documentElement.dataset.theme}|${style.getPropertyValue('--bg')}|${style.getPropertyValue('--surface')}|${style.getPropertyValue('--radius')}|${style.getPropertyValue('--shadow')}|${style.getPropertyValue('--sidebar')}`;
      });
      const actualTheme = actual.split('|')[0];
      signatures.add(actual);
      if (actualTheme !== theme) throw new Error(`Modo de exibição não aplicado: ${theme} / ${actualTheme}`);
    }
    if (signatures.size !== themes.length) throw new Error(`Modos não alteraram os tokens visuais (${signatures.size}/${themes.length})`);
    await page.locator('#settingsBrandName').fill('Arena Lucao Futevolei');
    await page.locator('#settingsStudentsTitle').fill('Alunos teste');
    await page.locator('#settingsForm button[type="submit"]').click();
    await page.waitForTimeout(100);
    const saved = await page.evaluate(() => ({
      brand: document.querySelector('[data-config-text="brandName"]')?.textContent,
      title: document.querySelector('[data-config-page-title="studentsTitle"]')?.textContent,
      config: JSON.parse(localStorage.getItem('tlf_admin_config_v1') || '{}')
    }));
    if (saved.brand !== 'Arena Lucao Futevolei' || saved.title !== 'Alunos teste' || saved.config.brandName !== saved.brand || saved.config.studentsTitle !== saved.title) {
      throw new Error(`Configuração de texto não persistiu (${JSON.stringify(saved)})`);
    }
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 10000 });
    await page.waitForTimeout(250);
    const persisted = await page.evaluate(() => ({
      theme: document.documentElement.dataset.theme,
      brand: document.querySelector('[data-config-text="brandName"]')?.textContent,
      title: document.querySelector('[data-config-page-title="studentsTitle"]')?.textContent
    }));
    if (persisted.theme !== 'dark' || persisted.brand !== 'Arena Lucao Futevolei' || persisted.title !== 'Alunos teste') {
      throw new Error(`Configuração não sobreviveu ao reload (${JSON.stringify(persisted)})`);
    }
  }
  if (action === 'payment-modal') {
    await page.locator('#page-payments.active [data-pay]').first().click();
    await page.waitForSelector('#paymentModal.open', { timeout: 5000 });
  }
  if (action === 'class-modal') {
    await page.locator('#page-classes.active [data-open-class]').first().click();
    await page.waitForSelector('#classModal.open', { timeout: 5000 });
  }
  if (action === 'attendance') {
    await page.locator('#page-classes.active [data-attendance]').first().click();
    await page.waitForSelector('#attendanceModal.open', { timeout: 5000 });
  }
}

(async () => {
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch({ headless: true, executablePath });
  for (const item of selectedCases) {
    console.log(`Visual check: ${item.name}`);
    const context = await browser.newContext({ viewport: item.viewport, deviceScaleFactor: 1 });
    const page = await context.newPage();
    const runtimeErrors = [];
    page.on('pageerror', (error) => runtimeErrors.push(`pageerror: ${error.message}`));
    page.on('console', (message) => {
      if (message.type() === 'error') runtimeErrors.push(`console: ${message.text()} (${message.location().url || 'sem origem'})`);
    });
    page.setDefaultTimeout(5000);
    const targetUrl = `${baseUrl}${item.path || ''}?visual=${item.name}`;
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 10000 });
    await page.waitForTimeout(300);
    console.log(`  loaded ${item.name}`);
    if (!item.path) {
      const assetVersion = await page.locator('script[src*="app.js"]').getAttribute('src');
      if (baseUrl.includes('127.0.0.1') && !assetVersion.includes(expectedAssetVersion)) {
        throw new Error(`${item.name}: asset version inesperada (${assetVersion})`);
      }
      const styleVersion = await page.locator('link[href*="styles.css"]').getAttribute('href');
      if (baseUrl.includes('127.0.0.1') && !styleVersion.includes(expectedStyleVersion)) {
        throw new Error(`${item.name}: styles inesperado (${styleVersion})`);
      }
    }
    if (item.page) {
      await login(page);
      console.log(`  logged ${item.name}`);
      await page.evaluate((target) => window.localStorage.setItem('tlf_last_page', target), item.page);
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 10000 });
      await page.waitForTimeout(300);
      console.log(`  reloaded ${item.name}`);
    }
    if (item.theme) {
      await page.evaluate((theme) => {
        document.documentElement.dataset.theme = theme;
        localStorage.setItem('fv_theme', theme);
      }, item.theme);
      await page.waitForTimeout(100);
    }
    if (item.action) await runCaseAction(page, item.action);
    if (item.page && item.viewport.width <= 980) {
      const mobileNav = await page.evaluate(() => {
        const sidebar = document.querySelector('.sidebar');
        const visibleItems = Array.from(document.querySelectorAll('.sidebar .nav-item'))
          .filter((item) => getComputedStyle(item).display !== 'none');
        return {
          visibleItems: visibleItems.length,
          sidebarHeight: sidebar?.getBoundingClientRect().height || 0,
          hasSecondary: visibleItems.some((item) => item.classList.contains('secondary-nav'))
        };
      });
      if (mobileNav.visibleItems !== 6 || mobileNav.hasSecondary || mobileNav.sidebarHeight > 100) {
        throw new Error(`${item.name}: navegacao mobile fora do padrao (${JSON.stringify(mobileNav)})`);
      }
    }
    console.log(`  action ${item.name}`);
    if (runtimeErrors.length) throw new Error(`${item.name}: ${runtimeErrors.join(' | ')}`);
    await page.screenshot({ path: `${outDir}/${item.name}.png`, fullPage: false });
    console.log(`  screenshot ${item.name}`);
    const issueCount = await page.evaluate(() => {
      function hasHorizontalScroller(node) {
        let current = node.parentElement;
        while (current && current !== document.body) {
          const style = getComputedStyle(current);
          if (current.scrollWidth > current.clientWidth && ['auto', 'scroll'].includes(style.overflowX)) return true;
          current = current.parentElement;
        }
        return false;
      }
      const nodes = Array.from(document.querySelectorAll('body *'));
      return nodes.filter((node) => {
        if (hasHorizontalScroller(node)) return false;
        const rect = node.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return false;
        return rect.right > window.innerWidth + 1 || rect.left < -1;
      }).length;
    });
    if (issueCount) throw new Error(`${item.name}: ${issueCount} elemento(s) fora da viewport`);
    await context.close();
    console.log(`  closed ${item.name}`);
  }
  await Promise.race([
    browser.close(),
    new Promise((resolve) => setTimeout(resolve, 1500))
  ]);
  console.log(`Visual check ok: ${selectedCases.length} screenshots em ${outDir}`);
  process.exit(0);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
