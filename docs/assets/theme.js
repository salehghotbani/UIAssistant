(() => {
  const key = 'uiassistant-site-theme';
  const root = document.documentElement;
  const systemTheme = window.matchMedia('(prefers-color-scheme: dark)');
  const themeColor = document.querySelector('meta[name="theme-color"]');
  let preference;
  let toggle;

  try {
    preference = localStorage.getItem(key);
  } catch {
    // The site can still switch themes when browser storage is unavailable.
  }

  function applyTheme() {
    let theme = preference;
    if (theme !== 'light' && theme !== 'dark') {
      theme = systemTheme.matches ? 'dark' : 'light';
    }
    root.dataset.theme = theme;
    themeColor.content = theme === 'dark' ? '#15121e' : '#ffffff';
    toggle?.setAttribute('aria-pressed', String(theme === 'dark'));
  }

  applyTheme();
  systemTheme.addEventListener('change', applyTheme);
  window.addEventListener('storage', (event) => {
    if (event.key === key || event.key === null) {
      preference = event.newValue;
      applyTheme();
    }
  });

  document.addEventListener('DOMContentLoaded', () => {
    toggle = document.querySelector('.theme-toggle');
    if (!toggle) return;

    toggle.addEventListener('click', () => {
      preference = root.dataset.theme === 'dark' ? 'light' : 'dark';
      applyTheme();
      try {
        localStorage.setItem(key, preference);
      } catch {
        // Keep the choice for this page when the browser blocks saving it.
      }
    });
    applyTheme();
    toggle.hidden = false;
  });
})();
