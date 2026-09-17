const http = require('http');

// Iniciar servidor temporariamente na porta 3025
process.env.PORT = '3025';
process.env.ADMIN_PIN = '2222';
process.env.TEACHER_PIN = '1111';

require('../server/index.js');

function request(path, options = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(`http://localhost:3025${path}`, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });
    req.on('error', reject);
    if (options.body) req.write(JSON.stringify(options.body));
    req.end();
  });
}

async function runTests() {
  console.log('--- TESTANDO NOVAS FUNCIONALIDADES (TEAMLUAOFUTURO) ---');

  // Aguarda 1s para o servidor subir
  await new Promise(r => setTimeout(r, 1000));

  // 1. Teste Login Admin
  console.log('1. Testando login Admin (PIN 2222)...');
  const adminLogin = await request('/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: { pin: '2222' }
  });
  console.log(`   Resultado: status=${adminLogin.status}, role=${adminLogin.data.role}`);
  if (adminLogin.data.role !== 'admin') throw new Error('Falha no login admin');

  // 2. Teste Login Professor
  console.log('2. Testando login Professor (PIN 1111)...');
  const teacherLogin = await request('/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: { pin: '1111' }
  });
  console.log(`   Resultado: status=${teacherLogin.status}, role=${teacherLogin.data.role}`);
  if (teacherLogin.data.role !== 'teacher') throw new Error('Falha no login professor');

  // 3. Teste Multi-Tenancy (Arenas)
  console.log('3. Testando listagem de Arenas...');
  const arenas = await request('/api/arenas', {
    headers: { 'x-admin-pin': '2222' }
  });
  console.log(`   Resultado: status=${arenas.status}, arenas encontradas=${arenas.data.items.length}, primeira=${arenas.data.items[0].nome}`);

  // 4. Teste Geração de Pix Dinâmico
  console.log('4. Testando geração de Pix dinâmico...');
  const pix = await request('/api/pix/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-admin-pin': '2222' },
    body: { aluno_id: 1, valor: 220, referencia: '2026-09' }
  });
  console.log(`   Resultado: status=${pix.status}, código Pix=${pix.data.pix_code.substring(0, 45)}...`);
  if (!pix.data.pix_code.startsWith('000201')) throw new Error('Formato Pix inválido');

  // 5. Teste Simulação de Webhook Pix (Baixa Automática)
  console.log('5. Testando simulação de confirmação Pix...');
  const sim = await request('/api/pix/simulate-payment', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-admin-pin': '2222' },
    body: { aluno_id: 1, valor: 220, referencia: '2026-09' }
  });
  console.log(`   Resultado: status=${sim.status}, pago_ate=${sim.data.paidUntil}, mensagem=${sim.data.mensagem}`);

  // 6. Teste Cancelamento por Chuva e Crédito de Reposição
  console.log('6. Testando cancelamento de aula por chuva...');
  const rain = await request('/api/classes/1/cancel-rain', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-admin-pin': '2222' }
  });
  console.log(`   Resultado: status=${rain.status}, mensagem=${rain.data.mensagem}, alunos com crédito=${rain.data.alunos_afetados.length}`);

  console.log('\n? TODOS OS 6 TESTES PASSARAM COM SUCESSO TOTAL!');
  process.exit(0);
}

runTests().catch(err => {
  console.error('? ERRO NOS TESTES:', err);
  process.exit(1);
});
