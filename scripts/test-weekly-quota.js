const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const PORT = 4399;
const DB_PATH = path.join(ROOT, 'tmp-quota-test.db');
const BASE = `http://127.0.0.1:${PORT}`;
const PIN = '1209';

function cleanup() {
  [DB_PATH, `${DB_PATH}-shm`, `${DB_PATH}-wal`].forEach((f) => {
    try { fs.rmSync(f, { force: true }); } catch {}
  });
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function req(pathname, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.public ? {} : { 'X-Admin-Pin': PIN }),
    ...(options.headers || {})
  };
  const res = await fetch(`${BASE}${pathname}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.ok === false) {
    throw new Error(`${options.method || 'GET'} ${pathname}: ${data.error || res.statusText}`);
  }
  return data;
}

async function runTest() {
  cleanup();
  const server = spawn(process.execPath, ['server/index.js'], {
    cwd: ROOT,
    env: { ...process.env, DB_PATH, PORT: String(PORT), AUTO_BACKUP_ON_START: 'false' },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  try {
    // Wait for server
    let ready = false;
    for (let i = 0; i < 40; i++) {
      try {
        await fetch(`${BASE}/health`);
        ready = true;
        break;
      } catch {
        await wait(200);
      }
    }
    if (!ready) throw new Error('Server did not start');

    console.log('Server started for quota testing.');

    // 1. Create a student with 1x plan without specifying level
    const student1x = await req('/api/students', {
      method: 'POST',
      body: JSON.stringify({
        nome: 'Aluno Um Treino',
        telefone: '(15) 98888-1111',
        plano_nome: '1x semana',
        status: 'Ativo'
      })
    });
    console.log('Student created:', student1x.item.nome, '| Nivel:', JSON.stringify(student1x.item.nivel));
    if (student1x.item.nivel === 'Iniciante') {
      throw new Error('Nivel should NOT default to Iniciante!');
    }

    // 2. Create 3 classes in the same current week
    const today = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(new Date());

    const [y, m, d] = today.split('-').map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    const day = dt.getUTCDay();
    const daysToNextMon = ((8 - day) % 7) || 7;
    const d1 = new Date(Date.UTC(y, m - 1, d + daysToNextMon));
    monStr = d1.toISOString().slice(0, 10);
    d1.setUTCDate(d1.getUTCDate() + 1);
    tueStr = d1.toISOString().slice(0, 10);
    d1.setUTCDate(d1.getUTCDate() + 1);
    wedStr = d1.toISOString().slice(0, 10);

    const class1 = await req('/api/classes', {
      method: 'POST',
      body: JSON.stringify({ data: monStr, horario: '18:00', turma: 'Turma A', capacidade: 8, status: 'Marcada' })
    });
    const class2 = await req('/api/classes', {
      method: 'POST',
      body: JSON.stringify({ data: tueStr, horario: '19:00', turma: 'Turma B', capacidade: 8, status: 'Marcada' })
    });
    const class3 = await req('/api/classes', {
      method: 'POST',
      body: JSON.stringify({ data: wedStr, horario: '20:00', turma: 'Turma C', capacidade: 8, status: 'Marcada' })
    });

    console.log('Created 3 classes in week:', monStr, tueStr, wedStr);

    // 3. Student confirms class 1 (1x plan -> 1/1)
    const conf1 = await req('/api/public/student-confirm', {
      public: true,
      method: 'POST',
      body: JSON.stringify({ telefone: '988881111', aula_id: class1.item.id, confirmado: 'sim' })
    });
    console.log('Confirmation 1 succeeded:', conf1.ok);

    // Check student-classes output for quota
    const lookup1 = await req(`/api/public/student-classes?telefone=988881111&semana=${monStr}`, { public: true });
    console.log('Student lookup weekly quota:', lookup1.semana);
    if (lookup1.semana.limite !== 1 || lookup1.semana.confirmadas !== 1) {
      throw new Error(`Expected limite=1, confirmadas=1, got ${JSON.stringify(lookup1.semana)}`);
    }

    // 4. Student tries to confirm class 2 (should FAIL because quota = 1)
    let failedAsExpected = false;
    try {
      await req('/api/public/student-confirm', {
        public: true,
        method: 'POST',
        body: JSON.stringify({ telefone: '988881111', aula_id: class2.item.id, confirmado: 'sim' })
      });
    } catch (err) {
      failedAsExpected = true;
      console.log('Quota blocking succeeded as expected:', err.message);
      if (!err.message.includes('Limite do plano atingido')) {
        throw new Error('Error message did not mention plan limit');
      }
    }
    if (!failedAsExpected) throw new Error('Student on 1x plan was able to confirm 2 classes in the same week!');

    // 5. Student unconfirms class 1 -> now has 0
    await req('/api/public/student-confirm', {
      public: true,
      method: 'POST',
      body: JSON.stringify({ telefone: '988881111', aula_id: class1.item.id, confirmado: 'remover' })
    });
    const lookupAfterRemove = await req(`/api/public/student-classes?telefone=988881111&semana=${monStr}`, { public: true });
    console.log('Quota after remove:', lookupAfterRemove.semana);
    if (lookupAfterRemove.semana.confirmadas !== 0) {
      throw new Error('Confirmadas should be 0 after remove');
    }

    // 6. Now student can confirm class 2
    const conf2 = await req('/api/public/student-confirm', {
      public: true,
      method: 'POST',
      body: JSON.stringify({ telefone: '988881111', aula_id: class2.item.id, confirmado: 'sim' })
    });
    console.log('Confirmation 2 succeeded after unconfirming class 1:', conf2.ok);

    // 7. Test 2x plan
    const student2x = await req('/api/students', {
      method: 'POST',
      body: JSON.stringify({
        nome: 'Aluno Dois Treinos',
        telefone: '(15) 98888-2222',
        plano_nome: '2x semana',
        status: 'Ativo'
      })
    });
    // Can confirm 2 classes:
    await req('/api/public/student-confirm', {
      public: true,
      method: 'POST',
      body: JSON.stringify({ telefone: '988882222', aula_id: class1.item.id, confirmado: 'sim' })
    });
    await req('/api/public/student-confirm', {
      public: true,
      method: 'POST',
      body: JSON.stringify({ telefone: '988882222', aula_id: class2.item.id, confirmado: 'sim' })
    });
    const lookup2x = await req(`/api/public/student-classes?telefone=988882222&semana=${monStr}`, { public: true });
    console.log('Student 2x quota:', lookup2x.semana);
    if (lookup2x.semana.limite !== 2 || lookup2x.semana.confirmadas !== 2) {
      throw new Error(`Expected limite=2, confirmadas=2, got ${JSON.stringify(lookup2x.semana)}`);
    }

    // 3rd confirmation must fail
    let failed2x = false;
    try {
      await req('/api/public/student-confirm', {
        public: true,
        method: 'POST',
        body: JSON.stringify({ telefone: '988882222', aula_id: class3.item.id, confirmado: 'sim' })
      });
    } catch (err) {
      failed2x = true;
      console.log('2x quota blocking succeeded:', err.message);
    }
    if (!failed2x) throw new Error('Student on 2x plan was able to confirm 3 classes!');

    console.log('ALL WEEKLY PLAN QUOTA TESTS PASSED SUCCESSFULLY!');
  } finally {
    server.kill();
    cleanup();
  }
}

runTest().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
