// modules/payments.js - Módulo de gestão financeira, baixas de mensalidade e cobranças Pix
'use strict';

/**
 * Renderiza a tela de financeiro/mensalidades com resumo, prioridades e lista
 */
export function renderPayments(ctx) {
  const monthInput = document.getElementById('paymentMonth');
  if (monthInput && !monthInput.value) monthInput.value = ctx.currentMonth();
  const month = monthInput?.value || ctx.currentMonth();
  const query = document.getElementById('paymentSearch')?.value.trim().toLowerCase() || '';
  const filter = document.getElementById('paymentStatusFilter')?.value || '';
  const signature = `${ctx.stateVersion}|${month}|${query}|${filter}|${ctx.paymentVisibleLimit}`;
  if (!ctx.shouldRender('payments', signature)) return;

  const index = ctx.getStateIndex();
  const monthPayments = index.paymentsByMonth.get(month) || [];
  const paidThisMonth = monthPayments.reduce((sum, item) => sum + Number(item.valor || 0), 0);
  const activeStudents = index.activeStudents;
  const pending = activeStudents.filter((student) => !ctx.isPaidForMonth(student, month));
  const overdue = pending.filter((student) => ctx.paymentUrgency(student, month).days > 0);
  const dueSoon = pending.filter((student) => {
    const days = ctx.paymentUrgency(student, month).days;
    return days <= 0 && days >= -3;
  });
  const expected = activeStudents.reduce((sum, student) => sum + Number(student.mensalidade || 0), 0);
  const receiveRate = expected ? Math.round((paidThisMonth / expected) * 100) : 0;
  const priorityStudents = ctx.sortedPaymentStudents(month).filter((student) => !ctx.isPaidForMonth(student, month));

  const priorityTarget = document.getElementById('paymentPriority');
  if (priorityTarget) {
    priorityTarget.innerHTML = priorityStudents.length ? `
      <div class="payment-priority-head">
        <div>
          <span class="section-label">cobrar primeiro</span>
          <strong>${priorityStudents.length} pendente(s)</strong>
        </div>
        <button class="mini-btn" type="button" data-action="quick-pending">Copiar lista</button>
      </div>
      <div class="payment-priority-grid">
        ${priorityStudents.slice(0, 3).map((student) => {
          const urgency = ctx.paymentUrgency(student, month);
          const priority = ctx.paymentPriority(student, month);
          return `
            <article class="payment-priority-card">
              <div>
                <button class="link-title compact-title" type="button" data-report-student="${student.id}">${ctx.escapeHTML(student.nome)}</button>
                <p class="meta">${ctx.money.format(Number(student.mensalidade || 0))} - ${ctx.escapeHTML(urgency.label)}</p>
                <span class="pill ${priority.className}">${ctx.escapeHTML(priority.label)}</span>
              </div>
              <div class="actions">
                ${student.telefone ? `<a class="mini-btn" href="${ctx.whatsappUrl(student.telefone, ctx.studentChargeText(student, month))}" target="_blank" rel="noopener">WhatsApp</a>` : ''}
                <button class="mini-btn" data-copy-charge="${student.id}">Copiar</button>
                <button class="mini-btn" data-pay="${student.id}">Pago</button>
              </div>
            </article>
          `;
        }).join('')}
      </div>
    ` : '';
  }

  const summaryElem = document.getElementById('financeSummary');
  if (summaryElem) {
    summaryElem.innerHTML = `
      <article class="mini-stat kpi-ok payment-secondary"><span>Recebido no mês</span><strong>${ctx.money.format(paidThisMonth)}</strong></article>
      <article class="mini-stat payment-secondary"><span>Previsão do mês</span><strong>${ctx.money.format(expected)}</strong></article>
      <article class="mini-stat payment-secondary ${receiveRate >= 80 ? 'kpi-ok' : pending.length ? 'kpi-warn' : ''}"><span>Recebimento</span><strong>${receiveRate}%</strong></article>
      <article class="mini-stat ${pending.length ? 'kpi-bad' : 'kpi-ok'}"><span>Pendências</span><strong>${pending.length}</strong></article>
      <article class="mini-stat ${overdue.length ? 'kpi-bad' : 'kpi-ok'}"><span>Atrasadas</span><strong>${overdue.length}</strong></article>
      <article class="mini-stat ${dueSoon.length ? 'kpi-warn' : ''}"><span>Cobrar agora</span><strong>${dueSoon.length}</strong></article>
      <article class="mini-stat ${pending.length ? 'kpi-bad' : 'kpi-ok'}"><span>A receber</span><strong>${ctx.money.format(pending.reduce((sum, student) => sum + Number(student.mensalidade || 0), 0))}</strong></article>
    `;
  }

  const visibleStudents = ctx.sortedPaymentStudents(month).filter((student) => {
    const haystack = `${student.nome} ${student.telefone} ${student.plano_nome}`.toLowerCase();
    const matchesQuery = !query || haystack.includes(query);
    const matchesFilter = !filter || (filter === 'paid' ? ctx.isPaidForMonth(student, month) : !ctx.isPaidForMonth(student, month));
    return matchesQuery && matchesFilter;
  });

  const listElem = document.getElementById('paymentList');
  if (listElem) {
    listElem.innerHTML = visibleStudents.length ? visibleStudents.slice(0, ctx.paymentVisibleLimit).map((student) => ctx.paymentRow(student, month)).join('') : ctx.empty('Nenhum aluno encontrado para a referência.');
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
