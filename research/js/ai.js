/*
 * ai.js - a computer pilot for the Run view.
 *
 * It flies a ship by the same means a player has: each frame of the game (at
 * ml0) it reads the ships, torpedoes and star from core and sets that ship's
 * bits of the control word (ccw, cw, rocket, torpedo; both turn bits together
 * for hyperspace, where the version has it). It knows nothing the screen does
 * not show. Positions are the top ten bits of nx1 and ny1 (screen points),
 * velocities ndx and ndy (a frame moves a ship by a velocity shifted right three
 * places), the heading nth (0 points up; the thrust runs along -sin, cos).
 */
(function (root) {
  'use strict';
  var SW = root.SW, A = SW.ai = {};

  function s18(w) { return w & 0o400000 ? -(w ^ 0o777777) : w; }
  function wrapA(a) { while (a > Math.PI) a -= 2 * Math.PI; while (a <= -Math.PI) a += 2 * Math.PI; return a; }
  function wrapD(d) { while (d > 512) d -= 1024; while (d < -512) d += 1024; return d; }   // the screen wraps at its edges

  // How well it flies: how near a torpedo must be to pass the other ship before
  // it fires (points), how finely it aims, whether it dodges torpedoes and uses
  // hyperspace, how often it looks (frames), how much its aim wanders (radians).
  // hit: how near a torpedo must pass the other ship before it fires (points);
  // aim: how finely it turns to meet it (radians); dodge: how far ahead it
  // watches for torpedoes (frames; 0, not at all) and near: how close one must
  // come (points); hyper: how late it jumps (frames; 0, never); every: how often
  // it looks (frames); wob: how far its aim wanders (radians); chaseAt: beyond
  // what distance it thrusts toward the other ship (0, never); top: the speed it
  // lets itself reach doing so (points a frame); orbitVt: how slow across the
  // star it lets itself get before it burns to hold its orbit (points a frame);
  // spray: within this distance it fires at every chance (points); jink: when the
  // other ship points at it from nearer than this, it thrusts sideways (points; 0, never).
  A.LEVELS = {
    easy: { hit: 24, aim: 0.14, dodge: 0, near: 0, hyper: 0, every: 2, wob: 0.12, chaseAt: 0, top: 0, orbitVt: 0.7, spray: 0, jink: 0 },
    medium: { hit: 18, aim: 0.05, dodge: 20, near: 14, hyper: 0, every: 1, wob: 0.04, chaseAt: 0, top: 1.6, orbitVt: 0.55, spray: 90, jink: 0 },
    hard: { hit: 18, aim: 0.06, dodge: 22, near: 14, hyper: 2, every: 1, wob: 0.05, chaseAt: 200, top: 1.7, orbitVt: 0.52, spray: 100, jink: 0 },
    hardcore: { hit: 18, aim: 0.04, dodge: 22, near: 14, hyper: 5, every: 1, wob: 0.01, chaseAt: 200, top: 1.7, orbitVt: 0.52, spray: 100, jink: 0 }
  };
  // Calibrated on the emulator, 29 Sep 2026, ten 90-second games a pairing in 3.1
  // and 4.8 (ships lost, weaker first): easy 33, medium 18; medium 36, hard 23;
  // hard 34, hardcore 5. What tells most is jumping to hyperspace in time; firing
  // only at near-certain hits, jinking aside when aimed at and a longer watch for
  // torpedoes were tried for hardcore and made it worse.

  A.LEVEL_NAMES = [['easy', 'easy'], ['medium', 'medium'], ['hard', 'hard'], ['hardcore', 'hardcore']];
  A.LOOP = { p: 0.18, open: 0.8, r0: 80, r1: 120, top: 3, min: 45 };
  A.STYLE_NAMES = [['hunter', 'hunter'], ['duellist', 'duellist'], ['orbiter', 'orbiter']];
  // Styles, chosen on Run for each computer ship (all at the hard level): they
  // scale the level's chase distance and speed, shift how slow it lets its orbit
  // get, set how long it waits before its first move, and how long it circles at
  // the start of a round before going in (frames, drawn at random within the
  // range, so two pilots of one style do not fly alike).
  var TEMPER = [
    { name: 'hunter', chase: 0.7, top: 1.2, orbit: -0.05, wait: [0, 15], think: [60, 180] },
    { name: 'duellist', chase: 1, top: 1, orbit: 0, wait: [5, 30], think: [100, 300] },
    { name: 'orbiter', chase: 1.4, top: 0.85, orbit: 0.08, wait: [10, 45], think: [160, 400] }
  ];

  // The version's torpedoes, from its own constants: speed relative to the ship
  // (the heading shifted right by tvl; 4 points a frame at sar 4s, 2 in 2B at sar
  // 5s) and life in frames (tlf; 2B's trf). Measured on the emulator, 29 Sep 2026.
  function torpedoes(b) {
    var S = b.sym, m = b.asm.memory, w = function (n) { return S[n] && m[S[n].val] ? m[S[n].val].val : null; };
    var tv = w('tvl'), sh = 5;
    if (tv != null) { sh = 0; for (var x = tv & 0o777; x; x >>= 1) sh += x & 1; }
    var lf = w('tlf'); if (lf == null) lf = w('trf');
    return { speed: 64 / Math.pow(2, sh), life: lf != null ? (lf & 0o7777) : 96, ahead: 36 };
  }

  // A pilot for ship k of build b, with that ship's control bits (from SW.controlMap).
  // style: hunter, duellist or orbiter (at random if not given); level: hard if not given.
  A.pilot = function (b, k, bits, style, level) {
    level = level || 'hard';
    var S = b.sym, L = A.LEVELS[level] || A.LEVELS.hard, T = torpedoes(b);
    var M = TEMPER.filter(function (t) { return t.name === style; })[0] || TEMPER[Math.floor(Math.random() * TEMPER.length)], wait = M.wait[0] + Math.floor(Math.random() * (M.wait[1] - M.wait[0]));
    var mtb = S.mtb.val, nob = S.nob.val, nx = S.nx1.val, ny = S.ny1.val, dx = S.ndx.val, dy = S.ndy.val, th = S.nth.val;
    var mex = S.mex ? S.mex.val : -1, tcr = S.tcr ? S.tcr.val : -1;
    var hyp = {}; ['hp1', 'hp3', 'hp7'].forEach(function (n) { if (S[n]) hyp[S[n].val] = 1; });
    var canHyper = !!S.hp1;
    var frame = Math.floor(Math.random() * 3), last = 0, fired = false, hyperAt = -9999, spin = 1;
    // each pilot its own drifting wobble in its aim, so two do not fly as mirror images
    var wob = 0, wobTo = 0;
    // A plan, drawn afresh at each new life and every few seconds, so that a play
    // that worked once is not repeated: which way round the star, how slow it lets
    // its orbit get, how far off it chases, how near a shot must pass before it
    // fires, a small bias in its aim, and now and then a short feint off its line.
    var plan = null, loop = null, fresh = true, seen = 0, spotted = 0;
    var LOOP = A.LOOP;
    function rnd(a, b) { return a + Math.random() * (b - a); }
    function newPlan() {
      var p = { spin: Math.random() < 0.5 ? 1 : -1, vt: rnd(-0.12, 0.12), chase: rnd(0.6, 1.5), top: rnd(0.85, 1.2),
                hit: rnd(0.8, 1.25), react: Math.floor(rnd(2, 7)), bias: rnd(-1, 1) * L.aim, until: frame + Math.floor(rnd(150, 450)), feint: null };
      if (Math.random() < 0.35) { var at = frame + Math.floor(rnd(20, 120)); p.feint = { at: at, to: at + Math.floor(rnd(20, 50)), turn: (Math.random() < 0.5 ? 1 : -1) * rnd(0.6, 1.3) }; }
      return p;
    }

    function ship(mem, j) {
      var w = mem[mtb + j], r = w & 0o7777;
      return { alive: w !== 0 && r !== mex && !hyp[r], x: s18(mem[nx + j]) / 256, y: s18(mem[ny + j]) / 256,
               vx: s18(mem[dx + j]) / 2048, vy: s18(mem[dy + j]) / 2048, a: s18(mem[th + j]) / 16384 };
    }
    function steer(me, to, tol) {
      var e = wrapA(to - me.a);
      if (Math.abs(e) <= tol) return { bits: 0, on: true };
      return { bits: e > 0 ? bits.ccw : bits.cw, on: false };
    }
    function headingTo(ddx, ddy) { return Math.atan2(-ddx, ddy); }
    // The other ship's acceleration (the star's pull, and its rocket), estimated from
    // how its velocity changed over the last frames. Only the ship's path bends:
    // gravity does not act on torpedoes, which fly straight (F24)
    var hv = null, hax = 0, hay = 0;
    function track(him) {
      if (hv && him.alive) { hax += ((him.vx - hv.vx) - hax) * 0.4; hay += ((him.vy - hv.vy) - hay) * 0.4; }
      hv = him.alive ? { vx: him.vx, vy: him.vy } : null;
    }
    // The star's pull, measured on itself while coasting (no rocket last frame):
    // the change in its velocity times r squared, for the speed of a circular orbit
    var mv = null, gm = 0;
    function pull(me) {
      var r = Math.hypot(me.x, me.y);
      if (mv && me.alive && !(prev & bits.rocket) && r > 40) {
        var a = Math.hypot(me.vx - mv.vx, me.vy - mv.vy) * r * r;
        if (a > 0) gm = gm ? gm + (a - gm) * 0.2 : a;
      }
      mv = me.alive ? { vx: me.vx, vy: me.vy } : null;
    }
    // A torpedo fired now along heading a: how near it passes the other ship (points),
    // the other ship followed along its bending path, a frame at a time
    function missIf(me, him, a) {
      var hx = -Math.sin(a), hy = Math.cos(a);
      var rx = wrapD(him.x - me.x - hx * T.ahead), ry = wrapD(him.y - me.y - hy * T.ahead);
      var wx = me.vx + hx * T.speed - him.vx, wy = me.vy + hy * T.speed - him.vy, best = Infinity;
      for (var t = 0; t <= T.life; t += 2) {
        var ex = rx - wx * t + 0.5 * hax * t * t, ey = ry - wy * t + 0.5 * hay * t * t, m = Math.hypot(ex, ey);
        if (m < best) best = m; else if (m > best + 60) break;
      }
      return best;
    }
    // where to point to meet it: lead the target along its path, solved a few times over
    function aimAt(me, him) {
      var rx = wrapD(him.x - me.x), ry = wrapD(him.y - me.y), t = Math.hypot(rx, ry) / T.speed, ax = rx, ay = ry;
      for (var n = 0; n < 5; n++) {
        ax = rx + (him.vx - me.vx) * t + 0.5 * hax * t * t; ay = ry + (him.vy - me.vy) * t + 0.5 * hay * t * t;
        t = Math.min(T.life, Math.max(0, Math.hypot(ax, ay) - T.ahead) / T.speed);
      }
      return headingTo(ax, ay);
    }

    // Slips, now and then, as a person makes them: a hesitation (holding what it was
    // doing), turning too far, holding the rocket too long, a wild shot, not seeing
    // a torpedo coming, letting the orbit sag. One every few seconds, a few frames long.
    var slip = null, slipAt = Math.floor(rnd(120, 360)), prev = 0, n = 0;
    var SLIPS = [['freeze', 6, 15], ['overturn', 4, 12], ['burn', 8, 20], ['wild', 1, 1], ['blind', 20, 40], ['drift', 20, 60]];
    function slipping(kind) { return slip && slip.kind === kind; }
    var fly = function (mem) {
      n++;
      if (slip && n >= slip.to) slip = null;
      if (!slip && n >= slipAt) {
        var z = SLIPS[Math.floor(Math.random() * SLIPS.length)];
        slip = { kind: z[0], to: n + Math.floor(rnd(z[1], z[2] + 1)), dir: prev & bits.ccw ? bits.ccw : prev & bits.cw ? bits.cw : (Math.random() < 0.5 ? bits.ccw : bits.cw) };
        slipAt = n + Math.floor(rnd(120, 360));
      }
      var o = think(mem), both = bits.ccw | bits.cw;
      if (slip && (o & both) !== both) {   // never spoils a jump into hyperspace
        if (slip.kind === 'freeze') o = prev;
        else if (slip.kind === 'overturn') o = (o & ~both) | slip.dir;
        else if (slip.kind === 'burn') o |= bits.rocket;
        else if (slip.kind === 'wild' && !(prev & bits.torpedo)) o |= bits.torpedo;
      }
      return (prev = o);
    };
    var think = function (mem) {
      frame++;
      if (frame % 30 === 0) wobTo = (Math.random() - 0.5) * 2 * L.wob;
      wob += (wobTo - wob) * 0.1;
      if (frame % L.every) return last;
      var me = ship(mem, k), him = ship(mem, 1 - k), out = 0;
      track(him); pull(me);
      if (!me.alive) { wait = M.wait[0] + Math.floor(Math.random() * (M.wait[1] - M.wait[0] + 30)); plan = null; loop = null; fresh = true; return (last = 0); }
      if (!plan || frame > plan.until) {
        plan = newPlan();
        // At the start of a round, as people did, it usually circles a while to get
        // its bearings, round the star at about its own distance, before going in
        if (fresh && Math.random() < LOOP.open) {
          var r0 = Math.hypot(me.x, me.y);
          loop = { R: Math.max(110, Math.min(280, r0 * rnd(0.55, 0.85))), swept: 0, ang: null, laps: 9, go: true,
                   to: frame + Math.floor(rnd(M.think[0], M.think[1])) };
        }
        fresh = false;
        // now and then, a turn round the star before going in, as players did for show
        if (!loop && Math.random() < LOOP.p) loop = { R: rnd(LOOP.r0, LOOP.r1), swept: 0, ang: null, to: frame + 700, laps: rnd(1, 1.4), go: false };
      }
      if (wait > 0) { wait--; return (last = 0); }   // a moment's thought at the start of each game

      // Fire whenever a torpedo would pass close to the other ship, whatever else it
      // is doing; pressed and released in turn, so versions that fire once a press fire
      var dHim = him.alive ? Math.hypot(wrapD(him.x - me.x), wrapD(him.y - me.y)) : Infinity, mNow = him.alive ? missIf(me, him, me.a) : Infinity;
      var hit = L.hit * plan.hit, shoot = mNow < hit || (dHim < L.spray && mNow < hit * 2.5);
      // a person's reaction time: a shot has to stay lined up a few frames before it fires
      seen = shoot ? seen + 1 : 0; shoot = shoot && seen > plan.react;
      function trigger(o) { if (shoot) { if (!fired) o |= bits.torpedo; fired = !fired; } else fired = false; return o; }

      // 1. torpedoes coming: the nearest approach of each over the next second
      var threat = null;
      if (L.dodge && tcr >= 0 && !slipping('blind')) for (var i = 2; i < nob; i++) {
        if ((mem[mtb + i] & 0o7777) !== tcr) continue;
        var t = ship(mem, i), rx = wrapD(t.x - me.x), ry = wrapD(t.y - me.y), vx = t.vx - me.vx, vy = t.vy - me.vy;
        var v2 = vx * vx + vy * vy; if (!v2) continue;
        var tca = -(rx * vx + ry * vy) / v2; if (tca < 0 || tca > L.dodge) continue;
        var miss = Math.hypot(rx + vx * tca, ry + vy * tca);
        if (miss < L.near && (!threat || tca < threat.tca)) threat = { tca: tca, vx: vx, vy: vy };
      }
      // and a torpedo has to be seen a few frames before it is dodged
      spotted = threat ? spotted + 1 : 0; if (spotted <= plan.react + 2) threat = null;
      if (threat) {
        if (L.hyper && canHyper && threat.tca < L.hyper && frame - hyperAt > 400) { hyperAt = frame; return (last = bits.ccw | bits.cw); }
        var s = steer(me, headingTo(-threat.vy, threat.vx), 0.5);
        out |= s.bits; if (s.on) out |= bits.rocket;
        return (last = trigger(out));
      }

      // A turn round the star, for show: in close, the heading along the orbit bent in
      // or out toward the chosen radius, the rocket held to a swing; fire held unless
      // the other ship is point blank. Ends after the laps, or if it takes too long.
      var lr = Math.hypot(me.x, me.y);
      if (loop && !loop.go && dHim > 300) loop.go = true;   // only with the other ship well away
      if (loop && loop.go && dHim < 160) loop = null;       // and not with it closing in
      if (loop && loop.go && lr > LOOP.min) {
        var la = Math.atan2(me.y, me.x);
        if (loop.ang !== null) loop.swept += Math.abs(wrapA(la - loop.ang));
        loop.ang = la;
        if (loop.swept >= loop.laps * 2 * Math.PI || frame > loop.to) { loop.done = true; loop = null; }
        else {
          var lox = me.x / lr, loy = me.y / lr, lh = me.x * me.vy - me.y * me.vx;
          var ls = Math.abs(lh) / lr > 0.15 ? (lh > 0 ? 1 : -1) : plan.spin;
          // the velocity of a circular orbit at radius R, drifting in or out toward it;
          // thrust only to close the difference, and let the star do the turning
          var vc = gm ? Math.min(LOOP.top, Math.sqrt(gm / lr)) : 1.2, vrT = Math.max(-0.6, Math.min(0.6, (loop.R - lr) * 0.02));
          var ex = -loy * ls * vc + lox * vrT - me.vx, ey = lox * ls * vc + loy * vrT - me.vy;
          var ll = steer(me, Math.hypot(ex, ey) > 0.12 ? headingTo(ex, ey) : headingTo(-loy * ls, lox * ls), 0.4);
          out |= ll.bits; if (ll.on && Math.hypot(ex, ey) > 0.12) out |= bits.rocket;
          shoot = dHim < 120 && mNow < hit * 0.5;
          return (last = trigger(out));
        }
      }

      // 2. the star: keep in orbit round it. Falling inward, or too slow across the
      // line to the star, thrust along the orbit (square to the star, the way it
      // is already going round), as the players' opening did (the CBS eye). Ships
      // turn only about a thirtieth of a radian a frame, so it starts early.
      var r = Math.hypot(me.x, me.y), ox = r ? me.x / r : 0, oy = r ? me.y / r : 1;
      var vr = me.vx * ox + me.vy * oy, h = me.x * me.vy - me.y * me.vx, vt = r ? Math.abs(h) / r : 0;
      if (vt > 0.15) spin = h > 0 ? 1 : -1;
      else spin = plan.spin;
      var fall = r < 100 || (!(slipping('drift') && r > 140) && ((r < 420 && vt < L.orbitVt + M.orbit + plan.vt) || (r < 260 && vr < -0.3 && vt < 1)));
      if (fall) {
        var tx = -oy * spin, ty = ox * spin, lift = r < 100 ? 0.6 : 0.15;
        var s2 = steer(me, headingTo(tx + lift * ox, ty + lift * oy), 0.45);
        out |= s2.bits; if (s2.on) out |= bits.rocket;
        if (L.hyper && canHyper && r < 22 && frame - hyperAt > 400) { hyperAt = frame; return (last = bits.ccw | bits.cw); }
        return (last = trigger(out));
      }

      // 3. the other ship: turn to meet it, and close in when far
      if (!him.alive) return (last = 0);
      // being aimed at from near: thrust sideways (never toward the star), spoiling its aim
      if (L.jink && dHim < L.jink) {
        var qx = wrapD(me.x - him.x), qy = wrapD(me.y - him.y);
        // only a shot that would hit: the other ship's torpedo, fired now, passing within 12 points
        if (missIf(him, me, him.a) < 12) {
          var sx = -qy / dHim, sy = qx / dHim; if (sx * ox + sy * oy < 0) { sx = -sx; sy = -sy; }
          var sj = steer(me, headingTo(sx, sy), 0.5);
          out |= sj.bits; if (sj.on && Math.hypot(me.vx, me.vy) < L.top) out |= bits.rocket;
          return (last = trigger(out));
        }
      }
      var feint = plan.feint && frame >= plan.feint.at && frame < plan.feint.to;
      var s3 = steer(me, aimAt(me, him) + wob + plan.bias + (feint ? plan.feint.turn : 0), L.aim);
      out |= s3.bits;
      var px = wrapD(him.x - me.x), py = wrapD(him.y - me.y), d = Math.hypot(px, py);
      var sp = Math.hypot(me.vx, me.vy), hx = -Math.sin(me.a), hy = Math.cos(me.a);
      // never by thrusting toward the star
      if ((feint || (L.chaseAt && d > L.chaseAt * M.chase * plan.chase)) && s3.on && sp < L.top * M.top * plan.top && hx * ox + hy * oy > -0.1) out |= bits.rocket;
      return (last = trigger(out));
    };
    fly.temper = M.name; fly.level = level;
    fly.state = function () { return { loop: loop, slip: slip && slip.kind, plan: plan, gm: gm }; };   // for inspection
    return fly;
  };
})(this);
