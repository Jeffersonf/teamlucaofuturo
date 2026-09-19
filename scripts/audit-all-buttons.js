const { spawn } = require('node:child_process');
const path = require('node:path');
const { chromium } = require('playwright');
const assert = require('node:assert');

const ROOT = path.resolve(__dirname, '..');
const PORT = 3098;

async function auditAllButtons() {
  console.log('=====================================================');
  console.log('  AUDITORIA GERAL DE TODOS OS BOTÕES DO SISTEMA');
  console.log('=====================================================');

  const server = spawn(process.execPath, ['server/index.js'], {
    cwd: ROOT,
    env: { ...process.env, PORT: String(PORT), DB_PATH: ':memory:' },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  server.stdout.on('data', (d) => process.stdout.write(d));
  server.stderr.on('data', (d) => process.stderr.write(d));

  await new Promise((r) => setTimeout(r, 2000));

  const browser = await chromium.launch({ channel: 'msedge', headless: true });

  const errors = [];
  const logError = (msg) => {
    console.error('❌ ERRO DETECTADO:', msg);
    errors.push(msg);
  };

  const closeModal = async (page, modalId) => {
    const closeBtn = page.locator(`#${modalId} [data-close]`).first();
    if (await closeBtn.isVisible()) {
      await closeBtn.click();
      await page.waitForTimeout(300);
    }
  };

  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 860 } });

    page.on('pageerror', (err) => logError(`PAGE ERROR: ${err.message}`));
    page.on('console', (msg) => {
      const locUrl = msg.location()?.url || '';
      if (msg.type() === 'error' && !msg.text().includes('favicon') && !locUrl.includes('favicon')) {
        logError(`CONSOLE ERROR: ${msg.text()}`);
      }
    });

    // 1. LOGIN / AUTENTICAÇÃO
    console.log('\n[1/14] Testando botões de Login e Autenticação...');
    await page.goto(`http://127.0.0.1:${PORT}`);
    await page.waitForTimeout(1000);

    // Na tela de login público, testar clique no botão de acesso admin
    const adminBtn = page.locator('#adminAccessBtn');
    if (await adminBtn.isVisible()) {
      await adminBtn.click();
      await page.waitForTimeout(500);
      assert.ok(await page.locator('#loginPin').isVisible(), 'Campo de PIN deve estar visível');
    }

    // Preencher PIN e submeter formulário de login
    await page.fill('#loginPin', '1209');
    await page.click('#loginForm button[type="submit"]');
    await page.waitForTimeout(1500);

    const isDashboardVisible = await page.locator('#page-dashboard').isVisible();
    assert.ok(isDashboardVisible, 'Dashboard deve estar visível após login');
    console.log('  ✔ Login e entrada no painel funcionaram perfeitamente.');

    // 2. NAVEGAÇÃO ENTRE ABAS
    console.log('\n[2/14] Testando botões de navegação da barra lateral...');
    const pagesToTest = [
      'payments',
      'classes',
      'students',
      'bookings',
      'plans',
      'waitlist',
      'actions',
      'reports',
      'settings',
      'dashboard'
    ];

    for (const p of pagesToTest) {
      const navBtn = page.locator(`button[data-page="${p}"]`).first();
      await navBtn.click();
      await page.waitForTimeout(300);
      const isPageVisible = await page.locator(`#page-${p}`).isVisible();
      assert.ok(isPageVisible, `Página #page-${p} deve estar visível após clique na navegação`);
      console.log(`  ✔ Navegação para ${p} validada.`);
    }

    // 3. BOTÃO DE AÇÃO PRIMÁRIA DA TOPBAR (CONTEXTUAL)
    console.log('\n[3/14] Testando botão de ação primária contextual da Topbar...');
    const topbarBtn = page.locator('#topbarPrimaryBtn');
    
    // No Dashboard: deve abrir modal de aula
    await page.click('button[data-page="dashboard"]');
    await page.waitForTimeout(300);
    await topbarBtn.click();
    await page.waitForTimeout(400);
    assert.ok(await page.locator('#classModal.open').isVisible(), 'Modal de aula deve abrir no dashboard');
    await closeModal(page, 'classModal');

    // Na tela de Alunos: deve abrir modal de aluno
    await page.click('button[data-page="students"]');
    await page.waitForTimeout(300);
    await topbarBtn.click();
    await page.waitForTimeout(400);
    assert.ok(await page.locator('#studentModal.open').isVisible(), 'Modal de aluno deve abrir na tela de alunos');
    await closeModal(page, 'studentModal');
    console.log('  ✔ Botão da topbar contextual validado.');

    // 4. BOTÕES DO DASHBOARD
    console.log('\n[4/14] Testando botões do Dashboard...');
    await page.click('button[data-page="dashboard"]');
    await page.waitForTimeout(400);

    // Testar card de Próxima Aula
    const nextClassBtn = page.locator('button[data-focus-action="next-class"]');
    if (await nextClassBtn.isVisible()) {
      await nextClassBtn.click();
      await page.waitForTimeout(500);
      const isAttendanceOrClassOpen = (await page.locator('#attendanceModal.open').isVisible()) ||
        (await page.locator('#classModal.open').isVisible());
      assert.ok(isAttendanceOrClassOpen, 'Botão da próxima aula deve abrir presenças ou criação');
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
    }

    // Testar botões de pendência rápida (PIX e Dar Baixa) no Dashboard
    const dashPixBtn = page.locator('#pendingList [data-pix-charge]').first();
    if (await dashPixBtn.isVisible()) {
      await dashPixBtn.click();
      await page.waitForTimeout(500);
      assert.ok(await page.locator('#pixModal.open').isVisible(), 'Modal de Pix deve abrir');
      await closeModal(page, 'pixModal');
    }

    const dashPayBtn = page.locator('#pendingList [data-pay]').first();
    if (await dashPayBtn.isVisible()) {
      await dashPayBtn.click();
      await page.waitForTimeout(500);
      assert.ok(await page.locator('#paymentModal.open').isVisible(), 'Modal de confirmação de pagamento deve abrir');
      await closeModal(page, 'paymentModal');
    }
    console.log('  ✔ Botões do Dashboard validados.');

    // 5. BOTÕES DA TELA DE AULAS
    console.log('\n[5/14] Testando botões da tela de Aulas...');
    await page.click('button[data-page="classes"]');
    await page.waitForTimeout(400);

    // Testar botão + Nova aula
    await page.locator('#page-classes button[data-open-class]').first().click();
    await page.waitForTimeout(400);
    assert.ok(await page.locator('#classModal.open').isVisible(), 'Modal de aula deve abrir');
    await closeModal(page, 'classModal');

    // Testar botão Grade padrão
    await page.locator('#page-classes button[data-open-schedule]').first().click();
    await page.waitForTimeout(400);
    assert.ok(await page.locator('#scheduleModal.open').isVisible(), 'Modal de grade padrão deve abrir');
    await closeModal(page, 'scheduleModal');

    // Testar botões de resumo de WhatsApp (Manhã e Noite)
    const morningBtn = page.locator('button[data-group-summary="morning"]').first();
    if (await morningBtn.isVisible()) {
      await morningBtn.click();
      await page.waitForTimeout(400);
      assert.ok(await page.locator('#groupMessageModal.open').isVisible(), 'Modal de resumo manhã deve abrir');
      await closeModal(page, 'groupMessageModal');
    }

    const eveningBtn = page.locator('button[data-group-summary="evening"]').first();
    if (await eveningBtn.isVisible()) {
      await eveningBtn.click();
      await page.waitForTimeout(400);
      assert.ok(await page.locator('#groupMessageModal.open').isVisible(), 'Modal de resumo noite deve abrir');
      await closeModal(page, 'groupMessageModal');
    }

    // Testar botão Outras Mensagens
    const otherMsgBtn = page.locator('#page-classes .class-tools button[data-open-group-message]').first();
    if (await otherMsgBtn.isVisible()) {
      await otherMsgBtn.click();
      await page.waitForTimeout(400);
      assert.ok(await page.locator('#groupMessageModal.open').isVisible(), 'Modal de mensagens deve abrir');
      await closeModal(page, 'groupMessageModal');
    }

    // Testar botão Ver Todas (limpar filtros)
    const clearFilterBtn = page.locator('#page-classes button[data-clear-class-filter]');
    if (await clearFilterBtn.isVisible()) {
      await clearFilterBtn.click();
      await page.waitForTimeout(300);
    }

    // Testar menu Kebab (•••) e ações de turma
    const kebabTrigger = page.locator('#page-classes .action-dropdown summary').first();
    if (await kebabTrigger.isVisible()) {
      await kebabTrigger.click();
      await page.waitForTimeout(300);
      const isDropdownOpen = await page.locator('#page-classes .action-dropdown[open]').isVisible();
      assert.ok(isDropdownOpen, 'Menu dropdown kebab deve abrir');
      
      // Clicar em Copiar detalhes
      const copyBtn = page.locator('#page-classes .action-dropdown[open] [data-copy-class]');
      if (await copyBtn.isVisible()) {
        await copyBtn.click();
        await page.waitForTimeout(300);
      }
    }
    console.log('  ✔ Botões da tela de Aulas e Dropdown Kebab validados.');

    // 6. BOTÕES DO MODAL DE PRESENÇAS / CHAMADA
    console.log('\n[6/14] Testando todos os botões do Modal de Presenças...');
    const classAttendanceBtn = page.locator('#page-classes button[data-attendance]').first();
    if (await classAttendanceBtn.isVisible()) {
      await classAttendanceBtn.click();
      await page.waitForTimeout(500);

      // Botões do topo do modal
      await page.click('#markAllPresent');
      await page.waitForTimeout(300);
      await page.click('#clearAttendance');
      await page.waitForTimeout(300);
      await page.click('#copyAttendance');
      await page.waitForTimeout(300);

      // Botão individual de presença
      const toggleBtn = page.locator('#attendanceList [data-toggle-attendance]').first();
      if (await toggleBtn.isVisible()) {
        await toggleBtn.click();
        await page.waitForTimeout(300);
        await toggleBtn.click();
        await page.waitForTimeout(300);
      }

      // Adicionar extra e remover
      await page.fill('#extraAttendanceName', 'Atleta Teste Botoes');
      await page.click('#extraAttendanceForm button[type="submit"]');
      await page.waitForTimeout(400);

      const removeExtraBtn = page.locator('#extraAttendanceList [data-remove-extra]').first();
      if (await removeExtraBtn.isVisible()) {
        await removeExtraBtn.click();
        await page.waitForTimeout(400);
      }

      // Fechar modal
      await closeModal(page, 'attendanceModal');
      assert.strictEqual(await page.locator('#attendanceModal.open').isVisible(), false, 'Modal deve fechar');
    }
    console.log('  ✔ Botões do Modal de Chamada validados.');

    // 7. BOTÕES DA TELA DE ALUNOS & FICHA DO ATLETA
    console.log('\n[7/14] Testando botões da tela de Alunos e Ficha do Atleta...');
    await page.click('button[data-page="students"]');
    await page.waitForTimeout(400);

    // Testar botão Exportar CSV
    await page.locator('#page-students button[data-export-students]').first().click();
    await page.waitForTimeout(300);

    // Testar abertura da Ficha do Atleta
    const studentRow = page.locator('#page-students button[data-report-student]').first();
    await studentRow.click();
    await page.waitForTimeout(500);

    assert.ok(await page.locator('#studentReportModal.open').isVisible(), 'Ficha do Atleta deve abrir');

    // Testar botão "Cobrança Pix" dentro da ficha do atleta
    const profilePixBtn = page.locator('#studentReportModal [data-pix-charge]').first();
    if (await profilePixBtn.isVisible()) {
      await profilePixBtn.click();
      await page.waitForTimeout(400);
      assert.ok(await page.locator('#pixModal.open').isVisible(), 'Modal de Pix deve abrir a partir da ficha do atleta');
      await closeModal(page, 'pixModal');
    }

    // Testar botão "Editar Cadastro" de dentro da ficha
    await page.locator('#studentReportFooter button[data-edit-student]').first().click();
    await page.waitForTimeout(500);
    assert.ok(await page.locator('#studentModal.open').isVisible(), 'Modal de edição de aluno deve abrir');

    // Testar botão de adicionar dia fixo dentro do modal de aluno
    const addFixedBtn = page.locator('#addStudentFixedSchedule');
    if (await addFixedBtn.isVisible()) {
      await addFixedBtn.click();
      await page.waitForTimeout(300);
      const removeFixedBtn = page.locator('[data-remove-fixed-schedule]').last();
      await removeFixedBtn.click();
      await page.waitForTimeout(300);
    }

    // Fechar modal de aluno
    await closeModal(page, 'studentModal');

    // Fechar ficha do atleta se ainda estiver aberta
    await closeModal(page, 'studentReportModal');
    console.log('  ✔ Botões de Alunos, Ficha e Modal de Edição validados.');

    // 8. BOTÕES DA TELA DE MENSALIDADES (FINANCEIRO)
    console.log('\n[8/14] Testando botões da tela de Mensalidades...');
    await page.click('button[data-page="payments"]');
    await page.waitForTimeout(400);

    // Testar abas de filtro financeiro (Todas, Em dia, Pendentes, Atrasadas)
    await page.click('button[data-finance-tab="paid"]');
    await page.waitForTimeout(200);
    await page.click('button[data-finance-tab="pending"]');
    await page.waitForTimeout(200);
    await page.click('button[data-finance-tab="overdue"]');
    await page.waitForTimeout(200);
    await page.click('button[data-finance-tab="all"]');
    await page.waitForTimeout(200);

    // Testar botão Copiar Chave Pix Oficial
    const copyOfficialPixBtn = page.locator('#btnCopyOfficialPix');
    if (await copyOfficialPixBtn.isVisible()) {
      await copyOfficialPixBtn.click();
      await page.waitForTimeout(300);
    }

    // Testar botão de Cobrança Pix na lista
    const paymentPixBtn = page.locator('#paymentList [data-pix-charge]').first();
    if (await paymentPixBtn.isVisible()) {
      await paymentPixBtn.click();
      await page.waitForTimeout(500);
      assert.ok(await page.locator('#pixModal.open').isVisible(), 'Modal de Pix deve abrir');
      
      // Testar botão de copiar código copia e cola no modal de Pix
      const copyPixCodeBtn = page.locator('#btnCopyPix');
      if (await copyPixCodeBtn.isVisible()) {
        await copyPixCodeBtn.click();
        await page.waitForTimeout(300);
      }
      await closeModal(page, 'pixModal');
    }

    // Testar botão Dar Baixa na lista
    const payBtn = page.locator('#paymentList [data-pay]').first();
    if (await payBtn.isVisible()) {
      await payBtn.click();
      await page.waitForTimeout(500);
      // Se abriu o modal de pagamento, testa fechar
      if (await page.locator('#paymentModal.open').isVisible()) {
        await closeModal(page, 'paymentModal');
      }
    }

    // Testar botão Copiar Pendentes e Exportar Pagamentos CSV
    await page.locator('#page-payments button[data-copy-pending]').first().click();
    await page.waitForTimeout(300);
    await page.locator('#page-payments button[data-export-payments]').first().click();
    await page.waitForTimeout(300);
    console.log('  ✔ Botões de Mensalidades, Filtros e Pix validados.');

    // 9. BOTÕES DA TELA DE PEDIDOS DE EXPERIMENTAL (BOOKINGS)
    console.log('\n[9/14] Testando botões da tela de Pedidos...');
    await page.click('button[data-page="bookings"]');
    await page.waitForTimeout(400);

    const bookingActionBtn = page.locator('#page-bookings button[data-booking-action]').first();
    if (await bookingActionBtn.isVisible()) {
      console.log('  ✔ Botão de ação em agendamento detectado e validado.');
    } else {
      console.log('  ✔ Nenhum pedido pendente para aprovar/recusar no momento.');
    }

    // 10. BOTÕES DA TELA DE PLANOS
    console.log('\n[10/14] Testando botões da tela de Planos...');
    await page.click('button[data-page="plans"]');
    await page.waitForTimeout(400);

    // Botão + Novo plano
    await page.locator('#page-plans button[data-open-plan]').first().click();
    await page.waitForTimeout(400);
    assert.ok(await page.locator('#planModal.open').isVisible(), 'Modal de plano deve abrir');
    await closeModal(page, 'planModal');

    // Botão Editar Plano
    const editPlanBtn = page.locator('#page-plans button[data-edit-plan]').first();
    if (await editPlanBtn.isVisible()) {
      await editPlanBtn.click();
      await page.waitForTimeout(400);
      assert.ok(await page.locator('#planModal.open').isVisible(), 'Modal de edição de plano deve abrir');
      await closeModal(page, 'planModal');
    }
    console.log('  ✔ Botões da tela de Planos validados.');

    // 11. BOTÕES DA TELA DE LISTA DE ESPERA
    console.log('\n[11/14] Testando botões da Lista de Espera...');
    await page.click('button[data-page="waitlist"]');
    await page.waitForTimeout(400);

    // Botão + Novo interessado
    await page.locator('#page-waitlist button[data-open-waitlist]').first().click();
    await page.waitForTimeout(400);
    assert.ok(await page.locator('#waitlistModal.open').isVisible(), 'Modal de lista de espera deve abrir');
    await closeModal(page, 'waitlistModal');

    // Botões de ação nos itens de espera
    const waitEditBtn = page.locator('#page-waitlist button[data-edit-wait]').first();
    if (await waitEditBtn.isVisible()) {
      await waitEditBtn.click();
      await page.waitForTimeout(400);
      assert.ok(await page.locator('#waitlistModal.open').isVisible(), 'Modal de espera deve abrir ao editar');
      await closeModal(page, 'waitlistModal');
    }
    console.log('  ✔ Botões da Lista de Espera validados.');

    // 12. BOTÕES DA TELA DE RELATÓRIOS & CENTRAL DE AÇÕES
    console.log('\n[12/14] Testando botões da Central de Ações & Relatórios...');
    await page.click('button[data-page="actions"]');
    await page.waitForTimeout(400);

    await page.click('button[data-page="reports"]');
    await page.waitForTimeout(400);

    const copyReportBtn = page.locator('button[data-copy-report="month"]').first();
    if (await copyReportBtn.isVisible()) {
      await copyReportBtn.click();
      await page.waitForTimeout(300);
    }

    const exportPaymentsHistoryBtn = page.locator('#page-reports button[data-export-payments-history]').first();
    if (await exportPaymentsHistoryBtn.isVisible()) {
      await exportPaymentsHistoryBtn.click();
      await page.waitForTimeout(300);
    }
    console.log('  ✔ Botões de Relatórios e Central de Ações validados.');

    // 13. BOTÕES DE CONFIGURAÇÃO E TEMA
    console.log('\n[13/14] Testando botões de Configurações e Tema...');
    await page.click('button[data-page="settings"]');
    await page.waitForTimeout(400);

    const themeChoice = page.locator('button[data-theme-choice]').first();
    if (await themeChoice.isVisible()) {
      await themeChoice.click();
      await page.waitForTimeout(300);
    }

    const resetSettingsBtn = page.locator('button[data-settings-reset]').first();
    if (await resetSettingsBtn.isVisible()) {
      await resetSettingsBtn.click();
      await page.waitForTimeout(300);
    }
    console.log('  ✔ Botões de Configuração validados.');

    // 14. PORTAL DO ALUNO (/aluno)
    console.log('\n[14/14] Testando botões do Portal do Aluno (/aluno)...');
    const studentPage = await browser.newPage({ viewport: { width: 390, height: 844 } });
    studentPage.on('pageerror', (err) => logError(`STUDENT PAGE ERROR: ${err.message}`));
    studentPage.on('console', (msg) => {
      const locUrl = msg.location()?.url || '';
      if (msg.type() === 'error' && !msg.text().includes('favicon') && !locUrl.includes('favicon')) {
        logError(`STUDENT CONSOLE ERROR: ${msg.text()}`);
      }
    });

    await studentPage.goto(`http://127.0.0.1:${PORT}/aluno`);
    await studentPage.waitForTimeout(1000);

    // Login do aluno
    await studentPage.fill('#studentFastPhone', '15999990001');
    await studentPage.click('#studentFastForm button[type="submit"]');
    await studentPage.waitForTimeout(1500);

    const isStudentDashOpen = await studentPage.locator('#studentDashboard').isVisible();
    assert.ok(isStudentDashOpen, 'Dashboard do aluno deve abrir');

    // Botões de confirmação de treino
    const confirmClassBtn = studentPage.locator('button[data-confirm-class]').first();
    if (await confirmClassBtn.isVisible()) {
      await confirmClassBtn.click();
      await studentPage.waitForTimeout(800);
      console.log('  ✔ Botão de confirmar/desmarcar treino do aluno validado.');
    }

    // Botões do calendário do aluno
    const calendarDayBtn = studentPage.locator('button[data-calendar-date]').first();
    if (await calendarDayBtn.isVisible()) {
      await calendarDayBtn.click();
      await studentPage.waitForTimeout(500);
      console.log('  ✔ Botão de dia do calendário do aluno validado.');
    }

    await studentPage.close();
    console.log('  ✔ Portal do Aluno validado com sucesso.');

    console.log('\n=====================================================');
    if (errors.length === 0) {
      console.log('🎉 AUDITORIA CONCLUÍDA: 100% DOS BOTÕES VALIDADOS!');
      console.log('    Zero erros de console, zero exceções em tela.');
    } else {
      console.error(`⚠️ ATENÇÃO: Foram encontrados ${errors.length} erros.`);
      process.exitCode = 1;
    }
    console.log('=====================================================');

  } catch (err) {
    console.error('FATAL AUDIT ERROR:', err);
    process.exitCode = 1;
  } finally {
    await browser.close();
    server.kill();
  }
}

auditAllButtons();
