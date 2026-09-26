/*
 * tape.js - the paper tape: each version's assembled object tape drawn as
 * punched eight-channel tape (sprocket holes between channels 3 and 4),
 * as the PDP-1's reader saw it.
 */
(function (root) {
  'use strict';
  var SW = root.SW;
  var T = SW.tape = {};
  var view = SW.$('#view-tape');

  // Tape colours come from the theme (--tape-paper, --tape-hole): ivory on
  // dark grounds, white or near-white on light ones, where ivory would merge.
  T.colours = function () {
    return { paper: SW.cssVar('--tape-paper') || '#e7e1d0', hole: SW.cssVar('--tape-hole') || '#1c2a31' };
  };

  // Draw bytes on a canvas: one column per frame (tape runs left to right).
  T.draw = function (canvas, bytes, opts) {
    opts = opts || {};
    var pitch = opts.pitch || 6, h = opts.height || 60, from = opts.from || 0;
    var n = Math.min(bytes.length - from, opts.max || bytes.length);
    canvas.width = Math.max(1, n * pitch + 2 * pitch);
    canvas.height = h;
    var g = canvas.getContext('2d');
    var tc = T.colours(), paper = opts.paper || tc.paper, hole = opts.hole || tc.hole;
    g.fillStyle = paper;
    g.fillRect(0, 0, canvas.width, h);
    var row = (h - 8) / 9, r = Math.max(1, row * 0.34), rs = Math.max(0.7, row * 0.16);
    for (var i = 0; i < n; i++) {
      var b = bytes[from + i], x = pitch + i * pitch + pitch / 2;
      g.fillStyle = hole;
      // channel 1 at the top, 8 at the bottom, sprocket between 3 and 4: the
      // way round in which a title punched in the leader reads correctly
      for (var c = 0; c < 8; c++) {
        if (!((b >> c) & 1)) continue;
        var slot = c < 3 ? c : c + 1;
        var y = 4 + row * (slot + 0.5);
        g.beginPath(); g.arc(x, y, r, 0, 6.2832); g.fill();
      }
      g.beginPath(); g.arc(x, 4 + row * 3.5, rs, 0, 6.2832); g.fill();
    }
    return canvas;
  };

  T.strip = function (b) {
    var el = SW.$('#tape-strip');
    el.innerHTML = '';
    if (!b.asm) { el.title = 'No tape'; return; }
    var reals = T.realTapes ? T.realTapes(b) : [];
    function put(bytes, title) {
      var c = document.createElement('canvas'), s = 0;
      while (s < bytes.length && bytes[s] === 0) s++;
      T.draw(c, bytes, { from: s, max: 400, pitch: 4, height: 30 });
      el.innerHTML = '';
      el.appendChild(c);
      el.title = title;
    }
    if (reals.length) {
      SW.fetchBytes(reals[0].path).then(function (bytes) { put(bytes, 'Real tape: ' + reals[0].path); })
        .catch(function () { put(b.asm.tape, 'Reconstruction: the tape the assembler punches today'); });
    } else put(b.asm.tape, 'Reconstruction: the tape the assembler punches today (no real tape survives for this version)');
  };

  T.svg = function (bytes, from, n, pitch, h) {
    pitch = pitch || 10; h = h || 100;
    var row = (h - 8) / 9, r = row * 0.34, rs = row * 0.16, w = (n + 2) * pitch;
    var out = ['<svg xmlns="http://www.w3.org/2000/svg" width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '">',
               '<rect width="' + w + '" height="' + h + '" fill="' + T.colours().paper + '"/><g fill="' + T.colours().hole + '">'];
    for (var i = 0; i < n; i++) {
      var byte = bytes[from + i], x = pitch + i * pitch + pitch / 2;
      for (var c = 0; c < 8; c++) {
        if (!((byte >> c) & 1)) continue;
        var slot = c < 3 ? c : c + 1;
        out.push('<circle cx="' + x.toFixed(1) + '" cy="' + (4 + row * (slot + 0.5)).toFixed(1) + '" r="' + r.toFixed(2) + '"/>');
      }
      out.push('<circle cx="' + x.toFixed(1) + '" cy="' + (4 + row * 3.5).toFixed(1) + '" r="' + rs.toFixed(2) + '"/>');
    }
    out.push('</g></svg>');
    return out.join('');
  };

  // ---------- punched titles ----------
  // Tapes were often labelled by punching letters into the leader, one
  // letter as five columns of holes (channels 1-6, channel 1 at the top),
  // readable by eye when the tape is held up. The glyphs below are the ones
  // observed on the surviving tapes; any other letter reads as '?'. A single
  // full column (77) is read as '/' because it only occurs inside dates.
  T.FONT = {
    A: '76.11.11.11.76', B: '77.45.45.45.32', C: '36.41.41.41.22', D: '77.41.41.41.36', E: '77.45.45.41.41',
    F: '77.5.5.1.1', M: '77.2.14.2.77', P: '77.11.11.11.6', R: '77.11.11.31.46', S: '22.45.45.45.30',
    W: '37.60.14.60.37', Y: '1.2.74.2.1', Z: '61.51.41.45.43',
    '0': '36.41.41.41.36', '1': '42.77.40', '2': '62.51.51.51.46', '3': '22.41.45.45.32', '4': '14.12.11.77.10',
    '6': '36.45.45.45.30', '.': '60.60', '/': '77'
  };
  var GLYPHS = Object.keys(T.FONT).map(function (k) {
    return { ch: k, cols: T.FONT[k].split('.').map(function (s) { return parseInt(s, 8); }) };
  });
  // Read one run of columns with no blank between them: the fewest glyphs
  // that cover it exactly (letters are sometimes punched with no gap).
  function readCols(cols) {
    var n = cols.length, best = [''];
    for (var i = 0; i < n; i++) {
      if (best[i] == null) continue;
      GLYPHS.forEach(function (g) {
        var L = g.cols.length;
        if (i + L > n) return;
        for (var k = 0; k < L; k++) if (cols[i + k] !== g.cols[k]) return;
        if (best[i + L] == null || best[i + L].length > best[i].length + 1) best[i + L] = best[i] + g.ch;
      });
    }
    return best[n] == null ? null : best[n];
  }
  // Punched titles on a tape image: runs of frames without channel 8 (which
  // every loader and data frame has), gaps of up to eight blank frames
  // allowed inside, fifteen frames or more, at least half legible.
  T.titles = function (bytes) {
    var out = [], i = 0, n = bytes.length;
    while (i < n) {
      var b0 = bytes[i];
      if (!b0 || (b0 & 0x80)) { i++; continue; }
      var j = i, last = i, gap = 0;
      while (j < n) {
        var c = bytes[j];
        if (c & 0x80) break;
        if (c) { last = j; gap = 0; } else if (++gap > 8) break;
        j++;
      }
      if (last - i + 1 >= 15) {
        var text = '', known = 0, segs = 0, k = i;
        while (k <= last) {
          if (!bytes[k]) { var z = 0; while (!bytes[k]) { z++; k++; } if (z >= 3) text += ' '; continue; }
          var cols = [];
          while (k <= last && bytes[k]) cols.push(bytes[k++] & 0x3f);
          segs++;
          var r = readCols(cols);
          if (r != null) { text += r; known++; } else text += '?';
        }
        if (known / segs >= 0.5) out.push({ from: i, to: last, text: text });
      }
      i = last + 1;
    }
    return out;
  };

  // ---------- anatomy: what each stretch of an object tape is ----------
  // An object tape, as the PDP-1 read it: blank leader (and any punched title),
  // the read-in (RIM) section of dio/value pairs ending in a jmp, then, if that
  // section is macro1's block loader, blocks of words each closed by a
  // checksum, and a final jmp to the program's start. Frames without channel 8
  // are skipped by the reader in binary mode (titles live there).
  var DIO = 0o320000, JMP = 0o600000;
  T.anatomy = function (bytes) {
    var p = 0, segs = [], blocks = [], rim = [];
    function getw() {
      var w = 0, f0 = -1;
      for (var i = 0; i < 3;) {
        if (p >= bytes.length) return null;
        var c = bytes[p++];
        if (c & 0o200) { if (f0 < 0) f0 = p - 1; w = (w << 6) | (c & 0o77); i++; }
      }
      return { w: w, f0: f0, f1: p - 1 };
    }
    var first = 0;
    while (first < bytes.length && !(bytes[first] & 0o200)) first++;
    var titles = T.titles(bytes);
    if (first > 0) segs.push({ kind: 'leader', f0: 0, f1: first - 1, label: 'leader' + (titles.some(function (t) { return t.to < first; }) ? ' and title' : '') });
    var out = { segs: segs, blocks: blocks, titles: titles, frames: bytes.length, rimWords: 0 };
    if (first >= bytes.length) { out.kind = 'blank'; return out; }
    var rimJ = null, bad = null;
    for (;;) {
      var w = getw();
      if (!w) break;
      if ((w.w & 0o760000) === JMP) { rimJ = w; break; }
      if ((w.w & 0o760000) !== DIO) { bad = w; break; }
      var v = getw();
      if (!v) break;
      rim.push({ a: w.w & 0o7777, v: v.w, f0: w.f0, f1: v.f1 });
    }
    out.rimWords = rim.length;
    if (bad || !rim.length) { out.kind = 'unknown'; segs.push({ kind: 'other', f0: first, f1: bytes.length - 1, label: 'not in read-in format' }); return out; }
    var loader = rim.some(function (r) { return r.a === 0o7751 && r.v === 0o730002; });
    segs.push({ kind: loader ? 'loader' : 'rim', f0: rim[0].f0, f1: rimJ ? rimJ.f1 : rim[rim.length - 1].f1,
                label: loader ? 'read-in loader (' + rim.length + ' words, then jmp ' + SW.oct(rimJ ? rimJ.w & 0o7777 : 0, 4) + ')' : 'program in read-in mode (' + rim.length + ' words)' });
    out.kind = loader ? 'blocks' : 'rim';
    if (!loader) { out.start = rimJ ? rimJ.w & 0o7777 : null; addTail(); return out; }
    for (;;) {
      var sw = getw();
      if (!sw) break;
      if ((sw.w & 0o760000) === JMP) { out.jmp = { to: sw.w & 0o7777, f0: sw.f0, f1: sw.f1 }; segs.push({ kind: 'jmp', f0: sw.f0, f1: sw.f1, label: 'jmp ' + SW.oct(sw.w & 0o7777, 4) }); break; }
      var ew = getw();
      if (!ew) break;
      var a0 = sw.w & 0o7777, a1 = ew.w & 0o7777, sum = sw.w + ew.w, n = 0, last = ew;
      for (var a = a0; a < a1; a++) { var d = getw(); if (!d) break; sum += d.w; n++; last = d; }
      var ck = getw();
      while (sum > 0o777777) sum = (sum & 0o777777) + Math.floor(sum / 0o1000000);
      var blk = { n: blocks.length + 1, a0: a0, a1: a1 - 1, words: n, f0: sw.f0, f1: ck ? ck.f1 : last.f1, ck: ck ? ck.w : null, sum: sum, ok: !!ck && ck.w === sum };
      blocks.push(blk);
      segs.push({ kind: blk.ok ? 'block' : 'bad', f0: blk.f0, f1: blk.f1, block: blk, label: SW.oct(a0, 4) + '–' + SW.oct(a1 - 1, 4) });
    }
    out.start = out.jmp ? out.jmp.to : null;
    addTail();
    return out;
    function addTail() {
      var lastF = segs.length ? segs[segs.length - 1].f1 : -1;
      if (lastF < bytes.length - 1) segs.push({ kind: 'trailer', f0: lastF + 1, f1: bytes.length - 1, label: 'trailer' + (titles.some(function (t) { return t.from > lastF; }) ? ' and title' : '') });
    }
  };
  // A source tape: leader, then the text in pages ended by stop codes (013).
  T.sourceAnatomy = function (bytes) {
    var first = 0, segs = [];
    while (first < bytes.length && !bytes[first]) first++;
    var last = bytes.length - 1;
    while (last > first && !bytes[last]) last--;
    if (first) segs.push({ kind: 'leader', f0: 0, f1: first - 1, label: 'leader' });
    var f0 = first, page = 1;
    for (var i = first; i <= last; i++) {
      if (bytes[i] === 0o13) { segs.push({ kind: page % 2 ? 'block' : 'page2', f0: f0, f1: i, label: 'page ' + page + ' (to the stop code at frame ' + i + ')' }); page++; f0 = i + 1; }
    }
    if (f0 <= last) segs.push({ kind: page % 2 ? 'block' : 'page2', f0: f0, f1: last, label: 'page ' + page });
    if (last < bytes.length - 1) segs.push({ kind: 'trailer', f0: last + 1, f1: bytes.length - 1, label: 'trailer' });
    return { kind: 'source', segs: segs, blocks: [], titles: T.titles(bytes), frames: bytes.length, pages: page - (f0 > last ? 1 : 0) };
  };
  var ANAT_COL = { leader: 'var(--g-muted)', trailer: 'var(--g-muted)', loader: 'var(--g-moved)', rim: 'var(--g-moved)', block: 'var(--g-retained)', bad: 'var(--g-removed)', jmp: 'var(--g-added)', other: 'var(--g-edited)', page2: 'var(--g-heat)' };
  T.anatomySVG = function (an, name, W) {
    W = W || 1100;
    var H = 150, top = 46, h = 30, sx = (W - 40) / Math.max(1, an.frames);
    var o = ['<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '" font-family="ui-monospace, Menlo, Consolas, monospace">',
             '<title>' + SW.esc('Anatomy of ' + name) + '</title>',
             '<text x="20" y="20" font-size="13" fill="var(--g-text)">' + SW.esc(name) + '</text>',
             '<text x="20" y="36" font-size="10" fill="var(--g-muted)">' + an.frames.toLocaleString('en-GB') + ' frames · ' + (an.kind === 'source' ? 'a source tape in FIO-DEC, ' + an.pages + ' pages between stop codes' : an.kind === 'blocks' ? an.blocks.length + ' blocks, ' + an.blocks.filter(function (b) { return !b.ok; }).length + ' failing their checksum · ' + (an.start != null ? 'ends jmp ' + SW.oct(an.start, 4) : 'no closing jmp') : an.kind === 'rim' ? 'read-in mode only' : 'not an object tape') + '</text>'];
    an.segs.forEach(function (sg, i) {
      var x = 20 + sg.f0 * sx, w = Math.max(1, (sg.f1 - sg.f0 + 1) * sx), alt = sg.kind === 'block' && sg.block && sg.block.n % 2 === 0;
      o.push('<rect class="an-seg" data-i="' + i + '" x="' + x.toFixed(2) + '" y="' + top + '" width="' + w.toFixed(2) + '" height="' + h + '" fill="' + ANAT_COL[sg.kind] + '" fill-opacity="' + (sg.kind === 'leader' || sg.kind === 'trailer' ? 0.35 : alt ? 0.6 : 0.9) + '" stroke="var(--g-stroke)" stroke-width="0.4"><title>' +
        SW.esc(sg.label + ' · frames ' + sg.f0 + '–' + sg.f1 + (sg.block ? ' · ' + sg.block.words + ' words · checksum ' + SW.oct(sg.block.ck) + (sg.block.ok ? ' (checks)' : ' (the words sum to ' + SW.oct(sg.block.sum) + ')') : '')) + '</title></rect>');
      if (sg.kind === 'bad') o.push('<text x="' + (x + w / 2).toFixed(1) + '" y="' + (top - 4) + '" font-size="10" text-anchor="middle" fill="var(--g-removed)">✕ ' + SW.esc(sg.label) + '</text>');
    });
    an.titles.forEach(function (t) {
      var x = 20 + t.from * sx, w = Math.max(2, (t.to - t.from + 1) * sx);
      o.push('<rect x="' + x.toFixed(2) + '" y="' + (top + h + 3) + '" width="' + w.toFixed(2) + '" height="4" fill="var(--g-edited)"><title>' + SW.esc('Punched title “' + t.text + '”') + '</title></rect>');
    });
    var kx = 20, ky = H - 22;
    [['leader', 'leader / trailer'], ['loader', 'read-in loader'], ['block', 'block (checksum good)'], ['bad', 'checksum fails'], ['jmp', 'closing jmp'], ['other', 'punched title']].forEach(function (k) {
      o.push('<rect x="' + kx + '" y="' + (ky - 9) + '" width="14" height="10" fill="' + (k[0] === 'other' ? 'var(--g-edited)' : ANAT_COL[k[0]]) + '"/><text x="' + (kx + 18) + '" y="' + ky + '" font-size="10" fill="var(--g-text)">' + k[1] + '</text>');
      kx += 34 + k[1].length * 6.2;
    });
    o.push('</svg>');
    return o.join('');
  };

  // Every tape image the catalogue refers to, with the versions that use it.
  T.EXTRA = [{ path: 'SteveRussell_box1/stars.bin', note: 'star table, not used in any build here' }];
  T.allTapes = function () {
    var V = root.SWVersions, map = {}, list = [];
    function add(path, vid, kind) {
      if (!map[path]) { map[path] = { path: path, kind: kind, versions: [] }; list.push(map[path]); }
      if (vid && map[path].versions.indexOf(vid) < 0) map[path].versions.push(vid);
    }
    V.VERSIONS.forEach(function (v) {
      (v.build || []).forEach(function (p) { if (p && p.tape) add(p.tape, v.id, 'source tape'); });
      (v.sourceTapes || []).forEach(function (t) { add(t, v.id, 'source tape'); });
      (v.witnesses || []).forEach(function (t) { add(t, v.id, /\.rim$/.test(t) ? 'object tape (modern build)' : 'object tape'); });
    });
    T.EXTRA.forEach(function (e) { add(e.path, null, e.note); });
    return list;
  };

  // A title as it is punched, for display and export.
  T.titleSVG = function (bytes, t) {
    var pad = 6, from = Math.max(0, t.from - pad), n = Math.min(bytes.length - from, t.to - t.from + 1 + 2 * pad);
    return T.svg(bytes, from, n, 8, 80);
  };

  // Tape frames of the program (after the loader) mapped back to words.
  function frames(b) {
    var bytes = b.asm.tape, s = 0;
    while (s < bytes.length && bytes[s] === 0) s++;
    return { bytes: bytes, start: s };
  }

  // Real tapes held for a version: digitised images of the physical tapes.
  T.realTapes = function (b) {
    var out = [], seen = {};
    function add(path, kind) { if (!seen[path]) { seen[path] = 1; out.push({ path: path, kind: kind }); } }
    b.parts.forEach(function (p) { if (p.tape) add(p.src, 'source tape (FIO-DEC)'); });
    (b.v.sourceTapes || []).forEach(function (t) { add(t, 'source tape (FIO-DEC)'); });
    (b.v.witnesses || []).forEach(function (t) { add(t, /\.rim$/.test(t) ? 'object tape (modern macro1 build)' : 'object tape'); });
    return out;
  };

  SW.views.tape = {
    show: function (b) {
      view.innerHTML = '';
      if (!b.asm) { view.innerHTML = '<div class="pad hint">No tape: no source survives for this version.</div>'; return; }
      var reals = T.realTapes(b);
      var pad = SW.el('div', { class: 'pad' });
      pad.innerHTML = '<h2>' + SW.esc(b.v.label) + ': tapes</h2>' +
        '<p class="prose">Two kinds of tape are shown here, and they should not be confused. <b>Real tapes</b> are the digitised images of the surviving paper tapes (for the 1962–63 versions, mostly from Steve Russell’s box, read for bitsavers in 2003–04): every frame as the tape reader saw it. <b>The reconstruction</b> is the tape the assembler here would punch from the source today, in macro1’s loader and block format, not the format MIT’s MACRO punched.</p>' +
        '<p class="prose">A <b>frame</b> is one column of holes across the tape: one character on a source tape, one six-bit part of a word on an object tape, at ten frames to the inch. Eight data channels run along the tape, with the small sprocket hole between the third and fourth. Show chooses what to draw: the whole tape, one of its stretches (leader, read-in loader, each checksummed block, the closing jump; on a source tape, each page between stop codes), a punched title, or a range of your own, counted in frames from the very beginning of the tape image, leader included. A version read from several physical tapes lists each one under Tape.</p>' +
        (reals.length ? '' : '<p class="prose"><b>No real tape survives for this version</b> in the project’s sources; only the reconstruction can be shown.</p>');
      var mode = SW.store.get('tape.mode', 'holes');
      var tb = SW.el('div', { class: 'toolbar' });
      tb.innerHTML = '<span class="seg-btns"><button class="btn' + (mode === 'holes' ? ' on' : '') + '" data-mode="holes" title="The tape as holes, frame by frame">Holes</button><button class="btn' + (mode === 'anatomy' ? ' on' : '') + '" data-mode="anatomy" title="The tape as stretches: leader and title, the read-in loader, each block of words with its checksum (checked), and the closing jump; for a source tape, its pages between stop codes">Anatomy</button></span>' +
        '<label class="check" title="Real tapes are digitised images of the surviving paper tapes; the reconstruction is the tape the assembler would punch today">Tape <select id="tp-which">' +
        reals.map(function (r, i) { return '<option value="r' + i + '">Real: ' + SW.esc(r.path) + ' (' + SW.esc(r.kind) + ')</option>'; }).join('') +
        '<option value="asm">Reconstruction: assembled today (macro1 format)</option></select></label>' +
        '<label class="check" title="What to draw: the whole tape, one of its stretches as the tape is built, a punched title, or your own range">Show <select id="tp-show"></select></label>' +
        '<label class="check" title="A frame is one column of holes across the tape: one character or byte. Frames are counted from the very start of the tape image, leader included.">From frame <input type="number" id="tp-from" min="0" value="0" style="width:6.5em"></label>' +
        '<label class="check" title="How many frames to draw (ten frames to the inch of real tape)">Frames <input type="number" id="tp-n" min="1" value="600" style="width:6.5em"></label>' +
        '<button class="btn" id="tp-lens" title="Magnifier: hover over the tape to see the frames under the cursor enlarged, with each frame\'s value and the stretch it belongs to. Click the tape to open a close-up of that part under the row.">🔍</button>' +
        '<label class="check" title="Wrapped: the stretch cut into rows that fit the window, each starting with its first frame\'s number. One strip: a single band to scroll along, as the tape runs through the reader.">Layout <select id="tp-layout"><option value="wrap">Wrapped rows</option><option value="strip">One strip</option></select></label>';
      var info = SW.el('div', { class: 'hint', style: 'margin:6px 0' });
      var roll = SW.el('div', { class: 'tape-roll' });
      var decoded = SW.el('pre', { class: 'mono', style: 'display:none;max-height:260px;overflow:auto;font-size:12px;background:var(--surface);padding:8px;border-radius:6px' });
      var titlesBox = SW.el('div', { class: 'tape-titles' });
      var anatBox = SW.el('div', { class: 'tape-anat' });
      var cur = { bytes: [], name: '', source: false, an: null, chars: null };
      var lensOn = SW.store.get('tape.lens', true);
      var lens = SW.el('div', { class: 'tape-lens' });
      lens.innerHTML = '<canvas></canvas><div class="tape-lens-cap"></div>';
      SW.$('#tp-layout', tb).value = SW.store.get('tape.layout', 'wrap');
      // Anatomy: the tape as stretches (leader, loader, blocks and their checksums, jmp).
      function showAnatomy() {
        anatBox.innerHTML = '';
        anatBox.style.display = mode === 'anatomy' ? '' : 'none';
        if (mode !== 'anatomy' || !cur.bytes.length) return;
        var an = cur.an;
        var box = SW.el('div', { class: 'svgbox', style: 'margin:6px 0' }, SW.displaySVG(T.anatomySVG(an, cur.name, 1100)));
        anatBox.appendChild(box);
        var bar = SW.el('div', { class: 'toolbar', style: 'position:static;padding-left:0' });
        bar.appendChild(SW.figureButtons(function () { return T.anatomySVG(an, cur.name, 1100); }, cur.name + '-anatomy'));
        anatBox.appendChild(bar);
        anatBox.appendChild(SW.el('p', { class: 'hint' }, 'Click a stretch, or a row, to draw the holes from there.'));
        var rows = an.segs.map(function (sg) {
          var bk = sg.block;
          return [sg.kind === 'bad' ? 'block (fails)' : sg.kind === 'page2' ? 'page' : sg.kind, sg.f0 + '–' + sg.f1, sg.f1 - sg.f0 + 1, bk ? SW.oct(bk.a0, 4) + '–' + SW.oct(bk.a1, 4) : '', bk ? bk.words : '',
                  bk ? { html: bk.ok ? '<span class="badge ok">' + SW.oct(bk.ck) + ' checks</span>' : '<span class="badge err">' + SW.oct(bk.ck) + ' punched; words sum to ' + SW.oct(bk.sum) + '</span>', text: bk.ok ? SW.oct(bk.ck) + ' checks' : SW.oct(bk.ck) + ' punched, words sum to ' + SW.oct(bk.sum), sort: bk.ok ? 1 : 0 } : '',
                  (b.symAt && bk && b.symAt(bk.a0)) || (sg.kind === 'block' || sg.kind === 'bad' ? '' : sg.label)];
        });
        var tbl = SW.table(['Stretch', 'Frames', 'Length', 'Addresses', 'Words', 'Checksum', 'Note'], rows, { cls: ['', 'mono', 'num', 'mono', 'num', 'mono', 'mono'], onRow: function (r) {
          var f0 = parseInt(r[1], 10);
          for (var i = 0; i < an.segs.length; i++) if (an.segs[i].f0 === f0) { show('s' + i); break; }
          roll.scrollIntoView({ block: 'nearest' });
        } });
        var sc = SW.el('div', { class: 'scroll', style: 'max-height:360px;overflow:auto' });
        sc.appendChild(tbl);
        anatBox.appendChild(sc);
        box.addEventListener('click', function (e) {
          var r = e.target.closest('.an-seg');
          if (!r) return;
          show('s' + r.getAttribute('data-i')); roll.scrollIntoView({ block: 'nearest' });
        });
        anatBox.appendChild(SW.exportButtons(function () {
          return { title: 'Anatomy of ' + cur.name, meta: SW.docMeta(b), blocks: [SW.tableBlock('Stretches of the tape', ['Stretch', 'Frames', 'Length', 'Addresses', 'Words', 'Checksum', 'Note'], rows)] };
        }, cur.name + '-anatomy'));
      }
      function showTitles(bytes) {
        var ts = T.titles(bytes);
        titlesBox.innerHTML = '';
        if (!ts.length) return;
        titlesBox.appendChild(SW.el('h3', {}, 'Punched titles'));
        titlesBox.appendChild(SW.el('p', { class: 'hint', title: 'Each letter is punched as five columns of holes in channels 1 to 6; the reading is made by matching the columns against the letters observed on the surviving tapes. A ? marks a shape not yet in that set.' },
          'Letters punched into the tape as holes, to be read by eye when the tape is held up. The reading is the bench’s, made against the letter shapes found on the surviving tapes.'));
        ts.forEach(function (t, ti) {
          var row = SW.el('div', { class: 'tape-title' });
          row.innerHTML = '<div class="tape-title-img">' + T.titleSVG(bytes, t) + '</div>' +
            '<div><b class="mono">“' + SW.esc(t.text) + '”</b> <span class="hint">frames ' + t.from + '–' + t.to + '</span></div>';
          row.appendChild(SW.el('button', { class: 'btn ghost', title: 'Draw the tape from just before this title', onclick: function () {
            show('t' + ti);
            roll.scrollIntoView({ block: 'nearest' });
          } }, 'Show on tape'));
          titlesBox.appendChild(row);
        });
      }
      function start(bytes) { var s = 0; while (s < bytes.length && bytes[s] === 0) s++; return s; }
      // What Show offers: the whole tape, its stretches as the tape is built
      // (anatomy), its punched titles, and a range of your own.
      function stretchName(sg) {
        return sg.block ? 'block ' + sg.block.n + ', ' + sg.label + (sg.kind === 'bad' ? ' (checksum fails)' : '') : sg.label;
      }
      function fillShow() {
        var an = cur.an, n = cur.bytes.length;
        var h = '<option value="whole">Whole tape (' + n.toLocaleString('en-GB') + ' frames, ' + (n / 120).toFixed(1) + ' ft)</option>';
        if (an && an.segs.length) h += '<optgroup label="' + (an.kind === 'source' ? 'Pages, between stop codes' : 'Stretches of the tape') + '">' + an.segs.map(function (sg, i) {
          return '<option value="s' + i + '">' + SW.esc(stretchName(sg)) + ' · ' + (sg.f1 - sg.f0 + 1).toLocaleString('en-GB') + ' frames</option>';
        }).join('') + '</optgroup>';
        if (an && an.titles.length) h += '<optgroup label="Punched titles">' + an.titles.map(function (t, i) {
          return '<option value="t' + i + '">“' + SW.esc(t.text) + '”, frames ' + t.from + '–' + t.to + '</option>';
        }).join('') + '</optgroup>';
        SW.$('#tp-show', tb).innerHTML = h + '<option value="custom">Your own range (From frame, Frames)</option>';
      }
      function show(v) {
        var an = cur.an, f0 = 0, len = cur.bytes.length;
        if (v[0] === 's' && an && an.segs[+v.slice(1)]) { var sg = an.segs[+v.slice(1)]; f0 = sg.f0; len = sg.f1 - sg.f0 + 1; }
        else if (v[0] === 't' && an && an.titles[+v.slice(1)]) { var t = an.titles[+v.slice(1)]; f0 = Math.max(0, t.from - 10); len = t.to - f0 + 11; }
        if (v !== 'custom') { SW.$('#tp-from', tb).value = f0; SW.$('#tp-n', tb).value = len; }
        SW.$('#tp-show', tb).value = v;
        if (v === 'whole' || v === 'custom') SW.store.set('tape.show', v);
        draw();
      }
      // Wrapped: rows that fit the window, each labelled with its first frame.
      // One strip: canvases of up to 3,000 frames side by side (a canvas has a
      // width limit), to scroll along.
      function draw() {
        roll.innerHTML = '';
        if (!cur.bytes.length) return;
        var from = Math.max(0, Math.min(cur.bytes.length - 1, +SW.$('#tp-from', tb).value || 0));
        var n = Math.max(1, Math.min(cur.bytes.length - from, +SW.$('#tp-n', tb).value || 1));
        var wrap = SW.$('#tp-layout', tb).value === 'wrap', s;
        roll.classList.toggle('wrapped', wrap);
        if (wrap) {
          var pitch = 7, per = Math.max(40, Math.floor(((roll.clientWidth || 1000) - 70) / pitch) - 2);
          for (s = from; s < from + n; s += per) {
            var row = SW.el('div', { class: 'tape-row' + (s + per <= from + n ? ' full' : '') }), c = document.createElement('canvas');
            row.appendChild(SW.el('span', { class: 'tape-at mono' }, s.toLocaleString('en-GB')));
            T.draw(c, cur.bytes, { from: s, max: Math.min(per, from + n - s), pitch: pitch, height: 70 });
            c.dataset.from = s; c.dataset.pitch = pitch;
            row.appendChild(c);
            roll.appendChild(row);
          }
        } else {
          var one = SW.el('div', { class: 'tape-one' });
          for (s = from; s < from + n; s += 3000) {
            var c2 = document.createElement('canvas');
            T.draw(c2, cur.bytes, { from: s, max: Math.min(3000, from + n - s), pitch: 9, height: 90 });
            c2.dataset.from = s; c2.dataset.pitch = 9;
            one.appendChild(c2);
          }
          roll.appendChild(one);
        }
      }
      // The first view of a tape: where the Findings page sent us, else the whole
      // tape (or your own range, from the end of the leader, if that was last used).
      // ---------- magnifier and close-up ----------
      // The frame under the pointer on one of the roll's canvases (drawn with a
      // pitch-wide margin, and perhaps stretched to fill its row).
      function frameAt(c, e) {
        var r = c.getBoundingClientRect(), p = +c.dataset.pitch, x = (e.clientX - r.left) * c.width / r.width;
        var f = +c.dataset.from + Math.floor((x - p) / p);
        return f >= 0 && f < cur.bytes.length ? f : null;
      }
      function frameInfo(f) {
        var x = cur.bytes[f], bits = '';
        for (var k = 7; k >= 0; k--) bits += (x >> k) & 1 ? '●' : '·';
        var sg = cur.an && cur.an.segs.filter(function (s) { return s.f0 <= f && f <= s.f1; })[0];
        var what = !x ? 'blank' : cur.source ? (cur.chars && cur.chars[f]) || '' : x & 0o200 ? 'binary: six bits of a word, ' + SW.oct(x & 0o77, 2) : 'no channel 8: skipped by the loader (a title, or leader)';
        return '<b>frame ' + f.toLocaleString('en-GB') + '</b> · ' + SW.oct(x, 3) + ' <span class="mono" title="channels 8 to 1">' + bits + '</span>' +
          (what ? ' · ' + SW.esc(what) : '') + (sg ? '<br><span class="hint">' + SW.esc(stretchName(sg)) + '</span>' : '');
      }
      function lensAt(e) {
        var c = e.target.closest ? e.target.closest('.tape-roll canvas') : null;
        var f = c && lensOn ? frameAt(c, e) : null;
        if (f == null) { lens.style.display = 'none'; return; }
        var lc = SW.$('canvas', lens), P = 16, K = 25, s0 = Math.max(0, Math.min(cur.bytes.length - K, f - 12));
        T.draw(lc, cur.bytes, { from: s0, max: K, pitch: P, height: 140 });
        var g = lc.getContext('2d');
        g.strokeStyle = SW.cssVar('--amber') || '#c80'; g.lineWidth = 2;
        g.strokeRect(P + (f - s0) * P + 1, 1, P - 2, 138);
        SW.$('.tape-lens-cap', lens).innerHTML = frameInfo(f);
        lens.style.display = 'block';
        var w = lens.offsetWidth, h = lens.offsetHeight;
        lens.style.left = (e.clientX + 18 + w > window.innerWidth ? e.clientX - w - 18 : e.clientX + 18) + 'px';
        lens.style.top = (e.clientY + 18 + h > window.innerHeight ? e.clientY - h - 18 : e.clientY + 18) + 'px';
      }
      // A close-up under the row: the frames around the click, large, with
      // frame numbers every ten; ◀ ▶ move along, ✕ closes.
      function closeUp(anchor, f) {
        SW.$$('.tape-zoom', roll).forEach(function (z) { z.remove(); });
        var P = 16, K = Math.max(40, Math.floor((roll.clientWidth - 40) / P) - 2), s0 = Math.max(0, Math.min(cur.bytes.length - K, f - Math.floor(K / 2)));
        var z = SW.el('div', { class: 'tape-zoom' });
        var bar = SW.el('div', { class: 'tape-zoom-bar' });
        function paint() {
          var c = z.querySelector('canvas.zc') || z.appendChild(SW.el('canvas', { class: 'zc' }));
          T.draw(c, cur.bytes, { from: s0, max: K, pitch: P, height: 150 });
          c.dataset.from = s0; c.dataset.pitch = P;
          var ru = z.querySelector('canvas.zr') || z.appendChild(SW.el('canvas', { class: 'zr' }));
          ru.width = c.width; ru.height = 18;
          var g = ru.getContext('2d');
          g.fillStyle = SW.cssVar('--text-dim') || '#888'; g.font = '11px ' + (SW.cssVar('--mono') || 'monospace'); g.textAlign = 'center';
          for (var i = 0; i < K; i++) if ((s0 + i) % 10 === 0) { var x = P + i * P + P / 2; g.fillRect(x, 0, 1, 5); g.fillText((s0 + i).toLocaleString('en-GB'), x, 16); }
          bar.firstChild.textContent = 'Close-up: frames ' + s0.toLocaleString('en-GB') + '–' + (s0 + K - 1).toLocaleString('en-GB');
        }
        bar.innerHTML = '<span class="hint"></span>';
        [['◀', -1, 'Earlier frames'], ['▶', 1, 'Later frames']].forEach(function (d) {
          bar.appendChild(SW.el('button', { class: 'btn ghost', title: d[2], onclick: function () { s0 = Math.max(0, Math.min(cur.bytes.length - K, s0 + d[1] * Math.floor(K / 2))); paint(); } }, d[0]));
        });
        bar.appendChild(SW.el('button', { class: 'btn ghost', title: 'Close', onclick: function () { z.remove(); } }, '✕'));
        z.appendChild(bar);
        paint();
        anchor.insertAdjacentElement('afterend', z);
      }
      roll.addEventListener('mousemove', lensAt);
      roll.addEventListener('mouseleave', function () { lens.style.display = 'none'; });
      roll.addEventListener('click', function (e) {
        var c = e.target.closest('canvas');
        if (!c || c.closest('.tape-zoom')) return;
        var f = frameAt(c, e);
        if (f != null) closeUp(c.closest('.tape-row, .tape-one') || c, f);
      });

      function firstShow(path) {
        cur.an = cur.source ? T.sourceAnatomy(cur.bytes) : T.anatomy(cur.bytes);
        cur.chars = cur.source && root.SWFiodec && root.SWFiodec.frameChars ? root.SWFiodec.frameChars(cur.bytes) : null;
        fillShow();
        var goTo = SW.state.tapeGo;
        SW.state.tapeGo = null;
        if (goTo && goTo.path === path && goTo.from != null) {
          SW.$('#tp-from', tb).value = Math.max(0, goTo.from - 10); SW.$('#tp-n', tb).value = 600; show('custom');
        } else if (SW.store.get('tape.show', 'whole') === 'custom') {
          SW.$('#tp-from', tb).value = start(cur.bytes); SW.$('#tp-n', tb).value = 600; show('custom');
        } else show('whole');
      }
      function select() {
        var w = SW.$('#tp-which', tb).value;
        decoded.style.display = 'none';
        titlesBox.innerHTML = '';
        if (w === 'asm') {
          cur = { bytes: b.asm.tape, name: 'spacewar-' + b.v.id + '-reconstruction', source: false };
          info.innerHTML = '<b>Reconstruction.</b> ' + cur.bytes.length.toLocaleString('en-GB') + ' frames (' + (cur.bytes.length / 120).toFixed(1) + ' ft): blank leader, macro1’s RIM read-in loader, the program in checksummed blocks, a closing <code>jmp</code> to the start address.';
          firstShow(null);
          showAnatomy();
          return;
        }
        var r = reals[+w.slice(1)];
        info.textContent = 'Reading ' + r.path + '…';
        SW.fetchBytes(r.path).then(function (bytes) {
          var d = root.SWFiodec ? root.SWFiodec.decode(bytes) : null;
          cur = { bytes: bytes, name: r.path.split('/').pop().replace(/\.[a-z]+$/, ''), source: !!(d && d.isSource) };
          var kind = d && d.isSource ? 'a <b>source tape</b>: FIO-DEC text, every frame passing the odd-parity check (' + d.stops + ' stop codes)' :
            'an <b>object tape</b>: binary words for the loader' + (d ? ' (' + Math.round(100 * d.parityErrors / Math.max(1, d.frames)) + '% of frames fail the FIO-DEC parity test, as binary does)' : '');
          info.innerHTML = '<b>Real tape.</b> <span class="mono">' + SW.sourceLink(r.path) + '</span>: ' + bytes.length.toLocaleString('en-GB') + ' frames (' + (bytes.length / 120).toFixed(1) + ' ft), ' + kind + '.';
          if (d && d.isSource) { decoded.style.display = 'block'; decoded.textContent = d.text.slice(0, 6000) + (d.text.length > 6000 ? '\n…' : ''); }
          firstShow(r.path);
          showTitles(bytes);
          showAnatomy();
        }).catch(function (e) { info.textContent = e.message; });
      }
      tb.appendChild(SW.el('button', { class: 'btn', onclick: function () {
        var from = +SW.$('#tp-from', tb).value, n = +SW.$('#tp-n', tb).value;
        root.SWExport.download(cur.name + '.svg', T.svg(cur.bytes, from, Math.min(n, cur.bytes.length - from), 10, 100), 'image/svg+xml');
      } }, '▣ Save as SVG'));
      tb.appendChild(SW.el('button', { class: 'btn', onclick: function () {
        root.SWExport.download(cur.name + '.bin', new Uint8Array(cur.bytes), 'application/octet-stream');
      } }, '⤓ Tape image (.bin)'));
      pad.appendChild(tb);
      pad.appendChild(info);
      pad.appendChild(anatBox);
      pad.appendChild(roll);
      pad.appendChild(titlesBox);
      pad.appendChild(decoded);
      SW.$('#tp-which', tb).addEventListener('change', select);
      tb.addEventListener('click', function (e) {
        var m = e.target.closest('[data-mode]');
        if (!m) return;
        mode = m.dataset.mode; SW.store.set('tape.mode', mode);
        SW.$$('[data-mode]', tb).forEach(function (x) { x.classList.toggle('on', x.dataset.mode === mode); });
        showAnatomy();
      });
      // Sent here from elsewhere (the Findings page) to a particular tape.
      var want = SW.state.tapeGo ? reals.map(function (r) { return r.path; }).indexOf(SW.state.tapeGo.path) : -1;
      if (want >= 0) SW.$('#tp-which', tb).value = 'r' + want; else SW.state.tapeGo = null;
      function custom() { SW.$('#tp-show', tb).value = 'custom'; SW.store.set('tape.show', 'custom'); draw(); }
      SW.$('#tp-from', tb).addEventListener('change', custom);
      SW.$('#tp-n', tb).addEventListener('change', custom);
      SW.$('#tp-show', tb).addEventListener('change', function (e) { show(e.target.value); });
      SW.$('#tp-layout', tb).addEventListener('change', function (e) { SW.store.set('tape.layout', e.target.value); draw(); });
      var lb = SW.$('#tp-lens', tb);
      lb.classList.toggle('on', lensOn);
      lb.onclick = function () { lensOn = !lensOn; SW.store.set('tape.lens', lensOn); lb.classList.toggle('on', lensOn); lens.style.display = 'none'; };
      pad.appendChild(lens);
      // Wrapped rows fit the window: draw them again when it changes width.
      var lastW = 0, relay = null;
      if (root.ResizeObserver) new ResizeObserver(function () {
        var w = roll.clientWidth;
        if (!w || Math.abs(w - lastW) < 20 || SW.$('#tp-layout', tb).value !== 'wrap') return;
        lastW = w; clearTimeout(relay); relay = setTimeout(draw, 120);
      }).observe(roll);
      select();
      var wit = b.v.witnesses || [];
      if (wit.length) {
        var w = SW.el('div', { style: 'margin-top:18px' });
        w.innerHTML = '<h3>Witness tapes</h3><p class="hint">Surviving object tapes for this version, compared word by word with what the source assembles to.</p><div id="tp-wit" class="hint">Reading tapes…</div>';
        pad.appendChild(w);
        SW.tape.witnesses(b).then(function (rows) {
          var el = SW.$('#tp-wit', pad);
          el.innerHTML = '';
          el.appendChild(SW.table(['Tape', 'Words on tape', 'Differ', 'Only in source', 'Only on tape'], rows.map(function (r) {
            return [{ html: SW.sourceLink(r.tape), text: r.tape, sort: r.tape }, r.words, r.differ, r.missing, r.extra];
          }), { cls: ['mono', 'num', 'num', 'num', 'num'] }));
          rows.forEach(function (r) { if (r.mem) el.appendChild(witnessDetail(b, r)); });
        });
      }
      view.appendChild(pad);
    }
  };

  // Every word where source and tape part company, as code.
  function witnessDetail(b, r) {
    var C = root.PDP1CPU, rows = [];
    var addrs = {};
    r.diffs.forEach(function (a) { addrs[a] = 1; });
    for (var k in b.asm.memory) if (!(k in r.mem)) addrs[k] = 1;
    for (var k2 in r.mem) if (!(k2 in b.asm.memory)) addrs[k2] = 1;
    Object.keys(addrs).map(Number).sort(function (x, y) { return x - y; }).forEach(function (a) {
      var w = b.asm.memory[a], t = r.mem[a], L = w ? b.lines[w.file][w.line - 1] : null;
      rows.push([SW.oct(a, 4), b.symAt(a) || '', w ? SW.oct(w.val) : '', w ? C.disasm(w.val, b.symAt) : '', t != null ? SW.oct(t) : '', t != null ? C.disasm(t, b.symAt) : '',
                 L ? L.n + ': ' + L.raw.trim() : '']);
    });
    var d = SW.el('details', { style: 'margin:10px 0' });
    d.innerHTML = '<summary><b>' + SW.esc(r.tape) + '</b> (' + SW.sourceLink(r.tape, 'open file') + '): ' + (rows.length ? rows.length + ' words differ' : 'identical to the build') + '</summary>';
    if (!rows.length) return d;
    var bar = SW.el('div', { class: 'toolbar', style: 'position:static;padding-left:0' });
    bar.appendChild(SW.exportButtons(function () {
      return { title: b.v.label + ' against ' + r.tape, subtitle: 'Words where the build and the witness tape differ', meta: SW.docMeta(b),
               blocks: [SW.tableBlock('Differences', ['Address', 'Symbol', 'Source word', 'As code', 'Tape word', 'As code', 'Source line'], rows)] };
    }, 'spacewar-' + b.v.id + '-witness-' + r.tape.split('/').pop().replace(/\.[a-z]+$/, '')));
    d.appendChild(bar);
    d.appendChild(SW.table(['Address', 'Symbol', 'Source word', 'As code', 'Tape word', 'As code', 'Source line'], rows,
      { cls: ['mono', 'mono', 'mono', 'mono', 'mono', 'mono', 'mono'], onRow: function (row) {
        var s = b.srcOf(parseInt(row[0], 8));
        if (s) SW.emit('goto', { p: s.p, n: s.n, tab: 'read' });
      } }));
    return d;
  }

  // Compare a build with its witness tapes.
  T.witnesses = function (b) {
    return Promise.all((b.v.witnesses || []).map(function (t) {
      return SW.fetchBytes(t).then(function (bytes) {
        var m = root.PDP1Asm.readTape(bytes).memory, d = [], miss = 0, n = 0;
        for (var k in b.asm.memory) {
          if (!(k in m)) miss++;
          else if (m[k] !== b.asm.memory[k].val) d.push(+k);
        }
        for (var k2 in m) { n++; }
        var extra = Object.keys(m).filter(function (k) { return !(k in b.asm.memory); }).length;
        return { tape: t, words: n, differ: d.length, missing: miss, extra: extra, diffs: d, mem: m };
      }).catch(function () { return { tape: t, words: '?', differ: '?', missing: '?', extra: '?', diffs: [] }; });
    }));
  };
})(this);
