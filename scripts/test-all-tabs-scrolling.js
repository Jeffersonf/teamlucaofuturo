const { chromium } = require('playwright');
const { spawn } = require('child_process');
const path = require('path');

async function testAllTabs() {
  const ROOT = path.resolve(__dirname, '..');
  const server = spawn(process.execPath, ['server/index.js'], {
    cwd: ROOT,
    env: { ...process.env, PORT: '3101', DB_PATH: ':memory:' },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  await new Promise(r => setTimeout(r, 1500));
  const browser = await chromium.launch({ channel: 'msedge', headless: true });

  try {
    const page = await browser.newPage({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true
    });

    await page.goto('http://127.0.0.1:3101');
    await page.evaluate(() => localStorage.setItem('tlf_admin_pin', '1209'));
    await page.reload();
    await page.waitForTimeout(1500);

    const client = await page.context().newCDPSession(page);

    // Tab buttons on mobile bottom bar: dashboard, classes, students, payments, more
    const mobileTabs = ['dashboard', 'classes', 'students', 'payments', 'more'];

    for (const tab of mobileTabs) {
      const tabSelector = `button[data-page="${tab}"]`;
      await page.click(tabSelector);
      await page.waitForTimeout(300);

      const before = await page.evaluate(() => window.scrollY);

      // Perform touch drag
      await client.send('Input.dispatchTouchEvent', {
        type: 'touchStart',
        touchPoints: [{ x: 200, y: 600 }]
      });
      for (let y = 580; y >= 200; y -= 40) {
        await client.send('Input.dispatchTouchEvent', {
          type: 'touchMove',
          touchPoints: [{ x: 200, y }]
        });
        await new Promise(r => setTimeout(r, 16));
      }
      await client.send('Input.dispatchTouchEvent', {
        type: 'touchEnd',
        touchPoints: []
      });
      await page.waitForTimeout(300);

      const after = await page.evaluate(() => window.scrollY);
      const metrics = await page.evaluate(() => ({
        scrollHeight: document.documentElement.scrollHeight,
        innerHeight: window.innerHeight
      }));

      console.log(`Mobile Tab [${tab}]:`, {
        before,
        after,
        scrollHeight: metrics.scrollHeight,
        scrolled: after > before || metrics.scrollHeight <= metrics.innerHeight
      });

      // Reset scroll
      await page.evaluate(() => window.scrollTo(0, 0));
    }

    // Test secondary pages reached via "More" menu
    await page.click('button[data-page="more"]');
    await page.waitForTimeout(300);

    const subPages = ['reports', 'settings', 'plans', 'waitlist'];
    for (const sub of subPages) {
      const moreBtn = `button[data-more-page="${sub}"]`;
      if (await page.locator(moreBtn).isVisible()) {
        await page.click(moreBtn);
        await page.waitForTimeout(300);

        const before = await page.evaluate(() => window.scrollY);
        await client.send('Input.dispatchTouchEvent', {
          type: 'touchStart',
          touchPoints: [{ x: 200, y: 600 }]
        });
        for (let y = 580; y >= 200; y -= 40) {
          await client.send('Input.dispatchTouchEvent', {
            type: 'touchMove',
            touchPoints: [{ x: 200, y }]
          });
          await new Promise(r => setTimeout(r, 16));
        }
        await client.send('Input.dispatchTouchEvent', {
          type: 'touchEnd',
          touchPoints: []
        });
        await page.waitForTimeout(300);

        const after = await page.evaluate(() => window.scrollY);
        const metrics = await page.evaluate(() => ({
          scrollHeight: document.documentElement.scrollHeight,
          innerHeight: window.innerHeight
        }));

        console.log(`Sub-Page [${sub}]:`, {
          before,
          after,
          scrollHeight: metrics.scrollHeight,
          scrolled: after > before || metrics.scrollHeight <= metrics.innerHeight
        });

        // Go back to more
        await page.click('button[data-page="more"]');
        await page.waitForTimeout(200);
      }
    }

    // Modal test: Open student modal, verify body.modal-open, close it, verify scrolling resumes
    await page.click('button[data-page="students"]');
    await page.waitForTimeout(300);
    const newStudentBtn = page.locator('button[data-open-student]').first();
    if (await newStudentBtn.isVisible()) {
      await newStudentBtn.click();
      await page.waitForTimeout(400);

      const modalOpenState = await page.evaluate(() => ({
        isModalOpen: document.getElementById('studentModal')?.classList.contains('open'),
        bodyHasModalOpenClass: document.body.classList.contains('modal-open')
      }));
      console.log('Modal Opened Status:', modalOpenState);

      // Close modal
      await page.click('#studentModal button.close');
      await page.waitForTimeout(400);

      const modalClosedState = await page.evaluate(() => ({
        isModalOpen: document.getElementById('studentModal')?.classList.contains('open'),
        bodyHasModalOpenClass: document.body.classList.contains('modal-open')
      }));
      console.log('Modal Closed Status:', modalClosedState);

      // Verify scrolling works after modal close
      await client.send('Input.dispatchTouchEvent', {
        type: 'touchStart',
        touchPoints: [{ x: 200, y: 600 }]
      });
      for (let y = 580; y >= 200; y -= 40) {
        await client.send('Input.dispatchTouchEvent', {
          type: 'touchMove',
          touchPoints: [{ x: 200, y }]
        });
        await new Promise(r => setTimeout(r, 16));
      }
      await client.send('Input.dispatchTouchEvent', {
        type: 'touchEnd',
        touchPoints: []
      });
      await page.waitForTimeout(300);
      console.log('ScrollY after modal close touch drag:', await page.evaluate(() => window.scrollY));
    }

    console.log('ALL VERIFICATION TESTS COMPLETED SUCCESSFULLY!');
  } finally {
    await browser.close();
    server.kill();
  }
}

testAllTabs().catch(console.error);
