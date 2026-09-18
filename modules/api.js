// modules/api.js - Camada de requisições HTTP e conexão com o servidor

const PIN_KEY = 'tlf_admin_pin';

export async function api(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  const pin = localStorage.getItem(PIN_KEY);
  if (pin) headers['X-Admin-Pin'] = pin;
  if (options.body && typeof options.body === 'string') {
    headers['Content-Type'] = 'application/json';
  }
  const res = await fetch(path, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.ok === false) {
    throw new Error(data.error || `HTTP ${res.status}`);
  }
  return data;
}

export async function detectServer() {
  if (typeof location !== 'undefined' && location.protocol === 'file:') return false;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 900);
    const res = await fetch('/health', { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return false;
    const data = await res.json().catch(() => null);
    return Boolean(data && data.ok === true && data.mode === 'server');
  } catch {
    return false;
  }
}
