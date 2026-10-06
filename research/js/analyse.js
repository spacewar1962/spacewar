/*
 * analyse.js - lenses on a version: critical readings and technical maps.
 * Each lens is a card with its own export; the numbering is stable so a
 * lens can be named in discussion ("lens 4").
 */
(function (root) {
  'use strict';
  var SW = root.SW, C = root.PDP1CPU;
  var view = SW.$('#view-analyse');
  var build = null, lens = SW.store.get('an.lens', 1);
  if (lens === 12 || lens === 13) lens = 1;   // the sky and the ships are under Graphics now
  SW.anLens = function () { return lens; };
  // Art's gizmo in the address: its mode, the version compared with, the split, the routine open
  var gzQ = {};
  SW.gzQuery = function () { return lens === 16 ? gzQ : {}; };
  function gzWrite(o) { gzQ = o; SW.writeQuery(); }
  SW.anLensName = function () { return LENSES[lens - 1][1]; };

  var LENSES = [
    [1, 'Comments', 'Every comment, searchable'],
    [2, 'Hands and dates', 'Initials, signatures and dates'],
    [3, 'Lexicon', 'The program’s names'],
    [4, 'Rules made adjustable', 'Constants, sense switches, test word'],
    [5, 'The machine in the code', 'Devices, arithmetic, timing'],
    [6, 'Where the time goes', 'The run profile'],
    [7, 'Absence', 'Gaps in the record, and what fills them'],
    [8, 'Calls', 'Subroutine calls'],
    [9, 'Instructions', 'Instruction counts, written and run'],
    [10, 'Memory map', 'Core, word by word'],
    [11, 'Macros', 'Macros and their use'],
    [12, 'The sky', 'The star table as a chart'],
    [13, 'The ships', 'The ship outlines'],
    [14, 'Symbol histories', 'One symbol across the versions'],
    [15, 'Functional overview', 'Start-up, the main loop, each object’s routine, the calls'],
    [16, 'Art’s Dynamic Profile Gizmo', 'The code as a graph of blocks']
  ];

  function progLines(b) {
    var out = [];
    b.lines.forEach(function (ls, pi) { if (b.parts[pi].role === 'program') ls.forEach(function (L) { if (!L.skipped) out.push(L); }); });
    return out;
  }
  function allLines(b) {
    var out = [];
    b.lines.forEach(function (ls) { ls.forEach(function (L) { if (!L.skipped) out.push(L); }); });
    return out;
  }
  function goto(L) { SW.state.sel = { p: L.p, n0: L.n, n1: L.n }; SW.emit('goto', { p: L.p, n: L.n, tab: 'read' }); }
  function card(title, lede) {
    var c = SW.el('div', { class: 'card' });
    c.innerHTML = '<h3>' + SW.esc(title) + '</h3>' + (lede ? '<p class="lede">' + lede + '</p>' : '');
    return c;
  }
  function bars(rows, max) {
    max = max || rows.reduce(function (m, r) { return Math.max(m, r[1]); }, 1);
    return '<div class="bars">' + rows.map(function (r) {
      return '<div class="b"><span title="' + SW.esc(r[0]) + '">' + SW.esc(r[0]) + '</span><i style="width:' + (100 * r[1] / max).toFixed(1) + '%"></i><em>' + r[1] + '</em></div>';
    }).join('') + '</div>';
  }
  var STOP = { the: 1, a: 1, of: 1, to: 1, and: 1, is: 1, in: 1, for: 1, if: 1, on: 1, at: 1, by: 1, it: 1, be: 1, or: 1, as: 1, from: 1, with: 1, this: 1, that: 1, not: 1, no: 1, an: 1, are: 1 };

  // ---------- 1 comments ----------
  var STARLINE = /^\s*(?:[0-9a-z]+,)?\s*mark\s/i;
  // Keyword-in-context rows: line | left context | keyword | right context.
  function kwicRows(items, q, width) {
    width = width || 70;
    var h = [];
    items.forEach(function (x, i) {
      var s = x.c, idx = q ? s.toLowerCase().indexOf(q) : 0;
      if (q && idx < 0) return;
      var l = q ? s.slice(Math.max(0, idx - width), idx) : '', k = q ? s.slice(idx, idx + q.length) : '', r = q ? s.slice(idx + q.length, idx + q.length + width) : s;
      h.push('<div class="kw" data-i="' + i + '"><span class="kn">' + SW.esc(x.tag || x.L.n) + '</span><span class="kl">' + SW.esc(l) +
        '</span><span class="k">' + SW.esc(k) + '</span><span class="kr">' + SW.esc(r) + '</span></div>');
    });
    return h;
  }
  function comments(b, el) {
    var noStars = SW.store.get('an.nostars', true);
    var all = progLines(b).map(function (L) { var p = SW.parseLine(L.raw); return { L: L, c: p.comment.replace(/^\/\s?/, ''), own: !p.code.trim() && !p.labels.length, star: STARLINE.test(L.raw) }; })
      .filter(function (x) { return x.c.trim(); });
    var stars = all.filter(function (x) { return x.star; }).length;
    var cs = noStars ? all.filter(function (x) { return !x.star; }) : all;
    var freq = {};
    cs.forEach(function (x) { (x.c.toLowerCase().match(/[a-z][a-z'-]+/g) || []).forEach(function (w) { if (!STOP[w] && w.length > 2) freq[w] = (freq[w] || 0) + 1; }); });
    var top = Object.keys(freq).map(function (w) { return [w, freq[w]]; }).sort(function (a, b) { return b[1] - a[1]; }).slice(0, 40);

    var c2 = card('Keyword in context', 'Search the comments; the match is centred with its context either side. Click a line to read it in the listing.');
    var bar = SW.el('div', { class: 'toolbar', style: 'position:static;padding:0 0 8px' });
    var inp = SW.el('input', { type: 'search', placeholder: 'e.g. torpedo, gravity, hyperspace', style: 'flex:1;min-width:220px' });
    bar.appendChild(inp);
    var tog = SW.el('label', { class: 'check', title: 'The star table carries a comment on every star (their names and constellations); leave them out to hear the programmers' }, '<input type="checkbox"' + (noStars ? ' checked' : '') + '> leave out the star table (' + stars + ' star comments)');
    tog.firstChild.onchange = function (e) { SW.store.set('an.nostars', e.target.checked); render(); };
    bar.appendChild(tog);
    var count = SW.el('span', { class: 'hint' });
    bar.appendChild(count);
    c2.appendChild(bar);
    var out = SW.el('div', { class: 'kwic scroll', style: 'max-height:520px' });
    function run() {
      var q = inp.value.trim().toLowerCase(), h = kwicRows(cs, q, 80);
      count.textContent = h.length + (q ? ' matches' : ' comments');
      out.innerHTML = h.slice(0, 800).join('') || '<div class="faint">No matches.</div>';
    }
    inp.addEventListener('input', run);
    out.addEventListener('click', function (e) { var d = e.target.closest('[data-i]'); if (d) goto(cs[+d.dataset.i].L); });
    c2.appendChild(out);
    c2.style.gridColumn = '1 / -1';
    el.appendChild(c2);

    var c1 = card(cs.length + ' comments' + (noStars ? ' (star table left out)' : ''), 'Comments are where the program addresses a human reader. ' + cs.filter(function (x) { return x.own; }).length + ' stand on their own lines (headers, section titles); the rest gloss an instruction. Words used most often:');
    c1.insertAdjacentHTML('beforeend', '<div class="scroll" style="columns:2 260px;column-gap:28px;max-height:none">' + bars(top) + '</div>');
    c1.style.gridColumn = '1 / -1';
    el.appendChild(c1);
    run();
    return function () {
      return [{ type: 'p', text: cs.length + ' comments in the program text' + (noStars ? ', leaving out the ' + stars + ' comments of the star table.' : '.') },
        SW.tableBlock('Most frequent words in comments', ['Word', 'Count'], top),
        SW.tableBlock('All comments', ['Line', 'Comment', 'Reference'], cs.map(function (x) { return [String(x.L.n), x.c, SW.refOf(b.v.id, x.L.p, x.L.n, x.L.n, b.parts.length)]; }))];
    };
  }

  // ---------- 2 hands and dates ----------
  function hands(b, el) {
    var rows = [];
    allLines(b).forEach(function (L) {
      var s = L.raw, dates = s.match(/\b\d{1,2}\/\d{1,2}\/\d{2,4}\b|\b\d{4}-\d{2}-\d{2}\b|\b\d{1,2} (?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]* \d{2,4}\b/gi);
      var hs = SW.handsIn(s);
      if (hs.length || dates) rows.push({ L: L, hands: hs, dates: dates || [], src: b.parts[L.p].src });
    });
    var c = card('Signatures and dates', 'Initials and dates as the programmers and later editors left them. Titles are the first line of each tape; later annotations (reconstruction notes, museum logs) are part of the text’s history too.');
    var t = SW.table(['File', 'Line', 'Hand', 'Date', 'Text', 'Reference'], rows.map(function (r) {
      return [r.src, r.L.n, r.hands.map(function (h) { return h + ' (' + SW.handOf(h).who + ')'; }).join(', '), r.dates.join(', '), r.L.raw.trim(), SW.refOf(b.v.id, r.L.p, r.L.n, r.L.n, b.parts.length)];
    }), { cls: ['mono', 'num', '', 'mono', 'mono', 'mono'], onRow: function (r) { var x = rows.filter(function (y) { return y.L.n === r[1] && y.src === r[0]; })[0]; if (x) goto(x.L); } });
    var s = SW.el('div', { class: 'scroll' }); s.appendChild(t); c.appendChild(s);
    c.style.gridColumn = '1 / -1';
    el.appendChild(c);
    return function () { return [SW.tableBlock('Signatures and dates', ['File', 'Line', 'Hand', 'Date', 'Text'], t.getRows())]; };
  }

  // ---------- 3 lexicon ----------
  function lexicon(b, el) {
    if (!b.asm) return null;
    var rows = b.asm.symbols.filter(function (s) { return s.defs.length && b.parts[s.defs[0].file].role === 'program'; }).map(function (s) {
      var d = s.defs[0], L = b.lines[d.file][d.line - 1], cm = L ? SW.parseLine(L.raw).comment.replace(/^\/\s?/, '') : '';
      return [s.name, s.variable ? 'variable' : s.label ? 'label' : 'defined', s.refs.length, d.line, cm, SW.refOf(b.v.id, d.file, d.line, d.line, b.parts.length)];
    }).sort(function (a, b) { return b[2] - a[2]; });
    var c = card(rows.length + ' names', 'Every symbol the program defines, with how often it is used and the comment beside its definition: a glossary written by the code itself. Three letters was the working length; the names are abbreviations of a world (ships, torpedoes, the star, the sky).');
    var s = SW.el('div', { class: 'scroll', style: 'max-height:520px' });
    s.appendChild(SW.table(['Name', 'Kind', 'Uses', 'Defined at', 'Comment at definition', 'Reference'], rows, { cls: ['mono', '', 'num', 'num', '', 'mono'], onRow: function (r) { goto(b.lines[b.sym[r[0]].defs[0].file][r[3] - 1]); } }));
    c.appendChild(s); c.style.gridColumn = '1 / -1';
    el.appendChild(c);
    return function () { return [SW.tableBlock('Lexicon', ['Name', 'Kind', 'Uses', 'Defined at line', 'Comment at definition', 'Reference'], rows)]; };
  }

  // ---------- 4 rules made adjustable ----------
  function adjustable(b, el) {
    var ls = progLines(b), consts = [], switches = [], tw = [];
    ls.forEach(function (L) {
      var m = /^\s*([a-z0-9]+),\s*([0-7]+),\s*([^\/]*?)\s*(\/.*)?$/i.exec(L.raw);
      if (m) consts.push([m[1], m[2], m[3].replace(/\s+/g, ' '), (m[4] || '').replace(/^\/\s*/, ''), L]);
      var p = SW.parseLine(L.raw), code = p.code.toLowerCase();
      if (/\bszs\b|senseswitch/.test(code)) switches.push([L.n, p.code.trim(), p.comment.replace(/^\/\s?/, ''), L]);
      if (/\blat\b|\biot\s+1?11\b/.test(code)) tw.push([L.n, p.code.trim(), p.comment.replace(/^\/\s?/, ''), L]);
    });
    var c1 = card('The constants block', 'Parameters placed at fixed addresses so they could be changed at the console or in the debugger. The listing notes that “all instructions are executed, and may be replaced by jda or jsp”: the rules of the game as live code.');
    c1.appendChild(SW.table(['Symbol', 'Loc', 'Value', 'Comment'], consts.map(function (r) { return r.slice(0, 4); }), { cls: ['mono', 'mono', 'mono', ''], onRow: function (r) { goto(consts.filter(function (x) { return x[0] === r[0]; })[0][4]); } }));
    var c2 = card('Sense switches', 'The console’s six switches as runtime options, read with szs.');
    c2.appendChild(SW.table(['Line', 'Code', 'Comment'], switches.map(function (r) { return r.slice(0, 3); }), { cls: ['num', 'mono', ''], onRow: function (r) { goto(switches.filter(function (x) { return x[0] === r[0]; })[0][3]); } }));
    var c3 = card('Test word and control boxes', 'Reading the front-panel test word (lat) and the control boxes (iot 11, iot 111).');
    c3.appendChild(SW.table(['Line', 'Code', 'Comment'], tw.map(function (r) { return r.slice(0, 3); }), { cls: ['num', 'mono', ''], onRow: function (r) { goto(tw.filter(function (x) { return x[0] === r[0]; })[0][3]); } }));
    [c1, c2, c3].forEach(function (c) { el.appendChild(c); });
    return function () {
      return [SW.tableBlock('The constants block', ['Symbol', 'Loc', 'Value', 'Comment'], consts.map(function (r) { return r.slice(0, 4); })),
              SW.tableBlock('Sense switches', ['Line', 'Code', 'Comment'], switches.map(function (r) { return r.slice(0, 3); })),
              SW.tableBlock('Test word and control boxes', ['Line', 'Code', 'Comment'], tw.map(function (r) { return r.slice(0, 3); }))];
    };
  }

  // ---------- 5 the machine in the code ----------
  function classify(md) {
    var op = md >> 13;
    if (op === 0o35) {
      var d = md & 0o77;
      return d === 0o07 ? 'display (dpy)' : d === 0o11 ? 'control boxes (iot 11)' : 'other i/o (iot ' + (md & 0o7777).toString(8) + ')';
    }
    if (op === 0o26 || op === 0o27) return op === 0o26 ? 'multiply (mul/mus)' : 'divide (div/dis)';
    if (op === 0o33) return 'shifts and rotates';
    if (op === 0o32) return (md & 0o70) ? 'sense switch skips' : 'skips';
    if (op === 0o37) return (md & 0o2000) ? 'test word (lat)' : 'operate';
    if (op === 0o07 || op === 0o31) return 'subroutine calls (jda, jsp)';
    if (op === 0o30) return 'jumps';
    if (op === 0o13 || op === 0o14) return 'address rewriting (dap, dip)';
    if (op === 0o04) return 'execute (xct)';
    return null;
  }
  function machine(b, el) {
    if (!b.asm) return null;
    var cnt = {}, dyn = {}, prof = SW.profile && SW.profile.build === b ? SW.profile : null;
    b.asm.words.forEach(function (w) {
      if (w.kind || b.parts[w.file].role !== 'program') return;
      var k = classify(w.val);
      if (!k) return;
      cnt[k] = (cnt[k] || 0) + 1;
      if (prof) dyn[k] = (dyn[k] || 0) + prof.exec[w.loc];
    });
    var rows = Object.keys(cnt).map(function (k) { return [k, cnt[k], prof ? dyn[k] || 0 : '']; }).sort(function (a, b) { return b[1] - a[1]; });
    var c = card('Hardware in the instruction stream', 'Instructions that touch the machine’s particular hardware or idioms, as written' + (prof ? ' and as executed in your last run' : ' (run the program to add executed counts)') + '. The PDP-1 ' + (b.v.mdv ? 'here has the automatic multiply/divide option, which the 4.x line assumes.' : 'here lacks automatic multiply/divide; multiplication is done in steps (mus, dis).'));
    c.appendChild(SW.table(['Feature', 'Words', 'Executed'], rows, { cls: ['', 'num', 'num'] }));
    el.appendChild(c);
    var timing = progLines(b).filter(function (L) { return /time|delay|wait|count/i.test(SW.parseLine(L.raw).comment); });
    var c2 = card('Time in the comments', 'Lines whose comments speak of time, delay or counting: the program managing the machine’s pace.');
    c2.appendChild(SW.table(['Line', 'Text', 'Reference'], timing.map(function (L) { return [L.n, L.raw.trim(), SW.refOf(b.v.id, L.p, L.n, L.n, b.parts.length)]; }), { cls: ['num', 'mono', 'mono'], onRow: function (r) { goto(timing.filter(function (L) { return L.n === r[0]; })[0]); } }));
    el.appendChild(c2);
    return function () { return [SW.tableBlock('Hardware in the instruction stream', ['Feature', 'Words', 'Executed'], rows), SW.tableBlock('Time in the comments', ['Line', 'Text', 'Reference'], timing.map(function (L) { return [L.n, SW.refOf(b.v.id, L.p, L.n, L.n, b.parts.length) + '  ' + L.raw.trim()]; }))]; };
  }

  // ---------- 6 where the time goes ----------
  function timeGoes(b, el) {
    var prof = SW.profile && SW.profile.build === b ? SW.profile : null;
    var c = card('Where the machine’s time goes', prof ? 'From your last run (' + (prof.cycles / 200000).toFixed(2) + ' s of machine time, ' + prof.instructions.toLocaleString('en-GB') + ' instructions). Share of instructions by routine.' : 'Run the program in the Run view for a few seconds (play, or let it idle), then return here.');
    if (!prof) { el.appendChild(c); return null; }
    var labs = Object.keys(b.labelAt).map(Number).sort(function (x, y) { return x - y; });
    function rof(a) { var r = '(start)'; for (var i = 0; i < labs.length && labs[i] <= a; i++) r = b.labelAt[labs[i]]; return r; }
    var agg = {}, tot = 0;
    for (var a = 0; a < 4096; a++) if (prof.exec[a]) { var r = rof(a); agg[r] = (agg[r] || 0) + prof.exec[a]; tot += prof.exec[a]; }
    var rows = Object.keys(agg).map(function (k) { return [k, agg[k]]; }).sort(function (x, y) { return y[1] - x[1]; });
    c.insertAdjacentHTML('beforeend', '<div class="scroll">' + bars(rows.slice(0, 30).map(function (r) { return [r[0], +(100 * r[1] / tot).toFixed(1)]; })) + '</div><p class="hint">Percentages of executed instructions.</p>');
    el.appendChild(c);
    return function () { return [SW.tableBlock('Share of executed instructions by routine', ['Routine', 'Instructions', '%'], rows.map(function (r) { return [r[0], r[1], (100 * r[1] / tot).toFixed(2)]; }))]; };
  }

  // ---------- 16 Art's Dynamic Profile Gizmo ----------
  // A profile in the professional sense (after a letter from Art Schwarz): the
  // run as a graph whose nodes are blocks of sequential code and whose edges are
  // the branches taken between them, with the time spent in each block. A block
  // begins where a branch arrives (or at the first instruction run) and ends at
  // an instruction that branched (or the last). The emulator records, for the
  // last run in Run, the instructions stepped and cycles spent at each address
  // and every transfer of control other than to the next address.
  function flowBlocks(b, prof) {
    var steps = prof.steps, cyc = prof.cyc, br = prof.branches, out = {}, into = {};
    br.forEach(function (n, k) { var f = Math.floor(k / 4096), t = k % 4096; out[f] = (out[f] || 0) + n; into[t] = 1; });
    var entry = prof.entry >= 0 ? prof.entry : b.asm.start;
    into[entry] = 1;
    var blocks = [], at = new Int32Array(4096).fill(-1), cur = null;
    for (var a = 0; a < 4096; a++) {
      if (!steps[a]) { cur = null; continue; }
      if (!cur || into[a] || out[a - 1]) { cur = { i: blocks.length, a0: a, a1: a, steps: 0, cyc: 0, entries: Math.round(steps[a]) }; blocks.push(cur); }
      cur.a1 = a; cur.steps += steps[a]; cur.cyc += cyc[a]; at[a] = cur.i;
    }
    var edges = {};
    function edge(f, t, n, kind) { var k = f + '>' + t; (edges[k] = edges[k] || { f: f, t: t, n: 0, kind: kind }).n += n; }
    br.forEach(function (n, k) { var f = at[Math.floor(k / 4096)], t = at[k % 4096]; if (f >= 0 && t >= 0) edge(f, t, Math.round(n), 'branch'); });
    blocks.forEach(function (bl) {   // falling through into the next block
      var ft = steps[bl.a1] - (out[bl.a1] || 0), nx = at[(bl.a1 + 1) & 4095];
      if (Math.round(ft) > 0 && nx >= 0 && nx !== bl.i) edge(bl.i, nx, Math.round(ft), 'fall');
    });
    var labs = Object.keys(b.labelAt).map(Number).sort(function (x, y) { return x - y; });
    function nameOf(a) {   // its label, or the nearest label before it and how far on
      if (a in b.labelAt) return b.labelAt[a];
      var l = -1; for (var i = 0; i < labs.length && labs[i] <= a; i++) l = labs[i];
      return l < 0 ? SW.oct(a, 4) : b.labelAt[l] + '+' + (a - l);
    }
    blocks.forEach(function (bl) {
      bl.name = nameOf(bl.a0);
      var s0 = b.srcOf(bl.a0), s1 = b.srcOf(bl.a1);
      bl.src = s0 ? { p: s0.p, n0: s0.n, n1: s1 && s1.p === s0.p ? s1.n : s0.n } : null;
    });
    return { blocks: blocks, edges: Object.keys(edges).map(function (k) { return edges[k]; }), entry: at[entry], total: blocks.reduce(function (t, x) { return t + x.cyc; }, 0) };
  }
  // A sample run for the gizmo, without the Run view: the program run on its own
  // emulator for some seconds of machine time, both ships flown by Lensman AI
  // where the version allows, in slices so the page stays responsive.
  var sampling = null;
  // machine time, from memory cycles (5 µs each)
  // names a reader gives to blocks and routines, kept in this browser: version -> address -> name
  function gzName(vid, a0) { return ((SW.store.get('gz.names', {}) || {})[vid] || {})[a0] || ''; }
  function gzSetName(vid, a0, name) { var all = SW.store.get('gz.names', {}) || {}; all[vid] = all[vid] || {}; if (name) all[vid][a0] = name; else delete all[vid][a0]; SW.store.set('gz.names', all); }
  // A block or routine's heading: your name for it, its own label beside it in grey brackets
  function gzTitle(nm, real) { return nm ? SW.esc(nm) + ' <span class="gz-real">(' + SW.esc(real) + ')</span>' : SW.esc(real); }
  // in a graph box: the name cut to the room left beside the time (the box's own label goes on its second line)
  function gzFit(name, room) { var n = Math.max(3, Math.floor(room / 7.2)); return name.length > n ? name.slice(0, n - 1) + '…' : name; }
  function gzNameField(cur, label) { return '<label class="gz-name" title="Your name for it, kept in this browser and shown in the graph in place of ' + SW.esc(label) + '">Name <input type="text" maxlength="40" value="' + SW.esc(cur) + '" placeholder="' + SW.esc(label) + '"></label>'; }
  function gzN(n) { return Math.round(n || 0).toLocaleString('en-GB'); }
  function gzMs(cycles) { var ms = (cycles || 0) * 5 / 1000; return (ms >= 100 ? Math.round(ms).toLocaleString('en-GB') : ms >= 10 ? ms.toFixed(1) : ms.toFixed(2)) + ' ms'; }
  function sampleRun(b, secs, styles, useAI, progress) {
    return SW.controlMap(b.v.id).then(function (m) { return m; }, function () { return null; }).then(function (m) {
      var C = root.PDP1CPU, cpu = new C.PDP1(SW.cpuOpts(b.v));
      cpu.load(b.asm.memory, b.asm.start); cpu.tw = 0; cpu.control = 0;
      var ai = !!(useAI && m && !b.v.ctlLoad && b.sym.nth && b.sym.ndx && SW.ai);
      var pilots = ai ? [0, 1].map(function (j) { return SW.ai.pilot(b, j, m[j], styles[j]); }) : [];
      var ml0 = b.sym.ml0 ? b.sym.ml0.val : -1, end = Math.round(secs * 200000);
      return new Promise(function (done) {
        (function slice() {
          var stop = Math.min(end, cpu.cycles + 200000);
          while (cpu.cycles < stop && !cpu.halted) {
            if (cpu.pc === ml0 && pilots.length) { var bits = 0; pilots.forEach(function (p) { if (p) bits |= p(cpu.mem); }); cpu.control = bits; }
            cpu.step();
          }
          progress(cpu.cycles / end);
          if (cpu.cycles < end && !cpu.halted && sampling) setTimeout(slice, 0);
          else done({ build: b, exec: cpu.execCount, read: cpu.readCount, write: cpu.writeCount, lastWriter: cpu.lastWriter,
                      steps: cpu.stepCount, cyc: cpu.cycCount, branches: cpu.branches, cycles: cpu.cycles, instructions: cpu.instructions,
                      entry: cpu.entry, sample: { secs: secs, ai: ai, styles: styles.slice() } });
        })();
      });
    });
  }
  function gzMode(mode) {
    return '<span class="seg-btns gz-mode"><button class="btn' + (mode === 'profile' ? ' on' : '') + '" data-gzm="profile" title="This version as it runs: the blocks it passed through and the time in each">Profile</button><button class="btn' + (mode === 'compare' ? ' on' : '') + '" data-gzm="compare" title="This version against another, by the structure of their code: blocks between branches, and the branches">⇄ Compare</button>' +
      '<button class="btn' + (mode === 'across' ? ' on' : '') + '" data-gzm="across" title="Every routine traced through the versions, each version against the one it was made from">☰ Across the versions</button></span>';
  }
  function gzModeWire(bar) {
    bar.addEventListener('click', function (e) { var m = e.target.closest('[data-gzm]'); if (m) { SW.store.set('an.gizmoMode', m.dataset.gzm); render(); } });
  }
  // Several sample runs, averaged (Lensman AI flies a little differently each time); each run's
  // cycles kept, for the range of a block's or routine's time over the runs
  function sampleRuns(b, secs, styles, useAI, runs, progress) {
    var ps = [];
    function next(k) {
      if (k >= runs || (k && !sampling)) return Promise.resolve();
      return sampleRun(b, secs, styles, useAI, function (f) { progress((k + f) / runs); }).then(function (p) { ps.push(p); return next(k + 1); });
    }
    return next(0).then(function () {
      var n = ps.length, P = ps[0];
      if (n === 1) { P.runCyc = [P.cyc]; return P; }
      var steps = new Float64Array(4096), cyc = new Float64Array(4096), exec = new Float64Array(4096), br = new Map();
      ps.forEach(function (p) {
        for (var a = 0; a < 4096; a++) { steps[a] += p.steps[a] / n; cyc[a] += p.cyc[a] / n; exec[a] += p.exec[a] / n; }
        p.branches.forEach(function (v, k) { br.set(k, (br.get(k) || 0) + v / n); });
      });
      return { build: P.build, exec: exec, read: P.read, write: P.write, lastWriter: P.lastWriter, steps: steps, cyc: cyc, branches: br,
               cycles: ps.reduce(function (t, p) { return t + p.cycles; }, 0) / n, instructions: Math.round(ps.reduce(function (t, p) { return t + p.instructions; }, 0) / n),
               entry: P.entry, sample: Object.assign({}, P.sample, { runs: n }), runCyc: ps.map(function (p) { return p.cyc; }) };
    });
  }
  // the range of a stretch's time over the runs, in ms (empty for one run)
  function gzRange(runCyc, ranges) {
    if (!runCyc || runCyc.length < 2) return '';
    var v = runCyc.map(function (c) { var t = 0; ranges.forEach(function (r) { for (var a = r[0]; a <= r[1]; a++) t += c[a]; }); return t * 5 / 1000; });
    var lo = Math.min.apply(null, v), hi = Math.max.apply(null, v), f = function (x) { return x >= 100 ? Math.round(x) : x >= 10 ? x.toFixed(1) : x.toFixed(2); };
    return f(lo) + '–' + f(hi) + ' ms over ' + v.length + ' runs';
  }
  function gizmo(b, el) {
    if (SW.store.get('an.gizmoMode', 'profile') === 'compare' && SW.structure) return gizmoCompare(b, el);
    if (SW.store.get('an.gizmoMode', 'profile') === 'across' && SW.structure) return gizmoAcross(b, el);
    gzWrite({ gz: 'profile' });
    var prof = SW.profile && SW.profile.build === b && SW.profile.branches && SW.profile.instructions ? SW.profile : null;
    var lede = 'A profile in the professional sense, after Art Schwarz: the run drawn as a graph. Each node is a block of sequential code; each edge a branch taken between blocks. A block begins where a branch arrives, or at the first instruction run, and ends at an instruction that branched, or at the last. The time is the machine’s, in 5 µs memory cycles, summed over everything between branches.';
    var legend = 'Darker blocks take more of the time; the rounded block is where the run began. Solid edges are branches, dashed ones falling through into a block a branch also reaches, dotted ones a way through blocks left out; thicker for more often. An edge up or across returns to a block drawn above (a loop). Click a block for its code, the instructions it ran and where it branches.';
    var c = SW.el('div', { class: 'card gz-card' });
    c.style.gridColumn = '1 / -1';
    el.appendChild(c);
    var secs = SW.store.get('an.gizmoSecs', 10), cover = SW.store.get('an.gizmoCover', 0.9), runs = SW.store.get('an.gizmoRuns', 3);
    var SN = SW.ai ? SW.ai.STYLE_NAMES : [['duellist', 'duellist']];
    var styles = [0, 1].map(function (j) { var v = SW.store.get('an.gizmoStyle' + j, 'duellist'); return SN.some(function (o) { return o[0] === v; }) ? v : 'duellist'; });
    var useAI = SW.store.get('an.gizmoAI', true);
    function styleSel(j) { return '<label class="check" title="How Lensman AI flies ' + (j ? 'the Wedge' : 'the Needle') + ' in the sample run: a hunter chases hard and closes in; an orbiter keeps its distance and fires from its orbit; a duellist is between">' + (j ? 'Wedge' : 'Needle') + ' <select class="gz-style" data-j="' + j + '">' + SN.map(function (o) { return '<option value="' + o[0] + '"' + (o[0] === styles[j] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select></label>'; }
    var F = prof ? flowBlocks(b, prof) : null, B = F ? F.blocks : [], tot = F ? F.total || 1 : 1;
    var from = prof ? (prof.sample ? 'sample run' + (prof.sample.runs > 1 ? ' ×' + prof.sample.runs + ', averaged' : '') + ', ' + (prof.sample.ai ? 'Lensman AI: Needle ' + (prof.sample.styles || ['duellist'])[0] + ', Wedge ' + (prof.sample.styles || ['', 'duellist'])[1] : 'no one at the controls') : 'your run in Run') : '';
    var bar = SW.el('div', { class: 'gz-bar' });
    bar.innerHTML = gzMode('profile') + '<span class="sep"></span><button class="btn gz-run" title="Run the program here for the time chosen and draw the graph from that run">▶ Sample run</button>' +
      '<select class="gz-secs" title="How long to run, in machine time">' + [5, 10, 30, 60].map(function (n) { return '<option value="' + n + '"' + (n === secs ? ' selected' : '') + '>' + n + ' s</option>'; }).join('') + '</select>' +
      '<select class="gz-runs" title="How many runs to average (the computer pilot flies a little differently each time); the times show their range over the runs">' + [1, 3, 5].map(function (n) { return '<option value="' + n + '"' + (n === runs ? ' selected' : '') + '>× ' + n + '</option>'; }).join('') + '</select>' +
      '<span class="gz-ai' + (useAI ? '' : ' off') + '" title="Lensman AI, the bench’s computer pilot, flies both ships in the sample run. Off, no one is at the controls: the ships only drift under gravity"><label class="check"><input type="checkbox" class="gz-ai-on"' + (useAI ? ' checked' : '') + '> Lensman AI</label>' + styleSel(0) + styleSel(1) + '</span>' +
      (prof ? '<span class="sep"></span><label class="check" title="The busiest blocks that together take this share of the time">Show <select class="gz-cover">' + [[0.8, '80%'], [0.9, '90%'], [0.95, '95%'], [0.99, '99%'], [1, '100%']].map(function (o) { return '<option value="' + o[0] + '"' + (o[0] === cover ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select> of the time</label>' : '') +
      '<span class="gz-src hint">' + (prof ? B.length + ' blocks · ' + F.edges.length + ' edges · ' + (prof.cycles / 200000).toFixed(2) + ' s · ' + prof.instructions.toLocaleString('en-GB') + ' instructions · ' + from : 'Press ▶ Sample run, or play the game in Run and come back.') + '</span>' +
      (prof ? '<details class="gz-about"><summary title="What the graph shows and how to read it">About</summary><div class="gz-about-b"><p>' + lede + '</p><p>' + legend + '</p></div></details>' : '');
    c.appendChild(bar);
    gzModeWire(bar);
    if (!prof) c.insertAdjacentHTML('beforeend', '<p class="lede">' + lede + '</p>');
    var gb = bar.querySelector('.gz-run'), gs = bar.querySelector('.gz-secs'), src = bar.querySelector('.gz-src');
    gs.addEventListener('change', function () { secs = +gs.value; SW.store.set('an.gizmoSecs', secs); });
    bar.querySelector('.gz-runs').addEventListener('change', function (e) { runs = +e.target.value; SW.store.set('an.gizmoRuns', runs); dynCache = {}; });
    SW.$$('.gz-style', bar).forEach(function (x) { x.disabled = !useAI; x.addEventListener('change', function () { styles[+x.dataset.j] = x.value; SW.store.set('an.gizmoStyle' + x.dataset.j, x.value); }); });
    bar.querySelector('.gz-ai-on').addEventListener('change', function (e) {
      useAI = e.target.checked; SW.store.set('an.gizmoAI', useAI);
      bar.querySelector('.gz-ai').classList.toggle('off', !useAI);
      SW.$$('.gz-style', bar).forEach(function (x) { x.disabled = !useAI; });
    });
    gb.addEventListener('click', function () {
      if (sampling) { sampling = null; return; }   // a second press stops it
      sampling = {}; gb.textContent = '■ Stop'; gs.disabled = true; SW.$$('.gz-style, .gz-ai-on', bar).forEach(function (x) { x.disabled = true; });
      sampleRuns(b, secs, styles, useAI, runs, function (f) { src.textContent = 'Running… ' + Math.round(100 * f) + '%'; }).then(function (p) {
        sampling = null;
        if (build !== b) return;
        SW.profile = p; SW.emit('profile');
        render();
      });
    });
    if (!prof) return null;
    var ctl = bar;
    var box = SW.el('div', { class: 'svgbox gizmo' }), figs = SW.el('div');
    c.appendChild(box); c.appendChild(figs);
    var lastSVG = '';
    function draw() {
      var order = B.slice().sort(function (x, y) { return y.cyc - x.cyc; }), shown = {}, acc = 0;
      for (var i = 0; i < order.length && (acc < cover * tot || cover >= 1) && i < 400; i++) { shown[order[i].i] = 1; acc += order[i].cyc; }
      if (F.entry >= 0) shown[F.entry] = 1;
      // depth from the first block, by the branches taken (shortest path)
      var adj = {}, depth = {};
      F.edges.forEach(function (e) { (adj[e.f] = adj[e.f] || []).push(e.t); });
      var q = [F.entry >= 0 ? F.entry : order[0].i]; depth[q[0]] = 0;
      while (q.length) { var u = q.shift(); (adj[u] || []).forEach(function (v) { if (depth[v] == null) { depth[v] = depth[u] + 1; q.push(v); } }); }
      var ids = Object.keys(shown).map(Number);
      ids.sort(function (x, y) { return ((depth[x] == null ? 1e9 : depth[x]) - (depth[y] == null ? 1e9 : depth[y])) || (B[x].a0 - B[y].a0); });
      // rows by depth, at most seven to a row
      var rows = [], lastD = null;
      ids.forEach(function (id) { var d = depth[id] == null ? 1e9 : depth[id]; if (d !== lastD || rows[rows.length - 1].length >= 7) { rows.push([]); lastD = d; } rows[rows.length - 1].push(id); });
      var E = F.edges.filter(function (e) { return shown[e.f] && shown[e.t]; }), pos = {};
      // a path through blocks left out becomes one dotted edge between the blocks shown
      var via = {};
      ids.forEach(function (sid) {
        (adj[sid] || []).forEach(function (h) {
          if (shown[h]) return;
          var seen = {}, st = [h], n = 0; seen[h] = 1;
          var first = F.edges.filter(function (e) { return e.f === sid && e.t === h; })[0];
          while (st.length && n++ < 300) {
            var u = st.pop();
            (adj[u] || []).forEach(function (v) {
              if (shown[v]) { var k = sid + '>' + v; via[k] = via[k] || { f: sid, t: v, n: 0, kind: 'via' }; via[k].n += first ? first.n : 0; }
              else if (!seen[v]) { seen[v] = 1; st.push(v); }
            });
          }
        });
      });
      Object.keys(via).forEach(function (k) { if (!E.some(function (e) { return e.f === via[k].f && e.t === via[k].t; })) E.push(via[k]); });
      function place() { rows.forEach(function (r, ri) { r.forEach(function (id, k) { pos[id] = { r: ri, k: k }; }); }); }
      place();
      for (var sweep = 0; sweep < 4; sweep++) {   // order each row by where its neighbours sit
        rows.forEach(function (r, ri) {
          if (!ri) return;
          var bc = {};
          r.forEach(function (id) {
            var xs = E.filter(function (e) { return (e.t === id && pos[e.f].r < ri) || (e.f === id && pos[e.t].r < ri); }).map(function (e) { var o = e.t === id ? e.f : e.t; return pos[o].k - (rows[pos[o].r].length - 1) / 2; });
            bc[id] = xs.length ? xs.reduce(function (s, x) { return s + x; }, 0) / xs.length : 0;
          });
          r.sort(function (x, y) { return bc[x] - bc[y]; });
        });
        place();
      }
      var NW = 176, NH = 46, GX = 26, GY = 52, wmax = Math.max.apply(null, rows.map(function (r) { return r.length; })), W = wmax * (NW + GX) + 140, H = rows.length * (NH + GY) + 30;
      function xy(id) { var p = pos[id], r = rows[p.r]; return { x: 40 + (W - 140 - r.length * (NW + GX)) / 2 + p.k * (NW + GX), y: 20 + p.r * (NH + GY) }; }
      var nmax = E.reduce(function (m, e) { return Math.max(m, e.n); }, 1), smax = ids.reduce(function (m, id) { return Math.max(m, B[id].cyc); }, 1);
      var o = ['<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '"><rect width="' + W + '" height="' + H + '" fill="var(--surface)"/>',
        '<defs><marker id="gz-ar" viewBox="0 0 8 8" refX="7" refY="4" markerUnits="userSpaceOnUse" markerWidth="9" markerHeight="9" orient="auto-start-reverse"><path d="M0 0L8 4L0 8z" fill="var(--text-dim)"/></marker></defs>'];
      E.forEach(function (e) {
        var a = xy(e.f), z = xy(e.t), sw = (0.8 + 3.2 * Math.log(1 + e.n) / Math.log(1 + nmax)).toFixed(2), d;
        var tip = B[e.f].name + ' → ' + B[e.t].name + (e.kind === 'via' ? ': through blocks left out' : ': ' + e.n.toLocaleString('en-GB') + ' time' + (e.n === 1 ? '' : 's') + (e.kind === 'fall' ? ' (falling through)' : ''));
        if (e.f === e.t) d = 'M' + (a.x + NW) + ' ' + (a.y + 14) + ' c 26 -10 26 28 0 18';
        else if (pos[e.t].r > pos[e.f].r) d = 'M' + (a.x + NW / 2) + ' ' + (a.y + NH) + ' C ' + (a.x + NW / 2) + ' ' + (a.y + NH + GY * 0.6) + ' ' + (z.x + NW / 2) + ' ' + (z.y - GY * 0.6) + ' ' + (z.x + NW / 2) + ' ' + (z.y - 1);
        else { var bx = Math.max(a.x, z.x) + NW + 24 + 10 * (pos[e.f].r - pos[e.t].r); d = 'M' + (a.x + NW) + ' ' + (a.y + NH / 2 + 6) + ' C ' + bx + ' ' + (a.y + NH / 2 + 6) + ' ' + bx + ' ' + (z.y + NH / 2 - 6) + ' ' + (z.x + NW + 1) + ' ' + (z.y + NH / 2 - 6); }
        o.push('<path d="' + d + '" fill="none" stroke="var(--text-dim)" stroke-opacity="0.75" stroke-width="' + sw + '"' + (e.kind === 'fall' ? ' stroke-dasharray="4 3"' : e.kind === 'via' ? ' stroke-dasharray="1 3" stroke-linecap="round"' : '') + ' marker-end="url(#gz-ar)"><title>' + SW.esc(tip) + '</title></path>');
      });
      ids.forEach(function (id) {
        var bl = B[id], p = xy(id), sh = bl.cyc / tot, heat = Math.round(8 + 62 * Math.sqrt(bl.cyc / smax));
        var lines = bl.src ? (bl.src.n1 !== bl.src.n0 ? 'lines ' + bl.src.n0 + '–' + bl.src.n1 : 'line ' + bl.src.n0) : SW.oct(bl.a0, 4);
        o.push('<g class="gz-node" data-b="' + id + '" style="cursor:pointer"><title>' + SW.esc((gzName(b.v.id, bl.a0) ? gzName(b.v.id, bl.a0) + ': ' : '') + bl.name + ' (' + SW.oct(bl.a0, 4) + '–' + SW.oct(bl.a1, 4) + '), ' + (bl.a1 - bl.a0 + 1) + ' instructions; entered ' + bl.entries.toLocaleString('en-GB') + ' times; ' + (100 * sh).toFixed(2) + '% of the time') + '</title>' +
          '<rect x="' + p.x + '" y="' + p.y + '" width="' + NW + '" height="' + NH + '" rx="' + (id === F.entry ? 14 : 4) + '" fill="var(--surface)"/>' +
          '<rect x="' + p.x + '" y="' + p.y + '" width="' + NW + '" height="' + NH + '" rx="' + (id === F.entry ? 14 : 4) + '" fill="var(--amber)" fill-opacity="' + (heat / 100).toFixed(2) + '" stroke="var(--text-dim)" stroke-width="1"/>' +
          '<text x="' + (p.x + 8) + '" y="' + (p.y + 18) + '" font-family="monospace" font-size="12" font-weight="700" fill="var(--text)">' + SW.esc(gzFit(gzName(b.v.id, bl.a0) || bl.name, NW - 24 - 6.6 * gzMs(bl.cyc).length)) + '</text>' +
          '<text x="' + (p.x + NW - 8) + '" y="' + (p.y + 18) + '" text-anchor="end" font-family="sans-serif" font-size="11.5" fill="var(--text)" font-weight="700">' + gzMs(bl.cyc) + '</text>' +
          '<text x="' + (p.x + 8) + '" y="' + (p.y + 36) + '" font-family="sans-serif" font-size="10.5" fill="var(--text-dim)">' + SW.esc((gzName(b.v.id, bl.a0) ? '(' + bl.name + ') · ' : '') + lines) + ' · ×' + bl.entries.toLocaleString('en-GB') + '</text></g>');
      });
      o.push('</svg>');
      lastSVG = o.join('');
      box.innerHTML = SW.displaySVG(lastSVG);
      var hid = B.length - ids.length;
      figs.innerHTML = hid ? '<span class="hint">' + hid + ' quieter block' + (hid === 1 ? '' : 's') + ' (' + (100 * (tot - acc) / tot).toFixed(1) + '% of the time) left out; the dotted edges pass through them.</span> ' : '';
      figs.appendChild(SW.figureButtons(function () { return lastSVG; }, 'spacewar-' + b.v.id + '-dynamic-profile', SW.refText(b.v.id)));
    }
    // a block in a box: its source lines, the instructions it ran, the branches in and out
    function inRead(bl) { SW.state.sel = { p: bl.src.p, n0: bl.src.n0, n1: bl.src.n1 }; SW.emit('goto', { p: bl.src.p, n: bl.src.n0, tab: 'read' }); }
    var dlg = null;
    function openBlock(id) {
      var bl = B[id], esc = SW.esc, C = root.PDP1CPU;
      if (!dlg) {
        dlg = SW.el('dialog', { class: 'tray-big gz-dlg' });
        document.body.appendChild(dlg);
        dlg.addEventListener('click', function (e) {
          if (e.target === dlg || e.target.closest('[data-x]')) { dlg.close(); return; }
          var j = e.target.closest('[data-gb]'); if (j) { openBlock(+j.dataset.gb); return; }
          if (e.target.closest('[data-read]')) { dlg.close(); inRead(B[+dlg.dataset.b]); }
          if (e.target.closest('[data-keep]')) keepBlock(B[+dlg.dataset.b]);
        });
        dlg.addEventListener('change', function (e) {
          if (!e.target.closest('.gz-name')) return;
          var bl0 = B[+dlg.dataset.b]; gzSetName(b.v.id, bl0.a0, e.target.value.trim()); draw();
          dlg.querySelector('.tray-bighead b').innerHTML = gzTitle(e.target.value.trim(), bl0.name);
          SW.toast(e.target.value.trim() ? 'Named ' + e.target.value.trim() : 'Name cleared');
        });
        dlg.addEventListener('close', function () { dlg.remove(); dlg = null; });
      }
      dlg.dataset.b = id;
      var ref = bl.src ? SW.refText(b.v.id, bl.src.p, bl.src.n0, bl.src.n1, b.parts.length) : '';
      var src = bl.src ? b.lines[bl.src.p].slice(bl.src.n0 - 1, bl.src.n1).map(function (L) {
        return '<div class="gz-l"><span class="n">' + L.n + '</span><span class="t">' + esc(L.raw) + '</span></div>'; }).join('') : '';
      var words = [];
      for (var a = bl.a0; a <= bl.a1; a++) {
        var w = b.asm.memory[a];
        words.push('<tr><td class="mono">' + SW.oct(a, 4) + '</td><td class="mono">' + esc(w ? C.disasm(w.val, b.symAt) : '') + '</td><td class="num">' + prof.steps[a].toLocaleString('en-GB') + '</td><td class="num">' + Math.round(prof.cyc[a] * 5).toLocaleString('en-GB') + '</td></tr>');
      }
      function links(list, other) {
        return list.length ? list.sort(function (x, y) { return y.n - x.n; }).map(function (e) {
          var o = B[other(e)];
          return '<button class="btn ghost" data-gb="' + o.i + '" title="Open this block">' + esc(o.name) + ' <span class="faint">' + (e.kind === 'fall' ? 'falls through, ' : '') + '×' + e.n.toLocaleString('en-GB') + '</span></button>';
        }).join(' ') : '<span class="faint">none</span>';
      }
      var ins = F.edges.filter(function (e) { return e.t === id && e.f !== id; }), outs = F.edges.filter(function (e) { return e.f === id && e.t !== id; }), self = F.edges.filter(function (e) { return e.f === id && e.t === id; })[0];
      dlg.innerHTML = '<div class="tray-bighead"><b>' + gzTitle(gzName(b.v.id, bl.a0), bl.name) + '</b> <span class="faint mono">' + esc(ref) + '</span>' + gzNameField(gzName(b.v.id, bl.a0), bl.name) + '<span class="refhelp-acts">' +
        '<button class="btn ghost" data-keep title="This block, with its name, figures and code, in My notes (private)">＋ My notes</button>' +
        (bl.src ? '<button class="btn" data-read title="This code in Read, in its context">Read in context ↗</button>' : '') +
        '<button class="icon-btn" data-x title="Close (Esc)">✕</button></span></div>' +
        '<table class="ov-sub gz-q"><tbody>' + blockFigures(bl).map(function (r) { return '<tr><th>' + r[0] + '</th><td>' + esc(r[1]) + '</td></tr>'; }).join('') + '</tbody></table>' +
        '<p class="hint">' + (100 * bl.cyc / tot).toFixed(2) + '% of the time (' + Math.round(bl.cyc * 5).toLocaleString('en-GB') + ' µs); entered ' + bl.entries.toLocaleString('en-GB') + ' times; ' + (bl.a1 - bl.a0 + 1) + ' instruction' + (bl.a1 > bl.a0 ? 's' : '') + ' (' + SW.oct(bl.a0, 4) + '–' + SW.oct(bl.a1, 4) + ')' + (self ? '; loops on itself ×' + self.n.toLocaleString('en-GB') : '') + (id === F.entry ? '; the run began here' : '') + '.</p>' +
        '<div class="gz-cols"><div><h4>The source</h4><div class="listing gz-src-l">' + (src || '<p class="faint">No source line.</p>') + '</div></div>' +
        '<div><h4>The instructions run</h4><table class="ov-sub"><thead><tr><th>Address</th><th>As assembled</th><th>Times</th><th>µs</th></tr></thead><tbody>' + words.join('') + '</tbody></table></div></div>' +
        '<h4>Comes from</h4><p>' + links(ins, function (e) { return e.f; }) + '</p><h4>Goes to</h4><p>' + links(outs, function (e) { return e.t; }) + '</p>';
      if (!dlg.open) dlg.showModal();
    }
    function blockFigures(bl) {
      var outs = F.edges.filter(function (e) { return e.f === bl.i; }), ins = F.edges.filter(function (e) { return e.t === bl.i; });
      var rg = gzRange(prof.runCyc, [[bl.a0, bl.a1]]);
      return [['Time', gzMs(bl.cyc) + ' (' + (100 * bl.cyc / tot).toFixed(2) + '% of the run' + (prof.sample && prof.sample.runs > 1 ? ', averaged' : '') + ')' + (rg ? '; ' + rg : '')], ['Per entry', bl.entries ? (bl.cyc * 5 / bl.entries).toFixed(1) + ' µs' : ''],
        ['Entered', gzN(bl.entries) + ' times'], ['Instructions run', gzN(bl.steps)], ['Length', (bl.a1 - bl.a0 + 1) + ' instruction' + (bl.a1 > bl.a0 ? 's' : '') + ' (' + SW.oct(bl.a0, 4) + '–' + SW.oct(bl.a1, 4) + ')'],
        ['Branches in', ins.length + ' (' + gzN(ins.reduce(function (t, e) { return t + e.n; }, 0)) + ' times)'], ['Branches out', outs.length + ' (' + gzN(outs.reduce(function (t, e) { return t + e.n; }, 0)) + ' times)'],
        ['The run', (prof.cycles / 200000).toFixed(2) + ' s of machine time, ' + gzN(prof.instructions) + ' instructions']];
    }
    function keepBlock(bl) {
      if (!SW.tray) return;
      var nm = gzName(b.v.id, bl.a0), ref = bl.src ? SW.refText(b.v.id, bl.src.p, bl.src.n0, bl.src.n1, b.parts.length) : SW.refText(b.v.id);
      SW.tray.addDoc({ title: 'Block ' + (nm ? nm + ' (' + bl.name + ')' : bl.name) + ' ' + ref, subtitle: 'Art’s Dynamic Profile Gizmo, ' + b.v.label,
        blocks: [SW.tableBlock('The figures', ['', ''], blockFigures(bl))].concat(bl.src ? [{ type: 'code', caption: ref, lines: b.lines[bl.src.p].slice(bl.src.n0 - 1, bl.src.n1).map(function (L) { return { n: L.n, text: L.raw }; }) }] : []) },
        { vid: b.v.id, anchor: bl.src ? { p: bl.src.p, n0: bl.src.n0, n1: bl.src.n1, src: b.parts[bl.src.p].src } : null, tags: ['profile'] });
    }
    box.addEventListener('click', function (e) {
      var g = e.target.closest('[data-b]'); if (!g) return;
      openBlock(+g.dataset.b);
    });
    ctl.querySelector('.gz-cover').addEventListener('change', function (e) { cover = +e.target.value; SW.store.set('an.gizmoCover', cover); draw(); });
    draw();
    // the blocks and branches as tables
    var trows = B.slice().sort(function (x, y) { return y.cyc - x.cyc; }).map(function (bl) {
      return [bl.name, bl.src ? SW.refOf(b.v.id, bl.src.p, bl.src.n0, bl.src.n1, b.parts.length) : SW.oct(bl.a0, 4), bl.a1 - bl.a0 + 1, bl.entries, bl.steps, Math.round(bl.cyc * 5), +(100 * bl.cyc / tot).toFixed(2)];
    });
    var c2 = SW.el('div', { class: 'gz-sec' }); c2.innerHTML = '<h4>The blocks</h4><p class="hint">Each block of sequential code the run passed through, busiest first: its length, how often it was entered, the instructions run in it, and the time.</p>';
    var s2 = SW.el('div');
    s2.appendChild(SW.table(['Block', 'Reference', 'Length', 'Entered', 'Instructions run', 'Time (µs)', '% of time'], trows, { cls: ['mono', 'mono', 'num', 'num', 'num', 'num', 'num'], onRow: function (r) { var bl = B.filter(function (x) { return x.name === r[0]; })[0]; if (bl) openBlock(bl.i); } }));
    c2.appendChild(s2); c.appendChild(c2);
    var erows = F.edges.slice().sort(function (x, y) { return y.n - x.n; }).map(function (e) { return [B[e.f].name, B[e.t].name, e.kind === 'fall' ? 'falls through' : 'branch', e.n]; });
    var c3 = SW.el('div', { class: 'gz-sec' }); c3.innerHTML = '<h4>The branches</h4><p class="hint">Each edge between blocks, most taken first.</p>';
    var s3 = SW.el('div');
    s3.appendChild(SW.table(['From', 'To', 'How', 'Times'], erows, { cls: ['mono', 'mono', '', 'num'] }));
    c3.appendChild(s3); c.appendChild(c3);
    return function () {
      return [{ type: 'p', text: lede + ' The graph itself saves from under it, as SVG or PNG.' },
        SW.tableBlock('The blocks', ['Block', 'Reference', 'Length', 'Entered', 'Instructions run', 'Time (µs)', '% of time'], trows),
        SW.tableBlock('The branches', ['From', 'To', 'How', 'Times'], erows)];
    };
  }

  // ⇄ Compare: this version against another by the structure of their code
  // (structure.js): blocks between branches read from the assembled code, with
  // the jumps the code does not name taken from a 5 s sample run of each.
  var dynCache = {};
  function dynOf(b) {
    if (dynCache[b.v.id]) return Promise.resolve(dynCache[b.v.id]);
    sampling = sampling || {};
    return sampleRuns(b, 5, ['duellist', 'duellist'], true, SW.store.get('an.gizmoRuns', 3), function () {}).then(function (p) { dynCache[b.v.id] = p; return p; });
  }
  // ☰ Across the versions: each version compared with the one it was made from (its parent in the
  // descent), routines followed from parent to child; a row for each routine, a column for each version
  // a sample run as Compare makes it, for the comparison tests (tests/compare.html)
  SW.gzSample = function (bv) { sampling = sampling || {}; return sampleRun(bv, 5, ['duellist', 'duellist'], true, function () {}).then(function (p) { sampling = null; return p; }); };
  var acrossCache = {};
  function gizmoAcross(b, el) {
    var V = root.SWVersions, ST = SW.structure, esc = SW.esc, split = !!SW.store.get('an.gizmoSplit', false);
    gzWrite({ gz: 'across', split: split ? 1 : null });
    var c = SW.el('div', { class: 'card gz-card' }); c.style.gridColumn = '1 / -1'; el.appendChild(c);
    var bar = SW.el('div', { class: 'gz-bar' });
    bar.innerHTML = gzMode('across') + '<span class="sep"></span><label class="check" title="Draw the largest routine, the main loop, as its labelled parts"><input type="checkbox" class="gz-split"' + (split ? ' checked' : '') + '> Split the main loop</label>' +
      '<span class="gz-src hint">Reading every version…</span>' +
      '<details class="gz-about"><summary>About</summary><div class="gz-about-b"><p>Each version is compared with the one it was made from (its parent in the descent: 4.2 from dfw’s 4.1, 4.8 from 4.1, 4.0TS a side branch), by the structure of its code, as ⇄ Compare does; a routine is followed from parent to child. Witnesses (another text of the same version) are left out. The jumps the code does not name come from one 5 s sample run of each version.</p><p>● the same as in its parent · ◐ altered · ↪ moved (its code from another routine) · ＋ new · × gone (in the version that lost it). Click a cell for that version against its parent, the routine open.</p></div></details>';
    c.appendChild(bar); gzModeWire(bar);
    bar.querySelector('.gz-split').addEventListener('change', function (e) { SW.store.set('an.gizmoSplit', e.target.checked); render(); });
    var src = bar.querySelector('.gz-src'), body = SW.el('div', { class: 'gz-across' }); c.appendChild(body);
    // the versions in order of descent, depth first from the earliest
    var vs = V.VERSIONS.filter(function (v) { return v.build && !v.witnessOf && v.id !== 'stars'; });
    var kids = {}; vs.forEach(function (v) { var pid = v.parent && vs.some(function (x) { return x.id === v.parent; }) ? v.parent : ''; (kids[pid] = kids[pid] || []).push(v); });
    Object.keys(kids).forEach(function (k) { kids[k].sort(function (x, y) { return x.sort - y.sort; }); });
    var order = []; (function walk(pid) { (kids[pid] || []).forEach(function (v) { order.push(v); walk(v.id); }); })('');
    var out = { rows: [], head: [] };
    var key = order.map(function (v) { return v.id; }).join(',');
    (acrossCache[key] ? Promise.resolve(acrossCache[key]) : (function () {
      var G = {}, k = 0;
      return order.reduce(function (p, v) {
        return p.then(function () {
          src.textContent = 'Reading ' + SW.refOf(v.id) + ' (' + (++k) + ' of ' + order.length + ')…';
          return SW.build(v.id).then(function (bv) {
            if (!bv.asm) return;
            sampling = sampling || {};
            return sampleRun(bv, 5, ['duellist', 'duellist'], true, function () {}).then(function (d) { G[v.id] = ST.graph(bv, d); });
          }, function () {});
        });
      }, Promise.resolve()).then(function () { sampling = null; acrossCache[key] = G; return G; });
    })()).then(function (G) {
      if (build !== b) return;
      var cols = order.filter(function (v) { return G[v.id]; }), lineOf = {}, lines = [], R = {};
      cols.forEach(function (v) { R[v.id] = ST.routines(G[v.id], { split: split }); });
      cols.forEach(function (v, ci) {
        var par = v.parent && G[v.parent] ? v.parent : null, cr = null, cell = {};
        if (par) cr = ST.compareRoutines(ST.compare(G[par], G[v.id]), { split: split });
        if (cr) cr.rows.forEach(function (row) {
          if (row.b) cell[row.b.i] = row;
          else if (row.a && lineOf[par + ':' + row.a.i] != null) lines[lineOf[par + ':' + row.a.i]].cells[v.id] = { k: 'gone', name: row.a.name };
        });
        cr && cr.RB.list.forEach(function (r, i) { R[v.id].list[i] = r; });   // the same routines the comparison found
        R[v.id].list.forEach(function (r) {
          var row = cell[r.i], li = row && row.a && lineOf[par + ':' + row.a.i] != null ? lineOf[par + ':' + row.a.i] : null;
          // new here: joins a row of the same name not yet in this column (a sibling or another branch has it), else starts one
          if (li == null) for (var q = 0; q < lines.length; q++) if (lines[q].name === r.name && !lines[q].cells[v.id]) { li = q; break; }
          if (li == null) { li = lines.length; lines.push({ name: r.name, first: ci, a0: r.a0, cells: {} }); }
          lineOf[v.id + ':' + r.i] = li;
          lines[li].cells[v.id] = { k: !par || !row || row.kind === 'inserted' ? 'new' : row.kind, name: r.name };
        });
      });
      lines.sort(function (x, y) { return (x.first - y.first) || (x.a0 - y.a0); });
      var MARK = { same: '●', altered: '◐', moved: '↪', new: '＋', gone: '×' };
      var TIP = { same: 'the same as in its parent', altered: 'altered from its parent', moved: 'moved: its code from another routine in the parent', new: 'new in this version', gone: 'gone: in the parent, not here' };
      src.textContent = cols.length + ' versions · ' + lines.length + ' routines followed through them';
      body.innerHTML = '<div class="gz-acr-wrap"><table class="gz-acr"><thead><tr><th>Routine</th>' + cols.map(function (v) { return '<th title="' + esc(v.label + (v.parent ? ', made from ' + SW.refOf(v.parent) : '')) + '">' + esc(SW.refOf(v.id).replace(/^SW/, '')) + '</th>'; }).join('') + '</tr></thead><tbody>' +
        lines.map(function (ln) {
          return '<tr><th class="mono">' + esc(ln.name) + '</th>' + cols.map(function (v) {
            var cl = ln.cells[v.id]; if (!cl) return '<td></td>';
            return '<td class="ac-' + cl.k + '" data-v="' + esc(v.id) + '" data-n="' + esc(cl.name) + '" title="' + esc(cl.name + ' in ' + SW.refOf(v.id) + ': ' + TIP[cl.k] + (v.parent ? ' (' + SW.refOf(v.parent) + ')' : '')) + '">' + MARK[cl.k] + (cl.name !== ln.name && cl.k !== 'gone' ? '<i>' + esc(cl.name) + '</i>' : '') + '</td>';
          }).join('') + '</tr>';
        }).join('') + '</tbody></table></div>';
      body.onclick = function (e) {
        var td = e.target.closest('td[data-v]'); if (!td) return;
        var v = V.byId(td.dataset.v); if (!v || !v.parent) return;
        var m = SW.store.get('an.gizmoCmpBy', {}) || {}; m[v.id] = v.parent; SW.store.set('an.gizmoCmpBy', m);
        SW.store.set('an.gizmoMode', 'compare'); SW.state.gzRoutine = td.dataset.n;
        if (SW.state.v === v.id) render(); else SW.select(v.id);
      };
      out.head = ['Routine'].concat(cols.map(function (v) { return SW.refOf(v.id); }));
      out.rows = lines.map(function (ln) { return [ln.name].concat(cols.map(function (v) { var cl = ln.cells[v.id]; return cl ? MARK[cl.k] + (cl.name !== ln.name && cl.k !== 'gone' ? ' ' + cl.name : '') : ''; })); });
    });
    return function () { return [{ type: 'p', text: 'Each version compared with the one it was made from; a routine followed from parent to child. ● the same, ◐ altered, ↪ moved, ＋ new, × gone.' }, SW.tableBlock('Routines across the versions', out.head, out.rows)]; };
  }
  function gizmoCompare(b, el) {
    var V = root.SWVersions, ST = SW.structure, esc = SW.esc;
    var vs = V.VERSIONS.filter(function (v) { return v.build && v.id !== b.v.id; }).sort(function (x, y) { return x.sort - y.sort; });
    var earlier = vs.filter(function (v) { return v.sort <= b.v.sort; });
    // the version to compare with: as last chosen for this version, else the last chosen at all,
    // else the one before it
    var byV = SW.store.get('an.gizmoCmpBy', {}) || {}, ok = function (id) { return vs.some(function (v) { return v.id === id; }); };
    var other = ok(byV[b.v.id]) ? byV[b.v.id] : ok(SW.store.get('an.gizmoCmp', '')) ? SW.store.get('an.gizmoCmp', '') : (earlier[earlier.length - 1] || vs[0] || {}).id;
    function keep(cur, cmp) { var m = SW.store.get('an.gizmoCmpBy', {}) || {}; m[cur] = cmp; SW.store.set('an.gizmoCmpBy', m); SW.store.set('an.gizmoCmp', cmp); }
    var split = !!SW.store.get('an.gizmoSplit', false);
    gzWrite({ gz: 'compare', cmp: other, split: split ? 1 : null });
    var lede = 'After Art Schwarz: each version’s code without its comments, cut into blocks between branches (a block begins where a branch arrives and ends at an instruction that can branch), read from the assembled code; jumps the code does not name (jmp i, jsp i, xct) are taken from a 5 s sample run of each version. Blocks are matched across the two versions by their code, then their label, then their place between matched blocks. Here they are gathered into routines, each running from an entry point (the start, anything called, anything the main loop dispatches to) to the next, and the two versions’ routines are set side by side.';
    var legend = 'The same: every block matched and unchanged. Altered: some of its blocks changed, were inserted or were removed. Moved: a routine on one side only whose code is all found in another routine on the other. Inserted, removed: a routine with no counterpart. Click a routine for its blocks side by side, and a block for its code in both versions.';
    var c = SW.el('div', { class: 'card gz-card' });
    c.style.gridColumn = '1 / -1';
    el.appendChild(c);
    var bar = SW.el('div', { class: 'gz-bar' });
    bar.innerHTML = gzMode('compare') + '<span class="sep"></span><label class="check" title="The version to compare this one with">' + esc(SW.refOf(b.v.id)) + ' against <select class="gz-cmp">' +
      vs.map(function (v) { return '<option value="' + esc(v.id) + '"' + (v.id === other ? ' selected' : '') + '>' + esc(SW.refOf(v.id) + '  ' + v.label) + '</option>'; }).join('') + '</select></label>' +
      '<button class="btn ghost gz-link" title="Copy a link that opens the bench on this comparison (and the routine open, if one is)">🔗 Link</button>' +
      '<button class="btn ghost gz-swap" title="Swap the two versions round: ' + esc(SW.refOf(other || '') + ' on the right, ' + SW.refOf(b.v.id) + ' on the left') + '">⇄ Swap</button>' +
      '<label class="check" title="Draw the largest routine, the main loop, as its labelled parts: each label a branch arrives at begins a part"><input type="checkbox" class="gz-split"' + (split ? ' checked' : '') + '> Split the main loop</label>' +
      '<span class="gz-src hint">Reading both versions…</span>' +
      '<details class="gz-about"><summary title="What the comparison shows and how to read it">About</summary><div class="gz-about-b"><p>' + lede + '</p><p>' + legend + '</p></div></details>';
    c.appendChild(bar);
    gzModeWire(bar);
    bar.querySelector('.gz-cmp').addEventListener('change', function (e) { keep(b.v.id, e.target.value); render(); });
    bar.querySelector('.gz-link').addEventListener('click', function () { SW.copyText(location.href.replace(/&nc=\d+/, ''), 'the link to this comparison'); });
    bar.querySelector('.gz-swap').addEventListener('click', function () { if (!other) return; keep(other, b.v.id); SW.select(other); });
    bar.querySelector('.gz-split').addEventListener('change', function (e) { SW.store.set('an.gizmoSplit', e.target.checked); render(); });
    var src = bar.querySelector('.gz-src'), body = SW.el('div', { class: 'gz-sbs' }), more = SW.el('div', { class: 'gz-more' });
    c.appendChild(body); c.appendChild(more);
    var out = { rrows: [], rows: [], erows: [], summary: '' };
    if (!other) { src.textContent = 'No other version to compare with.'; return null; }
    SW.build(other).then(function (bo) {
      if (!bo.asm) { src.textContent = SW.refOf(other) + ' has no source to compare.'; return; }
      return dynOf(bo).then(function (dA) { return dynOf(b).then(function (dB) {
        sampling = null;
        if (build !== b) return;
        var GA = ST.graph(bo, dA), GB = ST.graph(b, dB), C = ST.compare(GA, GB);
        draw(bo, GA, GB, C, dA, dB);
      }); });
    }, function () { src.textContent = 'Could not build ' + SW.refOf(other) + '.'; });
    function ref(G, x) { return x.src ? SW.refOf(G.b.v.id, x.src.p, x.src.n0, x.src.n1, G.b.parts.length) : SW.oct(x.a0, 4); }
    function linesOf(x) { return x.src ? (x.src.n1 !== x.src.n0 ? 'lines ' + x.src.n0 + '–' + x.src.n1 : 'line ' + x.src.n0) : SW.oct(x.a0, 4); }
    function draw(bo, GA, GB, C, dA, dB) {
      var ra = SW.refOf(bo.v.id), rb = SW.refOf(b.v.id), R = ST.compareRoutines(C, { split: split });
      var rk = { same: 0, altered: 0, moved: 0, inserted: 0, removed: 0 }; R.rows.forEach(function (r) { rk[r.kind]++; });
      out.summary = ra + ' → ' + rb + ': ' + R.RA.list.length + ' → ' + R.RB.list.length + ' routines (the same ' + rk.same + ', altered ' + rk.altered + ', moved ' + rk.moved + ', inserted ' + rk.inserted + ', removed ' + rk.removed + '); ' + GA.blocks.length + ' → ' + GB.blocks.length + ' blocks (the same ' + C.same + ', altered ' + C.altered.length + ', inserted ' + C.inserted.length + ', removed ' + C.removed.length + '); branches added ' + C.edgesNew.length + ', removed ' + C.edgesGone.length + '.';
      src.textContent = R.RA.list.length + ' → ' + R.RB.list.length + ' routines · same ' + rk.same + ' · altered ' + rk.altered + (rk.moved ? ' · moved ' + rk.moved : '') + ' · inserted ' + rk.inserted + ' · removed ' + rk.removed;
      function tallyText(t) { var W = { altered: 'altered', inserted: 'inserted', removed: 'removed', out: 'moved out', in: 'moved in' }; return ['altered', 'inserted', 'removed', 'out', 'in'].filter(function (k) { return t[k]; }).map(function (k) { return t[k] + ' ' + W[k]; }).join(' · ') || 'unchanged'; }
      function side(r, G, R0) {
        if (!r) return '';
        var calls = r.to.map(function (z) { return R0.list[z].name; });
        return '<b class="mono">' + esc(r.name) + '</b><span class="faint"> ' + esc(linesOf(r)) + ' · ' + r.blocks.length + ' block' + (r.blocks.length === 1 ? '' : 's') + '</span>' +
          (calls.length ? '<div class="sbs-calls faint">→ ' + esc(calls.slice(0, 6).join(', ') + (calls.length > 6 ? ' and ' + (calls.length - 6) + ' more' : '')) + '</div>' : '');
      }
      // ---- the two flows, side by side, in one layout: a routine sits in the same place in both ----
      var rowOfA = {}, rowOfB = {};
      R.rows.forEach(function (r, k) { if (r.a) rowOfA[r.a.i] = k; if (r.b) rowOfB[r.b.i] = k; });
      function flows(G, RR, d, rowOf) {   // the transfers between routines, with how often the sample run took them
        var fl = {};
        RR.list.forEach(function (r) { r.to.forEach(function (z) { var k = rowOf[r.i] + '>' + rowOf[z]; fl[k] = fl[k] || { f: rowOf[r.i], t: rowOf[z], n: 0 }; }); });
        if (d && d.branches) d.branches.forEach(function (n, key) {
          var bf = G.at[Math.floor(key / 4096)], bt = G.at[key % 4096];
          if (bf == null || bt == null) return;
          var rf = RR.of[bf], rt = RR.of[bt];
          if (rf === rt || G.blocks[bt].a0 !== RR.list[rt].a0) return;
          var k = rowOf[rf] + '>' + rowOf[rt];
          (fl[k] = fl[k] || { f: rowOf[rf], t: rowOf[rt], n: 0 }).n += n;
        });
        return fl;
      }
      function shares(G, RR, d) {   // each routine's share of the run's time
        var tot = 0, sh = {};
        if (!d || !d.cyc) return sh;
        for (var a = 0; a < 4096; a++) tot += d.cyc[a];
        RR.list.forEach(function (r) { var c = 0; r.blocks.forEach(function (bi) { var bl = G.blocks[bi]; for (var a = bl.a0; a <= bl.a1; a++) c += d.cyc[a]; }); sh[r.i] = tot ? c / tot : 0; sh['c' + r.i] = c; });
        return sh;
      }
      var FA = flows(GA, R.RA, dA, rowOfA), FB = flows(GB, R.RB, dB, rowOfB), SA = shares(GA, R.RA, dA), SB = shares(GB, R.RB, dB);
      // a routine's name, given on either side, holds for both
      function rName(row) { return (row.b && gzName(b.v.id, row.b.a0)) || (row.a && gzName(bo.v.id, row.a.a0)) || ''; }
      function blockMs(d, x) { var c = 0; if (d && d.cyc && x) for (var a = x.a0; a <= x.a1; a++) c += d.cyc[a]; return c; }
      function routineFigures(row) {
        function col(r, G, d, SH, F, rowOf) {
          if (!r) return ['', '', '', '', '', '', ''];
          var steps = 0, words = 0; r.blocks.forEach(function (bi) { var bl = G.blocks[bi]; words += bl.a1 - bl.a0 + 1; if (d && d.steps) for (var a = bl.a0; a <= bl.a1; a++) steps += d.steps[a]; });
          var k = rowOf[r.i], outs = [], ins = [];
          Object.keys(F).forEach(function (key) { var e = F[key]; var o = R.rows[e.t], q = R.rows[e.f]; if (e.f === k && e.t !== k) outs.push(((o.b || o.a).name) + ' ×' + gzN(e.n)); if (e.t === k && e.f !== k) ins.push(((q.b || q.a).name) + ' ×' + gzN(e.n)); });
          var ent = d && d.steps ? d.steps[r.a0] : 0;
          var rg = gzRange(d && d.runCyc, r.blocks.map(function (bi) { return [G.blocks[bi].a0, G.blocks[bi].a1]; }));
          return [gzMs(SH['c' + r.i]) + ' (' + (100 * (SH[r.i] || 0)).toFixed(1) + '%)' + (rg ? '; ' + rg : ''), ent ? (SH['c' + r.i] * 5 / ent).toFixed(1) + ' µs' : '', gzN(ent) + ' times', gzN(steps), r.blocks.length + ' blocks, ' + words + ' words', outs.join(', ') || 'none', ins.join(', ') || 'none'];
        }
        var A = col(row.a, GA, dA, SA, FA, rowOfA), B2 = col(row.b, GB, dB, SB, FB, rowOfB);
        return ['Time in a 5 s run' + ((dB && dB.sample && dB.sample.runs > 1) ? ' (×' + dB.sample.runs + ', averaged)' : ''), 'Per entry', 'Entered', 'Instructions run', 'Size', 'Calls and jumps to', 'Reached from'].map(function (h, i) { return [h, A[i], B2[i]]; });
      }
      var uni = {}; [FA, FB].forEach(function (F) { Object.keys(F).forEach(function (k) { uni[k] = F[k]; }); });
      var entryRow = rowOfB[R.RB.of[GB.entry]];
      var Lay = ST.layout(R.rows.map(function (r, k) { return { id: k, ord: (r.b || r.a).a0 }; }), Object.keys(uni).map(function (k) { return uni[k]; }), entryRow, 3);
      var nmax = 1; [FA, FB].forEach(function (F) { Object.keys(F).forEach(function (k) { nmax = Math.max(nmax, F[k].n); }); });
      var smax = 0.0001; [SA, SB].forEach(function (S0) { Object.keys(S0).forEach(function (k) { smax = Math.max(smax, S0[k]); }); });
      var NW = 164, NH = 42, GX = 18, GY = 46, rowsL = Lay.rows, wmax = Math.max.apply(null, rowsL.map(function (r) { return r.length; }).concat([1]));
      var W = wmax * (NW + GX) + 90, H = rowsL.length * (NH + GY) + 24;
      function xy(k) { var p = Lay.pos[k], r = rowsL[p.r]; return { x: 20 + (W - 90 - r.length * (NW + GX)) / 2 + p.k * (NW + GX), y: 14 + p.r * (NH + GY) }; }
      var EDGE = { altered: 'var(--violet)', inserted: 'var(--g-added)', removed: 'var(--g-removed)' };
      function sideSVG(isA) {
        var F = isA ? FA : FB, SH = isA ? SA : SB, id = isA ? 'a' : 'b';
        var o = ['<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '"><rect width="' + W + '" height="' + H + '" fill="var(--surface)"/>',
          '<defs><marker id="fl-ar-' + id + '" viewBox="0 0 8 8" refX="7" refY="4" markerUnits="userSpaceOnUse" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M0 0L8 4L0 8z" fill="var(--text-dim)"/></marker></defs>'];
        Object.keys(F).forEach(function (key) {
          var e = F[key]; if (e.f == null || e.t == null || !Lay.pos[e.f] || !Lay.pos[e.t]) return;
          var a = xy(e.f), z = xy(e.t), d, pf = Lay.pos[e.f], pt = Lay.pos[e.t];
          if (e.f === e.t) return;
          if (pt.r > pf.r) d = 'M' + (a.x + NW / 2) + ' ' + (a.y + NH) + ' C ' + (a.x + NW / 2) + ' ' + (a.y + NH + GY * 0.6) + ' ' + (z.x + NW / 2) + ' ' + (z.y - GY * 0.6) + ' ' + (z.x + NW / 2) + ' ' + (z.y - 1);
          else { var bx = Math.max(a.x, z.x) + NW + 18 + 8 * (pf.r - pt.r); d = 'M' + (a.x + NW) + ' ' + (a.y + NH / 2 + 5) + ' C ' + bx + ' ' + (a.y + NH / 2 + 5) + ' ' + bx + ' ' + (z.y + NH / 2 - 5) + ' ' + (z.x + NW + 1) + ' ' + (z.y + NH / 2 - 5); }
          var sw = e.n ? (0.9 + 3.4 * Math.log(1 + e.n) / Math.log(1 + nmax)).toFixed(2) : 1;
          var fr = R.rows[e.f], to = R.rows[e.t], nf = (isA ? fr.a : fr.b), nt = (isA ? to.a : to.b);
          o.push('<path d="' + d + '" fill="none" stroke="var(--text-dim)" stroke-opacity="' + (e.n ? 0.8 : 0.45) + '" stroke-width="' + sw + '"' + (e.n ? '' : ' stroke-dasharray="3 3"') + ' marker-end="url(#fl-ar-' + id + ')"><title>' + esc((nf ? nf.name : '?') + ' → ' + (nt ? nt.name : '?') + (e.n ? ': ' + e.n.toLocaleString('en-GB') + ' times in the sample run' : ': in the code, not taken in the sample run')) + '</title></path>');
        });
        R.rows.forEach(function (row, k) {
          if (!Lay.pos[k]) return;
          var r = isA ? row.a : row.b, p = xy(k);
          if (!r) { o.push('<rect x="' + p.x + '" y="' + p.y + '" width="' + NW + '" height="' + NH + '" rx="4" fill="none" stroke="var(--line)" stroke-dasharray="4 3"/>'); return; }
          var sh = SH[r.i] || 0, heat = Math.round(6 + 60 * Math.sqrt(sh / smax)), ring = EDGE[row.kind], nm = rName(row);
          o.push('<g class="gz-node" data-r="' + k + '" style="cursor:pointer"><title>' + esc((nm ? nm + ': ' : '') + r.name + ', ' + linesOf(r) + ', ' + r.blocks.length + ' blocks; ' + gzMs(SH['c' + r.i]) + ' (' + (100 * sh).toFixed(1) + '% of the time) in the 5 s sample run; ' + row.kind) + '</title>' +
            '<rect x="' + p.x + '" y="' + p.y + '" width="' + NW + '" height="' + NH + '" rx="' + (k === entryRow ? 12 : 4) + '" fill="var(--surface)"/>' +
            '<rect x="' + p.x + '" y="' + p.y + '" width="' + NW + '" height="' + NH + '" rx="' + (k === entryRow ? 12 : 4) + '" fill="var(--amber)" fill-opacity="' + (heat / 100).toFixed(2) + '" stroke="' + (ring || 'var(--text-faint)') + '" stroke-width="' + (ring ? 2 : 1) + '"/>' +
            '<text x="' + (p.x + 7) + '" y="' + (p.y + 17) + '" font-family="monospace" font-size="11.5" font-weight="700" fill="var(--text)">' + esc(gzFit(nm || r.name, NW - 22 - 6.4 * gzMs(SH['c' + r.i]).length)) + '</text>' +
            '<text x="' + (p.x + NW - 7) + '" y="' + (p.y + 17) + '" text-anchor="end" font-family="sans-serif" font-size="11" fill="var(--text)" font-weight="700">' + gzMs(SH['c' + r.i]) + '</text>' +
            '<text x="' + (p.x + 7) + '" y="' + (p.y + 33) + '" font-family="sans-serif" font-size="10" fill="var(--text-dim)">' + esc((nm ? '(' + r.name + ') · ' : '') + linesOf(r)) + '</text></g>');
        });
        o.push('</svg>');
        return o.join('');
      }
      var svgA = sideSVG(true), svgB = sideSVG(false);
      body.innerHTML = '<div class="gz-flow2"><div><div class="fl-h">' + esc(ra) + ' · ' + esc(bo.v.label) + '</div><div class="svgbox fl-box">' + SW.displaySVG(svgA) + '</div></div>' +
        '<div><div class="fl-h">' + esc(rb) + ' · ' + esc(b.v.label) + '</div><div class="svgbox fl-box">' + SW.displaySVG(svgB) + '</div></div></div>' +
        '<p class="hint fl-key">Each routine in the same place on both sides. Shaded by its share of the time in a 5 s sample run of that version, with the machine time it took there in milliseconds (the share is in the hover and in its box); edges are calls and dispatches between routines, thicker for more often, dashed if in the code but not taken in the run. Outlined violet: altered; green: inserted; red: removed; an empty dashed box: no counterpart on this side. The rounded routine is where the program starts. Click a routine for its blocks side by side.</p>';
      var fb = SW.el('div'); body.appendChild(fb);
      fb.appendChild(SW.figureButtons(function () { return svgA; }, 'spacewar-' + bo.v.id + '-flow', ra));
      fb.appendChild(document.createTextNode(' '));
      fb.appendChild(SW.figureButtons(function () { return svgB; }, 'spacewar-' + b.v.id + '-flow', rb));
      body.onclick = function (e) { var g = e.target.closest('[data-r]'); if (g) openRoutine(R.rows[+g.dataset.r]); };
      // a routine named in the link (?rt=), opened once drawn
      if (SW.state.gzRoutine) {
        var want = SW.state.gzRoutine; SW.state.gzRoutine = null;
        var hit = R.rows.filter(function (r) { return (r.b && r.b.name === want) || (r.a && r.a.name === want) || rName(r) === want; })[0];
        if (hit) openRoutine(hit);
      }
      // ---- the routines, row by row, folded ----
      var rlist = SW.el('div', { class: 'gz-sec' });
      rlist.innerHTML = '<h4>The routines, row by row <span class="faint">(' + R.rows.length + ': ' + rk.altered + ' altered, ' + rk.moved + ' moved, ' + rk.inserted + ' inserted, ' + rk.removed + ' removed)</span></h4>' +
        '<div class="gz-sbs"><div class="sbs-row sbs-head"><div>' + esc(ra) + '</div><div></div><div>' + esc(rb) + '</div></div>' +
        R.rows.map(function (r, i) {
          return '<div class="sbs-row k-' + r.kind + '" data-r="' + i + '" title="Click for the blocks side by side">' +
            '<div class="sbs-a">' + (r.a ? side(r.a, GA, R.RA) : '<span class="faint">Inserted or moved</span>') + '</div>' +
            '<div class="sbs-mid"><span class="gz-k gz-k-' + r.kind + '">' + r.kind + '</span><span class="faint">' + esc(r.kind === 'same' ? '' : r.kind === 'moved' ? 'its code is mostly in another routine' + (r.t.removed || r.t.inserted ? ' (' + tallyText(r.t) + ')' : '') : tallyText(r.t)) + '</span></div>' +
            '<div class="sbs-b">' + (r.b ? side(r.b, GB, R.RB) : '<span class="faint">Removed or moved</span>') + '</div></div>';
        }).join('') + '</div>';
      rlist.addEventListener('click', function (e) { var r = e.target.closest('.sbs-row[data-r]'); if (r) openRoutine(R.rows[+r.dataset.r]); });
      var listHost = rlist;
      out.rrows = R.rows.map(function (r) { return [r.kind, r.a ? r.a.name : '', r.b ? r.b.name : '', r.kind === 'same' ? '' : tallyText(r.t), r.b ? ref(GB, r.b) : ref(GA, r.a)]; });
      // the block-level detail, folded away
      out.rows = [];
      C.altered.forEach(function (xi) { var x = GA.blocks[xi], y = GB.blocks[C.mA[xi]], d = ST.lineDiff(x.lines.map(function (l) { return l.key; }), y.lines.map(function (l) { return l.key; })); var no = d.filter(function (q) { return q[0] === '-'; }).length, ni = d.filter(function (q) { return q[0] === '+'; }).length; out.rows.push({ id: 'b' + y.i, r: ['altered', x.name, y.name, no || ni ? no + ' out, ' + ni + ' in' : 'same lines, assembled differently', ref(GB, y)] }); });
      C.inserted.forEach(function (yi) { var y = GB.blocks[yi], w = C.into[yi]; out.rows.push({ id: 'b' + yi, r: ['inserted', '', y.name, y.lines.length + ' line' + (y.lines.length === 1 ? '' : 's') + (w ? ', between ' + GB.blocks[w[0]].name + ' and ' + GB.blocks[w[1]].name : ''), ref(GB, y)] }); });
      C.removed.forEach(function (xi) { var x = GA.blocks[xi]; out.rows.push({ id: 'a' + xi, r: ['removed', x.name, '', x.lines.length + ' line' + (x.lines.length === 1 ? '' : 's'), ref(GA, x)] }); });
      out.rows.sort(function (p, q) { return p.r[4] < q.r[4] ? -1 : 1; });
      out.erows = C.edgesNew.map(function (e) { return ['added', GB.blocks[e.f].name, GB.blocks[e.t].name]; }).concat(C.edgesGone.map(function (e) { return ['removed', GA.blocks[e.f].name, GA.blocks[e.t].name]; }));
      more.innerHTML = '';
      more.appendChild(listHost);
      var d2 = SW.el('div', { class: 'gz-sec' });
      d2.innerHTML = '<h4>Every block that changed <span class="faint">(' + out.rows.length + ')</span></h4>';
      var s2 = SW.el('div');
      s2.appendChild(SW.table(['Change', 'In ' + ra, 'In ' + rb, 'Lines', 'Reference'], out.rows.map(function (o) { return o.r; }), { cls: ['', 'mono', 'mono', '', 'mono'], onRow: function (r) { var o = out.rows.filter(function (q) { return q.r === r; })[0]; if (o) openBlock(o.id); } }));
      d2.appendChild(s2); more.appendChild(d2);
      var d3 = SW.el('div', { class: 'gz-sec' });
      d3.innerHTML = '<h4>Every branch that changed <span class="faint">(' + out.erows.length + ', between blocks matched in both)</span></h4>';
      var s3 = SW.el('div');
      s3.appendChild(SW.table(['Branch', 'From', 'To'], out.erows, { cls: ['', 'mono', 'mono'] }));
      d3.appendChild(s3); more.appendChild(d3);
      function kindOf(id) { var isA = id.charAt(0) === 'a', n = +id.slice(1), xi = isA ? n : C.mB[n]; return isA ? 'removed' : xi == null ? 'inserted' : C.kind[xi] === 'altered' ? 'altered' : 'same'; }
      function dialog(html) {
        var dlg = SW.el('dialog', { class: 'tray-big gz-dlg gz-cmpdlg' });
        dlg.innerHTML = html;
        document.body.appendChild(dlg);
        dlg.addEventListener('close', function () { dlg.remove(); });
        dlg.showModal();
        return dlg;
      }
      // a routine: its blocks in both versions, side by side
      function openRoutine(r) {
        gzWrite({ gz: 'compare', cmp: other, split: split ? 1 : null, rt: (r.b || r.a).name });
        var items = [];
        (r.b ? r.b.blocks : []).forEach(function (yi) { var xi = C.mB[yi]; items.push({ ord: GB.blocks[yi].a0, a: xi == null ? null : GA.blocks[xi], b: GB.blocks[yi], id: 'b' + yi }); });
        (r.a ? r.a.blocks : []).forEach(function (xi) {
          if (C.mA[xi] != null && r.b && r.b.blocks.indexOf(C.mA[xi]) >= 0) return;
          var prev = r.a.blocks.filter(function (q) { return q < xi && C.mA[q] != null; }).pop();
          items.push({ ord: prev != null ? GB.blocks[C.mA[prev]].a0 + 0.5 : -1 + xi / 1e4, a: GA.blocks[xi], b: C.mA[xi] != null ? GB.blocks[C.mA[xi]] : null, id: C.mA[xi] != null ? 'b' + C.mA[xi] : 'a' + xi });
        });
        items.sort(function (p, q) { return p.ord - q.ord; });
        function cell(x, d) { return x ? '<b class="mono">' + esc(x.name) + '</b> <span class="faint">' + esc(linesOf(x)) + '</span>' + (d ? '<span class="gz-t">' + gzMs(blockMs(d, x)) + '</span>' : '') : ''; }
        var label = r.a && r.b && r.a.name !== r.b.name ? r.a.name + ' → ' + r.b.name : (r.b || r.a).name, figs = routineFigures(r);
        var dlg = dialog('<div class="tray-bighead"><b>' + gzTitle(rName(r), label) + '</b> <span class="gz-k gz-k-' + r.kind + '">' + r.kind + '</span>' + gzNameField(rName(r), label) + '<span class="refhelp-acts"><button class="btn ghost" data-keep title="This routine in both versions, with its name and figures, in My notes (private)">＋ My notes</button><button class="icon-btn" data-x title="Close (Esc)">✕</button></span></div>' +
          '<div class="gz-view"><span class="seg-btns"><button class="btn on" data-view="blocks" title="The routine’s figures and its blocks">Blocks</button><button class="btn" data-view="code" title="One block’s code in both versions">Code</button></span>' +
          '<span class="gz-step" hidden><button class="btn ghost" data-step="-1" title="The block before">‹</button><span class="gz-stepn faint"></span><button class="btn ghost" data-step="1" title="The block after">›</button></span></div>' +
          '<div class="gz-pane" data-pane="blocks">' +
          '<table class="ov-sub gz-q gz-q2"><thead><tr><th></th><th>' + esc(r.a ? ref(GA, r.a) : ra + ': Inserted or moved') + '</th><th>' + esc(r.b ? ref(GB, r.b) : rb + ': Removed or moved') + '</th></tr></thead><tbody>' +
            figs.map(function (q) { return '<tr><th>' + q[0] + '</th><td>' + esc(q[1]) + '</td><td>' + esc(q[2]) + '</td></tr>'; }).join('') + '</tbody></table>' +
          '<h4>Its blocks</h4><div class="gz-sbs"><div class="sbs-row sbs-head"><div>' + esc(ra) + '</div><div></div><div>' + esc(rb) + '</div></div></div>' +
          '<div class="gz-sbs gz-sbs-in">' + items.map(function (it) { var k = kindOf(it.id); return '<div class="sbs-row k-' + k + '" data-id="' + it.id + '" title="Click for the code in both versions"><div class="sbs-a">' + (cell(it.a, dA) || '<span class="faint">Inserted or moved</span>') + '</div><div class="sbs-mid"><span class="gz-k gz-k-' + k + '">' + k + '</span></div><div class="sbs-b">' + (cell(it.b, dB) || '<span class="faint">Removed or moved</span>') + '</div></div>'; }).join('') + '</div>' +
          '<p class="hint">Click a block for its code in both versions.</p></div>' +
          '<div class="gz-pane" data-pane="code" hidden><div class="gz-bv"></div></div>');
        var cur = null;
        function view(v) {
          dlg.style.minHeight = Math.max(dlg.offsetHeight, parseFloat(dlg.style.minHeight) || 0) + 'px';   // the box keeps its size between the two views
          SW.$$('[data-view]', dlg).forEach(function (bt) { bt.classList.toggle('on', bt.dataset.view === v); });
          SW.$$('.gz-pane', dlg).forEach(function (pn) { pn.hidden = pn.dataset.pane !== v; });
          dlg.querySelector('.gz-step').hidden = v !== 'code';
        }
        function showBlock(bid) {
          cur = bid;
          dlg.querySelector('.gz-bv').innerHTML = blockHTML(bid, false);
          SW.$$('.gz-sbs-in .sbs-row', dlg).forEach(function (row) { row.classList.toggle('on', row.dataset.id === bid); });
          var at = items.map(function (it) { return it.id; }).indexOf(bid);
          dlg.querySelector('.gz-stepn').textContent = 'block ' + (at + 1) + ' of ' + items.length;
        }
        var first = items.filter(function (it) { return kindOf(it.id) !== 'same'; })[0] || items[0];
        if (first) showBlock(first.id);
        dlg.addEventListener('click', function (e) {
          if (e.target === dlg || e.target.closest('[data-x]')) { gzWrite({ gz: 'compare', cmp: other, split: split ? 1 : null }); dlg.close(); return; }
          if (e.target.closest('[data-keep]')) { keepRoutine(r, items, figs); return; }
          var vb = e.target.closest('[data-view]'); if (vb) { view(vb.dataset.view); return; }
          var st = e.target.closest('[data-step]'); if (st) { var ids = items.map(function (it) { return it.id; }), at = ids.indexOf(cur); showBlock(ids[(at + +st.dataset.step + ids.length) % ids.length]); return; }
          var it = e.target.closest('[data-id]'); if (it) { showBlock(it.dataset.id); view('code'); }
        });
        dlg.addEventListener('close', function () { gzWrite({ gz: 'compare', cmp: other, split: split ? 1 : null }); });
        dlg.addEventListener('change', function (e) {
          if (!e.target.closest('.gz-name')) return;
          var v = e.target.value.trim();
          if (r.b) gzSetName(b.v.id, r.b.a0, v);
          if (r.a) gzSetName(bo.v.id, r.a.a0, v);
          SW.toast(v ? 'Named ' + v : 'Name cleared');
          dlg.querySelector('.tray-bighead b').innerHTML = gzTitle(v, label);
          render();
        });
      }
      function keepRoutine(r, items, figs) {
        if (!SW.tray) return;
        var nm = rName(r), label = (r.b || r.a).name;
        SW.tray.addDoc({ title: 'Routine ' + (nm ? nm + ' (' + label + ')' : label) + ', ' + ra + ' and ' + rb, subtitle: 'Art’s Dynamic Profile Gizmo, ⇄ Compare: ' + r.kind,
          blocks: [SW.tableBlock('The figures', ['', ra + (r.a ? ' ' + ref(GA, r.a) : ''), rb + (r.b ? ' ' + ref(GB, r.b) : '')], figs),
                   SW.tableBlock('Its blocks', [ra, 'Change', rb], items.map(function (it) { return [it.a ? it.a.name + ' ' + linesOf(it.a) + ' ' + gzMs(blockMs(dA, it.a)) : '', kindOf(it.id), it.b ? it.b.name + ' ' + linesOf(it.b) + ' ' + gzMs(blockMs(dB, it.b)) : '']; }))] },
          { vid: b.v.id, anchor: r.b && r.b.src ? { p: r.b.src.p, n0: r.b.src.n0, n1: r.b.src.n1, src: b.parts[r.b.src.p].src } : null, tags: ['profile', 'compare'] });
      }
      // a block: its code in both versions, side by side
      function openBlock(id) {
        var dlg = dialog(blockHTML(id, true));
        dlg.addEventListener('click', function (e) { if (e.target === dlg || e.target.closest('[data-x]')) dlg.close(); });
      }
      // a block's code in both versions, side by side (in its own box, or under a routine's blocks)
      function blockHTML(id, own) {
        var isA = id.charAt(0) === 'a', n = +id.slice(1), y = isA ? null : GB.blocks[n], xi = isA ? n : C.mB[n], x = xi == null ? null : GA.blocks[xi], k = kindOf(id);
        var la = x ? x.lines : [], lb = y ? y.lines : [], d = ST.lineDiff(la.map(function (l) { return l.key; }), lb.map(function (l) { return l.key; }));
        function cell(l, mark) { return l ? '<div class="gz-l ' + mark + '"><span class="n">' + l.n + '</span><span class="t">' + esc(l.raw) + '</span></div>' : '<div class="gz-l gap"></div>'; }
        var rowsH = d.map(function (q) { return '<div class="gz-pair">' + cell(q[1] != null ? la[q[1]] : null, q[0] === '-' ? 'del' : '') + cell(q[2] != null ? lb[q[2]] : null, q[0] === '+' ? 'add' : '') + '</div>'; }).join('');
        function link(G, bl, label) { if (!bl || !bl.src) return ''; var u = location.pathname + '?v=' + encodeURIComponent(G.b.v.id) + '&tab=read&l=' + bl.src.p + ':' + bl.src.n0 + (bl.src.n1 > bl.src.n0 ? '-' + bl.src.n1 : ''); return '<a class="btn" href="' + esc(u) + '" target="_blank" rel="noopener" title="These lines in Read, in a new tab">' + label + ' ↗</a>'; }
        return ('<div class="tray-bighead' + (own ? '' : ' gz-bvh') + '"><b>' + esc((x ? x.name : '') + (x && y && x.name !== y.name ? ' → ' : '') + (y && (!x || x.name !== y.name) ? y.name : '')) + '</b> <span class="gz-k gz-k-' + k + '">' + k + '</span><span class="refhelp-acts">' + (own ? '<button class="icon-btn" data-x title="Close (Esc)">✕</button>' : '') + '</span></div>' +
          '<div class="gz-pair gz-pairh"><div>' + esc(x ? ref(GA, x) : ra + ': Inserted or moved') + ' ' + link(GA, x, 'Read') + '</div><div>' + esc(y ? ref(GB, y) : rb + ': Removed or moved') + ' ' + link(GB, y, 'Read') + '</div></div>' +
          '<div class="listing gz-src-l gz-cmpl">' + rowsH + '</div>' + (k === 'altered' && !d.some(function (q) { return q[0] !== '='; }) ? '<p class="hint">The same lines, assembled differently: a macro they use, a repeat count or a symbol they name has changed between the versions.</p>' : '') + '<p class="hint">Comments and spacing are left out of the comparison; lines shown as held.</p>');
      }
    }
    return function () {
      return [{ type: 'p', text: lede }, { type: 'p', text: out.summary },
        SW.tableBlock('The routines', ['Change', 'Before', 'After', 'Blocks', 'Reference'], out.rrows),
        SW.tableBlock('The blocks that changed', ['Change', 'Before', 'After', 'Lines', 'Reference'], out.rows.map(function (o) { return o.r; })),
        SW.tableBlock('The branches that changed', ['Branch', 'From', 'To'], out.erows)];
    };
  }

  // ---------- 7 absence ----------
  function absence(b, el) {
    var V = root.SWVersions, items = [];
    b.parts.forEach(function (p) {
      if (p.role !== 'program') items.push(['Supplied tape', p.src + ': ' + p.role]);
      if (p.title > 1) items.push(['Skipped header', p.src + ': lines 1–' + (p.title - 1) + ' (transcription header, not assembled)']);
    });
    // the repairs register: readings corrected against the scan, lines remade (kintsugi in Read)
    b.parts.forEach(function (p, pi) {
      ((V.REPAIRS || {})[p.src] || []).forEach(function (r) {
        items.push([r.kind === 'rebuilt' ? 'Remade' : 'Corrected', SW.refText(b.v.id, pi, r.n, r.n, b.parts.length) + '  ' + (r.was ? '“' + r.was + '” → ' : '') + '“' + r.now + '”  (' + r.ev + '; ' + r.by + ', ' + r.date + ')']);
      });
    });
    if (/R$/.test(SW.REF[b.v.id] || '')) items.push(['Reconstruction', SW.refText(b.v.id) + '  ' + (SW.MADE[b.v.id] || 'a reconstructed text')]);
    (b.v.transforms || []).forEach(function (k) { items.push(['Normalisation', V.TRANSFORMS[k].label]); });
    var norm = 0; b.lines.forEach(function (ls) { ls.forEach(function (L) { if (L.raw !== L.norm && !L.skipped) norm++; }); });
    if (norm) items.push(['Lines normalised', String(norm)]);
    allLines(b).forEach(function (L) { if (/illegible|\[\?|uncertain|unclear/i.test(L.raw)) items.push(['Marked uncertain', SW.refText(b.v.id, L.p, L.n, L.n, b.parts.length) + '  ' + L.raw.trim()]); });
    if (b.asm) b.asm.errors.forEach(function (e) { items.push(['Assembly error', SW.refText(b.v.id, e.file, e.line, e.line, b.parts.length) + '  ' + e.message + (e.symbol ? ' "' + e.symbol + '"' : '')]); });
    V.VERSIONS.filter(function (v) { return v.status === 'lost'; }).forEach(function (v) { items.push(['Lost version', v.label + ' (' + v.date + '): ' + v.summary]); });
    var c = card('What the record does not hold', 'Every place where this build depends on something other than the text as held, the version’s reconstruction card: readings corrected against the scan and lines remade (marked in gold in Read), supplied tapes, normalisations, uncertain readings, errors, and the versions that do not survive at all.');
    c.appendChild(SW.table(['Kind', 'Detail'], items, { cls: ['', 'mono'] }));
    c.style.gridColumn = '1 / -1';
    el.appendChild(c);
    return function () { return [SW.tableBlock('Absences, supplements and repairs', ['Kind', 'Detail'], items)]; };
  }

  // ---------- 8 calls ----------
  function calls(b, el) {
    if (!b.asm) return null;
    var labs = Object.keys(b.labelAt).map(Number).sort(function (x, y) { return x - y; });
    function rof(a) { var r = '(start)'; for (var i = 0; i < labs.length && labs[i] <= a; i++) r = b.labelAt[labs[i]]; return r; }
    var edges = {};
    b.asm.words.forEach(function (w) {
      if (w.kind) return;
      var op = w.val >> 13, ib = (w.val >> 12) & 1;
      if ((op === 0o31 || (op === 0o07 && ib)) && !((w.val >> 12) & 1 && op === 0o31)) {
        var tgt = w.val & 0o7777, k = rof(w.loc) + ' → ' + (b.labelAt[tgt] || rof(tgt));
        edges[k] = edges[k] || { from: rof(w.loc), to: b.labelAt[tgt] || rof(tgt), n: 0, via: op === 0o31 ? 'jsp' : 'jda' };
        edges[k].n++;
      }
    });
    var rows = Object.keys(edges).map(function (k) { var e = edges[k]; return [e.from, e.to, e.via, e.n]; }).sort(function (a, b) { return a[1] < b[1] ? -1 : 1; });
    var callees = {}; rows.forEach(function (r) { callees[r[1]] = (callees[r[1]] || 0) + r[3]; });
    // Arc diagram: routines along a line in address order, calls as arcs.
    var nodes = {}, W = 1100, H = 330, base = 250;
    rows.forEach(function (r) { nodes[r[0]] = 1; nodes[r[1]] = 1; });
    var addrOf = function (n) { var s = b.sym[n]; return s ? s.val : 0; };
    var order = Object.keys(nodes).sort(function (x, y) { return addrOf(x) - addrOf(y); });
    var pos = {}; order.forEach(function (n, i) { pos[n] = 30 + i * (W - 60) / Math.max(1, order.length - 1); });
    var arcSVG = function () {
      var o = ['<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '"><rect width="' + W + '" height="' + H + '" fill="var(--surface)"/>'];
      o.push('<line x1="20" y1="' + base + '" x2="' + (W - 20) + '" y2="' + base + '" stroke="var(--line)"/>');
      rows.forEach(function (r) {
        var x1 = pos[r[0]], x2 = pos[r[1]];
        if (x1 == null || x2 == null || x1 === x2) return;
        var h = Math.min(base - 12, Math.abs(x2 - x1) * 0.55), mx = (x1 + x2) / 2;
        o.push('<path d="M' + x1.toFixed(1) + ' ' + base + ' Q' + mx.toFixed(1) + ' ' + (base - 2 * h).toFixed(1) + ' ' + x2.toFixed(1) + ' ' + base + '" fill="none" stroke="' + (x2 > x1 ? 'var(--beam)' : 'var(--amber)') + '" stroke-opacity="0.55" stroke-width="' + Math.min(4, 0.8 + r[3] * 0.4).toFixed(1) + '"><title>' + SW.esc(r[0] + ' → ' + r[1] + ' (' + r[2] + ', ' + r[3] + ' site' + (r[3] > 1 ? 's' : '') + ')') + '</title></path>');
      });
      order.forEach(function (n) {
        var x = pos[n], called = callees[n] || 0;
        o.push('<circle cx="' + x.toFixed(1) + '" cy="' + base + '" r="' + (2.5 + Math.min(6, called)).toFixed(1) + '" fill="var(--text)"><title>' + SW.esc(n + ' at ' + SW.oct(addrOf(n), 4) + (called ? ', called from ' + called + ' site(s)' : '')) + '</title></circle>');
        o.push('<text transform="translate(' + (x + 3).toFixed(1) + ' ' + (base + 12) + ') rotate(60)" font-size="9" fill="var(--text-dim)">' + SW.esc(n) + '</text>');
      });
      return o.concat(['</svg>']).join('');
    };
    var c0 = card('The call structure', 'Routines along the line in memory order; each arc a call (blue: to a routine later in memory, rose: to one earlier), thicker for more call sites. Hover for names.');
    c0.appendChild(SW.el('div', { class: 'svgbox' }, SW.displaySVG(arcSVG())));
    c0.appendChild(SW.figureButtons(arcSVG, 'spacewar-' + b.v.id + '-calls', SW.refText(b.v.id)));
    c0.style.gridColumn = '1 / -1';
    el.appendChild(c0);
    var c1 = card('Most called', 'Subroutines by the number of call sites (jsp and jda).');
    c1.insertAdjacentHTML('beforeend', '<div class="scroll">' + bars(Object.keys(callees).map(function (k) { return [k, callees[k]]; }).sort(function (x, y) { return y[1] - x[1]; }).slice(0, 30)) + '</div>');
    var c2 = card('Call sites', 'From routine to called routine. Routines are regions beginning at a label.');
    var s = SW.el('div', { class: 'scroll' });
    s.appendChild(SW.table(['From', 'To', 'Via', 'Sites'], rows, { cls: ['mono', 'mono', 'mono', 'num'] }));
    c2.appendChild(s);
    el.appendChild(c1); el.appendChild(c2);
    return function () { return [SW.tableBlock('Call sites', ['From', 'To', 'Via', 'Sites'], rows)]; };
  }

  // ---------- 9 instructions ----------
  function instructions(b, el) {
    if (!b.asm) return null;
    var st = {}, dy = {}, prof = SW.profile && SW.profile.build === b ? SW.profile : null;
    b.asm.words.forEach(function (w) {
      if (w.kind === 'constant' || w.kind === 'text' || b.parts[w.file].role !== 'program') return;
      var m = C.disasm(w.val).split(' ')[0];
      st[m] = (st[m] || 0) + 1;
      if (prof) dy[m] = (dy[m] || 0) + prof.exec[w.loc];
    });
    var rows = Object.keys(st).map(function (k) { return [k, st[k], prof ? dy[k] || 0 : '']; }).sort(function (a, b) { return b[1] - a[1]; });
    var c1 = card('As written', 'Leading mnemonic of each assembled word in the program (data words disassemble as whatever instruction they spell).');
    c1.insertAdjacentHTML('beforeend', '<div class="scroll">' + bars(rows.slice(0, 30).map(function (r) { return [r[0], r[1]]; })) + '</div>');
    el.appendChild(c1);
    var c2 = card('As executed', prof ? 'From your last run.' : 'Run the program to fill this in.');
    if (prof) c2.insertAdjacentHTML('beforeend', '<div class="scroll">' + bars(rows.filter(function (r) { return r[2]; }).sort(function (a, b) { return b[2] - a[2]; }).slice(0, 30).map(function (r) { return [r[0], r[2]]; })) + '</div>');
    el.appendChild(c2);
    return function () { return [SW.tableBlock('Instruction frequency', ['Mnemonic', 'Words', 'Executed'], rows)]; };
  }

  // ---------- 10 memory map ----------
  // Core as a programmer looks at it: each of the 4,096 words by kind, routine,
  // or how often it is executed, read or written in two emulated seconds of the
  // program running (which also shows what exists only at run time: the ship
  // outlines compiled into code, the object table); hover for a word, click to
  // inspect it, a segment table like a linker map, and go to an address or name.
  function memRun(b) {
    if (b._memRun) return b._memRun;
    var cpu = new root.PDP1CPU.PDP1(SW.cpuOpts(b.v));
    cpu.load(b.asm.memory, b.asm.start);
    try { cpu.run(400000); } catch (e) { /* what ran is still counted */ }
    return (b._memRun = { mem: cpu.mem.slice(), exec: cpu.execCount.slice(), read: cpu.readCount.slice(), write: cpu.writeCount.slice(), writer: cpu.lastWriter.slice(), secs: cpu.cycles * 5e-6 });
  }
  // what each kind of word is, for the legends' hover text
  var MEMWHAT = {
    code: 'Assembled from this version’s own program text: instructions and the data written among them.',
    constant: 'The constants block: values written in parentheses in the source, such as (B, which the assembler gathers into one table at the end.',
    variable: 'The variables block: storage the assembler sets aside for names marked as variables, with no value until the program runs.',
    supplied: 'Assembled from a tape this version’s own surviving text does not include, added so that it can be built: in 4.1 and 4.8, Samson’s Expensive Planetarium star table (13 March 1962) from the 2B sources. Real core, but not attested for this version.',
    text: 'Character data from the text pseudo-instruction: three FIO-DEC characters to a word.',
    'run-time code': 'Not assembled: written while the program runs, then executed, such as the ship outlines compiled into instructions at start-up.',
    'run-time data': 'Not assembled: written while the program runs but never executed, such as the object table.',
    unused: 'Neither assembled nor written in two emulated seconds of running.'
  };
  var MEMCOL = { code: 'var(--beam)', constant: 'var(--amber)', variable: 'var(--violet)', supplied: 'var(--green)', text: 'var(--red)', 'run-time code': '#e8a0ff', 'run-time data': '#8fa3b5', unused: 'var(--line-soft)' };
  function memmap(b, el) {
    if (!b.asm) return null;
    var run = memRun(b), kind = new Array(4096).fill('unused');
    b.asm.words.forEach(function (w) { kind[w.loc] = w.kind === 'constant' ? 'constant' : w.kind === 'text' ? 'text' : b.parts[w.file].role !== 'program' ? 'supplied' : 'code'; });
    if (b.asm.variables) for (var a = b.asm.variables.start; a < b.asm.variables.end; a++) if (kind[a] === 'unused') kind[a] = 'variable';
    for (a = 0; a < 4096; a++) if (kind[a] === 'unused' && run.write[a]) kind[a] = run.exec[a] ? 'run-time code' : 'run-time data';
    var colOf = function (k) { return SW.cssVar ? (MEMCOL[k].indexOf('var(') === 0 ? SW.cssVar(MEMCOL[k].slice(4, -1)) : MEMCOL[k]) : MEMCOL[k]; };
    // routine of each word: the nearest code label at or below it
    // labels that name their own address (not those written relative to R, whose values are offsets)
    function placedLab(ad) {
      var sy = b.sym[b.labelAt[ad]], d = sy && sy.defs && sy.defs[0], ws = d && b.asm.byLine && b.asm.byLine[d.file] ? b.asm.byLine[d.file][d.line] : null;
      return !ws || !ws.length || ws.some(function (w) { return w.loc === ad; });
    }
    var labs = Object.keys(b.labelAt).map(Number).filter(placedLab).sort(function (x, y) { return x - y; }), routine = new Array(4096);
    for (a = 0, i2 = -1; a < 4096; a++) { while (i2 + 1 < labs.length && labs[i2 + 1] <= a) i2++; routine[a] = i2 >= 0 && b.asm.memory[a] ? b.labelAt[labs[i2]] : ''; }   // assembled words only: run-time code has no routine of its own
    var i2;
    function hue(n) { var h = 0; for (var k = 0; k < n.length; k++) h = (h * 37 + n.charCodeAt(k)) % 360; return h; }
    var mode = SW.store.get('mem.mode', 'kind'), sel = -1, selRun = null;
    var c = card('The 4,096 words', 'Each square one 18-bit word, 64 to a row, addresses in octal. Run-time kinds and counts come from two emulated seconds of this version running (' + run.secs.toFixed(1) + ' s).');
    var tb = SW.el('div', { class: 'toolbar mem-tb', style: 'position:static;padding:0 0 6px' });
    tb.innerHTML = '<label class="check">Colour by <select data-m="mode"><option value="kind">kind</option><option value="routine">routine</option><option value="exec">executed</option><option value="read">read</option><option value="write">written</option></select></label>' +
      '<label class="check">Go to <input data-m="go" placeholder="octal address or name" style="width:12em"></label><span class="mem-legend"></span>';
    c.appendChild(tb);
    var row = SW.el('div', { class: 'mem-row' });
    var left = SW.el('div', { class: 'mem-left' }), right = SW.el('div', { class: 'mem-right' });
    left.style.width = (44 + 64 * 10) + 'px';   // fixed, so the caption's length never moves the panel beside it
    var CELL = 10, LX = 44, W = LX + 64 * CELL, H = 64 * CELL, dpr = Math.min(2, root.devicePixelRatio || 1);
    var cv = SW.el('canvas', { class: 'mem-cv' }); cv.width = W * dpr; cv.height = H * dpr; cv.style.width = W + 'px';
    var g = cv.getContext('2d'); g.scale(dpr, dpr);
    var cap = SW.el('p', { class: 'mem-cap mono hint' }, 'Hover over a word; click to inspect it.');
    left.appendChild(cv); left.appendChild(cap);
    var insp = SW.el('div', { class: 'mem-insp' }), segs = SW.el('div', { class: 'mem-segs' });
    right.appendChild(insp); right.appendChild(segs);
    row.appendChild(left); row.appendChild(right);
    c.appendChild(row);
    function cellColour(a) {
      if (mode === 'kind') return colOf(kind[a]);
      if (mode === 'routine') return kind[a] === 'unused' ? colOf('unused') : routine[a] ? 'hsl(' + hue(routine[a]) + ',55%,' + (kind[a] === 'code' ? 58 : 40) + '%)' : colOf('unused');
      var arr = run[mode], v = arr[a];
      if (!v) return kind[a] === 'unused' ? colOf('unused') : 'rgba(128,140,150,0.28)';
      var t = Math.min(1, Math.log10(1 + v) / 5);
      return 'hsl(' + (mode === 'write' ? 0 : mode === 'read' ? 200 : 40) + ',90%,' + (30 + t * 40).toFixed(0) + '%)';
    }
    function draw() {
      g.clearRect(0, 0, W, H);
      g.font = '9px ' + (SW.cssVar('--mono') || 'monospace'); g.textAlign = 'right';
      for (var a = 0; a < 4096; a++) {
        var x = LX + (a & 63) * CELL, y = (a >> 6) * CELL;
        g.fillStyle = cellColour(a);
        g.globalAlpha = selRun && (a < selRun.a0 || a > selRun.a1) ? 0.3 : 1;
        g.fillRect(x, y, CELL - 1, CELL - 1);
        if ((a & 63) === 0 && ((a >> 6) & 3) === 0) { g.globalAlpha = 1; g.fillStyle = SW.cssVar('--text-dim') || '#888'; g.fillText(SW.oct(a, 4), LX - 5, y + 8); }
      }
      g.globalAlpha = 1;
      if (sel >= 0) { g.strokeStyle = SW.cssVar('--text') || '#fff'; g.lineWidth = 2; g.strokeRect(LX + (sel & 63) * CELL - 1, (sel >> 6) * CELL - 1, CELL + 1, CELL + 1); }
      var leg = SW.$('.mem-legend', tb);
      if (mode === 'kind') leg.innerHTML = Object.keys(MEMCOL).map(function (k) { var n = kind.filter(function (x) { return x === k; }).length; return n ? '<span title="' + SW.esc(MEMWHAT[k] || '') + '"><i style="background:' + colOf(k) + '"></i>' + k + ' ' + n + '</span>' : ''; }).join('');
      else if (mode === 'routine') leg.innerHTML = '<span class="hint">each routine (from its label) in its own colour; code bright, its data darker</span>';
      else { var tot = 0, used = 0; run[mode].forEach(function (v) { tot += v; if (v) used++; }); leg.innerHTML = '<span class="hint">' + used + ' words ' + ({ exec: 'executed', read: 'read', write: 'written' })[mode] + ', ' + tot.toLocaleString('en-GB') + ' times in ' + run.secs.toFixed(1) + ' s; brighter is more</span>'; }
    }
    function addrAt(e) { var r = cv.getBoundingClientRect(), x = (e.clientX - r.left) * W / r.width - LX, y = (e.clientY - r.top) * W / r.width; if (x < 0 || y < 0 || x >= 64 * CELL || y >= H) return -1; return (Math.floor(y / CELL) << 6) | Math.floor(x / CELL); }
    function srcLine(a) { var sq = b.srcOf(a); return sq ? { sq: sq, L: b.lines[sq.p][sq.n - 1] } : null; }
    cv.addEventListener('mousemove', function (e) {
      var a = addrAt(e); if (a < 0) { cap.textContent = 'Hover over a word; click to inspect it.'; return; }
      var w = b.asm.memory[a], val = w ? w.val : run.mem[a], sl = srcLine(a);
      cap.textContent = SW.oct(a, 4) + '  ' + kind[a] + (b.symAt(a) ? '  ' + b.symAt(a) : '') + (val || kind[a] !== 'unused' ? '  ' + SW.oct(val) + '  ' + root.PDP1CPU.disasm(val, b.symAt) : '') + (sl ? '   · line ' + sl.sq.n + ': ' + sl.L.raw.trim().slice(0, 60) : '');
    });
    cv.addEventListener('click', function (e) { var a = addrAt(e); if (a >= 0) inspect(a); });
    function inspect(a) {
      sel = a; selRun = null; draw();
      var w = b.asm.memory[a], asmv = w ? w.val : null, now = run.mem[a], sl = srcLine(a), name = b.labelAt[a], sym = name && b.sym[name];
      var h = '<h4>' + SW.oct(a, 4) + (b.symAt(a) ? ' <span class="mono">' + SW.esc(b.symAt(a)) + '</span>' : '') + ' <span class="badge" style="background:' + colOf(kind[a]) + ';color:#000">' + kind[a] + '</span></h4><table class="mem-kv">' +
        (asmv != null ? '<tr><td>assembled</td><td class="mono">' + SW.oct(asmv) + '  ' + SW.esc(root.PDP1CPU.disasm(asmv, b.symAt)) + '</td></tr>' : '') +
        (asmv == null || now !== asmv ? '<tr><td>after ' + run.secs.toFixed(1) + ' s</td><td class="mono">' + SW.oct(now) + '  ' + SW.esc(root.PDP1CPU.disasm(now, b.symAt)) + '</td></tr>' : '') +
        '<tr><td>routine</td><td class="mono">' + SW.esc(routine[a] || '·') + '</td></tr>' +
        '<tr><td>in ' + run.secs.toFixed(1) + ' s</td><td>executed ' + run.exec[a].toLocaleString('en-GB') + ' · read ' + run.read[a].toLocaleString('en-GB') + ' · written ' + run.write[a].toLocaleString('en-GB') + (run.writer[a] >= 0 ? ', last by ' + SW.oct(run.writer[a], 4) + (b.symAt(run.writer[a]) ? ' (' + SW.esc(b.symAt(run.writer[a])) + ')' : '') : '') + '</td></tr>' +
        (sl ? '<tr><td>source</td><td><a href="#" data-go="' + a + '">' + SW.esc(b.parts[sl.sq.p].src.split('/').pop()) + ', line ' + sl.sq.n + '</a> ' + SW.refTag(b.v.id, sl.sq.p, sl.sq.n, sl.sq.n, b.parts.length) + '<div class="mono mem-src">' + SW.esc(sl.L.raw.trim()) + '</div></td></tr>' : '') + '</table>';
      if (sym && sym.refs && sym.refs.length) h += '<div class="hint">Used on ' + sym.refs.length + ' line' + (sym.refs.length > 1 ? 's' : '') + ':</div><div class="mem-refs">' + sym.refs.slice(0, 24).map(function (r) { var L = b.lines[r.file] && b.lines[r.file][r.line - 1]; return '<a href="#" data-ref="' + r.file + ':' + r.line + '" class="mono">' + r.line + '  ' + SW.esc(L ? L.raw.trim().slice(0, 40) : '') + '</a>'; }).join('') + (sym.refs.length > 24 ? '<span class="hint">and ' + (sym.refs.length - 24) + ' more</span>' : '') + '</div>';
      insp.innerHTML = h;
    }
    insp.addEventListener('click', function (e) {
      var go = e.target.closest('[data-go]'), rf = e.target.closest('[data-ref]');
      if (go) { e.preventDefault(); var sq = b.srcOf(+go.dataset.go); if (sq) goto(b.lines[sq.p][sq.n - 1]); }
      if (rf) { e.preventDefault(); var pr = rf.dataset.ref.split(':'); var L = b.lines[+pr[0]][+pr[1] - 1]; if (L) goto(L); }
    });
    // the segment table: contiguous stretches of one kind, with their labels
    var runs = [], r0 = 0;
    for (a = 1; a <= 4096; a++) if (a === 4096 || kind[a] !== kind[r0]) { runs.push({ a0: r0, a1: a - 1, kind: kind[r0] }); r0 = a; }
    var srows = runs.map(function (r) {
      var ls = labs.filter(function (x) { return x >= r.a0 && x <= r.a1; }).map(function (x) { return b.labelAt[x]; });
      return [{ html: '<span class="mono">' + SW.oct(r.a0, 4) + '–' + SW.oct(r.a1, 4) + '</span>', text: SW.oct(r.a0, 4) + '–' + SW.oct(r.a1, 4), sort: r.a0 }, r.a1 - r.a0 + 1,
              { html: '<i class="mem-dot" style="background:' + colOf(r.kind) + '"></i>' + r.kind, text: r.kind }, { html: '<span class="mono">' + SW.esc(ls.slice(0, 6).join(' ')) + (ls.length > 6 ? ' +' + (ls.length - 6) : '') + '</span>', text: ls.join(' ') }];
    });
    segs.appendChild(SW.el('h4', {}, 'Segments'));
    var st = SW.table(['Addresses', 'Words', 'Kind', 'Labels'], srows, { cls: ['mono', 'num', '', 'mono'], onRow: function (rw) { var a0 = rw[0].sort, rr = runs.filter(function (x) { return x.a0 === a0; })[0]; selRun = selRun === rr ? null : rr; sel = -1; draw(); } });
    var sc = SW.el('div', { class: 'scroll', style: 'max-height:300px;overflow:auto' }); sc.appendChild(st); segs.appendChild(sc);
    SW.$('[data-m="mode"]', tb).value = mode;
    SW.$('[data-m="mode"]', tb).onchange = function (e) { mode = e.target.value; SW.store.set('mem.mode', mode); draw(); };
    SW.$('[data-m="go"]', tb).addEventListener('keydown', function (e) {
      if (e.key !== 'Enter') return;
      var q = e.target.value.trim(), a2 = /^[0-7]{1,4}$/.test(q) ? parseInt(q, 8) : b.sym[q] && b.sym[q].defined !== false ? b.sym[q].val & 0o7777 : -1;
      if (a2 >= 0) inspect(a2); else SW.toast('No address or name “' + q + '” in this build.');
    });
    draw();
    insp.innerHTML = '<p class="hint">Click a word to inspect it: its value as assembled and as the program left it, its source line, the lines that use it, and how often it was executed, read and written.</p>';
    // the figure: the map by kind, as SVG
    var svg = function () {
      var o = ['<svg xmlns="http://www.w3.org/2000/svg" width="' + (64 * 9 + 60) + '" height="' + (64 * 9 + 10) + '" viewBox="0 0 ' + (64 * 9 + 60) + ' ' + (64 * 9 + 10) + '">'];
      for (var i = 0; i < 4096; i++) {
        var x = 52 + (i % 64) * 9, y = Math.floor(i / 64) * 9;
        o.push('<rect x="' + x + '" y="' + y + '" width="8" height="8" fill="' + MEMCOL[kind[i]] + '"><title>' + SW.oct(i, 4) + ' ' + kind[i] + (b.labelAt[i] ? ' ' + b.labelAt[i] : '') + '</title></rect>');
        if (i % 64 === 0) o.push('<text x="0" y="' + (y + 8) + '" font-size="8" fill="var(--text-dim)">' + SW.oct(i, 4) + '</text>');
      }
      return o.concat(['</svg>']).join('');
    };
    c.appendChild(SW.figureButtons(svg, 'spacewar-' + b.v.id + '-memory', SW.refText(b.v.id)));
    c.style.gridColumn = '1 / -1';
    el.appendChild(c);
    var counts = {}; kind.forEach(function (k) { counts[k] = (counts[k] || 0) + 1; });
    return function () { return [SW.tableBlock('Memory use', ['Kind', 'Words'], Object.keys(counts).map(function (k) { return [k, counts[k]]; })), SW.tableBlock('Segments', ['Addresses', 'Words', 'Kind', 'Labels'], srows)]; };
  }

  // ---------- 11 macros ----------
  function macros(b, el) {
    if (!b.asm) return null;
    var uses = {};
    b.asm.words.forEach(function (w) { if (w.macro) uses[w.macro] = (uses[w.macro] || 0) + 1; });
    var sites = {};
    b.asm.words.forEach(function (w) { if (w.macro) { sites[w.macro] = sites[w.macro] || {}; sites[w.macro][w.file + ':' + w.line] = 1; } });
    var rows = b.asm.macros.map(function (m) {
      return [m.name, m.args.join(', '), sites[m.name] ? Object.keys(sites[m.name]).length : 0, uses[m.name] || 0, SW.refOf(b.v.id, m.file, m.line, m.line, b.parts.length)];
    }).sort(function (a, b) { return b[3] - a[3]; });
    var c = card(rows.length + ' macros', 'Macro instructions: abbreviations the programmers wrote for themselves. Call sites and the words they expanded into.');
    c.appendChild(SW.table(['Macro', 'Dummies', 'Call sites', 'Words generated', 'Defined'], rows, { cls: ['mono', 'mono', 'num', 'num', 'mono'], onRow: function (r) { var m = b.macros[r[0]]; if (m) goto(b.lines[m.file][m.line - 1]); } }));
    c.style.gridColumn = '1 / -1';
    el.appendChild(c);
    return function () { return [SW.tableBlock('Macros', ['Macro', 'Dummies', 'Call sites', 'Words generated', 'Defined'], rows)]; };
  }

  // ---------- 12 the sky ----------
  function starsOf(b) {
    var stars = [];
    allLines(b).forEach(function (L) {
      var m = /^\s*(?:([0-9a-z]+),)?\s*mar[kc]\s+(-?\d+)\s*,\s*(-?\d+)\s*(\/.*)?$/i.exec(L.raw);
      if (m) stars.push({ x: +m[2], y: +m[3], name: (m[4] || '').replace(/^\/\s*/, '').trim(), label: m[1] || '', L: L });
    });
    return stars;
  }

  // The star map: Samson's table as a chart of the sky, in a modal. "mark X, Y"
  // measures both in 8192ths of a circle (X right ascension, Y declination:
  // Aldebaran's 1537, 371 is 67.5 degrees, +16.3 degrees), so the chart is drawn
  // at one scale in both directions, in two strips of twelve hours, right
  // ascension increasing to the left as on a map of the sky. Constellations
  // are Samson's own identifications, outlined around their stars (no stick
  // figures: the table has none).
  var CONST = { Orio: 'Orion', Taur: 'Taurus', Ophi: 'Ophiuchus', Aqar: 'Aquarius', Virg: 'Virgo', Erid: 'Eridanus', Ceti: 'Cetus', Hyda: 'Hydra', Leon: 'Leo',
    Serp: 'Serpens', Pisc: 'Pisces', Aqil: 'Aquila', Pegs: 'Pegasus', Mono: 'Monoceros', Capr: 'Capricornus', Herc: 'Hercules', Leps: 'Lepus', Libr: 'Libra',
    CMaj: 'Canis Major', Boot: 'Boötes', Gemi: 'Gemini', Sgtr: 'Sagittarius', Scor: 'Scorpius', Dlph: 'Delphinus', Crat: 'Crater', Sgte: 'Sagitta', Scut: 'Scutum',
    Corv: 'Corvus', Canc: 'Cancer', CMin: 'Canis Minor', Arie: 'Aries', Vulp: 'Vulpecula', Equl: 'Equuleus', Coma: 'Coma Berenices', Sext: 'Sextans', Pupp: 'Puppis' };
  function hull(pts) {
    pts = pts.slice().sort(function (a, b) { return a[0] - b[0] || a[1] - b[1]; });
    if (pts.length < 3) return pts;
    function cr(o, a, b) { return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]); }
    var lo = [], up = [];
    pts.forEach(function (p) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); });
    pts.slice().reverse().forEach(function (p) { while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop(); up.push(p); });
    return lo.slice(0, -1).concat(up.slice(0, -1));
  }
  // host: render into that element (the Star map tab) instead of a modal; returns a stop function
  SW.skyMap = function (b, host) {
    var stars = starsOf(b);
    if (!stars.length) { if (host) host.innerHTML = '<div class="pad hint">' + SW.esc(b.v.label) + ' carries no star table.</div>'; else SW.toast('This version carries no star table.'); return function () {}; }
    var mag = 1;
    stars.forEach(function (st) {
      var mm = /^(\d)j$/.exec(st.label); if (mm) mag = +mm[1];
      st.mag = mag;
      var c = /(?:^|\s)([A-Z][A-Za-z]{2,4})\b/.exec(st.name.split(',')[0]); st.con = c && CONST[c[1]] ? c[1] : '';   // '87 Taur', 'nu Hyda'
      st.proper = st.name.indexOf(',') > 0 ? st.name.split(',').slice(1).join(',').trim() : '';
      st.ra = st.x * 360 / 8192; st.dec = st.y * 360 / 8192;
    });
    var cons = [], byCon = {};
    stars.forEach(function (st) { if (!st.con) return; if (!byCon[st.con]) { byCon[st.con] = []; cons.push(st.con); } byCon[st.con].push(st); });
    cons.sort(function (a, c) { return byCon[c].length - byCon[a].length; });
    var hue = {}; cons.forEach(function (c, i) { hue[c] = Math.round((i * 137.508) % 360); });
    var unnamed = stars.filter(function (st) { return !st.con; }).length;
    var maxDec = Math.ceil(Math.max.apply(null, stars.map(function (st) { return Math.abs(st.dec); })) / 5) * 5;
    var W = 1400, ML = 44, MR = 18, S = (W - ML - MR) / 180, SH = 2 * maxDec * S, GAP = 56, TOP = 30;
    var H = TOP + 2 * SH + GAP + 40;
    function hms(deg) { var h = deg / 15, hh = Math.floor(h), mm = Math.round((h - hh) * 60); if (mm === 60) { hh++; mm = 0; } return hh + 'h ' + (mm < 10 ? '0' : '') + mm + 'm'; }
    function sgn(d) { return (d >= 0 ? '+' : '−') + Math.abs(d).toFixed(1) + '°'; }
    // strip 0: 12h (left) to 0h (right); strip 1: 24h to 12h
    function place(st) { var k = st.ra >= 180 ? 1 : 0, ra0 = k ? 360 : 180; return { k: k, x: ML + (ra0 - st.ra) * S, y: TOP + k * (SH + GAP) + (maxDec - st.dec) * S }; }
    function svg(pal) {
      var dark = !pal || !pal.bg || /^#0|^#1|black/i.test(pal.bg);
      var bg = pal && pal.bg ? pal.bg : '#04070d', ink = dark ? '#f4f1e6' : '#111', dim = dark ? '#8fa3b5' : '#555', grid = dark ? 'rgba(143,163,181,0.18)' : 'rgba(0,0,0,0.12)';
      var o = ['<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '" font-family="Helvetica, Arial, sans-serif">', '<rect width="' + W + '" height="' + H + '" fill="' + bg + '"/>'];
      for (var k = 0; k < 2; k++) {
        var y0 = TOP + k * (SH + GAP);
        o.push('<rect x="' + ML + '" y="' + y0 + '" width="' + (180 * S) + '" height="' + SH + '" fill="none" stroke="' + grid + '"/>');
        for (var h = 0; h <= 12; h++) { var x = ML + h * 15 * S, lab = (k ? 24 : 12) - h; o.push('<line x1="' + x + '" y1="' + y0 + '" x2="' + x + '" y2="' + (y0 + SH) + '" stroke="' + grid + '"/><text x="' + x + '" y="' + (y0 + SH + 14) + '" font-size="11" fill="' + dim + '" text-anchor="middle">' + (lab % 24) + 'h</text>'); }
        for (var d = -maxDec; d <= maxDec; d += 10) { if (d === -maxDec) continue; var yy = y0 + (maxDec - d) * S; o.push('<line x1="' + ML + '" y1="' + yy + '" x2="' + (ML + 180 * S) + '" y2="' + yy + '" stroke="' + grid + '"' + (d === 0 ? ' stroke-dasharray="4 4"' : '') + '/><text x="' + (ML - 6) + '" y="' + (yy + 4) + '" font-size="10" fill="' + dim + '" text-anchor="end">' + (d > 0 ? '+' : d < 0 ? '−' : '') + Math.abs(d) + '°</text>'); }
      }
      // constellations: an outline round each one's stars in each strip, and its name
      cons.forEach(function (c) {
        [0, 1].forEach(function (k) {
          var pts = byCon[c].map(place).filter(function (p) { return p.k === k; });
          if (!pts.length) return;
          var col = 'hsl(' + hue[c] + ',65%,' + (dark ? 66 : 38) + '%)';
          var hp = hull(pts.map(function (p) { return [p.x, p.y]; }));
          var cx = pts.reduce(function (a, p) { return a + p.x; }, 0) / pts.length, cy = pts.reduce(function (a, p) { return a + p.y; }, 0) / pts.length;
          var pad = hp.map(function (q) { var dx = q[0] - cx, dy = q[1] - cy, l = Math.sqrt(dx * dx + dy * dy) || 1; return [q[0] + dx / l * 9, q[1] + dy / l * 9]; });
          if (pad.length >= 3) o.push('<path class="sky-con" data-c="' + c + '" d="M' + pad.map(function (q) { return q[0].toFixed(1) + ' ' + q[1].toFixed(1); }).join(' L') + ' Z" fill="' + col + '" fill-opacity="0.06" stroke="' + col + '" stroke-opacity="0.75" stroke-width="1.2" stroke-dasharray="5 4" stroke-linejoin="round"><title>' + SW.esc((CONST[c] || c) + ': ' + byCon[c].length + ' stars') + '</title></path>');
          else o.push('<circle class="sky-con" data-c="' + c + '" cx="' + cx.toFixed(1) + '" cy="' + cy.toFixed(1) + '" r="12" fill="none" stroke="' + col + '" stroke-opacity="0.75" stroke-dasharray="5 4"/>');
          if (pts.length * 2 >= byCon[c].filter(function () { return true; }).length || pts.length >= 3)
            o.push('<text x="' + cx.toFixed(1) + '" y="' + (Math.max.apply(null, pts.map(function (p) { return p.y; })) + 22).toFixed(1) + '" font-size="10.5" letter-spacing="1.2" fill="' + col + '" text-anchor="middle">' + SW.esc((CONST[c] || c).toUpperCase()) + '</text>');
        });
      });
      // the stars, by Samson's groups (1 the brightest)
      var R = { 1: 4.6, 2: 3.3, 3: 2.3, 4: 1.6 };
      stars.forEach(function (st) {
        var p = place(st);
        o.push('<circle cx="' + p.x.toFixed(1) + '" cy="' + p.y.toFixed(1) + '" r="' + (R[st.mag] || 1.6) + '" fill="' + ink + '"><title>' + SW.esc(st.name + ' · mark ' + st.x + ', ' + st.y + ' · RA ' + hms(st.ra) + ', Dec ' + sgn(st.dec) + ' · group ' + st.mag + ' · line ' + st.L.n) + '</title></circle>');
        if (st.proper) o.push('<text x="' + (p.x + 6).toFixed(1) + '" y="' + (p.y - 5).toFixed(1) + '" font-size="10" fill="' + ink + '" fill-opacity="0.85">' + SW.esc(st.proper) + '</text>');
      });
      o.push('<text x="' + ML + '" y="18" font-size="12" fill="' + dim + '">' + SW.esc(b.v.label + ' ' + SW.refText(b.v.id) + ': the Expensive Planetarium, ' + stars.length + ' stars in ' + cons.length + ' constellations (right ascension increasing to the left; declination ' + '±' + maxDec + '°)') + '</text>');
      if (!pal) o.push('<g class="sky-win"></g>');   // the scope's window, drawn live (not exported)
      return o.concat(['</svg>']).join('');
    }
    var dlg = host ? SW.el('div', { class: 'sky-dlg sky-page' }) : SW.el('dialog', { class: 'sky-dlg' });
    dlg.innerHTML = '<div class="rd-head"><h2>Star map: ' + SW.esc(b.v.label) + ' ' + SW.refTag(b.v.id) + '</h2><button class="btn ghost" data-a="close" title="Close (Esc)">✕</button></div>' +
      '<p class="hint">Peter Samson’s star table (“stars by prs”), ' + stars.length + ' stars from the line <span class="mono">' + SW.esc(stars[0].L.raw.trim()) + '</span> ' + SW.refTag(b.v.id, stars[0].L.p, stars[0].L.n, stars[0].L.n, b.parts.length) + ' on. Each <span class="mono">mark X, Y</span> is drawn at X and Y in 8192ths of a circle: right ascension and declination. Dot sizes follow Samson’s four groups (labels 1j–1q, 2j–2q, 3j–3q, 4j–4q), the brightest largest. Constellations are his identifications, outlined round their stars' + (unnamed ? ' (' + unnamed + ' stars carry no identification in this table and belong to none)' : '') + '; hover a star for its entry.</p>' +
      '<div class="svgbox sky-box"></div><div class="sky-cons"></div><div class="sky-exp"></div>' +
      '<div class="sky-scope"><h3>On the scope</h3><div class="sky-scope-row"><div class="sky-crt-wrap"><canvas class="sky-crt" width="440" height="440"></canvas><canvas class="sky-over" width="880" height="880"></canvas></div>' +
      '<div class="sky-scope-side"><div class="sky-scope-ctl"></div><div class="sky-scope-exp"></div><p class="sky-scope-read mono"></p><div class="sky-scope-how"></div></div></div></div>';
    if (host) { host.innerHTML = ''; host.appendChild(dlg); SW.$('[data-a="close"]', dlg).remove(); } else document.body.appendChild(dlg);
    var box = SW.$('.sky-box', dlg);
    box.innerHTML = svg();
    SW.$('.sky-exp', dlg).appendChild(SW.figureButtons(svg, 'spacewar-' + b.v.id + '-star-map', SW.refText(b.v.id)));
    SW.$('.sky-cons', dlg).innerHTML = cons.map(function (c) {
      return '<span class="sky-chip" data-c="' + c + '"><i style="background:hsl(' + hue[c] + ',65%,60%)"></i>' + SW.esc(CONST[c] || c) + ' <b>' + byCon[c].length + '</b></span>';
    }).join('');
    SW.$('.sky-cons', dlg).addEventListener('mouseover', function (e) {
      var ch = e.target.closest('.sky-chip');
      SW.$$('.sky-con', box).forEach(function (p) { p.classList.toggle('lit', !!ch && p.getAttribute('data-c') === ch.dataset.c); });
    });
    SW.$('.sky-cons', dlg).addEventListener('mouseleave', function () { SW.$$('.sky-con', box).forEach(function (p) { p.classList.remove('lit'); }); });
    var stopScope = scopeDemo();
    if (host) return stopScope;
    SW.$('[data-a="close"]', dlg).onclick = function () { dlg.close(); };
    dlg.addEventListener('close', function () { stopScope(); dlg.remove(); });
    dlg.showModal();

    // ---------- on the scope ----------
    // The background display as each version's own code does it (read from its
    // source): dislis takes each star's stored X (8192 minus the mark X), less
    // fpr, keeps it if it falls in the 1024 units below fpr (wrapping round the
    // circle), centres it and plots it with its Y: a window 45 degrees square.
    // Brightness is by intensity (dislis J, Q, B: 3.1 on) or by how often a group
    // is redrawn (1m to 4m: 2B, and the ddp line 4.2 to 4.4); fpr falls by one
    // unit every so many passes of the main loop, so the sky drifts.
    function scopeDemo() {
      var src = allLines(b).map(function (L) { return L.raw.replace(/\/.*$/, '').trim(); });
      var calls = {}, mode = 'refresh';
      src.forEach(function (t) { var m = /^dislis\s+([1-4])j\s*,\s*\1q\s*,\s*([0-7])/.exec(t); if (m) { calls[+m[1]] = +m[2]; mode = 'intensity'; } });
      var rate = { 1: 2, 2: 1, 3: 0.5, 4: 0.25 };   // 1m twice a pass, 2m once, 3m when bcc is odd, 4m when bcc & 3 is 0
      var fpr0 = 0, scrollN = 0, fastN = 0, bccN = 0, twoB = false, inv2B = false;
      // 'law i N', directly or through 'xct name' to a constant 'name, …, law i N' (the CHM builds)
      function lawOf(t) {
        var m = /^(?:\w+,\s*)?law i\s+([0-7]+)/.exec(t); if (m) return parseInt(m[1], 8);
        var x = /^(?:\w+,\s*)?xct\s+(\w+)/.exec(t);
        if (x) for (var k = 0; k < src.length; k++) { var d = new RegExp('^' + x[1] + ',.*law i\\s+([0-7]+)').exec(src[k]); if (d) return parseInt(d[1], 8); }
        return 0;
      }
      for (var i = 0; i < src.length; i++) {
        var fm = /^fpr,\s*([0-7]+)/.exec(src[i]); if (fm) fpr0 = parseInt(fm[1], 8);
        if (/^(?:\w+,\s*)?isp\s+\\?bkc/.test(src[i])) {
          var got = [];
          for (var j = i + 1; j < i + 6 && j < src.length; j++) { var lv = lawOf(src[j]); if (lv) got.push(lv); if (/^(?:\w+,\s*)?dac\s+\\?bkc/.test(src[j])) break; }
          if (got.length) { scrollN = got[0]; if (got.length > 1) fastN = got[1]; }
        }
        if (/^bcx,\s*jmp \.$/.test(src[i])) bccN = lawOf(src[i + 1] || '') || bccN;
        if (/^bck,/.test(src[i])) for (var j2 = i; j2 < i + 5 && j2 < src.length; j2++) { if (/^szs\s+30/.test(src[j2])) twoB = true; if (/^szs\s+i\s+30/.test(src[j2])) twoB = inv2B = true; }   // 2B's switches, in bck itself; the 25 March listing tests them the other way round
      }
      var unread = !scrollN || (mode === 'intensity' && !bccN);
      if (!scrollN) scrollN = 32;
      if (!bccN) bccN = 2;
      var perUnit = mode === 'intensity' ? scrollN * bccN : scrollN;       // passes per unit of drift
      var perFast = fastN ? fastN : 0;
      var groups = mode === 'intensity' ? Object.keys(calls).map(Number) : [1, 2, 3, 4];
      // the main loop's rate, measured: run the build for two emulated seconds and count calls of bck
      var passes = 0, bckAt = B_SYM('bck');
      function B_SYM(n) { return b.sym[n] && b.sym[n].defined !== false ? b.sym[n].val : -1; }
      try {
        var cpu = new root.PDP1CPU.PDP1(SW.cpuOpts(b.v));
        cpu.load(b.asm.memory, b.asm.start);
        cpu.run(400000);
        if (bckAt >= 0) passes = cpu.execCount[bckAt] / (cpu.cycles * 5e-6);
      } catch (e) { passes = 0; }
      if (!passes) passes = 30;
      // each star as the code holds it
      var pts = stars.filter(function (st) { return groups.indexOf(st.mag) >= 0; }).map(function (st) {
        return { st: st, S: (8192 - st.x) & 8191, Y: st.y, g: st.mag };
      });
      var cv = SW.$('canvas.sky-crt', dlg), g = cv.getContext('2d'), N = cv.width;
      g.fillStyle = '#000'; g.fillRect(0, 0, N, N);
      var fpr = fpr0, acc = 0, pass = 0, playing = false, speed = 1, sw3 = false, sw4 = false, last = null, raf = 0, winAt = -1;
      // 2B's switches as the 2 April tape reads them (the 25 March listing's are the other way round)
      function E3() { return inv2B ? !sw3 : sw3; }
      function E4() { return inv2B ? !sw4 : sw4; }
      function inView(p) { var u = ((p.S - fpr) % 8192 + 8192) % 8192; return u > 7168 ? u - 7680 : null; }
      function plot(p, x, s) {
        var px = (x + 512) * N / 1024, py = (511 - p.Y) * N / 1024;
        g.fillStyle = 'rgba(200,236,255,' + SW.beam(s).toFixed(3) + ')';
        g.fillRect(px - 1.2, py - 1.2, 2.6, 2.6);
      }
      var chmMap = SW.chmInten(b.v);
      function sgn3(v) { if (chmMap) v = chmMap[v & 7]; return v & 4 ? v - 8 : v; }   // intensity: 3 bits, 4 dimmest to 3 brightest (PDP-35-2); the CHM's machine maps 4 to 7 otherwise
      function drawGroup(gr, s) { pts.forEach(function (p) { if (p.g !== gr) return; var x = inView(p); if (x !== null) plot(p, x, s); }); }
      function onePass() {
        pass++;
        var starsOff = twoB ? (E3() && E4()) : sw4;
        if (!starsOff) {
          if (mode === 'intensity') { if (pass % bccN === 0) groups.forEach(function (gr) { drawGroup(gr, sgn3(calls[gr])); }); }
          else { drawGroup(1, 0); drawGroup(2, 0); if (pass & 1) drawGroup(3, 0); if ((pass & 3) === 0) drawGroup(4, 0); drawGroup(1, 0); }
        }
        var still = twoB ? E3() : false, every = twoB && E4() && perFast ? perFast : perUnit;
        if (!still && pass % every === 0) { fpr = fpr - 1; if (fpr < 0) fpr += 8192; }
      }
      // The chart laid over the screen: the map's constellation outlines and names,
      // the named stars, and a faint grid of RA hours and declination, all where
      // the window puts them. A layer of its own, so the phosphor fade leaves it.
      var over = SW.$('canvas.sky-over', dlg), og = over.getContext('2d'), ON = over.width, chartOn = true;   // on by default
      function scr(S, Y) { var u = ((S - fpr) % 8192 + 8192) % 8192; if (u <= 7168) return null; return [(u - 7680 + 512) * ON / 1024, (511 - Y) * ON / 1024]; }
      function drawOverlay() {
        og.clearRect(0, 0, ON, ON);
        if (!chartOn) return;
        og.save();
        og.font = '19px Helvetica, Arial, sans-serif'; og.lineWidth = 1.6;
        // grid: RA every hour (mark X = h * 8192/24), declination every 10 degrees
        og.strokeStyle = 'rgba(143,163,181,0.22)'; og.fillStyle = 'rgba(143,163,181,0.7)';
        for (var h = 0; h < 24; h++) {
          var S0 = (8192 - Math.round(h * 8192 / 24)) & 8191, a = scr(S0, 0);
          if (!a) continue;
          og.beginPath(); og.moveTo(a[0], 0); og.lineTo(a[0], ON); og.stroke();
          og.fillText(h + 'h', a[0] + 4, ON / 2 - 6);
        }
        for (var d = -20; d <= 20; d += 10) {
          var y = (511 - d * 8192 / 360) * ON / 1024;
          og.setLineDash(d === 0 ? [6, 6] : []); og.beginPath(); og.moveTo(0, y); og.lineTo(ON, y); og.stroke(); og.setLineDash([]);
          if (d) og.fillText((d > 0 ? '+' : '−') + Math.abs(d) + '°', 12 + ON * 0.12, y - 4);
        }
        // constellations in view: outline round their stars, and the name
        cons.forEach(function (c) {
          var q = pts.filter(function (p) { return p.st.con === c; }).map(function (p) { return scr(p.S, p.Y); }).filter(Boolean);
          if (!q.length) return;
          var col = 'hsl(' + hue[c] + ',70%,66%)';
          var cx = q.reduce(function (a2, p) { return a2 + p[0]; }, 0) / q.length, cy = q.reduce(function (a2, p) { return a2 + p[1]; }, 0) / q.length;
          var hp = hull(q), pad = hp.map(function (p) { var dx = p[0] - cx, dy = p[1] - cy, l = Math.sqrt(dx * dx + dy * dy) || 1; return [p[0] + dx / l * 14, p[1] + dy / l * 14]; });
          og.strokeStyle = col; og.fillStyle = col; og.globalAlpha = 0.85; og.lineWidth = 2.4; og.setLineDash([10, 8]);
          og.beginPath();
          if (pad.length >= 3) { og.moveTo(pad[0][0], pad[0][1]); pad.slice(1).forEach(function (p) { og.lineTo(p[0], p[1]); }); og.closePath(); }
          else og.arc(cx, cy, 18, 0, 6.2832);
          og.stroke(); og.setLineDash([]);
          og.globalAlpha = 0.07; og.fill(); og.globalAlpha = 0.95;
          og.font = 'bold 22px Helvetica, Arial, sans-serif'; og.textAlign = 'center';
          og.fillText((CONST[c] || c).toUpperCase(), cx, Math.min(ON - 30, Math.max.apply(null, q.map(function (p) { return p[1]; })) + 40));
          og.textAlign = 'left'; og.globalAlpha = 1;
        });
        // named stars
        og.fillStyle = 'rgba(244,241,230,0.92)'; og.font = '20px Helvetica, Arial, sans-serif';
        pts.forEach(function (p) { if (!p.st.proper) return; var a = scr(p.S, p.Y); if (a) og.fillText(p.st.proper, a[0] + 9, a[1] - 7); });
        og.restore();
      }
      // The scope as a figure: the round screen, the stars in the window at their
      // relative brightness (intensity by SW.beam, as the Run view draws it; by
      // redrawing, in the proportion 2 : 1 : 1/2 : 1/4), the chart if it is on.
      function scopeSVG(pal) {
        var Z = 880, o = ['<svg xmlns="http://www.w3.org/2000/svg" width="' + Z + '" height="' + (Z + 70) + '" viewBox="0 0 ' + Z + ' ' + (Z + 70) + '" font-family="Helvetica, Arial, sans-serif">'];
        if (pal && pal.bg) o.push('<rect width="' + Z + '" height="' + (Z + 70) + '" fill="' + pal.bg + '"/>');
        o.push('<defs><clipPath id="scope"><circle cx="' + Z / 2 + '" cy="' + Z / 2 + '" r="' + (Z / 2 - 6) + '"/></clipPath></defs>');
        o.push('<circle cx="' + Z / 2 + '" cy="' + Z / 2 + '" r="' + (Z / 2 - 2) + '" fill="#000" stroke="#3a4650" stroke-width="8"/><g clip-path="url(#scope)">');
        var off = twoB ? (E3() && E4()) : sw4, RB = { 1: 1, 2: 0.82, 3: 0.62, 4: 0.45 };
        if (chartOn) {
          for (var h = 0; h < 24; h++) { var a = scr((8192 - Math.round(h * 8192 / 24)) & 8191, 0); if (a) o.push('<line x1="' + a[0].toFixed(1) + '" y1="0" x2="' + a[0].toFixed(1) + '" y2="' + Z + '" stroke="rgba(143,163,181,0.25)"/><text x="' + (a[0] + 4).toFixed(1) + '" y="' + (Z / 2 - 6) + '" font-size="18" fill="rgba(143,163,181,0.8)">' + h + 'h</text>'); }
          for (var dd = -20; dd <= 20; dd += 10) { var yy = (511 - dd * 8192 / 360) * Z / 1024; o.push('<line x1="0" y1="' + yy.toFixed(1) + '" x2="' + Z + '" y2="' + yy.toFixed(1) + '" stroke="rgba(143,163,181,0.25)"' + (dd === 0 ? ' stroke-dasharray="6 6"' : '') + '/>' + (dd ? '<text x="' + (12 + Z * 0.12) + '" y="' + (yy - 4).toFixed(1) + '" font-size="18" fill="rgba(143,163,181,0.8)">' + (dd > 0 ? '+' : '−') + Math.abs(dd) + '°</text>' : '')); }
          cons.forEach(function (c) {
            var q = pts.filter(function (p) { return p.st.con === c; }).map(function (p) { return scr(p.S, p.Y); }).filter(Boolean);
            if (!q.length) return;
            var col = 'hsl(' + hue[c] + ',70%,66%)', cx = q.reduce(function (a2, p) { return a2 + p[0]; }, 0) / q.length, cy = q.reduce(function (a2, p) { return a2 + p[1]; }, 0) / q.length;
            var pad = hull(q).map(function (p) { var dx = p[0] - cx, dy = p[1] - cy, l = Math.sqrt(dx * dx + dy * dy) || 1; return [p[0] + dx / l * 14, p[1] + dy / l * 14]; });
            o.push(pad.length >= 3 ? '<path d="M' + pad.map(function (p) { return p[0].toFixed(1) + ' ' + p[1].toFixed(1); }).join(' L') + ' Z" fill="' + col + '" fill-opacity="0.07" stroke="' + col + '" stroke-width="2.4" stroke-dasharray="10 8"/>' : '<circle cx="' + cx.toFixed(1) + '" cy="' + cy.toFixed(1) + '" r="18" fill="none" stroke="' + col + '" stroke-width="2.4" stroke-dasharray="10 8"/>');
            o.push('<text x="' + cx.toFixed(1) + '" y="' + Math.min(Z - 30, Math.max.apply(null, q.map(function (p) { return p[1]; })) + 40).toFixed(1) + '" font-size="22" font-weight="bold" fill="' + col + '" text-anchor="middle">' + SW.esc((CONST[c] || c).toUpperCase()) + '</text>');
          });
        }
        if (!off) pts.forEach(function (p) {
          if (inView(p) === null) return;
          var a = scr(p.S, p.Y), al = mode === 'intensity' ? SW.beam(sgn3(calls[p.g])) : RB[p.g];
          o.push('<circle cx="' + a[0].toFixed(1) + '" cy="' + a[1].toFixed(1) + '" r="3.2" fill="rgb(200,236,255)" fill-opacity="' + al.toFixed(2) + '"><title>' + SW.esc(p.st.name) + '</title></circle>');
          if (chartOn && p.st.proper) o.push('<text x="' + (a[0] + 9).toFixed(1) + '" y="' + (a[1] - 7).toFixed(1) + '" font-size="20" fill="rgba(244,241,230,0.92)">' + SW.esc(p.st.proper) + '</text>');
        });
        o.push('</g>');
        var ink = pal && pal.ink ? pal.ink : '#8fa3b5', ra0 = (8192 - fpr) * 360 / 8192;
        o.push('<text x="' + Z / 2 + '" y="' + (Z + 28) + '" font-size="18" fill="' + ink + '" text-anchor="middle">' + SW.esc(b.v.label + ' on the Type 30 scope: fpr ' + SW.oct(fpr, 5) + ', window RA ' + hms(ra0) + '–' + hms(ra0 + 45)) + '</text>');
        o.push('<text x="' + Z / 2 + '" y="' + (Z + 54) + '" font-size="15" fill="' + ink + '" text-anchor="middle">' + SW.esc(mode === 'intensity' ? 'Brightness by intensity: ' + groups.map(function (gr) { return 'group ' + gr + ' at ' + calls[gr]; }).join(', ') : 'Brightness by redrawing: groups 1–4 drawn 2, 1, ½, ¼ times a pass') + '</text>');
        return o.concat(['</svg>']).join('');
      }
      function fade(dt) { var keep = Math.exp(-dt / 0.12); g.fillStyle = 'rgba(0,2,4,' + (1 - keep).toFixed(4) + ')'; g.fillRect(0, 0, N, N); }
      function hms(deg) { deg = ((deg % 360) + 360) % 360; var h = deg / 15, hh = Math.floor(h), mm = Math.round((h - hh) * 60); if (mm === 60) { hh++; mm = 0; } return (hh % 24) + 'h' + (mm < 10 ? '0' : '') + mm + 'm'; }
      // the window on the map: stored X from fpr-1024 to fpr is mark X from 8192-fpr to 9216-fpr
      function drawWindow() {
        var gw = SW.$('.sky-win', box); if (!gw) return;
        var x0 = 8192 - fpr, ra0 = x0 * 360 / 8192, ra1 = ra0 + 45, h = '';
        [[ra0, ra1]].forEach(function (iv) {
          for (var k = 0; k < 2; k++) {
            var lo = k ? 180 : 0, hi = k ? 360 : 180;
            [[iv[0], iv[1]], [iv[0] - 360, iv[1] - 360], [iv[0] + 360, iv[1] + 360]].forEach(function (q) {
              var a = Math.max(q[0], lo), c = Math.min(q[1], hi);
              if (c <= a) return;
              var ra00 = k ? 360 : 180, xL = ML + (ra00 - c) * S, xR = ML + (ra00 - a) * S, y0 = TOP + k * (SH + GAP);
              h += '<rect x="' + xL.toFixed(1) + '" y="' + y0 + '" width="' + (xR - xL).toFixed(1) + '" height="' + SH + '" fill="rgba(255,206,122,0.10)" stroke="#ffce7a" stroke-width="1.6"/>';
            });
          }
        });
        gw.innerHTML = h;
        drawOverlay();
        var n = pts.filter(function (p) { return inView(p) !== null; }).length;
        var turn = 8192 * perUnit / passes;
        read.textContent = 'fpr ' + SW.oct(fpr, 5) + ' · window RA ' + hms(ra0) + '–' + hms(ra1) + ' · ' + n + ' stars in view · main loop ' + passes.toFixed(1) + ' passes a second (measured) · drift one unit every ' + perUnit + ' passes' + (twoB && perFast ? (inv2B ? ' with sense switch 4 on (' + perFast + ' with it off)' : ' (' + perFast + ' with sense switch 4)') : '') + ', a full turn of the sky in ' + (turn / 60).toFixed(0) + ' minutes' + (unread ? ' (the timing could not be read from this source; 3.1’s is assumed)' : '');
      }
      function tick(t) {
        if (!cv.offsetParent) { last = null; raf = requestAnimationFrame(tick); return; }   // the tab is hidden: wait
        var dt = last == null ? 0 : Math.min(0.1, (t - last) / 1000);
        last = t;
        if (playing) {
          acc += dt * passes * speed;
          var n = Math.floor(acc); acc -= n;
          fade(dt);
          var drawn = Math.min(n, 60);   // at speed, only the latest passes are drawn; the drift keeps count
          for (var q = 0; q < n; q++) { if (q < n - drawn) { var sv = pass; pass++; var still = twoB ? E3() : false, every = twoB && E4() && perFast ? perFast : perUnit; if (!still && pass % every === 0) { fpr = (fpr + 8191) % 8192; } void sv; } else onePass(); }
          if (fpr !== winAt) { winAt = fpr; drawWindow(); }
        }
        raf = requestAnimationFrame(tick);
      }
      var ctl = SW.$('.sky-scope-ctl', dlg), read = SW.$('.sky-scope-read', dlg);
      ctl.innerHTML = '<button class="btn" data-s="play">▶ Run the sky</button> <label class="check">Speed <select data-s="speed"><option value="1">as the program ran</option><option value="16">× 16</option><option value="64">× 64</option><option value="512">× 512</option></select></label> ' +
        (twoB && inv2B ? '<label class="check" title="25 March 2B: the sky drifts only with sense switch 3 on; with switches 3 and 4 both off there are no stars"><input type="checkbox" data-s="sw3"> Sense switch 3</label> <label class="check" title="25 March 2B: the sky drifts every ' + perFast + ' passes unless sense switch 4 is on; with switches 3 and 4 both off there are no stars"><input type="checkbox" data-s="sw4"> Sense switch 4</label>'
        : twoB ? '<label class="check" title="2B: sense switch 3 holds the sky still (and with switch 4 turns the stars off)"><input type="checkbox" data-s="sw3"> Sense switch 3</label> <label class="check" title="2B: sense switch 4 makes the sky drift every ' + perFast + ' passes (and with switch 3 turns the stars off)"><input type="checkbox" data-s="sw4"> Sense switch 4</label>'
              : '<label class="check" title="Sense switch 4 turns the stars off (szs 40, jmp bcx)"><input type="checkbox" data-s="sw4"> Sense switch 4</label>') +
        ' <label class="check" title="Lay the star map’s constellation outlines and names, the named stars and a grid of RA and declination over the screen"><input type="checkbox" data-s="chart" checked> Chart overlay</label>' +
        ' <span class="hint">Click the map to move the window.</span>';
      ctl.addEventListener('click', function (e) {
        var bt = e.target.closest('[data-s="play"]');
        if (bt) { playing = !playing; bt.textContent = playing ? '❚❚ Pause' : '▶ Run the sky'; }
      });
      ctl.addEventListener('change', function (e) {
        var d = e.target.dataset.s;
        if (d === 'speed') speed = +e.target.value;
        if (d === 'sw3') sw3 = e.target.checked;
        if (d === 'sw4') sw4 = e.target.checked;
        if (d === 'chart') chartOn = e.target.checked;
        drawWindow();
      });
      box.addEventListener('click', function (e) {
        var svgEl = SW.$('svg', box), r = svgEl.getBoundingClientRect(), k2 = W / r.width, x = (e.clientX - r.left) * k2, y = (e.clientY - r.top) * k2;
        var strip = y < TOP + SH + GAP / 2 ? 0 : 1, ra = (strip ? 360 : 180) - (x - ML) / S;
        if (x < ML || x > ML + 180 * S) return;
        // centre the window on the click: its middle is stored X fpr - 512, mark X 8192 - (fpr - 512)
        var X = Math.round(ra * 8192 / 360);
        fpr = ((8192 - X) + 512 + 8192) % 8192;
        g.fillStyle = '#000'; g.fillRect(0, 0, N, N);
        if (!playing) { for (var q = 0; q < 4; q++) onePass(); }
        winAt = fpr; drawWindow();
      });
      var ex = SW.$('.sky-scope-exp', dlg), name = 'spacewar-' + b.v.id + '-scope';
      var fb = SW.figureButtons(scopeSVG, name, SW.refText(b.v.id));
      fb.appendChild(document.createTextNode(' '));
      fb.appendChild(SW.el('button', { class: 'btn', title: 'Save the phosphor screen as it is now (with the chart, if it is on), as a PNG', onclick: function () {
        var c = document.createElement('canvas'); c.width = ON; c.height = ON;
        var x = c.getContext('2d');
        x.save();
        x.drawImage(cv, 0, 0, ON, ON); x.drawImage(over, 0, 0);
        x.restore();
        c.toBlob(function (blob) { blob.arrayBuffer().then(function (buf) { root.SWExport.download(name + '-screen.png', new Uint8Array(buf), 'image/png'); }); }, 'image/png');
      } }, '▣ Screen PNG'));
      ex.appendChild(fb);
      var how = SW.$('.sky-scope-how', dlg);
      how.innerHTML = '<p>How the stars reach the round screen, as this version’s code does it:</p><ol>' +
        '<li><b>Stored.</b> <span class="mono">mark X, Y</span> puts two words in core: <span class="mono">8192−X</span>, and <span class="mono">Y</span> shifted left 8 bits (<span class="mono">repeat 8, Y=Y+Y</span>), so Y is already in scope units.</li>' +
        '<li><b>The window.</b> <span class="mono">dislis</span> takes the stored X less <span class="mono">fpr</span>, the right margin; a star is shown only if that falls in the 1,024 units below <span class="mono">fpr</span>, wrapping round at 8,192 (<span class="mono">add (2000</span>, <span class="mono">add (−20000+2000</span>). 1,024 units is an eighth of the circle, 45° of right ascension; Y spans ±512 points on the same scale, so the scope shows 45° by 45° of sky, the round tube cutting the corners.</li>' +
        '<li><b>Plotted.</b> <span class="mono">sub (1000</span> centres it, <span class="mono">sal 8s</span> moves it into the display’s X bits, <span class="mono">lio</span> Y, <span class="mono">dpy</span>.</li>' +
        (mode === 'intensity' ? '<li><b>Brightness by intensity.</b> Every ' + bccN + ' passes the groups are drawn with <span class="mono">dislis J, Q, B</span>, the intensity B set into the dpy instruction (<span class="mono">dpy-i+B</span>): ' + groups.map(function (gr) { return 'group ' + gr + ' at ' + calls[gr]; }).join(', ') + '.' + (groups.length < 4 ? ' Group ' + [1, 2, 3, 4].filter(function (gr) { return groups.indexOf(gr) < 0; }).join(', ') + ' is not drawn.' : '') + '</li>'
          : '<li><b>Brightness by redrawing.</b> Each pass draws group 1 twice (<span class="mono">jsp 1m</span> at the start and the end), group 2 once, group 3 every second pass (<span class="mono">and (1</span>) and group 4 every fourth (<span class="mono">and (3</span>), all at one intensity; the phosphor makes the more often drawn brighter.</li>') +
        '<li><b>The drift.</b> Every ' + perUnit + ' passes of the main loop <span class="mono">fpr</span> falls by one (' + (mode === 'intensity' ? 'every ' + scrollN + ' star frames, ' + bccN + ' passes each' : '<span class="mono">law i ' + scrollN.toString(8) + '</span>') + '), so the stars move slowly across the screen. It starts at ' + SW.oct(fpr0, 5) + '.' + (twoB && inv2B ? ' This listing tests sense switches 3 and 4 the other way round from the 2 April tape: the sky drifts only with switch 3 on, drifts every ' + perFast + ' passes unless switch 4 is on, and with both off there are no stars.' : twoB ? ' Sense switch 3 holds the sky still; switch 4 makes it drift every ' + perFast + ' passes; both together turn the stars off.' : ' Sense switch 4 turns the stars off.') + '</li></ol>' +
        '<p class="hint">The main loop’s rate is measured by running this version on the bench’s emulator for two emulated seconds and counting its calls of <span class="mono">bck</span>.</p>' +
        (SW.draws && SW.draws.TYPE30 ? '<p class="dr-t30">' + SW.esc(SW.draws.TYPE30) + '</p>' : '');
      drawWindow();
      for (var q0 = 0; q0 < 4; q0++) onePass();
      raf = requestAnimationFrame(tick);
      dlg.stepScope = function (sec) { var n = Math.round(sec * passes * speed); for (var q = 0; q < n; q++) onePass(); drawWindow(); };
      return function () { cancelAnimationFrame(raf); };
    }
  };


  function sky(b, el) {
    var stars = starsOf(b);
    var c = card('The Expensive Planetarium', stars.length ? stars.length + ' stars, each entered as “mark X, Y” (X increasing across 8192 units of right ascension, Y declination), with Samson’s own identifications. Groups begin at the labels 1j, 2j, 3j, 4j (magnitude groups).' : 'This build carries no star table.');
    if (!stars.length) { el.appendChild(c); return null; }
    var mag = 1, W = 1024, H = 280;
    var svg = function (pal) {
      pal = pal || SW.PLATE;
      var o = ['<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '">' + (pal.bg ? '<rect width="' + W + '" height="' + H + '" fill="' + pal.bg + '"/>' : '')];
      mag = 1;
      stars.forEach(function (s) {
        var mm = /^(\d)j$/.exec(s.label); if (mm) mag = +mm[1];
        var x = W - (s.x / 8192) * W, y = H / 2 - s.y * (H / 2 - 8) / 512;
        o.push('<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="' + (4.4 - mag * 0.8).toFixed(1) + '" fill="' + pal.ink + '"><title>' + SW.esc(s.name + ' (mark ' + s.x + ', ' + s.y + ')') + '</title></circle>');
        if (mag === 1) o.push('<text x="' + (x + 5).toFixed(1) + '" y="' + (y - 4).toFixed(1) + '" font-size="9" fill="' + pal.dim + '">' + SW.esc(s.name.replace(/^\d+\s*/, '').split(',').pop().trim()) + '</text>');
      });
      return o.concat(['</svg>']).join('');
    };
    var box = SW.el('div', { class: 'svgbox', style: 'cursor:zoom-in', title: 'Open the star map, with the constellations marked' }, svg());
    box.onclick = function () { SW.skyMap(b); };
    c.appendChild(box);
    var fb = SW.figureButtons(svg, 'spacewar-' + b.v.id + '-sky', SW.refText(b.v.id));
    fb.insertBefore(SW.el('button', { class: 'btn', onclick: function () { SW.skyMap(b); } }, '✦ Star map'), fb.firstChild);
    c.appendChild(fb);
    c.style.gridColumn = '1 / -1';
    el.appendChild(c);
    return function () { return [SW.tableBlock('Star table', ['Label', 'X', 'Y', 'Identification', 'Line'], stars.map(function (s) { return [s.label, String(s.x), String(s.y), s.name, String(s.L.n)]; }))]; };
  }

  // ---------- 13 the ships ----------
  // Decode an outline table as the outline compiler (oc) does: each octal
  // digit read from the top of the word is a step, plotted after moving.
  // At angle zero (x right, y up): 1 (0,-1), 2 (1,0), 3 (1,-1), 4 (-1,0),
  // 5 (-1,-1); 6 saves then restores the position; 7 ends the side, and the
  // compiled code runs again with the sideways terms negated (the mirror).
  var STEP = { 1: [0, -1], 2: [1, 0], 3: [1, -1], 4: [-1, 0], 5: [-1, -1] };
  function outline(b, name) {
    var s = b.sym[name];
    if (!s || !s.defined || !b.asm) return null;
    var digits = [], a = s.val;
    for (var n = 0; n < 40; n++, a++) {
      var w = b.asm.memory[a];
      if (!w) break;
      var v = w.val, end = false;
      for (var k = 5; k >= 0; k--) { var d = (v >> (3 * k)) & 7; digits.push(d); if (d === 7) { end = true; break; } }
      if (end) break;
    }
    var pts = [];
    [1, -1].forEach(function (side) {
      var x = 0, y = 0, saved = null;
      digits.forEach(function (d) {
        if (d === 6) { if (saved) { x = saved[0]; y = saved[1]; saved = null; } else saved = [x, y]; return; }
        var st = STEP[d];
        if (!st) return;
        x += st[0] * side; y += st[1];
        pts.push([x, y, side]);
      });
    });
    return { name: name, addr: s.val, digits: digits, pts: pts,
             words: digits.join('').match(/.{1,6}/g) };
  }
  function outlineSVG(o, cell, title, pal) {
    cell = cell || 7;
    pal = pal || SW.PLATE;
    var xs = o.pts.map(function (p) { return p[0]; }), ys = o.pts.map(function (p) { return p[1]; });
    var minx = Math.min.apply(null, xs.concat([0])), maxx = Math.max.apply(null, xs.concat([0]));
    var miny = Math.min.apply(null, ys.concat([0])), maxy = Math.max.apply(null, ys.concat([0]));
    var w = (maxx - minx + 3) * cell, h = (maxy - miny + 3) * cell + (title ? 18 : 0);
    var o2 = ['<svg xmlns="http://www.w3.org/2000/svg" width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '">' + (pal.bg ? '<rect width="' + w + '" height="' + h + '" fill="' + pal.bg + '"/>' : '')];
    var X = function (x) { return (x - minx + 1.5) * cell; }, Y = function (y) { return (maxy - y + 1.5) * cell; };
    o2.push('<circle cx="' + X(0) + '" cy="' + Y(0) + '" r="' + (cell * 0.22) + '" fill="' + pal.accent + '"><title>start</title></circle>');
    o.pts.forEach(function (p, i) {
      o2.push('<circle cx="' + X(p[0]).toFixed(1) + '" cy="' + Y(p[1]).toFixed(1) + '" r="' + (cell * 0.32).toFixed(1) + '" fill="' + (p[2] > 0 ? pal.ink : pal.ink2) + '"><title>' + (i + 1) + '</title></circle>');
    });
    if (title) o2.push('<text x="4" y="' + (h - 5) + '" font-size="11" fill="' + pal.dim + '">' + SW.esc(title) + '</text>');
    return o2.concat(['</svg>']).join('');
  }
  function ships(b, el) {
    var os = ['ot1', 'ot2'].map(function (n) { return outline(b, n); }).filter(Boolean);
    if (!os.length) { el.appendChild(card('No outline tables', 'This build has no ot1/ot2 outline tables.')); return null; }
    os.forEach(function (o) {
      var label = o.name === 'ot1' ? 'ot1, the Needle' : 'ot2, the Wedge';
      var od = b.sym[o.name] && b.sym[o.name].defs && b.sym[o.name].defs[0];
      var c = card(label, (od ? SW.refTag(b.v.id, od.file, od.line, od.line, b.parts.length) + ' ' : '') + 'The outline table at ' + SW.oct(o.addr, 4) + ', read three bits at a time: <span class="mono">' + SW.esc(o.words.join(' ')) + '</span>. The table describes one side of the ship (pale points). At code 7 the compiled code complements its sideways terms and runs again, drawing the other side as a mirror image (blue points). The rose point is the start, the nose. ' + o.pts.length + ' points, each plotted every frame.');
      var svg = outlineSVG(o, 9);
      c.appendChild(SW.el('div', { class: 'svgbox', style: 'text-align:center' }, svg));
      c.appendChild(SW.figureButtons(function (pal) { return outlineSVG(o, 12, b.v.label + ' ' + label, pal); }, 'spacewar-' + b.v.id + '-' + o.name, (function () { var d = b.sym[o.name] && b.sym[o.name].defs && b.sym[o.name].defs[0]; return d ? SW.refText(b.v.id, d.file, d.line, d.line, b.parts.length) : SW.refText(b.v.id); })()));
      el.appendChild(c);
    });
    var c2 = card('How to read the codes', 'From the outline compiler in the source: 1 continue along the axis; 2 step outward; 3 outward and along; 4 step inward; 5 inward and along; 6 remember this point, and at the next 6 return to it; 7 end, then draw the other side as its mirror. The compiler turns these into display instructions when the game starts: Dan Edwards’s outline compiler, compiling data into code at run time.');
    el.appendChild(c2);
    return function () {
      return [SW.tableBlock('Outline tables', ['Table', 'Address', 'Codes', 'Points'], os.map(function (o) { return [o.name, SW.oct(o.addr, 4), o.words.join(' '), String(o.pts.length)]; }))];
    };
  }

  var FNS = { 1: comments, 2: hands, 3: lexicon, 4: adjustable, 5: machine, 6: timeGoes, 7: absence, 8: calls, 9: instructions, 10: memmap, 11: macros, 12: sky, 13: ships, 16: gizmo };

  // ---------- 14 symbol histories (once "biographies") ----------
  // A symbol or macro followed through every version that can be built.
  var bioName = SW.store.get('an.bio', 'str');
  function bioVersions() {
    return V.VERSIONS.filter(function (v) { return v.build && v.id !== 'stars'; }).sort(function (a, b) { return a.sort - b.sort; });
  }
  function squash(t) { return String(t || '').replace(/[\\~]/g, '').replace(/\s+/g, ' ').trim().toLowerCase(); }
  function bioEntry(b, name) {
    var s = b.sym && b.sym[name], m = b.macros && b.macros[name];
    if (!s && !m) return null;
    var e = { kind: m ? 'macro' : s.variable ? 'variable' : s.label ? 'label' : 'symbol', uses: 0, L: null, def: '', cm: '', key: '', val: '', supplied: false };
    if (m) {
      e.L = b.lines[m.file] && b.lines[m.file][m.line - 1];
      e.def = m.args.length ? name + ' ' + m.args.join(',') : name;
      e.key = squash(m.body).replace(/[\s,]+/g, ' ');   // tab or comma between a pseudo-op and its argument is the same to MACRO
      e.body = m.body;
      e.uses = facts(b).macros[name] || 0;
      e.supplied = b.parts[m.file].role !== 'program';
    } else {
      var d = s.defs[0];
      e.L = d ? b.lines[d.file] && b.lines[d.file][d.line - 1] : null;
      e.uses = s.refs.length;
      e.val = SW.oct(s.val, s.label || s.variable ? 4 : 6);
      e.supplied = d ? b.parts[d.file].role !== 'program' : false;
      if (e.L) {
        var p = SW.parseLine(e.L.norm || e.L.raw);
        e.def = ((p.labels.length ? p.labels.join(', ') + ', ' : '') + p.code).replace(/\s+/g, ' ').trim();
        e.key = squash(e.def);
      } else e.def = s.variable ? '(variable, allotted by the assembler)' : '';
    }
    if (e.L) {
      e.cm = SW.parseLine(e.L.raw).comment.replace(/^\/\s?/, '').trim();
      e.hands = SW.handsIn(e.cm);
    }
    return e;
  }
  function bioRows(name) {
    var vs = bioVersions();
    return Promise.all(vs.map(function (v) { return SW.build(v.id).catch(function () { return null; }); })).then(function (bs) {
      var rows = [], last = null, seen = false;
      vs.forEach(function (v, i) {
        var b = bs[i];
        if (!b || !b.asm) return;
        var e = bioEntry(b, name), st;
        if (!e) st = seen ? 'gone' : 'not yet';
        else if (!seen) st = 'first';
        else if (!last) st = 'returns';
        else if (e.key !== last.key) st = e.kind === 'variable' ? 'same' : 'changed';
        else if (squash(e.cm) !== squash(last.cm)) st = 'comment changed';
        else st = 'same';
        if (e) { seen = true; last = e; } else last = null;
        rows.push({ v: v, b: b, e: e, st: st });
      });
      return rows;
    });
  }
  var BIO_COL = { first: 'var(--g-added)', same: 'var(--g-retained)', changed: 'var(--g-edited)', 'comment changed': 'var(--g-moved)',
                  returns: 'var(--g-added)', gone: 'var(--g-removed)', 'not yet': 'var(--g-muted)' };
  function bioSVG(name, rows) {
    var step = 74, left = 40, W = left * 2 + Math.max(1, rows.length - 1) * step + 60, H = 200, y = 96;
    var out = ['<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '" font-family="ui-monospace, Menlo, Consolas, monospace">',
               '<title>' + SW.esc(name + ' across the versions') + '</title>',
               '<text x="' + left + '" y="18" font-size="13" fill="var(--g-text)">' + SW.esc(name) + ' across the versions</text>'];
    for (var i = 1; i < rows.length; i++) {
      if (rows[i].e && rows[i - 1].e) out.push('<line x1="' + (left + (i - 1) * step) + '" y1="' + y + '" x2="' + (left + i * step) + '" y2="' + y + '" stroke="var(--g-line)" stroke-width="2"/>');
    }
    rows.forEach(function (r, i) {
      var x = left + i * step, c = BIO_COL[r.st], present = !!r.e;
      out.push('<g><title>' + SW.esc(r.v.label + ' (' + r.v.date + '): ' + r.st + (r.e ? '. ' + r.e.def : '')) + '</title>' +
        '<circle cx="' + x + '" cy="' + y + '" r="' + (present ? 8 : 5) + '" fill="' + (present ? c : 'none') + '" stroke="' + c + '" stroke-width="2"/></g>');
      out.push('<text x="' + x + '" y="' + (y - 18) + '" font-size="10" fill="var(--g-text)" transform="rotate(-35 ' + x + ' ' + (y - 18) + ')">' + SW.esc(short(r.v)) + '</text>');
      if (present) {
        var val = r.e.kind === 'macro' ? 'macro' : r.e.def.replace(/^[^,]*,\s*/, '').slice(0, 11);
        out.push('<text x="' + x + '" y="' + (y + 26) + '" font-size="10" text-anchor="middle" fill="' + (r.st === 'changed' || r.st === 'first' ? 'var(--g-text)' : 'var(--g-muted)') + '">' + SW.esc(val) + '</text>');
      }
    });
    var lx = left, ly = H - 22;
    ['first', 'same', 'changed', 'comment changed', 'gone'].forEach(function (k) {
      out.push('<circle cx="' + (lx + 5) + '" cy="' + (ly - 4) + '" r="5" fill="' + (k === 'gone' ? 'none' : BIO_COL[k]) + '" stroke="' + BIO_COL[k] + '" stroke-width="2"/>' +
        '<text x="' + (lx + 14) + '" y="' + ly + '" font-size="10" fill="var(--g-text)">' + k + '</text>');
      lx += 30 + k.length * 6.2;
    });
    out.push('</svg>');
    return out.join('');
  }
  function bioSummary(name, rows) {
    var pres = rows.filter(function (r) { return r.e; });
    if (!pres.length) return 'No version that can be assembled defines “' + name + '”.';
    var first = pres[0], lastR = pres[pres.length - 1], k = first.e.kind;
    var out = '“' + name + '” is a ' + k + (first.e.supplied ? ' on a supplied tape' : '') + '. It first appears in ' + first.v.label.replace(/^Spacewar! /, '') + ' (' + first.v.date + ')';
    out += first.e.def && k !== 'macro' ? ', as “' + first.e.def + '”' + (first.e.cm ? ' (' + first.e.cm + ')' : '') + '.' : '.';
    var ch = rows.filter(function (r) { return r.st === 'changed'; });
    if (ch.length) out += ' Its definition changes in ' + ch.map(function (r) { return r.v.label.replace(/^Spacewar! /, '') + (k !== 'macro' ? ' (to “' + r.e.def + '”)' : ''); }).join(', ') + '.';
    else out += ' Its definition never changes.';
    var cc = rows.filter(function (r) { return r.st === 'comment changed'; });
    if (cc.length) out += ' Its comment is rewritten in ' + cc.map(function (r) { return r.v.label.replace(/^Spacewar! /, ''); }).join(', ') + '.';
    var gone = rows.filter(function (r) { return r.st === 'gone'; });
    if (gone.length) out += ' It is absent from ' + gone.map(function (r) { return r.v.label.replace(/^Spacewar! /, ''); }).join(', ') + '.';
    var hs = {};
    pres.forEach(function (r) { (r.e.hands || []).forEach(function (h) { hs[h] = 1; }); });
    if (Object.keys(hs).length) out += ' Initials in its comment: ' + Object.keys(hs).join(', ') + '.';
    if (lastR !== first) out += ' Last seen in ' + lastR.v.label.replace(/^Spacewar! /, '') + '.';
    return out;
  }
  function biography(b, el) {
    var c = card('Whose life?', 'Type a label, constant, variable or macro, or pick one. Every version that can be assembled is searched; the definition line, its comment, value and number of uses are compared step by step.');
    c.style.gridColumn = '1 / -1';
    var names = {};
    if (b.sym) Object.keys(b.sym).forEach(function (n) { if (b.sym[n].defs.length) names[n] = 1; });
    if (b.macros) Object.keys(b.macros).forEach(function (n) { names[n] = 1; });
    var dl = SW.el('datalist', { id: 'bio-names' }, Object.keys(names).sort().map(function (n) { return '<option value="' + SW.esc(n) + '">'; }).join(''));
    var inp = SW.el('input', { type: 'search', list: 'bio-names', value: bioName, placeholder: 'e.g. str, maa, ioh, dispt', class: 'btn', style: 'width:14em' });
    var go = SW.el('button', { class: 'btn' }, 'Follow');
    var row = SW.el('div', { class: 'toolbar', style: 'position:static;padding-left:0' });
    row.appendChild(inp); row.appendChild(dl); row.appendChild(go);
    var consts = Object.keys(facts(b).consts).slice(0, 14);
    ['ioh', 'dispt', 'mex', 'tcr', 'sqs'].forEach(function (n) { if (names[n] && consts.indexOf(n) < 0) consts.push(n); });
    consts.forEach(function (n) {
      row.appendChild(SW.el('button', { class: 'btn ghost mono', title: 'Follow ' + n, onclick: function () { inp.value = n; follow(); } }, n));
    });
    c.appendChild(row);
    el.appendChild(c);
    var out = SW.el('div', { style: 'grid-column:1 / -1' });
    el.appendChild(out);
    var cur = { name: '', rows: [] };
    function follow() {
      var name = inp.value.trim().replace(/^[\\~.]/, '');
      if (!name) return;
      bioName = name; SW.store.set('an.bio', name);
      out.innerHTML = '<p class="hint">Following ' + SW.esc(name) + ' through ' + bioVersions().length + ' versions…</p>';
      bioRows(name).then(function (rows) {
        cur = { name: name, rows: rows };
        out.innerHTML = '';
        var sc = card(name, SW.esc(bioSummary(name, rows)));
        var fig = SW.el('div', { class: 'svgbox', style: 'margin:8px 0' }, SW.displaySVG(bioSVG(name, rows)));
        sc.appendChild(fig);
        sc.appendChild(SW.figureButtons(function () { return bioSVG(name, rows); }, 'spacewar-symbol-history-' + SW.slug(name), SW.refsOf(rows.map(function (r) { return r.v.id; }))));
        out.appendChild(sc);
        var t = SW.table(['Version', 'Date', 'Status', 'Kind', 'Definition', 'Comment', 'Value', 'Uses', 'Hand', 'Reference'], tableRows(rows),
          { cls: ['', 'mono', '', '', 'mono', '', 'mono', 'num', 'mono', 'mono'], onRow: function (r) {
            var hit = rows.filter(function (x) { return x.v.label.replace(/^Spacewar! /, '') === r[0]; })[0];
            if (!hit || !hit.e || !hit.e.L) return;
            SW.openAt(hit.v.id, { p: hit.e.L.p, n0: hit.e.L.n });
          } });
        var tc = card('Step by step', 'Click a row to open the definition in that version.');
        var sd = SW.el('div', { class: 'scroll' }); sd.appendChild(t); tc.appendChild(sd);
        out.appendChild(tc);
        var withBody = rows.filter(function (r) { return r.e && r.e.body; });
        if (withBody.length) {
          var mc = card('The macro body, where it changes', '');
          rows.forEach(function (r) {
            if (r.st !== 'first' && r.st !== 'changed' && r.st !== 'returns') return;
            mc.insertAdjacentHTML('beforeend', '<h4>' + SW.esc(short(r.v)) + ' · ' + SW.esc(r.st) + ' ' + (r.e.L ? SW.refTag(r.v.id, r.e.L.p, r.e.L.n, r.e.L.n, SW.nparts(r.v.id)) : SW.refTag(r.v.id)) + '</h4><pre class="mono" style="font-size:12px;overflow:auto">' + SW.esc(r.e.body) + '</pre>');
          });
          out.appendChild(mc);
        }
      });
    }
    function tableRows(rows) {
      return rows.map(function (r) {
        var e = r.e;
        return [short(r.v), r.v.date, { html: '<span style="color:' + BIO_COL[r.st] + '">●</span> ' + SW.esc(r.st), text: r.st, sort: r.st },
                e ? e.kind + (e.supplied ? ' (supplied)' : '') : '', e ? e.def : '', e ? e.cm : '', e ? e.val : '', e ? e.uses : '',
                e && e.hands && e.hands.length ? e.hands.join(', ') : '',
                e && e.L ? SW.refOf(r.v.id, e.L.p, e.L.n, e.L.n, SW.nparts(r.v.id)) : SW.refOf(r.v.id)];
      });
    }
    go.onclick = follow;
    inp.addEventListener('keydown', function (ev) { if (ev.key === 'Enter') follow(); });
    follow();
    return function () {
      return [{ type: 'p', text: bioSummary(cur.name, cur.rows) },
              SW.tableBlock(cur.name + ' across the versions', ['Version', 'Date', 'Status', 'Kind', 'Definition', 'Comment', 'Value', 'Uses', 'Hand', 'Reference'], tableRows(cur.rows))];
    };
  }

  // =================== across the variorum ===================
  var V = root.SWVersions;
  var DEFAULT_SET = ['2b', '3.1', '4.0', '4.1', '4.0ts', '4.2', '4.3', '4.4', '4.8', '4.1f', '2015'];
  var mode = SW.store.get('an.mode', 'one');
  var xst = { onlyChanges: true };

  function selected() {
    var set = SW.store.get('gen.set', DEFAULT_SET);
    return V.VERSIONS.filter(function (v) { return v.build && v.id !== 'stars' && set.indexOf(v.id) >= 0; })
      .sort(function (a, b) { return a.sort - b.sort; });
  }
  function short(v) { return v.label.replace(/^Spacewar! /, ''); }
  function normText(s) { return s.toLowerCase().replace(/\s+/g, ' ').trim(); }

  // Everything the cross-version lenses need from one build, computed once.
  function facts(b) {
    if (b._facts) return b._facts;
    var f = { comments: {}, nComments: 0, own: 0, hands: {}, dates: [], titles: [], names: {}, consts: {},
              machine: {}, callees: {}, sites: 0, instr: {}, words: 0, mem: {}, macros: {}, stars: {}, starOrder: [] };
    progLines(b).forEach(function (L) {
      var p = SW.parseLine(L.raw), c = p.comment.replace(/^\/\s?/, '').trim();
      if (c) {
        var k = normText(c);
        f.comments[k] = f.comments[k] || { text: c, n: 0, L: L };
        f.comments[k].n++; f.nComments++;
        if (!p.code.trim() && !p.labels.length) f.own++;
      }
      SW.handsIn(L.raw).forEach(function (h) { f.hands[h] = (f.hands[h] || 0) + 1; });
      (L.raw.match(/\b\d{1,2}\/\d{1,2}\/\d{2,4}\b|\b\d{4}-\d{2}-\d{2}\b/g) || []).forEach(function (d) { if (f.dates.indexOf(d) < 0) f.dates.push(d); });
      var cm = /^\s*([a-z0-9]+),\s*([0-7]+),\s*([^\/]*?)\s*(\/.*)?$/i.exec(L.raw);
      if (cm) f.consts[cm[1]] = { val: cm[3].replace(/\s+/g, ' '), cm: (cm[4] || '').replace(/^\/\s*/, ''), loc: cm[2] };
    });
    allLines(b).forEach(function (L) {
      var m = /^\s*(?:([0-9a-z]+),)?\s*mar[kc]\s+(-?\d+)\s*,\s*(-?\d+)\s*(\/.*)?$/i.exec(L.raw);   // 'marc' as on the 3.1 tape
      if (!m) return;
      var name = (m[4] || '').replace(/^\/\s*/, '').replace(/\s+/g, ' ').trim() || ('mark ' + m[2] + ',' + m[3]);
      if (!f.stars[name]) f.starOrder.push(name);
      f.stars[name] = m[2] + ', ' + m[3];
    });
    if (!b.asm) { b._facts = f; return f; }
    b.asm.titles.forEach(function (t) { if (b.parts[t.file].role === 'program') f.titles.push(t.text.trim()); });
    b.asm.symbols.forEach(function (s) {
      if (s.defs.length && b.parts[s.defs[0].file].role === 'program') f.names[s.name] = s.variable ? 'variable' : s.label ? 'label' : 'defined';
    });
    var labs = Object.keys(b.labelAt).map(Number).sort(function (x, y) { return x - y; });
    var kind = {};
    b.asm.words.forEach(function (w) {
      var prog = b.parts[w.file].role === 'program';
      kind[w.loc] = w.kind === 'constant' ? 'constant' : w.kind === 'text' ? 'text' : prog ? 'code' : 'supplied';
      if (w.macro && prog) { f.macros[w.macro] = f.macros[w.macro] || {}; f.macros[w.macro][w.file + ':' + w.line] = 1; }
      if (w.kind || !prog) return;
      f.words++;
      var cl = classify(w.val);
      if (cl) f.machine[cl] = (f.machine[cl] || 0) + 1;
      var mn = C.disasm(w.val).split(' ')[0];
      f.instr[mn] = (f.instr[mn] || 0) + 1;
      var op = w.val >> 13;
      if (op === 0o31 || (op === 0o07 && ((w.val >> 12) & 1))) {
        var tgt = w.val & 0o7777, name = b.labelAt[tgt];
        if (!name) { for (var i = labs.length - 1; i >= 0; i--) if (labs[i] <= tgt) { name = b.labelAt[labs[i]]; break; } }
        name = name || SW.oct(tgt, 4);
        f.callees[name] = (f.callees[name] || 0) + 1;
        f.sites++;
      }
    });
    if (b.asm.variables) for (var a = b.asm.variables.start; a < b.asm.variables.end; a++) if (!kind[a]) kind[a] = 'variable';
    for (a = 0; a < 4096; a++) { var k = kind[a] || 'unused'; f.mem[k] = (f.mem[k] || 0) + 1; }
    Object.keys(f.macros).forEach(function (m) { f.macros[m] = Object.keys(f.macros[m]).length; });
    b._facts = f;
    return f;
  }

  // A matrix table: one row per key, one column per version; a cell that
  // differs from the previous version's is shaded.
  function matrix(keys, vs, get, opts) {
    opts = opts || {};
    var rows = keys.map(function (k) {
      var prev = null, changed = false, cells = vs.map(function (v, i) {
        var x = get(k, v, i);
        var s = x == null || x === '' ? '' : String(x);
        var diff = i > 0 && s !== prev;
        if (i > 0 && s !== prev) changed = true;
        prev = s;
        return { html: s === '' ? '<span class="faint">·</span>' : (diff ? '<span style="background:var(--hl);padding:0 3px;border-radius:2px">' + SW.esc(s) + '</span>' : SW.esc(s)), text: s, sort: isNaN(+s) || s === '' ? s : +s };
      });
      return { row: [k].concat(cells).concat(opts.extra ? [opts.extra(k)] : []), changed: changed };
    });
    if (opts.onlyChanges) rows = rows.filter(function (r) { return r.changed; });
    return rows.map(function (r) { return r.row; });
  }
  function matrixCard(title, lede, head, rows, cls) {
    var c = card(title, lede);
    var s = SW.el('div', { class: 'scroll', style: 'max-height:560px;overflow:auto' });
    s.appendChild(SW.table(head, rows, { cls: cls }));
    c.appendChild(s);
    c.style.gridColumn = '1 / -1';
    return c;
  }
  function stepRows(vs, fs, setOf) {
    return vs.map(function (v, i) {
      var cur = setOf(fs[i]), prev = i ? setOf(fs[i - 1]) : null, add = 0, drop = 0;
      if (prev) {
        Object.keys(cur).forEach(function (k) { if (!(k in prev)) add++; });
        Object.keys(prev).forEach(function (k) { if (!(k in cur)) drop++; });
      }
      return [short(v), v.date, Object.keys(cur).length, i ? add : '', i ? drop : ''];
    });
  }
  function onlyToggle(el, rerender) {
    var l = SW.el('label', { class: 'check', style: 'margin-bottom:8px', title: 'Hide rows whose value is the same in every selected version, leaving only what changes' }, '<input type="checkbox"' + (xst.onlyChanges ? ' checked' : '') + '> only rows that change between versions');
    l.firstChild.onchange = function (e) { xst.onlyChanges = e.target.checked; rerender(); };
    el.appendChild(l);
  }

  var XFNS = {};

  XFNS[1] = function (vs, bs, el) {
    var fs = bs.map(facts);
    var steps = stepRows(vs, fs, function (f) { return f.comments; }).map(function (r, i) { return r.concat([fs[i].own]); });
    el.appendChild(matrixCard('Comments through the versions', 'How many comments each version carries, and how many are new or gone since the version before (compared as normalised text).',
      ['Version', 'Date', 'Distinct comments', 'New', 'Dropped', 'On own line'], steps, ['mono', '', 'num', 'num', 'num', 'num']));
    var changes = [];
    vs.forEach(function (v, i) {
      if (!i) return;
      var a = fs[i - 1].comments, b = fs[i].comments;
      Object.keys(b).forEach(function (k) { if (!(k in a)) changes.push([short(vs[i - 1]) + ' → ' + short(v), 'new', b[k].text, b[k].L ? SW.refOf(v.id, b[k].L.p, b[k].L.n, b[k].L.n, SW.nparts(v.id)) : '']); });
      Object.keys(a).forEach(function (k) { if (!(k in b)) changes.push([short(vs[i - 1]) + ' → ' + short(v), 'dropped', a[k].text, a[k].L ? SW.refOf(vs[i - 1].id, a[k].L.p, a[k].L.n, a[k].L.n, SW.nparts(vs[i - 1].id)) : '']); });
    });
    el.appendChild(matrixCard('What the comments say that changes', 'Every comment that appears or disappears between consecutive versions.', ['Step', 'Change', 'Comment', 'Reference'], changes, ['mono', '', '', 'mono']));
    var c = card('Keyword in context, across versions', 'Search every selected version\'s comments at once.');
    var inp = SW.el('input', { type: 'search', placeholder: 'e.g. torpedo, gravity, score', class: 'btn', style: 'width:100%;margin-bottom:6px' });
    var out = SW.el('div', { class: 'kwic scroll' });
    inp.addEventListener('input', function () {
      var q = inp.value.trim().toLowerCase(), items = [];
      if (q) fs.forEach(function (f, i) {
        Object.keys(f.comments).forEach(function (k) { var L = f.comments[k].L; items.push({ c: f.comments[k].text, tag: short(vs[i]) + (L ? ' ' + SW.refOf(vs[i].id, L.p, L.n, L.n, SW.nparts(vs[i].id)) : '') }); });
      });
      var h = q ? kwicRows(items, q, 70) : [];
      out.innerHTML = h.slice(0, 800).join('') || '<div class="faint">' + (q ? 'No matches.' : 'Type to search.') + '</div>';
    });
    c.appendChild(inp); c.appendChild(out); c.style.gridColumn = '1 / -1';
    el.appendChild(c);
    inp.dispatchEvent(new Event('input'));
    return function () { return [SW.tableBlock('Comments through the versions', ['Version', 'Date', 'Distinct comments', 'New', 'Dropped', 'On own line'], steps), SW.tableBlock('Comments that appear or disappear', ['Step', 'Change', 'Comment'], changes)]; };
  };

  XFNS[2] = function (vs, bs, el) {
    var fs = bs.map(facts);
    var rows = vs.map(function (v, i) {
      var f = fs[i];
      return [short(v), v.date, v.authors, f.titles.join(' | '), Object.keys(f.hands).map(function (h) { return h + ' ×' + f.hands[h]; }).join(', '), f.dates.join(', ')];
    });
    el.appendChild(matrixCard('Hands and dates in each version', 'The tape titles as written, the initials found anywhere in the text (with counts), and the dates. Initials in later reassemblies (nl) mark the reconstructor\'s hand in the text.',
      ['Version', 'Date', 'Attributed to', 'Tape titles', 'Initials in the text', 'Dates in the text'], rows, ['mono', '', '', 'mono', 'mono', 'mono']));
    var hs = {}; fs.forEach(function (f) { Object.keys(f.hands).forEach(function (h) { hs[h] = 1; }); });
    var m = matrix(Object.keys(hs).sort(), vs, function (h, v, i) { return fs[i].hands[h] || ''; });
    el.appendChild(matrixCard('Which hand appears where', 'Occurrences of each set of initials, version by version.', ['Initials'].concat(vs.map(short)), m, ['mono'].concat(vs.map(function () { return 'num'; }))));
    var fw = card('Following the hands', 'Initials sit in particular routines. The Genealogy flow can colour every routine by the hand that signed it and carry that hand forward to its descendants, so a signature in 4.0 can be followed into 4.8.');
    fw.appendChild(SW.el('button', { class: 'btn', onclick: function () { SW.store.set('gen.boxes', 'hand'); SW.forget('genealogy'); SW.setTab('genealogy'); } }, 'Show the hands in the genealogy flow →'));
    fw.style.gridColumn = '1 / -1';
    el.appendChild(fw);
    return function () { return [SW.tableBlock('Hands and dates', ['Version', 'Date', 'Attributed to', 'Tape titles', 'Initials', 'Dates'], rows), SW.tableBlock('Initials by version', ['Initials'].concat(vs.map(short)), m)]; };
  };

  XFNS[3] = function (vs, bs, el, rerender) {
    var fs = bs.map(facts);
    var steps = stepRows(vs, fs, function (f) { return f.names; });
    el.appendChild(matrixCard('Names coined and retired', 'Symbols defined in each version\'s program, with how many are new since the version before and how many have gone.',
      ['Version', 'Date', 'Names', 'Coined', 'Retired'], steps, ['mono', '', 'num', 'num', 'num']));
    var all = {}; fs.forEach(function (f) { Object.keys(f.names).forEach(function (n) { all[n] = 1; }); });
    var keys = Object.keys(all).sort();
    var first = function (n) { for (var i = 0; i < fs.length; i++) if (fs[i].names[n]) return short(vs[i]); return ''; };
    var m = matrix(keys, vs, function (n, v, i) { return fs[i].names[n] ? '✓' : ''; }, { onlyChanges: xst.onlyChanges, extra: first });
    var c = matrixCard('The lexicon across versions', 'Each name, and the versions that define it (✓). Shaded cells mark where a name arrives or leaves.', ['Name'].concat(vs.map(short), ['First seen']), m, ['mono'].concat(vs.map(function () { return ''; }), ['mono']));
    onlyToggle(c, rerender);
    el.appendChild(c);
    return function () { return [SW.tableBlock('Names coined and retired', ['Version', 'Date', 'Names', 'Coined', 'Retired'], steps), SW.tableBlock('Names by version', ['Name'].concat(vs.map(short), ['First seen']), m)]; };
  };

  XFNS[4] = function (vs, bs, el, rerender) {
    var fs = bs.map(facts), all = {}, loc = {}, cm = {};
    fs.forEach(function (f) { Object.keys(f.consts).forEach(function (k) { all[k] = 1; loc[k] = f.consts[k].loc; cm[k] = f.consts[k].cm; }); });
    var keys = Object.keys(all).sort(function (a, b) { return parseInt(loc[a], 8) - parseInt(loc[b], 8); });
    var m = matrix(keys, vs, function (k, v, i) { return fs[i].consts[k] ? fs[i].consts[k].val : ''; }, { onlyChanges: xst.onlyChanges, extra: function (k) { return cm[k]; } });
    var c = matrixCard('The constants block, value by value', 'The “interesting and often changed constants” traced across the variorum: torpedo count and speed, reload and life, fuel, gravity, the hyperspace ration and more. Shaded values changed from the version before.',
      ['Symbol'].concat(vs.map(short), ['Comment (latest)']), m, ['mono'].concat(vs.map(function () { return 'mono'; }), ['']));
    onlyToggle(c, rerender);
    el.appendChild(c);
    return function () { return [SW.tableBlock('The constants block across versions', ['Symbol'].concat(vs.map(short), ['Comment']), m)]; };
  };

  XFNS[5] = function (vs, bs, el) {
    var fs = bs.map(facts), all = {};
    fs.forEach(function (f) { Object.keys(f.machine).forEach(function (k) { all[k] = 1; }); });
    var m = matrix(Object.keys(all).sort(), vs, function (k, v, i) { return fs[i].machine[k] || ''; });
    el.appendChild(matrixCard('Hardware in the instruction stream', 'Instruction words by hardware feature or idiom, as written. Note where multiply and divide move from step instructions (mus, dis) to the automatic option in the 4.x line.',
      ['Feature'].concat(vs.map(short)), m, [''].concat(vs.map(function () { return 'num'; }))));
    var mdv = vs.map(function (v) { return [short(v), v.mdv ? 'automatic multiply/divide' : 'multiply/divide by steps']; });
    el.appendChild(matrixCard('The machine each version assumes', '', ['Version', 'Arithmetic'], mdv, ['mono', '']));
    return function () { return [SW.tableBlock('Hardware features by version', ['Feature'].concat(vs.map(short)), m), SW.tableBlock('Machine assumed', ['Version', 'Arithmetic'], mdv)]; };
  };

  // Run each version headless for two seconds of machine time, no input.
  function profileRun(b) {
    if (b._run) return b._run;
    if (!b.v.runnable || !b.asm) return null;
    var cpu = new C.PDP1(SW.cpuOpts(b.v));
    cpu.load(b.asm.memory, b.asm.start);
    var dots = 0;
    cpu.onDisplay = function () { dots++; };
    cpu.run(400000);
    var cls = {}, total = 0, labs = Object.keys(b.labelAt).map(Number).sort(function (x, y) { return x - y; }), rt = {};
    for (var a = 0; a < 4096; a++) {
      var n = cpu.execCount[a];
      if (!n) continue;
      total += n;
      var k = classify(cpu.mem[a]) || 'other (load, store, arithmetic)';
      cls[k] = (cls[k] || 0) + n;
      var r = '(start)';
      for (var i = labs.length - 1; i >= 0; i--) if (labs[i] <= a) { r = b.labelAt[labs[i]]; break; }
      rt[r] = (rt[r] || 0) + n;
    }
    b._run = { cls: cls, total: total, dots: dots, routines: rt, instructions: cpu.instructions };
    return b._run;
  }

  XFNS[6] = function (vs, bs, el) {
    var c0 = card('Two seconds of each version', 'Each selected version is run here, untouched by a player, for two seconds of PDP-1 time (400,000 memory cycles), and its instructions are counted. A level comparison of what each program spends its time on when it is simply drawing the game.');
    var btn = SW.el('button', { class: 'btn' }, '▶ Run the selected versions');
    c0.appendChild(btn);
    c0.style.gridColumn = '1 / -1';
    el.appendChild(c0);
    var holder = SW.el('div', { style: 'display:contents' });
    el.appendChild(holder);
    var blocks = [];
    function show() {
      var rs = bs.map(profileRun), all = {};
      rs.forEach(function (r) { if (r) Object.keys(r.cls).forEach(function (k) { all[k] = 1; }); });
      var m = matrix(Object.keys(all).sort(), vs, function (k, v, i) { return rs[i] && rs[i].total ? (100 * (rs[i].cls[k] || 0) / rs[i].total).toFixed(1) : ''; });
      var sum = vs.map(function (v, i) {
        var r = rs[i];
        if (!r) return [short(v), '', '', '', ''];
        var top = Object.keys(r.routines).sort(function (a, b) { return r.routines[b] - r.routines[a]; }).slice(0, 4)
          .map(function (k) { return k + ' ' + (100 * r.routines[k] / r.total).toFixed(0) + '%'; }).join(', ');
        return [short(v), r.instructions, r.dots, (r.dots / 2).toFixed(0), top];
      });
      holder.innerHTML = '';
      holder.appendChild(matrixCard('Executed instructions by kind (%)', 'Share of executed instructions in two seconds of machine time.', ['Kind'].concat(vs.map(short)), m, [''].concat(vs.map(function () { return 'num'; }))));
      holder.appendChild(matrixCard('Pace and priorities', 'Instructions executed, points plotted, and the routines that take the most time.', ['Version', 'Instructions', 'Points plotted', 'Points per second', 'Busiest routines'], sum, ['mono', 'num', 'num', 'num', 'mono']));
      blocks = [SW.tableBlock('Executed instructions by kind (%)', ['Kind'].concat(vs.map(short)), m), SW.tableBlock('Pace and priorities', ['Version', 'Instructions', 'Points plotted', 'Points per second', 'Busiest routines'], sum)];
    }
    btn.onclick = function () { btn.disabled = true; btn.textContent = 'Running…'; setTimeout(function () { show(); btn.textContent = 'Done'; }, 30); };
    if (bs.every(function (b) { return b._run || !b.v.runnable; })) show();
    return function () { return blocks.length ? blocks : [{ type: 'p', text: 'Run the selected versions first.' }]; };
  };

  XFNS[7] = function (vs, bs, el) {
    var rows = V.VERSIONS.slice().sort(function (a, b) { return a.sort - b.sort; }).filter(function (v) {
      return v.status === 'lost' || vs.indexOf(v) >= 0;
    }).map(function (v) {
      var b = bs[vs.indexOf(v)];
      if (!b) return [short(v), v.date, 'lost', '', '', '', '', '', v.summary];
      var norm = 0, unc = 0;
      b.lines.forEach(function (ls) { ls.forEach(function (L) { if (L.raw !== L.norm && !L.skipped) norm++; if (/illegible|\[\?|uncertain|unclear/i.test(L.raw)) unc++; }); });
      return [short(v), v.date, v.status, b.parts.filter(function (p) { return p.role !== 'program'; }).length, norm, b.asm ? b.asm.errorCount : '', unc,
              (v.witnesses || []).length, (v.transforms || []).map(function (k) { return k; }).join(', ')];
    });
    el.appendChild(matrixCard('What each version depends on', 'Supplied tapes, normalised lines, assembly errors, lines marked uncertain, and surviving witness tapes, with the lost versions in their place in the sequence.',
      ['Version', 'Date', 'Status', 'Supplied tapes', 'Normalised lines', 'Errors', 'Uncertain', 'Witness tapes', 'Normalisations / note'], rows, ['mono', '', '', 'num', 'num', 'num', 'num', 'num', '']));
    return function () { return [SW.tableBlock('Absences, supplements and repairs by version', ['Version', 'Date', 'Status', 'Supplied tapes', 'Normalised lines', 'Errors', 'Uncertain', 'Witness tapes', 'Note'], rows)]; };
  };

  XFNS[8] = function (vs, bs, el, rerender) {
    var fs = bs.map(facts);
    var sum = vs.map(function (v, i) { return [short(v), Object.keys(fs[i].callees).length, fs[i].sites]; });
    el.appendChild(matrixCard('Subroutine structure', 'Distinct subroutines called (by jsp and jda) and the number of call sites.', ['Version', 'Subroutines', 'Call sites'], sum, ['mono', 'num', 'num']));
    var all = {}; fs.forEach(function (f) { Object.keys(f.callees).forEach(function (k) { all[k] = (all[k] || 0) + f.callees[k]; }); });
    var keys = Object.keys(all).sort(function (a, b) { return all[b] - all[a]; });
    var m = matrix(keys, vs, function (k, v, i) { return fs[i].callees[k] || ''; }, { onlyChanges: xst.onlyChanges });
    var c = matrixCard('Call sites per subroutine', 'How often each subroutine is called, version by version (most called first).', ['Subroutine'].concat(vs.map(short)), m, ['mono'].concat(vs.map(function () { return 'num'; })));
    onlyToggle(c, rerender);
    el.appendChild(c);
    return function () { return [SW.tableBlock('Subroutine structure', ['Version', 'Subroutines', 'Call sites'], sum), SW.tableBlock('Call sites per subroutine', ['Subroutine'].concat(vs.map(short)), m)]; };
  };

  XFNS[9] = function (vs, bs, el) {
    var fs = bs.map(facts), all = {};
    fs.forEach(function (f) { Object.keys(f.instr).forEach(function (k) { all[k] = (all[k] || 0) + f.instr[k]; }); });
    var keys = Object.keys(all).sort(function (a, b) { return all[b] - all[a]; }).slice(0, 45);
    var m = matrix(keys, vs, function (k, v, i) { return fs[i].words ? (1000 * (fs[i].instr[k] || 0) / fs[i].words).toFixed(0) : ''; });
    el.appendChild(matrixCard('Instruction mix per thousand words', 'Leading mnemonic of each program word, per thousand words so that versions of different length compare. The 45 most common across the selection.',
      ['Mnemonic'].concat(vs.map(short)), m, ['mono'].concat(vs.map(function () { return 'num'; }))));
    return function () { return [SW.tableBlock('Instruction mix per thousand words', ['Mnemonic'].concat(vs.map(short)), m)]; };
  };

  XFNS[10] = function (vs, bs, el) {
    var fs = bs.map(facts), kinds = ['code', 'constant', 'variable', 'supplied', 'text', 'unused'];
    var col = { code: 'var(--beam)', constant: 'var(--amber)', variable: 'var(--violet)', supplied: 'var(--green)', text: 'var(--red)', unused: 'var(--line-soft)' };
    var W = 760, bh = 18, lw = 150;
    var svg = function () {
      var o = ['<svg xmlns="http://www.w3.org/2000/svg" width="' + (W + lw + 10) + '" height="' + (vs.length * (bh + 8) + 10) + '" viewBox="0 0 ' + (W + lw + 10) + ' ' + (vs.length * (bh + 8) + 10) + '">'];
      vs.forEach(function (v, i) {
        var x = lw, y = 6 + i * (bh + 8);
        o.push('<text x="0" y="' + (y + 13) + '" font-size="11" fill="var(--text)">' + SW.esc(short(v).slice(0, 22)) + '</text>');
        kinds.forEach(function (k) {
          var w = W * (fs[i].mem[k] || 0) / 4096;
          if (w <= 0) return;
          o.push('<rect x="' + x.toFixed(1) + '" y="' + y + '" width="' + w.toFixed(1) + '" height="' + bh + '" fill="' + col[k] + '"><title>' + k + ' ' + (fs[i].mem[k] || 0) + ' words</title></rect>');
          x += w;
        });
      });
      return o.concat(['</svg>']).join('');
    };
    var c = card('How each version fills the 4096 words', 'Words of memory by use.');
    c.insertAdjacentHTML('beforeend', '<div class="legend">' + kinds.map(function (k) { return '<span title="' + SW.esc(MEMWHAT[k] || '') + '"><i style="background:' + col[k] + '"></i>' + k + '</span>'; }).join('') + '</div>');
    c.appendChild(SW.el('div', { class: 'svgbox', style: 'margin-top:6px' }, SW.displaySVG(svg())));
    c.appendChild(SW.figureButtons(svg, 'spacewar-memory-across-versions', function () { return SW.refsOf((typeof vs !== 'undefined' ? vs : []).map(function (v) { return v.v ? v.v.id : v.id; })); }));
    c.style.gridColumn = '1 / -1';
    el.appendChild(c);
    var m = matrix(kinds, vs, function (k, v, i) { return fs[i].mem[k] || 0; });
    el.appendChild(matrixCard('Memory use (words)', '', ['Use'].concat(vs.map(short)), m, [''].concat(vs.map(function () { return 'num'; }))));
    return function () { return [SW.tableBlock('Memory use (words)', ['Use'].concat(vs.map(short)), m)]; };
  };

  XFNS[11] = function (vs, bs, el, rerender) {
    var fs = bs.map(facts), all = {};
    fs.forEach(function (f) { Object.keys(f.macros).forEach(function (k) { all[k] = 1; }); });
    bs.forEach(function (b) { if (b.asm) b.asm.macros.forEach(function (m) { all[m.name] = 1; }); });
    var keys = Object.keys(all).sort();
    var m = matrix(keys, vs, function (k, v, i) { return fs[i].macros[k] || (bs[i].macros && bs[i].macros[k] ? '0' : ''); }, { onlyChanges: xst.onlyChanges });
    var c = matrixCard('Macro call sites by version', 'Call sites of each macro in the program (0: defined but unused; ·: not defined).', ['Macro'].concat(vs.map(short)), m, ['mono'].concat(vs.map(function () { return 'num'; })));
    onlyToggle(c, rerender);
    el.appendChild(c);
    return function () { return [SW.tableBlock('Macro call sites by version', ['Macro'].concat(vs.map(short)), m)]; };
  };

  XFNS[12] = function (vs, bs, el, rerender) {
    var fs = bs.map(facts), all = [], seen = {};
    fs.forEach(function (f) { f.starOrder.forEach(function (s) { if (!seen[s]) { seen[s] = 1; all.push(s); } }); });
    var has = fs.map(function (f) { return f.starOrder.length > 0; });
    // The usual entry for each star: what most versions with a star table give
    // (absence counts). Only departures from it are marked, so a version is not
    // marked for differing from an unusual neighbour.
    var usual = {};
    all.forEach(function (k) {
      var cnt = {}, best = null;
      fs.forEach(function (f, i) { if (!has[i]) return; var v = f.stars[k] || ''; cnt[v] = (cnt[v] || 0) + 1; });
      Object.keys(cnt).forEach(function (v) { if (best === null || cnt[v] > cnt[best]) best = v; });
      usual[k] = best || '';
    });
    // Samson's groups (1j-1q ... 4j-4q), read from the fullest table
    var full = 0; fs.forEach(function (f, i) { if (f.starOrder.length > fs[full].starOrder.length) full = i; });
    var group = {}, gm = 1;
    starsOf(bs[full]).forEach(function (st) { var mm = /^(\d)j$/.exec(st.label); if (mm) gm = +mm[1]; var nm = st.name.replace(/\s+/g, ' ').trim() || ('mark ' + st.x + ',' + st.y); group[nm] = gm; });
    var tally = vs.map(function () { return { missing: [], moved: 0, extra: 0 }; });
    var rows = [];
    all.forEach(function (k) {
      var any = false, cells = vs.map(function (v, i) {
        if (!has[i]) return { html: '<span class="faint">·</span>', text: '', sort: '' };
        var x = fs[i].stars[k] || '', u = usual[k];
        if (x === u) return { html: x ? SW.esc(x) : '<span class="faint">·</span>', text: x, sort: x };
        any = true;
        if (!x) { tally[i].missing.push(k); return { html: '<span class="sky-miss" title="Absent here; most versions have it at ' + SW.esc(u) + '">missing</span>', text: 'missing', sort: 'missing' }; }
        if (!u) { tally[i].extra++; return { html: '<span class="sky-extra" title="Most versions do not have this star">' + SW.esc(x) + '</span>', text: x, sort: x }; }
        tally[i].moved++;
        return { html: '<span class="sky-moved" title="Most versions have ' + SW.esc(u) + '">' + SW.esc(x) + '</span>', text: x, sort: x };
      });
      if (!xst.onlyChanges || any) rows.push([k].concat(cells));
    });
    var sum = vs.map(function (v, i) {
      var st = has[i] ? starsOf(bs[i]) : [], part = st.length ? bs[i].parts[st[0].L.p] : null;
      var t = tally[i], note = '';
      if (t.missing.length && t.missing.every(function (k) { return group[k] === 4; }) && t.missing.length >= Object.keys(group).filter(function (k) { return group[k] === 4; }).length * 0.9)
        note = 'Samson’s fourth group (4j–4q) absent: groups 1–3 only';
      return [short(v), fs[i].starOrder.length || '', !has[i] ? 'none' : part && part.role && part.role !== 'program' && !bs[i].parts.some(function (q) { return q.role === 'program' && q.src === part.src; }) ? 'supplied: ' + part.src : 'its own source',
              { html: t.missing.length ? '<span class="sky-miss">' + t.missing.length + '</span>' : '', text: String(t.missing.length || ''), sort: t.missing.length },
              { html: t.moved ? '<span class="sky-moved">' + t.moved + '</span>' : '', text: String(t.moved || ''), sort: t.moved },
              { html: t.extra ? '<span class="sky-extra">' + t.extra + '</span>' : '', text: String(t.extra || ''), sort: t.extra }, note];
    });
    var SUMHEAD = ['Version', 'Stars', 'Star table', 'Missing', 'Moved', 'Extra', 'Note'];
    var sc = matrixCard('Stars in each version', 'The star table each build carries, or is supplied with (a stand-in where the version’s own is not held), and how it departs from the usual: stars missing, at another position, or found in few versions. Click a version to open its star map, with the constellations marked.', SUMHEAD, sum, ['mono', 'num', 'mono', 'num', 'num', 'num', '']);
    var chips = SW.el('div', { class: 'sky-vers' });
    vs.forEach(function (v, i) { if (has[i]) chips.appendChild(SW.el('button', { class: 'btn', title: 'Open the star map of ' + v.label, onclick: function () { SW.skyMap(bs[i]); } }, '✦ ' + SW.esc(short(v)))); });
    sc.insertBefore(chips, sc.querySelector('.scroll'));
    SW.$$('tbody tr', sc).forEach(function (tr, i) { if (has[i]) { tr.style.cursor = 'pointer'; tr.title = 'Open the star map'; tr.addEventListener('click', function () { SW.skyMap(bs[i]); }); } });
    el.appendChild(sc);
    var c = matrixCard('The sky across versions', 'Each star by Samson’s identification, with its “mark X, Y” in each version. The usual entry is what most versions give; only departures from it are marked: <span class="sky-miss">missing</span>, <span class="sky-moved">at another position</span>, <span class="sky-extra">found in few versions</span>. A column of dots carries no star table.', ['Star'].concat(vs.map(short)), rows, [''].concat(vs.map(function () { return 'mono'; })));
    onlyToggle(c, rerender);
    el.appendChild(c);
    return function () { return [SW.tableBlock('Stars by version', SUMHEAD, sum), SW.tableBlock('Star positions by version (departures from the usual entry marked)', ['Star'].concat(vs.map(short)), rows)]; };
  };

  XFNS[13] = function (vs, bs, el) {
    ['ot1', 'ot2'].forEach(function (n) {
      var c = card(n === 'ot1' ? 'The Needle (ot1) through the versions' : 'The Wedge (ot2) through the versions', 'Each version\'s outline table drawn from its codes. A change in the codes is a change in the ship.');
      var row = SW.el('div', { style: 'display:flex;flex-wrap:wrap;gap:10px;align-items:flex-end' });
      var prev = null;
      vs.forEach(function (v, i) {
        var o = outline(bs[i], n);
        var key = o ? o.words.join(' ') : '';
        var box = SW.el('div', { style: 'text-align:center;font-size:11px' });
        box.innerHTML = (o ? outlineSVG(o, 5) : '<div class="faint" style="padding:20px">none</div>') + '<div class="mono' + (i && key !== prev ? '' : ' faint') + '"' + (i && key !== prev ? ' style="color:var(--amber)"' : '') + '>' + SW.esc(short(v)) + (i && key !== prev ? ' (changed)' : '') + '</div>';
        prev = key;
        row.appendChild(box);
      });
      c.appendChild(row);
      c.style.gridColumn = '1 / -1';
      el.appendChild(c);
    });
    var rows = vs.map(function (v, i) {
      var a = outline(bs[i], 'ot1'), b = outline(bs[i], 'ot2');
      return [short(v), a ? a.words.join(' ') : '', b ? b.words.join(' ') : ''];
    });
    el.appendChild(matrixCard('The codes', '', ['Version', 'ot1 (Needle)', 'ot2 (Wedge)'], rows, ['mono', 'mono', 'mono']));
    return function () { return [SW.tableBlock('Outline codes by version', ['Version', 'ot1 (Needle)', 'ot2 (Wedge)'], rows)]; };
  };

  function renderAcross(cards, head, L) {
    var vs = selected();
    var picks = SW.el('div', { class: 'hint', style: 'grid-column:1/-1;margin-bottom:4px' });
    var set = SW.store.get('gen.set', DEFAULT_SET);
    picks.innerHTML = 'Versions (shared with Genealogy): ' + V.VERSIONS.filter(function (v) { return v.build && v.id !== 'stars'; }).sort(function (a, b) { return a.sort - b.sort; }).map(function (v) {
      return '<label class="check" style="margin-right:10px" title="' + SW.esc(v.label + ' · ' + v.date + ': ' + v.summary) + '"><input type="checkbox" data-id="' + SW.esc(v.id) + '"' + (set.indexOf(v.id) >= 0 ? ' checked' : '') + '> ' + SW.esc(short(v)) + '</label>';
    }).join('');
    picks.addEventListener('change', function (e) {
      var id = e.target.dataset.id, s = SW.store.get('gen.set', DEFAULT_SET).filter(function (x) { return x !== id; });
      if (e.target.checked) s.push(id);
      SW.store.set('gen.set', s);
      render();
    });
    cards.appendChild(picks);
    var wait = SW.el('p', { class: 'hint' }, 'Assembling ' + vs.length + ' versions…');
    cards.appendChild(wait);
    Promise.all(vs.map(function (v) { return SW.build(v.id); })).then(function (bs) {
      wait.remove();
      if (!vs.length) { cards.appendChild(SW.el('p', { class: 'hint' }, 'Choose some versions.')); return; }
      var blocks = XFNS[L[0]](vs, bs, cards, render);
      if (blocks) head.appendChild(expMenu(SW.exportButtons(function () {
        return { title: 'Spacewar! across the variorum: ' + L[1].toLowerCase(), subtitle: L[2],
                 meta: [['Versions', vs.map(function (v) { return v.label + ' ' + SW.refText(v.id) + ' (' + v.date + ')'; }).join('; ')], ['Generated', SW.fmtDate(SW.today()) + ', Spacewar! research bench v' + SW.VERSION]],
                 blocks: blocks() };
      }, 'spacewar-variorum-lens-' + L[0])));
    }).catch(function (e) { wait.textContent = e.message; });
  }

  // The lenses in a drop-down, grouped; exports in a menu of their own.
  // The lenses by menu in the tab row: Text, Program, and Absence under Versions.
  var MENUS = { text: [['', [1, 2, 3, 14]]], program: [['The program', [15, 4, 8, 9, 11]], ['The machine', [5, 6, 16, 10]]], versions: [['', [7]]] };
  function menuOf(n) { for (var m in MENUS) if (MENUS[m].some(function (gr) { return gr[1].indexOf(n) >= 0; })) return m; return 'text'; }
  function lensItems(groups, attr, cur) {
    return groups.map(function (gr) {
      return '<div class="lens-g">' + (gr[0] ? '<h5>' + SW.esc(gr[0]) + '</h5>' : '') + gr[1].map(function (n) {
        var l = LENSES[n - 1];
        return '<button ' + attr + '="' + n + '"' + (n === cur ? ' class="on"' : '') + '><b>' + SW.esc(l[1]) + '</b><span>' + SW.esc(l[2]) + '</span></button>';
      }).join('') + '</div>';
    }).join('');
  }
  function expMenu(w) {
    var d = SW.el('details', { class: 'menu exp-menu tb-right' });
    d.innerHTML = '<summary class="btn" title="Export this lens">⤓ Export ▾</summary>';
    var body = SW.el('div', { class: 'menu-body' });
    body.appendChild(w);
    d.appendChild(body);
    return d;
  }
  function render() {
    var b = build;
    view.innerHTML = '';
    var pad = SW.el('div', { class: 'pad', style: 'max-width:none' });
    var L = LENSES[lens - 1];
    var head = SW.el('div', { class: 'toolbar an-head', style: 'position:static;padding:0 0 10px' });
    var mg = MENUS[menuOf(lens)];
    head.innerHTML = (mg.length === 1 && mg[0][1].length === 1 ? '<b class="an-title">' + SW.esc(L[1]) + '</b>' :
      '<details class="menu lens-menu"><summary class="btn" title="Choose">' + SW.esc(L[1]) + ' ▾</summary><div class="menu-body lens-list">' + lensItems(mg, 'data-l', lens) + '</div></details>') +
      '<span class="seg-btns"><button class="btn' + (mode === 'one' ? ' on' : '') + '" data-mode="one">This version</button>' +
      '<button class="btn' + (mode === 'across' ? ' on' : '') + '" data-mode="across">Across the variorum</button></span>' +
      '<span class="hint an-desc">' + SW.esc(L[2]) + '.</span>';
    head.addEventListener('click', function (e) {
      var t = e.target.closest('[data-l]');
      if (t) { lens = +t.dataset.l; SW.store.set('an.lens', lens); SW.writeQuery(); render(); return; }
      var m = e.target.closest('[data-mode]'); if (m) { mode = m.dataset.mode; SW.store.set('an.mode', mode); render(); }
    });
    // a lens on one version names it with its reference (the across-versions mode names each in its tables)
    if (mode !== 'across' || lens === 15) head.insertAdjacentHTML('beforeend', ' <span class="an-ref">' + SW.refTag(b.v.id) + '</span>');
    pad.appendChild(head);
    var cards = SW.el('div', { class: 'cards' });
    pad.appendChild(cards);
    view.appendChild(pad);
    SW.markTabs();
    if (lens === 15) {   // one version at a time: recorded on the emulator
      SW.$$('[data-mode]', head).forEach(function (x) { x.style.display = 'none'; });
      if (!b.asm) { cards.innerHTML = '<p class="hint">No source survives for this version.</p>'; return; }
      var ov = SW.el('div', { class: 'ov', style: 'grid-column:1/-1' }); cards.appendChild(ov);
      SW.overview.render(b, ov);
      return;
    }
    if (lens === 14) {
      // a biography is always across the versions; there is no single-version mode
      SW.$$('[data-mode]', head).forEach(function (x) { x.style.display = 'none'; });
      if (!b.asm) { cards.innerHTML = '<p class="hint">Choose a version with a surviving source; its names are offered for following.</p>'; return; }
      var bb = biography(b, cards);
      head.appendChild(expMenu(SW.exportButtons(function () {
        return { title: 'Spacewar!: the history of the symbol “' + bioName + '”', subtitle: L[2], meta: [['Generated', SW.fmtDate(SW.today()) + ', Spacewar! research bench v' + SW.VERSION]], blocks: bb() };
      }, function () { return 'spacewar-symbol-history-' + bioName; })));
      return;
    }
    if (lens === 16) SW.$$('[data-mode]', head).forEach(function (x) { x.style.display = 'none'; });   // one run, one version
    if (mode === 'across' && lens !== 16) { renderAcross(cards, head, L); return; }
    if (!b.asm && lens !== 7) { cards.innerHTML = '<p class="hint">No source survives for this version.</p>'; return; }
    var blocks = FNS[lens](b, cards);
    if (blocks) head.appendChild(expMenu(SW.exportButtons(function () {
      return { title: b.v.label + ': ' + L[1].toLowerCase(), subtitle: L[2], meta: SW.docMeta(b), blocks: blocks() };
    }, 'spacewar-' + b.v.id + '-lens-' + L[0])));
  }

  SW.views.analyse = { show: function (b) { build = b; render(); } };

  // ---------- the Graphics tab ----------
  // The bench's pictures of the program: the star map (with the scope and the
  // star tables across the versions), the ships, the sun, hyperspace.
  var GFX = [['sky', 'Star map', 'The star table, its constellations, and the scope'],
             ['ships', 'The ships', 'The Needle and the Wedge, and how they are drawn'],
             ['sun', 'The sun', 'The central star, drawn slowly'],
             ['hyper', 'Hyperspace', 'What hyperspace draws, slowed down'],
             ['gravity', 'Gravity', 'The pull of the star by distance, from each version’s code'],
             ['orbits', 'Orbits', 'The ships set circling the star, as each version’s game runs them'],
             ['moves', 'Manoeuvres', 'What the well allows: falls, orbits, the CBS opening, escape, as plates'],
             ['torps', 'Torpedoes', 'Torpedo tracks as each version’s game fires them, and the warpage rule'],
             ['random', 'Random numbers', 'The five instructions of chance: the sequence, its cycles, where it is used'],
             ['collision', 'Collision shape', 'Where two objects collide, measured in each version’s game'],
             ['roulette', 'Hyperspace roulette', 'The odds of exploding at each breakout, and where the ship comes out'],
             ['tapesim', 'Tape Load Simulator', 'The tape read into core: Read-In, then the loader']];
  // the Graphics menu in groups, with a small heading over each
  var GFXG = [['What it draws', ['sky', 'ships', 'sun', 'hyper']], ['The pull of the star', ['gravity', 'orbits', 'moves']],
              ['The rules at work', ['torps', 'collision', 'roulette', 'random']], ['The machine', ['tapesim']]];
  function gfxList(attr, onId, skip) {
    return GFXG.map(function (grp) {
      var items = grp[1].filter(function (id) { return id !== skip; }).map(function (id) { return GFX.filter(function (g) { return g[0] === id; })[0]; }).filter(Boolean);
      return items;
    }).map(function (items, i) {
      if (!items.length) return '';
      return '<div class="gfx-grp"><div class="menu-group">' + SW.esc(GFXG[i][0]) + '</div>' +
        items.map(function (g) { return '<button ' + attr + '="' + g[0] + '"' + (g[0] === onId ? ' class="on"' : '') + '><b>' + SW.esc(g[1]) + '</b><span>' + SW.esc(g[2]) + '</span></button>'; }).join('') + '</div>';
    }).join('');
  }
  var gfx = SW.store.get('gfx.item', 'sky'); if (gfx === 'memory') gfx = 'sky';
  var gfxStop = null, gfxBuild = null;
  function renderGfx() {
    var el = SW.$('#view-graphics'), b = gfxBuild;
    if (gfxStop) { gfxStop(); gfxStop = null; }
    el.innerHTML = '';
    var G = GFX.filter(function (x) { return x[0] === gfx; })[0] || GFX[0];
    var pad = SW.el('div', { class: 'pad gfx-page', style: 'max-width:none' });
    var head = SW.el('div', { class: 'toolbar an-head', style: 'position:static;padding:0 0 10px' });
    head.innerHTML = '<details class="menu lens-menu"><summary class="btn" title="Choose a graphic">' + SW.esc(G[1]) + ' ▾</summary><div class="menu-body lens-list">' +
      gfxList('data-g', G[0], 'tapesim') +
      '</div></details><span class="hint an-desc">' + SW.esc(G[2]) + '.</span>';
    head.addEventListener('click', function (e) { var t = e.target.closest('[data-g]'); if (t) { gfx = t.dataset.g; SW.store.set('gfx.item', gfx); SW.writeQuery(); renderGfx(); } });
    pad.appendChild(head);
    el.appendChild(pad);
    if (!b.lines || !b.asm) { pad.appendChild(SW.el('p', { class: 'hint' }, 'No source survives for ' + SW.esc(b.v.label) + ', so there is nothing to draw.')); return; }
    if (G[0] === 'sky') {
      var host = SW.el('div'); pad.appendChild(host); gfxStop = SW.skyMap(b, host);
      var sk = SW.el('div', { class: 'cards', style: 'margin-top:14px' }), svs = selected();
      pad.appendChild(sk);
      Promise.all(svs.map(function (v) { return SW.build(v.id); })).then(function (bs) { if (svs.length && sk.isConnected) XFNS[12](svs, bs, sk, renderGfx); });
      return;
    }
    var cards = SW.el('div', { class: 'cards' });
    pad.appendChild(cards);
    if (G[0] === 'gravity') { gfxStop = SW.gravity.draw(b, cards); return; }
    if (G[0] === 'orbits') { gfxStop = SW.orbits.draw(b, cards); return; }
    if (G[0] === 'moves') { gfxStop = SW.orbits.plates(b, cards); return; }
    if (G[0] === 'torps') { gfxStop = SW.orbits.torpedoes(b, cards); return; }
    if (G[0] === 'random') { gfxStop = SW.random.draw(b, cards); return; }
    if (G[0] === 'collision') { gfxStop = SW.lab.drawCollision(b, cards); return; }
    if (G[0] === 'roulette') { gfxStop = SW.lab.drawRoulette(b, cards); return; }
    if (G[0] === 'sun' || G[0] === 'hyper') {
      var wait = SW.el('p', { class: 'hint' }, 'Running ' + b.v.label + ' on the emulator…');
      cards.appendChild(wait);
      setTimeout(function () { wait.remove(); SW.draws[G[0] === 'sun' ? 'sun' : 'hyperspace'](b, cards); }, 30);
      return;
    }
    var blocks = FNS[13](b, cards);
    if (blocks) head.appendChild(expMenu(SW.exportButtons(function () {
      return { title: b.v.label + ': ' + G[1].toLowerCase(), subtitle: G[2], meta: SW.docMeta(b), blocks: blocks() };
    }, 'spacewar-' + b.v.id + '-' + G[0])));
    if (G[0] === 'ships') {
      var hold = SW.el('div', { style: 'grid-column:1/-1' }, '<p class="hint">Running ' + SW.esc(b.v.label) + ' on the emulator…</p>');
      cards.insertBefore(hold, cards.firstChild);
      setTimeout(function () { var tmp = SW.el('div'); SW.draws.ships(b, tmp); while (tmp.firstChild) cards.insertBefore(tmp.firstChild, hold); hold.remove(); }, 30);
      var vs = selected(), wait = SW.el('p', { class: 'hint', style: 'grid-column:1/-1' }, 'Drawing the ships of ' + vs.length + ' versions…');
      cards.appendChild(wait);
      Promise.all(vs.map(function (v) { return SW.build(v.id); })).then(function (bs) { wait.remove(); if (vs.length) XFNS[13](vs, bs, cards); });
    }
  }
  SW.views.graphics = { show: function (b) { gfxBuild = b; renderGfx(); } };

  // ---------- drop-downs in the tab row, as on the main site ----------
  // Text ▾, Program ▾, Graphics ▾, Versions ▾ and Help ▾ open a menu under the tab (click; a click outside
  // or Esc closes it); choosing an item goes to that lens or graphic.
  var tabMenu = null;
  function closeTabMenu() { if (!tabMenu) return; tabMenu.el.remove(); tabMenu.btn.setAttribute('aria-expanded', 'false'); tabMenu = null; }
  var VERS = [['about', 'This version', 'Its record, sources, build log and annotations'],
              ['compare', 'Compare', 'Two versions side by side'],
              ['genealogy', 'Genealogy', 'How the versions descend'],
              ['tape', 'Tape', 'The paper tapes, frame by frame'],
              ['absence', 'Absence', 'Gaps in the record, and what fills them']];
  function menuHTML(which) {
    if (which === 'help') {
      var dm = document.querySelector('meta[name="bench-date"]');
      // Grouped, with a divider and a small heading between the groups; About the bench stays last.
      var HELP = [['Getting started', [['tour', 'Take the welcome tour', 'Twelve stops through the bench; about three minutes'],
                                       ['refs', 'Referencing and versions', 'How the bench cites a source, as [REF: SW3.1T, 2.141]'],
                                       ['join', 'Joining the annotation group', 'A Hypothesis account, the group and your token, step by step'],
                                       ['reading', 'What you should read', 'A short bibliography: repairing old code, critical code studies, Spacewar!'],
                                       ['cards', 'Reconstruction cards', 'What was done to each text to read and run it; repairs in gold in Read'],
                                       ['anno', 'Advanced annotation', 'Rich text, and links between annotations across versions'],
                                       ['sitemap', 'Site map', 'Every view and version as a plain link']]],
                  ['Your bench', [['settings', 'Settings', 'Initials, group, theme, fonts'],
                                  ['backup', 'Back up everything', 'Notes, drafts, settings and findings in one file'],
                                  ['restore', 'Restore from a backup…', 'Brings back notes and drafts beside those here']]],
                  ['The project', [['code', 'Source code on GitHub ↗', 'github.com/spacewar1962/spacewar'],
                                   ['issue', 'Report a problem ↗', 'GitHub issues'],
                                   ['about', 'About the bench', 'Version, sources, citation']]]];
      return HELP.map(function (g, i) {
        return (i ? '<hr class="menu-rule">' : '') + '<div class="menu-group">' + SW.esc(g[0]) + '</div>' + g[1].map(function (h) {
          return '<button data-pick="' + h[0] + '"><b>' + SW.esc(h[1]) + '</b><span>' + SW.esc(h[2]) + '</span></button>';
        }).join('');
      }).join('') + '<div class="help-ver hint">Spacewar! Research Bench ' + SW.esc(SW.VERSION) + (dm ? ', ' + SW.esc(SW.fmtDate(dm.content)) : '') + '</div>';
    }
    if (which === 'graphics') return gfxList('data-pick', SW.state.tab === 'graphics' ? gfx : null);
    if (which === 'versions') return VERS.map(function (h) {
      var on = h[0] === 'absence' ? SW.state.tab === 'analyse' && lens === 7 : SW.state.tab === h[0];
      return '<button data-pick="' + h[0] + '"' + (on ? ' class="on"' : '') + '><b>' + SW.esc(h[1]) + '</b><span>' + SW.esc(h[2]) + '</span></button>';
    }).join('');
    return lensItems(MENUS[which], 'data-pick', SW.state.tab === 'analyse' ? lens : 0);
  }
  SW.$$('#tabs [data-menu]').forEach(function (btn) {
    btn.addEventListener('click', function (e) {
      e.stopPropagation();   // the menu, not the tab: choosing an item goes there
      var which = btn.dataset.menu;
      if (tabMenu && tabMenu.btn === btn) { closeTabMenu(); return; }
      closeTabMenu();
      var r = btn.getBoundingClientRect(), el = SW.el('div', { class: 'tab-menu lens-list', role: 'menu', 'data-w': which }, menuHTML(which));
      document.body.appendChild(el);
      el.style.top = r.bottom + 'px';
      el.style.left = Math.max(6, Math.min(r.left, window.innerWidth - el.offsetWidth - 6)) + 'px';
      btn.setAttribute('aria-expanded', 'true');
      tabMenu = { el: el, btn: btn };
      el.addEventListener('click', function (ev) {
        var t = ev.target.closest('[data-pick]');
        if (!t) return;
        closeTabMenu();
        if (which === 'help') {
          var p = t.dataset.pick;
          if (p === 'tour') { SW.tours.start('welcome'); return; }
          if (p === 'refs') { SW.refHelp(); return; }
          if (p === 'anno') { SW.notes.help(); return; }
          if (p === 'join') { SW.notes.joinHelp(); return; }
          if (p === 'reading') { SW.readingHelp(); return; }
          if (p === 'cards') { SW.cardsHelp(); return; }
          if (p === 'sitemap') { location.href = 'sitemap.html'; return; }
          if (p === 'backup') { SW.backup.save(); return; }
          if (p === 'restore') { SW.backup.restore(); return; }
          if (p === 'about') SW.$('#btn-about').click();
          else if (p === 'settings') SW.$('#btn-settings').click();
          else window.open(p === 'code' ? 'https://github.com/spacewar1962/spacewar' : 'https://github.com/spacewar1962/spacewar/issues', '_blank', 'noopener');
          return;
        }
        if (which === 'versions' && t.dataset.pick !== 'absence') { SW.setTab(t.dataset.pick); return; }
        if (which === 'versions') { lens = 7; SW.store.set('an.lens', 7); SW.forget('analyse'); SW.setTab('analyse'); return; }
        if (which === 'graphics' && t.dataset.pick === 'tapesim') {   // opens over the Tape view, on its tape
          SW.setTab('tape');
          var tries = 0;
          (function go() { if (SW.tape && SW.tape.openSim && SW.tape.simV === SW.state.v && SW.tape.openSim()) return; if (++tries < 50) setTimeout(go, 100); else SW.toast('No tape to load for this version.', 4000); })();
          return;
        }
        if (which === 'graphics') { gfx = t.dataset.pick; SW.store.set('gfx.item', gfx); SW.forget('graphics'); SW.setTab('graphics'); }
        else {   // the lens already open is shown as it was left
          var nl = +t.dataset.pick;
          if (nl !== lens) { lens = nl; SW.store.set('an.lens', lens); SW.forget('analyse'); }
          SW.setTab('analyse');
        }
      });
    });
  });
  document.addEventListener('mousedown', function (e) { if (tabMenu && !tabMenu.el.contains(e.target) && !tabMenu.btn.contains(e.target)) closeTabMenu(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeTabMenu(); });
  window.addEventListener('resize', closeTabMenu);
  // Open a lens or a graphic from elsewhere (the welcome tour).
  SW.openLens = function (n) { lens = n; SW.store.set('an.lens', n); SW.forget('analyse'); SW.setTab('analyse'); };
  // From a link (?lens=14, ?g=gravity): set before the first view is drawn.
  SW.setLens = function (n) { n = +n; if (LENSES[n - 1] && n !== 12 && n !== 13) { lens = n; SW.store.set('an.lens', n); } };
  SW.setGraphic = function (g) { if (GFX.some(function (x) { return x[0] === g; }) && g !== 'tapesim') { gfx = g; SW.store.set('gfx.item', g); } };
  SW.gfxItem = function () { return gfx; };
  SW.openGraphic = function (g) { gfx = g; SW.store.set('gfx.item', g); SW.forget('graphics'); SW.setTab('graphics'); };
  // Open a biography from elsewhere (the symbol pop-up in Read).
  SW.biography = function (name) {
    bioName = name; SW.store.set('an.bio', name);
    lens = 14; SW.store.set('an.lens', 14);
    SW.forget('analyse');
    SW.setTab('analyse');
  };
  SW.on('profile', function () { if (build && SW.state.tab === 'analyse' && (lens === 5 || lens === 6 || lens === 9)) render(); });
})(this);
