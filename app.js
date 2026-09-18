import { applyRoleUI, setStoredRole, getStoredRole, isTeacher } from './modules/roles.js';
import { cancelClassDueToRain } from './modules/rain.js';
import { openPixModal } from './modules/pix.js';
import { loadArenas } from './modules/arenas.js';
import { api, detectServer } from './modules/api.js';
import { showToast } from './modules/toast.js';
import { renderDashboard as renderDashboardModule, renderKpis as renderKpisModule, renderTodayClasses as renderTodayClassesModule, renderPending as renderPendingModule, renderDashboardActions as renderDashboardActionsModule, renderFocusStrip as renderFocusStripModule } from './modules/dashboard.js';
import { renderClasses as renderClassesModule, renderClassSummary as renderClassSummaryModule, renderClassesTodayPlanner as renderClassesTodayPlannerModule, renderClassCalendar as renderClassCalendarModule, openAttendance as openAttendanceModule } from './modules/classes.js';
import { renderStudents as renderStudentsModule, studentCard as studentCardModule, openStudent as openStudentModule, openStudentReport as openStudentReportModule } from './modules/students.js';
import { renderPayments as renderPaymentsModule, openDirectPix as openDirectPixModule, openPayment as openPaymentModule } from './modules/payments.js';
import { renderSettings as renderSettingsModule, syncSettingsForm as syncSettingsFormModule, readSettingsForm as readSettingsFormModule, updateSettingsPreview as updateSettingsPreviewModule, saveSettings as saveSettingsModule, resetSettingsForm as resetSettingsFormModule } from './modules/settings.js';
import { whatsappUrl, openWhatsApp, sendClassConfirmation, sendPixPaymentRequest, sendExperimentalWelcome, sendClassCancellationNotice, sendPaymentReceipt } from './modules/whatsapp.js';
import { exportMonthlyPaymentsCsv, exportStudentsCsv, exportPaymentHistoryCsv } from './modules/export.js';

'use strict';

const STORE_KEY = 'fv_school_state_v2';
const PIN_KEY = 'tlf_admin_pin';
const PAGE_KEY = 'tlf_last_page';
const CONFIG_KEY = 'tlf_admin_config_v1';
const ACTION_REFRESH_MS = 15000;
const STANDARD_CLASS_SLOTS = Object.freeze([
  { day: 1, label: 'Segunda', times: ['18:30', '19:30', '20:30'] },
  { day: 2, label: 'Terça', times: ['18:30', '19:30', '20:30'] },
  { day: 3, label: 'Quarta', times: ['18:30', '19:30', '20:30'] },
  { day: 4, label: 'Quinta', times: ['18:30', '19:30', '20:30'] },
  { day: 5, label: 'Sexta', times: ['18:30', '19:30', '20:30'] },
  { day: 6, label: 'Sábado', times: ['09:00', '10:00', '14:00', '15:00'] }
]);
const MOBILE_MORE_PAGES = ['bookings', 'actions', 'waitlist', 'plans', 'reports', 'settings'];
const PAGE_TITLES = {
  dashboard: ['operação de hoje', 'Painel do dia'],
  actions: ['histórico', 'Central de ações'],
  bookings: ['alunos', 'Pedidos de aula'],
  students: ['cadastro', 'Alunos'],
  classes: ['agenda', 'Aulas'],
  payments: ['financeiro', 'Mensalidades'],
  waitlist: ['demanda', 'Lista de espera'],
  plans: ['oferta', 'Planos'],
  reports: ['gestão', 'Relatórios'],
  more: ['atalhos', 'Mais'],
  settings: ['administração', 'Configuração']
};
const DEFAULT_APP_CONFIG = Object.freeze({
  brandName: 'Team Lucão',
  brandShort: 'Team Lucão',
  brandSubtitle: 'gestão da escola',
  dashboardEyebrow: 'operação de hoje',
  dashboardTitle: 'Painel do dia',
  actionsTitle: 'Central de ações',
  bookingsTitle: 'Pedidos de aula',
  studentsTitle: 'Alunos',
  classesTitle: 'Aulas',
  paymentsTitle: 'Mensalidades',
  waitlistTitle: 'Lista de espera',
  plansTitle: 'Planos',
  reportsTitle: 'Relatórios',
  onlineModeLabel: 'Servidor online',
  localModeLabel: 'Modo local',
  publicEyebrow: 'agenda da escola',
  publicTitle: 'Team Lucão',
  publicDescription: 'Aluno? Informe seu WhatsApp para confirmar presença. Ainda não é aluno? Solicite uma aula experimental.',
  loginEyebrow: 'acesso restrito',
  loginDescription: 'Painel rápido para organizar alunos, aulas e cobranças.',
  onlineNoticeTitle: 'Operação real',
  localNoticeTitle: 'Demo local',
  onlineNoticeText: 'Servidor ativo, dados compartilhados e backups disponíveis.',
  localNoticeText: 'Dados neste navegador. Para uso diário no iPhone, publique o servidor.'
});
const THEME_OPTIONS = Object.freeze([
  { id: 'dark', label: 'Sports Red (Oficial)', description: 'Dark Zinc Grafite com destaque Vermelho Esportivo.', swatches: ['#dc2626', '#18181b', '#09090b'] }
]);

function loadAppConfig() {
  try {
    const saved = JSON.parse(localStorage.getItem(CONFIG_KEY));
    return saved ? { ...DEFAULT_APP_CONFIG, ...saved } : { ...DEFAULT_APP_CONFIG };
  } catch {
    return { ...DEFAULT_APP_CONFIG };
  }
}

let appConfig = loadAppConfig();

const LIST_PAGE_SIZE = 24;
let lastModalTrigger = null;
const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const todayISO = () => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Sao_Paulo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit'
}).format(new Date());
const currentMonth = () => todayISO().slice(0, 7);
const selectedPaymentMonth = () => document.getElementById('paymentMonth')?.value || currentMonth();
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

function demoState() {
  const today = todayISO();
  const plans = [
    { id: 'p1', nome: '1x semana', preco: 180, aulas_semana: 1, descricao: 'Uma aula fixa por semana', ativo: 1 },
    { id: 'p2', nome: '2x semana', preco: 260, aulas_semana: 2, descricao: 'Duas aulas fixas por semana', ativo: 1 },
    { id: 'p3', nome: 'Livre', preco: 340, aulas_semana: 4, descricao: 'Acesso amplo as turmas', ativo: 1 },
    { id: 'p4', nome: 'Avulso', preco: 70, aulas_semana: 0, descricao: 'Aula avulsa ou reposicao', ativo: 1 }
  ];
  const names = [
    'Ana Souza', 'Bruno Lima', 'Carla Mendes', 'Diego Alves', 'Fernanda Rocha', 'Gustavo Nunes',
    'Helena Prado', 'Igor Martins', 'Julia Campos', 'Rafael Costa', 'Marina Lopes', 'Thiago Ferreira',
    'Larissa Pires', 'Caio Ribeiro', 'Bianca Moreira', 'Eduardo Santos', 'Patricia Almeida', 'Lucas Barros',
    'Isabela Gomes', 'Mateus Carvalho', 'Renata Duarte', 'Felipe Martins', 'Camila Nogueira', 'Andre Lopes',
    'Sofia Teixeira', 'Vitor Araujo', 'Leticia Freitas', 'Rodrigo Mello', 'Amanda Vieira', 'Pedro Henrique',
    'Natalia Ramos', 'Joao Victor', 'Luana Castro', 'Marcelo Dias', 'Beatriz Fonseca', 'Henrique Reis',
    'Priscila Moura', 'Daniel Batista', 'Laura Cunha', 'Murilo Rocha', 'Tatiane Cardoso', 'Ruan Oliveira',
    'Melissa Correia', 'Alex Silva', 'Barbara Tavares', 'Cesar Augusto', 'Vivian Leal', 'Samuel Pinto'
  ];
  const levels = ['Iniciante', 'Intermediario', 'Avancado', 'Kids'];
  const notes = ['Prefere turma da noite', 'Foco em fundamento', 'Veio por indicacao', 'Treina para torneio', 'Aula experimental marcada', '', 'Retorna no proximo mes', 'Costuma fazer avulso aos sabados'];
  const students = names.map((name, index) => {
    const plan = plans[index % plans.length];
    const paused = index % 17 === 0;
    const trial = index % 11 === 0;
    const pending = index % 6 === 0 || trial;
    return {
      id: `s${index + 1}`,
      nome: name,
      telefone: `(15) 991${String(110000 + index).slice(1)}`,
      email: '',
      plano_id: plan.id,
      plano_nome: plan.nome,
      mensalidade: plan.preco,
      dia_vencimento: (index % 4) * 5 + 5,
      status: paused ? 'Pausado' : trial ? 'Experimental' : 'Ativo',
      nivel: levels[index % levels.length],
      observacao: notes[index % notes.length],
      pago_ate: paused || pending ? '' : addMonthsIso(today, 1)
    };
  });
  const classTemplates = [
    ['Iniciantes', '18:30', 8],
    ['Intermediario', '19:30', 8],
    ['Kids', '20:30', 6],
    ['Avancado', '18:30', 8],
    ['Sabado livre', '09:00', 10],
    ['Experimental', '10:00', 8],
    ['Feminino iniciante', '14:00', 8],
    ['Treino competitivo', '15:00', 8]
  ];
  const classes = Array.from({ length: 24 }, (_item, index) => {
    const template = classTemplates[index % classTemplates.length];
    const dayOffset = Math.floor(index / 3);
    const enrolled = students
      .filter((student, studentIndex) => student.status !== 'Pausado' && studentIndex % classTemplates.length === index % classTemplates.length)
      .slice(0, template[2]);
    if (enrolled.length < 3) {
      enrolled.push(...students.filter((student) => student.status !== 'Pausado').slice(index % 10, (index % 10) + 4));
    }
    const alunoIds = [...new Set(enrolled.map((student) => student.id))].slice(0, template[2]);
    const presencas = {};
    alunoIds.forEach((id, presenceIndex) => {
      if (dayOffset <= 1) presencas[id] = presenceIndex % 4 !== 0;
    });
    return {
      id: `c${index + 1}`,
      data: addDaysIso(today, dayOffset),
      horario: template[1],
      turma: template[0],
      professor: index % 5 === 0 ? 'Professor convidado' : 'Lucao',
      tipo: index % 8 === 5 ? 'Experimental' : index % 8 === 4 ? 'Avulso' : 'Regular',
      capacidade: template[2],
      status: dayOffset === 0 ? 'Confirmada' : 'Marcada',
      aluno_ids: alunoIds,
      presencas,
      extra_presentes: dayOffset === 0 && index % 6 === 0 ? [{ id: `e${index}`, nome: ['Visitante Rafael', 'Reposicao da Laura', 'Aula teste Felipe'][index % 3], tipo: ['Visitante', 'Reposicao', 'Experimental'][index % 3], criado_em: today }] : []
    };
  });
  const payments = students.filter((student) => student.pago_ate).slice(0, 32).map((student, index) => ({
    id: `pay${index + 1}`,
    aluno_id: student.id,
    aluno_nome: student.nome,
    referencia: today.slice(0, 7),
    valor: student.mensalidade,
    vencimento: today,
    pago_em: addDaysIso(today, -(index % 8)),
    status: 'PAGO',
    forma_pagamento: index % 3 === 0 ? 'Pix' : index % 3 === 1 ? 'Cartao' : 'Dinheiro'
  }));
  const waitNames = ['Julia Moraes', 'Rafael Brito', 'Marina Lins', 'Otavio Sales', 'Paula Azevedo', 'Nicolas Farias', 'Clara Matos', 'Leandro Paiva', 'Monique Torres', 'Davi Campos', 'Erica Reis', 'Fabio Nascimento'];
  const waitlist = waitNames.map((name, index) => ({
    id: `w${index + 1}`,
    nome: name,
    telefone: `(15) 992${String(220000 + index).slice(1)}`,
    preferencia: ['Noite - iniciante', 'Sabado de manha', 'Kids', 'Experimental', 'Intermediario'][index % 5],
    status: index % 5 === 0 ? 'Convertido' : index % 3 === 0 ? 'Contatado' : 'Novo',
    observacao: ['Chamou pelo Instagram', 'Aguardando confirmar horario', 'Perguntou sobre valores', 'Indicacao de aluno'][index % 4],
    data_cadastro: addDaysIso(today, -index)
  }));
  const bookings = [
    { id: 'ag1', nome: 'Rafael Brito', telefone: '(15) 99222-0001', aula_id: classes[1]?.id, status: 'Pendente', observacao: 'Quer fazer experimental', criado_em: today, respondido_em: '' },
    { id: 'ag2', nome: 'Marina Lins', telefone: '(15) 99222-0002', aula_id: classes[4]?.id, status: 'Pendente', observacao: 'Reposicao de sabado', criado_em: today, respondido_em: '' },
    { id: 'ag3', nome: 'Julia Moraes', telefone: '(15) 99222-0003', aula_id: classes[2]?.id, status: 'Aprovado', observacao: 'Confirmada pelo professor', criado_em: addDaysIso(today, -1), respondido_em: today }
  ].filter((item) => item.aula_id);
  const logs = [
    { id: 'l1', data_hora: `${today}T12:01:00`, ator: 'Aluno', acao: 'Confirmacao aluno', detalhe: 'Marina Lopes confirmou presenca na aula Kids das 18:00.' },
    { id: 'l2', data_hora: `${today}T12:05:00`, ator: 'Professor', acao: 'Pagamento', detalhe: 'Ana Souza teve mensalidade marcada como paga.' },
    { id: 'l3', data_hora: `${today}T12:10:00`, ator: 'Aluno', acao: 'Pedido de aula', detalhe: 'Rafael Brito solicitou aula experimental.' },
    { id: 'l4', data_hora: `${today}T12:16:00`, ator: 'Professor', acao: 'Presenca', detalhe: 'Presencas atualizadas na turma Kids.' }
  ];
  return {
    students,
    plans,
    classes,
    payments,
    bookings,
    waitlist,
    logs
  };
}

let apiMode = false;
let state = loadLocalState();
let activeAttendanceClassId = '';
let publicStudentLookup = { telefone: '', student: null, items: [], available: [] };
let publicStudentWaitlist = [];
let publicStudentPendingBookings = new Set();
let publicApiAvailable = false;
let publicClassesCache = { items: [], expiresAt: 0, promise: null };
let actionRefreshTimer = null;
let renderFrame = 0;
let stateVersion = 0;
let indexVersion = -1;
let stateIndex = null;
let studentVisibleLimit = LIST_PAGE_SIZE;
let paymentVisibleLimit = LIST_PAGE_SIZE;
const scheduledUiWork = new Map();
const renderSignatures = new Map();

function loadLocalState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORE_KEY));
    return saved ? { ...demoState(), ...saved } : demoState();
  } catch {
    return demoState();
  }
}

function saveLocalState() {
  localStorage.setItem(STORE_KEY, JSON.stringify(state));
}

function touchState() {
  stateVersion += 1;
  stateIndex = null;
  renderSignatures.clear();
}

function buildStateIndex() {
  const students = state.students || [];
  const classes = state.classes || [];
  const payments = state.payments || [];
  const today = todayISO();
  const studentsById = new Map(students.map((student) => [String(student.id), student]));
  const plansById = new Map((state.plans || []).map((plan) => [String(plan.id), plan]));
  const classesById = new Map(classes.map((item) => [String(item.id), item]));
  const classesByDay = new Map();
  const paymentsByMonth = new Map();
  const attendanceByStudent = new Map();
  const classStudentsById = new Map();
  const weeklyAttendanceByStudent = new Map();
  const weeklyTargetByStudent = new Map();
  const attendanceHistoryByStudent = new Map();

  students.forEach((student) => {
    const plan = plansById.get(String(student.plano_id));
    const match = String(student.plano_nome || '').match(/(\d+)\s*x/i);
    weeklyTargetByStudent.set(String(student.id), plan ? Number(plan.aulas_semana || 0) : match ? Number(match[1]) : 0);
  });

  classes.forEach((item) => {
    const ids = classStudentIds(item);
    const enrolled = item.alunos || ids.map((id) => {
      const student = studentsById.get(String(id));
      if (!student) return null;
      return { ...student, confirmado: item.confirmacoes?.[id] || item.confirmacoes?.[String(id)] || '' };
    }).filter(Boolean);
    classStudentsById.set(String(item.id), enrolled);
    if (item.status !== 'Cancelada') {
      const list = classesByDay.get(item.data) || [];
      list.push(item);
      classesByDay.set(item.data, list);
    }
    const weekKey = weekBounds(item.data).start;
    ids.forEach((id) => {
      const key = String(id);
      const summary = attendanceByStudent.get(key) || { enrolled: 0, present: 0 };
      summary.enrolled += 1;
      const wasPresent = Boolean(item.presencas?.[id] || item.presencas?.[key]);
      if (wasPresent) {
        summary.present += 1;
        const attendanceKey = `${key}|${weekKey}`;
        weeklyAttendanceByStudent.set(attendanceKey, (weeklyAttendanceByStudent.get(attendanceKey) || 0) + 1);
      }
      attendanceByStudent.set(key, summary);
      const history = attendanceHistoryByStudent.get(key) || [];
      history.push({ ...item, wasPresent });
      attendanceHistoryByStudent.set(key, history);
    });
  });
  classesByDay.forEach((items) => items.sort(sortClass));
  attendanceHistoryByStudent.forEach((history) => history.sort(sortClass));
  payments.forEach((item) => {
    const month = paymentMonth(item);
    if (!month) return;
    const list = paymentsByMonth.get(month) || [];
    list.push(item);
    paymentsByMonth.set(month, list);
  });

  const activeStudents = students.filter((student) => student.status !== 'Pausado');
  const pendingStudents = activeStudents.filter((student) => !isPaid(student));
  return {
    studentsById,
    plansById,
    classesById,
    activeStudents,
    pendingStudents,
    todayClasses: classesByDay.get(today) || [],
    pendingBookings: (state.bookings || []).filter((item) => (item.status || 'Pendente') === 'Pendente'),
    approvedBookings: (state.bookings || []).filter((item) => (item.status || '') === 'Aprovado'),
    classesByDay,
    classStudentsById,
    paymentsByMonth,
    attendanceByStudent,
    attendanceHistoryByStudent,
    weeklyAttendanceByStudent,
    weeklyTargetByStudent
  };
}

function getStateIndex() {
  if (!stateIndex || indexVersion !== stateVersion) {
    stateIndex = buildStateIndex();
    indexVersion = stateVersion;
  }
  return stateIndex;
}

function scheduleRender() {
  if (renderFrame) return;
  renderFrame = requestAnimationFrame(() => {
    renderFrame = 0;
    render();
  });
}

function saveAndRender() {
  touchState();
  saveLocalState();
  scheduleRender();
}

window.__tlf_app = {
  get state() { return state; },
  saveAndRender,
  get apiMode() { return apiMode; },
  toast,
  loadData
};

function scheduleUiWork(key, fn, delay = 80) {
  const current = scheduledUiWork.get(key);
  if (current) {
    if (current.type === 'timeout') clearTimeout(current.id);
    if (current.type === 'frame') cancelAnimationFrame(current.id);
  }
  const run = () => {
    const frame = requestAnimationFrame(() => {
      scheduledUiWork.delete(key);
      fn();
    });
    scheduledUiWork.set(key, { type: 'frame', id: frame });
  };
  if (delay > 0) {
    const timeout = setTimeout(run, delay);
    scheduledUiWork.set(key, { type: 'timeout', id: timeout });
    return;
  }
  run();
}

function shouldRender(key, signature) {
  if (renderSignatures.get(key) === signature) return false;
  renderSignatures.set(key, signature);
  return true;
}

function resetStudentListLimit() {
  studentVisibleLimit = LIST_PAGE_SIZE;
  renderSignatures.delete('students');
}

function resetPaymentListLimit() {
  paymentVisibleLimit = LIST_PAGE_SIZE;
  renderSignatures.delete('payments');
}

function syncLocalStateFromStorage() {
  if (apiMode) return;
  state = loadLocalState();
  touchState();
  renderPlanOptions();
  renderPage();
  renderGlobalResults();
  if (document.getElementById('attendanceModal')?.classList.contains('open') && activeAttendanceClassId) {
    openAttendance(activeAttendanceClassId);
  }
}

function showLogin(show = true) {
  const wall = document.getElementById('loginWall');
  wall.classList.toggle('open', show);
  wall.setAttribute('aria-hidden', show ? 'false' : 'true');
  if (show) setTimeout(() => document.getElementById('loginPin').focus(), 50);
}

function showBooking(show = true) {
  const wall = document.getElementById('bookingWall');
  if (!wall) return;
  wall.classList.toggle('open', show);
  wall.setAttribute('aria-hidden', show ? 'false' : 'true');
  if (show) renderPublicBooking();
}

async function unlockApp(pin) {
  const cleanPin = String(pin || '').trim();
  if (!cleanPin) throw new Error('Informe o PIN');
  const hasServer = await detectServer();
  const userRole = 'admin'; // Unificado: 1 login com acesso a tudo
  if (hasServer) {
    await api('/api/login', { method: 'POST', body: JSON.stringify({ pin: cleanPin }), headers: { 'X-Admin-Pin': cleanPin } });
  } else if (!['1209', '2222', '1111'].includes(cleanPin)) {
    throw new Error('PIN inválido');
  }
  localStorage.setItem(PIN_KEY, cleanPin);
  setStoredRole(userRole);
  applyRoleUI(userRole);
  showLogin(false);
  showBooking(false);
  await loadData({ serverKnown: hasServer });
}

function updateSystemNotice() {
  const notice = document.getElementById('systemNotice');
  if (!notice) return;
  if (apiMode) {
    notice.className = 'system-notice online';
    notice.innerHTML = `<strong>${escapeHTML(appConfig.onlineNoticeTitle)}</strong><span>${escapeHTML(appConfig.onlineNoticeText)}</span>`;
    return;
  }
  notice.className = 'system-notice demo';
  notice.innerHTML = `<strong>${escapeHTML(appConfig.localNoticeTitle)}</strong><span>${escapeHTML(appConfig.localNoticeText)}</span>`;
}

async function loadData({ serverKnown = false } = {}) {
  apiMode = serverKnown || apiMode || await detectServer();
  if (!apiMode) {
    const modeStatus = document.getElementById('modeStatus');
    if (modeStatus) modeStatus.textContent = appConfig.localModeLabel;
    updateSystemNotice();
    restorePage();
  initSetupGuideCard();
    return;
  }
  const modeStatus = document.getElementById('modeStatus');
  if (modeStatus) modeStatus.textContent = appConfig.onlineModeLabel;
  updateSystemNotice();
  const bootstrap = await api('/api/bootstrap');
  const data = bootstrap.items || {};
  state = {
    students: data.students || [],
    classes: data.classes || [],
    plans: data.plans || [],
    waitlist: data.waitlist || [],
    payments: data.payments || [],
    bookings: data.bookings || [],
    logs: data.logs || []
  };
  touchState();
  restorePage();
  applyRoleUI();
}

async function refreshApp() {
  await loadData();
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    const registration = await navigator.serviceWorker.getRegistration('./');
    await registration?.update();
  }
  toast('Dados e app atualizados');
}

function studentById(id) {
  return getStateIndex().studentsById.get(String(id));
}

function planById(id) {
  return getStateIndex().plansById.get(String(id));
}

function classById(id) {
  return getStateIndex().classesById.get(String(id));
}

function isPaid(student) {
  return Boolean(student.pago_ate && student.pago_ate >= todayISO());
}

function isPaidForMonth(student, month = currentMonth()) {
  return Boolean(student.pago_ate && String(student.pago_ate).slice(0, 7) >= month);
}

function paymentMonth(item = {}) {
  return String(item.referencia || item.pago_em || item.vencimento || '').slice(0, 7);
}

function dueDay(student = {}) {
  return Math.min(31, Math.max(1, Number(student.dia_vencimento || student.vencimento_dia || 10) || 10));
}

function dueDateForMonth(student = {}, month = todayISO().slice(0, 7)) {
  const [year, monthNumber] = month.split('-').map(Number);
  const lastDay = new Date(year, monthNumber, 0).getDate();
  return `${month}-${String(Math.min(dueDay(student), lastDay)).padStart(2, '0')}`;
}

function paymentUrgency(student = {}, month = currentMonth()) {
  if (isPaidForMonth(student, month)) return { label: 'em dia', className: 'ok', days: 0 };
  const due = dueDateForMonth(student, month);
  const days = signedDaysBetween(due, todayISO());
  if (days > 0) return { label: `${days} dia(s) atrasado`, className: 'bad', days };
  if (days === 0) return { label: 'vence hoje', className: 'warn', days };
  if (days >= -3) return { label: `vence em ${Math.abs(days)} dia(s)`, className: 'warn', days };
  return { label: `vence ${formatDate(due)}`, className: '', days };
}

function paymentPriority(student = {}, month = currentMonth()) {
  if (isPaidForMonth(student, month)) return { label: 'Em dia', className: 'ok', rank: 4 };
  const urgency = paymentUrgency(student, month);
  if (urgency.days > 0) return { label: 'Atrasada', className: 'bad', rank: 0 };
  if (urgency.days >= -3) return { label: 'Cobrar agora', className: 'warn', rank: 1 };
  return { label: 'Programada', className: '', rank: 2 };
}

function studentNextAction(student = {}, weekly = 0, target = 0, nextClasses = []) {
  const payment = paymentPriority(student);
  if (payment.rank <= 1) return { label: payment.label, detail: 'Prioridade financeira', className: payment.className };
  if (!hasFixedSchedule(student)) return { label: 'Definir agenda', detail: 'Aluno sem dia e horário fixo', className: 'warn' };
  if (!nextClasses.length) return { label: 'Criar próximas aulas', detail: 'Agenda fixa sem aulas futuras', className: 'warn' };
  if (target && weekly < target) return { label: 'Acompanhar frequencia', detail: `${weekly}/${target} aulas na semana`, className: 'warn' };
  return { label: 'Tudo ok', detail: 'Aluno sem pendencia operacional', className: 'ok' };
}

function hasFixedSchedule(student = {}) {
  return fixedSchedules(student).length > 0;
}

function fixedSchedules(student = {}) {
  let values = student.agendas_fixas ?? student.fixedSchedules ?? [];
  if (typeof values === 'string') {
    try { values = JSON.parse(values); } catch { values = []; }
  }
  if (!Array.isArray(values)) values = [];
  if (!values.length && student.dia_fixo !== '' && student.dia_fixo !== null && student.dia_fixo !== undefined && student.horario_fixo) {
    values = [{ dia: student.dia_fixo, horario: student.horario_fixo, turma: student.turma_fixa }];
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

function fixedScheduleGroup(student = {}, schedule = {}) {
  return schedule.turma || student.turma_fixa || student.turma || student.nivel || 'Turma fixa';
}

function fixedScheduleOccurrences(student = {}, weeks = 4) {
  const occurrences = [];
  fixedSchedules(student).forEach((schedule) => {
    const start = nextDateForWeekday(schedule.dia);
    if (!start) return;
    Array.from({ length: weeks }, (_item, index) => {
      occurrences.push({
        data: addDaysIso(start, index * 7),
        horario: schedule.horario,
        turma: fixedScheduleGroup(student, schedule),
        schedule
      });
    });
  });
  return occurrences.sort((a, b) => `${a.data}T${a.horario}`.localeCompare(`${b.data}T${b.horario}`));
}

function fixedScheduleText(student = {}) {
  if (!hasFixedSchedule(student)) return 'sem agenda fixa';
  return fixedSchedules(student).map((schedule) => (
    [weekdayName(schedule.dia), schedule.horario, fixedScheduleGroup(student, schedule)].filter(Boolean).join(' - ')
  )).join(' | ');
}

function classStudentIds(item = {}) {
  return item.aluno_ids || (item.alunos || []).map((entry) => entry.aluno_id || entry.id);
}

function classStudents(item = {}) {
  const cached = item.id ? getStateIndex().classStudentsById.get(String(item.id)) : null;
  if (cached) return cached;
  if (item.alunos) return item.alunos;
  return classStudentIds(item).map((id) => {
    const student = studentById(id);
    if (!student) return null;
    return { ...student, confirmado: item.confirmacoes?.[id] || '' };
  }).filter(Boolean);
}

function classExtras(item = {}) {
  if (Array.isArray(item.extra_presentes)) return item.extra_presentes;
  if (Array.isArray(item.extras)) return item.extras;
  if (typeof item.extras === 'string') {
    try {
      const parsed = JSON.parse(item.extras || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function classType(item = {}) {
  return item.tipo || item.tipo_aula || item.type || 'Regular';
}

function phoneDigits(value = '') {
  return String(value || '').replace(/\D/g, '');
}

function extraType(extra = {}) {
  return extra.tipo || extra.tipo_presenca || extra.type || 'Avulso';
}

function cssToken(value = '') {
  return String(value || 'item').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'item';
}

function weekBounds(dateIso = todayISO()) {
  const date = new Date(`${dateIso}T12:00:00`);
  const day = date.getDay();
  const diffToMonday = day === 0 ? 1 : 1 - day;
  const start = new Date(date);
  start.setDate(date.getDate() + diffToMonday);
  const end = new Date(start);
  end.setDate(start.getDate() + 5);
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10)
  };
}

function weeklyAttendanceCount(studentId, dateIso = todayISO()) {
  const { start } = weekBounds(dateIso);
  return getStateIndex().weeklyAttendanceByStudent.get(`${String(studentId)}|${start}`) || 0;
}

function planWeeklyTarget(student = {}) {
  if (student.id) {
    const cached = getStateIndex().weeklyTargetByStudent.get(String(student.id));
    if (cached !== undefined) return cached;
  }
  const plan = planById(student.plano_id);
  if (plan) return Number(plan.aulas_semana || 0);
  const match = String(student.plano_nome || '').match(/(\d+)\s*x/i);
  return match ? Number(match[1]) : 0;
}

function attendanceSummary(studentId) {
  const index = getStateIndex();
  const summary = index.attendanceByStudent.get(String(studentId)) || { enrolled: 0, present: 0 };
  const history = index.attendanceHistoryByStudent.get(String(studentId)) || [];
  const enrolled = summary.enrolled;
  const present = summary.present;
  const rate = enrolled ? Math.round((present / enrolled) * 100) : 0;
  return { enrolled, present, rate, history };
}

function classConfirmationStats(item = {}) {
  const students = classStudents(item);
  const yes = students.filter((student) => student.confirmado === 'sim' || student.confirmacao === 'sim').length;
  const no = students.filter((student) => student.confirmado === 'nao' || student.confirmacao === 'nao').length;
  const confirmedByTeacher = students.filter((student) => (student.confirmado === 'sim' || student.confirmacao === 'sim') && student.confirmado_professor === 'sim').length;
  return { yes, no, open: Math.max(0, students.length - yes - no), confirmedByTeacher, pendingTeacher: Math.max(0, yes - confirmedByTeacher) };
}

function classOperationStatus(item = {}) {
  const enrolled = classStudents(item);
  const capacity = Number(item.capacidade || 8);
  const present = enrolled.filter((student) => item.presencas?.[student.aluno_id || student.id] || student.presente).length;
  const confirmation = classConfirmationStats(item);
  if ((item.status || '') === 'Finalizada') return ['ok', 'Finalizada'];
  if (present) return ['warn', 'Finalizar presenca'];
  if (enrolled.length >= capacity) return ['bad', 'Lotada'];
  if (confirmation.open) return ['warn', `${confirmation.open} sem resposta`];
  if (confirmation.no) return ['bad', `${confirmation.no} nao vai`];
  if (confirmation.pendingTeacher) return ['warn', `${confirmation.pendingTeacher} aguardando professor`];
  return ['ok', 'Pronta'];
}

function studentClassEntry(item = {}, studentId = '') {
  return classStudents(item).find((student) => String(student.aluno_id || student.id) === String(studentId)) || {};
}

function confirmationLabel(value = '') {
  if (value === 'sim') return ['ok', 'vai'];
  if (value === 'nao') return ['bad', 'nao vai'];
  return ['warn', 'sem resposta'];
}

function formatDate(value) {
  if (!value) return '-';
  const [year, month, day] = String(value).slice(0, 10).split('-');
  return `${day}/${month}/${year}`;
}

function formatActionTime(value) {
  if (!value) return '--:--';
  const text = String(value);
  const iso = text.match(/T(\d{2}):(\d{2})/);
  if (iso) return `${iso[1]}:${iso[2]}`;
  const br = text.match(/(\d{1,2}):(\d{2})/);
  if (br) return `${br[1].padStart(2, '0')}:${br[2]}`;
  return text.slice(0, 5);
}

function actionDateKey(value) {
  const text = String(value || '');
  const isoDate = text.match(/^(\d{4}-\d{2}-\d{2})/);
  if (isoDate) return isoDate[1];
  const parsed = new Date(text);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  return '';
}

function formatActionDate(value) {
  const key = actionDateKey(value);
  if (!key) return 'Sem data';
  if (key === todayISO()) return 'Hoje';
  if (key === addDaysIso(todayISO(), -1)) return 'Ontem';
  return formatDate(key);
}

function actionActor(item = {}) {
  if (['Professor', 'Aluno', 'Sistema'].includes(item.ator)) return item.ator;
  if (item.ator === 'API') return 'Sistema';
  const text = `${item.acao || ''} ${item.detalhe || ''}`.toLowerCase();
  if (text.includes('confirmacao aluno') || text.includes('solicitou aula')) return 'Aluno';
  if (text.includes('backup') || text.includes('importacao') || text.includes('sistema')) return 'Sistema';
  return 'Professor';
}

function actionLabel(item = {}) {
  const labels = {
    API: 'Registro do sistema',
    Presenca: 'Presença',
    'Presenca em massa': 'Presença em massa',
    'Confirmacao aluno': 'Confirmação do aluno',
    'Pedido recusado': 'Pedido recusado',
    'Pedido aprovado': 'Pedido aprovado'
  };
  return labels[item.acao] || item.acao || 'Ação';
}

function actionCategoryLabel(category = '') {
  return ({ Presenca: 'Presença', Operacao: 'Operação' }[category] || category);
}

function actionTone(actor = '') {
  if (actor === 'Aluno') return 'student';
  if (actor === 'Sistema') return 'system';
  return 'teacher';
}

function actionIcon(actor = '') {
  if (actor === 'Aluno') return 'Aluno';
  if (actor === 'Sistema') return 'Sistema';
  return 'Prof.';
}

function actionCategory(item = {}) {
  const text = `${item.acao || ''} ${item.detalhe || ''}`.toLowerCase();
  if (text.includes('pagamento') || text.includes('mensalidade') || text.includes('pago') || text.includes('cobranca') || text.includes('fechamento') || text.includes('receita')) return 'Financeiro';
  if (text.includes('presenca') || text.includes('presente') || text.includes('faltou') || text.includes('confirmacao')) return 'Presenca';
  if (text.includes('pedido') || text.includes('solicitou') || text.includes('aprovado') || text.includes('recusado')) return 'Pedidos';
  if (text.includes('aula') || text.includes('agenda') || text.includes('duplicada') || text.includes('status da aula')) return 'Agenda';
  if (text.includes('aluno') || text.includes('cadastro')) return 'Aluno';
  if (text.includes('backup') || text.includes('sistema') || text.includes('importacao')) return 'Sistema';
  return 'Operacao';
}

function actionCategoryTone(category = '') {
  if (category === 'Financeiro') return 'money';
  if (category === 'Presenca') return 'presence';
  if (category === 'Pedidos') return 'request';
  if (category === 'Agenda') return 'schedule';
  if (category === 'Sistema') return 'system';
  return 'default';
}

function actionFocusRow(item) {
  const category = actionCategory(item);
  return `
    <article class="action-focus-row">
      <time>${escapeHTML(formatActionTime(item.data_hora))}</time>
      <div>
        <strong>${escapeHTML(actionLabel(item))}</strong>
        <p>${escapeHTML(item.detalhe || 'Movimento registrado no sistema.')}</p>
        <span class="pill action-pill action-pill-${actionCategoryTone(category)}">${escapeHTML(actionCategoryLabel(category))}</span>
      </div>
    </article>
  `;
}

function actionFocusCard(actor, title, subtitle, items) {
  return `
    <section class="action-focus-card action-${actionTone(actor)}">
      <div class="action-focus-head">
        <div>
          <span>${escapeHTML(actor)}</span>
          <strong>${escapeHTML(title)}</strong>
        </div>
        <small>${items.length} registro(s)</small>
      </div>
      <p>${escapeHTML(subtitle)}</p>
      <div class="action-focus-list">
        ${items.length ? items.slice(0, 4).map(actionFocusRow).join('') : empty('Nada importante aqui agora.')}
      </div>
    </section>
  `;
}

function studentRecentActions(student = {}, limit = 5) {
  const name = String(student.nome || '').toLowerCase();
  const phone = phoneDigits(student.telefone || '');
  if (!name && !phone) return [];
  return sortedActions(120).filter((item) => {
    const text = `${item.acao || ''} ${item.detalhe || ''}`.toLowerCase();
    return (name && text.includes(name)) || (phone && phoneDigits(text).includes(phone));
  }).slice(0, limit);
}

function sortedActions(limit = 80) {
  return [...(state.logs || [])]
    .sort((a, b) => {
      const timeA = Date.parse(a.data_hora || '');
      const timeB = Date.parse(b.data_hora || '');
      if (Number.isFinite(timeA) && Number.isFinite(timeB)) return timeB - timeA;
      const idA = Number(a.id || 0);
      const idB = Number(b.id || 0);
      if (Number.isFinite(idA) && Number.isFinite(idB)) return idB - idA;
      return String(b.data_hora || b.id || '').localeCompare(String(a.data_hora || a.id || ''));
    })
    .slice(0, limit);
}

function recordAction(actor, action, detail) {
  state.logs = state.logs || [];
  state.logs.unshift({
    id: uid(),
    data_hora: new Date().toISOString(),
    ator: actor,
    acao: action,
    detalhe: detail
  });
  state.logs = state.logs.slice(0, 120);
}

function weekdayName(value) {
  const names = ['Domingo', 'Segunda', 'Terca', 'Quarta', 'Quinta', 'Sexta', 'Sabado'];
  return names[Number(value)] || '';
}

function nextDateForWeekday(weekday, fromIso = todayISO()) {
  const target = Number(weekday);
  if (!Number.isInteger(target) || target < 0 || target > 6) return '';
  const date = new Date(`${fromIso}T12:00:00`);
  const diff = (target - date.getDay() + 7) % 7;
  date.setDate(date.getDate() + diff);
  return date.toISOString().slice(0, 10);
}

function addMonthsIso(dateIso, months = 1) {
  const date = dateIso ? new Date(`${dateIso}T12:00:00`) : new Date();
  date.setMonth(date.getMonth() + months);
  return date.toISOString().slice(0, 10);
}

function addDaysIso(dateIso, days = 7) {
  const date = dateIso ? new Date(`${dateIso}T12:00:00`) : new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function nextMondayIso(fromIso = todayISO()) {
  const date = new Date(`${fromIso}T12:00:00`);
  const offset = date.getDay() === 0 ? 1 : 8 - date.getDay();
  return addDaysIso(fromIso, offset === 7 ? 0 : offset);
}

function standardClassSlots() {
  return STANDARD_CLASS_SLOTS.flatMap((day) => day.times.map((time) => ({ day: day.day, label: day.label, time })));
}

function daysBetween(dateIso, endIso = todayISO()) {
  if (!dateIso) return 0;
  const start = new Date(`${dateIso}T12:00:00`);
  const end = new Date(`${endIso}T12:00:00`);
  return Math.max(0, Math.floor((end - start) / 86400000));
}

function signedDaysBetween(dateIso, endIso = todayISO()) {
  if (!dateIso) return 0;
  const start = new Date(`${dateIso}T12:00:00`);
  const end = new Date(`${endIso}T12:00:00`);
  return Math.floor((end - start) / 86400000);
}


function toast(message, type = 'info') {
  showToast(message, type);
}

function updateTopbar(page) {
  const [eyebrow, title] = PAGE_TITLES[page] || PAGE_TITLES.dashboard;
  const eyebrowEl = document.getElementById('topbarEyebrow');
  const titleEl = document.getElementById('topbarTitle');
  if (eyebrowEl) eyebrowEl.textContent = eyebrow;
  if (titleEl) titleEl.textContent = title;
}

function applyAppConfig() {
  PAGE_TITLES.dashboard = [appConfig.dashboardEyebrow, appConfig.dashboardTitle];
  ['actions', 'bookings', 'students', 'classes', 'payments', 'waitlist', 'plans', 'reports'].forEach((page) => {
    const title = appConfig[`${page}Title`];
    if (title) PAGE_TITLES[page][1] = title;
  });
  document.title = appConfig.brandName;
  document.querySelectorAll('[data-config-text]').forEach((element) => {
    const value = appConfig[element.dataset.configText];
    if (typeof value === 'string' && value.trim()) element.textContent = value;
  });
  document.querySelectorAll('[data-config-page-title]').forEach((element) => {
    const value = appConfig[element.dataset.configPageTitle];
    if (typeof value === 'string' && value.trim()) element.textContent = value;
  });
  document.querySelectorAll('[data-preview-brand]').forEach((element) => { element.textContent = appConfig.brandName; });
  document.querySelectorAll('[data-preview-subtitle]').forEach((element) => { element.textContent = appConfig.brandSubtitle; });
  document.querySelectorAll('[data-preview-title]').forEach((element) => { element.textContent = appConfig.dashboardTitle; });
  document.querySelectorAll('[data-preview-description]').forEach((element) => { element.textContent = appConfig.publicDescription; });
  updateTopbar(currentPage());
}

function normalizeTheme(theme) {
  return 'dark';
}

function setTheme(theme, { persist = true } = {}) {
  const next = 'dark';
  document.documentElement.dataset.theme = next;
  document.documentElement.classList.add('dark');
  if (persist) localStorage.setItem('fv_theme', next);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', '#09090b');
  updateThemeButton();
  if (document.getElementById('themePicker')) renderSettings({ syncForm: false });
}

function renderSettings(opts) {
  renderSettingsModule(getAppContext(), opts);
}

function syncSettingsForm() {
  syncSettingsFormModule(getAppContext());
}

function readSettingsForm() {
  return readSettingsFormModule(getAppContext());
}

function updateSettingsPreview() {
  updateSettingsPreviewModule(getAppContext());
}

function saveSettings(event) {
  saveSettingsModule(getAppContext(), event);
}

function resetSettingsForm() {
  resetSettingsFormModule(getAppContext());
}

function clearSettings() {
  appConfig = { ...DEFAULT_APP_CONFIG };
  localStorage.setItem(CONFIG_KEY, JSON.stringify(appConfig));
  setTheme('dark');
  applyAppConfig();
  updateSystemNotice();
  renderSettings();
  toast('Configurações restauradas');
}

function currentPage() {
  return document.documentElement.dataset.page
    || document.querySelector('.page.active')?.id?.replace('page-', '')
    || localStorage.getItem(PAGE_KEY)
    || 'dashboard';
}

async function refreshActions({ force = false } = {}) {
  if (!apiMode || !localStorage.getItem(PIN_KEY)) return;
  if (!force && document.hidden) return;
  const res = await api('/api/tables/logs?limit=80');
  const nextLogs = res.rows || [];
  const currentKey = (state.logs || []).map((item) => `${item.id}:${item.ator || ''}`).join('|');
  const nextKey = nextLogs.map((item) => `${item.id}:${item.ator || ''}`).join('|');
  if (currentKey === nextKey) return;
  state.logs = nextLogs;
  touchState();
  const page = currentPage();
  if (page === 'dashboard' || page === 'actions') renderPage(page);
}

function startActionRefresh() {
  clearInterval(actionRefreshTimer);
  actionRefreshTimer = setInterval(() => {
    refreshActions().catch(() => {});
  }, ACTION_REFRESH_MS);
}

function setPage(page) {
  const isMobile = window.matchMedia('(max-width: 620px)').matches;
  if (page === 'more' && !isMobile) page = 'dashboard';
  if (!document.getElementById(`page-${page}`)) page = 'dashboard';
  if (document.documentElement.dataset.page && page === currentPage() && document.getElementById(`page-${page}`)?.classList.contains('active')) {
    renderPage(page);
    return;
  }
  const moreActive = isMobile && MOBILE_MORE_PAGES.includes(page);
  document.querySelectorAll('.page').forEach((el) => el.classList.toggle('active', el.id === `page-${page}`));
  document.querySelectorAll('.nav-item').forEach((el) => {
    const active = moreActive ? el.dataset.page === 'more' : el.dataset.page === page;
    el.classList.toggle('active', active);
    if (active) el.setAttribute('aria-current', 'page');
    else el.removeAttribute('aria-current');
    if (active) el.scrollIntoView({ block: 'nearest', inline: 'center' });
  });
  document.documentElement.dataset.page = page;
  updateTopbar(page);
  localStorage.setItem(PAGE_KEY, page);
  closeGlobalResults();
  window.scrollTo({ top: 0, behavior: 'smooth' });
  renderPage(page);
}

function restorePage() {
  const saved = localStorage.getItem(PAGE_KEY) || 'dashboard';
  setPage(saved === 'more' && !window.matchMedia('(max-width: 620px)').matches ? 'dashboard' : saved);
}

function toggleTheme() {
  const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  setTheme(next);
}

function updateThemeButton() {
  const button = document.getElementById('themeBtn');
  if (!button) return;
  const dark = document.documentElement.dataset.theme === 'dark';
  button.innerHTML = dark
    ? '<svg class="theme-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.65 17.65l1.42 1.42M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.65 6.35l1.42-1.42" /></svg>'
    : '<svg class="theme-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M21 12.8A8.5 8.5 0 1 1 11.2 3 6.5 6.5 0 0 0 21 12.8Z" /></svg>';
  button.setAttribute('aria-pressed', dark ? 'true' : 'false');
  button.setAttribute('aria-label', dark ? 'Usar tema claro' : 'Usar tema escuro');
  button.title = dark ? 'Usar tema claro' : 'Usar tema escuro';
}

function logout() {
  localStorage.removeItem(PIN_KEY);
  showLogin(true);
}

function updatePerformanceMode() {
  const mobile = window.matchMedia('(max-width: 620px)').matches;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  document.documentElement.dataset.perf = mobile || reducedMotion ? 'lite' : 'full';
}

function getAppContext() {
  return {
    state,
    stateVersion,
    appConfig,
    setAppConfig: (cfg) => { appConfig = cfg; },
    CONFIG_KEY,
    PIN_KEY,
    THEME_OPTIONS,
    LIST_PAGE_SIZE,
    studentVisibleLimit,
    paymentVisibleLimit,
    money,
    todayISO,
    currentMonth,
    selectedPaymentMonth,
    formatDate,
    escapeHTML,
    empty,
    shouldRender,
    getStateIndex,
    classStudents,
    classExtras,
    classType,
    extraType,
    classById,
    studentById,
    classConfirmationStats,
    confirmationLabel,
    classOperationStatus,
    classStatusActions,
    cssToken,
    weeklyAttendanceCount,
    planWeeklyTarget,
    fixedSchedules,
    fixedScheduleText,
    fixedScheduleOccurrences,
    hasFixedSchedule,
    studentNextAction,
    studentRecentActions,
    isPaid,
    isPaidForMonth,
    dueDay,
    paymentUrgency,
    paymentPriority,
    sortedPaymentStudents,
    studentChargeText,
    sortedActions,
    actionRow,
    actionFocusRow,
    reportClassLine,
    attendanceSummary,
    nextClass,
    nextWaitLead,
    classRow,
    paymentRow,
    rosterPerson,
    openModal,
    closeModal,
    setActiveAttendanceClassId: (id) => { activeAttendanceClassId = id; },
    toast,
    whatsappUrl,
    whatsappShareUrl,
    classShareText,
    openPixModal,
    loadData,
    renderPlanOptions,
    renderStudentFixedScheduleRows,
    renderStudentSchedulePreview,
    applyAppConfig,
    updateSystemNotice,
    addDaysIso,
    weekBounds,
    sortClass
  };
}

function renderDashboard() {
  renderDashboardModule(getAppContext());
}

function renderFocusStrip() {
  renderFocusStripModule(getAppContext());
}

function renderPage(page = currentPage()) {
  const renderers = {
    dashboard: renderDashboard,
    actions: renderActions,
    students: renderStudents,
    classes: renderClasses,
    bookings: renderBookings,
    payments: renderPayments,
    plans: renderPlans,
    waitlist: renderWaitlist,
    reports: renderReports,
    more: () => {},
    settings: renderSettings
  };
  (renderers[page] || renderDashboard)();
}

function render() {
  renderPlanOptions();
  renderPage();
  renderGlobalResults();
}

function renderKpis() {
  renderKpisModule(getAppContext());
}

function nextClass() {
  const nowKey = new Date().toISOString().slice(0, 16);
  return [...state.classes]
    .filter((item) => item.status !== 'Cancelada')
    .sort(sortClass)
    .find((item) => `${item.data}T${item.horario}` >= nowKey) || [...state.classes].sort(sortClass)[0];
}

function renderQuickActions() {
  renderQuickActionsModule(getAppContext());
}

function renderTodayClasses() {
  renderTodayClassesModule(getAppContext());
}

function renderPending() {
  renderPendingModule(getAppContext());
}

function actionRow(item) {
  const actor = actionActor(item);
  const category = actionCategory(item);
  return `
    <article class="action-item action-${actionTone(actor)}">
      <time><span>${escapeHTML(formatActionTime(item.data_hora))}</span><small>${escapeHTML(actionIcon(actor))}</small></time>
      <div>
        <div class="action-line">
          <strong>${escapeHTML(actor)}</strong>
          <span>${escapeHTML(actionLabel(item))}</span>
        </div>
        <div class="action-meta-line">
          <span class="pill action-pill action-pill-${actionCategoryTone(category)}">${escapeHTML(actionCategoryLabel(category))}</span>
          <small>${escapeHTML(formatActionDate(item.data_hora))}</small>
        </div>
        <p>${escapeHTML(item.detalhe || 'Movimento registrado no sistema.')}</p>
      </div>
    </article>
  `;
}

function groupedActionRows(items) {
  let current = '';
  return items.map((item) => {
    const key = actionDateKey(item.data_hora) || 'sem-data';
    const header = key !== current ? `<div class="action-day"><span>${escapeHTML(formatActionDate(item.data_hora))}</span></div>` : '';
    current = key;
    return `${header}${actionRow(item)}`;
  }).join('');
}

function renderDashboardActions() {
  renderDashboardActionsModule(getAppContext());
}

function renderActions() {
  const filter = document.getElementById('actionActorFilter')?.value || '';
  const categoryFilter = document.getElementById('actionCategoryFilter')?.value || '';
  const query = document.getElementById('actionSearch')?.value.trim().toLowerCase() || '';
  const signature = `${stateVersion}|${filter}|${categoryFilter}|${query}`;
  if (!shouldRender('actions', signature)) return;
  const all = sortedActions(80);
  const items = all.filter((item) => {
    const actor = actionActor(item);
    const category = actionCategory(item);
    const haystack = `${actor} ${category} ${actionLabel(item)} ${item.acao || ''} ${item.detalhe || ''}`.toLowerCase();
    return (!filter || actor === filter) && (!categoryFilter || category === categoryFilter) && (!query || haystack.includes(query));
  });
  const professor = all.filter((item) => actionActor(item) === 'Professor').length;
  const aluno = all.filter((item) => actionActor(item) === 'Aluno').length;
  const system = all.filter((item) => actionActor(item) === 'Sistema').length;
  const finance = all.filter((item) => actionCategory(item) === 'Financeiro').length;
  const latest = items[0] || all[0];
  const summary = document.getElementById('actionSummary');
  if (summary) {
    summary.innerHTML = `
      <article class="mini-stat action-latest"><span>Ultimo movimento</span><strong>${latest ? escapeHTML(formatActionTime(latest.data_hora)) : '--:--'}</strong><small>${latest ? escapeHTML(`${actionActor(latest)} - ${actionLabel(latest)}`) : 'Sem registro'}</small></article>
      <article class="mini-stat action-mini-teacher"><span>Professor</span><strong>${professor}</strong></article>
      <article class="mini-stat action-mini-student"><span>Aluno</span><strong>${aluno}</strong></article>
      <article class="mini-stat action-mini-system"><span>Sistema</span><strong>${system}</strong></article>
      <article class="mini-stat action-mini-money"><span>Financeiro</span><strong>${finance}</strong></article>
    `;
  }
  const focus = document.getElementById('actionFocus');
  if (focus) {
    const teacherItems = all.filter((item) => actionActor(item) === 'Professor');
    const studentItems = all.filter((item) => actionActor(item) === 'Aluno');
    focus.innerHTML = `
      ${actionFocusCard('Professor', 'Operação do professor', 'Pagamentos, presenças, aulas e decisões feitas pelo painel.', teacherItems)}
      ${actionFocusCard('Aluno', 'Movimento dos alunos', 'Confirmações, pedidos de aula e respostas enviadas pelo acesso rápido.', studentItems)}
    `;
  }
  document.getElementById('actionList').innerHTML = items.length ? groupedActionRows(items) : empty('Nenhuma acao nesse filtro.');
}

function renderStudents() {
  renderStudentsModule(getAppContext());
}

function renderGlobalResults() {
  const input = document.getElementById('globalSearch');
  const results = document.getElementById('globalResults');
  if (!input || !results) return;
  const query = input.value.trim().toLowerCase();
  if (query.length < 2) {
    closeGlobalResults();
    results.innerHTML = '';
    return;
  }
  const studentItems = state.students.filter((student) => (
    `${student.nome} ${student.telefone} ${student.plano_nome}`.toLowerCase().includes(query)
  )).slice(0, 5).map((student) => ({
    title: student.nome,
    meta: `${student.plano_nome || 'sem plano'} - ${student.telefone || 'sem telefone'}`,
    action: `student:${student.id}`
  }));
  const waitItems = state.waitlist.filter((item) => (
    `${item.nome} ${item.telefone} ${item.preferencia}`.toLowerCase().includes(query)
  )).slice(0, 3).map((item) => ({
    title: item.nome,
    meta: `espera - ${item.status || 'Novo'}`,
    action: `wait:${item.id}`
  }));
  const items = [...studentItems, ...waitItems];
  results.innerHTML = items.length ? items.map((item) => `
    <button type="button" role="option" data-global-result="${item.action}">
      <strong>${escapeHTML(item.title)}</strong>
      <span>${escapeHTML(item.meta)}</span>
    </button>
  `).join('') : '<div class="global-empty">Nada encontrado</div>';
  results.classList.add('open');
  input.setAttribute('aria-expanded', 'true');
}

function closeGlobalResults() {
  document.getElementById('globalResults')?.classList.remove('open');
  document.getElementById('globalSearch')?.setAttribute('aria-expanded', 'false');
}

function openGlobalResult(action) {
  const [kind, id] = action.split(':');
  document.getElementById('globalSearch').value = '';
  renderGlobalResults();
  if (kind === 'student') {
    setPage('students');
    openStudent(id);
  }
  if (kind === 'wait') {
    setPage('waitlist');
    openWaitItem(id);
  }
}

function renderClasses() {
  renderClassesModule(getAppContext());
}

function bookingClass(booking) {
  return getStateIndex().classesById.get(String(booking.aula_id));
}

function bookingStatusTone(status = 'Pendente') {
  if (status === 'Aprovado') return 'ok';
  if (status === 'Recusado') return 'bad';
  return 'warn';
}

function isExperimentalBooking(booking = {}) {
  if (!booking) return false;
  const obs = String(booking.observacao || '').toLowerCase();
  const tipo = String(booking.tipo || '').toLowerCase();
  const turma = String(booking.turma || '').toLowerCase();
  if (obs.includes('experimental') || tipo.includes('experimental') || turma.includes('experimental')) return true;
  const digits = phoneDigits(booking.telefone);
  if (digits && state.students) {
    const student = state.students.find((s) => phoneDigits(s.telefone).endsWith(digits.slice(-8)));
    if (student && (String(student.status || '').toLowerCase() === 'experimental' || String(student.plano_nome || '').toLowerCase().includes('experimental'))) return true;
  }
  return false;
}

function renderBookings() {
  const target = document.getElementById('bookingList');
  if (!target) return;
  const bookings = [...(state.bookings || [])].sort((a, b) => (
    Number((b.status || 'Pendente') === 'Pendente') - Number((a.status || 'Pendente') === 'Pendente')
    || String(b.id).localeCompare(String(a.id))
  ));
  const pending = bookings.filter((item) => (item.status || 'Pendente') === 'Pendente');
  const approved = bookings.filter((item) => item.status === 'Aprovado');
  const rejected = bookings.filter((item) => item.status === 'Recusado');
  const experimentalsPending = pending.filter((item) => isExperimentalBooking(item));
  const totalExperimentals = bookings.filter((item) => isExperimentalBooking(item));

  const filterSelect = document.getElementById('bookingFilter');
  const currentFilter = filterSelect?.value || 'all';

  const summary = document.getElementById('bookingSummary');
  if (summary) {
    summary.innerHTML = `
      <article class="mini-stat ${pending.length ? 'kpi-warn' : 'kpi-ok'}"><span>Aguardando</span><strong>${pending.length}</strong></article>
      <article class="mini-stat ${experimentalsPending.length ? 'kpi-warn' : ''}" style="${experimentalsPending.length ? 'border-color: rgba(245,158,11,0.4);' : ''}"><span>🧪 Experimentais</span><strong style="${experimentalsPending.length ? 'color: #fbbf24;' : ''}">${experimentalsPending.length}</strong></article>
      <article class="mini-stat kpi-ok"><span>Aprovados</span><strong>${approved.length}</strong></article>
      <article class="mini-stat"><span>Total</span><strong>${bookings.length}</strong></article>
    `;
  }

  const filteredBookings = bookings.filter((item) => {
    if (currentFilter === 'experimental') return isExperimentalBooking(item);
    if (currentFilter === 'regular') return !isExperimentalBooking(item);
    return true;
  });

  target.innerHTML = filteredBookings.length ? filteredBookings.map((booking) => {
    const item = bookingClass(booking);
    const status = booking.status || 'Pendente';
    const full = item ? classStudentIds(item).length >= Number(item.capacidade || 8) : false;
    const isExp = isExperimentalBooking(booking);
    return `
      <article class="row-card booking-request booking-${cssToken(status)}" style="${isExp ? 'border-left: 3px solid #f59e0b;' : ''}">
        <div class="booking-main">
          <div class="booking-titleline">
            <h3 style="display:flex; align-items:center; gap:8px;">
              ${escapeHTML(booking.nome)}
              ${isExp ? '<span class="pill warn" style="font-size:10px; font-weight:700; background:rgba(245,158,11,0.18); color:#fbbf24; border:1px solid rgba(245,158,11,0.35);">🧪 Experimental</span>' : ''}
            </h3>
            <span class="pill ${bookingStatusTone(status)}">${escapeHTML(status)}</span>
          </div>
          <p class="meta">${escapeHTML(booking.telefone || 'sem WhatsApp')}</p>
          <p class="booking-class-meta">${item ? `${formatDate(item.data)} às ${item.horario} - ${escapeHTML(item.turma || 'Turma')}` : 'aula removida'}</p>
          <div class="pill-row">
            ${isExp ? '<span class="pill warn">Aula Experimental</span>' : '<span class="pill">Aula Regular</span>'}
            ${item ? `<span class="pill ${full ? 'bad' : 'ok'}">${classStudentIds(item).length}/${item.capacidade || 8} vagas</span>` : ''}
            ${booking.indicado_por ? `<span class="pill">Indicação: ${escapeHTML(booking.indicado_por)}</span>` : ''}
            ${booking.criado_em ? `<span class="pill">${formatDate(booking.criado_em)}</span>` : ''}
          </div>
          ${booking.observacao ? `<p class="meta" style="color:var(--text);">${escapeHTML(booking.observacao)}</p>` : ''}
        </div>
        <div class="actions">
          ${booking.telefone ? `<a class="mini-btn" href="${whatsappUrl(booking.telefone, bookingReplyText(booking, item))}" target="_blank" rel="noopener">WhatsApp</a>` : ''}
          ${status === 'Pendente' ? `<button class="mini-btn ${isExp ? 'primary-btn' : ''}" data-booking-action="${booking.id}:approve">${isExp ? 'Aprovar Experimental' : 'Aprovar'}</button><button class="mini-btn danger-mini" data-booking-action="${booking.id}:reject">Recusar</button>` : ''}
        </div>
      </article>
    `;
  }).join('') : empty(currentFilter === 'experimental' ? 'Nenhuma solicitação de aula experimental no momento.' : 'Nenhum pedido de aula encontrado.');

  // Renderizar experimentais da lista de espera que ainda não foram agendados
  const waitlistSection = document.getElementById('bookingWaitlistSection');
  if (waitlistSection) {
    const waitlistExp = (state.waitlist || []).filter((item) => {
      const st = String(item.status || 'Novo');
      const obs = String(item.observacao || '').toLowerCase();
      const pref = String(item.preferencia || '').toLowerCase();
      return ['Novo', 'Contatado', 'Experimental marcado'].includes(st) && (obs.includes('experimental') || pref.includes('experimental') || st === 'Experimental marcado');
    });

    if (waitlistExp.length && currentFilter !== 'regular') {
      waitlistSection.innerHTML = `
        <div style="margin-top: 24px; padding: 16px; border: 1px dashed rgba(245,158,11,0.35); border-radius: 18px; background: rgba(245,158,11,0.04);">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; flex-wrap: wrap; gap: 8px;">
            <strong style="display:flex; align-items:center; gap:6px; color:#fbbf24; font-size:14px;">
              🧪 Experimentais na Fila de Espera (${waitlistExp.length})
            </strong>
            <small style="color: var(--muted);">Interessados aguardando confirmação de horário</small>
          </div>
          <div class="list" style="gap: 8px;">
            ${waitlistExp.map((wait) => `
              <article class="row-card" style="padding: 12px 14px;">
                <div style="min-width:0; flex:1;">
                  <div style="display:flex; align-items:center; gap:8px;">
                    <strong>${escapeHTML(wait.nome)}</strong>
                    <span class="pill warn">${escapeHTML(wait.status || 'Novo')}</span>
                  </div>
                  <p class="meta">${escapeHTML(wait.telefone || 'sem telefone')} ${wait.preferencia ? `• Pref: ${escapeHTML(wait.preferencia)}` : ''}</p>
                  ${wait.observacao ? `<p class="meta" style="color:var(--text);">${escapeHTML(wait.observacao)}</p>` : ''}
                </div>
                <div class="actions">
                  ${wait.telefone ? `<a class="mini-btn" href="${whatsappUrl(wait.telefone, `Oi ${wait.nome}! Aqui é do Team Lucão Futevôlei. Vi seu interesse na aula experimental. Vamos agendar seu treino?`)}" target="_blank" rel="noopener">WhatsApp</a>` : ''}
                  <button class="mini-btn" data-edit-wait="${wait.id}">Agendar Treino</button>
                </div>
              </article>
            `).join('')}
          </div>
        </div>
      `;
    } else {
      waitlistSection.innerHTML = '';
    }
  }
}

function nextWaitLead() {
  return [...state.waitlist]
    .filter((item) => !['Convertido', 'Perdido'].includes(item.status || 'Novo'))
    .sort((a, b) => daysBetween(b.data_cadastro || todayISO()) - daysBetween(a.data_cadastro || todayISO()))[0];
}

function waitPriority(item = {}) {
  const status = item.status || 'Novo';
  const age = daysBetween(item.data_cadastro || todayISO());
  if (status === 'Convertido') return { label: 'Convertido', className: 'ok', rank: 4, age };
  if (status === 'Perdido') return { label: 'Perdido', className: 'bad', rank: 5, age };
  if (status === 'Novo' && age >= 2) return { label: 'Responder hoje', className: 'bad', rank: 0, age };
  if (status === 'Novo') return { label: 'Novo lead', className: 'warn', rank: 1, age };
  if (status === 'Contatado') return { label: 'Marcar experimental', className: 'warn', rank: 2, age };
  if (status === 'Experimental marcado') return { label: 'Converter aluno', className: 'warn', rank: 3, age };
  return { label: status, className: '', rank: 3, age };
}


function renderClassSummary(classes) {
  renderClassSummaryModule(getAppContext(), classes);
}

function renderClassesTodayPlanner() {
  renderClassesTodayPlannerModule(getAppContext());
}

function renderClassCalendar() {
  renderClassCalendarModule(getAppContext());
}

function paymentRow(student, month) {
  const paid = isPaidForMonth(student, month);
  const urgency = paymentUrgency(student, month);
  const priority = paymentPriority(student, month);
  return `
    <article class="row-card payment-row ${paid ? 'payment-paid' : 'payment-pending'}">
      <div>
        <button class="link-title compact-title" type="button" data-report-student="${student.id}">${escapeHTML(student.nome)}</button>
        <p class="meta">${escapeHTML(student.plano_nome || 'sem plano')} - ${money.format(Number(student.mensalidade || 0))} - pago até ${student.pago_ate ? formatDate(student.pago_ate) : 'sem registro'}</p>
        <div class="pill-row">
          <span class="pill ${priority.className}">${escapeHTML(priority.label)}</span>
          <span class="pill ${paid ? 'ok' : 'bad'}">${paid ? 'em dia' : 'pendente'}</span>
          <span class="pill ${urgency.className}">${escapeHTML(urgency.label)}</span>
          <span class="pill">vence dia ${dueDay(student)}</span>
        </div>
      </div>
      <div class="actions">
        ${student.telefone ? `<a class="mini-btn" href="${whatsappUrl(student.telefone, studentChargeText(student, month))}" target="_blank" rel="noopener">WhatsApp</a>` : ''}
        ${!paid ? `<button class="mini-btn" style="color:#ef4444; border-color:rgba(220,38,38,0.3); background:rgba(220,38,38,0.08);" data-pix-charge="${student.id}">PIX</button>` : ''}
        <button class="mini-btn" data-copy-charge="${student.id}">Copiar cobrança</button>
        <button class="mini-btn" data-pay="${student.id}">${paid ? 'Desmarcar' : 'Dar Baixa'}</button>
      </div>
    </article>
  `;
}

function renderPayments() {
  renderPaymentsModule(getAppContext());
}

function renderPlans() {
  document.getElementById('planGrid').innerHTML = state.plans.length ? state.plans.map((plan) => `
    <article class="student-card">
      <h3>${escapeHTML(plan.nome)}</h3>
      <p class="meta">${money.format(Number(plan.preco || 0))} - ${Number(plan.aulas_semana || 0)} aula(s)/semana</p>
      <div class="pill-row"><span class="pill ${Number(plan.ativo ?? 1) ? 'ok' : ''}">${Number(plan.ativo ?? 1) ? 'ativo' : 'inativo'}</span></div>
      ${plan.descricao ? `<p class="meta">${escapeHTML(plan.descricao)}</p>` : ''}
      <div class="actions">
        <button class="mini-btn" data-edit-plan="${plan.id}">Editar</button>
      </div>
    </article>
  `).join('') : empty('Cadastre planos para organizar aulas e mensalidades.');
}

function renderWaitlist() {
  const status = document.getElementById('waitStatusFilter').value;
  const items = state.waitlist
    .filter((item) => !status || (item.status || 'Novo') === status)
    .sort((a, b) => {
      const priorityA = waitPriority(a);
      const priorityB = waitPriority(b);
      if (priorityA.rank !== priorityB.rank) return priorityA.rank - priorityB.rank;
      if (priorityA.age !== priorityB.age) return priorityB.age - priorityA.age;
      return String(a.nome || '').localeCompare(String(b.nome || ''));
    });
  document.getElementById('waitlistList').innerHTML = items.length ? items.map((item) => {
    const priority = waitPriority(item);
    const age = priority.age;
    const needsReply = priority.rank === 0;
    const queue = item.aula_id ? state.waitlist.filter((entry) => String(entry.aula_id) === String(item.aula_id) && ['Novo', 'Contatado', 'Experimental marcado'].includes(entry.status || 'Novo')).sort((a, b) => String(a.data_cadastro || '').localeCompare(String(b.data_cadastro || '')) || String(a.id).localeCompare(String(b.id))) : [];
    const position = item.aula_id ? queue.findIndex((entry) => String(entry.id) === String(item.id)) + 1 : 0;
    return `
    <article class="row-card wait-row wait-${cssToken(item.status || 'Novo')} ${needsReply ? 'wait-needs-reply' : ''}">
      <div>
        <h3>${escapeHTML(item.nome)}</h3>
        <p class="meta">${escapeHTML(item.telefone || 'sem telefone')} - ${item.aula_data ? `aula ${formatDate(item.aula_data)} as ${escapeHTML(item.aula_horario || '')} - ${escapeHTML(item.aula_turma || 'Turma')}` : escapeHTML(item.preferencia || 'sem preferencia')}</p>
        <div class="pill-row">
          <span class="pill ${priority.className}">${escapeHTML(priority.label)}</span>
          <span class="pill ${item.status === 'Convertido' ? 'ok' : item.status === 'Contatado' || item.status === 'Experimental marcado' ? 'warn' : item.status === 'Perdido' ? 'bad' : ''}">${escapeHTML(item.status || 'Novo')}</span>
          ${item.data_cadastro ? `<span class="pill">${formatDate(item.data_cadastro)}</span>` : ''}
          ${position ? `<span class="pill warn">posicao ${position}</span>` : ''}
          <span class="pill ${needsReply ? 'bad' : age ? 'warn' : ''}">${age || 0} dia(s)</span>
          ${needsReply ? '<span class="pill bad">responder hoje</span>' : ''}
        </div>
        ${item.observacao ? `<p class="meta">${escapeHTML(item.observacao)}</p>` : ''}
      </div>
      <div class="actions">
        ${item.telefone ? `<a class="mini-btn" href="${whatsappUrl(item.telefone, `Oi ${item.nome}, tudo bem? Aqui é do Team Lucão. Ainda tem interesse em começar as aulas?`)}" target="_blank" rel="noopener">WhatsApp</a>` : ''}
        <button class="mini-btn" data-wait-status="${item.id}:Contatado">Contatado</button>
        <button class="mini-btn" data-wait-status="${item.id}:Experimental marcado">Experimental</button>
        <button class="mini-btn" data-edit-wait="${item.id}">Editar</button>
        <button class="mini-btn" data-convert-wait="${item.id}">Virar aluno</button>
        <button class="mini-btn danger-mini" data-wait-status="${item.id}:Perdido">Perdido</button>
      </div>
    </article>
  `;
  }).join('') : empty('Sem interessados em espera.');
}

function renderReports() {
  const month = selectedPaymentMonth();
  const index = getStateIndex();
  const monthPayments = index.paymentsByMonth.get(month) || [];
  const paidThisMonth = monthPayments.reduce((sum, item) => sum + Number(item.valor || 0), 0);
  const activeStudents = index.activeStudents;
  const pending = activeStudents.filter((student) => !isPaidForMonth(student, month));
  const active = state.students.filter((student) => student.status === 'Ativo').length;
  const trial = state.students.filter((student) => student.status === 'Experimental').length;
  const monthClasses = state.classes.filter((item) => String(item.data || '').startsWith(month) && item.status !== 'Cancelada');
  const expectedRevenue = activeStudents.reduce((sum, student) => sum + Number(student.mensalidade || 0), 0);
  const pendingValue = pending.reduce((sum, student) => sum + Number(student.mensalidade || 0), 0);
  const monthExpectedAttendance = monthClasses.reduce((sum, item) => sum + classStudents(item).length, 0);
  const monthPresent = monthClasses.reduce((sum, item) => (
    sum + classStudents(item).filter((student) => item.presencas?.[student.aluno_id || student.id] || student.presente).length
  ), 0);
  const monthExtras = monthClasses.reduce((sum, item) => sum + classExtras(item).length, 0);
  const attendanceRate = monthExpectedAttendance ? Math.round((monthPresent / monthExpectedAttendance) * 100) : 0;
  const pendingBookings = index.pendingBookings.length;
  const approvedBookings = index.approvedBookings.length;
  const waitingOpen = state.waitlist.filter((item) => !['Convertido', 'Perdido'].includes(item.status || 'Novo')).length;
  const totalAttendances = state.classes.reduce((sum, item) => {
    const presencas = item.presencas || {};
    return sum + Object.values(presencas).filter(Boolean).length;
  }, 0);
  const reportItems = [
    ['Alunos ativos', active],
    ['Experimentais', trial],
    ['Pendências', pending.length],
    ['Recebido no mês', money.format(paidThisMonth)],
    ['Presenças marcadas', totalAttendances]
  ];
  document.getElementById('reportGrid').innerHTML = reportItems.map(([label, value]) => `
    <article class="mini-stat"><span>${label}</span><strong>${escapeHTML(value)}</strong></article>
  `).join('');

  document.getElementById('operationReport').innerHTML = `
    <article class="operation-card">
      <div>
        <span class="section-label">Fechamento do mes</span>
        <h3>${escapeHTML(month)}</h3>
        <p class="meta">Resumo pronto para revisar a operação e copiar para o professor.</p>
      </div>
      <div class="operation-grid">
        <span><strong>${money.format(expectedRevenue)}</strong><small>previsao</small></span>
        <span><strong>${money.format(paidThisMonth)}</strong><small>recebido</small></span>
        <span><strong>${money.format(pendingValue)}</strong><small>a receber</small></span>
        <span><strong>${attendanceRate}%</strong><small>presenca</small></span>
        <span><strong>${monthClasses.length}</strong><small>aulas</small></span>
        <span><strong>${monthExtras}</strong><small>avulsos</small></span>
        <span><strong>${pendingBookings}/${approvedBookings}</strong><small>pedidos</small></span>
        <span><strong>${waitingOpen}</strong><small>em espera</small></span>
      </div>
      <div class="actions">
        <button class="mini-btn" data-copy-report="month">Copiar fechamento</button>
        <button class="mini-btn" data-action="payments">Ver cobranças</button>
        <button class="mini-btn" data-backup>Backup JSON</button>
        <button class="mini-btn" data-server-backup>Backup servidor</button>
      </div>
    </article>
  `;

  const attendanceRows = state.students.map((student) => {
    const summary = index.attendanceByStudent.get(String(student.id)) || { enrolled: 0, present: 0 };
    const enrolled = summary.enrolled;
    const present = summary.present;
    const rate = enrolled ? Math.round((present / enrolled) * 100) : 0;
    return { student, enrolled, present, rate };
  }).sort((a, b) => b.enrolled - a.enrolled || a.student.nome.localeCompare(b.student.nome));

  document.getElementById('attendanceReport').innerHTML = attendanceRows.length ? attendanceRows.map((item) => `
    <article class="row-card compact-row">
      <div>
        <h3>${escapeHTML(item.student.nome)}</h3>
        <p class="meta">${item.present}/${item.enrolled} presenças - ${item.rate}% de comparecimento</p>
      </div>
      <div class="pill-row"><span class="pill ${item.rate >= 70 ? 'ok' : item.enrolled ? 'warn' : ''}">${item.enrolled ? 'com histórico' : 'sem aulas'}</span></div>
    </article>
  `).join('') : empty('Cadastre alunos para gerar relatório.');

  const attentionRows = [
    ...pending.map((student) => ({
      title: student.nome,
      text: `${money.format(Number(student.mensalidade || 0))} pendente`,
      tag: 'pagamento'
    })),
    ...state.waitlist.filter((item) => (item.status || 'Novo') !== 'Convertido').map((item) => ({
      title: item.nome,
      text: item.preferencia || 'Interessado sem preferencia',
      tag: item.status || 'Novo'
    }))
  ];
  document.getElementById('attentionReport').innerHTML = attentionRows.length ? attentionRows.map((item) => `
    <article class="row-card compact-row">
      <div>
        <h3>${escapeHTML(item.title)}</h3>
        <p class="meta">${escapeHTML(item.text)}</p>
      </div>
      <div class="pill-row"><span class="pill bad">${escapeHTML(item.tag)}</span></div>
    </article>
  `).join('') : empty('Nenhum ponto de atenção agora.');
}

function studentCard(student) {
  return studentCardModule(getAppContext(), student);
}

function classRow(item) {
  const enrolled = classStudents(item);
  const present = enrolled.filter((student) => item.presencas?.[student.aluno_id || student.id] || student.presente).length;
  const extras = classExtras(item);
  const confirmation = classConfirmationStats(item);
  const [operationTone, operationLabel] = classOperationStatus(item);
  return `
    <article class="row-card class-row class-${cssToken(item.status || 'Marcada')} type-${cssToken(classType(item))}">
      <div>
        <h3>${formatDate(item.data)} às ${item.horario} - ${escapeHTML(item.turma || 'Turma')}</h3>
        <p class="meta">${escapeHTML(item.professor || 'Professor nao informado')} - ${enrolled.length}/${item.capacidade || 8} aluno(s) previstos</p>
        <div class="pill-row">
          <span class="pill ${operationTone}">${escapeHTML(operationLabel)}</span>
          <span class="pill">${present}/${enrolled.length} presenças</span>
          <span class="pill ok">${confirmation.yes} vão</span>
          ${confirmation.pendingTeacher ? `<span class="pill warn">${confirmation.pendingTeacher} aguardando professor</span>` : ''}
          ${confirmation.no ? `<span class="pill bad">${confirmation.no} não vão</span>` : ''}
          ${confirmation.open ? `<span class="pill warn">${confirmation.open} sem resposta</span>` : ''}
          ${extras.length ? `<span class="pill warn">${extras.length} fora da lista</span>` : ''}
          <span class="pill warn">${escapeHTML(classType(item))}</span>
          <span class="pill">${escapeHTML(item.status || 'Marcada')}</span>
          ${item.data === todayISO() ? '<span class="pill ok">hoje</span>' : ''}
        </div>
        ${enrolled.length || extras.length ? `
          <div class="roster-list class-roster">
            ${enrolled.map((student) => rosterPerson(student, item.data, Boolean(item.presencas?.[student.aluno_id || student.id] || student.presente))).join('')}
            ${extras.map((extra) => `<span class="roster-person extra"><strong>${escapeHTML(extra.nome || extra)}</strong><small>${escapeHTML(extraType(extra))}</small></span>`).join('')}
          </div>
        ` : ''}
      </div>
      <div class="actions">
        <a class="mini-btn" href="${whatsappShareUrl(classShareText(item))}" target="_blank" rel="noopener">WhatsApp</a>
        <button class="mini-btn" data-attendance="${item.id}">Presenças</button>
        ${classStatusActions(item)}
        <button class="mini-btn" data-copy-class="${item.id}">Copiar</button>
        <button class="mini-btn" data-open-group-message="${item.id}">Avisar grupo</button>
        <button class="mini-btn" data-edit-class="${item.id}">Editar</button>
      </div>
    </article>
  `;
}

function classStatusActions(item) {
  const id = escapeHTML(item.id);
  if (item.status === 'Finalizada') {
    return `<button class="mini-btn" data-class-status="${id}:Marcada">Reabrir</button>`;
  }
  if (item.status === 'Cancelada') {
    return `<button class="mini-btn" data-class-status="${id}:Marcada">Reativar</button>`;
  }
  if (item.status === 'Confirmada') return `<button class="mini-btn" data-class-status="${id}:Finalizada">Finalizar</button><button class="mini-btn danger-mini" data-cancel-class="${id}">Cancelar</button>`;
  return `<button class="mini-btn" data-class-status="${id}:Confirmada">Confirmar</button><button class="mini-btn danger-mini" data-cancel-class="${id}">Cancelar</button>`;
}

function rosterPerson(student, dateIso, present = false) {
  const id = student.aluno_id || student.id;
  const fullStudent = studentById(id) || student;
  const count = weeklyAttendanceCount(id, dateIso);
  const target = planWeeklyTarget(fullStudent);
  const confirmation = student.confirmado || student.confirmacao || '';
  const confirmationText = confirmation === 'sim' ? 'vai' : confirmation === 'nao' ? 'nao vai' : 'sem resposta';
  const confirmationClass = confirmation === 'sim' ? 'confirm-yes' : confirmation === 'nao' ? 'confirm-no' : '';
  return `
    <span class="roster-person ${present ? 'present' : ''} ${confirmationClass}">
      <button type="button" data-report-student="${id}">${escapeHTML(student.nome)}</button>
      <small>${count}/${target || '-'} na semana - ${confirmationText}</small>
    </span>
  `;
}

function empty(text) {
  return `<div class="empty"><span>Sem dados</span><strong>${escapeHTML(text)}</strong></div>`;
}

function sortClass(a, b) {
  return `${a.data}T${a.horario}`.localeCompare(`${b.data}T${b.horario}`);
}

function escapeHTML(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char]));
}

function openModal(id) {
  const modalWrap = document.getElementById(id);
  if (!modalWrap) return;
  if (!document.querySelector('.modal-wrap.open') && document.activeElement instanceof HTMLElement) {
    lastModalTrigger = document.activeElement;
  }
  document.querySelectorAll('.modal-wrap.open').forEach((modal) => {
    if (modal.id !== id) {
      modal.classList.remove('open');
      modal.setAttribute('aria-hidden', 'true');
    }
  });
  modalWrap.classList.add('open');
  modalWrap.setAttribute('aria-hidden', 'false');
  document.body.classList.add('modal-open');
  const modal = modalWrap.querySelector('.modal');
  if (modal) modal.scrollTop = 0;
  requestAnimationFrame(() => {
    modalWrap.querySelector('input:not([type="hidden"]), select, textarea, button.close')?.focus();
  });
}

function closeModal(id) {
  const modalWrap = document.getElementById(id);
  if (!modalWrap) return;
  modalWrap.classList.remove('open');
  modalWrap.setAttribute('aria-hidden', 'true');
  if (!document.querySelector('.modal-wrap.open')) {
    document.body.classList.remove('modal-open');
    if (lastModalTrigger?.isConnected && !lastModalTrigger.disabled) lastModalTrigger.focus();
    lastModalTrigger = null;
  }
}

function renderPlanOptions(selected = '') {
  const options = state.plans.map((plan) => `<option value="${plan.id}" ${String(plan.id) === String(selected) ? 'selected' : ''}>${escapeHTML(plan.nome)} - ${money.format(Number(plan.preco || 0))}</option>`).join('');
  const studentPlan = document.getElementById('studentPlan');
  if (studentPlan) studentPlan.innerHTML = `<option value="">Sem plano</option>${options}`;
}

function fixedDayOptions(selected = '') {
  return [
    ['', 'Selecione o dia'], ['1', 'Segunda'], ['2', 'Terça'], ['3', 'Quarta'],
    ['4', 'Quinta'], ['5', 'Sexta'], ['6', 'Sábado'], ['0', 'Domingo']
  ].map(([value, label]) => `<option value="${value}" ${String(selected) === value ? 'selected' : ''}>${label}</option>`).join('');
}

function fixedScheduleRow(schedule = {}, index = 0) {
  return `
    <div class="fixed-schedule-row" data-fixed-schedule-row>
      <label>Dia da semana
        <select class="student-fixed-day" aria-label="Dia fixo ${index + 1}">${fixedDayOptions(schedule.dia)}</select>
      </label>
      <label>Horário
        <input class="student-fixed-time" type="time" list="classTimeOptions" value="${escapeHTML(schedule.horario || '')}" aria-label="Horário fixo ${index + 1}" />
      </label>
      <label class="fixed-schedule-group-field">Turma (opcional)
        <input class="student-fixed-group" value="${escapeHTML(schedule.turma || '')}" placeholder="Ex: Iniciante" aria-label="Turma fixa ${index + 1}" />
      </label>
      <button class="icon-btn fixed-schedule-remove" type="button" data-remove-fixed-schedule aria-label="Remover este dia" title="Remover este dia">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
      </button>
    </div>
  `;
}

function renderStudentFixedScheduleRows(schedules = []) {
  const target = document.getElementById('studentFixedSchedules');
  if (!target) return;
  const rows = schedules.length ? schedules : [{}];
  target.innerHTML = rows.slice(0, 7).map(fixedScheduleRow).join('');
}

function studentFormScheduleRows() {
  return [...document.querySelectorAll('[data-fixed-schedule-row]')].map((row) => ({
    dia: row.querySelector('.student-fixed-day')?.value ?? '',
    horario: row.querySelector('.student-fixed-time')?.value || '',
    turma: row.querySelector('.student-fixed-group')?.value.trim() || ''
  }));
}

function studentFormScheduleDraft() {
  const level = document.getElementById('studentLevel')?.value || 'Turma fixa';
  const agendas_fixas = studentFormScheduleRows()
    .filter((schedule) => schedule.dia !== '' && Boolean(schedule.horario))
    .map((schedule) => ({ ...schedule, turma: schedule.turma || level }));
  const primary = agendas_fixas[0] || {};
  return {
    agendas_fixas,
    dia_fixo: primary.dia || '',
    horario_fixo: primary.horario || '',
    turma_fixa: primary.turma || ''
  };
}

function renderStudentSchedulePreview() {
  const target = document.getElementById('studentSchedulePreview');
  if (!target) return;
  const draft = studentFormScheduleDraft();
  const rows = studentFormScheduleRows();
  const incomplete = rows.some((schedule) => Boolean(schedule.dia || schedule.horario || schedule.turma) && !(schedule.dia !== '' && schedule.horario));
  if (!draft.agendas_fixas.length && !incomplete) {
    target.innerHTML = '<span>Agenda opcional</span><strong>Adicione os dias em que este aluno treina toda semana.</strong>';
    target.className = 'schedule-preview schedule-preview-empty';
    return;
  }
  if (incomplete) {
    target.innerHTML = '<span>Agenda incompleta</span><strong>Em cada linha preenchida, escolha o dia e o horário.</strong>';
    target.className = 'schedule-preview schedule-preview-warn';
    return;
  }
  target.className = 'schedule-preview schedule-preview-ok';
  target.innerHTML = `
    <span>${draft.agendas_fixas.length} dia(s) por semana</span>
    <div class="schedule-preview-list">
      ${draft.agendas_fixas.map((schedule) => `
        <div class="schedule-preview-item">
          <strong>${escapeHTML([weekdayName(schedule.dia), schedule.horario, schedule.turma].filter(Boolean).join(' - '))}</strong>
          <div class="schedule-preview-dates">
            ${fixedScheduleOccurrences({ agendas_fixas: [schedule] }, 4).map((item) => `<small>${formatDate(item.data)}</small>`).join('')}
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

function openStudent(id = '') {
  openStudentModule(getAppContext(), id);
}

function openStudentReport(id) {
  openStudentReportModule(getAppContext(), id);
}

function reportClassLine(item, showPresence = false, studentId = '') {
  const entry = studentClassEntry(item, studentId);
  const [confirmClass, confirmText] = confirmationLabel(entry.confirmado || entry.confirmacao || '');
  return `
    <article class="row-card compact-row">
      <div>
        <h3>${formatDate(item.data)} ${escapeHTML(item.horario)} - ${escapeHTML(item.turma || 'Turma')}</h3>
        <p class="meta">${escapeHTML(item.professor || 'Professor nao informado')} - ${escapeHTML(classType(item))}</p>
      </div>
      <div class="pill-row">
        <span class="pill ${confirmClass}">${confirmText}</span>
        ${showPresence ? `<span class="pill ${item.wasPresent ? 'ok' : 'warn'}">${item.wasPresent ? 'presente' : 'faltou'}</span>` : ''}
      </div>
    </article>
  `;
}

function openClass(id = '') {
  const item = classById(id) || {};
  document.getElementById('classId').value = item.id || '';
  document.getElementById('classDate').value = item.data || todayISO();
  document.getElementById('classTime').value = item.horario || '18:30';
  document.getElementById('classGroup').value = item.turma || '';
  document.getElementById('classCoach').value = item.professor || '';
  document.getElementById('classType').value = classType(item);
  document.getElementById('classCapacity').value = item.capacidade || 8;
  document.getElementById('classStatus').value = item.status || 'Marcada';
  document.getElementById('classRecurrence').value = item.id ? 'once' : 'weekly';
  document.getElementById('classRepeatWeeks').value = item.id ? 1 : 4;
  document.getElementById('classRepeatWeeks').disabled = Boolean(item.id);
  document.getElementById('classNotice').value = item.observacao || '';
  const classSearch = document.getElementById('classStudentSearch');
  if (classSearch) classSearch.value = '';
  fillClassStudents(item.aluno_ids || []);
  const rainBtn = document.getElementById('btnCancelRain');
  if (rainBtn) {
    rainBtn.style.display = item.id ? 'block' : 'none';
    rainBtn.onclick = () => {
      cancelClassDueToRain(item.id, () => localStorage.getItem(PIN_KEY), toast, () => {
        closeModal('classModal');
        loadData();
      });
    };
  }
  openModal('classModal');
}

function mondayOfIso(dateIso = todayISO()) {
  const date = new Date(`${dateIso}T12:00:00`);
  const day = date.getDay();
  return addDaysIso(dateIso, day === 0 ? -6 : 1 - day);
}

function renderScheduleSlots() {
  const target = document.getElementById('scheduleSlots');
  if (!target) return;
  target.innerHTML = STANDARD_CLASS_SLOTS.map((day) => `
    <div class="schedule-slot-day">
      <strong>${day.label}</strong>
      <div>${day.times.map((time) => `<label><input type="checkbox" data-schedule-slot="${day.day}:${time}" checked /><span>${time}</span></label>`).join('')}</div>
    </div>
  `).join('');
}

function openSchedule() {
  document.getElementById('scheduleStart').value = mondayOfIso(addDaysIso(todayISO(), 1));
  document.getElementById('scheduleWeeks').value = 4;
  document.getElementById('scheduleGroup').value = 'Turma Arena';
  document.getElementById('scheduleCoach').value = 'Lucao';
  document.getElementById('scheduleCapacity').value = 8;
  document.getElementById('scheduleType').value = 'Regular';
  document.getElementById('scheduleNotify').checked = true;
  renderScheduleSlots();
  openModal('scheduleModal');
}

async function withModalLoading({ submitButton, modalId, operation, successText = 'Salvo com sucesso!', successToast = 'Salvo com sucesso!' }) {
  if (submitButton?.disabled) return;
  const originalHtml = submitButton?.innerHTML || '';
  if (submitButton) {
    submitButton.disabled = true;
    submitButton.classList.add('btn-loading');
    submitButton.innerHTML = `
      <svg class="spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
      </svg>
      <span>Salvando no servidor...</span>
    `;
  }
  try {
    await operation();
    if (submitButton) {
      submitButton.classList.remove('btn-loading');
      submitButton.classList.add('btn-saved');
      submitButton.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
        <span>${escapeHTML(successText)}</span>
      `;
      await new Promise((resolve) => setTimeout(resolve, 400));
    }
    if (modalId) closeModal(modalId);
    if (successToast) toast(successToast, 'ok');
  } catch (err) {
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.classList.remove('btn-loading');
      submitButton.classList.remove('btn-saved');
      submitButton.innerHTML = originalHtml;
    }
    throw err;
  } finally {
    if (submitButton) {
      setTimeout(() => {
        submitButton.disabled = false;
        submitButton.classList.remove('btn-loading');
        submitButton.classList.remove('btn-saved');
        submitButton.innerHTML = originalHtml;
      }, 450);
    }
  }
}

async function saveSchedule(event) {
  event.preventDefault();
  const submitButton = event.currentTarget.querySelector('button[type="submit"]') || event.submitter;
  const start = mondayOfIso(document.getElementById('scheduleStart').value || todayISO());
  const weeks = Math.min(12, Math.max(1, Number(document.getElementById('scheduleWeeks').value || 1)));
  const group = document.getElementById('scheduleGroup').value.trim() || 'Turma Arena';
  const coach = document.getElementById('scheduleCoach').value.trim();
  const capacity = Math.min(30, Math.max(1, Number(document.getElementById('scheduleCapacity').value || 8)));
  const type = document.getElementById('scheduleType').value || 'Regular';
  const selectedSlots = [...document.querySelectorAll('[data-schedule-slot]:checked')].map((input) => {
    const raw = input.dataset.scheduleSlot;
    const separator = raw.indexOf(':');
    return { day: Number(raw.slice(0, separator)), time: raw.slice(separator + 1) };
  });
  if (!selectedSlots.length) throw new Error('Selecione pelo menos um horário');
  const created = [];
  for (let week = 0; week < weeks; week += 1) {
    for (const slot of selectedSlots) {
      const date = addDaysIso(start, week * 7 + slot.day - 1);
      const duplicate = state.classes.find((item) => item.data === date && item.horario === slot.time && String(item.turma || '') === group);
      if (duplicate) continue;
      const payload = {
        data: date,
        horario: slot.time,
        turma: group,
        professor: coach,
        tipo: type,
        capacidade: capacity,
        status: 'Marcada',
        observacao: 'Criada pela grade padrão.',
        aluno_ids: [],
        presencas: {},
        extra_presentes: []
      };
      if (apiMode) {
        const result = await api('/api/classes', { method: 'POST', body: JSON.stringify(payload) });
        created.push(result.item);
      } else {
        created.push({ ...payload, id: uid() });
      }
    }
  }

  await withModalLoading({
    submitButton,
    modalId: 'scheduleModal',
    successText: 'Grade gerada!',
    successToast: created.length ? `${created.length} aulas criadas na grade com sucesso!` : 'A grade padrão já estava criada.',
    operation: async () => {
      if (!apiMode) {
        state.classes.push(...created);
        recordAction('Professor', 'Grade criada', `${created.length} aulas criadas na grade padrão.`);
        saveAndRender();
      } else {
        await loadData();
      }
    }
  });

  if (created.length && document.getElementById('scheduleNotify').checked) openGroupMessage(created[0].id);
}

function openPlan(id = '') {
  const plan = planById(id) || {};
  document.getElementById('planId').value = plan.id || '';
  document.getElementById('planName').value = plan.nome || '';
  document.getElementById('planPrice').value = plan.preco || '';
  document.getElementById('planClasses').value = plan.aulas_semana ?? '';
  document.getElementById('planDescription').value = plan.descricao || '';
  openModal('planModal');
}

function openWaitlist() {
  document.getElementById('waitId').value = '';
  document.getElementById('waitName').value = '';
  document.getElementById('waitPhone').value = '';
  document.getElementById('waitPreference').value = '';
  document.getElementById('waitStatus').value = 'Novo';
  document.getElementById('waitNote').value = '';
  openModal('waitlistModal');
}

function openWaitItem(id) {
  const item = state.waitlist.find((entry) => String(entry.id) === String(id));
  if (!item) return;
  document.getElementById('waitId').value = item.id || '';
  document.getElementById('waitName').value = item.nome || '';
  document.getElementById('waitPhone').value = item.telefone || '';
  document.getElementById('waitPreference').value = item.preferencia || '';
  document.getElementById('waitStatus').value = item.status || 'Novo';
  document.getElementById('waitNote').value = item.observacao || '';
  openModal('waitlistModal');
}

async function copyText(text, message = 'Texto copiado') {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
  } else {
    const helper = document.createElement('textarea');
    helper.value = text;
    helper.setAttribute('readonly', '');
    helper.style.position = 'fixed';
    helper.style.opacity = '0';
    document.body.appendChild(helper);
    helper.select();
    const copied = document.execCommand('copy');
    helper.remove();
    if (!copied) throw new Error('Nao foi possivel copiar o texto');
  }
  toast(message);
}

async function recordOperationalAction(action, detail, actor = 'Professor') {
  recordAction(actor, action, detail);
  if (apiMode) {
    api('/api/logs', { method: 'POST', body: JSON.stringify({ acao: action, detalhe: detail, ator: actor }) })
      .then(() => refreshActions({ force: true }))
      .catch(() => {});
  } else {
    saveLocalState();
  }
  const page = document.documentElement.dataset.page;
  if (page === 'actions' || page === 'dashboard') renderPage(page);
}

function pendingChargeText(month = selectedPaymentMonth()) {
  const pending = state.students.filter((student) => student.status !== 'Pausado' && !isPaidForMonth(student, month));
  if (!pending.length) return `Sem mensalidades pendentes em ${month}.`;
  return pending.map((student) => (
    `${student.nome} - ${student.telefone || 'sem telefone'} - ${money.format(Number(student.mensalidade || 0))} - ref. ${month} - vence dia ${dueDay(student)}`
  )).join('\n');
}

function studentChargeText(student, month = selectedPaymentMonth()) {
  const urgency = paymentUrgency(student, month);
  const due = dueDateForMonth(student, month);
  const status = urgency.days > 0 ? `esta em aberto desde ${formatDate(due)}` : urgency.days === 0 ? 'vence hoje' : `vence em ${formatDate(due)}`;
  return `Oi ${student.nome}, tudo bem? Passando para lembrar da mensalidade do Team Lucão referente a ${month}, no valor de ${money.format(Number(student.mensalidade || 0))}. Ela ${status}.`;
}

function sortedPaymentStudents(month = selectedPaymentMonth()) {
  return getStateIndex().activeStudents.slice().sort((a, b) => {
    const priorityA = paymentPriority(a, month);
    const priorityB = paymentPriority(b, month);
    if (priorityA.rank !== priorityB.rank) return priorityA.rank - priorityB.rank;
    const urgencyA = paymentUrgency(a, month).days;
    const urgencyB = paymentUrgency(b, month).days;
    if (urgencyA !== urgencyB) return urgencyB - urgencyA;
    return String(a.nome || '').localeCompare(String(b.nome || ''));
  });
}

async function copyPendingCharges() {
  const month = selectedPaymentMonth();
  const text = pendingChargeText();
  await copyText(text, 'Lista de cobrança copiada');
  await recordOperationalAction('Cobranca copiada', `Lista de mensalidades pendentes copiada para ${month}.`);
  setPage('payments');
}

function monthlyOperationText(month = selectedPaymentMonth()) {
  const activeStudents = state.students.filter((student) => student.status !== 'Pausado');
  const pending = activeStudents.filter((student) => !isPaidForMonth(student, month));
  const monthPayments = (state.payments || []).filter((item) => paymentMonth(item) === month);
  const monthClasses = state.classes.filter((item) => String(item.data || '').startsWith(month) && item.status !== 'Cancelada');
  const expectedRevenue = activeStudents.reduce((sum, student) => sum + Number(student.mensalidade || 0), 0);
  const paidThisMonth = monthPayments.reduce((sum, item) => sum + Number(item.valor || 0), 0);
  const pendingValue = pending.reduce((sum, student) => sum + Number(student.mensalidade || 0), 0);
  const expectedAttendance = monthClasses.reduce((sum, item) => sum + classStudents(item).length, 0);
  const present = monthClasses.reduce((sum, item) => (
    sum + classStudents(item).filter((student) => item.presencas?.[student.aluno_id || student.id] || student.presente).length
  ), 0);
  const rate = expectedAttendance ? Math.round((present / expectedAttendance) * 100) : 0;
  const extras = monthClasses.reduce((sum, item) => sum + classExtras(item).length, 0);
  const pendingBookings = (state.bookings || []).filter((item) => (item.status || 'Pendente') === 'Pendente').length;
  const approvedBookings = (state.bookings || []).filter((item) => (item.status || '') === 'Aprovado').length;
  const waitingOpen = state.waitlist.filter((item) => !['Convertido', 'Perdido'].includes(item.status || 'Novo')).length;
  return [
    `Fechamento Team Lucao - ${month}`,
    `Alunos ativos: ${state.students.filter((student) => student.status === 'Ativo').length}`,
    `Receita prevista: ${money.format(expectedRevenue)}`,
    `Recebido: ${money.format(paidThisMonth)}`,
    `A receber: ${money.format(pendingValue)} (${pending.length} aluno(s))`,
    `Aulas no mes: ${monthClasses.length}`,
    `Presenças: ${present}/${expectedAttendance} (${rate}%)`,
    `Avulsos/fora da lista: ${extras}`,
    `Pedidos pendentes/aprovados: ${pendingBookings}/${approvedBookings}`,
    `Interessados em aberto: ${waitingOpen}`
  ].join('\n');
}

async function copyMonthlyReport() {
  const month = selectedPaymentMonth();
  await copyText(monthlyOperationText(month), 'Fechamento copiado');
  await recordOperationalAction('Fechamento copiado', `Fechamento operacional de ${month} foi copiado.`);
}

async function copyStudentCharge(studentId) {
  const student = studentById(studentId);
  if (!student) return;
  const text = studentChargeText(student);
  await copyText(text, 'Cobranca copiada');
  await recordOperationalAction('Cobranca individual', `Cobranca de ${student.nome} foi copiada.`);
}

function classShareText(item) {
  const enrolled = classStudents(item);
  const names = enrolled.length ? enrolled.map((student, index) => `${index + 1}. ${student.nome}`).join('\n') : 'Sem alunos previstos.';
  return `Aula Team Lucão\n${formatDate(item.data)} às ${item.horario} - ${item.turma || 'Turma'} (${classType(item)})\nProfessor: ${item.professor || 'não informado'}\n\nPrevistos:\n${names}`;
}

function classGroupMessageText(item, template = 'confirm') {
  if (template === 'morning_summary' || template === 'evening_summary') {
    const todayClasses = [...state.classes].filter((c) => c.data === todayISO() && c.status !== 'Cancelada').sort(sortClass);
    const dateFormatted = todayISO().split('-').reverse().slice(0, 2).join('/');
    const portalUrl = 'https://teamlucaofuturo.pages.dev/aluno';

    if (template === 'morning_summary') {
      let msg = `☀️ *Bom dia, galera do Team Lucão!* 🏐\n\n`;
      msg += `Confiram os treinos de hoje e confirmem suas presenças na Área do Aluno:\n👉 ${portalUrl}\n\n`;
      msg += `📅 *TREINOS DE HOJE (${dateFormatted})*:\n`;
      if (todayClasses.length === 0) {
        msg += `_Nenhum treino agendado para hoje._\n`;
      } else {
        todayClasses.forEach((c) => {
          const students = classStudents(c);
          const confirmed = students.filter((s) => c.presencas?.[s.aluno_id || s.id] === 'sim' || s.confirmado === 'sim');
          const cap = Number(c.capacidade || 8);
          const open = Math.max(0, cap - confirmed.length);
          const status = open === 0 ? '❌ *LOTADA*' : `✅ *${open} vaga(s)*`;
          msg += `▫️ *${c.horario}* - ${c.turma || 'Turma'} (${confirmed.length}/${cap}) • ${status}\n`;
          if (confirmed.length > 0) {
            msg += `   👥 _${confirmed.map((s) => (s.nome || '').trim().split(' ')[0]).join(', ')}_\n`;
          }
        });
      }
      msg += `\n⚠️ _Se for faltar, desmarque pelo link com antecedência para liberar a vaga pro parceiro!_ 👊`;
      return msg;
    } else {
      let msg = `🔥 *Chamada pros treinos de hoje à noite!* 🏐\n\n`;
      msg += `Fique por dentro das turmas e garanta sua vaga de última hora:\n👉 ${portalUrl}\n\n`;
      msg += `📅 *QUADRO DE HOJE À NOITE (${dateFormatted})*:\n`;
      if (todayClasses.length === 0) {
        msg += `_Nenhum treino agendado para hoje._\n`;
      } else {
        todayClasses.forEach((c) => {
          const students = classStudents(c);
          const confirmed = students.filter((s) => c.presencas?.[s.aluno_id || s.id] === 'sim' || s.confirmado === 'sim');
          const cap = Number(c.capacidade || 8);
          const open = Math.max(0, cap - confirmed.length);
          const status = open === 0 ? '❌ *LOTADA*' : `⚡ *${open} vaga(s) restante(s)*`;
          msg += `▫️ *${c.horario}* - ${c.turma || 'Turma'} • ${status}\n`;
          if (confirmed.length > 0) {
            msg += `   👥 Confirmados: ${confirmed.map((s) => (s.nome || '').trim().split(' ')[0]).join(', ')}\n`;
          } else {
            msg += `   👥 Nenhum aluno confirmado ainda.\n`;
          }
        });
      }
      msg += `\n📲 _Confirme ou desmarque direto pelo link acima. Bora pro play!_ 🚀`;
      return msg;
    }
  }

  if (!item) {
    if (template === 'cancel') return 'Pessoal, aviso importante: uma aula foi cancelada. Vamos avisar uma nova opcao assim que estiver definida.';
    if (template === 'reminder') return 'Pessoal, lembrete da aula de hoje: cheguem alguns minutos antes para aquecer. Nos vemos na quadra!';
    if (template === 'change') return 'Pessoal, tivemos uma atualizacao na agenda de aulas. Confiram os horarios no painel e avisem qualquer duvida.';
    if (template === 'week') return 'Pessoal, agenda da semana atualizada. Confiram seus horarios no painel e avisem qualquer necessidade de ajuste.';
    return 'Pessoal, confirmando a agenda de aulas. Quem for participar, responda com um ok aqui no grupo. Ate la!';
  }
  const classLine = `${formatDate(item.data)} as ${item.horario} - ${item.turma || 'Turma'}`;
  const reason = item.observacao || 'um imprevisto operacional';
  if (template === 'reminder') return `Pessoal, lembrete da aula de hoje: ${classLine}. Cheguem alguns minutos antes para aquecer. Nos vemos na quadra!`;
  if (template === 'cancel') return `Pessoal, aviso importante: a aula de ${classLine} foi cancelada. Motivo: ${reason}. Vamos avisar uma nova opcao assim que estiver definida.`;
  if (template === 'change') return `Pessoal, o horario da aula foi atualizado para ${classLine}. Por favor, confirmem a leitura no grupo. Qualquer duvida, falem com a equipe.`;
  if (template === 'week') return `Pessoal, agenda da semana: a aula de ${classLine} esta prevista. Confiram seus demais horarios no painel e avisem qualquer necessidade de ajuste.`;
  return `Pessoal, confirmando a aula de ${classLine}. Quem for participar, responda com um ok aqui no grupo. Ate la!`;
}

function openGroupSummary(period = 'morning') {
  renderGroupMessageOptions();
  const templateSelect = document.getElementById('groupMessageTemplate');
  if (templateSelect) {
    templateSelect.value = period === 'morning' ? 'morning_summary' : 'evening_summary';
  }
  updateGroupMessagePreview();
  openModal('groupMessageModal');
}

function renderGroupMessageOptions(selectedId = '') {
  const select = document.getElementById('groupMessageClass');
  if (!select) return;
  const classes = [...state.classes].filter((item) => item.data >= todayISO()).sort(sortClass).slice(0, 80);
  select.innerHTML = classes.length ? classes.map((item) => `<option value="${escapeHTML(item.id)}" ${String(item.id) === String(selectedId) ? 'selected' : ''}>${escapeHTML(publicClassLabel(item))}</option>`).join('') : '<option value="">Nenhuma aula futura</option>';
}

function updateGroupMessagePreview() {
  const classItem = classById(document.getElementById('groupMessageClass')?.value);
  const template = document.getElementById('groupMessageTemplate')?.value || 'confirm';
  const text = classGroupMessageText(classItem, template);
  const field = document.getElementById('groupMessageText');
  if (field) field.value = text;
  const whatsapp = document.getElementById('groupMessageWhatsapp');
  if (whatsapp) whatsapp.href = whatsappShareUrl(text);
}

function openGroupMessage(classId = '') {
  renderGroupMessageOptions(classId);
  const classSelect = document.getElementById('groupMessageClass');
  const selectedClass = classById(classId) || classById(classSelect?.value);
  if (classSelect && selectedClass) classSelect.value = selectedClass.id;
  document.getElementById('groupMessageTemplate').value = selectedClass?.status === 'Cancelada' ? 'cancel' : 'confirm';
  updateGroupMessagePreview();
  openModal('groupMessageModal');
}

async function copyGroupMessage() {
  const text = document.getElementById('groupMessageText')?.value.trim();
  if (!text) throw new Error('Escolha uma aula para gerar a mensagem');
  await copyText(text, 'Mensagem do grupo copiada');
  await recordOperationalAction('Mensagem de grupo copiada', 'Mensagem geral preparada para o grupo da aula.');
}

function classRosterText(item) {
  const enrolled = classStudents(item);
  const extras = classExtras(item);
  const lines = enrolled.map((student, index) => {
    const id = student.aluno_id || student.id;
    const fullStudent = studentById(id) || student;
    return `${index + 1}. ${student.nome} - ${weeklyAttendanceCount(id, item.data)}/${planWeeklyTarget(fullStudent) || '-'} na semana`;
  });
  const extraLines = extras.map((extra, index) => `${extraType(extra)} ${index + 1}: ${extra.nome || extra}`);
  return [
    'Lista da aula - Team Lucão',
    `${formatDate(item.data)} as ${item.horario} - ${item.turma || 'Turma'} (${classType(item)})`,
    `Professor: ${item.professor || 'nao informado'}`,
    '',
    'Previstos:',
    lines.length ? lines.join('\n') : 'Sem alunos previstos.',
    extraLines.length ? `\nFora da lista:\n${extraLines.join('\n')}` : ''
  ].filter(Boolean).join('\n');
}

async function copyClassRoster(classId) {
  const item = classById(classId);
  if (!item) return;
  await copyText(classRosterText(item), 'Lista da aula copiada');
  await recordOperationalAction('Lista da aula copiada', `${item.horario} - ${item.turma || 'Turma'} em ${formatDate(item.data)} teve lista copiada.`);
}

function attendanceSummaryText(item) {
  const enrolled = classStudents(item);
  const present = enrolled.filter((student) => item.presencas?.[student.aluno_id || student.id] || student.presente);
  const presentIds = new Set(present.map((student) => String(student.aluno_id || student.id)));
  const absent = enrolled.filter((student) => !presentIds.has(String(student.aluno_id || student.id)));
  const confirmed = enrolled.filter((student) => (student.confirmado || student.confirmacao) === 'sim');
  const declined = enrolled.filter((student) => (student.confirmado || student.confirmacao) === 'nao');
  const extras = classExtras(item);
  return [
    'Resumo de presenca - Team Lucão',
    `${formatDate(item.data)} as ${item.horario} - ${item.turma || 'Turma'} (${classType(item)})`,
    '',
    `Confirmaram que vao (${confirmed.length}):`,
    confirmed.length ? confirmed.map((student) => `- ${student.nome}`).join('\n') : '- nenhum',
    '',
    `Avisaram que não vão (${declined.length}):`,
    declined.length ? declined.map((student) => `- ${student.nome}`).join('\n') : '- nenhum',
    '',
    `Presentes (${present.length}):`,
    present.length ? present.map((student) => `- ${student.nome}`).join('\n') : '- nenhum marcado',
    '',
    `Faltaram (${absent.length}):`,
    absent.length ? absent.map((student) => `- ${student.nome}`).join('\n') : '- ninguem',
    extras.length ? `\nFora da lista (${extras.length}):\n${extras.map((extra) => `- ${extra.nome || extra} (${extraType(extra)})`).join('\n')}` : ''
  ].filter(Boolean).join('\n');
}

async function copyAttendanceSummary(classId = activeAttendanceClassId) {
  const item = classById(classId);
  if (!item) return;
  await copyText(attendanceSummaryText(item), 'Resumo de presenca copiado');
  await recordOperationalAction('Resumo de presenca copiado', `${item.horario} - ${item.turma || 'Turma'} em ${formatDate(item.data)} teve resumo copiado.`);
}

function whatsappShareUrl(text) {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

function openNextClass() {
  const item = nextClass();
  if (!item) {
    openClass();
    return;
  }
  if ((item.aluno_ids || item.alunos || []).length) openAttendance(item.id);
  else openClass(item.id);
}

function handleQuickAction(action) {
  if (action === 'payments') {
    setPage('payments');
    document.getElementById('paymentStatusFilter').value = 'pending';
    resetPaymentListLimit();
    renderPayments();
    return;
  }
  if (action === 'students-more') {
    studentVisibleLimit += LIST_PAGE_SIZE;
    renderSignatures.delete('students');
    renderStudents();
    return;
  }
  if (action === 'payments-more') {
    paymentVisibleLimit += LIST_PAGE_SIZE;
    renderSignatures.delete('payments');
    renderPayments();
    return;
  }
  if (action === 'actions') {
    setPage('actions');
    return;
  }
  if (action === 'quick-pending') copyPendingCharges().catch((err) => toast(err.message));
  if (action === 'quick-next-class') openNextClass();
  if (action === 'quick-bookings') setPage('bookings');
  if (action === 'quick-waitlist') openWaitlist();
  if (action === 'quick-experimental') {
    setPage('classes');
    document.getElementById('classDateFilter').value = todayISO();
    document.getElementById('classTypeFilter').value = 'Experimental';
    document.getElementById('classStatusFilter').value = '';
    renderClasses();
  }
  if (action === 'quick-class') openClass();
}

function handleFocusAction(action) {
  if (action === 'next-class') {
    openNextClass();
    return;
  }
  if (action === 'payments') {
    setPage('payments');
    document.getElementById('paymentStatusFilter').value = 'pending';
    renderPayments();
    return;
  }
  if (action === 'bookings') {
    setPage('bookings');
    return;
  }
  if (action === 'waitlist') {
    setPage('waitlist');
    return;
  }
  if (action.startsWith('wait:')) {
    setPage('waitlist');
    openWaitItem(action.split(':')[1]);
  }
}

function fillClassStudents(selected = []) {
  const select = document.getElementById('classStudents');
  if (!select) return;
  const selectedSet = new Set(selected.map(String));
  select.innerHTML = state.students.filter((student) => student.status !== 'Pausado').map((student) => (
    `<option value="${student.id}" ${selectedSet.has(String(student.id)) ? 'selected' : ''}>${escapeHTML(student.nome)} - ${escapeHTML(student.plano_nome || 'sem plano')}</option>`
  )).join('');
  renderClassStudentChecklist();
}

function selectedClassStudentIds() {
  return [...document.getElementById('classStudents')?.selectedOptions || []].map((option) => String(option.value));
}

function renderClassStudentChecklist() {
  const list = document.getElementById('classStudentChecklist');
  const count = document.getElementById('classStudentCount');
  const select = document.getElementById('classStudents');
  if (!list || !select) return;
  const selected = new Set(selectedClassStudentIds());
  const query = document.getElementById('classStudentSearch')?.value.trim().toLowerCase() || '';
  const students = state.students
    .filter((student) => student.status !== 'Pausado')
    .filter((student) => {
      const haystack = `${student.nome} ${student.telefone} ${student.plano_nome} ${student.nivel}`.toLowerCase();
      return selected.has(String(student.id)) || !query || haystack.includes(query);
    })
    .sort((a, b) => Number(selected.has(String(b.id))) - Number(selected.has(String(a.id))) || a.nome.localeCompare(b.nome))
    .slice(0, query ? 30 : 18);
  if (count) count.textContent = `${selected.size} selecionado(s)`;
  list.innerHTML = students.length ? students.map((student) => {
    const checked = selected.has(String(student.id));
    const schedule = fixedSchedules(student).map((item) => `${weekdayName(item.dia)} ${item.horario}`).join(', ');
    return `
      <label class="class-student-option ${checked ? 'selected' : ''}">
        <input type="checkbox" value="${student.id}" ${checked ? 'checked' : ''} data-class-student-check />
        <span>
          <strong>${escapeHTML(student.nome)}</strong>
          <small>${escapeHTML(student.plano_nome || 'sem plano')}${schedule ? ` - ${escapeHTML(schedule)}` : ''}</small>
        </span>
      </label>
    `;
  }).join('') : empty('Nenhum aluno encontrado.');
}

function toggleClassStudent(studentId, checked) {
  const option = [...document.getElementById('classStudents')?.options || []].find((item) => String(item.value) === String(studentId));
  if (!option) return;
  option.selected = checked;
  renderClassStudentChecklist();
}

function bookingReplyText(booking, item) {
  const isExp = isExperimentalBooking(booking);
  const classText = item ? `${formatDate(item.data)} às ${item.horario}` : 'a aula solicitada';
  if (isExp) {
    return `Oi ${booking.nome}, tudo bem? Aqui é do Team Lucão Futevôlei! Recebi sua solicitação para a *Aula Experimental* em ${classText}. Sua vaga está confirmada! Te esperamos na quadra.`;
  }
  return `Oi ${booking.nome}, tudo bem? Aqui é do Team Lucão. Recebi seu pedido para ${classText} e confirmei sua vaga!`;
}

function publicClassLabel(item) {
  const used = Number(item.inscritos ?? classStudentIds(item).length);
  const capacity = Number(item.capacidade || 8);
  return `${formatDate(item.data)} ${item.horario} - ${item.turma || 'Turma'} (${used}/${capacity})`;
}

async function sendPublicBooking(payload) {
  if (!payload.nome || !payload.aula_id) throw new Error('Informe nome e aula');
  if (phoneDigits(payload.telefone).length < 8) throw new Error('Informe pelo menos 8 numeros do WhatsApp');
  if (location.protocol !== 'file:') {
    try {
      const res = await fetch('/api/public/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.ok === false) throw new Error(data.error || 'Nao foi possivel enviar');
      publicApiAvailable = true;
      publicClassesCache.expiresAt = 0;
      return data.item;
    } catch (err) {
      if (await detectServer()) throw err;
    }
  }
  const classItem = classById(payload.aula_id);
  if (!classItem) throw new Error('Aula nao encontrada');
  if (classItem.status === 'Cancelada') throw new Error('Aula cancelada');
  const used = classStudentIds(classItem).length;
  if (used >= Number(classItem.capacidade || 8)) throw new Error('Aula lotada');
  state.bookings = state.bookings || [];
  state.bookings.unshift({ id: uid(), ...payload, status: 'Pendente', criado_em: todayISO(), respondido_em: '' });
  recordAction('Aluno', 'Pedido de aula', `${payload.nome} solicitou vaga pelo formulario publico.`);
  saveLocalState();
  return state.bookings[0];
}

async function loadPublicClasses({ force = false } = {}) {
  const now = Date.now();
  if (!force && publicClassesCache.items.length && publicClassesCache.expiresAt > now) return publicClassesCache.items;
  if (location.protocol !== 'file:') {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 900);
    try {
      const res = await fetch('/api/public/classes', { signal: controller.signal });
      const data = await res.json();
      if (res.ok && data.ok) {
        publicApiAvailable = true;
        publicClassesCache.items = data.items || [];
        publicClassesCache.expiresAt = Date.now() + 15000;
        return publicClassesCache.items;
      }
    } catch {
      // local demo fallback
    } finally {
      clearTimeout(timeout);
    }
  }
  publicApiAvailable = false;
  const items = [...state.classes]
    .filter((item) => item.status !== 'Cancelada' && item.data >= todayISO())
    .sort(sortClass)
    .slice(0, 20)
    .map((item) => ({
      ...item,
      inscritos: classStudentIds(item).length,
      espera: state.waitlist.filter((wait) => String(wait.aula_id || '') === String(item.id) && ['Novo', 'Contatado', 'Experimental marcado'].includes(wait.status || 'Novo')).length
    }));
  publicClassesCache.items = items;
  publicClassesCache.expiresAt = Date.now() + 5000;
  return items;
}

async function renderPublicBooking() {
  const select = document.getElementById('bookingClass');
  const list = document.getElementById('bookingClassList');
  if (!select || !list) return;
  select.disabled = true;
  select.innerHTML = '<option value="">Carregando horários...</option>';
  list.setAttribute('aria-busy', 'true');
  list.innerHTML = empty('Carregando horários...');
  const classes = await loadPublicClasses({ force: true });
  const bookingStatus = document.getElementById('bookingStatus');
  const studentStatus = document.getElementById('studentConfirmStatus');
  const hasServer = publicApiAvailable;
  if (!publicApiAvailable && bookingStatus && !bookingStatus.textContent) bookingStatus.textContent = 'Modo demo: pedido fica salvo apenas neste navegador.';
  if (!hasServer && studentStatus && !studentStatus.textContent) studentStatus.textContent = 'Modo demo: confirmação real precisa do servidor online.';
  select.disabled = !classes.length;
  select.innerHTML = classes.length
    ? classes.map((item) => {
      const used = Number(item.inscritos ?? classStudentIds(item).length);
      const capacity = Number(item.capacidade || 8);
      const freeSlots = Math.max(0, capacity - used);
      const available = freeSlots > 0;
      const waiting = Number(item.espera || 0);
      return `<option value="${escapeHTML(item.id)}" ${available ? '' : 'disabled style="color: var(--muted);"'} data-full="${available ? '0' : '1'}">${escapeHTML(publicClassLabel(item))}${available ? ` (${freeSlots} vagas)` : ` - lotada (indisponível)`}</option>`;
    }).join('')
    : '<option value="">Sem horário disponível</option>';
  list.innerHTML = classes.length ? classes.map((item) => {
    const used = Number(item.inscritos ?? classStudentIds(item).length);
    const capacity = Number(item.capacidade || 8);
    const available = Math.max(0, capacity - used);
    const waiting = Number(item.espera || 0);
    return `
      <button class="booking-class-card ${available ? '' : 'is-full'}" type="button" ${available ? '' : 'disabled'} aria-label="${escapeHTML(publicClassLabel(item))}" data-booking-class="${escapeHTML(item.id)}">
        <strong>${formatDate(item.data)} ${escapeHTML(item.horario)}</strong>
        <span>${escapeHTML(item.turma || 'Turma')} - ${escapeHTML(item.tipo || 'Regular')}</span>
        <small>${available ? `${available} vaga(s) livres` : `lotada - ${waiting} na espera; toque para entrar`}</small>
      </button>
    `;
  }).join('') : empty('Nenhuma aula disponível agora.');
  list.setAttribute('aria-busy', 'false');
  updateBookingClassAction();
}

function selectedPublicBookingClass() {
  return document.getElementById('bookingClass')?.selectedOptions?.[0] || null;
}

function updateBookingClassAction() {
  const button = document.getElementById('bookingSubmitButton');
  const option = selectedPublicBookingClass();
  if (!button) return;
  const isFull = option?.dataset.full === '1';
  button.textContent = isFull ? 'Entrar na espera' : 'Solicitar experimental';
  button.classList.toggle('waitlist-submit', isFull);
}

async function submitPublicWaitlist(payload) {
  if (location.protocol !== 'file:') {
    try {
      const res = await fetch('/api/public/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.ok === false) throw new Error(data.error || 'Nao foi possivel entrar na espera');
      publicApiAvailable = true;
      publicClassesCache.expiresAt = 0;
      return data.item;
    } catch (err) {
      if (await detectServer()) throw err;
    }
  }
  const classItem = classById(payload.aula_id);
  if (!classItem) throw new Error('Aula nao encontrada');
  if (classItem.status === 'Cancelada') throw new Error('Aula cancelada');
  if (classStudentIds(classItem).length < Number(classItem.capacidade || 8)) throw new Error('Ainda existe vaga nessa aula');
  const digits = phoneDigits(payload.telefone).slice(-8);
  const duplicate = state.waitlist.find((item) => String(item.aula_id || '') === String(payload.aula_id) && ['Novo', 'Contatado', 'Experimental marcado'].includes(item.status || 'Novo') && phoneDigits(item.telefone).endsWith(digits));
  if (duplicate) throw new Error('Voce ja esta na espera dessa aula');
  const position = state.waitlist.filter((item) => String(item.aula_id || '') === String(payload.aula_id) && ['Novo', 'Contatado', 'Experimental marcado'].includes(item.status || 'Novo')).length + 1;
  const next = { ...payload, id: uid(), status: 'Novo', data_cadastro: todayISO(), posicao: position, preferencia: `${classItem.data} ${classItem.horario} - ${classItem.turma || 'Turma'}` };
  state.waitlist.unshift(next);
  recordAction('Aluno', 'Entrada na espera', `${next.nome} entrou na espera da aula ${classItem.horario} - ${classItem.turma || 'Turma'}.`);
  saveAndRender();
  return next;
}

async function submitBooking(event) {
  event.preventDefault();
  const payload = {
    nome: document.getElementById('bookingName').value.trim(),
    telefone: document.getElementById('bookingPhone').value.trim(),
    aula_id: document.getElementById('bookingClass').value,
    observacao: ['Aula experimental solicitada.', document.getElementById('bookingNote').value.trim()].filter(Boolean).join(' ')
  };
  const selected = selectedPublicBookingClass();
  if (!selected?.value) throw new Error('Escolha uma aula');
  if (selected.dataset.full === '1') {
    const waitItem = await submitPublicWaitlist(payload);
    document.getElementById('bookingStatus').textContent = `Voce entrou na lista de espera${waitItem?.posicao ? ` na posicao ${waitItem.posicao}` : ''}. A escola avisa se abrir uma vaga.`;
  } else {
    await sendPublicBooking(payload);
    document.getElementById('bookingStatus').textContent = apiMode ? 'Solicitação de aula experimental enviada. Aguarde a confirmação pelo WhatsApp.' : 'Solicitação experimental salva na demo. Entre no painel para aprovar.';
  }
  event.target.reset();
  await renderPublicBooking();
}

function setPublicTab(tab = 'guest') {
  document.querySelectorAll('[data-public-tab]').forEach((button) => {
    button.classList.toggle('active', button.dataset.publicTab === tab);
    button.setAttribute('aria-selected', button.dataset.publicTab === tab ? 'true' : 'false');
  });
  document.querySelectorAll('[data-public-pane]').forEach((pane) => {
    pane.classList.toggle('active', pane.dataset.publicPane === tab);
    pane.setAttribute('aria-hidden', pane.dataset.publicPane === tab ? 'false' : 'true');
  });
  if (tab === 'student') renderStudentConfirmList();
}

function renderStudentConfirmList() {
  const list = document.getElementById('studentClassList');
  if (!list) return;
  if (!publicStudentLookup.telefone) {
    list.innerHTML = empty('Digite seu WhatsApp para ver as aulas em que voce ja esta na lista.');
    return;
  }
  const student = publicStudentLookup.student;
  const items = publicStudentLookup.items || [];
  if (!items.length) {
    list.innerHTML = `
      <div class="student-confirm-head">
        <span class="pill ok">${escapeHTML(student?.nome || 'Aluno')}</span>
        <small>${escapeHTML(student?.plano_nome || 'Plano nao informado')}</small>
      </div>
      ${empty('Voce nao tem aula agendada. Veja abaixo os horarios regulares com vaga nesta semana.')}
    `;
    return;
  }
  const indicated = items.filter((item) => item.confirmado === 'sim').length;
  const confirmed = items.filter((item) => item.confirmado === 'sim' && item.confirmado_professor === 'sim').length;
  const open = Math.max(0, items.length - indicated);
  list.innerHTML = `
    <div class="student-confirm-head">
      <span class="pill ok">${escapeHTML(student?.nome || 'Aluno')}</span>
      <small>${escapeHTML(student?.plano_nome || 'Plano nao informado')}</small>
    </div>
    <div class="student-confirm-summary">
      <span class="pill ok">${indicated} indicaram que vao</span>
      <span class="pill ${confirmed < indicated ? 'warn' : 'ok'}">${confirmed} confirmadas pelo professor</span>
      <span class="pill ${open ? 'warn' : 'ok'}">${open} sem indicacao</span>
    </div>
    ${items.map((item) => {
      const yes = item.confirmado === 'sim';
      const approved = item.confirmado_professor === 'sim';
      return `
        <article class="student-confirm-card ${yes ? 'confirm-yes' : ''}">
          <div>
            <strong>${formatDate(item.data)} as ${escapeHTML(item.horario)}</strong>
            <span>${escapeHTML(item.turma || 'Turma')} - ${escapeHTML(item.tipo || 'Regular')}</span>
            <small>${approved ? 'Confirmado pelo professor' : yes ? 'Indicacao enviada; aguardando o professor' : 'Ainda sem indicacao'}</small>
          </div>
          <div class="confirm-choice">
            <button class="mini-btn ${yes ? 'active' : ''}" type="button" ${approved ? 'disabled' : ''} data-student-confirm="${item.id}:sim">${approved ? 'Confirmado' : yes ? 'Indicado' : 'Vou'}</button>
          </div>
        </article>
      `;
    }).join('')}
  `;
}

function localStudentClassesByPhone(telefone = '') {
  const digits = phoneDigits(telefone).slice(-8);
  const student = state.students.find((item) => phoneDigits(item.telefone).endsWith(digits));
  if (!student) return { student: null, items: [] };
  const items = state.classes
    .filter((item) => item.status !== 'Cancelada' && item.data >= todayISO() && classStudentIds(item).some((id) => String(id) === String(student.id)))
    .sort(sortClass)
    .slice(0, 30)
    .map((item) => ({ ...item, confirmado: item.confirmacoes?.[student.id] || '', confirmado_professor: item.confirmacoesProfessor?.[student.id] || '' }));
  return { student, items };
}

async function loadStudentWaitlistStatus(telefone = '') {
  publicStudentWaitlist = [];
  if (phoneDigits(telefone).length < 8) return;
  if (location.protocol !== 'file:') {
    try {
      const res = await fetch(`/api/public/student-waitlist?telefone=${encodeURIComponent(telefone)}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.ok === false) throw new Error(data.error || 'Nao foi possivel buscar a espera');
      publicStudentWaitlist = data.items || [];
      return;
    } catch (err) {
      if (await detectServer()) throw err;
    }
  }
  const digits = phoneDigits(telefone).slice(-8);
  const activeWaitlist = state.waitlist.filter((item) => String(item.aula_id || '') && ['Novo', 'Contatado', 'Experimental marcado'].includes(item.status || 'Novo'));
  publicStudentWaitlist = activeWaitlist
    .filter((item) => phoneDigits(item.telefone).endsWith(digits))
    .map((item) => {
      const queue = activeWaitlist
        .filter((ahead) => String(ahead.aula_id) === String(item.aula_id))
        .sort((a, b) => String(a.data_cadastro || '').localeCompare(String(b.data_cadastro || '')) || String(a.id).localeCompare(String(b.id)));
      return { ...item, posicao: queue.findIndex((ahead) => String(ahead.id) === String(item.id)) + 1 };
    });
}

async function loadStudentConfirmations(telefone) {
  const status = document.getElementById('studentConfirmStatus');
  if (phoneDigits(publicStudentLookup.telefone) !== phoneDigits(telefone)) publicStudentPendingBookings = new Set();
  publicStudentLookup = { telefone, student: null, items: [], available: [] };
  publicStudentWaitlist = [];
  if (status) status.textContent = 'Buscando suas aulas...';
  if (location.protocol !== 'file:') {
    try {
      const res = await fetch(`/api/public/student-classes?telefone=${encodeURIComponent(telefone)}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.ok === false) throw new Error(data.error || 'Nao foi possivel buscar');
      publicStudentLookup = { telefone, student: data.student, items: data.items || [], available: data.available || [] };
      await loadStudentWaitlistStatus(telefone);
      if (status) status.textContent = data.items?.length ? 'Indique em quais aulas voce vai.' : 'Escolha um horario regular com vaga nesta semana.';
      renderStudentConfirmList();
      await renderStudentBookingOptions(data.available || []);
      return;
    } catch (err) {
      if (await detectServer()) throw err;
    }
  }
  const local = localStudentClassesByPhone(telefone);
  publicStudentLookup = { telefone, student: local.student, items: local.items, available: [] };
  await loadStudentWaitlistStatus(telefone);
  if (status) status.textContent = local.student ? 'Modo demo local.' : 'Aluno nao encontrado na demo.';
  renderStudentConfirmList();
  await renderStudentBookingOptions();
}

async function renderStudentBookingOptions(classes = null) {
  const target = document.getElementById('studentBookingList');
  if (!target) return;
  const board = target.closest('.student-booking-board');
  const filters = document.getElementById('studentSlotFilters');
  const dateFilter = document.getElementById('studentSlotDate');
  const timeFilter = document.getElementById('studentSlotTime');
  target.setAttribute('aria-busy', 'true');
  if (!publicStudentLookup.student) {
    if (board) board.hidden = true;
    if (filters) filters.hidden = true;
    target.innerHTML = empty('Busque seu WhatsApp acima para liberar o agendamento.');
    target.setAttribute('aria-busy', 'false');
    return;
  }
  if ((publicStudentLookup.items || []).length) {
    if (board) board.hidden = true;
    if (filters) filters.hidden = true;
    target.innerHTML = '';
    target.setAttribute('aria-busy', 'false');
    return;
  }
  if (board) board.hidden = false;
  if (!classes) classes = publicStudentLookup.available.length ? publicStudentLookup.available : await loadPublicClasses();
  if (!publicStudentLookup.available.length && classes.length) publicStudentLookup.available = classes;
  const currentIds = new Set((publicStudentLookup.items || []).map((item) => String(item.id)));
  const today = todayISO();
  const weekEnd = addDaysIso(today, 6);
  const options = classes.filter((item) => {
    const remaining = Number(item.capacidade || 8) - Number(item.inscritos ?? classStudentIds(item).length);
    return item.data >= today
      && item.data <= weekEnd
      && !/experimental/i.test(String(item.tipo || ''))
      && remaining > 0
      && !currentIds.has(String(item.id))
      && !publicStudentPendingBookings.has(String(item.id));
  });
  const dates = [...new Set(options.map((item) => item.data))];
  const times = [...new Set(options.map((item) => item.horario))].sort();
  if (filters && dateFilter && timeFilter) {
    const previousDate = dateFilter.value;
    const previousTime = timeFilter.value;
    dateFilter.innerHTML = '<option value="">Todas as datas</option>' + dates.map((date) => '<option value="' + escapeHTML(date) + '">' + formatDate(date) + '</option>').join('');
    timeFilter.innerHTML = '<option value="">Todos os horarios</option>' + times.map((time) => '<option value="' + escapeHTML(time) + '">' + escapeHTML(time) + '</option>').join('');
    dateFilter.value = dates.includes(previousDate) ? previousDate : '';
    timeFilter.value = times.includes(previousTime) ? previousTime : '';
    filters.hidden = !options.length;
  }
  const selectedDate = dateFilter?.value || '';
  const selectedTime = timeFilter?.value || '';
  const filteredOptions = options.filter((item) => (!selectedDate || item.data === selectedDate) && (!selectedTime || item.horario === selectedTime));
  target.innerHTML = filteredOptions.length ? filteredOptions.map((item) => {
    const remaining = Math.max(0, Number(item.capacidade || 8) - Number(item.inscritos ?? classStudentIds(item).length));
    return `
      <article class="booking-class-card student-booking-option">
        <div><strong>${formatDate(item.data)} ${escapeHTML(item.horario)}</strong><span>${escapeHTML(item.turma || 'Turma')}</span><small>${remaining} vaga(s) livres</small></div>
        <button class="mini-btn" type="button" data-student-booking="${escapeHTML(item.id)}">Escolher horario</button>
      </article>
    `;
  }).join('') : empty(options.length ? 'Nenhum horario corresponde aos filtros.' : 'Nenhum horario regular com vaga nesta semana.');
  target.setAttribute('aria-busy', 'false');
}

async function submitStudentWaitlist(classId) {
  const student = publicStudentLookup.student;
  const telefone = publicStudentLookup.telefone || document.getElementById('studentLookupPhone')?.value.trim();
  if (!student || !telefone) throw new Error('Busque seu WhatsApp antes de entrar na espera');
  const waitItem = await submitPublicWaitlist({ nome: student.nome, telefone, aula_id: classId, observacao: 'Entrou na espera pelo fluxo do aluno.' });
  const status = document.getElementById('studentConfirmStatus');
  if (status) status.textContent = `Voce entrou na espera${waitItem?.posicao ? ` na posicao ${waitItem.posicao}` : ''}. A escola avisa se abrir uma vaga.`;
  await loadStudentWaitlistStatus(telefone);
  await renderStudentBookingOptions();
}

async function submitStudentBooking(classId) {
  const student = publicStudentLookup.student;
  const telefone = publicStudentLookup.telefone || document.getElementById('studentLookupPhone')?.value.trim();
  if (!student || !telefone) throw new Error('Busque seu WhatsApp antes de agendar');
  if (publicStudentPendingBookings.has(String(classId))) return;
  publicStudentPendingBookings.add(String(classId));
  try {
    await sendPublicBooking({ nome: student.nome, telefone, aula_id: classId, observacao: 'Agendamento feito pelo fluxo regular do aluno.' });
  } catch (error) {
    publicStudentPendingBookings.delete(String(classId));
    throw error;
  }
  const status = document.getElementById('studentConfirmStatus');
  if (status) status.textContent = 'Indicacao enviada. Aguarde a confirmacao do professor.';
  await loadStudentConfirmations(telefone);
}

async function submitStudentConfirmation(classId, confirmado) {
  const telefone = publicStudentLookup.telefone || document.getElementById('studentLookupPhone')?.value.trim();
  if (!telefone) throw new Error('Informe seu WhatsApp');
  if (location.protocol !== 'file:') {
    try {
      const res = await fetch('/api/public/student-confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telefone, aula_id: classId, confirmado })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.ok === false) throw new Error(data.error || 'Nao foi possivel confirmar');
      await loadStudentConfirmations(telefone);
      document.getElementById('studentConfirmStatus').textContent = confirmado === 'sim' ? 'Indicacao enviada. Aguarde a confirmacao do professor.' : 'Resposta registrada.';
      return;
    } catch (err) {
      if (await detectServer()) throw err;
    }
  }
  const local = localStudentClassesByPhone(telefone);
  if (!local.student) throw new Error('Aluno nao encontrado');
  const classItem = classById(classId);
  if (!classItem) throw new Error('Aula nao encontrada');
  classItem.confirmacoes = { ...(classItem.confirmacoes || {}), [local.student.id]: confirmado };
  recordAction('Aluno', 'Confirmacao aluno', `${local.student.nome} respondeu ${confirmado === 'sim' ? 'vou' : 'nao vou'} na aula ${classItem.horario} - ${classItem.turma || 'Turma'}.`);
  touchState();
  saveLocalState();
  publicStudentLookup = { telefone, student: local.student, items: localStudentClassesByPhone(telefone).items, available: [] };
  renderStudentConfirmList();
}

async function respondBooking(id, action, force = false) {
  const booking = (state.bookings || []).find((item) => String(item.id) === String(id));
  if (!booking) return;
  const item = bookingClass(booking);
  if (!item) throw new Error('Aula nao encontrada');
  const approve = action === 'approve';
  if (!approve && !confirm(`Recusar pedido de ${booking.nome}?`)) return;
  if (approve && classStudentIds(item).length >= Number(item.capacidade || 8) && !force) {
    if (!confirm('Aula lotada. Aprovar mesmo assim como fora da lista?')) return;
    force = true;
  }
  if (apiMode) {
    await api(`/api/bookings/${id}/respond`, { method: 'POST', body: JSON.stringify({ action, force }) });
    await loadData();
    toast(approve ? 'Pedido aprovado' : 'Pedido recusado');
    return;
  }
  if (action === 'bookings') {
    setPage('bookings');
    return;
  }
  if (!approve) {
    booking.status = 'Recusado';
    booking.respondido_em = todayISO();
    recordAction('Professor', 'Pedido recusado', `${booking.nome} foi recusado na aula ${item.horario} - ${item.turma || 'Turma'}.`);
    saveAndRender();
    toast('Pedido recusado');
    return;
  }
  const digits = String(booking.telefone || '').replace(/\D/g, '');
  const isExp = isExperimentalBooking(booking);
  let student = digits ? state.students.find((entry) => String(entry.telefone || '').replace(/\D/g, '').endsWith(digits.slice(-8))) : null;

  if (!student && isExp) {
    student = {
      id: uid(),
      nome: booking.nome,
      telefone: booking.telefone,
      status: 'Experimental',
      plano_nome: 'Experimental',
      nivel: 'Iniciante',
      observacao: `Cadastrado automaticamente via aprovação de experimental em ${item.data} às ${item.horario}`,
      criado_em: todayISO()
    };
    state.students.push(student);
  }

  if (student && !classStudentIds(item).map(String).includes(String(student.id))) {
    item.aluno_ids = [...classStudentIds(item), student.id];
    item.presencas = item.presencas || {};
    item.presencas[student.id] = item.presencas[student.id] || false;
  } else if (!student) {
    item.extra_presentes = [...classExtras(item), { id: `ag${booking.id}`, nome: booking.nome, tipo: isExp ? 'Experimental' : 'Solicitado', criado_em: todayISO() }];
  }
  booking.status = 'Aprovado';
  booking.respondido_em = todayISO();
  recordAction('Professor', isExp ? 'Experimental aprovado' : 'Pedido aprovado', `${booking.nome} foi aprovado(a) na aula ${item.horario} - ${item.turma || 'Turma'}.`);
  saveAndRender();
  toast(isExp ? 'Aula experimental aprovada e aluno cadastrado!' : 'Pedido aprovado');
}

function syncStudentFixedSchedule(student) {
  if (!student?.id || student.status === 'Pausado') return 0;
  const occurrences = fixedScheduleOccurrences(student, 4);
  if (!occurrences.length) return 0;
  let touched = 0;
  occurrences.forEach(({ data: dateIso, horario, turma: group }) => {
    let item = state.classes.find((entry) => (
      entry.data === dateIso &&
      entry.horario === horario &&
      String(entry.turma || '') === String(group) &&
      entry.status !== 'Cancelada'
    ));
    if (!item) {
      item = {
        id: uid(),
        data: dateIso,
        horario,
        turma: group,
        professor: '',
        tipo: 'Regular',
        capacidade: 8,
        status: 'Marcada',
        aluno_ids: [],
        presencas: {},
        extra_presentes: []
      };
      state.classes.push(item);
    }
    const ids = new Set(classStudentIds(item).map(String));
    if (!ids.has(String(student.id))) {
      item.aluno_ids = [...ids, String(student.id)];
      item.presencas = item.presencas || {};
      item.presencas[student.id] = item.presencas[student.id] || false;
      touched += 1;
    }
  });
  return touched;
}

async function syncStudentFixedScheduleApi(student) {
  if (!student?.id || student.status === 'Pausado') return 0;
  const occurrences = fixedScheduleOccurrences(student, 4);
  if (!occurrences.length) return 0;
  const knownClasses = [...state.classes];
  let touched = 0;
  for (const { data: dateIso, horario, turma: group } of occurrences) {
    const existing = knownClasses.find((entry) => (
      entry.data === dateIso &&
      entry.horario === horario &&
      String(entry.turma || '') === String(group) &&
      entry.status !== 'Cancelada'
    ));
    if (!existing) {
      const created = await api('/api/classes', {
        method: 'POST',
        body: JSON.stringify({
          data: dateIso,
          horario,
          turma: group,
          professor: '',
          tipo: 'Regular',
          capacidade: 8,
          status: 'Marcada',
          aluno_ids: [student.id],
          presencas: {}
        })
      });
      if (created.item) knownClasses.push(created.item);
      touched += 1;
      continue;
    }
    const ids = new Set(classStudentIds(existing).map(String));
    if (!ids.has(String(student.id))) {
      await api(`/api/classes/${existing.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          ...existing,
          aluno_ids: [...ids, String(student.id)],
          presencas: existing.presencas || {}
        })
      });
      existing.aluno_ids = [...ids, String(student.id)];
      touched += 1;
    }
  }
  return touched;
}

async function syncStudentScheduleAction(studentId) {
  const student = studentById(studentId);
  if (!student) return;
  if (!hasFixedSchedule(student)) {
    toast('Defina dia e horário fixo antes de sincronizar');
    openStudent(studentId);
    return;
  }
  let linked = 0;
  if (apiMode) {
    linked = await syncStudentFixedScheduleApi(student);
    await loadData();
  } else {
    linked = syncStudentFixedSchedule(student);
    recordAction('Professor', 'Agenda fixa', `${student.nome} teve agenda fixa sincronizada: ${linked || 0} aula(s).`);
    saveAndRender();
  }
  toast(linked ? `${linked} aula(s) vinculada(s)` : 'Agenda fixa ja estava sincronizada');
  openStudentReport(studentId);
}

async function saveStudent(event) {
  event.preventDefault();
  const submitButton = event.currentTarget.querySelector('button[type="submit"]') || event.submitter;
  const id = document.getElementById('studentId').value;
  const plan = planById(document.getElementById('studentPlan').value);
  const scheduleRows = studentFormScheduleRows();
  const incompleteSchedule = scheduleRows.some((schedule) => Boolean(schedule.dia || schedule.horario || schedule.turma) && !(schedule.dia !== '' && schedule.horario));
  if (incompleteSchedule) throw new Error('Em cada agenda fixa, informe o dia e o horário.');
  const scheduleDraft = studentFormScheduleDraft();
  const scheduleKeys = new Set();
  const duplicatedSchedule = scheduleDraft.agendas_fixas.some((schedule) => {
    const key = `${schedule.dia}|${schedule.horario}`;
    if (scheduleKeys.has(key)) return true;
    scheduleKeys.add(key);
    return false;
  });
  if (duplicatedSchedule) throw new Error('Há dois horários fixos iguais para este aluno.');
  const payload = {
    nome: document.getElementById('studentName').value.trim(),
    telefone: document.getElementById('studentPhone').value.trim(),
    email: document.getElementById('studentEmail').value.trim(),
    plano_id: plan?.id || null,
    plano_nome: plan?.nome || '',
    mensalidade: Number(document.getElementById('studentFee').value || plan?.preco || 0),
    dia_vencimento: dueDay({ dia_vencimento: document.getElementById('studentDueDay').value }),
    status: document.getElementById('studentStatus').value,
    nivel: document.getElementById('studentLevel').value,
    dia_fixo: scheduleDraft.dia_fixo,
    horario_fixo: scheduleDraft.horario_fixo,
    turma_fixa: scheduleDraft.turma_fixa,
    agendas_fixas: scheduleDraft.agendas_fixas,
    observacao: document.getElementById('studentNote').value.trim(),
    pago_ate: studentById(id)?.pago_ate || ''
  };

  await withModalLoading({
    submitButton,
    modalId: 'studentModal',
    successText: id ? 'Aluno atualizado!' : 'Aluno salvo!',
    successToast: id ? 'Cadastro do aluno atualizado com sucesso!' : 'Novo aluno cadastrado com sucesso!',
    operation: async () => {
      if (apiMode) {
        const saved = await api(id ? `/api/students/${id}` : '/api/students', { method: id ? 'PUT' : 'POST', body: JSON.stringify(payload) });
        await loadData();
        const linked = await syncStudentFixedScheduleApi(saved.item || { ...payload, id });
        if (linked) await loadData();
      } else {
        const next = { ...payload, id: id || uid() };
        const index = state.students.findIndex((student) => String(student.id) === String(next.id));
        if (index >= 0) state.students[index] = next;
        else state.students.push(next);
        const linked = syncStudentFixedSchedule(next);
        recordAction('Professor', id ? 'Aluno atualizado' : 'Aluno cadastrado', `${next.nome} ${id ? 'teve cadastro atualizado' : 'foi cadastrado'}${linked ? ` e vinculado a ${linked} aula(s).` : '.'}`);
        saveAndRender();
        if (linked) toast(`${linked} aula(s) vinculada(s)`);
      }
    }
  });
}

async function saveClass(event) {
  event.preventDefault();
  const submitButton = event.currentTarget.querySelector('button[type="submit"]') || event.submitter;
  const id = document.getElementById('classId').value;
  const alunoIds = [...document.getElementById('classStudents').selectedOptions].map((option) => option.value);
  const previous = classById(id);
  const presencas = {};
  alunoIds.forEach((studentId) => { presencas[studentId] = previous?.presencas?.[studentId] || false; });
  const payload = {
    data: document.getElementById('classDate').value,
    horario: document.getElementById('classTime').value,
    turma: document.getElementById('classGroup').value.trim(),
    professor: document.getElementById('classCoach').value.trim(),
    tipo: document.getElementById('classType').value,
    capacidade: Number(document.getElementById('classCapacity').value || 8),
    status: document.getElementById('classStatus').value,
    observacao: document.getElementById('classNotice').value.trim(),
    aluno_ids: alunoIds,
    presencas,
    extra_presentes: classExtras(previous)
  };
  const recurrence = document.getElementById('classRecurrence').value;
  const repeatWeeks = id || recurrence === 'once' ? 1 : Math.min(12, Math.max(1, Number(document.getElementById('classRepeatWeeks').value || 1)));
  const classPayloads = Array.from({ length: repeatWeeks }, (_item, index) => ({
    ...payload,
    data: addDaysIso(payload.data, index * 7),
    presencas: index === 0 ? payload.presencas : {},
    extra_presentes: index === 0 ? payload.extra_presentes : []
  }));

  await withModalLoading({
    submitButton,
    modalId: 'classModal',
    successText: id ? 'Aula atualizada!' : (repeatWeeks > 1 ? `${repeatWeeks} aulas criadas!` : 'Aula salva!'),
    successToast: id ? 'Aula atualizada com sucesso!' : (repeatWeeks > 1 ? `${repeatWeeks} aulas criadas na grade!` : 'Aula salva com sucesso!'),
    operation: async () => {
      if (apiMode) {
        if (id) await api(`/api/classes/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
        else {
          for (const item of classPayloads) {
            await api('/api/classes', { method: 'POST', body: JSON.stringify(item) });
          }
        }
        await loadData();
      } else {
        if (id) {
          const next = { ...payload, id };
          const index = state.classes.findIndex((item) => String(item.id) === String(next.id));
          if (index >= 0) state.classes[index] = next;
        } else {
          classPayloads.forEach((item) => state.classes.push({ ...item, id: uid() }));
        }
        recordAction('Professor', id ? 'Aula atualizada' : 'Aula criada', `${payload.horario} - ${payload.turma || 'Turma'} em ${formatDate(payload.data)}.`);
        saveAndRender();
      }
    }
  });
}

async function savePlan(event) {
  event.preventDefault();
  const submitButton = event.currentTarget.querySelector('button[type="submit"]') || event.submitter;
  const id = document.getElementById('planId').value;
  const payload = {
    nome: document.getElementById('planName').value.trim(),
    preco: Number(document.getElementById('planPrice').value || 0),
    aulas_semana: Number(document.getElementById('planClasses').value || 0),
    descricao: document.getElementById('planDescription').value.trim(),
    ativo: 1
  };

  await withModalLoading({
    submitButton,
    modalId: 'planModal',
    successText: id ? 'Plano atualizado!' : 'Plano criado!',
    successToast: id ? 'Plano atualizado com sucesso!' : 'Novo plano cadastrado com sucesso!',
    operation: async () => {
      if (apiMode) {
        await api(id ? `/api/tables/planos/${id}` : '/api/tables/planos', { method: id ? 'PUT' : 'POST', body: JSON.stringify(payload) });
        await loadData();
      } else {
        const next = { ...payload, id: id || uid() };
        const index = state.plans.findIndex((plan) => String(plan.id) === String(next.id));
        if (index >= 0) state.plans[index] = next;
        else state.plans.push(next);
        saveAndRender();
      }
    }
  });
}

async function saveWaitlist(event) {
  event.preventDefault();
  const submitButton = event.currentTarget.querySelector('button[type="submit"]') || event.submitter;
  const id = document.getElementById('waitId').value;
  const payload = {
    nome: document.getElementById('waitName').value.trim(),
    telefone: document.getElementById('waitPhone').value.trim(),
    preferencia: document.getElementById('waitPreference').value.trim(),
    status: document.getElementById('waitStatus').value,
    observacao: document.getElementById('waitNote').value.trim()
  };

  await withModalLoading({
    submitButton,
    modalId: 'waitlistModal',
    successText: id ? 'Contato atualizado!' : 'Interessado salvo!',
    successToast: id ? 'Contato atualizado com sucesso!' : 'Interessado salvo na lista de espera!',
    operation: async () => {
      if (apiMode) {
        await api(id ? `/api/waitlist/${id}` : '/api/waitlist', { method: id ? 'PUT' : 'POST', body: JSON.stringify(payload) });
        await loadData();
      } else {
        const next = { ...payload, id: id || uid(), data_cadastro: state.waitlist.find((item) => String(item.id) === String(id))?.data_cadastro || todayISO() };
        const index = state.waitlist.findIndex((item) => String(item.id) === String(next.id));
        if (index >= 0) state.waitlist[index] = next;
        else state.waitlist.unshift(next);
        recordAction('Professor', id ? 'Espera atualizada' : 'Interessado cadastrado', `${next.nome} entrou/atualizou a lista de espera.`);
        saveAndRender();
      }
    }
  });
}

function openAttendance(classId) {
  openAttendanceModule(getAppContext(), classId);
}

async function saveClassItem(item) {
  if (apiMode) {
    await api(`/api/classes/${item.id}`, { method: 'PUT', body: JSON.stringify(item) });
    await loadData();
  } else {
    saveAndRender();
  }
}

async function updateClassStatus(id, status) {
  const item = classById(id);
  if (!item) return;
  item.status = status;
  if (!apiMode) recordAction('Professor', 'Status da aula', `${item.horario} - ${item.turma || 'Turma'} mudou para ${status}.`);
  await saveClassItem(item);
  toast(`Aula ${status.toLowerCase()}`);
}

async function cancelClass(id) {
  const item = classById(id);
  if (!item) return;
  const reason = prompt('Motivo ou aviso para o cancelamento', item.observacao || 'Aula cancelada pela escola.');
  if (reason === null) return;
  item.status = 'Cancelada';
  item.observacao = reason.trim() || 'Aula cancelada pela escola.';
  await saveClassItem(item);
  toast('Aula cancelada. Use Avisar grupo para enviar o comunicado.');
}

async function finishAttendance() {
  if (!activeAttendanceClassId) return;
  await updateClassStatus(activeAttendanceClassId, 'Finalizada');
  closeModal('attendanceModal');
}

async function addExtraAttendance(event) {
  event.preventDefault();
  const item = classById(activeAttendanceClassId);
  if (!item) return;
  const input = document.getElementById('extraAttendanceName');
  const name = input.value.trim();
  if (!name) return;
  const type = document.getElementById('extraAttendanceType').value || 'Avulso';
  item.extra_presentes = [...classExtras(item), { id: uid(), nome: name, tipo: type, criado_em: todayISO() }];
  recordAction('Professor', 'Fora da lista', `${name} entrou como ${type} na aula ${item.horario} - ${item.turma || 'Turma'}.`);
  input.value = '';
  document.getElementById('extraAttendanceType').value = 'Avulso';
  await saveClassItem(item);
  openAttendance(item.id);
  toast('Avulso adicionado');
}

async function removeExtraAttendance(classId, index) {
  const item = classById(classId);
  if (!item) return;
  item.extra_presentes = [...classExtras(item)];
  const removed = item.extra_presentes[Number(index)];
  item.extra_presentes.splice(Number(index), 1);
  recordAction('Professor', 'Fora da lista removido', `${removed?.nome || 'Pessoa'} foi removido(a) da aula ${item.horario} - ${item.turma || 'Turma'}.`);
  await saveClassItem(item);
  openAttendance(classId);
  toast('Avulso removido');
}

async function setClassAttendance(classId, present) {
  const item = classById(classId);
  if (!item) return;
  item.presencas = item.presencas || {};
  classStudentIds(item).forEach((studentId) => { item.presencas[studentId] = present; });
  if (!apiMode) recordAction('Professor', 'Presenca em massa', `${item.turma || 'Turma'} teve presencas ${present ? 'marcadas' : 'limpas'}.`);
  if (apiMode) {
    await api(`/api/classes/${classId}/attendance`, { method: 'PUT', body: JSON.stringify({ attendance: item.presencas }) });
    await loadData();
  } else {
    saveAndRender();
  }
  openAttendance(classId);
  toast(present ? 'Turma marcada presente' : 'Presenças limpas');
}

async function toggleAttendance(classId, studentId) {
  const item = classById(classId);
  if (!item) return;
  item.presencas = item.presencas || {};
  item.presencas[studentId] = !item.presencas[studentId];
  const student = studentById(studentId);
  if (!apiMode) recordAction('Professor', 'Presenca', `${student?.nome || 'Aluno'} foi ${item.presencas[studentId] ? 'marcado presente' : 'desmarcado'} na aula ${item.horario} - ${item.turma || 'Turma'}.`);
  if (apiMode) {
    await api(`/api/classes/${classId}/attendance`, { method: 'PUT', body: JSON.stringify({ attendance: item.presencas }) });
    await loadData();
  } else {
    saveAndRender();
  }
  openAttendance(classId);
}

async function confirmStudentAttendance(classId, studentId, action = 'approve') {
  const item = classById(classId);
  if (!item) return;
  const student = studentById(studentId) || classStudents(item).find((entry) => String(entry.aluno_id || entry.id) === String(studentId));
  if (!student) return;
  if (apiMode) {
    await api(`/api/classes/${classId}/student-confirmation`, {
      method: 'POST',
      body: JSON.stringify({ student_id: studentId, action })
    });
    await loadData();
  } else {
    item.confirmacoesProfessor = item.confirmacoesProfessor || {};
    item.confirmacoesProfessor[studentId] = action === 'approve' ? 'sim' : '';
    recordAction('Professor', action === 'approve' ? 'Confirmacao professor' : 'Confirmacao professor removida', `${student.nome} ${action === 'approve' ? 'foi confirmado(a)' : 'deixou de estar confirmado(a)'} na aula ${item.horario} - ${item.turma || 'Turma'}.`);
    saveAndRender();
  }
  openAttendance(classId);
  toast(action === 'approve' ? 'Indicacao confirmada' : 'Confirmacao removida');
}

function openDirectPix(studentId) {
  openDirectPixModule(getAppContext(), studentId);
}

function openPayment(studentId) {
  openPaymentModule(getAppContext(), studentId);
}

async function markPaid(studentId) {
  const student = studentById(studentId);
  if (!student) return;
  const month = selectedPaymentMonth();
  const alreadyPaid = isPaidForMonth(student, month);
  if (!alreadyPaid) {
    openPayment(studentId);
    return;
  }
  if (!confirm(`Marcar ${student.nome} como NAO pago em ${month}?`)) return;
  try {
    if (apiMode) {
      await api(`/api/students/${studentId}/pay`, {
        method: 'DELETE',
        body: JSON.stringify({ referencia: month })
      }).catch(async () => {
        await api(`/api/students/${studentId}`, { method: 'PUT', body: JSON.stringify({ ...student, pago_ate: '' }) });
      });
      await loadData();
    } else {
      student.pago_ate = '';
      state.payments = (state.payments || []).filter((item) => !(String(item.aluno_id) === String(student.id) && paymentMonth(item) === month));
      recordAction('Professor', 'Pagamento reaberto', `${student.nome} foi marcado como nao pago em ${month}.`);
      saveAndRender();
    }
    toast('Mensalidade marcada como nao paga');
  } catch (err) {
    toast(err.message || 'Erro ao desmarcar pagamento', 'error');
  }
}

async function savePayment(event) {
  event.preventDefault();
  const submitButton = event.currentTarget.querySelector('button[type="submit"]') || event.submitter;
  const studentId = document.getElementById('paymentStudentId').value;
  const student = studentById(studentId);
  if (!student) return;
  const month = document.getElementById('paymentReference').value || selectedPaymentMonth();
  const paidUntil = dueDateForMonth(student, month);
  const paidAt = document.getElementById('paymentPaidAt').value || todayISO();
  const value = Number(document.getElementById('paymentValue').value || student.mensalidade || 0);
  const method = document.getElementById('paymentMethod').value || 'Pix';
  const note = document.getElementById('paymentNote').value.trim();

  await withModalLoading({
    submitButton,
    modalId: 'paymentModal',
    successText: 'Pagamento confirmado!',
    successToast: `Pagamento de ${student.nome} (${month}) confirmado com sucesso!`,
    operation: async () => {
      if (apiMode) {
        await api(`/api/students/${studentId}/pay`, {
          method: 'POST',
          body: JSON.stringify({
            referencia: month,
            vencimento: paidUntil,
            pago_em: paidAt,
            valor: value,
            forma_pagamento: method,
            observacao: note
          })
        });
        await loadData({ serverKnown: true });
      } else {
        student.pago_ate = student.pago_ate && student.pago_ate > paidUntil ? student.pago_ate : paidUntil;
        state.payments = state.payments || [];
        state.payments.unshift({
          id: uid(),
          aluno_id: student.id,
          aluno_nome: student.nome,
          referencia: month,
          valor: value,
          vencimento: paidUntil,
          pago_em: paidAt,
          status: 'PAGO',
          forma_pagamento: method,
          observacao: note
        });
        recordAction('Professor', 'Pagamento', `${student.nome} pagou ${money.format(value)} via ${method} em ${month}.`);
        saveAndRender();
      }
    }
  });
}

async function duplicateClass(id) {
  const item = classById(id);
  if (!item) return;
  const next = {
    data: addDaysIso(item.data, 7),
    horario: item.horario,
    turma: item.turma,
    professor: item.professor,
    capacidade: item.capacidade,
    status: 'Marcada',
    aluno_ids: classStudentIds(item),
    presencas: {},
    extra_presentes: []
  };
  if (apiMode) {
    await api('/api/classes', { method: 'POST', body: JSON.stringify(next) });
    await loadData();
  } else {
    state.classes.push({ ...next, id: uid() });
    recordAction('Professor', 'Aula duplicada', `${item.turma || 'Turma'} foi duplicada para ${formatDate(next.data)}.`);
    saveAndRender();
  }
  toast('Aula duplicada para a próxima semana');
}

async function updateWaitStatus(id, status) {
  const item = state.waitlist.find((entry) => String(entry.id) === String(id));
  if (!item) return;
  item.status = status;
  if (apiMode) {
    await api(`/api/waitlist/${id}`, { method: 'PUT', body: JSON.stringify(item) });
    await loadData();
  } else {
    recordAction('Professor', 'Status da espera', `${item.nome} mudou para ${status}.`);
    saveAndRender();
  }
  toast('Status atualizado');
}

function convertWait(id) {
  const item = state.waitlist.find((entry) => String(entry.id) === String(id));
  if (!item) return;
  item.status = 'Convertido';
  if (!apiMode) {
    recordAction('Professor', 'Interessado convertido', `${item.nome} virou aluno em preparo.`);
    saveLocalState();
  }
  openStudent();
  document.getElementById('studentName').value = item.nome || '';
  document.getElementById('studentPhone').value = item.telefone || '';
  document.getElementById('studentNote').value = [item.preferencia, item.observacao].filter(Boolean).join(' - ');
}

async function downloadBackup() {
  const payload = apiMode ? await api('/api/backup.json') : { app: 'TeamLucaoFutevolei.LocalState', exported_at: new Date().toISOString(), data: state };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `team-lucao-futevolei-backup-${todayISO()}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}

async function createServerBackup() {
  if (!apiMode) {
    toast('Backup em servidor só com npm start');
    return;
  }
  const res = await api('/api/backups/create', { method: 'POST', body: JSON.stringify({}) });
  toast(`Backup criado: ${res.filename}`);
}

function bindEvents() {
  const renderStudentsLater = () => scheduleUiWork('students', renderStudents, 120);
  const renderPaymentsLater = () => scheduleUiWork('payments', renderPayments, 120);
  const renderActionsLater = () => scheduleUiWork('actions', renderActions, 120);
  const renderGlobalResultsLater = () => scheduleUiWork('global-results', renderGlobalResults, 40);
  const renderClassChecklistLater = () => scheduleUiWork('class-checklist', renderClassStudentChecklist, 80);

  document.getElementById('bookingForm')?.addEventListener('submit', (event) => submitBooking(event).catch((err) => toast(err.message)));
  document.getElementById('bookingClass')?.addEventListener('change', updateBookingClassAction);
  document.querySelectorAll('[data-public-tab]').forEach((button) => button.addEventListener('click', () => setPublicTab(button.dataset.publicTab)));
  document.getElementById('studentLookupForm')?.addEventListener('submit', (event) => {
    event.preventDefault();
    loadStudentConfirmations(document.getElementById('studentLookupPhone').value.trim()).catch((err) => {
      document.getElementById('studentConfirmStatus').textContent = err.message;
    });
  });
  document.getElementById('studentClassList')?.addEventListener('click', (event) => {
    const target = event.target.closest('[data-student-confirm]');
    if (!target) return;
    const [classId, confirmed] = target.dataset.studentConfirm.split(':');
    submitStudentConfirmation(classId, confirmed).catch((err) => {
      document.getElementById('studentConfirmStatus').textContent = err.message;
    });
  });
  document.getElementById('studentBookingList')?.addEventListener('click', (event) => {
    const target = event.target.closest('[data-student-booking]');
    if (!target) return;
    submitStudentBooking(target.dataset.studentBooking).catch((err) => {
      document.getElementById('studentConfirmStatus').textContent = err.message;
    });
  });
  document.getElementById('studentSlotDate')?.addEventListener('change', () => renderStudentBookingOptions(publicStudentLookup.available));
  document.getElementById('studentSlotTime')?.addEventListener('change', () => renderStudentBookingOptions(publicStudentLookup.available));
  document.getElementById('studentBookingList')?.addEventListener('click', (event) => {
    const target = event.target.closest('[data-student-waitlist]');
    if (!target) return;
    submitStudentWaitlist(target.dataset.studentWaitlist).catch((err) => {
      document.getElementById('studentConfirmStatus').textContent = err.message;
    });
  });
  document.getElementById('adminAccessBtn')?.addEventListener('click', () => {
    showBooking(false);
    showLogin(true);
  });
  document.getElementById('bookingClassList')?.addEventListener('click', (event) => {
    const target = event.target.closest('[data-booking-class]');
    if (!target) return;
    document.getElementById('bookingClass').value = target.dataset.bookingClass;
    updateBookingClassAction();
    document.getElementById('bookingName').focus();
  });
  document.getElementById('loginForm').addEventListener('submit', (event) => {
    event.preventDefault();
    unlockApp(document.getElementById('loginPin').value).catch((err) => toast(err.message));
  });
  document.querySelectorAll('.nav-item').forEach((button) => button.addEventListener('click', () => setPage(button.dataset.page)));
  document.querySelectorAll('[data-open-student]').forEach((button) => button.addEventListener('click', () => openStudent()));
  document.querySelectorAll('[data-open-class]').forEach((button) => button.addEventListener('click', () => openClass()));
  document.querySelectorAll('[data-open-plan]').forEach((button) => button.addEventListener('click', () => openPlan()));
  document.querySelectorAll('[data-open-waitlist]').forEach((button) => button.addEventListener('click', () => openWaitlist()));
  document.querySelectorAll('[data-close]').forEach((button) => button.addEventListener('click', () => closeModal(button.dataset.close)));
  document.querySelectorAll('.modal-wrap').forEach((modalWrap) => modalWrap.addEventListener('click', (event) => {
    if (event.target === modalWrap) closeModal(modalWrap.id);
  }));
  document.querySelectorAll('[data-refresh]').forEach((button) => button.addEventListener('click', () => refreshApp().catch((err) => toast(err.message))));
  document.querySelectorAll('[data-backup]').forEach((button) => button.addEventListener('click', () => downloadBackup().catch((err) => toast(err.message))));
  document.querySelectorAll('[data-copy-pending]').forEach((button) => button.addEventListener('click', () => copyPendingCharges().catch((err) => toast(err.message))));
  document.querySelectorAll('[data-server-backup]').forEach((button) => button.addEventListener('click', () => createServerBackup().catch((err) => toast(err.message))));
  document.querySelectorAll('[data-export-payments]').forEach((button) => button.addEventListener('click', () => {
    const month = document.getElementById('paymentMonth')?.value || currentMonth();
    exportMonthlyPaymentsCsv(getAppContext(), month);
  }));
  document.querySelectorAll('[data-export-students]').forEach((button) => button.addEventListener('click', () => {
    exportStudentsCsv(getAppContext());
  }));
  document.querySelectorAll('[data-export-payments-history]').forEach((button) => button.addEventListener('click', () => {
    exportPaymentHistoryCsv(getAppContext());
  }));
  document.getElementById('settingsForm')?.addEventListener('submit', saveSettings);
  document.getElementById('themePicker')?.addEventListener('click', (event) => {
    const target = event.target.closest('[data-theme-choice]');
    if (target) setTheme(target.dataset.themeChoice);
  });
  document.getElementById('settingsForm')?.addEventListener('input', updateSettingsPreview);
  document.querySelectorAll('[data-settings-default-theme]').forEach((button) => button.addEventListener('click', () => {
    setTheme('dark');
    toast('Tema escuro oficial ativado');
  }));
  document.querySelectorAll('[data-settings-reset]').forEach((button) => button.addEventListener('click', resetSettingsForm));
  document.querySelectorAll('[data-settings-clear]').forEach((button) => button.addEventListener('click', clearSettings));
  document.querySelectorAll('[data-clear-class-filter]').forEach((button) => button.addEventListener('click', () => {
    document.getElementById('classDateFilter').value = '';
    document.getElementById('classTypeFilter').value = '';
    document.getElementById('classStatusFilter').value = '';
    renderClasses();
  }));
  document.getElementById('quickActions').addEventListener('click', (event) => {
    const target = event.target.closest('[data-action]');
    if (target) handleQuickAction(target.dataset.action);
  });
  document.getElementById('focusStrip').addEventListener('click', (event) => {
    const target = event.target.closest('[data-focus-action]');
    if (target) handleFocusAction(target.dataset.focusAction);
  });
  document.getElementById('studentForm').addEventListener('submit', (event) => saveStudent(event).catch((err) => toast(err.message)));
  document.getElementById('paymentForm').addEventListener('submit', (event) => savePayment(event).catch((err) => toast(err.message)));
  document.getElementById('classForm').addEventListener('submit', (event) => saveClass(event).catch((err) => toast(err.message)));
  document.getElementById('scheduleForm')?.addEventListener('submit', (event) => saveSchedule(event).catch((err) => toast(err.message)));
  document.getElementById('groupMessageForm')?.addEventListener('submit', (event) => event.preventDefault());
  document.getElementById('groupMessageClass')?.addEventListener('change', updateGroupMessagePreview);
  document.getElementById('groupMessageTemplate')?.addEventListener('change', updateGroupMessagePreview);
  document.querySelector('[data-copy-group-message]')?.addEventListener('click', () => copyGroupMessage().catch((err) => toast(err.message)));
  document.querySelectorAll('[data-group-summary]').forEach((button) => {
    button.addEventListener('click', () => openGroupSummary(button.dataset.groupSummary));
  });
  document.querySelector('[data-open-schedule]')?.addEventListener('click', openSchedule);
  document.getElementById('planForm').addEventListener('submit', (event) => savePlan(event).catch((err) => toast(err.message)));
  document.getElementById('waitlistForm').addEventListener('submit', (event) => saveWaitlist(event).catch((err) => toast(err.message)));
  document.getElementById('extraAttendanceForm').addEventListener('submit', (event) => addExtraAttendance(event).catch((err) => toast(err.message)));
  document.getElementById('markAllPresent').addEventListener('click', () => setClassAttendance(activeAttendanceClassId, true).catch((err) => toast(err.message)));
  document.getElementById('clearAttendance').addEventListener('click', () => setClassAttendance(activeAttendanceClassId, false).catch((err) => toast(err.message)));
  document.getElementById('copyAttendance').addEventListener('click', () => copyAttendanceSummary().catch((err) => toast(err.message)));
  document.getElementById('finishAttendance').addEventListener('click', () => finishAttendance().catch((err) => toast(err.message)));
  document.getElementById('studentSearch').addEventListener('input', () => {
    resetStudentListLimit();
    renderStudentsLater();
  });
  document.getElementById('globalSearch').addEventListener('input', renderGlobalResultsLater);
  document.getElementById('globalResults').addEventListener('click', (event) => {
    const target = event.target.closest('[data-global-result]');
    if (target) openGlobalResult(target.dataset.globalResult);
  });
  document.addEventListener('click', (event) => {
    if (!event.target.closest('.global-search')) closeGlobalResults();
  });
  document.addEventListener('keydown', (event) => {
    const activeLayer = document.querySelector('.modal-wrap.open, .login-wall.open');
    if (event.key === 'Escape') {
      const openModalEl = document.querySelector('.modal-wrap.open');
      if (openModalEl) {
        closeModal(openModalEl.id);
        return;
      }
      if (!activeLayer) closeGlobalResults();
      return;
    }
    if (event.key !== 'Tab' || !activeLayer) return;
    const focusables = [...activeLayer.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')]
      .filter((element) => element.offsetParent !== null);
    if (!focusables.length) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });
  document.getElementById('studentStatusFilter').addEventListener('change', () => {
    resetStudentListLimit();
    renderStudents();
  });
  document.getElementById('studentPaymentFilter').addEventListener('change', () => {
    resetStudentListLimit();
    renderStudents();
  });
  document.getElementById('paymentMonth').addEventListener('change', () => {
    resetPaymentListLimit();
    renderPayments();
  });
  document.getElementById('paymentSearch').addEventListener('input', () => {
    resetPaymentListLimit();
    renderPaymentsLater();
  });
  document.getElementById('paymentStatusFilter').addEventListener('change', () => {
    resetPaymentListLimit();
    renderPayments();
  });
  document.getElementById('actionSearch')?.addEventListener('input', renderActionsLater);
  document.getElementById('actionActorFilter')?.addEventListener('change', renderActions);
  document.getElementById('actionCategoryFilter')?.addEventListener('change', renderActions);
  document.getElementById('classDateFilter').addEventListener('change', renderClasses);
  document.getElementById('classTypeFilter').addEventListener('change', renderClasses);
  document.getElementById('classStatusFilter').addEventListener('change', renderClasses);
  document.getElementById('classStudentSearch')?.addEventListener('input', renderClassChecklistLater);
  document.getElementById('waitStatusFilter').addEventListener('change', renderWaitlist);
  document.getElementById('bookingFilter')?.addEventListener('change', renderBookings);
  document.getElementById('studentPlan').addEventListener('change', (event) => {
    const plan = planById(event.target.value);
    if (plan) document.getElementById('studentFee').value = plan.preco || '';
  });
  const fixedScheduleList = document.getElementById('studentFixedSchedules');
  fixedScheduleList?.addEventListener('input', renderStudentSchedulePreview);
  fixedScheduleList?.addEventListener('change', renderStudentSchedulePreview);
  fixedScheduleList?.addEventListener('click', (event) => {
    const removeButton = event.target.closest('[data-remove-fixed-schedule]');
    if (!removeButton) return;
    const row = removeButton.closest('[data-fixed-schedule-row]');
    if (!row) return;
    if (fixedScheduleList.querySelectorAll('[data-fixed-schedule-row]').length === 1) renderStudentFixedScheduleRows();
    else row.remove();
    renderStudentSchedulePreview();
  });
  document.getElementById('addStudentFixedSchedule')?.addEventListener('click', () => {
    const count = fixedScheduleList?.querySelectorAll('[data-fixed-schedule-row]').length || 0;
    if (count >= 7) {
      toast('Limite de 7 dias fixos por aluno');
      return;
    }
    fixedScheduleList?.insertAdjacentHTML('beforeend', fixedScheduleRow({}, count));
    fixedScheduleList?.querySelector('[data-fixed-schedule-row]:last-child .student-fixed-day')?.focus();
    renderStudentSchedulePreview();
  });
  document.getElementById('studentLevel')?.addEventListener('change', renderStudentSchedulePreview);
  document.getElementById('themeBtn')?.addEventListener('click', toggleTheme);
  document.getElementById('logoutBtn').addEventListener('click', logout);
  document.getElementById('classStudentChecklist')?.addEventListener('change', (event) => {
    const target = event.target.closest('[data-class-student-check]');
    if (!target) return;
    toggleClassStudent(target.value, target.checked);
  });
  document.body.addEventListener('click', (event) => {
    const target = event.target.closest('[data-action],[data-report-student],[data-edit-student],[data-sync-student],[data-edit-class],[data-duplicate-class],[data-class-status],[data-cancel-class],[data-copy-class],[data-open-group-message],[data-copy-report],[data-edit-plan],[data-attendance],[data-toggle-attendance],[data-confirm-student],[data-pay],[data-pix-charge],[data-copy-charge],[data-edit-wait],[data-wait-status],[data-convert-wait],[data-remove-extra],[data-class-day],[data-more-page],[data-more-action],[data-booking-action]');
    if (!target) return;
    if (target.dataset.action && !target.closest('#quickActions')) handleQuickAction(target.dataset.action);
    if (target.dataset.morePage) setPage(target.dataset.morePage);
    if (target.dataset.moreAction === 'theme') toggleTheme();
    if (target.dataset.moreAction === 'logout') logout();
    if (target.dataset.reportStudent) openStudentReport(target.dataset.reportStudent);
    if (target.dataset.editStudent) openStudent(target.dataset.editStudent);
    if (target.dataset.syncStudent) syncStudentScheduleAction(target.dataset.syncStudent).catch((err) => toast(err.message));
    if (target.dataset.editClass) openClass(target.dataset.editClass);
    if (target.dataset.duplicateClass) duplicateClass(target.dataset.duplicateClass).catch((err) => toast(err.message));
    if (target.dataset.classStatus) {
      const [id, status] = target.dataset.classStatus.split(':');
      updateClassStatus(id, status).catch((err) => toast(err.message));
    }
    if (target.dataset.cancelClass) cancelClass(target.dataset.cancelClass).catch((err) => toast(err.message));
    if (target.dataset.openGroupMessage !== undefined) openGroupMessage(target.dataset.openGroupMessage || '');
    if (target.dataset.copyClass) copyClassRoster(target.dataset.copyClass).catch((err) => toast(err.message));
    if (target.dataset.copyReport) copyMonthlyReport().catch((err) => toast(err.message));
    if (target.dataset.editPlan) openPlan(target.dataset.editPlan);
    if (target.dataset.attendance) openAttendance(target.dataset.attendance);
    if (target.dataset.toggleAttendance) {
      const [classId, studentId] = target.dataset.toggleAttendance.split(':');
      toggleAttendance(classId, studentId).catch((err) => toast(err.message));
    }
    if (target.dataset.confirmStudent) {
      const [classId, studentId] = target.dataset.confirmStudent.split(':');
      confirmStudentAttendance(classId, studentId).catch((err) => toast(err.message));
    }
    if (target.dataset.removeExtra) {
      const [classId, index] = target.dataset.removeExtra.split(':');
      removeExtraAttendance(classId, index).catch((err) => toast(err.message));
    }
    if (target.dataset.classDay) {
      document.getElementById('classDateFilter').value = target.dataset.classDay;
      renderClasses();
    }
    if (target.dataset.pay) markPaid(target.dataset.pay).catch((err) => toast(err.message));
    if (target.dataset.pixCharge) openDirectPix(target.dataset.pixCharge);
    if (target.dataset.copyCharge) copyStudentCharge(target.dataset.copyCharge).catch((err) => toast(err.message));
    if (target.dataset.editWait) openWaitItem(target.dataset.editWait);
    if (target.dataset.waitStatus) {
      const [id, status] = target.dataset.waitStatus.split(':');
      updateWaitStatus(id, status).catch((err) => toast(err.message));
    }
    if (target.dataset.convertWait) convertWait(target.dataset.convertWait);
    if (target.dataset.bookingAction) {
      const [id, action] = target.dataset.bookingAction.split(':');
      respondBooking(id, action).catch((err) => toast(err.message));
    }
  });
}

applyAppConfig();
setTheme('dark');
updatePerformanceMode();
bindEvents();
window.addEventListener('resize', updatePerformanceMode);
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) refreshActions({ force: true }).catch(() => {});
});
window.addEventListener('storage', (event) => {
  if (event.key === STORE_KEY) syncLocalStateFromStorage();
  if (event.key === 'fv_theme') setTheme('dark', { persist: false });
});
startActionRefresh();
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('./service-worker.js?v=20260908-ui2', { scope: './' }).catch(() => {});
}
if (localStorage.getItem(PIN_KEY)) {
  showBooking(false);
  loadData().catch((err) => {
    if (/PIN|401/.test(err.message)) {
      localStorage.removeItem(PIN_KEY);
      showBooking(true);
      showLogin(false);
      return;
    }
    const modeStatus = document.getElementById('modeStatus');
    if (modeStatus) modeStatus.textContent = appConfig.localModeLabel;
    apiMode = false;
    updateSystemNotice();
    toast(err.message);
    render();
  });
} else {
  showLogin(false);
  showBooking(true);
  updateSystemNotice();
}
