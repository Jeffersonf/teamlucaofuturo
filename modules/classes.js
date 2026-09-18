// modules/classes.js - Módulo de gestão de aulas, agenda, presença e avisos de grupo
'use strict';

/**
 * Renderiza a listagem de aulas de acordo com filtros ativos
 */
export function renderClasses(ctx) {
  const dateInput = document.getElementById('classDateFilter');
  const date = dateInput ? dateInput.value : '';
  const type = document.getElementById('classTypeFilter')?.value || '';
  const status = document.getElementById('classStatusFilter')?.value || '';
  const signature = `${ctx.stateVersion}|${date}|${type}|${status}`;
  if (!ctx.shouldRender('classes', signature)) return;

  const classes = [...ctx.state.classes].filter((item) => (
    (!date || item.data === date)
    && (!type || ctx.classType(item) === type)
    && (!status || (item.status || 'Marcada') === status)
  )).sort(ctx.sortClass);

  renderClassesTodayPlanner(ctx);
  renderClassCalendar(ctx);
  renderClassSummary(ctx, classes);

  const list = document.getElementById('classList');
  if (list) {
    list.innerHTML = classes.length ? classes.map(ctx.classRow).join('') : ctx.empty('Crie a primeira aula da agenda.');
  }
}

/**
 * Resumo estatístico das aulas filtradas
 */
export function renderClassSummary(ctx, classes) {
  const target = document.getElementById('classSummary');
  if (!target) return;
  const future = classes.filter((item) => item.data >= ctx.todayISO() && item.status !== 'Cancelada').length;
  const experimental = classes.filter((item) => ctx.classType(item) === 'Experimental').length;
  const repos = classes.filter((item) => ctx.classType(item) === 'Reposicao').length;
  const avulsos = classes.reduce((sum, item) => sum + ctx.classExtras(item).filter((extra) => ['Avulso', 'Reposicao', 'Experimental', 'Visitante'].includes(ctx.extraType(extra))).length, 0);
  target.innerHTML = `
    <article class="mini-stat"><span>Filtradas</span><strong>${classes.length}</strong></article>
    <article class="mini-stat"><span>Futuras</span><strong>${future}</strong></article>
    <article class="mini-stat"><span>Experimentais</span><strong>${experimental}</strong></article>
    <article class="mini-stat"><span>Reposições</span><strong>${repos}</strong></article>
    <article class="mini-stat"><span>Fora da lista</span><strong>${avulsos}</strong></article>
  `;
}

/**
 * Planner operacional do dia com lista detalhada de presença e status
 */
export function renderClassesTodayPlanner(ctx) {
  const target = document.getElementById('classesTodayPlanner');
  if (!target) return;
  const classes = ctx.getStateIndex().todayClasses;
  const expected = classes.reduce((sum, item) => sum + ctx.classStudents(item).length, 0);
  const present = classes.reduce((sum, item) => sum + ctx.classStudents(item).filter((student) => item.presencas?.[student.aluno_id || student.id] || student.presente).length, 0);
  const extrasTotal = classes.reduce((sum, item) => sum + ctx.classExtras(item).length, 0);
  const confirmedToday = classes.reduce((sum, item) => sum + ctx.classConfirmationStats(item).yes, 0);
  const declinedToday = classes.reduce((sum, item) => sum + ctx.classConfirmationStats(item).no, 0);
  const attentionTotal = classes.filter((item) => ctx.classOperationStatus(item)[0] !== 'ok').length;
  const summary = `
    <article class="today-summary">
      <span>Resumo de hoje</span>
      <strong>${classes.length} aula(s)</strong>
      <small>${expected} previstos - ${confirmedToday} confirmados - ${declinedToday} não vão - ${present} presentes - ${extrasTotal} fora da lista - ${attentionTotal} atenção</small>
    </article>
  `;
  target.innerHTML = classes.length ? `${summary}${classes.map((item) => {
    const enrolled = ctx.classStudents(item);
    const extras = ctx.classExtras(item);
    const capacity = Number(item.capacidade || 8);
    const presentCount = enrolled.filter((student) => item.presencas?.[student.aluno_id || student.id] || student.presente).length;
    const confirmation = ctx.classConfirmationStats(item);
    const [operationTone, operationLabel] = ctx.classOperationStatus(item);
    return `
      <article class="today-class class-${ctx.cssToken(item.status || 'Marcada')} type-${ctx.cssToken(ctx.classType(item))}">
        <div class="today-class-head">
          <div class="class-timebox">
            <span>${ctx.escapeHTML(item.horario)}</span>
            <small>${ctx.escapeHTML(ctx.classType(item))}</small>
          </div>
          <div class="class-main">
            <strong>${ctx.escapeHTML(item.turma || 'Turma')}</strong>
            <span>${ctx.escapeHTML(item.professor || 'Professor não informado')}</span>
            <div class="pill-row">
              <span class="pill ${operationTone}">${ctx.escapeHTML(operationLabel)}</span>
              <span class="pill">${enrolled.length}/${capacity} previstos</span>
              <span class="pill ok">${confirmation.yes} vão</span>
              ${confirmation.no ? `<span class="pill bad">${confirmation.no} não vão</span>` : ''}
              ${confirmation.open ? `<span class="pill warn">${confirmation.open} sem resposta</span>` : ''}
              <span class="pill ${presentCount >= enrolled.length && enrolled.length ? 'ok' : 'warn'}">${presentCount}/${enrolled.length} presentes</span>
              ${extras.length ? `<span class="pill warn">${extras.length} fora da lista</span>` : ''}
              <span class="pill">${ctx.escapeHTML(item.status || 'Marcada')}</span>
            </div>
          </div>
          <div class="actions">
            <button class="mini-btn" data-attendance="${item.id}">Presenças</button>
            ${ctx.classStatusActions(item)}
            <a class="mini-btn" href="${ctx.whatsappShareUrl(ctx.classShareText(item))}" target="_blank" rel="noopener">WhatsApp</a>
            <button class="mini-btn" data-open-group-message="${item.id}">Avisar grupo</button>
            <button class="mini-btn" data-copy-class="${item.id}">Copiar</button>
          </div>
        </div>
        <div class="roster-list">
          ${enrolled.map((student) => ctx.rosterPerson(student, item.data, Boolean(item.presencas?.[student.aluno_id || student.id] || student.presente))).join('')}
          ${extras.map((extra) => `<span class="roster-person extra"><strong>${ctx.escapeHTML(extra.nome || extra)}</strong><small>${ctx.escapeHTML(ctx.extraType(extra))}</small></span>`).join('')}
        </div>
      </article>
    `;
  }).join('')}` : ctx.empty('Nenhuma aula marcada para hoje.');
}

/**
 * Calendário semanal resumido
 */
export function renderClassCalendar(ctx) {
  const target = document.getElementById('classCalendar');
  if (!target) return;
  const index = ctx.getStateIndex();
  const days = Array.from({ length: 7 }, (_item, i) => ctx.addDaysIso(ctx.todayISO(), i));
  target.innerHTML = days.map((day) => {
    const classes = index.classesByDay.get(day) || [];
    return `
      <article class="calendar-day ${day === ctx.todayISO() ? 'today' : ''}">
        <button type="button" data-class-day="${day}">
          <strong>${ctx.formatDate(day).slice(0, 5)}</strong>
          <span>${classes.length} aula(s)</span>
        </button>
        <div>${classes.slice(0, 3).map((item) => `<small>${ctx.escapeHTML(item.horario)} ${ctx.escapeHTML(item.turma || '')}</small>`).join('')}</div>
      </article>
    `;
  }).join('');
}

/**
 * Abre o modal de chamada e presenças
 */
export function openAttendance(ctx, classId) {
  const item = ctx.classById(classId);
  if (!item) return;
  ctx.setActiveAttendanceClassId(classId);
  const enrolled = ctx.classStudents(item);
  const ids = enrolled.map((student) => student.aluno_id || student.id);
  const extras = ctx.classExtras(item);
  const presentCount = ids.filter((id) => item.presencas?.[id] || item.presencas?.[String(id)]).length;
  const confirmation = ctx.classConfirmationStats(item);
  const absentLikely = enrolled.filter((student) => (student.confirmado || student.confirmacao) === 'nao').length;
  const pendingTeacher = confirmation.pendingTeacher;

  const titleElem = document.getElementById('attendanceTitle');
  if (titleElem) {
    titleElem.innerHTML = `
      <span>${ctx.formatDate(item.data)} às ${ctx.escapeHTML(item.horario)} - ${ctx.escapeHTML(item.turma || 'Turma')}</span>
      <strong>${presentCount}/${ids.length} presentes</strong>
      <small>${ctx.escapeHTML(ctx.classType(item))} - ${ctx.escapeHTML(item.status || 'Marcada')}</small>
      <div class="attendance-title-pills">
        <span class="pill ok">${confirmation.yes} vão</span>
        ${absentLikely ? `<span class="pill bad">${absentLikely} não vão</span>` : ''}
        ${pendingTeacher ? `<span class="pill warn">${pendingTeacher} aguardando professor</span>` : ''}
        <span class="pill warn">${confirmation.open} sem resposta</span>
        ${extras.length ? `<span class="pill warn">${extras.length} fora da lista</span>` : ''}
      </div>
    `;
  }

  const listElem = document.getElementById('attendanceList');
  if (listElem) {
    listElem.innerHTML = enrolled.map((student) => {
      const id = student.aluno_id || student.id;
      const fullStudent = ctx.studentById(id) || student;
      const present = Boolean(item.presencas?.[id] || item.presencas?.[String(id)] || student.presente);
      const [confirmClass, confirmText] = ctx.confirmationLabel(student.confirmado || student.confirmacao || '');
      const teacherConfirmed = student.confirmado_professor === 'sim';
      const phone = fullStudent.telefone || student.telefone || '';
      return `
      <div class="check-item ${present ? 'checked-in' : ''} ${confirmClass === 'bad' ? 'likely-absent' : ''}">
        <div>
          <strong>${ctx.escapeHTML(student.nome)}</strong>
          <p class="meta">${ctx.escapeHTML(fullStudent.plano_nome || student.plano_nome || 'sem plano')} - ${ctx.weeklyAttendanceCount(id, item.data)}/${ctx.planWeeklyTarget(fullStudent) || '-'} na semana</p>
          <div class="pill-row">
            <span class="pill ${confirmClass}">${confirmText}</span>
            ${teacherConfirmed ? '<span class="pill ok">professor confirmou</span>' : student.confirmado === 'sim' ? `<button class="pill confirm-teacher-button" type="button" data-confirm-student="${item.id}:${id}">Confirmar indicação</button>` : ''}
            ${phone ? `<a class="pill" href="${ctx.whatsappUrl(phone, `Oi ${student.nome}, tudo bem? Aqui é do Team Lucão. Você confirma a aula de hoje às ${item.horario}?`)}" target="_blank" rel="noopener">WhatsApp</a>` : ''}
          </div>
        </div>
        <button class="mini-btn ${present ? 'present' : ''}" data-toggle-attendance="${item.id}:${id}">
          ${present ? 'Presente' : 'Marcar'}
        </button>
      </div>
    `;
    }).join('') || ctx.empty('Nenhum aluno vinculado a esta aula.');
  }

  const extraElem = document.getElementById('extraAttendanceList');
  if (extraElem) {
    extraElem.innerHTML = extras.length ? extras.map((extra, index) => `
      <article class="row-card compact-row">
        <div>
          <h3>${ctx.escapeHTML(extra.nome || extra)}</h3>
          <p class="meta">${ctx.escapeHTML(ctx.extraType(extra))} - fora da lista prevista</p>
        </div>
        <div class="actions">
          <button class="mini-btn danger-mini" data-remove-extra="${item.id}:${index}">Remover</button>
        </div>
      </article>
    `).join('') : ctx.empty('Nenhum aluno avulso ou reposição nesta aula.');
  }

  ctx.openModal('attendanceModal');
}
