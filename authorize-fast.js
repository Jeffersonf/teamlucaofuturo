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
  if (!status) return;
  status.textContent = message;
  if (!message) {
    status.className = 'w-full max-w-md hidden mb-4';
    return;
  }
  if (state === 'success') {
    status.className = 'w-full max-w-md p-3 rounded-2xl bg-emerald-950/60 border border-emerald-800/60 text-emerald-300 text-xs font-medium block mb-4 text-center';
  } else if (state === 'error') {
    status.className = 'w-full max-w-md p-3 rounded-2xl bg-red-950/60 border border-red-800/60 text-red-300 text-xs font-medium block mb-4 text-center';
  } else {
    status.className = 'w-full max-w-md p-3 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 text-xs font-medium block mb-4 text-center';
  }
}

async function fetchPending() {
  setStatus('Atualizando...');
  try {
    const response = await fetch('/api/quick/confirmations', { headers: { 'X-Admin-Pin': pin } });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.ok === false) throw new Error(data.error || 'PIN inválido.');
    const items = data.items || [];
    pendingList.innerHTML = items.length ? items.map((item) => `
      <article class="p-3.5 sm:p-4 rounded-2xl bg-zinc-950/60 border border-zinc-800 hover:border-zinc-700 transition-colors flex items-center justify-between gap-3">
        <div>
          <strong class="text-sm font-semibold text-zinc-100 block">${escapeHTML(item.aluno_nome)}</strong>
          <p class="text-xs text-zinc-400 mt-0.5">${formatDate(item.data)} às ${escapeHTML(item.horario)} · ${escapeHTML(item.turma || 'Turma')}</p>
        </div>
        <button class="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-sm shadow-emerald-600/25 transition-all active:scale-95 shrink-0 flex items-center gap-1.5" type="button" data-confirm="${item.aula_id}:${item.aluno_id}">
          <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
          Autorizar
        </button>
      </article>
    `).join('') : '<p class="text-xs text-zinc-500 text-center py-8 bg-zinc-950/30 rounded-2xl border border-zinc-800/40">Nenhuma indicação de presença pendente.</p>';
    if (updatedAt) updatedAt.textContent = `Atualizado às ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
    setStatus('Lista atualizada.', 'success');
    setTimeout(() => { if (status && status.textContent === 'Lista atualizada.') setStatus(); }, 1800);
  } catch (err) {
    setStatus(err.message, 'error');
  }
}

async function login(event) {
  event?.preventDefault?.();
  pin = pinInput.value.trim();
  if (!pin) return;
  setStatus('Validando PIN...');
  try {
    const response = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Admin-Pin': pin },
      body: JSON.stringify({ pin })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.ok === false) throw new Error(data.error || 'PIN inválido.');
    localStorage.setItem(PIN_KEY, pin);
    document.getElementById('loginSection').hidden = true;
    pendingSection.hidden = false;
    await fetchPending();
  } catch (error) {
    localStorage.removeItem(PIN_KEY);
    pin = '';
    setStatus(error.message, 'error');
  }
}

async function confirm(button) {
  const [classId, studentId] = button.dataset.confirm.split(':');
  button.disabled = true;
  button.textContent = 'Gravando...';
  try {
    const response = await fetch(`/api/classes/${classId}/student-confirmation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Admin-Pin': pin },
      body: JSON.stringify({ student_id: studentId, action: 'approve' })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.ok === false) throw new Error(data.error || 'Não foi possível autorizar.');
    await fetchPending();
    setStatus('Presença autorizada com sucesso!', 'success');
  } catch (error) {
    button.disabled = false;
    button.textContent = 'Autorizar';
    setStatus(error.message, 'error');
  }
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
document.getElementById('refreshButton')?.addEventListener('click', () => fetchPending());
logoutButton?.addEventListener('click', logout);
pendingList?.addEventListener('click', (event) => {
  const button = event.target.closest('[data-confirm]');
  if (button && !button.disabled) confirm(button);
});

document.addEventListener('visibilitychange', () => {
  if (!document.hidden && !pendingSection.hidden && pin) fetchPending().catch(() => {});
});

setInterval(() => {
  if (!document.hidden && !pendingSection.hidden && pin) fetchPending().catch(() => {});
}, 30000);

if (pin) {
  pinInput.value = pin;
  login();
}
