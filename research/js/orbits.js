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
  // runs kept, the most recent few (each holds every frame of a game)
  var RUNS = {}, ORDER = [];
  function keepRun(key, d) { RUNS[key] = d; ORDER = ORDER.filter(function (k) { return k !== key; }); ORDER.push(key); while (ORDER.length > 12) delete RUNS[ORDER.shift()]; return d; }
  function s18(v) { return v & 0o400000 ? -(v ^ 0o777777) : v; }
  function u18(v) { v = Math.round(v); return v < 0 ? (-v) ^ 0o777777 : v & 0o777777; }
  function vname(v) { return v.label.replace(/^Spacewar! /, ''); }

  // Run a version's game with a scenario: sc.key (for the cache), sc.setup(mem, S, P)
  // once the game is going, sc.control(frame) for the control boxes, sc.frames to run,
  // sc.strobe (frames between the outlines kept). Resolves with {frames, fps} or {why}.
  O.run = function (vid, sc, alive, progress) {
    var key = vid + '|' + sc.key;
    if (RUNS[key]) { keepRun(key, RUNS[key]); return Promise.resolve(RUNS[key]); }
    var ctl = null;
    return (sc.control ? SW.controlMap(vid).then(function (m) { ctl = m; return SW.build(vid); }) : SW.build(vid)).then(function (b) {
      var S = b.sym, need = ['ml0', 'ml1', 'mtb', 'nx1', 'ny1', 'ndx', 'ndy'];
      if (!b.asm || need.some(function (n) { return !S[n]; })) return { why: 'the object table or the main loop is not where 3.1 has them' };
      var P = SW.gravity.probe(b);
      var cpu = new root.PDP1CPU.PDP1(SW.cpuOpts(b.v)); cpu.load(b.asm.memory, b.asm.start); cpu.tw = 0; cpu.control = 0;
      var mem = cpu.mem, ml0 = S.ml0.val, ml1 = S.ml1.val, mtb = S.mtb.val, nx = S.nx1.val, ny = S.ny1.val,
          own = [S.ss1 ? S.ss1.val : -1, S.ss2 ? S.ss2.val : -1];
      function gone(i) { return own[i] >= 0 && (mem[mtb + i] & 0o7777) !== own[i]; }
      function centroid(P) { var sx = 0, sy = 0; for (var i = 0; i < P.length; i += 2) { sx += P[i]; sy += P[i + 1]; } return [sx / (P.length / 2), sy / (P.length / 2)]; }
      function settle() {
        var base = cand[0].j;
        // a frame drawn centred on ship c: that ship's outline sits at the middle of the
        // screen while the ship itself is elsewhere; shift the frame by the ship's place
        cand.forEach(function (c) {
          var f = frames[c.j]; if (!f) return; c.t = [0, 0];
          for (var k = 0; k < 2; k++) {
            var P = c.g[k], q = f.s[k]; if (!P.length || q.gone) continue;
            var m = centroid(P);
            if (Math.hypot(m[0], m[1]) < 24 && Math.hypot(q.x, q.y) > 40) { c.t = [q.x, q.y]; break; }
          }
        });
        var keep = [0, 1].map(function (k) {
          var best = null, bd = Infinity, bt = [0, 0];
          cand.forEach(function (c) {
            var P = c.g[k], q = frames[c.j] && frames[c.j].s[k]; if (!P.length || !q) return;
            var m = centroid(P), d = Math.hypot(m[0] + c.t[0] - q.x, m[1] + c.t[1] - q.y);
            if (d < bd) { bd = d; best = P; bt = c.t; }
          });
          var P2 = best || cand[0].g[k], o2 = [];
          for (var i = 0; i < P2.length; i += 2) {
            var X = Math.round(P2[i] + bt[0]), Y = Math.round(P2[i + 1] + bt[1]);
            if ((bt[0] || bt[1]) && Math.abs(X) <= 4 && Math.abs(Y) <= 4) continue;   // the stray centre point (F28), come back near the centre (the ship moved a little within the frame)
            o2.push(X, Y);
          }
          return Int16Array.from(o2);
        });
        frames[base].pts = keep; cand = [];
      }
      var frames = [], n = 0, started = false, c0 = 0, grab = null, cand = [], after = -1, sun = [], sunFrames = 0,
          tcr = S.tcr ? S.tcr.val : -1, nob = S.nob ? S.nob.val : 24;
      // the points each ship's routine puts on the screen, in frames being kept;
      // and, over a few frames, the star's own dots (drawn by the main loop near the centre)
      cpu.onDisplay = function (x, y) {
        var k = (mem[ml1] & 0o7777) - mtb;
        // (the ship routine also plots one point at the centre, under the star, every
        // frame before its outline: cla cli, dpy-4000; it is no part of the ship)
        if (grab && (k === 0 || k === 1)) { if (x || y) grab[k].push(x, y); }
        else if (sunFrames && sunFrames < 6 && k !== 0 && k !== 1 && x * x + y * y < 1600) sun.push(x, y);
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
                // Outlines are taken on two frames running and, for each ship, the set that
                // lies where the ship is kept. 4.4 draws each frame centred on one ship (its
                // two consoles, alternately): such a frame is moved back by that ship's place.
                if (grab && j) cand.push({ j: j - 1, g: grab });
                var second = sc.strobe > 1 && cand.length === 1 && cand[0].j === j - 1 && (j - 1) % sc.strobe === 0;
                if (cand.length && !second) settle();
                var f = { t: (cpu.cycles - c0) / 200000, s: [] };
                for (var i = 0; i < 2; i++) f.s.push({ x: s18(mem[nx + i]) / 256, y: s18(mem[ny + i]) / 256, dx: s18(mem[S.ndx.val + i]), dy: s18(mem[S.ndy.val + i]), gone: gone(i) });
                // the torpedoes in flight: each object running the torpedo routine, by its slot
                if (sc.torps) { var tp = []; for (var o = 2; o < nob; o++) if ((mem[mtb + o] & 0o7777) === tcr) tp.push(o, Math.round(s18(mem[nx + o]) / 256), Math.round(s18(mem[ny + o]) / 256)); f.tp = Int16Array.from(tp); }
                frames.push(f);
                grab = (sc.strobe && j % sc.strobe === 0) || second ? [[], []] : null;
                if (sunFrames || j === 2) sunFrames++;
                if (sc.control) cpu.control = sc.control(j, f.t, mem, S, s18, ctl);
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
          res(keepRun(key, { frames: frames, fps: T ? (frames.length - 1) / T : 20, sun: sun }));
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
      key: 'orbit5|' + r + '|' + pct + '|' + secs, frames: Math.round(secs * 20), strobe: 20,
      setup: function (mem, S, P, u) {
        var v = circular(P, r) * pct / 100, nx = S.nx1.val, ny = S.ny1.val, dx = S.ndx.val, dy = S.ndy.val;
        // the Needle on the right going up, the Wedge on the left going down
        mem[nx] = u(r * 256); mem[ny] = 0; mem[dx] = 0; mem[dy] = u(v);
        mem[nx + 1] = u(-r * 256); mem[ny + 1] = 0; mem[dx + 1] = 0; mem[dy + 1] = u(-v);
      }
    }, alive, progress);
  };

  // ---------- Manoeuvres: the movements the well allows, as plates ----------
  // Each is a scenario for O.run: from the game's own start, or with the ships
  // set in place; flown, where it needs controls, by a small autopilot that
  // turns a ship to an angle and fires for a time.
  function wrapA(a) { while (a > Math.PI) a -= 2 * Math.PI; while (a <= -Math.PI) a += 2 * Math.PI; return a; }
  // turn ship k to angle 'to' (radians; 0 points up, the thrust is (-sin, cos)), then fire for 'burn' seconds
  function pilot(plan) {
    var st = [{}, {}];
    return function (j, t, mem, S, s18, BIT) {
      var cw = 0;
      plan.forEach(function (p, k) {
        if (!p) return;
        var a = s18(mem[S.nth.val + k]) / 16384, e = wrapA(p.to - a), q = st[k];
        if (q.t0 == null) {
          if (Math.abs(e) > 0.07) cw |= e > 0 ? BIT[k].ccw : BIT[k].cw;
          else q.t0 = t;
        }
        if (q.t0 != null && t - q.t0 < p.burn) cw |= BIT[k].rocket;
      });
      return cw;
    };
  }
  function placed(r0, v0) {   // both ships set: the Needle at r0 moving v0, the Wedge opposite
    return function (mem, S, P, u) {
      var nx = S.nx1.val, ny = S.ny1.val, dx = S.ndx.val, dy = S.ndy.val;
      mem[nx] = u(r0[0] * 256); mem[ny] = u(r0[1] * 256); mem[dx] = u(v0[0]); mem[dy] = u(v0[1]);
      mem[nx + 1] = u(-r0[0] * 256); mem[ny + 1] = u(-r0[1] * 256); mem[dx + 1] = u(-v0[0]); mem[dy + 1] = u(-v0[1]);
    };
  }
  function vcirc(P, r) { var g = P.ok ? P.at(Math.round(r * 256), 0) : 0; return g ? Math.sqrt(8 * g * r * 256) : 0; }
  O.MOVES = [
    { id: 'fall', title: 'Left alone', secs: 24, E: 512,
      text: 'The game’s own start, no controls: the ships fall from their corners along the diagonal. In 3.1 they meet near the centre; in 4.x the star catches them first (F22).' },
    { id: 'cbs', title: 'The CBS opening', secs: 30, E: 512,
      text: 'Each ship turned at right angles to the star and fired for 4 seconds, then left: the two orbits make the eye that named it (Graetz 1981). Accounts give 2 to 3 seconds (Landsteiner) and 3.5 to 4 (Russell). On the bench 3.1 needs about 4: with 3.5 or less its ships are caught by the star within 19 seconds, where 4.x holds the eye from 2.5.',
      control: function () { return pilot([{ to: Math.PI / 4, burn: 4 }, { to: -3 * Math.PI / 4, burn: 4 }]); } },
    { id: 'orbit', title: 'A circular orbit', secs: 30, E: 256,
      text: 'Set at 128 points from the star at the speed its own pull there would hold in a circle.',
      setup: function (mem, S, P, u) { placed([128, 0], [0, vcirc(P, 128)])(mem, S, P, u); } },
    { id: 'ellipse', title: 'A close pass', secs: 30, E: 256,
      text: 'The same, at three quarters of that speed: the ship swings in close to the star, where the versions’ pulls differ most.',
      setup: function (mem, S, P, u) { placed([128, 0], [0, vcirc(P, 128) * 0.75])(mem, S, P, u); } },
    { id: 'escape', title: 'Escape', secs: 20, E: 512,
      text: 'At one and a half times circular speed: the ship climbs out of the well. The screen wraps at its edges, so it comes back from the other side.',
      setup: function (mem, S, P, u) { placed([128, 0], [0, vcirc(P, 128) * 1.5])(mem, S, P, u); } },
    { id: 'flyby', title: 'A fly-by', secs: 20, E: 512,
      text: 'Coming in from the left, aimed 60 points above the star: the well bends the path round it.',
      setup: function (mem, S, P, u) { placed([-420, 60], [vcirc(P, 128) * 1.1, 0])(mem, S, P, u); } }
  ];
  // ---------- Torpedoes ----------
  // A pilot that works through a list of headings for ship k: turn to each,
  // fire (the button held for two frames), wait for the tube to reload, go on.
  function gunner(k, heads, every) {
    var i = 0, phase = 'turn', c = 0;
    return function (j, t, mem, S, s18, BIT) {
      var cw = 0, B = BIT[k];
      if (i >= heads.length) return 0;
      var h = heads[i];
      if (phase === 'turn') {
        if (h == null) phase = 'fire';
        else { var e = wrapA(h - s18(mem[S.nth.val + k]) / 16384); if (Math.abs(e) > 0.07) cw |= e > 0 ? B.ccw : B.cw; else phase = 'fire'; }
        c = 0;
      }
      if (phase === 'fire') { cw |= B.torpedo; if (++c >= 2) { phase = 'wait'; c = 0; } }
      else if (phase === 'wait' && ++c >= (every || 20)) { phase = 'turn'; i++; }
      return cw;
    };
  }
  var FAN = [0, 1, 2, 3, 4, 5, 6, 7].map(function (n) { return n * Math.PI / 4; });
  function atRest(x, y, x2, y2) {
    return function (mem, S, P, u) {
      var nx = S.nx1.val, ny = S.ny1.val;
      mem[nx] = u(x * 256); mem[ny] = u(y * 256); mem[S.ndx.val] = 0; mem[S.ndy.val] = 0;
      mem[nx + 1] = u(x2 * 256); mem[ny + 1] = u(y2 * 256); mem[S.ndx.val + 1] = 0; mem[S.ndy.val + 1] = 0;
    };
  }
  O.TORPS = [
    { id: 'tfan', title: 'A fan', secs: 16, E: 512, torps: true,
      text: 'The Needle at rest turns through eight headings and fires at each. The torpedoes keep the ship’s motion and fly straight: the star does not pull them.',
      setup: atRest(-220, -140, 420, 420), control: function () { return gunner(0, FAN); } },
    { id: 'torbit', title: 'Fired while circling', secs: 16, E: 512, torps: true,
      text: 'The Needle set circling the star at 160 points with its nose held up, firing once a second: each torpedo takes the ship’s velocity plus a push along its heading, and goes straight on.',
      setup: function (mem, S, P, u) { var v = vcirc(P, 160); mem[S.nx1.val] = u(160 * 256); mem[S.ny1.val] = 0; mem[S.ndx.val] = 0; mem[S.ndy.val] = u(v); mem[S.nth.val] = 0;
        mem[S.nx1.val + 1] = u(420 * 256); mem[S.ny1.val + 1] = u(-420 * 256); mem[S.ndx.val + 1] = 0; mem[S.ndy.val + 1] = 0; },
      control: function () { return gunner(0, [null, null, null, null, null, null, null, null, null, null, null, null], 20); } },
    { id: 'twarp', title: 'The same fan, with the warpage turned up', secs: 16, E: 512, torps: true,
      text: 'The bench’s change, not the program’s: the warpage constant the set to sar 1s instead of sar 9s. Each frame a torpedo’s dy gains its x, and its dx its y, shifted right 9 places and then by the; at sar 9s that rounds to nothing.',
      setup: function (mem, S, P, u) { atRest(-220, -140, 420, 420)(mem, S, P, u); if (S.the) mem[S.the.val] = 0o675001; }, control: function () { return gunner(0, FAN); } }
  ];
  O.torpedoes = function (b, host) {
    return O.plates(b, host, { store: 'torps', title: 'Torpedoes', moves: O.TORPS,
      intro: 'Torpedoes as each version’s game fires them, the tracks drawn every other frame. From 3.1 on the constants are the same: 32 torpedoes a ship (tno), each lasting 96 frames (tlf) at 16 frames’ reload (rlt), launched at the ship’s speed plus its heading shifted by tvl (sar 4s). The warpage term the (sar 9s) is written into the torpedo routine but, at that setting, adds nothing: the tracks are straight (F24). 2B has no warpage term.' });
  };

  O.move = function (vid, m, alive) {
    return O.run(vid, { key: 'move5|' + m.id, frames: Math.round(m.secs * 22), strobe: 20, setup: m.setup, control: m.control ? m.control() : null, torps: !!m.torps }, alive);
  };

  // the page of plates: each movement for two versions side by side, the
  // outlines once a second as on the documentation plates of the time
  O.plates = function (b, host, cfg) {
    cfg = cfg || { store: 'plates', title: 'Manoeuvres', moves: O.MOVES, intro: 'What the shape of the well allows, movement by movement, each run in the version’s own game on the emulator: the ships as the program draws them, once a second, as on the stroboscopic plates of the time. Two versions side by side.' };
    var P0 = SW.store.get(cfg.store, {}) || {};
    var st = { a: P0.a || '3.1', b: P0.b || '4.0', paper: P0.paper !== false, path: P0.path !== false };
    function keep() { SW.store.set(cfg.store, st); }
    var all = V.VERSIONS.filter(function (v) { return v.build && v.id !== '1' && v.id !== 'stars'; }).sort(function (a, c) { return a.sort - c.sort; });
    var opts = all.map(function (v) { return '<option value="' + v.id + '">' + SW.esc(vname(v)) + '</option>'; }).join('');
    var card = SW.el('div', { class: 'card grav plates', style: 'grid-column:1/-1' });
    card.innerHTML = '<h4>' + SW.esc(cfg.title) + '</h4>' +
      '<p class="hint">' + SW.esc(cfg.intro) + '</p>' + (cfg.more ? cfg.more(b) : '') +
      '<div class="well-view plates-ctl"><label>Left <select data-p="a">' + opts + '</select></label><label>Right <select data-p="b">' + opts + '</select></label>' +
      '<label><input type="checkbox" data-p="paper"> Paper</label><label><input type="checkbox" data-p="path"> Show the path</label><span class="hint">Timing between plots, 1 second.</span></div>' +
      '<div class="plates-grid"></div>';
    host.appendChild(card);
    SW.$('[data-p=a]', card).value = st.a; SW.$('[data-p=b]', card).value = st.b;
    SW.$('[data-p=paper]', card).checked = st.paper; SW.$('[data-p=path]', card).checked = st.path;
    var grid = SW.$('.plates-grid', card), stopped = false, job = 0, got = {};
    function alive(my) { return function () { return !stopped && my === job; }; }
    function pal() { return st.paper ? { bg: '#dcd9d1', ink: '#262626', faint: 'rgba(38,38,38,0.28)', sun: '#262626' } : { bg: '#000', ink: '#cfe6ff', faint: 'rgba(207,230,255,0.28)', sun: '#ffce7a' }; }
    function drawPlate(cv, d, m, label) {
      var N = cv.width / (root.devicePixelRatio || 1), g = cv.getContext('2d'), c = pal(), E = m.E, k = N / (2 * E);
      g.setTransform(root.devicePixelRatio || 1, 0, 0, root.devicePixelRatio || 1, 0, 0);
      function X(x) { return N / 2 + x * k; } function Y(y) { return N / 2 - y * k; }
      g.fillStyle = c.bg; g.fillRect(0, 0, N, N);
      g.fillStyle = c.ink; g.font = '11px IBM Plex Mono, monospace'; g.fillText(label, 8, 16);
      if (!d) { g.fillStyle = c.faint; g.fillText('running…', 8, 32); return; }
      if (d.why) { g.fillStyle = c.faint; g.fillText(d.why.slice(0, 40), 8, 32); return; }
      var r = Math.max(0.9, N / 360);
      g.fillStyle = c.sun; for (var i = 0; i < d.sun.length; i += 2) { g.globalAlpha = 0.5; g.fillRect(X(d.sun[i]) - r * 0.6, Y(d.sun[i + 1]) - r * 0.6, r * 1.2, r * 1.2); }
      g.globalAlpha = 1;
      var F = d.frames;
      if (st.path) [0, 1].forEach(function (s) {
        g.strokeStyle = c.faint; g.lineWidth = 1; g.beginPath(); var pen = false;
        F.forEach(function (f, j) { var q = f.s[s]; if (q.gone) { pen = false; return; } if (pen && Math.abs(q.x - F[j - 1].s[s].x) + Math.abs(q.y - F[j - 1].s[s].y) > 200) pen = false; if (pen) g.lineTo(X(q.x), Y(q.y)); else g.moveTo(X(q.x), Y(q.y)); pen = true; });
        g.stroke();
      });
      g.fillStyle = c.ink;
      F.forEach(function (f) { if (!f.pts) return; [0, 1].forEach(function (s) { var P = f.pts[s]; for (var i = 0; i < P.length; i += 2) g.fillRect(X(P[i]) - r / 2, Y(P[i + 1]) - r / 2, r, r); }); });
      F.forEach(function (f, j) { if (!f.tp || j % 2) return; var T = f.tp; for (var i = 0; i < T.length; i += 3) g.fillRect(X(T[i + 1]) - r * 0.45, Y(T[i + 2]) - r * 0.45, r * 0.9, r * 0.9); });
      var end = F.findIndex(function (f) { return f.s[0].gone || f.s[1].gone; });
      g.fillStyle = c.faint; g.fillText(end >= 0 ? 'exploded at ' + F[end].t.toFixed(1) + ' s' : F[F.length - 1].t.toFixed(0) + ' s', 8, N - 8);
    }
    // a pair of plates large, in a window of its own
    function big(m) {
      var d = SW.el('dialog', { class: 'tray-big plate-big' }), dpr = root.devicePixelRatio || 1,
          N = Math.round(Math.max(260, Math.min(620, (root.innerWidth - 140) / 2, root.innerHeight - 230)));
      d.innerHTML = '<div class="tray-bighead"><b>' + SW.esc(m.title) + '</b><button class="icon-btn" data-x title="Close (Esc)">✕</button></div>' +
        '<p class="hint">' + SW.esc(m.text) + '</p><div class="plate-pair"><canvas></canvas><canvas></canvas></div><p class="hint">Timing between plots, 1 second.</p><div class="plate-exp"></div>';
      document.body.appendChild(d);
      var cvs = SW.$$('canvas', d);
      cvs.forEach(function (cv, i) {
        cv.width = N * dpr; cv.height = N * dpr; cv.style.width = N + 'px'; cv.style.height = N + 'px';
        var vid = i ? st.b : st.a; drawPlate(cv, got[vid + '|' + m.id], m, vname(V.byId(vid)));
      });
      SW.$('.plate-exp', d).appendChild(SW.figureButtons(function () {
        var W = 2 * N + 16, o = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + ' ' + (N + 24) + '" width="' + W + '" height="' + (N + 24) + '" font-family="IBM Plex Mono, monospace" font-size="12">';
        cvs.forEach(function (cv, i) { o += '<image href="' + cv.toDataURL('image/png') + '" x="' + (i * (N + 16)) + '" y="0" width="' + N + '" height="' + N + '"/>'; });
        return o + '<text x="0" y="' + (N + 18) + '" fill="#888">' + SW.esc(m.title) + '. Timing between plots, 1 second. Spacewar! research bench.</text></svg>';
      }, 'spacewar-' + m.id, function () { return SW.refsOf([st.a, st.b]); }));
      d.addEventListener('click', function (e) { if (e.target === d || e.target.closest('[data-x]')) { d.close(); d.remove(); } });
      d.addEventListener('close', function () { d.remove(); });
      d.showModal();
    }
    function build() {
      var my = ++job, list = [];
      grid.innerHTML = '';
      cfg.moves.forEach(function (m) {
        var el = SW.el('div', { class: 'plate' });
        el.innerHTML = '<h5>' + SW.esc(m.title) + '</h5><p class="hint">' + SW.esc(m.text) + '</p><div class="plate-pair"><canvas data-s="a"></canvas><canvas data-s="b"></canvas></div><div class="plate-exp"></div>';
        grid.appendChild(el);
        var cvs = SW.$$('canvas', el), N = 250, dpr = root.devicePixelRatio || 1;
        cvs.forEach(function (cv) { cv.width = N * dpr; cv.height = N * dpr; cv.style.width = N + 'px'; cv.style.height = N + 'px'; });
        function paintPair() { [st.a, st.b].forEach(function (vid, i) { drawPlate(cvs[i], got[vid + '|' + m.id], m, vname(V.byId(vid))); }); }
        cvs.forEach(function (cv) { cv.title = 'Click to see these plates large'; cv.style.cursor = 'zoom-in'; cv.onclick = function () { big(m); }; });
        paintPair();
        list.push({ m: m, paint: paintPair });
        // the pair as one figure: two plates side by side
        SW.$('.plate-exp', el).appendChild(SW.figureButtons(function () {
          var W = 2 * N + 12, o = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + ' ' + (N + 22) + '" width="' + W + '" height="' + (N + 22) + '" font-family="IBM Plex Mono, monospace" font-size="11">';
          cvs.forEach(function (cv, i) { o += '<image href="' + cv.toDataURL('image/png') + '" x="' + (i * (N + 12)) + '" y="0" width="' + N + '" height="' + N + '"/>'; });
          return o + '<text x="0" y="' + (N + 16) + '" fill="#888">' + SW.esc(m.title) + '. Timing between plots, 1 second. Spacewar! research bench.</text></svg>';
        }, 'spacewar-' + m.id, function () { return SW.refsOf([st.a, st.b]); }));
      });
      // run each movement for both versions in turn
      var jobs = [];
      list.forEach(function (x) { [st.a, st.b].forEach(function (vid) { jobs.push({ x: x, vid: vid }); }); });
      (function next() {
        if (!alive(my)() || !jobs.length) return;
        var q = jobs.shift();
        O.move(q.vid, q.x.m, alive(my)).then(function (d) { if (!alive(my)()) return; got[q.vid + '|' + q.x.m.id] = d; q.x.paint(); setTimeout(next, 0); });
      })();
      build.list = list;
    }
    card.addEventListener('change', function (e) {
      var k = e.target.dataset.p; if (!k) return;
      if (k === 'a' || k === 'b') { st[k] = e.target.value; keep(); build(); return; }
      st[k] = e.target.checked; keep(); (build.list || []).forEach(function (x) { x.paint(); });
    });
    build();
    return function () { stopped = true; };
  };

  // the colours: 3.1 and 4.0 as in the gravity views, the others after
  var INK = { '3.1': '#ffb347', '4.0': '#9be36b' }, MORE = ['#39c5e0', '#e36bb3', '#b39bff', '#ff6b6b', '#6be3d0', '#d8d86b', '#f0f0f0'];
  function inkOf(vid, list) { if (INK[vid]) return INK[vid]; var i = list.filter(function (x) { return !INK[x]; }).indexOf(vid); return MORE[(i < 0 ? 0 : i) % MORE.length]; }

  O.draw = function (b, host) {
    var P0 = SW.store.get('orbits', {}) || {};
    var st = { vs: P0.vs || ['3.1', '4.0'], r: P0.r || 128, pct: P0.pct || 100, secs: P0.secs || 60, strobe: P0.strobe !== false, loop: P0.loop !== false, fade: P0.fade !== false, speed: P0.speed || 2 };
    function keep() { SW.store.set('orbits', st); }
    var all = V.VERSIONS.filter(function (v) { return v.build && v.id !== '1' && v.id !== 'stars'; }).sort(function (a, c) { return a.sort - c.sort; });
    var card = SW.el('div', { class: 'card grav orb', style: 'grid-column:1/-1' });
    card.innerHTML = '<h4>Orbits ' + SW.refTag(b.v.id) + '</h4>' +
      '<p class="hint">Each version’s game run on the emulator with the two ships put on opposite sides of the star, moving at the speed its own pull there would hold in a circle, then left alone. The paths as the game computes them, the outlines as it draws them once a second, and below, the distance from the star and the pull on the ship, frame by frame.</p>' +
      '<div class="orb-row"><div class="orb-main"><canvas class="orb-cv"></canvas>' +
        '<div class="well-play orb-play"><button class="btn" data-o="play">▶ Play</button> <button class="btn ghost" data-o="again" title="From the start">↺</button> ' +
        '<label>Speed <select data-o="speed"><option value="1">as played</option><option value="2">double</option><option value="4">four times</option><option value="8">eight times</option></select></label> ' +
        '<label><input type="checkbox" data-o="loop"> Loop</label> <label title="Older outlines fade as new ones are drawn"><input type="checkbox" data-o="fade"> Fade</label> <span class="hint mono orb-t">&nbsp;</span></div>' +
        '<div class="hint mono orb-read">&nbsp;</div><div class="orb-duals" hidden></div></div>' +
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
    SW.$('[data-o=strobe]', card).checked = st.strobe; SW.$('[data-o=loop]', card).checked = st.loop; SW.$('[data-o=fade]', card).checked = st.fade; SW.$('[data-o=speed]', card).value = String(st.speed);
    var cv = SW.$('.orb-cv', card), charts = SW.$('.orb-charts', card), vbox = SW.$('.orb-vs', card), read = SW.$('.orb-read', card);
    var stopped = false, job = 0, got = {}, anim = { T: null, playing: false, raf: 0, t0: 0, T0: 0 };
    function alive(my) { return function () { return !stopped && my === job; }; }
    function tEnd() { var m = 0; st.vs.forEach(function (v) { var d = got[v]; if (d && d.frames) m = Math.max(m, d.frames[d.frames.length - 1].t); }); return m || st.secs; }
    // the animation: time runs through the recorded frames; the ships drawn where they are, older outlines fading
    function tick(now) {
      if (!anim.playing) return;
      if (!card.isConnected || card.offsetParent === null) { stopPlay(); return; }
      var T = anim.T0 + (now - anim.t0) / 1000 * st.speed, end = tEnd();
      if (T >= end) { if (st.loop) { anim.T0 = 0; anim.t0 = now; T = 0; } else { T = end; stopPlay(); } }
      anim.T = T; paintScene(); cursor();
      if (anim.playing) anim.raf = requestAnimationFrame(tick);
    }
    function stopPlay() { anim.playing = false; cancelAnimationFrame(anim.raf); SW.$('[data-o=play]', card).textContent = '▶ Play'; }
    function play(fromStart) {
      if (anim.playing && !fromStart) { stopPlay(); return; }
      if (fromStart || anim.T == null || anim.T >= tEnd()) anim.T = 0;
      anim.T0 = anim.T; anim.t0 = performance.now(); anim.playing = true; SW.$('[data-o=play]', card).textContent = '⏸ Pause';
      anim.raf = requestAnimationFrame(tick);
    }

    function chips() {
      vbox.innerHTML = all.map(function (v) {
        var on = st.vs.indexOf(v.id) >= 0;
        return '<label class="orb-chip' + (on ? ' on' : '') + '"><input type="checkbox" data-v="' + v.id + '"' + (on ? ' checked' : '') + '><i style="background:' + inkOf(v.id, st.vs) + '"></i>' + SW.esc(vname(v)) + ' <span class="orb-ref mono">' + SW.esc(SW.refOf(v.id)) + '</span></label>';
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
        stopPlay(); anim.T = null;
        O.orbit(vid, st.r, st.pct, st.secs, alive(my), function (f) { read.textContent = 'Running ' + vname(V.byId(vid)) + '… ' + Math.round(f * 100) + '%'; }).then(function (d) {
          if (!alive(my)()) return;
          got[vid] = d; SW.build(vid).then(function (bv) { d.twin = SW.scopeCount(bv) === 2; paint(); }); paint(); setTimeout(next, 0);
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
    function scene(g, N, pal, T) {
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
        var ink = inkOf(vid, st.vs), F = d.frames, live = T != null, cur = -1;
        if (live) for (var j0 = 0; j0 < F.length && F[j0].t <= T; j0++) cur = j0;
        [0, 1].forEach(function (s) {
          g.strokeStyle = ink; g.lineWidth = 1.3; g.globalAlpha = live ? 0.45 : 0.9; g.setLineDash(s ? [5, 3] : []);
          g.beginPath(); var pen = false;
          F.forEach(function (f, j) {
            if (live && j > cur) return;
            var q = f.s[s]; if (q.gone) { pen = false; return; }
            if (pen && j && Math.abs(q.x - F[j - 1].s[s].x) > 200) pen = false;
            if (pen) g.lineTo(X(q.x), Y(q.y)); else g.moveTo(X(q.x), Y(q.y)); pen = true;
          });
          g.stroke(); g.setLineDash([]); g.globalAlpha = 1;
          function stamp(f, a, big, ox, oy) { if (!f.pts) return; var P = f.pts[s], w = big ? 2 : 1.6; ox = ox || 0; oy = oy || 0; g.globalAlpha = a; for (var i = 0; i < P.length; i += 2) g.fillRect(X(P[i] + ox) - w / 2, Y(P[i + 1] + oy) - w / 2, w, w); }
          g.fillStyle = ink;
          if (st.strobe) F.forEach(function (f, j) {
            if (j % 20 || (live && j > cur)) return;
            stamp(f, live && st.fade ? Math.max(0.06, Math.exp(-(T - f.t) / 5)) : 1, false);
          });
          // the ship now: the last outline kept (once a second), moved to where the ship is
          if (live && cur >= 0 && !F[cur].s[s].gone) { var j1 = cur - cur % 20; if (F[j1] && F[j1].pts) stamp(F[j1], 1, true, F[cur].s[s].x - F[j1].s[s].x, F[cur].s[s].y - F[j1].s[s].y); }
          g.globalAlpha = 1;
        });
      });
    }
    function paintScene() {
      var N = Math.round(Math.max(300, Math.min(560, cv.parentNode.clientWidth || 560, (root.innerHeight || 900) - 320))), dpr = root.devicePixelRatio || 1;
      if (cv.width !== N * dpr) { cv.width = N * dpr; cv.height = N * dpr; cv.style.width = N + 'px'; cv.style.height = N + 'px'; }
      var g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
      scene(g, N, { bg: '#000', dim: '#4a5a66' }, anim.T);
      SW.$('.orb-t', card).textContent = anim.T != null ? anim.T.toFixed(1) + ' s' : '';
      duals(N);
    }
    // 4.4, the two-console version: what each pilot's scope showed, centred on
    // their own ship, drawn from the same record (4.4's kcb subtracts the ship's
    // place from everything it plots; see F31)
    var dualBox = SW.$('.orb-duals', card);
    function duals(N) {
      var vid = st.vs.filter(function (v) { return got[v] && got[v].twin; })[0];
      if (!vid) { dualBox.hidden = true; return; }
      var d = got[vid], F = d.frames, M = Math.round(N / 2 - 8), dpr = root.devicePixelRatio || 1;
      if (dualBox.hidden || dualBox.dataset.v !== vid || +dualBox.dataset.m !== M) {
        dualBox.hidden = false; dualBox.dataset.v = vid; dualBox.dataset.m = M;
        dualBox.innerHTML = '<p class="hint">' + SW.esc(vname(V.byId(vid))) + ' on its two scopes, each centred on one pilot’s ship (F31)</p>' +
          [['Scope 1: the Wedge’s console', 1], ['Scope 2: the Needle’s console', 0]].map(function (s2) { return '<figure><canvas data-c="' + s2[1] + '" width="' + M * dpr + '" height="' + M * dpr + '" style="width:' + M + 'px;height:' + M + 'px"></canvas><figcaption>' + s2[0] + '</figcaption></figure>'; }).join('');
      }
      var T = anim.T == null ? F[F.length - 1].t : anim.T, cur = 0;
      for (var j = 0; j < F.length && F[j].t <= T; j++) cur = j;
      SW.$$('canvas', dualBox).forEach(function (cvs) {
        var c = +cvs.dataset.c, g = cvs.getContext('2d'), k = M / 1024, q = F[cur].s[c];
        g.setTransform(dpr, 0, 0, dpr, 0, 0); g.fillStyle = '#000'; g.fillRect(0, 0, M, M);
        function wrap(v) { return ((v + 512) % 1024 + 1024) % 1024 - 512; }
        function X(x) { return M / 2 + wrap(x - q.x) * k; } function Y(y) { return M / 2 - wrap(y - q.y) * k; }
        // the star, where it lies from this ship
        g.strokeStyle = '#ffce7a'; g.lineWidth = 1; var sx = X(0), sy = Y(0);
        for (var a = 0; a < 8; a++) { var t = a * Math.PI / 4; g.beginPath(); g.moveTo(sx + Math.cos(t) * 1.5, sy + Math.sin(t) * 1.5); g.lineTo(sx + Math.cos(t) * 4, sy + Math.sin(t) * 4); g.stroke(); }
        // both ships now, each its last outline moved to where it is
        g.fillStyle = inkOf(vid, st.vs);
        [0, 1].forEach(function (s2) {
          var j1 = cur - cur % 20, f0 = F[j1], fq = F[cur].s[s2]; if (!f0 || !f0.pts || fq.gone) return;
          var P = f0.pts[s2], ox = fq.x - f0.s[s2].x, oy = fq.y - f0.s[s2].y;
          for (var i = 0; i < P.length; i += 2) g.fillRect(X(P[i] + ox) - 0.8, Y(P[i + 1] + oy) - 0.8, 1.6, 1.6);
        });
      });
    }
    function paint() { paintScene(); paintCharts(); cursor(); }
    // the time on the charts
    function cursor() {
      SW.$$('.orb-cursor', charts).forEach(function (x) { x.remove(); });
      if (anim.T == null || anim.T > st.secs) return;
      SW.$$('svg', charts).forEach(function (el) {
        // measured on screen: an inline SVG may report no clientWidth
        var W = +el.getAttribute('viewBox').split(' ')[2], r = el.getBoundingClientRect(), rc = charts.getBoundingClientRect(), k = r.width / W, x = (58 + anim.T / st.secs * (W - 70)) * k;
        var c = SW.el('div', { class: 'orb-cursor' }); c.style.left = (r.left - rc.left + x) + 'px'; c.style.top = (r.top - rc.top + 18 * k) + 'px'; c.style.height = (r.height - 44 * k) + 'px';
        charts.appendChild(c);
      });
    }
    // distance from the star and the pull on the Needle, frame by frame
    function chartSVG(pal, W) {
      W = W || 900;
      var H = 150, L = 58, R = 12, T = 18, B = 26, pw = W - L - R, ph = H - T - B, runs = st.vs.filter(function (v) { return got[v] && !got[v].why; });
      if (!runs.length) return '';
      var tmax = st.secs;
      function one(title, pick, fmt) {
        var mx = 0, mn = Infinity;
        runs.forEach(function (v) { got[v].frames.forEach(function (f) { f.s.forEach(function (q) { var y = pick(q); if (y != null) { mx = Math.max(mx, y); mn = Math.min(mn, y); } }); }); });
        if (!isFinite(mn)) return '';
        var lo = title === 'distance' ? Math.max(0, mn - (mx - mn) * 0.1 - 1) : 0, hi = mx + (mx - lo) * 0.08 + 1;
        var o = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '" font-family="IBM Plex Mono, monospace" font-size="10.5">';
        o += '<rect x="' + L + '" y="' + T + '" width="' + pw + '" height="' + ph + '" fill="none" stroke="' + pal.dim + '" stroke-width="0.6"/>';
        o += '<text x="' + L + '" y="12" fill="' + pal.ink + '">' + (title === 'distance' ? 'Distance from the star (screen points): the Needle solid, the Wedge dashed' : 'Pull on each ship (length of bx, by): the Needle solid, the Wedge dashed') + '</text>';
        [lo, (lo + hi) / 2, hi].forEach(function (v) { var y = T + ph - (v - lo) / (hi - lo) * ph; o += '<text x="' + (L - 5) + '" y="' + (y + 3) + '" fill="' + pal.dim + '" text-anchor="end">' + fmt(v) + '</text>'; });
        for (var s = 0; s <= tmax; s += tmax / 6) { var x = L + s / tmax * pw; o += '<text x="' + x + '" y="' + (H - 8) + '" fill="' + pal.dim + '" text-anchor="middle">' + Math.round(s) + ' s</text>'; }
        runs.forEach(function (v) { [0, 1].forEach(function (s) {
          var d = '', pen = false;
          got[v].frames.forEach(function (f) { var y = pick(f.s[s]); if (y == null || f.t > tmax) { pen = false; return; } d += (pen ? 'L' : 'M') + (L + f.t / tmax * pw).toFixed(1) + ' ' + (T + ph - (y - lo) / (hi - lo) * ph).toFixed(1); pen = true; });
          o += '<path d="' + d + '" fill="none" stroke="' + inkOf(v, st.vs) + '" stroke-width="1.2"' + (s ? ' stroke-dasharray="5 3" opacity="0.8"' : '') + '/>';
        }); });
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
      var g = c.getContext('2d'); g.scale(2, 2); scene(g, N, { bg: '#000', dim: '#4a5a66' }, anim.playing ? null : anim.T);
      var ch = chartSVG(pal, N).replace(/<svg[^>]*>/g, '').split('</svg>');
      var o = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + N + ' ' + (N + 310) + '" width="' + N + '" height="' + (N + 310) + '" font-family="IBM Plex Mono, monospace" font-size="10.5">' +
        '<image href="' + c.toDataURL('image/png') + '" x="0" y="0" width="' + N + '" height="' + N + '"/>' +
        '<g transform="translate(0 ' + (N + 6) + ')">' + (ch[0] || '') + '</g><g transform="translate(0 ' + (N + 158) + ')">' + (ch[1] || '') + '</g>';
      st.vs.slice().reverse().forEach(function (vid, n) { var y = N - 8 - n * 12; o += '<text x="' + (N - 6) + '" y="' + y + '" fill="#cfe6ff" text-anchor="end">' + SW.esc(vname(V.byId(vid))) + '</text><rect x="' + (N - 12 - vname(V.byId(vid)).length * 6.3 - 14) + '" y="' + (y - 5) + '" width="12" height="2.5" fill="' + inkOf(vid, st.vs) + '"/>'; });
      return o + '</svg>';
    }
    SW.$('.grav-exp', card).appendChild(SW.figureButtons(function (p) { return figSVG(p); }, 'spacewar-orbits', function () { return SW.refsOf(st.vs); }));
    card.addEventListener('click', function (e) { var t = e.target.closest('[data-o=play], [data-o=again]'); if (t) play(t.dataset.o === 'again'); });
    card.addEventListener('change', function (e) {
      var t = e.target;
      if (t.dataset.v) { var id = t.dataset.v; st.vs = st.vs.filter(function (x) { return x !== id; }); if (t.checked) st.vs.push(id); st.vs.sort(function (a, c) { return V.byId(a).sort - V.byId(c).sort; }); keep(); chips(); runAll(); return; }
      var k = t.dataset.o; if (!k) return;
      if (k === 'strobe' || k === 'loop' || k === 'fade') { st[k] = t.checked; keep(); paintScene(); return; }
      if (k === 'speed') { st.speed = +t.value; keep(); if (anim.playing) { anim.T0 = anim.T; anim.t0 = performance.now(); } return; }
      st[k] = +t.value; keep(); runAll();
    });
    var lastW = 0;
    if (root.ResizeObserver) new ResizeObserver(function () { var w = card.clientWidth; if (w && Math.abs(w - lastW) > 8) { lastW = w; paint(); } }).observe(card);
    chips(); runAll();
    return function () { stopped = true; stopPlay(); };
  };
})(this);
