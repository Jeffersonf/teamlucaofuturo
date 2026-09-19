// modules/dashboard.js - Módulo de renderização e inteligência do Painel do Dia (Dashboard SaaS 2026)
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
 * Renderiza a faixa de foco e ação imediata (Live Operational Hero)
 */
export function renderFocusStrip(ctx) {
  const target = document.getElementById('focusStrip');
  if (!target) return;
  const index = ctx.getStateIndex();
  const next = ctx.nextClass();
  const lead = ctx.nextWaitLead();
  const pendingBookings = index.pendingBookings;

  if (!next) {
    target.innerHTML = `
      <section class="day-command next-class-panel">
        <div class="day-command-main">
          <div class="hero-status-row">
            <span class="live-status-pill" style="color:#71717a; border-color:rgba(255,255,255,0.1); background:rgba(255,255,255,0.05);">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              <span>Grade do Dia</span>
            </span>
          </div>
          <h2 class="hero-title">Sem aula marcada para agora</h2>
          <p class="meta hero-subtitle">Crie uma nova aula para iniciar a grade de treinos de hoje.</p>
        </div>
        <div class="day-command-actions">
          <button class="primary-btn hero-primary-btn" type="button" data-open-class>+ Criar Aula</button>
          ${pendingBookings.length ? `<button class="soft-btn hero-secondary-btn" type="button" data-focus-action="bookings">Ver pedidos (${pendingBookings.length})</button>` : ''}
          ${lead ? `<button class="soft-btn hero-secondary-btn" type="button" data-focus-action="wait:${lead.id}">Fila de espera</button>` : ''}
        </div>
      </section>
    `;
    return;
  }

  const nextStudents = ctx.classStudents(next);
  const nextPresent = nextStudents.filter((student) => next.presencas?.[student.aluno_id || student.id] || student.presente).length;
  const capacity = Number(next.capacidade || 8);
  const isFull = nextStudents.length >= capacity;

  target.innerHTML = `
    <section class="day-command next-class-panel">
      <div class="day-command-main">
        <div class="hero-status-row">
          <span class="live-status-pill">
            <span class="live-dot-pulse"></span>
            <span>Em Andamento • ${ctx.escapeHTML(next.horario)}</span>
          </span>
          <span class="hero-meta-item">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
            <span>Quadra 1 (Areia Principal)</span>
          </span>
          <span class="pill ${isFull ? 'ok' : 'neutral'} hero-capacity-pill">
            ${nextStudents.length}/${capacity} ${isFull ? 'Lotada' : 'Atletas'}
          </span>
        </div>

        <h2 class="hero-title">
          ${ctx.escapeHTML(next.turma || 'Turma')}
        </h2>
        <p class="meta hero-subtitle">
          ${nextPresent} presenças confirmadas de ${nextStudents.length} atletas convocados.
        </p>

        <!-- Quick 1-Click Check-in Chips -->
        ${nextStudents.length ? `
          <div class="quick-checkin-row">
            <span class="quick-checkin-label">Check-in rápido:</span>
            ${nextStudents.map((student) => {
              const sId = student.aluno_id || student.id;
              const isPres = Boolean(next.presencas?.[sId] || next.presencas?.[String(sId)] || student.presente);
              const shortName = student.nome ? student.nome.trim().split(' ').slice(0, 2).join(' ') : 'Aluno';
              return `
                <button class="quick-checkin-chip ${isPres ? 'present' : ''}" type="button" data-focus-action="quick-checkin:${next.id}:${sId}" title="${isPres ? 'Desmarcar presença' : 'Confirmar presença de ' + ctx.escapeHTML(student.nome)}">
                  ${isPres
                    ? `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>`
                    : `<span class="dot"></span>`}
                  <span class="chip-name">${ctx.escapeHTML(shortName)}</span>
                </button>
              `;
            }).join('')}
          </div>
        ` : ''}
      </div>

      <div class="day-command-actions">
        <button class="primary-btn hero-primary-btn" type="button" data-focus-action="next-class">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
          <span>Lista de Chamada</span>
        </button>
        <button class="soft-btn hero-secondary-btn" type="button" data-open-group-message="${next.id}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
          <span>Avisar no Grupo</span>
        </button>
        ${pendingBookings.length ? `<button class="soft-btn hero-secondary-btn" type="button" data-focus-action="bookings">Ver pedidos (${pendingBookings.length})</button>` : ''}
        ${lead ? `<button class="soft-btn hero-secondary-btn" type="button" data-focus-action="wait:${lead.id}">Fila de espera</button>` : ''}
      </div>
    </section>
  `;
}

/**
 * Renderiza os KPIs operacionais no padrão Bento Grid SaaS 100% Simétrico
 */
export function renderKpis(ctx) {
  const target = document.getElementById('kpiGrid');
  if (!target) return;
  const index = ctx.getStateIndex();
  const activeStudents = (ctx.state?.students || []).filter((s) => s.status === 'Ativo');
  const todayClasses = index.todayClasses;
  const expectedToday = todayClasses.reduce((sum, item) => sum + ctx.classStudents(item).length, 0);
  const presentToday = todayClasses.reduce((sum, item) => (
    sum + ctx.classStudents(item).filter((student) => item.presencas?.[student.aluno_id || student.id] || student.presente).length
  ), 0);
  const pendingStudents = index.pendingStudents;
  const pendingValue = pendingStudents.reduce((sum, student) => sum + Number(student.mensalidade || 0), 0);
  const attendanceRate = expectedToday ? Math.round((presentToday / expectedToday) * 100) : 0;

  // Cálculos de ocupação de quadra
  const totalCapacity = todayClasses.reduce((sum, item) => sum + (Number(item.capacidade) || 8), 0);
  const occupancyRate = totalCapacity ? Math.round((expectedToday / totalCapacity) * 100) : 0;

  // Cálculos financeiros do mês
  const monthlyTotal = activeStudents.reduce((sum, s) => sum + Number(s.mensalidade || 0), 0);
  const paidTotal = activeStudents.filter((s) => s.pagamento_status === 'paid').reduce((sum, s) => sum + Number(s.mensalidade || 0), 0);
  const collectionRate = monthlyTotal ? Math.round((paidTotal / monthlyTotal) * 100) : 100;

  // Formatação limpa de moeda
  const formattedRevenue = ctx.money.format(paidTotal || monthlyTotal).replace(/\s+/g, ' ');
  const formattedPending = ctx.money.format(pendingValue).replace(/\s+/g, ' ');

  target.innerHTML = `
    <!-- KPI 1: Ocupação do Dia -->
    <div class="kpi-card kpi-card-enhanced">
      <div>
        <div class="finance-kpi-header">
          <span class="kpi-card-label">Ocupação do Dia</span>
          <div class="finance-kpi-icon">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
          </div>
        </div>
        <div class="kpi-card-value tnum">${occupancyRate}%</div>
        <p class="meta" style="margin:2px 0 0; font-size:11.5px;">${expectedToday} de ${totalCapacity} vagas</p>
      </div>
      <div>
        <div class="kpi-progress-bar">
          <div class="kpi-progress-fill" style="width: ${occupancyRate}%;"></div>
        </div>
        <div class="finance-kpi-footer" style="margin-top:6px;">
          <span class="meta">${todayClasses.length === 1 ? '1 turma hoje' : `${todayClasses.length} turmas hoje`}</span>
        </div>
      </div>
    </div>

    <!-- KPI 2: Presenças -->
    <div class="kpi-card kpi-card-enhanced">
      <div>
        <div class="finance-kpi-header">
          <span class="kpi-card-label">Presenças Hoje</span>
          <div class="finance-kpi-icon" style="color:#10b981;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          </div>
        </div>
        <div class="kpi-card-value tnum">${presentToday} / ${expectedToday || 0}</div>
        <p class="meta" style="margin:2px 0 0; font-size:11.5px;">${attendanceRate}% comparecimento</p>
      </div>
      <div>
        <div class="kpi-progress-bar">
          <div class="kpi-progress-fill emerald" style="width: ${attendanceRate}%;"></div>
        </div>
        <div class="finance-kpi-footer" style="margin-top:6px;">
          <span class="meta">${Math.max(0, expectedToday - presentToday)} aguardando</span>
        </div>
      </div>
    </div>

    <!-- KPI 3: Receita no Mês -->
    <div class="kpi-card kpi-card-enhanced">
      <div>
        <div class="finance-kpi-header">
          <span class="kpi-card-label">Receita no Mês</span>
          <div class="finance-kpi-icon">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8M12 6v2m0 8v2"/></svg>
          </div>
        </div>
        <div class="kpi-card-value tnum">${formattedRevenue}</div>
        <p class="meta" style="margin:2px 0 0; font-size:11.5px;">${collectionRate}% liquidado no mês</p>
      </div>
      <div>
        <div class="kpi-progress-bar">
          <div class="kpi-progress-fill emerald" style="width: ${collectionRate}%;"></div>
        </div>
        <div class="finance-kpi-footer" style="margin-top:6px;">
          <span class="meta">${activeStudents.length} alunos ativos</span>
        </div>
      </div>
    </div>

    <!-- KPI 4: Cobranças Pendentes -->
    <div class="kpi-card kpi-card-enhanced">
      <div>
        <div class="finance-kpi-header">
          <span class="kpi-card-label">Pendências Financeiras</span>
          <div class="finance-kpi-icon" style="color:#ef4444;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          </div>
        </div>
        <div class="kpi-card-value tnum" style="${pendingStudents.length ? 'color:#ef4444;' : ''}">
          ${formattedPending}
        </div>
        <p class="meta" style="margin:2px 0 0; font-size:11.5px;">${pendingStudents.length} ${pendingStudents.length === 1 ? 'aluno pendente' : 'alunos pendentes'}</p>
      </div>
      <div>
        <div class="kpi-progress-bar">
          <div class="kpi-progress-fill" style="background:#ef4444; width: ${pendingStudents.length ? Math.min(100, Math.round((pendingStudents.length / (activeStudents.length || 1)) * 100)) : 0}%;"></div>
        </div>
        <div class="finance-kpi-footer" style="margin-top:6px;">
          <span class="meta">${pendingStudents.length ? 'Requer atenção' : 'Tudo em dia'}</span>
          <button type="button" data-action="payments" style="background:transparent; border:none; padding:0; font-size:11px; font-weight:600; color:#ef4444; cursor:pointer; display:inline-flex; align-items:center; gap:2px;">
            Cobrar →
          </button>
        </div>
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
 * Renderiza pendências de alunos no dashboard com visual SaaS refinado
 */
export function renderPending(ctx) {
  const target = document.getElementById('pendingList');
  if (!target) return;
  const students = ctx.getStateIndex().pendingStudents;
  const visible = students.slice(0, 4);

  target.innerHTML = students.length ? `
    ${visible.map((student) => {
      const initials = student.nome ? student.nome.split(' ').filter(Boolean).map((n) => n[0]).slice(0, 2).join('').toUpperCase() : 'AL';
      const formattedValue = ctx.money.format(Number(student.mensalidade || 0)).replace(/\s+/g, ' ');
      return `
        <article class="row-card pending-student-card">
          <div class="pending-student-main">
            <div class="pending-avatar">${initials}</div>
            <div class="pending-student-info">
              <button class="link-title compact-title" type="button" data-report-student="${student.id}">
                ${ctx.escapeHTML(student.nome)}
              </button>
              <p class="meta">
                ${ctx.escapeHTML(student.plano_nome || 'Sem plano')} • Venc. dia ${student.vencimento_dia || '10'}
              </p>
            </div>
          </div>
          <div class="pending-student-actions">
            <strong class="pending-amount tnum">${formattedValue}</strong>
            <div class="pending-buttons">
              ${student.telefone ? `
                <a class="mini-btn icon-btn" href="${ctx.whatsappUrl ? ctx.whatsappUrl(student.telefone, `Oi ${student.nome}, tudo bem? Notamos que sua mensalidade do Team Lucão está pendente. Segue a chave PIX para acerto: lucao@futevolei.com. Qualquer dúvida estamos à disposição!`) : '#'}" target="_blank" rel="noopener" title="Cobrar no WhatsApp" style="color:#34d399; border-color:rgba(52,211,153,0.3); background:rgba(52,211,153,0.08);">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
                </a>
              ` : ''}
              <button class="mini-btn icon-btn" type="button" data-pay="${student.id}" title="Dar Baixa" style="color:#ffffff;">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
              </button>
            </div>
          </div>
        </article>
      `;
    }).join('')}
    ${students.length > visible.length ? `<button class="soft-btn dashboard-more-btn" type="button" data-action="payments" style="width:100%; justify-content:center; font-size:12px; margin-top:4px;">Ver todas as ${students.length} pendências</button>` : ''}
  ` : ctx.empty('Sem pendências financeiras no momento.');
}

/**
 * Renderiza o feed de ações recentes como Timeline moderna
 */
export function renderDashboardActions(ctx) {
  const target = document.getElementById('dashboardActions');
  if (!target) return;
  const items = ctx.sortedActions(4);

  if (!items.length) {
    target.innerHTML = ctx.empty('Nenhuma ação registrada hoje.');
    return;
  }

  target.innerHTML = `
    <div class="timeline-feed">
      ${items.map((item) => {
        const cat = (item.tipo || item.titulo || '').toLowerCase();
        let dotColor = 'red';
        if (cat.includes('presenca') || cat.includes('presença') || cat.includes('chamada')) dotColor = 'green';
        else if (cat.includes('pagamento') || cat.includes('pix') || cat.includes('baixa')) dotColor = 'blue';
        else if (cat.includes('aluno') || cat.includes('cadastro') || cat.includes('matrícula')) dotColor = 'purple';

        const time = item.hora || item.horario || item.data || '';
        return `
          <div class="timeline-item">
            <span class="timeline-dot ${dotColor}"></span>
            <div style="font-weight:500;">
              <strong style="color:#ffffff;">${ctx.escapeHTML(item.titulo || item.tipo || 'Ação')}</strong>:
              ${ctx.escapeHTML(item.descricao || item.detalhe || '')}
            </div>
            <div class="timeline-time">${ctx.escapeHTML(time)} • ${ctx.escapeHTML(item.ator || 'Sistema')}</div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}
