/* Dashboard: headline numbers and charts for the whole village, or for one area. */
Pages.dashboard = (() => {
  const esc = Utils.escapeHtml;
  const charts = new Map(); // canvas id -> Chart
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let families = [];
  let members = [];
  let area = '';

  // Colours come from CSS variables, so both themes get their own set.
  function palette() {
    const v = UI.cssVar;
    return {
      blue: v('--blue'), pink: v('--pink'), amber: v('--amber'), violet: v('--violet'), red: v('--red'),
      orange: v('--orange'), cyan: v('--cyan'), indigo: v('--indigo'),
      male: v('--chart-male'), female: v('--chart-female'), other: v('--chart-other'), muted: v('--chart-muted'),
      marital: ['--m1', '--m2', '--m3', '--m4', '--m5'].map(v),
      text: v('--text'), text2: v('--text-2'), text3: v('--text-3'),
      grid: v('--grid'), axis: v('--axis'), surface: v('--surface'), border: v('--border'),
    };
  }

  async function init() {
    [families, members] = await Promise.all([DB.listFamilies(), DB.listMembers()]);
    area = new URLSearchParams(location.search).get('area') || '';
    if (typeof Chart !== 'undefined') {
      // Charts are drawn on canvas, so wait for the web font before drawing text.
      await Promise.race([document.fonts?.ready, new Promise(r => setTimeout(r, 1500))]);
      Chart.defaults.font.family = getComputedStyle(document.body).fontFamily;
      Chart.defaults.font.size = 12;
    }
    setupFilter();
    document.querySelectorAll('[data-toggle-table]').forEach(button => button.addEventListener('click', () => toggleTable(button)));
    render();
    document.addEventListener('themechange', () => {
      charts.forEach(c => c.destroy());
      charts.clear();
      render();
    });
  }

  function setupFilter() {
    const select = document.getElementById('area-filter');
    const areas = DB.areas();
    if (area && !areas.includes(area)) area = '';
    const counts = new Map();
    families.forEach(f => { if (f.area) counts.set(f.area, (counts.get(f.area) || 0) + 1); });
    select.innerHTML = `<option value="" data-count="${families.length}">All areas</option>`
      + areas.map(a => `<option value="${esc(a)}" data-count="${counts.get(a) || 0}"${a === area ? ' selected' : ''}>${esc(a)}</option>`).join('');
    UI.enhanceSelect(select);
    select.addEventListener('change', () => setArea(select.value));
  }

  function setArea(value) {
    area = value;
    const select = document.getElementById('area-filter');
    select.value = value;
    select._menu?.refresh();
    const url = new URL(location.href);
    if (area) url.searchParams.set('area', area); else url.searchParams.delete('area');
    history.replaceState(null, '', url);
    render();
  }

  function toggleTable(button) {
    const card = button.closest('.chart-card');
    const table = card.querySelector('.chart-table');
    const showTable = table.hidden;
    table.hidden = !showTable;
    card.querySelector('.chart-box, .donut').hidden = showTable;
    button.textContent = showTable ? 'Show chart' : 'Show table';
  }

  function render() {
    const fams = area ? families.filter(f => f.area === area) : families;
    const ids = new Set(fams.map(f => f.id));
    const people = members.filter(m => ids.has(m.family_id)).map(m => ({ ...m, age: Utils.ageInYears(m.dob) }));
    document.getElementById('dash-scope').textContent = area ? `Showing ${area} only` : `All areas of ${CONFIG.villageName}`;
    document.getElementById('area-link').innerHTML = area
      ? `<a href="families.html?area=${encodeURIComponent(area)}">View the ${fams.length} ${fams.length === 1 ? 'family' : 'families'} in ${esc(area)} ${UI.icon('arrowRight')}</a>`
      : '';

    renderStats(fams, people);
    if (typeof Chart === 'undefined') {
      document.querySelectorAll('.chart-box, .donut').forEach(box => {
        box.innerHTML = '<p class="chart-empty">Charts could not load. Check the internet connection and refresh.</p>';
      });
    } else {
      renderAgeGroups(people);
      renderGender(people);
      renderFamilySizes(fams, people);
      renderBloodGroups(people);
      renderMarital(people);
      renderEducation(people);
      renderOccupation(people);
      renderAreas();
    }
    renderRecent(fams, people);
  }

  // ---------- Headline numbers ----------
  function renderStats(fams, people) {
    const total = people.length;
    const male = people.filter(p => p.gender === 'male').length;
    const female = people.filter(p => p.gender === 'female').length;
    const children = people.filter(p => p.age !== null && p.age < 18).length;
    const seniors = people.filter(p => p.age !== null && p.age >= 60).length;
    const aadhaar = people.filter(p => p.aadhaar_last4).length;
    const sizes = familySizeList(fams, people);
    const largest = sizes.length ? Math.max(...sizes) : 0;
    const areaCount = new Set(fams.map(f => f.area).filter(Boolean)).size;
    const tiles = [
      { label: 'Families', value: Utils.number(fams.length), note: area ? `in ${area}` : `in ${areaCount} ${areaCount === 1 ? 'area' : 'areas'}`, icon: 'home', tone: 'blue' },
      { label: 'Members', value: Utils.number(total), note: `${male} male · ${female} female`, icon: 'users', tone: 'violet' },
      { label: 'Family size', value: fams.length ? (total / fams.length).toFixed(1) : '0', note: `Average · largest ${largest}`, icon: 'chart', tone: 'cyan' },
      { label: 'Children', value: Utils.number(children), note: `Under 18 · ${Utils.percent(children, total)}`, icon: 'child', tone: 'amber' },
      { label: 'Seniors', value: Utils.number(seniors), note: `60 and over · ${Utils.percent(seniors, total)}`, icon: 'heart', tone: 'pink' },
      { label: 'Aadhaar', value: Utils.percent(aadhaar, total), note: `${aadhaar} of ${total} recorded`, icon: 'idcard', tone: 'indigo', meter: total ? aadhaar / total : 0 },
    ];
    document.getElementById('stats').innerHTML = tiles.map(t => `
      <article class="card stat">
        <div class="stat-top"><span class="stat-label">${esc(t.label)}</span><span class="stat-icon tone-${t.tone}">${UI.icon(t.icon)}</span></div>
        <div class="stat-value">${esc(t.value)}</div>
        ${t.meter !== undefined ? `<div class="meter" aria-hidden="true"><span style="width:${(t.meter * 100).toFixed(1)}%"></span></div>` : ''}
        <div class="stat-note">${esc(t.note)}</div>
      </article>`).join('');
  }

  // ---------- Chart.js helpers ----------
  function withAlpha(color, alpha) {
    const m = /^#([0-9a-f]{6})$/i.exec(String(color).trim());
    if (!m) return color;
    const n = parseInt(m[1], 16);
    return `rgba(${n >> 16}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
  }

  // A soft gradient along each bar: lighter at the baseline, full colour at the end.
  function gradient(color, horizontal) {
    return ctx => {
      const { chart } = ctx;
      const a = chart.chartArea;
      if (!a) return color;
      const g = horizontal
        ? chart.ctx.createLinearGradient(a.left, 0, a.right, 0)
        : chart.ctx.createLinearGradient(0, a.bottom, 0, a.top);
      g.addColorStop(0, withAlpha(color, 0.55));
      g.addColorStop(1, color);
      return g;
    };
  }

  // Writes each bar's value just past its end.
  const valueLabels = {
    id: 'valueLabels',
    afterDatasetsDraw(chart, args, opts) {
      const { ctx } = chart;
      const horizontal = chart.options.indexAxis === 'y';
      ctx.save();
      ctx.font = `400 12px ${Chart.defaults.font.family}`;
      ctx.fillStyle = opts.color || '#666';
      chart.data.datasets.forEach((ds, di) => {
        const meta = chart.getDatasetMeta(di);
        if (meta.hidden) return;
        meta.data.forEach((bar, i) => {
          const raw = ds.data[i];
          if (!raw) return;
          if (horizontal) {
            ctx.textAlign = raw < 0 ? 'right' : 'left';
            ctx.textBaseline = 'middle';
            ctx.fillText(String(Math.abs(raw)), bar.x + (raw < 0 ? -6 : 6), bar.y);
          } else {
            ctx.textAlign = 'center';
            ctx.textBaseline = 'bottom';
            ctx.fillText(String(raw), bar.x, bar.y - 4);
          }
        });
      });
      ctx.restore();
    },
  };

  // A 2px gap in the surface colour where the male and female bars meet.
  const centreGap = {
    id: 'centreGap',
    afterDatasetsDraw(chart, args, opts) {
      const x = chart.scales.x.getPixelForValue(0);
      const { top, bottom } = chart.chartArea;
      chart.ctx.save();
      chart.ctx.fillStyle = opts.color;
      chart.ctx.fillRect(x - 1, top, 2, bottom - top);
      chart.ctx.restore();
    },
  };

  // Total in the middle of a doughnut.
  const centreText = {
    id: 'centreText',
    afterDatasetsDraw(chart, args, opts) {
      const arc = chart.getDatasetMeta(0).data[0];
      if (!arc) return;
      const { ctx } = chart;
      const family = Chart.defaults.font.family;
      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = opts.color;
      ctx.font = `700 24px ${family}`;
      ctx.fillText(opts.value, arc.x, arc.y - 8);
      ctx.fillStyle = opts.subColor;
      ctx.font = `400 12px ${family}`;
      ctx.fillText(opts.label, arc.x, arc.y + 13);
      ctx.restore();
    },
  };

  function tooltip(c, extra = {}) {
    return {
      backgroundColor: c.surface, borderColor: c.border, borderWidth: 1,
      titleColor: c.text3, bodyColor: c.text,
      titleFont: { weight: '400', size: 12 }, bodyFont: { weight: '700', size: 13 },
      padding: { x: 10, y: 8 }, cornerRadius: 8, caretSize: 5, displayColors: false, ...extra,
    };
  }

  const barShape = { borderRadius: 5, borderSkipped: 'start', maxBarThickness: 22, categoryPercentage: 0.72, barPercentage: 0.9 };

  function barChart({ id, labels, values, color, horizontal = false, dim, unit, xTitle, onClick }) {
    const c = palette();
    const box = document.getElementById(id).parentElement;
    box.style.height = horizontal ? `${Math.max(250, labels.length * 32 + 20)}px` : '250px';
    const fill = gradient(color, horizontal);
    const background = ctx => (dim && dim(ctx.dataIndex) ? c.muted : fill(ctx));
    const scales = horizontal
      ? {
        x: { display: false, beginAtZero: true },
        y: { grid: { display: false }, border: { display: false }, ticks: { color: c.text2, font: { size: 12.5 } } },
      }
      : {
        x: {
          grid: { display: false }, border: { color: c.axis }, ticks: { color: c.text2, font: { size: 12.5 } },
          title: { display: Boolean(xTitle), text: xTitle, color: c.text3, font: { size: 12 } },
        },
        y: {
          beginAtZero: true, border: { display: false }, grid: { color: c.grid, drawTicks: false },
          ticks: { color: c.text3, font: { size: 11.5 }, precision: 0, padding: 8, maxTicksLimit: 5 },
        },
      };
    draw(id, {
      type: 'bar',
      data: { labels, datasets: [{ data: values, ...barShape, backgroundColor: background, hoverBackgroundColor: color }] },
      options: {
        indexAxis: horizontal ? 'y' : 'x',
        responsive: true, maintainAspectRatio: false,
        animation: reduceMotion ? false : { duration: 500 },
        layout: { padding: horizontal ? { right: 34 } : { top: 20 } },
        scales,
        plugins: {
          legend: { display: false },
          tooltip: tooltip(c, { callbacks: { label: ctx => `${ctx.parsed[horizontal ? 'x' : 'y']} ${unit}` } }),
          valueLabels: { color: c.text2 },
        },
        onClick: onClick ? (evt, elements) => { if (elements.length) onClick(elements[0].index); } : undefined,
        onHover: onClick ? (evt, elements) => { evt.native.target.style.cursor = elements.length ? 'pointer' : ''; } : undefined,
      },
      plugins: [valueLabels],
    });
  }

  function donutChart({ id, legendId, labels, values, colors, centreLabel, unit }) {
    const c = palette();
    const total = values.reduce((s, v) => s + v, 0);
    draw(id, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data: total ? values : [1],
          backgroundColor: total ? colors : [c.grid],
          hoverBackgroundColor: total ? colors : [c.grid],
          borderColor: c.surface, borderWidth: 2, hoverOffset: 4, borderRadius: 2,
        }],
      },
      options: {
        responsive: true, maintainAspectRatio: false, cutout: '74%',
        animation: reduceMotion ? false : { duration: 500 },
        layout: { padding: 4 },
        plugins: {
          legend: { display: false },
          tooltip: tooltip(c, {
            enabled: Boolean(total), displayColors: true, usePointStyle: true, boxWidth: 8, boxHeight: 8, boxPadding: 4,
            callbacks: { title: () => '', label: ctx => ` ${ctx.label}: ${ctx.raw} ${unit} (${Utils.percent(ctx.raw, total)})` },
          }),
          centreText: { value: Utils.number(total), label: centreLabel, color: c.text, subColor: c.text3 },
        },
      },
      plugins: [centreText],
    });
    document.getElementById(legendId).innerHTML = labels.map((label, i) => `
      <li>
        <span class="dot" style="background:${colors[i]}"></span>
        <span class="legend-label">${esc(label)}</span>
        <span class="legend-value">${Utils.number(values[i])}</span>
        <span class="legend-pct">${Utils.percent(values[i], total)}</span>
      </li>`).join('');
  }

  function draw(id, config) {
    const existing = charts.get(id);
    if (existing) {
      existing.data = config.data;
      existing.options = config.options;
      existing.update();
      return;
    }
    charts.set(id, new Chart(document.getElementById(id), config));
  }

  function table(id, headers, rows) {
    document.getElementById(id).innerHTML = `
      <table class="data-table">
        <thead><tr>${headers.map((h, i) => `<th${i ? ' class="num"' : ''}>${esc(h)}</th>`).join('')}</tr></thead>
        <tbody>${rows.map(r => `<tr>${r.map((v, i) => `<td${i ? ' class="num"' : ''}>${esc(v)}</td>`).join('')}</tr>`).join('')}</tbody>
      </table>`;
  }

  const note = (id, text) => { document.getElementById(id).textContent = text; };

  // ---------- Charts ----------
  function renderAgeGroups(people) {
    const c = palette();
    const groups = [...Utils.AGE_GROUPS].reverse(); // oldest at the top, like a population pyramid
    const count = (g, gender) => people.filter(p => p.gender === gender && p.age !== null && p.age >= g.min && p.age <= g.max).length;
    const male = groups.map(g => count(g, 'male'));
    const female = groups.map(g => count(g, 'female'));
    const max = Math.max(1, ...male, ...female);
    const unknownAge = people.filter(p => p.age === null).length;
    const otherGender = people.filter(p => p.age !== null && p.gender !== 'male' && p.gender !== 'female').length;
    const shape = { ...barShape, maxBarThickness: 24, categoryPercentage: 0.78 };

    draw('chart-age', {
      type: 'bar',
      data: {
        labels: groups.map(g => g.label),
        datasets: [
          { label: 'Male', data: male.map(v => -v), ...shape, backgroundColor: withAlpha(c.male, 0.88), hoverBackgroundColor: c.male },
          { label: 'Female', data: female, ...shape, backgroundColor: withAlpha(c.female, 0.88), hoverBackgroundColor: c.female },
        ],
      },
      options: {
        indexAxis: 'y', responsive: true, maintainAspectRatio: false,
        animation: reduceMotion ? false : { duration: 500 },
        layout: { padding: { left: 4, right: 30 } },
        scales: {
          x: {
            stacked: true, suggestedMin: -max, suggestedMax: max,
            ticks: { precision: 0, color: c.text3, font: { size: 11.5 }, maxTicksLimit: 9, callback: v => Math.abs(v) },
            grid: { color: c.grid, drawTicks: false }, border: { display: false },
            title: { display: true, text: '← Male    Female →', color: c.text3, font: { size: 12 } },
          },
          y: { stacked: true, grid: { display: false }, border: { display: false }, ticks: { color: c.text2, font: { size: 12.5 } } },
        },
        plugins: {
          legend: { display: false },
          tooltip: tooltip(c, {
            displayColors: true, usePointStyle: true, boxWidth: 8, boxHeight: 8, boxPadding: 4,
            callbacks: { title: items => `Age ${items[0].label}`, label: ctx => ` ${Math.abs(ctx.raw)} ${ctx.dataset.label.toLowerCase()}` },
          }),
          valueLabels: { color: c.text2 },
          centreGap: { color: c.surface },
        },
      },
      plugins: [valueLabels, centreGap],
    });
    table('table-age', ['Age group', 'Male', 'Female'], groups.map((g, i) => [g.label, male[i], female[i]]).reverse());
    const missing = [];
    if (unknownAge) missing.push(`${unknownAge} without date of birth`);
    if (otherGender) missing.push(`${otherGender} with gender "other" or not recorded`);
    note('note-age', missing.length ? `Not shown: ${missing.join(', ')}.` : '');
  }

  function renderGender(people) {
    const c = palette();
    const groups = [
      { key: 'male', label: 'Male', color: c.male },
      { key: 'female', label: 'Female', color: c.female },
      { key: 'other', label: 'Other', color: c.other },
    ].map(g => ({ ...g, count: people.filter(p => p.gender === g.key).length }))
      .filter(g => g.key !== 'other' || g.count);
    donutChart({
      id: 'chart-gender', legendId: 'legend-gender', centreLabel: 'members', unit: 'members',
      labels: groups.map(g => g.label), values: groups.map(g => g.count), colors: groups.map(g => g.color),
    });
    table('table-gender', ['Gender', 'Members'], groups.map(g => [g.label, g.count]));
    const notSet = people.length - groups.reduce((s, g) => s + g.count, 0);
    note('note-gender', notSet ? `${notSet} without gender recorded.` : '');
  }

  function renderMarital(people) {
    const c = palette();
    const adults = people.filter(p => p.age === null || p.age >= 18);
    const values = Utils.MARITAL.map(label => adults.filter(p => p.marital_status === label).length);
    // Each status keeps its own colour; statuses with nobody in them are left out of the ring.
    const shown = Utils.MARITAL.map((label, i) => ({ label, value: values[i], color: c.marital[i] })).filter(r => r.value);
    donutChart({
      id: 'chart-marital', legendId: 'legend-marital', centreLabel: 'adults', unit: 'adults',
      labels: shown.map(r => r.label), values: shown.map(r => r.value), colors: shown.map(r => r.color),
    });
    table('table-marital', ['Marital status', 'Adults'], Utils.MARITAL.map((m, i) => [m, values[i]]));
    const missing = adults.filter(p => !p.marital_status).length;
    note('note-marital', missing ? `${missing} not recorded.` : '');
  }

  function familySizeList(fams, people) {
    const counts = new Map(fams.map(f => [f.id, 0]));
    people.forEach(p => counts.set(p.family_id, (counts.get(p.family_id) || 0) + 1));
    return [...counts.values()];
  }

  function renderFamilySizes(fams, people) {
    const sizes = familySizeList(fams, people);
    const largest = sizes.length ? Math.max(...sizes) : 0;
    const top = Math.max(5, Math.min(8, largest));
    const labels = [];
    const values = [];
    for (let n = 1; n <= top; n++) {
      const last = n === 8 && largest > 8;
      labels.push(last ? '8+' : String(n));
      values.push(sizes.filter(s => (last ? s >= 8 : s === n)).length);
    }
    barChart({ id: 'chart-size', labels, values, color: palette().violet, unit: 'families', xTitle: 'Members in the family' });
    table('table-size', ['Members in family', 'Families'], labels.map((l, i) => [l, values[i]]));
    const empty = sizes.filter(s => s === 0).length;
    note('note-size', empty ? `${empty} ${empty === 1 ? 'family has' : 'families have'} no members yet.` : '');
  }

  function renderBloodGroups(people) {
    const values = Utils.BLOOD_GROUPS.map(g => people.filter(p => p.blood_group === g).length);
    barChart({ id: 'chart-blood', labels: Utils.BLOOD_GROUPS, values, color: palette().red, unit: 'members' });
    table('table-blood', ['Blood group', 'Members'], Utils.BLOOD_GROUPS.map((g, i) => [g, values[i]]));
    const unknown = people.length - values.reduce((s, v) => s + v, 0);
    note('note-blood', unknown ? `${unknown} ${unknown === 1 ? 'member does' : 'members do'} not know their blood group.` : '');
  }

  function renderEducation(people) {
    const group = people.filter(p => p.age === null || p.age >= 6);
    const order = [...Utils.EDUCATION, ...new Set(group.map(p => p.education).filter(e => e && !Utils.EDUCATION.includes(e)))];
    const rows = order.map(label => ({ label, value: group.filter(p => p.education === label).length })).filter(r => r.value);
    barChart({ id: 'chart-education', labels: rows.map(r => r.label), values: rows.map(r => r.value), color: palette().blue, horizontal: true, unit: 'members' });
    table('table-education', ['Education', 'Members'], rows.map(r => [r.label, r.value]));
    const missing = group.filter(p => !p.education).length;
    note('note-education', missing ? `${missing} not recorded.` : '');
  }

  function renderOccupation(people) {
    const adults = people.filter(p => p.age === null || p.age >= 18);
    const counts = new Map();
    adults.forEach(p => { if (p.occupation) counts.set(p.occupation, (counts.get(p.occupation) || 0) + 1); });
    let rows = [...counts].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value || a.label.localeCompare(b.label));
    if (rows.length > 9) { // fold the long tail into "Other"
      const keep = rows.filter(r => r.label !== 'Other').slice(0, 8);
      const kept = new Set(keep.map(r => r.label));
      rows = [...keep, { label: 'Other', value: rows.filter(r => !kept.has(r.label)).reduce((s, r) => s + r.value, 0) }];
    }
    barChart({ id: 'chart-occupation', labels: rows.map(r => r.label), values: rows.map(r => r.value), color: palette().orange, horizontal: true, unit: 'adults' });
    table('table-occupation', ['Occupation', 'Adults'], rows.map(r => [r.label, r.value]));
    const missing = adults.filter(p => !p.occupation).length;
    note('note-occupation', missing ? `${missing} not recorded.` : '');
  }

  function renderAreas() {
    const counts = new Map();
    families.forEach(f => { const a = f.area || 'No area'; counts.set(a, (counts.get(a) || 0) + 1); });
    const rows = [...counts].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value || a.label.localeCompare(b.label));
    barChart({
      id: 'chart-area', labels: rows.map(r => r.label), values: rows.map(r => r.value), color: palette().cyan, horizontal: true, unit: 'families',
      // With an area picked, that bar keeps its colour and the others turn grey.
      dim: area ? i => rows[i].label !== area : null,
      onClick: index => { const label = rows[index].label; if (label !== 'No area') setArea(label === area ? '' : label); },
    });
    table('table-area', ['Area', 'Families'], rows.map(r => [r.label, r.value]));
    note('note-area', area ? 'Click the highlighted bar again to show all areas.' : 'Click a bar to see that area only.');
  }

  function renderRecent(fams, people) {
    const counts = new Map();
    people.forEach(p => counts.set(p.family_id, (counts.get(p.family_id) || 0) + 1));
    const recent = [...fams].sort((a, b) => (b.created_at || '').localeCompare(a.created_at || '')).slice(0, 5);
    document.getElementById('recent-body').innerHTML = recent.length ? `
      <ul class="recent-list">${recent.map(f => `
        <li>
          <a href="family.html?id=${encodeURIComponent(f.id)}">
            <span class="avatar">${esc(Utils.initials(f.head_name))}</span>
            <span class="recent-text"><strong>${esc(f.head_name)}</strong><small>${esc([f.family_code, f.area].filter(Boolean).join(' · '))}</small></span>
            <span class="recent-meta"><span class="count-pill" title="Members">${UI.icon('users')}${counts.get(f.id) || 0}</span><small>${esc(Utils.formatDate(f.created_at))}</small></span>
          </a>
        </li>`).join('')}</ul>`
      : '<p class="chart-empty">No families yet.</p>';
  }

  return { init };
})();
