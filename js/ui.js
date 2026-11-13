/* App shell (header, navigation, banner), dialogs, toasts, theme and page start-up. */
const Pages = {};

const UI = (() => {
  const esc = Utils.escapeHtml;

  // Simple line icons (24×24, drawn with the current text colour).
  const ICONS = {
    dashboard: '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
    home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9v12h14V9"/><path d="M10 21v-6h4v6"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1"/>',
    shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
    trash: '<path d="M3 6h18"/><path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2"/><path d="m19 6-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    download: '<path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/>',
    upload: '<path d="M12 21V9"/><path d="m7 14 5-5 5 5"/><path d="M5 3h14"/>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/>',
    printer: '<path d="M6 9V3h12v6"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="7" rx="1"/>',
    arrowLeft: '<path d="M19 12H5"/><path d="m12 19-7-7 7-7"/>',
    arrowRight: '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
    chevronDown: '<path d="m6 9 6 6 6-6"/>',
    chevronRight: '<path d="m9 18 6-6-6-6"/>',
    phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/>',
    pin: '<path d="M12 21s-7-6.2-7-12a7 7 0 0 1 14 0c0 5.8-7 12-7 12z"/><circle cx="12" cy="9" r="2.5"/>',
    tree: '<rect x="9" y="2" width="6" height="5" rx="1"/><rect x="2" y="17" width="6" height="5" rx="1"/><rect x="16" y="17" width="6" height="5" rx="1"/><path d="M12 7v6"/><path d="M5 17v-3a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v3"/>',
    crescent: '<path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5z"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>',
    moon: '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    alert: '<circle cx="12" cy="12" r="9"/><path d="M12 8v4M12 16h.01"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
    refresh: '<path d="M21 12a9 9 0 0 1-15.5 6.3L3 16"/><path d="M3 21v-5h5"/><path d="M3 12a9 9 0 0 1 15.5-6.3L21 8"/><path d="M21 3v5h-5"/>',
    copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"/>',
    eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    eyeOff: '<path d="m3 3 18 18"/><path d="M10.6 5.1A10.8 10.8 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4.1M6.6 6.6C3.9 8.4 2 12 2 12s3.5 7 10 7a9.7 9.7 0 0 0 5.4-1.6"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/>',
    idcard: '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="11" r="2"/><path d="M6 16c.6-1.3 1.7-2 3-2s2.4.7 3 2"/><path d="M15 10h3M15 14h3"/>',
    child: '<circle cx="12" cy="12" r="9"/><path d="M8.5 14.5s1.3 1.5 3.5 1.5 3.5-1.5 3.5-1.5"/><path d="M9 9.5h.01M15 9.5h.01"/>',
    heart: '<path d="M19.5 12.6 12 20l-7.5-7.4a4.9 4.9 0 0 1 7-6.9l.5.5.5-.5a4.9 4.9 0 0 1 7 6.9z"/>',
    chart: '<path d="M4 20V10M10 20V4M16 20v-7M21 20H3"/>',
    file: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/>',
    fit: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
    image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/>',
    key: '<circle cx="8" cy="15" r="4"/><path d="m10.8 12.2 9.2-9.2M17 6l3 3M14 9l2 2"/>',
    database: '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5"/><path d="M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/>',
    lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  };

  function icon(name, extraClass = '') {
    return `<svg class="icon ${extraClass}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ''}</svg>`;
  }

  const cssVar = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

  // ---------- Theme ----------
  const darkQuery = matchMedia('(prefers-color-scheme: dark)');
  const isDark = () => {
    const t = document.documentElement.dataset.theme;
    return t ? t === 'dark' : darkQuery.matches;
  };
  function toggleTheme() {
    const next = isDark() ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    Utils.storage.set('vfr.theme', next);
    themeChanged();
  }
  function themeChanged() {
    updateThemeButtons();
    document.dispatchEvent(new Event('themechange'));
  }
  function updateThemeButtons() {
    document.querySelectorAll('[data-action="theme-toggle"]').forEach(b => {
      b.innerHTML = icon(isDark() ? 'sun' : 'moon');
      b.setAttribute('aria-label', isDark() ? 'Switch to light theme' : 'Switch to dark theme');
      b.title = b.getAttribute('aria-label');
    });
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', cssVar('--surface'));
  }
  function bindThemeToggles() {
    document.querySelectorAll('[data-action="theme-toggle"]').forEach(b => b.addEventListener('click', toggleTheme));
    updateThemeButtons();
  }
  darkQuery.addEventListener('change', () => { if (!document.documentElement.dataset.theme) themeChanged(); });

  // ---------- Header & navigation ----------
  const NAV = [
    { href: 'dashboard.html', label: 'Dashboard', icon: 'dashboard', pages: ['dashboard'] },
    { href: 'families.html', label: 'Families', icon: 'users', pages: ['families', 'family'] },
    { href: 'admin.html', label: 'Admin', icon: 'shield', pages: ['admin'], adminOnly: true },
  ];

  function renderShell(page, session) {
    const links = NAV.filter(n => !n.adminOnly || Auth.can('admin')).map(n => {
      const active = n.pages.includes(page);
      return `<a class="nav-link${active ? ' active' : ''}" href="${n.href}"${active ? ' aria-current="page"' : ''}>${icon(n.icon)}<span>${n.label}</span></a>`;
    }).join('');
    const header = document.getElementById('app-header');
    header.innerHTML = `
      <div class="header-inner">
        <a class="brand" href="dashboard.html">
          <span class="brand-mark">${icon('crescent')}</span>
          <span class="brand-text"><strong>${esc(CONFIG.appName)}</strong><small>${esc(CONFIG.villageName)}</small></span>
        </a>
        <nav class="nav" aria-label="Main">${links}</nav>
        <div class="header-tools">
          <button type="button" class="icon-btn theme-toggle" data-action="theme-toggle"></button>
          <div class="user-menu dropdown">
            <button class="user-button" type="button" aria-haspopup="menu" aria-expanded="false" aria-label="Account menu">
              <span class="avatar">${esc(Utils.initials(session.name))}</span>
              <span class="user-meta"><strong>${esc(session.name)}</strong><small>${esc(Auth.roleLabel(session.role))}</small></span>
              ${icon('chevronDown', 'chevron')}
            </button>
            <div class="menu" role="menu" hidden>
              <div class="menu-head">
                <strong>${esc(session.name)}</strong>
                <span>@${esc(session.username)} · <span class="badge badge-${esc(session.role)}">${esc(Auth.roleLabel(session.role))}</span></span>
              </div>
              ${Supa.enabled ? `<button type="button" role="menuitem" data-action="password">${icon('key')}<span>Change password</span></button>` : ''}
              <button type="button" role="menuitem" data-action="logout" class="danger">${icon('logout')}<span>Log out</span></button>
            </div>
          </div>
        </div>
      </div>`;
    dropdown(header.querySelector('.user-button'), header.querySelector('.menu'));
    bindThemeToggles();
    header.querySelector('[data-action="password"]')?.addEventListener('click', changePasswordDialog);
    header.querySelector('[data-action="logout"]').addEventListener('click', () => Auth.logout());

    const bottom = document.createElement('nav');
    bottom.className = 'bottom-nav';
    bottom.setAttribute('aria-label', 'Main');
    bottom.innerHTML = links;
    document.body.appendChild(bottom);
    document.body.classList.add('has-bottom-nav');
  }

  // ---------- Banner (demo mode / new data available) ----------
  function changePasswordDialog() {
    openDialog({
      title: 'Change password',
      subtitle: 'Other devices signed in with your account will be signed out.',
      submitLabel: 'Change password',
      body: `
        <div class="form-grid">
          <div class="field span-2"><label for="cp-old">Current password</label><input id="cp-old" name="old_password" type="password" autocomplete="current-password"></div>
          <div class="field span-2"><label for="cp-new">New password</label><input id="cp-new" name="new_password" type="password" autocomplete="new-password" placeholder="At least 8 characters"></div>
          <div class="field span-2"><label for="cp-again">New password again</label><input id="cp-again" name="new_password_again" type="password" autocomplete="new-password"></div>
        </div>`,
      onSubmit: async form => {
        const data = Object.fromEntries(new FormData(form));
        if (data.new_password !== data.new_password_again) {
          throw new Utils.FieldError('new_password_again', 'The two new passwords are not the same.');
        }
        await Auth.changePassword(data.old_password, data.new_password);
        toast('Password changed');
      },
    });
  }

  function renderBanner() {
    const box = document.getElementById('app-banner');
    if (!box || DB.online) return; // the banner is only about demo mode
    const info = DB.info();
    if (info.seedChanged) {
      box.innerHTML = `
        <div class="banner banner-warning" role="status"><div class="banner-inner">
          ${icon('refresh')}
          <p><strong>New data available.</strong> The CSV files were updated. Loading them replaces the changes saved in this browser${Auth.can('export') ? ' (export them first if you need them)' : ''}.</p>
          <button type="button" class="btn btn-sm btn-secondary" data-action="reload">Load new data</button>
        </div></div>`;
      box.querySelector('[data-action="reload"]').addEventListener('click', async () => {
        const ok = await confirm({ title: 'Load the new CSV data?', message: 'Changes saved in this browser will be replaced by the data in the CSV files.', confirmLabel: 'Load new data', danger: false });
        if (!ok) return;
        await DB.reloadFromFiles();
        flash('Loaded the latest CSV data.');
        location.reload();
      });
      return;
    }
    if (Utils.storage.get('vfr.banner-hidden', true)) return;
    box.innerHTML = `
      <div class="banner" role="note"><div class="banner-inner">
        ${icon('info')}
        <p><strong>Demo mode.</strong> Changes are saved only in this browser.${Auth.can('admin') ? ' Use <b>Backup</b> on the Admin page to save them as CSV files.' : ''}</p>
        <button type="button" class="icon-btn" aria-label="Hide this message">${icon('x')}</button>
      </div></div>`;
    box.querySelector('button').addEventListener('click', () => {
      Utils.storage.set('vfr.banner-hidden', '1', true);
      box.innerHTML = '';
    });
  }

  // ---------- Toasts ----------
  function toast(message, type = 'success') {
    let wrap = document.getElementById('toasts');
    if (!wrap) {
      wrap = Object.assign(document.createElement('div'), { id: 'toasts', className: 'toasts' });
      wrap.setAttribute('aria-live', 'polite');
      document.body.appendChild(wrap);
    }
    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    el.innerHTML = `${icon(type === 'error' ? 'alert' : 'check')}<span></span>`;
    el.querySelector('span').textContent = message;
    wrap.appendChild(el);
    requestAnimationFrame(() => el.classList.add('show'));
    setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 300); }, 3500);
  }
  // A toast to show after the next page loads.
  const flash = (message, type = 'success') => Utils.storage.set('vfr.flash', JSON.stringify({ message, type }), true);
  function showFlash() {
    const raw = Utils.storage.get('vfr.flash', true);
    if (!raw) return;
    Utils.storage.remove('vfr.flash', true);
    try { const f = JSON.parse(raw); toast(f.message, f.type); } catch { /* ignore */ }
  }

  // ---------- Dialogs ----------
  /**
   * Open a modal form. onSubmit(form) may throw; the message is shown in the dialog
   * (and a Utils.FieldError also highlights its field). Return false to keep it open.
   */
  function openDialog({ title, subtitle = '', body, submitLabel = 'Save', danger = false, wide = false, onSubmit }) {
    const dlg = document.createElement('dialog');
    dlg.className = 'dialog' + (wide ? ' dialog-wide' : '');
    dlg.innerHTML = `
      <form class="dialog-form" novalidate>
        <header class="dialog-header">
          <div><h2>${esc(title)}</h2>${subtitle ? `<p>${esc(subtitle)}</p>` : ''}</div>
          <button type="button" class="icon-btn" data-close aria-label="Close">${icon('x')}</button>
        </header>
        <div class="dialog-body"></div>
        <div class="form-error" role="alert" hidden></div>
        <footer class="dialog-footer">
          <button type="button" class="btn btn-ghost" data-close>Cancel</button>
          <button type="submit" class="btn ${danger ? 'btn-danger' : 'btn-primary'}">${esc(submitLabel)}</button>
        </footer>
      </form>`;
    dlg.querySelector('.dialog-body').innerHTML = body;
    document.body.appendChild(dlg);

    const form = dlg.querySelector('form');
    const errorBox = dlg.querySelector('.form-error');
    dlg.addEventListener('close', () => dlg.remove());
    dlg.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => dlg.close()));
    form.addEventListener('input', e => e.target.removeAttribute?.('aria-invalid'));
    form.addEventListener('submit', async e => {
      e.preventDefault();
      errorBox.hidden = true;
      form.querySelectorAll('[aria-invalid]').forEach(el => el.removeAttribute('aria-invalid'));
      const button = form.querySelector('[type="submit"]');
      button.disabled = true;
      try {
        if ((await onSubmit(form, dlg)) !== false) dlg.close();
      } catch (err) {
        errorBox.textContent = err.message;
        errorBox.hidden = false;
        const field = err.field && form.elements[err.field];
        const target = field && (field instanceof RadioNodeList ? field[0] : field);
        if (target) {
          (field instanceof RadioNodeList ? [...field] : [target]).forEach(el => el.setAttribute('aria-invalid', 'true'));
          target.focus();
        } else {
          errorBox.scrollIntoView({ block: 'nearest' });
        }
      } finally {
        button.disabled = false;
      }
    });
    dlg.showModal();
    return dlg;
  }

  function confirm({ title, message, confirmLabel = 'Delete', danger = true }) {
    return new Promise(resolve => {
      let ok = false;
      const dlg = openDialog({
        title, submitLabel: confirmLabel, danger,
        body: '<p class="confirm-text"></p>',
        onSubmit: () => { ok = true; },
      });
      dlg.classList.add('dialog-confirm');
      dlg.querySelector('.confirm-text').textContent = message;
      dlg.addEventListener('close', () => resolve(ok));
    });
  }

  // ---------- Small pieces ----------
  function dropdown(trigger, menu) {
    const close = () => { menu.hidden = true; trigger.setAttribute('aria-expanded', 'false'); };
    trigger.addEventListener('click', e => {
      e.stopPropagation();
      const open = menu.hidden;
      document.querySelectorAll('.menu').forEach(m => { m.hidden = true; });
      menu.hidden = !open;
      trigger.setAttribute('aria-expanded', String(open));
    });
    document.addEventListener('click', e => { if (!menu.contains(e.target)) close(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
    menu.addEventListener('click', e => { if (e.target.closest('button, a')) close(); });
  }

  /**
   * Shows a filter <select> as a button with a styled list (the browser's own list cannot be styled).
   * The <select> stays in the page, hidden, so its value and 'change' events work as before.
   * <option data-count="8"> shows the number on the right. Call select._menu.refresh() after
   * changing select.value from code.
   */
  let selectCount = 0;
  let openSelect = null;
  function enhanceSelect(select) {
    if (select._menu) { select._menu.refresh(); return select._menu; }
    const id = select.id || `select-${++selectCount}`;
    const wrap = document.createElement('div');
    wrap.className = 'select-menu';
    select.before(wrap);
    wrap.append(select);
    select.hidden = true;

    const button = document.createElement('button');
    button.type = 'button';
    button.id = `${id}-button`;
    button.className = 'select-button';
    button.setAttribute('aria-haspopup', 'listbox');
    button.setAttribute('aria-expanded', 'false');
    const label = document.querySelector(`label[for="${select.id}"]`);
    if (label) label.htmlFor = button.id;
    const name = select.getAttribute('aria-label') || label?.textContent.trim() || '';
    const list = document.createElement('ul');
    list.className = 'select-list';
    list.id = `${id}-list`;
    list.setAttribute('role', 'listbox');
    list.hidden = true;
    button.setAttribute('aria-controls', list.id);
    wrap.append(button, list);
    let active = -1;

    function refresh() {
      const current = select.options[select.selectedIndex];
      button.innerHTML = `<span class="select-value"></span>${icon('chevronDown', 'chevron')}`;
      button.querySelector('.select-value').textContent = current ? current.text : '';
      if (name) button.setAttribute('aria-label', `${name}: ${current ? current.text : ''}`);
      if (!list.hidden) renderList();
    }
    function renderList() {
      list.innerHTML = [...select.options].map((o, i) => `
        <li role="option" id="${list.id}-${i}" data-index="${i}" aria-selected="${i === select.selectedIndex}">
          <span class="option-check">${i === select.selectedIndex ? icon('check') : ''}</span>
          <span class="option-label">${esc(o.text)}</span>
          ${o.dataset.count !== undefined ? `<span class="option-count">${esc(o.dataset.count)}</span>` : ''}
        </li>`).join('');
    }
    function setActive(i, scroll = true) {
      const items = [...list.children];
      if (!items.length) return;
      active = Math.max(0, Math.min(items.length - 1, i));
      items.forEach((li, n) => li.classList.toggle('active', n === active));
      button.setAttribute('aria-activedescendant', items[active].id);
      if (scroll) items[active].scrollIntoView({ block: 'nearest' });
    }
    function open() {
      if (openSelect && openSelect !== close) openSelect();
      openSelect = close;
      renderList();
      list.hidden = false;
      button.setAttribute('aria-expanded', 'true');
      setActive(select.selectedIndex);
    }
    function close() {
      list.hidden = true;
      button.setAttribute('aria-expanded', 'false');
      button.removeAttribute('aria-activedescendant');
      if (openSelect === close) openSelect = null;
    }
    function choose(i) {
      if (i >= 0 && i !== select.selectedIndex) {
        select.selectedIndex = i;
        select.dispatchEvent(new Event('change', { bubbles: true }));
      }
      close();
      refresh();
      button.focus();
    }

    button.addEventListener('click', () => (list.hidden ? open() : close()));
    button.addEventListener('keydown', e => {
      const isOpen = !list.hidden;
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        if (!isOpen) open(); else setActive(active + (e.key === 'ArrowDown' ? 1 : -1));
      } else if (isOpen && e.key === 'Home') { e.preventDefault(); setActive(0); }
      else if (isOpen && e.key === 'End') { e.preventDefault(); setActive(list.children.length - 1); }
      else if (isOpen && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); choose(active); }
      else if (isOpen && e.key === 'Escape') { e.preventDefault(); close(); }
      else if (isOpen && e.key === 'Tab') close();
    });
    list.addEventListener('mousedown', e => e.preventDefault()); // keep focus on the button
    list.addEventListener('mousemove', e => {
      const li = e.target.closest('[data-index]');
      if (li && +li.dataset.index !== active) setActive(+li.dataset.index, false);
    });
    list.addEventListener('click', e => {
      const li = e.target.closest('[data-index]');
      if (li) choose(+li.dataset.index);
    });
    document.addEventListener('pointerdown', e => { if (!list.hidden && !wrap.contains(e.target)) close(); });
    new MutationObserver(refresh).observe(select, { childList: true });
    select.addEventListener('change', refresh);
    refresh();
    select._menu = { refresh, open, close };
    return select._menu;
  }

  /** <option> list. Values not in the list (for example from an imported CSV) are kept as an extra option. */
  function options(list, selected = '', placeholder) {
    const items = list.map(o => (typeof o === 'string' ? { value: o, label: o } : o));
    if (selected && !items.some(o => o.value === selected)) items.push({ value: selected, label: selected });
    return (placeholder !== undefined ? `<option value="">${esc(placeholder)}</option>` : '')
      + items.map(o => `<option value="${esc(o.value)}"${o.value === selected ? ' selected' : ''}>${esc(o.label)}</option>`).join('');
  }

  function emptyState({ icon: name = 'info', title, text = '', action = '' }) {
    return `
      <div class="empty-state">
        <span class="empty-icon">${icon(name)}</span>
        <h3>${esc(title)}</h3>
        ${text ? `<p>${esc(text)}</p>` : ''}
        ${action}
      </div>`;
  }

  // A list for people to read (Families page), or with backup a file in the database format that Import reads (Admin page).
  function exportTable(table, backup = false) {
    try {
      const file = backup ? `${table}.csv` : `${table === 'families' ? 'Families' : 'Members'} ${Utils.todayISO()}.csv`;
      Utils.downloadText(file, backup ? DB.exportCSV(table) : DB.exportReadable(table));
      toast(`Downloaded ${file}`);
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  // ---------- Start-up ----------
  async function start() {
    const page = document.body.dataset.page;
    if (page === 'login') {
      if (!Auth.readStored()) DB.forget();
      bindThemeToggles(); await Pages.login.init(); showFlash(); return;
    }

    const session = await Auth.requireAuth();
    if (!session) return;
    if (page === 'admin' && !Auth.can('admin')) { location.replace('dashboard.html'); return; }

    renderShell(page, session);
    const main = document.getElementById('main');
    main.hidden = false;
    try {
      await DB.load();
      renderBanner();
      await Pages[page].init(session);
    } catch (err) {
      console.error(err);
      main.innerHTML = emptyState({ icon: 'alert', title: 'Something went wrong', text: err.message });
    }
    document.getElementById('page-loader')?.remove();
    showFlash();
  }
  document.addEventListener('DOMContentLoaded', start);

  return { icon, cssVar, isDark, toast, flash, openDialog, confirm, dropdown, enhanceSelect, options, emptyState, exportTable };
})();
