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
 *     (both rotate bits); what the hyperspace routines then plot is what the
 *     version draws for hyperspace.
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
    var cpu = new C.PDP1(SW.cpuOpts(b.v));
    cpu.load(b.asm.memory, b.asm.start);
    cpu.srcMap = new Uint8Array(4096);
    for (var k in b.asm.memory) cpu.srcMap[+k] = 1;
    return cpu;
  }
  // Run and keep every point plotted: position, intensity, the address that
  // plotted it, the instruction there, the frame, and whether it is run-time code.
  function record(b, cpu, cycles, out) {
    var bck = b.sym.bck ? b.sym.bck.val : -1;
    // on a version with two displays (4.4) the players follow one: scope 1, the Wedge's console
    var twin = SW.scopeCount(b) === 2;
    cpu.onDisplay = function (x, y, s, t, pc, md) {
      if (twin && SW.scopeOf(b, md) === 2) return;
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
  // point after it is plotted (time constant 2 s of replay, shortened so
  // it can be seen; the real glow lasted about 2.4 of the program's redraws).
  // Without fade, earlier frames dim when a new frame begins.
  // a coordinate as the display took it: 10 bits, ones' complement (−5 is 1772)
  function oc10(v) { return (v >= 0 ? v : (-v) ^ 0o1777).toString(8).padStart(4, '0'); }
  var FADE_SECONDS = 2;
  D.TYPE30 = 'Type 30 Precision CRT Display: a 16-inch cathode ray tube, random point plotting on a raster 9.25 by 9.25 inches; 1,024 by 1,024 addressable locations, origin fixed at the centre, ones’ complement coordinates; 20,000 points a second; 512 points discernible along each axis. One instruction, dpy (address 0007): X from bits 0–9 of the AC, Y from bits 0–9 of the In-Out register. (DEC, PDP-1 Handbook, 1963, pp. 33–34.)';   // shortened so it can be seen: on the scope the glow lasted about 2.4 redraws
  // the player's settings, kept across versions, pages and visits
  D.prefs = function (set) {
    var d = { speed: 16, loop: false, fade: false, grid: false };
    try { if (set) localStorage.setItem('swbench.player', JSON.stringify(set)); Object.assign(d, JSON.parse(localStorage.getItem('swbench.player') || '{}')); } catch (e) {}
    return d;
  };
  function player(host, seq, o) {
    o = o || {};
    var wrap = SW.el('div', { class: 'dr-player' });
    var cv = SW.el('canvas', { class: 'dr-cv', width: 520, height: 520 }), g = cv.getContext('2d'), N = cv.width;
    var ctl = SW.el('div', { class: 'toolbar dr-ctl', style: 'position:static;padding:6px 0 0' });
    ctl.innerHTML = '<button class="btn" data-a="play">▶ Play</button><button class="btn ghost" data-a="step" title="The next point">Step ▸</button><button class="btn ghost" data-a="restart" title="From the start">↺</button>' +
      '<label class="check">Speed <select data-a="speed"><option value="1">1 point a second</option><option value="4">4 a second</option><option value="16" selected>16 a second</option><option value="64">64 a second</option></select></label>' +
      '<label class="check" title="Start again at the end"><input type="checkbox" data-a="loop"> Loop</label>' +
      '<label class="check" title="The display’s addressable positions as faint dots (1,024 by 1,024; the screen holds no bitmap: each point is lit at an address by a display instruction), and each point’s coordinates in octal"><input type="checkbox" data-a="grid"> Grid</label>' +
      '<label class="check" title="Each point fades after it is plotted, as the phosphor did. Shortened so it can be seen here (a time constant of 2 s of replay); on the scope the glow lasted about two and a half redraws, which with Loop kept the image steady"><input type="checkbox" data-a="fade"> Phosphor fade</label>';
    var cap = SW.el('p', { class: 'dr-cap mono hint' });
    wrap.appendChild(cv); wrap.appendChild(ctl); wrap.appendChild(cap);
    if (!o.noT30) wrap.appendChild(SW.el('p', { class: 'dr-t30' }, SW.esc(D.TYPE30)));
    host.appendChild(wrap);
    // one scale for x and y, the points' extent with a margin
    // follow: every frame moved so that its centre (the mean of its points: a
    // ray and its mirror are symmetric about the sun) is at the origin, so the
    // frames line up though the centre moves (4.4 alternates two scopes)
    if (o.follow) {
      var sum = {};
      seq.forEach(function (p) { var q = sum[p.frame] = sum[p.frame] || [0, 0, 0]; q[0] += p.x; q[1] += p.y; q[2]++; });
      seq = seq.map(function (p) { var q = sum[p.frame]; return Object.assign({}, p, { x: p.x - Math.round(q[0] / q[2]), y: p.y - Math.round(q[1] / q[2]) }); });
    }
    var x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, frames = {};
    seq.forEach(function (p) { x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y); frames[p.frame == null ? 0 : p.frame] = 1; });
    var cx = o.follow ? 0 : Math.round((x0 + x1) / 2), cy = o.follow ? 0 : Math.round((y0 + y1) / 2);
    var span = Math.max(o.minSpan || 8, o.follow ? 2 * Math.max(-x0, x1, -y0, y1) : Math.max(x1 - x0, y1 - y0)) * 1.18, k = N / span;
    function px(p) { return [N / 2 + (p.x - cx) * k, N / 2 - (p.y - cy) * k]; }
    var pref = D.prefs(), i = 0, events = [], clock = 0, playing = false, speed = pref.speed, loop = pref.loop, fade = pref.fade, grid = pref.grid, acc = 0, last = null, dirty = true;
    SW.$('[data-a="speed"]', ctl).value = String(speed);
    ['loop', 'fade', 'grid'].forEach(function (a) { SW.$('[data-a="' + a + '"]', ctl).checked = pref[a]; });
    function tau() { return FADE_SECONDS; }
    function dot(p, alpha, ring) {
      var q = px(p), r = Math.max(2.5, Math.min(7, k * 0.45));
      g.fillStyle = p.col || 'rgb(200,236,255)';
      g.globalAlpha = alpha * SW.beam(p.s);
      g.beginPath(); g.arc(q[0], q[1], r, 0, 6.2832); g.fill(); g.globalAlpha = 1;
      if (ring) { g.strokeStyle = '#ffce7a'; g.lineWidth = 2; g.beginPath(); g.arc(q[0], q[1], r + 5, 0, 6.2832); g.stroke(); }
    }
    function plot() {
      if (loop && !fade) { var jj = i; events = events.filter(function (e) { return e.j !== jj; }); }   // redrawn over itself, as the program refreshes
      events.push({ j: i, t: clock });
      i++;
      if (i >= seq.length) {
        if (loop) { i = 0; }
        else { playing = false; SW.$('[data-a="play"]', ctl).textContent = '▶ Play'; }
      }
      dirty = true;
    }
    function render() {
      g.fillStyle = '#02050a'; g.fillRect(0, 0, N, N);
      if (grid) {   // the addressable positions in view (thinned when they would crowd)
        var st = Math.max(1, Math.ceil(5 / k)), gx0 = Math.ceil((cx - N / 2 / k) / st) * st, gy0 = Math.ceil((cy - N / 2 / k) / st) * st;
        g.fillStyle = 'rgba(160,180,200,0.7)';
        for (var gx = gx0; gx <= cx + N / 2 / k; gx += st) for (var gy = gy0; gy <= cy + N / 2 / k; gy += st) { var gq = px({ x: gx, y: gy }); g.fillRect(gq[0] - 1, gq[1] - 1, 2, 2); }
      }
      var lastE = events[events.length - 1], f = lastE ? seq[lastE.j].frame : null, T = tau();
      if (fade) events = events.filter(function (e) { return Math.exp(-(clock - e.t) / T) > 0.01; });
      events.forEach(function (e, n) {
        var p = seq[e.j], a = fade ? Math.exp(-(clock - e.t) / T) : (f != null && p.frame !== f ? 0.18 : 1);
        dot(p, a, e === lastE);
      });
      // actual size: the same points at the scale of the whole screen, as if this
      // drawing area were the scope's 1,024 points across
      var IB = 118, ix = N - IB - 10, iy = 10, sc = N / 1024;
      // centred on what is being drawn now (the current frame's points), so it stays in view
      var cur = events.filter(function (e) { return f == null || seq[e.j].frame === f; }), icx = cx, icy = cy;
      if (cur.length) { icx = cur.reduce(function (a, e) { return a + seq[e.j].x; }, 0) / cur.length; icy = cur.reduce(function (a, e) { return a + seq[e.j].y; }, 0) / cur.length; }
      g.fillStyle = '#000'; g.fillRect(ix, iy, IB, IB);
      g.strokeStyle = 'rgba(143,163,181,0.6)'; g.lineWidth = 1; g.strokeRect(ix + 0.5, iy + 0.5, IB - 1, IB - 1);
      events.forEach(function (e) {
        var p2 = seq[e.j], a2 = fade ? Math.exp(-(clock - e.t) / T) : (f != null && p2.frame !== f ? 0.18 : 1);
        var qx = ix + IB / 2 + (p2.x - icx) * sc, qy = iy + IB / 2 - (p2.y - icy) * sc;
        if (qx < ix || qx > ix + IB || qy < iy || qy > iy + IB) return;
        g.globalAlpha = a2; g.fillStyle = p2.col || 'rgb(200,236,255)'; g.fillRect(qx - 0.6, qy - 0.6, 1.3, 1.3); g.globalAlpha = 1;
      });
      g.fillStyle = 'rgba(143,163,181,0.9)'; g.font = '11px Helvetica, Arial, sans-serif'; g.textAlign = 'center';
      g.fillText('actual size', ix + IB / 2, iy + IB + 14); g.textAlign = 'left';
      var p = lastE ? seq[lastE.j] : null;
      cap.textContent = p ? 'point ' + (lastE.j + 1) + ' of ' + seq.length + (p.frame != null ? ' · frame ' + (p.frame + 1) : '') + ' · ' + p.cap + (grid ? ' · octal ' + oc10(p.x) + ', ' + oc10(p.y) : '') : (o.intro || 'Press Play, or Step, to watch it drawn.');
      dirty = false;
    }
    function tick(t) {
      if (!cv.isConnected) return;
      // the page left (not the version switched, which redraws): pause
      if (!cv.offsetParent && playing) { playing = false; D.playing = false; var pb = SW.$('[data-a="play"]', ctl); if (pb) pb.textContent = '▶ Play'; }
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
      if (b.dataset.a === 'play') { if (i >= seq.length) { i = 0; events = []; } playing = !playing; D.playing = playing; b.textContent = playing ? '❚❚ Pause' : '▶ Play'; }
      if (b.dataset.a === 'step') { if (i >= seq.length) { i = 0; events = []; } plot(); render(); }
      if (b.dataset.a === 'restart') { i = 0; events = []; render(); }
    });
    ctl.addEventListener('change', function (e) {
      var a = e.target.dataset.a;
      if (a === 'speed') speed = +e.target.value;
      if (a === 'loop') loop = e.target.checked;
      if (a === 'fade') { fade = e.target.checked; dirty = true; }
      if (a === 'grid') { grid = e.target.checked; dirty = true; }
      D.prefs({ speed: speed, loop: loop, fade: fade, grid: grid });
    });
    // still playing when the version is switched, so versions can be compared running
    if (D.playing && seq.length) { playing = true; SW.$('[data-a="play"]', ctl).textContent = '❚❚ Pause'; }
    render();
    requestAnimationFrame(tick);
    // time passing, for testing without animation frames: sec of play (or of glow if paused)
    wrap.advance = function (sec, play) { if (play) playing = true; clock += sec; if (playing) { acc += sec * speed; while (acc >= 1 && playing) { acc -= 1; plot(); } } render(); return { i: i, shown: events.length, playing: playing }; };
    wrap.set = function (o2) { if ('loop' in o2) { loop = o2.loop; SW.$('[data-a="loop"]', ctl).checked = loop; } if ('fade' in o2) { fade = o2.fade; SW.$('[data-a="fade"]', ctl).checked = fade; } };
    wrap.isPlaying = function () { return playing; };
    wrap.step = function (n) { for (var q = 0; q < (n || 1) && i < seq.length; q++) plot(); render(); return i; };
    return wrap;
  }
  function note(t) { return SW.el('p', { class: 'hint' }, t); }

  // Each version's result as last recorded (bench 1.14.14), so the version
  // buttons are all there at once; each is checked again on the emulator while
  // nothing is playing, and moves only if its result has changed.
  var KNOWN = {"ships": {"1": "none recorded", "2b-pre": "80 + 76 points · from sp5", "2b": "80 + 76 points · from sp5", "3.1": "80 + 76 points · from sp5", "3.1t": "80 + 76 points · from sp5", "4.0": "80 + 76 points · from sp5", "4.0ts": "80 + 76 points · from sp5", "2015": "80 + 76 points · from mot", "4.1": "80 + 76 points · from mot", "4.1t": "80 + 76 points · from mot", "4.1d": "80 + 76 points · from mot", "4.1f": "80 + 76 points · from mot", "4.2": "80 + 76 points · from mot", "4.3": "80 + 76 points · from mot", "4.3m": "80 + 76 points · from mot", "4.4": "80 + 76 points · from mot", "4.4m": "80 + 76 points · from mot", "4.4f": "80 + 76 points · from mot", "4.8": "80 + 76 points · from mot"}, "sun": {"1": "nothing plotted", "2b-pre": "every dot (bpt: sar 5s)", "2b": "every dot (bpt: sar 5s)", "3.1": "every dot (bpt: sar 5s)", "3.1t": "every dot (bpt: sar 5s)", "4.0": "every dot (bpt: sar 5s)", "4.0ts": "every dot (bpt: sar 5s)", "2015": "every second dot (bpt: sar 6s)", "4.1": "every second dot (bpt: sar 6s)", "4.1t": "every second dot (bpt: sar 6s)", "4.1d": "every second dot (bpt: sar 6s)", "4.1f": "every second dot (bpt: sar 6s)", "4.2": "every second dot (bpt: sar 6s)", "4.3": "every second dot (bpt: sar 6s)", "4.3m": "every second dot (bpt: sar 6s)", "4.4": "every second dot (bpt: sar 6s)", "4.4m": "every second dot (bpt: sar 6s)", "4.4f": "every second dot (bpt: sar 6s)", "4.8": "every second dot (bpt: sar 6s)"}, "hyper": {"1": "no hyperspace", "2b-pre": "no hyperspace", "2b": "no hyperspace", "2015": "Minskytron (2015)", "4.2": "could not be triggered", "4.3": "two still dots, then exploded on breakout", "4.4": "a moving dot", "4.4m": "a moving dot", "4.4f": "a moving dot", "3.1": "a still dot", "3.1t": "a still dot", "4.0": "a still dot", "4.0ts": "a still dot", "4.1": "a still dot", "4.1t": "a still dot", "4.1d": "a still dot", "4.1f": "a still dot", "4.3m": "a still dot", "4.8": "a still dot"}};
  function anyPlaying() { return SW.$$('.dr-player').some(function (p) { return p.isPlaying && p.isPlaying(); }); }
  // Each version's recording, made once and kept for the session.
  function memo(key, b, fn) { var m = (D._res = D._res || {})[key] = (D._res[key] || {}); return m[b.v.id] || (m[b.v.id] = fn(b)); }
  // Beside a card's content: every version, grouped by what it does (its short
  // summary), filled in as each runs on the emulator; a version's button
  // switches the page to it.
  // top: a strip under the heading, above the content, instead of a column beside it
  function across(c, b, key, analyse, top) {
    var side = SW.el('div', { class: top ? 'dr-side dr-top' : 'dr-side' });
    side.innerHTML = '<h4>Across the versions</h4><p class="hint">Click a version to switch to it.</p>';
    var box = SW.el('div', { class: 'dr-groups' });
    side.appendChild(box);
    var vs = root.SWVersions.VERSIONS.filter(function (v) { return v.build && v.id !== 'stars'; }).sort(function (x, y) { return x.sort - y.sort; });
    var shortOf = {}, res = (D._res = D._res || {})[key] || {};
    var checked = {};
    vs.forEach(function (v) { if (res[v.id]) { shortOf[v.id] = res[v.id].short; checked[v.id] = 1; } else if (KNOWN[key] && KNOWN[key][v.id]) shortOf[v.id] = KNOWN[key][v.id]; });
    function name(v) { return v.label.replace(/^Spacewar! /, '').replace(/ \((ddp, )?Morris listing\)/, ' (Morris)').replace(/ \(source tapes?\)/, ' tape').replace(/\(dfw, source tape\)/, 'tape'); }
    function paint() {
      var groups = [], at = {};
      vs.forEach(function (v) { var k = shortOf[v.id]; if (k == null) return; if (!(k in at)) { at[k] = groups.length; groups.push({ k: k, vs: [] }); } groups[at[k]].vs.push(v); });
      var waiting = vs.filter(function (v) { return shortOf[v.id] == null; });
      if (waiting.length) groups.push({ k: 'not run yet' + (anyPlaying() ? ' (while playing)' : ''), vs: waiting, wait: true });
      box.innerHTML = groups.map(function (gp) {
        return '<div class="dr-g' + (gp.wait ? ' dr-wait' : '') + (gp.vs.some(function (v) { return v.id === b.v.id; }) ? ' on' : '') + '"><div class="dr-gk">' + SW.esc(gp.k) + '</div><div class="dr-gv">' +
          gp.vs.map(function (v) { return '<button data-v="' + v.id + '"' + (v.id === b.v.id ? ' class="on"' : '') + ' title="' + SW.esc(v.label) + '">' + SW.esc(name(v)) + '</button>'; }).join('') + '</div></div>';
      }).join('');
    }
    box.addEventListener('click', function (e) { var t = e.target.closest('button[data-v]'); if (t && t.dataset.v !== b.v.id) SW.select(t.dataset.v); });
    paint();
    if (top) c.insertBefore(side, c.children[1] || null);
    else {
      var row = SW.el('div', { class: 'dr-hrow' }), main = SW.el('div', { class: 'dr-hmain' });
      while (c.children.length > 1) main.appendChild(c.children[1]);   // everything after the heading
      row.appendChild(main); row.appendChild(side);
      c.appendChild(row);
    }
    var todo = vs.filter(function (v) { return !checked[v.id]; }), k = 0;
    // one at a time, and only while nothing is playing, so the animation is not held up
    function next() {
      if (!side.isConnected || k >= todo.length) return;
      if (anyPlaying()) { setTimeout(next, 500); return; }
      var v = todo[k++];
      SW.build(v.id).then(function (bv) {
        var was = shortOf[v.id];
        try { shortOf[v.id] = bv.asm && bv.sym.bck ? memo(key, bv, analyse).short : 'no source to run'; } catch (e) { shortOf[v.id] = 'emulator stopped'; }
        if (shortOf[v.id] !== was) paint();
        setTimeout(next, 20);
      }, function () { if (shortOf[v.id] == null) { shortOf[v.id] = 'could not be built'; paint(); } setTimeout(next, 20); });
    }
    setTimeout(next, 50);   // once the card is in the page
  }

  // ---------- the ships ----------
  // One frame's points from compiled outline code, split into the two ships by
  // jumps in position; within a ship a drop back to lower addresses is the
  // mirror pass.
  function shipsOf(b) {
    var cpu = machine(b), pts = [];
    cpu.run(SETTLE); record(b, cpu, 60000, pts);
    var byF = {}; pts.forEach(function (p) { if (p.rt) (byF[p.f] = byF[p.f] || []).push(p); });
    var best = null; Object.keys(byF).forEach(function (f) { if (!best || byF[f].length > best.length) best = byF[f]; });
    if (!best) return { ships: [], short: 'none recorded', say: 'No points were plotted from compiled outline code in the first seconds.' };
    // the display wraps at ±512: distances and positions are taken modulo 1,024
    function wd(a) { return ((a % 1024) + 1536) % 1024 - 512; }
    var ships = [[]];
    best.forEach(function (p, j) { var q = j ? best[j - 1] : null; if (q && Math.abs(wd(p.x - q.x)) + Math.abs(wd(p.y - q.y)) > 120) ships.push([]); ships[ships.length - 1].push(p); });
    // each ship unwrapped round its first point, so one straddling the edge is drawn whole
    ships = ships.map(function (sp) { var o = sp[0]; return sp.map(function (p) { var q = Object.assign({}, p); q.x = o.x + wd(p.x - o.x); q.y = o.y + wd(p.y - o.y); return q; }); });
    var labs = placedLabels(b), via = best[0].via >= 0 ? routineOf(b, labs, best[0].via) : '';
    var parts = ships.map(function (sp) {
      var k = sp.length; for (var j = 1; j < sp.length; j++) if (sp[j].pc < sp[j - 1].pc - 1) { k = j; break; }
      return sp.length + ' points (' + k + ' on the first side, ' + (sp.length - k) + ' in the mirror pass)';
    });
    return { ships: ships, labs: labs, short: ships.map(function (sp) { return sp.length; }).join(' + ') + ' points' + (via ? ' · from ' + via : ''), say: (ships.length === 2 ? 'The two ships: ' : ships.length + ' ship' + (ships.length === 1 ? '' : 's') + ': ') + parts.join('; ') + ' in a frame' + (via ? ', the compiled outlines entered from ' + via : '') + '.' };
  }
  D.ships = function (b, host) {
    var c = SW.el('div', { class: 'card', style: 'grid-column:1/-1' });
    c.innerHTML = '<h3>How the PDP-1 draws them</h3>';
    host.appendChild(c);
    var S;
    try { S = memo('ships', b, shipsOf); } catch (e) { c.appendChild(note('The emulator stopped: ' + e.message)); return; }
    if (!S.ships.length) c.appendChild(note(S.say));
    if (S.ships.length) {
      c.insertAdjacentHTML('beforeend', '<p class="lede">Recorded from this version running on the emulator: every point the display instruction plotted for the ships in one frame, in the order plotted, magnified. The outlines are not drawn from the table directly: at the start of the game the outline compiler turns each table into instructions, and each frame those instructions plot the ship at its position and angle.</p>');
      var row = SW.el('div', { class: 'dr-row' });
      c.appendChild(row);
      S.ships.forEach(function (sp, n) {
        var col = SW.el('div', { class: 'dr-col' });
        col.appendChild(SW.el('h4', {}, (n === 0 ? 'The first ship drawn' : n === 1 ? 'The second ship drawn' : 'Ship ' + (n + 1)) + ': ' + sp.length + ' points'));
        var pass = 1, seq = sp.map(function (p, j) {
          if (j && p.pc < sp[j - 1].pc - 1) pass = 2;
          var who = p.w >= 0 ? routineOf(b, S.labs, p.w) : '';
          return { x: p.x, y: p.y, s: p.s, col: j === 0 ? '#ffce7a' : pass === 1 ? '#dfeeff' : '#5aa0ff',
                   cap: (pass === 1 ? 'first side' : 'mirror pass') + ' · PC ' + SW.oct(p.pc, 4) + ' ' + C.disasm(p.md, b.symAt) + (who ? ' · compiled by ' + who : '') + ' · (' + p.x + ', ' + p.y + ')' };
        });
        player(col, seq, { intro: 'Pale: the first side; blue: the mirror pass; amber: the first point.', noT30: n < S.ships.length - 1 });
        row.appendChild(col);
      });
    }
    across(c, b, 'ships', shipsOf, true);
  };

  // ---------- the sun ----------
  // The points plotted from blp up to bck (the central star), ten frames.
  function sunOf(b) {
    var blp = b.sym.blp, bck = b.sym.bck;
    if (!blp || !bck) return { short: 'no star routine (blp)', say: 'No star routine by the name blp.', frames: [], pts: [] };
    var cpu = machine(b), pts = [];
    cpu.run(SETTLE); record(b, cpu, 160000, pts);
    var sun = pts.filter(function (p) { return !p.rt && p.pc >= blp.val && p.pc < bck.val; });
    var frames = []; sun.forEach(function (p) { if (frames.indexOf(p.f) < 0) frames.push(p.f); });
    frames = frames.slice(0, 10);
    sun = sun.filter(function (p) { return frames.indexOf(p.f) >= 0; });
    if (!sun.length) return { short: 'nothing plotted', say: 'Nothing was plotted from blp in this run.', frames: [], pts: [] };
    var per = frames.map(function (f) { return sun.filter(function (p) { return p.f === f; }).length; });
    var src = []; b.lines.forEach(function (ls) { ls.forEach(function (L) { src.push(L.raw); }); });
    var ray = src.some(function (t) { return /repeat\s+10,\s*starp/.test(t); });
    // the rays' dots: from 4.1 bpt has half the steps (repeat 10 for repeat 20,
    // sar 6s for sar 5s) and blp's step mask is doubled ((400700 for (add 340),
    // so the rays keep their length with every second dot
    var sh = null, bd = b.sym.bpt && b.sym.bpt.defs && b.sym.bpt.defs[0];
    if (bd) { var bl = b.lines[bd.file] || [], seen9 = false; for (var q = bd.line - 1; q < Math.min(bl.length, bd.line + 8); q++) { var m = /\bsar\s+(\d)s/.exec(bl[q].raw); if (m) { if (seen9) { sh = +m[1]; break; } if (m[1] === '9') seen9 = true; } } }
    return { frames: frames, pts: sun, ray: ray, short: sh ? (sh <= 5 ? 'every dot' : 'every second dot') + ' (bpt: sar ' + sh + 's)' : Math.round(sun.length / frames.length) + ' points a frame',
             say: Math.round(sun.length / frames.length) + ' points a frame on average (' + Math.min.apply(null, per) + ' to ' + Math.max.apply(null, per) + ') over ' + frames.length + ' frames, from blp' + (ray ? '; a random ray of up to eight points (repeat 10, starp: 10 is octal) and its mirror' : '') + '.' };
  }
  D.sun = function (b, host) {
    var c = SW.el('div', { class: 'card', style: 'grid-column:1/-1' });
    c.innerHTML = '<h3>The sun</h3>';
    host.appendChild(c);
    var U;
    try { U = memo('sun', b, sunOf); } catch (e) { c.appendChild(note('The emulator stopped: ' + e.message)); return; }
    if (!U.pts.length) c.appendChild(note(U.say));
    if (U.pts.length) {
      var labs = placedLabels(b);
      c.insertAdjacentHTML('beforeend', '<p class="lede">Recorded from this version running: the points plotted by the star routine (from blp) in ' + U.frames.length + ' successive frames, point by point, magnified; each new frame dims the one before.' +
        (U.ray ? ' Each frame the routine picks a random direction and length (random), then plots up to eight points outward along it (repeat 10, starp: the count is octal) and the same run again with the signs complemented (cma), so the ray is mirrored through the centre.' : '') + ' The sun is a new random ray every frame; on the phosphor the rays blur into a flickering star.</p>');
      var seq = [];
      U.frames.forEach(function (f, n) {
        U.pts.filter(function (p) { return p.f === f; }).forEach(function (p) {
          seq.push({ x: p.x, y: p.y, s: p.s, frame: n, col: 'rgb(255,236,190)', cap: 'PC ' + SW.oct(p.pc, 4) + ' ' + routineOf(b, labs, p.pc) + ' · ' + C.disasm(p.md, b.symAt) + ' · (' + p.x + ', ' + p.y + ')' });
        });
      });
      player(c, seq, { intro: 'Press Play: each frame’s ray, point by point.', follow: true, minSpan: 24 });
    }
    across(c, b, 'sun', sunOf, true);
  };

  // ---------- hyperspace ----------
  // Send a ship in (both rotate bits, through the test word and the control
  // boxes; the other ship's bits if that does nothing) and keep what the
  // hyperspace routines plot that they never plot in the same run without it. A ship that
  // stays on screen means the version did not take the input.
  function hyperOf(b) {
    var src = [];
    b.lines.forEach(function (ls) { ls.forEach(function (L) { src.push(L); }); });
    var noneLine = src.filter(function (L) { return /bells and whisles, like hyperspace|bells and whistles, like hyperspace/i.test(L.raw); })[0];
    var r0 = null;
    function run(bits) {
      var base = machine(b), trig = machine(b), bp = {}, pts = [], before = [], after = [];
      base.run(SETTLE); trig.run(SETTLE);
      base.onDisplay = function (x, y, s, t, pc) { bp[pc] = 1; };
      base.run(1600000); base.onDisplay = null;
      record(b, trig, 20000, before);
      trig.tw = bits; trig.control = bits;
      record(b, trig, 30000, pts);
      trig.tw = 0; trig.control = 0;
      record(b, trig, 400000, after);
      pts = pts.concat(after);
      record(b, trig, 1200000, pts);
      r0 = { before: before, all: pts };
      var shipsBefore = before.filter(function (p) { return p.rt; }).length / Math.max(1, new Set(before.map(function (p) { return p.f; })).size);
      var shipsAfter = after.filter(function (p) { return p.rt; }).length / Math.max(1, new Set(after.map(function (p) { return p.f; })).size);
      // only the hyperspace routines (hp1-hp7; h1-h3 for the 2015 Minskytron):
      // a triggered run can also draw an explosion, torpedoes or the exhaust
      var labs0 = placedLabels(b);
      // breaking out can fail (the hyperspatial uncertainty, hur): po1, "now go
      // bang", replaces the ship with the explosion (mex, before tcr)
      var S = b.sym, bang = S.po1 && S.mex && S.tcr && S.mex.val < S.tcr.val && trig.execCount[S.po1.val] > 0
        ? pts.filter(function (p) { return !bp[p.pc] && p.pc >= S.mex.val && p.pc < S.tcr.val; }) : [];
      return { bang: bang, h: pts.filter(function (p) { return !bp[p.pc] && b.asm.memory[p.pc] && /^hp?\d$/.test(routineOf(b, labs0, p.pc)); }), vanished: shipsAfter < shipsBefore * 0.8 };
    }
    var r = run(0o600000);
    if (!r.h.length && !r.vanished) r = run(0o000014);
    var labs = placedLabels(b), frames = [], pos = {}, byR = {};
    r.h.forEach(function (p) { if (frames.indexOf(p.f) < 0) frames.push(p.f); pos[p.x + ',' + p.y] = 1; var k = b.asm.memory[p.pc] ? routineOf(b, labs, p.pc) : 'run-time code'; byR[k] = (byR[k] || 0) + 1; });
    var nl = r.h.some(function (p) { var sq = b.srcOf(p.pc); var L = sq && b.lines[sq.p][sq.n - 1]; return L && /n\.?\s?l\.?\s*2015|minskytron/i.test(L.raw); }) ||
             src.some(function (L) { return /minskytron hyperspace/i.test(L.raw) && /2015|n\.l/i.test(L.raw); });
    var np = Object.keys(pos).length, nf = frames.length, kind, say;
    if (!r.h.length && noneLine) { kind = 'none'; say = 'No hyperspace: the source says so where it would go (line ' + noneLine.n + '): “' + noneLine.raw.trim().replace(/^\/\s*/, '') + '”.'; }
    else if (!r.h.length && !r.vanished) { kind = 'untriggered'; say = 'The bench could not send a ship into hyperspace here: the ship stayed on screen, so the version did not take the emulator’s control input (4.2, for one, decodes its control boxes through its own routine, 8a).'; }
    else if (!r.h.length) { kind = 'nothing'; say = 'The ship vanished, but nothing was plotted from code of hyperspace’s own: it is invisible until it breaks out.'; }
    else if (nl) { kind = 'minskytron'; say = 'The Minskytron signature, added by Norbert Landsteiner in 2015 (n.l. 2015) after the 1962 hyperspace patch: ' + r.h.length + ' points at ' + np + ' positions over ' + nf + ' frames.'; }
    else if (np === 2 && r.h.length <= nf * 2.2) { kind = 'dots'; say = 'Two dots, still, at two places: up to two points a frame for ' + nf + ' frames.'; }
    else if (np === 1) { kind = 'dot'; say = 'A single dot, still, at one place: one point a frame for ' + nf + ' frames, while the ship is away.'; }
    else if (r.h.length <= nf * 1.2) { kind = 'moving'; say = 'A single dot that moves: one point a frame at ' + np + ' positions over ' + nf + ' frames, while the ship is away.'; }
    else if (nf <= 8) { kind = 'burst'; say = 'A brief burst: ' + r.h.length + ' points at ' + np + ' positions over ' + nf + ' frames.'; }
    else { kind = 'pattern'; say = 'A pattern: ' + r.h.length + ' points at ' + np + ' positions over ' + nf + ' frames.'; }
    if (r.bang && r.bang.length) say += ' In this run the ship then exploded on breaking out (po1, “now go bang”, after the hyperspatial uncertainty check): ' + r.bang.length + ' points from the explosion routine (mex).';
    var short = { none: 'no hyperspace', untriggered: 'could not be triggered', nothing: 'nothing drawn', minskytron: 'Minskytron (2015)', dot: 'a still dot', dots: 'two still dots', moving: 'a moving dot', burst: 'a burst, ' + nf + ' frames', pattern: 'a pattern, ' + r.h.length + ' points' }[kind];
    if (r.bang && r.bang.length) short += ', then exploded on breakout';
    return { h: r.h, bang: r.bang || [], frames: frames, np: np, byR: byR, kind: kind, say: say, short: short, labs: labs, before: r0 && r0.before, all: r0 && r0.all, vanished: r.vanished };
  }
  D.hyperOf = hyperOf;

  D.hyperspace = function (b, host) {
    var c = SW.el('div', { class: 'card', style: 'grid-column:1/-1' });
    c.innerHTML = '<h3>Hyperspace</h3>';
    host.appendChild(c);
    var H;
    try { H = memo('hyper', b, hyperOf); } catch (e) { c.appendChild(note('The emulator stopped: ' + e.message)); return; }
    if (!H.h.length) c.appendChild(note(H.say));
    if (H.h.length) {
      c.insertAdjacentHTML('beforeend', '<p class="lede">Recorded from this version running: a ship sent into hyperspace through its control bits (both rotate bits), and the points plotted then by the hyperspace routines (hp1 to hp7; h1 to h3 in the 2015 Minskytron), frame by frame, magnified: ' +
        Object.keys(H.byR).map(function (k) { return SW.esc(k) + ' ' + H.byR[k] + ' point' + (H.byR[k] === 1 ? '' : 's'); }).join(', ') + '.</p>');
      var seq = [];
      function cap(p) { var sq = b.srcOf(p.pc), L = sq && b.lines[sq.p][sq.n - 1]; return 'PC ' + SW.oct(p.pc, 4) + ' ' + (b.asm.memory[p.pc] ? routineOf(b, H.labs, p.pc) : '(compiled outline)') + ' · ' + C.disasm(p.md, b.symAt) + (L ? ' · line ' + sq.n + ': ' + L.raw.trim().slice(0, 36) : '') + ' · (' + p.x + ', ' + p.y + ')'; }
      // a point plotted again in the next frame or the one after (a still dot, or
      // two alternating) is shown once, with the number of frames it was held
      var fn = -1, lastF = null, raw = [];   // raw: the last two points recorded, each with the item that shows it
      H.h.forEach(function (p) {
        var back = raw.filter(function (r) { return r.x === p.x && r.y === p.y; })[0], it;
        if (back) { it = back.it; it.held++; it.cap = it.cap0 + ' · plotted in ' + it.held + ' frames'; }
        else {
          if (p.f !== lastF) { fn++; lastF = p.f; }
          it = { x: p.x, y: p.y, s: p.s, frame: fn, col: '#b8f0c8', cap0: cap(p), cap: cap(p), held: 1 };
          seq.push(it);
        }
        raw = raw.concat([{ x: p.x, y: p.y, it: it }]).slice(-2);
      });
      var showBang = false; try { showBang = localStorage.getItem('swbench.hyperBang') === '1'; } catch (e) {}
      if (H.bang.length) {
        var opt = SW.el('label', { class: 'check dr-opt' }, '<input type="checkbox"' + (showBang ? ' checked' : '') + '> Show the breakout explosion (po1, “now go bang”)');
        opt.querySelector('input').onchange = function (e) {
          try { localStorage.setItem('swbench.hyperBang', e.target.checked ? '1' : '0'); } catch (x) {}
          var nc = SW.el('div'); c.replaceWith(nc); D.hyperspace(b, nc); nc.replaceWith.apply(nc, [].slice.call(nc.childNodes));
        };
        c.appendChild(opt);
      }
      if (H.bang.length && showBang) {
        var bf = null;
        H.bang.forEach(function (p) { if (p.f !== bf) { fn++; bf = p.f; } seq.push({ x: p.x, y: p.y, s: p.s, frame: fn, col: '#ffb070', cap: 'the breakout explosion (po1, “now go bang”) · ' + cap(p) }); });
        c.insertAdjacentHTML('beforeend', '<p class="hint">In this run the breakout failed the hyperspatial uncertainty check (hur) and po1 (“now go bang”) ran: amber, the explosion, ' + H.bang.length + ' points. This is chance: the check uses the random number, and each jump makes a failure more likely.</p>');
      }
      c.insertAdjacentHTML('beforeend', '<p class="hint">A point plotted again in the next frames is shown once, with the number of frames it was plotted in: ' + H.h.length + ' points recorded, ' + seq.length + ' shown.</p>');
      player(c, seq, { intro: 'Press Play: what hyperspace draws, frame by frame.', minSpan: 48 });
    }
    across(c, b, 'hyper', hyperOf, true);
  };
})(this);