const { spawn } = require('node:child_process');
const path = require('node:path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const PORT = 3099;

async function run() {
  const server = spawn(process.execPath, ['server/index.js'], {
    cwd: ROOT,
    env: { ...process.env, PORT: String(PORT), DB_PATH: ':memory:' },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  server.stdout.on('data', (d) => process.stdout.write(d));
  server.stderr.on('data', (d) => process.stderr.write(d));

  // wait for server
  await new Promise(r => setTimeout(r, 1500));

  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage();

  const pageErrors = [];
  page.on('pageerror', err => {
    console.error('PAGE ERROR:', err);
    pageErrors.push(err);
  });
  page.on('console', msg => {
    if (msg.type() === 'error') console.error('CONSOLE ERROR:', msg.text());
    else console.log('CONSOLE:', msg.text());
  });

  // Navigate to aluno
  await page.goto(`http://127.0.0.1:${PORT}/aluno`);
  console.log('Opened /aluno');

  // Login as student
  await page.fill('#studentFastPhone', '15999990001');
  await page.click('#studentFastForm button[type="submit"]');

  await page.waitForSelector('#studentDashboard', { state: 'visible', timeout: 5000 });
  console.log('Dashboard visible!');

  // Check buttons in studentWeeklyList
  const weeklyButtons = await page.$$eval('#studentWeeklyList button', btns => btns.map(b => b.textContent.trim()));
  console.log('Weekly buttons:', weeklyButtons);

  // Check buttons in upcomingList
  const upcomingButtons = await page.$$eval('#studentUpcomingList button', btns => btns.map(b => b.textContent.trim()));
  console.log('Upcoming buttons:', upcomingButtons);

  // Click Vou participar in weekly list
  console.log('Testing click on weekly list...');
  const firstWeeklyBtn = await page.$('#studentWeeklyList [data-confirm-class]');
  if (firstWeeklyBtn) {
    const textBefore = await firstWeeklyBtn.textContent();
    console.log('Clicking weekly button with text:', textBefore.trim());
    await firstWeeklyBtn.click();
    await page.waitForTimeout(1500);

    // After clicking weekly, check button in weekly list
    const weeklyBtnsAfter = await page.$$eval('#studentWeeklyList button', btns => btns.map(b => b.textContent.trim()));
    console.log('Weekly buttons after click:', weeklyBtnsAfter);

    // Check upcoming list
    const upcomingAfterWeekly = await page.$$eval('#studentUpcomingList button', btns => btns.map(b => b.textContent.trim()));
    console.log('Upcoming buttons after weekly click:', upcomingAfterWeekly);

    // Check dashboard status
    const statusText = await page.$eval('#studentDashboardStatus', el => el.textContent.trim()).catch(() => '');
    console.log('Dashboard status after confirm:', statusText);

    // Now click Desmarcar on the weekly list
    const weeklyDesmarcarBtn = await page.$('#studentWeeklyList [data-confirm-value="remover"]');
    if (weeklyDesmarcarBtn) {
      console.log('Found Desmarcar button in weekly list! Clicking Desmarcar...');
      await weeklyDesmarcarBtn.click();
      await page.waitForTimeout(1500);

      const weeklyBtnsAfterUnmark = await page.$$eval('#studentWeeklyList button', btns => btns.map(b => b.textContent.trim()));
      console.log('Weekly buttons after unmark:', weeklyBtnsAfterUnmark);

      const upcomingAfterUnmark = await page.$eval('#studentUpcomingList', el => el.textContent.trim());
      console.log('Upcoming content after unmark:', upcomingAfterUnmark);

      const statusAfterUnmark = await page.$eval('#studentDashboardStatus', el => el.textContent.trim()).catch(() => '');
      console.log('Dashboard status after unmark:', statusAfterUnmark);

      // Now test marking again, but unmarking from Upcoming list!
      console.log('Re-marking class to test unmark from Upcoming list...');
      const weeklyBtn2 = await page.$('#studentWeeklyList [data-confirm-class]');
      await weeklyBtn2.click();
      await page.waitForTimeout(1500);

      const upcomingDesmarcarBtn = await page.$('#studentUpcomingList [data-confirm-value="remover"]');
      if (upcomingDesmarcarBtn) {
        console.log('Found Desmarcar in upcoming list! Clicking it...');
        await upcomingDesmarcarBtn.click();
        await page.waitForTimeout(1500);

        const weeklyBtnsAfterUpcomingUnmark = await page.$$eval('#studentWeeklyList button', btns => btns.map(b => b.textContent.trim()));
        console.log('Weekly buttons after upcoming unmark:', weeklyBtnsAfterUpcomingUnmark);

        const upcomingAfterUpcomingUnmark = await page.$eval('#studentUpcomingList', el => el.textContent.trim());
        console.log('Upcoming content after upcoming unmark:', upcomingAfterUpcomingUnmark);
      }
    }
  }

  await browser.close();
  server.kill();

  if (pageErrors.length > 0) {
    console.error('FAILED with page errors:', pageErrors);
    process.exit(1);
  } else {
    console.log('SUCCESS! Complete marking and unmarking flow tested with 0 errors.');
  }
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
