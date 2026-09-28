/*
 * random.js - the program's random numbers. Spacewar! has no source of
 * chance: its "random number" is five instructions of arithmetic on one
 * 18-bit word, ran (rotate it right, exclusive-or a constant, add the
 * constant). The bench finds those instructions in each version's assembled
 * program and runs them on the emulator: the sequence from the value the
 * program starts with, how long it runs before it repeats, what becomes of
 * every one of the 262,144 possible words, the pairs of successive numbers,
 * and where the program asks for one.
 */
(function (root) {
  'use strict';
  var SW = root.SW, V = root.SWVersions;
  var R = SW.random = {};
  var N18 = 1 << 18, CACHE = {};
  function vname(v) { return v.label.replace(/^Spacewar! /, ''); }
  function oct(n, w) { var s = (n >>> 0).toString(8); while (s.length < (w || 6)) s = '0' + s; return s; }

  // The generator of a version: its five instructions found in the program and
  // run on the emulator. Resolves with {f: Int32Array (next word for every word),
  // seed, onTape, k (the constant), site, calls: [{p, n, routine}], ...} or {why}.
  R.study = function (vid) {
    if (CACHE[vid]) return CACHE[vid];
    return (CACHE[vid] = SW.build(vid).then(function (b) {
      var S = b.sym, ran = S.ran || S['\\ran'] || S['~ran'];
      if (!b.asm || !ran) return { why: 'no random-number word (ran)' };
      var cpu = new root.PDP1CPU.PDP1({ mdv: b.v.mdv }); cpu.load(b.asm.memory, b.asm.start);
      var mem = cpu.mem, a = ran.val, site = -1;
      // lac ran, rar 1s, xor (k, add (k, dac ran
      for (var i = 0; i < 0o7770; i++) {
        if (mem[i] === (0o200000 | a) && mem[i + 1] === 0o671001 && (mem[i + 2] >> 12) === 0o06 && (mem[i + 3] >> 12) === 0o40 && mem[i + 4] === (0o240000 | a)) { site = i; break; }
      }
      if (site < 0) return { why: 'the five instructions of the random macro were not found' };
      var k = mem[mem[site + 2] & 0o7777], k2 = mem[mem[site + 3] & 0o7777];
      var onTape = !!b.asm.memory[a], seed = mem[a];
      var f = new Int32Array(N18);
      for (var x = 0; x < N18; x++) {
        mem[a] = x; cpu.pc = site; cpu.halted = false;
        for (var s = 0; s < 5; s++) cpu.step();
        f[x] = mem[a];
      }
      // where the program asks for one: the lines that call the macro, by routine
      var calls = [];
      b.lines.forEach(function (ls, p) {
        if (b.parts[p].role !== 'program') return;
        var routine = '', inDefine = false, seen = {};
        ls.forEach(function (L) {
          if (L.away) return;
          var raw = L.raw.replace(/\/.*$/, ''), m = /^([a-z0-9]+),\s*(.*)$/i.exec(raw), body = (m ? m[2] : raw).trim();
          if (m) routine = m[1];
          // a macro's definition, from define to term, is not a call
          if (/^define\b/i.test(body)) { inDefine = true; return; }
          if (inDefine) { if (/^term/i.test(body)) inDefine = false; return; }
          if (/^(random|ranct)\b/i.test(body) && !seen[L.n]) { seen[L.n] = 1; calls.push({ p: p, n: L.n, routine: routine, raw: L.raw.trim() }); }
        });
      });
      return { f: f, seed: seed, onTape: onTape, k: k, k2: k2, site: site, calls: calls, v: b.v };
    }));
  };

  // the sequence from a word: how many steps before it repeats a word, and the
  // length of the cycle it falls into
  R.orbit = function (f, x0) {
    var seen = new Int32Array(N18).fill(-1), x = x0, i = 0;
    while (seen[x] < 0) { seen[x] = i++; x = f[x]; }
    return { tail: seen[x], cycle: i - seen[x], first: x };
  };
  // what becomes of every word: the cycles the whole space falls into
  R.cycles = function (f) {
    var state = new Uint8Array(N18), cyc = [], onCycle = 0;   // 0 unseen, 1 on the path now, 2 done
    for (var s = 0; s < N18; s++) {
      if (state[s]) continue;
      var path = [], x = s;
      while (!state[x]) { state[x] = 1; path.push(x); x = f[x]; }
      if (state[x] === 1) { var j = path.indexOf(x), len = path.length - j; cyc.push(len); onCycle += len; }
      path.forEach(function (y) { state[y] = 2; });
    }
    cyc.sort(function (a, c) { return c - a; });
    return { count: cyc.length, lengths: cyc, onCycle: onCycle };
  };

  R.draw = function (b, host) {
    var P0 = SW.store.get('random', {}) || {};
    var st = { a: P0.a || '2b', b: P0.b || '3.1' };
    function keep() { SW.store.set('random', st); }
    var all = V.VERSIONS.filter(function (v) { return v.build && v.id !== 'stars'; }).sort(function (a, c) { return a.sort - c.sort; });
    var opts = all.map(function (v) { return '<option value="' + v.id + '">' + SW.esc(vname(v)) + '</option>'; }).join('');
    var card = SW.el('div', { class: 'card grav rnd', style: 'grid-column:1/-1' });
    card.innerHTML = '<h4>Random numbers</h4>' +
      '<p class="hint">Spacewar! has no source of chance. The PDP-1 offers the program nothing random to read, and the program reads nothing that varies: its “random number” is five instructions of arithmetic on one 18-bit word, <span class="mono">ran</span>: rotate it right one place, exclusive-or a constant, add the same constant. From the same starting word it gives the same sequence every time. From 3.1 on that word, 0, is punched on the tape with the program, so the sequence begins afresh each time the program is loaded, and later games carry on from wherever the last left off; what differs from game to game is how many numbers the play uses up, since the sun, explosions, hyperspace and the rocket’s flame each take them as they happen. The Morris listing of 4.0 carries a patch that records the starting word and every control word on paper tape, so that a game can be played again exactly (F25). The bench runs the instructions themselves on the emulator.</p>' +
      '<div class="well-view plates-ctl"><label>Left <select data-r="a">' + opts + '</select></label><label>Right <select data-r="b">' + opts + '</select></label></div>' +
      '<div class="rnd-pair"><div class="rnd-col" data-c="a"></div><div class="rnd-col" data-c="b"></div></div>';
    host.appendChild(card);
    SW.$('[data-r=a]', card).value = st.a; SW.$('[data-r=b]', card).value = st.b;
    var stopped = false;

    function column(el, vid) {
      el.innerHTML = '<h5>' + SW.esc(vname(V.byId(vid))) + ' ' + SW.refTag(vid) + '</h5><p class="hint">Running the generator on every one of the 262,144 words…</p>';
      setTimeout(function () {
        R.study(vid).then(function (d) {
          if (stopped) return;
          if (d.why) { el.innerHTML = '<h5>' + SW.esc(vname(V.byId(vid))) + '</h5><p class="hint">' + SW.esc(d.why) + '.</p>'; return; }
          var o = R.orbit(d.f, d.seed), cy = R.cycles(d.f), seq = [], x = d.seed;
          for (var i = 0; i < 16; i++) { x = d.f[x]; seq.push(oct(x)); }
          var WHAT = { blp: 'the sun', bpt: 'the sun', mz1: 'explosions', mex: 'explosions', hp1: 'hyperspace', hp3: 'hyperspace', hp7: 'hyperspace', sq6: 'the rocket flame' };
          var routines = {}; d.calls.forEach(function (c) { var w = WHAT[c.routine] || 'elsewhere'; (routines[w] = routines[w] || []).push(c.routine); });
          el.innerHTML = '<h5>' + SW.esc(vname(V.byId(vid))) + ' ' + SW.refTag(vid) + '</h5>' +
            '<table class="ov-sub rnd-t"><tbody>' +
            '<tr><td>The instructions</td><td class="mono">lac ran · rar 1s · xor (' + oct(d.k) + ' · add (' + oct(d.k2) + ' · dac ran</td></tr>' +
            '<tr><td>Starting word</td><td class="mono">' + oct(d.seed) + (d.onTape ? ' (punched on the tape with the program)' : ' (not punched on the tape, which the bench rebuilds exactly: the program started from whatever the core held; the emulator’s core holds 0)') + '</td></tr>' +
            '<tr><td>From it</td><td>' + o.tail.toLocaleString('en-GB') + ' numbers before the sequence joins a cycle of ' + o.cycle.toLocaleString('en-GB') + ', which then repeats for ever</td></tr>' +
            '<tr><td>All 262,144 words</td><td>fall into ' + cy.count.toLocaleString('en-GB') + ' cycle' + (cy.count === 1 ? '' : 's') + ' (the longest ' + cy.lengths[0].toLocaleString('en-GB') + (cy.count > 1 ? '; then ' + cy.lengths.slice(1, 5).map(function (n) { return n.toLocaleString('en-GB'); }).join(', ') + (cy.count > 5 ? ' …' : '') : '') + '); ' + cy.onCycle.toLocaleString('en-GB') + ' words lie on a cycle, the rest lead into one</td></tr>' +
            '<tr><td>The first numbers</td><td class="mono rnd-seq">' + seq.join(' ') + ' …</td></tr>' +
            '<tr><td>Asked for by</td><td>' + (Object.keys(routines).map(function (w) { var u = routines[w].filter(function (r, i, a) { return a.indexOf(r) === i; }); return w + ' (<span class="mono">' + SW.esc(u.join(', ')) + '</span>' + (routines[w].length > 1 ? ', ' + routines[w].length + ' places' : '') + ')'; }).join('; ') || 'no calls found') + '</td></tr>' +
            '</tbody></table>' +
            '<div class="rnd-figs"><figure><canvas class="rnd-pairs"></canvas><figcaption class="hint">Each number against the next, over the cycle the program runs in (each word as a point: across, this number; up, the next).</figcaption></figure>' +
            '<figure><canvas class="rnd-bits"></canvas><figcaption class="hint">The first 192 numbers from the start, one to a row, the 18 bits across (a hole for a 1, as on paper tape).</figcaption></figure></div>';
          pairs(SW.$('.rnd-pairs', el), d, o);
          bits(SW.$('.rnd-bits', el), d);
        });
      }, 30);
    }
    function pairs(cv, d, o) {
      var N = 300, dpr = root.devicePixelRatio || 1; cv.width = N * dpr; cv.height = N * dpr; cv.style.width = N + 'px'; cv.style.height = N + 'px';
      var g = cv.getContext('2d'); g.scale(dpr, dpr); g.fillStyle = '#000'; g.fillRect(0, 0, N, N);
      var img = g.getImageData(0, 0, N * dpr, N * dpr), px = img.data, W = N * dpr, x = o.first, max = Math.min(o.cycle, 262144);
      for (var i = 0; i < max; i++) {
        var y = d.f[x], X = Math.floor(x / N18 * W), Y = W - 1 - Math.floor(y / N18 * W), q = (Y * W + X) * 4;
        px[q] = Math.min(255, px[q] + 90); px[q + 1] = Math.min(255, px[q + 1] + 200); px[q + 2] = Math.min(255, px[q + 2] + 230); px[q + 3] = 255;
        x = y;
      }
      g.putImageData(img, 0, 0);
    }
    function bits(cv, d) {
      var rows = 192, cell = 5, W = 18 * cell + 17, H = rows * 3, dpr = root.devicePixelRatio || 1;
      cv.width = W * dpr; cv.height = H * dpr; cv.style.width = W + 'px'; cv.style.height = H + 'px';
      var g = cv.getContext('2d'); g.scale(dpr, dpr); g.fillStyle = '#dcd9d1'; g.fillRect(0, 0, W, H); g.fillStyle = '#262626';
      var x = d.seed;
      for (var r = 0; r < rows; r++) {
        x = d.f[x];
        for (var bit = 0; bit < 18; bit++) if ((x >> (17 - bit)) & 1) g.fillRect(bit * (cell + 1), r * 3, cell, 2);
      }
    }
    function both() { column(SW.$('[data-c=a]', card), st.a); column(SW.$('[data-c=b]', card), st.b); }
    card.addEventListener('change', function (e) { var k = e.target.dataset.r; if (!k) return; st[k] = e.target.value; keep(); column(SW.$('[data-c=' + k + ']', card), st[k]); });
    both();
    return function () { stopped = true; };
  };
})(this);
