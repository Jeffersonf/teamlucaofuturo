const { spawn } = require('node:child_process');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const PORT = 3099;

async function runTest() {
  console.log('--- TESTE PIX WEBHOOK & CONFIG ---');
  const server = spawn(process.execPath, ['server/index.js'], {
    cwd: ROOT,
    env: { ...process.env, PORT: String(PORT), DB_PATH: ':memory:' },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  server.stderr.on('data', (d) => console.error('[server err]', d.toString()));

  await new Promise((r) => setTimeout(r, 1600));

  try {
    // 1. Test Pix Config GET
    console.log('[1] Testando GET /api/pix/config...');
    const resGetConfig = await fetch(`http://127.0.0.1:${PORT}/api/pix/config`);
    const dataGetConfig = await resGetConfig.json();
    console.log('GET config result:', dataGetConfig);
    if (!dataGetConfig.ok) throw new Error('GET /api/pix/config falhou');

    // 2. Test Pix Config POST
    console.log('[2] Testando POST /api/pix/config...');
    const resPostConfig = await fetch(`http://127.0.0.1:${PORT}/api/pix/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Admin-Pin': '1209' },
      body: JSON.stringify({
        chave_pix: '15999998888',
        tipo_chave: 'telefone',
        beneficiario: 'Team Lucao Arena',
        cidade: 'Sorocaba'
      })
    });
    const dataPostConfig = await resPostConfig.json();
    console.log('POST config result:', dataPostConfig);
    if (!dataPostConfig.ok || dataPostConfig.chave_pix !== '15999998888') {
      throw new Error('POST /api/pix/config falhou na atualizacao');
    }

    // 3. Obter um aluno existente
    console.log('[3] Buscando aluno para teste de webhook...');
    const resStudents = await fetch(`http://127.0.0.1:${PORT}/api/students`, {
      headers: { 'X-Admin-Pin': '1209' }
    });
    const dataStudents = await resStudents.json();
    const student = dataStudents.items?.[0];
    if (!student) throw new Error('Nenhum aluno encontrado para teste');
    console.log(`Aluno selecionado: ID=${student.id}, Nome=${student.nome}, Telefone=${student.telefone}`);

    // 4. Testar Webhook Pix com TxID padronizado TLF{id}...
    console.log('[4] Disparando POST /api/webhooks/pix via TxID...');
    const resWebhookTxid = await fetch(`http://127.0.0.1:${PORT}/api/webhooks/pix`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        txid: `TLF${student.id}202609`,
        valor: 260.00,
        horario: new Date().toISOString()
      })
    });
    const dataWebhookTxid = await resWebhookTxid.json();
    console.log('Webhook TxID result:', dataWebhookTxid);
    if (!dataWebhookTxid.ok || dataWebhookTxid.status !== 'CONFIRMADO' || dataWebhookTxid.aluno_id !== student.id) {
      throw new Error('POST /api/webhooks/pix por TxID falhou');
    }

    // 5. Verificar se o aluno teve seu pago_ate atualizado
    const resCheckStudent = await fetch(`http://127.0.0.1:${PORT}/api/students/${student.id}`, {
      headers: { 'X-Admin-Pin': '1209' }
    });
    const dataCheckStudent = await resCheckStudent.json();
    console.log('Aluno apos webhook:', dataCheckStudent.item.nome, 'pago_ate:', dataCheckStudent.item.pago_ate);
    if (!dataCheckStudent.item.pago_ate) {
      throw new Error('pago_ate do aluno nao foi atualizado pelo webhook');
    }

    // 6. Testar Webhook Pix com Telefone (formato BACEN/MercadoPago/Asaas)
    console.log('[5] Disparando POST /api/webhooks/pix via telefone do pagador...');
    const secondStudent = dataStudents.items[1] || student;
    const resWebhookPhone = await fetch(`http://127.0.0.1:${PORT}/api/webhooks/pix`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pix: [
          {
            txid: 'PIX998877665544',
            valor: 180.00,
            pagador: {
              nome: secondStudent.nome,
              telefone: secondStudent.telefone
            }
          }
        ]
      })
    });
    const dataWebhookPhone = await resWebhookPhone.json();
    console.log('Webhook Phone result:', dataWebhookPhone);
    if (!dataWebhookPhone.ok || dataWebhookPhone.status !== 'CONFIRMADO') {
      throw new Error('POST /api/webhooks/pix por telefone falhou');
    }

    // 7. Testar Webhook com pagador desconhecido
    console.log('[6] Disparando POST /api/webhooks/pix para pagador desconhecido...');
    const resWebhookUnknown = await fetch(`http://127.0.0.1:${PORT}/api/webhooks/pix`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        txid: 'UNKNOWN123',
        valor: 50.00,
        telefone: '1100000000'
      })
    });
    const dataWebhookUnknown = await resWebhookUnknown.json();
    console.log('Webhook Desconhecido result:', dataWebhookUnknown);
    if (!dataWebhookUnknown.ok || dataWebhookUnknown.status !== 'PENDENTE_CONCILIACAO') {
      throw new Error('POST /api/webhooks/pix para desconhecido deveria retornar PENDENTE_CONCILIACAO');
    }

    console.log('\n>>> TODOS OS TESTES DE PIX WEBHOOK & CONFIG PASSARAM COM SUCESSO! <<<\n');
  } finally {
    server.kill();
  }
}

runTest().catch((err) => {
  console.error('Falha no teste:', err);
  process.exit(1);
});
