const phoneDigits = (value) => String(value || '').replace(/\D/g, '');
const escapeHTML = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
}[char]));

const form = document.getElementById('studentFastForm');
const phoneInput = document.getElementById('studentFastPhone');
const searchButton = form.querySelector('button[type="submit"]');
const studentStatus = document.getElementById('studentFastStatus');
const dashboardStatus = document.getElementById('studentDashboardStatus');
const dashboard = document.getElementById('studentDashboard');
const greeting = document.getElementById('studentGreeting');
const period = document.getElementById('studentPeriod');
const plan = document.getElementById('studentPlan');
const upcomingList = document.getElementById('studentUpcomingList');
const availableList = document.getElementById('studentAvailableList');
const weeklyList = document.getElementById('studentWeeklyList');
const quotaCard = document.getElementById('studentQuotaCard');
const quotaCounter = document.getElementById('studentQuotaCounter');
const quotaSubtext = document.getElementById('studentQuotaHint');
const quotaStatusPill = document.getElementById('studentQuotaStatusPill');
const quotaProgressBar = document.getElementById('studentQuotaProgressBar');
const weeklyDatesBadge = document.getElementById('weeklyDatesBadge');
const calendar = document.getElementById('studentCalendar');
const dateFilter = document.getElementById('studentFastDate');
const timeFilter = document.getElementById('studentFastTime');

const guestModeButton = document.getElementById('guestModeButton');
const studentPanel = document.getElementById('studentPanel');
const guestPanel = document.getElementById('guestPanel');
const heroEyebrow = document.getElementById('heroEyebrow');
const heroTitle = document.getElementById('heroTitle');
const heroDescription = document.getElementById('heroDescription');
const guestForm = document.getElementById('guestBookingForm');
const guestName = document.getElementById('guestName');
const guestPhone = document.getElementById('guestPhone');
const guestDate = document.getElementById('guestDate');
const guestTime = document.getElementById('guestTime');
const guestButton = document.getElementById('guestSubmitButton');
const guestStatus = document.getElementById('guestStatus');

let currentPhone = '';
let agendaData = { items: [], available: [], requests: [] };
let guestClasses = [];
let guestClassesLoaded = false;

function setStatus(target, message = '', state = '') {
  if (!target) return;
  target.textContent = message;
  if (!message) {
    target.className = 'hidden';
    return;
  }
  if (state === 'success') {
    target.className = 'p-3.5 rounded-2xl bg-emerald-950/60 border border-emerald-800/60 text-emerald-300 text-xs font-medium block my-3 text-center';
  } else if (state === 'error') {
    target.className = 'p-3.5 rounded-2xl bg-red-950/60 border border-red-800/60 text-red-300 text-xs font-medium block my-3 text-center';
  } else {
    target.className = 'p-3 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 text-xs font-medium block my-3 text-center';
  }
}

let statusTimeout = null;
function showStatus(message = '', state = '', autoClearMs = 4000) {
  const isDashboardActive = dashboard && !dashboard.hidden;
  const target = (isDashboardActive && dashboardStatus) ? dashboardStatus : studentStatus;
  setStatus(target, message, state);
  if (target === dashboardStatus && studentStatus) setStatus(studentStatus, '');
  if (statusTimeout) {
    clearTimeout(statusTimeout);
    statusTimeout = null;
  }
  if (message && state === 'success' && autoClearMs) {
    statusTimeout = setTimeout(() => {
      setStatus(target, '');
    }, autoClearMs);
  }
}

function setButtonLoading(button, loading, text = 'Salvando...') {
  if (loading) {
    button.dataset.originalText = button.textContent;
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
    button.textContent = text;
    return;
  }
  button.disabled = false;
  button.removeAttribute('aria-busy');
  button.textContent = button.dataset.originalText || button.textContent;
  delete button.dataset.originalText;
}

function formatPhone(value) {
  const digits = phoneDigits(value).slice(0, 11);
  if (digits.length <= 2) return digits ? `(${digits}` : '';
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  const split = digits.length === 11 ? 7 : 6;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, split)}-${digits.slice(split)}`;
}

function parseDate(value) {
  return new Date(`${String(value || '').slice(0, 10)}T12:00:00Z`);
}

function formatDate(value) {
  const date = parseDate(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' }).format(date);
}

function formatDateLong(value) {
  const date = parseDate(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' }).format(date);
}

function dateOptionLabel(value) {
  const date = parseDate(value);
  return new Intl.DateTimeFormat('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' }).format(date);
}

function openSlots(item) {
  return Math.max(0, Number(item.capacidade || 8) - Number(item.inscritos || 0));
}

async function responseData(response, fallback) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.ok === false) throw new Error(data.error || fallback);
  return data;
}

function responseMarkup(item) {
  const answer = String(item.confirmado || '').toLowerCase();
  const teacherApproved = item.confirmado_professor === 'sim';
  if (answer === 'sim') {
    return `
      <div class="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
        <span class="px-3 py-2 sm:py-1.5 rounded-xl bg-zinc-800 text-emerald-400 text-xs font-medium border border-zinc-700 flex items-center gap-1.5 min-h-[38px]">
          <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
          ${teacherApproved ? 'Aprovado pelo Prof.' : 'Confirmado'}
        </span>
        <button class="px-3 py-2 sm:py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 text-xs font-medium border border-zinc-800 transition-all active:scale-95 min-h-[38px]" type="button" data-confirm-class="${escapeHTML(item.id)}" data-confirm-value="remover">Desmarcar</button>
      </div>`;
  }
  if (answer === 'nao') {
    return `
      <div class="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
        <span class="px-3 py-2 sm:py-1.5 rounded-xl bg-red-950/60 text-red-400 text-xs font-medium border border-red-900/40 min-h-[38px] flex items-center">Não vou</span>
        <button class="px-3 py-2 sm:py-1.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-semibold shadow-sm shadow-red-600/25 transition-all active:scale-95 min-h-[38px]" type="button" data-confirm-class="${escapeHTML(item.id)}" data-confirm-value="sim">Agora eu vou</button>
        <button class="px-2.5 py-2 sm:py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 text-xs font-medium border border-zinc-800 transition-all min-h-[38px]" type="button" data-confirm-class="${escapeHTML(item.id)}" data-confirm-value="remover">Remover</button>
      </div>`;
  }
  return `
    <div class="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
      <button class="flex-1 sm:flex-none px-4 py-2.5 sm:py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-semibold transition-all shadow-sm shadow-red-600/25 active:scale-95 min-h-[40px] flex items-center justify-center gap-1.5" type="button" data-confirm-class="${escapeHTML(item.id)}" data-confirm-value="sim">
        <span>Vou participar</span>
        <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg>
      </button>
      <button class="px-3 py-2.5 sm:py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 text-xs font-medium border border-zinc-800 transition-all min-h-[40px]" type="button" data-confirm-class="${escapeHTML(item.id)}" data-confirm-value="nao">Não vou</button>
    </div>`;
}

function renderUpcoming() {
  const items = agendaData.items || [];
  upcomingList.innerHTML = items.length ? items.map((item) => `
    <article class="p-3.5 sm:p-4 rounded-2xl bg-zinc-950/60 border border-zinc-800 hover:border-zinc-700 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3" data-scheduled-date="${escapeHTML(item.data)}">
      <div class="flex items-center gap-3.5">
        <div class="text-center min-w-[42px] sm:min-w-[48px]">
          <span class="block text-[10px] font-semibold text-zinc-500 uppercase">${escapeHTML(formatDate(item.data))}</span>
          <span class="block text-sm sm:text-base font-bold text-zinc-100">${escapeHTML(item.horario)}</span>
        </div>
        <div class="w-px h-8 bg-zinc-800"></div>
        <div>
          <div class="flex items-center gap-2 flex-wrap">
            <h4 class="text-xs sm:text-sm font-semibold text-zinc-200">${escapeHTML(item.turma || 'Turma')}</h4>
            ${item.professor ? `<span class="text-[10px] text-zinc-500">· Prof. ${escapeHTML(item.professor)}</span>` : ''}
          </div>
          <p class="text-[11px] text-zinc-500 mt-0.5">${escapeHTML(formatDateLong(item.data))}</p>
        </div>
      </div>
      ${responseMarkup(item)}
    </article>
  `).join('') : '<p class="text-xs text-zinc-500 text-center py-5 bg-zinc-950/30 rounded-2xl border border-zinc-800/40">Nenhuma aula confirmada no momento. Escolha seu horário na Grade da Semana acima.</p>';
}

function availableItems() {
  const requestedIds = new Set((agendaData.requests || []).map((item) => String(item.aula_id)));
  return (agendaData.available || []).filter((item) => !requestedIds.has(String(item.id)));
}

function setupAvailableFilters(preserveDate = false) {
  const items = availableItems();
  const previousDate = preserveDate ? dateFilter.value : '';
  const dates = [...new Set(items.map((item) => item.data))];
  dateFilter.innerHTML = '<option value="">Todas as datas</option>' + dates.map((date) => (
    `<option value="${escapeHTML(date)}">${escapeHTML(dateOptionLabel(date))}</option>`
  )).join('');
  dateFilter.value = dates.includes(previousDate) ? previousDate : '';
  setupAvailableTimes();
}

function setupAvailableTimes() {
  const previousTime = timeFilter.value;
  const source = availableItems().filter((item) => !dateFilter.value || item.data === dateFilter.value);
  const times = [...new Set(source.map((item) => item.horario))].sort();
  timeFilter.innerHTML = '<option value="">Todos os horários</option>' + times.map((time) => (
    `<option value="${escapeHTML(time)}">${escapeHTML(time)}</option>`
  )).join('');
  timeFilter.value = times.includes(previousTime) ? previousTime : '';
  timeFilter.disabled = !source.length;
  renderAvailable();
}

function renderAvailable() {
  const items = availableItems().filter((item) => (
    (!dateFilter.value || item.data === dateFilter.value)
    && (!timeFilter.value || item.horario === timeFilter.value)
  ));
  const requests = agendaData.requests || [];
  const requestsMarkup = requests.length ? `
    <div class="p-3 rounded-2xl bg-zinc-950 border border-zinc-800 text-xs space-y-1 mb-3">
      <strong class="text-zinc-200 block">${requests.length === 1 ? '1 solicitação aguardando professor:' : `${requests.length} solicitações aguardando professor:`}</strong>
      ${requests.map((item) => `<div class="text-zinc-400 text-[11px]">• ${escapeHTML(formatDate(item.data))} às ${escapeHTML(item.horario)} · ${escapeHTML(item.turma || 'Turma')}</div>`).join('')}
    </div>` : '';
  const listMarkup = items.length ? items.map((item) => `
    <article class="p-3 rounded-2xl bg-zinc-950/60 border border-zinc-800 hover:border-zinc-700 transition-colors flex items-center justify-between gap-3">
      <div>
        <strong class="text-xs font-semibold text-zinc-200 block">${escapeHTML(formatDateLong(item.data))} às ${escapeHTML(item.horario)}</strong>
        <p class="text-[11px] text-zinc-500 mt-0.5">${escapeHTML(item.turma || 'Turma')} · ${openSlots(item)} ${openSlots(item) === 1 ? 'vaga' : 'vagas'}</p>
      </div>
      <button class="px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-700 text-xs font-medium transition-all active:scale-95" type="button" data-book-class="${escapeHTML(item.id)}">Solicitar</button>
    </article>
  `).join('') : '<p class="text-xs text-zinc-500 text-center py-4 bg-zinc-950/30 rounded-2xl border border-zinc-800/40">Nenhuma outra aula com vaga para os filtros escolhidos.</p>';
  availableList.innerHTML = requestsMarkup + listMarkup;
}

function monthKeys(start, end) {
  const result = [];
  const cursor = new Date(`${String(start).slice(0, 7)}-01T12:00:00Z`);
  const finalKey = String(end).slice(0, 7);
  while (cursor.toISOString().slice(0, 7) <= finalKey && result.length < 3) {
    result.push(cursor.toISOString().slice(0, 7));
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return result;
}

function renderCalendar() {
  const scheduledDates = new Set((agendaData.items || []).map((item) => item.data));
  const availableDates = new Set(availableItems().map((item) => item.data));
  const requestedDates = new Set((agendaData.requests || []).map((item) => item.data));
  const start = agendaData.period_start;
  const end = agendaData.period_end;
  if (!start || !end) {
    calendar.innerHTML = '<p class="empty-state">Período indisponível.</p>';
    return;
  }

  calendar.innerHTML = monthKeys(start, end).map((key) => {
    const [year, month] = key.split('-').map(Number);
    const firstDay = new Date(Date.UTC(year, month - 1, 1));
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const offset = (firstDay.getUTCDay() + 6) % 7;
    const cells = Array.from({ length: offset }, () => '<span class="calendar-day blank" aria-hidden="true"></span>');
    for (let day = 1; day <= lastDay; day += 1) {
      const iso = `${key}-${String(day).padStart(2, '0')}`;
      const scheduled = scheduledDates.has(iso);
      const available = availableDates.has(iso);
      const requested = requestedDates.has(iso);
      const inPeriod = iso >= start && iso <= end;
      const selected = dateFilter.value === iso;
      const classes = ['calendar-day', scheduled ? 'has-scheduled' : '', available ? 'has-available' : '', requested ? 'has-request' : '', selected ? 'is-selected' : '', !inPeriod ? 'out-period' : ''].filter(Boolean).join(' ');
      const labelParts = [formatDateLong(iso)];
      if (scheduled) labelParts.push('sua aula');
      if (available) labelParts.push('aula com vaga');
      if (requested) labelParts.push('solicitação pendente');
      cells.push((scheduled || available || requested) && inPeriod
        ? `<button type="button" class="${classes}" data-calendar-date="${iso}" aria-label="${escapeHTML(labelParts.join(', '))}"><span>${day}</span><i></i></button>`
        : `<span class="${classes}" aria-hidden="true"><span>${day}</span></span>`);
    }
    const title = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(firstDay);
    return `
      <section class="calendar-month">
        <h3>${escapeHTML(title)}</h3>
        <div class="calendar-weekdays" aria-hidden="true"><span>Seg</span><span>Ter</span><span>Qua</span><span>Qui</span><span>Sex</span><span>Sáb</span><span>Dom</span></div>
        <div class="calendar-grid">${cells.join('')}</div>
      </section>`;
  }).join('');
}


function renderWeeklyQuota() {
  const semana = agendaData.semana || {};
  const student = agendaData.student || {};
  const limit = Number(semana.limite || 2);
  const confirmed = Number(semana.confirmadas || 0);
  const pct = Math.min(100, Math.round((confirmed / limit) * 100));

  if (quotaCounter) {
    quotaCounter.textContent = `${confirmed} de ${limit} ${limit === 1 ? 'aula' : 'aulas'}`;
  }

  if (quotaProgressBar) {
    quotaProgressBar.style.width = `${pct}%`;
  }

  const isFull = confirmed >= limit;
  if (quotaStatusPill) {
    quotaStatusPill.className = isFull
      ? 'text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-950/60 text-amber-400 border border-amber-800/40'
      : 'text-[10px] font-medium px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300 border border-zinc-700/50';
    quotaStatusPill.textContent = isFull ? 'Limite atingido' : `${limit - confirmed} ${(limit - confirmed) === 1 ? 'aula restante' : 'aulas restantes'}`;
  }

  if (quotaSubtext) {
    const planName = student.plano_nome || 'ativo';
    if (isFull) {
      quotaSubtext.textContent = `Limite atingido (${planName}: ${limit}x na semana). Para outro horário, desmarque uma aula acima.`;
    } else {
      quotaSubtext.textContent = `Plano ${planName}: até ${limit} ${limit === 1 ? 'aula' : 'aulas'} por semana.`;
    }
  }

  if (weeklyDatesBadge && semana.inicio && semana.fim) {
    weeklyDatesBadge.textContent = `Semana de ${formatDate(semana.inicio)} a ${formatDate(semana.fim)}`;
  }
}

function renderWeeklySchedule() {
  if (!weeklyList) return;
  const classes = agendaData.aulas_semana || [];
  const semana = agendaData.semana || {};
  const limit = Number(semana.limite || 2);
  const confirmedCount = Number(semana.confirmadas || 0);
  const quotaReached = confirmedCount >= limit;

  if (!classes.length) {
    weeklyList.innerHTML = '<p class="text-xs text-zinc-500 text-center py-6 bg-zinc-950/30 rounded-2xl border border-zinc-800/40">Nenhuma aula cadastrada para esta semana no momento.</p>';
    return;
  }

  weeklyList.innerHTML = classes.map((cls) => {
    const isStudentConfirmed = String(cls.confirmado || '').toLowerCase() === 'sim';
    const spotsLeft = Math.max(0, Number(cls.capacidade || 8) - Number(cls.inscritos || 0));
    const isFull = spotsLeft <= 0 && !isStudentConfirmed;
    const isPlanExpired = Boolean(agendaData.student?.plano_vencido);

    let actionButtonMarkup = '';
    if (isStudentConfirmed) {
      actionButtonMarkup = `
        <div class="weekly-class-action flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
          <span class="px-3 py-2 sm:py-1.5 rounded-xl bg-zinc-800 text-emerald-400 text-xs font-medium border border-zinc-700 flex items-center gap-1.5 min-h-[38px]">
            <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
            Confirmado
          </span>
          <button class="px-3 py-2 sm:py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 text-xs font-medium border border-zinc-800 transition-all active:scale-95 min-h-[38px]" type="button" data-confirm-class="${escapeHTML(cls.id)}" data-confirm-value="remover">Desmarcar</button>
        </div>
      `;
    } else if (isPlanExpired) {
      actionButtonMarkup = `
        <div class="weekly-class-action w-full sm:w-auto">
          <a class="w-full sm:w-auto px-3.5 py-2.5 sm:py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 text-xs font-medium flex items-center justify-center gap-1.5 hover:text-zinc-200 transition-colors min-h-[40px]" href="#pixDemoCard" title="Seu plano está vencido. Regularize via PIX para confirmar presença.">
            <svg class="w-3.5 h-3.5 text-zinc-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            <span>Plano vencido · Pagar PIX</span>
          </a>
        </div>
      `;
    } else if (isFull) {
      actionButtonMarkup = `
        <div class="weekly-class-action w-full sm:w-auto">
          <button class="w-full sm:w-auto px-3.5 py-2.5 sm:py-1.5 rounded-xl bg-zinc-900/80 border border-zinc-800 text-zinc-600 text-xs font-medium cursor-not-allowed min-h-[40px]" type="button" disabled>Lotada</button>
        </div>
      `;
    } else if (quotaReached) {
      actionButtonMarkup = `
        <div class="weekly-class-action w-full sm:w-auto">
          <button class="w-full sm:w-auto px-3.5 py-2.5 sm:py-1.5 rounded-xl bg-zinc-900/80 border border-zinc-800 text-zinc-500 text-xs font-medium cursor-not-allowed min-h-[40px]" type="button" disabled title="Você já atingiu o limite do seu plano nesta semana">Limite atingido (${confirmedCount}/${limit})</button>
        </div>
      `;
    } else {
      actionButtonMarkup = `
        <div class="weekly-class-action w-full sm:w-auto">
          <button class="w-full sm:w-auto px-4 py-2.5 sm:py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-semibold transition-all shadow-sm shadow-red-600/25 active:scale-95 min-h-[40px] flex items-center justify-center gap-1.5" type="button" data-confirm-class="${escapeHTML(cls.id)}" data-confirm-value="sim">
            <span>Vou participar</span>
            <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg>
          </button>
        </div>
      `;
    }

    return `
      <article class="p-3.5 sm:p-4 rounded-2xl bg-zinc-950/60 border ${isStudentConfirmed ? 'border-zinc-700 bg-zinc-900/40' : 'border-zinc-800 hover:border-zinc-700'} transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div class="flex items-center gap-3.5">
          <div class="text-center min-w-[42px] sm:min-w-[48px]">
            <span class="block text-[10px] font-semibold text-zinc-500 uppercase">${escapeHTML(dateOptionLabel(cls.data))}</span>
            <span class="block text-sm sm:text-base font-bold text-zinc-100">${escapeHTML(cls.horario)}</span>
          </div>
          <div class="w-px h-8 bg-zinc-800"></div>
          <div>
            <div class="flex items-center gap-2 flex-wrap">
              <h4 class="text-xs sm:text-sm font-semibold text-zinc-200">${escapeHTML(cls.turma || 'Turma Geral')}</h4>
              ${cls.professor ? `<span class="text-[10px] text-zinc-500">· Prof. ${escapeHTML(cls.professor)}</span>` : ''}
            </div>
            <p class="text-[11px] text-zinc-500 mt-0.5 flex items-center gap-1.5">
              <span class="w-1.5 h-1.5 rounded-full ${isFull ? 'bg-zinc-600' : 'bg-emerald-500'}"></span>
              ${spotsLeft > 0 ? `${spotsLeft} ${spotsLeft === 1 ? 'vaga livre' : 'vagas livres'}` : 'Lotada'}
            </p>
          </div>
        </div>
        <div class="w-full sm:w-auto flex justify-end">
          ${actionButtonMarkup}
        </div>
      </article>
    `;
  }).join('');
}

function renderDashboard() {
  const student = agendaData.student || {};
  const firstName = (student.nome || '').trim().split(/\s+/)[0] || 'Aluno';
  
  if (greeting) greeting.textContent = firstName;
  if (period) period.textContent = `Aulas até ${formatDateLong(agendaData.period_end)}.`;
  if (plan) plan.textContent = student.plano_nome || 'Plano 2x';

  // Plan status badge (clean dot, anti-AI-slop)
  const statusBadge = document.getElementById('studentPlanStatus');
  const expiredBanner = document.getElementById('expiredPlanBanner');
  const expiredTitle = document.getElementById('expiredBannerTitle');

  const isExpired = Boolean(student.plano_vencido);
  const formattedDueDate = formatDate(student.plano_vencimento);

  if (statusBadge) {
    if (isExpired) {
      statusBadge.className = 'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-950/80 text-red-400 border border-red-800/40 shrink-0';
      statusBadge.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-red-400"></span><span>Vencido (${formattedDueDate || 'hoje'})`;
    } else {
      statusBadge.className = 'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-950/80 text-emerald-400 border border-emerald-800/40 shrink-0';
      statusBadge.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span><span>Até ${formattedDueDate || 'o vencimento'}`;
    }
  }

  if (expiredBanner) {
    if (isExpired) {
      expiredBanner.style.display = 'flex';
      if (expiredTitle) expiredTitle.textContent = `Plano vencido em ${formattedDueDate || 'dias anteriores'}`;
    } else {
      expiredBanner.style.display = 'none';
    }
  }

  renderUpcoming();
  renderWeeklyQuota();
  renderWeeklySchedule();
  setupAvailableFilters(true);
  renderCalendar();
  initPixDemoArea(student, firstName);
  
  const searchCard = document.getElementById('studentSearchCard');
  if (searchCard) searchCard.style.display = 'none';
  dashboard.hidden = false;
}

function generatePixCode(pixKey, merchantName, merchantCity, amount, txId) {
  const f = (id, val) => `${id}${String(val.length).padStart(2, '0')}${val}`;
  const key = String(pixKey || '').replace(/\D/g, '');
  const name = String(merchantName || 'TEAM LUCAO').slice(0, 25).toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const city = String(merchantCity || 'SOROCABA').slice(0, 15).toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const valFormatted = Number(amount || 0).toFixed(2);
  const tx = String(txId || '***').slice(0, 25).toUpperCase().replace(/[^A-Z0-9]/g, '');

  const gui = f('00', 'br.gov.bcb.pix');
  const k = f('01', key);
  const mai = f('26', gui + k);

  const pfi = f('00', '01');
  const mcc = f('52', '0000');
  const curr = f('53', '986');
  const amt = f('54', valFormatted);
  const cc = f('58', 'BR');
  const mn = f('59', name);
  const mc = f('60', city);
  const addData = f('62', f('05', tx));

  const raw = pfi + mai + mcc + curr + amt + cc + mn + mc + addData + '6304';

  let crc = 0xFFFF;
  for (let i = 0; i < raw.length; i++) {
    crc ^= (raw.charCodeAt(i) << 8);
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ 0x1021) & 0xFFFF;
      } else {
        crc = (crc << 1) & 0xFFFF;
      }
    }
  }
  const crcHex = (crc & 0xFFFF).toString(16).toUpperCase().padStart(4, '0');
  return raw + crcHex;
}

let pixInitialized = false;

function initPixDemoArea(student, firstName) {
  const select = document.getElementById('pixPlanSelect');
  const displayAmount = document.getElementById('pixDisplayAmount');
  const btnGenerate = document.getElementById('btnGeneratePix');
  const resultBox = document.getElementById('pixResultBox');
  const qrImg = document.getElementById('pixQrImage');
  const copyInput = document.getElementById('pixCopyCode');
  const btnCopy = document.getElementById('btnCopyPix');
  const btnCopyText = document.getElementById('btnCopyPixText');
  const btnSimulate = document.getElementById('btnSimulatePix');

  if (!select || !btnGenerate) return;

  if (student.mensalidade && student.mensalidade > 0) {
    const matchingOption = Array.from(select.options).find((opt) => Number(opt.value) === Number(student.mensalidade));
    if (matchingOption) select.value = matchingOption.value;
  }

  const updateDisplayPrice = () => {
    const val = Number(select.value || 260);
    if (displayAmount) displayAmount.textContent = `R$ ${val.toFixed(2).replace('.', ',')}`;
  };
  updateDisplayPrice();

  if (!pixInitialized) {
    pixInitialized = true;

    select.addEventListener('change', () => {
      updateDisplayPrice();
      if (resultBox && resultBox.style.display !== 'none') {
        renderCurrentPix();
      }
    });

    const renderCurrentPix = () => {
      const amount = select.value;
      const cleanName = (firstName || 'ALUNO').toUpperCase().replace(/[^A-Z]/g, '');
      const pixString = generatePixCode('15996744160', 'TEAM LUCAO', 'SOROCABA', amount, `TL${cleanName}`);
      if (copyInput) copyInput.value = pixString;
      if (qrImg) {
        qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&margin=2&data=${encodeURIComponent(pixString)}`;
      }
      if (resultBox) resultBox.style.display = 'flex';
    };

    btnGenerate.addEventListener('click', () => {
      renderCurrentPix();
      resultBox?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });

async function copyPixText(text, inputElement) {
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (e) {}
  }
  // Fallback para WebViews (WhatsApp, Instagram, Android antigo)
  try {
    const tempArea = document.createElement('textarea');
    tempArea.value = text;
    tempArea.setAttribute('readonly', '');
    tempArea.style.position = 'fixed';
    tempArea.style.top = '-9999px';
    tempArea.style.left = '-9999px';
    tempArea.style.opacity = '0';
    document.body.appendChild(tempArea);
    tempArea.focus();
    tempArea.select();
    tempArea.setSelectionRange(0, 99999);
    const successful = document.execCommand('copy');
    document.body.removeChild(tempArea);
    if (successful) return true;
  } catch (e) {}
  if (inputElement) {
    try {
      inputElement.focus();
      inputElement.select();
      inputElement.setSelectionRange(0, 99999);
      return document.execCommand('copy');
    } catch (e) {}
  }
  return false;
}

    if (btnCopy && copyInput) {
      btnCopy.addEventListener('click', async () => {
        const text = copyInput.value;
        if (!text) return;
        const ok = await copyPixText(text, copyInput);
        if (ok) {
          btnCopy.classList.add('bg-emerald-600', 'text-white');
          if (btnCopyText) btnCopyText.textContent = 'Copiado!';
          if (navigator.vibrate) { try { navigator.vibrate(40); } catch (e) {} }
        } else {
          if (btnCopyText) btnCopyText.textContent = 'Erro ao copiar';
        }
        setTimeout(() => {
          btnCopy.classList.remove('bg-emerald-600', 'text-white');
          if (btnCopyText) btnCopyText.textContent = 'Copiar';
        }, 2500);
      });
    }

    if (btnSimulate) {
      btnSimulate.addEventListener('click', async () => {
        setButtonLoading(btnSimulate, true, 'Confirmando pagamento...');
        try {
          const res = await fetch('/api/public/simulate-pix', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ telefone: currentPhone })
          });
          const data = await responseData(res, 'Não foi possível confirmar o pagamento simulado.');
          setStatus(studentStatus, 'Pagamento PIX confirmado com sucesso! Seu plano foi renovado e suas aulas foram liberadas.', 'success');
          await loadAgenda();
        } catch (err) {
          setStatus(studentStatus, err.message, 'error');
        } finally {
          setButtonLoading(btnSimulate, false);
        }
      });
    }
  }
}

async function loadAgenda() {
  const response = await fetch(`/api/public/student-classes?telefone=${encodeURIComponent(currentPhone)}`, { cache: 'no-store' });
  agendaData = await responseData(response, 'Aluno não encontrado. Confira o WhatsApp informado.');
  renderDashboard();
}

async function findClasses(event) {
  event.preventDefault();
  const phone = phoneInput.value.trim();
  if (phoneDigits(phone).length < 10) {
    showStatus('Informe um WhatsApp válido com DDD.', 'error');
    phoneInput.focus();
    return;
  }
  currentPhone = phone;
  try { localStorage.setItem("tlf_student_phone", phone); } catch {}
  phoneInput.blur();
  document.activeElement?.blur();
  dashboard.hidden = true;
  setButtonLoading(searchButton, true, 'Buscando...');
  showStatus('Buscando sua agenda...', '');
  try {
    await loadAgenda();
    const count = (agendaData.items || []).length;
    showStatus(count
      ? `${count} ${count === 1 ? 'aula confirmada encontrada' : 'aulas confirmadas encontradas'} até o vencimento.`
      : 'Agenda encontrada. Confira a grade semanal para confirmar presenças.', 'success');
  } catch (error) {
    showStatus(error.message, 'error');
    dashboard.hidden = true;
  } finally {
    setButtonLoading(searchButton, false);
  }
}

async function updateConfirmation(classId, value, button) {
  if (button) setButtonLoading(button, true, value === 'remover' ? 'Desmarcando...' : 'Confirmando...');
  showStatus(value === 'remover' ? 'Desmarcando presença...' : 'Confirmando presença...', '');
  try {
    const response = await fetch('/api/public/student-confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ telefone: currentPhone, aula_id: classId, confirmado: value })
    });
    const data = await responseData(response, 'Não foi possível salvar sua resposta.');
    await loadAgenda();
    showStatus(value === 'sim'
      ? 'Presença confirmada! Aguarde a liberação do professor.'
      : value === 'nao'
        ? 'Ausência informada ao professor.'
        : 'Aula desmarcada com sucesso. Sua vaga foi liberada.', 'success');
  } catch (error) {
    if (button) setButtonLoading(button, false);
    showStatus(error.message, 'error', 6000);
  }
}

async function requestClass(classId, button) {
  const classItem = availableItems().find((item) => String(item.id) === String(classId));
  if (!classItem) return;
  setButtonLoading(button, true, 'Solicitando...');
  showStatus('Enviando sua solicitação...', '');
  try {
    const response = await fetch('/api/public/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nome: agendaData.student?.nome || 'Aluno',
        telefone: currentPhone,
        aula_id: classId,
        observacao: 'Solicitação de horário regular pelo aluno.'
      })
    });
    const data = await responseData(response, 'Não foi possível enviar a solicitação.');
    agendaData.requests = [...(agendaData.requests || []), {
      ...data.item,
      aula_id: classItem.id,
      data: classItem.data,
      horario: classItem.horario,
      turma: classItem.turma,
      tipo: classItem.tipo
    }];
    setupAvailableFilters(true);
    renderCalendar();
    showStatus('Solicitação enviada. O professor confirmará pelo WhatsApp.', 'success');
  } catch (error) {
    setButtonLoading(button, false);
    showStatus(error.message, 'error', 6000);
  }
}

function selectCalendarDate(value) {
  if (availableItems().some((item) => item.data === value)) {
    dateFilter.value = value;
    setupAvailableTimes();
    renderCalendar();
    document.getElementById('availableTitle').scrollIntoView({ behavior: 'smooth', block: 'start' });
    return;
  }
  const scheduled = upcomingList.querySelector(`[data-scheduled-date="${CSS.escape(value)}"]`);
  if (scheduled) {
    scheduled.scrollIntoView({ behavior: 'smooth', block: 'center' });
    scheduled.classList.add('is-highlighted');
    window.setTimeout(() => scheduled.classList.remove('is-highlighted'), 1300);
  }
}

async function loadGuestClasses() {
  setStatus(guestStatus, 'Carregando todas as aulas disponíveis...');
  guestDate.disabled = true;
  try {
    const response = await fetch('/api/public/classes', { cache: 'no-store' });
    const data = await responseData(response, 'Não foi possível carregar os horários.');
    // Sempre mantem TODAS as aulas futuras cadastradas
    guestClasses = data.items || [];
    setupGuestDates();
    guestClassesLoaded = true;
    const availableCount = guestClasses.filter((item) => openSlots(item) > 0).length;
    setStatus(guestStatus, availableCount
      ? 'Escolha uma data e selecione o horário desejado.'
      : 'Todas as aulas cadastradas no momento estão lotadas.');
    renderGuestClassList();
  } catch (error) {
    setStatus(guestStatus, error.message, 'error');
  } finally {
    guestDate.disabled = false;
  }
}

function setupGuestDates() {
  const dates = [...new Set(guestClasses.map((item) => item.data))];
  guestDate.innerHTML = '<option value="">Selecione a data</option>' + dates.map((date) => {
    const forDate = guestClasses.filter((item) => item.data === date);
    const hasSpots = forDate.some((item) => openSlots(item) > 0);
    return `<option value="${escapeHTML(date)}">${escapeHTML(formatDateLong(date))}${hasSpots ? '' : ' (Lotada)'}</option>`;
  }).join('');
  setupGuestTimes();
}

function setupGuestTimes() {
  const items = guestClasses.filter((item) => item.data === guestDate.value);
  if (!guestDate.value) {
    guestTime.innerHTML = '<option value="">Escolha primeiro a data</option>';
    guestTime.disabled = true;
    renderGuestClassList();
    return;
  }

  guestTime.innerHTML = '<option value="">Selecione o horário</option>' + items.map((item) => {
    const slots = openSlots(item);
    const available = slots > 0;
    if (available) {
      return `<option value="${escapeHTML(item.id)}">${escapeHTML(item.horario)} · ${escapeHTML(item.turma || 'Turma')} · ${slots} ${slots === 1 ? 'vaga livre' : 'vagas livres'}</option>`;
    } else {
      return `<option value="${escapeHTML(item.id)}" disabled style="color: var(--muted); opacity: 0.5;">${escapeHTML(item.horario)} · ${escapeHTML(item.turma || 'Turma')} · (Lotada / Indisponível)</option>`;
    }
  }).join('');

  guestTime.disabled = !items.length;
  renderGuestClassList();
}

function renderGuestClassList() {
  const container = document.getElementById('guestClassesList');
  if (!container) return;
  const source = guestClasses;

  if (!source.length) {
    container.innerHTML = '<p class="text-xs text-zinc-500 text-center py-6 bg-zinc-950/30 rounded-2xl border border-zinc-800/40">Nenhuma aula com vagas livres no momento.</p>';
    return;
  }

  container.innerHTML = source.map((item) => {
    const slots = openSlots(item);
    const available = slots > 0;
    const isSelected = String(guestTime.value) === String(item.id);

    return `
      <article class="p-3 sm:p-3.5 rounded-2xl ${isSelected ? 'bg-red-950/30 border-red-600 ring-1 ring-red-600' : 'bg-zinc-950/60 border-zinc-800 hover:border-zinc-700'} border transition-all flex items-center justify-between gap-3 cursor-pointer select-none" data-pick-guest="${escapeHTML(item.id)}" data-pick-date="${escapeHTML(item.data)}" data-pick-title="${escapeHTML(dateOptionLabel(item.data))} às ${escapeHTML(item.horario)} - ${escapeHTML(item.turma || 'Turma')}">
        <div class="flex items-center gap-3">
          <div class="text-center min-w-[40px]">
            <span class="block text-[10px] font-semibold text-zinc-500 uppercase">${escapeHTML(dateOptionLabel(item.data))}</span>
            <span class="block text-sm font-bold text-zinc-100">${escapeHTML(item.horario)}</span>
          </div>
          <div class="w-px h-7 bg-zinc-800"></div>
          <div>
            <div class="flex items-center gap-2">
              <h4 class="text-xs font-semibold text-zinc-200">${escapeHTML(item.turma || 'Turma Geral')}</h4>
              ${item.professor ? `<span class="text-[10px] text-zinc-500">· ${escapeHTML(item.professor)}</span>` : ''}
            </div>
            <p class="text-[10px] text-zinc-500 mt-0.5 flex items-center gap-1">
              <span class="w-1.5 h-1.5 rounded-full ${available ? 'bg-emerald-500' : 'bg-zinc-600'}"></span>
              ${available ? `${slots} ${slots === 1 ? 'vaga livre' : 'vagas livres'}` : 'Lotada'}
            </p>
          </div>
        </div>
        <div class="shrink-0">
          ${isSelected ? `
            <span class="px-2.5 py-1 rounded-lg bg-red-600 text-white text-xs font-bold flex items-center gap-1">
              ✓ Escolhido
            </span>
          ` : (available ? `
            <span class="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium border border-zinc-700">
              Escolher
            </span>
          ` : `
            <span class="px-2.5 py-1 rounded-lg bg-zinc-900 text-zinc-600 text-xs font-medium">
              Lotada
            </span>
          `)}
        </div>
      </article>
    `;
  }).join('');
}

function switchMode(showGuest) {
  studentPanel.hidden = showGuest;
  guestPanel.hidden = !showGuest;

  const tabStudent = document.getElementById('tabStudentPortal');
  const tabGuest = document.getElementById('tabGuestPortal');
  if (tabStudent && tabGuest) {
    if (showGuest) {
      tabStudent.className = 'px-4 sm:px-5 py-2.5 sm:py-2 rounded-xl font-medium transition-all text-zinc-400 hover:text-zinc-200 flex items-center gap-2 min-h-[40px]';
      tabGuest.className = 'px-4 sm:px-5 py-2.5 sm:py-2 rounded-xl font-semibold transition-all bg-zinc-800 text-white shadow-sm flex items-center gap-2 min-h-[40px]';
    } else {
      tabStudent.className = 'px-4 sm:px-5 py-2.5 sm:py-2 rounded-xl font-semibold transition-all bg-zinc-800 text-white shadow-sm flex items-center gap-2 min-h-[40px]';
      tabGuest.className = 'px-4 sm:px-5 py-2.5 sm:py-2 rounded-xl font-medium transition-all text-zinc-400 hover:text-zinc-200 flex items-center gap-2 min-h-[40px]';
    }
  }

  if (showGuest) {
    try { history.replaceState(null, '', '#experimental'); } catch (e) {}
  } else {
    try { history.replaceState(null, '', '#aulas'); } catch (e) {}
  }

  if (heroTitle) heroTitle.textContent = showGuest ? 'Team Lucão • Aula Experimental' : 'Team Lucão • Grade & Presenças';
  if (heroDescription) {
    heroDescription.textContent = showGuest
      ? 'Escolha uma aula disponível na grade e solicite seu agendamento em poucos segundos.'
      : 'Consulte sua agenda semanal, confirme suas presenças e acompanhe seu plano em tempo real.';
  }

  if (showGuest) {
    if (!guestClassesLoaded) loadGuestClasses();
    if (window.innerWidth >= 1024) {
      window.setTimeout(() => guestName?.focus(), 50);
    }
  } else {
    if (window.innerWidth >= 1024 && !currentPhone) {
      window.setTimeout(() => phoneInput?.focus(), 50);
    }
  }
}

async function submitGuestBooking(event) {
  event.preventDefault();
  const name = guestName.value.trim();
  const phone = guestPhone.value.trim();
  const classId = guestTime.value;
  if (!name) {
    setStatus(guestStatus, 'Informe seu nome.', 'error');
    guestName.focus();
    return;
  }
  if (phoneDigits(phone).length < 10) {
    setStatus(guestStatus, 'Informe um WhatsApp válido com DDD.', 'error');
    guestPhone.focus();
    return;
  }
  if (!classId) {
    setStatus(guestStatus, 'Escolha uma data e um horário disponível.', 'error');
    return;
  }

  guestPhone.blur();
  guestName.blur();
  document.activeElement?.blur();

  setButtonLoading(guestButton, true, 'Enviando pedido...');
  setStatus(guestStatus, 'Enviando sua solicitação...');
  const referral = document.getElementById('guestReferral')?.value?.trim() || '';
  try {
    const response = await fetch('/api/public/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nome: name,
        telefone: phone,
        aula_id: classId,
        observacao: 'Aula experimental solicitada.',
        indicado_por: referral
      })
    });
    await responseData(response, 'Não foi possível solicitar a aula experimental.');
    guestClasses = guestClasses.filter((item) => String(item.id) !== String(classId));
    guestDate.value = '';
    setupGuestDates();
    setStatus(guestStatus, 'Pedido enviado! O professor confirmará sua aula pelo WhatsApp.', 'success');
  } catch (error) {
    setStatus(guestStatus, error.message, 'error');
  } finally {
    setButtonLoading(guestButton, false);
  }
}

form.addEventListener('submit', findClasses);
phoneInput.addEventListener('input', () => { phoneInput.value = formatPhone(phoneInput.value); });
guestPhone.addEventListener('input', () => { guestPhone.value = formatPhone(guestPhone.value); });
dateFilter.addEventListener('change', () => { setupAvailableTimes(); renderCalendar(); });
timeFilter.addEventListener('change', renderAvailable);
guestDate.addEventListener('change', setupGuestTimes);

if (guestModeButton) {
  guestModeButton.addEventListener('click', () => switchMode(guestPanel.hidden));
}

const tabStudent = document.getElementById('tabStudentPortal');
const tabGuest = document.getElementById('tabGuestPortal');
if (tabStudent) tabStudent.addEventListener('click', () => switchMode(false));
if (tabGuest) tabGuest.addEventListener('click', () => switchMode(true));


const guestListContainer = document.getElementById('guestClassesList');
if (guestListContainer) {
  guestListContainer.addEventListener('click', (event) => {
    const card = event.target.closest('[data-pick-guest]');
    if (!card) return;
    const classId = card.dataset.pickGuest;
    const date = card.dataset.pickDate;
    const title = card.dataset.pickTitle;

    guestDate.innerHTML = '<option value="' + date + '" selected>' + date + '</option>';
    guestDate.value = date;
    guestTime.innerHTML = '<option value="' + classId + '" selected>' + classId + '</option>';
    guestTime.value = classId;

    const notice = document.getElementById('guestSelectedNotice');
    if (notice) {
      notice.className = 'p-3 rounded-2xl bg-red-950/40 border border-red-900/40 text-red-200 text-xs font-medium mb-4 flex items-center gap-2';
      notice.innerHTML = '<svg class="w-4 h-4 text-red-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg><span>Aula: <strong>' + escapeHTML(title) + '</strong></span>';
    }

    renderGuestClassList();
    if (window.innerWidth < 1024) {
      const formCard = document.getElementById('guestBookingForm');
      formCard?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else {
      document.getElementById('guestName')?.focus();
    }
  });
}

guestForm.addEventListener('submit', submitGuestBooking);

if (upcomingList) {
  upcomingList.addEventListener('click', (event) => {
    const button = event.target.closest('[data-confirm-class]');
    if (button && !button.disabled) updateConfirmation(button.dataset.confirmClass, button.dataset.confirmValue, button);
  });
}

if (weeklyList) {
  weeklyList.addEventListener('click', (event) => {
    const button = event.target.closest('[data-confirm-class]');
    if (button && !button.disabled) updateConfirmation(button.dataset.confirmClass, button.dataset.confirmValue, button);
  });
}

availableList.addEventListener('click', (event) => {
  const button = event.target.closest('[data-book-class]');
  if (button) requestClass(button.dataset.bookClass, button);
});

calendar.addEventListener('click', (event) => {
  const button = event.target.closest('[data-calendar-date]');
  if (button) selectCalendarDate(button.dataset.calendarDate);
});


const btnSearchAgain = document.getElementById('btnSearchAgain');
if (btnSearchAgain) {
  btnSearchAgain.addEventListener('click', () => {
    dashboard.hidden = true;
    const searchCard = document.getElementById('studentSearchCard');
    if (searchCard) searchCard.style.display = 'block';
    phoneInput.value = "";
    try { localStorage.removeItem("tlf_student_phone"); } catch {}
    phoneInput.focus();
    setStatus(studentStatus, '');
  });
}

// Resposta tátil instantânea no Android (elimina atraso de toque)
document.addEventListener('touchstart', () => {}, { passive: true });

// Auto-login do aluno via localStorage ou query params (?telefone= / ?phone=)
function initStudentPortal() {
  const hash = window.location.hash.toLowerCase();
  const urlParams = new URLSearchParams(window.location.search);
  const paramPhone = urlParams.get('telefone') || urlParams.get('phone');
  const isGuestMode = hash === '#experimental' || hash === '#guest' || urlParams.get('tab') === 'guest';

  if (isGuestMode) {
    switchMode(true);
    return;
  }

  const storedPhone = paramPhone || (function() {
    try { return localStorage.getItem('tlf_student_phone'); } catch (e) { return null; }
  })();

  if (storedPhone && phoneDigits(storedPhone).length >= 10) {
    phoneInput.value = formatPhone(storedPhone);
    currentPhone = phoneDigits(storedPhone);
    dashboard.hidden = true;
    setButtonLoading(searchButton, true, 'Carregando...');
    setStatus(studentStatus, 'Carregando sua agenda...');
    loadAgenda().catch(() => {
      const searchCard = document.getElementById('studentSearchCard');
      if (searchCard) searchCard.style.display = 'block';
      setButtonLoading(searchButton, false);
      setStatus(studentStatus, '');
    });
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initStudentPortal);
} else {
  initStudentPortal();
}
