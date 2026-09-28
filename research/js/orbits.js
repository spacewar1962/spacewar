/*
 * orbits.js - the ships set circling the star, from each version's own code.
 * The game is run on the emulator from its start; once it is going, both
 * ships are put on opposite sides of the star at one distance, moving at the
 * speed that the version's own pull there would hold in a circle, and the
 * game is left to run. Every frame the ships' positions are read from the
 * object table, the pull under each from the version's gravity code, and
 * once a second the ships' outlines as the program draws them. The same
 * engine (SW.orbits.run) takes a script of controls, for manoeuvres.
 */
(function (root) {
  'use strict';
  var SW = root.SW, V = root.SWVersions;
  var O = SW.orbits = {};
  var RUNS = {};
  function s18(v) { return v & 0o400000 ? -(v ^ 0o777777) : v; }
  function u18(v) { v = Math.round(v); return v < 0 ? (-v) ^ 0o777777 : v & 0o777777; }
  function vname(v) { return v.label.replace(/^Spacewar! /, ''); }

  // Run a version's game with a scenario: sc.key (for the cache), sc.setup(mem, S, P)
  // once the game is going, sc.control(frame) for the control boxes, sc.frames to run,
  // sc.strobe (frames between the outlines kept). Resolves with {frames, fps} or {why}.
  O.run = function (vid, sc, alive, progress) {
    var key = vid + '|' + sc.key;
    if (RUNS[key]) return Promise.resolve(RUNS[key]);
    return SW.build(vid).then(function (b) {
      var S = b.sym, need = ['ml0', 'ml1', 'mtb', 'nx1', 'ny1', 'ndx', 'ndy'];
      if (!b.asm || need.some(function (n) { return !S[n]; })) return { why: 'the object table or the main loop is not where 3.1 has them' };
      var P = SW.gravity.probe(b);
      var cpu = new root.PDP1CPU.PDP1({ mdv: b.v.mdv }); cpu.load(b.asm.memory, b.asm.start); cpu.tw = 0; cpu.control = 0;
      var mem = cpu.mem, ml0 = S.ml0.val, ml1 = S.ml1.val, mtb = S.mtb.val, nx = S.nx1.val, ny = S.ny1.val,
          own = [S.ss1 ? S.ss1.val : -1, S.ss2 ? S.ss2.val : -1];
      function gone(i) { return own[i] >= 0 && (mem[mtb + i] & 0o7777) !== own[i]; }
      var frames = [], n = 0, started = false, c0 = 0, grab = null, after = -1;
      // the points each ship's routine puts on the screen, in frames being kept
      cpu.onDisplay = function (x, y) {
        if (!grab) return;
        var k = (mem[ml1] & 0o7777) - mtb;
        if (k === 0 || k === 1) grab[k].push(x, y);
      };
      return new Promise(function (res) {
        (function chunk() {
          if (!alive()) return;
          for (var q = 0; q < 150000 && !cpu.halted; q++) {
            if (cpu.pc === ml0) {
              n++;
              if (n === 3 && !started) { started = true; if (sc.setup) sc.setup(mem, S, P, u18); c0 = cpu.cycles; }
              if (started) {
                var j = frames.length;
                if (grab && j) frames[j - 1].pts = grab;
                var f = { t: (cpu.cycles - c0) / 200000, s: [] };
                for (var i = 0; i < 2; i++) f.s.push({ x: s18(mem[nx + i]) / 256, y: s18(mem[ny + i]) / 256, dx: s18(mem[S.ndx.val + i]), dy: s18(mem[S.ndy.val + i]), gone: gone(i) });
                frames.push(f);
                grab = sc.strobe && j % sc.strobe === 0 ? [[], []] : null;
                if (sc.control) { var cw = sc.control(j); cpu.control = cw; cpu.tw = cw; }
                if (after < 0 && f.s[0].gone && f.s[1].gone) after = j;
                if (j >= sc.frames || (after >= 0 && j > after + 20)) break;
              }
            }
            cpu.step();
          }
          if (progress) progress(Math.min(1, frames.length / sc.frames));
          var done = frames.length > sc.frames || (after >= 0 && frames.length > after + 20) || cpu.halted;
          if (!done) { setTimeout(chunk, 0); return; }
          frames.forEach(function (f) { f.s.forEach(function (s) {
            var g = !s.gone && P.ok ? P.at(u18(Math.max(-511.99, Math.min(511.99, s.x)) * 256), u18(Math.max(-511.99, Math.min(511.99, s.y)) * 256)) : null;
            s.g = g == null || isNaN(g) ? null : g; s.r = Math.hypot(s.x, s.y);
          }); });
          var T = frames[frames.length - 1].t;
          res(RUNS[key] = { frames: frames, fps: T ? (frames.length - 1) / T : 20 });
        })();
      });
    });
  };

  // The speed that holds a circle at distance r (screen points) under the
  // version's own pull there: each frame dx grows by the pull and x by dx/8,
  // so v = sqrt(8 g r) in the units of dx, r in units of x.
  function circular(P, r) {
    var g = P.ok ? P.at(Math.round(r * 256), 0) : null;
    return g ? Math.sqrt(8 * g * r * 256) : 0;
  }
  O.orbit = function (vid, r, pct, secs, alive, progress) {
    return O.run(vid, {
      key: 'orbit|' + r + '|' + pct + '|' + secs, frames: Math.round(secs * 20), strobe: 20,
      setup: function (mem, S, P, u) {
        var v = circular(P, r) * pct / 100, nx = S.nx1.val, ny = S.ny1.val, dx = S.ndx.val, dy = S.ndy.val;
        // the Needle on the right going up, the Wedge on the left going down
        mem[nx] = u(r * 256); mem[ny] = 0; mem[dx] = 0; mem[dy] = u(v);
        mem[nx + 1] = u(-r * 256); mem[ny + 1] = 0; mem[dx + 1] = 0; mem[dy + 1] = u(-v);
      }
    }, alive, progress);
  };

  // the colours: 3.1 and 4.0 as in the gravity views, the others after
  var INK = { '3.1': '#ffb347', '4.0': '#9be36b' }, MORE = ['#39c5e0', '#e36bb3', '#b39bff', '#ff6b6b', '#6be3d0', '#d8d86b', '#f0f0f0'];
  function inkOf(vid, list) { if (INK[vid]) return INK[vid]; var i = list.filter(function (x) { return !INK[x]; }).indexOf(vid); return MORE[(i < 0 ? 0 : i) % MORE.length]; }

  O.draw = function (b, host) {
    var P0 = SW.store.get('orbits', {}) || {};
    var st = { vs: P0.vs || ['3.1', '4.0'], r: P0.r || 128, pct: P0.pct || 100, secs: P0.secs || 60, strobe: P0.strobe !== false };
    function keep() { SW.store.set('orbits', st); }
    var all = V.VERSIONS.filter(function (v) { return v.build && v.id !== '1' && v.id !== 'stars'; }).sort(function (a, c) { return a.sort - c.sort; });
    var card = SW.el('div', { class: 'card grav orb', style: 'grid-column:1/-1' });
    card.innerHTML = '<h4>Orbits ' + SW.refTag(b.v.id) + '</h4>' +
      '<p class="hint">Each version’s game run on the emulator with the two ships put on opposite sides of the star, moving at the speed its own pull there would hold in a circle, then left alone. The paths as the game computes them, the outlines as it draws them once a second, and below, the distance from the star and the pull on the ship, frame by frame.</p>' +
      '<div class="orb-row"><div class="orb-main"><canvas class="orb-cv"></canvas><div class="hint mono orb-read">&nbsp;</div></div>' +
      '<div class="orb-side">' +
        '<div class="well-view orb-ctl">' +
          '<label>Distance <select data-o="r"><option value="64">64</option><option value="96">96</option><option value="128">128</option><option value="192">192</option><option value="256">256</option></select> points</label>' +
          '<label>Speed <select data-o="pct"><option value="90">90%</option><option value="95">95%</option><option value="100">circular</option><option value="105">105%</option><option value="110">110%</option></select></label>' +
          '<label>For <select data-o="secs"><option value="30">30 s</option><option value="60">60 s</option><option value="120">2 min</option></select></label>' +
          '<label><input type="checkbox" data-o="strobe"> Outlines once a second</label>' +
          '<span class="grav-exp"></span></div>' +
        '<h5>Versions</h5><div class="orb-vs"></div>' +
      '</div></div>' +
      '<div class="orb-charts"></div>';
    host.appendChild(card);
    ['r', 'pct', 'secs'].forEach(function (k) { SW.$('[data-o=' + k + ']', card).value = String(st[k]); });
    SW.$('[data-o=strobe]', card).checked = st.strobe;
    var cv = SW.$('.orb-cv', card), charts = SW.$('.orb-charts', card), vbox = SW.$('.orb-vs', card), read = SW.$('.orb-read', card);
    var stopped = false, job = 0, got = {};
    function alive(my) { return function () { return !stopped && my === job; }; }

    function chips() {
      vbox.innerHTML = all.map(function (v) {
        var on = st.vs.indexOf(v.id) >= 0;
        return '<label class="orb-chip' + (on ? ' on' : '') + '"><input type="checkbox" data-v="' + v.id + '"' + (on ? ' checked' : '') + '><i style="background:' + inkOf(v.id, st.vs) + '"></i>' + SW.esc(vname(v)) + '</label>';
      }).join('');
    }
    function runAll() {
      var my = ++job; got = {};
      var list = st.vs.slice(), i = 0;
      paint();
      (function next() {
        if (!alive(my)()) return;
        if (i >= list.length) { read.textContent = caption(); return; }
        var vid = list[i++];
        O.orbit(vid, st.r, st.pct, st.secs, alive(my), function (f) { read.textContent = 'Running ' + vname(V.byId(vid)) + '… ' + Math.round(f * 100) + '%'; }).then(function (d) {
          if (!alive(my)()) return;
          got[vid] = d; paint(); setTimeout(next, 0);
        });
      })();
    }
    function caption() {
      return st.vs.map(function (vid) {
        var d = got[vid]; if (!d || d.why) return vname(V.byId(vid)) + ': ' + (d ? d.why : '…');
        var F = d.frames, rs = F.filter(function (f) { return !f.s[0].gone; }).map(function (f) { return f.s[0].r; }),
            lo = Math.min.apply(null, rs), hi = Math.max.apply(null, rs), end = F.findIndex(function (f) { return f.s[0].gone; });
        return vname(V.byId(vid)) + ': ' + lo.toFixed(0) + ' to ' + hi.toFixed(0) + ' points' + (end >= 0 ? ', exploded at ' + F[end].t.toFixed(1) + ' s' : '');
      }).join(' · ');
    }
    // the screen: the paths of the Needle (solid) and the Wedge (dashed), the outlines kept, the star
    function scene(g, N, pal) {
      var E = Math.min(512, st.r * 1.7), k = N / (2 * E), c = N / 2;
      function X(x) { return c + x * k; } function Y(y) { return c - y * k; }
      g.fillStyle = pal.bg; g.fillRect(0, 0, N, N);
      g.strokeStyle = pal.dim; g.lineWidth = 1; g.setLineDash([3, 4]);
      g.beginPath(); g.arc(c, c, st.r * k, 0, 6.2832); g.stroke(); g.setLineDash([]);
      g.fillStyle = pal.dim; g.font = '11px IBM Plex Mono, monospace'; g.fillText('the circle at ' + st.r + ' points', 8, N - 10);
      g.strokeStyle = '#ffce7a'; g.lineWidth = 1.2;
      for (var a = 0; a < 8; a++) { var t = a * Math.PI / 4, l = a % 2 ? 4 : 7; g.beginPath(); g.moveTo(c + Math.cos(t) * 2, c + Math.sin(t) * 2); g.lineTo(c + Math.cos(t) * l, c + Math.sin(t) * l); g.stroke(); }
      st.vs.forEach(function (vid) {
        var d = got[vid]; if (!d || d.why) return;
        var ink = inkOf(vid, st.vs), F = d.frames;
        [0, 1].forEach(function (s) {
          g.strokeStyle = ink; g.lineWidth = 1.3; g.globalAlpha = 0.9; g.setLineDash(s ? [5, 3] : []);
          g.beginPath(); var pen = false;
          F.forEach(function (f, j) {
            var q = f.s[s]; if (q.gone) { pen = false; return; }
            if (pen && j && Math.abs(q.x - F[j - 1].s[s].x) > 200) pen = false;
            if (pen) g.lineTo(X(q.x), Y(q.y)); else g.moveTo(X(q.x), Y(q.y)); pen = true;
          });
          g.stroke(); g.setLineDash([]); g.globalAlpha = 1;
          if (st.strobe) {
            g.fillStyle = ink;
            F.forEach(function (f) { if (!f.pts) return; var P = f.pts[s]; for (var i = 0; i < P.length; i += 2) g.fillRect(X(P[i]) - 0.8, Y(P[i + 1]) - 0.8, 1.6, 1.6); });
          }
        });
      });
    }
    function paint() {
      var N = Math.round(Math.max(300, Math.min(560, cv.parentNode.clientWidth || 560, (root.innerHeight || 900) - 280))), dpr = root.devicePixelRatio || 1;
      cv.width = N * dpr; cv.height = N * dpr; cv.style.width = N + 'px'; cv.style.height = N + 'px';
      var g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
      scene(g, N, { bg: '#000', dim: '#4a5a66' });
      paintCharts();
    }
    // distance from the star and the pull on the Needle, frame by frame
    function chartSVG(pal, W) {
      W = W || 900;
      var H = 150, L = 58, R = 12, T = 18, B = 26, pw = W - L - R, ph = H - T - B, runs = st.vs.filter(function (v) { return got[v] && !got[v].why; });
      if (!runs.length) return '';
      var tmax = st.secs;
      function one(title, pick, fmt) {
        var mx = 0, mn = Infinity;
        runs.forEach(function (v) { got[v].frames.forEach(function (f) { var y = pick(f.s[0]); if (y != null) { mx = Math.max(mx, y); mn = Math.min(mn, y); } }); });
        if (!isFinite(mn)) return '';
        var lo = title === 'distance' ? Math.max(0, mn - (mx - mn) * 0.1 - 1) : 0, hi = mx + (mx - lo) * 0.08 + 1;
        var o = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '" font-family="IBM Plex Mono, monospace" font-size="10.5">';
        o += '<rect x="' + L + '" y="' + T + '" width="' + pw + '" height="' + ph + '" fill="none" stroke="' + pal.dim + '" stroke-width="0.6"/>';
        o += '<text x="' + L + '" y="12" fill="' + pal.ink + '">' + (title === 'distance' ? 'Distance of the Needle from the star (screen points)' : 'Pull on the Needle (length of bx, by)') + '</text>';
        [lo, (lo + hi) / 2, hi].forEach(function (v) { var y = T + ph - (v - lo) / (hi - lo) * ph; o += '<text x="' + (L - 5) + '" y="' + (y + 3) + '" fill="' + pal.dim + '" text-anchor="end">' + fmt(v) + '</text>'; });
        for (var s = 0; s <= tmax; s += tmax / 6) { var x = L + s / tmax * pw; o += '<text x="' + x + '" y="' + (H - 8) + '" fill="' + pal.dim + '" text-anchor="middle">' + Math.round(s) + ' s</text>'; }
        runs.forEach(function (v) {
          var d = '', pen = false;
          got[v].frames.forEach(function (f) { var y = pick(f.s[0]); if (y == null || f.t > tmax) { pen = false; return; } d += (pen ? 'L' : 'M') + (L + f.t / tmax * pw).toFixed(1) + ' ' + (T + ph - (y - lo) / (hi - lo) * ph).toFixed(1); pen = true; });
          o += '<path d="' + d + '" fill="none" stroke="' + inkOf(v, st.vs) + '" stroke-width="1.2"/>';
        });
        return o + '</svg>';
      }
      return one('distance', function (s) { return s.gone ? null : s.r; }, function (v) { return v.toFixed(1); }) +
             one('pull', function (s) { return s.gone ? null : s.g; }, function (v) { return Math.round(v); });
    }
    function paintCharts() {
      var W = Math.max(480, charts.clientWidth || 900);
      charts.innerHTML = SW.displaySVG(chartSVG({ ink: 'var(--g-text)', dim: 'var(--g-muted)' }, W));
      SW.$$('svg', charts).forEach(function (el) { el.removeAttribute('width'); el.removeAttribute('height'); el.style.width = '100%'; el.style.height = 'auto'; el.style.display = 'block'; });
      if (!/Running/.test(read.textContent)) read.textContent = caption();
    }
    // the figure: the screen as an image, the charts under it, the versions in the corner
    function figSVG(pal) {
      var N = 600, c = document.createElement('canvas'); c.width = N * 2; c.height = N * 2;
      var g = c.getContext('2d'); g.scale(2, 2); scene(g, N, { bg: '#000', dim: '#4a5a66' });
      var ch = chartSVG(pal, N).replace(/<svg[^>]*>/g, '').split('</svg>');
      var o = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + N + ' ' + (N + 310) + '" width="' + N + '" height="' + (N + 310) + '" font-family="IBM Plex Mono, monospace" font-size="10.5">' +
        '<image href="' + c.toDataURL('image/png') + '" x="0" y="0" width="' + N + '" height="' + N + '"/>' +
        '<g transform="translate(0 ' + (N + 6) + ')">' + (ch[0] || '') + '</g><g transform="translate(0 ' + (N + 158) + ')">' + (ch[1] || '') + '</g>';
      st.vs.slice().reverse().forEach(function (vid, n) { var y = N - 8 - n * 12; o += '<text x="' + (N - 6) + '" y="' + y + '" fill="#cfe6ff" text-anchor="end">' + SW.esc(vname(V.byId(vid))) + '</text><rect x="' + (N - 12 - vname(V.byId(vid)).length * 6.3 - 14) + '" y="' + (y - 5) + '" width="12" height="2.5" fill="' + inkOf(vid, st.vs) + '"/>'; });
      return o + '</svg>';
    }
    SW.$('.grav-exp', card).appendChild(SW.figureButtons(function (p) { return figSVG(p); }, 'spacewar-orbits'));
    card.addEventListener('change', function (e) {
      var t = e.target;
      if (t.dataset.v) { var id = t.dataset.v; st.vs = st.vs.filter(function (x) { return x !== id; }); if (t.checked) st.vs.push(id); st.vs.sort(function (a, c) { return V.byId(a).sort - V.byId(c).sort; }); keep(); chips(); runAll(); return; }
      var k = t.dataset.o; if (!k) return;
      if (k === 'strobe') { st.strobe = t.checked; keep(); paint(); return; }
      st[k] = +t.value; keep(); runAll();
    });
    var lastW = 0;
    if (root.ResizeObserver) new ResizeObserver(function () { var w = card.clientWidth; if (w && Math.abs(w - lastW) > 8) { lastW = w; paint(); } }).observe(card);
    chips(); runAll();
    return function () { stopped = true; };
  };
})(this);
