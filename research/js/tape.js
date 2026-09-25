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

  // Draw bytes on a canvas: one column per frame (tape runs left to right).
  T.draw = function (canvas, bytes, opts) {
    opts = opts || {};
    var pitch = opts.pitch || 6, h = opts.height || 60, from = opts.from || 0;
    var n = Math.min(bytes.length - from, opts.max || bytes.length);
    canvas.width = Math.max(1, n * pitch + 2 * pitch);
    canvas.height = h;
    var g = canvas.getContext('2d');
    var paper = opts.paper || '#e7e1d0', hole = opts.hole || '#1c2a31';
    g.fillStyle = paper;
    g.fillRect(0, 0, canvas.width, h);
    var row = (h - 8) / 9, r = Math.max(1, row * 0.34), rs = Math.max(0.7, row * 0.16);
    for (var i = 0; i < n; i++) {
      var b = bytes[from + i], x = pitch + i * pitch + pitch / 2;
      g.fillStyle = hole;
      // channels 1..8 from the bottom; sprocket between 3 and 4
      for (var c = 0; c < 8; c++) {
        if (!((b >> c) & 1)) continue;
        var slot = c < 3 ? c : c + 1;
        var y = h - 4 - row * (slot + 0.5);
        g.beginPath(); g.arc(x, y, r, 0, 6.2832); g.fill();
      }
      g.beginPath(); g.arc(x, h - 4 - row * 3.5, rs, 0, 6.2832); g.fill();
    }
    return canvas;
  };

  T.strip = function (b) {
    var el = SW.$('#tape-strip');
    el.innerHTML = '';
    if (!b.asm) return;
    var c = document.createElement('canvas');
    // skip the leader and show the start of the program proper
    var bytes = b.asm.tape, s = 0;
    while (s < bytes.length && bytes[s] === 0) s++;
    T.draw(c, bytes, { from: s, max: 400, pitch: 4, height: 30 });
    el.appendChild(c);
  };

  T.svg = function (bytes, from, n, pitch, h) {
    pitch = pitch || 10; h = h || 100;
    var row = (h - 8) / 9, r = row * 0.34, rs = row * 0.16, w = (n + 2) * pitch;
    var out = ['<svg xmlns="http://www.w3.org/2000/svg" width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '">',
               '<rect width="' + w + '" height="' + h + '" fill="#e7e1d0"/><g fill="#1c2a31">'];
    for (var i = 0; i < n; i++) {
      var byte = bytes[from + i], x = pitch + i * pitch + pitch / 2;
      for (var c = 0; c < 8; c++) {
        if (!((byte >> c) & 1)) continue;
        var slot = c < 3 ? c : c + 1;
        out.push('<circle cx="' + x.toFixed(1) + '" cy="' + (h - 4 - row * (slot + 0.5)).toFixed(1) + '" r="' + r.toFixed(2) + '"/>');
      }
      out.push('<circle cx="' + x.toFixed(1) + '" cy="' + (h - 4 - row * 3.5).toFixed(1) + '" r="' + rs.toFixed(2) + '"/>');
    }
    out.push('</g></svg>');
    return out.join('');
  };

  // Tape frames of the program (after the loader) mapped back to words.
  function frames(b) {
    var bytes = b.asm.tape, s = 0;
    while (s < bytes.length && bytes[s] === 0) s++;
    return { bytes: bytes, start: s };
  }

  SW.views.tape = {
    show: function (b) {
      view.innerHTML = '';
      if (!b.asm) { view.innerHTML = '<div class="pad hint">No tape: no source survives for this version.</div>'; return; }
      var f = frames(b), total = f.bytes.length;
      var pad = SW.el('div', { class: 'pad' });
      pad.innerHTML = '<h2>' + SW.esc(b.v.label) + ': the object tape</h2>' +
        '<p class="prose">The tape the assembler punches for this build: ' + total.toLocaleString('en-GB') + ' frames, ' +
        (total / 10 / 12).toFixed(1) + ' feet at ten frames to the inch. It begins with blank leader, then the read-in loader ' +
        '(RIM mode, pairs of <code>dio</code> and data), then the program in checksummed blocks, and ends with a <code>jmp</code> to the start address. ' +
        'Each column is one frame: eight data channels, with the smaller sprocket hole between the third and fourth.</p>';
      var tb = SW.el('div', { class: 'toolbar' });
      tb.innerHTML = '<label class="check">From frame <input type="number" id="tp-from" min="0" value="' + f.start + '" style="width:7em"></label>' +
        '<label class="check">Frames <input type="number" id="tp-n" min="10" value="600" style="width:6em"></label>';
      tb.appendChild(SW.el('button', { class: 'btn', onclick: function () {
        var from = +SW.$('#tp-from').value, n = +SW.$('#tp-n').value;
        var svg = T.svg(f.bytes, from, Math.min(n, total - from), 10, 100);
        root.SWExport.download('spacewar-' + b.v.id + '-tape.svg', svg, 'image/svg+xml');
      } }, '▣ Save as SVG'));
      tb.appendChild(SW.el('button', { class: 'btn', onclick: function () {
        root.SWExport.download('spacewar-' + b.v.id + '.bin', new Uint8Array(f.bytes), 'application/octet-stream');
      } }, '⤓ Tape image (.bin)'));
      pad.appendChild(tb);
      var roll = SW.el('div', { class: 'tape-roll' });
      pad.appendChild(roll);
      function draw() {
        roll.innerHTML = '';
        var c = document.createElement('canvas');
        T.draw(c, f.bytes, { from: +SW.$('#tp-from').value, max: +SW.$('#tp-n').value, pitch: 9, height: 90 });
        roll.appendChild(c);
      }
      tb.addEventListener('change', draw);
      draw();
      var wit = b.v.witnesses || [];
      if (wit.length) {
        var w = SW.el('div', { style: 'margin-top:18px' });
        w.innerHTML = '<h3>Witness tapes</h3><p class="hint">Surviving object tapes for this version, compared word by word with what the source assembles to.</p><div id="tp-wit" class="hint">Reading tapes…</div>';
        pad.appendChild(w);
        SW.tape.witnesses(b).then(function (rows) {
          var el = SW.$('#tp-wit');
          el.innerHTML = '';
          el.appendChild(SW.table(['Tape', 'Words on tape', 'Differ', 'Only in source', 'Only on tape'], rows.map(function (r) {
            return [r.tape, r.words, r.differ, r.missing, r.extra];
          }), { cls: ['mono', 'num', 'num', 'num', 'num'] }));
        });
      }
      view.appendChild(pad);
    }
  };

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
