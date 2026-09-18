// modules/export.js - Exportação de relatórios e dados para CSV / Excel
'use strict';

/**
 * Converte matriz de dados em arquivo CSV e dispara o download no navegador.
 * Utiliza codificação UTF-8 com BOM (\uFEFF) e separador ponto-e-vírgula (;)
 * para compatibilidade nativa imediata com o Microsoft Excel e Google Sheets no Brasil.
 *
 * @param {string} filename - Nome do arquivo (ex: mensalidades-2026-09.csv)
 * @param {string[]} headers - Títulos das colunas
 * @param {Array<Array<string|number>>} rows - Linhas de dados
 */
export function downloadCsv(filename, headers, rows) {
  const sanitizeCell = (val) => {
    if (val === null || val === undefined) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  const headerLine = headers.map(sanitizeCell).join(';');
  const dataLines = rows.map((row) => row.map(sanitizeCell).join(';'));
  const csvContent = '\uFEFF' + [headerLine, ...dataLines].join('\r\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function notifyToast(ctx, msg) {
  const fn = ctx?.toast || ctx?.showToast;
  if (typeof fn === 'function') {
    fn(msg);
  }
}

/**
 * Exporta as mensalidades do mês selecionado
 */
export function exportMonthlyPaymentsCsv(ctx, month) {
  const targetMonth = month || ctx.currentMonth();
  const students = ctx.sortedPaymentStudents(targetMonth);

  const headers = [
    'ID Aluno',
    'Nome do Aluno',
    'Telefone / WhatsApp',
    'Plano',
    'Valor Mensalidade (R$)',
    'Dia Vencimento',
    'Data Vencimento Mês',
    'Status Mensalidade',
    'Pago Até',
    'Situação no Mês'
  ];

  const rows = students.map((s) => {
    const isPaid = ctx.isPaidForMonth(s, targetMonth);
    const dueDate = ctx.dueDateForMonth(s, targetMonth);
    const urgency = ctx.paymentUrgency(s, targetMonth);
    const mensalidade = Number(s.mensalidade || 0).toFixed(2);

    return [
      s.id,
      s.nome || '',
      s.telefone || '',
      s.plano_nome || 'Sem plano',
      mensalidade,
      s.dia_vencimento || 10,
      dueDate,
      isPaid ? 'Pago' : 'Pendente',
      s.pago_ate || '',
      isPaid ? 'Em dia' : urgency.label
    ];
  });

  const filename = `mensalidades-team-lucao-${targetMonth}.csv`;
  downloadCsv(filename, headers, rows);
  notifyToast(ctx, `Arquivo ${filename} exportado com sucesso!`);
}

/**
 * Exporta a base completa de alunos
 */
export function exportStudentsCsv(ctx) {
  const students = ctx.state.students || ctx.state.alunos || [];

  const headers = [
    'ID',
    'Nome',
    'Telefone / WhatsApp',
    'Email',
    'Status',
    'Nível',
    'Plano',
    'Valor Mensalidade (R$)',
    'Dia Vencimento',
    'Pago Até',
    'Saldo Reposições',
    'Data Cadastro',
    'Observação'
  ];

  const rows = students.map((s) => [
    s.id,
    s.nome || '',
    s.telefone || '',
    s.email || '',
    s.status || 'Ativo',
    s.nivel || '',
    s.plano_nome || '',
    Number(s.mensalidade || 0).toFixed(2),
    s.dia_vencimento || 10,
    s.pago_ate || '',
    s.saldo_reposicoes || 0,
    s.data_cadastro || '',
    s.observacao || ''
  ]);

  const todayIso = new Date().toISOString().slice(0, 10);
  const filename = `alunos-team-lucao-${todayIso}.csv`;
  downloadCsv(filename, headers, rows);
  notifyToast(ctx, `Base de alunos exportada (${students.length} registros)!`);
}

/**
 * Exporta histórico de pagamentos realizados
 */
export function exportPaymentHistoryCsv(ctx) {
  const payments = ctx.state.payments || ctx.state.pagamentos || [];
  const students = ctx.state.students || ctx.state.alunos || [];
  const studentMap = new Map(students.map((s) => [s.id, s.nome]));

  const headers = [
    'ID Pagamento',
    'ID Aluno',
    'Nome do Aluno',
    'Mês Referência',
    'Valor (R$)',
    'Data Pagamento',
    'Data Vencimento',
    'Status',
    'Forma Pagamento',
    'Observação'
  ];

  const rows = payments.map((p) => [
    p.id || '',
    p.aluno_id || '',
    studentMap.get(p.aluno_id) || '',
    p.referencia || '',
    Number(p.valor || 0).toFixed(2),
    p.pago_em || '',
    p.vencimento || '',
    p.status || 'PAGO',
    p.forma_pagamento || 'Pix',
    p.observacao || ''
  ]);

  const todayIso = new Date().toISOString().slice(0, 10);
  const filename = `historico-pagamentos-${todayIso}.csv`;
  downloadCsv(filename, headers, rows);
  notifyToast(ctx, `Histórico de ${payments.length} pagamentos exportado!`);
}
