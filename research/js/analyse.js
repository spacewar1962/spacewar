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

  var LENSES = [
    [1, 'Comments', 'The programmers’ own voice: every comment, searchable in context'],
    [2, 'Hands and dates', 'Signatures, initials and dates written into the code'],
    [3, 'Lexicon', 'The names the program gives to its world'],
    [4, 'Rules made adjustable', 'Constants, sense switches, test word: what could be changed'],
    [5, 'The machine in the code', 'Where the PDP-1 shows through: devices, arithmetic, timing'],
    [6, 'Where the time goes', 'The run profile as an argument about priorities'],
    [7, 'Absence', 'What the record does not hold, and how the rebuild fills it'],
    [8, 'Calls', 'Who calls whom: subroutine calls between routines'],
    [9, 'Instructions', 'Instruction frequency, as written and as executed'],
    [10, 'Memory map', 'Code, constants, variables and tables across the 4096 words'],
    [11, 'Macros', 'The macros and how often each is expanded'],
    [12, 'The sky', 'The Expensive Planetarium’s star table drawn as a chart'],
    [13, 'The ships', 'The Needle and the Wedge, drawn from their outline codes'],
    [14, 'Biographies', 'One name’s life across the versions: when it appears, how its definition changes, who signs it, when it goes']
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
        SW.tableBlock('All comments', ['Line', 'Comment'], cs.map(function (x) { return [String(x.L.n), x.c]; }))];
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
    var t = SW.table(['File', 'Line', 'Hand', 'Date', 'Text'], rows.map(function (r) {
      return [r.src, r.L.n, r.hands.map(function (h) { return h + ' (' + SW.handOf(h).who + ')'; }).join(', '), r.dates.join(', '), r.L.raw.trim()];
    }), { cls: ['mono', 'num', '', 'mono', 'mono'], onRow: function (r) { var x = rows.filter(function (y) { return y.L.n === r[1] && y.src === r[0]; })[0]; if (x) goto(x.L); } });
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
      return [s.name, s.variable ? 'variable' : s.label ? 'label' : 'defined', s.refs.length, d.line, cm];
    }).sort(function (a, b) { return b[2] - a[2]; });
    var c = card(rows.length + ' names', 'Every symbol the program defines, with how often it is used and the comment beside its definition: a glossary written by the code itself. Three letters was the working length; the names are abbreviations of a world (ships, torpedoes, the star, the sky).');
    var s = SW.el('div', { class: 'scroll', style: 'max-height:520px' });
    s.appendChild(SW.table(['Name', 'Kind', 'Uses', 'Defined at', 'Comment at definition'], rows, { cls: ['mono', '', 'num', 'num', ''], onRow: function (r) { goto(b.lines[b.sym[r[0]].defs[0].file][r[3] - 1]); } }));
    c.appendChild(s); c.style.gridColumn = '1 / -1';
    el.appendChild(c);
    return function () { return [SW.tableBlock('Lexicon', ['Name', 'Kind', 'Uses', 'Defined at line', 'Comment at definition'], rows)]; };
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
    c2.appendChild(SW.table(['Line', 'Text'], timing.map(function (L) { return [L.n, L.raw.trim()]; }), { cls: ['num', 'mono'], onRow: function (r) { goto(timing.filter(function (L) { return L.n === r[0]; })[0]); } }));
    el.appendChild(c2);
    return function () { return [SW.tableBlock('Hardware in the instruction stream', ['Feature', 'Words', 'Executed'], rows), SW.tableBlock('Time in the comments', ['Line', 'Text'], timing.map(function (L) { return [L.n, L.raw.trim()]; }))]; };
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

  // ---------- 7 absence ----------
  function absence(b, el) {
    var V = root.SWVersions, items = [];
    b.parts.forEach(function (p) {
      if (p.role !== 'program') items.push(['Supplied tape', p.src + ': ' + p.role]);
      if (p.title > 1) items.push(['Skipped header', p.src + ': lines 1–' + (p.title - 1) + ' (transcription header, not assembled)']);
    });
    (b.v.transforms || []).forEach(function (k) { items.push(['Normalisation', V.TRANSFORMS[k].label]); });
    var norm = 0; b.lines.forEach(function (ls) { ls.forEach(function (L) { if (L.raw !== L.norm && !L.skipped) norm++; }); });
    if (norm) items.push(['Lines normalised', String(norm)]);
    allLines(b).forEach(function (L) { if (/illegible|\[\?|uncertain|unclear/i.test(L.raw)) items.push(['Marked uncertain', b.parts[L.p].src + ':' + L.n + '  ' + L.raw.trim()]); });
    if (b.asm) b.asm.errors.forEach(function (e) { items.push(['Assembly error', b.parts[e.file].src + ':' + e.line + '  ' + e.message + (e.symbol ? ' "' + e.symbol + '"' : '')]); });
    V.VERSIONS.filter(function (v) { return v.status === 'lost'; }).forEach(function (v) { items.push(['Lost version', v.label + ' (' + v.date + '): ' + v.summary]); });
    var c = card('What the record does not hold', 'Every place where this build depends on something other than the text as held: supplied tapes, normalisations, uncertain readings, errors, and the versions that do not survive at all.');
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
    var c0 = card('The call structure', 'Routines along the line in memory order; each arc a call (blue: to a routine later in memory, amber: to one earlier), thicker for more call sites. Hover for names.');
    c0.appendChild(SW.el('div', { class: 'svgbox' }, SW.displaySVG(arcSVG())));
    c0.appendChild(SW.figureButtons(arcSVG, 'spacewar-' + b.v.id + '-calls'));
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
  function memmap(b, el) {
    if (!b.asm) return null;
    var kind = new Array(4096).fill('');
    b.asm.words.forEach(function (w) { kind[w.loc] = w.kind === 'constant' ? 'constant' : w.kind === 'text' ? 'text' : b.parts[w.file].role !== 'program' ? 'supplied' : 'code'; });
    if (b.asm.variables) for (var a = b.asm.variables.start; a < b.asm.variables.end; a++) if (!kind[a]) kind[a] = 'variable';
    var col = { code: 'var(--beam)', constant: 'var(--amber)', variable: 'var(--violet)', supplied: 'var(--green)', text: 'var(--red)', '': 'var(--line-soft)' };
    var W = 64, cell = 9, svg = function () {
      var o = ['<svg xmlns="http://www.w3.org/2000/svg" width="' + (W * cell + 60) + '" height="' + (4096 / W * cell + 10) + '" viewBox="0 0 ' + (W * cell + 60) + ' ' + (4096 / W * cell + 10) + '">'];
      for (var i = 0; i < 4096; i++) {
        var x = 52 + (i % W) * cell, y = Math.floor(i / W) * cell;
        o.push('<rect x="' + x + '" y="' + y + '" width="' + (cell - 1) + '" height="' + (cell - 1) + '" fill="' + col[kind[i]] + '"><title>' + i.toString(8).padStart(4, '0') + ' ' + (kind[i] || 'unused') + (b.labelAt[i] ? ' ' + b.labelAt[i] : '') + '</title></rect>');
        if (i % W === 0) o.push('<text x="0" y="' + (y + cell - 1) + '" font-size="8" fill="var(--text-dim)">' + i.toString(8).padStart(4, '0') + '</text>');
      }
      return o.concat(['</svg>']).join('');
    };
    var counts = {}; kind.forEach(function (k) { counts[k || 'unused'] = (counts[k || 'unused'] || 0) + 1; });
    var c = card('The 4096 words', 'Each square one 18-bit word, 64 to a row (octal addresses at left). ' + Object.keys(counts).map(function (k) { return k + ' ' + counts[k]; }).join(' · '));
    c.insertAdjacentHTML('beforeend', '<div class="legend">' + Object.keys(col).filter(Boolean).map(function (k) { return '<span><i style="background:' + col[k] + '"></i>' + k + '</span>'; }).join('') + '<span><i style="background:var(--line-soft)"></i>unused</span></div>');
    var box = SW.el('div', { class: 'svgbox', style: 'margin-top:6px' }, SW.displaySVG(svg()));
    box.addEventListener('click', function (e) { var t = e.target.closest('rect'); if (!t) return; var addr = parseInt(t.textContent, 8), s = b.srcOf(addr); if (s) goto(b.lines[s.p][s.n - 1]); });
    c.appendChild(box);
    c.appendChild(SW.figureButtons(svg, 'spacewar-' + b.v.id + '-memory'));
    c.style.gridColumn = '1 / -1';
    el.appendChild(c);
    return function () { return [SW.tableBlock('Memory use', ['Kind', 'Words'], Object.keys(counts).map(function (k) { return [k, counts[k]]; }))]; };
  }

  // ---------- 11 macros ----------
  function macros(b, el) {
    if (!b.asm) return null;
    var uses = {};
    b.asm.words.forEach(function (w) { if (w.macro) uses[w.macro] = (uses[w.macro] || 0) + 1; });
    var sites = {};
    b.asm.words.forEach(function (w) { if (w.macro) { sites[w.macro] = sites[w.macro] || {}; sites[w.macro][w.file + ':' + w.line] = 1; } });
    var rows = b.asm.macros.map(function (m) {
      return [m.name, m.args.join(', '), sites[m.name] ? Object.keys(sites[m.name]).length : 0, uses[m.name] || 0, b.parts[m.file].src + ':' + m.line];
    }).sort(function (a, b) { return b[3] - a[3]; });
    var c = card(rows.length + ' macros', 'Macro instructions: abbreviations the programmers wrote for themselves. Call sites and the words they expanded into.');
    c.appendChild(SW.table(['Macro', 'Dummies', 'Call sites', 'Words generated', 'Defined'], rows, { cls: ['mono', 'mono', 'num', 'num', 'mono'], onRow: function (r) { var m = b.macros[r[0]]; if (m) goto(b.lines[m.file][m.line - 1]); } }));
    c.style.gridColumn = '1 / -1';
    el.appendChild(c);
    return function () { return [SW.tableBlock('Macros', ['Macro', 'Dummies', 'Call sites', 'Words generated', 'Defined'], rows)]; };
  }

  // ---------- 12 the sky ----------
  function sky(b, el) {
    var stars = [];
    allLines(b).forEach(function (L) {
      var m = /^\s*(?:([0-9a-z]+),)?\s*mark\s+(-?\d+)\s*,\s*(-?\d+)\s*(\/.*)?$/i.exec(L.raw);
      if (m) stars.push({ x: +m[2], y: +m[3], name: (m[4] || '').replace(/^\/\s*/, '').trim(), label: m[1] || '', L: L });
    });
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
    var box = SW.el('div', { class: 'svgbox' }, svg());
    c.appendChild(box);
    c.appendChild(SW.figureButtons(svg, 'spacewar-' + b.v.id + '-sky'));
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
      var c = card(label, 'The outline table at ' + SW.oct(o.addr, 4) + ', read three bits at a time: <span class="mono">' + SW.esc(o.words.join(' ')) + '</span>. Pale points are the first side, blue the mirrored pass; the amber point is the start (the nose). ' + o.pts.length + ' points, each plotted every frame.');
      var svg = outlineSVG(o, 9);
      c.appendChild(SW.el('div', { class: 'svgbox', style: 'text-align:center' }, svg));
      c.appendChild(SW.figureButtons(function (pal) { return outlineSVG(o, 12, b.v.label + ' ' + label, pal); }, 'spacewar-' + b.v.id + '-' + o.name));
      el.appendChild(c);
    });
    var c2 = card('How to read the codes', 'From the outline compiler in the source: 1 continue along the axis; 2 step outward; 3 outward and along; 4 step inward; 5 inward and along; 6 remember this point, and at the next 6 return to it; 7 end, then draw the other side as its mirror. The compiler turns these into display instructions when the game starts: Dan Edwards’s outline compiler, compiling data into code at run time.');
    el.appendChild(c2);
    return function () {
      return [SW.tableBlock('Outline tables', ['Table', 'Address', 'Codes', 'Points'], os.map(function (o) { return [o.name, SW.oct(o.addr, 4), o.words.join(' '), String(o.pts.length)]; }))];
    };
  }

  var FNS = { 1: comments, 2: hands, 3: lexicon, 4: adjustable, 5: machine, 6: timeGoes, 7: absence, 8: calls, 9: instructions, 10: memmap, 11: macros, 12: sky, 13: ships };

  // ---------- 14 biographies ----------
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
        sc.appendChild(SW.figureButtons(function () { return bioSVG(name, rows); }, 'spacewar-biography-' + SW.slug(name)));
        out.appendChild(sc);
        var t = SW.table(['Version', 'Date', 'Status', 'Kind', 'Definition', 'Comment', 'Value', 'Uses', 'Hand'], tableRows(rows),
          { cls: ['', 'mono', '', '', 'mono', '', 'mono', 'num', 'mono'], onRow: function (r) {
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
            mc.insertAdjacentHTML('beforeend', '<h4>' + SW.esc(short(r.v)) + ' · ' + SW.esc(r.st) + '</h4><pre class="mono" style="font-size:12px;overflow:auto">' + SW.esc(r.e.body) + '</pre>');
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
                e && e.hands && e.hands.length ? e.hands.join(', ') : ''];
      });
    }
    go.onclick = follow;
    inp.addEventListener('keydown', function (ev) { if (ev.key === 'Enter') follow(); });
    follow();
    return function () {
      return [{ type: 'p', text: bioSummary(cur.name, cur.rows) },
              SW.tableBlock(cur.name + ' across the versions', ['Version', 'Date', 'Status', 'Kind', 'Definition', 'Comment', 'Value', 'Uses', 'Hand'], tableRows(cur.rows))];
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
      var m = /^\s*(?:([0-9a-z]+),)?\s*mark\s+(-?\d+)\s*,\s*(-?\d+)\s*(\/.*)?$/i.exec(L.raw);
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
      Object.keys(b).forEach(function (k) { if (!(k in a)) changes.push([short(vs[i - 1]) + ' → ' + short(v), 'new', b[k].text]); });
      Object.keys(a).forEach(function (k) { if (!(k in b)) changes.push([short(vs[i - 1]) + ' → ' + short(v), 'dropped', a[k].text]); });
    });
    el.appendChild(matrixCard('What the comments say that changes', 'Every comment that appears or disappears between consecutive versions.', ['Step', 'Change', 'Comment'], changes, ['mono', '', '']));
    var c = card('Keyword in context, across versions', 'Search every selected version\'s comments at once.');
    var inp = SW.el('input', { type: 'search', placeholder: 'e.g. torpedo, gravity, score', class: 'btn', style: 'width:100%;margin-bottom:6px' });
    var out = SW.el('div', { class: 'kwic scroll' });
    inp.addEventListener('input', function () {
      var q = inp.value.trim().toLowerCase(), items = [];
      if (q) fs.forEach(function (f, i) {
        Object.keys(f.comments).forEach(function (k) { items.push({ c: f.comments[k].text, tag: short(vs[i]) }); });
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
    var cpu = new C.PDP1({ mdv: b.v.mdv });
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
    c.insertAdjacentHTML('beforeend', '<div class="legend">' + kinds.map(function (k) { return '<span><i style="background:' + col[k] + '"></i>' + k + '</span>'; }).join('') + '</div>');
    c.appendChild(SW.el('div', { class: 'svgbox', style: 'margin-top:6px' }, SW.displaySVG(svg())));
    c.appendChild(SW.figureButtons(svg, 'spacewar-memory-across-versions'));
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
    var sum = vs.map(function (v, i) { return [short(v), fs[i].starOrder.length]; });
    el.appendChild(matrixCard('Stars in each version', 'Entries in the star table carried by (or supplied to) each build.', ['Version', 'Stars'], sum, ['mono', 'num']));
    var m = matrix(all, vs, function (s, v, i) { return fs[i].stars[s] || ''; }, { onlyChanges: xst.onlyChanges });
    var c = matrixCard('The sky across versions', 'Each star by Samson\'s identification, with its “mark X, Y” position in each version. Shaded cells mark a star added, moved or removed.', ['Star'].concat(vs.map(short)), m, [''].concat(vs.map(function () { return 'mono'; })));
    onlyToggle(c, rerender);
    el.appendChild(c);
    return function () { return [SW.tableBlock('Stars by version', ['Version', 'Stars'], sum), SW.tableBlock('Star positions by version', ['Star'].concat(vs.map(short)), m)]; };
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
      if (blocks) head.appendChild(SW.exportButtons(function () {
        return { title: 'Spacewar! across the variorum: ' + L[1].toLowerCase(), subtitle: L[2],
                 meta: [['Versions', vs.map(function (v) { return v.label + ' (' + v.date + ')'; }).join('; ')], ['Generated', SW.fmtDate(SW.today()) + ', Spacewar! research bench v' + SW.VERSION]],
                 blocks: blocks() };
      }, 'spacewar-variorum-lens-' + L[0]));
    }).catch(function (e) { wait.textContent = e.message; });
  }

  function render() {
    var b = build;
    view.innerHTML = '';
    var pad = SW.el('div', { class: 'pad', style: 'max-width:none' });
    var nav = SW.el('div', { class: 'lens-nav' });
    nav.innerHTML = LENSES.map(function (l) { return '<button class="btn' + (l[0] === lens ? ' on' : '') + '" data-l="' + l[0] + '" title="' + SW.esc(l[2]) + '">' + l[0] + '. ' + SW.esc(l[1]) + '</button>'; }).join('');
    nav.addEventListener('click', function (e) { var t = e.target.closest('[data-l]'); if (t) { lens = +t.dataset.l; SW.store.set('an.lens', lens); render(); } });
    pad.appendChild(nav);
    var L = LENSES[lens - 1];
    var head = SW.el('div', { class: 'toolbar', style: 'position:static;padding:0 0 10px' });
    head.innerHTML = '<button class="btn' + (mode === 'one' ? ' on' : '') + '" data-mode="one">This version</button>' +
      '<button class="btn' + (mode === 'across' ? ' on' : '') + '" data-mode="across">Across the variorum</button><span class="sep"></span>' +
      '<span class="prose" style="font-size:15px"><b>' + L[0] + '. ' + SW.esc(L[1]) + '.</b> ' + SW.esc(L[2]) + '.</span><span class="sep"></span>';
    head.addEventListener('click', function (e) { var m = e.target.closest('[data-mode]'); if (m) { mode = m.dataset.mode; SW.store.set('an.mode', mode); render(); } });
    pad.appendChild(head);
    var cards = SW.el('div', { class: 'cards' });
    pad.appendChild(cards);
    view.appendChild(pad);
    if (lens === 14) {
      // a biography is always across the versions; there is no single-version mode
      SW.$$('[data-mode]', head).forEach(function (x) { x.style.display = 'none'; });
      if (!b.asm) { cards.innerHTML = '<p class="hint">Choose a version with a surviving source; its names are offered for following.</p>'; return; }
      var bb = biography(b, cards);
      head.appendChild(SW.exportButtons(function () {
        return { title: 'Spacewar!: the life of “' + bioName + '”', subtitle: L[2], meta: [['Generated', SW.fmtDate(SW.today()) + ', Spacewar! research bench v' + SW.VERSION]], blocks: bb() };
      }, function () { return 'spacewar-biography-' + bioName; }));
      return;
    }
    if (mode === 'across') { renderAcross(cards, head, L); return; }
    if (!b.asm && lens !== 7) { cards.innerHTML = '<p class="hint">No source survives for this version.</p>'; return; }
    var blocks = FNS[lens](b, cards);
    if (blocks) head.appendChild(SW.exportButtons(function () {
      return { title: b.v.label + ': ' + L[1].toLowerCase(), subtitle: L[2], meta: SW.docMeta(b), blocks: blocks() };
    }, 'spacewar-' + b.v.id + '-lens-' + L[0]));
  }

  SW.views.analyse = { show: function (b) { build = b; render(); } };
  // Open a biography from elsewhere (the symbol pop-up in Read).
  SW.biography = function (name) {
    bioName = name; SW.store.set('an.bio', name);
    lens = 14; SW.store.set('an.lens', 14);
    SW.forget('analyse');
    SW.setTab('analyse');
  };
  SW.on('profile', function () { if (build && SW.state.tab === 'analyse' && (lens === 5 || lens === 6 || lens === 9)) render(); });
})(this);
