const { chromium } = require('playwright');
const { spawn } = require('child_process');
const path = require('path');

async function testAll() {
  const ROOT = path.resolve(__dirname, '..');
  const server = spawn(process.execPath, ['server/index.js'], {
    cwd: ROOT,
    env: { ...process.env, PORT: '3111', DB_PATH: path.join(ROOT, 'arena.db') },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  await new Promise(r => setTimeout(r, 1600));
  const browser = await chromium.launch({ channel: 'msedge', headless: true });

  try {
    const page = await browser.newPage({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true
    });

    console.log('--- TESTANDO PAINEL ADM: HORÁRIOS E APROVAÇÕES ---');
    await page.goto('http://127.0.0.1:3111');
    await page.evaluate(() => localStorage.setItem('tlf_admin_pin', '1209'));
    await page.reload();
    await page.waitForTimeout(1500);

    // 1. Ir para a tela de Aulas e checar o Calendário
    await page.click('button[data-page="classes"]');
    await page.waitForTimeout(500);

    const calendarInfo = await page.evaluate(() => {
      const days = Array.from(document.querySelectorAll('#classCalendar .calendar-day')).map(d => ({
        text: d.querySelector('strong')?.textContent,
        count: d.querySelector('span')?.textContent
      }));
      return days;
    });
    console.log('Calendário de Treinos (Seg a Sáb):', calendarInfo);

    if (calendarInfo.length !== 6) {
      throw new Error(`Esperado 6 dias no calendário (Seg a Sáb), obteve: ${calendarInfo.length}`);
    }

    // 2. Ir para a tela de Pedidos (Aprovações)
    await page.click('button[data-page="more"]');
    await page.waitForTimeout(300);
    await page.click('button[data-more-page="bookings"]');
    await page.waitForTimeout(500);

    const bookingsView = await page.evaluate(() => {
      const title = document.querySelector('#page-bookings h2')?.textContent;
      const filterExists = !!document.getElementById('bookingFilter');
      const stats = Array.from(document.querySelectorAll('#bookingSummary .mini-stat')).map(s => ({
        label: s.querySelector('span')?.textContent,
        val: s.querySelector('strong')?.textContent
      }));
      const requests = Array.from(document.querySelectorAll('#bookingList .booking-request')).map(r => ({
        nome: r.querySelector('h3')?.textContent?.trim(),
        hasExperimentalBadge: r.innerHTML.includes('🧪 Experimental'),
        classMeta: r.querySelector('.booking-class-meta')?.textContent
      }));
      return { title, filterExists, stats, requests };
    });
    console.log('Tela de Aprovações (Pedidos):', JSON.stringify(bookingsView, null, 2));

    if (!bookingsView.filterExists) {
      throw new Error('Filtro de pedidos não encontrado na tela de aprovações');
    }

    const expStat = bookingsView.stats.find(s => s.label?.includes('Experimentais'));
    console.log('Stat de Experimentais:', expStat);
    if (!expStat) {
      throw new Error('Card de KPI de Experimentais não encontrado no resumo');
    }

    // 3. Testar Aprovação do pedido experimental
    const approveBtn = page.locator('#bookingList button[data-booking-action$=":approve"]').first();
    if (await approveBtn.isVisible()) {
      console.log('Testando clique de aprovação de experimental...');
      await approveBtn.click();
      await page.waitForTimeout(1000);

      // Verificar se o aluno foi para a lista de alunos como Experimental
      await page.click('button[data-page="students"]');
      await page.waitForTimeout(600);

      const studentsInfo = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('#studentList .row-card')).map(c => ({
          nome: c.querySelector('h3')?.textContent?.trim(),
          pills: Array.from(c.querySelectorAll('.pill')).map(p => p.textContent)
        }));
      });
      console.log('Alunos cadastrados após aprovação:', studentsInfo);

      const approvedAsStudent = studentsInfo.find(s => s.nome?.includes('Rafael Brito'));
      if (approvedAsStudent) {
        console.log('>>> ALUNO EXPERIMENTAL REGISTRADO COM SUCESSO:', approvedAsStudent);
      }
    }

    // 4. Testar Área do Aluno (Pública)
    console.log('\n--- TESTANDO ÁREA DO ALUNO (PUBLIC) ---');
    const studentPage = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await studentPage.goto('http://127.0.0.1:3111/aluno');
    await studentPage.waitForTimeout(1000);

    // Clicar na aba de Experimental / Conhecer
    await studentPage.click('#tabGuestPortal');
    await studentPage.waitForSelector('#guestClassesList article', { timeout: 5000 });

    const guestSlots = await studentPage.evaluate(() => {
      const cards = Array.from(document.querySelectorAll('#guestClassesList article')).map(a => {
        const time = a.querySelector('.text-center span:nth-child(2)')?.textContent?.trim();
        const turma = a.querySelector('h4')?.textContent?.trim();
        return `${time} - ${turma}`;
      });
      return cards;
    });
    console.log('Horários oferecidos para visitante/experimental:', guestSlots.slice(0, 10));

    if (guestSlots.length === 0) {
      throw new Error('Nenhum horário oferecido para visitante na tela pública');
    }

    console.log('\n>>> TODOS OS TESTES DE HORÁRIOS E EXPERIMENTAIS PASSARAM COM SUCESSO! <<<');

  } finally {
    await browser.close();
    server.kill();
  }
}

testAll().catch(err => {
  console.error(err);
  process.exit(1);
});
