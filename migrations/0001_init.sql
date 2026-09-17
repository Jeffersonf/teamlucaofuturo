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
  observacao TEXT DEFAULT '',
  pago_ate TEXT DEFAULT '',
  data_cadastro TEXT DEFAULT (date('now'))
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
  confirmado_professor TEXT DEFAULT '',
  confirmado_professor_em TEXT DEFAULT '',
  observacao TEXT DEFAULT '',
  UNIQUE(aula_id, aluno_id)
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
  observacao TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS agendamentos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL,
  telefone TEXT,
  aula_id INTEGER NOT NULL,
  status TEXT DEFAULT 'Pendente',
  observacao TEXT DEFAULT '',
  criado_em TEXT DEFAULT (date('now')),
  respondido_em TEXT DEFAULT ''
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
  data_cadastro TEXT DEFAULT (date('now'))
);

CREATE TABLE IF NOT EXISTS logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  data_hora TEXT,
  ator TEXT DEFAULT '',
  acao TEXT,
  detalhe TEXT
);

CREATE INDEX IF NOT EXISTS idx_aulas_data_horario ON aulas(data, horario);
CREATE INDEX IF NOT EXISTS idx_aula_alunos_aula ON aula_alunos(aula_id);
CREATE INDEX IF NOT EXISTS idx_aula_alunos_aluno ON aula_alunos(aluno_id);
CREATE INDEX IF NOT EXISTS idx_agendamentos_aula_status ON agendamentos(aula_id, status);
CREATE INDEX IF NOT EXISTS idx_alunos_telefone ON alunos(telefone);
CREATE INDEX IF NOT EXISTS idx_lista_espera_aula_status ON lista_espera(aula_id, status);

INSERT OR IGNORE INTO planos (id, nome, preco, aulas_semana, descricao, ativo) VALUES
  (1, '1x semana', 160, 1, 'Plano inicial', 1),
  (2, '2x semana', 220, 2, 'Mais ritmo e evolucao', 1),
  (3, 'Livre', 300, 4, 'Acesso amplo as turmas', 1),
  (4, 'Avulso', 60, 0, 'Aula avulsa', 1);

INSERT OR IGNORE INTO disponibilidade (dia, inicio, fim) VALUES
  (0, '07:00', '22:00'), (1, '07:00', '22:00'), (2, '07:00', '22:00'),
  (3, '07:00', '22:00'), (4, '07:00', '22:00'), (5, '07:00', '22:00'),
  (6, '07:00', '22:00');
