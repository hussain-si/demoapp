/* Sign-in page. */
Pages.login = (() => {
  const esc = Utils.escapeHtml;
  const SAFE_NEXT = /^[a-z0-9_-]+\.html(\?[^#]*)?$/i;

  async function init() {
    const params = new URLSearchParams(location.search);
    const next = SAFE_NEXT.test(params.get('next') || '') ? params.get('next') : 'dashboard.html';
    if (Auth.readStored()) { location.replace(next); return; }

    document.querySelectorAll('[data-app-name]').forEach(el => { el.textContent = CONFIG.appName; });
    document.querySelectorAll('[data-village-name]').forEach(el => { el.textContent = CONFIG.villageName; });
    document.getElementById('brand-icon').innerHTML = UI.icon('crescent');
    if (location.protocol === 'file:') document.getElementById('file-warning').hidden = false;

    const form = document.getElementById('login-form');
    const error = document.getElementById('login-error');
    const password = form.elements.password;
    const toggle = document.getElementById('toggle-password');
    toggle.innerHTML = UI.icon('eye');
    toggle.addEventListener('click', () => {
      const show = password.type === 'password';
      password.type = show ? 'text' : 'password';
      toggle.innerHTML = UI.icon(show ? 'eyeOff' : 'eye');
      toggle.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
    });

    document.getElementById('login-foot').textContent = Supa.enabled
      ? 'Data is stored securely in Supabase'
      : 'Demo mode · changes are saved in this browser';

    if (!Supa.enabled && CONFIG.showDemoLogins && CONFIG.demoLogins?.length) {
      const box = document.getElementById('demo-logins');
      box.hidden = false;
      box.querySelector('.demo-list').innerHTML = CONFIG.demoLogins.map((d, i) => `
        <button type="button" class="demo-item" data-index="${i}">
          <span><strong>${esc(d.username)}</strong> <span class="muted">/ ${esc(d.password)}</span></span>
          <span class="badge badge-${esc(d.role.toLowerCase())}">${esc(d.role)}</span>
        </button>`).join('');
      box.addEventListener('click', e => {
        const item = e.target.closest('.demo-item');
        if (!item) return;
        const d = CONFIG.demoLogins[item.dataset.index];
        form.elements.username.value = d.username;
        password.value = d.password;
        form.requestSubmit();
      });
    }

    form.addEventListener('submit', async e => {
      e.preventDefault();
      error.hidden = true;
      const button = form.querySelector('[type="submit"]');
      button.disabled = true;
      button.textContent = 'Signing in…';
      try {
        await Auth.login(form.elements.username.value, password.value, form.elements.remember.checked);
        location.replace(next);
      } catch (err) {
        error.textContent = err.message;
        error.hidden = false;
        button.disabled = false;
        button.textContent = 'Sign in';
        password.select();
      }
    });
    form.elements.username.focus();
  }

  return { init };
})();
