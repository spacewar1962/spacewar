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

  // A probe of one version's gravity code: at(x, y), in 18-bit units, gives
  // the pull, null where the ship is captured, NaN where the code did not end.
  var probes = {};
  G.probe = function (b) {
    if (probes[b.v.id]) return probes[b.v.id];
    var P = probes[b.v.id] = { ok: false, why: '' };
    var bsg = val(sym(b, 'bsg')), pof = val(sym(b, 'pof')), mx1 = val(sym(b, 'mx1')), my1 = val(sym(b, 'my1')),
        bx = val(sym(b, 'bx')), by = val(sym(b, 'by'));
    if (bsg == null || mx1 == null || bx == null) { P.why = 'no gravity section found'; return P; }
    var cpu = new root.PDP1CPU.PDP1(SW.cpuOpts(b.v));
    cpu.load(b.asm.memory, b.asm.start);
    cpu.tw = 0; cpu.control = 0;
    var mem = cpu.mem, start = -1;
    for (var a = 1; a < 0o7777; a++) if (mem[a] === (0o600000 | bsg) && mem[a - 1] === 0o640060) { start = a + 1; break; }
    if (start < 0) { P.why = 'no “szs 60, jmp bsg” before the gravity section'; return P; }
    var n = 0;
    while (cpu.pc !== start && n < 3000000 && !cpu.halted) { cpu.step(); n++; }
    if (cpu.pc !== start) { P.why = 'the gravity section was not reached'; return P; }
    // the ship being calculated: the table entries mx1 and my1 point to
    var ax = mem[mx1] & 0o7777, ay = mem[my1] & 0o7777;
    var snap = { mem: mem.slice(), ac: cpu.ac, io: cpu.io, ov: cpu.ov, flag: cpu.flag.slice() };
    P.ok = true;
    P.at = function (xu, yu) {
      mem.set(snap.mem); cpu.ac = snap.ac; cpu.io = snap.io; cpu.ov = snap.ov; cpu.flag = snap.flag.slice(); cpu.halted = false;
      mem[ax] = xu < 0 ? (-xu) ^ 0o777777 : xu; mem[ay] = yu < 0 ? (-yu) ^ 0o777777 : yu;
      cpu.pc = start;
      for (var i = 0; i < 20000 && cpu.pc !== bsg && cpu.pc !== pof && !cpu.halted; i++) cpu.step();
      if (cpu.pc === pof) return null;
      return cpu.pc === bsg ? Math.hypot(s18(mem[bx]), s18(mem[by])) : NaN;
    };
    return P;
  };

  // One version's curve: {s: [distances], g: [pulls, null where captured], capture}
  G.compute = function (b, along) {
    var key = b.v.id + '|' + along;
    if (cache[key]) return cache[key];
    var out = cache[key] = { ok: false, why: '' };
    var P = G.probe(b);
    if (!P.ok) { out.why = P.why; return out; }
    var S = [], Gs = [], cap = 0, k = along === 'diag' ? Math.SQRT1_2 : 1;
    for (var s = STEP; s <= MAXS + 1e-9; s += STEP) {
      var u = Math.round(s * k * 256), g = P.at(u, along === 'diag' ? u : 0);
      S.push(s);
      if (g === null) { Gs.push(null); cap = s; } else Gs.push(isNaN(g) ? null : g);
    }
    out.ok = true; out.s = S; out.g = Gs; out.capture = cap;
    out.sig = Gs.map(function (x) { return x == null ? 'c' : x.toFixed(2); }).join(',');
    return out;
  };

  function vname(v) { return v.label.replace(/^Spacewar! /, ''); }
  // A panel that folds away under its heading, remembered; onFold(folded).
  function foldable(card, key, onFold) {
    var h = card.firstElementChild, body = SW.el('div', { class: 'grav-body' });
    while (h.nextSibling) body.appendChild(h.nextSibling);
    card.appendChild(body);
    var btn = SW.el('button', { class: 'grav-fold', type: 'button' }, '▾');
    h.insertBefore(btn, h.firstChild);
    function set(f) {
      card.classList.toggle('folded', f); btn.textContent = f ? '▸' : '▾';
      btn.title = f ? 'Show this panel' : 'Fold this panel away'; btn.setAttribute('aria-expanded', String(!f));
      if (onFold) onFold(f);
    }
    var F = SW.store.get('grav.fold', {}) || {};
    set(!!F[key]);
    h.addEventListener('click', function (e) {
      if (e.target.closest('.swref')) return;
      var f = !card.classList.contains('folded'); set(f);
      var G2 = SW.store.get('grav.fold', {}) || {}; G2[key] = f; SW.store.set('grav.fold', G2);
    });
  }

  G.draw = function (b, host) {
    var P = SW.store.get('gravity2', {}) || {};
    var st = { range: P.range || 64, along: P.along || 'diag', off: P.off || {} };
    function keep() { SW.store.set('gravity2', { range: st.range, along: st.along, off: st.off }); }
    var vs = V.VERSIONS.filter(function (v) { return v.build; }).sort(function (a, c) { return a.sort - c.sort; });
    var card = SW.el('div', { class: 'card grav', style: 'grid-column:1/-1' });
    card.innerHTML = '<h4>Gravity ' + SW.refTag(b.v.id) + '</h4>' +
      '<p class="hint">The pull of the central star on a ship at rest, by its distance from the star, worked out by each version’s own gravity code on the emulator. Versions whose code gives the same curve are drawn as one line. The dashed line is the capture radius: nearer than that the code jumps to pof. After Norbert Landsteiner’s plot of 3.1 against 4.0. The emulator reproduces Norbert Landsteiner’s table of bx and by for 3.1 and 4.x exactly. On the diagonal 3.1’s pull is zero nearer than about 22.5 points, where its f(x, y) rounds to zero. The dip just outside the capture radius in the 4.x curve is also what the code computes: the left shift that undosft writes into xyt appears to overflow there.</p>' +
      '<div class="grav-ctl"><label>Distance <select data-k="range"><option value="32">0 to 32</option><option value="64">0 to 64</option><option value="128">0 to 128</option><option value="256">0 to 256</option><option value="512">0 to 512</option></select> screen points</label> ' +
      '<label>along <select data-k="along"><option value="diag">the diagonal (a free fall)</option><option value="axis">the x axis</option></select></label> <span class="grav-exp"></span></div>' +
      '<div class="grav-plot"></div><div class="grav-read hint mono">&nbsp;</div><div class="grav-groups"><p class="hint">Running the gravity code of ' + vs.length + ' versions…</p></div>';
    host.appendChild(card);
    SW.$('[data-k=range]', card).value = String(st.range);
    foldable(card, 'curves');
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
      if (!P.seen) { groups.forEach(function (gp) { if (!gp.vs.some(function (v) { return v.id === b.v.id || v.id === '3.1' || v.id === '4.0'; })) st.off[gp.key] = 1; }); P.seen = 1; SW.store.set('gravity2', { range: st.range, along: st.along, off: st.off, seen: 1 }); }
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

    var W = 720, H = 420, L = 62, R = 16, T = 16, B = 44, CW = 6.6;   // CW: a character's width at 11px
    function shown() { return groups.filter(function (gp) { return !st.off[gp.key]; }); }
    function scaleY(gs) {
      // the height: the largest pull shown beyond a tenth of the range
      var from = Math.round(st.range / 10 / STEP), m = 0;
      gs.forEach(function (gp) { for (var i = from; i < gp.c.s.length && gp.c.s[i] <= st.range; i++) if (gp.c.g[i] != null) m = Math.max(m, gp.c.g[i]); });
      m = (m || 1) * 1.05;
      var e = Math.pow(10, Math.floor(Math.log10(m / 4))), f = m / 4 / e, step = (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * e;
      return { max: step * Math.ceil(m / step), step: step };
    }
    // the legend under the chart, each curve's versions in full, wrapped
    function legend(gs) {
      var max = Math.max(20, Math.floor((W - L - R - 30) / CW));
      return gs.map(function (gp) {
        var words = gp.vs.map(vname), lines = [], cur = '';
        words.forEach(function (w, i) { var t = w + (i < words.length - 1 ? ',' : ''); if (cur && (cur + ' ' + t).length > max) { lines.push(cur); cur = t; } else cur = cur ? cur + ' ' + t : t; });
        if (cur) lines.push(cur);
        return { gp: gp, lines: lines };
      });
    }
    function svg(p) {
      var gs = shown(), sy = scaleY(gs), ym = sy.max, lg = legend(gs), nl = lg.reduce(function (n, x) { return n + x.lines.length; }, 0);
      B = 50 + (nl ? 10 + nl * 16 : 0);
      var pw = W - L - R, ph = H - T - B;
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
      o += '<text x="' + (L + pw / 2) + '" y="' + (T + ph + 36) + '" fill="' + p.ink + '" text-anchor="middle">distance from the star, screen points (' + (st.along === 'diag' ? 'along the diagonal' : 'along the x axis') + ')</text>';
      o += '<text transform="translate(14 ' + (T + ph / 2) + ') rotate(-90)" fill="' + p.ink + '" text-anchor="middle">pull: length of (bx, by)</text>';
      gs.forEach(function (gp) {
        // the capture radius: the first distance the code does not capture;
        // curves with the same radius share the line, their dashes interleaved
        var cr = gp.c.capture ? gp.c.capture + STEP : 0, k = gs.indexOf(gp);
        if (cr && cr <= st.range) o += '<line x1="' + X(cr) + '" y1="' + T + '" x2="' + X(cr) + '" y2="' + (T + ph) + '" stroke="' + gp.ink + '" stroke-width="1.2" stroke-dasharray="4 ' + (4 * gs.length - 4 + 3) + '" stroke-dashoffset="' + (-4 * k) + '"/>';
        var d = '', pen = false;
        for (var i = 0; i < gp.c.s.length && gp.c.s[i] <= st.range; i++) {
          var g = gp.c.g[i]; if (g == null) { pen = false; continue; }
          d += (pen ? 'L' : 'M') + X(gp.c.s[i]).toFixed(1) + ' ' + Y(g).toFixed(1); pen = true;
        }
        o += '<path d="' + d + '" fill="none" stroke="' + gp.ink + '" stroke-width="1.4" stroke-linejoin="round"/>';
      });
      var ly = T + ph + 62;
      lg.forEach(function (x) {
        o += '<line x1="' + L + '" y1="' + (ly - 4) + '" x2="' + (L + 20) + '" y2="' + (ly - 4) + '" stroke="' + x.gp.ink + '" stroke-width="2"/>';
        x.lines.forEach(function (t) { o += '<text x="' + (L + 28) + '" y="' + ly + '" fill="' + p.ink + '">' + SW.esc(t) + '</text>'; ly += 16; });
      });
      return o + '</svg>';
    }
    var SCREEN = { bg: 'none', ink: 'var(--g-text)', dim: 'var(--g-muted)' };
    function paint() {
      if (!groups.length) return;
      // drawn to the width available, at one screen pixel to one unit
      W = Math.max(420, Math.round(plot.clientWidth || 720));
      H = Math.round(Math.min(Math.max(W * 0.42, 340), 640)) + 60;
      plot.innerHTML = SW.displaySVG(svg(SCREEN));
      var el = SW.$('svg', plot); el.removeAttribute('width'); el.removeAttribute('height'); el.style.width = '100%'; el.style.height = 'auto'; el.style.display = 'block';
    }
    var lastW = 0, rsT = null;
    if (root.ResizeObserver) new ResizeObserver(function () {
      var w = plot.clientWidth; if (!w || Math.abs(w - lastW) < 8) return; lastW = w;
      clearTimeout(rsT); rsT = setTimeout(paint, 80);
    }).observe(plot);
    plot.addEventListener('mousemove', function (e) {
      var el = SW.$('svg', plot); if (!el) return;
      var r = el.getBoundingClientRect(), x = (e.clientX - r.left) / r.width * W;
      var s = (x - L) / (W - L - R) * st.range; if (s < 0 || s > st.range) { read.innerHTML = '&nbsp;'; return; }
      var i = Math.max(0, Math.round(s / STEP) - 1);
      read.innerHTML = SW.esc((i + 1) * STEP + ' points: ') + shown().map(function (gp) { var g = gp.c.g[i]; return '<span style="color:' + gp.ink + '">' + SW.esc(vname(gp.vs[0])) + (gp.vs.length > 1 ? ' +' + (gp.vs.length - 1) : '') + ' ' + (g == null ? 'captured' : g.toFixed(0)) + '</span>'; }).join(' · ');
    });
    SW.$('.grav-exp', card).appendChild(SW.figureButtons(function (p) { return svg(p); }, 'spacewar-gravity', function () { return SW.refsOf([].concat.apply([], shown().map(function (gp) { return gp.vs.map(function (v) { return v.id; }); }))); }));
    run();
    var stopWell = G.well(b, host);
    return function () { stopped = true; stopWell(); };
  };

  // The well: the pull over the whole screen as a sheet pressed down by it,
  // after Norbert Landsteiner's picture. A grid over the 1024 by 1024 raster,
  // each line sampled every 4 screen points; each point sinks by its pull,
  // to a floor, and a captured point sinks to the floor. Drawn in an oblique
  // view inside the round tube. Every version's well is worked out in turn;
  // versions whose code gives the same well share one, shown small to pick,
  // and any of them can be laid over the one shown, in its own colour.
  var WELLS = {}, WSIG = {};
  function wellData(vid, lines, alive, progress) {
    var key = vid + '|' + lines;
    if (WELLS[key]) return Promise.resolve(WELLS[key]);
    return SW.build(vid).then(function (bv) {
      var P = bv.asm ? G.probe(bv) : { ok: false, why: 'not assembled' };
      if (!P.ok) return { why: P.why };
      var n = lines, step = 1024 / n, pts = [], memo = {}, flat = [], q = 0;
      for (var i = 0; i <= n; i++) {
        var c = -512 + i * step, a = [], bL = [];
        for (var t = -512; t <= 512; t += 4) { a.push([c, t]); bL.push([t, c]); }
        pts.push(a, bL);
      }
      pts.forEach(function (L) { L.forEach(function (p) { flat.push(p); }); });
      function clip(v) { return Math.round(Math.max(-511.99, Math.min(511.99, v)) * 256); }
      return new Promise(function (res) {
        (function chunk() {
          if (!alive()) return;
          var end = Math.min(flat.length, q + 1500);
          for (; q < end; q++) {
            var p = flat[q], k = p[0] + ',' + p[1];
            if (!(k in memo)) memo[k] = P.at(clip(p[0]), clip(p[1]));
            p[2] = memo[k];
          }
          if (progress) progress(q / flat.length);
          if (q < flat.length) { setTimeout(chunk, 0); return; }
          var h = 5381, keys = Object.keys(memo).sort();
          keys.forEach(function (k2) { var v = memo[k2], t2 = v === null ? 'c' : isNaN(v) ? 'n' : v.toFixed(2); for (var z = 0; z < t2.length; z++) h = ((h * 33) ^ t2.charCodeAt(z)) >>> 0; });
          WSIG[key] = h.toString(36);
          res(WELLS[key] = pts);
        })();
      });
    });
  }
  // The fall: the version's own game run with no controls, the two ships'
  // positions read at the start of every frame (at ml0) until both have
  // exploded, and the pull under each (for its height on the sheet).
  var FALLS = {};
  G.fall = function (vid, alive, progress) {
    if (FALLS[vid]) return Promise.resolve(FALLS[vid]);
    return SW.build(vid).then(function (b) {
      var S = b.sym, need = ['ml0', 'mtb', 'nx1', 'ny1', 'mex'];
      if (!b.asm || need.some(function (n) { return !S[n]; })) return { why: 'the object table or the main loop is not where 3.1 has them' };
      var P = G.probe(b);
      var cpu = new root.PDP1CPU.PDP1(SW.cpuOpts(b.v)); cpu.load(b.asm.memory, b.asm.start); cpu.tw = 0; cpu.control = 0;
      var mem = cpu.mem, ml0 = S.ml0.val, mtb = S.mtb.val, nx = S.nx1.val, ny = S.ny1.val, bang = 0o400000 | S.mex.val,
          own = [S.ss1 ? S.ss1.val : -1, S.ss2 ? S.ss2.val : -1];
      // a ship has gone up once its object runs anything but its own routine
      // (the explosion, or nothing when the explosion is over)
      function gone(i) { var w = mem[mtb + i]; return own[i] >= 0 ? (w & 0o7777) !== own[i] : w === bang; }
      var frames = [], c0 = cpu.cycles, n = 0, after = -1, LIM = 60 * 200000;
      function pos(v) { return s18(v) / 256; }
      return new Promise(function (res) {
        (function chunk() {
          if (!alive()) return;
          for (var k = 0; k < 150000 && !cpu.halted; k++) {
            if (cpu.pc === ml0 && ++n > 2) {
              var f = { t: (cpu.cycles - c0) / 200000, s: [] };
              for (var i = 0; i < 2; i++) f.s.push({ x: pos(mem[nx + i]), y: pos(mem[ny + i]), boom: gone(i) });
              frames.push(f);
              if (after < 0 && f.s[0].boom && f.s[1].boom) after = frames.length;
            }
            cpu.step();
            if (after > 0 && frames.length > after + 40) break;
            if (cpu.cycles - c0 > LIM) break;
          }
          if (progress) progress(Math.min(1, (cpu.cycles - c0) / LIM));
          if (!(after > 0 && frames.length > after + 40) && cpu.cycles - c0 <= LIM && !cpu.halted) { setTimeout(chunk, 0); return; }
          // once a ship has gone up it stays so; the pull under each ship while it flies
          frames.forEach(function (f, j) { f.s.forEach(function (q, i) {
            if (j && frames[j - 1].s[i].boom) q.boom = true;
            q.g = P.ok && !q.boom ? P.at(Math.round(Math.max(-511.99, Math.min(511.99, q.x)) * 256), Math.round(Math.max(-511.99, Math.min(511.99, q.y)) * 256)) : 0;
            if (q.g === null || isNaN(q.g)) q.g = 0;
          }); });
          res(FALLS[vid] = { frames: frames, fps: frames.length > 1 ? (frames.length - 1) / (frames[frames.length - 1].t - frames[0].t) : 30 });
        })();
      });
    });
  };

  G.well = function (b, host) {
    var P0 = SW.store.get('well', {}) || {};
    var st = { v: P0.v || b.v.id, lines: P0.lines || 24, tilt: P0.tilt || 64, depth: P0.depth || 50, scale: P0.scale || 'sqrt', over: P0.over || [], star: P0.star !== false, rot: P0.rot || 0 };
    function keep() { SW.store.set('well', st); }
    var vs = V.VERSIONS.filter(function (v) { return v.build; }).sort(function (a, c) { return a.sort - c.sort; });
    if (!vs.some(function (v) { return v.id === st.v; })) st.v = '3.1';
    var card = SW.el('div', { class: 'card grav well', style: 'grid-column:1/-1' });
    card.innerHTML = '<h4>The well</h4>' +
      '<p class="hint">The pull over the whole screen as a sheet, each point sunk by the pull there and captured points to the floor, worked out by each version’s own code. After Norbert Landsteiner’s picture. Drag the well to turn it.</p>' +
      '<div class="well-row">' +
        '<div class="well-main"><div class="well-plot"></div><p class="well-note hint">&nbsp;</p>' +
          '<div class="well-view">' +
            '<label>Tilt <input type="range" data-w="tilt" min="25" max="100" step="1"></label>' +
            '<label>Rotate <input type="range" data-w="rot" min="-180" max="180" step="1"></label>' +
            '<label>Depth <input type="range" data-w="depth" min="10" max="100" step="1"></label>' +
            '<label>Lines <select data-w="lines"><option value="16">16</option><option value="24">24</option><option value="32">32</option><option value="48">48</option></select></label>' +
            '<label>Depth by <select data-w="scale"><option value="sqrt">√ pull</option><option value="lin">pull</option></select></label>' +
            '<label title="A small sun at the star’s place, on the sheet at rest"><input type="checkbox" data-w="star"> Mark the star</label>' +
            '<span class="grav-exp"></span></div></div>' +
        '<div class="well-side">' +
          '<h5>Wells</h5><p class="hint">Versions whose code gives the same well share one. Click one to show it; tick Overlay to lay it over the one shown.</p><div class="well-thumbs"></div>' +
          '<h5>The ships falling</h5><p class="hint">Each version’s game run with no controls: the Needle (white) and the Wedge (red) left alone at their starting corners.</p>' +
          '<div class="well-play"><button class="btn" data-w="play" title="Follow the two ships down the sheet as this version’s game runs them">▶ Show the ships falling</button> <button class="btn ghost" data-w="again" title="From the start">↺</button> ' +
            '<label>Speed <select data-w="speed"><option value="0.5">half</option><option value="1">as played</option><option value="2">double</option><option value="4">four times</option></select></label></div>' +
          '<div class="hint mono well-t0">&nbsp;</div><div class="well-falls"></div>' +
        '</div>' +
      '</div>';
    host.appendChild(card);
    SW.$('[data-w=lines]', card).value = String(st.lines);
    foldable(card, 'well', function (f) { if (f && fall && fall.playing) stopPlay(); });
    SW.$('[data-w=tilt]', card).value = st.tilt; SW.$('[data-w=depth]', card).value = st.depth; SW.$('[data-w=scale]', card).value = st.scale; SW.$('[data-w=star]', card).checked = st.star; SW.$('[data-w=rot]', card).value = st.rot;
    var plot = SW.$('.well-plot', card), note = SW.$('.well-note', card), thumbs = SW.$('.well-thumbs', card);
    var stopped = false, job = 0, groups = [];   // groups: {sig, vs, pts, ink}
    function alive(my) { return function () { return !stopped && my === job; }; }
    function groupOf(vid) { return groups.filter(function (g) { return g.vs.some(function (v) { return v.id === vid; }); })[0]; }

    // every version's well, in turn; the one shown first
    function sampleAll() {
      var my = ++job; groups = []; thumbs.innerHTML = '';
      // only the wells for the number of lines shown are kept
      Object.keys(WELLS).forEach(function (k) { if (!new RegExp('\\|' + st.lines + '$').test(k)) { delete WELLS[k]; delete WSIG[k]; } });
      var order = [V.byId(st.v)].concat(vs.filter(function (v) { return v.id !== st.v; })), i = 0, seen = {};
      note.textContent = 'Running the gravity code over the screen…';
      (function next() {
        if (!alive(my)()) return;
        if (i >= order.length) { note.textContent = caption(); fallsAll(my); return; }
        var v = order[i++];
        wellData(v.id, st.lines, alive(my), function (f) { note.textContent = 'Working out the wells: ' + vname(v) + ' ' + Math.round(f * 100) + '% (' + i + ' of ' + order.length + ')'; }).then(function (pts) {
          if (!alive(my)()) return;
          if (pts && !pts.why) {
            var sig = WSIG[v.id + '|' + st.lines];
            if (seen[sig]) { seen[sig].vs.push(v); seen[sig].vs.sort(function (a, c) { return a.sort - c.sort; }); }
            else { seen[sig] = { sig: sig, vs: [v], pts: pts }; groups.push(seen[sig]); }
            // colours in the order of the versions, as the curves above have them
            groups.sort(function (a, c) { return a.vs[0].sort - c.vs[0].sort; });
            groups.forEach(function (g, n) { g.ink = INK[n % INK.length]; });
            paintThumbs(); paint();
          }
          setTimeout(next, 0);
        });
      })();
    }
    // when and where each version's ships go up, worked out after the wells
    var fallsBox = SW.$('.well-falls', card);
    function whereOf(q) { var r = Math.hypot(q.x, q.y); return r > 480 ? 'corner' : r < 40 ? 'centre' : Math.round(r) + ' points out'; }
    function fallRow(v) {
      var d = FALLS[v.id], gp = groupOf(v.id), n = groups.indexOf(gp), cell;
      if (!d) cell = '<td colspan="2" class="faint">…</td>';
      else if (d.why) cell = '<td colspan="2" class="faint">' + SW.esc(d.why) + '</td>';
      else {
        var F = d.frames, j = F.findIndex(function (f) { return f.s[0].boom || f.s[1].boom; });
        if (j < 0) cell = '<td class="num faint">none</td><td class="faint">in ' + Math.round(F[F.length - 1].t) + ' s</td>';
        else { var q = F[Math.max(0, j - 1)].s[F[j].s[0].boom ? 0 : 1], pre = F.slice(0, j).some(function (f, k) { return k && Math.abs(f.s[0].x - F[k - 1].s[0].x) > 200; });
          cell = '<td class="num">' + F[j].t.toFixed(1) + ' s</td><td>' + whereOf(q) + (pre ? ' (captured)' : ' (collision)') + '</td>'; }
      }
      return '<tr data-v="' + v.id + '"' + (v.id === st.v ? ' class="on"' : '') + '><td class="well-tl">' + (gp ? '<i style="background:' + gp.ink + '"></i>' + String.fromCharCode(65 + n) : '') + '</td><td>' + SW.esc(vname(v)) + '</td>' + cell + '</tr>';
    }
    function paintFalls() {
      var rows = vs.filter(function (v) { return groupOf(v.id); });
      fallsBox.innerHTML = '<table class="ov-sub well-t well-ft"><thead><tr><th>Well</th><th>Version</th><th>Explode</th><th>Where</th></tr></thead><tbody>' + rows.map(fallRow).join('') + '</tbody></table>';
    }
    fallsBox.addEventListener('click', function (e) {
      var tr = e.target.closest('tr[data-v]'); if (!tr) return;
      if (fall.data) { stopPlay(); fall.data = null; fall.i = null; }
      st.v = tr.dataset.v; keep(); paintThumbs(); paint(); paintFalls(); play(true);
    });
    function fallsAll(my) {
      var rows = vs.filter(function (v) { return groupOf(v.id); }), i = 0;
      paintFalls();
      (function next() {
        if (!alive(my)() || i >= rows.length) return;
        var v = rows[i++];
        G.fall(v.id, alive(my)).then(function () { if (!alive(my)()) return; paintFalls(); setTimeout(next, 0); });
      })();
    }
    function caption() {
      var g = groupOf(st.v), ov = shownGroups().length - 1;
      return (V.byId(st.v) ? V.byId(st.v).label : st.v) + (g && g.vs.length > 1 ? ' (the same well as ' + (g.vs.length - 1) + ' other' + (g.vs.length > 2 ? 's' : '') + ')' : '') + ' · ' + st.lines + ' lines each way · depth by ' + (st.scale === 'lin' ? 'the pull' : 'the square root of the pull') + ', to the floor where the ship is captured' + (ov > 0 ? ' · ' + ov + ' overlaid' : '');
    }
    // the wells drawn: the one shown, and those overlaid
    function shownGroups() {
      var main = groupOf(st.v), out = main ? [main] : [];
      st.over.forEach(function (id) { var g = groupOf(id); if (g && out.indexOf(g) < 0) out.push(g); });
      return out;
    }
    var CYAN = '#39c5e0';
    // the small wells keep one view; the large one takes the controls
    var FIXED = { tilt: 28, depth: 50, scale: 'sqrt', rot: -27, star: false };
    function proj(N, w) {
      w = w || st;
      var h = N * 0.33, fore = w.tilt / 100, shear = 0.16, cx = N / 2, cy = N * 0.44, dk = w.depth / 50, floor = N * 0.42,
          ra = w.rot * Math.PI / 180, co = Math.cos(ra), si = Math.sin(ra);
      function depth(g) { return g === null ? floor : isNaN(g) ? 0 : Math.min(floor, w.scale === 'lin' ? g / 256 * N * 0.02 * dk : Math.sqrt(g / 256) * N * 0.035 * dk); }
      function at(x, y, d) {
        var u0 = x / 512, v0 = y / 512, u = u0 * co - v0 * si, v = u0 * si + v0 * co;
        return [cx + u * h - v * h * shear, cy - v * h * fore + d, d];
      }
      return { floor: floor, depth: depth, at: at, f: function (x, y, g) { return at(x, y, depth(g)); } };
    }
    function segs(N, pts, w) {
      var pr = proj(N, w), out = [];
      pts.forEach(function (L) {
        var prev = null;
        L.forEach(function (p) {
          var q = pr.f(p[0], p[1], p[2]);
          if (prev) { var d = Math.max(prev[2], q[2]); out.push([prev[0], prev[1], q[0], q[1], Math.max(0.1, 1 - d / pr.floor * 0.9)]); }
          prev = q;
        });
      });
      return out;
    }
    function inkOf(g) { return g.ink || CYAN; }
    var SUN = '#ffce7a';
    // the star's mark: eight short rays round a point, at the sheet's level
    function sunRays(N, w) {
      var c = proj(N, w).f(0, 0, 0), r0 = Math.max(1.5, N / 200), r1 = Math.max(4, N / 55), out = [];
      for (var a = 0; a < 8; a++) { var t = a * Math.PI / 4, k = a % 2 ? 0.6 : 1; out.push([c[0] + Math.cos(t) * r0, c[1] + Math.sin(t) * r0 * 0.7, c[0] + Math.cos(t) * r1 * k, c[1] + Math.sin(t) * r1 * k * 0.7]); }
      return out;
    }
    function drawTo(canvas, N, gs, lw, w) {
      w = w || st;
      var dpr = root.devicePixelRatio || 1, g = canvas.getContext('2d');
      canvas.width = Math.round(N * dpr); canvas.height = Math.round(N * dpr); canvas.style.width = N + 'px'; canvas.style.height = N + 'px';
      g.scale(dpr, dpr);
      g.fillStyle = '#000'; g.beginPath(); g.arc(N / 2, N / 2, N / 2, 0, 6.2832); g.fill(); g.save(); g.clip();
      g.lineWidth = lw;
      // the runs of each well by opacity, one path each, so that turning it stays smooth
      gs.forEach(function (gp) {
        g.strokeStyle = inkOf(gp);
        var by = {};
        segs(N, gp.pts, w).forEach(function (s) { var k = Math.round(s[4] * 10); (by[k] = by[k] || []).push(s); });
        Object.keys(by).forEach(function (k) {
          g.globalAlpha = k / 10 * (gs.length > 1 ? 0.85 : 1); g.beginPath();
          by[k].forEach(function (s) { g.moveTo(s[0], s[1]); g.lineTo(s[2], s[3]); });
          g.stroke();
        });
      });
      g.globalAlpha = 1;
      if (w.star) { g.strokeStyle = SUN; g.lineWidth = Math.max(1, N / 400); sunRays(N, w).forEach(function (r) { g.beginPath(); g.moveTo(r[0], r[1]); g.lineTo(r[2], r[3]); g.stroke(); }); }
      g.restore();
    }
    function paint() {
      var gs = shownGroups(); if (!gs.length) return;
      // small enough that the controls fit on the screen with it
      var N = Math.round(Math.max(300, Math.min(560, plot.clientWidth || 560, (root.innerHeight || 900) - 300)));
      plot.innerHTML = '<div class="well-tube" style="width:' + N + 'px;height:' + N + 'px"><canvas></canvas></div>';
      var cv = SW.$('canvas', plot);
      drawTo(cv, N, gs, 1);
      sheet = { N: N, img: document.createElement('canvas') };
      sheet.img.width = cv.width; sheet.img.height = cv.height; sheet.img.getContext('2d').drawImage(cv, 0, 0);
      if (fall.data && fall.i != null) ships(fall.i);
      if (!/Working out/.test(note.textContent)) note.textContent = caption();
    }
    // the ships over the sheet at frame i of the recorded fall
    var sheet = null, fall = { data: null, i: null, playing: false, raf: 0, t0: 0, i0: 0 };
    var NEEDLE = '#e6f4ff', WEDGE = '#ff7a6b';
    function ships(i) {
      var cv = SW.$('canvas', plot); if (!cv || !sheet || !fall.data) return;
      var F = fall.data.frames, N = sheet.N, dpr = cv.width / N, g = cv.getContext('2d'), pr = proj(N), W = WELLS[st.v + '|' + st.lines];
      // the sheet's height under a point, as drawn: from the two grid lines on
      // either side in each direction, each read between its samples, the
      // nearer lines counting for more
      function sheetDepth(x, y) {
        if (!W) return 0;
        var n = st.lines, step = 1024 / n;
        function along(line, t) { var k = (Math.max(-512, Math.min(512, t)) + 512) / 4, k0 = Math.floor(k), k1 = Math.min(line.length - 1, k0 + 1), f = k - k0; return pr.depth(line[k0][2]) * (1 - f) + pr.depth(line[k1][2]) * f; }
        function pair(c, t, fam) { var q = (Math.max(-512, Math.min(512, c)) + 512) / step, i0 = Math.min(n - 1, Math.floor(q)), f = q - i0; return [along(W[2 * i0 + fam], t) * (1 - f) + along(W[2 * (i0 + 1) + fam], t) * f, Math.min(f, 1 - f)]; }
        var a = pair(x, y, 0), b = pair(y, x, 1), wa = 1 - a[1] * 2 + 0.001, wb = 1 - b[1] * 2 + 0.001;
        return (a[0] * wa + b[0] * wb) / (wa + wb);
      }
      i = Math.max(0, Math.min(F.length - 1, i));
      g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.drawImage(sheet.img, 0, 0);
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.save(); g.beginPath(); g.arc(N / 2, N / 2, N / 2, 0, 6.2832); g.clip();
      [0, 1].forEach(function (k) {
        var ink = k ? WEDGE : NEEDLE, at = function (j) { var q = F[j].s[k]; return pr.at(q.x, q.y, sheetDepth(q.x, q.y)); },
            flat = function (j) { var q = F[j].s[k]; return pr.at(q.x, q.y, 0); };
        var bj = -1; for (var j = 0; j <= i; j++) if (F[j].s[k].boom) { bj = j; break; }
        var last = bj >= 0 ? bj - 1 : i;
        // the trail, faint, broken where the ship jumps (caught by the star and moved to the corner)
        g.strokeStyle = ink; g.lineWidth = 1.2; g.globalAlpha = 0.45; g.beginPath();
        for (var j2 = 0; j2 <= last; j2++) { var p = at(j2), q0 = j2 ? F[j2 - 1].s[k] : null, q1 = F[j2].s[k];
          if (!j2 || Math.abs(q1.x - q0.x) + Math.abs(q1.y - q0.y) > 200) g.moveTo(p[0], p[1]); else g.lineTo(p[0], p[1]); }
        g.stroke(); g.globalAlpha = 1;
        if (bj >= 0 && i >= bj) {
          // the explosion: rays that grow and fade
          // (and after it, a small cross where it happened)
          var c = at(Math.max(0, bj - 1)), age = i - bj, r = 4 + Math.min(age, 40) * 1.2, a = Math.max(0.35, 1 - age / 40);
          if (age > 40) r = 5;
          g.globalAlpha = a; g.strokeStyle = ink; g.lineWidth = 1.4;
          for (var t = 0; t < 12; t++) { var an = t * Math.PI / 6 + k * 0.26; g.beginPath(); g.moveTo(c[0] + Math.cos(an) * r * 0.35, c[1] + Math.sin(an) * r * 0.35); g.lineTo(c[0] + Math.cos(an) * r, c[1] + Math.sin(an) * r); g.stroke(); }
          g.globalAlpha = 1; return;
        }
        // the ship, pointing the way it is going
        var p1 = at(last), f1 = flat(last), f0 = flat(Math.max(0, last - 3)), dx = f1[0] - f0[0], dy = f1[1] - f0[1], m = Math.hypot(dx, dy);
        if (m < 0.01) { var c0 = pr.at(0, 0, 0); dx = c0[0] - f1[0]; dy = c0[1] - f1[1]; m = Math.hypot(dx, dy) || 1; }
        dx /= m; dy /= m;
        var L = Math.max(7, N / 60);
        g.fillStyle = ink; g.strokeStyle = ink;
        if (!k) { g.lineWidth = 2; g.beginPath(); g.moveTo(p1[0] - dx * L, p1[1] - dy * L); g.lineTo(p1[0] + dx * L * 0.6, p1[1] + dy * L * 0.6); g.stroke(); }
        else { g.beginPath(); g.moveTo(p1[0] + dx * L * 0.7, p1[1] + dy * L * 0.7); g.lineTo(p1[0] - dx * L * 0.6 - dy * L * 0.45, p1[1] - dy * L * 0.6 + dx * L * 0.45); g.lineTo(p1[0] - dx * L * 0.6 + dy * L * 0.45, p1[1] - dy * L * 0.6 - dx * L * 0.45); g.closePath(); g.fill(); }
      });
      g.restore();
      var f = F[i], ev = [];
      [0, 1].forEach(function (k) { var nm = k ? 'Wedge' : 'Needle', q = f.s[k], pq = i ? F[i - 1].s[k] : q; if (q.boom) ev.push(nm + ' exploded'); else if (Math.abs(q.x) > 500 && Math.abs(q.y) > 500 && i && Math.abs(q.x - pq.x) > 200) ev.push(nm + ' caught by the star, moved to the corner'); });
      SW.$('.well-t0', card).textContent = f.t.toFixed(1) + ' s' + (ev.length ? ' · ' + ev.join(' · ') : '');
    }
    function tick(now) {
      if (!fall.playing) return;
      if (!card.isConnected || card.offsetParent === null) { stopPlay(); return; }
      var sp = +SW.$('[data-w=speed]', card).value || 1, i = fall.i0 + Math.floor((now - fall.t0) / 1000 * fall.data.fps * sp);
      if (i >= fall.data.frames.length - 1) { i = fall.data.frames.length - 1; stopPlay(); }
      fall.i = i; ships(i);
      if (fall.playing) fall.raf = requestAnimationFrame(tick);
    }
    function stopPlay() { fall.playing = false; cancelAnimationFrame(fall.raf); SW.$('[data-w=play]', card).textContent = '▶ Show the ships falling'; }
    function play(fromStart) {
      if (fall.playing && !fromStart) { stopPlay(); return; }
      var vid = st.v, btn = SW.$('[data-w=play]', card);
      btn.textContent = 'Running the game…';
      G.fall(vid, function () { return !stopped; }, function (f) { btn.textContent = 'Running the game… ' + Math.round(f * 100) + '%'; }).then(function (d) {
        if (stopped || vid !== st.v) { stopPlay(); return; }
        if (!d || d.why) { btn.textContent = '▶ Show the ships falling'; note.textContent = 'The fall: ' + (d ? d.why : 'no result') + '.'; return; }
        fall.data = d;
        if (fromStart || fall.i == null || fall.i >= d.frames.length - 1) fall.i = 0;
        fall.i0 = fall.i; fall.t0 = performance.now(); fall.playing = true; btn.textContent = '⏸ Pause';
        fall.raf = requestAnimationFrame(tick);
      });
    }
    function paintThumbs() {
      var main = groupOf(st.v), shown = shownGroups();
      thumbs.innerHTML = '';
      var row = SW.el('div', { class: 'well-thumbrow' });
      function pick(gp) { if (fall.data) { stopPlay(); fall.data = null; fall.i = null; SW.$('.well-t0', card).textContent = ''; } if (groupOf(st.v) !== gp) st.v = gp.vs[0].id; if (fallsBox.firstChild) paintFalls(); st.over = st.over.filter(function (id) { return groupOf(id) !== gp; }); keep(); paintThumbs(); paint(); }
      function overlay(gp, on) {
        var ids = gp.vs.map(function (v) { return v.id; });
        st.over = st.over.filter(function (id) { return ids.indexOf(id) < 0; });
        if (on) st.over.push(gp.vs[0].id);
        keep(); paint(); paintThumbs();
      }
      groups.forEach(function (gp, n) {
        var t = SW.el('div', { class: 'well-thumb' + (gp === main ? ' on' : '') });
        var cv = SW.el('canvas', { title: 'Show well ' + String.fromCharCode(65 + n) + ': ' + gp.vs.map(vname).join(', ') });
        t.appendChild(cv);
        t.appendChild(SW.el('div', { class: 'well-tn' }, '<i style="background:' + gp.ink + '"></i>Well ' + String.fromCharCode(65 + n)));
        cv.onclick = function () { pick(gp); };
        row.appendChild(t);
        drawTo(cv, 88, [gp], 0.5, FIXED);
      });
      thumbs.appendChild(row);
      // which versions each well stands for, and whether it is laid over the one shown
      var tb = SW.el('table', { class: 'ov-sub well-t' });
      tb.innerHTML = '<thead><tr><th>Well</th><th>Versions</th><th title="Lay this well over the one shown">Overlay</th></tr></thead><tbody>' +
        groups.map(function (gp, n) {
          var on = gp === main, over = !on && shown.indexOf(gp) >= 0;
          return '<tr data-gi="' + n + '"' + (on ? ' class="on"' : '') + '><td class="well-tl"><i style="background:' + gp.ink + '"></i>' + String.fromCharCode(65 + n) + '</td><td>' +
            gp.vs.map(function (v) { return '<span>' + SW.esc(vname(v)) + '</span>'; }).join(', ') + '</td><td class="num">' +
            (on ? '<span class="faint" title="The well shown">shown</span>' : '<input type="checkbox"' + (over ? ' checked' : '') + '>') + '</td></tr>';
        }).join('') + '</tbody>';
      tb.addEventListener('change', function (e) { var tr = e.target.closest('[data-gi]'); if (tr) overlay(groups[+tr.dataset.gi], e.target.checked); });
      tb.addEventListener('click', function (e) { var tr = e.target.closest('[data-gi]'); if (tr && e.target.tagName !== 'INPUT' && groups[+tr.dataset.gi] !== main) pick(groups[+tr.dataset.gi]); });
      thumbs.appendChild(tb);
    }
    function svg(p) {
      var N = 600, gs = shownGroups(), o = ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + N + ' ' + N + '" width="' + N + '" height="' + N + '" font-family="IBM Plex Mono, monospace" font-size="9"><defs><clipPath id="tube"><circle cx="' + N / 2 + '" cy="' + N / 2 + '" r="' + N / 2 + '"/></clipPath></defs><circle cx="' + N / 2 + '" cy="' + N / 2 + '" r="' + N / 2 + '" fill="#000"/><g clip-path="url(#tube)" stroke-width="1" fill="none">'];
      gs.forEach(function (gp) {
        var by = {};
        segs(N, gp.pts).forEach(function (s) { var k = (Math.round(s[4] * 10) / 10).toFixed(1); (by[k] = by[k] || []).push('M' + s[0].toFixed(1) + ' ' + s[1].toFixed(1) + 'L' + s[2].toFixed(1) + ' ' + s[3].toFixed(1)); });
        Object.keys(by).forEach(function (k) { o.push('<path d="' + by[k].join('') + '" stroke="' + inkOf(gp) + '" stroke-opacity="' + k + '"/>'); });
      });
      o.push('</g>');
      if (st.star) o.push('<path d="' + sunRays(N).map(function (r) { return 'M' + r[0].toFixed(1) + ' ' + r[1].toFixed(1) + 'L' + r[2].toFixed(1) + ' ' + r[3].toFixed(1); }).join('') + '" stroke="' + SUN + '" stroke-width="1.5"/>');
      // the versions drawn, small in the bottom right-hand corner, each with its colour
      gs.slice().reverse().forEach(function (gp, n) {
        var y = N - 6 - n * 12, names = gp.vs.map(vname), t = names.length > 3 ? names[0] + ', ' + names[1] + ' … ' + names[names.length - 1] + ' (' + names.length + ')' : names.join(', ');
        o.push('<text x="' + (N - 4) + '" y="' + y + '" fill="' + p.ink + '" text-anchor="end">' + SW.esc(t) + '</text><line x1="' + (N - 10 - t.length * 5.45) + '" y1="' + (y - 3) + '" x2="' + (N - 20 - t.length * 5.45) + '" y2="' + (y - 3) + '" stroke="' + gp.ink + '" stroke-width="2"/>');
      });
      return o.join('') + '</svg>';
    }
    card.addEventListener('click', function (e) {
      var t = e.target.closest('[data-w=play], [data-w=again]'); if (!t) return;
      play(t.dataset.w === 'again');
    });
    card.addEventListener('change', function (e) {
      var k = e.target.dataset && e.target.dataset.w; if (!k) return;
      if (k === 'speed' && fall.playing) { fall.i0 = fall.i; fall.t0 = performance.now(); }
      if (k === 'lines') { st.lines = +e.target.value; keep(); sampleAll(); }
      if (k === 'scale') { st.scale = e.target.value; keep(); paint(); }
      if (k === 'star') { st.star = e.target.checked; keep(); paint(); }
    });
    card.addEventListener('input', function (e) {
      var k = e.target.dataset && e.target.dataset.w; if (k !== 'tilt' && k !== 'depth' && k !== 'rot') return;
      st[k] = +e.target.value; keep(); paint();
    });
    SW.$('.grav-exp', card).appendChild(SW.figureButtons(function (p) { return svg(p); }, 'spacewar-gravity-well', function () { return SW.refsOf([].concat.apply([], shownGroups().map(function (gp) { return gp.vs.map(function (v) { return v.id; }); }))); }));
    var drag = null, raf = 0;
    plot.addEventListener('pointerdown', function (e) {
      if (!SW.$('canvas', plot)) return;
      drag = { x: e.clientX, y: e.clientY, rot: st.rot, tilt: st.tilt }; plot.setPointerCapture(e.pointerId); e.preventDefault();
    });
    plot.addEventListener('pointermove', function (e) {
      if (!drag) return;
      st.rot = Math.round(((drag.rot + (e.clientX - drag.x) * 0.5) % 360 + 540) % 360 - 180);
      st.tilt = Math.max(25, Math.min(100, Math.round(drag.tilt - (e.clientY - drag.y) * 0.25)));
      SW.$('[data-w=rot]', card).value = st.rot; SW.$('[data-w=tilt]', card).value = st.tilt;
      if (!raf) raf = requestAnimationFrame(function () { raf = 0; paint(); });
    });
    function endDrag() { if (!drag) return; drag = null; keep(); }
    plot.addEventListener('pointerup', endDrag); plot.addEventListener('pointercancel', endDrag);
    var lastW = 0;
    if (root.ResizeObserver) new ResizeObserver(function () { var w = plot.clientWidth; if (w && Math.abs(w - lastW) > 8) { lastW = w; paint(); } }).observe(plot);
    sampleAll();
    return function () { stopped = true; stopPlay(); };
  };
})(this);
