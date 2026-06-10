/* Easter egg: type "minsky" anywhere on the page to summon the Minskytron,
   the PDP-1 display hack that came before Spacewar! (and gave it the
   hyperspace effect). A phosphor toast with the Minskytron's signature
   Lissajous curve fades in, linking to masswerk's emulation. */
(function () {
  var TARGET = 'minsky';
  var buf = '';
  var shown = false;

  document.addEventListener('keydown', function (e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    var k = (e.key || '').toLowerCase();
    if (k.length !== 1 || k < 'a' || k > 'z') return;
    buf = (buf + k).slice(-TARGET.length);
    if (buf === TARGET && !shown) reveal();
  });

  function reveal() {
    shown = true;
    var box = document.createElement('a');
    box.href = 'https://www.masswerk.at/minskytron/';
    box.target = '_blank';
    box.rel = 'noopener noreferrer';
    box.setAttribute('aria-label', 'The Minskytron, the PDP-1 display hack that came before Spacewar');
    box.style.cssText = [
      'position:fixed', 'left:50%', 'bottom:28px', 'transform:translateX(-50%) translateY(12px)',
      'z-index:9999', 'display:flex', 'align-items:center', 'gap:14px',
      'padding:14px 20px', 'border:1px solid #6cf2ff', 'border-radius:3px',
      'background:rgba(4,6,11,0.94)', 'backdrop-filter:blur(3px)',
      'box-shadow:0 0 14px rgba(108,242,255,0.4), inset 0 0 18px rgba(108,242,255,0.06)',
      'font-family:ui-monospace,Menlo,monospace', 'color:#bfe4ff', 'text-decoration:none',
      'opacity:0', 'transition:opacity .5s ease, transform .5s ease', 'max-width:90vw'
    ].join(';');

    box.innerHTML =
      '<svg width="44" height="44" viewBox="0 0 44 44" aria-hidden="true" style="flex:none;filter:drop-shadow(0 0 5px rgba(108,242,255,.8))">' +
        '<path id="mtron" fill="none" stroke="#6cf2ff" stroke-width="1.1" d=""/>' +
      '</svg>' +
      '<span style="line-height:1.35">' +
        '<b style="color:#eaf6ff;letter-spacing:1px;text-shadow:0 0 8px rgba(108,242,255,.6)">THE MINSKYTRON</b><br>' +
        '<span style="font-size:.78rem;color:#7fa6c4">the display hack before the game &rsaquo; play it at masswerk</span>' +
      '</span>';

    document.body.appendChild(box);
    requestAnimationFrame(function () {
      box.style.opacity = '1';
      box.style.transform = 'translateX(-50%) translateY(0)';
    });
    drawLissajous(box.querySelector('#mtron'));

    setTimeout(function () {
      box.style.opacity = '0';
      box.style.transform = 'translateX(-50%) translateY(12px)';
      setTimeout(function () { if (box.parentNode) box.parentNode.removeChild(box); shown = false; }, 600);
    }, 9000);
  }

  // A symmetric Lissajous figure, the kind of looping curve the Minskytron drew.
  function drawLissajous(path) {
    if (!path) return;
    var cx = 22, cy = 22, r = 17, d = '';
    for (var i = 0; i <= 220; i++) {
      var t = i / 220 * Math.PI * 2;
      var x = cx + r * Math.sin(3 * t);
      var y = cy + r * Math.sin(2 * t + 0.6);
      d += (i === 0 ? 'M' : 'L') + x.toFixed(1) + ' ' + y.toFixed(1);
    }
    path.setAttribute('d', d);
  }
})();
