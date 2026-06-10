/* Easter egg: type "minsky" anywhere on the front page to summon the
   Minskytron, the PDP-1 display hack Marvin Minsky wrote in 1962 (and the
   source of Spacewar!'s hyperspace effect). Instead of leaving the site,
   the curve is drawn live in a small phosphor panel, with a reference and
   a link to the original emulation at masswerk. */
(function () {
  var TARGET = 'minsky';
  var buf = '';
  var open = false;
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  document.addEventListener('keydown', function (e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    var k = (e.key || '').toLowerCase();
    if (k.length !== 1 || k < 'a' || k > 'z') return;
    buf = (buf + k).slice(-TARGET.length);
    if (buf === TARGET && !open) reveal();
  });

  function reveal() {
    open = true;
    var box = document.createElement('div');
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-label', 'The Minskytron display hack');
    box.style.cssText = [
      'position:fixed', 'left:50%', 'bottom:28px', 'transform:translateX(-50%) translateY(12px)',
      'z-index:9999', 'width:320px', 'max-width:92vw', 'padding:16px 18px 14px',
      'border:1px solid #6cf2ff', 'border-radius:3px', 'background:rgba(4,6,11,0.96)',
      'backdrop-filter:blur(3px)', 'box-shadow:0 0 16px rgba(108,242,255,0.4), inset 0 0 20px rgba(108,242,255,0.06)',
      'font-family:ui-monospace,Menlo,monospace', 'color:#bfe4ff',
      'opacity:0', 'transition:opacity .5s ease, transform .5s ease'
    ].join(';');

    box.innerHTML =
      '<div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:10px">' +
        '<b style="color:#eaf6ff;letter-spacing:2px;font-size:.82rem;text-shadow:0 0 8px rgba(108,242,255,.6)">THE MINSKYTRON</b>' +
        '<button type="button" aria-label="Close" style="background:none;border:0;color:#7fa6c4;font-size:1rem;cursor:pointer;line-height:1;padding:0 2px">&times;</button>' +
      '</div>' +
      '<canvas width="284" height="170" style="width:100%;height:auto;display:block;background:#02040a;border:1px solid rgba(108,242,255,0.18);border-radius:2px"></canvas>' +
      '<p style="font-size:.72rem;line-height:1.45;color:#7fa6c4;margin:11px 0 0">' +
        'Marvin Minsky’s <i>Tri-Pos: Three-Position Display</i> (early 1960s), the PDP-1 display hack that inspired <i>Spacewar!</i> ' +
        'Run the <a href="https://www.masswerk.at/minskytron/" target="_blank" rel="noopener noreferrer" style="color:#6cf2ff;text-decoration:none;border-bottom:1px solid rgba(108,242,255,.4)">original &rsaquo;</a> ' +
        'or read the <a href="https://www.masswerk.at/minskytron/minskytron-annotated.txt" target="_blank" rel="noopener noreferrer" style="color:#6cf2ff;text-decoration:none;border-bottom:1px solid rgba(108,242,255,.4)">annotated source &rsaquo;</a>, ' +
        'after Norbert Landsteiner’s reconstruction.' +
      '</p>';

    document.body.appendChild(box);
    requestAnimationFrame(function () {
      box.style.opacity = '1';
      box.style.transform = 'translateX(-50%) translateY(0)';
    });

    var canvas = box.querySelector('canvas');
    var stop = runMinskytron(canvas);

    function close() {
      stop();
      box.style.opacity = '0';
      box.style.transform = 'translateX(-50%) translateY(12px)';
      setTimeout(function () { if (box.parentNode) box.parentNode.removeChild(box); open = false; }, 500);
    }
    box.querySelector('button').addEventListener('click', close);
    setTimeout(function () { if (open) close(); }, 22000);
  }

  /* The actual Minskytron, after the PDP-1 source (dpys5.mac), Norbert
     Landsteiner's annotation, and HAKMEM item 149. Three oscillators run
     Minsky's circle algorithm, daisy-chained, each coordinate modified by
     the difference to the next oscillator and scaled by a right shift:

       ya += (xa + xb) >> sh0 ;  xa -= (ya - yb) >> sh1   (plot xa,ya)
       yb += (xb - xc) >> sh2 ;  xb -= (yb - yc) >> sh3   (plot xb,yb)
       yc += (xc - xa) >> sh4 ;  xc -= (yc - ya) >> sh5   (plot xc,yc)

     Here, kept simple: three pens trace circles of different radii. A morph
     value eases each circle into a spiral (the radius ramps with the angle)
     and back, and the whole thing drifts slowly down the display. */
  function runMinskytron(canvas) {
    var ctx = canvas.getContext('2d');
    var W = canvas.width, H = canvas.height;
    var cx = W / 2, cy = H / 2;
    var scale = Math.min(W, H) / 2 * 0.92;
    var raf = 0, t = 0, T = 0, driftY = 0;

    // three pens: base radius R, angular velocity w, starting phase ph
    var pen = [
      { R: 0.40, w: 0.100, ph: 0 },
      { R: 0.66, w: 0.072, ph: 2.1 },
      { R: 0.92, w: 0.052, ph: 4.2 }
    ];

    function pos(p) {
      var ang = t * p.w + p.ph;
      var m = 0.5 * (1 + Math.sin(T * 0.010));         // 0 = circle, 1 = spiral
      var sweep = (ang / (2 * Math.PI * 2.5)) % 1;      // 0..1 ramp over 2.5 turns
      var rad = p.R * ((1 - m) + m * (0.15 + 0.85 * sweep));
      var X = cx + rad * Math.cos(ang) * scale;
      var Y = cy + rad * Math.sin(ang) * scale + driftY;
      Y = ((Y % H) + H) % H;                            // drift down, wrapping
      return [X, Y];
    }
    function plot(dim) {
      ctx.fillStyle = dim ? 'rgba(96,224,255,0.5)' : 'rgba(175,250,255,0.98)';
      if (!dim) { ctx.shadowColor = 'rgba(120,242,255,0.95)'; ctx.shadowBlur = 5; }
      var sz = dim ? 1.3 : 2.4;
      for (var i = 0; i < 3; i++) { var q = pos(pen[i]); ctx.fillRect(q[0] - sz / 2, q[1] - sz / 2, sz, sz); }
      if (!dim) ctx.shadowBlur = 0;
    }

    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    if (reduce) { for (var i = 0; i < 1600; i++) { t++; plot(true); } plot(false); return function () {}; }

    function frame() {
      ctx.fillStyle = 'rgba(0,0,0,0.05)';               // moderate trail: a clean comet, not a smear
      ctx.fillRect(0, 0, W, H);
      T++;
      driftY = (driftY + 0.16) % H;                     // slow descent
      for (var j = 0; j < 6; j++) { t++; plot(true); }   // trace
      plot(false);                                      // bright heads
      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);
    return function () { cancelAnimationFrame(raf); };
  }
})();
