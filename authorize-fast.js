const escapeHTML = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char]));
const formatDate = (value) => { const [year, month, day] = String(value || '').slice(0, 10).split('-'); return `${day}/${month}/${year}`; };
const loginForm = document.getElementById('quickLoginForm');
const pinInput = document.getElementById('quickPin');
const status = document.getElementById('status');
const pendingSection = document.getElementById('pendingSection');
const pendingList = document.getElementById('pendingList');
const updatedAt = document.getElementById('updatedAt');
const logoutButton = document.getElementById('quickLogoutButton');
const PIN_KEY = 'tlf_admin_pin';
let pin = localStorage.getItem(PIN_KEY) || '';

function setStatus(message = '', state = '') {
  status.textContent = message;
  if (state) status.dataset.state = state;
  else delete status.dataset.state;
}

async function fetchPending() {
  setStatus('Atualizando confirmações...');
  const response = await fetch('/api/quick/confirmations', { headers: { 'X-Admin-Pin': pin } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.ok === false) throw new Error(data.error || 'PIN inválido.');
  const items = data.items || [];
  pendingList.innerHTML = items.length ? items.map((item) => `<article><div><strong>${escapeHTML(item.aluno_nome)}</strong><small>${formatDate(item.data)} às ${escapeHTML(item.horario)} - ${escapeHTML(item.turma || 'Turma')}</small></div><button type="button" data-confirm="${item.aula_id}:${item.aluno_id}">Autorizar</button></article>`).join('') : '<p class="empty">Nenhuma indicação pendente.</p>';
  updatedAt.textContent = `Atualizado às ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
  setStatus('Lista atualizada.', 'success');
  setTimeout(() => { if (status.textContent === 'Lista atualizada.') setStatus(); }, 1800);
}

async function login(event) {
  event.preventDefault(); pin = pinInput.value.trim(); if (!pin) return;
  setStatus('Entrando...');
  try {
    const response = await fetch('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Admin-Pin': pin }, body: JSON.stringify({ pin }) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.ok === false) throw new Error(data.error || 'PIN inválido.');
    localStorage.setItem(PIN_KEY, pin);
    document.getElementById('loginSection').hidden = true; pendingSection.hidden = false; await fetchPending();
  } catch (error) {
    localStorage.removeItem(PIN_KEY);
    pin = '';
    setStatus(error.message, 'error');
  }
}

async function confirm(button) {
  const [classId, studentId] = button.dataset.confirm.split(':'); button.disabled = true;
  try {
    const response = await fetch(`/api/classes/${classId}/student-confirmation`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Admin-Pin': pin }, body: JSON.stringify({ student_id: studentId, action: 'approve' }) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.ok === false) throw new Error(data.error || 'Não foi possível autorizar.');
    await fetchPending();
    setStatus('Aluno autorizado com sucesso.', 'success');
  } catch (error) { button.disabled = false; setStatus(error.message, 'error'); }
}

function logout() {
  localStorage.removeItem(PIN_KEY);
  pin = '';
  pendingSection.hidden = true;
  document.getElementById('loginSection').hidden = false;
  pinInput.value = '';
  setStatus('Sessão encerrada.');
  pinInput.focus();
}

loginForm.addEventListener('submit', login);
document.getElementById('refreshButton').addEventListener('click', () => fetchPending().catch((error) => { setStatus(error.message, 'error'); }));
logoutButton.addEventListener('click', logout);
pendingList.addEventListener('click', (event) => { const button = event.target.closest('[data-confirm]'); if (button) confirm(button); });
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && !pendingSection.hidden && pin) fetchPending().catch((error) => { setStatus(error.message, 'error'); });
});
setInterval(() => {
  if (!document.hidden && !pendingSection.hidden && pin) fetchPending().catch(() => {});
}, 30000);

if (pin) {
  pinInput.value = pin;
  login({ preventDefault() {} });
}
