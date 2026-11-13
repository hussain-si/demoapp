/*
 * Supabase connection (used when CONFIG.supabase has a URL and key).
 * Every request calls one of the app_* database functions in supabase/schema.sql;
 * each of them checks the sign-in session and role before touching any data.
 */
const Supa = (() => {
  const url = String(CONFIG.supabase?.url || '').trim().replace(/\/+$/, '');
  const key = String(CONFIG.supabase?.anonKey || '').trim();
  const enabled = Boolean(url && key);

  async function rpc(name, args = {}) {
    const headers = { apikey: key, 'Content-Type': 'application/json' };
    if (key.startsWith('eyJ')) headers.Authorization = `Bearer ${key}`; // older "anon" keys are JWTs
    let res;
    try {
      res = await fetch(`${url}/rest/v1/rpc/${name}`, { method: 'POST', headers, body: JSON.stringify(args) });
    } catch {
      throw new Error('Could not reach the database. Check the internet connection and try again.');
    }
    const text = await res.text();
    let body = null;
    try { body = text ? JSON.parse(text) : null; } catch { body = { message: text }; }
    if (res.ok) return body;

    const hint = body?.hint || '';
    let message = body?.message || `Database error (${res.status}).`;
    if (/Could not find the function/i.test(message)) message = 'The database is not set up yet. Run supabase/schema.sql in the Supabase SQL Editor.';
    else if (/Invalid API key|No API key|JWT/i.test(message)) message = 'The Supabase key in js/config.js is not valid.';
    const err = hint.startsWith('field:') ? new Utils.FieldError(hint.slice(6), message) : new Error(message);
    err.hint = hint;
    if (hint === 'session' && name !== 'app_logout') Auth.expired();
    throw err;
  }

  return { enabled, rpc };
})();
