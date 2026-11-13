/* Shared helpers: option lists, CSV, hashing, ids, dates and formatting. */
const Utils = (() => {
  // ---------- Option lists used by forms and charts ----------
  const RELATIONS = [
    'Self', 'Wife', 'Husband', 'Son', 'Daughter', 'Father', 'Mother', 'Brother', 'Sister',
    'Grandson', 'Granddaughter', 'Grandfather', 'Grandmother', 'Daughter-in-law', 'Son-in-law',
    'Father-in-law', 'Mother-in-law', 'Brother-in-law', 'Sister-in-law', 'Nephew', 'Niece',
    'Uncle', 'Aunt', 'Cousin', 'Other',
  ];
  const GENDER_LABELS = { male: 'Male', female: 'Female', other: 'Other' };
  const EDUCATION = [
    'Not schooled', 'Primary (1-5)', 'Middle (6-8)', 'High school (9-10)', 'Higher secondary (11-12)',
    'Diploma / ITI', 'Graduate', 'Post graduate', 'Madrasa (Hafiz / Alim)', 'Other',
  ];
  const OCCUPATIONS = [
    'Student', 'Homemaker', 'Farmer', 'Daily wage worker', 'Business / Shop', 'Private job', 'Government job',
    'Driver', 'Teacher', 'Working abroad', 'Retired', 'Unemployed', 'Child', 'Other',
  ];
  const MARITAL = ['Single', 'Married', 'Widowed', 'Divorced', 'Separated'];
  const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
  const AGE_GROUPS = [
    { label: '0–5', min: 0, max: 5 },
    { label: '6–17', min: 6, max: 17 },
    { label: '18–35', min: 18, max: 35 },
    { label: '36–59', min: 36, max: 59 },
    { label: '60+', min: 60, max: Infinity },
  ];

  // The English relation, then the word from CONFIG.relationNames if there is one: "Husband / Shohar".
  const relationLabel = relation => {
    const english = relation === 'Self' ? 'Head of family' : relation || '';
    const local = CONFIG.relationNames?.[relation];
    return english && local ? `${english} / ${local}` : english;
  };
  // A label that names two relations, with their words added: "Husband / wife (Shohar / Biwi)".
  const relationPairLabel = (english, a, b) => {
    const local = [a, b].map(r => CONFIG.relationNames?.[r]).filter(Boolean);
    return local.length ? `${english} (${local.join(' / ')})` : english;
  };
  const SPOUSE_LABEL = relationPairLabel('Husband / wife', 'Husband', 'Wife');
  const PARENT_LABEL = relationPairLabel('Father / mother', 'Father', 'Mother');

  // Members of one family in list order: head first, then husband / wife, parents, children, ...
  // Within a group, oldest first.
  const RELATION_RANK = {
    Self: 0, Wife: 1, Husband: 1, Father: 2, Mother: 2, Grandfather: 3, Grandmother: 3, Son: 4, Daughter: 4,
    'Daughter-in-law': 5, 'Son-in-law': 5, Grandson: 6, Granddaughter: 6, Brother: 7, Sister: 7,
    'Brother-in-law': 8, 'Sister-in-law': 8, 'Father-in-law': 9, 'Mother-in-law': 9, Nephew: 10, Niece: 10,
    Uncle: 11, Aunt: 11, Cousin: 12,
  };
  function sortMembers(list) {
    return [...list].sort((a, b) => (RELATION_RANK[a.relation] ?? 20) - (RELATION_RANK[b.relation] ?? 20)
      || (a.dob || '9999').localeCompare(b.dob || '9999')
      || a.full_name.localeCompare(b.full_name));
  }

  /** An error that belongs to one form field, so the form can point at it. */
  class FieldError extends Error {
    constructor(field, message) { super(message); this.field = field; }
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  // ---------- Browser storage (can be blocked, so never let it throw) ----------
  const storage = {
    get(key, session = false) {
      try { return (session ? sessionStorage : localStorage).getItem(key); } catch { return null; }
    },
    set(key, value, session = false) {
      try { (session ? sessionStorage : localStorage).setItem(key, value); return true; } catch { return false; }
    },
    remove(key, session = false) {
      try { (session ? sessionStorage : localStorage).removeItem(key); } catch { /* storage blocked */ }
    },
  };

  // ---------- CSV ----------
  /** Parse CSV text into objects keyed by the (lower-case) header row. Handles quotes and line breaks. */
  function parseCSV(text) {
    text = String(text || '').replace(/^﻿/, '');
    const rows = [];
    let row = [];
    let field = '';
    let inQuotes = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (inQuotes) {
        if (c === '"') {
          if (text[i + 1] === '"') { field += '"'; i++; } else inQuotes = false;
        } else field += c;
      } else if (c === '"' && field === '') inQuotes = true;
      else if (c === ',') { row.push(field); field = ''; }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && text[i + 1] === '\n') i++;
        row.push(field); rows.push(row); row = []; field = '';
      } else field += c;
    }
    if (field !== '' || row.length) { row.push(field); rows.push(row); }

    const header = (rows.shift() || []).map(h => h.trim().toLowerCase());
    const records = rows
      .filter(r => r.some(v => v.trim() !== ''))
      .map(r => Object.fromEntries(header.map((h, i) => [h, (r[i] ?? '').trim()])));
    records.columns = header;
    return records;
  }

  function toCSV(rows, columns) {
    const cell = v => {
      const s = v == null ? '' : String(v);
      return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    return [columns.join(','), ...rows.map(r => columns.map(c => cell(r[c])).join(','))].join('\n') + '\n';
  }

  /** Short, fast fingerprint of a string (FNV-1a). Used to notice when the CSV files change. */
  function hashString(str) {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193); }
    return (h >>> 0).toString(16);
  }

  // ---------- SHA-256 ----------
  const toHex = bytes => Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');

  async function sha256Hex(text) {
    const bytes = new TextEncoder().encode(text);
    if (window.crypto && crypto.subtle) return toHex(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)));
    return sha256Fallback(bytes); // crypto.subtle only exists on https:// and localhost
  }

  const K = new Uint32Array([
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ]);
  const ror = (x, n) => (x >>> n) | (x << (32 - n));

  function sha256Fallback(bytes) {
    const H = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);
    const padded = new Uint8Array(((bytes.length + 9 + 63) >> 6) << 6);
    padded.set(bytes);
    padded[bytes.length] = 0x80;
    const view = new DataView(padded.buffer);
    view.setUint32(padded.length - 8, Math.floor(bytes.length / 0x20000000));
    view.setUint32(padded.length - 4, bytes.length * 8);
    const W = new Uint32Array(64);
    for (let off = 0; off < padded.length; off += 64) {
      for (let i = 0; i < 16; i++) W[i] = view.getUint32(off + i * 4);
      for (let i = 16; i < 64; i++) {
        const s0 = ror(W[i - 15], 7) ^ ror(W[i - 15], 18) ^ (W[i - 15] >>> 3);
        const s1 = ror(W[i - 2], 17) ^ ror(W[i - 2], 19) ^ (W[i - 2] >>> 10);
        W[i] = (W[i - 16] + s0 + W[i - 7] + s1) | 0;
      }
      let [a, b, c, d, e, f, g, h] = H;
      for (let i = 0; i < 64; i++) {
        const t1 = (h + (ror(e, 6) ^ ror(e, 11) ^ ror(e, 25)) + ((e & f) ^ (~e & g)) + K[i] + W[i]) | 0;
        const t2 = ((ror(a, 2) ^ ror(a, 13) ^ ror(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) | 0;
        h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
      }
      H[0] += a; H[1] += b; H[2] += c; H[3] += d; H[4] += e; H[5] += f; H[6] += g; H[7] += h;
    }
    return Array.from(H, x => x.toString(16).padStart(8, '0')).join('');
  }

  // ---------- Ids ----------
  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    const b = crypto.getRandomValues(new Uint8Array(16));
    b[6] = (b[6] & 0x0f) | 0x40;
    b[8] = (b[8] & 0x3f) | 0x80;
    const h = toHex(b);
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
  }

  // ---------- Loading files ----------
  async function fetchText(url) {
    let res;
    try {
      res = await fetch(url, { cache: 'no-cache' });
    } catch {
      throw new Error(location.protocol === 'file:'
        ? 'Open the app through a web server (see README → "Run it locally"), not by double-clicking the file.'
        : `Could not load ${url}. Check your internet connection and try again.`);
    }
    if (!res.ok) throw new Error(`Could not load ${url} (error ${res.status}).`);
    return res.text();
  }

  // ---------- Dates & ages ----------
  const pad = n => String(n).padStart(2, '0');
  const toISODate = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const todayISO = () => toISODate(new Date());

  function parseDate(value) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || '');
    if (!m) return null;
    const d = new Date(+m[1], +m[2] - 1, +m[3]);
    return d.getMonth() === +m[2] - 1 ? d : null;
  }

  /** Accepts YYYY-MM-DD, DD-MM-YYYY or DD/MM/YYYY (what Excel often saves) and returns YYYY-MM-DD. */
  function normalizeDate(value) {
    const s = String(value || '').trim();
    let m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/.exec(s);
    let parts = m && [m[1], m[2], m[3]];
    if (!parts && (m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/.exec(s))) parts = [m[3], m[2], m[1]];
    if (!parts) return '';
    const iso = `${parts[0]}-${pad(+parts[1])}-${pad(+parts[2])}`;
    return parseDate(iso) ? iso : '';
  }

  function ageInYears(dob, ref = new Date()) {
    const d = parseDate(dob);
    if (!d) return null;
    let age = ref.getFullYear() - d.getFullYear();
    if (ref.getMonth() < d.getMonth() || (ref.getMonth() === d.getMonth() && ref.getDate() < d.getDate())) age--;
    return age >= 0 ? age : null;
  }

  function ageText(dob) {
    const age = ageInYears(dob);
    if (age === null) return '';
    if (age >= 2) return `${age} yrs`;
    if (age === 1) return '1 yr';
    const d = parseDate(dob);
    const now = new Date();
    const months = (now.getFullYear() - d.getFullYear()) * 12 + now.getMonth() - d.getMonth() - (now.getDate() < d.getDate() ? 1 : 0);
    return months < 1 ? 'Newborn' : `${months} mo`;
  }

  function formatDate(value) {
    const d = parseDate(String(value || '').slice(0, 10));
    return d ? d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
  }

  function formatDateTime(value) {
    const d = value ? new Date(value) : null;
    return d && !isNaN(d) ? d.toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : '';
  }

  // ---------- Aadhaar & phone ----------
  const aadhaarDigits = value => String(value || '').replace(/\D/g, '');
  const maskAadhaar = last4 => (last4 ? `XXXX XXXX ${last4}` : '');

  function formatPhone(value) {
    const d = String(value || '').replace(/\D/g, '');
    if (d.length === 10) return `${d.slice(0, 5)} ${d.slice(5)}`;
    if (d.length === 12 && d.startsWith('91')) return `+91 ${d.slice(2, 7)} ${d.slice(7)}`;
    return String(value || '');
  }
  const telHref = value => {
    const d = String(value || '').replace(/[^\d+]/g, '');
    return d ? `tel:${d}` : '';
  };

  // ---------- Misc ----------
  function initials(name) {
    const words = String(name || '').trim().split(/\s+/).filter(Boolean);
    return ((words[0]?.[0] || '') + (words.length > 1 ? words[words.length - 1][0] : '')).toUpperCase() || '?';
  }

  const percent = (n, total) => (total ? `${Math.round((n / total) * 100)}%` : '0%');
  const number = n => Number(n).toLocaleString('en-IN');

  function debounce(fn, wait = 200) {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), wait); };
  }

  /** Save text as a file. CSV gets a byte-order mark so Excel shows non-English names correctly. */
  function downloadText(filename, text, type = 'text/csv') {
    const blob = new Blob([type === 'text/csv' ? '﻿' + text : text], { type: `${type};charset=utf-8` });
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement('a'), { href: url, download: filename });
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return {
    RELATIONS, GENDER_LABELS, EDUCATION, OCCUPATIONS, MARITAL, BLOOD_GROUPS, AGE_GROUPS,
    relationLabel, SPOUSE_LABEL, PARENT_LABEL, sortMembers, FieldError, escapeHtml, storage, parseCSV, toCSV, hashString, sha256Hex, sha256Fallback,
    uuid, fetchText, todayISO, parseDate, normalizeDate, ageInYears, ageText, formatDate, formatDateTime,
    aadhaarDigits, maskAadhaar, formatPhone, telHref, initials, percent, number, debounce, downloadText,
  };
})();
