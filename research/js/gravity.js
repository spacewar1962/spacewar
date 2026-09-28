/*
 * gravity.js - the pull of the central star by distance, from each version's
 * own code. Ship 1 is put at a series of distances from the star, and the
 * gravity section of its calculation (from the jump over it on sense switch 6
 * to bsg, where it ends) is run on the emulator; the pull is the length of
 * (bx, by), the term added to the ship's velocity each frame. A distance at
 * which the code jumps to pof is inside the capture radius. After Norbert
 * Landsteiner's comparative plot of 3.1 and 4.0.
 */
(function (root) {
  'use strict';
  var SW = root.SW, V = root.SWVersions;
  var G = SW.gravity = {};
  var cache = {};
  var STEP = 0.25;   // screen points between samples
  var MAXS = 512;    // the farthest distance sampled, in screen points
  var INK = ['#39c5e0', '#ffb347', '#9be36b', '#e36bb3', '#b39bff', '#ff6b6b', '#6be3d0', '#d8d86b'];

  function s18(v) { return v & 0o400000 ? -(v ^ 0o777777) : v; }
  function sym(b, n) { var S = b.sym; return S[n] || S['\\' + n] || S['~' + n] || S['.' + n] || null; }
  function val(s) { return s ? (s.val != null ? s.val : s.value) : null; }

  // One version's curve: {s: [distances], g: [pulls, null where captured], capture}
  G.compute = function (b, along) {
    var key = b.v.id + '|' + along;
    if (cache[key]) return cache[key];
    var out = cache[key] = { ok: false, why: '' };
    var bsg = val(sym(b, 'bsg')), pof = val(sym(b, 'pof')), mx1 = val(sym(b, 'mx1')), my1 = val(sym(b, 'my1')),
        bx = val(sym(b, 'bx')), by = val(sym(b, 'by'));
    if (bsg == null || mx1 == null || bx == null) { out.why = 'no gravity section found'; return out; }
    var cpu = new root.PDP1CPU.PDP1({ mdv: b.v.mdv });
    cpu.load(b.asm.memory, b.asm.start);
    cpu.tw = 0; cpu.control = 0;
    var mem = cpu.mem, start = -1;
    for (var a = 1; a < 0o7777; a++) if (mem[a] === (0o600000 | bsg) && mem[a - 1] === 0o640060) { start = a + 1; break; }
    if (start < 0) { out.why = 'no “szs 60, jmp bsg” before the gravity section'; return out; }
    var n = 0;
    while (cpu.pc !== start && n < 3000000 && !cpu.halted) { cpu.step(); n++; }
    if (cpu.pc !== start) { out.why = 'the gravity section was not reached'; return out; }
    // the ship being calculated: the table entries mx1 and my1 point to
    var ax = mem[mx1] & 0o7777, ay = mem[my1] & 0o7777;
    var snap = { mem: mem.slice(), ac: cpu.ac, io: cpu.io, ov: cpu.ov, flag: cpu.flag.slice() };
    var S = [], Gs = [], cap = 0, k = along === 'diag' ? Math.SQRT1_2 : 1;
    for (var s = STEP; s <= MAXS + 1e-9; s += STEP) {
      mem.set(snap.mem); cpu.ac = snap.ac; cpu.io = snap.io; cpu.ov = snap.ov; cpu.flag = snap.flag.slice(); cpu.halted = false;
      var u = Math.round(s * k * 256);
      mem[ax] = u & 0o777777; mem[ay] = along === 'diag' ? u & 0o777777 : 0;
      cpu.pc = start;
      for (var i = 0; i < 20000 && cpu.pc !== bsg && cpu.pc !== pof && !cpu.halted; i++) cpu.step();
      S.push(s);
      if (cpu.pc === pof) { Gs.push(null); cap = s; }
      else Gs.push(cpu.pc === bsg ? Math.hypot(s18(mem[bx]), s18(mem[by])) : null);
    }
    out.ok = true; out.s = S; out.g = Gs; out.capture = cap;
    out.sig = Gs.map(function (x) { return x == null ? 'c' : x.toFixed(2); }).join(',');
    return out;
  };

  function vname(v) { return v.label.replace(/^Spacewar! /, ''); }

  G.draw = function (b, host) {
    var P = SW.store.get('gravity', {}) || {};
    var st = { range: P.range || 64, along: P.along || 'axis', off: P.off || {} };
    function keep() { SW.store.set('gravity', { range: st.range, along: st.along, off: st.off }); }
    var vs = V.VERSIONS.filter(function (v) { return v.build; }).sort(function (a, c) { return a.sort - c.sort; });
    var card = SW.el('div', { class: 'card grav', style: 'grid-column:1/-1' });
    card.innerHTML = '<h4>Gravity ' + SW.refTag(b.v.id) + '</h4>' +
      '<p class="hint">The pull of the central star on a ship at rest, by its distance from the star, worked out by each version’s own gravity code on the emulator. Versions whose code gives the same curve are drawn as one line. The dashed line is the capture radius: nearer than that the code jumps to pof. After Norbert Landsteiner’s plot of 3.1 against 4.0.</p>' +
      '<div class="grav-ctl"><label>Distance <select data-k="range"><option value="32">0 to 32</option><option value="64">0 to 64</option><option value="128">0 to 128</option><option value="256">0 to 256</option><option value="512">0 to 512</option></select> screen points</label> ' +
      '<label>along <select data-k="along"><option value="axis">the x axis</option><option value="diag">the diagonal</option></select></label> <span class="grav-exp"></span></div>' +
      '<div class="grav-plot"></div><div class="grav-read hint mono">&nbsp;</div><div class="grav-groups"><p class="hint">Running the gravity code of ' + vs.length + ' versions…</p></div>';
    host.appendChild(card);
    SW.$('[data-k=range]', card).value = String(st.range);
    SW.$('[data-k=along]', card).value = st.along;
    var plot = SW.$('.grav-plot', card), read = SW.$('.grav-read', card), gbox = SW.$('.grav-groups', card);
    var groups = [], stopped = false;

    function run() {
      groups = []; gbox.innerHTML = '<p class="hint">Running the gravity code of ' + vs.length + ' versions…</p>';
      var i = 0, curves = [];
      (function next() {
        if (stopped) return;
        if (i >= vs.length) { group(curves); return; }
        var v = vs[i++];
        SW.build(v.id).then(function (bv) {
          var c = bv.asm ? G.compute(bv, st.along) : { ok: false, why: 'not assembled' };
          curves.push({ v: v, c: c });
          setTimeout(next, 0);
        }, function () { curves.push({ v: v, c: { ok: false, why: 'could not be built' } }); setTimeout(next, 0); });
      })();
    }
    function group(curves) {
      var by = {}, none = [];
      curves.forEach(function (x) {
        if (!x.c.ok) { none.push(x); return; }
        (by[x.c.sig] = by[x.c.sig] || { c: x.c, vs: [] }).vs.push(x.v);
      });
      groups = Object.keys(by).map(function (k) { return by[k]; });
      groups.forEach(function (gp, n) { gp.ink = INK[n % INK.length]; gp.key = gp.vs[0].id; });
      // shown unless turned off; at first only the group of this version and of 3.1 and 4.0
      if (!P.seen) { groups.forEach(function (gp) { if (!gp.vs.some(function (v) { return v.id === b.v.id || v.id === '3.1' || v.id === '4.0'; })) st.off[gp.key] = 1; }); P.seen = 1; SW.store.set('gravity', { range: st.range, along: st.along, off: st.off, seen: 1 }); }
      gbox.innerHTML = '<table class="ov-sub grav-t"><thead><tr><th></th><th>Versions with this curve</th><th>Captured nearer than</th><th>Pull at 20 points</th></tr></thead><tbody>' +
        groups.map(function (gp, n) {
          var i20 = Math.round(20 / STEP) - 1, g20 = gp.c.g[i20];
          return '<tr data-gi="' + n + '"' + (st.off[gp.key] ? ' class="off"' : '') + '><td><label class="grav-sw" title="Show or hide this curve"><input type="checkbox"' + (st.off[gp.key] ? '' : ' checked') + '><span style="background:' + gp.ink + '"></span></label></td><td>' +
            gp.vs.map(function (v) { return '<button class="linkish" data-v="' + v.id + '" title="Switch to ' + SW.esc(v.label) + '">' + SW.esc(vname(v)) + '</button>'; }).join(', ') +
            '</td><td class="num">' + (gp.c.capture ? (gp.c.capture + STEP) + ' points' : 'none sampled') + '</td><td class="num">' + (g20 == null ? 'captured' : g20.toFixed(0)) + '</td></tr>';
        }).join('') + '</tbody></table>' +
        (none.length ? '<p class="hint">Not drawn: ' + none.map(function (x) { return SW.esc(vname(x.v)) + ' (' + SW.esc(x.c.why) + ')'; }).join('; ') + '.</p>' : '');
      paint();
    }
    gbox.addEventListener('change', function (e) {
      var tr = e.target.closest('[data-gi]'); if (!tr) return;
      var gp = groups[+tr.dataset.gi];
      if (e.target.checked) delete st.off[gp.key]; else st.off[gp.key] = 1;
      tr.classList.toggle('off', !e.target.checked); keep(); paint();
    });
    gbox.addEventListener('click', function (e) { var t = e.target.closest('[data-v]'); if (t) SW.select(t.dataset.v); });
    card.addEventListener('change', function (e) {
      var k = e.target.dataset && e.target.dataset.k; if (!k) return;
      if (k === 'range') { st.range = +e.target.value; keep(); paint(); }
      if (k === 'along') { st.along = e.target.value; keep(); run(); }
    });

    var W = 720, H = 420, L = 58, R = 16, T = 16, B = 44;
    function shown() { return groups.filter(function (gp) { return !st.off[gp.key]; }); }
    function scaleY(gs) {
      // the height: the largest pull shown beyond a tenth of the range
      var from = Math.round(st.range / 10 / STEP), m = 0;
      gs.forEach(function (gp) { for (var i = from; i < gp.c.s.length && gp.c.s[i] <= st.range; i++) if (gp.c.g[i] != null) m = Math.max(m, gp.c.g[i]); });
      m = (m || 1) * 1.05;
      var e = Math.pow(10, Math.floor(Math.log10(m / 4))), f = m / 4 / e, step = (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * e;
      return { max: step * Math.ceil(m / step), step: step };
    }
    function svg(p) {
      var gs = shown(), sy = scaleY(gs), ym = sy.max, pw = W - L - R, ph = H - T - B;
      function X(s) { return L + s / st.range * pw; }
      function Y(g) { return T + ph - Math.min(g, ym * 1.02) / ym * ph; }
      var o = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '" font-family="IBM Plex Mono, monospace" font-size="11">';
      o += '<rect x="' + L + '" y="' + T + '" width="' + pw + '" height="' + ph + '" fill="none" stroke="' + p.dim + '" stroke-width="0.6"/>';
      for (var t = 0; t <= 4; t++) {
        var sx = st.range * t / 4, x = X(sx);
        o += '<line x1="' + x + '" y1="' + (T + ph) + '" x2="' + x + '" y2="' + (T + ph + 4) + '" stroke="' + p.dim + '"/><text x="' + x + '" y="' + (T + ph + 16) + '" fill="' + p.dim + '" text-anchor="middle">' + sx + '</text>';
      }
      for (var gy = 0; gy <= ym + 1e-9; gy += sy.step) {
        var y = Y(gy);
        o += '<line x1="' + (L - 4) + '" y1="' + y + '" x2="' + L + '" y2="' + y + '" stroke="' + p.dim + '"/><text x="' + (L - 6) + '" y="' + (y + 4) + '" fill="' + p.dim + '" text-anchor="end">' + Math.round(gy) + '</text>';
      }
      o += '<text x="' + (L + pw / 2) + '" y="' + (H - 8) + '" fill="' + p.ink + '" text-anchor="middle">distance from the star, screen points (' + (st.along === 'diag' ? 'along the diagonal' : 'along the x axis') + ')</text>';
      o += '<text transform="translate(14 ' + (T + ph / 2) + ') rotate(-90)" fill="' + p.ink + '" text-anchor="middle">pull: length of (bx, by)</text>';
      gs.forEach(function (gp) {
        if (gp.c.capture && gp.c.capture <= st.range) o += '<line x1="' + X(gp.c.capture) + '" y1="' + T + '" x2="' + X(gp.c.capture) + '" y2="' + (T + ph) + '" stroke="' + gp.ink + '" stroke-width="1" stroke-dasharray="4 3"/>';
        var d = '', pen = false;
        for (var i = 0; i < gp.c.s.length && gp.c.s[i] <= st.range; i++) {
          var g = gp.c.g[i]; if (g == null) { pen = false; continue; }
          d += (pen ? 'L' : 'M') + X(gp.c.s[i]).toFixed(1) + ' ' + Y(g).toFixed(1); pen = true;
        }
        o += '<path d="' + d + '" fill="none" stroke="' + gp.ink + '" stroke-width="1.4" stroke-linejoin="round"/>';
      });
      var ly = T + 14;
      gs.forEach(function (gp) {
        o += '<line x1="' + (W - R - 190) + '" y1="' + (ly - 4) + '" x2="' + (W - R - 170) + '" y2="' + (ly - 4) + '" stroke="' + gp.ink + '" stroke-width="2"/><text x="' + (W - R - 164) + '" y="' + ly + '" fill="' + p.ink + '">' + SW.esc(gp.vs.map(vname).join(', ').slice(0, 26) + (gp.vs.map(vname).join(', ').length > 26 ? '…' : '')) + '</text>';
        ly += 16;
      });
      return o + '</svg>';
    }
    var SCREEN = { bg: 'none', ink: 'var(--g-text)', dim: 'var(--g-muted)' };
    function paint() {
      if (!groups.length) return;
      plot.innerHTML = SW.displaySVG(svg(SCREEN));
      var el = SW.$('svg', plot); el.removeAttribute('width'); el.removeAttribute('height'); el.style.width = '100%'; el.style.maxWidth = W + 'px'; el.style.height = 'auto';
    }
    plot.addEventListener('mousemove', function (e) {
      var el = SW.$('svg', plot); if (!el) return;
      var r = el.getBoundingClientRect(), x = (e.clientX - r.left) / r.width * W;
      var s = (x - L) / (W - L - R) * st.range; if (s < 0 || s > st.range) { read.innerHTML = '&nbsp;'; return; }
      var i = Math.max(0, Math.round(s / STEP) - 1);
      read.innerHTML = SW.esc((i + 1) * STEP + ' points: ') + shown().map(function (gp) { var g = gp.c.g[i]; return '<span style="color:' + gp.ink + '">' + SW.esc(vname(gp.vs[0])) + (gp.vs.length > 1 ? ' +' + (gp.vs.length - 1) : '') + ' ' + (g == null ? 'captured' : g.toFixed(0)) + '</span>'; }).join(' · ');
    });
    SW.$('.grav-exp', card).appendChild(SW.figureButtons(function (p) { return svg(p); }, 'spacewar-gravity'));
    run();
    return function () { stopped = true; };
  };
})(this);
