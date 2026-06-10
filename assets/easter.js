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

  /* The actual Minskytron, after the PDP-1 source (dpys5.mac), Norbert
     Landsteiner's annotation, and HAKMEM item 149. Three oscillators run
     Minsky's circle algorithm, daisy-chained, each coordinate modified by
     the difference to the next oscillator and scaled by a right shift:

       ya += (xa + xb) >> sh0 ;  xa -= (ya - yb) >> sh1   (plot xa,ya)
       yb += (xb - xc) >> sh2 ;  xb -= (yb - yc) >> sh3   (plot xb,yb)
       yc += (xc - xa) >> sh4 ;  xc -= (yc - ya) >> sh5   (plot xc,yc)

     The six shifts come from a Test Word (three bits each, +1). Different
     Test Words give different figures, so we cycle a few for variety, and
     the dots accumulate on a long-persistence field to draw the curve. */
  function runMinskytron(canvas) {
    var ctx = canvas.getContext('2d');
    var W = canvas.width, H = canvas.height;
    var cx = W / 2, cy = H / 2;
    var scale = (Math.min(W, H) / 2) * 0.9 / 512;   // display uses the top 10 bits
    var MAX = 1 << 17;                              // 18-bit signed range

    function wrap(v) { v = (v + MAX) % (2 * MAX); if (v < 0) v += 2 * MAX; return v - MAX; }
    function sar(v, k) { return Math.floor(v / (1 << k)); }   // arithmetic right shift

    // a few Test Words (shift sextets) that keep the daisy-chain smooth and
    // bounded; per-oscillator variation gives overlapping circles of
    // different size and speed, and each word draws a different figure
    var WORDS = [
      [7, 7, 8, 8, 9, 9], [8, 8, 8, 8, 8, 8], [7, 8, 8, 9, 7, 9],
      [9, 8, 7, 8, 9, 7], [8, 9, 8, 7, 9, 8], [7, 9, 8, 7, 9, 8]
    ];
    var xa, ya, xb, yb, xc, yc, sh, wi = 0, raf = 0, frames = 0;

    function seed() {
      xa = -8192; ya = 0; xb = 0; yb = 16384; xc = 8192; yc = 0;
      sh = WORDS[wi % WORDS.length]; wi++;
    }
    function step() {
      ya = wrap(ya + sar(xa + xb, sh[0]));  xa = wrap(xa - sar(ya - yb, sh[1]));
      yb = wrap(yb + sar(xb - xc, sh[2]));  xb = wrap(xb - sar(yb - yc, sh[3]));
      yc = wrap(yc + sar(xc - xa, sh[4]));  xc = wrap(xc - sar(yc - ya, sh[5]));
    }
    function px(v) { return cx + sar(v, 8) * scale; }
    function py(v) { return cy + sar(v, 8) * scale; }
    function plot(dim) {
      ctx.fillStyle = dim ? 'rgba(96,224,255,0.5)' : 'rgba(170,250,255,0.95)';
      if (!dim) { ctx.shadowColor = 'rgba(120,242,255,0.9)'; ctx.shadowBlur = 4; }
      var s = dim ? 1.2 : 2;
      ctx.fillRect(px(xa) - s / 2, py(ya) - s / 2, s, s);
      ctx.fillRect(px(xb) - s / 2, py(yb) - s / 2, s, s);
      ctx.fillRect(px(xc) - s / 2, py(yc) - s / 2, s, s);
      if (!dim) ctx.shadowBlur = 0;
    }

    seed();
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    if (reduce) { for (var i = 0; i < 1200; i++) { step(); plot(true); } plot(false); return function () {}; }

    function frame() {
      frames++;
      if (frames % 480 === 0) { seed(); }                 // new Test Word ~ every 8s
      ctx.fillStyle = 'rgba(0,0,0,0.025)';                // long persistence builds the figure
      ctx.fillRect(0, 0, W, H);
      for (var i = 0; i < 10; i++) { step(); plot(true); } // cyan trail of dots
      plot(false);                                        // the bright beam heads
      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);
    return function () { cancelAnimationFrame(raf); };
  }
})();
