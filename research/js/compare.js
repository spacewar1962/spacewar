/*
 * compare.js - Compare (two versions) and Genealogy (many versions).
 */
(function (root) {
  'use strict';
  var SW = root.SW, V = root.SWVersions, G = root.SWGenealogy;

  function buildable() { return V.VERSIONS.filter(function (v) { return v.build; }).sort(function (a, b) { return a.sort - b.sort; }); }
  function options(sel) {
    return buildable().map(function (v) {
      return '<option value="' + SW.esc(v.id) + '"' + (v.id === sel ? ' selected' : '') + '>' + SW.esc(v.label + ' · ' + v.date) + '</option>';
    }).join('');
  }
  function progLines(b, supplied) {
    var out = [];
    b.lines.forEach(function (ls, pi) {
      if (!supplied && b.parts[pi].role !== 'program') return;
      ls.forEach(function (L) { if (!L.skipped) out.push(L); });
    });
    return out;
  }
  // Resolve CSS custom properties so SVG figures stand alone.
  function resolveVars(svg) {
    var cs = getComputedStyle(document.documentElement);
    return svg.replace(/var\((--[\w-]+)\s*,\s*([^)]+)\)/g, function (m, name, fb) {
      var v = cs.getPropertyValue(name).trim();
      return v || fb.trim();
    }).replace(/var\((--[\w-]+)\)/g, function (m, name) { return cs.getPropertyValue(name).trim() || '#888'; });
  }
  SW.resolveVars = resolveVars;
  function svgActions(getSvg, name) {
    var w = SW.el('span');
    w.appendChild(SW.el('button', { class: 'btn', onclick: function () { root.SWExport.download(name + '.svg', resolveVars(getSvg()), 'image/svg+xml'); } }, '▣ SVG'));
    w.appendChild(document.createTextNode(' '));
    w.appendChild(SW.el('button', { class: 'btn', onclick: function () {
      SW.figures.svgToPNG(resolveVars(getSvg()), 3).then(function (r) { root.SWExport.download(name + '.png', r.png, 'image/png'); });
    } }, '▣ PNG'));
    return w;
  }

  // ======================= Compare =======================
  var cview = SW.$('#view-compare');
  var cst = { mode: 'text', noComments: false, ws: true, caseI: true, norm: true, supplied: false, fold: true };

  function keyOf(L) {
    var s = cst.norm ? L.norm : L.raw;
    if (cst.noComments) s = SW.parseLine(s).labels.map(function (l) { return l + ','; }).join('') + SW.parseLine(s).code;
    if (cst.ws) s = s.replace(/\s+/g, ' ').trim();
    if (cst.caseI) s = s.toLowerCase();
    return s;
  }

  function tokDiff(a, b) {
    var ta = a.match(/\s+|[^\s]+/g) || [], tb = b.match(/\s+|[^\s]+/g) || [];
    var ops = G.editScript(ta, tb);
    var ha = '', hb = '';
    ops.forEach(function (o) {
      if (o.op === 'same') { ha += SW.esc(ta[o.a]); hb += SW.esc(tb[o.b]); }
      else {
        if (o.a != null) ha += '<span class="rem">' + SW.esc(ta[o.a]) + '</span>';
        if (o.b != null) hb += '<span class="ins">' + SW.esc(tb[o.b]) + '</span>';
      }
    });
    return [ha, hb];
  }

  function textDiff(el, A, B) {
    var la = progLines(A, cst.supplied), lb = progLines(B, cst.supplied);
    var ops = G.editScript(la.map(keyOf), lb.map(keyOf));
    var st = { same: 0, change: 0, add: 0, del: 0 };
    ops.forEach(function (o) { st[o.op]++; });
    var head = SW.el('div', { class: 'pad', style: 'padding-bottom:4px' });
    head.innerHTML = '<div class="legend"><span><i style="background:var(--del-bg)"></i>only in ' + SW.esc(A.v.label) + ' (' + st.del + ')</span>' +
      '<span><i style="background:var(--add-bg)"></i>only in ' + SW.esc(B.v.label) + ' (' + st.add + ')</span>' +
      '<span><i style="background:var(--hl)"></i>changed (' + st.change + ')</span><span>unchanged ' + st.same + '</span>' +
      '<span>' + Math.round(200 * st.same / (la.length + lb.length || 1)) + '% of lines shared</span></div>';
    el.appendChild(head);
    var box = SW.el('div', { class: 'diff pad', style: 'padding-top:4px;max-width:none' });
    var html = [], i = 0, CTX = 3;
    function row(o) {
      var a = o.a != null ? la[o.a] : null, b = o.b != null ? lb[o.b] : null, cls = o.op === 'same' ? '' : o.op === 'add' ? 'add' : o.op === 'del' ? 'del' : 'chg';
      var ta = a ? SW.esc(a.raw) : '', tb = b ? SW.esc(b.raw) : '';
      if (o.op === 'change') { var d = tokDiff(a.raw, b.raw); ta = d[0]; tb = d[1]; }
      return '<div class="row">' +
        '<span class="n" data-v="a" data-p="' + (a ? a.p : '') + '" data-l="' + (a ? a.n : '') + '">' + (a ? a.n : '') + '</span><span class="' + (a ? cls : '') + '">' + ta + '</span>' +
        '<span class="n" data-v="b" data-p="' + (b ? b.p : '') + '" data-l="' + (b ? b.n : '') + '">' + (b ? b.n : '') + '</span><span class="' + (b ? cls : '') + '">' + tb + '</span></div>';
    }
    while (i < ops.length) {
      if (ops[i].op === 'same' && cst.fold) {
        var j = i; while (j < ops.length && ops[j].op === 'same') j++;
        var run = j - i;
        if (run > 2 * CTX + 2) {
          var s0 = i === 0 ? 0 : CTX, s1 = j === ops.length ? 0 : CTX;
          for (var k = i; k < i + s0; k++) html.push(row(ops[k]));
          html.push('<div class="fold" data-from="' + (i + s0) + '" data-to="' + (j - s1) + '">⋯ ' + (run - s0 - s1) + ' unchanged lines ⋯</div>');
          for (k = j - s1; k < j; k++) html.push(row(ops[k]));
          i = j;
          continue;
        }
      }
      html.push(row(ops[i])); i++;
    }
    box.innerHTML = html.join('');
    box.addEventListener('click', function (e) {
      var f = e.target.closest('.fold');
      if (f) {
        var h = []; for (var k = +f.dataset.from; k < +f.dataset.to; k++) h.push(row(ops[k]));
        f.insertAdjacentHTML('afterend', h.join('')); f.remove(); return;
      }
      var n = e.target.closest('.n');
      if (n && n.dataset.l) {
        var id = n.dataset.v === 'a' ? A.v.id : B.v.id;
        SW.state.sel = { p: +n.dataset.p, n0: +n.dataset.l, n1: +n.dataset.l };
        if (id !== SW.state.v) SW.select(id);
        SW.setTab('read');
      }
    });
    el.appendChild(box);
    return { ops: ops, la: la, lb: lb, st: st };
  }

  function textDoc(A, B, r) {
    var lines = [];
    r.ops.forEach(function (o) {
      if (o.op === 'same') return;
      if (o.a != null) lines.push({ n: r.la[o.a].n, text: r.la[o.a].raw, mark: 'del' });
      if (o.b != null) lines.push({ n: r.lb[o.b].n, text: r.lb[o.b].raw, mark: 'add' });
    });
    return { title: 'Spacewar! ' + A.v.label.replace('Spacewar! ', '') + ' against ' + B.v.label.replace('Spacewar! ', ''),
             subtitle: 'Differences in the program text', meta: [['From', A.v.label + ' (' + A.v.date + ')'], ['To', B.v.label + ' (' + B.v.date + ')'],
               ['Comparison', [cst.norm ? 'normalised text' : 'text as held', cst.noComments ? 'comments ignored' : 'comments compared', cst.ws ? 'spacing ignored' : '', cst.caseI ? 'case ignored' : ''].filter(Boolean).join('; ')],
               ['Summary', r.st.same + ' unchanged, ' + r.st.change + ' changed, ' + r.st.del + ' removed, ' + r.st.add + ' added lines']],
             blocks: [{ type: 'p', text: 'Removed lines (from ' + A.v.label + ') are struck through; added lines (in ' + B.v.label + ') are shaded green. Line numbers refer to each version\'s own source file.' },
                      { type: 'code', caption: 'Changed lines', lines: lines }] };
  }

  // The "interesting and often changed constants": labelled, fixed-location
  // lines such as "tno, 6, law i 41 / number of torps + 1".
  function constantsTable(b) {
    var out = {};
    progLines(b, false).forEach(function (L) {
      var m = /^\s*([a-z0-9]+),\s*([0-7]+),\s*([^\/]*?)\s*(\/.*)?$/i.exec(L.raw);
      if (m) out[m[1]] = { loc: m[2], val: m[3].replace(/\s+/g, ' '), cm: (m[4] || '').replace(/^\/\s*/, ''), L: L };
    });
    return out;
  }

  function symbolsDiff(el, A, B) {
    var ca = constantsTable(A), cb = constantsTable(B), names = {};
    Object.keys(ca).concat(Object.keys(cb)).forEach(function (k) { names[k] = 1; });
    var crow = Object.keys(names).sort(function (x, y) { return parseInt((ca[x] || cb[x]).loc, 8) - parseInt((ca[y] || cb[y]).loc, 8); }).map(function (k) {
      var a = ca[k], b = cb[k], st = !a ? 'added' : !b ? 'removed' : a.val !== b.val ? 'changed' : '';
      return [k, (a || b).loc, a ? a.val : '', b ? b.val : '', st, (b || a).cm];
    });
    var ma = A.macros || {}, mb = B.macros || {}, mn = {};
    Object.keys(ma).concat(Object.keys(mb)).forEach(function (k) { mn[k] = 1; });
    var mrow = Object.keys(mn).sort().map(function (k) {
      var a = ma[k], b = mb[k];
      var ka = a ? a.body.replace(/\s+/g, ' ').trim() : null, kb = b ? b.body.replace(/\s+/g, ' ').trim() : null;
      return [k, a ? a.args.join(', ') : '', b ? b.args.join(', ') : '', !a ? 'added' : !b ? 'removed' : ka !== kb ? 'body changed' : 'same'];
    });
    var sa = {}, sb = {};
    (A.asm ? A.asm.symbols : []).forEach(function (s) { if (s.defined && !s.label && !s.variable) sa[s.name] = s; });
    (B.asm ? B.asm.symbols : []).forEach(function (s) { if (s.defined && !s.label && !s.variable) sb[s.name] = s; });
    var sn = {}; Object.keys(sa).concat(Object.keys(sb)).forEach(function (k) { sn[k] = 1; });
    var srow = Object.keys(sn).sort().filter(function (k) { return !sa[k] || !sb[k] || sa[k].val !== sb[k].val; }).map(function (k) {
      return [k, sa[k] ? SW.oct(sa[k].val) : '', sb[k] ? SW.oct(sb[k].val) : '', !sa[k] ? 'added' : !sb[k] ? 'removed' : 'changed'];
    });
    var lab = function (s) { return (A.asm ? A.asm.symbols : []).filter(function (x) { return x.label; }).length; };
    void lab;
    var pad = SW.el('div', { class: 'pad' });
    pad.innerHTML = '<h3>The “interesting and often changed constants”</h3><p class="hint">The parameter block at the head of the program: the rules of the game made adjustable, and the place where versions most often differ by a single value.</p>';
    pad.appendChild(SW.table(['Symbol', 'Loc', A.v.label, B.v.label, 'Change', 'Comment'], crow, { cls: ['mono', 'mono', 'mono', 'mono', '', ''] }));
    pad.insertAdjacentHTML('beforeend', '<h3 style="margin-top:20px">Macros</h3>');
    pad.appendChild(SW.table(['Macro', 'Dummies in A', 'Dummies in B', 'Status'], mrow, { cls: ['mono', 'mono', 'mono', ''] }));
    pad.insertAdjacentHTML('beforeend', '<h3 style="margin-top:20px">Defined symbols that differ</h3><p class="hint">Symbols set with “=”, not labels or variables (whose addresses shift whenever code moves).</p>');
    pad.appendChild(SW.table(['Symbol', A.v.label, B.v.label, 'Status'], srow, { cls: ['mono', 'mono', 'mono', ''] }));
    el.appendChild(pad);
    return { crow: crow, mrow: mrow, srow: srow };
  }

  function routineDiff(el, A, B) {
    var ta = G.prepare(A.v.id, A.v.label, A.v.sort, A.parts, { includeSupplied: cst.supplied });
    var tb = G.prepare(B.v.id, B.v.label, B.v.sort, B.parts, { includeSupplied: cst.supplied });
    var c = G.compare(ta, tb, { granularity: 'routine', withComments: !cst.noComments });
    var s = c.summary;
    var pad = SW.el('div', { class: 'pad', style: 'max-width:none' });
    pad.innerHTML = '<div class="legend">' + ['retained', 'moved', 'edited', 'added', 'removed'].map(function (k) {
      return '<span><i style="background:var(--g-' + k + ')"></i>' + k + ' ' + s[k] + '</span>';
    }).join('') + '<span>overall similarity ' + Math.round(s.similarity * 100) + '%</span></div>';
    var svgBox = SW.el('div', { class: 'svgbox', style: 'margin:10px 0' });
    var svg = function () { return G.svgBlockMap(ta, tb, c, { title: A.v.label + ' → ' + B.v.label }); };
    svgBox.innerHTML = resolveVars(svg());
    var acts = SW.el('div', { class: 'toolbar', style: 'position:static;padding-left:0' });
    acts.appendChild(svgActions(svg, 'spacewar-' + A.v.id + '-' + B.v.id + '-blockmap'));
    pad.appendChild(acts);
    pad.appendChild(svgBox);
    var rows = c.pairs.map(function (p) {
      var ua = p.a != null ? c.unitsA[p.a] : null, ub = p.b != null ? c.unitsB[p.b] : null;
      return [ua ? ua.name : '', ua ? ua.n0 + '–' + ua.n1 : '', p.status, p.similarity != null ? Math.round(p.similarity * 100) : '', ub ? ub.name : '', ub ? ub.n0 + '–' + ub.n1 : ''];
    });
    pad.appendChild(SW.table([A.v.label, 'Lines', 'Status', 'Sim %', B.v.label, 'Lines'], rows, { cls: ['mono', 'mono', '', 'num', 'mono', 'mono'] }));
    el.appendChild(pad);
    return { c: c, rows: rows };
  }

  function renderCompare(A) {
    cview.innerHTML = '';
    var bid = SW.state.b && V.byId(SW.state.b) && V.byId(SW.state.b).build ? SW.state.b : defaultB(A.v.id);
    SW.state.b = bid;
    var tb = SW.el('div', { class: 'toolbar' });
    tb.innerHTML = '<b>' + SW.esc(A.v.label) + '</b> <span class="muted">against</span> <select id="cp-b">' + options(bid) + '</select><span class="sep"></span>' +
      ['text', 'constants', 'routines'].map(function (m) { return '<button class="btn' + (cst.mode === m ? ' on' : '') + '" data-m="' + m + '">' + { text: 'Text', constants: 'Constants & symbols', routines: 'Routines' }[m] + '</button>'; }).join('') +
      '<span class="sep"></span>' +
      '<label class="check"><input type="checkbox" data-o="noComments"' + (cst.noComments ? ' checked' : '') + '> ignore comments</label>' +
      '<label class="check"><input type="checkbox" data-o="norm"' + (cst.norm ? ' checked' : '') + '> normalised</label>' +
      '<label class="check"><input type="checkbox" data-o="supplied"' + (cst.supplied ? ' checked' : '') + '> supplied tapes</label>' +
      '<label class="check"><input type="checkbox" data-o="fold"' + (cst.fold ? ' checked' : '') + '> fold unchanged</label><span class="sep"></span><span id="cp-exp"></span>';
    cview.appendChild(tb);
    var body = SW.el('div');
    cview.appendChild(body);
    tb.addEventListener('change', function (e) {
      if (e.target.id === 'cp-b') { SW.state.b = e.target.value; SW.writeQuery(); }
      else if (e.target.dataset.o) cst[e.target.dataset.o] = e.target.checked;
      renderCompare(A);
    });
    tb.addEventListener('click', function (e) { var m = e.target.closest('[data-m]'); if (m) { cst.mode = m.dataset.m; renderCompare(A); } });
    body.innerHTML = '<p class="pad hint">Assembling ' + SW.esc(bid) + '…</p>';
    SW.build(bid).then(function (B) {
      body.innerHTML = '';
      var exp = SW.$('#cp-exp', tb), r;
      if (cst.mode === 'text') {
        r = textDiff(body, A, B);
        exp.appendChild(SW.exportButtons(function () { return textDoc(A, B, r); }, 'spacewar-' + A.v.id + '-vs-' + B.v.id));
      } else if (cst.mode === 'constants') {
        r = symbolsDiff(body, A, B);
        exp.appendChild(SW.exportButtons(function () {
          return { title: A.v.label + ' and ' + B.v.label + ': constants, macros, symbols', blocks: [
            SW.tableBlock('The interesting and often changed constants', ['Symbol', 'Loc', A.v.label, B.v.label, 'Change', 'Comment'], r.crow),
            SW.tableBlock('Macros', ['Macro', 'Dummies in A', 'Dummies in B', 'Status'], r.mrow),
            SW.tableBlock('Defined symbols that differ', ['Symbol', A.v.label, B.v.label, 'Status'], r.srow)] };
        }, 'spacewar-' + A.v.id + '-vs-' + B.v.id + '-constants'));
      } else {
        r = routineDiff(body, A, B);
        exp.appendChild(SW.exportButtons(function () {
          return { title: A.v.label + ' and ' + B.v.label + ': routines', blocks: [
            { type: 'p', text: 'Routine-level genealogy: retained ' + r.c.summary.retained + ', moved ' + r.c.summary.moved + ', edited ' + r.c.summary.edited + ', added ' + r.c.summary.added + ', removed ' + r.c.summary.removed + '; overall similarity ' + Math.round(r.c.summary.similarity * 100) + '%.' },
            SW.tableBlock('Routines matched', [A.v.label, 'Lines', 'Status', 'Similarity %', B.v.label, 'Lines'], r.rows)] };
        }, 'spacewar-' + A.v.id + '-vs-' + B.v.id + '-routines'));
      }
    }).catch(function (e) { body.innerHTML = '<p class="pad">' + SW.esc(e.message) + '</p>'; });
  }

  function defaultB(id) {
    var list = buildable(), i = list.map(function (v) { return v.id; }).indexOf(id);
    return (list[i + 1] || list[i - 1] || list[0]).id;
  }

  SW.views.compare = { show: function (b) {
    if (!b.v.build) { cview.innerHTML = '<div class="pad hint">No source survives for this version, so there is nothing to compare.</div>'; return; }
    renderCompare(b);
  } };

  // ======================= Genealogy =======================
  var gview = SW.$('#view-genealogy');
  var DEFAULT_SET = ['2b', '3.1', '4.0', '4.1', '4.0ts', '4.2', '4.3', '4.4', '4.8', '4.1f', '2015'];
  var gst = { set: SW.store.get('gen.set', DEFAULT_SET), gran: 'routine', supplied: true, show: 'alluvial' };

  function texts(ids) {
    var vs = buildable().filter(function (v) { return ids.indexOf(v.id) >= 0; });
    return Promise.all(vs.map(function (v) { return SW.build(v.id); })).then(function (bs) {
      return bs.map(function (b) { return G.prepare(b.v.id, b.v.label.replace(/^Spacewar! /, ''), b.v.sort, b.parts, { includeSupplied: gst.supplied }); });
    });
  }

  function renderGen(cur) {
    gview.innerHTML = '';
    var tb = SW.el('div', { class: 'toolbar' });
    tb.innerHTML = ['alluvial', 'matrix', 'lineage'].map(function (m) {
      return '<button class="btn' + (gst.show === m ? ' on' : '') + '" data-s="' + m + '">' + { alluvial: 'Flow through versions', matrix: 'Similarity & family tree', lineage: 'Lineage of ' + SW.esc(cur.v.label.replace(/^Spacewar! /, '')) }[m] + '</button>';
    }).join('') + '<span class="sep"></span>' +
      '<label class="check">Granularity <select id="gn-gran">' + ['section', 'routine', 'line'].map(function (g) { return '<option' + (g === gst.gran ? ' selected' : '') + '>' + g + '</option>'; }).join('') + '</select></label>' +
      '<label class="check" title="Count the supplied macro and star tapes as part of each version"><input type="checkbox" id="gn-sup"' + (gst.supplied ? ' checked' : '') + '> supplied tapes</label><span class="sep"></span><span id="gn-exp"></span>';
    gview.appendChild(tb);
    var picks = SW.el('div', { class: 'pad', style: 'padding-bottom:0;max-width:none' });
    picks.innerHTML = '<div class="hint">Versions (chronological): ' + buildable().filter(function (v) { return v.id !== 'stars'; }).map(function (v) {
      return '<label class="check" style="margin-right:10px"><input type="checkbox" data-id="' + SW.esc(v.id) + '"' + (gst.set.indexOf(v.id) >= 0 ? ' checked' : '') + '> ' + SW.esc(v.label.replace(/^Spacewar! /, '')) + '</label>';
    }).join('') + '</div>';
    gview.appendChild(picks);
    var body = SW.el('div', { class: 'pad', style: 'max-width:none' });
    gview.appendChild(body);
    tb.addEventListener('click', function (e) { var s = e.target.closest('[data-s]'); if (s) { gst.show = s.dataset.s; renderGen(cur); } });
    tb.addEventListener('change', function (e) {
      if (e.target.id === 'gn-gran') gst.gran = e.target.value;
      if (e.target.id === 'gn-sup') gst.supplied = e.target.checked;
      renderGen(cur);
    });
    picks.addEventListener('change', function (e) {
      var id = e.target.dataset.id;
      if (!id) return;
      gst.set = gst.set.filter(function (x) { return x !== id; });
      if (e.target.checked) gst.set.push(id);
      SW.store.set('gen.set', gst.set);
      renderGen(cur);
    });
    body.innerHTML = '<p class="hint">Assembling and matching ' + gst.set.length + ' versions…</p>';
    var ids = gst.show === 'lineage' && gst.set.indexOf(cur.v.id) < 0 ? gst.set.concat([cur.v.id]) : gst.set;
    setTimeout(function () {
      texts(ids).then(function (ts) {
        body.innerHTML = '';
        var exp = SW.$('#gn-exp', tb);
        if (gst.show === 'alluvial') showAlluvial(body, exp, ts);
        else if (gst.show === 'matrix') showMatrix(body, exp, ts);
        else showLineage(body, exp, ts, cur);
      }).catch(function (e) { body.innerHTML = '<p>' + SW.esc(e.message) + '</p>'; });
    }, 20);
  }

  function showAlluvial(body, exp, ts) {
    if (gst.gran === 'line') { body.innerHTML = '<p class="hint">Line granularity is too fine for the flow view; choose routine or section, or use Compare → Routines for a pair.</p>'; return; }
    var fl = G.flows(ts, { granularity: gst.gran });
    var svg = function () { return G.svgAlluvial(ts, fl, { granularity: gst.gran }); };
    body.innerHTML = '<p class="hint prose">Each column is a version in date order; each box a ' + gst.gran + ', stacked in source order with height by length. Ribbons join a ' + gst.gran + ' to its ancestor in the previous column: retained in place, moved, edited (with similarity), and stubs for what is added or dropped. Hover for names.</p>' +
      '<div class="legend">' + ['retained', 'moved', 'edited', 'added', 'removed'].map(function (k) { return '<span><i style="background:var(--g-' + k + ')"></i>' + k + '</span>'; }).join('') + '</div>';
    var box = SW.el('div', { class: 'svgbox', style: 'margin-top:10px' }, resolveVars(svg()));
    body.appendChild(box);
    exp.appendChild(svgActions(svg, 'spacewar-genealogy-flow-' + gst.gran));
    var rows = fl.steps.map(function (s) {
      var m = s.summary;
      return [s.from, s.to, m.retained, m.moved, m.edited, m.added, m.removed, Math.round(m.similarity * 100)];
    });
    body.insertAdjacentHTML('beforeend', '<h3 style="margin-top:18px">Step by step</h3>');
    body.appendChild(SW.table(['From', 'To', 'Retained', 'Moved', 'Edited', 'Added', 'Removed', 'Similarity %'], rows, { cls: ['mono', 'mono', 'num', 'num', 'num', 'num', 'num', 'num'] }));
    exp.appendChild(SW.exportButtons(function () {
      return { title: 'Spacewar! genealogy: ' + gst.gran + ' flow', blocks: [
        { type: 'p', text: 'Consecutive versions compared at ' + gst.gran + ' granularity' + (gst.supplied ? ', counting supplied macro and star tapes' : '') + '.' },
        SW.tableBlock('Step by step', ['From', 'To', 'Retained', 'Moved', 'Edited', 'Added', 'Removed', 'Similarity %'], rows)] };
    }, 'spacewar-genealogy-steps'));
  }

  function showMatrix(body, exp, ts) {
    var m = G.matrix(ts, { granularity: gst.gran === 'section' ? 'routine' : gst.gran });
    var t = G.tree(m);
    var sm = function () { return G.svgMatrix(m, {}); }, st = function () { return G.svgTree(t, m.labels, {}); };
    body.innerHTML = '<p class="hint prose">How much of each version’s program survives in each other version (retained, moved, and edited lines weighted by similarity), and the family tree that groups versions by that measure (UPGMA). A tree built from shared text, not from dates: read it against the documented history.</p>';
    var row = SW.el('div', { style: 'display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:14px;margin-top:10px' });
    row.appendChild(SW.el('div', { class: 'svgbox' }, resolveVars(sm())));
    row.appendChild(SW.el('div', { class: 'svgbox' }, resolveVars(st())));
    body.appendChild(row);
    exp.appendChild(svgActions(sm, 'spacewar-similarity-matrix'));
    exp.appendChild(document.createTextNode(' '));
    exp.appendChild(svgActions(st, 'spacewar-family-tree'));
    exp.appendChild(SW.exportButtons(function () {
      return { title: 'Spacewar! similarity matrix', blocks: [SW.tableBlock('Similarity (%)', [''].concat(m.labels), m.labels.map(function (l, i) {
        return [l].concat(m.sim[i].map(function (x) { return String(Math.round(x * 100)); }));
      }))] };
    }, 'spacewar-similarity'));
  }

  function showLineage(body, exp, ts, cur) {
    ts.sort(function (a, b) { return a.sort - b.sort; });
    var ti = ts.map(function (t) { return t.id; }).indexOf(cur.v.id);
    if (ti < 0) { body.innerHTML = '<p class="hint">This version has no program text.</p>'; return; }
    var lin = G.lineage(ts, ti, { granularity: gst.gran });
    var byFirst = {};
    lin.rows.forEach(function (r) { var k = r.firstSeen || cur.v.id; byFirst[k] = (byFirst[k] || 0) + r.unit.codeLines; });
    var total = 0; for (var k in byFirst) total += byFirst[k];
    body.innerHTML = '<p class="hint prose">Each ' + gst.gran + ' of ' + SW.esc(cur.v.label) + ', traced back through the selected versions to where it first appears (exactly or edited). Where a link is missing in the version before, older versions are searched (a bridged link).</p>';
    var bars = SW.el('div', { class: 'bars card', style: 'max-width:640px;margin:10px 0' });
    bars.innerHTML = '<h3>Code lines by version of first appearance</h3>' + ts.filter(function (t) { return byFirst[t.id]; }).map(function (t) {
      return '<div class="b"><span>' + SW.esc(t.label) + '</span><i style="width:' + (100 * byFirst[t.id] / total).toFixed(1) + '%"></i><em>' + byFirst[t.id] + '</em></div>';
    }).join('');
    body.appendChild(bars);
    var rows = lin.rows.map(function (r) {
      return [r.unit.name, { html: r.unit.n0 + '–' + r.unit.n1, sort: r.unit.n0 }, r.unit.codeLines, r.firstSeen || '(new)', r.status,
              r.chain.map(function (c) { return c.versionId + (c.status && c.status !== 'retained' ? ' (' + c.status + (c.similarity != null && c.status === 'edited' ? ' ' + Math.round(c.similarity * 100) + '%' : '') + ')' : '') + (c.gap ? '*' : ''); }).join(' ← ')];
    });
    body.appendChild(SW.table(['Unit', 'Lines', 'Code lines', 'First seen', 'Status', 'Chain (newest first; * bridged)'], rows,
      { cls: ['mono', 'mono', 'num', 'mono', '', 'mono'], onRow: function (r) {
        var t = ts[ti], row = lin.rows.filter(function (x) { return x.unit.name === r[0] && x.unit.n0 === r[1].sort; })[0];
        var L = row && t.lines[row.unit.start];
        if (!L) return;
        SW.state.sel = { p: L.part, n0: L.n, n1: L.n };
        SW.setTab('read');
      } }));
    exp.appendChild(SW.exportButtons(function () { return lineageDoc(cur, ts, ti, lin); }, 'spacewar-' + cur.v.id + '-lineage-' + gst.gran));
  }

  // The complete version, annotated with lineage at the chosen granularity.
  function lineageDoc(b, ts, ti, lin) {
    var blocks = [{ type: 'p', text: 'The complete program of ' + b.v.label + ', divided into ' + gst.gran + 's, each headed by the version in which it first appears among: ' + ts.map(function (t) { return t.label; }).join(', ') + '. Chains read newest first; an asterisk marks a bridged link (absent from the version immediately before).' }];
    lin.rows.forEach(function (r) {
      var t = ts[ti], u = r.unit;
      blocks.push({ type: 'h3', text: u.name + ' (ll. ' + u.n0 + '–' + u.n1 + '): first seen in ' + (r.firstSeen || b.v.id + ' (new)') });
      blocks.push({ type: 'p', runs: [{ text: 'Lineage: ', italic: true }, { text: r.chain.map(function (c) { return c.versionId + ' ' + (c.status || '') + (c.gap ? '*' : ''); }).join(' ← ') || 'none', code: true }] });
      var lines = [];
      for (var i = u.start; i <= u.end; i++) { var L = t.lines[i]; if (L) lines.push({ n: L.n, text: L.raw }); }
      blocks.push({ type: 'code', lines: lines });
    });
    return { title: b.v.label + ': lineage by ' + gst.gran, subtitle: 'A complete version annotated with its genealogy', meta: SW.docMeta(b), blocks: blocks };
  }

  SW.views.genealogy = { show: function (b) {
    if (!G) { gview.innerHTML = '<div class="pad">Genealogy module not loaded.</div>'; return; }
    renderGen(b);
  } };
})(this);
