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
  function svgActions(getSvg, name) { return SW.figureButtons(function () { return getSvg(); }, name); }


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
    pad.innerHTML = '<div class="legend">' + G.STATUSES.map(function (k) {
      return '<span><i style="background:var(--g-' + k + ')"></i>' + k + ' ' + s[k] + '</span>';
    }).join('') + '<span>overall similarity ' + Math.round(s.similarity * 100) + '%</span></div>';
    pad.appendChild(routineMap(ta, tb, c, A, B));
    var rows = c.pairs.map(function (p) {
      var ua = p.a != null ? c.unitsA[p.a] : null, ub = p.b != null ? c.unitsB[p.b] : null;
      return [ua ? ua.name : '', ua ? ua.n0 + '–' + ua.n1 : '', p.status, p.similarity != null ? Math.round(p.similarity * 100) : '', ub ? ub.name : '', ub ? ub.n0 + '–' + ub.n1 : ''];
    });
    pad.appendChild(SW.table([A.v.label, 'Lines', 'Status', 'Sim %', B.v.label, 'Lines'], rows, { cls: ['mono', 'mono', '', 'num', 'mono', 'mono'] }));
    el.appendChild(pad);
    return { c: c, rows: rows };
  }

  // Overview and back, for a zoomable chart. The first press goes out to the whole
  // chart and remembers the zoom and place; the next press returns there. Zooming
  // any other way forgets it.
  // o: { zoomed(): bool, zoom(): current zoom, set(z): redraw at z (null = overview) }
  function overviewFlip(box, o) {
    var back = null, btns = [];
    function returning() { return !!back && !o.zoomed(); }
    function flip() {
      if (o.zoomed()) {
        back = { z: o.zoom(), top: box.scrollTop, left: box.scrollLeft };
        o.set(null);
        box.scrollTop = 0; box.scrollLeft = 0;
      } else if (back) {
        var b = back; back = null;
        o.set(b.z);
        box.scrollTop = b.top; box.scrollLeft = b.left;
      }
      refresh();
    }
    function refresh() {
      btns.forEach(function (b) {
        b.textContent = returning() ? '⤡ Back to your zoom' : '⤢ Overview';
        b.title = returning() ? 'Return to the zoom and place you left' : 'Out to the whole chart; press again to come back';
      });
    }
    return {
      el: box, refresh: refresh,
      forget: function () { back = null; },
      button: function () { var b = SW.el('button', { class: 'btn' }); b.onclick = flip; btns.push(b); return b; }
    };
  }

  // ---------- the routine map: two versions side by side, zoomable to the code ----------
  var rmZoom = SW.store.get('rm.zoom', 1.2);          // pixels per source line
  var CODE_AT = 9;                                     // show code from this zoom up
  function routineMap(ta, tb, c, A, B) {
    var wrap = SW.el('div');
    var bar = SW.el('div', { class: 'toolbar', style: 'position:static;padding-left:0' });
    var box = SW.el('div', { class: 'svgbox flow', style: 'margin:6px 0 14px;max-height:78vh' });
    var readout = SW.el('span', { class: 'hint' });
    function zoomTo(z, keepCentre) {
      var frac = box.scrollHeight ? (box.scrollTop + box.clientHeight / 2) / box.scrollHeight : 0;
      rmZoom = Math.max(0.3, Math.min(16, z));
      SW.store.set('rm.zoom', rmZoom);
      draw();
      if (keepCentre) box.scrollTop = frac * box.scrollHeight - box.clientHeight / 2;
    }
    function fitZoom() {
      var n = Math.max(linesOf(c.unitsA, ta), linesOf(c.unitsB, tb), 1);
      return Math.max(0.3, Math.min(16, (Math.max(300, box.clientHeight || 600) - 90) / n));
    }
    var ov = overviewFlip(box, {
      zoomed: function () { return rmZoom > fitZoom() * 1.05; },
      zoom: function () { return rmZoom; },
      set: function (z) { zoomTo(z == null ? fitZoom() : z, false); }
    });
    function userZoom(z, keep) { ov.forget(); zoomTo(z, keep); }
    bar.appendChild(ov.button());
    [['−', 'Zoom out', function () { userZoom(rmZoom / 1.5, true); }],
     ['+', 'Zoom in (the code appears when there is room to read it)', function () { userZoom(rmZoom * 1.5, true); }],
     ['Code', 'Zoom in far enough to read the code', function () { userZoom(Math.max(CODE_AT, 12), true); }]].forEach(function (b) {
      bar.appendChild(SW.el('button', { class: 'btn', title: b[1], onclick: b[2] }, b[0]));
    });
    var slider = SW.el('input', { type: 'range', min: '0', max: '100', title: 'Zoom' });
    slider.style.width = '160px';
    slider.oninput = function () { userZoom(0.3 * Math.pow(16 / 0.3, +slider.value / 100), true); };
    bar.appendChild(slider);
    bar.appendChild(readout);
    bar.appendChild(SW.el('span', { class: 'sep' }));
    bar.appendChild(SW.paletteSelect(function () { draw(); }));
    bar.appendChild(SW.el('span', { class: 'sep' }));
    bar.appendChild(SW.figureButtons(function () { return svgOf(rmZoom); }, 'spacewar-' + A.v.id + '-' + B.v.id + '-routines'));
    wrap.appendChild(bar);
    wrap.appendChild(ov.el);
    function linesOf(us, t) { var n = 0; us.forEach(function (u) { n += u.end - u.start + 1; }); return n; }
    function svgOf(z) { return routineMapSVG(ta, tb, c, z, A.v.label, B.v.label); }
    function draw() {
      box.innerHTML = SW.displaySVG(svgOf(rmZoom));
      ov.refresh();
      slider.value = String(Math.round(100 * Math.log(rmZoom / 0.3) / Math.log(16 / 0.3)));
      readout.textContent = rmZoom.toFixed(1) + ' px per line' + (rmZoom >= CODE_AT ? ' · code shown' : ' · zoom in to read the code');
    }
    box.addEventListener('click', function (e) {
      var t = e.target.closest('[data-pair]');
      if (!t) return;
      var p = c.pairs[+t.dataset.pair];
      var ua = p.a != null ? c.unitsA[p.a] : null, ub = p.b != null ? c.unitsB[p.b] : null;
      var h = '<p class="hint" style="margin-top:0">Left: ' + SW.esc(ta.label) + '; right: ' + SW.esc(tb.label) + '. ' + statusChip(p.status, p.similarity) + '</p>' +
        '<div class="diff">' + pairRows(ta, ua, tb, ub) + '</div><p>' + (ua ? openButton(ta, ua) + ' ' : '') + (ub ? openButton(tb, ub) : '') + '</p>';
      drawerWide((ua ? ua.name : '') + (ua && ub && ua.name !== ub.name ? ' → ' : '') + (ub && (!ua || ub.name !== ua.name) ? ub.name : ''), h);
    });
    setTimeout(draw, 0);
    return wrap;
  }

  // Line-level marks for a matched pair: which lines of each side changed.
  function lineMarks(ta, ua, tb, ub) {
    var la = [], lb = [], i;
    for (i = ua.start; i <= ua.end; i++) la.push(ta.lines[i]);
    for (i = ub.start; i <= ub.end; i++) lb.push(tb.lines[i]);
    var ma = {}, mb = {};
    G.editScript(la.map(key), lb.map(key)).forEach(function (o) {
      if (o.op === 'same') return;
      if (o.a != null) ma[ua.start + o.a] = o.op;
      if (o.b != null) mb[ub.start + o.b] = o.op;
    });
    return [ma, mb];
  }

  function routineMapSVG(ta, tb, c, z, la, lb) {
    var showCode = z >= CODE_AT, fs = Math.min(13, Math.max(7, z - 1.5));
    var colW = showCode ? 440 : 28, gap = showCode ? 170 : 220, nameW = showCode ? 0 : 150;
    var xA = 12 + nameW, xB = xA + colW + gap, W = xB + colW + nameW + 12, top = 64;
    var COL = function (st) { return 'var(--g-' + st + ')'; };
    function layout(us) {
      var y = top, pos = [];
      us.forEach(function (u) { var h = (u.end - u.start + 1) * z; pos.push({ y: y, h: h }); y += h + (showCode ? 6 : 1); });
      return { pos: pos, bottom: y };
    }
    var LA = layout(c.unitsA), LB = layout(c.unitsB), H = Math.max(LA.bottom, LB.bottom) + 40;
    var statusA = {}, statusB = {}, pairA = {}, pairB = {};
    c.pairs.forEach(function (p, i) {
      if (p.a != null) { statusA[p.a] = p.status; pairA[p.a] = i; }
      if (p.b != null) { statusB[p.b] = p.status; pairB[p.b] = i; }
    });
    var o = ['<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + H.toFixed(0) + '" viewBox="0 0 ' + W + ' ' + H.toFixed(0) + '" font-family="var(--g-font, ui-monospace, Menlo, Consolas, monospace)">'];
    // titles: one per column, and the similarity on its own line in the middle
    o.push('<text x="' + xA + '" y="22" font-size="13" font-weight="700" fill="var(--g-text)">' + SW.esc(la) + '</text>');
    o.push('<text x="' + (xB + colW) + '" y="22" font-size="13" font-weight="700" fill="var(--g-text)" text-anchor="end">' + SW.esc(lb) + '</text>');
    var s = c.summary;
    o.push('<text x="' + ((xA + colW + xB) / 2) + '" y="44" font-size="11" fill="var(--g-muted)" text-anchor="middle">' +
      Math.round(s.similarity * 100) + '% similar · ' + s.retained + ' retained · ' + s.moved + ' moved · ' + s.edited + ' edited · ' + s.rewritten + ' rewritten · ' + s.added + ' added · ' + s.removed + ' removed</text>');
    // bands between matched units
    o.push('<g fill-opacity="0.5">');
    c.pairs.forEach(function (p, i) {
      if (p.a == null || p.b == null) return;
      var a = LA.pos[p.a], b = LB.pos[p.b], x0 = xA + colW, x1 = xB, mx = (x0 + x1) / 2;
      o.push('<path data-pair="' + i + '" d="M' + x0 + ' ' + a.y.toFixed(1) + ' C' + mx + ' ' + a.y.toFixed(1) + ' ' + mx + ' ' + b.y.toFixed(1) + ' ' + x1 + ' ' + b.y.toFixed(1) +
        ' L' + x1 + ' ' + (b.y + b.h).toFixed(1) + ' C' + mx + ' ' + (b.y + b.h).toFixed(1) + ' ' + mx + ' ' + (a.y + a.h).toFixed(1) + ' ' + x0 + ' ' + (a.y + a.h).toFixed(1) + ' Z" fill="' + COL(p.status) + '"' +
        (p.status === 'moved' ? ' fill-opacity="0.85"' : '') + '><title>' + SW.esc(c.unitsA[p.a].name + ' → ' + c.unitsB[p.b].name + ': ' + p.status + (p.status === 'edited' ? ' ' + Math.round(p.similarity * 100) + '%' : '')) + '</title></path>');
    });
    o.push('</g>');
    // the two columns
    function column(t, us, L, x, status, pairOf, side, marks) {
      us.forEach(function (u, k) {
        var P = L.pos[k], st = status[k] || (side === 'a' ? 'removed' : 'added');
        var pi = pairOf[k] != null ? pairOf[k] : '';
        o.push('<g data-pair="' + pi + '"><rect x="' + x + '" y="' + P.y.toFixed(1) + '" width="' + colW + '" height="' + Math.max(P.h, 0.6).toFixed(1) + '" fill="var(--g-box)" stroke="' + COL(st) + '" stroke-width="' + (showCode ? 1.4 : 1) + '"><title>' + SW.esc(t.label + ' · ' + u.name + ' (ll. ' + u.n0 + '–' + u.n1 + '): ' + st) + '</title></rect>');
        if (st === 'added' || st === 'removed') o.push('<rect x="' + x + '" y="' + P.y.toFixed(1) + '" width="' + (showCode ? 5 : colW) + '" height="' + Math.max(P.h, 0.6).toFixed(1) + '" fill="' + COL(st) + '" fill-opacity="' + (showCode ? 1 : 0.8) + '" pointer-events="none"/>');
        if (!showCode && P.h >= 9 && nameW) {
          var nx = side === 'a' ? x - 6 : x + colW + 6;
          o.push('<text x="' + nx + '" y="' + (P.y + Math.min(P.h, 14) / 2 + 3.5).toFixed(1) + '" font-size="10" fill="var(--g-text)"' + (side === 'a' ? ' text-anchor="end"' : '') + ' pointer-events="none">' + SW.esc(u.name.slice(0, 20)) + '</text>');
        }
        if (showCode) {
          var mk = marks && marks[k] ? marks[k] : {};
          for (var i = u.start; i <= u.end; i++) {
            var Ln = t.lines[i], y = P.y + (i - u.start) * z;
            if (!Ln) continue;
            if (mk[i]) o.push('<rect x="' + (x + 5) + '" y="' + y.toFixed(1) + '" width="' + (colW - 5) + '" height="' + z.toFixed(1) + '" fill="' + COL(mk[i] === 'change' ? 'edited' : side === 'a' ? 'removed' : 'added') + '" fill-opacity="0.28" pointer-events="none"/>');
            var txt = Ln.raw.replace(/\t/g, '    ').replace(/[\x00-\x1f]/g, '').replace(/\s+$/, '');
            if (txt.length > 62) txt = txt.slice(0, 61) + '…';
            o.push('<text x="' + (x + 8) + '" y="' + (y + z * 0.78).toFixed(1) + '" font-size="' + fs.toFixed(1) + '" fill="var(--g-text)" xml:space="preserve" pointer-events="none"><tspan fill="var(--g-muted)">' + String(Ln.n).padStart(5) + '  </tspan>' + SW.esc(txt) + '</text>');
          }
        }
        o.push('</g>');
      });
    }
    var marksA = {}, marksB = {};
    if (showCode) c.pairs.forEach(function (p) {
      if (p.a == null || p.b == null || p.status === 'retained' || p.status === 'moved') return;
      var m = lineMarks(ta, c.unitsA[p.a], tb, c.unitsB[p.b]);
      marksA[p.a] = m[0]; marksB[p.b] = m[1];
    });
    column(ta, c.unitsA, LA, xA, statusA, pairA, 'a', marksA);
    column(tb, c.unitsB, LB, xB, statusB, pairB, 'b', marksB);
    // legend
    var lx = 12;
    G.STATUSES.forEach(function (k) {
      o.push('<rect x="' + lx + '" y="' + (H - 24) + '" width="11" height="11" fill="' + COL(k) + '"/><text x="' + (lx + 16) + '" y="' + (H - 14) + '" font-size="11" fill="var(--g-text)">' + k + '</text>');
      lx += 92;
    });
    return o.concat(['</svg>']).join('');
  }

  function renderCompare(A) {
    cview.innerHTML = '';
    var bid = SW.state.b && V.byId(SW.state.b) && V.byId(SW.state.b).build ? SW.state.b : defaultB(A.v.id);
    SW.state.b = bid;
    var tb = SW.el('div', { class: 'toolbar' });
    tb.innerHTML = '<b>' + SW.esc(A.v.label) + '</b> <span class="muted">against</span> <select id="cp-b">' + options(bid) + '</select><span class="sep"></span>' +
      ['text', 'constants', 'routines'].map(function (m) { return '<button class="btn' + (cst.mode === m ? ' on' : '') + '" data-m="' + m + '">' + { text: 'Text', constants: 'Constants & symbols', routines: 'Routines' }[m] + '</button>'; }).join('') +
      '<span class="sep"></span>' +
      '<label class="check" title="Compare the code only: comments (after /) are left out, so a changed comment does not count as a change"><input type="checkbox" data-o="noComments"' + (cst.noComments ? ' checked' : '') + '> ignore comments</label>' +
      '<label class="check" title="Normalised: the text as the assembler read it, after the documented normalisations for this version (for example a transcription&#39;s &quot;.sx1&quot; read as the overlined variable &quot;~sx1&quot;, or modern &quot;//&quot; comments read as MACRO comments). Unticked: the source exactly as held in sources/. Normalised lines are marked with a violet rule by their line numbers."><input type="checkbox" data-o="norm"' + (cst.norm ? ' checked' : '') + '> normalised</label>' +
      '<label class="check" title="Include the tapes supplied to make a version assemble (the macro definitions and the star table), not only the version&#39;s own program text"><input type="checkbox" data-o="supplied"' + (cst.supplied ? ' checked' : '') + '> supplied tapes</label>' +
      '<label class="check" title="Collapse long runs of identical lines to a single bar (click it to open), so the differences stand together"><input type="checkbox" data-o="fold"' + (cst.fold ? ' checked' : '') + '> fold unchanged</label><span class="sep"></span><span id="cp-exp"></span>';
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
            { type: 'p', text: 'Routine-level genealogy: retained ' + r.c.summary.retained + ', moved ' + r.c.summary.moved + ', edited ' + r.c.summary.edited + ', rewritten ' + r.c.summary.rewritten + ', added ' + r.c.summary.added + ', removed ' + r.c.summary.removed + '; overall similarity ' + Math.round(r.c.summary.similarity * 100) + '%.' },
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
  // line: which line of descent the flow follows (V.LINES), or 'chosen' for the
  // ticked versions in date order, which mixes the ddp and dfw forks.
  var gst = { line: SW.store.get('gen.line', 'dfw'), set: SW.store.get('gen.set', DEFAULT_SET), gran: 'routine', supplied: true, show: 'alluvial', boxes: SW.store.get('gen.boxes', 'change'), zoom: +SW.store.get('gen.zoom', 0) || 0 };

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
      return '<button class="btn' + (gst.show === m ? ' on' : '') + '" data-s="' + m + '" title="' + { alluvial: 'Flow through versions: every version side by side, routines joined to their ancestors', matrix: 'Similarity matrix and family tree of the chosen versions', lineage: 'The line of descent of the version open now' }[m] + '">' + { alluvial: 'Flow', matrix: 'Similarity &amp; tree', lineage: 'Lineage of ' + SW.esc(cur.v.label.replace(/^Spacewar! /, '').replace(/ \(.*\)$/, '')) }[m] + '</button>';
    }).join('') + '<span class="sep"></span>' +
      '<label class="check" id="gn-line-l" title="Which line of descent to follow. After 4.0 the program forks into ddp (4.0TS, 4.2 to 4.4) and dfw (4.1, 4.8); the CHM builds and 2015 descend from dfw 4.1. Each step compares a version with its parent. &#39;Chosen versions&#39; compares the versions you tick in date order, which mixes the forks.">Line <select id="gn-line">' +
      V.LINES.map(function (l) { return '<option value="' + l.id + '"' + (gst.line === l.id ? ' selected' : '') + '>' + SW.esc(l.label) + '</option>'; }).join('') +
      '<option value="chosen"' + (gst.line === 'chosen' ? ' selected' : '') + '>Chosen versions, by date (mixes the forks)</option></select></label>' +
      '<label class="check" title="The size of the pieces traced from version to version: section (large blocks under a header or tape title), routine (from one label after a break to the next), or line">Granularity <select id="gn-gran">' + ['section', 'routine', 'line'].map(function (g) { return '<option' + (g === gst.gran ? ' selected' : '') + '>' + g + '</option>'; }).join('') + '</select></label>' +
      '<label class="check" title="Count the supplied macro and star tapes as part of each version"><input type="checkbox" id="gn-sup"' + (gst.supplied ? ' checked' : '') + '> supplied</label><span id="gn-pal"></span>' +
      '<span class="help-dot" id="gn-help" tabindex="0">?</span><span class="tb-right" id="gn-exp"></span>';
    // The versions: a menu, not a wall of checkboxes. Changes apply when it closes.
    var all = buildable().filter(function (v) { return v.id !== 'stars'; });
    var vm = SW.el('details', { class: 'menu' });
    vm.innerHTML = '<summary class="btn" title="Which versions to trace, in date order">Versions ' + gst.set.filter(function (id) { return all.some(function (v) { return v.id === id; }); }).length + ' of ' + all.length + ' ▾</summary>' +
      '<div class="menu-body gen-versions"><div class="row-btns"><button class="btn ghost" data-vs="all">All</button><button class="btn ghost" data-vs="none">None</button><button class="btn ghost" data-vs="default">Default</button></div>' +
      all.map(function (v) {
        return '<label class="check" title="' + SW.esc(v.label + ' · ' + v.date + ': ' + v.summary) + '"><input type="checkbox" data-id="' + SW.esc(v.id) + '"' + (gst.set.indexOf(v.id) >= 0 ? ' checked' : '') + '> ' + SW.esc(v.label.replace(/^Spacewar! /, '')) + ' <span class="faint">' + SW.esc(v.date) + '</span></label>';
      }).join('') + '<div class="hint">Applied when this menu closes.</div></div>';
    if (gst.line === 'chosen') tb.insertBefore(vm, SW.$('#gn-line-l', tb).nextSibling);
    gview.appendChild(tb);
    SW.$('#gn-pal', tb).appendChild(SW.paletteSelect(function () { renderGen(cur); }));
    SW.$('#gn-help', tb).title = gst.show === 'alluvial' ? '' : 'Choose versions, granularity and colours here; the figure and its exports are below.';
    gview.classList.toggle('gen-big', gst.show === 'alluvial' && !!SW.store.get('gen.big', false));
    var dirty = false;
    vm.addEventListener('change', function (e) {
      var id = e.target.dataset.id;
      if (!id) return;
      gst.set = gst.set.filter(function (x) { return x !== id; });
      if (e.target.checked) gst.set.push(id);
      dirty = true;
    });
    vm.addEventListener('click', function (e) {
      var b = e.target.closest('[data-vs]');
      if (!b) return;
      e.preventDefault();
      var k = b.dataset.vs;
      gst.set = k === 'all' ? all.map(function (v) { return v.id; }) : k === 'none' ? [] : DEFAULT_SET.slice();
      SW.$$('input[data-id]', vm).forEach(function (c) { c.checked = gst.set.indexOf(c.dataset.id) >= 0; });
      dirty = true;
    });
    vm.addEventListener('toggle', function () {
      if (vm.open || !dirty) return;
      SW.store.set('gen.set', gst.set);
      renderGen(cur);
    });
    var body = SW.el('div', { class: 'pad', style: 'max-width:none' });
    gview.appendChild(body);
    tb.addEventListener('click', function (e) { var s = e.target.closest('[data-s]'); if (s) { gst.show = s.dataset.s; renderGen(cur); } });
    tb.addEventListener('change', function (e) {
      if (e.target.dataset.id) return;   // a version box: applied when the menu closes
      if (e.target.id === 'gn-gran') gst.gran = e.target.value;
      if (e.target.id === 'gn-line') { gst.line = e.target.value; SW.store.set('gen.line', gst.line); }
      if (e.target.id === 'gn-sup') gst.supplied = e.target.checked;
      renderGen(cur);
    });
    // The versions to trace: the chosen line (each a chain of parents), or the ticked
    // versions; the lineage of the open version follows its own ancestors.
    var line = V.LINES.filter(function (l) { return l.id === gst.line; })[0];
    var ids = line ? line.ids : gst.set;
    if (gst.show === 'lineage') {
      var anc = V.ancestry(cur.v.id);
      ids = anc.length > 1 ? anc : (gst.set.indexOf(cur.v.id) < 0 ? gst.set.concat([cur.v.id]) : gst.set);
    }
    body.innerHTML = '<p class="hint">Assembling and matching ' + ids.length + ' versions…</p>';
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

  // The version names pinned above the flow: the chart's label band is copied into
  // a strip that sticks to the top of the scrolling box and moves sideways with the
  // columns; the chart itself is pulled up under it. Exports keep the labels in place.
  function pinLabels(box) {
    var main = box.querySelector('svg'), labs = main ? Array.prototype.slice.call(main.querySelectorAll('.g-collabel')) : [];
    if (!labs.length) return;
    // The chart leaves a tall band for its angled labels; the pinned strip is a
    // single 20px line instead, each name level and centred on its column, cut
    // to the column's width (the full name on hover).
    var band = +labs[0].getAttribute('y') + 8, W = main.getAttribute('width'), H = 20, NS = 'http://www.w3.org/2000/svg';
    var xs = labs.map(function (t) { return +t.getAttribute('x'); });
    var head = main.cloneNode(false);
    head.setAttribute('height', H);
    head.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    head.setAttribute('aria-hidden', 'true');
    head.removeAttribute('role');
    labs.forEach(function (t, i) {
      var full = (t.querySelector('title') || {}).textContent || t.textContent;
      var room = (i + 1 < xs.length ? xs[i + 1] - xs[i] : i > 0 ? xs[i] - xs[i - 1] : 200) - 12;
      var max = Math.max(3, Math.floor(room / 6.7));
      var n = document.createElementNS(NS, 'text');
      n.setAttribute('x', xs[i]); n.setAttribute('y', 14); n.setAttribute('text-anchor', 'middle');
      n.setAttribute('font-size', '11'); n.setAttribute('fill', t.getAttribute('fill'));
      n.textContent = full.length > max ? full.slice(0, max - 1) + '…' : full;
      var tt = document.createElementNS(NS, 'title'); tt.textContent = full; n.appendChild(tt);
      head.appendChild(n);
      t.setAttribute('visibility', 'hidden');
    });
    var strip = SW.el('div', { class: 'flow-head' });
    strip.appendChild(head);
    box.insertBefore(strip, main);
    // Pull the chart up by its whole label band (now empty), so its columns start
    // right under the strip; the chart is drawn at its natural size.
    main.style.marginTop = -band + 'px';
  }

  function showAlluvial(body, exp, ts) {
    gst.boxes = SW.store.get('gen.boxes', gst.boxes);
    if (gst.gran === 'line') { body.innerHTML = '<p class="hint">Line granularity is too fine for the flow view; choose routine or section, or use Compare → Routines for a pair.</p>'; return; }
    var fl = G.flows(ts, { granularity: gst.gran });
    // Zoom, in pixels per source line (0 = fit to the window). Further in, each
    // box shows its routine's name, then its code.
    var NAMES_AT = 2.5, CODE_AT_G = 8;
    var maxLines = Math.max.apply(null, ts.map(function (t) { return t.lines.length; }).concat([1]));
    var fitZ = 560 / maxLines;
    function z() { return gst.zoom || fitZ; }
    function flowOpts() {
      var k = z(), code = k >= CODE_AT_G, names = !code && k >= NAMES_AT;
      return { granularity: gst.gran, perLine: gst.zoom ? k : null, names: names, code: code,
               boxWidth: code ? 330 : names ? 130 : 14, colWidth: code ? 450 : names ? 240 : 110 };
    }
    // Whose hand: each box signed (initials in its comments), inherited from
    // its ancestor, or new on a tape whose title is signed.
    var hands = G.attributeHands(ts, fl, SW.handsIn);
    function handFill(i, k) {
      var a = hands[i][k], h = a.hand && SW.handOf(a.hand);
      return h ? h.colour + (a.how === 'signed' ? '' : a.how === 'inherited' ? 'a0' : '70') : null;
    }
    function handTip(i, k) { return '\n' + handText(ts, fl, hands, i, k); }
    function handLegend() {
      var seen = {};
      hands.forEach(function (col) { col.forEach(function (a) { if (a.hand) seen[a.hand] = 1; }); });
      return SW.HANDS.filter(function (h) { return seen[h.k]; }).map(function (h) { return [h.colour, h.k + ' ' + h.who]; })
        .concat([['var(--g-box, #263238)', 'no hand in the record'], ['#88888870', 'paler: inherited, or new on a signed tape']]);
    }
    var baseOpts = flowOpts;
    flowOpts = function () {
      var o = baseOpts();
      if (gst.boxes === 'hand') { o.boxFill = handFill; o.boxTip = handTip; o.extraLegend = handLegend(); }
      return o;
    };
    var svg = function () { return G.svgAlluvial(ts, fl, flowOpts()); };
    var help = SW.$('#gn-help');
    if (help) help.title = 'Each column is a version in date order; each box a ' + gst.gran + ', stacked in source order with height by length. ' +
      'Ribbons join a ' + gst.gran + ' to its ancestor in the previous column: retained in place, moved, edited (with similarity), and stubs for what is added or dropped.\n\n' +
      'Hover a box or ribbon for names. Click one to read the code it stands for, coloured by what happened to it; a clicked box also lights the same ' + gst.gran + ' in every version before and after it (click it again, or empty space, to clear).\n\n' +
      'Zoom in for names, then code. Chart only hides the tables below; drag the bar under the chart to resize it.';
    body.innerHTML = '';
    var zbar = SW.el('div', { class: 'toolbar flow-bar', style: 'position:static;padding-left:0' });
    var box = SW.el('div', { class: 'svgbox flow', style: 'margin-top:4px;max-height:80vh' });
    var slider = SW.el('input', { type: 'range', min: '0', max: '100', title: 'Zoom' });
    var readout = SW.el('span', { class: 'hint' });
    slider.style.width = '160px';
    function drawFlow() {
      box.innerHTML = SW.displaySVG(svg());
      pinLabels(box);
      if (ov) ov.refresh();
      var k = z();
      slider.value = String(Math.round(100 * Math.log(k / 0.1) / Math.log(16 / 0.1)));
      readout.textContent = (gst.zoom ? k.toFixed(1) + ' px/line' : 'fitted');
      readout.title = k >= CODE_AT_G ? 'Code shown' : k >= NAMES_AT ? 'Names shown; zoom in further for the code' : 'Zoom in for names, then code';
    }
    function zoomTo(k, keep) {
      var fy = box.scrollHeight ? (box.scrollTop + box.clientHeight / 2) / box.scrollHeight : 0;
      var fx = box.scrollWidth ? (box.scrollLeft + box.clientWidth / 2) / box.scrollWidth : 0;
      gst.zoom = k ? Math.max(0.1, Math.min(16, k)) : 0;
      SW.store.set('gen.zoom', gst.zoom);
      drawFlow();
      if (keep) { box.scrollTop = fy * box.scrollHeight - box.clientHeight / 2; box.scrollLeft = fx * box.scrollWidth - box.clientWidth / 2; }
    }
    var ov = overviewFlip(box, {
      zoomed: function () { return !!gst.zoom && gst.zoom > fitZ * 1.05; },
      zoom: function () { return gst.zoom; },
      set: function (k) { zoomTo(k || 0, false); }
    });
    function userZoom(k, keep) { ov.forget(); zoomTo(k, keep); }
    zbar.appendChild(ov.button());
    [['−', 'Zoom out', function () { userZoom(z() / 1.5, true); }],
     ['+', 'Zoom in: routine names appear, then the code', function () { userZoom(z() * 1.5, true); }],
     ['Names', 'Zoom in far enough to read the names of the ' + gst.gran + 's', function () { userZoom(Math.max(NAMES_AT, 3), true); }],
     ['Code', 'Zoom in far enough to read the code', function () { userZoom(Math.max(CODE_AT_G, 11), true); }]].forEach(function (b) {
      zbar.appendChild(SW.el('button', { class: 'btn', title: b[1], onclick: b[2] }, b[0]));
    });
    slider.oninput = function () { userZoom(0.1 * Math.pow(16 / 0.1, +slider.value / 100), true); };
    zbar.appendChild(slider);
    zbar.appendChild(readout);
    zbar.appendChild(SW.el('span', { class: 'sep' }));
    var boxSel = SW.el('label', { class: 'check', title: 'What the boxes show. Whose hand: the initials written in each ' + gst.gran + '’s own comments (solid), carried forward to its descendants (paler), or, for a ' + gst.gran + ' new in a version, the initials in that tape’s title (palest). Ribbons still show what changed.' },
      'Boxes <select><option value="change"' + (gst.boxes !== 'hand' ? ' selected' : '') + '>plain</option><option value="hand"' + (gst.boxes === 'hand' ? ' selected' : '') + '>whose hand</option></select>');
    boxSel.querySelector('select').onchange = function (e) { gst.boxes = e.target.value; SW.store.set('gen.boxes', gst.boxes); drawFlow(); handTable(); };
    zbar.appendChild(boxSel);
    zbar.appendChild(SW.el('span', { class: 'sep' }));
    var gv = body.closest('.view') || body;
    var bigBtn = SW.el('button', { class: 'btn', title: 'Give the chart the whole page: hides the version choices, the explanation and the tables below (click again to bring them back)' });
    function paintBig() { var on = gv.classList.contains('gen-big'); bigBtn.textContent = on ? '⤡ Show everything' : '⤢ Chart only'; bigBtn.classList.toggle('on', on); }
    bigBtn.onclick = function () { var on = !gv.classList.contains('gen-big'); gv.classList.toggle('gen-big', on); SW.store.set('gen.big', on); paintBig(); };
    paintBig();
    zbar.appendChild(bigBtn);
    var stage = SW.el('div', { class: 'flow-stage' });
    zbar.appendChild(SW.el('button', { class: 'btn', title: 'Fill the whole screen with the chart and its zoom controls (Esc to leave)', onclick: function () {
      if (document.fullscreenElement) document.exitFullscreen(); else if (stage.requestFullscreen) stage.requestFullscreen();
    } }, '⛶ Full screen'));
    zbar.appendChild(SW.el('span', { class: 'legend tb-right', title: 'Ribbon colours: what happened to each ' + gst.gran + ' between one version and the next' },
      G.STATUSES.map(function (k) { return '<span><i style="background:var(--g-' + k + ')"></i>' + k + '</span>'; }).join('')));
    body.appendChild(stage);
    stage.appendChild(zbar);
    stage.appendChild(ov.el);
    // A grip under the chart: drag to make it taller or shorter; double-click to reset.
    var grip = SW.el('div', { class: 'flow-grip', title: 'Drag to resize the chart; double-click to reset' });
    stage.appendChild(grip);
    function setH(h) {
      if (h) { box.style.height = h + 'px'; box.style.setProperty('max-height', h + 'px', 'important'); }
      else { box.style.height = ''; box.style.removeProperty('max-height'); box.style.maxHeight = '80vh'; }
    }
    setH(+SW.store.get('gen.h', 0) || 0);
    grip.addEventListener('pointerdown', function (e) {
      e.preventDefault();
      var y0 = e.clientY, h0 = box.getBoundingClientRect().height;
      grip.setPointerCapture(e.pointerId);
      function move(ev) { setH(Math.max(200, Math.round(h0 + ev.clientY - y0))); }
      function up() {
        grip.removeEventListener('pointermove', move); grip.removeEventListener('pointerup', up);
        SW.store.set('gen.h', Math.round(box.getBoundingClientRect().height));
      }
      grip.addEventListener('pointermove', move); grip.addEventListener('pointerup', up);
    });
    grip.addEventListener('dblclick', function () { SW.store.set('gen.h', 0); setH(0); });
    drawFlow();
    // Click: the unit's line of descent, back and forward, lightly lit, with the ribbons between.
    var back = fl.units.map(function () { return {}; }), fwd = fl.units.map(function () { return {}; });
    fl.steps.forEach(function (st, si) {
      st.pairs.forEach(function (p) { if (p.a != null && p.b != null) { fwd[si][p.a] = p.b; back[si + 1][p.b] = p.a; } });
    });
    var lit = [], litKey = '';
    function unlight() { lit.forEach(function (x) { x.classList.remove('hl'); }); lit = []; litKey = ''; }
    function light(col, k) {
      if (litKey === col + ':' + k && (!lit.length || box.contains(lit[0]))) return;
      unlight();
      litKey = col + ':' + k;
      var chain = [[col, k]], c = col, u = k;
      while (c > 0 && back[c][u] != null) { u = back[c][u]; c--; chain.unshift([c, u]); }
      c = col; u = k;
      while (c < fwd.length - 1 && fwd[c][u] != null) { u = fwd[c][u]; c++; chain.push([c, u]); }
      chain.forEach(function (cu, i) {
        var r = box.querySelector('rect[data-col="' + cu[0] + '"][data-u="' + cu[1] + '"]');
        if (r) { r.classList.add('hl'); lit.push(r); }
        if (i === chain.length - 1) return;
        var a = cu[1], nb = chain[i + 1][1];
        SW.$$('path[data-step="' + cu[0] + '"]', box).forEach(function (pth) {
          var d = pth.dataset;
          if (d.a0 !== '' && d.b0 !== '' && +d.a0 <= a && a <= +d.a1 && +d.b0 <= nb && nb <= +d.b1) { pth.classList.add('hl'); lit.push(pth); }
        });
      });
    }
    box.addEventListener('click', function (e) {
      var t = e.target.closest('[data-col],[data-step]');
      if (!t) { unlight(); return; }
      // the same box again: cancel the lighting
      if (t.dataset.col != null && litKey === t.dataset.col + ':' + t.dataset.u && lit.length && box.contains(lit[0])) {
        unlight(); t.classList.remove('picked'); return;
      }
      if (t.dataset.col != null) light(+t.dataset.col, +t.dataset.u); else unlight();
      SW.$$('.picked', box).forEach(function (x) { x.classList.remove('picked'); });
      t.classList.add('picked');
      if (t.dataset.col != null) showUnit(ts, fl, +t.dataset.col, +t.dataset.u, hands);
      else showRibbon(ts, fl, t.dataset);
    });
    exp.appendChild(svgActions(svg, 'spacewar-genealogy-flow-' + gst.gran));
    var rows = fl.steps.map(function (s) {
      var m = s.summary;
      return [s.from, s.to, m.retained, m.moved, m.edited, m.rewritten, m.added, m.removed, Math.round(m.similarity * 100)];
    });
    var extra = SW.el('div', { class: 'gen-extra' });
    body.appendChild(extra);
    extra.insertAdjacentHTML('beforeend', '<h3 style="margin-top:18px">Step by step</h3>');
    extra.appendChild(SW.table(['From', 'To', 'Retained', 'Moved', 'Edited', 'Rewritten', 'Added', 'Removed', 'Similarity %'], rows, { cls: ['mono', 'mono', 'num', 'num', 'num', 'num', 'num', 'num', 'num'] }));
    // Lines by hand, version by version (shown with the hand colouring).
    var hkeys = SW.HANDS.map(function (h) { return h.k; }).filter(function (k) { return hands.some(function (col) { return col.some(function (a) { return a.hand === k; }); }); });
    var hHead = ['Version'].concat(hkeys, ['no hand']);
    var hRows = ts.map(function (t, i) {
      var c = {};
      fl.units[i].forEach(function (u, k) { var h = hands[i][k].hand || '-'; c[h] = (c[h] || 0) + u.lines; });
      return [t.label].concat(hkeys.map(function (k) { return c[k] || 0; }), [c['-'] || 0]);
    });
    var hBox = SW.el('div');
    extra.appendChild(hBox);
    function handTable() {
      hBox.innerHTML = '';
      if (gst.boxes !== 'hand') return;
      hBox.insertAdjacentHTML('beforeend', '<h3 style="margin-top:18px">Lines by hand</h3><p class="hint">Code lines in ' + gst.gran + 's attributed to each hand: signed in the ' + gst.gran + '’s own comments, carried forward from an ancestor, or new on a tape whose title is signed. This follows the written record; it is evidence of a hand, not proof of authorship.</p>');
      hBox.appendChild(SW.table(hHead, hRows.map(function (r) { return r.slice(); }), { cls: ['mono'].concat(hHead.slice(1).map(function () { return 'num'; })) }));
    }
    handTable();
    exp.appendChild(SW.exportButtons(function () {
      var bl = [
        { type: 'p', text: 'Consecutive versions compared at ' + gst.gran + ' granularity' + (gst.supplied ? ', counting supplied macro and star tapes' : '') + '.' },
        SW.tableBlock('Step by step', ['From', 'To', 'Retained', 'Moved', 'Edited', 'Rewritten', 'Added', 'Removed', 'Similarity %'], rows)];
      if (gst.boxes === 'hand') bl.push(SW.tableBlock('Lines by hand (signed, inherited, or new on a signed tape)', hHead, hRows));
      return { title: 'Spacewar! genealogy: ' + gst.gran + ' flow', blocks: bl };
    }, 'spacewar-genealogy-steps'));
  }

  // ---------- the flow, made readable ----------
  var STATUS_BG = { same: '', change: 'chg', add: 'add', del: 'del' };
  function unitLines(t, u) {
    var out = [];
    for (var i = u.start; i <= u.end; i++) if (t.lines[i]) out.push(t.lines[i]);
    return out;
  }
  function key(l) { return l.norm || l.raw.replace(/\s+/g, ' ').trim(); }
  // Side-by-side rows for two units, the changed lines marked.
  function pairRows(ta, ua, tb, ub) {
    var la = ua ? unitLines(ta, ua) : [], lb = ub ? unitLines(tb, ub) : [];
    var ops = G.editScript(la.map(key), lb.map(key));
    return ops.map(function (o) {
      var a = o.a != null ? la[o.a] : null, b = o.b != null ? lb[o.b] : null, cls = STATUS_BG[o.op];
      var ha = a ? SW.esc(a.raw) : '', hb = b ? SW.esc(b.raw) : '';
      if (o.op === 'change') { var d = tokDiff(a.raw, b.raw); ha = d[0]; hb = d[1]; }
      return '<div class="row"><span class="n">' + (a ? a.n : '') + '</span><span class="' + (a ? cls : '') + '">' + ha + '</span>' +
        '<span class="n">' + (b ? b.n : '') + '</span><span class="' + (b ? cls : '') + '">' + hb + '</span></div>';
    }).join('');
  }
  function statusChip(st, sim) {
    return '<span class="badge" style="color:var(--g-' + st + ');border-color:currentColor">' + st + ((st === 'edited' || st === 'rewritten') && sim != null ? ' ' + Math.round(sim * 100) + '%' : '') + '</span>';
  }
  function openButton(t, u) {
    var L = t.lines[u.start];
    return '<button class="btn" data-open="' + SW.esc(t.id) + '" data-p="' + L.part + '" data-n0="' + L.n + '" data-n1="' + t.lines[u.end].n + '">Open in Read ↗</button>';
  }
  function wireOpen(el) {
    el.addEventListener('click', function (e) {
      var b = e.target.closest('[data-open]');
      if (!b) return;
      SW.state.sel = { p: +b.dataset.p, n0: +b.dataset.n0, n1: +b.dataset.n1 };
      SW.closeDrawer();
      document.body.classList.remove('drawer-wide');
      if (b.dataset.open !== SW.state.v) SW.select(b.dataset.open);
      SW.setTab('read');
    });
  }
  function drawerWide(title, html) {
    var el = SW.drawer(title, html);
    document.body.classList.add('drawer-wide');
    wireOpen(el);
    return el;
  }
  // A box: the unit, its ancestor in the previous column and its heir in the next.
  // How a unit came by its hand, in words.
  function handText(ts, fl, hands, i, k) {
    var a = hands[i][k], h = a.hand && SW.handOf(a.hand);
    if (!h) return 'Hand: none in the record';
    var who = h.k + ' (' + h.who + ')';
    if (a.how === 'signed') return 'Hand: ' + who + ', signed in its own comment at line ' + a.line.n + ': ' + a.line.comment.trim();
    if (a.how === 'tape') return 'Hand: ' + who + ', new in ' + ts[i].label + ', on a tape titled “' + a.line.raw.trim() + '”';
    var src = a, back = 0;
    while (src.how === 'inherited' && src.from) { src = src.from; back++; }
    return 'Hand: ' + who + ', carried forward ' + back + ' version' + (back === 1 ? '' : 's') + ' from where it was ' +
      (src.how === 'signed' ? 'signed (line ' + src.line.n + ')' : 'first seen on a signed tape') + (a.status ? '; ' + a.status + ' here' : '');
  }

  function showUnit(ts, fl, col, k, hands) {
    var t = ts[col], u = fl.units[col][k];
    var prev = col > 0 ? fl.steps[col - 1].pairs.filter(function (p) { return p.b === k; })[0] : null;
    var next = col < fl.steps.length ? fl.steps[col].pairs.filter(function (p) { return p.a === k; })[0] : null;
    var h = '<p class="mono" style="margin-top:0">' + SW.esc(u.file) + ', ll. ' + u.n0 + '–' + u.n1 + ' · ' + u.lines + ' lines</p>' +
      (hands ? '<p class="hint">' + SW.esc(handText(ts, fl, hands, col, k)) + '</p>' : '');
    if (prev) {
      var ua = prev.a != null ? fl.units[col - 1][prev.a] : null;
      h += '<h3>From ' + SW.esc(ts[col - 1].label) + ' ' + statusChip(prev.status, prev.similarity) + '</h3>' +
        (ua ? '<p class="hint">Ancestor: <span class="mono">' + SW.esc(ua.name) + '</span> (ll. ' + ua.n0 + '–' + ua.n1 + '). Left: ' + SW.esc(ts[col - 1].label) + '; right: ' + SW.esc(t.label) + '.</p>' : '<p class="hint">New in this version: no ancestor in ' + SW.esc(ts[col - 1].label) + '.</p>') +
        '<div class="diff">' + pairRows(ts[col - 1], ua, t, u) + '</div>';
    } else {
      h += '<div class="diff">' + pairRows(t, null, t, u).replace(/class="add"/g, 'class=""') + '</div>';
    }
    if (next) h += '<p class="hint" style="margin-top:10px">In ' + SW.esc(ts[col + 1].label) + ': ' + statusChip(next.status, next.similarity) +
      (next.b != null ? ' as <span class="mono">' + SW.esc(fl.units[col + 1][next.b].name) + '</span>' : '') + '</p>';
    h += '<p>' + openButton(t, u) + '</p>';
    drawerWide(t.label + ' · ' + u.name, h);
  }
  // A ribbon: every unit pair it carries, side by side.
  function showRibbon(ts, fl, d) {
    var si = +d.step, st = fl.steps[si], ta = ts[st.from], tb = ts[st.to];
    var a0 = d.a0 === '' ? null : +d.a0, a1 = d.a1 === '' ? null : +d.a1, b0 = d.b0 === '' ? null : +d.b0, b1 = d.b1 === '' ? null : +d.b1;
    var pairs = st.pairs.filter(function (p) {
      if (a0 == null) return p.a == null && p.b === b0;
      if (b0 == null) return p.b == null && p.a === a0;
      return p.a != null && p.b != null && p.a >= a0 && p.a <= a1 && p.b >= b0 && p.b <= b1 && p.status === d.status;
    });
    var h = '<p class="hint" style="margin-top:0">' + SW.esc(ta.label) + ' → ' + SW.esc(tb.label) + ': ' + statusChip(d.status) + ' ' + pairs.length + ' ' + gst.gran + (pairs.length === 1 ? '' : 's') +
      '. Left: ' + SW.esc(ta.label) + '; right: ' + SW.esc(tb.label) + '. Shaded: <span class="chg" style="padding:0 3px">changed</span> <span class="del" style="padding:0 3px">only left</span> <span class="add" style="padding:0 3px">only right</span>.</p>';
    pairs.slice(0, 40).forEach(function (p) {
      var ua = p.a != null ? fl.units[st.from][p.a] : null, ub = p.b != null ? fl.units[st.to][p.b] : null;
      h += '<h3>' + SW.esc(ua ? ua.name : '') + (ua && ub && ua.name !== ub.name ? ' → ' : '') + SW.esc(ub && (!ua || ub.name !== ua.name) ? ub.name : '') + ' ' + statusChip(p.status, p.similarity) + '</h3>' +
        '<div class="diff">' + pairRows(ta, ua, tb, ub) + '</div><p>' + (ua ? openButton(ta, ua) + ' ' : '') + (ub ? openButton(tb, ub) : '') + '</p>';
    });
    if (pairs.length > 40) h += '<p class="hint">…and ' + (pairs.length - 40) + ' more.</p>';
    drawerWide(ta.label + ' → ' + tb.label, h);
  }

  function showMatrix(body, exp, ts) {
    var m = G.matrix(ts, { granularity: gst.gran === 'section' ? 'routine' : gst.gran });
    var t = G.tree(m);
    var sm = function () { return G.svgMatrix(m, {}); }, st = function () { return G.svgTree(t, m.labels, {}); };
    body.innerHTML = '<p class="hint prose">How much of each version’s program survives in each other version (retained, moved, and edited lines weighted by similarity), and the family tree that groups versions by that measure (UPGMA). A tree built from shared text, not from dates: read it against the documented history.</p>';
    var row = SW.el('div', { style: 'display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:14px;margin-top:10px' });
    row.appendChild(SW.el('div', { class: 'svgbox' }, SW.displaySVG(sm())));
    row.appendChild(SW.el('div', { class: 'svgbox' }, SW.displaySVG(st())));
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
    body.innerHTML = '<p class="hint prose">Each ' + gst.gran + ' of ' + SW.esc(cur.v.label) + ', traced back through its line of descent to where it first appears (exactly or edited). Where a link is missing in the version before, older versions are searched (a bridged link).</p>';
    var bars = SW.el('div', { class: 'bars card', style: 'max-width:640px;margin:10px 0' });
    bars.innerHTML = '<h3>Code lines by version of first appearance</h3>' + ts.filter(function (t) { return byFirst[t.id]; }).map(function (t) {
      return '<div class="b"><span>' + SW.esc(t.label) + '</span><i style="width:' + (100 * byFirst[t.id] / total).toFixed(1) + '%"></i><em>' + byFirst[t.id] + '</em></div>';
    }).join('');
    body.appendChild(bars);
    var rows = lin.rows.map(function (r) {
      return [r.unit.name, { html: r.unit.n0 + '–' + r.unit.n1, sort: r.unit.n0 }, r.unit.codeLines, r.firstSeen || '(new)', r.status,
              r.chain.map(function (c) { return c.versionId + (c.status && c.status !== 'retained' ? ' (' + c.status + (c.similarity != null && (c.status === 'edited' || c.status === 'rewritten') ? ' ' + Math.round(c.similarity * 100) + '%' : '') + ')' : '') + (c.gap ? '*' : ''); }).join(' ← ')];
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
