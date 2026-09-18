const { spawn } = require('node:child_process');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const PORT = 3098;

async function test() {
  const server = spawn(process.execPath, ['server/index.js'], {
    cwd: ROOT,
    env: { ...process.env, PORT: String(PORT), DB_PATH: ':memory:' },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  await new Promise(r => setTimeout(r, 1500));

  try {
    // 1. Get students
    const resStudents = await fetch(`http://127.0.0.1:${PORT}/api/students`, {
      headers: { 'X-Admin-Pin': '1209' }
    });
    const studentsData = await resStudents.json();
    const student = studentsData.items[0];
    console.log('Testing student:', student.id, student.nome, 'pago_ate:', student.pago_ate);

    // 2. Mark paid via pay endpoint
    const resPay = await fetch(`http://127.0.0.1:${PORT}/api/students/${student.id}/pay`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Admin-Pin': '1209' },
      body: JSON.stringify({
        referencia: '2026-09',
        vencimento: '2026-09-10',
        valor: 260,
        forma_pagamento: 'Pix',
        observacao: 'Teste'
      })
    });
    const payData = await resPay.json();
    console.log('Pay result:', payData.ok, payData.paidUntil);

    // Check payments table
    const resPayments = await fetch(`http://127.0.0.1:${PORT}/api/payments`, {
      headers: { 'X-Admin-Pin': '1209' }
    });
    const paymentsData = await resPayments.json();
    console.log('Total payments in DB:', paymentsData.items.length);

    // 3. Now simulate markPaid in app.js: DELETE /api/students/:id/pay
    const resUnmark = await fetch(`http://127.0.0.1:${PORT}/api/students/${student.id}/pay`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', 'X-Admin-Pin': '1209' },
      body: JSON.stringify({ referencia: '2026-09' })
    });
    const unmarkData = await resUnmark.json();
    console.log('Unmark DELETE full data:', unmarkData);

    // Check payments table after unmark
    const resPaymentsAfter = await fetch(`http://127.0.0.1:${PORT}/api/payments`, {
      headers: { 'X-Admin-Pin': '1209' }
    });
    const paymentsDataAfter = await resPaymentsAfter.json();
    console.log('Total payments in DB after unmark:', paymentsDataAfter.items.length);

    // 4. Test student unmark (confirm: remover) on class
    const resClasses = await fetch(`http://127.0.0.1:${PORT}/api/classes`, {
      headers: { 'X-Admin-Pin': '1209' }
    });
    const classesData = await resClasses.json();
    const classItem = classesData.items.find(c => c.data >= '2026-09-17' && c.status !== 'Cancelada');
    console.log('Class item to test:', classItem?.id, classItem?.data, classItem?.horario);

    if (classItem) {
      // confirm
      const confRes = await fetch(`http://127.0.0.1:${PORT}/api/public/student-confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telefone: student.telefone, aula_id: classItem.id, confirmado: 'sim' })
      });
      console.log('Student confirm:', (await confRes.json()).ok);

      // check student-classes
      const lookup1 = await fetch(`http://127.0.0.1:${PORT}/api/public/student-classes?telefone=${student.telefone}`);
      const lookupData1 = await lookup1.json();
      console.log('Items in student-classes before unmark:', lookupData1.items.length);

      // now unmark (remover)
      const unconfRes = await fetch(`http://127.0.0.1:${PORT}/api/public/student-confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telefone: student.telefone, aula_id: classItem.id, confirmado: 'remover' })
      });
      console.log('Student unmark:', (await unconfRes.json()).ok);

      // check student-classes again
      const lookup2 = await fetch(`http://127.0.0.1:${PORT}/api/public/student-classes?telefone=${student.telefone}`);
      const lookupData2 = await lookup2.json();
      console.log('Items in student-classes after unmark:', lookupData2.items.length);
      console.log('Items content after unmark:', lookupData2.items.map(i => ({ id: i.id, confirmado: i.confirmado })));
    }

  } finally {
    server.kill();
  }
}

test().catch(console.error);
