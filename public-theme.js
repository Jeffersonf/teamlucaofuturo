(() => {
  const key = 'fv_theme';
  const normalize = (value) => String(value || 'dark').toLowerCase().endsWith('light') ? 'light' : 'dark';
  const icon = (dark) => dark
    ? '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>'
    : '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.8A8.5 8.5 0 1 1 11.2 3 6.5 6.5 0 0 0 21 12.8Z"/></svg>';

  function apply(value, persist = true) {
    const theme = normalize(value);
    const dark = theme === 'dark';
    document.documentElement.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0d1017' : '#f8fafc');
    document.querySelectorAll('[data-theme-toggle]').forEach((button) => {
      button.innerHTML = icon(dark);
      button.setAttribute('aria-label', dark ? 'Usar modo claro' : 'Usar modo escuro');
      button.setAttribute('aria-pressed', dark ? 'true' : 'false');
    });
    if (persist) localStorage.setItem(key, theme);
  }

  apply(localStorage.getItem(key) || 'dark', false);
  document.querySelectorAll('[data-theme-toggle]').forEach((button) => button.addEventListener('click', () => {
    apply(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
  }));
  window.addEventListener('storage', (event) => { if (event.key === key) apply(event.newValue, false); });
})();
