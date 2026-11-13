/*
 * Admin page: users, role permissions and the data tools.
 * With Supabase, users are added, edited and removed here directly.
 * In demo mode, users live in data/users.csv and this page makes the line to paste there.
 */
Pages.admin = (() => {
  const esc = Utils.escapeHtml;
  const online = Supa.enabled;
  let users = [];
  let editing = null; // username being edited (Supabase)

  async function init() {
    if (online) setOnlineTexts();
    renderPermissions();
    renderData();
    setupUserForm();
    setupUserList();
    setupDataTools();
    await refreshUsers();
  }

  function setOnlineTexts() {
    const set = (id, html) => { document.getElementById(id).innerHTML = html; };
    set('admin-sub', 'Users, roles and the data stored in Supabase.');
    set('users-source', 'Stored in Supabase');
    set('users-note', 'To change someone\'s role or reset their password, click the pencil. Everyone can change their own password from the account menu.');
    set('user-form-title', 'Add a user');
    set('user-form-sub', 'Saved straight to the database. No email is needed.');
    set('data-title', 'Data in Supabase');
    set('data-sub', 'Shared by everyone who signs in');
    set('perm-sub', 'Set for each user in the Users list');
    document.getElementById('user-submit').textContent = 'Save user';
    document.getElementById('reload-data').hidden = true;
  }

  // ---------- Users ----------
  async function refreshUsers() {
    try {
      users = await Auth.loadUsers();
      renderUsers();
    } catch (err) {
      document.getElementById('users-list').innerHTML = `<p class="form-error">${esc(err.message)}</p>`;
    }
  }

  function renderUsers() {
    const me = Auth.current().username;
    document.getElementById('users-count').textContent = `${users.length} ${users.length === 1 ? 'user' : 'users'}`;
    document.getElementById('users-list').innerHTML = `
      <ul class="user-list">${users.map(u => `
        <li data-username="${esc(u.username)}">
          <span class="avatar">${esc(Utils.initials(u.name))}</span>
          <span class="user-list-text"><strong>${esc(u.name)}${u.username === me ? ' <span class="muted">(you)</span>' : ''}</strong><small>@${esc(u.username)}</small></span>
          <span class="badge badge-${esc(u.role)}">${esc(Auth.roleLabel(u.role))}</span>
          ${online ? `
            <span class="user-actions">
              <button type="button" class="icon-btn" data-action="edit-user" aria-label="Edit ${esc(u.name)}">${UI.icon('edit')}</button>
              ${u.username !== me ? `<button type="button" class="icon-btn danger" data-action="delete-user" aria-label="Delete ${esc(u.name)}">${UI.icon('trash')}</button>` : ''}
            </span>` : ''}
        </li>`).join('')}</ul>`;
  }

  function setupUserList() {
    document.getElementById('users-list').addEventListener('click', async e => {
      const action = e.target.closest('[data-action]')?.dataset.action;
      const user = users.find(u => u.username === e.target.closest('[data-username]')?.dataset.username);
      if (!action || !user) return;
      if (action === 'edit-user') { startEdit(user); return; }
      const ok = await UI.confirm({
        title: `Delete ${user.name}?`,
        message: `@${user.username} will no longer be able to sign in. Families and members they added are kept.`,
        confirmLabel: 'Delete user',
      });
      if (!ok) return;
      try {
        await Auth.deleteUser(user.username);
        if (editing === user.username) resetForm();
        UI.toast(`${user.name} deleted`);
        await refreshUsers();
      } catch (err) {
        UI.toast(err.message, 'error');
      }
    });
  }

  const form = () => document.getElementById('user-form');

  function startEdit(user) {
    const f = form();
    editing = user.username;
    f.elements.name.value = user.name;
    f.elements.username.value = user.username;
    f.elements.username.readOnly = true;
    f.elements.role.value = user.role;
    f.elements.password.value = '';
    f.elements.password.placeholder = 'Leave empty to keep the current password';
    document.getElementById('user-form-title').textContent = `Edit ${user.name}`;
    document.getElementById('user-form-sub').textContent = 'Change the name or role, or type a new password to reset it.';
    document.getElementById('user-cancel').hidden = false;
    document.getElementById('user-error').hidden = true;
    f.scrollIntoView({ behavior: 'smooth', block: 'center' });
    f.elements.name.focus();
  }

  function resetForm() {
    const f = form();
    editing = null;
    f.reset();
    f.elements.role.value = 'volunteer';
    f.elements.username.readOnly = false;
    f.elements.password.placeholder = 'At least 8 characters';
    f.querySelectorAll('[aria-invalid]').forEach(el => el.removeAttribute('aria-invalid'));
    if (online) {
      document.getElementById('user-form-title').textContent = 'Add a user';
      document.getElementById('user-form-sub').textContent = 'Saved straight to the database. No email is needed.';
    }
    document.getElementById('user-cancel').hidden = true;
    document.getElementById('user-error').hidden = true;
  }

  function setupUserForm() {
    const f = form();
    f.elements.role.innerHTML = UI.options(Object.entries(Auth.ROLES).map(([value, r]) => ({ value, label: r.label })), 'volunteer');
    const toggle = document.getElementById('new-password-toggle');
    toggle.innerHTML = UI.icon('eye');
    toggle.addEventListener('click', () => {
      const input = f.elements.password;
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      toggle.innerHTML = UI.icon(show ? 'eyeOff' : 'eye');
      toggle.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
    });
    document.getElementById('user-cancel').addEventListener('click', resetForm);
    f.addEventListener('input', e => e.target.removeAttribute?.('aria-invalid'));

    const error = document.getElementById('user-error');
    const fail = (message, field) => {
      error.textContent = message;
      error.hidden = false;
      if (field && f.elements[field]) {
        f.elements[field].setAttribute('aria-invalid', 'true');
        f.elements[field].focus();
      }
    };

    f.addEventListener('submit', async e => {
      e.preventDefault();
      error.hidden = true;
      const name = f.elements.name.value.trim().replace(/[\r\n]+/g, ' ');
      const username = f.elements.username.value.trim().toLowerCase();
      const password = f.elements.password.value;
      const role = f.elements.role.value;
      if (!name) return fail('Enter the person\'s name.', 'name');
      if (!/^[a-z0-9._-]{3,32}$/.test(username)) return fail('Username: 3 to 32 characters, using only letters, numbers, dot, dash or underscore.', 'username');
      if ((!editing || password) && password.length < 8) return fail('Use a password of at least 8 characters.', 'password');

      if (online) {
        const button = document.getElementById('user-submit');
        button.disabled = true;
        try {
          await Auth.saveUser({ username, name, role, password });
          UI.toast(editing ? `${name} updated` : `${name} can now sign in as ${username}`);
          resetForm();
          await refreshUsers();
        } catch (err) {
          fail(err.message, err.field);
        } finally {
          button.disabled = false;
        }
        return;
      }

      // Demo mode: make the line for users.csv.
      const hash = await Auth.hashPassword(username, password);
      const line = Utils.toCSV([{ username, password_hash: hash, role, name }], ['username', 'password_hash', 'role', 'name']).split('\n')[1];
      const exists = users.some(u => u.username === username);
      const out = document.getElementById('user-output');
      out.hidden = false;
      out.innerHTML = `
        <p class="output-title">${UI.icon('check')}<span>${exists ? `Replace the line for <b>${esc(username)}</b> in users.csv with:` : 'Add this line to the end of users.csv:'}</span></p>
        <div class="code-row"><code class="code-output" id="user-line">${esc(line)}</code>
          <button type="button" class="btn btn-sm btn-secondary" id="copy-line">${UI.icon('copy')}<span>Copy</span></button></div>
        <ol class="steps">
          <li>Open <code>data/users.csv</code> in VS Code (or on GitHub).</li>
          <li>${exists ? 'Replace that user\'s line' : 'Paste the line on a new row at the end'} and save.</li>
          <li>Commit and push to GitHub. Vercel updates the site in about a minute.</li>
          <li>Share the username and password with ${esc(name)} privately.</li>
        </ol>`;
      document.getElementById('copy-line').addEventListener('click', async () => {
        UI.toast(await copy(line) ? 'Copied to clipboard' : 'Could not copy. Select the text and copy it.');
      });
    });
  }

  async function copy(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      const area = Object.assign(document.createElement('textarea'), { value: text });
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      const ok = document.execCommand('copy');
      area.remove();
      return ok;
    }
  }

  // ---------- Permissions ----------
  function renderPermissions() {
    const actions = [['view', 'See families, members, charts and the tree'], ['add', 'Add families and members'], ['edit', 'Edit families and members'],
      ['delete', 'Delete families and members'], ['export', 'Export CSV files'], ['admin', 'Admin page: users, import, delete all']];
    const roles = Object.entries(Auth.ROLES);
    document.getElementById('perm-table').innerHTML = `
      <table class="data-table perm-table">
        <thead><tr><th>Can…</th>${roles.map(([key, r]) => `<th class="center"><span class="badge badge-${key}">${r.label}</span></th>`).join('')}</tr></thead>
        <tbody>${actions.map(([key, label]) => `
          <tr><td>${label}</td>${roles.map(([, r]) => `<td class="center">${r[key]
            ? `<span class="yes" title="Yes">${UI.icon('check')}<span class="sr-only">Yes</span></span>`
            : `<span class="no" title="No">${UI.icon('x')}<span class="sr-only">No</span></span>`}</td>`).join('')}</tr>`).join('')}
        </tbody>
      </table>`;
  }

  // ---------- Data ----------
  function renderData() {
    const info = DB.info();
    const counts = `
      <div class="data-counts">
        <div><span>${Utils.number(info.families)}</span><small>Families</small></div>
        <div><span>${Utils.number(info.members)}</span><small>Members</small></div>
      </div>`;
    if (online) {
      document.getElementById('data-info').innerHTML = `${counts}<p class="panel-note">Download a backup from time to time. Backup files keep the database format so <b>Import</b> can read them back; for a list to read or print, use <b>Export</b> on the Families page.</p>`;
      return;
    }
    const when = v => (v ? esc(Utils.formatDateTime(v)) : '<span class="muted">Never</span>');
    document.getElementById('data-info').innerHTML = `
      ${counts}
      <dl class="kv">
        <dt>Loaded from CSV files</dt><dd>${when(info.loadedAt)}</dd>
        <dt>Last change in this browser</dt><dd>${when(info.changedAt)}</dd>
        <dt>families.csv last exported</dt><dd>${when(info.exportedAt.families)}</dd>
        <dt>members.csv last exported</dt><dd>${when(info.exportedAt.members)}</dd>
      </dl>
      ${info.changedAt && (!info.exportedAt.members || info.exportedAt.members < info.changedAt || !info.exportedAt.families || info.exportedAt.families < info.changedAt)
        ? `<p class="notice notice-warning">${UI.icon('alert')}<span>There are changes in this browser that are not exported yet.</span></p>` : ''}`;
  }

  function setupDataTools() {
    document.querySelectorAll('[data-export]').forEach(b => b.addEventListener('click', () => { UI.exportTable(b.dataset.export, true); renderData(); }));

    const importForm = document.getElementById('import-form');
    const result = document.getElementById('import-result');
    const showResult = (type, html) => {
      result.className = `notice notice-${type === 'error' ? 'error' : 'success'}`;
      result.innerHTML = html;
      result.hidden = false;
    };
    importForm.addEventListener('submit', async e => {
      e.preventDefault();
      result.hidden = true;
      const files = [...importForm.elements.files.files];
      const mode = importForm.elements.mode.value;
      if (!files.length) { showResult('error', 'Choose families.csv and/or members.csv first.'); return; }
      if (mode === 'replace') {
        const ok = await UI.confirm({
          title: 'Replace data?',
          message: `The ${online ? 'data in Supabase' : 'data in this browser'} will be replaced by the file(s) you chose. Export first if you need a copy.`,
          confirmLabel: 'Replace data',
        });
        if (!ok) return;
      }
      const button = importForm.querySelector('[type="submit"]');
      button.disabled = true;
      try {
        const loaded = await Promise.all(files.map(async f => ({ name: f.name, text: await f.text() })));
        loaded.forEach(f => { f.table = DB.detectTable(f.text); });
        const unknown = loaded.find(f => !f.table);
        if (unknown) throw new Error(`${unknown.name} is not a families.csv or members.csv file.`);
        loaded.sort((a, b) => (a.table === 'members') - (b.table === 'members')); // families first
        const lines = [];
        let last = null;
        for (const f of loaded) {
          last = await DB.importCSV(f.text, mode);
          lines.push(`<li><b>${esc(f.name)}</b>: ${last.added} added${mode === 'merge' ? `, ${last.updated} updated` : ''}${last.skipped ? `, ${last.skipped} skipped (incomplete rows)` : ''}.</li>`);
          if (last.renamed.length) lines.push(`<li class="warn">Family codes already in use were renumbered: ${esc(last.renamed.join(', '))}.</li>`);
        }
        if (last.duplicateCodes.length) lines.push(`<li class="warn">Duplicate family codes: ${esc(last.duplicateCodes.join(', '))}. Edit those families to give each a unique code.</li>`);
        if (last.orphans) lines.push(`<li class="warn">${last.orphans} members belong to families that are not loaded. Import families.csv too.</li>`);
        showResult('success', `<ul>${lines.join('')}</ul>`);
        importForm.reset();
        renderData();
        UI.toast('Import finished');
      } catch (err) {
        showResult('error', esc(err.message));
      } finally {
        button.disabled = false;
      }
    });

    document.getElementById('reload-data').addEventListener('click', async () => {
      const ok = await UI.confirm({ title: 'Reload from the CSV files?', message: 'All changes saved in this browser are replaced by the data in data/families.csv and data/members.csv.', confirmLabel: 'Reload' });
      if (!ok) return;
      try { await DB.reloadFromFiles(); UI.toast('Reloaded from the CSV files'); renderData(); } catch (err) { UI.toast(err.message, 'error'); }
    });
    document.getElementById('clear-data').addEventListener('click', async () => {
      const ok = await UI.confirm({
        title: 'Delete all data?',
        message: online
          ? 'Every family and member in the database will be deleted, for everyone. Export first if you need a copy.'
          : 'Every family and member in this browser will be deleted, to start with an empty register. Export first if you need a copy.',
        confirmLabel: 'Delete everything',
      });
      if (!ok) return;
      try { await DB.clearAll(); UI.toast('All data deleted'); renderData(); } catch (err) { UI.toast(err.message, 'error'); }
    });
  }

  return { init };
})();
