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

  // Tape colours: ivory on the dark theme, white on listing paper (where
  // ivory would merge with the page).
  T.colours = function () {
    return SW.lightTheme && SW.lightTheme() ? { paper: '#ffffff', hole: '#1c2a31' } : { paper: '#e7e1d0', hole: '#1c2a31' };
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
        '<p class="prose">A <b>frame</b> is one column of holes across the tape: one character on a source tape, one six-bit part of a word on an object tape, at ten frames to the inch. Eight data channels run along the tape, with the small sprocket hole between the third and fourth. Choose where to start (counted from the very beginning of the tape image, leader included) and how many frames to draw.</p>' +
        (reals.length ? '' : '<p class="prose"><b>No real tape survives for this version</b> in the project’s sources; only the reconstruction can be shown.</p>');
      var tb = SW.el('div', { class: 'toolbar' });
      tb.innerHTML = '<label class="check" title="Real tapes are digitised images of the surviving paper tapes; the reconstruction is the tape the assembler would punch today">Tape <select id="tp-which">' +
        reals.map(function (r, i) { return '<option value="r' + i + '">Real: ' + SW.esc(r.path) + ' (' + SW.esc(r.kind) + ')</option>'; }).join('') +
        '<option value="asm">Reconstruction: assembled today (macro1 format)</option></select></label>' +
        '<label class="check" title="A frame is one column of holes across the tape: one character or byte. Frames are counted from the very start of the tape image, leader included.">Start at frame <input type="number" id="tp-from" min="0" value="0" style="width:7em"></label>' +
        '<label class="check" title="How many frames to draw (ten frames to the inch of real tape)">Number of frames <input type="number" id="tp-n" min="10" value="600" style="width:6em"></label>';
      var info = SW.el('div', { class: 'hint', style: 'margin:6px 0' });
      var roll = SW.el('div', { class: 'tape-roll' });
      var decoded = SW.el('pre', { class: 'mono', style: 'display:none;max-height:260px;overflow:auto;font-size:12px;background:var(--surface);padding:8px;border-radius:6px' });
      var titlesBox = SW.el('div', { class: 'tape-titles' });
      var cur = { bytes: [], name: '' };
      function showTitles(bytes) {
        var ts = T.titles(bytes);
        titlesBox.innerHTML = '';
        if (!ts.length) return;
        titlesBox.appendChild(SW.el('h3', {}, 'Punched titles'));
        titlesBox.appendChild(SW.el('p', { class: 'hint', title: 'Each letter is punched as five columns of holes in channels 1 to 6; the reading is made by matching the columns against the letters observed on the surviving tapes. A ? marks a shape not yet in that set.' },
          'Letters punched into the tape as holes, to be read by eye when the tape is held up. The reading is the bench’s, made against the letter shapes found on the surviving tapes.'));
        ts.forEach(function (t) {
          var row = SW.el('div', { class: 'tape-title' });
          row.innerHTML = '<div class="tape-title-img">' + T.titleSVG(bytes, t) + '</div>' +
            '<div><b class="mono">“' + SW.esc(t.text) + '”</b> <span class="hint">frames ' + t.from + '–' + t.to + '</span></div>';
          row.appendChild(SW.el('button', { class: 'btn ghost', title: 'Draw the tape from just before this title', onclick: function () {
            SW.$('#tp-from', tb).value = Math.max(0, t.from - 10);
            draw();
            roll.scrollIntoView({ block: 'nearest' });
          } }, 'Show on tape'));
          titlesBox.appendChild(row);
        });
      }
      function start(bytes) { var s = 0; while (s < bytes.length && bytes[s] === 0) s++; return s; }
      function draw() {
        roll.innerHTML = '';
        var c = document.createElement('canvas');
        T.draw(c, cur.bytes, { from: +SW.$('#tp-from', tb).value, max: +SW.$('#tp-n', tb).value, pitch: 9, height: 90 });
        roll.appendChild(c);
      }
      function select() {
        var w = SW.$('#tp-which', tb).value;
        decoded.style.display = 'none';
        titlesBox.innerHTML = '';
        if (w === 'asm') {
          cur = { bytes: b.asm.tape, name: 'spacewar-' + b.v.id + '-reconstruction' };
          info.innerHTML = '<b>Reconstruction.</b> ' + cur.bytes.length.toLocaleString('en-GB') + ' frames (' + (cur.bytes.length / 120).toFixed(1) + ' ft): blank leader, macro1’s RIM read-in loader, the program in checksummed blocks, a closing <code>jmp</code> to the start address.';
          SW.$('#tp-from', tb).value = start(cur.bytes);
          draw();
          return;
        }
        var r = reals[+w.slice(1)];
        info.textContent = 'Reading ' + r.path + '…';
        SW.fetchBytes(r.path).then(function (bytes) {
          cur = { bytes: bytes, name: r.path.split('/').pop().replace(/\.[a-z]+$/, '') };
          var d = root.SWFiodec ? root.SWFiodec.decode(bytes) : null;
          var kind = d && d.isSource ? 'a <b>source tape</b>: FIO-DEC text, every frame passing the odd-parity check (' + d.stops + ' stop codes)' :
            'an <b>object tape</b>: binary words for the loader' + (d ? ' (' + Math.round(100 * d.parityErrors / Math.max(1, d.frames)) + '% of frames fail the FIO-DEC parity test, as binary does)' : '');
          info.innerHTML = '<b>Real tape.</b> <span class="mono">' + SW.sourceLink(r.path) + '</span>: ' + bytes.length.toLocaleString('en-GB') + ' frames (' + (bytes.length / 120).toFixed(1) + ' ft), ' + kind + '.';
          if (d && d.isSource) { decoded.style.display = 'block'; decoded.textContent = d.text.slice(0, 6000) + (d.text.length > 6000 ? '\n…' : ''); }
          var goTo = SW.state.tapeGo;
          SW.$('#tp-from', tb).value = goTo && goTo.path === r.path && goTo.from != null ? Math.max(0, goTo.from - 10) : start(bytes);
          SW.state.tapeGo = null;
          draw();
          showTitles(bytes);
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
      pad.appendChild(roll);
      pad.appendChild(titlesBox);
      pad.appendChild(decoded);
      SW.$('#tp-which', tb).addEventListener('change', select);
      // Sent here from elsewhere (the Findings page) to a particular tape.
      var want = SW.state.tapeGo ? reals.map(function (r) { return r.path; }).indexOf(SW.state.tapeGo.path) : -1;
      if (want >= 0) SW.$('#tp-which', tb).value = 'r' + want; else SW.state.tapeGo = null;
      SW.$('#tp-from', tb).addEventListener('change', draw);
      SW.$('#tp-n', tb).addEventListener('change', draw);
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
