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
        'Marvin Minsky’s PDP-1 display hack (1962), the precessing curve that became <i>Spacewar!</i>’s hyperspace. ' +
        'Run the original at <a href="https://www.masswerk.at/minskytron/" target="_blank" rel="noopener noreferrer" style="color:#6cf2ff;text-decoration:none;border-bottom:1px solid rgba(108,242,255,.4)">masswerk &rsaquo;</a>' +
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

  /* The display itself: a Lissajous figure whose phase and frequency ratio
     drift slowly, redrawn over a fading field so the phosphor trails the way
     a real long-persistence CRT would. Returns a stop() function. */
  function runMinskytron(canvas) {
    var ctx = canvas.getContext('2d');
    var W = canvas.width, H = canvas.height;
    var cx = W / 2, cy = H / 2, r = Math.min(W, H) * 0.40;
    var phase = 0, ratio = 2.0, t = 0, raf = 0;

    function drawFigure() {
      ctx.strokeStyle = 'rgba(108,242,255,0.9)';
      ctx.lineWidth = 1;
      ctx.shadowColor = 'rgba(108,242,255,0.9)';
      ctx.shadowBlur = 6;
      ctx.beginPath();
      for (var i = 0; i <= 260; i++) {
        var a = i / 260 * Math.PI * 2;
        var x = cx + r * Math.sin(3 * a + phase);
        var y = cy + r * Math.sin(ratio * a);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    if (reduce) { ctx.fillStyle = '#02040a'; ctx.fillRect(0, 0, W, H); drawFigure(); return function () {}; }

    function frame() {
      ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(2,4,10,0.14)';   // fade for phosphor persistence
      ctx.fillRect(0, 0, W, H);
      drawFigure();
      phase += 0.018;
      ratio += 0.0009;                        // the figure slowly precesses and morphs
      if (ratio > 5) ratio = 2.0;
      t++;
      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);
    return function () { cancelAnimationFrame(raf); };
  }
})();
