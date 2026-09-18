// modules/students.js - Módulo de gestão, filtragem e ficha completa dos alunos
'use strict';

/**
 * Renderiza a listagem de alunos com busca e filtros
 */
export function renderStudents(ctx) {
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
  return `
    <article class="student-row status-${ctx.cssToken(student.status || 'Ativo')} payment-${paid ? 'paid' : 'pending'}">
      <div class="student-main">
        <button class="link-title compact-title" type="button" data-report-student="${student.id}">${ctx.escapeHTML(student.nome)}</button>
        <p class="meta">${ctx.escapeHTML(student.telefone || 'sem telefone')} - vence dia ${ctx.dueDay(student)}</p>
      </div>
      <div class="student-plan">
        <strong>${ctx.escapeHTML(student.plano_nome || 'Sem plano')}</strong>
        <p class="meta">${ctx.money.format(Number(student.mensalidade || 0))}/mês - ${ctx.escapeHTML(student.nivel || 'Iniciante')}</p>
        <span class="pill ${student.status === 'Ativo' ? 'ok' : student.status === 'Experimental' ? 'warn' : ''}">${ctx.escapeHTML(student.status || 'Ativo')}</span>
      </div>
      <div class="student-frequency">
        <strong>${weekly}/${target || '-'}</strong>
        <p class="meta">${ctx.escapeHTML(schedule)}</p>
      </div>
      <div class="student-payment">
        <span class="pill ${paid ? 'ok' : 'bad'}">${paid ? 'em dia' : 'pendente'}</span>
        <p class="meta">${paid ? `pago até ${ctx.formatDate(student.pago_ate)}` : 'sem registro do mês'}</p>
      </div>
      <div class="actions student-actions">
        ${student.telefone ? `<a class="mini-btn" href="${ctx.whatsappUrl(student.telefone, message)}" target="_blank" rel="noopener">WhatsApp</a>` : ''}
        ${!paid ? `<button class="mini-btn" style="color:#ef4444; border-color:rgba(220,38,38,0.3); background:rgba(220,38,38,0.08);" data-pix-charge="${student.id}">PIX</button>` : ''}
        <button class="mini-btn" data-edit-student="${student.id}">Editar</button>
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
  document.getElementById('studentLevel').value = student.nivel || '';
  document.getElementById('studentStatus').value = student.status || 'Ativo';
  document.getElementById('studentNote').value = student.observacao || '';
  ctx.renderStudentFixedScheduleRows(ctx.fixedSchedules(student));
  ctx.renderStudentSchedulePreview();
  ctx.openModal('studentModal');
}

/**
 * Abre o relatório e histórico completo do aluno
 */
export function openStudentReport(ctx, id) {
  const student = ctx.studentById(id);
  if (!student) return;
  const summary = ctx.attendanceSummary(id);
  const weekly = ctx.weeklyAttendanceCount(id);
  const target = ctx.planWeeklyTarget(student);
  const nextClasses = summary.history.filter((item) => item.data >= ctx.todayISO()).slice(0, 6);
  const recentClasses = [...summary.history].filter((item) => item.data < ctx.todayISO()).reverse().slice(0, 6);
  const payments = (ctx.state.payments || [])
    .filter((item) => String(item.aluno_id) === String(id))
    .sort((a, b) => String(b.pago_em || b.vencimento || '').localeCompare(String(a.pago_em || a.vencimento || '')))
    .slice(0, 6);
  const paid = ctx.isPaid(student);
  const plan = `${ctx.escapeHTML(student.plano_nome || 'sem plano')} - ${ctx.money.format(Number(student.mensalidade || 0))}/mês`;
  const nextAction = ctx.studentNextAction(student, weekly, target, nextClasses);

  const targetElem = document.getElementById('studentReport');
  if (targetElem) {
    targetElem.innerHTML = `
      <div class="report-hero student-profile ${paid ? 'payment-paid' : 'payment-pending'}">
        <div>
          <span class="section-label">Relatório do aluno</span>
          <h2>${ctx.escapeHTML(student.nome)}</h2>
          <p class="meta">${ctx.escapeHTML(student.telefone || 'sem telefone')} - ${plan} - vence dia ${ctx.dueDay(student)}</p>
          <div class="pill-row">
            <span class="pill ${student.status === 'Ativo' ? 'ok' : student.status === 'Experimental' ? 'warn' : ''}">${ctx.escapeHTML(student.status || 'Ativo')}</span>
            <span class="pill ${nextAction.className}">${ctx.escapeHTML(nextAction.label)}</span>
            <span class="pill">${ctx.escapeHTML(student.nivel || 'sem nível')}</span>
            <span class="pill ${paid ? 'ok' : 'bad'}">${paid ? 'pagamento em dia' : 'pagamento pendente'}</span>
            <span class="pill">${weekly}/${target || '-'} na semana</span>
          </div>
        </div>
        <div class="actions">
          ${student.telefone ? `<a class="mini-btn" href="${ctx.whatsappUrl(student.telefone, `Oi ${student.nome}, tudo bem? Aqui é do Team Lucão.`)}" target="_blank" rel="noopener">WhatsApp</a>` : ''}
          <button class="mini-btn" data-sync-student="${student.id}">Agenda fixa</button>
          <button class="mini-btn" data-edit-student="${student.id}">Editar</button>
          <button class="mini-btn" data-pay="${student.id}">${paid ? 'Desmarcar' : 'Dar Baixa'}</button>
        </div>
      </div>
      <div class="report-grid student-report-grid">
        <article class="mini-stat"><span>Semana atual</span><strong>${weekly}/${target || '-'}</strong></article>
        <article class="mini-stat ${nextAction.className ? `kpi-${nextAction.className}` : ''}"><span>Ação sugerida</span><strong>${ctx.escapeHTML(nextAction.label)}</strong><small>${ctx.escapeHTML(nextAction.detail)}</small></article>
        <article class="mini-stat"><span>Presenças</span><strong>${summary.present}/${summary.enrolled}</strong></article>
      </div>
    `;
  }
  ctx.openModal('studentReportModal');
}
