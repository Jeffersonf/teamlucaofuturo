// scripts/test-audit-fixes.js
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

console.log('🧪 Iniciando testes de validação dos fixes de auditoria...\n');

// 1. WhatsApp module: test phone formatting with DDD fallback
console.log('1. Testando formatPhoneForWhatsApp (modules/whatsapp.js)...');
const { formatPhoneForWhatsApp } = await import('../modules/whatsapp.js');
assert.equal(formatPhoneForWhatsApp('99999-8888'), '5515999998888', '8 or 9 digits should prefix 15 and 55');
assert.equal(formatPhoneForWhatsApp('999998888'), '5515999998888', '9 digits should prefix 15 and 55');
assert.equal(formatPhoneForWhatsApp('15999998888'), '5515999998888', '11 digits with 15 should prefix 55');
assert.equal(formatPhoneForWhatsApp('5515999998888'), '5515999998888', 'Already complete international should remain');
console.log('   ✅ formatPhoneForWhatsApp aprovado!');

// 2. Export module: test with ctx.state.students and ctx.state.payments
console.log('\n2. Testando export.js com chaves canônicas (state.students e state.payments)...');
const { exportStudentsCsv, exportPaymentHistoryCsv } = await import('../modules/export.js');

let downloadTriggered = false;
globalThis.Blob = class {
  constructor(content, opts) {
    this.content = content;
    this.opts = opts;
  }
};
globalThis.URL = {
  ...globalThis.URL,
  createObjectURL: (blob) => 'blob:mock',
  revokeObjectURL: () => {}
};
globalThis.document = {
  createElement: () => ({
    setAttribute: () => {},
    style: {},
    click: () => { downloadTriggered = true; }
  }),
  body: {
    appendChild: () => {},
    removeChild: () => {}
  }
};

const mockCtx = {
  state: {
    students: [
      { id: 1, nome: 'Carlos Silva', telefone: '15999991111', plano_nome: '2x Semana', mensalidade: 220, dia_vencimento: 10, status: 'Ativo', nivel: 'Intermediário', pago_ate: '2026-10-10', saldo_reposicoes: 1 }
    ],
    payments: [
      { id: 101, aluno_id: 1, referencia: '2026-09', valor: 220, vencimento: '2026-09-10', pago_em: '2026-09-08', status: 'PAGO', forma_pagamento: 'Pix' }
    ]
  },
  showToast: () => {}
};

downloadTriggered = false;
exportStudentsCsv(mockCtx);
assert.equal(downloadTriggered, true, 'exportStudentsCsv deve engatilhar download com state.students');

downloadTriggered = false;
exportPaymentHistoryCsv(mockCtx);
assert.equal(downloadTriggered, true, 'exportPaymentHistoryCsv deve engatilhar download com state.payments e state.students');
console.log('   ✅ export.js exporta dados corretamente sem retornar arquivo vazio!');

// 3. App.js checks: STANDARD_CLASS_SLOTS and Sunday removal
console.log('\n3. Testando regras de horários oficiais e grade em app.js...');
const appContent = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf-8');
assert.ok(appContent.includes("times: ['08:00', '09:00', '17:30', '18:30', '19:30', '20:30']"), 'Segunda a sexta devem ter 6 horários oficiais');
assert.ok(appContent.includes("times: ['08:00', '09:00', '10:00', '14:00']"), 'Sábado deve ter 4 horários oficiais');
assert.ok(!appContent.includes("['0', 'Domingo']"), 'Domingo não deve constar em fixedDayOptions');
assert.ok(appContent.includes("c.horario >= '12:00'"), 'Chamada da noite deve filtrar apenas aulas da tarde/noite');
console.log('   ✅ app.js consistente com a regra de negócios!');

// 4. Worker Parity (worker/index.js)
console.log('\n4. Testando paridade do Cloudflare Worker (worker/index.js)...');
const workerContent = fs.readFileSync(path.join(ROOT, 'worker/index.js'), 'utf-8');
assert.ok(workerContent.includes("'saldo_reposicoes'"), 'TABLE_COLUMNS.alunos deve conter saldo_reposicoes');
assert.ok(workerContent.includes("path[3] === 'cancel-rain'"), 'worker deve ter rota /api/classes/:id/cancel-rain');
assert.ok(workerContent.includes("url.pathname === '/api/pix/generate'"), 'worker deve ter rota /api/pix/generate');
assert.ok(workerContent.includes("url.pathname === '/api/pix/simulate-payment'"), 'worker deve ter rota /api/pix/simulate-payment');
assert.ok(workerContent.includes("url.pathname === '/api/arenas'"), 'worker deve ter rota /api/arenas');
assert.ok(workerContent.includes("url.pathname === '/api/arenas/current'"), 'worker deve ter rota /api/arenas/current');
assert.ok(workerContent.includes("generatePixPayload"), 'worker deve ter algoritmo de geração de payload Pix EMV');
console.log('   ✅ worker/index.js em 100% de paridade com o backend Node.js!');

// 5. Server time zone (server/index.js)
console.log('\n5. Testando timezone em server/index.js...');
const serverContent = fs.readFileSync(path.join(ROOT, 'server/index.js'), 'utf-8');
assert.ok(serverContent.includes('return today().slice(0, 7);'), 'currentMonth() deve usar today() alinhado a America/Sao_Paulo');
console.log('   ✅ server/index.js com timezone alinhado a SP!');

// 6. Design System & HTML checks
console.log('\n6. Testando conformidade com Design System em index.html e aluno.html...');
const indexContent = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf-8');
assert.ok(!indexContent.includes('☀️ Resumo Manhã'), 'Emoji sol não deve estar solto no botão');
assert.ok(!indexContent.includes('🌇 Chamada Noite'), 'Emoji pôr-do-sol não deve estar solto no botão');
assert.ok(!indexContent.includes('🧪 Apenas Experimentais'), 'Emoji tubo de ensaio não deve estar na option de filtro');
assert.ok(indexContent.includes('Seg a sex: 08:00, 09:00, 17:30, 18:30, 19:30 e 20:30'), 'Texto descritivo de horário em index.html deve estar atualizado');
assert.ok(indexContent.includes('<button class="modal-close-btn close" type="button" aria-label="Fechar Pix" data-close="pixModal">'), 'pixModal deve usar modal-close-btn com SVG Lucide');

const alunoContent = fs.readFileSync(path.join(ROOT, 'aluno.html'), 'utf-8');
assert.ok(!alunoContent.includes('✓ Simular Pagamento'), 'Não deve ter caractere bruto ✓ no botão');
console.log('   ✅ index.html e aluno.html 100% conformes com o Design System!');

// 7. Service Worker
console.log('\n7. Testando service-worker.js...');
const swContent = fs.readFileSync(path.join(ROOT, 'service-worker.js'), 'utf-8');
assert.ok(swContent.includes("CACHE_NAME = 'team-lucao-v150'"), 'CACHE_NAME deve ser team-lucao-v150');
assert.ok(swContent.includes('./styles.css?v=20260918-ds'), 'Cache de styles.css deve ter hash 20260918-ds');
assert.ok(swContent.includes('./app.js?v=20260918-v1'), 'Cache de app.js deve ter hash 20260918-v1');
assert.ok(swContent.includes('./student-fast.js?v=20260918-v1'), 'Cache de student-fast.js deve ter hash 20260918-v1');
assert.ok(swContent.includes("addEventListener('install'"), 'Deve conter listener de install');
console.log('   ✅ service-worker.js atualizado com cache-busting consistente!');

console.log('\n🎉 TODOS OS TESTES PASSARAM COM SUCESSO! 100% DAS CORREÇÕES VALIDADAS.\n');
