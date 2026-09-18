const { chromium } = require('playwright');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

async function testModalAndProfile() {
  const ROOT = path.resolve(__dirname, '..');
  const server = spawn(process.execPath, ['server/index.js'], {
    cwd: ROOT,
    env: { ...process.env, DB_PATH: path.join(ROOT, 'arena.db') },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  let serverUrl = 'http://127.0.0.1:3020';
  await new Promise((resolve) => {
    server.stdout.on('data', (d) => {
      const text = d.toString();
      const match = text.match(/http:\/\/[^\s]+/);
      if (match) {
        serverUrl = match[0].replace('localhost', '127.0.0.1');
        resolve();
      }
    });
    setTimeout(resolve, 2000);
  });
  console.log(`Servidor iniciado em: ${serverUrl}`);

  const browser = await chromium.launch({ channel: 'msedge', headless: true });

  try {
    // Desktop Viewport
    const page = await browser.newPage({
      viewport: { width: 1280, height: 860 }
    });

    console.log('--- TESTE: FICHA DO ATLETA & REDESIGN DE MODAIS ---');
    await page.goto(serverUrl);
    await page.evaluate(() => localStorage.setItem('tlf_admin_pin', '1209'));
    await page.reload();
    await page.waitForTimeout(1500);

    // 1. Ir para a aba Alunos
    await page.click('button[data-page="students"]');
    await page.waitForTimeout(600);

    const studentRowsCount = await page.locator('.student-row').count();
    console.log(`Alunos listados: ${studentRowsCount}`);
    if (studentRowsCount === 0) throw new Error('Nenhum aluno encontrado na lista');

    // 2. Clicar no primeiro card de aluno para abrir a Ficha do Atleta
    console.log('Testando clique no card do aluno para abrir a Ficha Completa...');
    const firstRow = page.locator('.student-row').first();
    await firstRow.click();
    await page.waitForTimeout(600);

    // Verificar se o modal de relatório abriu
    const isProfileOpen = await page.locator('#studentReportModal.open').isVisible();
    console.log('Ficha do Aluno abriu?', isProfileOpen);
    if (!isProfileOpen) throw new Error('O modal da Ficha do Aluno (#studentReportModal) não abriu ao clicar no card!');

    // Verificar os componentes da Ficha do Atleta
    const athleteProfileData = await page.evaluate(() => {
      const avatar = document.querySelector('.athlete-avatar')?.textContent?.trim();
      const name = document.querySelector('.athlete-name')?.textContent?.trim();
      const badges = Array.from(document.querySelectorAll('.athlete-badge')).map(b => b.textContent.trim());
      const payBanner = document.querySelector('.athlete-pay-banner')?.className;
      const kpis = Array.from(document.querySelectorAll('.athlete-kpi-card')).map(k => ({
        label: k.querySelector('.athlete-kpi-label')?.textContent?.trim(),
        val: k.querySelector('.athlete-kpi-val')?.textContent?.trim()
      }));
      const sections = Array.from(document.querySelectorAll('.athlete-section-title')).map(s => s.textContent.trim());
      return { avatar, name, badges, payBanner, kpis, sections };
    });

    console.log('Dados da Ficha do Atleta:', athleteProfileData);
    if (!athleteProfileData.avatar) throw new Error('Avatar do atleta não encontrado!');
    if (!athleteProfileData.name) throw new Error('Nome do atleta não encontrado!');
    if (athleteProfileData.kpis.length !== 4) throw new Error(`Esperado 4 KPIs na ficha do atleta, obteve: ${athleteProfileData.kpis.length}`);

    // Capturar screenshot da Ficha do Atleta
    const brainDir = 'C:\\Users\\jeffe\\.gemini\\antigravity\\brain\\9b5f73f1-09cf-4e6c-ba2f-48e882b1a051';
    await page.screenshot({ path: path.join(brainDir, 'athlete-profile-desktop.png') });
    console.log('Screenshot salva: athlete-profile-desktop.png');

    // 3. Testar botão "Editar Cadastro" de dentro da ficha
    console.log('Testando abertura do modal de edição através da ficha do atleta...');
    await page.click('#studentReportFooter [data-edit-student]');
    await page.waitForTimeout(600);

    const isEditOpen = await page.locator('#studentModal.open').isVisible();
    console.log('Modal de edição abriu?', isEditOpen);
    if (!isEditOpen) throw new Error('Modal de edição (#studentModal) não abriu!');

    // Verificar estrutura moderna do modal
    const editModalStructure = await page.evaluate(() => {
      const hasHeader = !!document.querySelector('#studentModal .modal-header');
      const hasBody = !!document.querySelector('#studentModal .modal-body');
      const hasFooter = !!document.querySelector('#studentModal .modal-footer');
      const sectionCards = document.querySelectorAll('#studentModal .form-section-card').length;
      const saveBtnText = document.querySelector('#studentModal .modal-save-btn')?.textContent?.trim();
      return { hasHeader, hasBody, hasFooter, sectionCards, saveBtnText };
    });
    console.log('Estrutura do Modal de Edição:', editModalStructure);

    if (!editModalStructure.hasHeader || !editModalStructure.hasBody || !editModalStructure.hasFooter) {
      throw new Error('Modal de edição não possui header, body ou footer padronizados!');
    }
    if (editModalStructure.sectionCards < 3) {
      throw new Error('Modal de edição não possui seções semânticas form-section-card estruturadas!');
    }

    // Capturar screenshot do Modal de Edição
    await page.screenshot({ path: path.join(brainDir, 'modal-edit-student-desktop.png') });
    console.log('Screenshot salva: modal-edit-student-desktop.png');

    // 4. Testar salvar com feedback visual (loading spinner + success check)
    console.log('Testando feedback visual do botão Salvar...');
    await page.fill('#studentNote', 'Teste automatizado de salvamento com feedback visual.');

    // Clicar em salvar e verificar loading state
    const savePromise = page.click('#studentModal .modal-save-btn');
    
    // Verificar se o botão entrou em loading ou desabilitado
    await page.waitForTimeout(50);
    const isButtonLoading = await page.evaluate(() => {
      const btn = document.querySelector('#studentModal .modal-save-btn');
      return btn.disabled || btn.classList.contains('btn-loading') || btn.textContent.includes('Salvando');
    });
    console.log('Botão entrou em estado de loading imediatamente?', isButtonLoading);

    await savePromise;
    await page.waitForTimeout(1000);

    // Verificar se o modal fechou
    const isEditClosed = !(await page.locator('#studentModal.open').isVisible());
    console.log('Modal de edição fechou após salvar?', isEditClosed);
    if (!isEditClosed) throw new Error('O modal de edição não fechou após salvar!');

    // Verificar se o toast de confirmação foi disparado
    const toastText = await page.evaluate(() => document.getElementById('toast')?.textContent);
    console.log('Toast exibido:', toastText);

    // 5. Testar Mobile Viewport
    console.log('Testando visualização mobile...');
    const mobilePage = await browser.newPage({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true
    });
    await mobilePage.goto(serverUrl);
    await mobilePage.evaluate(() => localStorage.setItem('tlf_admin_pin', '1209'));
    await mobilePage.reload();
    await mobilePage.waitForTimeout(1500);

    await mobilePage.click('button[data-page="students"]');
    await mobilePage.waitForTimeout(500);
    await mobilePage.locator('.student-row').first().click();
    await mobilePage.waitForTimeout(600);

    await mobilePage.screenshot({ path: path.join(brainDir, 'athlete-profile-mobile.png') });
    console.log('Screenshot mobile salva: athlete-profile-mobile.png');

    console.log('\n--- TODOS OS TESTES PASSARAM COM SUCESSO! ---');
  } finally {
    await browser.close();
    server.kill();
  }
}

testModalAndProfile().catch((err) => {
  console.error('ERRO NO TESTE:', err);
  process.exit(1);
});
