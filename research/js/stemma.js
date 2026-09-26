/*
 * stemma.js - the family tree of the Spacewar! texts, drawn as a textual
 * scholar's stemma: each version under the version it was made from,
 * other readings of the same version (witnesses) beside it, lost versions
 * dashed where the record places them, grafts and influences dotted.
 * Descent edges carry the routine similarity of child to parent.
 */
(function (root) {
  'use strict';
  var SW = root.SW, V = root.SWVersions, G = root.SWGenealogy;

  // Where the lost versions sit, from their catalogue summaries: 2A is the
  // March 1962 integration stage before 2B; 4.5 to 4.7 fall between the 4.4
  // experiment and the stable 4.8. Placement, not parentage.
  var LOST_BETWEEN = { '2a': ['1', '2b'], '4.5': ['4.4', '4.8'] };

  function short(v) { return v.label.replace(/^Spacewar! /, ''); }
  function hasTape(v) {
    return !!((v.witnesses || []).length || (v.sourceTapes || []).length || (v.build || []).some(function (b) { return b && b.tape; }));
  }

  // ---------- layout ----------
  function layout() {
    var vs = V.VERSIONS.filter(function (v) { return v.id !== 'stars'; });
    var main = vs.filter(function (v) { return !v.witnessOf && v.status !== 'lost' && (v.parent || v.id === '1'); });
    var byId = {}, kids = {};
    main.forEach(function (v) { byId[v.id] = v; kids[v.id] = []; });
    main.forEach(function (v) { if (v.parent && kids[v.parent]) kids[v.parent].push(v); });
    Object.keys(kids).forEach(function (k) { kids[k].sort(function (a, b) { return a.sort - b.sort; }); });
    var SLOT = 212, ROW = 96, pos = {}, next = 0;
    (function place(v, depth) {
      var cs = kids[v.id];
      cs.forEach(function (c) { place(c, depth + 1); });
      var x = cs.length ? (pos[cs[0].id].x + pos[cs[cs.length - 1].id].x) / 2 : (next++) * SLOT;
      pos[v.id] = { x: x, y: depth * ROW, v: v, depth: depth };
    })(byId['1'], 0);
    // lost versions: half-way between the two they sit between, set off to one side
    var lost = vs.filter(function (v) { return v.status === 'lost' && LOST_BETWEEN[v.id]; }).map(function (v) {
      var a = pos[LOST_BETWEEN[v.id][0]], b = pos[LOST_BETWEEN[v.id][1]];
      if (!a || !b) return null;
      var y = (a.y + b.y) / 2, lo = Math.min(a.x, b.x), hi = Math.max(a.x, b.x);
      // the first free place: between them, beyond the right one, beyond the left one
      var cands = [(lo + hi) / 2, hi + SLOT * 0.75, lo - SLOT * 0.75, hi + SLOT * 1.5];
      var x = cands.filter(function (cx) {
        return !Object.keys(pos).some(function (k) { return Math.abs(pos[k].x - cx) < SLOT * 0.85 && Math.abs(pos[k].y - y) < ROW * 0.75; });
      })[0];
      if (x == null) x = hi + SLOT * 2;
      var p = { x: x, y: y, v: v, lost: true, between: LOST_BETWEEN[v.id] };
      pos[v.id] = p;
      return p;
    }).filter(Boolean);
    var wit = {};
    vs.forEach(function (v) { if (v.witnessOf && pos[v.witnessOf]) (wit[v.witnessOf] = wit[v.witnessOf] || []).push(v); });
    return { pos: pos, main: main, lost: lost, wit: wit, SLOT: SLOT, ROW: ROW };
  }

  // ---------- similarity of each child to its parent (by routine) ----------
  var simCache = {};
  function similarities(L, gran) {
    var pairs = L.main.filter(function (v) { return v.parent; }).map(function (v) { return [v.parent, v.id]; });
    L.main.forEach(function (v) { (v.also || []).forEach(function (a) { pairs.push([a, v.id]); }); });
    var need = pairs.filter(function (p) { return !((p.join('>') + ':' + gran) in simCache); });
    var ids = {};
    need.forEach(function (p) { ids[p[0]] = 1; ids[p[1]] = 1; });
    return Promise.all(Object.keys(ids).map(function (id) {
      return SW.build(id).then(function (b) { return [id, G.prepare(id, short(b.v), b.v.sort, b.parts, { includeSupplied: false })]; }).catch(function () { return [id, null]; });
    })).then(function (list) {
      var t = {};
      list.forEach(function (x) { t[x[0]] = x[1]; });
      need.forEach(function (p) {
        var a = t[p[0]], b = t[p[1]], k = p.join('>') + ':' + gran;
        if (!a || !b || !a.lines.length || !b.lines.length) { simCache[k] = null; return; }
        try { simCache[k] = G.flows([a, b], { granularity: gran }).steps[0].summary.similarity; } catch (e) { simCache[k] = null; }
      });
      var out = {};
      pairs.forEach(function (p) { out[p.join('>')] = simCache[p.join('>') + ':' + gran]; });
      return out;
    });
  }

  // ---------- drawing ----------
  var W_BOX = 132, H_BOX = 46;
  function svg(L, sims, opts) {
    opts = opts || {};
    var xs = Object.keys(L.pos).map(function (k) { return L.pos[k].x; });
    var ys = Object.keys(L.pos).map(function (k) { return L.pos[k].y; });
    var minX = Math.min.apply(null, xs), maxX = Math.max.apply(null, xs), maxY = Math.max.apply(null, ys);
    var padX = 30 + W_BOX / 2, top = 58, W = maxX - minX + 2 * padX, H = maxY + top + H_BOX + 110;
    function X(p) { return p.x - minX + padX; }
    function Y(p) { return p.y + top; }
    var lit = opts.lit || {};
    var o = ['<svg xmlns="http://www.w3.org/2000/svg" width="' + W.toFixed(0) + '" height="' + H.toFixed(0) + '" viewBox="0 0 ' + W.toFixed(0) + ' ' + H.toFixed(0) + '" font-family="ui-monospace, Menlo, Consolas, monospace">',
             '<title>Stemma of the Spacewar! texts</title>',
             '<text x="16" y="24" font-size="14" fill="var(--g-text)">Spacewar!: a stemma of the texts</text>',
             '<text x="16" y="42" font-size="10" fill="var(--g-muted)">Each version under the one it was made from; percentages are routine similarity to the parent' + (opts.gran && opts.gran !== 'routine' ? ' (by ' + opts.gran + ')' : '') + '.</text>'];
    function edge(a, b, kind, label, key) {
      var x1 = X(a), y1 = Y(a) + H_BOX, x2 = X(b), y2 = Y(b), my = (y1 + y2) / 2;
      if (kind !== 'descent') { y1 = Y(a) + H_BOX / 2; x1 += (x2 > x1 ? W_BOX / 2 : -W_BOX / 2); y2 = Y(b) + H_BOX / 2; x2 += (x1 > x2 ? W_BOX / 2 : -W_BOX / 2); my = (y1 + y2) / 2; }
      var st = { descent: 'stroke="var(--g-line)" stroke-width="2"', graft: 'stroke="var(--g-edited)" stroke-width="1.6" stroke-dasharray="7 4"',
                 influence: 'stroke="var(--g-moved)" stroke-width="1.4" stroke-dasharray="2 4"', lost: 'stroke="var(--g-muted)" stroke-width="1.4" stroke-dasharray="5 4"' }[kind];
      var d = kind === 'descent' ? 'M' + x1 + ' ' + y1 + ' C' + x1 + ' ' + my + ' ' + x2 + ' ' + my + ' ' + x2 + ' ' + y2
                                 : 'M' + x1 + ' ' + y1 + ' L' + x2 + ' ' + y2;
      o.push('<path class="st-edge' + (lit[key] ? ' lit' : '') + '" data-k="' + key + '" d="' + d + '" fill="none" ' + st + '/>');
      if (label) {
        // descent labels sit just above the child, clear of the witness tags under the parent
        var lx = (x1 + x2) / 2, ly = kind === 'descent' ? y2 - 10 : (y1 + y2) / 2 + 4;
        if (kind === 'descent') lx = x2;
        o.push('<text x="' + (lx + 5).toFixed(1) + '" y="' + ly.toFixed(1) + '" font-size="10" fill="var(--g-muted)">' + SW.esc(label) + '</text>');
      }
    }
    // descent and grafts
    L.main.forEach(function (v) {
      if (v.parent && L.pos[v.parent]) {
        var s = sims[v.parent + '>' + v.id];
        edge(L.pos[v.parent], L.pos[v.id], 'descent', s == null ? '' : Math.round(s * 100) + '%', v.parent + '>' + v.id);
      }
      (v.also || []).forEach(function (a) {
        if (!L.pos[a]) return;
        var s = sims[a + '>' + v.id];
        edge(L.pos[a], L.pos[v.id], 'graft', 'graft' + (s == null ? '' : ' ' + Math.round(s * 100) + '%'), a + '>' + v.id);
      });
      (v.influence || []).forEach(function (a) {
        if (!L.pos[a] || L.lost.some(function (p) { return p.between[0] === a && p.between[1] === v.id; })) return;
        edge(L.pos[a], L.pos[v.id], 'influence', 'influence', a + '>' + v.id);
      });
    });
    L.lost.forEach(function (p) {
      edge(L.pos[p.between[0]], p, 'lost', '', p.between[0] + '>' + p.v.id);
      edge(p, L.pos[p.between[1]], p.v.id === '4.5' ? 'influence' : 'lost', p.v.id === '4.5' ? 'influence?' : '', p.v.id + '>' + p.between[1]);
    });
    // nodes
    Object.keys(L.pos).forEach(function (id) {
      var p = L.pos[id], v = p.v, x = X(p) - W_BOX / 2, y = Y(p);
      var dash = v.status === 'lost' ? ' stroke-dasharray="4 3"' : v.status === 'reconstructed' ? ' stroke-dasharray="9 3"' : '';
      var fill = v.status === 'lost' ? 'none' : 'var(--g-box)';
      var stroke = lit[id] ? 'var(--amber, #ffce7a)' : v.status === 'lost' ? 'var(--g-muted)' : 'var(--g-stroke)';
      o.push('<g class="st-node" data-id="' + SW.esc(id) + '" style="cursor:pointer"><title>' + SW.esc(v.label + ' · ' + v.date + ' · ' + v.status + (v.medium ? ' · ' + v.medium : '') + '\n' + (v.summary || '')) + '</title>' +
        '<rect x="' + x + '" y="' + y + '" width="' + W_BOX + '" height="' + H_BOX + '" rx="5" fill="' + fill + '" stroke="' + stroke + '" stroke-width="' + (lit[id] ? 2.4 : 1.3) + '"' + dash + '/>' +
        '<text x="' + (x + 8) + '" y="' + (y + 18) + '" font-size="12" fill="var(--g-text)"' + (v.status === 'lost' ? ' font-style="italic"' : '') + '>' + SW.esc(trunc(short(v), 17)) + (hasTape(v) ? ' ▤' : '') + '</text>' +
        '<text x="' + (x + 8) + '" y="' + (y + 34) + '" font-size="9.5" fill="var(--g-muted)">' + SW.esc(trunc(v.date, 22)) + '</text></g>');
      // witnesses: other readings of this version, as tags under it
      var ws = L.wit[id] || [];
      ws.forEach(function (w, i) {
        // beside the box, clear of the descent line through its middle
        var tw = 62, tx = X(p) + W_BOX / 2 + 5, ty = y + 3 + i * 21;
        var par = /\(([^()]*)\)\s*$/.exec(short(w)), name = par ? par[1].split(',').pop().trim() : w.id;
        o.push('<g class="st-node" data-id="' + SW.esc(w.id) + '" style="cursor:pointer"><title>' + SW.esc(w.label + ': another reading of ' + short(v) + ' (' + (w.medium || w.status) + ')') + '</title>' +
          '<rect x="' + tx.toFixed(1) + '" y="' + ty + '" width="' + tw + '" height="15" rx="7" fill="none" stroke="' + (lit[w.id] ? 'var(--amber, #ffce7a)' : 'var(--g-stroke)') + '" stroke-dasharray="2 2"/>' +
          '<text x="' + (tx + tw / 2).toFixed(1) + '" y="' + (ty + 11) + '" font-size="8.5" text-anchor="middle" fill="var(--g-muted)">' + SW.esc(trunc(name, 12)) + (hasTape(w) ? ' ▤' : '') + '</text></g>');
      });
    });
    // key
    var ky = H - 40, kx = 16;
    [['descent', 'made from'], ['graft', 'grafted from'], ['influence', 'influence'], ['lost', 'placement of a lost version']].forEach(function (k) {
      var st = { descent: 'stroke="var(--g-line)" stroke-width="2"', graft: 'stroke="var(--g-edited)" stroke-width="1.6" stroke-dasharray="7 4"',
                 influence: 'stroke="var(--g-moved)" stroke-width="1.4" stroke-dasharray="2 4"', lost: 'stroke="var(--g-muted)" stroke-width="1.4" stroke-dasharray="5 4"' }[k[0]];
      o.push('<path d="M' + kx + ' ' + ky + ' h26" ' + st + '/><text x="' + (kx + 32) + '" y="' + (ky + 4) + '" font-size="10" fill="var(--g-text)">' + k[1] + '</text>');
      kx += 48 + k[1].length * 6.2;
    });
    ky += 20; kx = 16;
    [['', 'recovered source'], ['9 3', 'reconstructed'], ['4 3', 'lost']].forEach(function (k) {
      o.push('<rect x="' + kx + '" y="' + (ky - 9) + '" width="24" height="12" rx="3" fill="' + (k[1] === 'lost' ? 'none' : 'var(--g-box)') + '" stroke="var(--g-stroke)"' + (k[0] ? ' stroke-dasharray="' + k[0] + '"' : '') + '/>' +
        '<text x="' + (kx + 30) + '" y="' + (ky + 1) + '" font-size="10" fill="var(--g-text)">' + k[1] + '</text>');
      kx += 44 + k[1].length * 6.2;
    });
    o.push('<rect x="' + kx + '" y="' + (ky - 9) + '" width="30" height="12" rx="6" fill="none" stroke="var(--g-stroke)" stroke-dasharray="2 2"/><text x="' + (kx + 36) + '" y="' + (ky + 1) + '" font-size="10" fill="var(--g-text)">another reading (witness)   ▤ a real tape survives</text>');
    o.push('</svg>');
    return o.join('');
  }
  function trunc(s, n) { s = String(s || ''); return s.length > n ? s.slice(0, n - 1) + '…' : s; }

  // ---------- view ----------
  function render(body, exp, cur, opts) {
    opts = opts || {};
    var gran = opts.gran === 'line' ? 'routine' : (opts.gran || 'routine');
    var L = layout(), sims = {}, lit = {};
    var box = SW.el('div', { class: 'svgbox stemma', style: 'margin-top:6px;max-height:80vh' });
    var info = SW.el('div', { class: 'stemma-info hint' }, 'Click a version to light its line back to the first Spacewar!, and for what the record says of it. Click it again to clear.');
    body.appendChild(box);
    body.appendChild(info);
    function draw() { box.innerHTML = SW.displaySVG(svg(L, sims, { lit: lit, gran: gran })); }
    function light(id) {
      lit = {};
      if (!id) { draw(); return; }
      var v = V.byId(id), cur2 = v && (v.witnessOf || v.id);
      lit[id] = 1;
      if (v && v.witnessOf) lit[v.witnessOf] = 1;
      while (cur2) { lit[cur2] = 1; var p = V.byId(cur2); if (p && p.parent) lit[p.parent + '>' + cur2] = 1; cur2 = p && p.parent; }
      draw();
    }
    var picked = null;
    box.addEventListener('click', function (e) {
      var n = e.target.closest('.st-node');
      if (!n || n.dataset.id === picked) { picked = null; light(null); info.innerHTML = 'Click a version to light its line back to the first Spacewar!, and for what the record says of it. Click it again to clear.'; return; }
      picked = n.dataset.id;
      light(picked);
      var v = V.byId(picked), anc = V.ancestry(picked).map(function (id) { var x = V.byId(id); return x ? short(x) : id; });
      info.innerHTML = '<b>' + SW.esc(v.label) + '</b> · ' + SW.esc(v.date) + ' · ' + SW.esc(v.status) + (v.medium ? ' · ' + SW.esc(v.medium) : '') +
        '<br>' + SW.esc(v.summary || '') + (anc.length > 1 ? '<br><span class="mono">' + SW.esc(anc.join(' → ')) + '</span>' : '') +
        (v.build ? ' <button class="btn ghost" data-go="read">Read it</button> <button class="btn ghost" data-go="about">Version &amp; notes</button>' : ' <button class="btn ghost" data-go="about">Version &amp; notes</button>');
    });
    info.addEventListener('click', function (e) {
      var b = e.target.closest('[data-go]');
      if (!b || !picked) return;
      if (picked !== SW.state.v) SW.select(picked);
      SW.setTab(b.dataset.go);
    });
    draw();
    similarities(L, gran).then(function (s) { sims = s; draw(); });
    var fig = function () { return svg(L, sims, { gran: gran }); };
    exp.appendChild(SW.figureButtons(fig, 'spacewar-stemma'));
    exp.appendChild(SW.exportButtons(function () {
      var rows = [];
      L.main.forEach(function (v) {
        if (v.parent) rows.push([short(v), v.date, 'made from', short(V.byId(v.parent)), sims[v.parent + '>' + v.id] == null ? '' : Math.round(sims[v.parent + '>' + v.id] * 100) + '%']);
        (v.also || []).forEach(function (a) { rows.push([short(v), v.date, 'grafted from', short(V.byId(a)), sims[a + '>' + v.id] == null ? '' : Math.round(sims[a + '>' + v.id] * 100) + '%']); });
        (v.influence || []).forEach(function (a) { rows.push([short(v), v.date, 'influenced by', short(V.byId(a)), '']); });
      });
      Object.keys(L.wit).forEach(function (k) { L.wit[k].forEach(function (w) { rows.push([short(w), w.date, 'another reading of', short(V.byId(k)), '']); }); });
      L.lost.forEach(function (p) { rows.push([short(p.v), p.v.date, 'lost; placed between', short(V.byId(p.between[0])) + ' and ' + short(V.byId(p.between[1])), '']); });
      return SW.figures.svgToPNG(SW.exportSVG(fig()), 2, SW.figBgColour()).then(function (r) {
        return { title: 'Spacewar!: a stemma of the texts', meta: [['Generated', SW.fmtDate(SW.today()) + ', Spacewar! research bench v' + SW.VERSION]], blocks: [
          { type: 'figure', caption: 'Stemma of the Spacewar! texts. Percentages are routine similarity of each version to its parent.', png: r.png, width: r.width / 2, height: r.height / 2 },
          SW.tableBlock('Relations', ['Version', 'Date', 'Relation', 'To', 'Similarity'], rows)] };
      });
    }, 'spacewar-stemma'));
  }

  SW.stemma = { render: render, layout: layout, svg: svg };
})(this);
