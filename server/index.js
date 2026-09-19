const express = require('express');
const cors = require('cors');
const path = require('node:path');
const fs = require('node:fs');
const {
  DATA_TABLES,
  DB_PATH,
  deleteRow,
  insertRow,
  logAction,
  publicState,
  restoreState,
  row,
  rows,
  run,
  scalar,
  stateSnapshot,
  tableColumns,
  tableResponse,
  updateRow
} = require('./db');

const ROOT_DIR = path.resolve(__dirname, '..');
try {
  process.loadEnvFile?.(path.join(ROOT_DIR, '.env'));
} catch {}

const { generatePixPayload } = require('./pix');

const app = express();
const PORT = Number(process.env.PORT || 3025);
const BACKUPS_DIR = process.env.BACKUPS_DIR || path.join(ROOT_DIR, 'backups');
const ADMIN_PIN = String(process.env.ADMIN_PIN || '2222');
const TEACHER_PIN = String(process.env.TEACHER_PIN || '1111');
const AUTO_BACKUP_ON_START = String(process.env.AUTO_BACKUP_ON_START || 'true') !== 'false';
const AUTO_BACKUP_INTERVAL_HOURS = Number(process.env.AUTO_BACKUP_INTERVAL_HOURS || 0);
const BACKUP_RETENTION = Math.max(1, Number(process.env.BACKUP_RETENTION || 30));

app.use(cors());
app.use(express.json({ limit: '8mb' }));
app.get('/favicon.ico', (_req, res) => res.redirect('/assets/team-lucao-logo.png'));
app.use(express.static(ROOT_DIR));

function jsonError(res, err, fallback = 400) {
  return res.status(err.status || fallback).json({ ok: false, error: err.message || String(err) });
}

function moneyNumber(value) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

function positiveInt(value, fallback, min = 1, max = 30) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.round(parsed)));
}

function normalizeIsoDate(value, fallback = today()) {
  const raw = String(value || '').slice(0, 10);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (!match) return fallback;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return date.getUTCFullYear() === Number(match[1])
    && date.getUTCMonth() === Number(match[2]) - 1
    && date.getUTCDate() === Number(match[3]) ? raw : fallback;
}

function normalizeTime(value, fallback = '18:30') {
  const raw = String(value || '').slice(0, 5);
  const match = /^(\d{2}):(\d{2})$/.exec(raw);
  if (!match) return fallback;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  return hour <= 23 && minute <= 59 ? raw : fallback;
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
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
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

function addDaysIso(dateIso, days = 0) {
  const date = new Date(`${dateIso}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + Number(days || 0));
  return date.toISOString().slice(0, 10);
}

function addMonthsIso(dateIso, months = 1) {
  const date = dateIso ? new Date(`${dateIso}T12:00:00`) : new Date();
  date.setMonth(date.getMonth() + months);
  return date.toISOString().slice(0, 10);
}

function currentMonth() {
  return today().slice(0, 7);
}

function phoneDigits(value = '') {
  return String(value || '').replace(/\D/g, '');
}

function phoneSql() {
  return "REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(COALESCE(telefone, ''), '(', ''), ')', ''), '-', ''), ' ', ''), '+', '')";
}

function findStudentByPhone(value = '') {
  const digits = phoneDigits(value);
  if (digits.length < 8) {
    const err = new Error('Informe pelo menos 8 numeros do WhatsApp');
    err.status = 400;
    throw err;
  }
  const key = digits.slice(-8);
  return row(`SELECT * FROM alunos WHERE ${phoneSql()} LIKE ? ORDER BY id DESC LIMIT 1`, [`%${key}`]);
}

function dueDateForMonth(student = {}, month = currentMonth()) {
  const [year, monthNumber] = String(month || currentMonth()).slice(0, 7).split('-').map(Number);
  const lastDay = new Date(year, monthNumber, 0).getDate();
  const dueDay = Math.min(31, Math.max(1, Number(student.dia_vencimento || 10) || 10));
  return `${year}-${String(monthNumber).padStart(2, '0')}-${String(Math.min(dueDay, lastDay)).padStart(2, '0')}`;
}

function studentPeriodEnd(student = {}, start = today()) {
  if (student.pago_ate) {
    return student.pago_ate >= start ? student.pago_ate : start;
  }
  const currentDueDate = dueDateForMonth(student, start.slice(0, 7));
  if (currentDueDate >= start) return currentDueDate;
  return dueDateForMonth(student, addMonthsIso(`${start.slice(0, 7)}-01`, 1).slice(0, 7));
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function backupStamp() {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, '0');
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}

function createBackup(prefix = 'backup_manual') {
  ensureDir(BACKUPS_DIR);
  const filename = `${prefix}_${backupStamp()}.json`;
  const snapshot = stateSnapshot({ includeLogs: true });
  fs.writeFileSync(path.join(BACKUPS_DIR, filename), JSON.stringify(snapshot, null, 2), 'utf8');
  pruneBackups();
  return { filename, snapshot };
}

function listBackups() {
  ensureDir(BACKUPS_DIR);
  return fs.readdirSync(BACKUPS_DIR)
    .filter((filename) => filename.endsWith('.json') && filename.startsWith('backup_'))
    .map((filename) => {
      const fullPath = path.join(BACKUPS_DIR, filename);
      const stat = fs.statSync(fullPath);
      return {
        filename,
        size: stat.size,
        created_at: stat.mtime.toISOString()
      };
    })
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

function pruneBackups() {
  const backups = listBackups();
  backups.slice(BACKUP_RETENTION).forEach((backup) => {
    fs.unlinkSync(path.join(BACKUPS_DIR, backup.filename));
  });
}

function scheduleAutomaticBackups() {
  if (AUTO_BACKUP_ON_START) {
    try {
      const backup = createBackup('backup_startup');
      console.log(`Backup inicial criado: ${backup.filename}`);
    } catch (err) {
      console.warn(`Falha ao criar backup inicial: ${err.message}`);
    }
  }
  if (AUTO_BACKUP_INTERVAL_HOURS > 0) {
    const ms = AUTO_BACKUP_INTERVAL_HOURS * 60 * 60 * 1000;
    setInterval(() => {
      try {
        const backup = createBackup('backup_auto');
        console.log(`Backup automatico criado: ${backup.filename}`);
      } catch (err) {
        console.warn(`Falha no backup automatico: ${err.message}`);
      }
    }, ms).unref();
  }
}

function requirePin(req, res, next) {
  if (!req.path.startsWith('/api/')) return next();
  if (req.path === '/api/login' || req.path.startsWith('/api/public/') || req.path === '/api/webhooks/pix' || (req.path === '/api/pix/config' && req.method === 'GET')) return next();
  const pin = String(req.get('x-admin-pin') || req.query.pin || '').trim();
  const validPins = new Set(['1209', '2222', '1111', ADMIN_PIN, TEACHER_PIN]);
  if (validPins.has(pin)) {
    req.userRole = 'admin'; // Unificado: 1 login com acesso a tudo
    return next();
  }
  return res.status(401).json({ ok: false, error: 'PIN invalido' });
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

function normalizeStudentPayload(body = {}) {
  const plan = body.plano_id ? row('SELECT * FROM planos WHERE id=?', [body.plano_id]) : null;
  const schedules = normalizeFixedSchedules(body);
  const primarySchedule = schedules[0] || {};
  return {
    nome: String(body.nome || body.name || '').trim(),
    telefone: String(body.telefone || body.phone || '').trim(),
    email: String(body.email || '').trim(),
    plano_id: plan?.id || body.plano_id || null,
    plano_nome: plan?.nome || body.plano_nome || body.plan || '',
    mensalidade: moneyNumber(plan?.preco ?? body.mensalidade ?? body.fee),
    dia_vencimento: Math.min(31, Math.max(1, Number(body.dia_vencimento || body.vencimento_dia || body.dueDay || 10) || 10)),
    status: String(body.status || 'Ativo'),
    nivel: String(body.nivel ?? body.level ?? '').trim(),
    dia_fixo: primarySchedule.dia || '',
    horario_fixo: primarySchedule.horario || '',
    turma_fixa: primarySchedule.turma || '',
    agendas_fixas: JSON.stringify(schedules),
    observacao: String(body.observacao || body.note || ''),
    pago_ate: String(body.pago_ate || body.paidUntil || '')
  };
}

function normalizeClassPayload(body = {}) {
  const plan = body.plano_id ? row('SELECT * FROM planos WHERE id=?', [body.plano_id]) : null;
  const extras = body.extra_presentes ?? body.extras ?? [];
  return {
    data: normalizeIsoDate(body.data || body.date || today()),
    horario: normalizeTime(body.horario || body.time || '18:30'),
    turma: String(body.turma || body.group || '').trim(),
    tipo: String(body.tipo || body.tipo_aula || body.type || 'Regular'),
    professor: String(body.professor || body.coach || '').trim(),
    plano_id: plan?.id || body.plano_id || null,
    plano_nome: plan?.nome || body.plano_nome || '',
    capacidade: positiveInt(body.capacidade || body.capacity, 8, 1, 30),
    status: String(body.status || 'Marcada'),
    valor_avulso: moneyNumber(body.valor_avulso),
    extras: typeof extras === 'string' ? extras : JSON.stringify(extras),
    observacao: String(body.observacao || body.note || '')
  };
}

function classWithStudents(item) {
  const students = rows(`
    SELECT aa.*, a.nome, a.telefone, a.plano_nome, a.status
    FROM aula_alunos aa
    JOIN alunos a ON a.id=aa.aluno_id
    WHERE aa.aula_id=?
    ORDER BY a.nome
  `, [item.id]);
  return {
    ...item,
    alunos: students,
    aluno_ids: students.map((student) => student.aluno_id),
    extra_presentes: parseJsonList(item.extras),
    presencas: students.reduce((acc, student) => ({ ...acc, [student.aluno_id]: Number(student.presente || 0) === 1 }), {})
  };
}

function parseJsonList(value) {
  try {
    const parsed = JSON.parse(value || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function upsertClassStudents(classId, studentIds = [], attendance = {}) {
  const cleanIds = [...new Set(studentIds.map(Number).filter(Boolean))];
  rows('SELECT aluno_id FROM aula_alunos WHERE aula_id=?', [classId]).forEach((item) => {
    if (!cleanIds.includes(Number(item.aluno_id))) run('DELETE FROM aula_alunos WHERE aula_id=? AND aluno_id=?', [classId, item.aluno_id]);
  });
  cleanIds.forEach((studentId) => {
    const present = attendance[String(studentId)] || attendance[studentId] ? 1 : 0;
    const existing = row('SELECT id FROM aula_alunos WHERE aula_id=? AND aluno_id=?', [classId, studentId]);
    if (existing) {
      run('UPDATE aula_alunos SET presente=? WHERE id=?', [present, existing.id]);
    } else {
      run('INSERT INTO aula_alunos (aula_id, aluno_id, presente) VALUES (?, ?, ?)', [classId, studentId, present]);
    }
  });
}

const ACTIVE_WAITLIST_STATUSES = ['Novo', 'Contatado', 'Experimental marcado'];

function waitlistPosition(classId, waitlistId) {
  return Number(scalar(`
    SELECT COUNT(*) AS total FROM lista_espera
    WHERE aula_id=? AND status IN (${ACTIVE_WAITLIST_STATUSES.map(() => '?').join(',')}) AND id<=?
  `, [classId, ...ACTIVE_WAITLIST_STATUSES, waitlistId], 0));
}

app.get('/', (_req, res) => res.sendFile(path.join(ROOT_DIR, 'index.html')));
app.get('/aluno', (_req, res) => res.sendFile(path.join(ROOT_DIR, 'aluno.html')));
app.get('/autorizar', (_req, res) => res.sendFile(path.join(ROOT_DIR, 'autorizar.html')));
app.get('/health', (_req, res) => res.json(publicState(stateSnapshot({ includeLogs: false }))));
app.get('/api/public/classes', (_req, res) => {
  const items = rows(`
    SELECT a.*,
      (SELECT COUNT(*) FROM aula_alunos aa WHERE aa.aula_id=a.id) AS inscritos,
      (SELECT COUNT(*) FROM lista_espera w WHERE w.aula_id=a.id AND w.status IN ('Novo', 'Contatado', 'Experimental marcado')) AS espera
    FROM aulas a
    WHERE a.status != 'Cancelada' AND a.data >= ?
    ORDER BY a.data, a.horario
    LIMIT 60
  `, [today()]).filter((item) => !isClassPast(item.data, item.horario)).slice(0, 40).map((item) => ({
    id: item.id,
    data: item.data,
    horario: item.horario,
    turma: item.turma,
    tipo: item.tipo,
    professor: item.professor,
    capacidade: item.capacidade,
    inscritos: item.inscritos,
    espera: item.espera
  }));
  res.json({ ok: true, items });
});
app.post('/api/public/bookings', (req, res) => {
  try {
    const classItem = row('SELECT * FROM aulas WHERE id=?', [req.body.aula_id]);
    if (!classItem) throw new Error('Aula nao encontrada');
    if (classItem.status === 'Cancelada' || isClassPast(classItem.data, classItem.horario)) {
      throw new Error('Essa aula ja passou ou nao esta disponivel');
    }
    const phone = phoneDigits(req.body.telefone || '');
    if (phone.length < 8) throw new Error('Informe pelo menos 8 numeros do WhatsApp');
    const existingStudent = findStudentByPhone(phone);
    if (existingStudent) {
      const alreadyConfirmed = row("SELECT id FROM aula_alunos WHERE aula_id=? AND aluno_id=? AND confirmado='sim'", [classItem.id, existingStudent.id]);
      if (alreadyConfirmed) throw new Error('Você já está confirmado nesta aula');
    }
    const duplicate = row(`
      SELECT id FROM agendamentos
      WHERE aula_id=? AND status IN ('Pendente', 'Aprovado') AND ${phoneSql()} LIKE ?
      LIMIT 1
    `, [classItem.id, `%${phone.slice(-8)}`]);
    if (duplicate) throw new Error('Ja existe um pedido para esse WhatsApp nessa aula');
    const currentCount = scalar('SELECT COUNT(*) AS total FROM aula_alunos WHERE aula_id=?', [classItem.id]);
    if (currentCount >= Number(classItem.capacidade || 8)) throw new Error('Aula lotada');
    const payload = {
      nome: String(req.body.nome || '').trim(),
      telefone: String(req.body.telefone || '').trim(),
      aula_id: Number(classItem.id),
      status: 'Pendente',
      observacao: String(req.body.observacao || '').trim()
    };
    if (!payload.nome) throw new Error('Informe seu nome');
    const result = insertRow('agendamentos', payload);
    logAction('Pedido de aula', `${payload.nome} solicitou vaga na aula ${classItem.horario} - ${classItem.turma || 'Turma'} em ${classItem.data}.`, 'Aluno');
    res.json({ ok: true, item: row('SELECT * FROM agendamentos WHERE id=?', [result.id]) });
  } catch (err) {
    jsonError(res, err);
  }
});
app.post('/api/public/waitlist', (req, res) => {
  try {
    const classId = Number(req.body.aula_id || req.body.class_id || 0);
    const classItem = row('SELECT * FROM aulas WHERE id=?', [classId]);
    if (!classItem) throw new Error('Aula nao encontrada');
    if (classItem.status === 'Cancelada') throw new Error('Aula cancelada');
    if (String(classItem.data || '') < today()) throw new Error('Essa aula ja passou');
    const phone = phoneDigits(req.body.telefone || '');
    if (phone.length < 8) throw new Error('Informe pelo menos 8 numeros do WhatsApp');
    const nome = String(req.body.nome || '').trim();
    if (!nome) throw new Error('Informe seu nome');
    const duplicate = row(`
      SELECT id FROM lista_espera
      WHERE aula_id=? AND status IN (${ACTIVE_WAITLIST_STATUSES.map(() => '?').join(',')})
        AND ${phoneSql()} LIKE ?
      LIMIT 1
    `, [classItem.id, ...ACTIVE_WAITLIST_STATUSES, `%${phone.slice(-8)}`]);
    if (duplicate) throw new Error('Voce ja esta na espera dessa aula');
    const enrolled = scalar('SELECT COUNT(*) AS total FROM aula_alunos WHERE aula_id=?', [classItem.id]);
    if (enrolled < Number(classItem.capacidade || 8)) throw new Error('Ainda existe vaga nessa aula');
    const payload = {
      nome,
      telefone: String(req.body.telefone || '').trim(),
      aula_id: classItem.id,
      preferencia: `${classItem.data} ${classItem.horario} - ${classItem.turma || 'Turma'}`,
      status: 'Novo',
      observacao: String(req.body.observacao || '').trim(),
      data_cadastro: today()
    };
    const result = insertRow('lista_espera', payload);
    const position = waitlistPosition(classItem.id, result.id);
    logAction('Entrada na espera', `${payload.nome} entrou na espera da aula ${classItem.horario} - ${classItem.turma || 'Turma'} em ${classItem.data}.`, 'Aluno');
    res.json({ ok: true, position, item: { ...row('SELECT * FROM lista_espera WHERE id=?', [result.id]), posicao: position } });
  } catch (err) {
    jsonError(res, err);
  }
});
app.get('/api/public/student-waitlist', (req, res) => {
  try {
    const phone = phoneDigits(req.query.telefone || req.query.phone || '');
    if (phone.length < 8) throw new Error('Informe pelo menos 8 numeros do WhatsApp');
    const items = rows(`
      SELECT w.id, w.aula_id, w.nome, w.telefone, w.status, w.observacao, w.data_cadastro,
        a.data AS aula_data, a.horario AS aula_horario, a.turma AS aula_turma,
        (SELECT COUNT(*) FROM lista_espera ahead
         WHERE ahead.aula_id=w.aula_id AND ahead.status IN ('Novo', 'Contatado', 'Experimental marcado') AND ahead.id<=w.id) AS posicao
      FROM lista_espera w
      LEFT JOIN aulas a ON a.id=w.aula_id
      WHERE w.status IN ('Novo', 'Contatado', 'Experimental marcado') AND ${phoneSql()} LIKE ?
      ORDER BY w.id DESC
    `, [`%${phone.slice(-8)}`]);
    res.json({ ok: true, items });
  } catch (err) {
    jsonError(res, err);
  }
});
app.get('/api/public/student-classes', (req, res) => {
  try {
    const informedPhone = req.query.telefone || req.query.phone || '';
    const student = findStudentByPhone(informedPhone);
    if (!student) throw new Error('Aluno nao encontrado para esse WhatsApp');
    const start = today();
    const periodEnd = studentPeriodEnd(student, start);

    // Auto-vinculo e aprovacao automatica de aulas para alunos com dia fixo ate periodEnd
    const fixedList = normalizeFixedSchedules(student);
    if (fixedList.length > 0 && student.status !== 'Pausado' && periodEnd >= start) {
      for (const fix of fixedList) {
        const matchingClasses = rows(`
          SELECT id, data, horario, turma FROM aulas
          WHERE status != 'Cancelada' AND data BETWEEN ? AND ?
            AND strftime('%w', data) = ?
            AND horario = ?
        `, [start, periodEnd, String(fix.dia), fix.horario]);

        for (const matchCls of matchingClasses) {
          const existing = row('SELECT id, confirmado FROM aula_alunos WHERE aula_id=? AND aluno_id=?', [matchCls.id, student.id]);
          if (!existing) {
            run(`
              INSERT INTO aula_alunos (aula_id, aluno_id, confirmado, confirmado_em, confirmado_professor, confirmado_professor_em, presente)
              VALUES (?, ?, 'sim', ?, 'sim', ?, 0)
            `, [matchCls.id, student.id, today(), today()]);
          } else if (existing.confirmado !== 'sim') {
            run("UPDATE aula_alunos SET confirmado='sim', confirmado_em=? WHERE id=?", [today(), existing.id]);
          }
        }
      }
    }

    const week = getWeekRange(req.query.semana || req.query.date || start);
    const plan = student.plano_id ? row('SELECT * FROM planos WHERE id=?', [student.plano_id]) : null;
    const weeklyQuota = getStudentWeeklyQuota(student, plan);

    const weeklyConfirmedCount = scalar(`
      SELECT COUNT(*) AS total
      FROM aula_alunos aa
      JOIN aulas a ON a.id=aa.aula_id
      WHERE aa.aluno_id=? AND aa.confirmado='sim' AND a.status != 'Cancelada'
        AND a.data BETWEEN ? AND ?
    `, [student.id, week.inicio, week.fim]) || 0;

    const weeklyClasses = rows(`
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
    `, [student.id, student.id, student.id, student.id, student.id, student.id, week.inicio, week.fim]).map((cls) => ({
      ...cls,
      vagas_disponiveis: Math.max(0, Number(cls.capacidade || 8) - Number(cls.inscritos || 0)),
      lotada: Number(cls.inscritos || 0) >= Number(cls.capacidade || 8) && !cls.vinculado
    }));

    const items = rows(`
      SELECT a.id, a.data, a.horario, a.turma, a.tipo, a.professor, a.capacidade, a.status,
        aa.confirmado, aa.confirmado_em, aa.confirmado_professor, aa.confirmado_professor_em, aa.presente,
        (SELECT COUNT(*) FROM aula_alunos WHERE aula_id=a.id) AS inscritos
      FROM aula_alunos aa
      JOIN aulas a ON a.id=aa.aula_id
      WHERE aa.aluno_id=? AND a.status != 'Cancelada' AND a.data BETWEEN ? AND ?
      ORDER BY a.data, a.horario
      LIMIT 60
    `, [student.id, start, periodEnd]);

    const available = rows(`
      SELECT a.id, a.data, a.horario, a.turma, a.tipo, a.professor, a.capacidade, a.status,
        (SELECT COUNT(*) FROM aula_alunos WHERE aula_id=a.id) AS inscritos,
        (SELECT COUNT(*) FROM lista_espera w WHERE w.aula_id=a.id AND w.status IN ('Novo', 'Contatado', 'Experimental marcado')) AS espera
      FROM aulas a
      WHERE a.status != 'Cancelada'
        AND LOWER(COALESCE(a.tipo, '')) NOT LIKE '%experimental%'
        AND a.data BETWEEN ? AND ?
        AND (SELECT COUNT(*) FROM aula_alunos WHERE aula_id=a.id) < COALESCE(a.capacidade, 8)
        AND NOT EXISTS (
          SELECT 1 FROM aula_alunos linked
          WHERE linked.aula_id=a.id AND linked.aluno_id=?
        )
      ORDER BY a.data, a.horario, a.turma
      LIMIT 60
    `, [start, periodEnd, student.id]).filter((item) => !isClassPast(item.data, item.horario));

    const phone = phoneDigits(informedPhone);
    const requests = phone.length >= 8 ? rows(`
      SELECT ag.id, ag.aula_id, ag.status, ag.criado_em, a.data, a.horario, a.turma, a.tipo
      FROM agendamentos ag JOIN aulas a ON a.id=ag.aula_id
      WHERE ag.status IN ('Pendente', 'Aprovado')
      AND REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(COALESCE(ag.telefone, ''), '(', ''), ')', ''), '-', ''), ' ', ''), '+', '') LIKE ?
      AND a.data BETWEEN ? AND ?
      AND NOT EXISTS (
        SELECT 1 FROM aula_alunos aa
        WHERE aa.aula_id=ag.aula_id AND aa.aluno_id=? AND aa.confirmado='sim'
      )
      ORDER BY a.data, a.horario
    `, [`%${phone.slice(-8)}`, start, periodEnd, student.id]) : [];

    const todayDate = today();
    const planDueDate = student.pago_ate || dueDateForMonth(student, currentMonth());
    const isExpired = todayDate > planDueDate;

    res.json({
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
    });
  } catch (err) {
    jsonError(res, err);
  }
});

app.get('/api/public/group-summary', (req, res) => {
  try {
    const todayStr = String(req.query.data || today()).slice(0, 10);
    const nowHour = new Date().getHours();
    const period = String(req.query.periodo || (nowHour < 13 ? 'manha' : 'tarde')).toLowerCase();
    const format = String(req.query.format || 'json').toLowerCase();

    const classes = rows(`
      SELECT * FROM aulas 
      WHERE data = ? AND status != 'Cancelada' 
      ORDER BY horario, turma
    `, [todayStr]);

    const activeClasses = period === 'tarde'
      ? classes.filter((c) => c.horario >= '12:00')
      : classes;

    const items = activeClasses.map((c) => {
      const links = rows(`
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

      return {
        id: c.id,
        horario: c.horario,
        turma: c.turma || 'Turma',
        tipo: c.tipo || 'Regular',
        capacidade: capacity,
        confirmados: confirmedCount,
        vagas_restantes: openSlots,
        lotada: openSlots === 0,
        nomes_confirmados: confirmedNames
      };
    });

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
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      return res.send(text);
    }

    res.json({
      ok: true,
      data: todayStr,
      periodo: period,
      total_aulas: items.length,
      texto: text,
      items
    });
  } catch (err) {
    jsonError(res, err);
  }
});

app.post('/api/public/student-confirm', (req, res) => {
  try {
    const student = findStudentByPhone(req.body.telefone || req.body.phone || '');
    if (!student) throw new Error('Aluno nao encontrado para esse WhatsApp');
    const classId = Number(req.body.aula_id || req.body.class_id || 0);
    const classItem = row('SELECT * FROM aulas WHERE id=?', [classId]);
    if (!classItem || classItem.status === 'Cancelada' || isClassPast(classItem.data, classItem.horario)) {
      throw new Error('Essa aula ja começou ou nao esta mais disponivel para confirmacao');
    }

    const responseValue = String(req.body.confirmado ?? req.body.confirmation ?? '').toLowerCase();
    const removeResponse = ['remover', 'remove', 'limpar'].includes(responseValue);
    const confirmValue = removeResponse ? '' : responseValue;
    if (!removeResponse && !['sim', 'nao'].includes(confirmValue)) throw new Error('Resposta invalida');

    const link = row('SELECT * FROM aula_alunos WHERE aula_id=? AND aluno_id=?', [classId, student.id]);

    if (confirmValue === 'sim') {
      const alreadyConfirmedThis = link && link.confirmado === 'sim';
      if (!alreadyConfirmedThis) {
        const enrolled = scalar('SELECT COUNT(*) FROM aula_alunos WHERE aula_id=?', [classId]);
        if (!link && enrolled >= Number(classItem.capacidade || 8)) {
          throw new Error('Essa aula ja atingiu a capacidade maxima de alunos');
        }

        const classWeek = getWeekRange(classItem.data);
        const plan = student.plano_id ? row('SELECT * FROM planos WHERE id=?', [student.plano_id]) : null;
        const quota = getStudentWeeklyQuota(student, plan);

        const currentConfirmedInWeek = scalar(`
          SELECT COUNT(*) AS total
          FROM aula_alunos aa
          JOIN aulas a ON a.id=aa.aula_id
          WHERE aa.aluno_id=? AND aa.confirmado='sim' AND a.status != 'Cancelada'
            AND a.data BETWEEN ? AND ?
            AND a.id != ?
        `, [student.id, classWeek.inicio, classWeek.fim, classId]) || 0;

        if (currentConfirmedInWeek >= quota) {
          throw new Error(`Limite do plano atingido: seu plano (${student.plano_nome || 'ativo'}) permite ${quota} ${quota === 1 ? 'aula' : 'aulas'} por semana. Voce ja confirmou ${currentConfirmedInWeek} aula(s) nesta semana. Desmarque uma aula para escolher este horario.`);
        }
      }
    }

    const now = new Date().toISOString();
    if (!link) {
      run(`
        INSERT INTO aula_alunos (aula_id, aluno_id, confirmado, confirmado_em, confirmado_professor, confirmado_professor_em, presente)
        VALUES (?, ?, ?, ?, '', '', 0)
      `, [classId, student.id, confirmValue, confirmValue ? now : '']);
    } else {
      run(`
        UPDATE aula_alunos
        SET confirmado=?,
            confirmado_em=?,
            confirmado_professor=?,
            confirmado_professor_em=?
        WHERE aula_id=? AND aluno_id=?
      `, [
        confirmValue,
        confirmValue ? now : '',
        confirmValue === 'sim' ? (link.confirmado_professor || '') : '',
        confirmValue === 'sim' ? (link.confirmado_professor_em || '') : '',
        classId,
        student.id
      ]);
    }

    if (confirmValue === 'sim') {
      run("UPDATE agendamentos SET status='Aprovado', respondido_em=? WHERE aula_id=? AND " + phoneSql() + " LIKE ?", [today(), classId, `%${phoneDigits(student.telefone).slice(-8)}`]);
    } else if (removeResponse) {
      run("UPDATE agendamentos SET status='Cancelado', respondido_em=? WHERE aula_id=? AND " + phoneSql() + " LIKE ?", [today(), classId, `%${phoneDigits(student.telefone).slice(-8)}`]);
    }

    logAction(removeResponse ? 'Resposta do aluno removida' : 'Confirmacao aluno', removeResponse
      ? `${student.nome} removeu a resposta da aula ${classItem?.horario || classId} - ${classItem?.turma || 'Turma'} em ${classItem?.data || ''}.`
      : `${student.nome} respondeu ${confirmValue} na aula ${classItem?.horario || classId} - ${classItem?.turma || 'Turma'} em ${classItem?.data || ''}.`, 'Aluno');

    res.json({ ok: true, removed: removeResponse, item: row('SELECT * FROM aula_alunos WHERE aula_id=? AND aluno_id=?', [classId, student.id]) });
  } catch (err) {
    jsonError(res, err);
  }
});
app.post('/api/login', (req, res) => {
  const pin = String(req.body.pin || '').trim();
  if (pin === ADMIN_PIN) {
    return res.json({ ok: true, role: 'admin', permissions: ['all'] });
  }
  if (pin === TEACHER_PIN) {
    return res.json({ ok: true, role: 'teacher', permissions: ['classes', 'attendance', 'students_view', 'waitlist'] });
  }
  return jsonError(res, new Error('PIN invalido'), 401);
});

app.use(requirePin);

app.get('/api/state', (_req, res) => res.json({ ok: true, state: stateSnapshot({ includeLogs: true }) }));
app.get('/api/bootstrap', (_req, res) => {
  const month = currentMonth();
  res.json({
    ok: true,
    items: {
      students: rows('SELECT * FROM alunos ORDER BY nome'),
      classes: rows('SELECT * FROM aulas ORDER BY data, horario, turma').map(classWithStudents),
      plans: rows('SELECT * FROM planos ORDER BY ativo DESC, preco, nome'),
      waitlist: rows(`
        SELECT w.*, a.data AS aula_data, a.horario AS aula_horario, a.turma AS aula_turma, a.status AS aula_status
        FROM lista_espera w
        LEFT JOIN aulas a ON a.id=w.aula_id
        ORDER BY w.id DESC
      `),
      payments: rows('SELECT p.*, a.nome AS aluno_nome FROM pagamentos p LEFT JOIN alunos a ON a.id=p.aluno_id WHERE referencia=? OR pago_em LIKE ? ORDER BY id DESC', [month, `${month}%`]),
      bookings: rows(`
        SELECT ag.*, a.data, a.horario, a.turma, a.tipo, a.capacidade,
          (SELECT COUNT(*) FROM aula_alunos aa WHERE aa.aula_id=ag.aula_id) AS inscritos
        FROM agendamentos ag
        LEFT JOIN aulas a ON a.id=ag.aula_id
        ORDER BY ag.status='Pendente' DESC, ag.id DESC
      `),
      logs: rows('SELECT * FROM logs ORDER BY id DESC LIMIT 80')
    }
  });
});
app.post('/api/sync', (_req, res) => res.json({ ok: true, state: stateSnapshot({ includeLogs: true }) }));
app.get('/api/backup.json', (_req, res) => res.json(stateSnapshot({ includeLogs: true })));

app.post('/api/backups/create', (_req, res) => {
  try {
    const backup = createBackup();
    res.json({ ok: true, filename: backup.filename, backups: listBackups() });
  } catch (err) {
    jsonError(res, err, 500);
  }
});

app.get('/api/backups', (_req, res) => {
  try {
    res.json({ ok: true, retention: BACKUP_RETENTION, items: listBackups() });
  } catch (err) {
    jsonError(res, err, 500);
  }
});

app.get('/api/backups/:filename', (req, res) => {
  try {
    const filename = path.basename(req.params.filename || '');
    if (!filename.endsWith('.json') || !filename.startsWith('backup_')) {
      const err = new Error('Backup invalido');
      err.status = 400;
      throw err;
    }
    const fullPath = path.join(BACKUPS_DIR, filename);
    if (!fs.existsSync(fullPath)) {
      const err = new Error('Backup nao encontrado');
      err.status = 404;
      throw err;
    }
    res.download(fullPath);
  } catch (err) {
    jsonError(res, err, 500);
  }
});

app.post('/api/import', (req, res) => {
  try {
    res.json(restoreState(req.body, req.query.mode || req.body.mode || 'merge'));
  } catch (err) {
    jsonError(res, err);
  }
});

app.get('/api/dashboard', (req, res) => {
  const date = String(req.query.date || today()).slice(0, 10);
  const month = String(req.query.month || currentMonth()).slice(0, 7);
  const classes = rows('SELECT * FROM aulas WHERE data=? ORDER BY horario, turma', [date]).map(classWithStudents);
  const pending = rows("SELECT * FROM alunos WHERE COALESCE(status, 'Ativo') != 'Pausado' AND (pago_ate IS NULL OR pago_ate < ?) ORDER BY nome", [today()]);
  const paid = row("SELECT COALESCE(SUM(valor), 0) AS total FROM pagamentos WHERE status='PAGO' AND pago_em LIKE ?", [`${month}%`])?.total || 0;
  const activeStudents = row("SELECT COUNT(*) AS total FROM alunos WHERE COALESCE(status, 'Ativo')='Ativo'")?.total || 0;
  res.json({
    ok: true,
    date,
    month,
    aulas: classes,
    pendencias: pending,
    stats: {
      aulas_hoje: classes.length,
      alunos_ativos: activeStudents,
      presencas_hoje: classes.reduce((sum, item) => sum + item.alunos.filter((student) => Number(student.presente) === 1).length, 0),
      pagamentos_pendentes: pending.length,
      faturamento_mes: paid
    }
  });
});

app.get('/api/students', (req, res) => {
  const search = String(req.query.search || '').trim();
  const params = [];
  let sql = 'SELECT * FROM alunos';
  if (search) {
    sql += ' WHERE nome LIKE ? OR telefone LIKE ? OR plano_nome LIKE ? OR nivel LIKE ?';
    params.push(...Array(4).fill(`%${search}%`));
  }
  sql += ' ORDER BY nome';
  res.json({ ok: true, items: rows(sql, params) });
});

app.get('/api/students/:id', (req, res) => {
  const student = row('SELECT * FROM alunos WHERE id=?', [req.params.id]);
  if (!student) return jsonError(res, new Error('Aluno não encontrado'), 404);
  return res.json({ ok: true, item: student });
});

app.post('/api/students', (req, res) => {
  try {
    const payload = normalizeStudentPayload(req.body);
    if (!payload.nome) throw new Error('Informe o nome do aluno');
    const result = insertRow('alunos', payload);
    const item = row('SELECT * FROM alunos WHERE id=?', [result.id]);
    logAction('Aluno cadastrado', `${item.nome} foi cadastrado no painel.`, 'Professor');
    res.json({ ...result, item });
  } catch (err) {
    jsonError(res, err);
  }
});

app.put('/api/students/:id', (req, res) => {
  try {
    const previous = row('SELECT * FROM alunos WHERE id=?', [req.params.id]);
    const payload = normalizeStudentPayload(req.body);
    if (!payload.nome) throw new Error('Informe o nome do aluno');
    updateRow('alunos', req.params.id, payload);
    const item = row('SELECT * FROM alunos WHERE id=?', [req.params.id]);
    if (previous?.pago_ate && !item.pago_ate) {
      logAction('Pagamento reaberto', `${item.nome} foi marcado como nao pago.`, 'Professor');
    } else {
      logAction('Aluno atualizado', `${item.nome} teve cadastro atualizado.`, 'Professor');
    }
    res.json({ ok: true, item });
  } catch (err) {
    jsonError(res, err);
  }
});

app.delete('/api/students/:id', (req, res) => {
  try {
    res.json(deleteRow('alunos', req.params.id));
  } catch (err) {
    jsonError(res, err);
  }
});

app.post('/api/students/:id/pay', (req, res) => {
  try {
    const student = row('SELECT * FROM alunos WHERE id=?', [req.params.id]);
    if (!student) throw new Error('Aluno não encontrado');
    const reference = String(req.body.referencia || '').slice(0, 7) || currentMonth();
    const monthDueDate = String(req.body.vencimento || dueDateForMonth(student, reference)).slice(0, 10);
    const paidUntil = student.pago_ate && student.pago_ate > monthDueDate ? student.pago_ate : monthDueDate;
    const value = moneyNumber(req.body.valor ?? student.mensalidade);
    const paidAt = String(req.body.pago_em || today()).slice(0, 10);
    const method = String(req.body.forma_pagamento || 'Pix').trim() || 'Pix';
    const note = String(req.body.observacao || 'Mensalidade marcada pelo painel').trim();
    run('UPDATE alunos SET pago_ate=? WHERE id=?', [paidUntil, student.id]);
    run('INSERT INTO pagamentos (aluno_id, referencia, valor, vencimento, pago_em, status, forma_pagamento, observacao) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [
      student.id,
      reference,
      value,
      monthDueDate,
      paidAt,
      'PAGO',
      method,
      note
    ]);
    logAction('Pagamento', `${student.nome} pago até ${paidUntil}.`, 'Professor');
    res.json({ ok: true, paidUntil, item: row('SELECT * FROM alunos WHERE id=?', [student.id]) });
  } catch (err) {
    jsonError(res, err);
  }
});

app.delete('/api/students/:id/pay', (req, res) => {
  try {
    const student = row('SELECT * FROM alunos WHERE id=?', [req.params.id]);
    if (!student) throw new Error('Aluno não encontrado');
    const reference = String(req.body?.referencia || req.query?.referencia || currentMonth()).slice(0, 7);
    run('DELETE FROM pagamentos WHERE aluno_id=? AND referencia=?', [student.id, reference]);
    run('UPDATE alunos SET pago_ate=? WHERE id=?', ['', student.id]);
    logAction('Pagamento desmarcado', `${student.nome} teve pagamento de ${reference} desmarcado.`, 'Professor');
    res.json({ ok: true, item: row('SELECT * FROM alunos WHERE id=?', [student.id]) });
  } catch (err) {
    jsonError(res, err);
  }
});

app.get('/api/classes', (req, res) => {
  const params = [];
  let sql = 'SELECT * FROM aulas WHERE 1=1';
  if (req.query.date) {
    sql += ' AND data=?';
    params.push(String(req.query.date).slice(0, 10));
  }
  sql += ' ORDER BY data, horario, turma';
  res.json({ ok: true, items: rows(sql, params).map(classWithStudents) });
});

app.post('/api/classes', (req, res) => {
  try {
    const payload = normalizeClassPayload(req.body);
    const studentIds = req.body.aluno_ids || req.body.studentIds || [];
    const result = insertRow('aulas', payload);
    upsertClassStudents(result.id, studentIds, req.body.presencas || req.body.attendance || {});
    const item = classWithStudents(row('SELECT * FROM aulas WHERE id=?', [result.id]));
    logAction('Aula criada', `${item.horario} - ${item.turma || 'Turma'} em ${item.data}.`, 'Professor');
    res.json({ ok: true, item });
  } catch (err) {
    jsonError(res, err);
  }
});

app.put('/api/classes/:id', (req, res) => {
  try {
    const payload = normalizeClassPayload(req.body);
    updateRow('aulas', req.params.id, payload);
    upsertClassStudents(req.params.id, req.body.aluno_ids || req.body.studentIds || [], req.body.presencas || req.body.attendance || {});
    const item = classWithStudents(row('SELECT * FROM aulas WHERE id=?', [req.params.id]));
    logAction('Aula atualizada', `${item.horario} - ${item.turma || 'Turma'} em ${item.data}.`, 'Professor');
    res.json({ ok: true, item });
  } catch (err) {
    jsonError(res, err);
  }
});

app.delete('/api/classes/:id', (req, res) => {
  try {
    res.json(deleteRow('aulas', req.params.id));
  } catch (err) {
    jsonError(res, err);
  }
});

app.put('/api/classes/:id/attendance', (req, res) => {
  try {
    const classItem = row('SELECT * FROM aulas WHERE id=?', [req.params.id]);
    if (!classItem) throw new Error('Aula não encontrada');
    const attendance = req.body.attendance || req.body.presencas || {};
    Object.entries(attendance).forEach(([studentId, present]) => {
      run('UPDATE aula_alunos SET presente=? WHERE aula_id=? AND aluno_id=?', [present ? 1 : 0, req.params.id, studentId]);
    });
    logAction('Presenca', `${classItem.horario} - ${classItem.turma || 'Turma'} em ${classItem.data} teve presencas atualizadas.`, 'Professor');
    res.json({ ok: true, item: classWithStudents(classItem) });
  } catch (err) {
    jsonError(res, err);
  }
});

app.post('/api/classes/:id/student-confirmation', (req, res) => {
  try {
    const classItem = row('SELECT * FROM aulas WHERE id=?', [req.params.id]);
    if (!classItem) throw new Error('Aula nao encontrada');
    const studentId = Number(req.body.student_id || req.body.aluno_id || 0);
    if (!studentId) throw new Error('Aluno invalido');
    const link = row('SELECT * FROM aula_alunos WHERE aula_id=? AND aluno_id=?', [classItem.id, studentId]);
    if (!link) throw new Error('Aluno nao esta vinculado a esta aula');
    if (link.confirmado !== 'sim') throw new Error('O aluno ainda nao indicou que vai');
    const student = row('SELECT * FROM alunos WHERE id=?', [studentId]);
    if (!student) throw new Error('Aluno nao encontrado');
    const action = String(req.body.action || 'approve').toLowerCase();
    if (!['approve', 'clear'].includes(action)) throw new Error('Acao invalida');
    const now = new Date().toISOString();
    run('UPDATE aula_alunos SET confirmado_professor=?, confirmado_professor_em=? WHERE aula_id=? AND aluno_id=?', [
      action === 'approve' ? 'sim' : '',
      action === 'approve' ? now : '',
      classItem.id,
      studentId
    ]);
    logAction(action === 'approve' ? 'Confirmacao professor' : 'Confirmacao professor removida', `${student.nome} ${action === 'approve' ? 'foi confirmado(a)' : 'deixou de estar confirmado(a)'} na aula ${classItem.horario} - ${classItem.turma || 'Turma'} em ${classItem.data}.`, 'Professor');
    res.json({ ok: true, item: classWithStudents(row('SELECT * FROM aulas WHERE id=?', [classItem.id])) });
  } catch (err) {
    jsonError(res, err);
  }
});

app.get('/api/quick/confirmations', (_req, res) => {
  const items = rows(`
    SELECT aa.aula_id, aa.aluno_id, aa.confirmado_em,
      a.data, a.horario, a.turma, a.tipo,
      s.nome AS aluno_nome
    FROM aula_alunos aa
    JOIN aulas a ON a.id=aa.aula_id
    JOIN alunos s ON s.id=aa.aluno_id
    WHERE aa.confirmado='sim'
      AND COALESCE(aa.confirmado_professor, '') != 'sim'
      AND a.status != 'Cancelada'
      AND a.data >= ?
    ORDER BY a.data, a.horario, s.nome
  `, [today()]);
  res.json({ ok: true, items });
});

app.get('/api/plans', (_req, res) => {
  res.json({ ok: true, items: rows('SELECT * FROM planos ORDER BY ativo DESC, preco, nome') });
});

app.get('/api/payments', (req, res) => {
  const month = String(req.query.month || currentMonth()).slice(0, 7);
  const payments = rows('SELECT p.*, a.nome AS aluno_nome FROM pagamentos p LEFT JOIN alunos a ON a.id=p.aluno_id WHERE referencia=? OR pago_em LIKE ? ORDER BY id DESC', [month, `${month}%`]);
  res.json({ ok: true, month, items: payments });
});

app.get('/api/bookings', (_req, res) => {
  const items = rows(`
    SELECT ag.*, a.data, a.horario, a.turma, a.tipo, a.capacidade,
      (SELECT COUNT(*) FROM aula_alunos aa WHERE aa.aula_id=ag.aula_id) AS inscritos
    FROM agendamentos ag
    LEFT JOIN aulas a ON a.id=ag.aula_id
    ORDER BY ag.status='Pendente' DESC, ag.id DESC
  `);
  res.json({ ok: true, items });
});

app.post('/api/bookings/:id/respond', (req, res) => {
  try {
    const booking = row('SELECT * FROM agendamentos WHERE id=?', [req.params.id]);
    if (!booking) throw new Error('Pedido nao encontrado');
    const classItem = classWithStudents(row('SELECT * FROM aulas WHERE id=?', [booking.aula_id]));
    if (!classItem) throw new Error('Aula nao encontrada');
    const action = String(req.body.action || '').toLowerCase();
    if (!['approve', 'reject'].includes(action)) throw new Error('Acao invalida');
    if (action === 'reject') {
      run("UPDATE agendamentos SET status='Recusado', respondido_em=? WHERE id=?", [today(), booking.id]);
      logAction('Pedido recusado', `${booking.nome} foi recusado na aula ${classItem.horario} - ${classItem.turma || 'Turma'} em ${classItem.data}.`, 'Professor');
      return res.json({ ok: true, item: row('SELECT * FROM agendamentos WHERE id=?', [booking.id]) });
    }
    const currentIds = classItem.aluno_ids || [];
    if (currentIds.length >= Number(classItem.capacidade || 8) && !req.body.force) throw new Error('Aula lotada');
    const digits = String(booking.telefone || '').replace(/\D/g, '');
    let student = digits
      ? row("SELECT * FROM alunos WHERE REPLACE(REPLACE(REPLACE(REPLACE(telefone, '(', ''), ')', ''), '-', ''), ' ', '') LIKE ?", [`%${digits.slice(-8)}`])
      : null;
    const isExperimental = String(booking.observacao || '').toLowerCase().includes('experimental')
      || String(booking.tipo || '').toLowerCase().includes('experimental')
      || String(classItem.turma || '').toLowerCase().includes('experimental');

    if (!student && isExperimental) {
      const inserted = insertRow('alunos', {
        nome: booking.nome,
        telefone: booking.telefone,
        status: 'Experimental',
        plano_nome: 'Experimental',
        nivel: 'Iniciante',
        observacao: `Aprovado para experimental em ${classItem.data} ${classItem.horario}`
      });
      student = row('SELECT * FROM alunos WHERE id=?', [inserted.id]);
    }

    if (student) {
      upsertClassStudents(classItem.id, [...currentIds, student.id], classItem.presencas || {});
    } else {
      const extras = parseJsonList(classItem.extras);
      extras.push({ id: `ag${booking.id}`, nome: booking.nome, tipo: isExperimental ? 'Experimental' : 'Solicitado', criado_em: today() });
      run('UPDATE aulas SET extras=? WHERE id=?', [JSON.stringify(extras), classItem.id]);
    }
    run("UPDATE agendamentos SET status='Aprovado', respondido_em=? WHERE id=?", [today(), booking.id]);
    logAction('Pedido aprovado', `${booking.nome} foi aprovado na aula ${classItem.horario} - ${classItem.turma || 'Turma'} em ${classItem.data}.`, 'Professor');
    return res.json({ ok: true, item: row('SELECT * FROM agendamentos WHERE id=?', [booking.id]) });
  } catch (err) {
    return jsonError(res, err);
  }
});

app.get('/api/waitlist', (_req, res) => {
  res.json({ ok: true, items: rows(`
    SELECT w.*, a.data AS aula_data, a.horario AS aula_horario, a.turma AS aula_turma, a.status AS aula_status
    FROM lista_espera w
    LEFT JOIN aulas a ON a.id=w.aula_id
    ORDER BY w.id DESC
  `) });
});

app.post('/api/waitlist', (req, res) => {
  try {
    const payload = {
      nome: String(req.body.nome || req.body.name || '').trim(),
      telefone: String(req.body.telefone || req.body.phone || '').trim(),
      aula_id: req.body.aula_id ? Number(req.body.aula_id) : null,
      preferencia: String(req.body.preferencia || '').trim(),
      status: String(req.body.status || 'Novo').trim(),
      observacao: String(req.body.observacao || '').trim(),
      data_cadastro: today()
    };
    if (!payload.nome) throw new Error('Informe o nome');
    const result = insertRow('lista_espera', payload);
    const item = row('SELECT * FROM lista_espera WHERE id=?', [result.id]);
    logAction('Interessado cadastrado', `${item.nome} entrou na lista de espera.`, 'Professor');
    res.json({ ...result, item });
  } catch (err) {
    jsonError(res, err);
  }
});

app.put('/api/waitlist/:id', (req, res) => {
  try {
    const payload = {
      nome: String(req.body.nome || '').trim(),
      telefone: String(req.body.telefone || '').trim(),
      preferencia: String(req.body.preferencia || '').trim(),
      status: String(req.body.status || 'Novo').trim(),
      observacao: String(req.body.observacao || '').trim()
    };
    if (Object.prototype.hasOwnProperty.call(req.body, 'aula_id')) payload.aula_id = req.body.aula_id ? Number(req.body.aula_id) : null;
    if (!payload.nome) throw new Error('Informe o nome');
    updateRow('lista_espera', req.params.id, payload);
    const item = row('SELECT * FROM lista_espera WHERE id=?', [req.params.id]);
    logAction('Espera atualizada', `${item.nome} mudou para ${item.status || 'Novo'}.`, 'Professor');
    res.json({ ok: true, item });
  } catch (err) {
    jsonError(res, err);
  }
});

app.delete('/api/waitlist/:id', (req, res) => {
  try {
    res.json(deleteRow('lista_espera', req.params.id));
  } catch (err) {
    jsonError(res, err);
  }
});

app.get('/api/availability', (_req, res) => {
  res.json({ ok: true, items: rows('SELECT * FROM disponibilidade ORDER BY dia') });
});

app.put('/api/availability', (req, res) => {
  try {
    (req.body.items || []).forEach((item) => {
      run('INSERT OR REPLACE INTO disponibilidade (dia, inicio, fim) VALUES (?, ?, ?)', [Number(item.dia), item.inicio, item.fim]);
    });
    logAction('Agenda', 'Disponibilidade atualizada.', 'Professor');
    res.json({ ok: true, items: rows('SELECT * FROM disponibilidade ORDER BY dia') });
  } catch (err) {
    jsonError(res, err);
  }
});

app.post('/api/logs', (req, res) => {
  try {
    const action = String(req.body.acao || req.body.action || '').trim();
    const detail = String(req.body.detalhe || req.body.detail || '').trim();
    const actor = String(req.body.ator || req.body.actor || 'Professor').trim();
    if (!action) throw new Error('Acao obrigatoria');
    logAction(action, detail, actor);
    res.json({ ok: true });
  } catch (err) {
    jsonError(res, err);
  }
});

app.get('/api/tables', (_req, res) => {
  res.json({ ok: true, tables: DATA_TABLES.map((table) => ({ table, columns: tableColumns(table) })) });
});

app.get('/api/tables/:table', (req, res) => {
  try {
    res.json(tableResponse(req.params.table, req.query));
  } catch (err) {
    jsonError(res, err);
  }
});

app.post('/api/tables/:table', (req, res) => {
  try {
    res.json(insertRow(req.params.table, req.body));
  } catch (err) {
    jsonError(res, err);
  }
});

app.put('/api/tables/:table/:id', (req, res) => {
  try {
    res.json(updateRow(req.params.table, req.params.id, req.body));
  } catch (err) {
    jsonError(res, err);
  }
});

app.delete('/api/tables/:table/:id', (req, res) => {
  try {
    res.json(deleteRow(req.params.table, req.params.id));
  } catch (err) {
    jsonError(res, err);
  }
});

app.post('/api/classes/:id/cancel-rain', (req, res) => {
  try {
    const classId = Number(req.params.id);
    const classItem = row('SELECT * FROM aulas WHERE id=?', [classId]);
    if (!classItem) throw new Error('Aula nao encontrada');

    run("UPDATE aulas SET status = 'Cancelada (Chuva)' WHERE id=?", [classId]);

    const enrolled = rows(`
      SELECT aa.aluno_id, a.nome, a.telefone, COALESCE(a.saldo_reposicoes, 0) as saldo
      FROM aula_alunos aa
      JOIN alunos a ON a.id = aa.aluno_id
      WHERE aa.aula_id = ?
    `, [classId]);

    const affected = [];
    for (const student of enrolled) {
      run('UPDATE alunos SET saldo_reposicoes = COALESCE(saldo_reposicoes, 0) + 1 WHERE id=?', [student.aluno_id]);
      affected.push({ id: student.aluno_id, nome: student.nome, novo_saldo: student.saldo + 1 });
    }

    const turmaDesc = `${classItem.horario} - ${classItem.turma || 'Turma'} (${classItem.data})`;
    logAction('Cancelamento por Chuva', `Aula ${turmaDesc} cancelada por chuva. +1 credito de reposicao concedido para ${affected.length} aluno(s).`, req.userRole === 'admin' ? 'Administrador' : 'Professor');

    const whatsappMsg = `🌧️ *Aviso de Chuva - Team Lucao*\n\nGalera, devido as condicoes climaticas/chuva, a aula de *${classItem.turma || 'Futevolei'}* de hoje (*${classItem.horario}*) foi *cancelada por chuva*.\n\n✅ Todos os ${affected.length} alunos previstos ganharam *+1 credito de reposicao* automatico no sistema para agendar em outra data!\n\nQualquer duvida, estamos a disposicao! ⚽👊`;

    res.json({
      ok: true,
      item: classWithStudents(row('SELECT * FROM aulas WHERE id=?', [classId])),
      mensagem: `Aula cancelada por chuva. ${affected.length} credito(s) de reposicao concedido(s).`,
      alunos_afetados: affected,
      whatsapp_msg: whatsappMsg
    });
  } catch (err) {
    jsonError(res, err);
  }
});

app.post('/api/pix/generate', (req, res) => {
  try {
    const studentId = Number(req.body.aluno_id || req.body.studentId || 0);
    const student = studentId ? row('SELECT * FROM alunos WHERE id=?', [studentId]) : null;
    const arena = row('SELECT * FROM arenas ORDER BY id LIMIT 1') || {};
    
    const amount = moneyNumber(req.body.valor ?? req.body.amount ?? student?.mensalidade ?? 220);
    const reference = String(req.body.referencia || currentMonth());
    const pixKey = String(arena.chave_pix || 'arena@futevolei.com.br');
    const arenaName = String(arena.nome || 'TEAM LUCAO ARENA');
    
    const pixCode = generatePixPayload({
      key: pixKey,
      name: arenaName,
      city: 'SOROCABA',
      amount: amount,
      txid: `TLF${studentId || 'AV'}${reference.replace('-', '')}`
    });

    res.json({
      ok: true,
      pix_code: pixCode,
      chave: pixKey,
      valor: amount,
      aluno_nome: student?.nome || 'Aluno Avulso',
      referencia: reference,
      expira_em_minutos: 60
    });
  } catch (err) {
    jsonError(res, err);
  }
});

app.post('/api/pix/simulate-payment', (req, res) => {
  try {
    const studentId = Number(req.body.aluno_id || req.body.studentId || 0);
    const student = row('SELECT * FROM alunos WHERE id=?', [studentId]);
    if (!student) throw new Error('Aluno nao encontrado');
    
    const reference = String(req.body.referencia || currentMonth());
    const amount = moneyNumber(req.body.valor ?? student.mensalidade);
    const monthDueDate = String(req.body.vencimento || dueDateForMonth(student, reference)).slice(0, 10);
    const paidUntil = student.pago_ate && student.pago_ate > monthDueDate ? student.pago_ate : monthDueDate;
    const paidAt = today();

    run('UPDATE alunos SET pago_ate=? WHERE id=?', [paidUntil, student.id]);
    run('INSERT INTO pagamentos (aluno_id, referencia, valor, vencimento, pago_em, status, forma_pagamento, observacao) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [
      student.id,
      reference,
      amount,
      monthDueDate,
      paidAt,
      'PAGO',
      'Pix Automatico',
      'Baixa automatica via Webhook Pix'
    ]);

    logAction('Pix Recebido', `Pagamento Pix de R$ ${amount.toFixed(2)} confirmado automaticamente para ${student.nome} (${reference}).`, 'Sistema');

    res.json({
      ok: true,
      mensagem: `Pagamento Pix de ${student.nome} confirmado com sucesso!`,
      paidUntil,
      student: row('SELECT * FROM alunos WHERE id=?', [student.id])
    });
  } catch (err) {
    jsonError(res, err);
  }
});

app.get('/api/pix/config', (_req, res) => {
  try {
    const arena = row('SELECT * FROM arenas ORDER BY id LIMIT 1') || {};
    res.json({
      ok: true,
      chave_pix: arena.chave_pix || '',
      tipo_chave: arena.tipo_chave_pix || 'telefone',
      beneficiario: arena.responsavel || arena.nome || 'Team Lucão Futevôlei',
      cidade: 'Sorocaba'
    });
  } catch (err) {
    jsonError(res, err);
  }
});

app.post('/api/pix/config', (req, res) => {
  try {
    const chave = String(req.body.chave_pix || req.body.chave || '').trim();
    const tipo = String(req.body.tipo_chave || req.body.tipo || 'telefone').trim();
    const beneficiario = String(req.body.beneficiario || req.body.responsavel || '').trim();
    const cidade = String(req.body.cidade || 'Sorocaba').trim();

    const arena = row('SELECT * FROM arenas ORDER BY id LIMIT 1');
    if (arena) {
      run('UPDATE arenas SET chave_pix=?, tipo_chave_pix=?, responsavel=COALESCE(?, responsavel) WHERE id=?', [
        chave, tipo, beneficiario || null, arena.id
      ]);
    } else {
      insertRow('arenas', {
        slug: 'team-lucao',
        nome: beneficiario || 'Team Lucão Futevôlei',
        responsavel: beneficiario || 'Lucão',
        chave_pix: chave,
        tipo_chave_pix: tipo
      });
    }
    logAction('Configuração Pix', `Chave Pix atualizada para ${chave} (${tipo}).`, 'Professor');
    res.json({ ok: true, chave_pix: chave, tipo_chave: tipo, beneficiario, cidade });
  } catch (err) {
    jsonError(res, err);
  }
});

app.post('/api/webhooks/pix', (req, res) => {
  try {
    const body = req.body || {};
    const pixItem = Array.isArray(body.pix) ? body.pix[0] : (body.pix || body);
    const txid = String(body.txid || body.txId || pixItem.txid || body.identificador || '').trim();
    const amount = moneyNumber(body.valor || body.value || body.amount || pixItem.valor || 0);
    let studentId = Number(body.aluno_id || body.studentId || body.alunoId || pixItem.aluno_id || 0);
    const phone = phoneDigits(body.telefone || body.phone || body.pagador?.telefone || body.payer?.phone || pixItem.telefone || pixItem.phone || pixItem.pagador?.telefone || pixItem.payer?.phone || '');
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
      student = row('SELECT * FROM alunos WHERE id=?', [studentId]);
    } else if (phone.length >= 8) {
      student = findStudentByPhone(phone);
    } else if (payerName) {
      student = row('SELECT * FROM alunos WHERE LOWER(TRIM(nome)) = ?', [payerName.toLowerCase()]);
    }

    if (!student) {
      logAction('Pix Webhook Pendente', `Pix de R$ ${amount.toFixed(2)} recebido (TxID: ${txid || 'N/A'}), mas nenhum aluno correspondente foi identificado.`, 'Sistema');
      return res.json({
        ok: true,
        received: true,
        status: 'PENDENTE_CONCILIACAO',
        mensagem: 'Pagamento recebido. Aluno não identificado para baixa automática.'
      });
    }

    const finalAmount = amount > 0 ? amount : moneyNumber(student.mensalidade);
    const monthDueDate = String(req.body.vencimento || dueDateForMonth(student, reference)).slice(0, 10);
    const paidUntil = student.pago_ate && student.pago_ate > monthDueDate ? student.pago_ate : monthDueDate;
    const paidAt = today();

    run('UPDATE alunos SET pago_ate=? WHERE id=?', [paidUntil, student.id]);
    run('INSERT INTO pagamentos (aluno_id, referencia, valor, vencimento, pago_em, status, forma_pagamento, observacao) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [
      student.id,
      reference,
      finalAmount,
      monthDueDate,
      paidAt,
      'PAGO',
      'Pix Webhook',
      txid ? `TxID: ${txid}` : 'Baixa automática via Webhook Pix'
    ]);

    logAction('Pix Recebido', `Webhook Pix confirmou pagamento de R$ ${finalAmount.toFixed(2)} para ${student.nome} (${reference}).`, 'Sistema');

    return res.json({
      ok: true,
      received: true,
      status: 'CONFIRMADO',
      aluno_id: student.id,
      aluno_nome: student.nome,
      valor: finalAmount,
      referencia: reference,
      pago_ate: paidUntil,
      item: row('SELECT * FROM alunos WHERE id=?', [student.id])
    });
  } catch (err) {
    jsonError(res, err);
  }
});

app.get('/api/arenas', (_req, res) => {
  try {
    res.json({ ok: true, items: rows('SELECT * FROM arenas ORDER BY id') });
  } catch (err) {
    jsonError(res, err);
  }
});

app.get('/api/arenas/current', (_req, res) => {
  try {
    const arena = row('SELECT * FROM arenas ORDER BY id LIMIT 1') || {
      slug: 'team-lucao',
      nome: 'Team Lucão Futevôlei',
      responsavel: 'Lucão',
      chave_pix: 'lucao@futevolei.com.br'
    };
    res.json({ ok: true, arena });
  } catch (err) {
    jsonError(res, err);
  }
});

app.post('/api/arenas', (req, res) => {
  try {
    const nome = String(req.body.nome || '').trim();
    if (!nome) throw new Error('Nome da arena obrigatorio');
    const slug = String(req.body.slug || nome.toLowerCase().replace(/[^a-z0-9]+/g, '-')).trim();
    const result = insertRow('arenas', {
      slug,
      nome,
      responsavel: String(req.body.responsavel || '').trim(),
      telefone: String(req.body.telefone || '').trim(),
      chave_pix: String(req.body.chave_pix || '').trim(),
      cor_tema: String(req.body.cor_tema || '#0d9488').trim()
    });
    res.json({ ok: true, item: row('SELECT * FROM arenas WHERE id=?', [result.id]) });
  } catch (err) {
    jsonError(res, err);
  }
});

app.get('/api/db/download', (_req, res) => res.download(DB_PATH));

app.listen(PORT, () => {
  scheduleAutomaticBackups();
  console.log(`Team Lucão Futevôlei rodando em http://localhost:${PORT}`);
});
