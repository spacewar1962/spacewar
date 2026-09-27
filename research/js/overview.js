/*
 * overview.js - a functional overview of a version, for a programmer: what
 * runs once at start-up, what the main loop does each frame, which routine
 * each object in the object table runs, and which subroutines each calls.
 * Recorded, not read off the listing: the version runs on the bench's
 * emulator, stepped one instruction at a time, with controls pressed in turn
 * so that rockets, torpedoes and hyperspace run. Every subroutine call (jsp,
 * jda, cal, also through xct) is kept with the routine it was made from,
 * found by a call stack: a routine has returned when execution is back at
 * the address after its call, or up to two words on (a call followed by an
 * argument word, as jda mpy and jda oc are). What each routine is for is given in the
 * program's own comments, on the call or at the label.
 */
(function (root) {
  'use strict';
  var SW = root.SW, C = root.PDP1CPU, O = SW.overview = {};

  // cycles of 5 µs: 400000 is two seconds of the machine's time
  var PHASES = [
    { cycles: 400000, cw: 0, what: 'no controls for two seconds' },
    { cycles: 60000, cw: 0o600000, what: 'the first ship’s two rotate bits (hyperspace)' },
    { cycles: 1000000, cw: 0, what: 'no controls for five seconds' },
    { cycles: 300000, cw: 0o140000 | 0o3, what: 'both ships’ rocket and torpedo bits' },
    { cycles: 400000, cw: 0, what: 'no controls for two seconds' }
  ];
  O.PHASES = PHASES;

  function opOf(md) { return md >> 13; }
  function isCall(md) { var op = opOf(md); return op === 0o31 || op === 0o07; }

  O.analyse = function (b, phases) {
    phases = phases || PHASES;
    var cpu = new C.PDP1({ mdv: b.v.mdv });
    cpu.load(b.asm.memory, b.asm.start);
    // data flow: every read and write in the frames, by the routine running
    var flow = {};
    function who() { return stack.length ? stack[stack.length - 1].e : waitAt[cpu.curPC] ? 'wait' : 'main'; }
    function tally(a, rw) { var f = flow[a] = flow[a] || { r: {}, w: {} }, k = who(); f[rw][k] = (f[rw][k] || 0) + 1; }
    var rd0 = cpu.rd, wr0 = cpu.wr;
    cpu.rd = function (a) { if (inFrames) tally(a, 'r'); return rd0.call(this, a); };
    cpu.wr = function (a, v) { if (inFrames) tally(a, 'w'); return wr0.call(this, a, v); };
    // what each frame puts on the screen: x, y and the routine plotting, in turn
    cpu.onDisplay = function (x, y) { if (cur) cur.pts.push(x, y, who()); };
    var mem = cpu.mem, isSrc = function (a) { return !!b.asm.memory[a]; };
    var frameAt = b.sym.ml0 ? b.sym.ml0.val : (b.sym.bck ? b.sym.bck.val : -1);
    var R = {}, sites = {}, path = [], stack = [], inFrames = false, frames = 0;
    // time: cycles in each routine itself (ex) and with what it calls (inc), in
    // frames; each frame's calls as spans against time; the main loop's wait
    // for the rest of the frame (the line "use up rest of time") kept apart
    var ex = {}, inc = {}, frameList = [], cur = null, waitAt = {}, snaps = [];   // snaps: memory as each frame begins
    b.lines.forEach(function (ls, pi) { ls.forEach(function (L) {
      if (/use up rest of time/i.test(L.raw)) ((b.asm.byLine[pi] || [])[L.n] || []).forEach(function (w) { waitAt[w.loc] = 1; });
    }); });
    // the main loop: from its label to the last jump back to it (the game-over
    // test may jump back earlier)
    var loopEnd = frameAt + 0o200;
    for (var a = frameAt; a >= 0 && a < Math.min(0o10000, frameAt + 0o600); a++) if (mem[a] === (0o600000 | frameAt)) loopEnd = a;
    function inLoop(a) { return a >= frameAt && a <= loopEnd; }
    function rec(e) { return R[e] = R[e] || { e: e, calls: {}, n: 0, startup: 0, callers: {}, frames: {} }; }
    function span(e) { if (!cur) return null; var sp = { e: e, d: stack.length, t0: cpu.cycles - cur.t, t1: null }; cur.spans.push(sp); return sp; }
    function close(k) { for (var q = stack.length - 1; q >= k; q--) if (stack[q].span && stack[q].span.t1 == null) stack[q].span.t1 = cpu.cycles - cur.t; stack.length = k; }
    var phase = 0;
    phases.forEach(function (P, pi) {
      phase = pi;
      cpu.tw = P.cw; cpu.control = P.cw;
      var end = cpu.cycles + P.cycles;
      while (cpu.cycles < end && !cpu.halted) {
        var pc0 = cpu.pc, md = mem[pc0], tgt = md;
        // a return: execution is back just after a call on the stack (up to two
        // words on: jda mpy, jda oc and the like take an argument word after the call);
        // a routine entered by a jump from the main loop has finished when the main loop runs again
        for (var k = stack.length - 1; k >= 0; k--) {
          if (stack[k].jd ? inLoop(pc0) && pc0 > stack[k].site : ((pc0 - stack[k].ret) & 0o7777) <= 2) { close(k); break; }
        }
        if (pc0 === frameAt) {
          close(0);
          if (cur) { cur.len = cpu.cycles - cur.t; frameList.push(cur); }
          snaps.push(cpu.mem.slice());
          cur = { t: cpu.cycles, spans: [], pts: [], len: 0, phase: phase };
          inFrames = true; frames++;
        }
        if (!inFrames && !stack.length && isSrc(pc0) && b.labelAt[pc0] && path.indexOf(pc0) < 0 && path.length < 40) path.push(pc0);
        if (opOf(md) === 0o04) { var y = md & 0o7777; if ((md >> 12) & 1) y = mem[y] & 0o7777; tgt = mem[y]; }
        // a jump in the main loop that the program rewrites (jmp ., set for each object) is a dispatch
        var jd = inFrames && !stack.length && opOf(md) === 0o30 && inLoop(pc0) && cpu.writeCount[pc0] > 0;
        var c0 = cpu.cycles;
        cpu.step();
        if (inFrames) {
          var dc = cpu.cycles - c0, top = stack.length ? stack[stack.length - 1].e : waitAt[pc0] ? 'wait' : 'main';
          ex[top] = (ex[top] || 0) + dc;
          var seenE = {}; for (var q = 0; q < stack.length; q++) { var eq = stack[q].e; if (!seenE[eq]) { seenE[eq] = 1; inc[eq] = (inc[eq] || 0) + dc; } }
          if (top === 'wait') {
            var ls0 = cur.spans[cur.spans.length - 1];
            if (ls0 && ls0.e === 'wait' && ls0.t1 === c0 - cur.t) ls0.t1 = cpu.cycles - cur.t;
            else cur.spans.push({ e: 'wait', d: 0, t0: c0 - cur.t, t1: cpu.cycles - cur.t });
          }
        }
        if (jd && !inLoop(cpu.pc) && isSrc(cpu.pc)) {
          var tj = cpu.pc, rj = rec('main'), tt = rec(tj);
          rj.calls[tj] = (rj.calls[tj] || 0) + 1; tt.n++; tt.callers.main = 1; tt.frames[frames] = 1;
          var sj = sites[pc0] = sites[pc0] || { pc: pc0, to: {}, n: 0, jump: true }; sj.to[tj] = (sj.to[tj] || 0) + 1; sj.n++;
          stack.push({ jd: true, e: tj, site: pc0, span: span(tj) });
        }
        else if (isCall(tgt) && (cpu.ac & 0o7777) === ((pc0 + 1) & 0o7777)) {
          var to = cpu.pc;
          if (opOf(tgt) === 0o07) to = (to - 1) & 0o7777;   // jda Y: AC kept at Y, entry at Y+1
          if (!isSrc(to)) to = 'rt';
          var from = stack.length ? stack[stack.length - 1].e : (inFrames ? 'main' : 'startup');
          var r = rec(from), t = rec(to);
          r.calls[to] = (r.calls[to] || 0) + 1;
          t.n++; t.callers[from] = 1; if (!inFrames) t.startup++; else t.frames[frames] = 1;
          if (from === 'main') { var s = sites[pc0] = sites[pc0] || { pc: pc0, to: {}, n: 0 }; s.to[to] = (s.to[to] || 0) + 1; s.n++; }
          stack.push({ ret: (pc0 + 1) & 0o7777, e: to, span: inFrames ? span(to) : null });
          if (stack.length > 64) stack.shift();
        }
      }
    });
    var total = frameList.reduce(function (a, f) { return a + f.len; }, 0);
    return { R: R, sites: sites, path: path, frames: frames, frameAt: frameAt, loopEnd: loopEnd, start: b.asm.start, cpu: cpu, halted: cpu.halted,
             ex: ex, inc: inc, frameList: frameList, total: total, waitAt: waitAt, flow: flow, phases: phases, snaps: snaps };
  };

  // ---------- reading the source ----------
  function lineOf(b, name) {
    var s = b.sym[name], d = s && s.defs && s.defs[0];
    if (!d || !b.lines[d.file]) return null;
    return { p: d.file, n: d.line, L: b.lines[d.file][d.line - 1] };
  }
  function lineAt(b, pc) { var q = b.srcOf(pc); return q ? { p: q.p, n: q.n, L: b.lines[q.p][q.n - 1] } : null; }
  function commentOf(raw) { var m = /\/\s*(.*)$/.exec(String(raw || '')); return m ? m[1].trim() : ''; }
  // a label's gloss: the comment on its line, else the comment block just above
  function gloss(b, name, above) {
    var at = lineOf(b, name);
    if (!at || !at.L) return '';
    var own = above ? '' : commentOf(at.L.raw.replace(/^[^\/]*?,/, ''));
    if (own && !/^\s*$/.test(own)) return own;
    var ls = b.lines[at.p], out = [];
    for (var i = at.n - 2; i >= 0 && i >= at.n - 6; i--) {
      var t = ls[i].raw.trim();
      if (!t) { if (out.length) break; continue; }
      if (t[0] !== '/') break;
      out.unshift(t.replace(/^\/+\s*/, ''));
    }
    return out.slice(0, 2).join(' ');
  }
  function below(b, a) { for (var d = 0; d < 0o100 && a - d >= 0; d++) if (b.labelAt[a - d]) return { l: b.labelAt[a - d], d: d }; return null; }
  function name(b, e) {
    if (e === 'rt') return 'compiled outline'; if (e === 'main') return 'main loop'; if (e === 'startup') return 'start-up';
    var q = below(b, +e); return q ? q.l + (q.d ? '+' + q.d : '') : SW.oct(+e, 4);
  }
  // an entry's gloss: its label's, or for label+n the comment on its own line,
  // else the comment block above the label
  function glossAt(b, e) {
    if (e === 'rt') return 'the ship’s outline, compiled at start-up';
    var q = below(b, +e); if (!q) return '';
    if (!q.d) return gloss(b, q.l);
    var at = lineAt(b, +e), c = at && at.L ? commentOf(at.L.raw) : '';
    return c || gloss(b, q.l, true);
  }

  // The object table's fields, as the main loop sets its pointers to them
  // (init mx1, nx1 / dap mx1 / dac \mh1, each with the program's comment).
  // A field's length comes from the addresses of the symbols that mark each
  // field's start: mtb, then nx1, ny1 ... and nnn after the last.
  function tableFields(b) {
    var at = lineOf(b, 'ml0'); if (!at) return null;
    var ls = b.lines[at.p], out = [];
    for (var i = at.n - 1; i < Math.min(ls.length, at.n + 90); i++) {
      var t = ls[i].raw.replace(/^\s*ml0,/, '');
      var f = /^\s*(?:init\s+(\w+),\s*\w+|dap\s+[\\.~]?(\w+)|dac\s+[\\.~]?(\w+))\s*(?:\/\s*(.*))?$/.exec(t);
      if (f) { out.push({ field: f[1] || f[2] || f[3], what: (f[4] || '').trim(), n: i + 1, p: at.p }); continue; }
      if (!out.length) continue;
      if (/^\s*$/.test(t) || /^\s*(add\s+\(|law\s+n\w+|n\w+\s*=|\/)/.test(t)) continue;
      break;
    }
    if (!out.length) return null;
    var S = b.sym;
    out.forEach(function (f) { var nm = f.field === 'ml1' ? 'mtb' : 'n' + f.field.slice(1), s0 = S[nm]; f.base = s0 ? s0.val : null; });
    var bases = out.filter(function (f) { return f.base != null; }).map(function (f) { return f.base; }).concat(S.nnn ? [S.nnn.val] : []).sort(function (x, y) { return x - y; });
    out.forEach(function (f) { if (f.base == null) return; var nx = bases.filter(function (v) { return v > f.base; })[0]; f.size = nx != null ? nx - f.base : null; });
    return { fields: out, nob: S.nob ? S.nob.val : null };
  }

  // What an address is, for the data flow: an object table field (and which
  // object), a variable, a constant, or a word of the program; a word the
  // program both runs and writes is an instruction rewritten at run time.
  function classify(b, A, T) {
    var vars = {}, S = b.sym;
    Object.keys(S).forEach(function (k) { var s0 = S[k]; if (s0 && s0.variable && typeof s0.val === 'number') vars[s0.val] = k; });
    return function (a) {
      if (T) for (var i = 0; i < T.fields.length; i++) { var f = T.fields[i]; if (f.base != null && f.size && a >= f.base && a < f.base + f.size) return { kind: 'field', key: f.field, obj: a - f.base, f: f }; }
      if (vars[a]) return { kind: 'var', key: vars[a] };
      var m = b.asm.memory[a];
      if (m && m.kind === 'constant') return { kind: 'const' };
      if (A.cpu.execCount[a] > 0) return { kind: 'code', key: a };
      if (m || b.labelAt[a]) return { kind: 'data', key: name(b, a) };
      return { kind: 'other', key: SW.oct(a, 4) };
    };
  }

  // ---------- the page ----------
  // the controls held in a recording of one's own: ship bits as the source's
  // comment gives them (high four bits: ccw, cw, rocket, torpedo; low four the
  // same for the other ship)
  var BITS = [['ccw', 0o400000, 0o10], ['cw', 0o200000, 0o4], ['rocket', 0o100000, 0o2], ['torpedo', 0o040000, 0o1]];
  var mine = null;   // {cw, secs} when recording with one's own controls
  function myPhases(m) {
    var held = [];
    [0, 1].forEach(function (s0) { var on = BITS.filter(function (bt) { return m.cw & bt[1 + s0]; }).map(function (bt) { return bt[0]; }); if (on.length) held.push((s0 ? 'second' : 'first') + ' ship: ' + on.join(', ')); });
    return [{ cycles: 400000, cw: 0, what: 'no controls for two seconds' },
            { cycles: m.secs * 200000, cw: m.cw, what: (held.join('; ') || 'no controls') + ' held for ' + m.secs + ' seconds' },
            { cycles: 400000, cw: 0, what: 'released for two seconds' }];
  }
  O.render = function (b, el) {
    el.innerHTML = '<p class="hint">Running ' + SW.esc(b.v.label) + ' on the emulator…</p>';
    setTimeout(function () { draw(b, el); }, 20);
  };
  function goRead(b, p, n) { SW.state.sel = { p: p, n0: n, n1: n }; SW.setTab('read'); }
  function hue(nm) { var h = 0; for (var i = 0; i < nm.length; i++) h = (h * 31 + nm.charCodeAt(i)) % 360; return h; }
  function colour(nm) { return nm === 'waiting' ? 'rgba(143,163,181,0.28)' : 'hsl(' + hue(nm) + ',55%,52%)'; }
  var US = 5;   // a memory cycle is 5 µs
  function speedPref(set) { try { if (set) localStorage.setItem('swbench.ovSpeed', set); return localStorage.getItem('swbench.ovSpeed') || '4'; } catch (e) { return set || '4'; } }

  function draw(b, el) {
    // kept for the version and snapshot: the run, the frame shown, the routines visited
    var key = b.v.id + '|' + JSON.stringify(mine), C0 = O._keep && O._keep.key === key ? O._keep : null, A;
    if (C0) A = C0.A;
    else try { A = O.analyse(b, mine ? myPhases(mine) : PHASES); } catch (e) { el.innerHTML = '<p class="hint">The emulator stopped: ' + SW.esc(e.message) + '</p>'; return; }
    var keep = O._keep = C0 || { key: key, A: A, frame: null, hist: [], hpos: -1 };
    var F = Math.max(1, A.frames), FL = A.frameList, NF = Math.max(1, FL.length);
    var avgLen = A.total / NF;
    function nm(e) { return e === 'wait' ? 'waiting' : name(b, e); }
    function link(e, text) {
      if (e === 'startup') return '<span class="ov-nm">start-up</span>';
      if (text) { var at0 = lineOf(b, e) || null; return '<a href="#" class="ov-nm mono" data-p="' + (at0 ? at0.p : '') + '" data-n="' + (at0 ? at0.n : '') + '" title="Open in Read">' + SW.esc(text) + '</a>'; }
      return '<a href="#" class="ov-nm mono" data-e="' + SW.esc(String(e)) + '" title="Inspect">' + SW.esc(nm(e)) + '</a>';
    }
    function per(n) { var v = n / F; return v >= 10 ? Math.round(v) + ' a frame' : v >= 0.95 ? (Math.round(v * 10) / 10) + ' a frame' : 'in ' + Math.round(100 * v) + '% of frames'; }
    function rate(n) { var v = n / F; return v >= 1 ? String(Math.round(v)) : v >= 0.1 ? (Math.round(10 * v) / 10).toString() : '<0.1'; }
    function cyc(n) { return Math.round(n).toLocaleString('en-GB') + ' cycles (' + (n * US / 1000).toFixed(n * US < 10000 ? 2 : 1) + ' ms)'; }
    // small icons on a panel: save as SVG or PNG, and add to My notes
    function icons(k, fig) {
      return '<span class="ov-icons">' + (fig ? '<button class="ov-ic" data-ic="svg" data-k="' + k + '" title="Save as SVG">SVG</button><button class="ov-ic" data-ic="png" data-k="' + k + '" title="Save as PNG">PNG</button>' : '') +
        '<button class="ov-ic" data-ic="note" data-k="' + k + '" title="Add to My notes (private)">＋</button></span>';
    }
    var vshort = b.v.label.replace(/^Spacewar! /, ''), fileBase = 'spacewar-' + b.v.id;
    function callsOf(e, depth, seen) {
      var r = A.R[e]; if (!r) return '';
      var ks = Object.keys(r.calls).sort(function (x, y) { return r.calls[y] - r.calls[x]; });
      if (!ks.length || depth > 3) return '';
      return '<ul class="ov-calls">' + ks.map(function (k) {
        var loop = seen.indexOf(k) >= 0, g = glossAt(b, k);
        var cnt = r.n ? Math.round(10 * r.calls[k] / r.n) / 10 : r.calls[k];
        return '<li>' + link(k) + ' <span class="faint">×' + cnt + (r.n ? ' a call' : '') + '</span>' + (g ? ' <span class="ov-g">' + SW.esc(g) + '</span>' : '') +
          (loop ? '' : callsOf(k, depth + 1, seen.concat([k]))) + '</li>';
      }).join('') + '</ul>';
    }
    var h = [];
    var snapLine = '<div class="ov-run"><p class="hint"><b>Snapshot:</b> ' + SW.esc(b.v.label) + ' on the emulator, ' + A.frames + ' frames of the main loop, with ' +
      A.phases.map(function (P) { return P.what; }).join(', then ') + '. A memory cycle is 5 µs.' + (A.halted ? ' The machine halted during the run.' : '') + '</p>' +
      '<button class="btn" data-snap title="Choose the controls held, and take a new snapshot">New snapshot…</button></div>';

    // one frame against time
    var frameBox = ('<section class="ov-box ov-player"><h4>Frame Player <span class="ov-ver">' + SW.esc(vshort) + '</span>' + icons('player', true) + '</h4>' +
      '<div class="toolbar ov-fctl" style="position:static;padding:0 0 6px"><button class="btn ghost" data-f="prev" title="Previous frame">◀</button><button class="btn ghost" data-f="play">▶ Play</button><button class="btn ghost" data-f="next" title="Next frame">▶</button>' +
      '<select class="ov-speed" title="Frames a second when playing; real time plays each frame for as long as it took on the PDP-1">' + [['1', '1 a second'], ['2', '2 a second'], ['4', '4 a second'], ['8', '8 a second'], ['16', '16 a second'], ['rt', 'real time']].map(function (o) { return '<option value="' + o[0] + '"' + (o[0] === speedPref() ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select>' +
      '<input type="range" class="ov-fr" min="0" max="' + (NF - 1) + '" value="' + (keep.frame != null ? keep.frame : Math.min(NF - 1, Math.round(NF * 0.1))) + '"><span class="hint ov-fcap"></span></div>' +
      '<div class="ov-flame"></div><p class="hint">Each bar is a routine, from its call to its return, under the routine that called it; the scale is the same for every frame, and a line marks where this one ends. Grey is the main loop using up the rest of the frame’s time (count \\mtc); when the frame’s work takes longer, there is no wait and the frame runs long.</p>' + snapLine + '</section>');

    // where the time goes
    var rows = Object.keys(A.ex).map(function (e) { return { e: e, ex: A.ex[e], inc: e === 'main' ? A.total : e === 'wait' ? A.ex[e] : (A.inc[e] || A.ex[e]) }; })
      .filter(function (r) { return r.ex > 0; }).sort(function (x, y) { return y.ex - x.ex; });
    h.push('<section class="ov-box"><h4>Where each frame’s time goes <span class="faint">(a frame is about ' + cyc(avgLen) + ')</span>' + icons('budget', true) + '</h4><div class="ov-budget">' +
      rows.map(function (r) {
        var pc = 100 * r.ex / A.total;
        return '<div class="ov-brow" data-e="' + SW.esc(String(r.e)) + '"><span class="ov-bnm mono">' + SW.esc(nm(r.e)) + '</span><span class="ov-bar"><i style="width:' + Math.max(0.3, pc).toFixed(2) + '%;background:' + colour(nm(r.e)) + '"></i></span>' +
          '<span class="ov-bv">' + pc.toFixed(1) + '%</span><span class="ov-bv faint">' + Math.round(r.ex / NF).toLocaleString('en-GB') + ' a frame' + (r.inc > r.ex * 1.05 && r.e !== 'main' ? ', ' + Math.round(r.inc / NF).toLocaleString('en-GB') + ' with its calls' : '') + '</span></div>';
      }).join('') + '</div><p class="hint">Cycles spent in each routine itself, per frame on average; “with its calls” adds the routines it calls.</p></section>');

    // data flow
    var T0 = tableFields(b), what = classify(b, A, T0), groups = { field: {}, var: {}, code: {}, data: {} };
    Object.keys(A.flow).forEach(function (a) {
      var c = what(+a); if (!groups[c.kind]) return;
      var g = groups[c.kind][c.key] = groups[c.kind][c.key] || { key: c.key, c: c, r: {}, w: {}, objs: {} };
      if (c.kind === 'field') g.objs[c.obj] = 1;
      ['r', 'w'].forEach(function (rw) { var src = A.flow[a][rw]; Object.keys(src).forEach(function (k) { g[rw][k] = (g[rw][k] || 0) + src[k]; }); });
    });
    O.lastFlow = { groups: groups };
    function whoList(m) {
      return Object.keys(m).sort(function (x, y) { return m[y] - m[x]; }).map(function (k) { return link(k) + ' <span class="faint">' + rate(m[k]) + '</span>'; }).join(', ');
    }
    function flowRows(kind, label) {
      var gs = Object.keys(groups[kind]).map(function (k) { return groups[kind][k]; });
      if (kind === 'code') gs = gs.filter(function (g) { return Object.keys(g.w).length; });
      gs.sort(function (x, y) { return kind === 'field' ? (x.c.f.base - y.c.f.base) : String(x.key).localeCompare(String(y.key)); });
      return gs.map(function (g) {
        var nmx, extra = '';
        if (kind === 'field') { nmx = link(g.key === 'ml1' ? 'mtb' : 'n' + g.key.slice(1), g.key) ; extra = SW.esc(g.c.f.what || ''); }
        else if (kind === 'code') { var at = lineAt(b, +g.key); nmx = '<span class="mono">' + SW.esc(name(b, +g.key)) + '</span>'; extra = at && at.L ? '<span class="mono">' + SW.esc(at.L.raw.replace(/\t/g, ' ').trim()) + '</span>' : ''; }
        else { nmx = '<span class="mono">' + SW.esc(g.key) + '</span>'; extra = glossVar(g.key); }
        return '<tr><td>' + nmx + '</td><td class="ov-g">' + extra + '</td><td>' + (whoList(g.w) || '<span class="faint">none</span>') + '</td>' + (kind === 'code' ? '' : '<td>' + (whoList(g.r) || '<span class="faint">none</span>') + '</td>') + '</tr>';
      }).join('');
    }
    function glossVar(k) { var s0 = b.sym[k], d = s0 && ((s0.defs && s0.defs[0]) || (s0.refs && s0.refs[0])); if (!d || !b.lines[d.file]) return ''; return SW.esc(commentOf(b.lines[d.file][d.line - 1].raw)); }
    h.push('<section class="ov-box"><h4>Data flow <span class="faint">(reads and writes a frame, by routine)</span>' + icons('flow') + '</h4>' +
      '<details open><summary>The object table, by field</summary><table class="ov-sub"><thead><tr><th>Field</th><th>The program’s comment</th><th>Written by</th><th>Read by</th></tr></thead><tbody>' + flowRows('field') + '</tbody></table></details>' +
      '<details><summary>Variables</summary><table class="ov-sub"><thead><tr><th>Variable</th><th>A comment where it is used</th><th>Written by</th><th>Read by</th></tr></thead><tbody>' + flowRows('var') + '</tbody></table></details>' +
      '<details><summary>Instructions rewritten while the program runs</summary><p class="hint">Words the program both runs and writes: return addresses set by dap, pointers stepped by idx, calls aimed at the next object.</p><table class="ov-sub"><thead><tr><th>Where</th><th>The line</th><th>Written by</th></tr></thead><tbody>' + flowRows('code') + '</tbody></table></details>' +
      '<p class="hint">Numbers are reads or writes a frame, averaged over the run; literals (constants) are left out. Reading a pointer to reach the table counts as a read of the pointer as well.</p></section>');

    // start-up
    var su = A.R.startup;
    h.push('<section class="ov-box"><h4>Start-up <span class="faint">(once, from ' + SW.oct(A.start, 4) + ')</span></h4>' +
      '<p class="ov-path mono">' + A.path.map(function (a) { return link(a); }).join(' → ') + (A.frameAt >= 0 ? ' → ' + link(A.frameAt) : '') + '</p>' +
      (su ? '<p class="hint">Calls:</p>' + callsOf('startup', 0, ['startup']) : '') + '</section>');
    // the main loop
    var siteList = Object.keys(A.sites).map(function (k) { return A.sites[k]; }).sort(function (x, y) { return x.pc - y.pc; });
    var mainName = A.frameAt >= 0 ? link(A.frameAt) : 'the main loop';
    var items = siteList.map(function (s) {
      var tos = Object.keys(s.to), at = lineAt(b, s.pc), c = at && at.L ? commentOf(at.L.raw) : '';
      var dispatch = tos.length > 1 || A.cpu.writeCount[s.pc] > 0;
      if (dispatch) {
        return '<li class="ov-dispatch"><b>Each object’s own routine</b>, from the object table <span class="faint">(the ' + (s.jump ? 'jump' : 'call') + ' at ' + SW.oct(s.pc, 4) + ' is rewritten for each object' + (c ? '; “' + SW.esc(c) + '”' : '') + ')</span>' +
          '<div class="ov-objs">' + tos.sort(function (x, y) { return +x - +y; }).map(function (k) {
            var g = glossAt(b, k);
            return '<div class="ov-obj"><div>' + link(k) + ' <span class="faint">' + per(s.to[k]) + '</span></div>' + (g ? '<div class="ov-g">' + SW.esc(g) + '</div>' : '') + callsOf(k, 1, [k]) + '</div>';
          }).join('') + '</div></li>';
      }
      var k = tos[0], g = glossAt(b, k);
      return '<li>' + link(k) + ' <span class="faint">' + per(s.to[k]) + '</span>' + (c ? ' <span class="ov-g">' + SW.esc(c) + '</span>' : g ? ' <span class="ov-g">' + SW.esc(g) + '</span>' : '') + callsOf(k, 1, [k]) + '</li>';
    });
    if (Object.keys(A.waitAt).length) items.push('<li>' + link('wait') + ' <span class="ov-g">use up rest of time of main loop</span></li>');
    h.push('<section class="ov-box ov-main"><h4>Each frame: ' + mainName + '</h4><ol class="ov-steps">' + items.join('') +
      '<li class="faint">back to ' + mainName + '</li></ol></section>');
    // subroutines
    var subs = Object.keys(A.R).filter(function (e) { var r = A.R[e]; return e !== 'main' && e !== 'startup' && r.n && !Object.keys(r.callers).every(function (c) { return c === 'main'; }); });
    subs.sort(function (x, y) { return A.R[y].n - A.R[x].n; });
    h.push('<section class="ov-box"><h4>Subroutines' + icons('subs') + '</h4><table class="ov-sub"><thead><tr><th>Routine</th><th>Calls</th><th>Called from</th><th>The program’s comment</th></tr></thead><tbody>' +
      subs.map(function (e) {
        var r = A.R[e];
        return '<tr><td>' + link(e) + '</td><td class="num">' + (r.startup === r.n ? r.n + ' at start-up' : per(r.n - r.startup)) + '</td><td>' +
          Object.keys(r.callers).map(function (c) { return link(c); }).join(', ') + '</td><td class="ov-g">' + SW.esc(glossAt(b, e)) + '</td></tr>';
      }).join('') + '</tbody></table></section>');
    // the object table
    var T = tableFields(b);
    if (T) h.push('<section class="ov-box"><h4>The object table <span class="faint">(' + (T.nob != null ? T.nob + ' objects (nob, octal ' + T.nob.toString(8) + '), ' : '') + 'as the main loop sets its pointers; words in decimal)</span>' + icons('table') + '</h4><table class="ov-sub"><thead><tr><th>Field</th><th>Words</th><th>The program’s comment</th></tr></thead><tbody>' +
      T.fields.map(function (f) { return '<tr><td><a href="#" class="ov-nm mono" data-p="' + f.p + '" data-n="' + f.n + '">' + SW.esc(f.field) + '</a></td><td class="num">' + (f.size == null ? '' : f.size) + '</td><td class="ov-g">' + SW.esc(f.what) + '</td></tr>'; }).join('') + '</tbody></table></section>');

    el.innerHTML = '<div class="ov-top"><div class="ov-scope"><canvas width="720" height="720"></canvas><div class="ov-scapline"><p class="hint ov-scap"></p>' + icons('screen', true) + '</div></div>' + frameBox + '</div>' +
      '<section class="ov-box ov-panel"><div class="ov-insp"></div></section>' +
      '<div class="ov-rest">' + h.join('') + '</div>';
    var insp = SW.$('.ov-insp', el), scv = SW.$('.ov-scope canvas', el), sg = scv.getContext('2d'), scap = SW.$('.ov-scap', el), picked = null, hovered = null, shownFrame = 0;
    // the screen in the frame shown: its points bright, the frame before faint
    // (the phosphor's glow), a chosen routine's points in its colour
    function scope(i) {
      shownFrame = i;
      var N = scv.width, R = N / 2, k = N / 1024, hi = hovered != null ? String(hovered) : picked != null ? String(picked) : null;
      sg.fillStyle = '#000'; sg.fillRect(0, 0, N, N);
      sg.save(); sg.beginPath(); sg.arc(R, R, R - 2, 0, 6.2832); sg.fillStyle = '#02050a'; sg.fill(); sg.clip();
      function pass(f, alpha, bright) {
        if (!f) return 0;
        var n = 0, P = f.pts;
        for (var j = 0; j < P.length; j += 3) {
          var own = hi != null && String(P[j + 2]) === hi, px = R + P[j] * k, py = R - P[j + 1] * k;
          if (own && bright) { sg.fillStyle = colour(nm(P[j + 2])); sg.globalAlpha = 1; sg.beginPath(); sg.arc(px, py, 3.2, 0, 6.2832); sg.fill(); n++; }
          else { sg.fillStyle = '#cfe6ff'; sg.globalAlpha = alpha * (hi != null && bright ? 0.55 : 1); sg.fillRect(px - 1.1, py - 1.1, 2.2, 2.2); }
        }
        sg.globalAlpha = 1;
        return n;
      }
      pass(FL[i - 1], 0.28, false);
      var nHi = pass(FL[i], 1, true);
      sg.restore();
      sg.strokeStyle = '#3a5068'; sg.lineWidth = 3; sg.beginPath(); sg.arc(R, R, R - 2, 0, 6.2832); sg.stroke();
      var f = FL[i];
      scap.textContent = f ? 'Frame ' + (i + 1) + ' · ' + (f.pts.length / 3) + ' points' + (hi != null ? ' · ' + nm(hi) + (!runsIn(hi, i) ? ' not in this frame' : ' ' + nHi) : '') : '';
    }

    // ---------- the flame chart ----------
    var fl = SW.$('.ov-flame', el), fr = SW.$('.ov-fr', el), fcap = SW.$('.ov-fcap', el), playT = null;
    // one scale for every frame: the longest frame across, the deepest down, so
    // frames can be compared and the chart keeps still as they change
    var maxLen = 1, maxDepth = 0, ranIn = {};
    FL.forEach(function (f, n) { f.spans.forEach(function (sp) { var k = String(sp.e); (ranIn[k] = ranIn[k] || []); if (ranIn[k][ranIn[k].length - 1] !== n) ranIn[k].push(n); }); });
    function runsIn(e, i) { var l = ranIn[String(e)]; return !l || e === 'main' || l.indexOf(i) >= 0; }
    function ranges(l) { var out = [], a = null, p = null; l.forEach(function (n) { if (a === null) { a = p = n; } else if (n === p + 1) p = n; else { out.push(a === p ? String(a + 1) : (a + 1) + '–' + (p + 1)); a = p = n; } }); if (a !== null) out.push(a === p ? String(a + 1) : (a + 1) + '–' + (p + 1)); return out.join(', '); }
    // (the first frame, which runs long as the game begins, is left out of the scale and may run off the edge)
    FL.forEach(function (f, n) { if (n || FL.length === 1) maxLen = Math.max(maxLen, f.len); f.spans.forEach(function (sp) { maxDepth = Math.max(maxDepth, sp.d); }); });
    function chart(i) {
      var f = FL[i]; if (!f) { fl.innerHTML = '<p class="hint">No frames in this snapshot.</p>'; return; }
      var W = Math.max(300, fl.clientWidth || 700), RH = 20, depth = maxDepth;
      var H = (depth + 1) * RH + 26, len = f.len || 1, sc = maxLen;
      var o = ['<svg width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '" class="ov-fsvg">'];
      f.spans.forEach(function (sp, n) {
        var t1 = sp.t1 == null ? len : sp.t1, x = W * sp.t0 / sc, w = Math.max(0.8, W * (t1 - sp.t0) / sc), y = sp.d * RH, nmx = nm(sp.e);
        o.push('<g data-e="' + SW.esc(String(sp.e)) + '" class="ov-sp"><rect x="' + x.toFixed(1) + '" y="' + y + '" width="' + w.toFixed(1) + '" height="' + (RH - 2) + '" fill="' + colour(nmx) + '"><title>' + SW.esc(nmx + ': ' + cyc(t1 - sp.t0) + ', from cycle ' + sp.t0 + ' of the frame') + '</title></rect>' +
          (w > 34 ? '<text x="' + (x + 3).toFixed(1) + '" y="' + (y + RH - 7) + '" class="ov-spt">' + SW.esc(nmx) + '</text>' : '') + '</g>');
      });
      for (var tk = 0; tk <= 4; tk++) { var tx = W * tk / 4; o.push('<text x="' + Math.min(W - 60, tx + 2) + '" y="' + (H - 6) + '" class="ov-tick">' + Math.round(sc * tk / 4).toLocaleString('en-GB') + '</text><line x1="' + tx + '" x2="' + tx + '" y1="' + (H - 22) + '" y2="' + (H - 16) + '" class="ov-tl"/>'); }
      var ex0 = W * len / sc;   // where this frame ends
      o.push('<line x1="' + ex0.toFixed(1) + '" x2="' + ex0.toFixed(1) + '" y1="0" y2="' + (H - 22) + '" class="ov-fend"/>');
      o.push('</svg>');
      fl.innerHTML = o.join('');
      var wait = f.spans.filter(function (sp) { return sp.e === 'wait'; }).reduce(function (a, sp) { return a + ((sp.t1 == null ? len : sp.t1) - sp.t0); }, 0);
      var objs = f.spans.filter(function (sp) { return sp.d === 0 && sp.e !== 'wait'; }).map(function (sp) { return nm(sp.e); });
      scope(i); values(); keep.frame = i;
      fcap.textContent = 'frame ' + (i + 1) + ' of ' + NF + ' · ' + cyc(len) + ' · waiting ' + Math.round(100 * wait / len) + '% · ' + A.phases[f.phase].what;
      fcap.title = 'Called from the main loop, in order: ' + objs.join(', ');
    }
    fr.addEventListener('input', function () { chart(+fr.value); });
    SW.$('.ov-speed', el).addEventListener('change', function (e) { speedPref(e.target.value); });
    el.addEventListener('mouseover', function (ev) { var x = ev.target.closest('.ov-sp, .ov-brow'); var e2 = x ? x.dataset.e : null; if (e2 !== hovered) { hovered = e2; scope(shownFrame); } });
    var rsz = new ResizeObserver(function () { if (!fl.isConnected) { rsz.disconnect(); return; } chart(+fr.value); });
    rsz.observe(fl);
    SW.$('.ov-fctl', el).addEventListener('click', function (e) {
      var t = e.target.closest('[data-f]'); if (!t) return;
      if (t.dataset.f === 'play') {
        if (playT) { clearTimeout(playT); playT = null; t.textContent = '▶ Play'; return; }
        t.textContent = '❚❚ Pause';
        (function step() {
          if (!fl.isConnected) return;
          if (!fl.offsetParent) { playT = null; t.textContent = '▶ Play'; return; }   // paused when the page is left
          fr.value = (+fr.value + 1) % NF; chart(+fr.value);
          var sp = SW.$('.ov-speed', el).value, f = FL[+fr.value];
          playT = setTimeout(step, sp === 'rt' ? Math.max(16, (f ? f.len : 10000) * US / 1000) : 1000 / +sp);
        })();
        return;
      }
      fr.value = Math.max(0, Math.min(NF - 1, +fr.value + (t.dataset.f === 'next' ? 1 : -1))); chart(+fr.value);
    });
    chart(+fr.value);

    // ---------- values: what the chosen routine reads and writes, as the frame
    // shown begins and ends (memory kept at each frame boundary) ----------
    function signed(v) { return v & 0o400000 ? -((~v) & 0o377777) : v; }   // ones' complement
    // short names for the object table's fields, by their pointers (the same in every version)
    var FIELD = { ml1: 'routine', mx1: 'x', my1: 'y', mdx: 'dx', mdy: 'dy', mth: 'angle', mom: 'turn rate', mfu: 'fuel', mtr: 'torpedoes', ma1: 'count', mb1: 'time', mot: 'outline', mco: 'old control' };
    function fieldName(c) { return FIELD[c.key] || (c.f.what && c.f.what.length < 14 ? c.f.what : c.key); }
    function objName(n) { return n === 0 ? 'first ship' : n === 1 ? 'second ship' : 'object ' + (n + 1); }
    function values() {
      var box = SW.$('.ov-vals', insp); if (!box || picked == null) return;
      var e = String(picked), i = shownFrame, s0 = A.snaps[i], s1 = A.snaps[i + 1];
      if (!s0 || !s1) { box.innerHTML = ''; return; }
      var rows = [];
      Object.keys(A.flow).forEach(function (a) {
        var fl0 = A.flow[a], n = (fl0.r[e] || 0) + (fl0.w[e] || 0); if (!n) return;
        var c = what(+a); if (c.kind !== 'var' && c.kind !== 'field' && c.kind !== 'data') return;
        rows.push({ a: +a, c: c, n: n, w: !!fl0.w[e] });
      });
      // the key ones: the object table's fields first, then what it writes, then the most used
      rows.sort(function (x, y) { return (y.c.kind === 'field') - (x.c.kind === 'field') || y.w - x.w || y.n - x.n; });
      rows = rows.slice(0, 10);
      box.innerHTML = rows.length ? '<table class="ov-vt"><thead><tr><th>Frame ' + (i + 1) + '</th><th>begins</th><th>ends</th></tr></thead><tbody>' + rows.map(function (r) {
        var v0 = s0[r.a], v1 = s1[r.a], xy = r.c.kind === 'field' && /^m[xy]1$/.test(r.c.key);
        var lab = r.c.kind === 'field' ? fieldName(r.c) + (r.c.obj < 2 ? '' : ' ' + (r.c.obj + 1)) : String(r.c.key);
        var a0 = xy ? signed(v0) >> 8 : signed(v0), a1 = xy ? signed(v1) >> 8 : signed(v1);
        var tip = (r.c.kind === 'field' ? r.c.key + ', ' + objName(r.c.obj) + ': ' : '') + SW.oct(v0, 6) + ' → ' + SW.oct(v1, 6) + (xy ? ' (screen position: the top ten bits)' : '');
        return '<tr' + (a0 !== a1 ? ' class="ch"' : '') + ' title="' + SW.esc(tip) + '"><td>' + SW.esc(lab) + '</td><td>' + a0 + '</td><td>' + a1 + '</td></tr>';
      }).join('') + '</tbody></table>' : '';
    }

    // ---------- the inspector ----------
    var entries = Object.keys(A.R).filter(function (e) { return /^\d+$/.test(e); }).map(Number).concat([A.frameAt, A.start]).sort(function (x, y) { return x - y; });
    function codeOf(e) {   // the source lines from the entry to the next entry
      var a0 = e === 'main' ? A.frameAt : e === 'wait' ? +Object.keys(A.waitAt)[0] : +e;
      var a1 = e === 'main' ? A.loopEnd + 1 : e === 'wait' ? a0 + 1 : (entries.filter(function (x) { return x > a0; })[0] || a0 + 0o100);
      var q0 = b.srcOf(a0); if (!q0) return null;
      var n0 = q0.n, n1 = q0.n;
      for (var a = a0; a < Math.min(a1, a0 + 0o300); a++) { var q = b.srcOf(a); if (q && q.p === q0.p) { n0 = Math.min(n0, q.n); n1 = Math.max(n1, q.n); } }
      return { p: q0.p, n0: n0, n1: Math.min(n1, n0 + 79), cut: n1 > n0 + 79 };
    }
    // the routines visited in the panel, for back and forward
    var hist = keep.hist, hpos = keep.hpos;
    function inspect(e, nav) {
      if (e === 'startup') return;
      e = String(e);
      if (!nav) { if (hist[hpos] !== e) { hist = hist.slice(0, hpos + 1); hist.push(e); hpos = hist.length - 1; } }
      keep.hist = hist; keep.hpos = hpos;
      var r = A.R[e] || { n: 0, calls: {}, callers: {}, startup: 0 }, g = e === 'wait' ? 'use up rest of time of main loop' : e === 'main' ? glossAt(b, A.frameAt) : glossAt(b, e);
      var callsN = r.n - (r.startup || 0), exN = A.ex[e] || 0, incN = e === 'main' ? A.total : (A.inc[e] || exN);
      var st = [];
      if (callsN) st.push(per(callsN));
      if (r.startup) st.push(r.startup + ' at start-up');
      if (exN) st.push(Math.round(exN / NF).toLocaleString('en-GB') + ' cycles a frame' + (incN > exN * 1.05 ? ' (' + Math.round(incN / NF).toLocaleString('en-GB') + ' with its calls)' : '') + ', ' + (100 * incN / A.total).toFixed(1) + '% of the frame');
      if (callsN && incN) st.push(Math.round(incN / callsN).toLocaleString('en-GB') + ' a call');
      if (ranIn[e] && ranIn[e].length < NF) st.push('frames ' + ranges(ranIn[e]));
      var cd = e === 'rt' ? null : codeOf(e);
      var navh = '<div class="ov-hist"><button class="btn ghost" data-hnav="-1" title="' + (hpos > 0 ? 'Back to ' + SW.esc(nm(hist[hpos - 1])) : 'Back') + '"' + (hpos > 0 ? '' : ' disabled') + '>←</button><button class="btn ghost" data-hnav="1" title="' + (hpos < hist.length - 1 ? 'Forward to ' + SW.esc(nm(hist[hpos + 1])) : 'Forward') + '"' + (hpos < hist.length - 1 ? '' : ' disabled') + '>→</button>' +
        '</div>';
      var hh = ['<div class="ov-phead"><div><div class="ov-ptitle">' + navh + '<h4 class="mono">' + SW.esc(nm(e)) + (/^\d+$/.test(e) ? ' <span class="faint">' + SW.oct(+e, 4) + '</span>' : '') + (g ? ' <span class="ov-g">' + SW.esc(g) + '</span>' : '') + '</h4></div>' +
        '<p class="ov-pstat">' + st.map(SW.esc).join(' · ') + '</p></div>' + '<div class="ov-phact">' + icons('panel', true) + (cd ? '<button class="btn ghost" data-read="' + cd.p + ':' + cd.n0 + '">Open in Read ▸</button>' : '') + '</div></div>'];
      // values | code | relations
      hh.push('<div class="ov-pvals"><div class="ov-vals"></div></div>');
      hh.push('<div class="ov-pcode">');
      if (e === 'rt') hh.push('<p class="hint">Code written by the outline compiler (oc) at start-up, so it has no source lines: in Read it shows as run-time code.</p>');
      if (cd) {
        var ls = b.lines[cd.p];
        hh.push('<div class="ov-code mono">' + ls.slice(cd.n0 - 1, cd.n1).map(function (L) { return '<div><span class="faint">' + String(L.n).padStart(4) + '</span>  <span class="t">' + (SW.hlLine ? SW.hlLine(L.raw, b) : SW.esc(L.raw)) + '</span></div>'; }).join('') + (cd.cut ? '<div class="faint">…</div>' : '') + '</div>');
      }
      hh.push('</div><div class="ov-prel">');
      var cs = Object.keys(r.callers || {});
      if (cs.length) hh.push('<p><b>Called from</b> ' + cs.map(function (c0) { return link(c0); }).join(', ') + '</p>');
      var ks = Object.keys(r.calls || {}).sort(function (x, y) { return r.calls[y] - r.calls[x]; });
      if (ks.length) hh.push('<p><b>Calls</b> ' + ks.map(function (k) { return link(k) + '<span class="faint">×' + (r.n ? Math.round(10 * r.calls[k] / r.n) / 10 : r.calls[k]) + '</span>'; }).join(' ') + '</p>');
      // what it reads and writes, a frame
      var rs = {}, ws = {};
      Object.keys(A.flow).forEach(function (a) {
        var c = what(+a); if (c.kind === 'const' || c.kind === 'other') return;
        var key = c.kind === 'field' ? fieldName(c) : c.kind === 'code' ? name(b, +a) + ' ⚙' : c.key;
        var fr0 = A.flow[a];
        if (fr0.r[e]) rs[key] = (rs[key] || 0) + fr0.r[e];
        if (fr0.w[e]) ws[key] = (ws[key] || 0) + fr0.w[e];
      });
      function rwTable(m, title) {
        var ks2 = Object.keys(m).sort(function (x, y) { return m[y] - m[x]; });
        if (!ks2.length) return '';
        return '<table class="ov-rw"><thead><tr><th>' + title + '</th><th>a frame</th></tr></thead><tbody>' + ks2.slice(0, 12).map(function (k) { return '<tr><td>' + SW.esc(k) + '</td><td>' + rate(m[k]) + '</td></tr>'; }).join('') +
          (ks2.length > 12 ? '<tr><td class="faint" colspan="2">and ' + (ks2.length - 12) + ' more</td></tr>' : '') + '</tbody></table>';
      }
      hh.push('<div class="ov-rwpair">' + rwTable(ws, 'Writes') + rwTable(rs, 'Reads') + '</div><p class="hint">⚙ an instruction the program rewrites.</p></div>');
      insp.innerHTML = hh.join('');
      // symbols in the code that name a routine open it here
      SW.$$('.ov-code .sym[data-s]', insp).forEach(function (sp) { var s0 = b.sym[sp.dataset.s]; if (s0 && A.R[String(s0.val)] && String(s0.val) !== e) { sp.classList.add('go'); sp.dataset.e = String(s0.val); } });
      picked = e;
      // to watch it, the chart goes to the nearest frame in which it runs
      var l = ranIn[String(e)];
      if (l && l.length && l.indexOf(shownFrame) < 0) {
        var best = l.reduce(function (a, n) { return Math.abs(n - shownFrame) < Math.abs(a - shownFrame) ? n : a; }, l[0]);
        fr.value = best; chart(best);
      } else { scope(shownFrame); values(); }
      SW.$$('.ov-sp', fl).forEach(function (gg) { gg.classList.toggle('on', gg.dataset.e === String(e)); });
      SW.$$('.ov-brow', el).forEach(function (rw) { rw.classList.toggle('on', rw.dataset.e === String(e)); });
      var pr = insp.getBoundingClientRect(); if (pr.bottom < 60 || pr.top > window.innerHeight - 60) insp.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
    // ---------- figures and notes from the panels ----------
    function svgWrap(W, H, pal, body) { return '<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '">' + (pal.bg ? '<rect width="' + W + '" height="' + H + '" fill="' + pal.bg + '"/>' : '') + body + '</svg>'; }
    function screenSVG(pal) {
      var N = 520, R = N / 2, k = N / 1024, hi = picked != null ? String(picked) : null, o = ['<circle cx="' + R + '" cy="' + R + '" r="' + (R - 2) + '" fill="#02050a" stroke="#3a5068" stroke-width="3"/>'];
      [[FL[shownFrame - 1], 0.28], [FL[shownFrame], 1]].forEach(function (pr) {
        var f = pr[0]; if (!f) return;
        for (var j = 0; j < f.pts.length; j += 3) {
          var own = pr[1] === 1 && hi != null && String(f.pts[j + 2]) === hi, x = R + f.pts[j] * k, y = R - f.pts[j + 1] * k;
          o.push(own ? '<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="3" fill="' + colour(nm(f.pts[j + 2])) + '"/>' : '<rect x="' + (x - 1.1).toFixed(1) + '" y="' + (y - 1.1).toFixed(1) + '" width="2.2" height="2.2" fill="#cfe6ff" opacity="' + pr[1] + '"/>');
        }
      });
      return svgWrap(N, N, { bg: '#000' }, o.join(''));
    }
    function playerSVG(pal) {
      var f = FL[shownFrame]; if (!f) return svgWrap(10, 10, pal, '');
      var W = 1000, RH = 20, H = (maxDepth + 1) * RH + 28, sc = maxLen, len = f.len || 1, o = [];
      f.spans.forEach(function (sp) {
        var t1 = sp.t1 == null ? len : sp.t1, x = W * sp.t0 / sc, w = Math.max(0.8, W * (t1 - sp.t0) / sc), y = sp.d * RH, n0 = nm(sp.e);
        o.push('<rect x="' + x.toFixed(1) + '" y="' + y + '" width="' + w.toFixed(1) + '" height="' + (RH - 2) + '" fill="' + colour(n0) + '"/>' + (w > 34 ? '<text x="' + (x + 3).toFixed(1) + '" y="' + (y + RH - 7) + '" font-family="monospace" font-size="11" fill="#fff">' + SW.esc(n0) + '</text>' : ''));
      });
      for (var tk = 0; tk <= 4; tk++) o.push('<text x="' + Math.min(W - 60, W * tk / 4 + 2) + '" y="' + (H - 6) + '" font-family="monospace" font-size="10" fill="' + (pal.dim || '#888') + '">' + Math.round(sc * tk / 4).toLocaleString('en-GB') + '</text>');
      var ex0 = W * len / sc; o.push('<line x1="' + ex0 + '" x2="' + ex0 + '" y1="0" y2="' + (H - 22) + '" stroke="' + (pal.dim || '#888') + '" stroke-dasharray="3 3"/>');
      return svgWrap(W, H, pal, o.join(''));
    }
    function budgetSVG(pal) {
      var W = 760, RH = 20, o = [];
      rows.forEach(function (r, n) {
        var pc = 100 * r.ex / A.total, y = n * RH;
        o.push('<text x="0" y="' + (y + 14) + '" font-family="monospace" font-size="12" fill="' + (pal.ink || '#ddd') + '">' + SW.esc(nm(r.e)) + '</text>' +
          '<rect x="110" y="' + (y + 5) + '" width="' + (4.4 * Math.max(0.3, pc)).toFixed(1) + '" height="10" fill="' + colour(nm(r.e)) + '"/>' +
          '<text x="' + (120 + 4.4 * pc).toFixed(1) + '" y="' + (y + 14) + '" font-family="monospace" font-size="11" fill="' + (pal.dim || '#999') + '">' + pc.toFixed(1) + '%</text>');
      });
      return svgWrap(W, rows.length * RH + 4, pal, o.join(''));
    }
    // the data panel as an image: header, then values | code | calls, writes and reads
    function panelSVG(pal) {
      var ink = pal.ink || '#dde', dim = pal.dim || '#8a9', acc = pal.accent || '#fc6', e = String(picked), o = [], W = 1200, y0 = 64;
      function tx(x, y, t, sz, col, anchor, weight) { return '<text x="' + x + '" y="' + y + '" font-family="monospace" font-size="' + (sz || 12) + '" fill="' + (col || ink) + '"' + (anchor ? ' text-anchor="' + anchor + '"' : '') + (weight ? ' font-weight="' + weight + '"' : '') + ' xml:space="preserve">' + SW.esc(t) + '</text>'; }
      o.push(tx(16, 26, nm(e) + (/^\d+$/.test(e) ? '  ' + SW.oct(+e, 4) : '') + '   ' + glossAt(b, e), 17, ink, null, 700));
      o.push(tx(16, 46, vshort + ' · frame ' + (shownFrame + 1) + ' · ' + (SW.$('.ov-pstat', insp) ? SW.$('.ov-pstat', insp).textContent : ''), 11.5, dim));
      var rows0 = SW.$$('.ov-vt tbody tr', insp).map(function (tr) { return SW.$$('td', tr).map(function (x) { return x.textContent.trim(); }).concat([tr.classList.contains('ch')]); });
      o.push(tx(16, y0 + 12, 'Frame ' + (shownFrame + 1), 11, dim) + tx(250, y0 + 12, 'begins', 11, dim, 'end') + tx(330, y0 + 12, 'ends', 11, dim, 'end'));
      rows0.forEach(function (r, n) { var yy = y0 + 32 + n * 18, c0 = r[3] ? acc : ink; o.push(tx(16, yy, r[0], 12, c0) + tx(250, yy, r[1], 12, c0, 'end') + tx(330, yy, r[2], 12, c0, 'end')); });
      var cd = e === 'rt' ? null : codeOf(e), cl = cd ? b.lines[cd.p].slice(cd.n0 - 1, cd.n1) : [];
      cl.slice(0, 40).forEach(function (L, n) { o.push(tx(360, y0 + 12 + n * 16, String(L.n).padStart(4) + '  ' + L.raw.replace(/\t/g, '        ').replace(/^(.{0,70}).*$/, '$1'), 11.5, n === 0 ? ink : ink)); });
      var rl = SW.$$('.ov-rw', insp), xr = 900;
      var calls = Object.keys((A.R[e] || {}).calls || {});
      o.push(tx(xr, y0 + 12, 'Calls ' + calls.map(function (k) { return nm(k); }).join(' '), 11.5, ink));
      rl.forEach(function (t, col) {
        var x0 = xr + col * 150;
        SW.$$('tr', t).slice(0, 14).forEach(function (tr, n) { var cs = SW.$$('th, td', tr).map(function (x) { return x.textContent.trim(); }); o.push(tx(x0, y0 + 36 + n * 16, cs[0] || '', 11.5, n ? ink : dim) + tx(x0 + 135, y0 + 36 + n * 16, cs[1] || '', 11.5, n ? ink : dim, 'end')); });
      });
      var H = y0 + 20 + Math.max(rows0.length * 18 + 20, Math.min(40, cl.length) * 16, 15 * 16 + 30);
      return svgWrap(W, H, pal, o.join(''));
    }
    function tableBlocks(box) {   // the tables in a panel, as the page shows them
      return SW.$$('table', box).map(function (t) {
        var head = SW.$$('thead th', t).map(function (x) { return x.textContent.trim(); });
        return SW.tableBlock(t.closest('details') ? SW.$('summary', t.closest('details')).textContent : '', head, SW.$$('tbody tr', t).map(function (tr) { return SW.$$('td', tr).map(function (x) { return x.textContent.trim(); }); }));
      });
    }
    function boxOf(k) { return SW.$('[data-k="' + k + '"]', el).closest('section'); }
    var FIG = { panel: { svg: panelSVG, name: function () { return fileBase + '-' + SW.slug(nm(String(picked))) + '-frame-' + (shownFrame + 1); } },
                screen: { svg: screenSVG, name: function () { return fileBase + '-screen-frame-' + (shownFrame + 1); } },
                player: { svg: playerSVG, name: function () { return fileBase + '-frame-' + (shownFrame + 1) + '-calls'; } },
                budget: { svg: budgetSVG, name: function () { return fileBase + '-frame-time'; } } };
    function docOf(k) {
      var base = { title: '', subtitle: vshort + ', functional overview; ' + A.phases.map(function (P) { return P.what; }).join(', then '), blocks: [] };
      if (k === 'panel') {
        var e = String(picked), cd = e === 'rt' ? null : codeOf(e);
        base.title = nm(e) + ', frame ' + (shownFrame + 1) + ' (' + vshort + ')';
        base.blocks.push({ type: 'p', text: [glossAt(b, e), SW.$('.ov-pstat', insp) ? SW.$('.ov-pstat', insp).textContent : ''].filter(Boolean).join('. ') });
        base.blocks = base.blocks.concat(tableBlocks(SW.$('.ov-pvals', insp)), tableBlocks(SW.$('.ov-prel', insp)));
        if (cd) base.blocks.push({ type: 'code', caption: SW.cite(b, cd.p, cd.n0, cd.n1), lines: b.lines[cd.p].slice(cd.n0 - 1, cd.n1).map(function (L) { return { n: L.n, addr: '', word: '', text: L.raw }; }) });
        return base;
      }
      var titles = { flow: 'Data flow', subs: 'Subroutines', table: 'The object table' };
      base.title = titles[k] + ' (' + vshort + ')';
      base.blocks = tableBlocks(boxOf(k));
      return base;
    }
    function iconAct(btn) {
      var k = btn.dataset.k, act = btn.dataset.ic, F0 = FIG[k];
      if (act === 'svg' && F0) root.SWExport.download(F0.name() + '.svg', SW.exportSVG(F0.svg(SW.exportPalette())), 'image/svg+xml');
      else if (act === 'png' && F0) {
        SW.toast('Rendering PNG…');
        SW.figures.svgToPNG(SW.exportSVG(F0.svg(SW.exportPalette())), 3, SW.figBgColour()).then(function (r) { root.SWExport.download(F0.name() + '.png', r.png, 'image/png'); }, function () { SW.toast('The PNG could not be made; try SVG.', 5000); });
      }
      else if (act === 'note' && SW.tray) {   // figures go in as images (the data panel too, whole); the tables as tables
        if (F0) SW.tray.addFigure(F0.svg(SW.exportPalette()), k === 'panel' ? nm(String(picked)) + ', frame ' + (shownFrame + 1) + ' (' + vshort + ')' : F0.name());
        else SW.tray.addDoc(docOf(k));
      }
    }

    // the snapshot's options in a dialog: the controls held, and for how long
    function snapDialog() {
      var d = SW.el('dialog', { class: 'ov-snapdlg' }), mcw = mine ? mine.cw : 0;
      d.innerHTML = '<h3>New snapshot</h3>' +
        '<label class="ov-opt"><input type="radio" name="ovs" value="std"' + (mine ? '' : ' checked') + '><span><b>The standard sequence</b><span class="hint">' + SW.esc((function (t) { return t.charAt(0).toUpperCase() + t.slice(1); })(PHASES.map(function (P) { return P.what; }).join(', then '))) + '.</span></span></label>' +
        '<label class="ov-opt"><input type="radio" name="ovs" value="mine"' + (mine ? ' checked' : '') + '><span><b>Use these controls instead</b><span class="hint">Two seconds with no controls, then these held, then two seconds released. Both rotate bits of a ship mean hyperspace.</span></span></label>' +
        '<div class="ov-ships">' + [0, 1].map(function (s0) {
          return '<div><b>' + (s0 ? 'Second ship' : 'First ship') + '</b>' + BITS.map(function (bt) { return ' <label class="check"><input type="checkbox" data-bit="' + bt[1 + s0] + '"' + (mcw & bt[1 + s0] ? ' checked' : '') + '>' + bt[0] + '</label>'; }).join('') + '</div>';
        }).join('') + '<label class="check">held for <select class="ov-secs">' + [1, 3, 5, 10].map(function (x) { return '<option' + ((mine ? mine.secs : 3) === x ? ' selected' : '') + '>' + x + '</option>'; }).join('') + '</select> seconds</label></div>' +
        '<div class="toolbar" style="position:static;padding:10px 0 0;justify-content:flex-end"><button class="btn ghost" data-c>Cancel</button><button class="btn" data-t>Take snapshot</button></div>';
      document.body.appendChild(d);
      d.addEventListener('change', function (e2) { if (e2.target.dataset.bit || e2.target.classList.contains('ov-secs')) SW.$('input[value="mine"]', d).checked = true; });
      d.addEventListener('click', function (e2) {
        if (e2.target === d || e2.target.closest('[data-c]')) { d.close(); d.remove(); return; }
        if (e2.target.closest('[data-t]')) {
          if (SW.$('input[value="std"]', d).checked) mine = null;
          else { var cw = 0; SW.$$('[data-bit]', d).forEach(function (x) { if (x.checked) cw |= +x.dataset.bit; }); mine = { cw: cw, secs: +SW.$('.ov-secs', d).value }; }
          d.close(); d.remove(); O.render(b, el);
        }
      });
      d.addEventListener('close', function () { d.remove(); });
      d.showModal();
    }
    if (el._ovClick) el.removeEventListener('click', el._ovClick);
    el.addEventListener('click', el._ovClick = function (ev) {
      if (ev.target.closest('[data-snap]')) { snapDialog(); return; }
      var icb = ev.target.closest('[data-ic]'); if (icb) { ev.preventDefault(); iconAct(icb); return; }
      var hn = ev.target.closest('[data-hnav]');
      if (hn) { var np = hpos + (+hn.dataset.hnav); if (np >= 0 && np < hist.length) { hpos = np; keep.hpos = hpos; inspect(hist[hpos], true); } return; }
      var rd = ev.target.closest('[data-read]');
      if (rd) { var pn = rd.dataset.read.split(':'); goRead(b, +pn[0], +pn[1]); return; }
      var x = ev.target.closest('[data-e]');
      if (x) { ev.preventDefault(); inspect(x.dataset.e); return; }
      var a = ev.target.closest('a.ov-nm[data-p]');
      if (a && a.dataset.p !== '') { ev.preventDefault(); goRead(b, +a.dataset.p, +a.dataset.n); }
    });
    // the data panel starts on the first ship (ss1, or whichever entry is in it)
    var first = Object.keys(A.R).filter(function (e) { return /^\d+$/.test(e) && /^ss1(\+\d+)?$/.test(name(b, e)); })[0];
    if (first == null) { var objs = Object.keys(A.sites).map(function (k) { return A.sites[k]; }).filter(function (x) { return Object.keys(x.to).length > 1; })[0]; if (objs) first = Object.keys(objs.to).sort(function (x, y) { return +x - +y; })[0]; }
    if (hist.length && hist[hpos] != null) inspect(hist[hpos], true);
    else if (first != null) inspect(first);
  }
})(this);