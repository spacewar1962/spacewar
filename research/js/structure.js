/*
 * structure.js - the static structure of a version's code, and a comparison
 * of two versions by it (Art's Dynamic Profile Gizmo, ⇄ Compare).
 *
 * After Art Schwarz: rather than compare listings line by line, take the code
 * without its comments, cut it into blocks between branches, and compare the
 * graphs the blocks make. A change in the graph is a change of structure; a
 * block whose place holds but whose code differs is an alteration; a block
 * with no counterpart is an insertion or a removal, and the branch it was put
 * into shows where.
 *
 * The graph is read from the assembled code: every instruction reached from
 * the start, following each transfer the instruction can make. Transfers the
 * code does not name (jmp i, jsp i, and what xct runs) are taken from a short
 * sample run of the version. Code compiled at run time (the ships' outlines)
 * is left out: it has no source.
 */
(function (root) {
  'use strict';
  var SW = root.SW, S = {};

  // the transfers an instruction can make: to the next word, to a named
  // address, or (open) somewhere the code does not say
  function flow(md, a) {
    var op = md >> 13, ib = (md >> 12) & 1, y = md & 0o7777, nx = (a + 1) & 0o7777, sk = (a + 2) & 0o7777;
    switch (op) {
      case 0o30: return ib ? { to: [], open: true } : { to: [[y, 'jump']] };                  // jmp
      case 0o31: return ib ? { to: [[nx, 'return']], open: true } : { to: [[y, 'call'], [nx, 'return']] };   // jsp, and back
      case 0o07: var t = ((ib ? y : 0o100) + 1) & 0o7777; return { to: [[t, 'call'], [nx, 'return']] };    // jda, cal
      case 0o23: case 0o24: case 0o25: case 0o27: case 0o32: return { to: [[nx, 'next'], [sk, 'skip']] }; // isp, sad, sas, div, skips
      case 0o04: return { to: [[nx, 'next']], open: true };                                    // xct: what it runs may branch
      default: return null;                                                                     // on to the next word
    }
  }
  // a line's code, for matching: as the assembler reads it, without label, comment
  // or spacing, and with the transcriptions' marks for a variable (\x, ~x, .x) dropped
  function codeKey(L) { return SW.lineKey(L.norm || L.raw).replace(/^[^\s,]+,\s*/, '').replace(/[\\~]/g, ''); }
  // the operation a word assembles to, without its address (which moves between versions)
  function opOf(md) { var o = (root.PDP1CPU.disasm(md, null) || '').split(/\s/)[0]; return /^-?[0-7]+$/.test(o) ? 'data' : o; }   // a word with no operation is a number

  // The graph of one build. dyn: a profile from a run of it (or null).
  S.graph = function (b, dyn) {
    var mem = b.asm.memory, entry = b.asm.start, reach = {}, work = [entry], branchy = {};
    var dynOut = {};
    if (dyn && dyn.branches) dyn.branches.forEach(function (n, k) {
      var f = Math.floor(k / 4096), t = k % 4096;
      if (mem[f] && mem[t]) (dynOut[f] = dynOut[f] || []).push(t);
    });
    if (dyn && dyn.steps) for (var a0 = 0; a0 < 4096; a0++) if (dyn.steps[a0] && mem[a0]) work.push(a0);
    while (work.length) {
      var a = work.pop();
      if (reach[a] || !mem[a]) continue;
      reach[a] = 1;
      var fl = flow(mem[a].val, a);
      if (fl) branchy[a] = fl;
      (fl ? fl.to.map(function (x) { return x[0]; }) : [(a + 1) & 0o7777]).concat(dynOut[a] || []).forEach(function (t) { if (!reach[t]) work.push(t); });
    }
    // block starts: the entry, every target of a transfer, the word after a branch
    var lead = {}; lead[entry] = 1;
    Object.keys(branchy).forEach(function (k) {
      var a = +k; lead[(a + 1) & 0o7777] = 1;
      branchy[a].to.forEach(function (x) { if (x[1] !== 'next' && x[1] !== 'return') lead[x[0]] = 1; });
    });
    Object.keys(dynOut).forEach(function (k) { lead[(+k + 1) & 0o7777] = 1; dynOut[k].forEach(function (t) { lead[t] = 1; }); });
    var blocks = [], at = {}, cur = null, labs = Object.keys(b.labelAt).map(Number).sort(function (x, y) { return x - y; });
    function nameOf(a) {
      if (a in b.labelAt) return b.labelAt[a];
      var l = -1; for (var i = 0; i < labs.length && labs[i] <= a; i++) l = labs[i];
      return l < 0 ? SW.oct(a, 4) : b.labelAt[l] + '+' + (a - l);
    }
    for (var a1 = 0; a1 < 4096; a1++) {
      if (!reach[a1]) { cur = null; continue; }
      if (!cur || lead[a1] || branchy[a1 - 1] || dynOut[a1 - 1]) { cur = { i: blocks.length, a0: a1, a1: a1, keys: [], lines: [] }; blocks.push(cur); }
      cur.a1 = a1; at[a1] = cur.i;
    }
    blocks.forEach(function (bl) {
      bl.name = nameOf(bl.a0);
      var lastLine = null, k = 0;
      for (var a = bl.a0; a <= bl.a1; a++) {
        var s = b.srcOf(a), L = s && b.lines[s.p][s.n - 1];
        if (!L) { bl.keys.push('?'); continue; }
        var id = s.p + ':' + s.n;
        if (id === lastLine) k++; else { k = 0; lastLine = id; bl.lines.push({ p: s.p, n: s.n, raw: L.raw, key: codeKey(L) }); }
        bl.keys.push(codeKey(L) + (k ? '#' + k : '') + ':' + opOf(mem[a].val));
      }
      bl.fp = bl.keys.join('\n');
      var ps = bl.lines.length ? bl.lines[0] : null;
      bl.src = ps ? { p: ps.p, n0: ps.n, n1: bl.lines.filter(function (l) { return l.p === ps.p; }).pop().n } : null;
    });
    // edges between blocks
    var edges = {}, prio = { jump: 4, call: 4, skip: 3, branch: 2, next: 1, return: 1 };
    function edge(f, t, kind) {
      if (f == null || t == null) return;
      var k = f + '>' + t, e = edges[k];
      if (!e) edges[k] = { f: f, t: t, kind: kind };
      else if (prio[kind] > prio[e.kind]) e.kind = kind;
    }
    blocks.forEach(function (bl) {
      var last = bl.a1, fl = branchy[last];
      if (fl) fl.to.forEach(function (x) { edge(bl.i, at[x[0]], x[1]); });
      else edge(bl.i, at[(last + 1) & 0o7777], 'next');
      (dynOut[last] || []).forEach(function (t) { edge(bl.i, at[t], 'branch'); });
      bl.open = !!(fl && fl.open);
    });
    return { b: b, blocks: blocks, at: at, edges: Object.keys(edges).map(function (k) { return edges[k]; }), entry: at[entry] };
  };

  // The longest common subsequence of two lists of keys: pairs of indices.
  function lcs(x, y) {
    var n = x.length, m = y.length, T = [];
    for (var i = 0; i <= n; i++) { T.push(new Int32Array(m + 1)); }
    for (i = n - 1; i >= 0; i--) for (var j = m - 1; j >= 0; j--) T[i][j] = x[i] === y[j] ? T[i + 1][j + 1] + 1 : Math.max(T[i + 1][j], T[i][j + 1]);
    var out = []; i = 0; j = 0;
    while (i < n && j < m) { if (x[i] === y[j]) { out.push([i, j]); i++; j++; } else if (T[i + 1][j] >= T[i][j + 1]) i++; else j++; }
    return out;
  }
  S.lineDiff = function (ka, kb) {
    var p = lcs(ka, kb), rows = [], i = 0, j = 0;
    p.concat([[ka.length, kb.length]]).forEach(function (q) {
      while (i < q[0]) rows.push(['-', i++, null]);
      while (j < q[1]) rows.push(['+', null, j++]);
      if (i < ka.length && j < kb.length) rows.push(['=', i++, j++]);
    });
    return rows;
  };

  // Compare two graphs: A (the other version) and B (this one).
  S.compare = function (A, B) {
    var mA = {}, mB = {}, kind = {};   // matches, both ways; kind of each A block matched
    // 1. the same code
    var byFp = {};
    B.blocks.forEach(function (y) { (byFp[y.fp] = byFp[y.fp] || []).push(y); });
    A.blocks.forEach(function (x) {
      var c = (byFp[x.fp] || []).filter(function (y) { return mB[y.i] == null; });
      if (!c.length) return;
      var y = c.filter(function (y) { return y.name === x.name; })[0] || c[0];
      mA[x.i] = y.i; mB[y.i] = x.i; kind[x.i] = 'same';
    });
    // 2. the same label, different code
    var byName = {};
    B.blocks.forEach(function (y) { if (mB[y.i] == null && !/\+\d+$/.test(y.name)) byName[y.name] = y; });
    A.blocks.forEach(function (x) { var y = byName[x.name]; if (mA[x.i] == null && y && mB[y.i] == null) { mA[x.i] = y.i; mB[y.i] = x.i; kind[x.i] = 'altered'; } });
    // 3. the same place in the graph: one unmatched block on each side, between the same matched neighbours
    function nbrs(G) { var pre = {}, suc = {}; G.edges.forEach(function (e) { (suc[e.f] = suc[e.f] || []).push(e.t); (pre[e.t] = pre[e.t] || []).push(e.f); }); return { pre: pre, suc: suc }; }
    var NA = nbrs(A), NB = nbrs(B);
    for (var pass = 0; pass < 6; pass++) {
      var changed = false;
      A.blocks.forEach(function (x) {
        if (mA[x.i] != null) return;
        var cands = null;
        [['pre', 'suc'], ['suc', 'pre']].forEach(function (d) {
          (NA[d[0]][x.i] || []).forEach(function (n) {
            if (mA[n] == null) return;
            var here = (NB[d[1]][mA[n]] || []).filter(function (y) { return mB[y] == null; });
            cands = cands == null ? here : cands.filter(function (y) { return here.indexOf(y) >= 0; });
          });
        });
        if (cands && cands.length === 1) { mA[x.i] = cands[0]; mB[cands[0]] = x.i; kind[x.i] = 'altered'; changed = true; }
      });
      if (!changed) break;
    }
    // what is left over
    var removed = A.blocks.filter(function (x) { return mA[x.i] == null; }).map(function (x) { return x.i; });
    var inserted = B.blocks.filter(function (y) { return mB[y.i] == null; }).map(function (y) { return y.i; });
    var altered = Object.keys(kind).filter(function (k) { return kind[k] === 'altered'; }).map(Number);
    // an altered block that is in fact the same code (matched by place) counts as the same
    altered = altered.filter(function (xi) { if (A.blocks[xi].fp === B.blocks[mA[xi]].fp) { kind[xi] = 'same'; return false; } return true; });
    // edges
    function has(G, f, t) { return G.edges.some(function (e) { return e.f === f && e.t === t; }); }
    var edgesGone = A.edges.filter(function (e) { return mA[e.f] != null && mA[e.t] != null && !has(B, mA[e.f], mA[e.t]); });
    var edgesNew = B.edges.filter(function (e) { return mB[e.f] != null && mB[e.t] != null && !has(A, mB[e.f], mB[e.t]); });
    // where each insertion went: between matched blocks that A joined directly
    var into = {};
    inserted.forEach(function (yi) {
      var pre = (NB.pre[yi] || []).filter(function (p) { return mB[p] != null; }), suc = (NB.suc[yi] || []).filter(function (q) { return mB[q] != null; });
      pre.forEach(function (p) { suc.forEach(function (q) { if (!into[yi] && has(A, mB[p], mB[q])) into[yi] = [p, q]; }); });
    });
    return { A: A, B: B, mA: mA, mB: mB, kind: kind, removed: removed, inserted: inserted, altered: altered, edgesGone: edgesGone, edgesNew: edgesNew, into: into,
             same: Object.keys(kind).filter(function (k) { return kind[k] === 'same'; }).length };
  };

  // ---------- drawing ----------
  // nodes: [{ id, name, sub, cls }]; edges: [{ f, t, cls, tip }]; entry: a node id
  S.layout = function (nodes, edges, entry) {
    var adj = {}, depth = {};
    edges.forEach(function (e) { (adj[e.f] = adj[e.f] || []).push(e.t); });
    var q = [entry != null ? entry : nodes[0].id]; depth[q[0]] = 0;
    while (q.length) { var u = q.shift(); (adj[u] || []).forEach(function (v) { if (depth[v] == null) { depth[v] = depth[u] + 1; q.push(v); } }); }
    var ids = nodes.map(function (n) { return n.id; });
    // nodes the walk from the entry does not reach go under their nearest neighbour that it does
    var rev = {}; edges.forEach(function (e) { (rev[e.t] = rev[e.t] || []).push(e.f); });
    for (var g = 0; g < 4; g++) ids.forEach(function (id) { if (depth[id] == null) { var d = (rev[id] || []).map(function (p) { return depth[p]; }).filter(function (x) { return x != null; }); if (d.length) depth[id] = Math.min.apply(null, d) + 1; } });
    var order = {}; nodes.forEach(function (n, i) { order[n.id] = n.ord != null ? n.ord : i; });
    ids.sort(function (x, y) { return ((depth[x] == null ? 1e9 : depth[x]) - (depth[y] == null ? 1e9 : depth[y])) || (order[x] - order[y]); });
    var rows = [], lastD = null;
    ids.forEach(function (id) { var d = depth[id] == null ? 1e9 : depth[id]; if (d !== lastD || rows[rows.length - 1].length >= 7) { rows.push([]); lastD = d; } rows[rows.length - 1].push(id); });
    var pos = {};
    function place() { rows.forEach(function (r, ri) { r.forEach(function (id, k) { pos[id] = { r: ri, k: k }; }); }); }
    place();
    for (var sweep = 0; sweep < 4; sweep++) {
      rows.forEach(function (r, ri) {
        if (!ri) return;
        var bc = {};
        r.forEach(function (id) {
          var xs = edges.filter(function (e) { return (e.t === id && pos[e.f] && pos[e.f].r < ri) || (e.f === id && pos[e.t] && pos[e.t].r < ri); }).map(function (e) { var o = e.t === id ? e.f : e.t; return pos[o].k - (rows[pos[o].r].length - 1) / 2; });
          bc[id] = xs.length ? xs.reduce(function (s, x) { return s + x; }, 0) / xs.length : 0;
        });
        r.sort(function (x, y) { return bc[x] - bc[y]; });
      });
      place();
    }
    return { rows: rows, pos: pos };
  };
  var STYLE = {
    same: 'fill="var(--surface)" stroke="var(--text-faint)"',
    altered: 'fill="var(--surface)" stroke="var(--violet)" stroke-width="2"',
    inserted: 'fill="var(--surface)" stroke="var(--g-added)" stroke-width="2"',
    removed: 'fill="var(--surface)" stroke="var(--g-removed)" stroke-width="2" stroke-dasharray="5 3"'
  };
  var TINT = { altered: 'var(--violet)', inserted: 'var(--g-added)', removed: 'var(--g-removed)' };
  var ECOL = { same: 'var(--text-faint)', added: 'var(--g-added)', removed: 'var(--g-removed)' };
  S.svg = function (nodes, edges, entry) {
    var L = S.layout(nodes, edges, entry), rows = L.rows, pos = L.pos, byId = {};
    nodes.forEach(function (n) { byId[n.id] = n; });
    var NW = 150, NH = 44, GX = 28, GY = 50, wmax = Math.max.apply(null, rows.map(function (r) { return r.length; }).concat([1]));
    var W = wmax * (NW + GX) + 140, H = rows.length * (NH + GY) + 30;
    function xy(id) { var p = pos[id], r = rows[p.r]; return { x: 40 + (W - 140 - r.length * (NW + GX)) / 2 + p.k * (NW + GX), y: 20 + p.r * (NH + GY) }; }
    var o = ['<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '"><rect width="' + W + '" height="' + H + '" fill="var(--surface)"/><defs>'];
    Object.keys(ECOL).forEach(function (k) { o.push('<marker id="st-ar-' + k + '" viewBox="0 0 8 8" refX="7" refY="4" markerUnits="userSpaceOnUse" markerWidth="9" markerHeight="9" orient="auto-start-reverse"><path d="M0 0L8 4L0 8z" fill="' + ECOL[k] + '"/></marker>'); });
    o.push('</defs>');
    edges.forEach(function (e) {
      if (!pos[e.f] || !pos[e.t]) return;
      var a = xy(e.f), z = xy(e.t), d;
      if (e.f === e.t) d = 'M' + (a.x + NW) + ' ' + (a.y + 14) + ' c 26 -10 26 28 0 18';
      else if (pos[e.t].r > pos[e.f].r) d = 'M' + (a.x + NW / 2) + ' ' + (a.y + NH) + ' C ' + (a.x + NW / 2) + ' ' + (a.y + NH + GY * 0.6) + ' ' + (z.x + NW / 2) + ' ' + (z.y - GY * 0.6) + ' ' + (z.x + NW / 2) + ' ' + (z.y - 1);
      else { var bx = Math.max(a.x, z.x) + NW + 24 + 10 * (pos[e.f].r - pos[e.t].r); d = 'M' + (a.x + NW) + ' ' + (a.y + NH / 2 + 6) + ' C ' + bx + ' ' + (a.y + NH / 2 + 6) + ' ' + bx + ' ' + (z.y + NH / 2 - 6) + ' ' + (z.x + NW + 1) + ' ' + (z.y + NH / 2 - 6); }
      o.push('<path d="' + d + '" fill="none" stroke="' + ECOL[e.cls] + '" stroke-opacity="' + (e.cls === 'same' ? 0.6 : 0.95) + '" stroke-width="' + (e.cls === 'same' ? 1.1 : 2) + '"' + (e.cls === 'removed' ? ' stroke-dasharray="5 3"' : '') + ' marker-end="url(#st-ar-' + e.cls + ')"><title>' + SW.esc(e.tip || '') + '</title></path>');
    });
    nodes.forEach(function (n) {
      if (!pos[n.id]) return;
      var p = xy(n.id);
      o.push('<g class="gz-node" data-n="' + SW.esc(String(n.id)) + '" style="cursor:pointer"><title>' + SW.esc(n.tip || n.name) + '</title>' +
        '<rect x="' + p.x + '" y="' + p.y + '" width="' + NW + '" height="' + NH + '" rx="' + (n.id === entry ? 14 : 4) + '" ' + STYLE[n.cls] + '/>' +
        (TINT[n.cls] ? '<rect x="' + p.x + '" y="' + p.y + '" width="' + NW + '" height="' + NH + '" rx="' + (n.id === entry ? 14 : 4) + '" fill="' + TINT[n.cls] + '" fill-opacity="0.14"/>' : '') +
        '<text x="' + (p.x + 8) + '" y="' + (p.y + 18) + '" font-family="monospace" font-size="12" font-weight="700" fill="var(--text)">' + SW.esc(n.name) + '</text>' +
        '<text x="' + (p.x + NW - 8) + '" y="' + (p.y + 18) + '" text-anchor="end" font-family="sans-serif" font-size="10.5" fill="' + (TINT[n.cls] || 'var(--text-faint)') + '">' + SW.esc(n.tag || '') + '</text>' +
        '<text x="' + (p.x + 8) + '" y="' + (p.y + 35) + '" font-family="sans-serif" font-size="10.5" fill="var(--text-dim)">' + SW.esc(n.sub || '') + '</text></g>');
    });
    o.push('</svg>');
    return o.join('');
  };

  // ---------- routines: the high level ----------
  // A routine runs from an entry point to the next: the start, anything called
  // (jsp, jda, cal), and anything reached by a jump the code does not name
  // (jmp i, from the sample run: the main loop's dispatch to each object).
  S.routines = function (G) {
    var ent = {}, called = {}; if (G.entry != null) ent[G.blocks[G.entry].a0] = 1;
    // where a call comes back to is not an entry: the word after a call
    // (a call may be followed by its arguments, so up to three words after it)
    var back = {}; G.edges.forEach(function (e) { if (e.kind === 'call') { var c = G.blocks[e.f].a1; back[c + 1] = back[c + 2] = back[c + 3] = 1; } });
    G.edges.forEach(function (e) {
      var t = G.blocks[e.t].a0;
      if (e.kind === 'call') { ent[t] = 1; called[t] = 1; }
      else if (e.kind === 'branch' && G.blocks[e.f].open && !back[t]) ent[t] = 1;
    });
    var starts = Object.keys(ent).map(Number).sort(function (x, y) { return x - y; }), rs = [], of = {};
    G.blocks.forEach(function (bl) {
      var s0 = -1; for (var i = 0; i < starts.length && starts[i] <= bl.a0; i++) s0 = starts[i];
      var key = s0 < 0 ? bl.a0 : s0, r = rs.filter(function (q) { return q.a0 === key; })[0];
      if (!r) {
        var nm = s0 < 0 ? bl.name : G.blocks[G.at[key]].name;
        if (called[key] && /\+1$/.test(nm) && (key - 1) in G.b.labelAt) nm = G.b.labelAt[key - 1];   // jda x enters at x+1: the routine is x
        r = { i: rs.length, a0: key, name: nm, blocks: [], words: 0 }; rs.push(r);
      }
      r.blocks.push(bl.i); r.words += bl.a1 - bl.a0 + 1; of[bl.i] = r.i;
    });
    rs.forEach(function (r) {   // its lines: all those of its first tape it covers
      var f = G.blocks[r.blocks[0]].src; if (!f) { r.src = null; return; }
      var ns = []; r.blocks.forEach(function (i) { G.blocks[i].lines.forEach(function (l) { if (l.p === f.p) ns.push(l.n); }); });
      r.src = { p: f.p, n0: Math.min.apply(null, ns), n1: Math.max.apply(null, ns) };
    });
    var calls = {};
    G.edges.forEach(function (e) { var a = of[e.f], z = of[e.t]; if (a !== z && G.blocks[e.t].a0 === rs[z].a0) (calls[a] = calls[a] || {})[z] = 1; });
    rs.forEach(function (r) { r.to = Object.keys(calls[r.i] || {}).map(Number); });
    return { list: rs, of: of };
  };
  // Routines of two versions paired, from the blocks the comparison matched.
  S.compareRoutines = function (C) {
    var RA = S.routines(C.A), RB = S.routines(C.B), pairA = {}, pairB = {};
    // by name first, then by where most of a routine's matched blocks went
    var byName = {}; RB.list.forEach(function (r) { byName[r.name] = r; });
    RA.list.forEach(function (r) { var q = byName[r.name]; if (q && pairB[q.i] == null) { pairA[r.i] = q.i; pairB[q.i] = r.i; } });
    RA.list.forEach(function (r) {
      if (pairA[r.i] != null) return;
      var votes = {};
      r.blocks.forEach(function (xi) { var y = C.mA[xi]; if (y != null) { var q = RB.of[y]; votes[q] = (votes[q] || 0) + 1; } });
      var best = Object.keys(votes).sort(function (p, q) { return votes[q] - votes[p]; }).filter(function (q) { return pairB[q] == null; })[0];
      if (best != null && votes[best] * 2 >= r.blocks.length) { pairA[r.i] = +best; pairB[best] = r.i; }
    });
    function tally(ra, rb) {
      var t = { same: 0, altered: 0, inserted: 0, removed: 0 };
      (ra ? ra.blocks : []).forEach(function (xi) { if (C.mA[xi] == null) t.removed++; else if (C.kind[xi] === 'altered') t.altered++; else t.same++; });
      (rb ? rb.blocks : []).forEach(function (yi) { if (C.mB[yi] == null) t.inserted++; });
      return t;
    }
    var rows = [];
    RB.list.forEach(function (rb) {
      var ai = pairB[rb.i], ra = ai == null ? null : RA.list[ai], t = tally(ra, rb);
      // a routine new only as an entry point, its code all found elsewhere, has moved
      rows.push({ a: ra, b: rb, t: t, kind: !ra ? (t.inserted ? 'inserted' : 'moved') : (t.altered || t.inserted || t.removed) ? 'altered' : 'same', ord: rb.a0 });
    });
    RA.list.forEach(function (ra) {
      if (pairA[ra.i] != null) return;
      // a removed routine sits after the routine that came before it in the other version
      var prev = RA.list.filter(function (q) { return q.a0 < ra.a0 && pairA[q.i] != null; }).pop();
      var tr = tally(ra, null);
      rows.push({ a: ra, b: null, t: tr, kind: tr.removed ? 'removed' : 'moved', ord: prev ? RB.list[pairA[prev.i]].a0 + 0.5 : -1 });
    });
    rows.sort(function (p, q) { return p.ord - q.ord; });
    return { RA: RA, RB: RB, rows: rows, pairA: pairA, pairB: pairB };
  };

  root.SWStructure = SW.structure = S;
})(typeof window !== 'undefined' ? window : globalThis);
