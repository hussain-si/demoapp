/*
 * Sign-in and roles.
 * With Supabase: the database checks the password and returns a session token;
 *   every later request sends the token and the database checks the role again.
 * Demo mode: users come from data/users.csv, which holds SHA-256 of "username:password".
 * Roles: admin (everything), volunteer (add + edit), viewer (read only).
 */
const Auth = (() => {
  const KEY = 'vfr.session';
  const ROLES = {
    admin:     { label: 'Admin',     view: true, add: true,  edit: true,  delete: true,  export: true,  admin: true },
    volunteer: { label: 'Volunteer', view: true, add: true,  edit: true,  delete: false, export: true,  admin: false },
    viewer:    { label: 'Viewer',    view: true, add: false, edit: false, delete: false, export: false, admin: false },
  };
  let session = null;

  // Unknown or empty roles get the safest one.
  const normalizeRole = role => {
    const r = String(role || '').trim().toLowerCase();
    return ROLES[r] ? r : 'viewer';
  };

  const hashPassword = (username, password) => Utils.sha256Hex(`${String(username).trim().toLowerCase()}:${password}`);

  // "Keep me signed in" uses localStorage; otherwise the session ends when the browser closes.
  function readStored() {
    const fromSession = Utils.storage.get(KEY, true);
    const raw = fromSession || Utils.storage.get(KEY);
    if (!raw) return null;
    try { return { ...JSON.parse(raw), remember: !fromSession }; } catch { return null; }
  }
  function store(data, remember) {
    const { remember: _, ...rest } = data;
    clear();
    Utils.storage.set(KEY, JSON.stringify(rest), !remember);
  }
  function clear() {
    Utils.storage.remove(KEY, true);
    Utils.storage.remove(KEY);
  }
  const token = () => session?.token || readStored()?.token || '';
  // The browser copy of the data is deleted whenever nobody is signed in.
  const forgetData = () => Promise.race([DB.forget(), new Promise(r => setTimeout(r, 1500))]);

  async function login(username, password, remember) {
    const name = String(username || '').trim().toLowerCase();
    if (!name || !password) throw new Error('Enter your username and password.');
    if (Supa.enabled) {
      const s = await Supa.rpc('app_login', { p_username: name, p_password: password, p_remember: Boolean(remember) });
      session = { username: s.username, name: s.name, role: normalizeRole(s.role), token: s.token };
      store(session, remember);
      return session;
    }
    const users = await loadCsvUsers();
    const user = users.find(u => u.username === name);
    const hash = await hashPassword(name, password);
    if (!user || user.password_hash !== hash) throw new Error('Wrong username or password.');
    // "key" lets other pages notice when this user's password is changed in users.csv.
    session = { username: user.username, name: user.name, role: user.role, key: hash.slice(0, 16) };
    store(session, remember);
    return session;
  }

  async function logout() {
    const saved = readStored();
    if (Supa.enabled && saved?.token) {
      await Promise.race([Supa.rpc('app_logout', { p_token: saved.token }).catch(() => {}), new Promise(r => setTimeout(r, 1500))]);
    }
    clear();
    session = null;
    await forgetData();
    location.href = 'index.html';
  }

  // The database said the session is no longer valid (expired, password reset or user removed).
  function expired() {
    clear();
    session = null;
    Utils.storage.set('vfr.flash', JSON.stringify({ message: 'Your session has ended. Please sign in again.', type: 'error' }), true);
    forgetData().then(goToLogin);
  }

  /** Check the saved session: removed users and changed passwords are signed out. */
  async function requireAuth() {
    const saved = readStored();
    if (!saved || (Supa.enabled && !saved.token)) { clear(); await forgetData(); goToLogin(); return null; }
    try {
      if (Supa.enabled) {
        const me = await Supa.rpc('app_me', { p_token: saved.token });
        Object.assign(saved, { name: me.name, role: normalizeRole(me.role) });
      } else {
        const user = (await loadCsvUsers()).find(u => u.username === saved.username);
        if (!user || user.password_hash.slice(0, 16) !== saved.key) { clear(); goToLogin(); return null; }
        Object.assign(saved, { name: user.name, role: user.role });
      }
      store(saved, saved.remember);
    } catch (err) {
      if (err.hint === 'session') return null; // already sent to the sign-in page
      // Offline or the user list could not be loaded: keep the saved session.
    }
    session = saved;
    return session;
  }

  function goToLogin() {
    const here = location.pathname.split('/').pop() + location.search;
    location.replace('index.html' + (here && !here.startsWith('index.html') ? `?next=${encodeURIComponent(here)}` : ''));
  }

  // ---------- Users ----------
  async function loadCsvUsers() {
    const rows = Utils.parseCSV(await Utils.fetchText(CONFIG.files.users));
    return rows
      .map(u => ({
        username: (u.username || '').toLowerCase(),
        password_hash: (u.password_hash || '').toLowerCase(),
        role: normalizeRole(u.role),
        name: u.name || u.username || '',
      }))
      .filter(u => u.username && u.password_hash);
  }

  async function loadUsers() {
    if (!Supa.enabled) return loadCsvUsers();
    return (await Supa.rpc('app_list_users', { p_token: token() })).map(u => ({ ...u, role: normalizeRole(u.role) }));
  }
  // Supabase only: add or update a user (empty password keeps the current one), remove a user, change own password.
  const saveUser = u => Supa.rpc('app_save_user', { p_token: token(), p_username: u.username, p_name: u.name, p_role: u.role, p_password: u.password || null });
  const deleteUser = username => Supa.rpc('app_delete_user', { p_token: token(), p_username: username });
  const changePassword = (oldPassword, newPassword) => Supa.rpc('app_change_password', { p_token: token(), p_old: oldPassword, p_new: newPassword });

  const current = () => session;
  const can = action => Boolean((ROLES[session?.role] || ROLES.viewer)[action]);
  const roleLabel = role => (ROLES[role] || ROLES.viewer).label;

  return {
    ROLES, login, logout, expired, requireAuth, readStored, current, token, can, roleLabel,
    loadUsers, saveUser, deleteUser, changePassword, hashPassword, normalizeRole,
  };
})();
