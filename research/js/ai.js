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
  // Temperaments, one drawn at random for each pilot each game, so two pilots of
  // one level do not fly alike: they scale the level's chase distance and speed,
  // shift how slow it lets its orbit get, and set how long it waits before its
  // first move (frames).
  var TEMPER = [
    { name: 'hunter', chase: 0.7, top: 1.2, orbit: -0.05, wait: [0, 15] },
    { name: 'duellist', chase: 1, top: 1, orbit: 0, wait: [5, 30] },
    { name: 'orbiter', chase: 1.4, top: 0.85, orbit: 0.08, wait: [10, 45] }
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
  A.pilot = function (b, k, bits, level) {
    var S = b.sym, L = A.LEVELS[level === 'fair' ? 'medium' : level] || A.LEVELS.medium, T = torpedoes(b);
    var M = TEMPER[Math.floor(Math.random() * TEMPER.length)], wait = M.wait[0] + Math.floor(Math.random() * (M.wait[1] - M.wait[0]));
    var mtb = S.mtb.val, nob = S.nob.val, nx = S.nx1.val, ny = S.ny1.val, dx = S.ndx.val, dy = S.ndy.val, th = S.nth.val;
    var mex = S.mex ? S.mex.val : -1, tcr = S.tcr ? S.tcr.val : -1;
    var hyp = {}; ['hp1', 'hp3', 'hp7'].forEach(function (n) { if (S[n]) hyp[S[n].val] = 1; });
    var canHyper = !!S.hp1;
    var frame = Math.floor(Math.random() * 3), last = 0, fired = false, hyperAt = -9999, spin = 1;
    // each pilot its own drifting wobble in its aim, so two do not fly as mirror images
    var wob = 0, wobTo = 0;

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

    var fly = function (mem) {
      frame++;
      if (frame % 30 === 0) wobTo = (Math.random() - 0.5) * 2 * L.wob;
      wob += (wobTo - wob) * 0.1;
      if (frame % L.every) return last;
      var me = ship(mem, k), him = ship(mem, 1 - k), out = 0;
      track(him);
      if (!me.alive) { wait = M.wait[0] + Math.floor(Math.random() * (M.wait[1] - M.wait[0])); return (last = 0); }
      if (wait > 0) { wait--; return (last = 0); }   // a moment's thought at the start of each game

      // Fire whenever a torpedo would pass close to the other ship, whatever else it
      // is doing; pressed and released in turn, so versions that fire once a press fire
      var dHim = him.alive ? Math.hypot(wrapD(him.x - me.x), wrapD(him.y - me.y)) : Infinity, mNow = him.alive ? missIf(me, him, me.a) : Infinity;
      var shoot = mNow < L.hit || (dHim < L.spray && mNow < L.hit * 2.5);
      function trigger(o) { if (shoot) { if (!fired) o |= bits.torpedo; fired = !fired; } else fired = false; return o; }

      // 1. torpedoes coming: the nearest approach of each over the next second
      var threat = null;
      if (L.dodge && tcr >= 0) for (var i = 2; i < nob; i++) {
        if ((mem[mtb + i] & 0o7777) !== tcr) continue;
        var t = ship(mem, i), rx = wrapD(t.x - me.x), ry = wrapD(t.y - me.y), vx = t.vx - me.vx, vy = t.vy - me.vy;
        var v2 = vx * vx + vy * vy; if (!v2) continue;
        var tca = -(rx * vx + ry * vy) / v2; if (tca < 0 || tca > L.dodge) continue;
        var miss = Math.hypot(rx + vx * tca, ry + vy * tca);
        if (miss < L.near && (!threat || tca < threat.tca)) threat = { tca: tca, vx: vx, vy: vy };
      }
      if (threat) {
        if (L.hyper && canHyper && threat.tca < L.hyper && frame - hyperAt > 400) { hyperAt = frame; return (last = bits.ccw | bits.cw); }
        var s = steer(me, headingTo(-threat.vy, threat.vx), 0.5);
        out |= s.bits; if (s.on) out |= bits.rocket;
        return (last = trigger(out));
      }

      // 2. the star: keep in orbit round it. Falling inward, or too slow across the
      // line to the star, thrust along the orbit (square to the star, the way it
      // is already going round), as the players' opening did (the CBS eye). Ships
      // turn only about a thirtieth of a radian a frame, so it starts early.
      var r = Math.hypot(me.x, me.y), ox = r ? me.x / r : 0, oy = r ? me.y / r : 1;
      var vr = me.vx * ox + me.vy * oy, h = me.x * me.vy - me.y * me.vx, vt = r ? Math.abs(h) / r : 0;
      if (vt > 0.15) spin = h > 0 ? 1 : -1;
      else { var hx0 = -Math.sin(me.a), hy0 = Math.cos(me.a); spin = (-oy * hx0 + ox * hy0) >= 0 ? 1 : -1; if (M.name === 'hunter') spin = -spin; }
      var fall = r < 100 || (r < 420 && vt < L.orbitVt + M.orbit) || (r < 260 && vr < -0.3 && vt < 1);
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
      var s3 = steer(me, aimAt(me, him) + wob, L.aim);
      out |= s3.bits;
      var px = wrapD(him.x - me.x), py = wrapD(him.y - me.y), d = Math.hypot(px, py);
      var sp = Math.hypot(me.vx, me.vy), hx = -Math.sin(me.a), hy = Math.cos(me.a);
      // never by thrusting toward the star
      if (L.chaseAt && s3.on && d > L.chaseAt * M.chase && sp < L.top * M.top && hx * ox + hy * oy > -0.1) out |= bits.rocket;
      return (last = trigger(out));
    };
    fly.temper = M.name; fly.level = level;
    return fly;
  };
})(this);
