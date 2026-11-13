/* Families: the add / edit family form and the searchable list page. */
const FamilyForm = (() => {
  const esc = Utils.escapeHtml;

  function open({ family, onSaved } = {}) {
    const isNew = !family;
    const f = family || { family_code: DB.nextFamilyCode() };
    const areas = DB.areas();
    UI.openDialog({
      title: isNew ? 'Add family' : 'Edit family',
      subtitle: isNew ? 'The head of family is added as the first member.' : f.family_code,
      submitLabel: isNew ? 'Add family' : 'Save changes',
      body: `
        <div class="form-grid">
          <div class="field">
            <label for="ff-code">Family code <span class="req">*</span></label>
            <input id="ff-code" name="family_code" value="${esc(f.family_code)}" autocomplete="off" required>
            <span class="hint">Filled in automatically. Change it if you use your own numbering.</span>
          </div>
          <div class="field">
            <label for="ff-house">House no.</label>
            <input id="ff-house" name="house_no" value="${esc(f.house_no || '')}" autocomplete="off">
          </div>
          <div class="field span-2">
            <label for="ff-head">${esc(Utils.relationLabel('Self'))} <span class="req">*</span></label>
            <input id="ff-head" name="head_name" value="${esc(f.head_name || '')}" autocomplete="off" placeholder="Full name" required>
          </div>
          <div class="field">
            <label for="ff-area">Area / street / ward</label>
            <input id="ff-area" name="area" value="${esc(f.area || '')}" list="ff-areas" autocomplete="off" placeholder="e.g. Masjid Street">
            <datalist id="ff-areas">${areas.map(a => `<option value="${esc(a)}"></option>`).join('')}</datalist>
          </div>
          <div class="field">
            <label for="ff-phone">Phone</label>
            <input id="ff-phone" name="phone" type="tel" inputmode="tel" value="${esc(f.phone || '')}" autocomplete="off" placeholder="10-digit mobile">
          </div>
          <div class="field span-2">
            <label for="ff-address">Address</label>
            <textarea id="ff-address" name="address" rows="2" placeholder="Landmark, street">${esc(f.address || '')}</textarea>
          </div>
        </div>`,
      onSubmit: async form => {
        const data = Object.fromEntries(new FormData(form).entries());
        const saved = await DB.saveFamily({ ...data, id: f.id });
        onSaved?.(saved, isNew);
      },
    });
    if (isNew) setTimeout(() => document.getElementById('ff-head')?.focus(), 50);
  }

  return { open };
})();

Pages.families = (() => {
  const esc = Utils.escapeHtml;
  const PAGE_SIZE = 30;
  const SORTS = {
    recent: { label: 'Recently added', fn: (a, b) => (b.created_at || '').localeCompare(a.created_at || '') },
    code: { label: 'Family code', fn: (a, b) => a.family_code.localeCompare(b.family_code, undefined, { numeric: true }) },
    name: { label: 'Head of family (A–Z)', fn: (a, b) => a.head_name.localeCompare(b.head_name) },
    size: { label: 'Most members', fn: (a, b) => counts.get(b.id) - counts.get(a.id) || a.head_name.localeCompare(b.head_name) },
  };

  let families = [];
  let members = [];
  let counts = new Map();
  let searchText = new Map();
  let query = '';
  let area = '';
  let sort = 'recent';
  let limit = PAGE_SIZE;

  async function init() {
    const params = new URLSearchParams(location.search);
    query = params.get('q') || '';
    area = params.get('area') || '';
    sort = SORTS[params.get('sort')] ? params.get('sort') : 'recent';
    setupActions();
    setupToolbar();
    await load();
  }

  async function load() {
    [families, members] = await Promise.all([DB.listFamilies(), DB.listMembers()]);
    counts = new Map(families.map(f => [f.id, 0]));
    searchText = new Map(families.map(f => [f.id, [f.family_code, f.head_name, f.house_no, f.address, f.area, f.phone].join(' ').toLowerCase()]));
    for (const m of members) {
      counts.set(m.family_id, (counts.get(m.family_id) || 0) + 1);
      searchText.set(m.family_id, `${searchText.get(m.family_id)} ${m.full_name} ${m.phone} ${m.aadhaar_last4}`.toLowerCase());
    }
    renderAreaOptions();
    render();
  }

  function setupActions() {
    const actions = document.getElementById('families-actions');
    actions.innerHTML = `
      ${Auth.can('export') ? `
        <div class="dropdown">
          <button type="button" class="btn btn-secondary" id="export-button" aria-haspopup="menu" aria-expanded="false">${UI.icon('download')}<span>Export</span>${UI.icon('chevronDown', 'chevron')}</button>
          <div class="menu menu-right" role="menu" hidden>
            <button type="button" role="menuitem" data-export="families">${UI.icon('file')}<span>Families <small>one row per family</small></span></button>
            <button type="button" role="menuitem" data-export="members">${UI.icon('file')}<span>Members <small>one row per person</small></span></button>
          </div>
        </div>` : ''}
      ${Auth.can('add') ? `<button type="button" class="btn btn-primary" id="add-family">${UI.icon('plus')}<span>Add family</span></button>` : ''}`;
    const exportButton = document.getElementById('export-button');
    if (exportButton) {
      UI.dropdown(exportButton, exportButton.nextElementSibling);
      actions.querySelectorAll('[data-export]').forEach(b => b.addEventListener('click', () => UI.exportTable(b.dataset.export)));
    }
    document.getElementById('add-family')?.addEventListener('click', addFamily);
  }

  function addFamily() {
    FamilyForm.open({
      onSaved: saved => {
        UI.flash(`Family ${saved.family_code} added`);
        location.href = `family.html?id=${encodeURIComponent(saved.id)}&new=1`;
      },
    });
  }

  function setupToolbar() {
    const search = document.getElementById('family-search');
    const clear = document.getElementById('search-clear');
    search.value = query;
    clear.hidden = !query;
    search.addEventListener('input', Utils.debounce(() => {
      query = search.value.trim();
      clear.hidden = !query;
      limit = PAGE_SIZE;
      syncUrl();
      render();
    }, 150));
    clear.addEventListener('click', () => {
      search.value = '';
      search.dispatchEvent(new Event('input'));
      search.focus();
    });

    document.getElementById('family-area').addEventListener('change', e => { area = e.target.value; limit = PAGE_SIZE; syncUrl(); render(); });
    const sortSelect = document.getElementById('family-sort');
    sortSelect.innerHTML = UI.options(Object.entries(SORTS).map(([value, s]) => ({ value, label: s.label })), sort);
    UI.enhanceSelect(sortSelect);
    sortSelect.addEventListener('change', e => { sort = e.target.value; syncUrl(); render(); });

    document.getElementById('families-list').addEventListener('click', onListClick);
  }

  function renderAreaOptions() {
    const areas = DB.areas();
    if (area && !areas.includes(area)) areas.push(area);
    const counts = new Map();
    families.forEach(f => { if (f.area) counts.set(f.area, (counts.get(f.area) || 0) + 1); });
    const select = document.getElementById('family-area');
    select.innerHTML = `<option value="" data-count="${families.length}">All areas</option>`
      + areas.map(a => `<option value="${esc(a)}" data-count="${counts.get(a) || 0}"${a === area ? ' selected' : ''}>${esc(a)}</option>`).join('');
    UI.enhanceSelect(select);
  }

  function syncUrl() {
    const url = new URL(location.href);
    for (const [key, value, fallback] of [['q', query, ''], ['area', area, ''], ['sort', sort, 'recent']]) {
      if (value && value !== fallback) url.searchParams.set(key, value); else url.searchParams.delete(key);
    }
    history.replaceState(null, '', url);
  }

  function filtered() {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    return families
      .filter(f => (!area || f.area === area) && words.every(w => searchText.get(f.id).includes(w)))
      .sort(SORTS[sort].fn);
  }

  // When the search matched a family member (not the head), show who.
  function matchedMember(family) {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    if (!words.length) return null;
    const own = [family.family_code, family.head_name, family.house_no, family.address, family.area, family.phone].join(' ').toLowerCase();
    if (words.every(w => own.includes(w))) return null;
    return members.find(m => m.family_id === family.id && m.relation !== 'Self'
      && words.some(w => `${m.full_name} ${m.phone} ${m.aadhaar_last4}`.toLowerCase().includes(w))) || null;
  }

  function render() {
    const list = filtered();
    const totalMembers = members.length;
    document.getElementById('families-summary').textContent = query || area
      ? `${list.length} of ${families.length} families match`
      : `${Utils.number(families.length)} families · ${Utils.number(totalMembers)} members`;

    const box = document.getElementById('families-list');
    if (!families.length) {
      box.innerHTML = `<div class="card">${UI.emptyState({
        icon: 'home', title: 'No families yet',
        text: Auth.can('add') ? 'Add the first family to get started.' : 'An admin or volunteer can add families.',
        action: Auth.can('add') ? `<button type="button" class="btn btn-primary" data-action="add">${UI.icon('plus')}<span>Add family</span></button>` : '',
      })}</div>`;
      return;
    }
    if (!list.length) {
      box.innerHTML = `<div class="card">${UI.emptyState({
        icon: 'search', title: 'No families match',
        text: 'Try a different name, phone number or area.',
        action: '<button type="button" class="btn btn-secondary" data-action="reset">Clear search</button>',
      })}</div>`;
      return;
    }

    const shown = list.slice(0, limit);
    const canEdit = Auth.can('edit');
    const canDelete = Auth.can('delete');
    box.innerHTML = `
      <div class="card table-card">
        <table class="table families-table">
          <thead><tr>
            <th scope="col">Family</th><th scope="col">House no.</th><th scope="col">Area</th>
            <th scope="col">Phone</th><th scope="col" class="num">Members</th><th scope="col"><span class="sr-only">Actions</span></th>
          </tr></thead>
          <tbody>${shown.map(f => row(f, canEdit, canDelete)).join('')}</tbody>
        </table>
      </div>
      ${list.length > limit ? `
        <div class="list-more">
          <span class="muted">Showing ${shown.length} of ${list.length}</span>
          <button type="button" class="btn btn-secondary" data-action="more">Show more</button>
        </div>` : ''}`;
  }

  function row(f, canEdit, canDelete) {
    const match = matchedMember(f);
    const href = `family.html?id=${encodeURIComponent(f.id)}`;
    return `
      <tr data-id="${esc(f.id)}" data-href="${href}">
        <td class="cell-main">
          <a class="family-link" href="${href}">
            <span class="avatar">${esc(Utils.initials(f.head_name))}</span>
            <span class="family-name">
              <strong>${esc(f.head_name)}</strong>
              <small><span class="code">${esc(f.family_code)}</span>${match ? ` · Member: ${esc(match.full_name)}` : ''}</small>
            </span>
          </a>
        </td>
        <td data-label="House no."${f.house_no ? '' : ' class="empty-cell"'}>${esc(f.house_no) || '<span class="muted">—</span>'}</td>
        <td data-label="Area"${f.area ? '' : ' class="empty-cell"'}>${f.area ? `<span class="chip">${esc(f.area)}</span>` : '<span class="muted">—</span>'}</td>
        <td data-label="Phone"${f.phone ? '' : ' class="empty-cell"'}>${f.phone ? `<a href="${Utils.telHref(f.phone)}">${esc(Utils.formatPhone(f.phone))}</a>` : '<span class="muted">—</span>'}</td>
        <td data-label="Members" class="num"><span class="count-pill" title="Members">${UI.icon('users')}${counts.get(f.id) || 0}</span></td>
        <td class="row-actions">
          <a class="btn btn-sm btn-ghost" href="${href}">View${UI.icon('chevronRight')}</a>
          ${canEdit ? `<button type="button" class="icon-btn" data-action="edit" aria-label="Edit ${esc(f.head_name)}">${UI.icon('edit')}</button>` : ''}
          ${canDelete ? `<button type="button" class="icon-btn danger" data-action="delete" aria-label="Delete ${esc(f.head_name)}">${UI.icon('trash')}</button>` : ''}
        </td>
      </tr>`;
  }

  async function onListClick(e) {
    const action = e.target.closest('[data-action]')?.dataset.action;
    if (action === 'more') { limit += PAGE_SIZE; render(); return; }
    if (action === 'add') { addFamily(); return; }
    if (action === 'reset') {
      query = ''; area = '';
      document.getElementById('family-search').value = '';
      document.getElementById('search-clear').hidden = true;
      const areaSelect = document.getElementById('family-area');
      areaSelect.value = '';
      areaSelect._menu?.refresh();
      syncUrl(); render();
      return;
    }
    const tr = e.target.closest('tr[data-id]');
    if (!tr) return;
    const family = families.find(f => f.id === tr.dataset.id);
    if (action === 'edit') {
      FamilyForm.open({ family, onSaved: () => { UI.toast('Family updated'); load(); } });
    } else if (action === 'delete') {
      const n = counts.get(family.id) || 0;
      const ok = await UI.confirm({
        title: `Delete ${family.family_code}?`,
        message: `This deletes the family of ${family.head_name} and its ${n} ${n === 1 ? 'member' : 'members'}. This cannot be undone.`,
        confirmLabel: 'Delete family',
      });
      if (!ok) return;
      try { await DB.deleteFamily(family.id); UI.toast('Family deleted'); load(); } catch (err) { UI.toast(err.message, 'error'); }
    } else if (!e.target.closest('a, button')) {
      location.href = tr.dataset.href; // clicking anywhere on the row opens the family
    }
  }

  return { init };
})();
