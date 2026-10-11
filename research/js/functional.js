/*
 * functional.js - how this bench reads its PDP-1 MACRO for bench-kit's Functional overview
 * (kit/functional.js), drawn in Program ▸ Functional overview when Read from the source is
 * chosen (beside the recording, js/overview.js). From the assembled words, without running. The
 * routines are the bench's one definition of them, SW.structure.entries (js/structure.js), which
 * the Dynamic Profile uses too, without a run: the start, what a jsp or jda calls, what is called
 * through a word set by law, and what is stored in the objects' table the main loop runs; each
 * named by its label, or the label before it and how far on. Each is followed through its words as the machine would go, not into the routines it
 * calls: on after a word, to the target of a jmp, both ways after a skip (isp, sad, sas, the skip
 * group), on after a call (and the word after, which a jda may take as an argument); it stops at
 * a jmp i (a return), and where it reaches another routine. Its calls are the jsp and jda words
 * reached (from macros too: mult is jda mpy), in the order of their lines.
 * Each tape is shown with what it assembles to.
 */
(function (root) {
  'use strict';
  var SW = root.SW;

  // the six-bit operation of a word (the indirect bit included: jda is 17, jmp i 61)
  function op6(v) { return v >> 12; }
  var JMP = 0o60, JMPI = 0o61, JSP = 0o62, JDA = 0o17, SKIPS = { 0o46: 1, 0o50: 1, 0o52: 1, 0o64: 1, 0o65: 1 };
  function entryName(b) { return SW.structure.nameOf(b, b.asm.start); }

  function analyse(b) {
    var mem = b.asm.memory, rs = [], byAddr = {}, queue = [];
    var E = SW.structure.entries(b);
    E.list.forEach(function (a) {
      var src = b.srcOf(a), r = { name: SW.structure.nameOf(b, a), a: a, p: src.p, n: src.n, calls: [] };
      rs.push(r); byAddr[a] = r; queue.push(r);
    });
    function add(a) { return byAddr[a & 0o7777] || null; }
    // each routine followed through its words (a jda routine's from the word after its argument)
    while (queue.length) {
      var r = queue.shift(), seen = {}, todo = [E.enter[r.a] || r.a], first = {}, steps = 0;
      while (todo.length && steps++ < 4000) {
        var a = todo.pop() & 0o7777;
        if (seen[a] || (a !== r.a && byAddr[a])) continue;   // done, or another routine
        seen[a] = 1;
        var w = mem[a]; if (!w || w.kind === 'constant') continue;
        var o = op6(w.val), y = w.val & 0o7777;
        if (o === JMPI) continue;
        if (o === JMP) { todo.push(y); continue; }
        if (o === JSP || o === JDA) {
          var t = y !== a ? add(y) : null;
          if (t && t !== r && (!first[t.name] || w.line < first[t.name].line)) first[t.name] = { line: w.line };
          todo.push(a + 1); if (o === JDA) todo.push(a + 2);
          continue;
        }
        todo.push(a + 1);
        if (SKIPS[o]) todo.push(a + 2);
      }
      r.calls = Object.keys(first).map(function (k) { return { name: k, line: first[k].line }; }).sort(function (x, y) { return x.line - y.line; });
    }
    rs.sort(function (x, y) { return x.a - y.a; });
    // what each tape assembles to
    var load = b.parts.map(function () { return []; }), span = {};
    b.asm.words.forEach(function (w) { var s = span[w.file] || (span[w.file] = { lo: w.loc, hi: w.loc, n: 0, line: w.line }); s.lo = Math.min(s.lo, w.loc); s.hi = Math.max(s.hi, w.loc); s.n++; if (w.line < s.line) s.line = w.line; });
    Object.keys(span).forEach(function (f) {
      var s = span[f], st = b.srcOf(b.asm.start);
      load[f].push({ n: s.line, text: s.n + ' words, ' + SW.oct(s.lo, 4) + '–' + SW.oct(s.hi, 4) });
      if (st && st.p === +f) load[f].push({ n: st.n, text: 'the start, ' + SW.oct(b.asm.start, 4) });
    });
    return { rs: rs, load: load };
  }

  // the choice of mode was kept as an.foMode before bench-kit 0.16.0
  try { var was = SW.store.get('an.foMode', null); if (was) { SW.store.set('fo.mode', was); SW.store.set('an.foMode', null); } } catch (e) { /* ignore */ }

  SW.BENCH.functional = {
    // the program run on the emulator, each frame followed (js/overview.js)
    recorded: {
      label: 'Recorded run',
      title: 'The program run on the emulator: each frame, each object’s routine, the time and the data.',
      render: function (b, el) { var ov = SW.el('div', { class: 'ov', style: 'grid-column:1/-1' }); el.appendChild(ov); SW.overview.render(b, ov); return null; }
    },
    entry: entryName,
    analyse: analyse,
    // a tape by its file's name, or by its number where several tapes come from one file
    fileLabel: function (b, p) {
      var pt = b.parts[p], name = pt.src.split('/').pop(), role = pt.role !== 'program' ? pt.role.split(/,| \(/)[0] : '';
      var shared = b.parts.filter(function (x) { return x.src.split('/').pop() === name; }).length > 1;
      return shared ? 'tape ' + (p + 1) + (role ? ' (' + role + ')' : '') : name + (role ? ' (' + role + ')' : '');
    },
    loadTitle: 'Assembled to',
    startUpLede: 'The tapes of the version in the order they are read, with the routines each holds and what it assembles to in core memory (in octal), and where the program starts.',
    startLede: function (b, e) {
      return 'The program from its start address, ' + SW.oct(b.asm.start, 4) + ' (' + SW.esc(entryName(b)) + ')' + ', followed through its words as the machine would go (jumps, both ways after a skip, not into the routines it calls): the routines it calls (jsp, jda), in the order of their lines, and what each of those calls in turn. Read from the assembled words; Recorded run follows the program as it runs (each frame, each object’s routine). Click a name to read it.';
    },
    note: function () { return '<p class="hint">The routines are those the Dynamic Profile draws: the start, what a jsp or jda calls, what is called through a word set by law (cwr), and what is put in the objects’ table for the main loop to run (ss1, ss2, tcr, mex). A table routine’s place in the loop is in Recorded run.</p>'; }
  };
})(this);
