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

  O.analyse = function (b) {
    var cpu = new C.PDP1({ mdv: b.v.mdv });
    cpu.load(b.asm.memory, b.asm.start);
    var mem = cpu.mem, isSrc = function (a) { return !!b.asm.memory[a]; };
    var frameAt = b.sym.ml0 ? b.sym.ml0.val : (b.sym.bck ? b.sym.bck.val : -1);
    var R = {}, sites = {}, path = [], stack = [], inFrames = false, frames = 0;
    // time: cycles in each routine itself (ex) and with what it calls (inc), in
    // frames; each frame's calls as spans against time; the main loop's wait
    // for the rest of the frame (the line "use up rest of time") kept apart
    var ex = {}, inc = {}, frameList = [], cur = null, waitAt = {};
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
    PHASES.forEach(function (P, pi) {
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
          cur = { t: cpu.cycles, spans: [], len: 0, phase: phase };
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
             ex: ex, inc: inc, frameList: frameList, total: total, waitAt: waitAt };
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

  // ---------- the page ----------
  O.render = function (b, el) {
    el.innerHTML = '<p class="hint">Running ' + SW.esc(b.v.label) + ' on the emulator…</p>';
    setTimeout(function () { draw(b, el); }, 20);
  };
  function goRead(b, p, n) { SW.state.sel = { p: p, n0: n, n1: n }; SW.setTab('read'); }
  function hue(nm) { var h = 0; for (var i = 0; i < nm.length; i++) h = (h * 31 + nm.charCodeAt(i)) % 360; return h; }
  function colour(nm) { return nm === 'waiting' ? 'rgba(143,163,181,0.28)' : 'hsl(' + hue(nm) + ',55%,52%)'; }
  var US = 5;   // a memory cycle is 5 µs

  function draw(b, el) {
    var A;
    try { A = O.analyse(b); } catch (e) { el.innerHTML = '<p class="hint">The emulator stopped: ' + SW.esc(e.message) + '</p>'; return; }
    var F = Math.max(1, A.frames), FL = A.frameList, NF = Math.max(1, FL.length);
    var avgLen = A.total / NF;
    function nm(e) { return e === 'wait' ? 'waiting' : name(b, e); }
    function link(e) {
      if (e === 'startup') return '<span class="ov-nm">start-up</span>';
      return '<a href="#" class="ov-nm mono" data-e="' + SW.esc(String(e)) + '" title="Inspect">' + SW.esc(nm(e)) + '</a>';
    }
    function per(n) { var v = n / F; return v >= 10 ? Math.round(v) + ' a frame' : v >= 0.95 ? (Math.round(v * 10) / 10) + ' a frame' : 'in ' + Math.round(100 * v) + '% of frames'; }
    function cyc(n) { return Math.round(n).toLocaleString('en-GB') + ' cycles (' + (n * US / 1000).toFixed(n * US < 10000 ? 2 : 1) + ' ms)'; }
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
    h.push('<div class="ov-run hint">Recorded from ' + SW.esc(b.v.label) + ' on the emulator, ' + A.frames + ' frames of the main loop, with ' +
      PHASES.map(function (P) { return P.what; }).join(', then ') + '. Click a routine to inspect it; the grey text is the program’s own comment. A memory cycle is 5 µs.' + (A.halted ? ' The machine halted during the run.' : '') + '</div>');

    // one frame against time
    h.push('<section class="ov-box"><h4>One frame, call by call</h4>' +
      '<div class="toolbar ov-fctl" style="position:static;padding:0 0 6px"><button class="btn ghost" data-f="prev" title="Previous frame">◀</button><button class="btn ghost" data-f="play">▶ Play</button><button class="btn ghost" data-f="next" title="Next frame">▶</button>' +
      '<input type="range" class="ov-fr" min="0" max="' + (NF - 1) + '" value="' + Math.min(NF - 1, Math.round(NF * 0.1)) + '"><span class="hint ov-fcap"></span></div>' +
      '<div class="ov-flame"></div><p class="hint">Each bar is a routine, from its call to its return, under the routine that called it. Grey is the main loop using up the rest of the frame’s time (count \\mtc); when the frame’s work takes longer, there is no wait and the frame runs long.</p></section>');

    // where the time goes
    var rows = Object.keys(A.ex).map(function (e) { return { e: e, ex: A.ex[e], inc: e === 'main' ? A.total : e === 'wait' ? A.ex[e] : (A.inc[e] || A.ex[e]) }; })
      .filter(function (r) { return r.ex > 0; }).sort(function (x, y) { return y.ex - x.ex; });
    h.push('<section class="ov-box"><h4>Where each frame’s time goes <span class="faint">(a frame is about ' + cyc(avgLen) + ')</span></h4><div class="ov-budget">' +
      rows.map(function (r) {
        var pc = 100 * r.ex / A.total;
        return '<div class="ov-brow" data-e="' + SW.esc(String(r.e)) + '"><span class="ov-bnm mono">' + SW.esc(nm(r.e)) + '</span><span class="ov-bar"><i style="width:' + Math.max(0.3, pc).toFixed(2) + '%;background:' + colour(nm(r.e)) + '"></i></span>' +
          '<span class="ov-bv">' + pc.toFixed(1) + '%</span><span class="ov-bv faint">' + Math.round(r.ex / NF).toLocaleString('en-GB') + ' a frame' + (r.inc > r.ex * 1.05 && r.e !== 'main' ? ', ' + Math.round(r.inc / NF).toLocaleString('en-GB') + ' with its calls' : '') + '</span></div>';
      }).join('') + '</div><p class="hint">Cycles spent in each routine itself, per frame on average; “with its calls” adds the routines it calls.</p></section>');

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
    h.push('<section class="ov-box"><h4>Subroutines</h4><table class="ov-sub"><thead><tr><th>Routine</th><th>Calls</th><th>Called from</th><th>The program’s comment</th></tr></thead><tbody>' +
      subs.map(function (e) {
        var r = A.R[e];
        return '<tr><td>' + link(e) + '</td><td class="num">' + (r.startup === r.n ? r.n + ' at start-up' : per(r.n - r.startup)) + '</td><td>' +
          Object.keys(r.callers).map(function (c) { return link(c); }).join(', ') + '</td><td class="ov-g">' + SW.esc(glossAt(b, e)) + '</td></tr>';
      }).join('') + '</tbody></table></section>');
    // the object table
    var T = tableFields(b);
    if (T) h.push('<section class="ov-box"><h4>The object table <span class="faint">(' + (T.nob != null ? T.nob + ' objects (nob, octal ' + T.nob.toString(8) + '), ' : '') + 'as the main loop sets its pointers; words in decimal)</span></h4><table class="ov-sub"><thead><tr><th>Field</th><th>Words</th><th>The program’s comment</th></tr></thead><tbody>' +
      T.fields.map(function (f) { return '<tr><td><a href="#" class="ov-nm mono" data-p="' + f.p + '" data-n="' + f.n + '">' + SW.esc(f.field) + '</a></td><td class="num">' + (f.size == null ? '' : f.size) + '</td><td class="ov-g">' + SW.esc(f.what) + '</td></tr>'; }).join('') + '</tbody></table></section>');

    el.innerHTML = '<div class="ov-cols"><div class="ov-left">' + h.join('') + '</div><aside class="ov-insp" hidden></aside></div>';
    var insp = SW.$('.ov-insp', el);

    // ---------- the flame chart ----------
    var fl = SW.$('.ov-flame', el), fr = SW.$('.ov-fr', el), fcap = SW.$('.ov-fcap', el), playT = null;
    function chart(i) {
      var f = FL[i]; if (!f) { fl.innerHTML = '<p class="hint">No frames recorded.</p>'; return; }
      var W = Math.max(300, fl.clientWidth || 700), RH = 20, depth = 0; f.spans.forEach(function (sp) { depth = Math.max(depth, sp.d); });
      var H = (depth + 1) * RH + 26, len = f.len || 1;
      var o = ['<svg width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '" class="ov-fsvg">'];
      f.spans.forEach(function (sp, n) {
        var t1 = sp.t1 == null ? len : sp.t1, x = W * sp.t0 / len, w = Math.max(0.8, W * (t1 - sp.t0) / len), y = sp.d * RH, nmx = nm(sp.e);
        o.push('<g data-e="' + SW.esc(String(sp.e)) + '" class="ov-sp"><rect x="' + x.toFixed(1) + '" y="' + y + '" width="' + w.toFixed(1) + '" height="' + (RH - 2) + '" fill="' + colour(nmx) + '"><title>' + SW.esc(nmx + ': ' + cyc(t1 - sp.t0) + ', from cycle ' + sp.t0 + ' of the frame') + '</title></rect>' +
          (w > 34 ? '<text x="' + (x + 3).toFixed(1) + '" y="' + (y + RH - 7) + '" class="ov-spt">' + SW.esc(nmx) + '</text>' : '') + '</g>');
      });
      for (var tk = 0; tk <= 4; tk++) { var tx = W * tk / 4; o.push('<text x="' + Math.min(W - 60, tx + 2) + '" y="' + (H - 6) + '" class="ov-tick">' + Math.round(len * tk / 4).toLocaleString('en-GB') + '</text><line x1="' + tx + '" x2="' + tx + '" y1="' + (H - 22) + '" y2="' + (H - 16) + '" class="ov-tl"/>'); }
      o.push('</svg>');
      fl.innerHTML = o.join('');
      var wait = f.spans.filter(function (sp) { return sp.e === 'wait'; }).reduce(function (a, sp) { return a + ((sp.t1 == null ? len : sp.t1) - sp.t0); }, 0);
      var objs = f.spans.filter(function (sp) { return sp.d === 0 && sp.e !== 'wait'; }).map(function (sp) { return nm(sp.e); });
      fcap.textContent = 'frame ' + (i + 1) + ' of ' + NF + ' · ' + cyc(len) + ' · waiting ' + Math.round(100 * wait / len) + '% · ' + PHASES[f.phase].what;
      fcap.title = 'Called from the main loop, in order: ' + objs.join(', ');
    }
    fr.addEventListener('input', function () { chart(+fr.value); });
    var rsz = new ResizeObserver(function () { if (!fl.isConnected) { rsz.disconnect(); return; } chart(+fr.value); });
    rsz.observe(fl);
    SW.$('.ov-fctl', el).addEventListener('click', function (e) {
      var t = e.target.closest('[data-f]'); if (!t) return;
      if (t.dataset.f === 'play') {
        if (playT) { clearInterval(playT); playT = null; t.textContent = '▶ Play'; return; }
        t.textContent = '❚❚ Pause';
        playT = setInterval(function () { if (!fl.isConnected) { clearInterval(playT); return; } fr.value = (+fr.value + 1) % NF; chart(+fr.value); }, 150);
        return;
      }
      fr.value = Math.max(0, Math.min(NF - 1, +fr.value + (t.dataset.f === 'next' ? 1 : -1))); chart(+fr.value);
    });
    chart(+fr.value);

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
    function inspect(e) {
      if (e === 'startup') return;
      var r = A.R[e] || { n: 0, calls: {}, callers: {}, startup: 0 }, g = e === 'wait' ? 'use up rest of time of main loop' : e === 'main' ? glossAt(b, A.frameAt) : glossAt(b, e);
      var callsN = r.n - (r.startup || 0), exN = A.ex[e] || 0, incN = e === 'main' ? A.total : (A.inc[e] || exN);
      var hh = ['<button class="icon-btn ov-x" data-x title="Close">✕</button><h4 class="mono">' + SW.esc(nm(e)) + (/^\d+$/.test(e) ? ' <span class="faint">' + SW.oct(+e, 4) + '</span>' : '') + '</h4>'];
      if (g) hh.push('<p class="ov-g">' + SW.esc(g) + '</p>');
      var st = [];
      if (callsN) st.push(per(callsN));
      if (r.startup) st.push(r.startup + ' at start-up');
      if (exN) st.push(Math.round(exN / NF).toLocaleString('en-GB') + ' cycles a frame in itself' + (incN > exN * 1.05 ? ', ' + Math.round(incN / NF).toLocaleString('en-GB') + ' with its calls' : '') + ' (' + (100 * incN / A.total).toFixed(1) + '% of the frame)');
      if (callsN && incN) st.push(Math.round(incN / callsN).toLocaleString('en-GB') + ' cycles a call');
      hh.push('<ul class="ov-stats">' + st.map(function (x) { return '<li>' + SW.esc(x) + '</li>'; }).join('') + '</ul>');
      var cs = Object.keys(r.callers || {});
      if (cs.length) hh.push('<p><b>Called from</b> ' + cs.map(link).join(', ') + '</p>');
      var ks = Object.keys(r.calls || {}).sort(function (x, y) { return r.calls[y] - r.calls[x]; });
      if (ks.length) hh.push('<p><b>Calls</b> ' + ks.map(function (k) { return link(k) + ' <span class="faint">×' + (r.n ? Math.round(10 * r.calls[k] / r.n) / 10 : r.calls[k]) + '</span>'; }).join(', ') + '</p>');
      var cd = e === 'rt' ? null : codeOf(e);
      if (e === 'rt') hh.push('<p class="hint">Code written by the outline compiler (oc) at start-up, so it has no source lines: in Read it shows as run-time code.</p>');
      if (cd) {
        var ls = b.lines[cd.p];
        hh.push('<div class="ov-code mono">' + ls.slice(cd.n0 - 1, cd.n1).map(function (L) { return '<div><span class="faint">' + String(L.n).padStart(4) + '</span>  ' + SW.esc(L.raw.replace(/\t/g, '    ')) + '</div>'; }).join('') + (cd.cut ? '<div class="faint">…</div>' : '') + '</div>' +
          '<button class="btn ghost" data-read="' + cd.p + ':' + cd.n0 + '">Open in Read ▸</button>');
      }
      insp.innerHTML = hh.join('');
      insp.hidden = false; SW.$('.ov-cols', el).classList.add('insp-on');
      SW.$$('.ov-sp', fl).forEach(function (gg) { gg.classList.toggle('on', gg.dataset.e === String(e)); });
      SW.$$('.ov-brow', el).forEach(function (rw) { rw.classList.toggle('on', rw.dataset.e === String(e)); });
      if (window.innerWidth < 1000) insp.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
    el.addEventListener('click', function (ev) {
      if (ev.target.closest('[data-x]')) { insp.hidden = true; SW.$('.ov-cols', el).classList.remove('insp-on'); SW.$$('.ov-sp.on, .ov-brow.on', el).forEach(function (x) { x.classList.remove('on'); }); return; }
      var rd = ev.target.closest('[data-read]');
      if (rd) { var pn = rd.dataset.read.split(':'); goRead(b, +pn[0], +pn[1]); return; }
      var x = ev.target.closest('[data-e]');
      if (x) { ev.preventDefault(); inspect(x.dataset.e); return; }
      var a = ev.target.closest('a.ov-nm[data-p]');
      if (a && a.dataset.p !== '') { ev.preventDefault(); goRead(b, +a.dataset.p, +a.dataset.n); }
    });
  }
})(this);
