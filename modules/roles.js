// modules/roles.js - Acesso Unificado (1 login com acesso a tudo)
export const ROLE_KEY = 'tlf_user_role';

export function getStoredRole() {
  return 'admin';
}

export function setStoredRole(role) {
  localStorage.setItem(ROLE_KEY, 'admin');
}

export function isTeacher() {
  return false;
}

export function isAdmin() {
  return true;
}

export function applyRoleUI() {
  // Acesso 100% unificado: todas as abas e recursos liberados
  const financialNavs = document.querySelectorAll('[data-page="payments"], [data-page="reports"], [data-page="plans"], [data-page="settings"]');
  financialNavs.forEach(nav => {
    nav.style.opacity = '1';
    nav.removeAttribute('title');
  });

  const badge = document.getElementById('userRoleBadge');
  if (badge) {
    badge.textContent = 'Gestão';
    badge.style.background = 'rgba(220, 38, 38, 0.15)';
    badge.style.color = '#ef4444';
    badge.style.border = '1px solid rgba(220, 38, 38, 0.3)';
  }
}

