// modules/roles.js - Controle de Acesso e Permissões (Admin vs Professor)
export const ROLE_KEY = 'tlf_user_role';

export function getStoredRole() {
  return localStorage.getItem(ROLE_KEY) || 'admin';
}

export function setStoredRole(role) {
  localStorage.setItem(ROLE_KEY, role || 'admin');
}

export function isTeacher() {
  return getStoredRole() === 'teacher';
}

export function isAdmin() {
  return getStoredRole() === 'admin';
}

export function applyRoleUI(role) {
  const currentRole = role || getStoredRole();
  const isProf = currentRole === 'teacher';

  // Atualizar badge no cabeçalho
  const badge = document.getElementById('userRoleBadge');
  if (badge) {
    badge.textContent = isProf ? '👨‍🏫 Professor' : '👑 Administrador';
    badge.style.background = isProf ? '#fef3c7' : '#e0f2fe';
    badge.style.color = isProf ? '#92400e' : '#0369a1';
  }

  // Ocultar abas financeiras e administrativas para o professor
  const financialNavs = document.querySelectorAll('[data-page="payments"], [data-page="reports"], [data-page="plans"], [data-page="settings"]');
  financialNavs.forEach(nav => {
    if (isProf) {
      nav.style.opacity = '0.35';
      nav.setAttribute('title', 'Acesso restrito ao Administrador');
    } else {
      nav.style.opacity = '1';
      nav.removeAttribute('title');
    }
  });

  // Se o professor estiver numa aba restrita, redirecionar para dashboard
  const activeNav = document.querySelector('.nav-item.active');
  const activePage = activeNav?.getAttribute('data-page');
  if (isProf && ['payments', 'reports', 'plans', 'settings'].includes(activePage)) {
    const dashboardBtn = document.querySelector('[data-page="dashboard"]');
    if (dashboardBtn) dashboardBtn.click();
  }
}
