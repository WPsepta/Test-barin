/* ═══════════════════════════════════════════════════════════════
   DSOC AI — Theme (dark only, no toggle)
   ═══════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  const STORAGE_KEY = 'dsoc_theme';
  const html = document.documentElement;

  function getTheme() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === 'dark' || saved === 'light') return saved;
    } catch (_) {}
    return 'dark'; // default dark
  }

  function applyTheme(theme) {
    html.setAttribute('data-theme', theme);
    if (document.body) document.body.setAttribute('data-theme', theme);
    try { localStorage.setItem(STORAGE_KEY, theme); } catch (_) {}
  }

  applyTheme(getTheme());

  window.DSOC_THEME = {
    get: function () { return html.getAttribute('data-theme') || 'dark'; },
    set: applyTheme,
    toggle: function () { applyTheme(html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark'); }
  };
})();