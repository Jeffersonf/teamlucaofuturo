const { spawn } = require('node:child_process');
const path = require('node:path');
const { chromium } = require('playwright');
const assert = require('node:assert');

const ROOT = path.resolve(__dirname, '..');
const PORT = 3097;

async function testAttendanceFlow() {
  const server = spawn(process.execPath, ['server/index.js'], {
    cwd: ROOT,
    env: { ...process.env, PORT: String(PORT), DB_PATH: ':memory:' },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  server.stdout.on('data', (d) => process.stdout.write(d));
  server.stderr.on('data', (d) => process.stderr.write(d));

  await new Promise((r) => setTimeout(r, 2000));

  const browser = await chromium.launch({ channel: 'msedge', headless: true });

  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 860 } });

    page.on('pageerror', (err) => console.error('PAGE ERROR:', err));
    page.on('console', (msg) => {
      if (msg.type() === 'error') console.error('BROWSER ERROR:', msg.text());
    });

    console.log('--- 1. Navegando para o painel com PIN de acesso ---');
    await page.goto(`http://127.0.0.1:${PORT}`);
    await page.evaluate(() => localStorage.setItem('tlf_admin_pin', '1209'));
    await page.reload();
    await page.waitForTimeout(1500);

    console.log('--- 2. Abrindo modal de presenças da primeira aula ---');
    const attendanceBtn = page.locator('button[data-attendance]').first();
    await attendanceBtn.click();
    await page.waitForTimeout(600);

    const isModalOpen = await page.locator('#attendanceModal.open').isVisible();
    assert.ok(isModalOpen, 'Modal de presenças deve estar aberto');
    console.log('Modal de presenças aberto com sucesso!');

    console.log('--- 3. Verificando se o datalist de alunos foi populado ---');
    const datalistOptions = await page.locator('#studentsAttendanceDatalist option').count();
    console.log(`Opções no datalist de alunos: ${datalistOptions}`);
    assert.ok(datalistOptions > 0, 'Datalist deve conter alunos cadastrados');

    // Pegar o nome de um aluno cadastrado que não esteja inicialmente na aula
    const studentSample = await page.evaluate(() => {
      const options = Array.from(document.querySelectorAll('#studentsAttendanceDatalist option'));
      const notInClass = options.find((opt) => !opt.textContent.includes('já na turma'));
      return notInClass ? notInClass.value : options[0]?.value;
    });
    console.log(`Aluno selecionado para o teste: "${studentSample}"`);
    assert.ok(studentSample, 'Deve haver um aluno disponível para seleção');

    console.log('--- 4. Adicionando aluno cadastrado que compareceu à aula ---');
    await page.fill('#extraAttendanceName', studentSample);
    await page.selectOption('#extraAttendanceType', 'Reposição');

    // Submete o formulário
    await page.click('#extraAttendanceForm button[type="submit"]');
    await page.waitForTimeout(600);

    // Verifica se o aluno apareceu com o card rico e vinculado (não solto)
    const extraCard = page.locator('#extraAttendanceList .extra-student-card').first();
    const isExtraVisible = await extraCard.isVisible();
    assert.ok(isExtraVisible, 'Card rico de aluno cadastrado deve estar visível em #extraAttendanceList');

    const extraCardInfo = await page.evaluate(() => {
      const card = document.querySelector('#extraAttendanceList .extra-student-card');
      if (!card) return null;
      return {
        name: card.querySelector('button[data-report-student]')?.textContent?.trim(),
        hasPresentBadge: card.textContent.includes('Presente'),
        hasTypeBadge: card.textContent.includes('Reposição'),
        hasMetaPlan: card.querySelector('.meta')?.textContent?.trim()
      };
    });
    console.log('Card do aluno vinculado no modal:', extraCardInfo);
    assert.ok(extraCardInfo.hasPresentBadge, 'Deve exibir badge ✓ Presente');
    assert.ok(extraCardInfo.hasTypeBadge, 'Deve exibir badge de tipo Reposição');
    assert.ok(extraCardInfo.hasMetaPlan, 'Deve exibir plano e metas semanais do atleta');

    console.log('--- 5. Testando adição de visitante externo (não cadastrado) ---');
    await page.fill('#extraAttendanceName', 'Visitante Carlos Convidado');
    await page.selectOption('#extraAttendanceType', 'Visitante');
    await page.click('#extraAttendanceForm button[type="submit"]');
    await page.waitForTimeout(600);

    const visitorCard = page.locator('#extraAttendanceList .extra-visitor-card').first();
    assert.ok(await visitorCard.isVisible(), 'Card de visitante externo deve estar visível');
    console.log('Visitante externo adicionado com sucesso!');

    // Capturar screenshot no Desktop
    const brainDir = 'C:\\Users\\jeffe\\.gemini\\antigravity\\brain\\9b5f73f1-09cf-4e6c-ba2f-48e882b1a051';
    await page.screenshot({ path: path.join(brainDir, 'modal-attendance-desktop.png') });
    console.log('Screenshot salva: modal-attendance-desktop.png');

    console.log('--- 6. Testando remoção imediata in-place ---');
    const removeVisitorBtn = page.locator('#extraAttendanceList .extra-visitor-card button[data-remove-extra]').first();
    await removeVisitorBtn.click();
    await page.waitForTimeout(500);

    const visitorCardStillThere = await visitorCard.isVisible().catch(() => false);
    assert.strictEqual(visitorCardStillThere, false, 'Visitante removido não deve mais estar visível');
    console.log('Remoção imediata in-place testada com sucesso!');

    console.log('--- 7. Testando no Mobile Viewport (iPhone / 390px) ---');
    const mobilePage = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await mobilePage.goto(`http://127.0.0.1:${PORT}`);
    await mobilePage.evaluate(() => localStorage.setItem('tlf_admin_pin', '1209'));
    await mobilePage.reload();
    await mobilePage.waitForTimeout(1200);

    // Abre chamada no mobile
    await mobilePage.click('button[data-attendance]');
    await mobilePage.waitForTimeout(600);

    await mobilePage.screenshot({ path: path.join(brainDir, 'modal-attendance-mobile.png') });
    console.log('Screenshot mobile salva: modal-attendance-mobile.png');

    console.log('--- TODOS OS TESTES DE PRESENÇA PASSARAM COM 100% DE SUCESSO! ---');
  } catch (err) {
    console.error('ERRO NO TESTE:', err);
    process.exitCode = 1;
  } finally {
    await browser.close();
    server.kill();
  }
}

testAttendanceFlow();
