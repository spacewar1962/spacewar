/*
 * lab.js - two experiments run on each version's own game on the emulator.
 * The collision shape: the Wedge set at every offset from the Needle, one
 * frame run, and the offsets at which the game declares a collision. The
 * hyperspace roulette: a ship sent into hyperspace again and again, many
 * times over, recording at each breakout whether it survived and where it
 * came out. Where the bench intervenes (to place the ships, to shorten the
 * waits, to vary where the random numbers start) the page says so.
 */
(function (root) {
  'use strict';
  var SW = root.SW, V = root.SWVersions;
  var L = SW.lab = {};
  var CACHE = {};
  function s18(v) { return v & 0o400000 ? -(v ^ 0o777777) : v; }
  function u18(v) { v = Math.round(v); return v < 0 ? (-v) ^ 0o777777 : v & 0o777777; }
  function vname(v) { return v.label.replace(/^Spacewar! /, ''); }
  function oct(n) { return (n >>> 0).toString(8); }

  // A machine brought to the third frame of a game, and a way back to it.
  function started(b) {
    var S = b.sym, cpu = new root.PDP1CPU.PDP1(SW.cpuOpts(b.v)); cpu.load(b.asm.memory, b.asm.start);
    var n = 0; while (n < 3 && !cpu.halted && cpu.cycles < 3000000) { if (cpu.pc === S.ml0.val) n++; if (n < 3) cpu.step(); }
    var snap = { mem: cpu.mem.slice(), ac: cpu.ac, io: cpu.io, ov: cpu.ov, flag: cpu.flag.slice(), pc: cpu.pc };
    return { cpu: cpu, back: function () { cpu.mem.set(snap.mem); cpu.ac = snap.ac; cpu.io = snap.io; cpu.ov = snap.ov; cpu.flag = snap.flag.slice(); cpu.pc = snap.pc; cpu.halted = false; cpu.control = 0; } };
  }
  function frame(cpu, S) { var c = 0; do { cpu.step(); c++; } while (cpu.pc !== S.ml0.val && !cpu.halted && c < 400000); }

  // ---------- the collision shape ----------
  var R = 30;   // offsets from -R to R screen points, each way
  L.collision = function (vid, alive, progress) {
    var key = 'col|' + vid;
    if (CACHE[key]) return Promise.resolve(CACHE[key]);
    return SW.build(vid).then(function (b) {
      var S = b.sym, need = ['ml0', 'ml1', 'mtb', 'nx1', 'ny1', 'ndx', 'ndy', 'ss1', 'ss2'];
      if (!b.asm || need.some(function (n) { return !S[n]; })) return { why: 'the object table is not where 3.1 has it' };
      var M = started(b), cpu = M.cpu, mem = cpu.mem, nx = S.nx1.val, ny = S.ny1.val, X0 = -256, Y0 = 256;
      var me1 = S.me1 ? s18(cpu.mem[S.me1.val]) : null, me2 = S.me2 ? s18(cpu.mem[S.me2.val]) : null;
      var W = 2 * R + 1, hit = new Uint8Array(W * W), i = 0;
      // the two outlines, drawn apart, for scale
      var out = [[], []];
      M.back(); mem[nx] = u18(X0 * 256); mem[ny] = u18(Y0 * 256); mem[nx + 1] = u18((X0 + 200) * 256); mem[ny + 1] = u18(Y0 * 256);
      [0, 1].forEach(function (k) { mem[S.ndx.val + k] = 0; mem[S.ndy.val + k] = 0; });
      cpu.onDisplay = function (x, y) { var k = (mem[S.ml1.val] & 0o7777) - S.mtb.val; if ((k === 0 || k === 1) && (x || y)) out[k].push(x - (k ? X0 + 200 : X0), y - Y0); };
      frame(cpu, S); cpu.onDisplay = null;
      return new Promise(function (res) {
        (function chunk() {
          if (!alive()) return;
          for (var q = 0; q < 120 && i < W * W; q++, i++) {
            var dx = i % W - R, dy = Math.floor(i / W) - R;
            M.back();
            mem[nx] = u18(X0 * 256); mem[ny] = u18(Y0 * 256); mem[nx + 1] = u18((X0 + dx) * 256); mem[ny + 1] = u18((Y0 + dy) * 256);
            [0, 1].forEach(function (k) { mem[S.ndx.val + k] = 0; mem[S.ndy.val + k] = 0; });
            frame(cpu, S);
            if ((mem[S.mtb.val] & 0o7777) !== S.ss1.val || (mem[S.mtb.val + 1] & 0o7777) !== S.ss2.val) hit[i] = 1;
          }
          if (progress) progress(i / (W * W));
          if (i < W * W) { setTimeout(chunk, 0); return; }
          var sig = 0; for (var j = 0; j < hit.length; j++) sig = (sig * 31 + hit[j] * (j + 1)) >>> 0;
          res(CACHE[key] = { hit: hit, W: W, me1: me1, me2: me2, out: out, sig: sig });
        })();
      });
    });
  };

  // ---------- the hyperspace roulette ----------
  // Each trial: the random numbers started at a different place in their
  // cycle; the Needle at rest at the same spot; both turn buttons pressed
  // until it goes in; the waits inside hyperspace cut short (the bench's
  // change, which leaves the odds and the jumps alone); at breakout, whether
  // it survived, and where it came out; then put back where it started, and
  // again, until it explodes or has no jumps left.
  L.roulette = function (vid, trials, alive, progress) {
    var key = 'hyp|' + vid + '|' + trials;
    if (CACHE[key]) return Promise.resolve(CACHE[key]);
    return Promise.all([SW.build(vid), SW.controlMap(vid), SW.random.study(vid)]).then(function (r3) {
      var b = r3[0], ctl = r3[1], rnd = r3[2], S = b.sym;
      var need = ['ml0', 'mtb', 'nx1', 'ny1', 'ndx', 'ndy', 'ss1', 'hp1', 'hp3', 'na1', 'mex'];
      if (!b.asm || need.some(function (n) { return !S[n]; })) return { why: 'no hyperspace routines (hp1, hp3) in this version' };
      if (!ctl[0].ccw || !ctl[0].cw) return { why: 'the turn buttons were not found' };
      var ran = S.ran || S['\\ran'] || S['~ran'], M = started(b), cpu = M.cpu, mem = cpu.mem;
      var nx = S.nx1.val, ny = S.ny1.val, na = S.na1.val, both = ctl[0].ccw | ctl[0].cw, X0 = -300, Y0 = 200;
      var jumps = [], outs = [], t = 0, seed = rnd && rnd.f ? rnd.seed : 0;
      function routine() { return mem[S.mtb.val] & 0o7777; }
      function home() { mem[nx] = u18(X0 * 256); mem[ny] = u18(Y0 * 256); mem[S.ndx.val] = 0; mem[S.ndy.val] = 0; mem[nx + 1] = u18(300 * 256); mem[ny + 1] = u18(-300 * 256); mem[S.ndx.val + 1] = 0; mem[S.ndy.val + 1] = 0; }
      return new Promise(function (res) {
        (function trial() {
          if (!alive()) return;
          if (t >= trials) {
            var by = [];
            jumps.forEach(function (j) { var e = by[j.n] = by[j.n] || { n: j.n, tries: 0, boom: 0 }; e.tries++; if (j.boom) e.boom++; });
            res(CACHE[key] = { jumps: jumps, by: by.filter(Boolean), outs: outs, hur: S.hur ? s18(mem[S.hur.val]) : null, mhs: S.mhs ? mem[S.mhs.val] : null, trials: trials });
            return;
          }
          M.back();
          if (ran && rnd && rnd.f) { var x = seed; for (var s = 0; s < 1 + t * 997; s++) x = rnd.f[x]; mem[ran.val] = x; }
          home(); if (S.nh3) mem[S.nh3.val] = 0;
          var n = 0, frames = 0;
          while (frames < 4000 && !cpu.halted) {
            var rt = routine();
            if (rt === S.ss1.val) {
              // at home, press both turn buttons until the ship goes in
              cpu.control = both;
            } else {
              cpu.control = 0;
              if (rt === S.hp1.val || rt === S.hp3.val) { if (s18(mem[na]) < -1) mem[na] = u18(-1); }   // the waits, cut short
            }
            var before = rt, bx = s18(mem[nx]) / 256, by2 = s18(mem[ny]) / 256;
            frame(cpu, S); frames++;
            var after = routine();
            if (before === S.hp1.val && after === S.hp3.val) { outs.push([s18(mem[nx]) / 256 - X0, s18(mem[ny]) / 256 - Y0]); }
            if (before === S.hp3.val && after !== S.hp3.val) {
              n++;
              var boom = after === S.mex.val || (mem[S.mtb.val] & 0o7777) === (S.mex.val & 0o7777);
              jumps.push({ n: n, boom: boom });
              if (boom) break;
              home();
              if (S.nh3) mem[S.nh3.val] = 0;   // the recharge, cut short
            }
            if (before === S.ss1.val && after === S.ss1.val && n > 0 && S.nh2 && mem[S.nh2.val] === 0) break;   // no jumps left
          }
          t++;
          if (progress) progress(t / trials);
          setTimeout(trial, 0);
        })();
      });
    });
  };

  // ---------- the pages ----------
  function pair(host, title, intro, store, render) {
    var P0 = SW.store.get(store, {}) || {}, st = { a: P0.a || '3.1', b: P0.b || '4.0' };
    var all = V.VERSIONS.filter(function (v) { return v.build && v.id !== 'stars' && v.id !== '1'; }).sort(function (a, c) { return a.sort - c.sort; });
    var opts = all.map(function (v) { return '<option value="' + v.id + '">' + SW.esc(vname(v)) + '</option>'; }).join('');
    var card = SW.el('div', { class: 'card grav lab', style: 'grid-column:1/-1' });
    card.innerHTML = '<h4>' + SW.esc(title) + '</h4><p class="hint">' + intro + '</p>' +
      '<div class="well-view plates-ctl"><label>Left <select data-l="a">' + opts + '</select></label><label>Right <select data-l="b">' + opts + '</select></label></div>' +
      '<div class="rnd-pair"><div class="rnd-col" data-c="a"></div><div class="rnd-col" data-c="b"></div></div>';
    host.appendChild(card);
    SW.$('[data-l=a]', card).value = st.a; SW.$('[data-l=b]', card).value = st.b;
    var stopped = false;
    function col(k) { render(SW.$('[data-c=' + k + ']', card), st[k], function () { return !stopped && SW.$('[data-l=' + k + ']', card).value === st[k]; }); }
    card.addEventListener('change', function (e) { var k = e.target.dataset.l; if (!k) return; st[k] = e.target.value; SW.store.set(store, st); col(k); });
    col('a'); col('b');
    return function () { stopped = true; };
  }

  L.drawCollision = function (b, host) {
    return pair(host, 'Collision shape',
      'Where two objects collide, as each version’s game decides it: the Wedge set at every offset from the Needle, up to 30 screen points each way, both at rest far from the star, and one frame run. Shaded, the offsets at which the game declared a collision; outlined, the shape its constants give (|dx| and |dy| under me1, and |dx| + |dy| under me1 + me2); drawn to the same scale, the Needle (black) at the centre and the Wedge (blue, its centre ringed) at the furthest offset to the right at which the two collide. The same test serves torpedoes, which collide with ships and each other.',
      'labcol', function (el, vid, alive) {
        el.innerHTML = '<h5>' + SW.esc(vname(V.byId(vid))) + ' ' + SW.refTag(vid) + '</h5><p class="hint lab-prog">Running 3,721 frames…</p>';
        L.collision(vid, alive, function (f) { var p = SW.$('.lab-prog', el); if (p) p.textContent = 'Running 3,721 frames… ' + Math.round(f * 100) + '%'; }).then(function (d) {
          if (!alive()) return;
          if (d.why) { el.innerHTML = '<h5>' + SW.esc(vname(V.byId(vid))) + '</h5><p class="hint">' + SW.esc(d.why) + '.</p>'; return; }
          var n = 0; for (var i = 0; i < d.hit.length; i++) n += d.hit[i];
          var pts = d.me1 != null ? (d.me1 / 256) : null, pts2 = d.me2 != null ? d.me2 / 256 : null;
          el.innerHTML = '<h5>' + SW.esc(vname(V.byId(vid))) + ' ' + SW.refTag(vid) + '</h5>' +
            '<table class="ov-sub rnd-t"><tbody>' +
            '<tr><td>Constants</td><td class="mono">me1 ' + (d.me1 != null ? oct(d.me1) + ' (' + pts + ' points)' : '—') + ' · me2 ' + (d.me2 != null ? oct(d.me2) + ' (' + pts2 + ' points)' : '—') + '</td></tr>' +
            '<tr><td>Measured</td><td>' + n.toLocaleString('en-GB') + ' of 3,721 offsets collide</td></tr></tbody></table>' +
            '<canvas class="lab-cv"></canvas><div class="rnd-exp"></div>';
          var cv = SW.$('.lab-cv', el); drawCol(cv, d);
          SW.$('.rnd-exp', el).appendChild(SW.figureButtons(function (pal) { return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 380 400" width="380" height="400" font-family="IBM Plex Mono, monospace" font-size="11"><text x="0" y="12" fill="' + pal.ink + '">' + SW.esc(V.byId(vid).label) + ': where the Wedge collides with the Needle</text><image href="' + cv.toDataURL('image/png') + '" x="0" y="20" width="380" height="380"/></svg>'; }, 'spacewar-' + vid + '-collision', SW.refText(vid)));
        });
      });
  };
  function drawCol(cv, d) {
    var N = 380, dpr = root.devicePixelRatio || 1; cv.width = N * dpr; cv.height = N * dpr; cv.style.width = N + 'px'; cv.style.height = N + 'px';
    var g = cv.getContext('2d'); g.scale(dpr, dpr); g.fillStyle = '#dcd9d1'; g.fillRect(0, 0, N, N);
    var k = N / (2 * R + 1), c = N / 2;
    function X(x) { return c + x * k; } function Y(y) { return c - y * k; }
    g.fillStyle = 'rgba(200, 90, 60, 0.45)';
    for (var i = 0; i < d.hit.length; i++) if (d.hit[i]) { var dx = i % d.W - R, dy = Math.floor(i / d.W) - R; g.fillRect(X(dx) - k / 2, Y(dy) - k / 2, k, k); }
    g.strokeStyle = 'rgba(38,38,38,0.25)'; g.lineWidth = 1;
    for (var t = -R; t <= R; t += 10) { g.beginPath(); g.moveTo(X(t), 0); g.lineTo(X(t), N); g.stroke(); g.beginPath(); g.moveTo(0, Y(t)); g.lineTo(N, Y(t)); g.stroke(); }
    if (d.me1 != null && d.me2 != null) {
      var a = d.me1 / 256, s = (d.me1 + d.me2) / 256;
      // the octagon: |x| < a, |y| < a, |x| + |y| < s
      var P = [];
      [[1, 1], [-1, 1], [-1, -1], [1, -1]].forEach(function (q) {
        var x1 = Math.min(a, s), y1 = Math.max(0, s - a); P.push([q[0] * x1, q[1] * (q[0] * q[1] > 0 ? y1 : a)]);
      });
      g.strokeStyle = '#262626'; g.lineWidth = 1.4; g.beginPath();
      var ring = [];
      [[a, s - a], [s - a, a], [-(s - a), a], [-a, s - a], [-a, -(s - a)], [-(s - a), -a], [s - a, -a], [a, -(s - a)]].forEach(function (p) { ring.push([Math.max(-a, Math.min(a, p[0])), Math.max(-a, Math.min(a, p[1]))]); });
      ring.forEach(function (p, j) { if (j) g.lineTo(X(p[0]), Y(p[1])); else g.moveTo(X(p[0]), Y(p[1])); }); g.closePath(); g.stroke();
    }
    g.fillStyle = '#262626';
    d.out[0].forEach(function (v, j, A) { if (j % 2) return; g.fillRect(X(A[j]) - 1, Y(A[j + 1]) - 1, 2, 2); });
    // the Wedge where it first collides to the Needle's right: the furthest shaded offset on the middle row
    var edge = 0; for (var ex = R; ex >= 0; ex--) if (d.hit[R * d.W + ex + R]) { edge = ex; break; }
    g.fillStyle = '#1f5f9e';
    d.out[1].forEach(function (v, j, A) { if (j % 2) return; g.fillRect(X(A[j] + edge) - 1, Y(A[j + 1]) - 1, 2, 2); });
    g.strokeStyle = '#1f5f9e'; g.lineWidth = 1; g.beginPath(); g.arc(X(edge), Y(0), 3, 0, 2 * Math.PI); g.stroke();
    g.fillStyle = '#555'; g.font = '11px IBM Plex Mono, monospace';
    g.fillText('Needle (black) at the centre; the Wedge (blue)', 8, N - 36);
    g.fillText('where it first collides, ' + edge + ' points to the right', 8, N - 22); g.fillText('grid every 10 screen points', 8, N - 8);
  }

  L.drawRoulette = function (b, host) {
    return pair(host, 'Hyperspace roulette',
      'A ship sent into hyperspace again and again, 120 times over in each version’s own game. Each breakout adds hur to the ship’s uncertainty (mh4); a random number with its sign bit set is added to that, and if the sum comes out positive the ship explodes. The bench’s part: each trial starts the random numbers at a different place in their cycle, the waits inside hyperspace and the recharge are cut short, and after each breakout the ship is put back where it started. The odds, the jumps and where the ship comes out are the program’s.',
      'labhyp', function (el, vid, alive) {
        el.innerHTML = '<h5>' + SW.esc(vname(V.byId(vid))) + ' ' + SW.refTag(vid) + '</h5><p class="hint lab-prog">Running 120 trials…</p>';
        L.roulette(vid, 120, alive, function (f) { var p = SW.$('.lab-prog', el); if (p) p.textContent = 'Running 120 trials… ' + Math.round(f * 100) + '%'; }).then(function (d) {
          if (!alive()) return;
          if (d.why) { el.innerHTML = '<h5>' + SW.esc(vname(V.byId(vid))) + '</h5><p class="hint">' + SW.esc(d.why) + '.</p>'; return; }
          var surv = 1, rows = d.by.map(function (e) { var p = e.boom / e.tries; var row = '<tr><td class="num">' + e.n + '</td><td class="num">' + e.tries + '</td><td class="num">' + e.boom + '</td><td class="num">' + Math.round(p * 100) + '%</td><td class="num">' + Math.round(surv * 100) + '%</td></tr>'; surv *= (1 - p); return row; }).join('');
          el.innerHTML = '<h5>' + SW.esc(vname(V.byId(vid))) + ' ' + SW.refTag(vid) + '</h5>' +
            '<table class="ov-sub rnd-t"><tbody><tr><td>Constants</td><td class="mono">hur ' + (d.hur != null ? oct(d.hur) : '—') + ' · mhs ' + (d.mhs == null ? '—' : (d.mhs >> 12) === 0o71 ? 'law i ' + oct(d.mhs & 0o7777) + ' (' + (d.mhs & 0o7777) + ' jumps)' : oct(d.mhs)) + '</td></tr></tbody></table>' +
            '<table class="ov-sub lab-t"><thead><tr><th>Jump</th><th>Tried</th><th>Exploded</th><th>Chance</th><th>Alive going in</th></tr></thead><tbody>' + rows + '</tbody></table>' +
            '<div class="rnd-figs"><figure><canvas class="lab-bars"></canvas><figcaption class="hint">The chance of exploding at each breakout, measured (bars) against the jump number over eight (line).</figcaption></figure>' +
            '<figure><canvas class="lab-outs"></canvas><figcaption class="hint">Where the ship came out, relative to where it went in, over every jump (screen points; the full screen is 1,024 across).</figcaption></figure></div><div class="rnd-exp"></div>';
          var cb = SW.$('.lab-bars', el), co = SW.$('.lab-outs', el); bars(cb, d); outsPlot(co, d);
          SW.$('.rnd-exp', el).appendChild(SW.figureButtons(function (pal) { return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 330" width="600" height="330" font-family="IBM Plex Mono, monospace" font-size="11"><text x="0" y="12" fill="' + pal.ink + '">' + SW.esc(V.byId(vid).label) + ': hyperspace, 120 trials</text><image href="' + cb.toDataURL('image/png') + '" x="0" y="24" width="280" height="280"/><image href="' + co.toDataURL('image/png') + '" x="300" y="24" width="280" height="280"/></svg>'; }, 'spacewar-' + vid + '-hyperspace', SW.refText(vid)));
        });
      });
  };
  function bars(cv, d) {
    var N = 280, dpr = root.devicePixelRatio || 1; cv.width = N * dpr; cv.height = N * dpr; cv.style.width = N + 'px'; cv.style.height = N + 'px';
    var g = cv.getContext('2d'); g.scale(dpr, dpr); g.fillStyle = '#dcd9d1'; g.fillRect(0, 0, N, N);
    var L0 = 30, B = 30, pw = N - L0 - 10, ph = N - B - 14, n = Math.max(8, d.by.length), w = pw / n;
    g.strokeStyle = '#999'; g.strokeRect(L0, 14, pw, ph);
    g.fillStyle = '#555'; g.font = '10px IBM Plex Mono, monospace';
    [0, 0.5, 1].forEach(function (p) { g.fillText(Math.round(p * 100) + '%', 2, 14 + ph - p * ph + 3); });
    d.by.forEach(function (e) { var p = e.boom / e.tries, x = L0 + (e.n - 1) * w; g.fillStyle = 'rgba(200, 90, 60, 0.7)'; g.fillRect(x + 3, 14 + ph - p * ph, w - 6, p * ph); g.fillStyle = '#555'; g.fillText(String(e.n), x + w / 2 - 3, N - 14); });
    g.strokeStyle = '#262626'; g.lineWidth = 1.3; g.beginPath();
    for (var j = 1; j <= n; j++) { var x = L0 + (j - 0.5) * w, y = 14 + ph - Math.min(1, j / 8) * ph; if (j === 1) g.moveTo(x, y); else g.lineTo(x, y); }
    g.stroke();
    g.fillStyle = '#555'; g.fillText('jump', L0 + pw / 2 - 12, N - 2);
  }
  function outsPlot(cv, d) {
    var N = 280, dpr = root.devicePixelRatio || 1; cv.width = N * dpr; cv.height = N * dpr; cv.style.width = N + 'px'; cv.style.height = N + 'px';
    var g = cv.getContext('2d'); g.scale(dpr, dpr); g.fillStyle = '#dcd9d1'; g.fillRect(0, 0, N, N);
    var E = 520, k = N / (2 * E), c = N / 2;
    g.strokeStyle = 'rgba(38,38,38,0.3)'; g.beginPath(); g.moveTo(c, 0); g.lineTo(c, N); g.moveTo(0, c); g.lineTo(N, c); g.stroke();
    g.strokeStyle = 'rgba(38,38,38,0.3)'; g.strokeRect(c - 512 * k, c - 512 * k, 1024 * k, 1024 * k);
    g.fillStyle = 'rgba(38,38,38,0.75)';
    d.outs.forEach(function (o) { var x = ((o[0] + 512) % 1024 + 1024) % 1024 - 512, y = ((o[1] + 512) % 1024 + 1024) % 1024 - 512; g.fillRect(c + x * k - 1.2, c - y * k - 1.2, 2.4, 2.4); });
    g.fillStyle = '#555'; g.font = '10px IBM Plex Mono, monospace'; g.fillText(d.outs.length + ' breakouts; the box is the screen', 6, N - 6);
  }
})(this);
