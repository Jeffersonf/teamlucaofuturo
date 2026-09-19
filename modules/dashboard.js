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
          <div style="display:flex; align-items:center; gap:8px; margin-bottom:6px;">
            <span class="eyebrow" style="color:#71717a; font-weight:700; font-size:11px; letter-spacing:0.06em; text-transform:uppercase; display:flex; align-items:center; gap:5px;">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              Grade do Dia
            </span>
          </div>
          <h2 style="font-size:20px; font-weight:700; color:#ffffff; margin:0 0 4px; letter-spacing:-0.02em;">Sem aula marcada para agora</h2>
          <p class="meta" style="margin:0; font-size:13px; color:#a1a1aa;">Crie uma nova aula para iniciar a grade de treinos de hoje.</p>
        </div>
        <div class="day-command-actions">
          <button class="primary-btn" type="button" data-open-class>+ Criar Aula</button>
          ${pendingBookings.length ? `<button class="soft-btn" type="button" data-focus-action="bookings">Ver pedidos (${pendingBookings.length})</button>` : ''}
          ${lead ? `<button class="soft-btn" type="button" data-focus-action="wait:${lead.id}">Fila de espera</button>` : ''}
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
        <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap; margin-bottom:6px;">
          <span class="eyebrow" style="color:#f87171; font-weight:700; font-size:11px; letter-spacing:0.06em; text-transform:uppercase; display:flex; align-items:center; gap:6px;">
            <span class="live-dot-pulse"></span>
            Em Andamento • ${ctx.escapeHTML(next.horario)}
          </span>
          <span class="meta" style="display:inline-flex; align-items:center; gap:4px; font-size:12px; color:#a1a1aa;">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
            Quadra 1 (Areia Principal)
          </span>
          <span class="pill ${isFull ? 'ok' : 'neutral'}" style="font-size:10.5px; padding:2px 8px; font-weight:700;">
            ${nextStudents.length}/${capacity} ${isFull ? 'Lotada' : 'Atletas'}
          </span>
        </div>

        <h2 style="font-size:22px; font-weight:750; color:#ffffff; margin:0 0 4px; letter-spacing:-0.025em;">
          ${ctx.escapeHTML(next.turma || 'Turma')}
        </h2>
        <p class="meta" style="margin:0 0 8px; font-size:13px; color:#a1a1aa;">
          ${nextPresent} presenças confirmadas de ${nextStudents.length} atletas convocados.
        </p>

        <!-- Quick 1-Click Check-in Chips -->
        ${nextStudents.length ? `
          <div class="quick-checkin-row">
            <span style="font-size:11px; font-weight:700; color:#71717a; text-transform:uppercase; letter-spacing:0.04em;">Check-in rápido:</span>
            ${nextStudents.map((student) => {
              const sId = student.aluno_id || student.id;
              const isPres = Boolean(next.presencas?.[sId] || next.presencas?.[String(sId)] || student.presente);
              const shortName = student.nome ? student.nome.trim().split(' ').slice(0, 2).join(' ') : 'Aluno';
              return `
                <button class="quick-checkin-chip ${isPres ? 'present' : ''}" type="button" data-focus-action="quick-checkin:${next.id}:${sId}" title="${isPres ? 'Desmarcar presença' : 'Confirmar presença de ' + ctx.escapeHTML(student.nome)}">
                  ${isPres
                    ? `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>`
                    : `<span class="dot"></span>`}
                  <span>${ctx.escapeHTML(shortName)}</span>
                </button>
              `;
            }).join('')}
          </div>
        ` : ''}
      </div>

      <div class="day-command-actions">
        <button class="primary-btn" type="button" data-focus-action="next-class" style="display:flex; align-items:center; justify-content:center; gap:6px;">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
          <span>Lista de Chamada</span>
        </button>
        <button class="soft-btn" type="button" data-open-group-message="${next.id}" style="display:flex; align-items:center; justify-content:center; gap:6px;">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
          <span>Avisar no Grupo</span>
        </button>
        ${pendingBookings.length ? `<button class="soft-btn" type="button" data-focus-action="bookings">Ver pedidos (${pendingBookings.length})</button>` : ''}
        ${lead ? `<button class="soft-btn" type="button" data-focus-action="wait:${lead.id}">Fila de espera</button>` : ''}
      </div>
    </section>
  `;
}

/**
 * Renderiza os KPIs operacionais no padrão Bento Grid SaaS
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

  // Alunos confirmados para avatar stack
  const confirmedStudents = [];
  todayClasses.forEach((c) => {
    ctx.classStudents(c).forEach((s) => {
      const id = s.aluno_id || s.id;
      if ((c.presencas?.[id] || s.presente) && !confirmedStudents.some((cs) => cs.id === id)) {
        confirmedStudents.push(s);
      }
    });
  });

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
        <div class="kpi-card-value" style="font-family:var(--font-mono, monospace);">${occupancyRate}%</div>
        <p class="meta" style="margin:2px 0 0; font-size:11.5px;">${expectedToday} de ${totalCapacity} vagas preenchidas</p>
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
        <div class="kpi-card-value" style="font-family:var(--font-mono, monospace);">${presentToday} / ${expectedToday || 0}</div>
        <p class="meta" style="margin:2px 0 0; font-size:11.5px;">${attendanceRate}% taxa de comparecimento</p>
      </div>
      <div>
        <div class="kpi-avatar-stack">
          ${confirmedStudents.slice(0, 4).map((s) => {
            const initials = s.nome ? s.nome.split(' ').filter(Boolean).map((n) => n[0]).slice(0, 2).join('').toUpperCase() : 'AL';
            return `<div class="stack-item" title="${ctx.escapeHTML(s.nome)}">${initials}</div>`;
          }).join('')}
          ${confirmedStudents.length > 4 ? `<div class="stack-item stack-more">+${confirmedStudents.length - 4}</div>` : ''}
          <span class="meta" style="margin:0 0 0 8px; font-size:11px;">${expectedToday - presentToday} aguardando</span>
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
        <div class="kpi-card-value" style="font-family:var(--font-mono, monospace);">${ctx.money.format(paidTotal || monthlyTotal)}</div>
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
        <div class="kpi-card-value" style="font-family:var(--font-mono, monospace); ${pendingStudents.length ? 'color:#ef4444;' : ''}">
          ${ctx.money.format(pendingValue)}
        </div>
        <p class="meta" style="margin:2px 0 0; font-size:11.5px;">${pendingStudents.length} ${pendingStudents.length === 1 ? 'aluno pendente' : 'alunos pendentes'}</p>
      </div>
      <div>
        <button class="soft-btn" type="button" data-action="payments" style="width:100%; min-height:30px; font-size:11px; padding:4px 8px; justify-content:center; border-color:rgba(239,68,68,0.3); color:#fca5a5;">
          Cobrar Pendências
        </button>
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
      return `
        <article class="row-card">
          <div style="display:flex; align-items:center; gap:12px; min-width:0;">
            <div style="width:34px; height:34px; border-radius:9px; background:rgba(239,68,68,0.14); border:1px solid rgba(239,68,68,0.28); color:#ef4444; display:flex; align-items:center; justify-content:center; font-weight:700; font-size:12px; flex-shrink:0;">
              ${initials}
            </div>
            <div style="min-width:0; flex:1;">
              <button class="link-title compact-title" type="button" data-report-student="${student.id}" style="font-weight:600; font-size:13px; color:#ffffff;">
                ${ctx.escapeHTML(student.nome)}
              </button>
              <p class="meta" style="font-size:11px; margin:2px 0 0; color:#a1a1aa;">
                ${ctx.escapeHTML(student.plano_nome || 'Sem plano')} • Vencimento dia ${student.vencimento_dia || '10'}
              </p>
            </div>
          </div>
          <div class="actions" style="display:flex; align-items:center; gap:8px;">
            <strong style="font-family:var(--font-mono, monospace); font-size:13px; color:#ffffff; white-space:nowrap;">
              ${ctx.money.format(Number(student.mensalidade || 0))}
            </strong>
            ${student.telefone ? `
              <a class="mini-btn icon-btn" href="${ctx.whatsappUrl ? ctx.whatsappUrl(student.telefone, `Oi ${student.nome}, tudo bem? Notamos que sua mensalidade do Team Lucão está pendente. Segue a chave PIX para acerto: lucao@futevolei.com. Qualquer dúvida estamos à disposição!`) : '#'}" target="_blank" rel="noopener" title="Cobrar no WhatsApp" style="color:#34d399; border-color:rgba(52,211,153,0.3); background:rgba(52,211,153,0.08);">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
              </a>
            ` : ''}
            <button class="mini-btn icon-btn" type="button" data-pay="${student.id}" title="Dar Baixa" style="color:#ffffff;">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
            </button>
          </div>
        </article>
      `;
    }).join('')}
    ${students.length > visible.length ? `<button class="soft-btn dashboard-more-btn" type="button" data-action="payments" style="width:100%; justify-content:center; font-size:12px;">Ver todas as ${students.length} pendências</button>` : ''}
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
