// modules/students.js - Módulo de gestão, filtragem e ficha completa dos alunos
'use strict';

/**
 * Renderiza a listagem de alunos com busca e filtros
 */
/**
 * Renderiza a listagem de alunos com busca e filtros
 */
export function renderStudents(ctx) {
  const kpiTarget = document.getElementById('studentsKpiGrid');
  if (kpiTarget) {
    const all = ctx.state.students || [];
    const active = all.filter((s) => s.status === 'Ativo');
    const trials = all.filter((s) => s.status === 'Experimental');
    const paused = all.filter((s) => s.status === 'Pausado');
    const currentMonth = ctx.currentMonth();
    const paidActive = active.filter((s) => ctx.isPaidForMonth(s, currentMonth));
    const rate = active.length ? Math.round((paidActive.length / active.length) * 100) : 100;

    kpiTarget.innerHTML = `
      <div class="kpi-card">
        <div class="finance-kpi-header">
          <span class="kpi-card-label">Total Cadastrados</span>
          <div class="finance-kpi-icon">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
          </div>
        </div>
        <div class="kpi-card-value">${all.length}</div>
        <div class="finance-kpi-footer">
          <span class="trend-pill neutral">base geral</span>
          <span class="meta">${paused.length} pausado(s)</span>
        </div>
      </div>

      <div class="kpi-card highlight">
        <div class="finance-kpi-header">
          <span class="kpi-card-label">Alunos Ativos</span>
          <div class="finance-kpi-icon">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          </div>
        </div>
        <div class="kpi-card-value">${active.length}</div>
        <div class="finance-kpi-footer">
          <span class="trend-pill up">grade regular</span>
          <span class="meta">${active.length === 1 ? '1 atleta frequente' : `${active.length} atletas frequentes`}</span>
        </div>
      </div>

      <div class="kpi-card ${trials.length ? 'highlight' : ''}">
        <div class="finance-kpi-header">
          <span class="kpi-card-label">Experimentais</span>
          <div class="finance-kpi-icon">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 14 14"/></svg>
          </div>
        </div>
        <div class="kpi-card-value">${trials.length}</div>
        <div class="finance-kpi-footer">
          <span class="trend-pill ${trials.length ? 'warn' : 'neutral'}">${trials.length ? 'em conversão' : 'sem teste'}</span>
          <span class="meta">potenciais matrículas</span>
        </div>
      </div>

      <div class="kpi-card">
        <div class="finance-kpi-header">
          <span class="kpi-card-label">Adimplência do Mês</span>
          <div class="finance-kpi-icon">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" x2="12" y1="2" y2="22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
          </div>
        </div>
        <div class="kpi-card-value">${rate}%</div>
        <div class="finance-kpi-footer">
          <span class="trend-pill ${rate >= 80 ? 'up' : rate >= 50 ? 'warn' : 'down'}">${paidActive.length}/${active.length || 0} em dia</span>
          <span class="meta">mensalidades pagas</span>
        </div>
      </div>
    `;
  }

  const query = document.getElementById('studentSearch')?.value.trim().toLowerCase() || '';
  const status = document.getElementById('studentStatusFilter')?.value || '';
  const payment = document.getElementById('studentPaymentFilter')?.value || '';
  const signature = `${ctx.stateVersion}|${query}|${status}|${payment}|${ctx.studentVisibleLimit}`;
  if (!ctx.shouldRender('students', signature)) return;

  const students = ctx.state.students.filter((student) => {
    const haystack = `${student.nome} ${student.telefone} ${student.plano_nome} ${student.nivel} ${student.status}`.toLowerCase();
    const matchesQuery = haystack.includes(query);
    const matchesStatus = !status || student.status === status;
    const matchesPayment = !payment || (payment === 'paid' ? ctx.isPaid(student) : !ctx.isPaid(student));
    return matchesQuery && matchesStatus && matchesPayment;
  });

  const visible = students.slice(0, ctx.studentVisibleLimit);
  const grid = document.getElementById('studentGrid');
  if (grid) {
    grid.innerHTML = students.length ? `
      <div class="student-list-head" aria-hidden="true">
        <span>Aluno</span>
        <span>Plano</span>
        <span>Agenda</span>
        <span>Pagamento</span>
        <span>Ações</span>
      </div>
      ${visible.map((s) => studentCard(ctx, s)).join('')}
      ${students.length > visible.length ? `
        <button class="soft-btn list-more-btn" type="button" data-action="students-more">
          Mostrar mais ${Math.min(ctx.LIST_PAGE_SIZE, students.length - visible.length)} de ${students.length - visible.length}
        </button>
      ` : ''}
    ` : ctx.empty('Nenhum aluno encontrado.');
  }
}

/**
 * Renderiza o card individual de um aluno na listagem
 */
export function studentCard(ctx, student) {
  const message = `Oi ${student.nome}, tudo bem? Aqui é do Team Lucão.`;
  const weekly = ctx.weeklyAttendanceCount(student.id);
  const target = ctx.planWeeklyTarget(student);
  const paid = ctx.isPaid(student);
  const schedule = ctx.fixedScheduleText(student);
  const initials = student.nome ? student.nome.split(' ').filter(Boolean).map((n) => n[0]).slice(0, 2).join('').toUpperCase() : 'AL';

  return `
    <article class="student-row status-${ctx.cssToken(student.status || 'Ativo')} payment-${paid ? 'paid' : 'pending'}" data-report-student="${student.id}" style="cursor: pointer;" title="Clique para abrir a ficha completa de ${ctx.escapeHTML(student.nome)}">
      <div class="student-main">
        <div style="display: flex; align-items: center; gap: 10px;">
          <div style="width: 36px; height: 36px; border-radius: 11px; background: rgba(220,38,38,0.14); border: 1px solid rgba(220,38,38,0.25); color: #ef4444; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 13px; flex-shrink: 0;">
            ${initials}
          </div>
          <div>
            <button class="link-title compact-title" type="button" data-report-student="${student.id}">${ctx.escapeHTML(student.nome)}</button>
            <p class="meta">${ctx.escapeHTML(student.telefone || 'sem telefone')} • vence dia ${ctx.dueDay(student)}</p>
          </div>
        </div>
      </div>
      <div class="student-plan">
        <strong>${ctx.escapeHTML(student.plano_nome || 'Sem plano')}</strong>
        <p class="meta">${ctx.money.format(Number(student.mensalidade || 0))}/mês • ${ctx.escapeHTML(student.nivel || 'Iniciante')}</p>
        <span class="pill ${student.status === 'Ativo' ? 'ok' : student.status === 'Experimental' ? 'warn' : ''}">
          <span class="status-dot-6px ${student.status === 'Ativo' ? 'green' : student.status === 'Experimental' ? 'amber' : 'gray'}" style="margin-right: 4px;"></span>
          ${ctx.escapeHTML(student.status || 'Ativo')}
        </span>
      </div>
      <div class="student-frequency">
        <strong>${weekly}/${target || '-'}</strong>
        <p class="meta">${ctx.escapeHTML(schedule || 'Sem agenda fixa')}</p>
      </div>
      <div class="student-payment">
        <span class="pill ${paid ? 'ok' : 'bad'}">
          <span class="status-dot-6px ${paid ? 'green' : 'red'}" style="margin-right: 4px;"></span>
          ${paid ? 'em dia' : 'pendente'}
        </span>
        <p class="meta">${paid ? `pago até ${ctx.formatDate(student.pago_ate)}` : 'sem registro do mês'}</p>
      </div>
      <div class="actions student-actions">
        ${student.telefone ? `<a class="mini-btn" href="${ctx.whatsappUrl(student.telefone, message)}" target="_blank" rel="noopener" title="Abrir WhatsApp">WhatsApp</a>` : ''}
        ${!paid ? `<button class="mini-btn" style="color:#ef4444; border-color:rgba(220,38,38,0.3); background:rgba(220,38,38,0.08);" data-pix-charge="${student.id}" title="Cobrar PIX">PIX</button>` : ''}
        <button class="mini-btn" data-edit-student="${student.id}" title="Editar cadastro">Editar</button>
        <button class="mini-btn" data-pay="${student.id}">${paid ? 'Desmarcar' : 'Dar Baixa'}</button>
      </div>
    </article>
  `;
}

/**
 * Abre o modal de cadastro/edição de aluno
 */
export function openStudent(ctx, id = '') {
  const student = ctx.studentById(id) || {};
  document.getElementById('studentId').value = student.id || '';
  document.getElementById('studentName').value = student.nome || '';
  document.getElementById('studentPhone').value = student.telefone || '';
  document.getElementById('studentEmail').value = student.email || '';
  ctx.renderPlanOptions(student.plano_id || '');
  document.getElementById('studentFee').value = student.mensalidade || '';
  document.getElementById('studentDueDay').value = student.dia_vencimento || student.vencimento_dia || 10;
  document.getElementById('studentLevel').value = student.nivel || 'Iniciante';
  document.getElementById('studentStatus').value = student.status || 'Ativo';
  document.getElementById('studentNote').value = student.observacao || '';
  ctx.renderStudentFixedScheduleRows(ctx.fixedSchedules(student));
  ctx.renderStudentSchedulePreview();
  const title = document.getElementById('studentModalTitle');
  if (title) title.textContent = id ? 'Editar Aluno' : 'Novo Aluno';
  ctx.openModal('studentModal');
}

/**
 * Abre a Ficha Completa do Atleta (Perfil do Aluno)
 */
export function openStudentReport(ctx, id) {
  const student = ctx.studentById(id);
  if (!student) return;
  const summary = ctx.attendanceSummary(id);
  const weekly = ctx.weeklyAttendanceCount(id);
  const target = ctx.planWeeklyTarget(student);
  const nextClasses = (summary.history || []).filter((item) => item.data >= ctx.todayISO()).slice(0, 5);
  const recentClasses = [...(summary.history || [])].filter((item) => item.data < ctx.todayISO()).reverse().slice(0, 5);
  const payments = (ctx.state.payments || [])
    .filter((item) => String(item.aluno_id) === String(id))
    .sort((a, b) => String(b.pago_em || b.vencimento || '').localeCompare(String(a.pago_em || a.vencimento || '')))
    .slice(0, 5);
  const paid = ctx.isPaid(student);
  const plan = student.plano_nome ? `${ctx.escapeHTML(student.plano_nome)} • ${ctx.money.format(Number(student.mensalidade || 0))}/mês` : 'Sem plano associado';
  const nextAction = ctx.studentNextAction(student, weekly, target, nextClasses);
  const initials = student.nome ? student.nome.split(' ').filter(Boolean).map((n) => n[0]).slice(0, 2).join('').toUpperCase() : 'AL';
  const attendanceRate = summary.enrolled ? Math.round((summary.present / summary.enrolled) * 100) : 0;
  const fixedSchedule = ctx.fixedScheduleText(student);

  const targetElem = document.getElementById('studentReport');
  if (targetElem) {
    targetElem.innerHTML = `
      <div class="athlete-profile-view">
        <!-- 1. HERO DO ATLETA -->
        <div class="athlete-hero">
          <div class="athlete-avatar">${initials}</div>
          <div class="athlete-info">
            <h3 class="athlete-name">${ctx.escapeHTML(student.nome)}</h3>
            <div class="athlete-contacts">
              ${student.telefone ? `
                <a class="athlete-contact-link" href="${ctx.whatsappUrl(student.telefone, `Oi ${student.nome}, tudo bem? Aqui é do Team Lucão.`)}" target="_blank" rel="noopener">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                  <span>${ctx.escapeHTML(student.telefone)}</span>
                </a>
              ` : '<span class="athlete-contact-link">Sem telefone</span>'}
              ${student.email ? `
                <span class="athlete-contact-link">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                  <span>${ctx.escapeHTML(student.email)}</span>
                </span>
              ` : ''}
              <span class="athlete-contact-link">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
                <span>Vence dia ${ctx.dueDay(student)}</span>
              </span>
            </div>
            <div class="athlete-badges">
              <span class="athlete-badge status-${ctx.cssToken(student.status || 'Ativo')}">
                <span class="status-dot-6px ${student.status === 'Ativo' ? 'green' : student.status === 'Experimental' ? 'amber' : 'gray'}"></span>
                ${ctx.escapeHTML(student.status || 'Ativo')}
              </span>
              <span class="athlete-badge">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 14 14"/></svg>
                ${ctx.escapeHTML(student.nivel || 'Iniciante')}
              </span>
              <span class="athlete-badge">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>
                ${plan}
              </span>
              ${fixedSchedule ? `
                <span class="athlete-badge">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                  ${ctx.escapeHTML(fixedSchedule)}
                </span>
              ` : ''}
            </div>
          </div>
        </div>

        <!-- 2. STATUS FINANCEIRO COM AÇÕES RÁPIDAS -->
        <div class="athlete-pay-banner ${paid ? 'paid' : 'pending'}">
          <div class="athlete-pay-left">
            <div class="athlete-pay-icon">
              ${paid ? `
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
              ` : `
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              `}
            </div>
            <div>
              <p class="athlete-pay-title">${paid ? 'Mensalidade em Dia' : 'Mensalidade Pendente'}</p>
              <p class="athlete-pay-sub">${paid ? `Pago até ${ctx.formatDate(student.pago_ate)} • Próximo vencimento no dia ${ctx.dueDay(student)}` : `Vencimento no dia ${ctx.dueDay(student)} • Valor de ${ctx.money.format(Number(student.mensalidade || 0))}`}</p>
            </div>
          </div>
          <div class="athlete-pay-actions">
            ${!paid ? `
              <button class="primary-btn" style="height:36px; font-size:12px; border-radius:10px; padding:0 14px;" data-pix-charge="${student.id}">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:4px;"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M8 7v7M16 7v7M12 11h4M7 11h1"/></svg>
                <span>Gerar PIX</span>
              </button>
            ` : ''}
            <button class="soft-btn" style="height:36px; font-size:12px; border-radius:10px; padding:0 14px;" data-pay="${student.id}">
              ${paid ? 'Desmarcar Pagamento' : 'Dar Baixa Manual'}
            </button>
            ${student.telefone && !paid ? `
              <a class="soft-btn" style="height:36px; font-size:12px; border-radius:10px; padding:0 14px;" href="${ctx.whatsappUrl(student.telefone, `Oi ${student.nome}, tudo bem? Segue a chave PIX para acerto da mensalidade de futevôlei da Arena Team Lucão.`)}" target="_blank" rel="noopener">
                Cobrar no WhatsApp
              </a>
            ` : ''}
          </div>
        </div>

        <!-- 3. KPIS DE PERFORMANCE & FREQUÊNCIA -->
        <div class="athlete-kpi-grid">
          <div class="athlete-kpi-card">
            <span class="athlete-kpi-label">Semana Atual</span>
            <strong class="athlete-kpi-val">${weekly}/${target || '-'}</strong>
            <small class="athlete-kpi-sub">meta de treinos semanais</small>
          </div>
          <div class="athlete-kpi-card">
            <span class="athlete-kpi-label">Total de Presenças</span>
            <strong class="athlete-kpi-val">${summary.present}</strong>
            <small class="athlete-kpi-sub">de ${summary.enrolled} aulas marcadas</small>
          </div>
          <div class="athlete-kpi-card">
            <span class="athlete-kpi-label">Taxa de Assiduidade</span>
            <strong class="athlete-kpi-val">${attendanceRate}%</strong>
            <small class="athlete-kpi-sub">frequência registrada</small>
          </div>
          <div class="athlete-kpi-card">
            <span class="athlete-kpi-label">Diagnóstico</span>
            <strong class="athlete-kpi-val" style="font-size: 15px; color: ${nextAction.className === 'bad' ? '#ef4444' : nextAction.className === 'warn' ? '#fbbf24' : '#34d399'};">${ctx.escapeHTML(nextAction.label)}</strong>
            <small class="athlete-kpi-sub">${ctx.escapeHTML(nextAction.detail)}</small>
          </div>
        </div>

        <!-- 4. GRADE: PRÓXIMAS AULAS & HISTÓRICO RECENTE -->
        <div class="athlete-two-col">
          <div class="athlete-section">
            <div class="athlete-section-title">
              <span>Próximos Treinos Agendados</span>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            </div>
            <div class="athlete-list">
              ${nextClasses.length ? nextClasses.map((item) => `
                <div class="athlete-item-row">
                  <div class="athlete-item-main">
                    <strong>${ctx.formatDate(item.data)} às ${ctx.escapeHTML(item.horario)}</strong>
                    <small>${ctx.escapeHTML(item.turma || 'Turma Arena')}</small>
                  </div>
                  <span class="pill ok">Confirmado</span>
                </div>
              `).join('') : '<p style="font-size:12px; color:#a1a1aa; margin:8px 0;">Nenhuma aula futura agendada.</p>'}
            </div>
          </div>

          <div class="athlete-section">
            <div class="athlete-section-title">
              <span>Histórico Recente de Presença</span>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
            </div>
            <div class="athlete-list">
              ${recentClasses.length ? recentClasses.map((item) => `
                <div class="athlete-item-row">
                  <div class="athlete-item-main">
                    <strong>${ctx.formatDate(item.data)} às ${ctx.escapeHTML(item.horario)}</strong>
                    <small>${ctx.escapeHTML(item.turma || 'Turma Arena')}</small>
                  </div>
                  <span class="pill ${item.wasPresent ? 'ok' : 'bad'}">${item.wasPresent ? 'Presente' : 'Faltou'}</span>
                </div>
              `).join('') : '<p style="font-size:12px; color:#a1a1aa; margin:8px 0;">Sem registros de aulas passadas.</p>'}
            </div>
          </div>
        </div>

        <!-- 5. HISTÓRICO FINANCEIRO / MENSALIDADES -->
        <div class="athlete-section">
          <div class="athlete-section-title">
            <span>Últimos Pagamentos Registrados</span>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>
          </div>
          <div class="athlete-list">
            ${payments.length ? payments.map((p) => `
              <div class="athlete-item-row">
                <div class="athlete-item-main">
                  <strong>Referência: ${ctx.escapeHTML(p.referencia || 'Mês')} • ${ctx.money.format(Number(p.valor || 0))}</strong>
                  <small>Pago em ${ctx.formatDate(p.pago_em)} via ${ctx.escapeHTML(p.forma_pagamento || 'PIX')}${p.observacao ? ` (${ctx.escapeHTML(p.observacao)})` : ''}</small>
                </div>
                <span class="pill ok">Recibo OK</span>
              </div>
            `).join('') : '<p style="font-size:12px; color:#a1a1aa; margin:8px 0;">Nenhum pagamento registrado no histórico recente.</p>'}
          </div>
        </div>

        ${student.observacao ? `
          <!-- 6. OBSERVAÇÕES E NOTAS -->
          <div class="athlete-section">
            <div class="athlete-section-title">
              <span>Observações & Restrições</span>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
            </div>
            <p style="font-size:13px; color:#d4d4d8; margin:0; line-height:1.5;">${ctx.escapeHTML(student.observacao)}</p>
          </div>
        ` : ''}
      </div>
    `;
  }

  const footerElem = document.getElementById('studentReportFooter');
  if (footerElem) {
    footerElem.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: space-between; width: 100%; flex-wrap: wrap; gap: 8px;">
        <div style="display: flex; gap: 8px;">
          ${student.telefone ? `<a class="soft-btn" href="${ctx.whatsappUrl(student.telefone, `Oi ${student.nome}, tudo bem? Aqui é do Team Lucão.`)}" target="_blank" rel="noopener">WhatsApp</a>` : ''}
          <button class="soft-btn" data-sync-student="${student.id}">Sincronizar Agenda</button>
          <button class="soft-btn" data-edit-student="${student.id}">Editar Cadastro</button>
        </div>
        <button class="primary-btn" type="button" data-close="studentReportModal">Concluir</button>
      </div>
    `;
  }

  ctx.openModal('studentReportModal');
}

