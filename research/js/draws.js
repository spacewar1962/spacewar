/*
 * draws.js - how the PDP-1 draws the ships, the sun and hyperspace, slowed
 * down. Each is recorded, not imagined: the version runs on the bench's
 * emulator, and every point its display instruction plots is kept with the
 * address that plotted it (and the frame, counted by calls of bck). The
 * points are then replayed one at a time, magnified.
 *   - The ships: the points plotted from the compiled outlines (code the
 *     outline compiler writes at run time), one ship after the other; a jump
 *     back to lower addresses within a ship is the mirror pass.
 *   - The sun: the points plotted from blp up to bck (the central star).
 *   - Hyperspace: a ship is sent into hyperspace through its control bits
 *     (both rotate bits); what is plotted then from code that never plots in
 *     the same run without it is what the version draws for hyperspace.
 */
(function (root) {
  'use strict';
  var SW = root.SW, C = root.PDP1CPU, D = SW.draws = {};

  function placedLabels(b) {
    return Object.keys(b.labelAt).map(Number).filter(function (ad) {
      var sy = b.sym[b.labelAt[ad]], d = sy && sy.defs && sy.defs[0], ws = d && b.asm.byLine[d.file] ? b.asm.byLine[d.file][d.line] : null;
      return !ws || !ws.length || ws.some(function (w) { return w.loc === ad; });
    }).sort(function (x, y) { return x - y; });
  }
  function routineOf(b, labs, pc) { var r = ''; for (var i = 0; i < labs.length && labs[i] <= pc; i++) r = b.labelAt[labs[i]]; return r; }
  function machine(b) {
    var cpu = new C.PDP1({ mdv: b.v.mdv });
    cpu.load(b.asm.memory, b.asm.start);
    cpu.srcMap = new Uint8Array(4096);
    for (var k in b.asm.memory) cpu.srcMap[+k] = 1;
    return cpu;
  }
  // Run and keep every point plotted: position, intensity, the address that
  // plotted it, the instruction there, the frame, and whether it is run-time code.
  function record(b, cpu, cycles, out) {
    var bck = b.sym.bck ? b.sym.bck.val : -1;
    cpu.onDisplay = function (x, y, s, t, pc) {
      out.push({ x: x, y: y, s: s, pc: pc, md: cpu.mem[pc], f: bck >= 0 ? cpu.execCount[bck] : 0, rt: !b.asm.memory[pc], via: cpu.lastSrcPc, w: cpu.lastWriter[pc] });
    };
    cpu.run(cycles);
    cpu.onDisplay = null;
    return out;
  }
  var SETTLE = 400000;   // two emulated seconds, for the outlines to be compiled and the game under way

  // ---------- the player ----------
  // seq: [{x, y, s, col, frame, cap}] in plotting order. Drawn magnified, one
  // point at a time. Loop starts again at the end. Phosphor fade dims each
  // point after it is plotted, at the pace the bench's own scope simulation
  // uses (a time constant of 0.12 s against about 20 redraws a second, i.e.
  // some 2.4 redraws), scaled to the slowed replay: with Loop, the redrawing
  // keeps the image, as the program's redrawing kept it on the screen. Without
  // fade, earlier frames dim when a new frame begins.
  var FADE_REDRAWS = 0.12 * 20;
  function player(host, seq, o) {
    o = o || {};
    var wrap = SW.el('div', { class: 'dr-player' });
    var cv = SW.el('canvas', { class: 'dr-cv', width: 520, height: 520 }), g = cv.getContext('2d'), N = cv.width;
    var ctl = SW.el('div', { class: 'toolbar dr-ctl', style: 'position:static;padding:6px 0 0' });
    ctl.innerHTML = '<button class="btn" data-a="play">▶ Play</button><button class="btn ghost" data-a="step" title="The next point">Step ▸</button><button class="btn ghost" data-a="restart" title="From the start">↺</button>' +
      '<label class="check">Speed <select data-a="speed"><option value="1">1 point a second</option><option value="4">4 a second</option><option value="16" selected>16 a second</option><option value="64">64 a second</option></select></label>' +
      '<label class="check" title="Start again at the end"><input type="checkbox" data-a="loop"> Loop</label>' +
      '<label class="check" title="Each point fades after it is plotted, as on the scope (the bench’s scope simulation: 0.12 s against about 20 redraws a second), scaled to this slowed replay; with Loop the redrawing keeps the image"><input type="checkbox" data-a="fade"> Phosphor fade</label>';
    var cap = SW.el('p', { class: 'dr-cap mono hint' });
    wrap.appendChild(cv); wrap.appendChild(ctl); wrap.appendChild(cap);
    host.appendChild(wrap);
    // one scale for x and y, the points' extent with a margin
    var x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, frames = {};
    seq.forEach(function (p) { x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y); frames[p.frame == null ? 0 : p.frame] = 1; });
    var perFrame = seq.length / Math.max(1, Object.keys(frames).length);
    var span = Math.max(8, x1 - x0, y1 - y0) * 1.18, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, k = N / span;
    function px(p) { return [N / 2 + (p.x - cx) * k, N / 2 - (p.y - cy) * k]; }
    var i = 0, events = [], clock = 0, playing = false, speed = 16, loop = false, fade = false, acc = 0, last = null, dirty = true;
    function tau() { return FADE_REDRAWS * perFrame / speed; }
    function dot(p, alpha, ring) {
      var q = px(p), r = Math.max(2.5, Math.min(7, k * 0.45));
      g.fillStyle = p.col || 'rgb(200,236,255)';
      g.globalAlpha = alpha * Math.max(0.35, Math.min(1, 0.62 + 0.13 * (p.s || 0)));
      g.beginPath(); g.arc(q[0], q[1], r, 0, 6.2832); g.fill(); g.globalAlpha = 1;
      if (ring) { g.strokeStyle = '#ffce7a'; g.lineWidth = 2; g.beginPath(); g.arc(q[0], q[1], r + 5, 0, 6.2832); g.stroke(); }
    }
    function plot() {
      events.push({ j: i, t: clock });
      i++;
      if (i >= seq.length) {
        if (loop) { i = 0; if (!fade) events = []; }
        else { playing = false; SW.$('[data-a="play"]', ctl).textContent = '▶ Play'; }
      }
      dirty = true;
    }
    function render() {
      g.fillStyle = '#02050a'; g.fillRect(0, 0, N, N);
      var lastE = events[events.length - 1], f = lastE ? seq[lastE.j].frame : null, T = tau();
      if (fade) events = events.filter(function (e) { return Math.exp(-(clock - e.t) / T) > 0.01; });
      events.forEach(function (e, n) {
        var p = seq[e.j], a = fade ? Math.exp(-(clock - e.t) / T) : (f != null && p.frame !== f ? 0.18 : 1);
        dot(p, a, e === lastE);
      });
      // actual size: the same points at the scale of the whole screen, as if this
      // drawing area were the scope's 1,024 points across
      var IB = 118, ix = N - IB - 10, iy = 10, sc = N / 1024;
      g.fillStyle = '#000'; g.fillRect(ix, iy, IB, IB);
      g.strokeStyle = 'rgba(143,163,181,0.6)'; g.lineWidth = 1; g.strokeRect(ix + 0.5, iy + 0.5, IB - 1, IB - 1);
      events.forEach(function (e) {
        var p2 = seq[e.j], a2 = fade ? Math.exp(-(clock - e.t) / T) : (f != null && p2.frame !== f ? 0.18 : 1);
        var qx = ix + IB / 2 + (p2.x - cx) * sc, qy = iy + IB / 2 - (p2.y - cy) * sc;
        if (qx < ix || qx > ix + IB || qy < iy || qy > iy + IB) return;
        g.globalAlpha = a2; g.fillStyle = p2.col || 'rgb(200,236,255)'; g.fillRect(qx - 0.6, qy - 0.6, 1.3, 1.3); g.globalAlpha = 1;
      });
      g.fillStyle = 'rgba(143,163,181,0.9)'; g.font = '11px Helvetica, Arial, sans-serif'; g.textAlign = 'center';
      g.fillText('actual size', ix + IB / 2, iy + IB + 14); g.textAlign = 'left';
      var p = lastE ? seq[lastE.j] : null;
      cap.textContent = p ? 'point ' + (lastE.j + 1) + ' of ' + seq.length + (p.frame != null ? ' · frame ' + (p.frame + 1) : '') + ' · ' + p.cap : (o.intro || 'Press Play, or Step, to watch it drawn.');
      dirty = false;
    }
    function tick(t) {
      if (!cv.isConnected) return;
      if (last != null && cv.offsetParent) {
        var dt = Math.min(0.2, (t - last) / 1000);
        if (playing) { clock += dt; acc += dt * speed; while (acc >= 1 && playing) { acc -= 1; plot(); } }
        else if (fade && events.length) clock += dt;   // the glow goes on fading while paused
        if (dirty || (fade && events.length)) render();
      }
      last = t;
      requestAnimationFrame(tick);
    }
    ctl.addEventListener('click', function (e) {
      var b = e.target.closest('button[data-a]'); if (!b) return;
      if (b.dataset.a === 'play') { if (i >= seq.length) { i = 0; events = []; } playing = !playing; b.textContent = playing ? '❚❚ Pause' : '▶ Play'; }
      if (b.dataset.a === 'step') { if (i >= seq.length) { i = 0; events = []; } plot(); render(); }
      if (b.dataset.a === 'restart') { i = 0; events = []; render(); }
    });
    ctl.addEventListener('change', function (e) {
      var a = e.target.dataset.a;
      if (a === 'speed') speed = +e.target.value;
      if (a === 'loop') loop = e.target.checked;
      if (a === 'fade') { fade = e.target.checked; dirty = true; }
    });
    render();
    requestAnimationFrame(tick);
    // time passing, for testing without animation frames: sec of play (or of glow if paused)
    wrap.advance = function (sec, play) { if (play) playing = true; clock += sec; if (playing) { acc += sec * speed; while (acc >= 1 && playing) { acc -= 1; plot(); } } render(); return { i: i, shown: events.length, playing: playing }; };
    wrap.set = function (o2) { if ('loop' in o2) { loop = o2.loop; SW.$('[data-a="loop"]', ctl).checked = loop; } if ('fade' in o2) { fade = o2.fade; SW.$('[data-a="fade"]', ctl).checked = fade; } };
    wrap.step = function (n) { for (var q = 0; q < (n || 1) && i < seq.length; q++) plot(); render(); return i; };
    return wrap;
  }
  function note(t) { return SW.el('p', { class: 'hint' }, t); }

  // ---------- the ships ----------
  D.ships = function (b, host) {
    var c = SW.el('div', { class: 'card', style: 'grid-column:1/-1' });
    c.innerHTML = '<h3>How the PDP-1 draws them</h3>';
    host.appendChild(c);
    var cpu = machine(b), pts = [];
    try { cpu.run(SETTLE); record(b, cpu, 60000, pts); } catch (e) { c.appendChild(note('The emulator stopped: ' + e.message)); return; }
    var byF = {}; pts.forEach(function (p) { if (p.rt) (byF[p.f] = byF[p.f] || []).push(p); });
    var best = null; Object.keys(byF).forEach(function (f) { if (!best || byF[f].length > best.length) best = byF[f]; });
    if (!best) { c.appendChild(note('No points were plotted from compiled outline code in this version’s first seconds.')); return; }
    // one ship after the other: a long jump in position starts the next
    var ships = [[]];
    best.forEach(function (p, j) {
      var q = j ? best[j - 1] : null;
      if (q && Math.abs(p.x - q.x) + Math.abs(p.y - q.y) > 120) ships.push([]);
      ships[ships.length - 1].push(p);
    });
    var labs = placedLabels(b);
    c.insertAdjacentHTML('beforeend', '<p class="lede">Recorded from this version running on the emulator: every point the display instruction plotted for the ships in one frame, in the order plotted, magnified. The outlines are not drawn from the table directly: at the start of the game the outline compiler turns each table into instructions, and each frame those instructions plot the ship at its position and angle.</p>');
    var row = SW.el('div', { class: 'dr-row' });
    c.appendChild(row);
    ships.forEach(function (sp, n) {
      var col = SW.el('div', { class: 'dr-col' });
      col.appendChild(SW.el('h4', {}, (n === 0 ? 'The first ship drawn' : n === 1 ? 'The second ship drawn' : 'Ship ' + (n + 1)) + ': ' + sp.length + ' points'));
      var pass = 1, seq = sp.map(function (p, j) {
        if (j && p.pc < sp[j - 1].pc - 1) pass = 2;
        var who = p.w >= 0 ? routineOf(b, labs, p.w) : '';
        return { x: p.x, y: p.y, s: p.s, col: j === 0 ? '#ffce7a' : pass === 1 ? '#dfeeff' : '#5aa0ff',
                 cap: (pass === 1 ? 'first side' : 'mirror pass') + ' · PC ' + SW.oct(p.pc, 4) + ' ' + C.disasm(p.md, b.symAt) + (who ? ' · compiled by ' + who : '') + ' · (' + p.x + ', ' + p.y + ')' };
      });
      player(col, seq, { intro: 'Pale: the first side; blue: the mirror pass; amber: the first point.' });
      row.appendChild(col);
    });
  };

  // ---------- the sun ----------
  D.sun = function (b, host) {
    var c = SW.el('div', { class: 'card', style: 'grid-column:1/-1' });
    c.innerHTML = '<h3>The sun</h3>';
    host.appendChild(c);
    var blp = b.sym.blp, bck = b.sym.bck;
    if (!blp || !bck) { c.appendChild(note('This version has no star routine by the name blp.')); return; }
    var cpu = machine(b), pts = [];
    try { cpu.run(SETTLE); record(b, cpu, 160000, pts); } catch (e) { c.appendChild(note('The emulator stopped: ' + e.message)); return; }
    var sun = pts.filter(function (p) { return !p.rt && p.pc >= blp.val && p.pc < bck.val; });
    if (!sun.length) { c.appendChild(note('No points were plotted from blp in this run (sense switch 6 turns the star off in some versions).')); return; }
    var frames = []; sun.forEach(function (p) { if (frames.indexOf(p.f) < 0) frames.push(p.f); });
    frames = frames.slice(0, 10);
    var labs = placedLabels(b), src = [];
    b.lines.forEach(function (ls) { ls.forEach(function (L) { src.push(L.raw); }); });
    var has = function (re) { return src.some(function (t) { return re.test(t); }); };
    c.insertAdjacentHTML('beforeend', '<p class="lede">Recorded from this version running: the points plotted by the star routine (from blp) in ' + frames.length + ' successive frames, point by point, magnified; each new frame dims the one before.' +
      (has(/repeat\s+10,\s*starp/) ? ' Each frame the routine picks a random direction and length (random), then plots up to ten points outward along it (repeat 10, starp) and the same run again with the signs complemented (cma), so the ray is mirrored through the centre.' : '') + ' The sun is a new random ray every frame; on the phosphor the rays blur into a flickering star.</p>');
    var seq = [];
    frames.forEach(function (f, n) {
      sun.filter(function (p) { return p.f === f; }).forEach(function (p) {
        seq.push({ x: p.x, y: p.y, s: p.s, frame: n, col: 'rgb(255,236,190)', cap: 'PC ' + SW.oct(p.pc, 4) + ' ' + routineOf(b, labs, p.pc) + ' · ' + C.disasm(p.md, b.symAt) + ' · (' + p.x + ', ' + p.y + ')' });
      });
    });
    c.appendChild(note(sun.length + ' points in ' + frames.length + ' frames, ' + Math.round(seq.length / frames.length) + ' a frame on average.'));
    player(c, seq, { intro: 'Press Play: each frame’s ray, point by point.' });
  };

  // ---------- hyperspace ----------
  D.hyperspace = function (b, host) {
    var c = SW.el('div', { class: 'card', style: 'grid-column:1/-1' });
    c.innerHTML = '<h3>Hyperspace</h3>';
    host.appendChild(c);
    var src = [];
    b.lines.forEach(function (ls) { ls.forEach(function (L) { src.push(L); }); });
    var none = src.filter(function (L) { return /bells and whisles, like hyperspace|bells and whistles, like hyperspace/i.test(L.raw); })[0];
    // the same start run twice, with and without a ship sent into hyperspace
    function run(bits) {
      var base = machine(b), trig = machine(b), bp = {}, pts = [];
      base.run(SETTLE); trig.run(SETTLE);
      base.onDisplay = function (x, y, s, t, pc) { bp[pc] = 1; };
      base.run(1600000); base.onDisplay = null;
      var before = [], after = [];
      record(b, trig, 20000, before);
      trig.tw = bits; trig.control = bits;
      record(b, trig, 30000, pts);
      trig.tw = 0; trig.control = 0;
      record(b, trig, 1600000, pts);
      return { h: pts.filter(function (p) { return !bp[p.pc]; }) };
    }
    var r = null;
    try { r = run(0o600000); if (!r.h.length) r = run(0o000014); } catch (e) { c.appendChild(note('The emulator stopped: ' + e.message)); return; }
    if (!r.h.length) {
      c.appendChild(note(none ? 'This version has no hyperspace. Its source says so where it would go (line ' + none.n + '): “' + none.raw.trim().replace(/^\/\s*/, '') + '”. Hyperspace came later that year as a patch (dated 2 May 1962 as “Hyperspace VIci”, according to a note in the 2015 source) and is in 3.1 and after.' :
        'Sent into hyperspace on the emulator, this version plotted nothing of its own for it: the ship vanishes and later reappears.'));
      return;
    }
    var labs = placedLabels(b), frames = [];
    r.h.forEach(function (p) { if (frames.indexOf(p.f) < 0) frames.push(p.f); });
    var byR = {}; r.h.forEach(function (p) { var k = b.asm.memory[p.pc] ? routineOf(b, labs, p.pc) : 'run-time code'; byR[k] = (byR[k] || 0) + 1; });
    var nl = r.h.some(function (p) { var sq = b.srcOf(p.pc); var L = sq && b.lines[sq.p][sq.n - 1]; return L && /n\.?\s?l\.?\s*2015|minskytron/i.test(L.raw); }) ||
             src.some(function (L) { return /minskytron hyperspace/i.test(L.raw) && /2015|n\.l/i.test(L.raw); });
    c.insertAdjacentHTML('beforeend', '<p class="lede">Recorded from this version running: a ship sent into hyperspace through its control bits (both rotate bits), and the points plotted then from code that plots nothing in the same run without it, frame by frame, magnified. ' +
      Object.keys(byR).map(function (k) { return SW.esc(k) + ' ' + byR[k] + ' point' + (byR[k] === 1 ? '' : 's'); }).join(', ') + ' in ' + frames.length + ' frames.' +
      (nl ? ' This version carries the Minskytron hyperspace signature added by Norbert Landsteiner in 2015 (n.l. 2015), after the 1962 hyperspace patch.' : '') + '</p>');
    var seq = r.h.map(function (p) {
      var sq = b.srcOf(p.pc), L = sq && b.lines[sq.p][sq.n - 1];
      return { x: p.x, y: p.y, s: p.s, frame: frames.indexOf(p.f), col: '#b8f0c8', cap: 'PC ' + SW.oct(p.pc, 4) + ' ' + (b.asm.memory[p.pc] ? routineOf(b, labs, p.pc) : '') + ' · ' + C.disasm(p.md, b.symAt) + (L ? ' · line ' + sq.n + ': ' + L.raw.trim().slice(0, 40) : '') + ' · (' + p.x + ', ' + p.y + ')' };
    });
    player(c, seq, { intro: 'Press Play: what hyperspace draws, frame by frame.' });
  };
})(this);
