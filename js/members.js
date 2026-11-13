/* Members: list order, the member card and the add / edit member form. */
const Members = (() => {
  const esc = Utils.escapeHtml;

  const sort = Utils.sortMembers;

  function card(m, all, { canEdit, canDelete }) {
    const byId = new Map(all.map(x => [x.id, x]));
    const spouse = byId.get(m.spouse_id);
    const parent = byId.get(m.parent_id);
    const facts = [Utils.GENDER_LABELS[m.gender], Utils.ageText(m.dob)].filter(Boolean).join(' · ');
    const item = (label, value, html = false) => `
      <div><dt>${label}</dt><dd>${value ? (html ? value : esc(value)) : '<span class="empty">—</span>'}</dd></div>`;
    const phone = m.phone ? `<a href="${Utils.telHref(m.phone)}">${esc(Utils.formatPhone(m.phone))}</a>` : '';
    return `
      <article class="card member-card" id="member-${esc(m.id)}" data-id="${esc(m.id)}">
        <div class="member-top">
          <span class="avatar avatar-lg g-${esc(m.gender || 'unknown')}">${esc(Utils.initials(m.full_name))}</span>
          <div class="member-title">
            <h3>${esc(m.full_name)}</h3>
            <div class="member-sub">
              <span class="badge${m.relation === 'Self' ? ' badge-head' : ''}">${esc(Utils.relationLabel(m.relation) || 'Relation not set')}</span>
              ${facts ? `<span>${esc(facts)}</span>` : ''}
            </div>
          </div>
          <div class="member-actions">
            ${canEdit ? `<button type="button" class="icon-btn" data-action="edit-member" aria-label="Edit ${esc(m.full_name)}">${UI.icon('edit')}</button>` : ''}
            ${canDelete ? `<button type="button" class="icon-btn danger" data-action="delete-member" aria-label="Delete ${esc(m.full_name)}">${UI.icon('trash')}</button>` : ''}
          </div>
        </div>
        <dl class="member-details">
          ${item('Aadhaar', Utils.maskAadhaar(m.aadhaar_last4))}
          ${item('Phone', phone, true)}
          ${item('Date of birth', Utils.formatDate(m.dob))}
          ${item('Marital status', m.marital_status)}
          ${item('Education', m.education)}
          ${item('Occupation', m.occupation)}
          ${item('Blood group', m.blood_group)}
          ${spouse ? item(Utils.SPOUSE_LABEL, spouse.full_name) : ''}
          ${parent ? item(Utils.PARENT_LABEL, parent.full_name) : ''}
        </dl>
        ${m.notes ? `<p class="member-notes">${esc(m.notes)}</p>` : ''}
      </article>`;
  }

  function openForm({ family, member, members, onSaved }) {
    const isNew = !member;
    const m = member || {};
    const others = sort(members.filter(x => x.id !== m.id));
    const people = selected => others.map(o => `<option value="${esc(o.id)}"${o.id === selected ? ' selected' : ''}>${esc(o.full_name)} (${esc(Utils.relationLabel(o.relation))})</option>`).join('');
    const age = Utils.ageInYears(m.dob);
    const hasHead = members.some(x => x.relation === 'Self' && x.id !== m.id);
    const relations = Utils.RELATIONS.filter(r => r !== 'Self' || !hasHead).map(r => ({ value: r, label: Utils.relationLabel(r) }));

    const dlg = UI.openDialog({
      title: isNew ? 'Add member' : 'Edit member',
      subtitle: `${family.head_name} · ${family.family_code}`,
      submitLabel: isNew ? 'Add member' : 'Save changes',
      wide: true,
      body: `
        <div class="form-grid">
          <p class="form-section">Basic details</p>
          <div class="field span-2">
            <label for="mf-name">Full name <span class="req">*</span></label>
            <input id="mf-name" name="full_name" value="${esc(m.full_name || '')}" autocomplete="off" required>
          </div>
          <div class="field">
            <label for="mf-relation">Relation to head of family <span class="req">*</span></label>
            <select id="mf-relation" name="relation" required>${UI.options(relations, m.relation || '', 'Choose…')}</select>
          </div>
          <div class="field">
            <span class="label" id="mf-gender-label">Gender <span class="req">*</span></span>
            <div class="segmented" role="radiogroup" aria-labelledby="mf-gender-label">
              ${['male', 'female', 'other'].map(g => `
                <label><input type="radio" name="gender" value="${g}"${m.gender === g ? ' checked' : ''}><span>${Utils.GENDER_LABELS[g]}</span></label>`).join('')}
            </div>
          </div>
          <div class="field">
            <label for="mf-dob">Date of birth</label>
            <input id="mf-dob" name="dob" type="date" value="${esc(m.dob || '')}" max="${Utils.todayISO()}">
          </div>
          <div class="field">
            <label for="mf-age">Age in years <span class="label-note">if the date is not known</span></label>
            <input id="mf-age" type="number" inputmode="numeric" min="0" max="120" value="${age ?? ''}" placeholder="e.g. 45">
            <span class="hint">Typing an age sets the date of birth to 1 January of that year.</span>
          </div>
          <div class="field">
            <label for="mf-marital">Marital status</label>
            <select id="mf-marital" name="marital_status">${UI.options(Utils.MARITAL, m.marital_status || '', '—')}</select>
          </div>
          <div class="field">
            <label for="mf-blood">Blood group</label>
            <select id="mf-blood" name="blood_group">${UI.options(Utils.BLOOD_GROUPS, m.blood_group || '', 'Not known')}</select>
          </div>

          <p class="form-section">ID &amp; contact</p>
          <div class="field">
            <label for="mf-aadhaar">Aadhaar (last 4 digits)</label>
            <input id="mf-aadhaar" name="aadhaar_last4" inputmode="numeric" maxlength="14" autocomplete="off" value="${esc(m.aadhaar_last4 || '')}" placeholder="e.g. 1234">
            <span class="hint">${UI.icon('lock')} Only the last 4 digits are saved. If you type all 12, the rest is dropped.</span>
          </div>
          <div class="field">
            <label for="mf-phone">Phone</label>
            <input id="mf-phone" name="phone" type="tel" inputmode="tel" autocomplete="off" value="${esc(m.phone || '')}" placeholder="10-digit mobile">
          </div>

          <p class="form-section">Education &amp; work</p>
          <div class="field">
            <label for="mf-education">Education</label>
            <select id="mf-education" name="education">${UI.options(Utils.EDUCATION, m.education || '', '—')}</select>
          </div>
          <div class="field">
            <label for="mf-occupation">Occupation</label>
            <select id="mf-occupation" name="occupation">${UI.options(Utils.OCCUPATIONS, m.occupation || '', '—')}</select>
          </div>

          <p class="form-section">Family tree</p>
          <div class="field">
            <label for="mf-parent">${esc(Utils.PARENT_LABEL)}</label>
            <select id="mf-parent" name="parent_id"><option value="">Not set: guess from relation</option>${people(m.parent_id)}</select>
          </div>
          <div class="field">
            <label for="mf-spouse">${esc(Utils.SPOUSE_LABEL)}</label>
            <select id="mf-spouse" name="spouse_id"><option value="">Not set: guess from relation</option>${people(m.spouse_id)}</select>
          </div>
          <p class="hint span-2">These links draw the family tree exactly. Left empty, the tree guesses from the relation (for example, a son is shown under the head of family).</p>

          <div class="field span-2">
            <label for="mf-notes">Notes</label>
            <textarea id="mf-notes" name="notes" rows="2" placeholder="Anything else worth recording">${esc(m.notes || '')}</textarea>
          </div>
        </div>`,
      onSubmit: async form => {
        const data = Object.fromEntries(new FormData(form).entries());
        const typedFull = Utils.aadhaarDigits(data.aadhaar_last4).length === 12;
        const saved = await DB.saveMember({ ...data, gender: data.gender || '', id: m.id, family_id: family.id });
        UI.toast(`${isNew ? `${saved.full_name} added` : 'Changes saved'}${typedFull ? '. Only the last 4 Aadhaar digits were kept.' : ''}`);
        onSaved?.(saved, isNew);
      },
    });

    // Date of birth and age fill each other in.
    const dob = dlg.querySelector('#mf-dob');
    const ageInput = dlg.querySelector('#mf-age');
    dob.addEventListener('change', () => { ageInput.value = Utils.ageInYears(dob.value) ?? ''; });
    ageInput.addEventListener('input', () => {
      const years = parseInt(ageInput.value, 10);
      if (Number.isFinite(years) && years >= 0 && years <= 120 && Utils.ageInYears(dob.value) !== years) {
        dob.value = `${new Date().getFullYear() - years}-01-01`;
      }
    });
    if (isNew) setTimeout(() => dlg.querySelector('#mf-name').focus(), 50);
    return dlg;
  }

  return { sort, card, openForm };
})();
