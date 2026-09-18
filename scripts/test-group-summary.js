const { spawn } = require('node:child_process');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const PORT = 3089;

async function run() {
  console.log('--- TESTANDO ENDPOINTS DE RESUMO PARA GRUPO WHATSAPP ---');
  const server = spawn(process.execPath, ['server/index.js'], {
    cwd: ROOT,
    env: { ...process.env, PORT: String(PORT), DB_PATH: ':memory:' },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  await new Promise((r) => setTimeout(r, 1600));

  try {
    // 1. Teste JSON Padrão (Manhã)
    console.log('[1] Testando GET /api/public/group-summary?periodo=manha (JSON)...');
    const resJson = await fetch(`http://127.0.0.1:${PORT}/api/public/group-summary?periodo=manha`);
    const dataJson = await resJson.json();
    console.log('Resposta JSON:', {
      ok: dataJson.ok,
      periodo: dataJson.periodo,
      total_aulas: dataJson.total_aulas,
      tem_texto: !!dataJson.texto
    });
    if (!dataJson.ok || dataJson.periodo !== 'manha') throw new Error('Falha no resumo de manhã JSON');

    // 2. Teste Formato Texto Puro (Para Atalhos do iPhone / MacroDroid)
    console.log('[2] Testando GET /api/public/group-summary?periodo=manha&format=text (Texto Puro)...');
    const resTextMorning = await fetch(`http://127.0.0.1:${PORT}/api/public/group-summary?periodo=manha&format=text`);
    const textMorning = await resTextMorning.text();
    console.log('Texto Manhã Prévia:\n', textMorning.slice(0, 180) + '...\n');
    if (!textMorning.includes('Bom dia, galera do Team Lucão!')) throw new Error('Texto da manhã incorreto');

    // 3. Teste Formato Texto Puro (Tarde / Noite)
    console.log('[3] Testando GET /api/public/group-summary?periodo=tarde&format=text (Texto Puro)...');
    const resTextEvening = await fetch(`http://127.0.0.1:${PORT}/api/public/group-summary?periodo=tarde&format=text`);
    const textEvening = await resTextEvening.text();
    console.log('Texto Tarde Prévia:\n', textEvening.slice(0, 180) + '...\n');
    if (!textEvening.includes('Chamada pros treinos de hoje à noite!')) throw new Error('Texto da tarde incorreto');

    console.log('>>> TODOS OS TESTES DO RESUMO PARA GRUPO PASSARAM COM SUCESSO! <<<');
  } finally {
    server.kill();
  }
}

run().catch((err) => {
  console.error('Erro no teste:', err);
  process.exit(1);
});
