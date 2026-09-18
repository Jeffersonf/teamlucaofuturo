// modules/toast.js - Sistema de feedback visual e tátil para mobile e desktop

let toastTimer = null;

export function showToast(message, type = 'info') {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = message;
  el.classList.add('show');
  if (navigator.vibrate) {
    try { navigator.vibrate(type === 'error' ? [50, 50, 50] : 30); } catch (e) {}
  }
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2400);
}
