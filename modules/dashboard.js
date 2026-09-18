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
/**
 * Renderiza a faixa de foco e ação imediata
 */
export function renderFocusStrip(ctx) {
  const target = document.getElementById('focusStrip');
  if (!target) return;
  const index = ctx.getStateIndex();
  const next = ctx.nextClass();
  const lead = ctx.nextWaitLead();
  const pendingBookings = index.pendingBookings;
  const nextStudents = next ? ctx.classStudents(next) : [];
  const nextPresent = next ? nextStudents.filter((student) => next.presencas?.[student.aluno_id || student.id] || student.presente).length : 0;
  const briefTitle = next ? `${next.horario} • ${next.turma || 'Turma'}` : 'Sem aula marcada para agora';
  const briefText = next ? `${ctx.formatDate(next.data)} • ${nextStudents.length}/${next.capacidade || 8} atletas previstos • ${nextPresent} presenças confirmadas` : 'Crie uma aula para iniciar a grade do dia.';

  target.innerHTML = `
    <section class="day-command next-class-panel">
      <div class="day-command-main">
        <div style="display:flex; align-items:center; gap:8px; margin-bottom:6px;">
          <span class="eyebrow" style="color:#f87171; font-weight:700; font-size:11px; letter-spacing:0.06em; text-transform:uppercase; display:flex; align-items:center; gap:5px;">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            Próxima Aula
          </span>
          ${next ? `<span class="pill ok" style="font-size:10px; padding:2px 8px;">Confirmada</span>` : ''}
        </div>
        <h2 style="font-size:20px; font-weight:700; color:#ffffff; margin:0 0 4px; letter-spacing:-0.02em;">${ctx.escapeHTML(briefTitle)}</h2>
        <p class="meta" style="margin:0; font-size:13px; color:#a1a1aa;">${ctx.escapeHTML(briefText)}</p>
      </div>
      <div class="day-command-actions">
        <button class="primary-btn" type="button" data-focus-action="next-class">${next ? 'Abrir chamada' : 'Criar aula'}</button>
        ${pendingBookings.length ? `<button class="soft-btn" type="button" data-focus-action="bookings">Ver pedidos (${pendingBookings.length})</button>` : ''}
        ${lead ? `<button class="soft-btn" type="button" data-focus-action="wait:${lead.id}">Fila de espera</button>` : ''}
      </div>
    </section>
  `;
}

/**
 * Renderiza os KPIs operacionais no padrão Shadcn UI Kit SaaS com alinhamento e simetria perfeitos
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
  const attendanceRate = expectedToday ? Math.round((presentToday / expectedToday) * 100) : 0;

  target.innerHTML = `
    <!-- KPI 1: Aulas Hoje -->
    <div class="kpi-card">
      <div class="finance-kpi-header">
        <span class="kpi-card-label">Aulas Hoje</span>
        <div class="finance-kpi-icon">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="17" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>
        </div>
      </div>
      <div class="kpi-card-value">${todayClasses.length}</div>
      <div class="finance-kpi-footer">
        <span class="trend-pill ${todayClasses.length ? 'up' : 'neutral'}">${expectedToday} previstos</span>
        <span class="meta">${todayClasses.length === 1 ? '1 turma' : `${todayClasses.length} turmas`}</span>
      </div>
    </div>

    <!-- KPI 2: Presenças -->
    <div class="kpi-card">
      <div class="finance-kpi-header">
        <span class="kpi-card-label">Presenças</span>
        <div class="finance-kpi-icon">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
        </div>
      </div>
      <div class="kpi-card-value">${presentToday}/${expectedToday || 0}</div>
      <div class="finance-kpi-footer">
        <span class="trend-pill ${attendanceRate >= 70 ? 'up' : attendanceRate > 0 ? 'warn' : 'neutral'}">${attendanceRate}% taxa</span>
        <span class="meta">${expectedToday ? 'em andamento' : 'sem lista'}</span>
      </div>
    </div>

    <!-- KPI 3: Pedidos & Fila -->
    <div class="kpi-card">
      <div class="finance-kpi-header">
        <span class="kpi-card-label">Pedidos & Fila</span>
        <div class="finance-kpi-icon">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
        </div>
      </div>
      <div class="kpi-card-value">${pendingBookings}</div>
      <div class="finance-kpi-footer">
        <span class="trend-pill ${pendingBookings ? 'warn' : 'up'}">${pendingBookings ? 'pendentes' : 'em dia'}</span>
        <span class="meta">${pendingBookings ? 'ver lista' : 'tudo em dia'}</span>
      </div>
    </div>

    <!-- KPI 4: A Receber -->
    <div class="kpi-card">
      <div class="finance-kpi-header">
        <span class="kpi-card-label">A Receber no Mês</span>
        <div class="finance-kpi-icon">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8M12 6v2m0 8v2"/></svg>
        </div>
      </div>
      <div class="kpi-card-value" style="${pendingStudents.length ? 'color:#ef4444;' : ''}">${pendingStudents.length ? ctx.money.format(pendingValue) : 'R$ 0,00'}</div>
      <div class="finance-kpi-footer">
        <span class="trend-pill ${pendingStudents.length ? 'down' : 'up'}">${pendingStudents.length} pendentes</span>
        <span class="meta">${active} alunos</span>
      </div>
    </div>
  `;
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
 * Renderiza pendências de alunos no dashboard com visual Shadcn
 */
export function renderPending(ctx) {
  const target = document.getElementById('pendingList');
  if (!target) return;
  const students = ctx.getStateIndex().pendingStudents;
  const visible = students.slice(0, 5);
  target.innerHTML = students.length ? `
    ${visible.map((student) => {
      const initials = student.nome ? student.nome.split(' ').filter(Boolean).map((n) => n[0]).slice(0, 2).join('').toUpperCase() : 'AL';
      return `
        <article class="row-card">
          <div style="display:flex; align-items:center; gap:12px; min-width:0;">
            <div style="width:34px; height:34px; border-radius:8px; background:rgba(239,68,68,0.14); border:1px solid rgba(239,68,68,0.28); color:#ef4444; display:flex; align-items:center; justify-content:center; font-weight:700; font-size:12px; flex-shrink:0;">
              ${initials}
            </div>
            <div style="min-width:0; flex:1;">
              <button class="link-title compact-title" type="button" data-report-student="${student.id}">${ctx.escapeHTML(student.nome)}</button>
              <p class="meta">${ctx.escapeHTML(student.plano_nome || 'Sem plano')} • ${ctx.money.format(Number(student.mensalidade || 0))}</p>
              <div class="pill-row" style="margin-top:4px;">
                <span class="pill bad"><span class="online-dot" style="background:#ef4444; margin-right:4px;"></span>pendente</span>
              </div>
            </div>
          </div>
          <div class="actions">
            ${student.telefone ? `<button class="mini-btn" style="color:#ef4444; border-color:rgba(220,38,38,0.3); background:rgba(220,38,38,0.08);" data-pix-charge="${student.id}">PIX</button>` : ''}
            <button class="mini-btn" data-pay="${student.id}">Dar Baixa</button>
          </div>
        </article>
      `;
    }).join('')}
    ${students.length > visible.length ? `<button class="soft-btn dashboard-more-btn" type="button" data-action="quick-pending">Ver ${students.length - visible.length} restante(s)</button>` : ''}
  ` : ctx.empty('Sem pendências financeiras no momento.');
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
