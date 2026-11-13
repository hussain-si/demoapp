/* One family: details, members (add / edit / delete), the family tree and a printable card. */
Pages.family = (() => {
  const esc = Utils.escapeHtml;
  let family = null;
  let members = [];
  let tab = 'members';

  async function init() {
    const params = new URLSearchParams(location.search);
    family = await DB.getFamily(params.get('id') || '');
    const main = document.getElementById('main');
    if (!family) {
      main.innerHTML = `${backLink()}<div class="card">${UI.emptyState({
        icon: 'search', title: 'Family not found',
        text: 'It may have been deleted, or the link is incomplete.',
        action: '<a class="btn btn-primary" href="families.html">Go to families</a>',
      })}</div>`;
      return;
    }
    if (params.get('tab') === 'tree') tab = 'tree';
    main.addEventListener('click', onClick);
    await refresh();
    if (tab === 'tree') revealTabs('auto');

    // Just created: go straight on to the head of family's details.
    if (params.get('new') === '1') {
      params.delete('new');
      history.replaceState(null, '', `family.html?${params}`);
      const head = members.find(m => m.relation === 'Self');
      if (head && Auth.can('edit')) editMember(head);
    }
    document.addEventListener('themechange', () => { if (tab === 'tree') drawTree(); });
  }

  async function refresh() {
    family = await DB.getFamily(family.id);
    if (!family) { location.replace('families.html'); return; }
    members = Members.sort(await DB.familyMembers(family.id));
    document.title = `${family.head_name} · ${CONFIG.appName}`;
    render();
  }

  const backLink = () => `<a class="back-link" href="families.html">${UI.icon('arrowLeft')}<span>All families</span></a>`;

  function render() {
    const main = document.getElementById('main');
    main.innerHTML = `
      ${backLink()}
      ${hero()}
      <div class="tabs" role="tablist" aria-label="Family sections">
        <button type="button" class="tab" role="tab" id="tab-members" aria-controls="panel-members" aria-selected="${tab === 'members'}" data-tab="members">
          ${UI.icon('users')}<span>Members</span><span class="tab-count">${members.length}</span>
        </button>
        <button type="button" class="tab" role="tab" id="tab-tree" aria-controls="panel-tree" aria-selected="${tab === 'tree'}" data-tab="tree">
          ${UI.icon('tree')}<span>Family tree</span>
        </button>
      </div>
      <section id="panel-members" role="tabpanel" aria-labelledby="tab-members"${tab === 'members' ? '' : ' hidden'}>${membersPanel()}</section>
      <section id="panel-tree" role="tabpanel" aria-labelledby="tab-tree"${tab === 'tree' ? '' : ' hidden'}>${treePanel()}</section>
      ${printCard()}`;
    if (tab === 'tree') drawTree();
  }

  // On phones the tabs sit below the family card; bring the chosen tab into view.
  function revealTabs(behavior = 'smooth') {
    const tabs = document.querySelector('.tabs');
    if (tabs && tabs.getBoundingClientRect().top > window.innerHeight * 0.45) tabs.scrollIntoView({ behavior, block: 'start' });
  }

  function hero() {
    const ages = members.map(m => Utils.ageInYears(m.dob));
    const stats = [
      ['Members', members.length],
      ['Male', members.filter(m => m.gender === 'male').length],
      ['Female', members.filter(m => m.gender === 'female').length],
      ['Children', ages.filter(a => a !== null && a < 18).length],
      ['Seniors', ages.filter(a => a !== null && a >= 60).length],
    ];
    const place = [family.house_no && `House ${family.house_no}`, family.address].filter(Boolean).join(' · ');
    return `
      <section class="card family-hero">
        <div class="family-hero-top">
          <div class="hero-identity">
            <span class="hero-avatar">${esc(Utils.initials(family.head_name))}</span>
            <div class="hero-text">
              <div class="hero-tags">
                <span class="code-badge">${esc(family.family_code)}</span>
                ${family.area ? `<a class="chip" href="families.html?area=${encodeURIComponent(family.area)}">${UI.icon('pin')}${esc(family.area)}</a>` : ''}
              </div>
              <h1>${esc(family.head_name)}</h1>
              ${place ? `<p class="muted">${esc(place)}</p>` : ''}
              ${family.phone ? `<a class="hero-phone" href="${Utils.telHref(family.phone)}">${UI.icon('phone')}${esc(Utils.formatPhone(family.phone))}</a>` : ''}
            </div>
          </div>
          <div class="hero-actions">
            <button type="button" class="btn btn-secondary" data-action="print">${UI.icon('printer')}<span>Print</span></button>
            ${Auth.can('edit') ? `<button type="button" class="btn btn-secondary" data-action="edit-family">${UI.icon('edit')}<span>Edit</span></button>` : ''}
            ${Auth.can('delete') ? `<button type="button" class="btn btn-danger-soft" data-action="delete-family">${UI.icon('trash')}<span>Delete</span></button>` : ''}
          </div>
        </div>
        <dl class="hero-stats">${stats.map(([label, value]) => `<div><dt>${label}</dt><dd>${value}</dd></div>`).join('')}</dl>
        <p class="hero-meta">Added${family.created_by ? ` by ${esc(family.created_by)}` : ''}${family.created_at ? ` on ${esc(Utils.formatDate(family.created_at))}` : ''}</p>
      </section>`;
  }

  function membersPanel() {
    const canAdd = Auth.can('add');
    const head = `
      <div class="section-head">
        <h2>Members</h2>
        ${canAdd ? `<button type="button" class="btn btn-primary" data-action="add-member">${UI.icon('plus')}<span>Add member</span></button>` : ''}
      </div>`;
    if (!members.length) {
      return head + `<div class="card">${UI.emptyState({ icon: 'users', title: 'No members yet', text: canAdd ? 'Add the people who live in this family.' : '' })}</div>`;
    }
    const perms = { canEdit: Auth.can('edit'), canDelete: Auth.can('delete') };
    return head + `<div class="member-grid">${members.map(m => Members.card(m, members, perms)).join('')}</div>`;
  }

  function treePanel() {
    return `
      <div class="card tree-card">
        <div class="tree-toolbar">
          <div class="legend" aria-label="Legend">
            <span class="legend-item"><span class="legend-box g-male"></span>Male</span>
            <span class="legend-item"><span class="legend-box g-female"></span>Female</span>
            <span class="legend-item"><span class="legend-box g-other"></span>Other</span>
            <span class="legend-item"><span class="legend-line spouse"></span>${esc(Utils.SPOUSE_LABEL)}</span>
            <span class="legend-item"><span class="legend-line child"></span>Parent → child</span>
          </div>
          <div class="tree-actions">
            <button type="button" class="btn btn-sm btn-secondary" data-action="fit">${UI.icon('fit')}<span>Fit</span></button>
            <button type="button" class="btn btn-sm btn-secondary" data-action="save-image">${UI.icon('image')}<span>Save image</span></button>
          </div>
        </div>
        <div class="tree-canvas" id="tree-canvas" role="img" aria-label="Family tree of ${esc(family.head_name)}"></div>
        <div class="tree-selection" id="tree-selection" hidden></div>
        <p class="tree-hint">${UI.icon('info')}<span>Drag to move, pinch or scroll to zoom, tap a person for details. Set <b>Father / mother</b> and <b>Husband / wife</b> in a member's form to draw links exactly; dotted lines are relatives without links.</span></p>
      </div>`;
  }

  function drawTree() {
    const box = document.getElementById('tree-canvas');
    if (!box) return;
    document.getElementById('tree-selection').hidden = true;
    if (!members.length) {
      box.innerHTML = UI.emptyState({ icon: 'tree', title: 'No members yet', text: 'Add members to see the family tree.' });
      return;
    }
    if (typeof vis === 'undefined') {
      box.innerHTML = UI.emptyState({ icon: 'alert', title: 'The family tree could not load', text: 'Check the internet connection and refresh the page.' });
      return;
    }
    FamilyTree.render(box, members, { onSelect: showSelection });
  }

  function showSelection(id) {
    const box = document.getElementById('tree-selection');
    const m = members.find(x => x.id === id);
    if (!m) { box.hidden = true; return; }
    const facts = [Utils.relationLabel(m.relation), Utils.GENDER_LABELS[m.gender], Utils.ageText(m.dob), m.occupation].filter(Boolean).join(' · ');
    box.hidden = false;
    box.innerHTML = `
      <span class="avatar avatar-lg g-${esc(m.gender || 'unknown')}">${esc(Utils.initials(m.full_name))}</span>
      <div class="selection-text"><strong>${esc(m.full_name)}</strong><span>${esc(facts)}</span></div>
      <div class="selection-actions">
        <button type="button" class="btn btn-sm btn-secondary" data-action="show-member" data-id="${esc(m.id)}">Details</button>
        ${Auth.can('edit') ? `<button type="button" class="btn btn-sm btn-primary" data-action="edit-member" data-id="${esc(m.id)}">${UI.icon('edit')}<span>Edit</span></button>` : ''}
      </div>`;
  }

  function switchTab(name) {
    tab = name;
    document.querySelectorAll('.tab').forEach(t => t.setAttribute('aria-selected', String(t.dataset.tab === name)));
    document.getElementById('panel-members').hidden = name !== 'members';
    document.getElementById('panel-tree').hidden = name !== 'tree';
    const url = new URL(location.href);
    if (name === 'tree') url.searchParams.set('tab', 'tree'); else url.searchParams.delete('tab');
    history.replaceState(null, '', url);
    if (name === 'tree') drawTree(); else FamilyTree.destroy();
  }

  function focusMember(id) {
    switchTab('members');
    const card = document.getElementById(`member-${id}`);
    if (!card) return;
    card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    card.classList.add('highlight');
    setTimeout(() => card.classList.remove('highlight'), 2000);
  }

  function editMember(member) {
    Members.openForm({ family, member, members, onSaved: refresh });
  }

  async function onClick(e) {
    const target = e.target.closest('[data-action], [data-tab]');
    if (!target) return;
    if (target.dataset.tab) { switchTab(target.dataset.tab); revealTabs(); return; }
    const memberId = target.dataset.id || target.closest('.member-card')?.dataset.id;
    const member = members.find(m => m.id === memberId);

    switch (target.dataset.action) {
      case 'print': window.print(); break;
      case 'edit-family':
        FamilyForm.open({ family, onSaved: () => { UI.toast('Family updated'); refresh(); } });
        break;
      case 'delete-family': {
        const ok = await UI.confirm({
          title: `Delete ${family.family_code}?`,
          message: `This deletes the family of ${family.head_name} and its ${members.length} ${members.length === 1 ? 'member' : 'members'}. This cannot be undone.`,
          confirmLabel: 'Delete family',
        });
        if (!ok) return;
        try {
          await DB.deleteFamily(family.id);
          UI.flash(`${family.family_code} deleted`);
          location.href = 'families.html';
        } catch (err) { UI.toast(err.message, 'error'); }
        break;
      }
      case 'add-member': Members.openForm({ family, members, onSaved: refresh }); break;
      case 'edit-member': if (member) editMember(member); break;
      case 'delete-member': {
        if (!member) return;
        const ok = await UI.confirm({
          title: `Delete ${member.full_name}?`,
          message: member.relation === 'Self'
            ? 'This is the head of family. The family stays, but you should choose a new head afterwards.'
            : 'This removes the member from the family. This cannot be undone.',
          confirmLabel: 'Delete member',
        });
        if (!ok) return;
        try { await DB.deleteMember(member.id); UI.toast(`${member.full_name} deleted`); refresh(); } catch (err) { UI.toast(err.message, 'error'); }
        break;
      }
      case 'show-member': focusMember(memberId); break;
      case 'fit': FamilyTree.fit(); break;
      case 'save-image': FamilyTree.downloadImage(`${family.family_code}-family-tree.png`); break;
      default: break;
    }
  }

  function printCard() {
    const cell = v => esc(v || '—');
    const rows = members.map((m, i) => `
      <tr>
        <td>${i + 1}</td><td><strong>${esc(m.full_name)}</strong></td><td>${cell(Utils.relationLabel(m.relation))}</td>
        <td>${cell(Utils.GENDER_LABELS[m.gender])}</td><td>${cell(Utils.formatDate(m.dob))}</td><td>${cell(Utils.ageText(m.dob))}</td>
        <td>${cell(Utils.maskAadhaar(m.aadhaar_last4))}</td><td>${cell(Utils.formatPhone(m.phone))}</td>
        <td>${cell(m.education)}</td><td>${cell(m.occupation)}</td><td>${cell(m.blood_group)}</td>
      </tr>`).join('');
    return `
      <section class="print-card" aria-hidden="true">
        <header class="print-head">
          <div><p class="print-kicker">${esc(CONFIG.appName)} · ${esc(CONFIG.villageName)}</p><h1>${esc(family.head_name)}</h1></div>
          <div class="print-code">${esc(family.family_code)}</div>
        </header>
        <table class="print-info">
          <tr><th>House no.</th><td>${cell(family.house_no)}</td><th>Area</th><td>${cell(family.area)}</td></tr>
          <tr><th>Address</th><td colspan="3">${cell(family.address)}</td></tr>
          <tr><th>Phone</th><td>${cell(Utils.formatPhone(family.phone))}</td><th>Members</th><td>${members.length}</td></tr>
        </table>
        <table class="print-members">
          <thead><tr><th>#</th><th>Name</th><th>Relation</th><th>Gender</th><th>Date of birth</th><th>Age</th><th>Aadhaar</th><th>Phone</th><th>Education</th><th>Occupation</th><th>Blood</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
        <p class="print-foot">Printed on ${esc(Utils.formatDate(Utils.todayISO()))} by ${esc(Auth.current().name)}. Aadhaar numbers are masked.</p>
      </section>`;
  }

  return { init };
})();
