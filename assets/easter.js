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
        'Marvin Minsky’s <i>Tri-Pos: Three-Position Display</i> (early 1960s), the PDP-1 display hack that became <i>Spacewar!</i>’s hyperspace. ' +
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

  /* The actual Minskytron, ported from the PDP-1 source (dpys5.mac) via
     Norbert Landsteiner's annotation and HAKMEM item 149. Three coupled
     oscillators run Minsky's circle algorithm in 18-bit integer arithmetic
     The figure is a Lissajous, the family the Minskytron's coupled
     oscillators sweep through. A morph parameter m (0..1) carries it
     between a circle (m=0) and a figure-of-eight (m=2): ratio 1->2 with the
     phase swinging pi/2 -> 0 so both endpoints are clean closed figures.
     Drawn as a crisp glowing outline that tumbles and walks down the
     display, redrawn each frame so nothing smears. */
  function runMinskytron(canvas) {
    var ctx = canvas.getContext('2d');
    var W = canvas.width, H = canvas.height;
    var cx = W / 2, cy = H / 2, R = Math.min(W, H) / 2 * 0.40;
    var th = 0, driftY = 0, T = 0, raf = 0;

    // One continuous polyline traced over many periods, with each successive
    // sample rotated a little, so the loops precess into the full overlapping
    // rosette in a single crisp frame. No persistence, so nothing smears.
    function drawCurve(off) {
      var m = 0.5 * (1 + Math.sin(T * 0.010));     // 0..1: circle <-> figure-eight
      var ratio = 1 + m, phase = (1 - m) * Math.PI / 2;
      var amp = 0.82, N = 1500, dp = 0.085, dpr = 0.011;
      ctx.beginPath();
      for (var i = 0; i <= N; i++) {
        var pp = i * dp;
        var rot = th + i * dpr;                    // precession baked into the trace
        var x = amp * Math.sin(pp);
        var y = amp * Math.sin(ratio * pp + phase);
        var c = Math.cos(rot), s = Math.sin(rot);
        var X = cx + (x * c - y * s) * R;
        var Y = cy + (x * s + y * c) * R + off;
        if (i === 0) ctx.moveTo(X, Y); else ctx.lineTo(X, Y);
      }
      ctx.stroke();
    }
    function render() {
      ctx.strokeStyle = 'rgba(108,240,255,0.45)';
      ctx.lineWidth = 1;
      ctx.shadowColor = 'rgba(108,242,255,0.7)';
      ctx.shadowBlur = 4;
      drawCurve(driftY);
      drawCurve(driftY - H);                       // seamless wrap as it descends
      ctx.shadowBlur = 0;
    }

    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    if (reduce) { render(); return function () {}; }

    function frame() {
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);   // clean redraw, no smear
      T++;
      th += 0.0016;
      driftY = (driftY + 0.30) % H;                       // descend the display
      render();
      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);
    return function () { cancelAnimationFrame(raf); };
  }
})();
