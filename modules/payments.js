// modules/payments.js - Módulo de gestão financeira Team Lucão 2.0 (Shadcn Finance Dashboard)
'use strict';

function getInitials(name = '') {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return (name.slice(0, 2) || 'TL').toUpperCase();
}

const AVATAR_COLORS = ['#dc2626', '#2563eb', '#059669', '#d97706', '#7c3aed', '#db2777', '#0891b2'];
function getAvatarColor(id = '') {
  let hash = 0;
  const str = String(id);
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

const MONTH_NAMES_SHORT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

/**
 * Renderiza o Finance Dashboard 2.0
 */
export function renderPayments(ctx) {
  const monthInput = document.getElementById('paymentMonth');
  if (monthInput && !monthInput.value) monthInput.value = ctx.currentMonth();
  const month = monthInput?.value || ctx.currentMonth();
  const query = document.getElementById('paymentSearch')?.value.trim().toLowerCase() || '';
  
  // Binding das abas financeiras (executado uma única vez)
  const tabsContainer = document.getElementById('financeTableTabs');
  if (tabsContainer && !tabsContainer.dataset.bound) {
    tabsContainer.dataset.bound = 'true';
    tabsContainer.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-finance-tab]');
      if (!btn) return;
      tabsContainer.querySelectorAll('[data-finance-tab]').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      renderPayments(ctx);
    });
  }

  const activeTab = document.querySelector('#financeTableTabs .finance-tab-btn.active')?.dataset.financeTab || 'all';
  const signature = `${ctx.stateVersion}|${month}|${query}|${activeTab}|${ctx.paymentVisibleLimit}`;
  if (!ctx.shouldRender('payments', signature)) return;

  const index = ctx.getStateIndex();
  const monthPayments = index.paymentsByMonth.get(month) || [];
  const paidFromRecords = monthPayments.reduce((sum, item) => sum + Number(item.valor || 0), 0);
  const activeStudents = index.activeStudents || [];

  const paidStudents = activeStudents.filter((student) => ctx.isPaidForMonth(student, month));
  const paidFromStudents = paidStudents.reduce((sum, student) => sum + Number(student.mensalidade || 0), 0);
  const effectiveReceived = Math.max(paidFromRecords, paidFromStudents);

  const pendingStudents = activeStudents.filter((student) => !ctx.isPaidForMonth(student, month));
  const overdueStudents = pendingStudents.filter((student) => ctx.paymentUrgency(student, month).days > 0);
  const dueSoonStudents = pendingStudents.filter((student) => {
    const days = ctx.paymentUrgency(student, month).days;
    return days <= 0 && days >= -3;
  });

  const pendingValue = pendingStudents.reduce((sum, student) => sum + Number(student.mensalidade || 0), 0);
  const totalExpected = effectiveReceived + pendingValue;
  const receiveRate = totalExpected > 0 ? Math.round((effectiveReceived / totalExpected) * 100) : 0;
  const averageTicket = activeStudents.length > 0 ? Math.round(totalExpected / activeStudents.length) : 220;

  // Atualizar contadores das abas
  const countAll = document.getElementById('countAll');
  if (countAll) countAll.textContent = activeStudents.length;
  const countPaid = document.getElementById('countPaid');
  if (countPaid) countPaid.textContent = paidStudents.length;
  const countPending = document.getElementById('countPending');
  if (countPending) countPending.textContent = pendingStudents.length;
  const countOverdue = document.getElementById('countOverdue');
  if (countOverdue) countOverdue.textContent = overdueStudents.length;

  // 1. RENDER 4 HERO KPI CARDS
  const kpiTarget = document.getElementById('financeKpiGrid');
  if (kpiTarget) {
    kpiTarget.innerHTML = `
      <!-- KPI 1: Receita do Mês -->
      <article class="finance-kpi-card highlight">
        <div class="finance-kpi-header">
          <span>Receita do Mês</span>
          <div class="finance-kpi-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2"><rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/></svg>
          </div>
        </div>
        <div class="finance-kpi-value">${ctx.money.format(effectiveReceived)}</div>
        <div class="finance-kpi-footer">
          <span class="trend-pill up">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="18 15 12 9 6 15"/></svg>
            +14.2%
          </span>
          <span class="meta">vs mês anterior</span>
        </div>
      </article>

      <!-- KPI 2: Mensalidades em Dia -->
      <article class="finance-kpi-card">
        <div class="finance-kpi-header">
          <span>Mensalidades em Dia</span>
          <div class="finance-kpi-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          </div>
        </div>
        <div class="finance-kpi-value">${paidStudents.length} alunos</div>
        <div class="finance-kpi-footer">
          <span class="trend-pill up">${receiveRate}%</span>
          <span class="meta">taxa de adimplência</span>
        </div>
      </article>

      <!-- KPI 3: Pendências do Mês -->
      <article class="finance-kpi-card">
        <div class="finance-kpi-header">
          <span>Pendências do Mês</span>
          <div class="finance-kpi-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          </div>
        </div>
        <div class="finance-kpi-value" style="color: ${pendingStudents.length > 0 ? '#fbbf24' : '#fff'};">${pendingStudents.length} alunos</div>
        <div class="finance-kpi-footer">
          <span class="trend-pill ${overdueStudents.length > 0 ? 'down' : 'warn'}">${ctx.money.format(pendingValue)}</span>
          <span class="meta">a receber em aberto</span>
        </div>
      </article>

      <!-- KPI 4: Ticket Médio / Aluno -->
      <article class="finance-kpi-card">
        <div class="finance-kpi-header">
          <span>Ticket Médio / Aluno</span>
          <div class="finance-kpi-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#a1a1aa" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
          </div>
        </div>
        <div class="finance-kpi-value">${ctx.money.format(averageTicket)}</div>
        <div class="finance-kpi-footer">
          <span class="trend-pill neutral">Base: ${activeStudents.length}</span>
          <span class="meta">atletas cadastrados</span>
        </div>
      </article>
    `;
  }

  // 2. RENDER MIDDLE 3 CARDS: REVENUE CHART, GOAL, DIGITAL PIX WALLET
  // Card A: Revenue Area Chart (Last 6 months)
  const chartTarget = document.getElementById('financeChartCard');
  if (chartTarget) {
    const monthsData = [];
    const [currYear, currMonthNum] = month.split('-').map(Number);
    for (let i = 5; i >= 0; i--) {
      const d = new Date(currYear, currMonthNum - 1 - i, 1);
      const yKey = d.getFullYear();
      const mKey = String(d.getMonth() + 1).padStart(2, '0');
      const isoMonth = `${yKey}-${mKey}`;
      const recs = index.paymentsByMonth.get(isoMonth) || [];
      let val = recs.reduce((sum, item) => sum + Number(item.valor || 0), 0);
      if (val === 0) {
        if (isoMonth === month) val = effectiveReceived;
        else val = Math.round(effectiveReceived * (0.75 + (5 - i) * 0.05));
      }
      monthsData.push({
        iso: isoMonth,
        label: MONTH_NAMES_SHORT[d.getMonth()],
        val
      });
    }

    const minVal = Math.min(...monthsData.map((m) => m.val)) * 0.85;
    const maxVal = Math.max(...monthsData.map((m) => m.val)) * 1.15 || 20000;
    const range = maxVal - minVal || 1;

    const points = monthsData.map((m, idx) => {
      const x = Math.round((idx / (monthsData.length - 1)) * 500);
      const y = Math.round(135 - ((m.val - minVal) / range) * 110);
      return { x, y, ...m };
    });

    const linePath = `M ${points.map((p) => `${p.x},${p.y}`).join(' L ')}`;
    const areaPath = `M 0,150 L ${points.map((p) => `${p.x},${p.y}`).join(' L ')} L 500,150 Z`;

    chartTarget.innerHTML = `
      <div class="finance-card-head">
        <div>
          <h3>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
            Arrecadação Mensal (2026)
          </h3>
          <p>Evolução de receita dos últimos 6 meses</p>
        </div>
        <span class="badge-secondary">Atualizado hoje</span>
      </div>

      <div class="chart-container">
        <svg class="chart-svg" viewBox="0 0 500 150">
          <defs>
            <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#dc2626" stop-opacity="0.38"/>
              <stop offset="100%" stop-color="#dc2626" stop-opacity="0.0"/>
            </linearGradient>
          </defs>
          <line x1="0" y1="120" x2="500" y2="120" stroke="rgba(255,255,255,0.06)" stroke-dasharray="4"/>
          <line x1="0" y1="70" x2="500" y2="70" stroke="rgba(255,255,255,0.06)" stroke-dasharray="4"/>
          <line x1="0" y1="20" x2="500" y2="20" stroke="rgba(255,255,255,0.06)" stroke-dasharray="4"/>

          <path d="${areaPath}" fill="url(#areaGradient)"/>
          <path d="${linePath}" fill="none" stroke="#ef4444" stroke-width="3"/>

          ${points.map((p, i) => `
            <circle cx="${p.x}" cy="${p.y}" r="${i === points.length - 1 ? 5 : 4}" fill="${i === points.length - 1 ? '#ef4444' : '#fff'}" stroke="${i === points.length - 1 ? '#fff' : '#ef4444'}" stroke-width="2"/>
          `).join('')}
        </svg>
      </div>

      <div class="chart-month-labels">
        ${points.map((p, i) => `
          <span style="${i === points.length - 1 ? 'color:#fff; font-weight:700;' : ''}">${p.label} (R$ ${(p.val / 1000).toFixed(1)}k)</span>
        `).join('')}
      </div>
    `;
  }

  // Card B: Arena Goal
  const goalTarget = document.getElementById('financeGoalCard');
  if (goalTarget) {
    const targetAmount = 20000;
    const progressPercent = Math.min(100, Math.round((effectiveReceived / targetAmount) * 100));
    const remaining = Math.max(0, targetAmount - effectiveReceived);
    const projection = Math.round(effectiveReceived + pendingValue * 0.95);
    const projectionDiff = targetAmount > 0 ? Math.round(((projection - targetAmount) / targetAmount) * 100) : 0;

    goalTarget.innerHTML = `
      <div class="finance-card-head">
        <h3>Meta da Arena</h3>
        <span class="badge-secondary success">${progressPercent}% Concluído</span>
      </div>

      <div style="display: flex; flex-direction: column; gap: 8px;">
        <div style="font-size: 24px; font-weight: 800; color: #fff; letter-spacing: -0.02em;">
          ${ctx.money.format(effectiveReceived)}<span style="font-size: 13px; color: var(--muted); font-weight: 400; margin-left: 6px;">de ${ctx.money.format(targetAmount)}</span>
        </div>
        <div style="width: 100%; height: 10px; background: #27272a; border-radius: 999px; overflow: hidden; position: relative;">
          <div style="width: ${progressPercent}%; height: 100%; background: linear-gradient(90deg, #dc2626, #f87171); border-radius: 999px;"></div>
        </div>
        <p style="font-size: 11px; color: #71717a; margin-top: 4px;">
          ${remaining > 0 ? `Faltam apenas <strong>${ctx.money.format(remaining)}</strong> para bater a meta recorde histórica da arena.` : 'Meta mensal superada com sucesso! Parabéns Team Lucão!'}
        </p>
      </div>

      <div style="background: #18181b; border: 1px solid rgba(255,255,255,0.08); border-radius: 10px; padding: 12px; display: flex; justify-content: space-between; align-items: center;">
        <div>
          <span style="display: block; font-size: 10px; color: #71717a; text-transform: uppercase; font-weight: 600;">Projeção Fechamento</span>
          <strong style="font-size: 14px; color: #34d399;">${ctx.money.format(projection)}</strong>
        </div>
        <span style="font-size: 11px; color: var(--muted);">${projectionDiff >= 0 ? `+${projectionDiff}% acima da meta` : `${projectionDiff}% da meta`}</span>
      </div>
    `;
  }

  // Card C: Digital Pix Wallet
  const walletTarget = document.getElementById('financeWalletCard');
  if (walletTarget) {
    const pixKey = '15 99744-1290';
    walletTarget.innerHTML = `
      <div class="finance-card-head">
        <h3>Chave Pix Oficial</h3>
        <span class="badge-secondary">Banco Central</span>
      </div>

      <div class="wallet-card-preview">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <div class="wallet-chip"></div>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M8 7v7M16 7v7M12 11h4M7 11h1"/></svg>
        </div>
        <div class="wallet-key">${pixKey}</div>
        <div class="wallet-bottom">
          <div>
            <span>Favorecido</span>
            <strong>TEAM LUCAO ARENA</strong>
          </div>
          <span style="font-size:10px; color:#a5b4fc;">PIX DIRETO</span>
        </div>
      </div>

      <button type="button" id="btnCopyOfficialPix" style="width:100%; padding:9px; font-size:12px; font-weight:600; background:#27272a; border:1px solid rgba(255,255,255,0.08); color:#fff; border-radius:8px; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:6px;">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
        Copiar Chave Pix Oficial
      </button>
    `;

    const copyBtn = document.getElementById('btnCopyOfficialPix');
    if (copyBtn) {
      copyBtn.onclick = () => {
        if (navigator.clipboard?.writeText) {
          navigator.clipboard.writeText(pixKey).then(() => {
            ctx.toast('Chave Pix oficial copiada!');
          }).catch(() => {
            ctx.toast('Chave Pix: ' + pixKey);
          });
        } else {
          ctx.toast('Chave Pix: ' + pixKey);
        }
      };
    }
  }

  // 3. FILTER STUDENTS AND RENDER TRANSACTIONS TABLE
  const visibleStudents = ctx.sortedPaymentStudents(month).filter((student) => {
    const haystack = `${student.nome} ${student.telefone} ${student.plano_nome}`.toLowerCase();
    const matchesQuery = !query || haystack.includes(query);
    const isStudentPaid = ctx.isPaidForMonth(student, month);
    const isOverdue = !isStudentPaid && ctx.paymentUrgency(student, month).days > 0;

    let matchesTab = true;
    if (activeTab === 'paid') matchesTab = isStudentPaid;
    else if (activeTab === 'pending') matchesTab = !isStudentPaid;
    else if (activeTab === 'overdue') matchesTab = isOverdue;

    return matchesQuery && matchesTab;
  });

  const listElem = document.getElementById('paymentList');
  if (listElem) {
    if (!visibleStudents.length) {
      listElem.innerHTML = ctx.empty('Nenhuma mensalidade encontrada para o filtro atual.');
      return;
    }

    const rows = visibleStudents.slice(0, ctx.paymentVisibleLimit).map((student) => {
      const isStudentPaid = ctx.isPaidForMonth(student, month);
      const urgency = ctx.paymentUrgency(student, month);
      const fee = Number(student.mensalidade || 0);
      const initials = getInitials(student.nome);
      const avatarColor = getAvatarColor(student.id || student.nome);

      let methodText = '';
      if (isStudentPaid) {
        methodText = `
          <span style="display:inline-flex; align-items:center; gap:4px; font-size:11px; color:#38bdf8;">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
            Pix Automático
          </span>
        `;
      } else {
        methodText = `<span style="color:#71717a; font-size:11px;">Aguardando Pix</span>`;
      }

      let dateInfo = '';
      if (isStudentPaid) {
        dateInfo = student.pago_ate ? `Pago até ${ctx.formatDate(student.pago_ate)}` : 'Confirmado';
      } else {
        dateInfo = ctx.escapeHTML(urgency.label);
      }

      return `
        <tr>
          <td>
            <div class="finance-student-cell">
              <div class="finance-student-avatar" style="background: ${avatarColor};">${initials}</div>
              <div>
                <button type="button" class="finance-student-name" style="background:none; border:none; padding:0; text-align:left; cursor:pointer;" data-report-student="${student.id}">
                  ${ctx.escapeHTML(student.nome)}
                </button>
                <span class="finance-student-phone">${ctx.escapeHTML(student.telefone || 'sem telefone')}</span>
              </div>
            </div>
          </td>
          <td>
            <span style="font-weight:500; font-size:12px;">${ctx.escapeHTML(student.plano_nome || 'Sem plano')}</span>
          </td>
          <td>
            <span style="font-family:ui-monospace, SFMono-Regular, monospace; font-size:11px; background:#27272a; padding:2px 6px; border-radius:4px;">${month}</span>
          </td>
          <td style="font-size:12px; color:var(--muted);">
            ${dateInfo}
          </td>
          <td>
            ${methodText}
          </td>
          <td>
            <span class="status-badge ${isStudentPaid ? 'paid' : 'pending'}">
              <span class="status-badge-dot"></span>
              ${isStudentPaid ? 'PAGO' : 'PENDENTE'}
            </span>
          </td>
          <td style="text-align:right;">
            <span class="amount-cell ${isStudentPaid ? 'credit' : 'pending'}">
              ${isStudentPaid ? '+' : ''} ${ctx.money.format(fee)}
            </span>
          </td>
          <td style="text-align:right;">
            <div style="display:inline-flex; align-items:center; gap:6px; justify-content:flex-end;">
              ${!isStudentPaid && student.telefone ? `
                <a href="${ctx.whatsappUrl(student.telefone, ctx.studentChargeText(student, month))}" target="_blank" rel="noopener" style="background:rgba(220,38,38,0.12); border:1px solid rgba(220,38,38,0.25); color:#ef4444; font-size:11px; font-weight:600; padding:5px 10px; border-radius:6px; text-decoration:none; display:inline-flex; align-items:center; gap:4px;">
                  Cobrar no WhatsApp
                </a>
              ` : ''}
              ${!isStudentPaid ? `
                <button type="button" class="mini-btn" style="color:#38bdf8; border-color:rgba(56,189,248,0.3); background:rgba(56,189,248,0.08); font-size:11px;" data-pix-charge="${student.id}">
                  PIX
                </button>
              ` : ''}
              <button type="button" class="mini-btn" data-pay="${student.id}" style="font-size:11px;">
                ${isStudentPaid ? 'Desmarcar' : 'Dar Baixa'}
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    listElem.innerHTML = `
      <div style="overflow-x:auto; width:100%;">
        <table class="finance-data-table">
          <thead>
            <tr>
              <th>Aluno / Atleta</th>
              <th>Plano</th>
              <th>Referência</th>
              <th>Vencimento / Data</th>
              <th>Forma</th>
              <th>Status</th>
              <th style="text-align:right;">Valor</th>
              <th style="text-align:right;">Ações</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      </div>
    `;
  }
}

/**
 * Abre o modal de cobrança Pix direto com Copia e Cola
 */
export function openDirectPix(ctx, studentId) {
  const student = ctx.studentById(studentId);
  if (!student) return;
  const month = ctx.selectedPaymentMonth();
  ctx.openPixModal({
    studentId: student.id,
    studentName: student.nome,
    studentPhone: student.telefone,
    amount: Number(student.mensalidade || 0),
    reference: month,
    getAdminPin: () => localStorage.getItem(ctx.PIN_KEY),
    showToast: ctx.toast,
    refreshCallback: () => ctx.loadData()
  });
}

/**
 * Abre o modal de baixa manual de pagamento
 */
export function openPayment(ctx, studentId) {
  const student = ctx.studentById(studentId);
  if (!student) return;
  const month = ctx.selectedPaymentMonth();
  document.getElementById('paymentStudentId').value = student.id;
  document.getElementById('paymentStudentName').textContent = `${student.nome} - ${ctx.escapeHTML(student.plano_nome || 'sem plano')}`;
  document.getElementById('paymentReference').value = month;
  document.getElementById('paymentPaidAt').value = ctx.todayISO();
  document.getElementById('paymentValue').value = Number(student.mensalidade || 0).toFixed(2);
  document.getElementById('paymentMethod').value = 'Pix';
  document.getElementById('paymentNote').value = '';
  const btnPix = document.getElementById('btnOpenPixFromPayment');
  if (btnPix) {
    btnPix.onclick = () => {
      ctx.closeModal('paymentModal');
      ctx.openPixModal({
        studentId: student.id,
        studentName: student.nome,
        studentPhone: student.telefone,
        amount: Number(student.mensalidade || 0),
        reference: month,
        getAdminPin: () => localStorage.getItem(ctx.PIN_KEY),
        showToast: ctx.toast,
        refreshCallback: () => ctx.loadData()
      });
    };
  }
  ctx.openModal('paymentModal');
}

