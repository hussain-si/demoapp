/*
 * Data layer. The pages only use the functions returned at the bottom.
 *
 * With Supabase (CONFIG.supabase filled in): data is loaded from and saved to
 * the database through the app_* functions, so everyone shares the same data.
 *
 * Demo mode: data/families.csv and data/members.csv are loaded once, then every
 * add / edit / delete is saved in this browser (localStorage). Export writes CSV
 * files in the same format, so they can replace the files in data/.
 */
const DB = (() => {
  const KEY = 'vfr.data.v1';
  const FAMILY_COLUMNS = ['id', 'family_code', 'head_name', 'house_no', 'address', 'area', 'phone', 'created_by', 'created_at'];
  const MEMBER_COLUMNS = [
    'id', 'family_id', 'full_name', 'gender', 'dob', 'relation', 'parent_id', 'spouse_id', 'aadhaar_last4',
    'phone', 'education', 'occupation', 'marital_status', 'blood_group', 'notes', 'created_at',
  ];
  const GENDERS = { m: 'male', male: 'male', f: 'female', female: 'female', o: 'other', other: 'other' };
  const online = Supa.enabled;

  let state = null;
  let seedChanged = false;
  const nowISO = () => new Date().toISOString();

  function readStore() {
    try { return JSON.parse(Utils.storage.get(KEY) || 'null'); } catch { return null; }
  }
  function save() {
    if (online) return;
    if (!Utils.storage.set(KEY, JSON.stringify(state))) {
      throw new Error('This browser could not save the change (storage is full or blocked).');
    }
  }
  // Demo mode: another tab saved a change, so use the newer copy.
  window.addEventListener('storage', e => {
    if (!online && e.key === KEY && e.newValue) state = JSON.parse(e.newValue);
  });

  // ---------- Cleaning rows (from forms, CSV files and the database) ----------
  // Use the list's spelling when a value matches ignoring case; keep other values as typed.
  function matchOption(value, list) {
    if (!value) return '';
    const v = value.toLowerCase();
    return list.find(o => o.toLowerCase() === v) || value;
  }

  function cleanFamily(row) {
    const f = {};
    for (const c of FAMILY_COLUMNS) f[c] = String(row[c] ?? '').trim();
    f.family_code = f.family_code.toUpperCase();
    return f;
  }

  function cleanMember(row) {
    const m = {};
    for (const c of MEMBER_COLUMNS) m[c] = String(row[c] ?? '').trim();
    m.gender = GENDERS[m.gender.toLowerCase()] || '';
    m.dob = Utils.normalizeDate(m.dob);
    const relation = m.relation.toLowerCase();
    m.relation = relation === 'head' || relation === 'head of family' ? 'Self' : matchOption(m.relation, Utils.RELATIONS);
    // Excel drops leading zeros ("0123" -> "123"), so pad short values back to 4 digits.
    const digits = Utils.aadhaarDigits(m.aadhaar_last4);
    m.aadhaar_last4 = digits.length >= 4 ? digits.slice(-4) : digits ? digits.padStart(4, '0') : '';
    m.blood_group = matchOption(m.blood_group.replace(/\s+/g, '').toUpperCase().replace(/VE$/, ''), Utils.BLOOD_GROUPS);
    m.marital_status = matchOption(m.marital_status, Utils.MARITAL);
    m.education = matchOption(m.education, Utils.EDUCATION);
    m.occupation = matchOption(m.occupation, Utils.OCCUPATIONS);
    return m;
  }

  const withId = clean => row => {
    const rec = clean(row);
    if (!rec.id) rec.id = Utils.uuid();
    return rec;
  };

  // ---------- Browser copy of the database (Supabase only) ----------
  // Pages start from the copy kept in IndexedDB and ask the database only for rows changed since then,
  // so moving between pages does not download every family again. The copy is deleted on sign-out.
  // It is kept as one JSON text: reading that back is far faster than reading thousands of separate rows.
  const copySource = String(CONFIG.supabase?.url || '').trim();
  let copyConnection = null;
  let forgotten = false;

  const settle = req => new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  const byCreated = rows => rows.sort((a, b) => (a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0));

  async function copyStore(mode) {
    copyConnection ??= new Promise((resolve, reject) => {
      const req = indexedDB.open('vfr.copy', 1);
      req.onupgradeneeded = () => req.result.createObjectStore('copy');
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return (await copyConnection).transaction('copy', mode).objectStore('copy');
  }

  /** The saved copy, or null when there is none (or the browser blocks storage). */
  async function readCopy() {
    try {
      const saved = await settle((await copyStore('readonly')).get('data'));
      if (!saved || saved.source !== copySource) return null;
      return { rev: saved.rev, ...JSON.parse(saved.json) };
    } catch {
      return null;
    }
  }

  async function writeCopy(rev, families, members) {
    try {
      const json = JSON.stringify({ families, members });
      const store = await copyStore('readwrite');
      if (!forgotten) await settle(store.put({ source: copySource, rev, json }, 'data'));
    } catch {
      // Not saved: the next page asks the database again.
    }
  }

  /** Delete the browser copy (when nobody is signed in). */
  async function forget() {
    if (!online) return;
    forgotten = true;
    try { await settle((await copyStore('readwrite')).clear()); } catch { /* storage blocked: nothing was saved */ }
  }

  // Rows from the copy with the changed rows put in place and the deleted ones taken out.
  function merged(rows, changed, deletedIds) {
    const byId = new Map(rows.map(r => [r.id, r]));
    changed.forEach(r => byId.set(r.id, r));
    deletedIds.forEach(id => byId.delete(id));
    return byCreated([...byId.values()]);
  }

  // ---------- Loading ----------
  async function fetchSeed() {
    const [familiesText, membersText] = await Promise.all([
      Utils.fetchText(CONFIG.files.families),
      Utils.fetchText(CONFIG.files.members),
    ]);
    return {
      families: Utils.parseCSV(familiesText).map(withId(cleanFamily)),
      members: Utils.parseCSV(membersText).map(withId(cleanMember)),
      fingerprint: Utils.hashString(familiesText + '\u0000' + membersText),
    };
  }

  function fromSeed(seed) {
    return {
      version: 1,
      families: seed.families,
      members: seed.members,
      meta: { fingerprint: seed.fingerprint, loadedAt: nowISO(), changedAt: '', exportedAt: {} },
    };
  }

  async function load() {
    if (online) {
      const copy = await readCopy();
      const data = await Supa.rpc('app_get_data', copy ? { p_token: Auth.token(), p_since: copy.rev } : { p_token: Auth.token() });
      const families = data.families.map(cleanFamily);
      const members = data.members.map(cleanMember);
      state = { version: 1, families, members, meta: { loadedAt: nowISO(), exportedAt: {} } };
      if (copy && data.full === false) {
        const deleted = data.deleted || [];
        const deletedIds = kind => deleted.filter(d => d.kind === kind).map(d => d.id);
        const changed = families.length || members.length || deleted.length;
        state.families = changed ? merged(copy.families, families, deletedIds('families')) : copy.families;
        state.members = changed ? merged(copy.members, members, deletedIds('members')) : copy.members;
      }
      // Saved after the page is drawn. A database without change numbers (older schema.sql) sends no "rev".
      if (data.rev != null && data.rev !== copy?.rev) {
        const { families: f, members: m } = state;
        setTimeout(() => writeCopy(data.rev, f, m), 0);
      }
      return;
    }
    const saved = readStore();
    let seed = null;
    let error = null;
    try { seed = await fetchSeed(); } catch (e) { error = e; }

    if (!saved || saved.version !== 1) {
      if (!seed) throw error;
      state = fromSeed(seed);
      save();
      return;
    }
    state = saved;
    if (seed && seed.fingerprint !== state.meta.fingerprint) {
      // The CSV files were updated. Take them if nothing was edited here; otherwise ask first.
      if (!state.meta.changedAt) { state = fromSeed(seed); save(); } else seedChanged = true;
    }
  }

  // ---------- Reading ----------
  const copy = rows => rows.map(r => ({ ...r }));
  const familyIds = () => new Set(state.families.map(f => f.id));

  async function listFamilies() { return copy(state.families); }
  async function listMembers() {
    const ids = familyIds();
    return copy(state.members.filter(m => ids.has(m.family_id)));
  }
  async function getFamily(id) {
    const f = state.families.find(x => x.id === id);
    return f ? { ...f } : null;
  }
  async function familyMembers(familyId) { return copy(state.members.filter(m => m.family_id === familyId)); }

  function areas() {
    return [...new Set(state.families.map(f => f.area).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  }

  function nextFamilyCode() {
    const max = state.families.reduce((n, f) => {
      const m = /(\d+)\s*$/.exec(f.family_code);
      return m ? Math.max(n, +m[1]) : n;
    }, 0);
    return CONFIG.familyCodePrefix + String(max + 1).padStart(3, '0');
  }

  // ---------- Writing ----------
  function allow(action) {
    if (!Auth.can(action)) {
      throw new Error(`Your role (${Auth.roleLabel(Auth.current()?.role)}) is not allowed to ${action} records.`);
    }
  }
  // Demo mode: re-read before every change so two open tabs don't overwrite each other.
  function latest() {
    if (online) return;
    const s = readStore();
    if (s && s.version === 1) state = s;
  }
  function changed() {
    state.meta.changedAt = nowISO();
    save();
  }

  // The database sends back the saved family with all its members; put them in place.
  function applyFamily({ family, members }) {
    const f = cleanFamily(family);
    const i = state.families.findIndex(x => x.id === f.id);
    if (i >= 0) state.families[i] = f; else state.families.push(f);
    state.members = state.members.filter(m => m.family_id !== f.id).concat(members.map(cleanMember));
    return f;
  }

  function checkPhone(value, field) {
    const digits = String(value || '').replace(/\D/g, '');
    if (value && (digits.length < 10 || digits.length > 13)) {
      throw new Utils.FieldError(field, 'Enter a valid phone number (10 digits).');
    }
  }

  async function saveFamily(input) {
    const isNew = !input.id;
    allow(isNew ? 'add' : 'edit');
    latest();
    const index = isNew ? -1 : state.families.findIndex(f => f.id === input.id);
    if (!isNew && index < 0) throw new Error('This family no longer exists.');
    const before = isNew ? null : state.families[index];
    const family = cleanFamily({ ...before, ...input });

    if (!family.family_code) throw new Utils.FieldError('family_code', 'Enter a family code.');
    if (state.families.some(f => f.id !== family.id && f.family_code === family.family_code)) {
      throw new Utils.FieldError('family_code', `Family code ${family.family_code} is already used by another family.`);
    }
    if (!family.head_name) throw new Utils.FieldError('head_name', 'Enter the name of the head of family.');
    checkPhone(family.phone, 'phone');

    if (online) {
      const saved = applyFamily(await Supa.rpc('app_save_family', { p_token: Auth.token(), p_family: family }));
      return { ...saved };
    }
    if (isNew) {
      Object.assign(family, { id: Utils.uuid(), created_by: Auth.current().username, created_at: nowISO() });
      state.families.push(family);
      // The head of family is also a member of the family.
      state.members.push(cleanMember({
        id: Utils.uuid(), family_id: family.id, full_name: family.head_name, relation: 'Self', phone: family.phone, created_at: nowISO(),
      }));
    } else {
      state.families[index] = family;
      if (before.head_name !== family.head_name) {
        const head = state.members.find(m => m.family_id === family.id && m.relation === 'Self');
        if (head) head.full_name = family.head_name;
      }
    }
    changed();
    return { ...family };
  }

  async function deleteFamily(id) {
    allow('delete');
    latest();
    if (online) await Supa.rpc('app_delete_family', { p_token: Auth.token(), p_id: id });
    state.families = state.families.filter(f => f.id !== id);
    state.members = state.members.filter(m => m.family_id !== id);
    if (!online) changed();
  }

  async function saveMember(input) {
    const isNew = !input.id;
    allow(isNew ? 'add' : 'edit');
    latest();
    const index = isNew ? -1 : state.members.findIndex(m => m.id === input.id);
    if (!isNew && index < 0) throw new Error('This member no longer exists.');
    const before = isNew ? null : state.members[index];
    const member = cleanMember({ ...before, ...input });
    const family = state.families.find(f => f.id === member.family_id);
    if (!family) throw new Error('This family no longer exists.');
    const relatives = state.members.filter(m => m.family_id === family.id && m.id !== member.id);
    const { FieldError } = Utils;

    if (!member.full_name) throw new FieldError('full_name', 'Enter the full name.');
    if (!member.relation) throw new FieldError('relation', 'Choose how this person is related to the head of family.');
    if (!member.gender) throw new FieldError('gender', 'Choose male, female or other.');
    if (member.relation === 'Self' && relatives.some(m => m.relation === 'Self')) {
      throw new FieldError('relation', 'This family already has a head of family. Change that member first.');
    }
    if (member.dob && member.dob > Utils.todayISO()) throw new FieldError('dob', 'Date of birth cannot be in the future.');

    // Only the last 4 Aadhaar digits are ever kept. Accept 4 digits, or all 12 (then drop the first 8).
    if ('aadhaar_last4' in input) {
      const digits = Utils.aadhaarDigits(input.aadhaar_last4);
      if (digits && digits.length !== 4 && digits.length !== 12) {
        throw new FieldError('aadhaar_last4', 'Enter the last 4 digits of the Aadhaar number (or all 12 digits).');
      }
      member.aadhaar_last4 = digits.slice(-4);
    }
    checkPhone(member.phone, 'phone');

    if (member.parent_id && !relatives.some(m => m.id === member.parent_id)) member.parent_id = '';
    if (member.spouse_id && !relatives.some(m => m.id === member.spouse_id)) member.spouse_id = '';
    if (member.parent_id && member.parent_id === member.spouse_id) {
      throw new FieldError('spouse_id', 'The same person cannot be both the parent and the husband / wife.');
    }
    // The chosen parent must not be this person's own child, grandchild, ...
    for (let p = member.parent_id, steps = 0; p && steps < 100; steps++) {
      if (p === member.id) throw new FieldError('parent_id', 'That choice would make a loop in the family tree.');
      p = state.members.find(m => m.id === p)?.parent_id;
    }

    if (online) {
      const res = await Supa.rpc('app_save_member', { p_token: Auth.token(), p_member: member });
      applyFamily(res);
      return cleanMember(res.member);
    }
    if (isNew) {
      Object.assign(member, { id: Utils.uuid(), created_at: nowISO() });
      state.members.push(member);
    } else {
      state.members[index] = member;
    }

    // Keep husband / wife links two-way where the other side is still empty.
    if (before?.spouse_id && before.spouse_id !== member.spouse_id) {
      const old = state.members.find(m => m.id === before.spouse_id);
      if (old && old.spouse_id === member.id) old.spouse_id = '';
    }
    if (member.spouse_id) {
      const spouse = state.members.find(m => m.id === member.spouse_id);
      if (spouse && !spouse.spouse_id) spouse.spouse_id = member.id;
    }
    if (member.relation === 'Self') family.head_name = member.full_name;
    changed();
    return { ...member };
  }

  async function deleteMember(id) {
    allow('delete');
    latest();
    if (online) {
      applyFamily(await Supa.rpc('app_delete_member', { p_token: Auth.token(), p_id: id }));
      return;
    }
    state.members = state.members.filter(m => m.id !== id);
    for (const m of state.members) {
      if (m.parent_id === id) m.parent_id = '';
      if (m.spouse_id === id) m.spouse_id = '';
    }
    changed();
  }

  // ---------- CSV export / import ----------
  function exportCSV(table) {
    allow('export');
    const csv = table === 'families'
      ? Utils.toCSV(state.families, FAMILY_COLUMNS)
      : Utils.toCSV(state.members, MEMBER_COLUMNS);
    state.meta.exportedAt[table] = nowISO();
    save();
    return csv;
  }

  // For people to read or print: plain headings, names instead of ids, nothing internal.
  // Not the import format (exportCSV above is the backup that Import reads back).
  const READABLE_FAMILY_COLUMNS = ['Family code', 'Head of family', 'House no.', 'Address', 'Area', 'Phone', 'Members', 'Added by', 'Added on'];
  const READABLE_MEMBER_COLUMNS = [
    'Family code', 'Head of family', 'Area', 'Full name', 'Relation to head of family', 'Gender', 'Date of birth', 'Age',
    'Marital status', 'Aadhaar (last 4 digits)', 'Phone', 'Education', 'Occupation', 'Blood group', 'Father / mother', 'Husband / wife', 'Notes',
  ];

  function exportReadable(table) {
    allow('export');
    const families = [...state.families].sort((a, b) => a.family_code.localeCompare(b.family_code, undefined, { numeric: true }));
    const membersOf = new Map(families.map(f => [f.id, []]));
    state.members.forEach(m => membersOf.get(m.family_id)?.push(m));
    if (table === 'families') {
      return Utils.toCSV(families.map(f => ({
        'Family code': f.family_code, 'Head of family': f.head_name, 'House no.': f.house_no, Address: f.address, Area: f.area,
        Phone: Utils.formatPhone(f.phone), Members: membersOf.get(f.id).length, 'Added by': f.created_by, 'Added on': Utils.formatDate(f.created_at),
      })), READABLE_FAMILY_COLUMNS);
    }
    const name = new Map(state.members.map(m => [m.id, m.full_name]));
    const rows = families.flatMap(f => Utils.sortMembers(membersOf.get(f.id)).map(m => ({
      'Family code': f.family_code, 'Head of family': f.head_name, Area: f.area, 'Full name': m.full_name,
      'Relation to head of family': Utils.relationLabel(m.relation), Gender: Utils.GENDER_LABELS[m.gender] || '',
      'Date of birth': Utils.formatDate(m.dob), Age: Utils.ageInYears(m.dob) ?? '', 'Marital status': m.marital_status,
      'Aadhaar (last 4 digits)': Utils.maskAadhaar(m.aadhaar_last4), Phone: Utils.formatPhone(m.phone),
      Education: m.education, Occupation: m.occupation, 'Blood group': m.blood_group,
      'Father / mother': name.get(m.parent_id) || '', 'Husband / wife': name.get(m.spouse_id) || '', Notes: m.notes,
    })));
    return Utils.toCSV(rows, READABLE_MEMBER_COLUMNS);
  }

  function detectTable(text) {
    const header = Utils.parseCSV(String(text).split(/\r?\n/, 1)[0] + '\n').columns;
    if (header.includes('full_name') && header.includes('family_id')) return 'members';
    if (header.includes('head_name')) return 'families';
    return null;
  }

  /** mode "merge": add new rows and update rows with the same id. mode "replace": the file becomes the whole table. */
  async function importCSV(text, mode) {
    allow('admin');
    latest();
    const table = detectTable(text);
    if (!table) throw new Error('This is not a families.csv or members.csv file (its columns were not recognised).');
    const clean = table === 'families' ? cleanFamily : cleanMember;
    const incoming = Utils.parseCSV(text).map(withId(clean));
    incoming.forEach(r => { if (!r.created_at) r.created_at = nowISO(); });

    if (online) {
      const res = await Supa.rpc('app_import', {
        p_token: Auth.token(), p_table: table, p_rows: incoming, p_mode: mode, p_code_prefix: CONFIG.familyCodePrefix,
      });
      await load();
      return { table, added: res.added, updated: res.updated, skipped: res.skipped, renamed: res.renamed || [], duplicateCodes: [], orphans: 0 };
    }

    let added = 0;
    let updated = 0;
    if (mode === 'replace') {
      state[table] = incoming;
      added = incoming.length;
    } else {
      const position = new Map(state[table].map((r, i) => [r.id, i]));
      for (const rec of incoming) {
        if (position.has(rec.id)) { state[table][position.get(rec.id)] = rec; updated++; }
        else { position.set(rec.id, state[table].push(rec) - 1); added++; }
      }
    }
    if (table === 'families') state.families.filter(f => !f.family_code).forEach(f => { f.family_code = nextFamilyCode(); });
    changed();

    const codes = new Map();
    state.families.forEach(f => codes.set(f.family_code, (codes.get(f.family_code) || 0) + 1));
    const ids = familyIds();
    return {
      table, added, updated, skipped: 0, renamed: [],
      duplicateCodes: [...codes].filter(([, n]) => n > 1).map(([code]) => code),
      orphans: state.members.filter(m => !ids.has(m.family_id)).length,
    };
  }

  /** Demo mode: throw away this browser's changes and load data/*.csv again. */
  async function reloadFromFiles() {
    if (online) throw new Error('The data is stored in Supabase; there are no CSV files to reload.');
    state = fromSeed(await fetchSeed());
    seedChanged = false;
    save();
  }

  async function clearAll() {
    allow('admin');
    latest();
    if (online) await Supa.rpc('app_clear_all', { p_token: Auth.token() });
    state.families = [];
    state.members = [];
    if (!online) changed();
  }

  function info() {
    return {
      online,
      families: state.families.length,
      members: state.members.length,
      loadedAt: state.meta.loadedAt,
      changedAt: state.meta.changedAt,
      exportedAt: { ...state.meta.exportedAt },
      seedChanged,
    };
  }

  return {
    FAMILY_COLUMNS, MEMBER_COLUMNS, online, load, listFamilies, listMembers, getFamily, familyMembers, areas, nextFamilyCode,
    saveFamily, deleteFamily, saveMember, deleteMember, exportCSV, exportReadable, detectTable, importCSV, reloadFromFiles, clearAll, info, forget,
  };
})();
