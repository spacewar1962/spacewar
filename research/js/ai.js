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

  // How well it flies: how close it must be pointing to fire, how far it will
  // shoot, whether it dodges torpedoes and uses hyperspace, how often it looks.
  A.LEVELS = {
    easy: { aim: 0.30, range: 300, dodge: false, hyper: false, every: 3, lead: 0 },
    fair: { aim: 0.16, range: 420, dodge: true, hyper: false, every: 2, lead: 0.6 },
    hard: { aim: 0.08, range: 520, dodge: true, hyper: true, every: 1, lead: 1 }
  };

  // A pilot for ship k of build b, with that ship's control bits (from SW.controlMap).
  A.pilot = function (b, k, bits, level) {
    var S = b.sym, L = A.LEVELS[level] || A.LEVELS.fair;
    var mtb = S.mtb.val, nob = S.nob.val, nx = S.nx1.val, ny = S.ny1.val, dx = S.ndx.val, dy = S.ndy.val, th = S.nth.val;
    var mex = S.mex ? S.mex.val : -1, tcr = S.tcr ? S.tcr.val : -1;
    var hyp = {}; ['hp1', 'hp3', 'hp7'].forEach(function (n) { if (S[n]) hyp[S[n].val] = 1; });
    var canHyper = !!S.hp1;
    var frame = 0, last = 0, fired = false, hyperAt = -9999, spin = 1;
    // each pilot its own: a wobble in its aim that drifts, a range it likes, a phase
    // to its looking, so two computer pilots do not fly as mirror images
    var wob = 0, wobTo = 0, likes = L.range * (0.8 + 0.4 * Math.random()); frame = Math.floor(Math.random() * 3);

    function ship(mem, j) {
      var w = mem[mtb + j], r = w & 0o7777;
      return { alive: w !== 0 && r !== mex && !hyp[r], x: s18(mem[nx + j]) / 256, y: s18(mem[ny + j]) / 256,
               vx: s18(mem[dx + j]) / 2048, vy: s18(mem[dy + j]) / 2048, a: s18(mem[th + j]) / 16384 };
    }
    // turn toward angle 'to'; true when pointing within tol
    function steer(me, to, tol) {
      var e = wrapA(to - me.a);
      if (Math.abs(e) <= tol) return { bits: 0, on: true };
      return { bits: e > 0 ? bits.ccw : bits.cw, on: false };
    }
    function headingTo(ddx, ddy) { return Math.atan2(-ddx, ddy); }

    return function (mem) {
      frame++;
      if (frame % 25 === 0) wobTo = (Math.random() - 0.5) * 2 * L.aim;
      wob += (wobTo - wob) * 0.1;
      if (frame % L.every) return last;
      var me = ship(mem, k), him = ship(mem, 1 - k), out = 0;
      if (!me.alive) return (last = 0);

      // 1. torpedoes coming: the nearest approach of each over the next second
      var threat = null;
      if (L.dodge && tcr >= 0) for (var i = 2; i < nob; i++) {
        if ((mem[mtb + i] & 0o7777) !== tcr) continue;
        var t = ship(mem, i), rx = wrapD(t.x - me.x), ry = wrapD(t.y - me.y), vx = t.vx - me.vx, vy = t.vy - me.vy;
        var v2 = vx * vx + vy * vy; if (!v2) continue;
        var tca = -(rx * vx + ry * vy) / v2; if (tca < 0 || tca > 24) continue;
        var mx = rx + vx * tca, my = ry + vy * tca, miss = Math.hypot(mx, my);
        if (miss < 16 && (!threat || tca < threat.tca)) threat = { tca: tca, vx: vx, vy: vy };
      }
      if (threat) {
        if (L.hyper && canHyper && threat.tca < 5 && frame - hyperAt > 400) { hyperAt = frame; return (last = bits.ccw | bits.cw); }
        // thrust across the torpedo's path
        var s = steer(me, headingTo(-threat.vy, threat.vx), 0.5);
        out |= s.bits; if (s.on) out |= bits.rocket;
        return (last = out);
      }

      // 2. the star: keep in orbit round it. Falling inward, or too slow across the
      // line to the star, thrust along the orbit (square to the star, the way it
      // is already going round), as the players' opening did (the CBS eye)
      var r = Math.hypot(me.x, me.y), ox = r ? me.x / r : 0, oy = r ? me.y / r : 1;
      var vr = me.vx * ox + me.vy * oy, h = me.x * me.vy - me.y * me.vx, vt = r ? Math.abs(h) / r : 0;
      // the way round: as it already goes, or, from rest, whichever needs less turning
      if (vt > 0.15) spin = h > 0 ? 1 : -1;
      else { var hx0 = -Math.sin(me.a), hy0 = Math.cos(me.a); spin = (-oy * hx0 + ox * hy0) >= 0 ? 1 : -1; }
      // ships turn slowly (about a thirtieth of a radian a frame), so the orbit is
      // started early: anywhere inside the corners while too slow across the star
      var fall = r < 110 || (r < 440 && vt < 0.75) || (r < 330 && vr < -0.12 && vt < 1.1);
      if (fall) {
        var tx = -oy * spin, ty = ox * spin, lift = r < 110 ? 0.6 : 0.15;
        var s2 = steer(me, headingTo(tx + lift * ox, ty + lift * oy), 0.45);
        out |= s2.bits; if (s2.on) out |= bits.rocket;
        if (L.hyper && canHyper && r < 22 && frame - hyperAt > 400) { hyperAt = frame; out = bits.ccw | bits.cw; }
        return (last = out);
      }

      // 3. the other ship: point where it will be, and fire
      if (!him.alive) return (last = 0);
      var px = wrapD(him.x - me.x), py = wrapD(him.y - me.y), d = Math.hypot(px, py);
      var lt = L.lead * d / 4;   // a torpedo covers about four points a frame
      var ax = px + (him.vx - me.vx) * lt, ay = py + (him.vy - me.vy) * lt;
      var s3 = steer(me, headingTo(ax, ay) + wob, L.aim);
      out |= s3.bits;
      // the button is pressed and released in turn, so a version that fires once a press fires
      if (s3.on && d < likes) { if (!fired) out |= bits.torpedo; fired = !fired; } else fired = false;
      // far off: close in a little, but never by thrusting toward the star
      var sp = Math.hypot(me.vx, me.vy), hx = -Math.sin(me.a), hy = Math.cos(me.a);
      if (s3.on && d > 360 && sp < 0.9 && hx * ox + hy * oy > 0.2) out |= bits.rocket;
      return (last = out);
    };
  };
})(this);
