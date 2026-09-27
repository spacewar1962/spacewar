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
    // the main loop: from its label to the last jump back to it (the game-over
    // test may jump back earlier)
    var loopEnd = frameAt + 0o200;
    for (var a = frameAt; a >= 0 && a < Math.min(0o10000, frameAt + 0o600); a++) if (mem[a] === (0o600000 | frameAt)) loopEnd = a;
    function inLoop(a) { return a >= frameAt && a <= loopEnd; }
    function rec(e) { return R[e] = R[e] || { e: e, calls: {}, n: 0, startup: 0, callers: {}, frames: {} }; }
    PHASES.forEach(function (P) {
      cpu.tw = P.cw; cpu.control = P.cw;
      var end = cpu.cycles + P.cycles;
      while (cpu.cycles < end && !cpu.halted) {
        var pc0 = cpu.pc, md = mem[pc0], tgt = md;
        // a return: execution is back just after a call on the stack (up to two
        // words on: jda mpy, jda oc and the like take an argument word after the call)
        // words on: jda mpy, jda oc and the like take an argument word after the call);
        // a routine entered by a jump from the main loop has finished when the main loop runs again
        for (var k = stack.length - 1; k >= 0; k--) {
          if (stack[k].jd ? inLoop(pc0) && pc0 > stack[k].site : ((pc0 - stack[k].ret) & 0o7777) <= 2) { stack.length = k; break; }
        }
        if (pc0 === frameAt) { inFrames = true; frames++; stack.length = 0; }
        if (!inFrames && !stack.length && isSrc(pc0) && b.labelAt[pc0] && path.indexOf(pc0) < 0 && path.length < 40) path.push(pc0);
        if (opOf(md) === 0o04) { var y = md & 0o7777; if ((md >> 12) & 1) y = mem[y] & 0o7777; tgt = mem[y]; }
        // a jump in the main loop that the program rewrites (jmp ., set for each object) is a dispatch
        var jd = inFrames && !stack.length && opOf(md) === 0o30 && inLoop(pc0) && cpu.writeCount[pc0] > 0;
        cpu.step();
        if (jd && !inLoop(cpu.pc) && isSrc(cpu.pc)) {
          var tj = cpu.pc, rj = rec('main'), tt = rec(tj);
          rj.calls[tj] = (rj.calls[tj] || 0) + 1; tt.n++; tt.callers.main = 1; tt.frames[frames] = 1;
          var sj = sites[pc0] = sites[pc0] || { pc: pc0, to: {}, n: 0, jump: true }; sj.to[tj] = (sj.to[tj] || 0) + 1; sj.n++;
          stack.push({ jd: true, e: tj, site: pc0 });
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
          stack.push({ ret: (pc0 + 1) & 0o7777, e: to });
          if (stack.length > 64) stack.shift();
        }
      }
    });
    return { R: R, sites: sites, path: path, frames: frames, frameAt: frameAt, start: b.asm.start, cpu: cpu, halted: cpu.halted };
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

  // the object table's fields, as the main loop sets up its pointers:
  // "add (nob" / "dap mx1 / x" pairs after ml0
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
  function draw(b, el) {
    var A;
    try { A = O.analyse(b); } catch (e) { el.innerHTML = '<p class="hint">The emulator stopped: ' + SW.esc(e.message) + '</p>'; return; }
    var F = Math.max(1, A.frames);
    function link(e) {
      var nm = name(b, e);
      if (e === 'rt' || e === 'main' || e === 'startup') return '<span class="ov-nm">' + SW.esc(nm) + '</span>';
      var at = lineAt(b, +e) || lineOf(b, b.labelAt[e]);
      return '<a href="#" class="ov-nm mono" data-p="' + (at ? at.p : '') + '" data-n="' + (at ? at.n : '') + '" title="' + SW.esc(SW.oct(+e, 4)) + ': open in Read">' + SW.esc(nm) + '</a>';
    }
    function per(n) { var v = n / F; return v >= 10 ? Math.round(v) + ' a frame' : v >= 0.95 ? (Math.round(v * 10) / 10) + ' a frame' : 'in ' + Math.round(100 * v) + '% of frames'; }
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
      PHASES.map(function (P) { return P.what; }).join(', then ') + '. Names open the line in Read; the grey text is the program’s own comment.' + (A.halted ? ' The machine halted during the run.' : '') + '</div>');
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
    el.innerHTML = h.join('');
    el.addEventListener('click', function (e) {
      var a = e.target.closest('a.ov-nm'); if (!a || a.dataset.p === '') return;
      e.preventDefault(); goRead(b, +a.dataset.p, +a.dataset.n);
    });
  }
})(this);
