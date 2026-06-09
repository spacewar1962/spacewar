/* Hero starfield — a quiet homage to Peter Samson's "Expensive Planetarium"
   and Russell's two ships, drawn as phosphor vector lines on the Type 30 CRT.
   Lightweight canvas, decorative only. Honours prefers-reduced-motion. */
(function () {
  var canvas = document.getElementById('starfield');
  if (!canvas) return;
  var ctx = canvas.getContext('2d');
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var W, H, DPR, stars, ships, t = 0;

  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = canvas.clientWidth; H = canvas.clientHeight;
    canvas.width = W * DPR; canvas.height = H * DPR;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    seed();
  }

  function seed() {
    // Fixed star field (positions are deterministic per layout, not random per frame).
    var n = Math.round((W * H) / 6500);
    stars = [];
    var s = 20261962; // seeded LCG so the "planetarium" is stable, not noisy
    function rnd() { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; }
    for (var i = 0; i < n; i++) {
      stars.push({ x: rnd() * W, y: rnd() * H, m: rnd(), p: rnd() * Math.PI * 2 });
    }
    // Two ships drifting and slowly orbiting, like a demo left running.
    ships = [
      { kind: 'wedge',  cx: W * 0.34, cy: H * 0.42, r: 0, a: 0,        spin: 0.004,  drift: 0.18 },
      { kind: 'needle', cx: W * 0.66, cy: H * 0.60, r: 0, a: Math.PI,  spin: -0.005, drift: 0.15 }
    ];
  }

  // Ship outlines, in the spirit of Russell's outline-compiler vectors.
  var SHAPES = {
    wedge:  [[0,-11],[7,11],[0,6],[-7,11],[0,-11]],
    needle: [[0,-12],[3,10],[0,6],[-3,10],[0,-12]]
  };

  function drawShip(sh) {
    var pts = SHAPES[sh.kind];
    ctx.save();
    ctx.translate(sh.cx, sh.cy);
    ctx.rotate(sh.a);
    ctx.beginPath();
    for (var i = 0; i < pts.length; i++) {
      var x = pts[i][0], y = pts[i][1];
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = 'rgba(108,242,255,0.85)';
    ctx.lineWidth = 1.2;
    ctx.shadowColor = 'rgba(108,242,255,0.8)';
    ctx.shadowBlur = 8;
    ctx.stroke();
    ctx.restore();
  }

  function frame() {
    ctx.clearRect(0, 0, W, H);

    // stars: faint phosphor points, gentle twinkle
    for (var i = 0; i < stars.length; i++) {
      var st = stars[i];
      var tw = reduce ? 0.6 : 0.5 + 0.5 * Math.sin(t * 0.04 + st.p);
      var a = (0.15 + st.m * 0.55) * tw;
      var sz = st.m > 0.92 ? 1.6 : 1.0;
      ctx.fillStyle = 'rgba(191,228,255,' + a.toFixed(3) + ')';
      ctx.fillRect(st.x, st.y, sz, sz);
    }

    // central "sun" glow, the heavy star at the centre of the game
    var g = ctx.createRadialGradient(W/2, H/2, 0, W/2, H/2, 60);
    g.addColorStop(0, 'rgba(255,206,122,0.10)');
    g.addColorStop(1, 'rgba(255,206,122,0)');
    ctx.fillStyle = g;
    ctx.fillRect(W/2 - 60, H/2 - 60, 120, 120);

    for (var j = 0; j < ships.length; j++) {
      var sh = ships[j];
      if (!reduce) {
        sh.a += sh.spin;
        // slow orbital drift around the centre
        var ox = sh.cx - W/2, oy = sh.cy - H/2;
        var ang = Math.atan2(oy, ox) + sh.drift * 0.004;
        var rad = Math.sqrt(ox*ox + oy*oy);
        sh.cx = W/2 + Math.cos(ang) * rad;
        sh.cy = H/2 + Math.sin(ang) * rad;
      }
      drawShip(sh);
    }

    t++;
    if (!reduce) raf = requestAnimationFrame(frame);
  }

  var raf;
  window.addEventListener('resize', function () { resize(); });
  resize();
  frame();
})();
