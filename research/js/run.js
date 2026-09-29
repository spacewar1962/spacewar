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
  var ctx = null, ctx2 = null, glow = null, glow2 = null, dual = false, scopeSize = 1024;
  var GLOW_T = 1.2;   // the afterglow's time constant, seconds of machine time
  var decay = SW.store.get('run.decay', 0.12); // phosphor time constant (s)
  var tempBreak = null, stepOverTo = null;
  var paneTab = 'source';
  SW.breakpoints = SW.breakpoints || {};

  // W A S D fly the Needle (ship 1) and I J K L the Wedge (ship 2): W/I fire, S/K rocket, A/J turn left, D/L turn right.
  // The bits differ by version (4.4 and 4.8 rotate the control word), so they come from SW.controlMap.
  // Players: 'keys' (two people at the keyboard), 'ai1' (you fly the Needle, the
  // computer the Wedge), 'ai0' (you the Wedge, it the Needle), 'aiai' (it flies both).
  var players = SW.store.get('run.players', 'keys');
  var follow = SW.store.get('run.follow', true), paneAt = 0;
  // each computer pilot its own level (the Needle's, the Wedge's)
  var aiLevels = [0, 1].map(function (j) { var l = SW.store.get('run.ailevel' + j, SW.store.get('run.ailevel', 'medium')); return l === 'fair' ? 'medium' : l; });
  var ctlMap = null, keyBits = 0, aiBits = 0, pilots = [null, null], ml0At = -1;
  function shipMask(j) { var m = ctlMap && ctlMap[j]; return m ? (m.ccw | m.cw | m.rocket | m.torpedo) : 0; }
  function aiShips() { return players === 'ai1' ? [1] : players === 'ai0' ? [0] : players === 'aiai' ? [0, 1] : []; }
  function aiUsable() { return !!(ctlMap && build && !build.v.ctlLoad && build.sym.nth && build.sym.ndx); }
  function setPilots() {
    pilots = [null, null];
    if (!aiUsable()) return;
    aiShips().forEach(function (j) { pilots[j] = SW.ai.pilot(build, j, ctlMap[j], aiLevels[j]); });
  }
  // the control word: your keys for the ships you fly, the computer's bits for its own
  function compose() {
    var mine = 0xffffffff;
    aiShips().forEach(function (j) { if (pilots[j]) mine &= ~shipMask(j); });
    if (cpu) cpu.control = (keyBits & mine) | aiBits;
  }
  function aiFrame() {
    aiBits = 0;
    pilots.forEach(function (p) { if (p) aiBits |= p(cpu.mem); });
    compose();
  }
  var KEYS = { KeyW: 0o40000, KeyS: 0o100000, KeyA: 0o400000, KeyD: 0o200000, KeyI: 0o1, KeyK: 0o2, KeyJ: 0o10, KeyL: 0o4 };   // as 3.1 has them, until the version's own are found
  function keysFor(m) {
    var K = {}; [['KeyW', 0, 'torpedo'], ['KeyS', 0, 'rocket'], ['KeyA', 0, 'ccw'], ['KeyD', 0, 'cw'], ['KeyI', 1, 'torpedo'], ['KeyK', 1, 'rocket'], ['KeyJ', 1, 'ccw'], ['KeyL', 1, 'cw']].forEach(function (r) { if (m[r[1]][r[2]]) K[r[0]] = m[r[1]][r[2]]; });
    return K;
  }

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
    // 4.4 is the dual-console version: each frame goes to one of two scopes, centred
    // on one ship, chosen by the 400 bit of the display instruction (dj5 / dj6)
    dual = SW.scopeCount(build) === 2;
    var wrap = SW.el('div', { class: 'run' + (dual ? ' dual' : '') });
    var left = SW.el('div', { class: 'run-left' });
    var keysTip = 'Click, then fly the Needle with W A S D and the Wedge with I J K L: W and I fire, S and K the rocket, A and J turn left, D and L turn right.';
    left.innerHTML =
      (dual
        ? '<div class="scopes2"><figure><div class="scope-wrap" title="Scope 1. ' + keysTip + '"><canvas class="glow" width="' + scopeSize + '" height="' + scopeSize + '"></canvas><canvas class="flash" id="scope" width="' + scopeSize + '" height="' + scopeSize + '" tabindex="0"></canvas></div><figcaption>Scope 1: the Wedge’s console, centred on the Wedge</figcaption></figure>' +
          '<figure><div class="scope-wrap" title="Scope 2. ' + keysTip + '"><canvas class="glow" width="' + scopeSize + '" height="' + scopeSize + '"></canvas><canvas class="flash" id="scope2" width="' + scopeSize + '" height="' + scopeSize + '" tabindex="0"></canvas></div><figcaption>Scope 2: the Needle’s console, centred on the Needle</figcaption></figure></div>' +
          '<p class="hint scopes2-note">4.4 sends alternate frames to two displays, each centred on one pilot’s ship (the kcb routine subtracts that ship’s place). Its second display is addressed by 720407 (dpy-i 400, in dj6), which DEC’s 1963 PDP-1 Handbook gives as dpp, display one point on a second CRT (Type 31), beside dpy 720007 for the Type 30. Which display MIT used as the second console is not recorded there (F31).' + (build.v.id === '4.4f' ? ' This is Landsteiner’s 2015 fixed version (F33).' : (fixedSyms ? ' Assembled with the tape “foo” fed in after pass 1, as the listing’s pass log records, so the sun is placed correctly. The Needle’s console still shows its stars, torpedoes and explosions at the wrong positions (kcb’s jmp . 6); 4.4f is Landsteiner’s 2015 fix (F33).' : ' Assembled without the tape “foo” that the pass log records after pass 1, so the sun is misplaced on both consoles; the Needle’s console also shows its stars, torpedoes and explosions at the wrong positions (kcb’s jmp . 6); 4.4f is Landsteiner’s 2015 fix (F33).')) + '</p>'
        : '<div class="scope-wrap" title="Type 30 display. ' + keysTip + '"><canvas class="glow" width="' + scopeSize + '" height="' + scopeSize + '"></canvas><canvas class="flash" id="scope" width="' + scopeSize + '" height="' + scopeSize + '" tabindex="0"></canvas></div>') +
      '<div class="controls">' +
      '<button class="btn" id="r-run">▶ Run</button><button class="btn" id="r-step">Step</button>' +
      '<button class="btn" id="r-over" title="Step over a subroutine call (jsp, jda)">Step over</button>' +
      '<button class="btn" id="r-reset">Reset</button>' +
      '<select id="r-speed" class="btn" title="Speed relative to the PDP-1 (5 µs memory cycle)">' +
      [0.01, 0.05, 0.25, 0.5, 1, 2, 4].map(function (s) { return '<option value="' + s + '"' + (s === speed ? ' selected' : '') + '>' + s + '×</option>'; }).join('') +
      '</select>' +
      (dual ? '<button class="btn" id="r-fig" title="Save scope 1 at print resolution">▣ Scope 1</button><button class="btn" id="r-fig2" title="Save scope 2 at print resolution">▣ Scope 2</button>'
            : '<button class="btn" id="r-fig" title="Save the scope at print resolution">▣ Screenshot</button>') +
      (build.v.pass1 ? '<label class="check r-sym" title="The sun routine uses nx1 and ny1 before the line that assigns them. The pass log at the end of the listing (scan p. 31) shows that after pass 1 a short tape, “' + build.v.pass1.name + '”, was fed in with nx1=mtb nob and ny1=nx1 nob, so pass 2 had their final values and the sun was placed correctly. Ticked, the bench assembles with that tape, as MIT did. Unticked, without it, the sun is misplaced (F33). The kcb jump fault on the Needle’s console is a separate coding error and stays either way; 4.4f fixes it."><input type="checkbox" id="r-sym"' + (fixedSyms ? ' checked' : '') + '> Fix Sun Rendering Bug</label><button class="icon-btn r-symhelp" id="r-symhelp" title="What the fix is, with the pass log and the code">?</button>' : '') + '</div>' +
      '<div class="r-players" id="r-players"></div>' +
      (build.sym.ddd ? '<label class="check r-ddd" title="The constant ddd, “0 to save space for ddt”: at 0 the Needle’s outline is not compiled and both ships are drawn as Wedges (F47). Changing it resets the run."><input type="checkbox" id="r-ddd"' + (SW.store.get('run.ddd', false) ? ' checked' : '') + '> Both ships as Wedges (ddd = 0)</label>' : '') +
      '<div class="keys">Controls: click the scope, then <kbd>A</kbd>/<kbd>D</kbd> rotate, <kbd>S</kbd> thrust, <kbd>W</kbd> fire (Needle); <kbd>J</kbd>/<kbd>L</kbd>, <kbd>K</kbd>, <kbd>I</kbd> (Wedge). Hyperspace is both rotate keys together.</div>' +
      '<div class="console" id="console"></div>';
    var right = SW.el('div', { class: 'run-right' });
    right.innerHTML = '<div class="toolbar" id="r-tabs">' +
      ['source', 'trace', 'profile', 'writes', 'anomalies', 'breakpoints'].map(function (t) {
        return '<button class="btn' + (t === paneTab ? ' on' : '') + '" data-t="' + t + '">' + t.charAt(0).toUpperCase() + t.slice(1) + '</button>';
      }).join('') + '<label class="check r-follow" title="While it runs, keep the source on the line being run, with its counts, five times a second (always, at 0.05× and slower)"><input type="checkbox" id="r-follow"' + (follow ? ' checked' : '') + '> Follow</label>' +
      '<span class="sep"></span><span class="hint" id="r-clock"></span></div><div id="r-pane"></div>';
    // the divide between the scopes and the code drags; its place is kept per layout
    var split = SW.el('div', { class: 'run-split' });
    SW.dragSplit(wrap, split, 'runSplit.' + (dual ? 2 : 1), 220, 240);
    wrap.appendChild(left);
    wrap.appendChild(split);
    wrap.appendChild(right);
    view.appendChild(wrap);

    var cv = SW.$('#scope', view), cv2 = SW.$('#scope2', view);
    ctx = cv.getContext('2d');
    ctx2 = cv2 ? cv2.getContext('2d') : null;
    // the P7 phosphor's slow yellow-green afterglow, on a canvas under each scope
    glow = cv.previousElementSibling.getContext('2d');
    glow2 = cv2 ? cv2.previousElementSibling.getContext('2d') : null;
    clearScopes();
    [cv, cv2].forEach(function (c) {
      if (!c) return;
      c.addEventListener('keydown', function (e) { if (KEYS[e.code]) { keyBits |= KEYS[e.code]; compose(); e.preventDefault(); } });
      c.addEventListener('keyup', function (e) { if (KEYS[e.code]) { keyBits &= ~KEYS[e.code]; compose(); e.preventDefault(); } });
      c.addEventListener('blur', function () { keyBits = 0; compose(); });
    });

    // Hand focus back to the scope, so the game keys work and a later Space or
    // Enter does not press this button again and resume the game.
    SW.$('#r-run', view).onclick = function () { if (running) { pause(); cv.focus(); } else go(); };
    SW.$('#r-step', view).onclick = function () { pause(); stepOnce(); };
    SW.$('#r-over', view).onclick = stepOver;
    SW.$('#r-reset', view).onclick = function () { pause(); load(true); updateAll(); };
    SW.$('#r-speed', view).onchange = function (e) { speed = +e.target.value; SW.store.set('run.speed', speed); };
    var fo = SW.$('#r-follow', view); if (fo) fo.onchange = function () { follow = fo.checked; SW.store.set('run.follow', follow); };
    var sym = SW.$('#r-sym', view);
    if (sym) sym.onchange = function () { SW.store.set('run.sunfix', sym.checked); R.show(build); };
    renderPlayers();
    var ddd = SW.$('#r-ddd', view); if (ddd) ddd.onchange = function () { SW.store.set('run.ddd', ddd.checked); pause(); load(true); updateAll(); };
    var symh = SW.$('#r-symhelp', view); if (symh) symh.onclick = function () { sunHelp(build); };
    SW.$('#r-fig', view).onclick = function () { SW.figures.scopeFigureDialog(dual ? pts.filter(function (p) { return p.sc !== 2; }) : pts, cpu.cycles, build); };
    if (dual) SW.$('#r-fig2', view).onclick = function () { SW.figures.scopeFigureDialog(pts.filter(function (p) { return p.sc === 2; }), cpu.cycles, build); };
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
  function plot(x, y, s, t, pc, md) {
    // on the dual-console version the 400 bit picks the scope, and is no part of the brightness
    var sc = dual ? SW.scopeOf(build, md) : 1;
    if (dual && md != null) { var i2 = (md >> 6) & 3; s = i2; }
    pts.push({ x: x, y: y, s: s, t: t, sc: sc });
    if (pts.length > PTS_MAX) pts.splice(0, pts.length - PTS_MAX);
    var g = sc === 2 ? ctx2 : ctx, gg = sc === 2 ? glow2 : glow;
    if (!g) return;
    var a = SW.beam(s); if (a <= 0) return;   // intensity 4: for a photomultiplier only
    var px = (x + 512) * scopeSize / 1024, py = (511 - y) * scopeSize / 1024, w = 1.8 + 0.8 * a;   // brighter points bleed wider
    g.fillStyle = 'rgba(200,236,255,' + a + ')';
    g.fillRect(px - w / 2, py - w / 2, w, w);
    if (gg) { gg.fillStyle = 'rgba(160,225,110,' + (0.06 * a).toFixed(3) + ')'; gg.fillRect(px - w / 2, py - w / 2, w, w); }
  }
  // the phosphor fades in machine time, so a slowed run keeps its trace: the
  // blue-white flash quickly (decay), the yellow-green afterglow slowly (GLOW_T)
  // Fades are gathered into steps of an eighth of each time constant: a canvas keeps
  // 8-bit colour, so a smaller step is rounded away and the trace never fades.
  var flashDue = 0, glowDue = 0;
  function fade(dt) {
    if (!ctx) return;
    flashDue += dt; glowDue += dt;
    if (flashDue >= decay / 8) {
      var keep = Math.exp(-flashDue / decay); flashDue = 0;
      [ctx, ctx2].forEach(function (g) { if (!g) return; g.save(); g.globalCompositeOperation = 'destination-out'; g.fillStyle = 'rgba(0,0,0,' + (1 - keep).toFixed(4) + ')'; g.fillRect(0, 0, scopeSize, scopeSize); g.restore(); });
    }
    if (glowDue >= GLOW_T / 8) {
      var keepG = Math.exp(-glowDue / GLOW_T); glowDue = 0;
      [glow, glow2].forEach(function (g) { if (!g) return; g.fillStyle = 'rgba(0,2,4,' + (1 - keepG).toFixed(4) + ')'; g.fillRect(0, 0, scopeSize, scopeSize); });
    }
  }
  function clearScopes() {
    [ctx, ctx2].forEach(function (g) { if (g) g.clearRect(0, 0, scopeSize, scopeSize); });
    [glow, glow2].forEach(function (g) { if (g) { g.fillStyle = '#000'; g.fillRect(0, 0, scopeSize, scopeSize); } });
  }

  // ---------- execution ----------
  function load(keepSwitches) {
    // Reset keeps the console's switches where they are; a new version starts with them off
    var sw0 = keepSwitches && cpu ? cpu.sense.slice() : null, tw0 = keepSwitches && cpu ? cpu.tw : 0;
    cpu = new C.PDP1(SW.cpuOpts(build.v));
    if (sw0) { cpu.sense = sw0; cpu.tw = tw0; }
    cpu.load(build.asm.memory, build.asm.start);
    // ddd = 0 ("to save space for ddt"): both ships drawn as Wedges (F47)
    if (build.sym.ddd && SW.store.get('run.ddd', false)) cpu.mem[build.sym.ddd.val] = 0;
    cpu.srcMap = new Uint8Array(4096);
    for (var k in build.asm.memory) cpu.srcMap[+k] = 1;
    cpu.lastSrcPc = -1;
    cpu.onDisplay = plot;
    ml0At = build.sym.ml0 ? build.sym.ml0.val : -1;
    aiBits = 0; setPilots(); compose(); renderPlayers();   // a fresh computer pilot, and temperament, for a fresh game
    pts = [];
    clearScopes();
    cpu.breakpoints = SW.breakpoints;
    publishProfile();
  }

  function frame(t) {
    if (!running) return;
    // left the Run view: pause, as every player on the bench does
    var sc = SW.$('#scope', view); if (sc && sc.offsetParent === null) { pause(); return; }
    var dt = Math.min(0.1, (t - lastT) / 1000 || 0.016);
    lastT = t;
    var budget = Math.round(dt * CPS * speed), c0 = cpu.cycles;
    cpu.resumeFrom = cpu.pc;
    var res = runCycles(budget);
    fade((cpu.cycles - c0) / CPS);
    regs();
    if (res === 'break' || res === 'halt') {
      pause();
      if (res === 'break') SW.toast('Breakpoint at ' + SW.oct(cpu.pc, 4) + (build.symAt(cpu.pc) ? ' (' + build.symAt(cpu.pc) + ')' : ''));
      if (res === 'halt') SW.toast(cpu.fault || 'The program halted (hlt). The lights show AC and IO (the scores, at a game’s end). Run continues, as the console’s CONTINUE switch did; Reset starts again.', 6000);
      pane();
      return;
    }
    // the source follows the running program: every frame when slowed right down,
    // otherwise five times a second if Follow is ticked: only the lines in view are
    // updated, but keeping the line in view lays the listing out again, about 15 to 20
    // ms a time, so Follow costs about a tenth of one processor core
    if (paneTab === 'source' && (speed <= 0.05 || (follow && t - paneAt > 200))) { pane(); paneAt = t; }
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
      if (pc === ml0At && (pilots[0] || pilots[1])) aiFrame();   // each frame of the game, the computer's move
      cpu.step();
    }
    return cpu.halted ? 'halt' : 'ok';
  }

  function go() {
    // after a halt, Run continues from the next instruction, as the console's CONTINUE did
    if (cpu.halted) { cpu.halted = false; cpu.fault = null; }
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
    if (paneTab !== 'source' || el._tab !== 'source') { el.innerHTML = ''; el._key = null; el.onclick = null; }
    el._tab = paneTab;
    f(el);
  }

  function paneSource(el) {
    var s = build.srcOf(cpu.pc), note = '';
    // Code the program wrote into core as it ran (Spacewar! compiles its ship
    // outlines into instructions) has no source line: show the last program
    // line run before it (the code that called it), and say what wrote it.
    if (!s) {
      var wpc = cpu.lastWriter ? cpu.lastWriter[cpu.pc] : -1, ws = wpc >= 0 ? build.srcOf(wpc) : null, who = wpc >= 0 && build.symAt(wpc);
      // the routine that wrote it, by the nearest label (at or before) whose line carries a comment
      var said = '';
      for (var a = wpc; wpc >= 0 && a >= Math.max(0, wpc - 128) && !said; a--) {
        if (!(a in build.labelAt)) continue;
        var ls = build.srcOf(a), L = ls && build.lines[ls.p][ls.n - 1], m = L && /(^|\s)\/\s*(.+)$/.exec(L.raw);
        if (m) said = build.labelAt[a] + ', “' + m[2].trim() + '”';
      }
      var last = cpu.lastSrcPc >= 0 ? build.srcOf(cpu.lastSrcPc) : null;
      note = '<p class="pad hint run-gen">PC ' + SW.oct(cpu.pc, 4) + ' is ' + (wpc >= 0 ? 'in code the program wrote into core as it ran (put there by the instruction at ' + SW.oct(wpc, 4) + (who ? ', ' + SW.esc(who) : '') + (said ? ', in ' + SW.esc(said) : '') + ')' : 'outside the assembled program') + ', which has no source line. ' +
        (last ? 'Shown: the last program line run before it, at ' + SW.oct(cpu.lastSrcPc, 4) + (build.symAt(cpu.lastSrcPc) ? ' (' + SW.esc(build.symAt(cpu.lastSrcPc)) + ')' : '') + '.' : ws ? 'Shown: the instruction that wrote it.' : '') + '</p>';
      if (!last && !ws) { el.innerHTML = note; el._key = null; return; }
      s = last || ws;
    }
    // the whole text, scrolled to the line being run (not a window around it); drawn
    // once per text, then only the current line, breakpoints and counts are updated
    var lines = build.lines[s.p], key = build.v.id + '|' + build.dialect + '|' + s.p;
    if (el._key !== key || !SW.$('.listing', el)) {
      var h = '<div class="run-note"></div><p class="pad hint run-ref"></p><div class="listing" style="padding-top:6px">';
      el._rows = [];
      for (var i = 0; i < lines.length; i++) {
        var L = lines[i], ws = (build.asm.byLine[L.p] || [])[L.n] || [];
        h += '<div class="ln" data-a="' + (ws[0] ? ws[0].loc : '') + '" data-n="' + L.n + '">' +
          '<span class="n" title="Toggle breakpoint">' + L.n + '</span><span class="a">' + (ws[0] ? SW.oct(ws[0].loc, 4) : '') +
          '</span><span class="w"></span><span class="t">' + SW.esc(L.raw) + '</span><span></span></div>';
      }
      el.innerHTML = h + '</div><p class="pad hint">Click a line number to set or clear a breakpoint. Use “Run to here” in the Read view to run to any line.</p>';
      el._key = key; el._cur = null;
      var rowsEls = SW.$$('.listing .ln', el);
      lines.forEach(function (L, k) { el._rows.push({ el: rowsEls[k], w: rowsEls[k].querySelector('.w'), ws: (build.asm.byLine[L.p] || [])[L.n] || [], ex: -1 }); });
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
    SW.$('.run-note', el).innerHTML = note;
    SW.$('.run-ref', el).innerHTML = SW.esc(build.parts[s.p].src || '') + ' · ' + SW.refTag(build.v.id, s.p, s.n, s.n, build.parts.length);
    // only the lines in view (and the current one) are brought up to date: the
    // counts change every frame, and touching every line would cost far more
    var sc0 = el.closest('.run-right') || el, rows = el._rows, rh = rows.length && rows[0].el.offsetHeight || 20;
    var top0 = rows.length ? rows[0].el.offsetTop : 0, k0 = Math.max(0, Math.floor((sc0.scrollTop - top0) / rh) - 10), k1 = Math.min(rows.length, k0 + Math.ceil(sc0.clientHeight / rh) + 20);
    if (el._cur != null && el._cur !== s.n - 1 && rows[el._cur]) rows[el._cur].el.classList.remove('cur');
    function upd(R, k) {
      var ex = R.ws.reduce(function (a, w) { return a + cpu.execCount[w.loc]; }, 0);
      if (ex !== R.ex) { R.ex = ex; R.w.textContent = ex ? '×' + ex : ''; }
      var bp = R.ws.some(function (w) { return SW.breakpoints[w.loc]; });
      if (R.el.classList.contains('bp') !== bp) R.el.classList.toggle('bp', bp);
    }
    for (var k = k0; k < k1; k++) upd(rows[k], k);
    var cur = rows[s.n - 1] ? rows[s.n - 1].el : null;
    if (cur) { upd(rows[s.n - 1], s.n - 1); cur.classList.add('cur'); el._cur = s.n - 1; }
    // keep the line being run in view, in the middle, without jumping when it already is
    var sc = el.closest('.run-right') || el;
    if (cur) {
      var r = cur.getBoundingClientRect(), rs = sc.getBoundingClientRect();
      if (r.top < rs.top + 60 || r.bottom > rs.bottom - 40) sc.scrollTop += (r.top - rs.top) - rs.height / 2;
    }
  }

  // Who flies: two people, you against the computer, or the computer against itself
  function renderPlayers() {
    var el = view && SW.$('#r-players', view); if (!el) return;
    var ok = aiUsable();
    var NAME = ['the Needle', 'the Wedge'];
    function lvlSel(jj) {
      return '<label class="check" title="How well the computer flies ' + NAME[jj] + ': easy aims loosely and never dodges; medium dodges torpedoes; hard dodges earlier and, where the version has it, jumps into hyperspace; hardcore watches furthest and aims finest.">' + (jj ? 'Wedge' : 'Needle') + ' <select data-al="' + jj + '"' + (ok ? '' : ' disabled') + '>' +
        SW.ai.LEVEL_NAMES.map(function (o) { return '<option value="' + o[0] + '"' + (o[0] === aiLevels[jj] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select>' +
        (pilots[jj] && pilots[jj].temper ? ' <span class="hint" title="Drawn at random for each game: a hunter chases hard, an orbiter keeps its distance and snipes, a duellist is between">' + pilots[jj].temper + '</span>' : '') + '</label>';
    }
    el.innerHTML = '<label class="check" title="Who flies the ships. The computer flies by the same control bits as a player: it keeps in orbit round the star, turns to meet the other ship, fires whenever a torpedo would pass close to it, and at the higher levels dodges torpedoes and jumps into hyperspace. Press Run to start.">Players <select id="r-pl"' + (ok ? '' : ' disabled') + '>' +
      [['keys', 'Two people (keys)'], ['ai1', 'You (Needle) against the computer'], ['ai0', 'You (Wedge) against the computer'], ['aiai', 'The computer against itself']].map(function (o) { return '<option value="' + o[0] + '"' + (o[0] === players ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') +
      '</select></label> ' + aiShips().map(lvlSel).join(' ') +
      (build && build.v.ctlLoad ? ' <span class="hint">Not for this version: its two control boxes read the same word on the bench (F27).</span>' : !ctlMap && build && build.asm ? ' <span class="hint">Finding the controls…</span>' : '');
    var pl = SW.$('#r-pl', el);
    // choosing who flies does not start the game: Run does
    if (pl) pl.onchange = function () { players = pl.value; SW.store.set('run.players', players); setPilots(); compose(); renderPlayers(); };
    SW.$$('[data-al]', el).forEach(function (sel) { sel.onchange = function () { var jj = +sel.dataset.al; aiLevels[jj] = sel.value; SW.store.set('run.ailevel' + jj, sel.value); setPilots(); compose(); renderPlayers(); }; });
  }
  // a source line as its reference (version, tape, line)
  function lineRef(L) { return SW.refOf(build.v.id, L.p, L.n, L.n, build.parts.length); }
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
          return [SW.oct(t.pc, 4), build.symAt(t.pc) || '', C.disasm(t.md, build.symAt), SW.oct(t.ac), SW.oct(t.io), L ? lineRef(L) + ': ' + L.raw.trim() : ''];
        }))] };
    }, 'spacewar-' + build.v.id + '-trace'));
    el.appendChild(tb);
    el.appendChild(SW.table(['PC', 'Symbol', 'Instruction', 'AC', 'IO', 'Reference', 'Source'], tr.map(function (t) {
      var L = lineOf(t.pc);
      return [SW.oct(t.pc, 4), build.symAt(t.pc) || '', C.disasm(t.md, build.symAt), SW.oct(t.ac), SW.oct(t.io), L ? lineRef(L) : '', L ? L.raw.trim() : ''];
    }), { cls: ['mono', 'mono', 'mono', 'mono', 'mono', 'mono', 'mono'], onRow: function (r) { gotoRead(parseInt(r[0], 8)); } }));
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
                   w >= 0 ? SW.oct(w, 4) + ' ' + (build.symAt(w) || '') : '', L ? lineRef(L) + ': ' + L.raw.trim() : '', LW ? lineRef(LW) + ': ' + LW.raw.trim() : '']);
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
      return [SW.oct(+k, 4), SW.oct(by[k].md), by[k].n, L ? lineRef(L) + ': ' + L.raw.trim() : ''];
    });
    el.innerHTML = '<p class="pad hint" style="padding-bottom:0">Words executed that the PDP-1 has no instruction for (reserved opcodes). ' +
      (cpu.strictOps ? 'The machine is set to halt on them.' : 'The machine is set to carry on past them, as some emulators do.') + '</p>';
    el.appendChild(rows.length ? SW.table(['Address', 'Word', 'Times', 'Source'], rows, { cls: ['mono', 'mono', 'num', 'mono'], onRow: function (r) { gotoRead(parseInt(r[0], 8)); } })
      : SW.el('p', { class: 'pad hint' }, 'None so far.'));
  }

  function paneBreaks(el) {
    var rows = Object.keys(SW.breakpoints).map(function (k) {
      var L = lineOf(+k);
      return [SW.oct(+k, 4), build.symAt(+k) || '', L ? lineRef(L) + ': ' + L.raw.trim() : ''];
    });
    el.innerHTML = '<p class="pad hint" style="padding-bottom:0">Set breakpoints from the Read view (select a line, ● Breakpoint) or by clicking line numbers in the Source tab.</p>';
    if (rows.length) {
      el.appendChild(SW.table(['Address', 'Symbol', 'Source'], rows, { cls: ['mono', 'mono', 'mono'], onRow: function (r) { gotoRead(parseInt(r[0], 8)); } }));
      el.appendChild(SW.el('p', { class: 'pad' })).appendChild(SW.el('button', { class: 'btn', onclick: function () { SW.breakpoints = {}; cpu.breakpoints = SW.breakpoints; pane(); } }, 'Clear all'));
    }
  }

  function updateAll() { regs(); pane(); }

  // The ? beside Fix Sun Rendering Bug: the pass log, and the lines the tape
  // changes, with their words assembled without and with it (F33)
  function sunHelp(b) {
    var v = b.v, P = v.pass1;
    Promise.all([SW.build(v.id), SW.build(v.id, 'macro1963bare')]).then(function (bb) {
      var W = bb[0].asm.memory, O = bb[1].asm.memory, rows = [];
      Object.keys(W).forEach(function (k) {
        if (!O[k] || O[k].val === W[k].val) return;
        var L = bb[0].lines[W[k].file] && bb[0].lines[W[k].file][W[k].line - 1];
        rows.push({ p: W[k].file, n: W[k].line, loc: +k, src: L ? L.raw.replace(/\t/g, '  ').trim() : '', was: O[k].val, now: W[k].val });
      });
      rows.sort(function (a, c) { return a.loc - c.loc; });
      // where each tape and name named here is, so that it opens in Read
      var B = bb[0], at = {};
      function findLine(re) { for (var pi = 0; pi < B.lines.length; pi++) for (var i = 0; i < B.lines[pi].length; i++) { var L = B.lines[pi][i]; if (!/^\s*\//.test(L.raw) && re.test(L.raw)) return pi + ':' + L.n; } return null; }
      function defOf(k) { var d = B.sym[k] && B.sym[k].defs && B.sym[k].defs[0]; return d ? d.file + ':' + d.line : null; }
      at.pt1 = findLine(/spacewar 4\.[34].*pt 1/); at.pt2 = findLine(/spacewar 4\.[34].*pt 2/);
      at.stars = findLine(/stars by prs/i) || defOf('1j');
      ['bjl', 'kcb', 'mtb', 'nx1'].forEach(function (k) { at[k] = defOf(k); });
      at.sun = at.bjl || (rows.length ? rows[0].p + ':' + rows[0].n : null);   // 4.3 has no bjl: its sun lines are in bpt
      function lk(text, key) { return at[key] ? '<a href="#" data-line="' + at[key] + '" title="Open in Read">' + SW.esc(text) + '</a>' : SW.esc(text); }
      function logLine(l) {
        var tape = /^(foo|f|nx1=mtb nob|ny1=nx1 nob|start|foo - pass 1|f - pass 1)$/.test(l), key = /pt 1/.test(l) ? 'pt1' : /pt 2/.test(l) ? 'pt2' : /^stars by prs/.test(l) ? 'stars' : null;
        var h = key ? lk(l, key) : SW.esc(l);
        return tape ? '<mark>' + h + '</mark>' : h;
      }
      var d = SW.el('dialog', { class: 'tray-big sunhelp' });
      d.innerHTML = '<div class="tray-bighead"><b>' + SW.esc(P.name.toUpperCase()) + ' TAPE: This tape fixes the sun problem</b> ' + SW.refTag(v.id) + '<span class="refhelp-acts">' +
        (rows.length ? '<button class="btn ghost" data-go="read">Open in Read ▸</button>' : '') + '<button class="icon-btn" data-x title="Close (Esc)">✕</button></span></div>' +
        '<p><b>Two passes.</b> MACRO turned the source into a binary tape by reading the whole program twice. On pass 1 the operator fed every source tape through the reader (' + lk('part 1', 'pt1') + ', ' + lk('part 2', 'pt2') + ', ' + lk('the star tape', 'stars') + ') and MACRO punched nothing: it only worked out the value of every name, the addresses of labels such as ' + lk('bjl', 'bjl') + ', ' + lk('kcb', 'kcb') + ' and ' + lk('mtb', 'mtb') + ' and assignments such as ' + lk('nx1=mtb nob', 'nx1') + ', and kept them in its symbol table. On pass 2 the same tapes were fed through again from the start, and MACRO translated each line into a machine word, using those values, and punched the binary tape that was loaded to play. Two readings are needed because a line can use a name defined further on: jmp kcb needs ' + lk('kcb', 'kcb') + '’s address before the reader has reached it. The pass log below is MACRO’s typed record of this, one line for each tape as it went through, marked pass 1 or pass 2.</p>' +
        '<p><b>The problem.</b> Most names used before their definition are fine, since pass 1 has found them all before pass 2 begins. An assignment built from a name defined later is not. ' + lk('nx1=mtb nob', 'nx1') + ' is in part 1, but ' + lk('mtb', 'mtb') + ', the object table, is defined only at the end of part 2, so when pass 1 reaches the assignment mtb is not yet known and nx1 and ny1 are left unset. The ' + lk('sun routine', 'sun') + ', which subtracts the centred ship’s place, nx1 and ny1, then gets the wrong values on pass 2. Assembled from the listing alone, the sun is drawn in the wrong place.</p>' +
        '<p><b>The fix.</b> Between the two readings, after pass 1 of the program and the star tape, one more short input, titled “' + SW.esc(P.name) + '”, was read, with the two assignments again. By then mtb is known, so nx1 and ny1 get their final values, and when pass 2 starts the sun routine is punched correctly. It is read on pass 1 only, adds no words to the program, and only settles two symbols.</p>' +
        '<p><b>Provenance.</b> It is recorded in the pass log that ends the listing: the lines MACRO typed as each tape was read, in order, pass by pass. The log is part of the same assembly as the listing, not a later addition. It ends with the symbol punch “spacewar ' + (v.id === '4.3' ? '4.3' : '4.4') + ' syms 5/23/63 jcm”, so the assembly was most likely run by Joe Morris (jcm) on or just before 23 May 1963, after ddp’s last change to the program (' + (v.id === '4.3' ? '17 May' : '21 May') + '). The log does not say who wrote the fix. It prints the input’s lines, which it does not do for the program’s tapes, so they may have been typed in at the console rather than punched.' + (v.id === '4.3' ? ' In 4.3 there are two tries: first nx1 alone, then both.' : ' The 4.3 log of the same day has the same fix, titled “f”, with a first try that assigned nx1 alone.') + ' So this is not a later repair: it is how the program was assembled at MIT in May 1963, and the 1963 binary would have placed the sun correctly. Reassemblies made from the listing alone, including Norbert Landsteiner’s of 2015, show the fault; his 4.4f changes the source to avoid it.</p>' +
        '<div class="sunhelp-cols"><figure><figcaption>The pass log, <a href="../sources/' + encodeURIComponent(P.scan) + '#page=' + P.page + '" target="_blank" rel="noopener">scan p. ' + P.page + ' ↗</a>' + (v.id === '4.4m' ? ' (the Morris 4.4 listing)' : '') + '</figcaption><pre class="mono sunhelp-log">' +
        P.log.map(logLine).join('\n') + '</pre></figure>' +
        '<figure><figcaption>What the tape changes: the words assembled without it and with it</figcaption><table class="ov-sub mono sunhelp-t"><thead><tr><th>Reference</th><th>Address</th><th>Source</th><th>Without</th><th>With</th></tr></thead><tbody>' +
        rows.map(function (r) { return '<tr><td class="num"><a href="#" data-line="' + r.p + ':' + r.n + '">' + SW.esc(SW.refOf(v.id, r.p, r.n, r.n, B.parts.length)) + '</a></td><td>' + SW.oct(r.loc, 4) + '</td><td>' + SW.esc(r.src) + '</td><td>' + SW.oct(r.was, 6) + '</td><td>' + SW.oct(r.now, 6) + '</td></tr>'; }).join('') +
        '</tbody></table><p class="hint">Only these words differ. ' + (v.id === '4.3' ? 'In 4.3 the sun is recentred only in the subjective view (sense switch 2).' : 'Without the tape, the Wedge’s console subtracts locations 31 and 61 (ran, the random number, and tyi), so its sun jumps along one line; the Needle’s subtracts 30 and 60, a fixed offset.') + ' The kcb jump fault on the Needle’s console is separate and stays either way (4.4f fixes it).</p></figure></div>';
      // MACRO, explained on hover, in the prose (not in the log or the table)
      // the first MACRO in the prose links to DEC's manual; every one explains itself on hover
      var MACRO_TIP = 'MACRO: DEC’s assembler for the PDP-1 (manual F-36, 1962). It read a program’s source from punched paper tape, in two passes, and punched the object tape, the binary that was loaded to run. Spacewar! was written for it. Click for the manual (bitsavers.org); Wikipedia’s PDP-1 article gives the machine’s background.';
      var firstM = true;
      SW.$$('p', d).forEach(function (pe) { pe.innerHTML = pe.innerHTML.replace(/\bMACRO\b(?![^<]*>)/g, function () {
        var t = SW.esc(MACRO_TIP);
        if (firstM) { firstM = false; return '<a class="term" href="https://bitsavers.org/pdf/dec/pdp1/PDP-1_Macro.pdf" target="_blank" rel="noopener" title="' + t + '">MACRO</a> <a class="term-x" href="https://en.wikipedia.org/wiki/PDP-1" target="_blank" rel="noopener" title="The PDP-1 on Wikipedia">(PDP-1 ↗)</a>'; }
        return '<abbr class="term" title="' + t + '">MACRO</abbr>';
      }); });
      document.body.appendChild(d);
      d.addEventListener('click', function (e) {
        if (e.target === d || e.target.closest('[data-x]')) { d.close(); return; }
        var ln = e.target.closest('[data-line]'), go = e.target.closest('[data-go]');
        if (ln) { e.preventDefault(); var pn = ln.dataset.line.split(':'); d.close(); SW.openAt(v.id, { p: +pn[0], n0: +pn[1] }); }
        else if (go && go.dataset.go === 'read' && rows.length) { d.close(); SW.openAt(v.id, { p: rows[0].p, n0: rows[0].n, n1: rows[rows.length - 1].n }); }
      });
      d.addEventListener('close', function () { d.remove(); });
      d.showModal();
    });
  }

  // 4.3 and 4.4 are assembled with the tape fed in after pass 1, as their pass
  // logs record (F33); Run can leave it out, to show the misplaced sun
  var fixedSyms = false;
  R.show = function (b) {
    var want = b.v.pass1 && !SW.store.get('run.sunfix', true) ? 'macro1963bare' : b.v.dialect;
    if (b.dialect !== want) { SW.build(b.v.id, want).then(function (b2) { if (SW.state.v === b.v.id) R.show(b2); }); return; }
    fixedSyms = b.dialect !== 'macro1963bare';
    if (build !== b) {
      pause();
      build = b;
      if (b.asm && b.v.runnable) load();
      SW.controlMap(b.v.id).then(function (m) { if (build === b) { KEYS = keysFor(m); ctlMap = m; keyBits = 0; aiBits = 0; setPilots(); compose(); renderPlayers(); } });
    }
    render();
  };
  R.hide = function () { if (running) pause(); };
  R.cpu = function () { return cpu; };
})(this);
