/*
 * Family tree. Works out who is linked to whom (the form's father / mother and
 * husband / wife fields first, then sensible guesses from the relation), puts each
 * generation on its own row, and draws it with vis-network.
 */
const FamilyTree = (() => {
  const esc = Utils.escapeHtml;
  // Generation relative to the head of family: parents -1, children +1, ...
  const GENERATION = {
    Grandfather: -2, Grandmother: -2,
    Father: -1, Mother: -1, 'Father-in-law': -1, 'Mother-in-law': -1, Uncle: -1, Aunt: -1,
    Self: 0, Wife: 0, Husband: 0, Brother: 0, Sister: 0, 'Brother-in-law': 0, 'Sister-in-law': 0, Cousin: 0,
    Son: 1, Daughter: 1, 'Daughter-in-law': 1, 'Son-in-law': 1, Nephew: 1, Niece: 1,
    Grandson: 2, Granddaughter: 2,
  };
  const generationOf = relation => (Object.prototype.hasOwnProperty.call(GENERATION, relation) ? GENERATION[relation] : null);
  const NODE_W = 172;
  const COUPLE_GAP = 48;
  const SIBLING_GAP = 32;
  const ROOT_GAP = 80;
  const ROW_H = 150;
  let network = null;

  // ---------- Who is linked to whom ----------
  function links(members) {
    const byId = new Map(members.map(m => [m.id, m]));
    const parentOf = new Map(); // child id -> parent id
    const spouses = [];         // [id, id]
    const seen = new Set();
    const addSpouse = (a, b) => {
      if (!a || !b || a === b) return;
      const key = a < b ? `${a}|${b}` : `${b}|${a}`;
      if (!seen.has(key)) { seen.add(key); spouses.push([a, b]); }
    };
    const hasSpouse = id => spouses.some(p => p[0] === id || p[1] === id);

    for (const m of members) {
      if (m.parent_id && m.parent_id !== m.id && byId.has(m.parent_id)) parentOf.set(m.id, m.parent_id);
      if (m.spouse_id && byId.has(m.spouse_id)) addSpouse(m.id, m.spouse_id);
    }

    // Guesses from the relation, used only where the form's links were left empty.
    const head = members.find(m => m.relation === 'Self');
    if (head) {
      const all = relation => members.filter(m => m.relation === relation);
      const first = relation => members.find(m => m.relation === relation);
      const pair = (a, b) => { if (a && b && !hasSpouse(a.id) && !hasSpouse(b.id)) addSpouse(a.id, b.id); };
      const setParent = (child, parent) => {
        if (child && parent && child !== parent && !parentOf.has(child.id)) parentOf.set(child.id, parent.id);
      };

      [...all('Wife'), ...all('Husband')].forEach(s => { if (!hasSpouse(s.id)) addSpouse(head.id, s.id); });
      const father = first('Father');
      const mother = first('Mother');
      pair(father, mother);
      setParent(head, father || mother);
      pair(first('Grandfather'), first('Grandmother'));
      setParent(father || mother, first('Grandfather') || first('Grandmother'));
      pair(first('Father-in-law'), first('Mother-in-law'));

      const sons = all('Son');
      const daughters = all('Daughter');
      [...sons, ...daughters].forEach(c => setParent(c, head));
      const headParent = parentOf.has(head.id) ? byId.get(parentOf.get(head.id)) : null;
      const siblings = [...all('Brother'), ...all('Sister')];
      siblings.forEach(s => setParent(s, headParent));

      // A daughter-in-law is paired with the only unmarried son (same for a son-in-law).
      const unmarried = list => list.filter(x => !hasSpouse(x.id));
      all('Daughter-in-law').forEach(d => { const s = unmarried(sons); if (!hasSpouse(d.id) && s.length === 1) addSpouse(s[0].id, d.id); });
      all('Son-in-law').forEach(h => { const d = unmarried(daughters); if (!hasSpouse(h.id) && d.length === 1) addSpouse(d[0].id, h.id); });

      // Grandchildren go under the only married child (or the only child).
      const children = [...sons, ...daughters];
      const married = children.filter(c => hasSpouse(c.id));
      const grandParent = married.length === 1 ? married[0] : children.length === 1 ? children[0] : null;
      [...all('Grandson'), ...all('Granddaughter')].forEach(g => setParent(g, grandParent));
      [...all('Nephew'), ...all('Niece')].forEach(n => setParent(n, siblings.length === 1 ? siblings[0] : null));
    }

    const spousesOf = id => spouses.filter(p => p[0] === id || p[1] === id).map(p => (p[0] === id ? p[1] : p[0]));
    return { byId, head, parentOf, spouses, spousesOf };
  }

  // ---------- Generation (row) of each person ----------
  function generations(members, { byId, parentOf, spousesOf }) {
    const level = new Map();
    const visiting = new Set();
    const get = id => {
      if (level.has(id)) return level.get(id);
      const m = byId.get(id);
      if (visiting.has(id)) return generationOf(m.relation) ?? 0; // a loop in the data
      visiting.add(id);
      let value;
      if (parentOf.has(id)) value = get(parentOf.get(id)) + 1;
      else {
        const partners = spousesOf(id);
        const blood = partners.find(s => parentOf.has(s));
        if (blood) value = get(blood); // in-laws sit on the same row as their husband / wife
        else if (generationOf(m.relation) !== null) value = generationOf(m.relation);
        else value = partners.length ? get(partners[0]) : 0;
      }
      visiting.delete(id);
      level.set(id, value);
      return value;
    };
    members.forEach(m => get(m.id));
    return level;
  }

  // ---------- Layout ----------
  function arrange(unit, spousesOf) {
    const list = unit.members;
    if (list.length === 2) {
      list.sort((a, b) => (a.gender === 'female') - (b.gender === 'female'));
    } else if (list.length > 2) {
      // Someone with more than one husband / wife goes in the middle.
      const hub = list.reduce((best, x) => (spousesOf(x.id).length > spousesOf(best.id).length ? x : best), list[0]);
      const rest = list.filter(x => x !== hub);
      const half = Math.floor(rest.length / 2);
      unit.members = [...rest.slice(0, half), hub, ...rest.slice(half)];
    }
  }

  function layout(members, rel, level) {
    const { byId, head, parentOf, spousesOf } = rel;

    // 1. A person and their husband / wife form one "unit", drawn side by side.
    const unitOf = new Map();
    const units = [];
    for (const m of members) {
      if (unitOf.has(m.id)) continue;
      const unit = { members: [], children: [], parent: null, via: null };
      const queue = [m.id];
      while (queue.length) {
        const id = queue.shift();
        if (unitOf.has(id)) continue;
        unitOf.set(id, unit);
        unit.members.push(byId.get(id));
        queue.push(...spousesOf(id).filter(s => !unitOf.has(s)));
      }
      arrange(unit, spousesOf);
      const anchor = unit.members.find(x => parentOf.has(x.id)) || unit.members[0];
      unit.level = level.get(anchor.id);
      units.push(unit);
    }

    // 2. Hang each unit under its parents' unit.
    const isAncestor = (unit, other) => { for (let u = other; u; u = u.parent) if (u === unit) return true; return false; };
    for (const unit of units) {
      const child = unit.members.find(x => parentOf.has(x.id));
      if (!child) continue;
      const parentUnit = unitOf.get(parentOf.get(child.id));
      if (!parentUnit || parentUnit === unit || isAncestor(unit, parentUnit)) continue;
      unit.parent = parentUnit;
      unit.via = child;
      parentUnit.children.push(unit);
    }
    const born = u => u.via?.dob || '9999';
    units.forEach(u => u.children.sort((a, b) => born(a).localeCompare(born(b))));

    // 3. Measure, then place: children centred under their parents, eldest on the left.
    const unitWidth = u => u.members.length * NODE_W + (u.members.length - 1) * COUPLE_GAP;
    const width = new Map();
    const measure = u => {
      const kids = u.children.reduce((sum, c, i) => sum + measure(c) + (i ? SIBLING_GAP : 0), 0);
      const w = Math.max(unitWidth(u), kids);
      width.set(u, w);
      return w;
    };
    const positions = new Map();
    const place = (u, left) => {
      const centre = left + width.get(u) / 2;
      const start = centre - unitWidth(u) / 2 + NODE_W / 2;
      u.members.forEach((m, i) => positions.set(m.id, { x: start + i * (NODE_W + COUPLE_GAP), y: u.level * ROW_H }));
      const kids = u.children.reduce((sum, c, i) => sum + width.get(c) + (i ? SIBLING_GAP : 0), 0);
      let x = centre - kids / 2;
      for (const c of u.children) { place(c, x); x += width.get(c) + SIBLING_GAP; }
    };
    const rootOf = u => { while (u.parent) u = u.parent; return u; };
    const mainRoot = head ? rootOf(unitOf.get(head.id)) : null;
    const roots = units.filter(u => !u.parent).sort((a, b) => (b === mainRoot) - (a === mainRoot) || a.level - b.level);
    let cursor = 0;
    for (const r of roots) { measure(r); place(r, cursor); cursor += width.get(r) + ROOT_GAP; }
    return { units, unitOf, positions };
  }

  // ---------- Nodes & edges ----------
  function colors() {
    const v = UI.cssVar;
    return {
      font: getComputedStyle(document.body).fontFamily,
      text: v('--text'), text2: v('--text-2'), text3: v('--text-3'), surface: v('--surface'),
      male: [v('--tree-male-bg'), v('--tree-male-border')],
      female: [v('--tree-female-bg'), v('--tree-female-border')],
      other: [v('--tree-other-bg'), v('--tree-other-border')],
      unknown: [v('--tree-unknown-bg'), v('--tree-unknown-border')],
      line: v('--tree-line'), spouse: v('--tree-spouse'), muted: v('--tree-muted'),
    };
  }

  const plain = s => String(s || '').replace(/[*_`$]/g, '');

  function nodeFor(m, pos, c) {
    const [bg, border] = c[m.gender] || c.unknown;
    const facts = [Utils.relationLabel(m.relation) || 'Relation not set', Utils.ageText(m.dob)].filter(Boolean).join(' · ');
    const tip = document.createElement('div');
    tip.className = 'tree-tip';
    tip.innerHTML = `<strong>${esc(m.full_name)}</strong><span>${esc([Utils.relationLabel(m.relation), Utils.GENDER_LABELS[m.gender], Utils.ageText(m.dob)].filter(Boolean).join(' · '))}</span>${m.occupation ? `<span>${esc(m.occupation)}</span>` : ''}`;
    return {
      id: m.id, x: pos.x, y: pos.y, title: tip,
      label: `*${plain(m.full_name)}*\n${plain(facts)}`,
      shape: 'box',
      color: { background: bg, border, highlight: { background: bg, border }, hover: { background: bg, border } },
      borderWidth: m.relation === 'Self' ? 3 : 1.5,
      borderWidthSelected: 3.5,
      margin: { top: 10, right: 12, bottom: 10, left: 12 },
      widthConstraint: { minimum: NODE_W, maximum: NODE_W },
      shapeProperties: { borderRadius: 8 },
      font: { face: c.font, size: 12.5, color: c.text3, multi: 'md', bold: { face: c.font, size: 14, color: c.text, mod: 'bold' } },
    };
  }

  const lineColor = color => ({ color, hover: color, highlight: color });
  const spouseEdge = (from, to, c) => ({ from, to, color: lineColor(c.spouse), width: 2.5, smooth: { enabled: false }, chosen: false });
  const parentEdge = (from, to, c) => ({
    from, to, color: lineColor(c.line), width: 1.5, chosen: false,
    smooth: { enabled: true, type: 'cubicBezier', forceDirection: 'vertical', roundness: 0.5 },
  });
  const relationEdge = (from, m, c) => ({
    from, to: m.id, color: lineColor(c.muted), width: 1, dashes: [4, 5], chosen: false,
    label: Utils.relationLabel(m.relation) || 'Relative',
    font: { face: c.font, size: 11, color: c.text3, strokeWidth: 4, strokeColor: c.surface },
    smooth: { enabled: true, type: 'curvedCW', roundness: 0.12 },
  });

  function build(members, c = colors()) {
    const sorted = Members.sort(members);
    const rel = links(sorted);
    const level = generations(sorted, rel);
    const { units, unitOf, positions } = layout(sorted, rel, level);
    const nodes = sorted.map(m => nodeFor(m, positions.get(m.id), c));
    const edges = [];

    // A couple with children gets a small dot between them; the children's lines start from it.
    const parents = new Set(rel.parentOf.values());
    const junction = new Map();
    for (const u of units) {
      if (u.members.length !== 2 || !u.members.some(m => parents.has(m.id))) continue;
      const [a, b] = u.members;
      const pa = positions.get(a.id);
      const pb = positions.get(b.id);
      const id = `j:${a.id}`;
      nodes.push({ id, x: (pa.x + pb.x) / 2, y: pa.y, shape: 'dot', size: 4, borderWidth: 0, chosen: false, color: { background: c.spouse, border: c.spouse } });
      junction.set(u, id);
      edges.push(spouseEdge(a.id, id, c), spouseEdge(id, b.id, c));
    }
    for (const [a, b] of rel.spouses) {
      const u = unitOf.get(a);
      if (!(junction.has(u) && u === unitOf.get(b))) edges.push(spouseEdge(a, b, c));
    }
    for (const [child, parent] of rel.parentOf) {
      const parentUnit = unitOf.get(parent);
      if (parentUnit !== unitOf.get(child)) edges.push(parentEdge(junction.get(parentUnit) || parent, child, c));
    }
    // Anyone still not connected gets a dotted line to the head, labelled with the relation.
    const linked = new Set(edges.flatMap(e => [e.from, e.to]));
    if (rel.head) {
      for (const m of sorted) if (m !== rel.head && !linked.has(m.id)) edges.push(relationEdge(rel.head.id, m, c));
    }
    return { nodes, edges };
  }

  // ---------- Drawing ----------
  function destroy() {
    if (network) { network.destroy(); network = null; }
  }

  function render(container, members, { onSelect } = {}) {
    destroy();
    container.innerHTML = '';
    const { nodes, edges } = build(members);
    network = new vis.Network(container, { nodes, edges }, {
      autoResize: true,
      physics: { enabled: false },
      layout: { hierarchical: { enabled: false }, improvedLayout: false },
      interaction: { dragNodes: false, hover: true, tooltipDelay: 120, zoomSpeed: 0.7, selectConnectedEdges: false, hoverConnectedEdges: false },
    });
    network.once('afterDrawing', () => network.fit({ animation: false }));
    network.on('zoom', ({ scale }) => {
      if (scale < 0.2 || scale > 2.5) network.moveTo({ scale: Math.min(2.5, Math.max(0.2, scale)) });
    });
    network.on('click', params => {
      const id = params.nodes[0];
      onSelect?.(id && !String(id).startsWith('j:') ? id : null);
    });
    network.on('hoverNode', p => { container.style.cursor = String(p.node).startsWith('j:') ? '' : 'pointer'; });
    network.on('blurNode', () => { container.style.cursor = ''; });
    return network;
  }

  function fit() {
    network?.fit({ animation: { duration: 350, easingFunction: 'easeInOutQuad' } });
  }

  function select(id) {
    if (!network) return;
    network.selectNodes(id ? [id] : []);
  }

  /** Save the whole tree as a PNG (with a solid background, so it reads well on WhatsApp). */
  function downloadImage(filename) {
    if (!network) return;
    network.once('afterDrawing', () => {
      const canvas = network.canvas.frame.canvas;
      const out = document.createElement('canvas');
      out.width = canvas.width;
      out.height = canvas.height;
      const ctx = out.getContext('2d');
      ctx.fillStyle = UI.cssVar('--surface');
      ctx.fillRect(0, 0, out.width, out.height);
      ctx.drawImage(canvas, 0, 0);
      out.toBlob(blob => {
        const url = URL.createObjectURL(blob);
        const a = Object.assign(document.createElement('a'), { href: url, download: filename });
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      });
    });
    network.fit({ animation: false });
    network.redraw();
  }

  return { render, fit, select, destroy, downloadImage, build };
})();
