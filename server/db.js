const crypto = require('node:crypto');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const ROOT_DIR = path.resolve(__dirname, '..');
const DB_PATH = process.env.DB_PATH || path.join(ROOT_DIR, 'arena.db');
const APP_ID = 'TeamLucaoFutevolei.AdminState';
const APP_VERSION = 1;

const DATA_TABLES = [
  'arenas',
  'alunos',
  'planos',
  'aulas',
  'aula_alunos',
  'pagamentos',
  'agendamentos',
  'disponibilidade',
  'lista_espera',
  'logs'
];

const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA foreign_keys = ON');
db.exec('PRAGMA journal_mode = WAL');

function rows(sql, params = []) {
  return db.prepare(sql).all(...params);
}

function row(sql, params = []) {
  return db.prepare(sql).get(...params) || null;
}

function run(sql, params = []) {
  return db.prepare(sql).run(...params);
}

function todayIso() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date());
}

function monthPrefix() {
  return todayIso().slice(0, 7);
}

function nowIso() {
  return new Date().toISOString();
}

function scalar(sql, params = [], fallback = 0) {
  const item = row(sql, params);
  if (!item) return fallback;
  const first = Object.keys(item)[0];
  return item[first] ?? fallback;
}

function tableExists(table) {
  return !!row("SELECT name FROM sqlite_master WHERE type='table' AND name=?", [table]);
}

function tableColumns(table) {
  return rows(`PRAGMA table_info(${table})`).map((col) => col.name);
}

function normalizeTable(table) {
  if (!DATA_TABLES.includes(table) || !tableExists(table)) {
    const err = new Error('Tabela não permitida');
    err.status = 404;
    throw err;
  }
  return table;
}

function inferLogActor(action = '', detail = '') {
  const text = `${action} ${detail}`.toLowerCase();
  if (text.includes('confirmacao aluno') || text.includes('solicitou aula')) return 'Aluno';
  if (text.includes('backup') || text.includes('importacao')) return 'Sistema';
  return 'Professor';
}

function logAction(action, detail = '', actor = '') {
  if (!tableExists('logs')) return;
  run('INSERT INTO logs (data_hora, ator, acao, detalhe) VALUES (?, ?, ?, ?)', [
    new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }),
    String(actor || inferLogActor(action, detail)),
    String(action || 'Sistema'),
    String(detail || '')
  ]);
}

function ensureSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS arenas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT UNIQUE NOT NULL,
      nome TEXT NOT NULL,
      responsavel TEXT DEFAULT '',
      telefone TEXT DEFAULT '',
      chave_pix TEXT DEFAULT '',
      tipo_chave_pix TEXT DEFAULT 'email',
      cor_tema TEXT DEFAULT '#0d9488',
      logo_url TEXT DEFAULT 'assets/team-lucao-logo.png',
      config_json TEXT DEFAULT '{}',
      criado_em TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS alunos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      telefone TEXT,
      email TEXT,
      plano_id INTEGER,
      plano_nome TEXT,
      mensalidade REAL DEFAULT 0,
      dia_vencimento INTEGER DEFAULT 10,
      status TEXT DEFAULT 'Ativo',
      nivel TEXT DEFAULT 'Iniciante',
      dia_fixo TEXT DEFAULT '',
      horario_fixo TEXT DEFAULT '',
      turma_fixa TEXT DEFAULT '',
      agendas_fixas TEXT DEFAULT '[]',
      observacao TEXT DEFAULT '',
      pago_ate TEXT DEFAULT '',
      data_cadastro TEXT DEFAULT (date('now')),
      FOREIGN KEY(plano_id) REFERENCES planos(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS planos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      preco REAL DEFAULT 0,
      aulas_semana INTEGER DEFAULT 1,
      descricao TEXT DEFAULT '',
      ativo INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS aulas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      data TEXT NOT NULL,
      horario TEXT NOT NULL,
      turma TEXT DEFAULT '',
      tipo TEXT DEFAULT 'Regular',
      professor TEXT DEFAULT '',
      plano_id INTEGER,
      plano_nome TEXT,
      capacidade INTEGER DEFAULT 8,
      status TEXT DEFAULT 'Marcada',
      valor_avulso REAL DEFAULT 0,
      extras TEXT DEFAULT '[]',
      observacao TEXT DEFAULT '',
      UNIQUE(data, horario, turma)
    );

    CREATE TABLE IF NOT EXISTS aula_alunos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      aula_id INTEGER NOT NULL,
      aluno_id INTEGER NOT NULL,
      presente INTEGER DEFAULT 0,
      confirmado TEXT DEFAULT '',
      confirmado_em TEXT DEFAULT '',
      observacao TEXT DEFAULT '',
      UNIQUE(aula_id, aluno_id),
      FOREIGN KEY(aula_id) REFERENCES aulas(id) ON DELETE CASCADE,
      FOREIGN KEY(aluno_id) REFERENCES alunos(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS pagamentos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      aluno_id INTEGER,
      referencia TEXT NOT NULL,
      valor REAL DEFAULT 0,
      vencimento TEXT DEFAULT '',
      pago_em TEXT DEFAULT '',
      status TEXT DEFAULT 'PENDENTE',
      forma_pagamento TEXT DEFAULT '',
      observacao TEXT DEFAULT '',
      FOREIGN KEY(aluno_id) REFERENCES alunos(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS agendamentos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      telefone TEXT,
      aula_id INTEGER NOT NULL,
      status TEXT DEFAULT 'Pendente',
      observacao TEXT DEFAULT '',
      criado_em TEXT DEFAULT (date('now')),
      respondido_em TEXT DEFAULT '',
      FOREIGN KEY(aula_id) REFERENCES aulas(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS disponibilidade (
      dia INTEGER PRIMARY KEY,
      inicio TEXT DEFAULT '07:00',
      fim TEXT DEFAULT '22:00'
    );

    CREATE TABLE IF NOT EXISTS lista_espera (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      telefone TEXT,
      aula_id INTEGER,
      preferencia TEXT,
      status TEXT DEFAULT 'Novo',
      observacao TEXT,
      data_cadastro TEXT DEFAULT (date('now')),
      FOREIGN KEY(aula_id) REFERENCES aulas(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      data_hora TEXT,
      ator TEXT DEFAULT '',
      acao TEXT,
      detalhe TEXT
    );
  `);

  const logColumns = tableColumns('logs');
  if (!logColumns.includes('ator')) {
    run("ALTER TABLE logs ADD COLUMN ator TEXT DEFAULT ''");
    run(`
      UPDATE logs
      SET ator = CASE
        WHEN LOWER(COALESCE(acao, '') || ' ' || COALESCE(detalhe, '')) LIKE '%confirmacao aluno%' THEN 'Aluno'
        WHEN LOWER(COALESCE(detalhe, '')) LIKE '%solicitou aula%' THEN 'Aluno'
        WHEN LOWER(COALESCE(acao, '') || ' ' || COALESCE(detalhe, '')) LIKE '%backup%' THEN 'Sistema'
        WHEN LOWER(COALESCE(acao, '') || ' ' || COALESCE(detalhe, '')) LIKE '%importacao%' THEN 'Sistema'
        ELSE 'Professor'
      END
      WHERE COALESCE(ator, '') = ''
    `);
  }

  const waitlistColumns = tableColumns('lista_espera');
  if (!waitlistColumns.includes('status')) {
    run("ALTER TABLE lista_espera ADD COLUMN status TEXT DEFAULT 'Novo'");
  }
  if (!waitlistColumns.includes('aula_id')) {
    run('ALTER TABLE lista_espera ADD COLUMN aula_id INTEGER');
  }

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_aulas_data_horario ON aulas(data, horario);
    CREATE INDEX IF NOT EXISTS idx_aula_alunos_aula ON aula_alunos(aula_id);
    CREATE INDEX IF NOT EXISTS idx_aula_alunos_aluno ON aula_alunos(aluno_id);
    CREATE INDEX IF NOT EXISTS idx_agendamentos_aula_status ON agendamentos(aula_id, status);
    CREATE INDEX IF NOT EXISTS idx_alunos_telefone ON alunos(telefone);
    CREATE INDEX IF NOT EXISTS idx_lista_espera_aula_status ON lista_espera(aula_id, status);
  `);

  const studentColumns = tableColumns('alunos');
  if (!studentColumns.includes('dia_vencimento')) {
    run('ALTER TABLE alunos ADD COLUMN dia_vencimento INTEGER DEFAULT 10');
  }
  if (!studentColumns.includes('dia_fixo')) {
    run("ALTER TABLE alunos ADD COLUMN dia_fixo TEXT DEFAULT ''");
  }
  if (!studentColumns.includes('horario_fixo')) {
    run("ALTER TABLE alunos ADD COLUMN horario_fixo TEXT DEFAULT ''");
  }
  if (!studentColumns.includes('turma_fixa')) {
    run("ALTER TABLE alunos ADD COLUMN turma_fixa TEXT DEFAULT ''");
  }
  if (!studentColumns.includes('agendas_fixas')) {
    run("ALTER TABLE alunos ADD COLUMN agendas_fixas TEXT DEFAULT '[]'");
  }

  const classColumns = tableColumns('aulas');
  if (!classColumns.includes('tipo')) {
    run("ALTER TABLE aulas ADD COLUMN tipo TEXT DEFAULT 'Regular'");
  }
  if (!classColumns.includes('extras')) {
    run("ALTER TABLE aulas ADD COLUMN extras TEXT DEFAULT '[]'");
  }

  const classStudentColumns = tableColumns('aula_alunos');
  if (!classStudentColumns.includes('confirmado')) {
    run("ALTER TABLE aula_alunos ADD COLUMN confirmado TEXT DEFAULT ''");
  }
  if (!classStudentColumns.includes('confirmado_em')) {
    run("ALTER TABLE aula_alunos ADD COLUMN confirmado_em TEXT DEFAULT ''");
  }
  if (!classStudentColumns.includes('confirmado_professor')) {
    run("ALTER TABLE aula_alunos ADD COLUMN confirmado_professor TEXT DEFAULT ''");
  }
  if (!classStudentColumns.includes('confirmado_professor_em')) {
    run("ALTER TABLE aula_alunos ADD COLUMN confirmado_professor_em TEXT DEFAULT ''");
  }

  if (!studentColumns.includes('saldo_reposicoes')) {
    run('ALTER TABLE alunos ADD COLUMN saldo_reposicoes INTEGER DEFAULT 0');
  }
  if (!studentColumns.includes('arena_id')) {
    run('ALTER TABLE alunos ADD COLUMN arena_id INTEGER DEFAULT 1');
  }

  ['aulas', 'planos', 'pagamentos', 'lista_espera'].forEach((table) => {
    if (tableExists(table)) {
      const cols = tableColumns(table);
      if (!cols.includes('arena_id')) {
        run(`ALTER TABLE ${table} ADD COLUMN arena_id INTEGER DEFAULT 1`);
      }
    }
  });

  const arenaCount = scalar('SELECT COUNT(*) AS total FROM arenas');
  if (!arenaCount) {
    run(`
      INSERT INTO arenas (slug, nome, responsavel, telefone, chave_pix, tipo_chave_pix, cor_tema, logo_url)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      'team-lucao',
      'Team Lucão Futevôlei',
      'Lucão',
      '(15) 99999-9999',
      'lucao@futevolei.com.br',
      'email',
      '#0d9488',
      'assets/team-lucao-logo.png'
    ]);
  }

  const plans = scalar('SELECT COUNT(*) AS total FROM planos');
  if (!plans) {
    run('INSERT INTO planos (nome, preco, aulas_semana, descricao) VALUES (?, ?, ?, ?)', ['1x semana', 160, 1, 'Plano inicial']);
    run('INSERT INTO planos (nome, preco, aulas_semana, descricao) VALUES (?, ?, ?, ?)', ['2x semana', 220, 2, 'Mais ritmo e evolução']);
    run('INSERT INTO planos (nome, preco, aulas_semana, descricao) VALUES (?, ?, ?, ?)', ['Livre', 300, 4, 'Acesso amplo as turmas']);
    run('INSERT INTO planos (nome, preco, aulas_semana, descricao) VALUES (?, ?, ?, ?)', ['Avulso', 60, 0, 'Aula avulsa']);
  }

  for (let day = 0; day < 7; day += 1) {
    run('INSERT OR IGNORE INTO disponibilidade (dia, inicio, fim) VALUES (?, ?, ?)', [day, '07:00', '22:00']);
  }

  const students = scalar('SELECT COUNT(*) AS total FROM alunos');
  if (!students) {
    const planOne = row('SELECT * FROM planos WHERE nome=?', ['2x semana']);
    const planTwo = row('SELECT * FROM planos WHERE nome=?', ['1x semana']);
    run('INSERT INTO alunos (nome, telefone, plano_id, plano_nome, mensalidade, status, nivel, observacao, pago_ate) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', [
      'Ana Souza', '(15) 99999-0001', planOne.id, planOne.nome, planOne.preco, 'Ativo', 'Intermediário', 'Prefere turma da noite', todayIso()
    ]);
    run('INSERT INTO alunos (nome, telefone, plano_id, plano_nome, mensalidade, status, nivel, observacao) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [
      'Bruno Lima', '(15) 99999-0002', planTwo.id, planTwo.nome, planTwo.preco, 'Experimental', 'Iniciante', 'Aula experimental'
    ]);
  }

  const classes = scalar('SELECT COUNT(*) AS total FROM aulas');
  if (!classes) {
    const result = run('INSERT INTO aulas (data, horario, turma, professor, capacidade, status, observacao) VALUES (?, ?, ?, ?, ?, ?, ?)', [
      todayIso(), '18:30', 'Iniciantes', 'Jefferson', 8, 'Marcada', 'Treino técnico'
    ]);
    const classId = Number(result.lastInsertRowid);
    rows('SELECT id FROM alunos ORDER BY id LIMIT 2').forEach((student, index) => {
      run('INSERT INTO aula_alunos (aula_id, aluno_id, presente) VALUES (?, ?, ?)', [classId, student.id, index === 0 ? 1 : 0]);
    });
  }
}

function stableChecksum(payload) {
  return crypto
    .createHash('sha256')
    .update(JSON.stringify(payload, (_key, value) => {
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        return Object.keys(value).sort().reduce((acc, key) => {
          acc[key] = value[key];
          return acc;
        }, {});
      }
      return value;
    }))
    .digest('hex');
}

function stateSnapshot({ includeLogs = true } = {}) {
  const tables = includeLogs ? DATA_TABLES : DATA_TABLES.filter((table) => table !== 'logs');
  const data = {};
  const counts = {};
  tables.forEach((table) => {
    data[table] = tableExists(table) ? rows(`SELECT * FROM ${table}`) : [];
    counts[table] = data[table].length;
  });
  const today = todayIso();
  const month = monthPrefix();
  const stats = {
    aulas_hoje: scalar("SELECT COUNT(*) AS total FROM aulas WHERE data=? AND status != 'Cancelada'", [today]),
    alunos_ativos: scalar("SELECT COUNT(*) AS total FROM alunos WHERE COALESCE(status, 'Ativo') = 'Ativo'"),
    presencas_hoje: scalar('SELECT COUNT(*) AS total FROM aula_alunos aa JOIN aulas a ON a.id=aa.aula_id WHERE a.data=? AND aa.presente=1', [today]),
    pagamentos_pendentes: scalar("SELECT COUNT(*) AS total FROM alunos WHERE COALESCE(status, 'Ativo') != 'Pausado' AND (pago_ate IS NULL OR pago_ate < ?)", [today]),
    faturamento_mes: scalar("SELECT COALESCE(SUM(valor), 0) AS total FROM pagamentos WHERE status='PAGO' AND pago_em LIKE ?", [`${month}%`])
  };
  const state = {
    app: APP_ID,
    version: APP_VERSION,
    exported_at: nowIso(),
    source: { runtime: 'node-express', db_type: 'sqlite', business: 'Team Lucão Futevôlei' },
    stats,
    counts,
    last_activity: includeLogs ? row('SELECT * FROM logs ORDER BY id DESC LIMIT 1') : null,
    data
  };
  state.checksum = stableChecksum({ ...state, checksum: undefined });
  return state;
}

function publicState(state) {
  return {
    ok: true,
    app: APP_ID,
    version: APP_VERSION,
    status: 'online',
    mode: 'server',
    runtime: 'node-express',
    db_type: 'sqlite',
    generated_at: state.exported_at,
    counts: state.counts,
    stats: state.stats,
    checksum: state.checksum
  };
}

function tableResponse(tableName, { limit = 100, offset = 0, search = '' } = {}) {
  const table = normalizeTable(tableName);
  const columns = tableColumns(table);
  const safeLimit = Math.min(Math.max(Number(limit) || 100, 1), 1000);
  const safeOffset = Math.max(Number(offset) || 0, 0);
  let sql = `SELECT * FROM ${table}`;
  const params = [];
  if (search && columns.length) {
    sql += ` WHERE ${columns.map((col) => `CAST(${col} AS TEXT) LIKE ?`).join(' OR ')}`;
    params.push(...columns.map(() => `%${search}%`));
  }
  sql += columns.includes('id') ? ' ORDER BY id DESC' : ` ORDER BY ${columns[0]}`;
  sql += ' LIMIT ? OFFSET ?';
  params.push(safeLimit, safeOffset);
  return { ok: true, table, columns, rows: rows(sql, params), total: scalar(`SELECT COUNT(*) AS total FROM ${table}`) };
}

function insertRow(tableName, payload = {}) {
  const table = normalizeTable(tableName);
  const columns = tableColumns(table).filter((col) => col !== 'id' && Object.prototype.hasOwnProperty.call(payload, col));
  if (!columns.length) {
    const err = new Error('Nenhum campo valido enviado');
    err.status = 400;
    throw err;
  }
  const result = run(`INSERT INTO ${table} (${columns.join(',')}) VALUES (${columns.map(() => '?').join(',')})`, columns.map((col) => payload[col]));
  return { ok: true, table, id: Number(result.lastInsertRowid) };
}

function updateRow(tableName, id, payload = {}) {
  const table = normalizeTable(tableName);
  const columns = tableColumns(table);
  const editable = columns.filter((col) => col !== 'id' && Object.prototype.hasOwnProperty.call(payload, col));
  if (!editable.length) {
    const err = new Error('Nenhum campo valido enviado');
    err.status = 400;
    throw err;
  }
  run(`UPDATE ${table} SET ${editable.map((col) => `${col}=?`).join(',')} WHERE id=?`, [...editable.map((col) => payload[col]), id]);
  return { ok: true, table, id: Number(id) };
}

function deleteRow(tableName, id) {
  const table = normalizeTable(tableName);
  run(`DELETE FROM ${table} WHERE id=?`, [id]);
  return { ok: true, table, id: Number(id) };
}

function restoreState(payload, mode = 'merge') {
  if (!payload || payload.app !== APP_ID || !payload.data || typeof payload.data !== 'object') {
    const err = new Error('Backup invalido');
    err.status = 400;
    throw err;
  }
  const imported = {};
  db.exec('BEGIN');
  try {
    if (mode === 'replace') {
      ['logs', 'aula_alunos', 'pagamentos', 'agendamentos', 'aulas', 'alunos', 'lista_espera', 'disponibilidade', 'planos'].forEach((table) => {
        if (tableExists(table)) run(`DELETE FROM ${table}`);
      });
    }
    for (const [table, tableRows] of Object.entries(payload.data)) {
      if (!DATA_TABLES.includes(table) || !Array.isArray(tableRows) || !tableExists(table)) continue;
      const columns = tableColumns(table);
      imported[table] = 0;
      tableRows.forEach((item) => {
        const clean = columns.filter((col) => Object.prototype.hasOwnProperty.call(item, col));
        if (!clean.length) return;
        run(`INSERT OR REPLACE INTO ${table} (${clean.join(',')}) VALUES (${clean.map(() => '?').join(',')})`, clean.map((col) => item[col]));
        imported[table] += 1;
      });
    }
    db.exec('COMMIT');
    logAction('Backup', `Importacao concluida em modo ${mode}.`, 'Sistema');
    return { ok: true, imported };
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

ensureSchema();

module.exports = {
  APP_ID,
  APP_VERSION,
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
};
