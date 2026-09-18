// modules/dashboard.js - Módulo de renderização e inteligência do Painel do Dia (Dashboard)
'use strict';

/**
 * Renderiza o painel principal do dia
 */
export function renderDashboard(ctx) {
  renderFocusStrip(ctx);
  renderKpis(ctx);
  renderQuickActions(ctx);
  renderTodayClasses(ctx);
  renderPending(ctx);
  renderDashboardActions(ctx);
}

/**
 * Renderiza a faixa de foco e ação imediata
 */
export function renderFocusStrip(ctx) {
  const target = document.getElementById('focusStrip');
  if (!target) return;
  const index = ctx.getStateIndex();
  const next = ctx.nextClass();
  const todayClasses = index.todayClasses;
  const pending = index.activeStudents.filter((student) => !ctx.isPaidForMonth(student, ctx.currentMonth()));
  const pendingValue = pending.reduce((sum, student) => sum + Number(student.mensalidade || 0), 0);
  const lead = ctx.nextWaitLead();
  const pendingBookings = index.pendingBookings;
  const nextStudents = next ? ctx.classStudents(next) : [];
  const nextPresent = next ? nextStudents.filter((student) => next.presencas?.[student.aluno_id || student.id] || student.presente).length : 0;
  const briefTitle = next ? `${next.horario} - ${next.turma || 'Turma'}` : 'Sem aula marcada';
  const briefText = next ? `${ctx.formatDate(next.data)} - ${nextStudents.length}/${next.capacidade || 8} previstos - ${nextPresent}/${nextStudents.length || 0} presentes` : 'Crie a primeira aula do dia para iniciar a operação.';
  target.innerHTML = `
    <section class="day-command focus-${next ? 'live' : 'ok'}">
      <div class="day-command-main">
        <span class="eyebrow">agora</span>
        <h2>${ctx.escapeHTML(briefTitle)}</h2>
        <p>${ctx.escapeHTML(briefText)}</p>
        <div class="pill-row">
          <span class="pill">${todayClasses.length} aula(s) hoje</span>
          <span class="pill ${pendingBookings.length ? 'warn' : 'ok'}">${pendingBookings.length} pedido(s)</span>
          <span class="pill ${pending.length ? 'bad' : 'ok'}">${pending.length ? ctx.money.format(pendingValue) : 'financeiro em dia'}</span>
        </div>
      </div>
      <div class="day-command-actions">
        <button class="primary-btn" type="button" data-focus-action="next-class">${next ? 'Abrir presença' : 'Criar aula'}</button>
        <button class="soft-btn" type="button" data-focus-action="bookings">Pedidos</button>
        <button class="soft-btn" type="button" data-focus-action="${lead ? `wait:${lead.id}` : 'waitlist'}">Espera</button>
      </div>
    </section>
  `;
}

/**
 * Renderiza os KPIs operacionais rápidos
 */
export function renderKpis(ctx) {
  const target = document.getElementById('kpiGrid');
  if (!target) return;
  const index = ctx.getStateIndex();
  const active = ctx.state.students.filter((s) => s.status === 'Ativo').length;
  const todayClasses = index.todayClasses;
  const expectedToday = todayClasses.reduce((sum, item) => sum + ctx.classStudents(item).length, 0);
  const presentToday = todayClasses.reduce((sum, item) => (
    sum + ctx.classStudents(item).filter((student) => item.presencas?.[student.aluno_id || student.id] || student.presente).length
  ), 0);
  const pendingStudents = index.pendingStudents;
  const pendingBookings = index.pendingBookings.length;
  const pendingValue = pendingStudents.reduce((sum, student) => sum + Number(student.mensalidade || 0), 0);
  const items = [
    ['Aulas hoje', todayClasses.length, `${expectedToday} previstos`, todayClasses.length ? '' : 'ok'],
    ['Presenças', `${presentToday}/${expectedToday || 0}`, expectedToday ? 'marcadas hoje' : 'sem lista hoje', expectedToday && presentToday < expectedToday ? 'warn' : 'ok'],
    ['Pedidos', pendingBookings, pendingBookings ? 'aprovar agora' : 'sem pedido aberto', pendingBookings ? 'warn' : 'ok'],
    ['A receber', pendingStudents.length, pendingStudents.length ? ctx.money.format(pendingValue) : `${active} alunos ativos`, pendingStudents.length ? 'bad' : 'ok']
  ];
  target.innerHTML = items.map(([label, value, detail, tone]) => `
    <article class="kpi ${tone ? `kpi-${tone}` : ''}">
      <span>${label}</span>
      <strong>${value}</strong>
      <small>${ctx.escapeHTML(detail)}</small>
    </article>
  `).join('');
}

/**
 * Atalhos rápidos do dashboard
 */
export function renderQuickActions(_ctx) {
  const target = document.getElementById('quickActions');
  if (target) target.innerHTML = '';
}

/**
 * Renderiza a lista de aulas de hoje
 */
export function renderTodayClasses(ctx) {
  const target = document.getElementById('todayClasses');
  if (!target) return;
  const classes = ctx.getStateIndex().todayClasses;
  target.innerHTML = classes.length ? classes.map(ctx.classRow).join('') : ctx.empty('Nenhuma aula marcada para hoje.');
}

/**
 * Renderiza pendências de alunos no dashboard
 */
export function renderPending(ctx) {
  const target = document.getElementById('pendingList');
  if (!target) return;
  const students = ctx.getStateIndex().pendingStudents;
  const visible = students.slice(0, 5);
  target.innerHTML = students.length ? `
    ${visible.map((student) => `
      <article class="row-card">
        <div>
          <button class="link-title compact-title" type="button" data-report-student="${student.id}">${ctx.escapeHTML(student.nome)}</button>
          <p class="meta">${ctx.escapeHTML(student.plano_nome || 'sem plano')} - ${ctx.money.format(Number(student.mensalidade || 0))}</p>
          <div class="pill-row"><span class="pill bad">pagamento pendente</span></div>
        </div>
        <div class="actions"><button class="mini-btn" data-pay="${student.id}">Marcar pago</button></div>
      </article>
    `).join('')}
    ${students.length > visible.length ? `<button class="soft-btn dashboard-more-btn" type="button" data-action="quick-pending">Ver ${students.length - visible.length} restante(s)</button>` : ''}
  ` : ctx.empty('Sem pendências por enquanto.');
}

/**
 * Renderiza o feed de ações recentes
 */
export function renderDashboardActions(ctx) {
  const target = document.getElementById('dashboardActions');
  if (!target) return;
  const items = ctx.sortedActions(6);
  target.innerHTML = items.length ? items.map(ctx.actionRow).join('') : ctx.empty('Nenhuma ação registrada ainda.');
}
