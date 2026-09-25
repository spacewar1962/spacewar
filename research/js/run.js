/*
 * run.js - the machine: Type 30 scope, console, stepping, profiles.
 */
(function (root) {
  'use strict';
  var SW = root.SW, C = root.PDP1CPU;
  var view = SW.$('#view-run');
  var R = SW.views.run = {};
  var build = null, cpu = null, running = false, raf = 0, lastT = 0;
  var speed = SW.store.get('run.speed', 1);
  var CPS = 200000;                         // memory cycles per second (5 us)
  var pts = [], PTS_MAX = 80000;            // recent display points for figures
  var ctx = null, scopeSize = 1024;
  var decay = SW.store.get('run.decay', 0.12); // phosphor time constant (s)
  var tempBreak = null, stepOverTo = null;
  var paneTab = 'source';
  SW.breakpoints = SW.breakpoints || {};

  var KEYS = { KeyW: 0o1, KeyS: 0o2, KeyA: 0o4, KeyD: 0o10, KeyI: 0o40000, KeyK: 0o100000, KeyJ: 0o200000, KeyL: 0o400000 };

  function lamps(n, bits, gapEvery) {
    var h = '<span class="lamps">';
    for (var i = bits - 1; i >= 0; i--) {
      h += '<i class="' + ((n >> i) & 1 ? 'on' : '') + ((bits - 1 - i) % 3 === 0 && i !== bits - 1 ? ' gap' : '') + '"></i>';
    }
    void gapEvery;
    return h + '</span>';
  }

  function render() {
    view.innerHTML = '';
    if (!build.v.runnable || !build.asm) {
      view.appendChild(SW.el('div', { class: 'pad prose' }, '<h2>' + SW.esc(build.v.label) + '</h2><p>This version cannot be run: ' +
        (build.v.build ? 'it is a data tape, loaded by the programs that use it.' : 'no source survives.') + '</p>'));
      return;
    }
    var wrap = SW.el('div', { class: 'run' });
    var left = SW.el('div', { class: 'run-left' });
    left.innerHTML =
      '<div class="scope-wrap" title="Type 30 display. Click, then use W A S D (Needle) and I J K L (Wedge)."><canvas id="scope" width="' + scopeSize + '" height="' + scopeSize + '" tabindex="0"></canvas></div>' +
      '<div class="controls">' +
      '<button class="btn" id="r-run">▶ Run</button><button class="btn" id="r-step">Step</button>' +
      '<button class="btn" id="r-over" title="Step over a subroutine call (jsp, jda)">Step over</button>' +
      '<button class="btn" id="r-reset">Reset</button>' +
      '<select id="r-speed" class="btn" title="Speed relative to the PDP-1 (5 µs memory cycle)">' +
      [0.01, 0.05, 0.25, 0.5, 1, 2, 4].map(function (s) { return '<option value="' + s + '"' + (s === speed ? ' selected' : '') + '>' + s + '×</option>'; }).join('') +
      '</select>' +
      '<button class="btn" id="r-fig" title="Save the scope at print resolution">▣ Screenshot</button></div>' +
      '<div class="keys">Controls: click the scope, then <kbd>A</kbd>/<kbd>D</kbd> rotate, <kbd>S</kbd> thrust, <kbd>W</kbd> fire (Needle); <kbd>J</kbd>/<kbd>L</kbd>, <kbd>K</kbd>, <kbd>I</kbd> (Wedge). Hyperspace is both rotate keys together.</div>' +
      '<div class="console" id="console"></div>';
    var right = SW.el('div', { class: 'run-right' });
    right.innerHTML = '<div class="toolbar" id="r-tabs">' +
      ['source', 'trace', 'profile', 'writes', 'anomalies', 'breakpoints'].map(function (t) {
        return '<button class="btn' + (t === paneTab ? ' on' : '') + '" data-t="' + t + '">' + t.charAt(0).toUpperCase() + t.slice(1) + '</button>';
      }).join('') + '<span class="sep"></span><span class="hint" id="r-clock"></span></div><div id="r-pane"></div>';
    wrap.appendChild(left);
    wrap.appendChild(right);
    view.appendChild(wrap);

    var cv = SW.$('#scope', view);
    ctx = cv.getContext('2d');
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, scopeSize, scopeSize);
    cv.addEventListener('keydown', function (e) { if (KEYS[e.code]) { cpu.control |= KEYS[e.code]; e.preventDefault(); } });
    cv.addEventListener('keyup', function (e) { if (KEYS[e.code]) { cpu.control &= ~KEYS[e.code]; e.preventDefault(); } });
    cv.addEventListener('blur', function () { cpu.control = 0; });

    // Hand focus back to the scope, so the game keys work and a later Space or
    // Enter does not press this button again and resume the game.
    SW.$('#r-run', view).onclick = function () { if (running) { pause(); cv.focus(); } else go(); };
    SW.$('#r-step', view).onclick = function () { pause(); stepOnce(); };
    SW.$('#r-over', view).onclick = stepOver;
    SW.$('#r-reset', view).onclick = function () { pause(); load(); updateAll(); };
    SW.$('#r-speed', view).onchange = function (e) { speed = +e.target.value; SW.store.set('run.speed', speed); };
    SW.$('#r-fig', view).onclick = function () { SW.figures.scopeFigureDialog(pts, cpu.cycles, build); };
    SW.$('#r-tabs', view).addEventListener('click', function (e) {
      var t = e.target.closest('button[data-t]');
      if (!t) return;
      paneTab = t.dataset.t;
      SW.$$('#r-tabs .btn', view).forEach(function (x) { x.classList.toggle('on', x === t); });
      if (paneTab === 'trace') cpu.tracing = true;
      pane();
    });
    renderConsole();
    pane();
  }

  function renderConsole() {
    var el = SW.$('#console', view);
    if (!el) return;
    var sw = '', tw = '';
    for (var i = 1; i <= 6; i++) sw += '<label><input type="checkbox" data-sense="' + i + '"' + (cpu.sense[i] ? ' checked' : '') + '>' + i + '</label>';
    for (var j = 17; j >= 0; j--) tw += '<label><input type="checkbox" data-tw="' + j + '"' + ((cpu.tw >> j) & 1 ? ' checked' : '') + '>' + (17 - j) + '</label>';
    el.innerHTML =
      '<div id="c-regs"></div>' +
      '<h4 title="The six console switches the program reads with szs: game options such as a heavy or light central star, or the background stars on and off">Sense switches</h4><div class="switches">' + sw + '</div>' +
      '<h4 title="The eighteen front-panel switches read by lat: in some versions an alternative to the control boxes, or a way to tune a value while the game runs">Test word</h4><div class="switches">' + tw + '</div>' +
      '<h4>Machine</h4><label class="check" style="color:inherit" title="The PDP-1&#39;s optional automatic multiply and divide. The 4.x versions assume it (mul, div); the 1962 versions do without, using the step instructions mus and dis on the same opcodes. Change it to see what a program does on the other machine."><input type="checkbox" id="c-mdv"' + (cpu.mdv ? ' checked' : '') +
      '> automatic multiply/divide (mul, div)</label><br><label class="check" style="color:inherit" title="A word with no defined instruction (a reserved opcode, such as the stray 4 in the 4.4 listings) either stops the machine, or is passed over and logged under Anomalies"><input type="checkbox" id="c-strict"' +
      (cpu.strictOps ? ' checked' : '') + '> reserved opcodes halt</label>';
    el.onchange = function (e) {
      var t = e.target;
      if (t.dataset.sense) cpu.sense[+t.dataset.sense] = t.checked;
      else if (t.dataset.tw) { var bit = 1 << +t.dataset.tw; cpu.tw = t.checked ? cpu.tw | bit : cpu.tw & ~bit; }
      else if (t.id === 'c-mdv') { cpu.mdv = t.checked; SW.toast('Multiply/divide option ' + (t.checked ? 'on' : 'off') + ': mul/div opcodes now act as ' + (t.checked ? 'mul/div' : 'mus/dis')); }
      else if (t.id === 'c-strict') cpu.strictOps = t.checked;
    };
    regs();
  }

  function regs() {
    var el = SW.$('#c-regs', view);
    if (!el) return;
    var md = cpu.mem[cpu.pc];
    el.innerHTML =
      '<div class="reg"><span class="nm">PC</span>' + lamps(cpu.pc, 12) + '<span class="val">' + SW.oct(cpu.pc, 4) + '</span></div>' +
      '<div class="reg"><span class="nm">MB</span>' + lamps(md, 18) + '<span class="val">' + SW.oct(md) + '</span></div>' +
      '<div class="reg"><span class="nm">AC</span>' + lamps(cpu.ac, 18) + '<span class="val">' + SW.oct(cpu.ac) + '</span></div>' +
      '<div class="reg"><span class="nm">IO</span>' + lamps(cpu.io, 18) + '<span class="val">' + SW.oct(cpu.io) + '</span></div>' +
      '<div class="reg"><span class="nm">OV · F</span><span class="lamps"><i class="' + (cpu.ov ? 'on' : '') + '"></i>' +
      [1, 2, 3, 4, 5, 6].map(function (f) { return '<i class="' + (cpu.flag[f] ? 'on' : '') + (f === 1 ? ' gap' : '') + '"></i>'; }).join('') +
      '</span><span class="val">' + (cpu.halted ? 'HALT' : running ? 'RUN' : 'STOP') + '</span></div>' +
      '<div style="margin-top:4px">' + SW.esc(C.disasm(md, build.symAt)) + '</div>';
    var ck = SW.$('#r-clock', view);
    if (ck) ck.textContent = (cpu.cycles / CPS).toFixed(3) + ' s machine time · ' + cpu.instructions.toLocaleString('en-GB') + ' instructions';
    // Only touch the label when it changes: this runs every frame, and replacing
    // the text node under the pointer mid-click makes Chrome drop the click.
    var rb = SW.$('#r-run', view), label = running ? '❚❚ Pause' : '▶ Run';
    if (rb && rb.textContent !== label) rb.textContent = label;
  }

  // ---------- scope ----------
  function plot(x, y, s, t) {
    pts.push({ x: x, y: y, s: s, t: t });
    if (pts.length > PTS_MAX) pts.splice(0, pts.length - PTS_MAX);
    if (!ctx) return;
    var px = (x + 512) * scopeSize / 1024, py = (511 - y) * scopeSize / 1024;
    var a = Math.max(0.25, Math.min(1, 0.62 + 0.13 * s));
    ctx.fillStyle = 'rgba(200,236,255,' + a + ')';
    ctx.fillRect(px - 1, py - 1, 2.4, 2.4);
  }
  function fade(dt) {
    if (!ctx) return;
    var keep = Math.exp(-dt / decay);
    ctx.fillStyle = 'rgba(0,2,4,' + (1 - keep).toFixed(4) + ')';
    ctx.fillRect(0, 0, scopeSize, scopeSize);
  }

  // ---------- execution ----------
  function load() {
    cpu = new C.PDP1({ mdv: build.v.mdv });
    cpu.load(build.asm.memory, build.asm.start);
    cpu.onDisplay = plot;
    pts = [];
    if (ctx) { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, scopeSize, scopeSize); }
    cpu.breakpoints = SW.breakpoints;
    publishProfile();
  }

  function frame(t) {
    if (!running) return;
    var dt = Math.min(0.1, (t - lastT) / 1000 || 0.016);
    lastT = t;
    var budget = Math.round(dt * CPS * speed);
    cpu.resumeFrom = cpu.pc;
    var res = runCycles(budget);
    fade(dt);
    regs();
    if (res === 'break' || res === 'halt') {
      pause();
      if (res === 'break') SW.toast('Breakpoint at ' + SW.oct(cpu.pc, 4) + (build.symAt(cpu.pc) ? ' (' + build.symAt(cpu.pc) + ')' : ''));
      if (res === 'halt') SW.toast(cpu.fault || 'The program halted (hlt).', 4000);
      pane();
      return;
    }
    if (paneTab === 'source' && speed <= 0.05) pane();
    raf = requestAnimationFrame(frame);
  }

  function runCycles(n) {
    var end = cpu.cycles + n;
    while (cpu.cycles < end && !cpu.halted) {
      var pc = cpu.pc;
      if (pc !== cpu.resumeFrom && (SW.breakpoints[pc] || pc === tempBreak || pc === stepOverTo)) {
        if (pc === tempBreak) tempBreak = null;
        if (pc === stepOverTo) stepOverTo = null;
        return 'break';
      }
      cpu.resumeFrom = -1;
      cpu.step();
    }
    return cpu.halted ? 'halt' : 'ok';
  }

  function go() {
    if (cpu.halted) { SW.toast('Halted. Reset to start again.'); return; }
    running = true;
    lastT = performance.now();
    SW.$('#scope', view).focus();
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(frame);
    regs();
  }
  function pause() {
    running = false;
    cancelAnimationFrame(raf);
    publishProfile();
    regs();
    pane();
  }
  function stepOnce() {
    cpu.tracing = true;
    cpu.step();
    regs();
    pane();
  }
  function stepOver() {
    pause();
    var md = cpu.mem[cpu.pc], op = md >> 13;
    if (op === 0o31 || op === 0o07) {      // jsp, jda/cal: run until the next word
      stepOverTo = (cpu.pc + 1) & 0o7777;
      if (op === 0o07) stepOverTo = (cpu.pc + 1) & 0o7777;
      go();
    } else stepOnce();
  }
  SW.on('runTo', function (addr) {
    if (!build || !cpu) return;
    SW.setTab('run');
    tempBreak = addr;
    go();
  });
  SW.on('breakpoints', function () { if (paneTab === 'breakpoints' || paneTab === 'source') pane(); });

  // ---------- profile ----------
  function publishProfile() {
    if (!cpu) return;
    SW.profile = { build: build, exec: cpu.execCount, read: cpu.readCount, write: cpu.writeCount,
                   lastWriter: cpu.lastWriter, cycles: cpu.cycles, instructions: cpu.instructions };
    SW.emit('profile');
  }

  // Group addresses into routines: each labelled address starts a region.
  function routines() {
    var labs = Object.keys(build.labelAt).map(Number).sort(function (a, b) { return a - b; });
    return function (addr) {
      var lo = 0, hi = labs.length - 1, best = -1;
      while (lo <= hi) { var m = (lo + hi) >> 1; if (labs[m] <= addr) { best = m; lo = m + 1; } else hi = m - 1; }
      return best < 0 ? '(start)' : build.labelAt[labs[best]];
    };
  }

  // ---------- right pane ----------
  function lineOf(addr) { var s = build.srcOf(addr); return s ? build.lines[s.p][s.n - 1] : null; }
  function gotoRead(addr) {
    var s = build.srcOf(addr);
    if (s) SW.emit('goto', { p: s.p, n: s.n, tab: 'read' });
  }

  function pane() {
    var el = SW.$('#r-pane', view);
    if (!el || !cpu) return;
    var f = { source: paneSource, trace: paneTrace, profile: paneProfile, writes: paneWrites,
              anomalies: paneAnomalies, breakpoints: paneBreaks }[paneTab];
    el.innerHTML = '';
    f(el);
  }

  function paneSource(el) {
    var s = build.srcOf(cpu.pc);
    if (!s) { el.innerHTML = '<p class="pad hint">PC ' + SW.oct(cpu.pc, 4) + ' has no source line (outside the assembled program).</p>'; return; }
    var lines = build.lines[s.p], from = Math.max(0, s.n - 18), to = Math.min(lines.length, s.n + 22);
    var h = '<div class="listing" style="padding-top:6px">';
    for (var i = from; i < to; i++) {
      var L = lines[i], ws = (build.asm.byLine[L.p] || [])[L.n] || [];
      var bp = ws.some(function (w) { return SW.breakpoints[w.loc]; });
      var ex = ws.reduce(function (a, w) { return a + cpu.execCount[w.loc]; }, 0);
      h += '<div class="ln' + (L.n === s.n ? ' cur' : '') + (bp ? ' bp' : '') + '" data-a="' + (ws[0] ? ws[0].loc : '') + '">' +
        '<span class="n" title="Toggle breakpoint">' + L.n + '</span><span class="a">' + (ws[0] ? SW.oct(ws[0].loc, 4) : '') +
        '</span><span class="w">' + (ex ? '×' + ex : '') + '</span><span class="t">' + SW.esc(L.raw) + '</span><span></span></div>';
    }
    el.innerHTML = h + '</div><p class="pad hint">Click a line number to set or clear a breakpoint. Use “Run to here” in the Read view to run to any line.</p>';
    el.onclick = function (e) {
      var row = e.target.closest('.ln');
      if (!row || !row.dataset.a) return;
      var a = +row.dataset.a;
      if (e.target.closest('.n')) {
        if (SW.breakpoints[a]) delete SW.breakpoints[a]; else SW.breakpoints[a] = true;
        pane();
      } else gotoRead(a);
    };
  }

  function paneTrace(el) {
    var tr = cpu.trace.slice(-600).reverse();
    var tb = SW.el('div', { class: 'toolbar' });
    tb.appendChild(SW.el('span', { class: 'hint' }, 'The last ' + tr.length + ' instructions (most recent first). Tracing is on while this tab is open.'));
    tb.appendChild(SW.el('span', { class: 'sep' }));
    tb.appendChild(SW.exportButtons(function () {
      return { title: build.v.label + ': execution trace', meta: SW.docMeta(build), blocks: [
        { type: 'p', text: 'The last ' + tr.length + ' instructions executed, most recent first, at ' + (cpu.cycles / CPS).toFixed(4) + ' s of machine time.' },
        SW.tableBlock('Trace', ['PC', 'Symbol', 'Instruction', 'AC', 'IO', 'Source'], tr.map(function (t) {
          var L = lineOf(t.pc);
          return [SW.oct(t.pc, 4), build.symAt(t.pc) || '', C.disasm(t.md, build.symAt), SW.oct(t.ac), SW.oct(t.io), L ? L.n + ': ' + L.raw.trim() : ''];
        }))] };
    }, 'spacewar-' + build.v.id + '-trace'));
    el.appendChild(tb);
    el.appendChild(SW.table(['PC', 'Symbol', 'Instruction', 'AC', 'IO', 'Line', 'Source'], tr.map(function (t) {
      var L = lineOf(t.pc);
      return [SW.oct(t.pc, 4), build.symAt(t.pc) || '', C.disasm(t.md, build.symAt), SW.oct(t.ac), SW.oct(t.io), L ? L.n : '', L ? L.raw.trim() : ''];
    }), { cls: ['mono', 'mono', 'mono', 'mono', 'mono', 'num', 'mono'], onRow: function (r) { gotoRead(parseInt(r[0], 8)); } }));
  }

  function paneProfile(el) {
    var rof = routines(), agg = {}, total = 0;
    for (var a = 0; a < 4096; a++) {
      var n = cpu.execCount[a];
      if (!n) continue;
      var r = rof(a);
      agg[r] = agg[r] || { n: 0, words: 0, first: a };
      agg[r].n += n; agg[r].words++;
      total += n;
    }
    var rows = Object.keys(agg).map(function (k) {
      return [k, { html: SW.oct(agg[k].first, 4), sort: agg[k].first }, agg[k].n, +(100 * agg[k].n / total).toFixed(2), agg[k].words];
    }).sort(function (x, y) { return y[2] - x[2]; });
    var tb = SW.el('div', { class: 'toolbar' });
    tb.appendChild(SW.el('span', { class: 'hint' }, total.toLocaleString('en-GB') + ' instructions in ' + (cpu.cycles / CPS).toFixed(2) +
      ' s of machine time. Where the machine’s time goes, routine by routine (regions begin at each label).'));
    tb.appendChild(SW.el('span', { class: 'sep' }));
    tb.appendChild(SW.exportButtons(function () {
      return { title: build.v.label + ': execution profile', meta: SW.docMeta(build), blocks: [
        { type: 'p', text: total + ' instructions executed in ' + (cpu.cycles / CPS).toFixed(2) + ' s of simulated PDP-1 time (5 µs memory cycle). Controls and sense switches as set in the console.' },
        SW.tableBlock('Profile by routine', ['Routine', 'Start', 'Executed', '% of instructions', 'Words run'], rows)] };
    }, 'spacewar-' + build.v.id + '-profile'));
    el.appendChild(tb);
    el.appendChild(SW.table(['Routine', 'Start', 'Executed', '%', 'Words run'], rows,
      { cls: ['mono', 'mono', 'num', 'num', 'num'], onRow: function (r) { gotoRead(parseInt(r[1].html, 8)); } }));
  }

  // Self-modifying code: words that are both executed and written at run time.
  function paneWrites(el) {
    var rows = [];
    for (var a = 0; a < 4096; a++) {
      if (cpu.execCount[a] && cpu.writeCount[a]) {
        var L = lineOf(a), w = cpu.lastWriter[a], LW = w >= 0 ? lineOf(w) : null;
        rows.push([SW.oct(a, 4), build.symAt(a) || '', cpu.execCount[a], cpu.writeCount[a],
                   w >= 0 ? SW.oct(w, 4) + ' ' + (build.symAt(w) || '') : '', L ? L.raw.trim() : '', LW ? LW.raw.trim() : '']);
      }
    }
    var tb = SW.el('div', { class: 'toolbar' });
    tb.appendChild(SW.el('span', { class: 'hint' }, rows.length + ' instruction words were rewritten by the program while it ran: the code modifying itself (dap, dac, idx into instructions). The writer is the last instruction to store into the word.'));
    tb.appendChild(SW.el('span', { class: 'sep' }));
    tb.appendChild(SW.exportButtons(function () {
      return { title: build.v.label + ': self-modifying code', meta: SW.docMeta(build), blocks: [
        { type: 'p', text: 'Instruction words executed and also written during ' + (cpu.cycles / CPS).toFixed(2) + ' s of simulated time.' },
        SW.tableBlock('Rewritten instructions', ['Address', 'Symbol', 'Executed', 'Written', 'Last writer', 'Source', 'Writer source'], rows)] };
    }, 'spacewar-' + build.v.id + '-self-modifying'));
    el.appendChild(tb);
    el.appendChild(SW.table(['Address', 'Symbol', 'Executed', 'Written', 'Last writer', 'Source', 'Writer source'], rows,
      { cls: ['mono', 'mono', 'num', 'num', 'mono', 'mono', 'mono'], onRow: function (r) { gotoRead(parseInt(r[0], 8)); } }));
  }

  function paneAnomalies(el) {
    var by = {};
    cpu.anomalies.forEach(function (a) { by[a.pc] = by[a.pc] || { n: 0, md: a.md }; by[a.pc].n++; });
    var rows = Object.keys(by).map(function (k) {
      var L = lineOf(+k);
      return [SW.oct(+k, 4), SW.oct(by[k].md), by[k].n, L ? L.n + ': ' + L.raw.trim() : ''];
    });
    el.innerHTML = '<p class="pad hint" style="padding-bottom:0">Words executed that the PDP-1 has no instruction for (reserved opcodes). ' +
      (cpu.strictOps ? 'The machine is set to halt on them.' : 'The machine is set to carry on past them, as some emulators do.') + '</p>';
    el.appendChild(rows.length ? SW.table(['Address', 'Word', 'Times', 'Source'], rows, { cls: ['mono', 'mono', 'num', 'mono'], onRow: function (r) { gotoRead(parseInt(r[0], 8)); } })
      : SW.el('p', { class: 'pad hint' }, 'None so far.'));
  }

  function paneBreaks(el) {
    var rows = Object.keys(SW.breakpoints).map(function (k) {
      var L = lineOf(+k);
      return [SW.oct(+k, 4), build.symAt(+k) || '', L ? L.n + ': ' + L.raw.trim() : ''];
    });
    el.innerHTML = '<p class="pad hint" style="padding-bottom:0">Set breakpoints from the Read view (select a line, ● Breakpoint) or by clicking line numbers in the Source tab.</p>';
    if (rows.length) {
      el.appendChild(SW.table(['Address', 'Symbol', 'Source'], rows, { cls: ['mono', 'mono', 'mono'], onRow: function (r) { gotoRead(parseInt(r[0], 8)); } }));
      el.appendChild(SW.el('p', { class: 'pad' })).appendChild(SW.el('button', { class: 'btn', onclick: function () { SW.breakpoints = {}; cpu.breakpoints = SW.breakpoints; pane(); } }, 'Clear all'));
    }
  }

  function updateAll() { regs(); pane(); }

  R.show = function (b) {
    if (build !== b) {
      pause();
      build = b;
      if (b.asm && b.v.runnable) load();
    }
    render();
  };
  R.hide = function () { if (running) pause(); };
  R.cpu = function () { return cpu; };
})(this);
