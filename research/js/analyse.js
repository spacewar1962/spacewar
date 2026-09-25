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
    [12, 'The sky', 'The Expensive Planetarium’s star table drawn as a chart']
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
  function comments(b, el) {
    var cs = progLines(b).map(function (L) { var p = SW.parseLine(L.raw); return { L: L, c: p.comment.replace(/^\/\s?/, ''), own: !p.code.trim() && !p.labels.length }; })
      .filter(function (x) { return x.c.trim(); });
    var freq = {};
    cs.forEach(function (x) { (x.c.toLowerCase().match(/[a-z][a-z'-]+/g) || []).forEach(function (w) { if (!STOP[w] && w.length > 2) freq[w] = (freq[w] || 0) + 1; }); });
    var top = Object.keys(freq).map(function (w) { return [w, freq[w]]; }).sort(function (a, b) { return b[1] - a[1]; }).slice(0, 40);
    var c1 = card(cs.length + ' comments', 'Comments are where the program addresses a human reader. ' + cs.filter(function (x) { return x.own; }).length + ' stand on their own lines (headers, section titles); the rest gloss an instruction. Words used most often:');
    c1.insertAdjacentHTML('beforeend', '<div class="scroll">' + bars(top) + '</div>');
    el.appendChild(c1);
    var c2 = card('Keyword in context', 'Search the comments. Click a line to read it in the listing.');
    var inp = SW.el('input', { type: 'search', placeholder: 'e.g. torpedo, gravity, hyperspace', class: 'btn', style: 'width:100%;margin-bottom:6px' });
    var out = SW.el('div', { class: 'kwic scroll' });
    function run() {
      var q = inp.value.trim().toLowerCase(), h = [];
      cs.forEach(function (x, i) {
        var s = x.c, idx = q ? s.toLowerCase().indexOf(q) : 0;
        if (q && idx < 0) return;
        var l = s.slice(Math.max(0, idx - 34), idx), k = s.slice(idx, idx + q.length), r = s.slice(idx + q.length, idx + q.length + 40);
        h.push('<div data-i="' + i + '">' + String(x.L.n).padStart(5) + '  ' + SW.esc(l.padStart(34)) + '<span class="k">' + SW.esc(k) + '</span>' + SW.esc(r) + '</div>');
      });
      out.innerHTML = h.slice(0, 500).join('') || '<div class="faint">No matches.</div>';
    }
    inp.addEventListener('input', run);
    out.addEventListener('click', function (e) { var d = e.target.closest('[data-i]'); if (d) goto(cs[+d.dataset.i].L); });
    c2.appendChild(inp); c2.appendChild(out);
    el.appendChild(c2);
    run();
    return function () {
      return [{ type: 'p', text: cs.length + ' comments in the program text.' },
        SW.tableBlock('Most frequent words in comments', ['Word', 'Count'], top),
        SW.tableBlock('All comments', ['Line', 'Comment'], cs.map(function (x) { return [String(x.L.n), x.c]; }))];
    };
  }

  // ---------- 2 hands and dates ----------
  var HANDS = { ddp: 'D. D. "Monty" Preonas', dfw: 'unidentified', prs: 'Peter R. Samson', jcm: 'Joe Morris', nl: 'Norbert Landsteiner', sr: 'Steve Russell', dje: 'Dan Edwards', jmg: 'J. Martin Graetz', ak: 'Alan Kotok' };
  function hands(b, el) {
    var rows = [];
    allLines(b).forEach(function (L) {
      var s = L.raw, m, re = /\b(ddp|dfw|prs|jcm|nl|dje|jmg)\b/gi, dates = s.match(/\b\d{1,2}\/\d{1,2}\/\d{2,4}\b|\b\d{4}-\d{2}-\d{2}\b|\b\d{1,2} (?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]* \d{2,4}\b/gi);
      var hs = [];
      while ((m = re.exec(s))) hs.push(m[1].toLowerCase());
      if (hs.length || dates) rows.push({ L: L, hands: hs, dates: dates || [], src: b.parts[L.p].src });
    });
    var c = card('Signatures and dates', 'Initials and dates as the programmers and later editors left them. Titles are the first line of each tape; later annotations (reconstruction notes, museum logs) are part of the text’s history too.');
    var t = SW.table(['File', 'Line', 'Hand', 'Date', 'Text'], rows.map(function (r) {
      return [r.src, r.L.n, r.hands.map(function (h) { return h + (HANDS[h] ? ' (' + HANDS[h] + ')' : ''); }).join(', '), r.dates.join(', '), r.L.raw.trim()];
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
    var box = SW.el('div', { class: 'svgbox', style: 'margin-top:6px' }, SW.resolveVars ? SW.resolveVars(svg()) : svg());
    box.addEventListener('click', function (e) { var t = e.target.closest('rect'); if (!t) return; var addr = parseInt(t.textContent, 8), s = b.srcOf(addr); if (s) goto(b.lines[s.p][s.n - 1]); });
    c.appendChild(box);
    c.appendChild(SW.el('button', { class: 'btn', onclick: function () { root.SWExport.download('spacewar-' + b.v.id + '-memory.svg', SW.resolveVars(svg()), 'image/svg+xml'); } }, '▣ SVG'));
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
    var svg = function () {
      var o = ['<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '"><rect width="' + W + '" height="' + H + '" fill="#02040a"/>'];
      mag = 1;
      stars.forEach(function (s) {
        var mm = /^(\d)j$/.exec(s.label); if (mm) mag = +mm[1];
        var x = W - (s.x / 8192) * W, y = H / 2 - s.y * (H / 2 - 8) / 512;
        o.push('<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="' + (4.4 - mag * 0.8).toFixed(1) + '" fill="#e6f4ff"><title>' + SW.esc(s.name + ' (mark ' + s.x + ', ' + s.y + ')') + '</title></circle>');
        if (mag === 1) o.push('<text x="' + (x + 5).toFixed(1) + '" y="' + (y - 4).toFixed(1) + '" font-size="9" fill="#7fa6c4">' + SW.esc(s.name.replace(/^\d+\s*/, '').split(',').pop().trim()) + '</text>');
      });
      return o.concat(['</svg>']).join('');
    };
    var box = SW.el('div', { class: 'svgbox' }, svg());
    c.appendChild(box);
    c.appendChild(SW.el('button', { class: 'btn', onclick: function () { root.SWExport.download('spacewar-' + b.v.id + '-sky.svg', svg(), 'image/svg+xml'); } }, '▣ SVG'));
    c.style.gridColumn = '1 / -1';
    el.appendChild(c);
    return function () { return [SW.tableBlock('Star table', ['Label', 'X', 'Y', 'Identification', 'Line'], stars.map(function (s) { return [s.label, String(s.x), String(s.y), s.name, String(s.L.n)]; }))]; };
  }

  var FNS = { 1: comments, 2: hands, 3: lexicon, 4: adjustable, 5: machine, 6: timeGoes, 7: absence, 8: calls, 9: instructions, 10: memmap, 11: macros, 12: sky };

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
    head.innerHTML = '<span class="prose" style="font-size:15px"><b>' + L[0] + '. ' + SW.esc(L[1]) + '.</b> ' + SW.esc(L[2]) + '.</span><span class="sep"></span>';
    pad.appendChild(head);
    var cards = SW.el('div', { class: 'cards' });
    pad.appendChild(cards);
    view.appendChild(pad);
    if (!b.asm && lens !== 7) { cards.innerHTML = '<p class="hint">No source survives for this version.</p>'; return; }
    var blocks = FNS[lens](b, cards);
    if (blocks) head.appendChild(SW.exportButtons(function () {
      return { title: b.v.label + ': ' + L[1].toLowerCase(), subtitle: L[2], meta: SW.docMeta(b), blocks: blocks() };
    }, 'spacewar-' + b.v.id + '-lens-' + L[0]));
  }

  SW.views.analyse = { show: function (b) { build = b; render(); } };
  SW.on('profile', function () { if (build && SW.state.tab === 'analyse' && (lens === 5 || lens === 6 || lens === 9)) render(); });
})(this);
