// modules/arenas.js - Gestão Multi-Arena (Multi-Tenancy)
export async function loadArenas(getAdminPin) {
  const pin = typeof getAdminPin === 'function' ? getAdminPin() : getAdminPin;
  try {
    const res = await fetch('/api/arenas', {
      headers: { 'x-admin-pin': pin || '' }
    });
    const data = await res.json();
    return data.items || [];
  } catch {
    return [{ id: 1, slug: 'team-lucao', nome: 'Team Lucão Futevôlei' }];
  }
}

export async function createNewArena(payload, getAdminPin) {
  const pin = typeof getAdminPin === 'function' ? getAdminPin() : getAdminPin;
  const res = await fetch('/api/arenas', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-admin-pin': pin || ''
    },
    body: JSON.stringify(payload)
  });
  return res.json();
}
