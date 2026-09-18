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
            <button class="mini-btn primary-mini" data-attendance="${item.id}" title="Lista de chamada e presenças">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
              <span>Presenças</span>
            </button>
            <a class="mini-btn" href="${ctx.whatsappShareUrl(ctx.classShareText(item))}" target="_blank" rel="noopener" title="Compartilhar no WhatsApp">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
              <span>WhatsApp</span>
            </a>
            <details class="action-dropdown">
              <summary class="mini-btn icon-btn" title="Mais opções da aula" aria-label="Mais opções da aula">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="1.5" fill="currentColor"/><circle cx="19" cy="12" r="1.5" fill="currentColor"/><circle cx="5" cy="12" r="1.5" fill="currentColor"/></svg>
              </summary>
              <div class="dropdown-menu">
                ${ctx.classDropdownStatusAction ? ctx.classDropdownStatusAction(item) : ''}
                <button type="button" class="dropdown-item" data-open-group-message="${item.id}">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                  <span>Avisar turma</span>
                </button>
                <button type="button" class="dropdown-item" data-copy-class="${item.id}">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                  <span>Copiar detalhes</span>
                </button>
                <button type="button" class="dropdown-item" data-edit-class="${item.id}">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>
                  <span>Editar aula</span>
                </button>
                <div class="dropdown-divider"></div>
                <button type="button" class="dropdown-item danger" data-cancel-class="${item.id}">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                  <span>Cancelar aula</span>
                </button>
              </div>
            </details>
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
  const bounds = ctx.weekBounds(ctx.todayISO());
  // Semana de treinos: Segunda a Sábado (6 dias, Domingo sem aula)
  const days = Array.from({ length: 6 }, (_item, i) => ctx.addDaysIso(bounds.start, i));
  const weekdayNames = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  target.innerHTML = days.map((day, i) => {
    const classes = index.classesByDay.get(day) || [];
    const weekday = weekdayNames[i] || '';
    return `
      <article class="calendar-day ${day === ctx.todayISO() ? 'today' : ''}">
        <button type="button" data-class-day="${day}">
          <strong>${weekday} ${ctx.formatDate(day).slice(0, 5)}</strong>
          <span>${classes.length} aula(s)</span>
        </button>
        <div>${classes.slice(0, 4).map((item) => `<small>${ctx.escapeHTML(item.horario)} ${ctx.escapeHTML(item.turma || '')}</small>`).join('')}</div>
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

  // Popula o datalist para sugestão instantânea com alunos cadastrados
  const datalist = document.getElementById('studentsAttendanceDatalist');
  if (datalist && ctx.state?.students) {
    const enrolledSet = new Set(ids.map(String));
    const activeStudents = ctx.state.students.filter((s) => (s.status || 'Ativo') !== 'Pausado');
    datalist.innerHTML = activeStudents.map((s) => {
      const alreadyIn = enrolledSet.has(String(s.id)) ? ' (já na turma)' : '';
      const plan = s.plano_nome ? ` • ${s.plano_nome}` : '';
      return `<option value="${ctx.escapeHTML(s.nome)}">${ctx.escapeHTML(s.nome + plan + alreadyIn)}</option>`;
    }).join('');
  }

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
        <button class="mini-btn ${present ? 'present' : ''}" type="button" data-toggle-attendance="${item.id}:${id}">
          ${present ? 'Presente' : 'Marcar'}
        </button>
      </div>
    `;
    }).join('') || ctx.empty('Nenhum aluno vinculado a esta aula.');
  }

  const extraElem = document.getElementById('extraAttendanceList');
  if (extraElem) {
    extraElem.innerHTML = extras.length ? extras.map((extra, index) => {
      const studentId = extra.aluno_id || extra.id_aluno;
      const fullStudent = studentId ? ctx.studentById(studentId) : null;
      const extraName = extra.nome || fullStudent?.nome || (typeof extra === 'string' ? extra : 'Aluno');
      const typeLabel = ctx.extraType(extra);
      const isLinked = Boolean(fullStudent || studentId);

      const initials = (extraName || 'EX')
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((p) => p[0])
        .join('')
        .toUpperCase() || 'EX';

      if (isLinked && fullStudent) {
        const weeklyCount = ctx.weeklyAttendanceCount(fullStudent.id, item.data);
        const weeklyTarget = ctx.planWeeklyTarget(fullStudent);
        return `
          <article class="row-card compact-row extra-student-card" style="border-left: 3px solid #22c55e; background: rgba(34, 197, 94, 0.05); border-radius: 12px; margin-bottom: 8px; padding: 10px 14px; display: flex; align-items: center; justify-content: space-between; gap: 10px;">
            <div style="display: flex; align-items: center; gap: 12px; min-width: 0; flex: 1;">
              <div style="width: 36px; height: 36px; border-radius: 50%; background: rgba(34, 197, 94, 0.18); color: #22c55e; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 13px; flex-shrink: 0;">
                ${initials}
              </div>
              <div style="min-width: 0;">
                <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
                  <button type="button" data-report-student="${fullStudent.id}" style="background:none; border:none; padding:0; color:#fff; font-weight:700; font-size:14px; cursor:pointer; text-decoration:underline; text-underline-offset:2px;">
                    ${ctx.escapeHTML(fullStudent.nome)}
                  </button>
                  <span class="pill ok" style="font-size:10px; padding:2px 6px;">✓ Presente</span>
                  <span class="pill warn" style="font-size:10px; padding:2px 6px;">${ctx.escapeHTML(typeLabel)}</span>
                </div>
                <p class="meta" style="margin:2px 0 0; font-size:12px; color:#a1a1aa;">
                  ${ctx.escapeHTML(fullStudent.plano_nome || 'Aluno')} • ${weeklyCount}/${weeklyTarget || '-'} na semana
                </p>
              </div>
            </div>
            <div class="actions" style="margin: 0; flex-shrink: 0;">
              <button class="mini-btn danger-mini" type="button" data-remove-extra="${item.id}:${index}">Remover</button>
            </div>
          </article>
        `;
      }

      return `
        <article class="row-card compact-row extra-visitor-card" style="border-left: 3px solid #eab308; background: rgba(234, 179, 8, 0.05); border-radius: 12px; margin-bottom: 8px; padding: 10px 14px; display: flex; align-items: center; justify-content: space-between; gap: 10px;">
          <div style="display: flex; align-items: center; gap: 12px; min-width: 0; flex: 1;">
            <div style="width: 36px; height: 36px; border-radius: 50%; background: rgba(234, 179, 8, 0.18); color: #eab308; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 13px; flex-shrink: 0;">
              ${initials}
            </div>
            <div style="min-width: 0;">
              <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
                <strong style="color:#fff; font-size:14px;">${ctx.escapeHTML(extraName)}</strong>
                <span class="pill ok" style="font-size:10px; padding:2px 6px;">✓ Presente</span>
                <span class="pill" style="font-size:10px; padding:2px 6px;">${ctx.escapeHTML(typeLabel)}</span>
              </div>
              <p class="meta" style="margin:2px 0 0; font-size:12px; color:#a1a1aa;">
                Visitante externo / não cadastrado
              </p>
            </div>
          </div>
          <div class="actions" style="margin: 0; flex-shrink: 0;">
            <button class="mini-btn danger-mini" type="button" data-remove-extra="${item.id}:${index}">Remover</button>
          </div>
        </article>
      `;
    }).join('') : ctx.empty('Nenhum aluno avulso ou reposição nesta aula.');
  }

  ctx.openModal('attendanceModal');
}
