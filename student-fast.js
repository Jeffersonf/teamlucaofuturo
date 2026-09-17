const phoneDigits = (value) => String(value || '').replace(/\D/g, '');
const escapeHTML = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
}[char]));

const form = document.getElementById('studentFastForm');
const phoneInput = document.getElementById('studentFastPhone');
const searchButton = form.querySelector('button[type="submit"]');
const studentStatus = document.getElementById('studentFastStatus');
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
  if (state) target.dataset.state = state;
  else delete target.dataset.state;
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
      <div class="class-response">
        <span class="response-pill yes">${teacherApproved ? 'Confirmada pelo professor' : 'Você informou que vai'}</span>
        <button class="response-button secondary" type="button" data-confirm-class="${escapeHTML(item.id)}" data-confirm-value="remover">Remover confirmação</button>
      </div>`;
  }
  if (answer === 'nao') {
    return `
      <div class="class-response">
        <span class="response-pill no">Você informou que não vai</span>
        <div class="class-actions">
          <button class="response-button yes" type="button" data-confirm-class="${escapeHTML(item.id)}" data-confirm-value="sim">Agora eu vou</button>
          <button class="response-button secondary" type="button" data-confirm-class="${escapeHTML(item.id)}" data-confirm-value="remover">Remover resposta</button>
        </div>
      </div>`;
  }
  return `
    <div class="class-response">
      <span class="response-question">Você vai participar?</span>
      <div class="class-actions">
        <button class="response-button yes" type="button" data-confirm-class="${escapeHTML(item.id)}" data-confirm-value="sim">Sim, eu vou</button>
        <button class="response-button no" type="button" data-confirm-class="${escapeHTML(item.id)}" data-confirm-value="nao">Não vou</button>
      </div>
    </div>`;
}

function renderUpcoming() {
  const items = agendaData.items || [];
  upcomingList.innerHTML = items.length ? items.map((item) => `
    <article class="student-class-card response-${escapeHTML(item.confirmado || 'pending')}" data-scheduled-date="${escapeHTML(item.data)}">
      <div class="class-main">
        <time datetime="${escapeHTML(item.data)}T${escapeHTML(item.horario)}">
          <span>${escapeHTML(formatDate(item.data))}</span>
          <strong>${escapeHTML(item.horario)}</strong>
        </time>
        <div class="class-copy">
          <strong>${escapeHTML(item.turma || 'Turma')}</strong>
          <small>${escapeHTML(formatDateLong(item.data))}${item.professor ? ` · ${escapeHTML(item.professor)}` : ''}</small>
        </div>
      </div>
      ${responseMarkup(item)}
    </article>
  `).join('') : '<p class="empty-state">Não há aulas indicadas para você até a data de vencimento deste período.</p>';
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
    <div class="request-summary">
      <strong>${requests.length === 1 ? '1 solicitação aguardando o professor' : `${requests.length} solicitações aguardando o professor`}</strong>
      ${requests.map((item) => `<span>${escapeHTML(formatDate(item.data))} às ${escapeHTML(item.horario)} · ${escapeHTML(item.turma || 'Turma')}</span>`).join('')}
    </div>` : '';
  const listMarkup = items.length ? items.map((item) => `
    <article class="available-class-card">
      <div>
        <strong>${escapeHTML(formatDateLong(item.data))} às ${escapeHTML(item.horario)}</strong>
        <small>${escapeHTML(item.turma || 'Turma')} · ${openSlots(item)} ${openSlots(item) === 1 ? 'vaga disponível' : 'vagas disponíveis'}</small>
      </div>
      <button type="button" data-book-class="${escapeHTML(item.id)}">Solicitar vaga</button>
    </article>
  `).join('') : '<p class="empty-state">Nenhuma outra aula com vaga para os filtros escolhidos.</p>';
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
    quotaCounter.textContent = `${confirmed} de ${limit} ${limit === 1 ? 'aula confirmada' : 'aulas confirmadas'}`;
  }

  if (quotaProgressBar) {
    quotaProgressBar.style.width = `${pct}%`;
  }

  const isFull = confirmed >= limit;
  if (quotaStatusPill) {
    quotaStatusPill.className = isFull ? 'quota-status-pill full' : 'quota-status-pill';
    quotaStatusPill.textContent = isFull ? 'Limite atingido' : `${limit - confirmed} ${(limit - confirmed) === 1 ? 'vaga restante' : 'vagas restantes'}`;
  }

  if (quotaSubtext) {
    const planName = student.plano_nome || 'ativo';
    if (isFull) {
      quotaSubtext.textContent = `Você já atingiu o limite do seu plano (${planName}: ${limit}x na semana). Para escolher outro horário, desmarque uma aula confirmada abaixo.`;
    } else {
      quotaSubtext.textContent = `Seu plano (${planName}) permite confirmar até ${limit} ${limit === 1 ? 'aula' : 'aulas'} por semana.`;
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
    weeklyList.innerHTML = '<p class="empty-state">Nenhuma aula cadastrada para esta semana no momento.</p>';
    return;
  }

  weeklyList.innerHTML = classes.map((cls) => {
    const isStudentConfirmed = String(cls.confirmado || '').toLowerCase() === 'sim';
    const spotsLeft = Math.max(0, Number(cls.capacidade || 8) - Number(cls.inscritos || 0));
    const isFull = spotsLeft <= 0 && !isStudentConfirmed;

    let actionButtonMarkup = '';
    if (isStudentConfirmed) {
      actionButtonMarkup = `
        <div class="weekly-class-action">
          <span class="confirmed-badge">✓ Confirmado</span>
          <button class="btn-unconfirm-slot" type="button" data-confirm-class="${escapeHTML(cls.id)}" data-confirm-value="remover">Desmarcar</button>
        </div>
      `;
    } else if (isFull) {
      actionButtonMarkup = `
        <div class="weekly-class-action">
          <button class="btn-confirm-slot" type="button" disabled>Aula lotada</button>
        </div>
      `;
    } else if (quotaReached) {
      actionButtonMarkup = `
        <div class="weekly-class-action">
          <button class="btn-confirm-slot" type="button" disabled title="Você já atingiu o limite do seu plano nesta semana">Limite atingido (${confirmedCount}/${limit})</button>
        </div>
      `;
    } else {
      actionButtonMarkup = `
        <div class="weekly-class-action">
          <button class="btn-confirm-slot" type="button" data-confirm-class="${escapeHTML(cls.id)}" data-confirm-value="sim">Confirmar presença</button>
        </div>
      `;
    }

    return `
      <article class="weekly-class-card ${isStudentConfirmed ? 'is-confirmed' : ''} ${isFull ? 'is-full' : ''}">
        <div class="weekly-timebox">
          <span>${escapeHTML(dateOptionLabel(cls.data))}</span>
          <strong>${escapeHTML(cls.horario)}</strong>
        </div>
        <div class="weekly-class-info">
          <strong>${escapeHTML(cls.turma || 'Turma Geral')}</strong>
          <div class="weekly-class-meta">
            <span>${escapeHTML(formatDateLong(cls.data))}</span>
            ${cls.professor ? `<span>· Prof. ${escapeHTML(cls.professor)}</span>` : ''}
            <span>· ${spotsLeft} ${spotsLeft === 1 ? 'vaga disponível' : 'vagas disponíveis'}</span>
          </div>
        </div>
        ${actionButtonMarkup}
      </article>
    `;
  }).join('');
}

function renderDashboard() {
  const student = agendaData.student || {};
  const firstName = (student.nome || '').trim().split(/\s+/)[0] || 'aluno';
  greeting.textContent = `Olá, ${firstName}! Seja bem-vindo(a).`;
  period.textContent = `Aulas de hoje até ${formatDateLong(agendaData.period_end)}.`;
  plan.textContent = student.plano_nome || 'Aluno ativo';
  renderUpcoming();
  renderWeeklyQuota();
  renderWeeklySchedule();
  setupAvailableFilters(true);
  renderCalendar();
  dashboard.hidden = false;
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
    setStatus(studentStatus, 'Informe um WhatsApp válido com DDD.', 'error');
    phoneInput.focus();
    return;
  }
  currentPhone = phone;
  dashboard.hidden = true;
  setButtonLoading(searchButton, true, 'Buscando...');
  setStatus(studentStatus, 'Buscando sua agenda...');
  try {
    await loadAgenda();
    const count = (agendaData.items || []).length;
    setStatus(studentStatus, count
      ? `${count} ${count === 1 ? 'aula encontrada' : 'aulas encontradas'} até o vencimento.`
      : 'Agenda encontrada. Confira também as aulas disponíveis.', 'success');
  } catch (error) {
    setStatus(studentStatus, error.message, 'error');
    dashboard.hidden = true;
  } finally {
    setButtonLoading(searchButton, false);
  }
}

async function updateConfirmation(classId, value, button) {
  setButtonLoading(button, true);
  setStatus(studentStatus, value === 'remover' ? 'Removendo sua resposta...' : 'Salvando sua resposta...');
  try {
    const response = await fetch('/api/public/student-confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ telefone: currentPhone, aula_id: classId, confirmado: value })
    });
    const data = await responseData(response, 'Não foi possível salvar sua resposta.');
    await loadAgenda();
    setStatus(studentStatus, value === 'sim'
      ? 'Presença informada. Agora é só aguardar a confirmação do professor.'
      : value === 'nao'
        ? 'Ausência informada ao professor.'
        : 'Sua resposta foi removida.', 'success');
  } catch (error) {
    setButtonLoading(button, false);
    setStatus(studentStatus, error.message, 'error');
  }
}

async function requestClass(classId, button) {
  const classItem = availableItems().find((item) => String(item.id) === String(classId));
  if (!classItem) return;
  setButtonLoading(button, true, 'Solicitando...');
  setStatus(studentStatus, 'Enviando sua solicitação...');
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
    setStatus(studentStatus, 'Solicitação enviada. O professor confirmará pelo WhatsApp.', 'success');
  } catch (error) {
    setButtonLoading(button, false);
    setStatus(studentStatus, error.message, 'error');
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
  const source = guestDate.value
    ? guestClasses.filter((item) => item.data === guestDate.value)
    : guestClasses;

  if (!source.length) {
    container.innerHTML = '<p class="empty-state">Nenhuma aula programada no momento.</p>';
    return;
  }

  container.innerHTML = source.map((item) => {
    const slots = openSlots(item);
    const available = slots > 0;
    const isSelected = String(guestTime.value) === String(item.id);

    return `
      <article class="guest-slot-card ${available ? '' : 'is-full'} ${isSelected ? 'is-selected' : ''}">
        <div class="guest-slot-timebox">
          <span>${escapeHTML(dateOptionLabel(item.data))}</span>
          <strong>${escapeHTML(item.horario)}</strong>
        </div>
        <div class="guest-slot-info">
          <strong>${escapeHTML(item.turma || 'Turma Geral')}</strong>
          <div class="guest-slot-meta">
            <span>${escapeHTML(formatDateLong(item.data))}</span>
            ${item.professor ? `<span>· Prof. ${escapeHTML(item.professor)}</span>` : ''}
            <span>· ${available ? `${slots} ${slots === 1 ? 'vaga livre' : 'vagas livres'}` : 'Lotada'}</span>
          </div>
        </div>
        ${available ? `
          <button class="btn-pick-guest-slot" type="button" data-pick-guest="${escapeHTML(item.id)}" data-pick-date="${escapeHTML(item.data)}">
            ${isSelected ? '✓ Selecionado' : 'Escolher este horário'}
          </button>
        ` : `
          <button class="btn-pick-guest-slot" type="button" disabled title="Esta aula já está com capacidade máxima">
            Sem vagas (Lotada)
          </button>
        `}
      </article>
    `;
  }).join('');
}

function switchMode(showGuest) {
  studentPanel.hidden = showGuest;
  guestPanel.hidden = !showGuest;

  if (guestModeButton) {
    guestModeButton.textContent = showGuest ? '← Voltar para Sou Aluno' : '⭐ Não sou aluno (Experimental)';
    guestModeButton.setAttribute('aria-expanded', String(showGuest));
  }

  const tabStudent = document.getElementById('tabStudentPortal');
  const tabGuest = document.getElementById('tabGuestPortal');
  if (tabStudent && tabGuest) {
    tabStudent.classList.toggle('active', !showGuest);
    tabStudent.setAttribute('aria-selected', String(!showGuest));
    tabGuest.classList.toggle('active', showGuest);
    tabGuest.setAttribute('aria-selected', String(showGuest));
  }

  if (heroEyebrow) heroEyebrow.textContent = showGuest ? 'primeira aula experimental' : 'acesso do aluno';
  if (heroTitle) heroTitle.textContent = 'Team Lucão';
  if (heroDescription) {
    heroDescription.textContent = showGuest
      ? 'Escolha uma aula disponível na grade e solicite seu agendamento em poucos segundos.'
      : 'Consulte seus horários ou informe se você vai participar.';
  }

  if (showGuest) {
    if (!guestClassesLoaded) loadGuestClasses();
    window.setTimeout(() => guestName.focus(), 0);
  } else {
    window.setTimeout(() => phoneInput.focus(), 0);
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
  setButtonLoading(guestButton, true, 'Enviando pedido...');
  setStatus(guestStatus, 'Enviando sua solicitação...');
  try {
    const response = await fetch('/api/public/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome: name, telefone: phone, aula_id: classId, observacao: 'Aula experimental solicitada.' })
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
    const button = event.target.closest('[data-pick-guest]');
    if (!button || button.disabled) return;
    const classId = button.dataset.pickGuest;
    const date = button.dataset.pickDate;
    if (date) {
      guestDate.value = date;
      setupGuestTimes();
      guestTime.value = classId;
      renderGuestClassList();
      guestForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
}

guestForm.addEventListener('submit', submitGuestBooking);

upcomingList.addEventListener('click', (event) => {
  const button = event.target.closest('[data-confirm-class]');
  if (button) updateConfirmation(button.dataset.confirmClass, button.dataset.confirmValue, button);
});

availableList.addEventListener('click', (event) => {
  const button = event.target.closest('[data-book-class]');
  if (button) requestClass(button.dataset.bookClass, button);
});

calendar.addEventListener('click', (event) => {
  const button = event.target.closest('[data-calendar-date]');
  if (button) selectCalendarDate(button.dataset.calendarDate);
});
