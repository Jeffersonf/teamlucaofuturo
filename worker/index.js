const DATA_TABLES = [
  'alunos', 'planos', 'aulas', 'aula_alunos', 'pagamentos',
  'agendamentos', 'disponibilidade', 'lista_espera', 'logs'
];

const TABLE_COLUMNS = {
  alunos: ['id', 'nome', 'telefone', 'email', 'plano_id', 'plano_nome', 'mensalidade', 'dia_vencimento', 'status', 'nivel', 'dia_fixo', 'horario_fixo', 'turma_fixa', 'agendas_fixas', 'observacao', 'pago_ate', 'data_cadastro', 'indicado_por'],
  planos: ['id', 'nome', 'preco', 'aulas_semana', 'descricao', 'ativo'],
  aulas: ['id', 'data', 'horario', 'turma', 'tipo', 'professor', 'plano_id', 'plano_nome', 'capacidade', 'status', 'valor_avulso', 'extras', 'observacao'],
  aula_alunos: ['id', 'aula_id', 'aluno_id', 'presente', 'confirmado', 'confirmado_em', 'confirmado_professor', 'confirmado_professor_em', 'observacao'],
  pagamentos: ['id', 'aluno_id', 'referencia', 'valor', 'vencimento', 'pago_em', 'status', 'forma_pagamento', 'observacao'],
  agendamentos: ['id', 'nome', 'telefone', 'aula_id', 'status', 'observacao', 'criado_em', 'respondido_em', 'indicado_por'],
  disponibilidade: ['dia', 'inicio', 'fim'],
  lista_espera: ['id', 'nome', 'telefone', 'aula_id', 'preferencia', 'status', 'observacao', 'data_cadastro'],
  logs: ['id', 'data_hora', 'ator', 'acao', 'detalhe']
};

const ACTIVE_WAITLIST_STATUSES = ['Novo', 'Contatado', 'Experimental marcado'];

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...extraHeaders }
  });
}

function errorResponse(error, fallback = 400) {
  return json({ ok: false, error: error?.message || String(error) }, error?.status || fallback);
}

function getWeekRange(dateIso = today()) {
  const raw = String(dateIso || '').slice(0, 10) || today();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  const now = match
    ? new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])))
    : new Date();
  const day = now.getUTCDay();
  const diffToMon = day === 0 ? 1 : 1 - day;
  now.setUTCDate(now.getUTCDate() + diffToMon);
  const start = now.toISOString().slice(0, 10);
  now.setUTCDate(now.getUTCDate() + 5);
  const end = now.toISOString().slice(0, 10);
  return { inicio: start, fim: end };
}

function getStudentWeeklyQuota(student, plan = null) {
  if (plan && Number.isFinite(Number(plan.aulas_semana)) && Number(plan.aulas_semana) > 0) {
    return Number(plan.aulas_semana);
  }
  const planName = String(student?.plano_nome || '').toLowerCase();
  const match = planName.match(/(\d+)\s*x/);
  if (match) {
    const parsed = parseInt(match[1], 10);
    if (parsed > 0) return parsed;
  }
  if (planName.includes('livre')) return 7;
  return 2;
}

function today() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(new Date());
}

function nowTimeSP() {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(new Date());
}

function isClassPast(dateStr, timeStr) {
  const todayStr = today();
  if (!dateStr) return false;
  if (dateStr < todayStr) return true;
  if (dateStr === todayStr && timeStr) {
    return String(timeStr).slice(0, 5) <= nowTimeSP();
  }
  return false;
}

function addDaysIso(value, days = 0) {
  const date = new Date(`${value}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + Number(days || 0));
  return date.toISOString().slice(0, 10);
}

function dueDateForMonth(student = {}, month = currentMonth()) {
  const [year, monthNumber] = String(month || currentMonth()).slice(0, 7).split('-').map(Number);
  const lastDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  const dueDay = int(student.dia_vencimento, 10, 1, 31);
  return `${year}-${String(monthNumber).padStart(2, '0')}-${String(Math.min(dueDay, lastDay)).padStart(2, '0')}`;
}

function nextMonthKey(month) {
  const [year, monthNumber] = String(month).slice(0, 7).split('-').map(Number);
  const date = new Date(Date.UTC(year, monthNumber, 1));
  return date.toISOString().slice(0, 7);
}

function studentPeriodEnd(student = {}, start = today()) {
  const currentDueDate = dueDateForMonth(student, start.slice(0, 7));
  return currentDueDate >= start ? currentDueDate : dueDateForMonth(student, nextMonthKey(start.slice(0, 7)));
}

function currentMonth() { return today().slice(0, 7); }
function digits(value) { return String(value || '').replace(/\D/g, ''); }
function money(value) { const parsed = Number(value || 0); return Number.isFinite(parsed) ? Math.max(0, parsed) : 0; }
function int(value, fallback = 1, min = 1, max = 30) { const parsed = Number(value); return Number.isFinite(parsed) ? Math.min(max, Math.max(min, Math.round(parsed))) : fallback; }

function normalizeDate(value) {
  const raw = String(value || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return today();
  const date = new Date(`${raw}T12:00:00Z`);
  return date.toISOString().slice(0, 10) === raw ? raw : today();
}

function normalizeTime(value) {
  const raw = String(value || '').slice(0, 5);
  const match = /^(\d{2}):(\d{2})$/.exec(raw);
  if (!match || Number(match[1]) > 23 || Number(match[2]) > 59) return '18:30';
  return raw;
}

function sqlPhone(column = 'telefone') {
  return `REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(COALESCE(${column}, ''), '(', ''), ')', ''), '-', ''), ' ', ''), '+', '')`;
}

async function all(db, sql, params = []) {
  const result = await db.prepare(sql).bind(...params).all();
  return result.results || [];
}

async function first(db, sql, params = []) {
  return (await db.prepare(sql).bind(...params).first()) || null;
}

async function run(db, sql, params = []) {
  return db.prepare(sql).bind(...params).run();
}

async function scalar(db, sql, params = [], fallback = 0) {
  const item = await first(db, sql, params);
  if (!item) return fallback;
  return item[Object.keys(item)[0]] ?? fallback;
}

function allowedPayload(table, payload = {}, includeId = false) {
  const columns = TABLE_COLUMNS[table] || [];
  return Object.fromEntries(Object.entries(payload).filter(([key, value]) =>
    columns.includes(key) && (includeId || key !== 'id') && value !== undefined
  ));
}

async function insertRow(db, table, payload, includeId = false) {
  const clean = allowedPayload(table, payload, includeId);
  const keys = Object.keys(clean);
  if (!keys.length) throw new Error('Nenhum campo valido');
  const result = await run(db, `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${keys.map(() => '?').join(', ')})`, keys.map((key) => clean[key]));
  return { id: Number(result.meta?.last_row_id || clean.id || 0), changes: Number(result.meta?.changes || 0) };
}

async function updateRow(db, table, id, payload) {
  const clean = allowedPayload(table, payload);
  const keys = Object.keys(clean);
  if (!keys.length) return { changes: 0 };
  const result = await run(db, `UPDATE ${table} SET ${keys.map((key) => `${key}=?`).join(', ')} WHERE id=?`, [...keys.map((key) => clean[key]), id]);
  return { changes: Number(result.meta?.changes || 0) };
}

async function deleteRow(db, table, id) {
  const result = await run(db, `DELETE FROM ${table} WHERE id=?`, [id]);
  return { ok: true, changes: Number(result.meta?.changes || 0) };
}

function normalizeFixedSchedules(body = {}) {
  let values = body.agendas_fixas ?? body.fixedSchedules ?? [];
  if (typeof values === 'string') {
    try { values = JSON.parse(values); } catch { values = []; }
  }
  if (!Array.isArray(values)) values = [];
  if (!values.length && body.dia_fixo !== '' && body.dia_fixo !== null && body.dia_fixo !== undefined && body.horario_fixo) {
    values = [{ dia: body.dia_fixo, horario: body.horario_fixo, turma: body.turma_fixa }];
  }
  const seen = new Set();
  return values.map((item) => ({
    dia: String(item?.dia ?? item?.dia_fixo ?? ''),
    horario: String(item?.horario || item?.horario_fixo || '').slice(0, 5),
    turma: String(item?.turma || item?.turma_fixa || '').trim()
  })).filter((item) => {
    const key = `${item.dia}|${item.horario}`;
    const valid = /^[0-6]$/.test(item.dia) && /^([01]\d|2[0-3]):[0-5]\d$/.test(item.horario) && !seen.has(key);
    if (valid) seen.add(key);
    return valid;
  }).slice(0, 7);
}

function normalizeStudent(body = {}) {
  const schedules = normalizeFixedSchedules(body);
  const primarySchedule = schedules[0] || {};
  return {
    nome: String(body.nome || body.name || '').trim(),
    telefone: String(body.telefone || body.phone || '').trim(),
    email: String(body.email || '').trim(),
    plano_id: body.plano_id ? Number(body.plano_id) : null,
    plano_nome: String(body.plano_nome || body.plan || '').trim(),
    mensalidade: money(body.mensalidade ?? body.fee),
    dia_vencimento: int(body.dia_vencimento || body.vencimento_dia || body.dueDay, 10, 1, 31),
    status: String(body.status || 'Ativo'),
    nivel: String(body.nivel ?? body.level ?? '').trim(),
    dia_fixo: primarySchedule.dia || '',
    horario_fixo: primarySchedule.horario || '',
    turma_fixa: primarySchedule.turma || '',
    agendas_fixas: JSON.stringify(schedules),
    observacao: String(body.observacao || body.note || ''),
    pago_ate: String(body.pago_ate || body.paidUntil || ''),
    indicado_por: String(body.indicado_por || body.referredBy || body.indicacao || '').trim()
  };
}

function normalizeClass(body = {}) {
  const extras = body.extra_presentes ?? body.extras ?? [];
  return {
    data: normalizeDate(body.data || body.date),
    horario: normalizeTime(body.horario || body.time),
    turma: String(body.turma || body.group || '').trim(),
    tipo: String(body.tipo || body.tipo_aula || body.type || 'Regular'),
    professor: String(body.professor || body.coach || '').trim(),
    plano_id: body.plano_id ? Number(body.plano_id) : null,
    plano_nome: String(body.plano_nome || '').trim(),
    capacidade: int(body.capacidade || body.capacity, 8, 1, 30),
    status: String(body.status || 'Marcada'),
    valor_avulso: money(body.valor_avulso),
    extras: typeof extras === 'string' ? extras : JSON.stringify(extras),
    observacao: String(body.observacao || body.note || '')
  };
}

async function logAction(db, action, detail = '', actor = '') {
  await run(db, 'INSERT INTO logs (data_hora, ator, acao, detalhe) VALUES (?, ?, ?, ?)', [
    new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }),
    actor || (String(action).toLowerCase().includes('confirmacao aluno') ? 'Aluno' : 'Professor'),
    String(action || 'Sistema'), String(detail || '')
  ]);
}

function parseList(value) { try { const parsed = JSON.parse(value || '[]'); return Array.isArray(parsed) ? parsed : []; } catch { return []; } }

async function classWithStudents(db, item) {
  const students = await all(db, `
    SELECT aa.*, a.nome, a.telefone, a.plano_nome, a.status
    FROM aula_alunos aa JOIN alunos a ON a.id=aa.aluno_id
    WHERE aa.aula_id=? ORDER BY a.nome
  `, [item.id]);
  return {
    ...item,
    alunos: students,
    aluno_ids: students.map((student) => student.aluno_id),
    extra_presentes: parseList(item.extras),
    presencas: Object.fromEntries(students.map((student) => [student.aluno_id, Number(student.presente || 0) === 1]))
  };
}

async function classesWithStudents(db, items) {
  if (!items.length) return [];
  const ids = items.map((item) => item.id);
  const students = await all(db, `
    SELECT aa.*, a.nome, a.telefone, a.plano_nome, a.status
    FROM aula_alunos aa JOIN alunos a ON a.id=aa.aluno_id
    WHERE aa.aula_id IN (${ids.map(() => '?').join(',')}) ORDER BY a.nome
  `, ids);
  const grouped = new Map();
  students.forEach((student) => {
    const key = String(student.aula_id);
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(student);
  });
  return items.map((item) => {
    const enrolled = grouped.get(String(item.id)) || [];
    return {
      ...item,
      alunos: enrolled,
      aluno_ids: enrolled.map((student) => student.aluno_id),
      extra_presentes: parseList(item.extras),
      presencas: Object.fromEntries(enrolled.map((student) => [student.aluno_id, Number(student.presente || 0) === 1]))
    };
  });
}

async function classList(db, sql = 'SELECT * FROM aulas ORDER BY data, horario, turma', params = []) {
  const items = await all(db, sql, params);
  return classesWithStudents(db, items);
}

async function upsertClassStudents(db, classId, studentIds = [], attendance = {}) {
  const cleanIds = [...new Set((Array.isArray(studentIds) ? studentIds : []).map(Number).filter(Boolean))];
  const current = await all(db, 'SELECT aluno_id FROM aula_alunos WHERE aula_id=?', [classId]);
  for (const item of current) if (!cleanIds.includes(Number(item.aluno_id))) await run(db, 'DELETE FROM aula_alunos WHERE aula_id=? AND aluno_id=?', [classId, item.aluno_id]);
  for (const studentId of cleanIds) {
    const present = attendance[String(studentId)] || attendance[studentId] ? 1 : 0;
    await run(db, `INSERT OR IGNORE INTO aula_alunos (aula_id, aluno_id, presente) VALUES (?, ?, ?)`, [classId, studentId, present]);
  }
}

async function findStudent(db, value) {
  const phone = digits(value);
  if (phone.length < 8) throw new Error('Informe pelo menos 8 numeros do WhatsApp');
  return first(db, `SELECT * FROM alunos WHERE ${sqlPhone()} LIKE ? ORDER BY id DESC LIMIT 1`, [`%${phone.slice(-8)}`]);
}

async function publicClasses(db) {
  const items = await all(db, `
    SELECT a.id, a.data, a.horario, a.turma, a.tipo, a.professor, a.capacidade,
      a.status,
      (SELECT COUNT(*) FROM aula_alunos aa WHERE aa.aula_id=a.id) AS inscritos,
      (SELECT COUNT(*) FROM lista_espera w WHERE w.aula_id=a.id AND w.status IN ('Novo', 'Contatado', 'Experimental marcado')) AS espera
    FROM aulas a WHERE a.status != 'Cancelada' AND a.data >= ?
    ORDER BY a.data, a.horario LIMIT 60
  `, [today()]);
  return items.filter((item) => !isClassPast(item.data, item.horario)).slice(0, 40);
}

async function studentClasses(db, request) {
  const url = new URL(request.url);
  const informedPhone = url.searchParams.get('telefone') || url.searchParams.get('phone');
  const student = await findStudent(db, informedPhone);
  if (!student) throw new Error('Aluno nao encontrado para esse WhatsApp');
  const start = today();
  const periodEnd = studentPeriodEnd(student, start);

  const week = getWeekRange(url.searchParams.get('semana') || url.searchParams.get('date') || start);
  const plan = student.plano_id ? await first(db, 'SELECT * FROM planos WHERE id=?', [student.plano_id]) : null;
  const weeklyQuota = getStudentWeeklyQuota(student, plan);

  const weeklyConfirmedCount = (await scalar(db, `
    SELECT COUNT(*) AS total
    FROM aula_alunos aa
    JOIN aulas a ON a.id=aa.aula_id
    WHERE aa.aluno_id=? AND aa.confirmado='sim' AND a.status != 'Cancelada'
      AND a.data BETWEEN ? AND ?
  `, [student.id, week.inicio, week.fim])) || 0;

  const rawWeekly = await all(db, `
    SELECT a.id, a.data, a.horario, a.turma, a.tipo, a.professor, a.capacidade, a.status,
      (SELECT COUNT(*) FROM aula_alunos aa WHERE aa.aula_id=a.id) AS inscritos,
      (SELECT aa.confirmado FROM aula_alunos aa WHERE aa.aula_id=a.id AND aa.aluno_id=?) AS confirmado,
      (SELECT aa.confirmado_em FROM aula_alunos aa WHERE aa.aula_id=a.id AND aa.aluno_id=?) AS confirmado_em,
      (SELECT aa.confirmado_professor FROM aula_alunos aa WHERE aa.aula_id=a.id AND aa.aluno_id=?) AS confirmado_professor,
      (SELECT aa.confirmado_professor_em FROM aula_alunos aa WHERE aa.aula_id=a.id AND aa.aluno_id=?) AS confirmado_professor_em,
      (SELECT aa.presente FROM aula_alunos aa WHERE aa.aula_id=a.id AND aa.aluno_id=?) AS presente,
      EXISTS(SELECT 1 FROM aula_alunos aa WHERE aa.aula_id=a.id AND aa.aluno_id=?) AS vinculado
    FROM aulas a
    WHERE a.status != 'Cancelada' AND a.data BETWEEN ? AND ?
    ORDER BY a.data, a.horario, a.turma
  `, [student.id, student.id, student.id, student.id, student.id, student.id, week.inicio, week.fim]);

  const weeklyClasses = rawWeekly.map((cls) => ({
    ...cls,
    vagas_disponiveis: Math.max(0, Number(cls.capacidade || 8) - Number(cls.inscritos || 0)),
    lotada: Number(cls.inscritos || 0) >= Number(cls.capacidade || 8) && !cls.vinculado
  }));

  const items = await all(db, `
    SELECT a.id, a.data, a.horario, a.turma, a.tipo, a.professor, a.capacidade, a.status,
      aa.confirmado, aa.confirmado_em, aa.confirmado_professor, aa.confirmado_professor_em, aa.presente,
      (SELECT COUNT(*) FROM aula_alunos WHERE aula_id=a.id) AS inscritos
    FROM aula_alunos aa JOIN aulas a ON a.id=aa.aula_id
    WHERE aa.aluno_id=? AND a.status != 'Cancelada' AND a.data BETWEEN ? AND ?
    ORDER BY a.data, a.horario LIMIT 60
  `, [student.id, start, periodEnd]);

  const rawAvailable = await all(db, `
    SELECT a.id, a.data, a.horario, a.turma, a.tipo, a.professor, a.capacidade, a.status,
      (SELECT COUNT(*) FROM aula_alunos WHERE aula_id=a.id) AS inscritos
    FROM aulas a
    WHERE a.status != 'Cancelada'
      AND LOWER(COALESCE(a.tipo, '')) NOT LIKE '%experimental%'
      AND a.data BETWEEN ? AND ?
      AND (SELECT COUNT(*) FROM aula_alunos WHERE aula_id=a.id) < COALESCE(a.capacidade, 8)
      AND NOT EXISTS (SELECT 1 FROM aula_alunos linked WHERE linked.aula_id=a.id AND linked.aluno_id=?)
    ORDER BY a.data, a.horario, a.turma LIMIT 60
  `, [start, periodEnd, student.id]);
  const available = rawAvailable.filter((item) => !isClassPast(item.data, item.horario));

  const phone = digits(informedPhone);
  const requests = phone.length >= 8 ? await all(db, `
    SELECT ag.id, ag.aula_id, ag.status, ag.criado_em, a.data, a.horario, a.turma, a.tipo
    FROM agendamentos ag JOIN aulas a ON a.id=ag.aula_id
    WHERE ag.status IN ('Pendente', 'Aprovado')
      AND ${sqlPhone('ag.telefone')} LIKE ?
      AND a.data BETWEEN ? AND ?
      AND NOT EXISTS (
        SELECT 1 FROM aula_alunos aa
        WHERE aa.aula_id=ag.aula_id AND aa.aluno_id=? AND aa.confirmado='sim'
      )
    ORDER BY a.data, a.horario
  `, [`%${phone.slice(-8)}`, start, periodEnd, student.id]) : [];

  const todayDate = today();
  let planDueDate = '';
  if (student.pago_ate) {
    planDueDate = student.pago_ate;
  } else {
    planDueDate = dueDateForMonth(student, currentMonth());
  }
  const isExpired = todayDate > planDueDate;

  return {
    ok: true,
    student: {
      id: student.id,
      nome: student.nome,
      telefone: student.telefone,
      plano_id: student.plano_id,
      plano_nome: student.plano_nome,
      mensalidade: student.mensalidade,
      dia_vencimento: student.dia_vencimento,
      pago_ate: student.pago_ate,
      plano_vencido: isExpired,
      plano_vencimento: planDueDate
    },
    period_start: start,
    period_end: periodEnd,
    semana: {
      inicio: week.inicio,
      fim: week.fim,
      limite: weeklyQuota,
      confirmadas: weeklyConfirmedCount
    },
    aulas_semana: weeklyClasses,
    items,
    available,
    requests
  };
}

async function stateSnapshot(db, includeLogs = true) {
  const tables = includeLogs ? DATA_TABLES : DATA_TABLES.filter((table) => table !== 'logs');
  const entries = await Promise.all(tables.map(async (table) => [table, await all(db, `SELECT * FROM ${table}`)]));
  const data = Object.fromEntries(entries);
  const current = today();
  const stats = {
    aulas_hoje: await scalar(db, "SELECT COUNT(*) AS total FROM aulas WHERE data=? AND status != 'Cancelada'", [current]),
    alunos_ativos: await scalar(db, "SELECT COUNT(*) AS total FROM alunos WHERE COALESCE(status, 'Ativo')='Ativo'"),
    presencas_hoje: await scalar(db, `SELECT COUNT(*) AS total FROM aula_alunos aa JOIN aulas a ON a.id=aa.aula_id WHERE a.data=? AND aa.presente=1`, [current])
  };
  return { app: 'TeamLucaoFutevolei.D1', version: 1, exported_at: new Date().toISOString(), today: current, stats, data };
}

async function bootstrap(db) {
  const month = currentMonth();
  const [students, classRows, plans, waitlist, payments, bookings, logs] = await Promise.all([
    all(db, `
      SELECT a.*,
        (SELECT COUNT(*) FROM alunos ind WHERE ind.indicado_por IS NOT NULL AND ind.indicado_por != '' AND LOWER(TRIM(ind.indicado_por)) = LOWER(TRIM(a.nome))) AS total_indicados
      FROM alunos a
      ORDER BY a.nome
    `),
    all(db, 'SELECT * FROM aulas ORDER BY data, horario, turma'),
    all(db, 'SELECT * FROM planos ORDER BY ativo DESC, preco, nome'),
    all(db, `SELECT w.*, a.data AS aula_data, a.horario AS aula_horario, a.turma AS aula_turma, a.status AS aula_status FROM lista_espera w LEFT JOIN aulas a ON a.id=w.aula_id ORDER BY w.id DESC`),
    all(db, 'SELECT p.*, a.nome AS aluno_nome FROM pagamentos p LEFT JOIN alunos a ON a.id=p.aluno_id WHERE referencia=? OR pago_em LIKE ? ORDER BY p.id DESC', [month, `${month}%`]),
    all(db, `SELECT ag.*, a.data, a.horario, a.turma, a.tipo, a.capacidade, (SELECT COUNT(*) FROM aula_alunos aa WHERE aa.aula_id=ag.aula_id) AS inscritos FROM agendamentos ag LEFT JOIN aulas a ON a.id=ag.aula_id ORDER BY ag.status='Pendente' DESC, ag.id DESC`),
    all(db, 'SELECT * FROM logs ORDER BY id DESC LIMIT 80')
  ]);
  return { ok: true, items: { students, classes: await classesWithStudents(db, classRows), plans, waitlist, payments, bookings, logs } };
}

async function respondBooking(db, id, body) {
  const booking = await first(db, 'SELECT * FROM agendamentos WHERE id=?', [id]);
  if (!booking) throw new Error('Pedido nao encontrado');
  const rawClass = await first(db, 'SELECT * FROM aulas WHERE id=?', [booking.aula_id]);
  if (!rawClass) throw new Error('Aula nao encontrada');
  const action = String(body.action || '').toLowerCase();
  if (!['approve', 'reject'].includes(action)) throw new Error('Acao invalida');
  if (action === 'reject') {
    await run(db, "UPDATE agendamentos SET status='Recusado', respondido_em=? WHERE id=?", [today(), id]);
    await logAction(db, 'Pedido recusado', `${booking.nome} foi recusado na aula ${rawClass.horario} - ${rawClass.turma || 'Turma'} em ${rawClass.data}.`, 'Professor');
    return { ok: true, item: await first(db, 'SELECT * FROM agendamentos WHERE id=?', [id]) };
  }
  const classItem = await classWithStudents(db, rawClass);
  if (classItem.aluno_ids.length >= Number(rawClass.capacidade || 8) && !body.force) throw new Error('Aula lotada');
  const phone = digits(booking.telefone);
  let student = phone ? await first(db, `SELECT * FROM alunos WHERE ${sqlPhone()} LIKE ? LIMIT 1`, [`%${phone.slice(-8)}`]) : null;
  const isExperimental = String(booking.observacao || '').toLowerCase().includes('experimental')
    || String(booking.tipo || '').toLowerCase().includes('experimental')
    || String(rawClass.turma || '').toLowerCase().includes('experimental');

  if (!student && isExperimental) {
    const newStudent = await insertRow(db, 'alunos', {
      nome: booking.nome,
      telefone: booking.telefone,
      status: 'Experimental',
      plano_nome: 'Experimental',
      nivel: 'Iniciante',
      observacao: `Aprovado para experimental em ${rawClass.data} ${rawClass.horario}`
    });
    student = await first(db, 'SELECT * FROM alunos WHERE id=?', [newStudent.id]);
  }

  if (student) {
    await upsertClassStudents(db, rawClass.id, [...classItem.aluno_ids, student.id], classItem.presencas || {});
  } else {
    const extras = parseList(rawClass.extras);
    extras.push({ id: `ag${id}`, nome: booking.nome, tipo: isExperimental ? 'Experimental' : 'Solicitado', criado_em: today() });
    await run(db, 'UPDATE aulas SET extras=? WHERE id=?', [JSON.stringify(extras), rawClass.id]);
  }
  await run(db, "UPDATE agendamentos SET status='Aprovado', respondido_em=? WHERE id=?", [today(), id]);
  await logAction(db, 'Pedido aprovado', `${booking.nome} foi aprovado na aula ${rawClass.horario} - ${rawClass.turma || 'Turma'} em ${rawClass.data}.`, 'Professor');
  return { ok: true, item: await first(db, 'SELECT * FROM agendamentos WHERE id=?', [id]) };
}

async function importSnapshot(db, body) {
  const source = body?.data || body?.state || body;
  const mode = new URLSearchParams(body?.mode || '').get('mode') || body?.mode || 'merge';
  if (!source || typeof source !== 'object') throw new Error('Backup invalido');
  const order = ['planos', 'alunos', 'aulas', 'aula_alunos', 'pagamentos', 'agendamentos', 'disponibilidade', 'lista_espera', 'logs'];
  if (mode === 'replace') for (const table of [...order].reverse()) await run(db, `DELETE FROM ${table}`);
  let imported = 0;
  for (const table of order) {
    if (!Array.isArray(source[table])) continue;
    for (const item of source[table]) {
      const clean = allowedPayload(table, item, true);
      if (!Object.keys(clean).length) continue;
      if (mode === 'merge' && clean.id && await first(db, `SELECT id FROM ${table} WHERE id=?`, [clean.id])) {
        await updateRow(db, table, clean.id, clean);
      } else {
        await insertRow(db, table, clean, true);
      }
      imported += 1;
    }
  }
  return { ok: true, imported, mode };
}

async function apiHandler(request, env, body) {
  const url = new URL(request.url);
  const path = url.pathname.split('/').filter(Boolean);
  const method = request.method.toUpperCase();
  const db = env.DB;
  if (!db) throw new Error('D1 nao configurado');

  if (url.pathname === '/health' && method === 'GET') {
    await first(db, 'SELECT 1 AS ok');
    return json({ ok: true, mode: 'server' });
  }

  const isValidPin = (testPin) => {
    const p = String(testPin || '').trim();
    if (!p) return false;
    const allowed = new Set(['1209', '2222', '1111']);
    if (env.ADMIN_PIN) allowed.add(String(env.ADMIN_PIN).trim());
    return allowed.has(p);
  };

  if (url.pathname === '/api/login' && method === 'POST') {
    if (!isValidPin(body.pin)) return json({ ok: false, error: 'PIN invalido' }, 401);
    return json({ ok: true, role: 'admin' });
  }

  const isPublic = url.pathname.startsWith('/api/public/') || url.pathname === '/api/webhooks/pix' || (url.pathname === '/api/pix/config' && method === 'GET');
  if (!isPublic && url.pathname !== '/api/login') {
    if (!isValidPin(request.headers.get('x-admin-pin'))) return json({ ok: false, error: 'PIN invalido' }, 401);
  }

  if (url.pathname === '/api/webhooks/pix' && method === 'POST') {
    const pixItem = Array.isArray(body.pix) ? body.pix[0] : (body.pix || body);
    const txid = String(body.txid || body.txId || pixItem.txid || body.identificador || '').trim();
    const amount = money(body.valor || body.value || body.amount || pixItem.valor || 0);
    let studentId = Number(body.aluno_id || body.studentId || body.alunoId || pixItem.aluno_id || 0);
    const phone = digits(body.telefone || body.phone || body.pagador?.telefone || body.payer?.phone || pixItem.telefone || pixItem.phone || pixItem.pagador?.telefone || pixItem.payer?.phone || '');
    const payerName = String(body.pagador?.nome || body.payer?.name || body.nome || pixItem.pagador?.nome || pixItem.payer?.name || pixItem.nome || '').trim();
    let reference = String(body.referencia || currentMonth()).slice(0, 7);

    if (!studentId && txid) {
      const match = /^TLF(\d+?)(\d{6})$/i.exec(txid) || /^TLF(\d+)$/i.exec(txid);
      if (match && Number(match[1])) {
        studentId = Number(match[1]);
        if (match[2] && !body.referencia) {
          reference = `${match[2].slice(0, 4)}-${match[2].slice(4, 6)}`;
        }
      }
    }

    let student = null;
    if (studentId) {
      student = await first(db, 'SELECT * FROM alunos WHERE id=?', [studentId]);
    } else if (phone.length >= 8) {
      student = await findStudent(db, phone);
    } else if (payerName) {
      student = await first(db, 'SELECT * FROM alunos WHERE LOWER(TRIM(nome)) = ?', [payerName.toLowerCase()]);
    }

    if (!student) {
      await logAction(db, 'Pix Webhook Pendente', `Pix de R$ ${amount.toFixed(2)} recebido (TxID: ${txid || 'N/A'}), mas nenhum aluno correspondente foi identificado.`, 'Sistema');
      return json({
        ok: true,
        received: true,
        status: 'PENDENTE_CONCILIACAO',
        mensagem: 'Pagamento recebido. Aluno não identificado para baixa automática.'
      });
    }

    const finalAmount = amount > 0 ? amount : money(student.mensalidade);
    const monthDueDate = String(body.vencimento || dueDateForMonth(student, reference)).slice(0, 10);
    const paidUntil = student.pago_ate && student.pago_ate > monthDueDate ? student.pago_ate : monthDueDate;
    const paidAt = today();

    await run(db, 'UPDATE alunos SET pago_ate=? WHERE id=?', [paidUntil, student.id]);
    await insertRow(db, 'pagamentos', {
      aluno_id: student.id,
      referencia: reference,
      valor: finalAmount,
      vencimento: monthDueDate,
      pago_em: paidAt,
      status: 'PAGO',
      forma_pagamento: 'Pix Webhook',
      observacao: txid ? `TxID: ${txid}` : 'Baixa automática via Webhook Pix'
    });

    await logAction(db, 'Pix Recebido', `Webhook Pix confirmou pagamento de R$ ${finalAmount.toFixed(2)} para ${student.nome} (${reference}).`, 'Sistema');

    return json({
      ok: true,
      received: true,
      status: 'CONFIRMADO',
      aluno_id: student.id,
      aluno_nome: student.nome,
      valor: finalAmount,
      referencia: reference,
      pago_ate: paidUntil,
      item: await first(db, 'SELECT * FROM alunos WHERE id=?', [student.id])
    });
  }

  if (url.pathname === '/api/pix/config') {
    if (method === 'GET') {
      await run(db, 'CREATE TABLE IF NOT EXISTS configuracoes (chave TEXT PRIMARY KEY, valor TEXT)');
      const rowChave = await first(db, "SELECT valor FROM configuracoes WHERE chave='chave_pix'");
      const rowTipo = await first(db, "SELECT valor FROM configuracoes WHERE chave='tipo_chave'");
      const rowBeneficiario = await first(db, "SELECT valor FROM configuracoes WHERE chave='beneficiario'");
      const rowCidade = await first(db, "SELECT valor FROM configuracoes WHERE chave='cidade'");
      return json({
        ok: true,
        chave_pix: rowChave?.valor || 'arena@futevolei.com.br',
        tipo_chave: rowTipo?.valor || 'telefone',
        beneficiario: rowBeneficiario?.valor || 'Team Lucão Futevôlei',
        cidade: rowCidade?.valor || 'Sorocaba'
      });
    }
    if (method === 'POST') {
      await run(db, 'CREATE TABLE IF NOT EXISTS configuracoes (chave TEXT PRIMARY KEY, valor TEXT)');
      const chave = String(body.chave_pix || body.chave || '').trim();
      const tipo = String(body.tipo_chave || body.tipo || 'telefone').trim();
      const beneficiario = String(body.beneficiario || body.responsavel || 'Team Lucão Futevôlei').trim();
      const cidade = String(body.cidade || 'Sorocaba').trim();
      await run(db, "INSERT OR REPLACE INTO configuracoes (chave, valor) VALUES ('chave_pix', ?)", [chave]);
      await run(db, "INSERT OR REPLACE INTO configuracoes (chave, valor) VALUES ('tipo_chave', ?)", [tipo]);
      await run(db, "INSERT OR REPLACE INTO configuracoes (chave, valor) VALUES ('beneficiario', ?)", [beneficiario]);
      await run(db, "INSERT OR REPLACE INTO configuracoes (chave, valor) VALUES ('cidade', ?)", [cidade]);
      await logAction(db, 'Configuração Pix', `Chave Pix atualizada para ${chave} (${tipo}).`, 'Professor');
      return json({ ok: true, chave_pix: chave, tipo_chave: tipo, beneficiario, cidade });
    }
  }

  if (url.pathname === '/api/public/group-summary' && method === 'GET') {
    const todayStr = String(url.searchParams.get('data') || today()).slice(0, 10);
    const nowHour = new Date().getUTCHours() - 3;
    const period = String(url.searchParams.get('periodo') || (nowHour < 13 ? 'manha' : 'tarde')).toLowerCase();
    const format = String(url.searchParams.get('format') || 'json').toLowerCase();

    const classes = await all(db, `
      SELECT * FROM aulas 
      WHERE data = ? AND status != 'Cancelada' 
      ORDER BY horario, turma
    `, [todayStr]);

    const activeClasses = period === 'tarde'
      ? classes.filter((c) => c.horario >= '12:00')
      : classes;

    const items = [];
    for (const c of activeClasses) {
      const links = await all(db, `
        SELECT aa.confirmado, aa.presente, a.nome
        FROM aula_alunos aa
        JOIN alunos a ON a.id = aa.aluno_id
        WHERE aa.aula_id = ? AND aa.confirmado = 'sim'
        ORDER BY a.nome
      `, [c.id]);

      const confirmedNames = links.map((l) => l.nome.trim().split(' ')[0]);
      const confirmedCount = links.length;
      const capacity = Number(c.capacidade || 8);
      const openSlots = Math.max(0, capacity - confirmedCount);

      items.push({
        id: c.id,
        horario: c.horario,
        turma: c.turma || 'Turma',
        tipo: c.tipo || 'Regular',
        capacidade: capacity,
        confirmados: confirmedCount,
        vagas_restantes: openSlots,
        lotada: openSlots === 0,
        nomes_confirmados: confirmedNames
      });
    }

    const [y, m, d] = todayStr.split('-');
    const dateFormatted = `${d}/${m}`;
    const portalUrl = 'https://teamlucaofuturo.pages.dev/aluno';

    let text = '';
    if (period === 'manha') {
      text += `☀️ *Bom dia, galera do Team Lucão!* 🏐\n\n`;
      text += `Confiram os treinos de hoje e confirmem suas presenças na Área do Aluno:\n👉 ${portalUrl}\n\n`;
      text += `📅 *TREINOS DE HOJE (${dateFormatted})*:\n`;
      if (items.length === 0) {
        text += `_Nenhum treino agendado para hoje._\n`;
      } else {
        items.forEach((c) => {
          const statusText = c.lotada ? '❌ *LOTADA*' : `✅ *${c.vagas_restantes} vaga(s)*`;
          text += `▫️ *${c.horario}* - ${c.turma} (${c.confirmados}/${c.capacidade}) • ${statusText}\n`;
          if (c.nomes_confirmados.length > 0) {
            text += `   👥 _${c.nomes_confirmados.join(', ')}_\n`;
          }
        });
      }
      text += `\n⚠️ _Se for faltar, desmarque pelo link com antecedência para liberar a vaga pro parceiro!_ 👊`;
    } else {
      text += `🔥 *Chamada pros treinos de hoje à noite!* 🏐\n\n`;
      text += `Fique por dentro das turmas e garanta sua vaga de última hora:\n👉 ${portalUrl}\n\n`;
      text += `📅 *QUADRO DE HOJE À NOITE (${dateFormatted})*:\n`;
      if (items.length === 0) {
        text += `_Nenhum treino agendado para hoje._\n`;
      } else {
        items.forEach((c) => {
          const statusText = c.lotada ? '❌ *LOTADA*' : `⚡ *${c.vagas_restantes} vaga(s) restante(s)*`;
          text += `▫️ *${c.horario}* - ${c.turma} • ${statusText}\n`;
          if (c.nomes_confirmados.length > 0) {
            text += `   👥 Confirmados: ${c.nomes_confirmados.join(', ')}\n`;
          } else {
            text += `   👥 Nenhum aluno confirmado ainda.\n`;
          }
        });
      }
      text += `\n📲 _Confirme ou desmarque direto pelo link acima. Bora pro play!_ 🚀`;
    }

    if (format === 'text') {
      return new Response(text, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Cache-Control': 'no-store',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    return json({
      ok: true,
      data: todayStr,
      periodo: period,
      total_aulas: items.length,
      texto: text,
      items
    });
  }

  if (url.pathname === '/api/public/classes' && method === 'GET') return json({ ok: true, items: await publicClasses(db) });
  if (url.pathname === '/api/public/student-classes' && method === 'GET') return json(await studentClasses(db, request));
  if (url.pathname === '/api/public/student-waitlist' && method === 'GET') {
    const phone = digits(url.searchParams.get('telefone') || url.searchParams.get('phone'));
    if (phone.length < 8) throw new Error('Informe pelo menos 8 numeros do WhatsApp');
    const items = await all(db, `SELECT w.id, w.aula_id, w.nome, w.telefone, w.status, w.observacao, w.data_cadastro, a.data AS aula_data, a.horario AS aula_horario, a.turma AS aula_turma, (SELECT COUNT(*) FROM lista_espera ahead WHERE ahead.aula_id=w.aula_id AND ahead.status IN ('Novo', 'Contatado', 'Experimental marcado') AND ahead.id<=w.id) AS posicao FROM lista_espera w LEFT JOIN aulas a ON a.id=w.aula_id WHERE w.status IN ('Novo', 'Contatado', 'Experimental marcado') AND ${sqlPhone('w.telefone')} LIKE ? ORDER BY w.id DESC`, [`%${phone.slice(-8)}`]);
    return json({ ok: true, items });
  }
  if (url.pathname === '/api/public/bookings' && method === 'POST') {
    const classItem = await first(db, 'SELECT * FROM aulas WHERE id=?', [body.aula_id]);
    if (!classItem) throw new Error('Aula nao encontrada');
    if (classItem.status === 'Cancelada' || isClassPast(classItem.data, classItem.horario)) {
      throw new Error('Essa aula ja passou ou nao esta disponivel');
    }
    const phone = digits(body.telefone);
    if (phone.length < 8) throw new Error('Informe pelo menos 8 numeros do WhatsApp');
    if (!String(body.nome || '').trim()) throw new Error('Informe seu nome');
    const existingStudent = await findStudent(db, phone);
    if (existingStudent) {
      const alreadyConfirmed = await first(db, "SELECT id FROM aula_alunos WHERE aula_id=? AND aluno_id=? AND confirmado='sim'", [classItem.id, existingStudent.id]);
      if (alreadyConfirmed) throw new Error('Você já está confirmado nesta aula');
    }
    const duplicate = await first(db, `SELECT id FROM agendamentos WHERE aula_id=? AND status IN ('Pendente', 'Aprovado') AND ${sqlPhone()} LIKE ? LIMIT 1`, [classItem.id, `%${phone.slice(-8)}`]);
    if (duplicate) throw new Error('Ja existe um pedido para esse WhatsApp nessa aula');
    const enrolled = await scalar(db, 'SELECT COUNT(*) AS total FROM aula_alunos WHERE aula_id=?', [classItem.id]);
    if (enrolled >= Number(classItem.capacidade || 8)) throw new Error('Aula lotada');
    const result = await insertRow(db, 'agendamentos', {
      nome: String(body.nome).trim(),
      telefone: String(body.telefone || '').trim(),
      aula_id: Number(classItem.id),
      status: 'Pendente',
      observacao: String(body.observacao || '').trim(),
      indicado_por: String(body.indicado_por || body.referral || body.indicacao || '').trim()
    });
    await logAction(db, 'Pedido de aula', `${String(body.nome).trim()} solicitou vaga na aula ${classItem.horario} - ${classItem.turma || 'Turma'} em ${classItem.data}.`, 'Aluno');
    return json({ ok: true, item: await first(db, 'SELECT * FROM agendamentos WHERE id=?', [result.id]) });
  }
  if (url.pathname === '/api/public/student-confirm' && method === 'POST') {
    const student = await findStudent(db, body.telefone || body.phone);
    if (!student) throw new Error('Aluno nao encontrado para esse WhatsApp');
    const classId = Number(body.aula_id || body.class_id || 0);
    const classItem = await first(db, 'SELECT * FROM aulas WHERE id=?', [classId]);
    if (!classItem || classItem.status === 'Cancelada' || isClassPast(classItem.data, classItem.horario)) {
      throw new Error('Essa aula ja começou ou nao esta mais disponivel para confirmacao');
    }

    const responseValue = String(body.confirmado ?? body.confirmation ?? '').toLowerCase();
    const removeResponse = ['remover', 'remove', 'limpar'].includes(responseValue);
    const value = removeResponse ? '' : responseValue;
    if (!removeResponse && !['sim', 'nao'].includes(value)) throw new Error('Resposta invalida');

    const link = await first(db, 'SELECT * FROM aula_alunos WHERE aula_id=? AND aluno_id=?', [classId, student.id]);

    if (value === 'sim') {
      const todayDate = today();
      const planDueDate = student.pago_ate || dueDateForMonth(student, currentMonth());
      if (todayDate > planDueDate) {
        throw new Error(`Seu plano está vencido (${planDueDate.slice(8, 10)}/${planDueDate.slice(5, 7)}/${planDueDate.slice(0, 4)}). Regularize sua mensalidade via PIX para confirmar presença nas aulas.`);
      }

      const alreadyConfirmedThis = link && link.confirmado === 'sim';
      if (!alreadyConfirmedThis) {
        const enrolled = await scalar(db, 'SELECT COUNT(*) AS total FROM aula_alunos WHERE aula_id=?', [classId]);
        if (!link && enrolled >= Number(classItem.capacidade || 8)) {
          throw new Error('Essa aula ja atingiu a capacidade maxima de alunos');
        }

        const classWeek = getWeekRange(classItem.data);
        const plan = student.plano_id ? await first(db, 'SELECT * FROM planos WHERE id=?', [student.plano_id]) : null;
        const quota = getStudentWeeklyQuota(student, plan);

        const currentConfirmedInWeek = (await scalar(db, `
          SELECT COUNT(*) AS total
          FROM aula_alunos aa
          JOIN aulas a ON a.id=aa.aula_id
          WHERE aa.aluno_id=? AND aa.confirmado='sim' AND a.status != 'Cancelada'
            AND a.data BETWEEN ? AND ?
        `, [student.id, classWeek.inicio, classWeek.fim])) || 0;

        if (currentConfirmedInWeek >= quota) {
          throw new Error(`Voce ja confirmou o limite de ${quota} aula(s) nessa semana pelo seu plano`);
        }
      }
    }

    const now = new Date().toISOString();
    if (!link) {
      await run(db, `
        INSERT INTO aula_alunos (aula_id, aluno_id, confirmado, confirmado_em, confirmado_professor, confirmado_professor_em, presente)
        VALUES (?, ?, ?, ?, '', '', 0)
      `, [classId, student.id, value, value ? now : '']);
    } else {
      await run(db, 'UPDATE aula_alunos SET confirmado=?, confirmado_em=?, confirmado_professor=?, confirmado_professor_em=? WHERE aula_id=? AND aluno_id=?', [
        value,
        value ? now : '',
        value === 'sim' ? (link.confirmado_professor || '') : '',
        value === 'sim' ? (link.confirmado_professor_em || '') : '',
        classId,
        student.id
      ]);
    }

    if (value === 'sim') {
      await run(db, "UPDATE agendamentos SET status='Aprovado', respondido_em=? WHERE aula_id=? AND " + sqlPhone('telefone') + " LIKE ?", [today(), classId, `%${digits(student.telefone).slice(-8)}`]);
    } else if (removeResponse) {
      await run(db, "UPDATE agendamentos SET status='Cancelado', respondido_em=? WHERE aula_id=? AND " + sqlPhone('telefone') + " LIKE ?", [today(), classId, `%${digits(student.telefone).slice(-8)}`]);
    }

    await logAction(db, removeResponse ? 'Resposta do aluno removida' : 'Confirmacao aluno', removeResponse
      ? `${student.nome} removeu a resposta da aula ${classItem.horario} - ${classItem.turma || 'Turma'} em ${classItem.data}.`
      : `${student.nome} respondeu ${value} na aula ${classItem.horario} - ${classItem.turma || 'Turma'} em ${classItem.data}.`, 'Aluno');

    return json({ ok: true, removed: removeResponse, item: await first(db, 'SELECT * FROM aula_alunos WHERE aula_id=? AND aluno_id=?', [classId, student.id]) });
  }
  if (url.pathname === '/api/public/simulate-pix' && method === 'POST') {
    const informedPhone = body.telefone || body.phone || '';
    const student = await findStudent(db, informedPhone);
    if (!student) throw new Error('Aluno não encontrado para esse WhatsApp');
    const nextMonth = nextMonthKey(currentMonth());
    const nextDueDate = dueDateForMonth(student, nextMonth);
    await run(db, 'UPDATE alunos SET pago_ate=? WHERE id=?', [nextDueDate, student.id]);
    await logAction(db, 'Pagamento PIX', `${student.nome} realizou pagamento simulado via PIX. Plano liberado até ${nextDueDate}.`, 'PIX');
    return json({ ok: true, pago_ate: nextDueDate, student: { ...student, pago_ate: nextDueDate } });
  }
  if (url.pathname === '/api/public/waitlist' && method === 'POST') {
    const classId = Number(body.aula_id || body.class_id || 0);
    const classItem = await first(db, 'SELECT * FROM aulas WHERE id=?', [classId]);
    if (!classItem) throw new Error('Aula nao encontrada');
    const phone = digits(body.telefone);
    if (phone.length < 8 || !String(body.nome || '').trim()) throw new Error('Informe nome e WhatsApp');
    const enrolled = await scalar(db, 'SELECT COUNT(*) AS total FROM aula_alunos WHERE aula_id=?', [classId]);
    if (enrolled < Number(classItem.capacidade || 8)) throw new Error('Ainda existe vaga nessa aula');
    const duplicate = await first(db, `SELECT id FROM lista_espera WHERE aula_id=? AND status IN ('Novo', 'Contatado', 'Experimental marcado') AND ${sqlPhone()} LIKE ?`, [classId, `%${phone.slice(-8)}`]);
    if (duplicate) throw new Error('Voce ja esta na espera dessa aula');
    const result = await insertRow(db, 'lista_espera', { nome: String(body.nome).trim(), telefone: String(body.telefone || '').trim(), aula_id: classId, preferencia: `${classItem.data} ${classItem.horario} - ${classItem.turma || 'Turma'}`, status: 'Novo', observacao: String(body.observacao || '').trim(), data_cadastro: today() });
    const position = await scalar(db, `SELECT COUNT(*) AS total FROM lista_espera WHERE aula_id=? AND status IN ('Novo', 'Contatado', 'Experimental marcado') AND id<=?`, [classId, result.id]);
    await logAction(db, 'Entrada na espera', `${String(body.nome).trim()} entrou na espera da aula ${classItem.horario} - ${classItem.turma || 'Turma'} em ${classItem.data}.`, 'Aluno');
    return json({ ok: true, position, item: { ...(await first(db, 'SELECT * FROM lista_espera WHERE id=?', [result.id])), posicao: position } });
  }

  if (url.pathname === '/api/bootstrap' && method === 'GET') return json(await bootstrap(db));
  if (url.pathname === '/api/state' && method === 'GET') return json({ ok: true, state: await stateSnapshot(db, true) });
  if (url.pathname === '/api/sync' && method === 'POST') return json({ ok: true, state: await stateSnapshot(db, true) });
  if (url.pathname === '/api/backup.json' && method === 'GET') return json(await stateSnapshot(db, true));
  if (url.pathname === '/api/backups/create' && method === 'POST') return json({ ok: true, filename: `backup_cloud_${Date.now()}.json`, backups: [], snapshot: await stateSnapshot(db, true) });
  if (url.pathname === '/api/import' && method === 'POST') return json(await importSnapshot(db, body));

  if (url.pathname === '/api/dashboard' && method === 'GET') {
    const date = String(url.searchParams.get('date') || today()).slice(0, 10);
    const month = String(url.searchParams.get('month') || currentMonth()).slice(0, 7);
    const classes = await classList(db, 'SELECT * FROM aulas WHERE data=? ORDER BY horario, turma', [date]);
    const pending = await all(db, "SELECT * FROM alunos WHERE COALESCE(status, 'Ativo') != 'Pausado' AND (pago_ate IS NULL OR pago_ate < ?) ORDER BY nome", [today()]);
    const paid = await scalar(db, "SELECT COALESCE(SUM(valor), 0) AS total FROM pagamentos WHERE status='PAGO' AND pago_em LIKE ?", [`${month}%`]);
    const active = await scalar(db, "SELECT COUNT(*) AS total FROM alunos WHERE COALESCE(status, 'Ativo')='Ativo'");
    return json({ ok: true, date, month, aulas: classes, pendencias: pending, stats: { aulas_hoje: classes.length, alunos_ativos: active, presencas_hoje: classes.reduce((sum, item) => sum + item.alunos.filter((student) => Number(student.presente) === 1).length, 0), pagamentos_pendentes: pending.length, faturamento_mes: paid } });
  }

  if (path[1] === 'quick' && path[2] === 'confirmations' && method === 'GET') {
    return json({ ok: true, items: await all(db, `SELECT aa.aula_id, aa.aluno_id, aa.confirmado_em, a.data, a.horario, a.turma, a.tipo, s.nome AS aluno_nome FROM aula_alunos aa JOIN aulas a ON a.id=aa.aula_id JOIN alunos s ON s.id=aa.aluno_id WHERE aa.confirmado='sim' AND COALESCE(aa.confirmado_professor, '') != 'sim' AND a.status != 'Cancelada' AND a.data >= ? ORDER BY a.data, a.horario, s.nome`, [today()]) });
  }

  if (path[1] === 'classes' && path.length === 4 && path[3] === 'attendance' && method === 'PUT') {
    const classItem = await first(db, 'SELECT * FROM aulas WHERE id=?', [path[2]]);
    if (!classItem) throw new Error('Aula nao encontrada');
    for (const [studentId, present] of Object.entries(body.attendance || body.presencas || {})) await run(db, 'UPDATE aula_alunos SET presente=? WHERE aula_id=? AND aluno_id=?', [present ? 1 : 0, path[2], studentId]);
    await logAction(db, 'Presenca', `${classItem.horario} - ${classItem.turma || 'Turma'} em ${classItem.data} teve presencas atualizadas.`, 'Professor');
    return json({ ok: true, item: await classWithStudents(db, classItem) });
  }
  if (path[1] === 'classes' && path.length === 4 && path[3] === 'student-confirmation' && method === 'POST') {
    const classItem = await first(db, 'SELECT * FROM aulas WHERE id=?', [path[2]]);
    const studentId = Number(body.student_id || body.aluno_id || 0);
    const link = await first(db, 'SELECT * FROM aula_alunos WHERE aula_id=? AND aluno_id=?', [path[2], studentId]);
    const student = await first(db, 'SELECT * FROM alunos WHERE id=?', [studentId]);
    if (!classItem || !link || !student) throw new Error('Aluno nao esta vinculado a esta aula');
    if (link.confirmado !== 'sim') throw new Error('O aluno ainda nao indicou que vai');
    const action = String(body.action || 'approve').toLowerCase();
    if (!['approve', 'clear'].includes(action)) throw new Error('Acao invalida');
    await run(db, 'UPDATE aula_alunos SET confirmado_professor=?, confirmado_professor_em=? WHERE aula_id=? AND aluno_id=?', [action === 'approve' ? 'sim' : '', action === 'approve' ? new Date().toISOString() : '', path[2], studentId]);
    await logAction(db, action === 'approve' ? 'Confirmacao professor' : 'Confirmacao professor removida', `${student.nome} ${action === 'approve' ? 'foi confirmado(a)' : 'deixou de estar confirmado(a)'} na aula ${classItem.horario} - ${classItem.turma || 'Turma'} em ${classItem.data}.`, 'Professor');
    return json({ ok: true, item: await classWithStudents(db, classItem) });
  }

  if (path[1] === 'bookings' && path.length === 3 && method === 'POST' && path[2] !== 'respond') return json(await respondBooking(db, path[2], body));
  if (path[1] === 'bookings' && path.length === 4 && path[3] === 'respond' && method === 'POST') return json(await respondBooking(db, path[2], body));

  if (path[1] === 'students' && path.length === 2) {
    if (method === 'GET') {
      const search = String(url.searchParams.get('search') || '').trim();
      const params = search ? Array(5).fill(`%${search}%`) : [];
      const sql = search
        ? `SELECT a.*, (SELECT COUNT(*) FROM alunos ind WHERE LOWER(TRIM(ind.indicado_por)) = LOWER(TRIM(a.nome))) AS total_indicados FROM alunos a WHERE a.nome LIKE ? OR a.telefone LIKE ? OR a.plano_nome LIKE ? OR a.nivel LIKE ? OR a.indicado_por LIKE ? ORDER BY a.nome`
        : `SELECT a.*, (SELECT COUNT(*) FROM alunos ind WHERE LOWER(TRIM(ind.indicado_por)) = LOWER(TRIM(a.nome))) AS total_indicados FROM alunos a ORDER BY a.nome`;
      return json({ ok: true, items: await all(db, sql, params) });
    }
    if (method === 'POST') {
      const payload = normalizeStudent(body); if (!payload.nome) throw new Error('Informe o nome do aluno');
      const result = await insertRow(db, 'alunos', payload); const item = await first(db, 'SELECT * FROM alunos WHERE id=?', [result.id]);
      await logAction(db, 'Aluno cadastrado', `${item.nome} foi cadastrado no painel.`, 'Professor'); return json({ ...result, item });
    }
  }
  if (path[1] === 'students' && path.length === 3 && path[2] === 'batch-import' && method === 'POST') {
    const items = Array.isArray(body.items) ? body.items : (Array.isArray(body.students) ? body.students : []);
    const updateExisting = Boolean(body.update_existing);
    let created = 0, updated = 0, ignored = 0;
    for (const raw of items) {
      const nome = String(raw.nome || raw.name || '').trim();
      if (!nome) { ignored++; continue; }
      const rawPhone = String(raw.telefone || raw.phone || '').trim();
      let phone = digits(rawPhone);
      if (phone.startsWith('55') && (phone.length === 12 || phone.length === 13)) phone = phone.slice(2);
      if (phone.length === 8 || phone.length === 9) phone = '15' + phone;
      let existing = null;
      if (phone.length >= 8) {
        existing = await first(db, `SELECT * FROM alunos WHERE ${sqlPhone()} LIKE ? LIMIT 1`, [`%${phone.slice(-8)}`]);
      } else {
        existing = await first(db, `SELECT * FROM alunos WHERE LOWER(TRIM(nome)) = ? LIMIT 1`, [nome.toLowerCase()]);
      }
      const payload = normalizeStudent({
        ...raw,
        nome,
        telefone: rawPhone || (phone ? formatPhone(phone) : ''),
        indicado_por: String(raw.indicado_por || raw.referral || '').trim()
      });
      if (existing) {
        if (updateExisting) {
          await updateRow(db, 'alunos', existing.id, {
            ...payload,
            plano_id: payload.plano_id || existing.plano_id,
            plano_nome: payload.plano_nome || existing.plano_nome,
            mensalidade: payload.mensalidade > 0 ? payload.mensalidade : existing.mensalidade,
            indicado_por: payload.indicado_por || existing.indicado_por
          });
          updated++;
        } else {
          ignored++;
        }
      } else {
        await insertRow(db, 'alunos', payload);
        created++;
      }
    }
    await logAction(db, 'Importação de alunos', `Importação: ${created} criados, ${updated} atualizados, ${ignored} ignorados.`, 'Professor');
    return json({ ok: true, total: items.length, created, updated, ignored });
  }
  if (path[1] === 'students' && path.length === 3 && path[2] !== 'pay') {
    const id = path[2];
    if (method === 'GET') {
      const item = await first(db, `SELECT a.*, (SELECT COUNT(*) FROM alunos ind WHERE LOWER(TRIM(ind.indicado_por)) = LOWER(TRIM(a.nome))) AS total_indicados FROM alunos a WHERE a.id=?`, [id]);
      if (!item) return errorResponse(Object.assign(new Error('Aluno nao encontrado'), { status: 404 }));
      const indicados = await all(db, `SELECT id, nome, telefone, plano_nome, data_cadastro FROM alunos WHERE LOWER(TRIM(indicado_por)) = LOWER(TRIM(?)) ORDER BY nome`, [item.nome]);
      return json({ ok: true, item, indicados });
    }
    if (method === 'PUT') { const payload = normalizeStudent(body); if (!payload.nome) throw new Error('Informe o nome do aluno'); await updateRow(db, 'alunos', id, payload); const item = await first(db, 'SELECT * FROM alunos WHERE id=?', [id]); await logAction(db, 'Aluno atualizado', `${item?.nome || 'Aluno'} teve cadastro atualizado.`, 'Professor'); return json({ ok: true, item }); }
    if (method === 'DELETE') return json(await deleteRow(db, 'alunos', id));
  }
  if (path[1] === 'students' && path.length === 4 && path[3] === 'pay') {
    const student = await first(db, 'SELECT * FROM alunos WHERE id=?', [path[2]]); if (!student) throw new Error('Aluno nao encontrado');
    const reference = String(body.referencia || url.searchParams.get('referencia') || currentMonth()).slice(0, 7);
    if (method === 'POST') {
      const due = String(body.vencimento || `${reference}-10`).slice(0, 10);
      const paidUntil = student.pago_ate && student.pago_ate > due ? student.pago_ate : due;
      await run(db, 'UPDATE alunos SET pago_ate=? WHERE id=?', [paidUntil, student.id]);
      await insertRow(db, 'pagamentos', { aluno_id: student.id, referencia: reference, valor: money(body.valor ?? student.mensalidade), vencimento: due, pago_em: String(body.pago_em || today()).slice(0, 10), status: 'PAGO', forma_pagamento: String(body.forma_pagamento || 'Pix'), observacao: String(body.observacao || 'Mensalidade marcada pelo painel') });
      await logAction(db, 'Pagamento', `${student.nome} pago ate ${paidUntil}.`, 'Professor'); return json({ ok: true, paidUntil, item: await first(db, 'SELECT * FROM alunos WHERE id=?', [student.id]) });
    }
    if (method === 'DELETE') {
      await run(db, 'DELETE FROM pagamentos WHERE aluno_id=? AND referencia=?', [student.id, reference]);
      await run(db, 'UPDATE alunos SET pago_ate=? WHERE id=?', ['', student.id]);
      await logAction(db, 'Pagamento desmarcado', `${student.nome} teve pagamento de ${reference} desmarcado.`, 'Professor');
      return json({ ok: true, item: await first(db, 'SELECT * FROM alunos WHERE id=?', [student.id]) });
    }
  }

  if (path[1] === 'classes' && path.length === 2) {
    if (method === 'GET') return json({ ok: true, items: await classList(db, url.searchParams.get('date') ? 'SELECT * FROM aulas WHERE data=? ORDER BY data, horario, turma' : undefined, url.searchParams.get('date') ? [String(url.searchParams.get('date')).slice(0, 10)] : []) });
    if (method === 'POST' || method === 'PUT') {
      const payload = normalizeClass(body); const ids = body.aluno_ids || body.studentIds || []; const attendance = body.presencas || body.attendance || {};
      if (method === 'POST') { const result = await insertRow(db, 'aulas', payload); await upsertClassStudents(db, result.id, ids, attendance); const item = await classWithStudents(db, await first(db, 'SELECT * FROM aulas WHERE id=?', [result.id])); await logAction(db, 'Aula criada', `${item.horario} - ${item.turma || 'Turma'} em ${item.data}.`, 'Professor'); return json({ ok: true, item }); }
    }
  }
  if (path[1] === 'classes' && path.length === 3 && method === 'PUT') { const id = path[2]; const payload = normalizeClass(body); await updateRow(db, 'aulas', id, payload); await upsertClassStudents(db, id, body.aluno_ids || body.studentIds || [], body.presencas || body.attendance || {}); const item = await classWithStudents(db, await first(db, 'SELECT * FROM aulas WHERE id=?', [id])); await logAction(db, 'Aula atualizada', `${item.horario} - ${item.turma || 'Turma'} em ${item.data}.`, 'Professor'); return json({ ok: true, item }); }
  if (path[1] === 'classes' && path.length === 3 && method === 'DELETE') return json(await deleteRow(db, 'aulas', path[2]));

  if (path[1] === 'plans' && method === 'GET') return json({ ok: true, items: await all(db, 'SELECT * FROM planos ORDER BY ativo DESC, preco, nome') });
  if (path[1] === 'payments' && method === 'GET') { const month = String(url.searchParams.get('month') || currentMonth()).slice(0, 7); return json({ ok: true, month, items: await all(db, 'SELECT p.*, a.nome AS aluno_nome FROM pagamentos p LEFT JOIN alunos a ON a.id=p.aluno_id WHERE referencia=? OR pago_em LIKE ? ORDER BY p.id DESC', [month, `${month}%`]) }); }
  if (path[1] === 'bookings' && path.length === 2 && method === 'GET') return json({ ok: true, items: await all(db, `SELECT ag.*, a.data, a.horario, a.turma, a.tipo, a.capacidade, (SELECT COUNT(*) FROM aula_alunos aa WHERE aa.aula_id=ag.aula_id) AS inscritos FROM agendamentos ag LEFT JOIN aulas a ON a.id=ag.aula_id ORDER BY ag.status='Pendente' DESC, ag.id DESC`) });
  if (path[1] === 'waitlist' && method === 'GET') return json({ ok: true, items: await all(db, `SELECT w.*, a.data AS aula_data, a.horario AS aula_horario, a.turma AS aula_turma, a.status AS aula_status FROM lista_espera w LEFT JOIN aulas a ON a.id=w.aula_id ORDER BY w.id DESC`) });
  if (path[1] === 'waitlist' && path.length === 2 && method === 'POST') { const payload = { nome: String(body.nome || body.name || '').trim(), telefone: String(body.telefone || body.phone || '').trim(), aula_id: body.aula_id ? Number(body.aula_id) : null, preferencia: String(body.preferencia || '').trim(), status: String(body.status || 'Novo'), observacao: String(body.observacao || '').trim(), data_cadastro: today() }; if (!payload.nome) throw new Error('Informe o nome'); const result = await insertRow(db, 'lista_espera', payload); const item = await first(db, 'SELECT * FROM lista_espera WHERE id=?', [result.id]); await logAction(db, 'Interessado cadastrado', `${item.nome} entrou na lista de espera.`, 'Professor'); return json({ ...result, item }); }
  if (path[1] === 'waitlist' && path.length === 3 && method === 'PUT') { const payload = { nome: String(body.nome || '').trim(), telefone: String(body.telefone || '').trim(), preferencia: String(body.preferencia || '').trim(), status: String(body.status || 'Novo'), observacao: String(body.observacao || '').trim() }; if (Object.prototype.hasOwnProperty.call(body, 'aula_id')) payload.aula_id = body.aula_id ? Number(body.aula_id) : null; await updateRow(db, 'lista_espera', path[2], payload); const item = await first(db, 'SELECT * FROM lista_espera WHERE id=?', [path[2]]); await logAction(db, 'Espera atualizada', `${item?.nome || 'Interessado'} mudou para ${item?.status || payload.status}.`, 'Professor'); return json({ ok: true, item }); }
  if (path[1] === 'waitlist' && path.length === 3 && method === 'DELETE') return json(await deleteRow(db, 'lista_espera', path[2]));
  if (path[1] === 'availability' && method === 'GET') return json({ ok: true, items: await all(db, 'SELECT * FROM disponibilidade ORDER BY dia') });
  if (path[1] === 'availability' && method === 'PUT') { for (const item of body.items || []) await run(db, 'INSERT OR REPLACE INTO disponibilidade (dia, inicio, fim) VALUES (?, ?, ?)', [Number(item.dia), String(item.inicio || '07:00'), String(item.fim || '22:00')]); await logAction(db, 'Agenda', 'Disponibilidade atualizada.', 'Professor'); return json({ ok: true, items: await all(db, 'SELECT * FROM disponibilidade ORDER BY dia') }); }
  if (path[1] === 'logs' && method === 'POST') { await logAction(db, String(body.acao || body.action || '').trim(), String(body.detalhe || body.detail || '').trim(), String(body.ator || body.actor || 'Professor')); return json({ ok: true }); }
  if (path[1] === 'tables' && path.length === 3 && method === 'GET') { const table = path[2]; if (!DATA_TABLES.includes(table)) throw new Error('Tabela nao permitida'); const limit = Math.min(500, Math.max(1, Number(url.searchParams.get('limit') || 200))); return json({ ok: true, table, rows: await all(db, `SELECT * FROM ${table} ORDER BY id DESC LIMIT ${limit}`) }); }
  if (path[1] === 'tables' && path.length === 2 && method === 'GET') return json({ ok: true, tables: DATA_TABLES });
  if (path[1] === 'tables' && path.length === 3 && method === 'POST') { if (!DATA_TABLES.includes(path[2])) throw new Error('Tabela nao permitida'); const result = await insertRow(db, path[2], body); return json({ ok: true, ...result, item: await first(db, `SELECT * FROM ${path[2]} WHERE id=?`, [result.id]) }); }
  if (path[1] === 'tables' && path.length === 4 && method === 'PUT') { if (!DATA_TABLES.includes(path[2])) throw new Error('Tabela nao permitida'); await updateRow(db, path[2], path[3], body); return json({ ok: true, item: await first(db, `SELECT * FROM ${path[2]} WHERE id=?`, [path[3]]) }); }
  if (path[1] === 'tables' && path.length === 4 && method === 'DELETE') { if (!DATA_TABLES.includes(path[2])) throw new Error('Tabela nao permitida'); return json(await deleteRow(db, path[2], path[3])); }
  if (url.pathname === '/api/db/download' && method === 'GET') return json(await stateSnapshot(db, true), 200, { 'Content-Disposition': 'attachment; filename="arena-d1-backup.json"' });
  throw Object.assign(new Error('Rota nao encontrada'), { status: 404 });
}

async function readBody(request) {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method.toUpperCase())) return {};
  const text = await request.text();
  if (!text) return {};
  try { return JSON.parse(text); } catch { throw new Error('JSON invalido'); }
}

function assetRequest(request, env) {
  const url = new URL(request.url);
  const routes = env.PAGES_MODE === '1' ? {} : { '/': '/index.html', '/aluno': '/aluno.html', '/autorizar': '/autorizar.html' };
  if (routes[url.pathname]) url.pathname = routes[url.pathname];
  return new Request(url, request);
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Pin', 'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS' } });
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/') || url.pathname === '/health') {
      try { return await apiHandler(request, env, await readBody(request)); } catch (error) { return errorResponse(error); }
    }
    return env.ASSETS.fetch(assetRequest(request, env));
  }
};
