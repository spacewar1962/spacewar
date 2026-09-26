/*
 * reader.js - "Load tape": the PDP-1's photoelectric tape reader set running
 * on the tape chosen in the Tape view, with the machine loading it.
 *
 * What is modelled, from DEC's Programmed Data Processor-1 Manual (1961):
 *   - the reader reads 400 lines a second (p. 22); in binary it takes lines
 *     with the eighth hole, three to an 18-bit word, and passes over the rest
 *     (leader, punched titles);
 *   - Read-In mode (p. 23): the first group of three lines and every other
 *     group after it is an instruction, dio Y (the next group goes into Y)
 *     or jmp Y (Read-In ends and the computer starts at Y);
 *   - the console's register lights (p. 12): Program Counter, Instruction,
 *     Memory Address, Memory Buffer, Accumulator, In-Out; and the Run,
 *     Read In and In-Out Halt lights.
 * After Read-In the loader punched on the tape itself runs on the bench's
 * PDP-1 emulator: each "iot i 2" (rpb, read paper binary, waiting) is given
 * the next word when the reader has delivered it, and the loader's own
 * checksum test decides whether the load goes on or the machine halts.
 * A source tape is read by the assembler, which is not emulated: for it the
 * reader runs and the text is printed as read, and the console stays dark.
 */
(function (root) {
  'use strict';
  var SW = root.SW;
  var DIO = 0o320000, JMP = 0o600000, M = 0o777777;
  var W = 900, H = 620, CW = 400, HX = 450, TY = 176, PITCH = 5;
  var RATE = 400;   // lines a second (Manual, 1961, p. 22)

  // A reader: the tape and how far it has moved; words for binary reading.
  function Reader(bytes) { this.b = bytes; this.p = 0; }
  // The next binary word from frame p, and the frame its third line is on.
  Reader.prototype.peek = function () {
    var w = 0, p = this.p;
    for (var i = 0; i < 3;) {
      if (p >= this.b.length) return null;
      var c = this.b[p++];
      if (c & 0o200) { w = (w << 6) | (c & 0o77); i++; }
    }
    return { w: w, f: p - 1, next: p };
  };

  // Source tapes: how many characters have been read after each frame.
  function textIndex(bytes) {
    var d = root.SWFiodec.decode(bytes), idx = new Int32Array(bytes.length), n = 0;
    for (var i = 0; i < bytes.length; i++) {
      var x = bytes[i], c = x & 0o77;
      if (x && !(x & 0o100) && c !== 0o72 && c !== 0o74 && c !== 0o75) n++;
      idx[i] = n;
    }
    return { text: d.text, idx: idx };
  }

  // The memory-reference instructions: after them the Memory Address lights
  // show the operand's address and the Memory Buffer the operand (p. 12).
  var MRI = {};
  [0o01, 0o02, 0o03, 0o04, 0o10, 0o11, 0o12, 0o13, 0o14, 0o15, 0o16, 0o20, 0o21, 0o22, 0o23, 0o24, 0o25, 0o26, 0o27, 0o30, 0o31].forEach(function (o) { MRI[o] = 1; });

  function steel(g, x0, y0, x1, y1) {
    var gr = g.createLinearGradient(x0, y0, x1, y1);
    gr.addColorStop(0, '#d9dcdd'); gr.addColorStop(0.45, '#a9adaf'); gr.addColorStop(0.55, '#c3c6c8'); gr.addColorStop(1, '#8e9294');
    return gr;
  }

  SW.reader = {};
  SW.reader.open = function (bytes, o) {
    o = o || {};
    var an = o.an, N = bytes.length;
    var tx = o.source && root.SWFiodec ? textIndex(bytes) : null;
    var dlg = SW.el('dialog', { class: 'reader-dlg' });
    dlg.innerHTML = '<div class="rd-head"><h2>Tape Load Simulator: ' + SW.esc(o.name || 'the tape') + '</h2><button class="btn ghost" data-a="close" title="Close (Esc)">✕</button></div>' +
      '<div class="rd-body"><canvas class="rd-machine"></canvas><div class="rd-coreside"><canvas class="rd-core"></canvas><button class="btn ghost rd-divebtn" data-a="dive" title="What each stretch of core holds and why, worked out from this tape and the version’s source">What is where in core ▸</button><p class="hint rd-corecap">Hover over core to see a word.</p></div></div>' +
      (tx ? '<pre class="rd-print mono"></pre>' : '') +
      '<div class="rd-ctl"><button class="btn" data-a="play">▶ Play</button><button class="btn ghost" data-a="restart" title="Back to the start of the tape">↺</button>' +
      '<label class="check">Speed <select data-a="speed"><option value="1" selected>400 lines a second, as the PDP-1 read</option><option value="4">× 4</option><option value="16">× 16</option><option value="64">× 64</option></select></label>' +
      '<button class="btn ghost" data-a="skip" title="Read the rest of the tape at once">Skip to end ⏭</button><span class="rd-run"></span></div>' +
      '<p class="rd-status hint"></p><div class="rd-dive" hidden></div>' +
      '<p class="hint rd-note">' + (tx ? 'A source tape is read by the assembler, which the bench does not emulate: the reader runs and the text is printed as it is read; the console stays dark.'
        : 'Read-In mode loads the loader punched at the head of the tape; the loader then runs on the bench’s PDP-1 emulator, taking each word as the reader delivers it and checking each block against its checksum. Reader speed and console lights as in DEC’s PDP-1 Manual (1961).') + '</p>';
    document.body.appendChild(dlg);
    var cv = SW.$('canvas.rd-machine', dlg), g = cv.getContext('2d'), dpr = Math.min(2, root.devicePixelRatio || 1);
    cv.width = W * dpr; cv.height = H * dpr; g.scale(dpr, dpr);
    var kv = SW.$('canvas.rd-core', dlg), k = kv.getContext('2d');
    kv.width = CW * dpr; kv.height = H * dpr; k.scale(dpr, dpr);
    var corecap = SW.$('.rd-corecap', dlg);
    var status = SW.$('.rd-status', dlg), print = SW.$('.rd-print', dlg), runBox = SW.$('.rd-run', dlg);
    var pos, playing, speed = 1, last = null, raf = 0, shown;
    var cpu, rd, phase, lamps, lo, hi, outcome, chains;
    // core as it fills: 0 empty, 1 loaded, 2 loaded over an earlier word; when (frame) each was last written
    var core = new Uint8Array(4096), when = new Float64Array(4096), deposits = 0, rimAt = new Uint8Array(4096), rimWhen = new Float64Array(4096);
    function deposit(a, before, v) {
      var f = rd ? rd.p - 1 : pos;                // the frame the word's last line was read from
      if (core[a] && before !== v && f - when[a] > 30) core[a] = 2;   // (a block's first word briefly holds its dio: not counted)
      else if (!core[a]) { core[a] = 1; deposits++; }
      when[a] = f;
    }

    function reset() {
      pos = 0; playing = false; shown = -1; outcome = null; chains = [];
      core.fill(0); when.fill(0); deposits = 0; rimAt.fill(0);
      rd = new Reader(bytes);
      cpu = tx ? null : new root.PDP1CPU.PDP1({});
      if (cpu) {
        cpu.mem.fill(0);
        var wr0 = cpu.wr;
        cpu.wr = function (a, v) { var before = this.mem[a]; wr0.call(this, a, v); deposit(a, before, v & M); };
      }
      phase = tx ? 'source' : 'readin';
      lamps = { pc: null, ir: null, ma: null, mb: null, ac: null, io: null, run: false, readin: !tx, iohalt: false };
      lo = 0o7777; hi = 0;
      runBox.innerHTML = '';
      var pb = SW.$('[data-a="play"]', dlg); if (pb) pb.textContent = '▶ Play';
    }

    // Move the machine on to where the tape now is.
    function advance() {
      if (!cpu || outcome) return;
      var budget = 200000;
      while (budget-- > 0) {
        if (phase === 'readin') {
          lamps.readin = true; lamps.run = false;
          var a = rd.peek();
          if (!a) { outcome = { end: true, text: 'The tape ran out in Read-In mode.' }; return; }
          if (a.f > pos) return;                       // the reader has not got there yet
          if ((a.w & 0o760000) === JMP) {             // Read-In ends: start at Y
            rd.p = a.next; lamps.mb = a.w; lamps.io = a.w;
            cpu.pc = a.w & 0o7777; phase = 'run';
            lamps.readin = false; lamps.run = true; lamps.pc = cpu.pc;
            continue;
          }
          if ((a.w & 0o760000) !== DIO) { outcome = { end: true, text: 'Read-In mode stopped: ' + SW.oct(a.w) + ' is neither dio nor jmp.' }; return; }
          // the dio and its word go together: take neither until the word has been read
          var at = rd.p; rd.p = a.next;
          var v = rd.peek();
          rd.p = at;
          if (!v) { outcome = { end: true, text: 'The tape ran out in Read-In mode.' }; return; }
          if (v.f > pos) return;
          rd.p = v.next;
          var y = a.w & 0o7777;
          deposit(y, cpu.mem[y], v.w); rimAt[y] = 1; rimWhen[y] = rd.p - 1;
          cpu.mem[y] = v.w; lo = Math.min(lo, y); hi = Math.max(hi, y);
          lamps.ma = y; lamps.mb = v.w; lamps.io = v.w;
          continue;
        }
        // running: the loader (or, once it jumps out, the program)
        if (cpu.pc < lo || cpu.pc > hi) {
          outcome = { loaded: true, text: 'The loader has read a jmp ' + SW.oct(cpu.pc, 4) + ' and the machine now runs from ' + SW.oct(cpu.pc, 4) + '.' };
          lamps.pc = cpu.pc; lamps.run = true; lamps.iohalt = false;
          return;
        }
        var pc0 = cpu.pc, md = cpu.mem[pc0], op = md >> 13;
        if (op === 0o35 && (md & 0o77) === 2) {       // rpb: read paper binary
          var r = rd.peek();
          lamps.pc = (pc0 + 1) & 0o7777; lamps.ir = op; lamps.ma = pc0; lamps.mb = md;
          if (!r) { outcome = { end: true, waiting: true, text: 'The tape has run out with the loader waiting for another word (In-Out Halt): there is no jump to a start address at its end.' }; lamps.iohalt = true; return; }
          if (r.f > pos) { lamps.iohalt = !!(md & 0o10000); return; }   // waiting on the reader
          rd.p = r.next; cpu.io = r.w; cpu.pc = (pc0 + 1) & 0o7777;
          lamps.iohalt = false; lamps.io = cpu.io;
          continue;
        }
        var y2 = md & 0o7777;
        if (MRI[op] && (md & 0o10000)) y2 = cpu.mem[y2] & 0o7777;
        cpu.step();
        // a block whose first word is a jmp back into the loader: it starts again and reads on
        if (op === 0o04 && (cpu.mem[y2] >> 13) === 0o30 && cpu.pc >= lo && cpu.pc <= hi) chains.push({ f: rd.p - 1, to: cpu.pc });
        lamps.pc = cpu.pc; lamps.ir = op; lamps.ac = cpu.ac; lamps.io = cpu.io;
        if (MRI[op]) { lamps.ma = y2; lamps.mb = cpu.mem[y2]; } else { lamps.ma = pc0; lamps.mb = md; }
        if (cpu.halted) {
          var sg = segAt(rd.p - 1);
          lamps.run = false;
          outcome = { halted: true, text: 'The machine halted at ' + SW.oct(pc0, 4) + ' (hlt): the loader’s sum of the block ' + (sg ? sg.label + ' ' : '') + 'does not match the checksum punched after it, so the load stops here.' };
          return;
        }
      }
    }
    // Core against the version's build, once the load is over.
    function coreCheck() {
      if (!cpu || !o.buildMem) return { text: '', same: false };
      var n = 0, diff = [];
      for (var k in o.buildMem) {
        n++;
        var w = o.buildMem[k], v = (typeof w === 'object' ? w.val : w) & M;
        if (cpu.mem[+k] !== v) diff.push(+k);
      }
      if (!diff.length) return { same: true, text: ' Core now holds the ' + n.toLocaleString('en-GB') + ' words of ' + (o.label || 'this version') + '’s build exactly.' };
      diff.sort(function (a, b) { return a - b; });
      return { same: false, text: ' Core now differs from ' + (o.label || 'this version') + '’s build in ' + diff.length.toLocaleString('en-GB') + ' of its ' + n.toLocaleString('en-GB') + ' words (' + SW.oct(diff[0], 4) + (diff.length > 1 ? '–' + SW.oct(diff[diff.length - 1], 4) : '') + ').' };
    }
    function segAt(f) { return an && an.segs.filter(function (s) { return s.f0 <= f && f <= s.f1; })[0]; }

    function lamp(x, y, on, dim) {
      g.beginPath(); g.arc(x, y, 7, 0, 6.2832);
      g.fillStyle = on ? '#ffe9a8' : dim ? '#6c7577' : '#8a918f';
      if (on) { g.shadowColor = '#ffd76a'; g.shadowBlur = 12; }
      g.fill(); g.shadowBlur = 0;
      g.strokeStyle = '#1d3550'; g.lineWidth = 1; g.stroke();
    }
    function lampRow(x0, y, label, bits, val) {
      g.fillStyle = '#e8eef3'; g.font = '10px Helvetica, Arial, sans-serif'; g.textAlign = 'left';
      g.fillText(label, x0, y - 13);
      for (var i = 0; i < bits; i++) {
        var x = x0 + 9 + i * 19 + Math.floor(i / 3) * 5;
        lamp(x, y, val != null && ((val >> (bits - 1 - i)) & 1));
      }
    }
    function loops(cx, cy, frac, side) {
      var n = frac > 0.001 ? Math.max(1, Math.round(frac * 9)) : 0;
      g.strokeStyle = '#d7b24a'; g.lineWidth = 2.2;
      for (var i = 0; i < n; i++) {
        g.beginPath(); g.ellipse(cx + side * i * 1.5, cy + 8 - i * 1.2, 58 + (i % 3) * 5, 44 + i * 3.2, 0, 0, 6.2832); g.stroke();
      }
      if (n) { g.beginPath(); g.moveTo(cx + side * 40, cy - 30); g.quadraticCurveTo(cx + side * 90, TY - 10, cx + side * 150, TY); g.stroke(); }
    }
    function bin(x, flip) {
      g.save(); g.translate(x, 0); if (flip) { g.translate(200, 0); g.scale(-1, 1); }
      g.fillStyle = steel(g, 0, 110, 200, 330);
      g.beginPath(); g.moveTo(0, 120); g.lineTo(150, 120); g.lineTo(196, 190); g.lineTo(150, 170); g.lineTo(40, 170); g.lineTo(30, 250); g.lineTo(160, 262); g.lineTo(170, 320); g.lineTo(0, 320); g.closePath(); g.fill();
      g.strokeStyle = '#6d7275'; g.lineWidth = 1; g.stroke();
      g.restore();
    }
    function roller(x, y, r, ang) {
      var gr = g.createRadialGradient(x - r / 3, y - r / 3, 1, x, y, r);
      gr.addColorStop(0, '#f2f3f3'); gr.addColorStop(1, '#8c9193');
      g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 6.2832); g.fill();
      g.strokeStyle = '#5d6264'; g.lineWidth = 1; g.stroke();
      g.strokeStyle = 'rgba(60,64,66,0.55)'; g.lineWidth = 1.5;
      for (var k = 0; k < 3; k++) { var a = ang + k * 2.094; g.beginPath(); g.moveTo(x + Math.cos(a) * r * 0.25, y + Math.sin(a) * r * 0.25); g.lineTo(x + Math.cos(a) * r * 0.8, y + Math.sin(a) * r * 0.8); g.stroke(); }
    }
    function draw() {
      var f = Math.min(N - 1, Math.floor(pos)), moving = playing && pos < N && !(outcome && outcome.halted);
      g.fillStyle = '#d6d9d2'; g.fillRect(0, 0, W, H);
      g.fillStyle = '#c3c7bf'; g.fillRect(0, 96, W, 3); g.fillRect(0, 338, W, 3);
      // fold bins: the tape feeds from the right-hand bin and folds into the left
      bin(30, false); bin(670, true);
      loops(130, 222, pos / N, 1); loops(770, 222, 1 - pos / N, -1);
      g.fillStyle = steel(g, 250, 180, 650, 330); g.fillRect(232, 186, 436, 140);
      g.strokeStyle = '#6d7275'; g.strokeRect(232, 186, 436, 140);
      g.fillStyle = '#9ea3a5'; g.fillRect(232, TY + 14, 436, 5);
      var ang = pos * PITCH / 18;
      roller(290, 150, 26, -ang); roller(352, TY - 14, 11, -ang * 2); roller(548, TY - 14, 11, -ang * 2);
      g.fillStyle = steel(g, 590, 140, 640, 160); g.fillRect(588, 146, 50, 22);
      // the tape, its own frames passing under the head
      var tw = 30, ty0 = TY - tw / 2, row = (tw - 4) / 9;
      g.fillStyle = '#e7c965'; g.fillRect(180, ty0, 540, tw);
      for (var x = 180; x < 720; x += PITCH) {
        var fi = Math.floor(pos + (x - HX) / PITCH);
        if (fi < 0 || fi >= N) continue;
        var b = bytes[fi], xx = HX + (fi - pos) * PITCH;
        g.fillStyle = '#3b3322';
        for (var ch = 0; ch < 8; ch++) {
          if (!((b >> ch) & 1)) continue;
          g.beginPath(); g.arc(xx, ty0 + 2 + row * ((ch < 3 ? ch : ch + 1) + 0.5), 1.35, 0, 6.2832); g.fill();
        }
        g.beginPath(); g.arc(xx, ty0 + 2 + row * 3.5, 0.7, 0, 6.2832); g.fill();
      }
      // the read head, its lamp showing through the holes
      var holes = 0, cb = bytes[f] || 0;
      for (var k = 0; k < 8; k++) holes += (cb >> k) & 1;
      var glow = moving ? 0.35 + holes * 0.08 : 0.15;
      var lg = g.createRadialGradient(HX, TY + 22, 2, HX, TY + 22, 60);
      lg.addColorStop(0, 'rgba(255,214,120,' + glow + ')'); lg.addColorStop(1, 'rgba(255,214,120,0)');
      g.fillStyle = lg; g.fillRect(HX - 70, TY - 20, 140, 90);
      g.fillStyle = steel(g, 405, 100, 495, 170); g.fillRect(404, 98, 92, 64);
      g.fillStyle = '#20262b'; g.fillRect(414, 106, 72, 48);
      g.fillStyle = 'rgba(255,255,255,0.08)'; g.fillRect(416, 108, 30, 20);
      g.fillStyle = 'rgba(255,220,140,' + (glow * 0.9) + ')'; g.fillRect(HX - 3, ty0 - 2, 6, tw + 4);
      // the console's lights (Manual, p. 12)
      g.fillStyle = '#3f6e98'; g.fillRect(30, 360, W - 60, 250);
      g.strokeStyle = '#2b5075'; g.strokeRect(30, 360, W - 60, 250);
      var L = cpu ? lamps : {};
      lampRow(50, 400, 'PROGRAM COUNTER', 12, L.pc);
      lampRow(50, 468, 'INSTRUCTION', 5, L.ir);
      lampRow(50, 536, 'MEMORY ADDRESS', 12, L.ma);
      lampRow(340, 400, 'MEMORY BUFFER', 18, L.mb);
      lampRow(340, 468, 'ACCUMULATOR', 18, L.ac);
      lampRow(340, 536, 'IN-OUT', 18, L.io);
      [['RUN', L.run], ['READ IN', L.readin && moving && !outcome], ['IN-OUT HALT', L.iohalt && moving && !outcome]].forEach(function (l, i) {
        var y = 400 + i * 34;
        lamp(752, y, !!l[1]);
        g.fillStyle = '#e8eef3'; g.font = '10px Helvetica, Arial, sans-serif'; g.textAlign = 'left'; g.fillText(l[0], 766, y + 4);
      });
    }
    // Core: 4,096 words, 64 to a row, 0000 at the top left; a row of eight is 1000 octal.
    var CX = 52, CY = 44, CS = 5;
    function drawCore() {
      k.fillStyle = '#16202a'; k.fillRect(0, 0, CW, H);
      k.fillStyle = '#e8eef3'; k.font = '11px Helvetica, Arial, sans-serif'; k.textAlign = 'left';
      k.fillText('CORE MEMORY · 4,096 WORDS', CX, 22);
      k.fillStyle = '#9fb1c1'; k.font = '10px ' + (SW.cssVar('--mono') || 'monospace'); k.textAlign = 'right';
      for (var r = 0; r < 64; r += 8) k.fillText(SW.oct(r * 64, 4), CX - 6, CY + r * CS + 8);
      var fresh = Math.max(40, 400 * speed * 0.25);
      for (var a = 0; a < 4096; a++) {
        var c = core[a], x = CX + (a & 63) * CS, y = CY + (a >> 6) * CS;
        k.fillStyle = !c ? '#223140' : pos - when[a] < fresh ? '#ffd76a' : an && an.kind === 'blocks' && a >= lo && lo <= hi ? '#a58ad8' : c === 2 ? '#e07a5f' : '#6fb3d9';
        k.fillRect(x, y, CS - 1, CS - 1);
      }
      var ly = CY + 64 * CS + 26;
      [['#6fb3d9', 'loaded'], ['#ffd76a', 'just loaded'], ['#e07a5f', 'loaded over an earlier word'], ['#a58ad8', 'the loader and its working words'], ['#223140', 'empty']].forEach(function (l, i) {
        k.fillStyle = l[0]; k.fillRect(CX, ly + i * 18 - 8, 9, 9);
        k.fillStyle = '#c9d6e2'; k.font = '11px Helvetica, Arial, sans-serif'; k.textAlign = 'left'; k.fillText(l[1], CX + 16, ly + i * 18);
      });
      k.fillStyle = '#e8eef3'; k.font = '12px Helvetica, Arial, sans-serif';
      k.fillText(cpu ? deposits.toLocaleString('en-GB') + ' words in core' : 'A source tape is not loaded into core', CX, ly + 5 * 18 + 10);
    }
    kv.addEventListener('mousemove', function (e) {
      var r = kv.getBoundingClientRect(), sx = CW / r.width, x = (e.clientX - r.left) * sx - CX, y = (e.clientY - r.top) * sx - CY;
      if (x < 0 || y < 0 || x >= 64 * CS || y >= 64 * CS || !cpu) { corecap.textContent = 'Hover over core to see a word.'; return; }
      var a = (Math.floor(y / CS) << 6) | Math.floor(x / CS), w = cpu.mem[a];
      corecap.textContent = SW.oct(a, 4) + ': ' + (core[a] ? SW.oct(w) + '  ' + root.PDP1CPU.disasm(w, o.symAt) + (o.symAt && o.symAt(a) ? '  (' + o.symAt(a) + ' in the build)' : '') + ' · written at frame ' + Math.round(when[a]).toLocaleString('en-GB') + (core[a] === 2 ? ', over an earlier word' : '') : 'empty');
    });

    // ---------- what is where in core ----------
    // Core walked in address order, in stretches: loaded by the tape (and from
    // which source lines), loaded twice, the loader, or left empty (and the
    // source lines and symbols that account for the gap).
    function deepDive(box) {
      var B = o.build;
      box.innerHTML = '';
      if (!cpu) { box.innerHTML = '<p class="hint">A source tape is read by the assembler, not loaded into core, so there is no core to describe.</p>'; return; }
      var kinds = new Array(4096), loaderLo = an && an.kind === 'blocks' ? lo : 4096;
      for (var a = 0; a < 4096; a++) kinds[a] = a >= loaderLo && (core[a] || rimAt[a]) ? 'loader' : core[a] === 2 ? 'twice' : core[a] ? 'loaded' : 'empty';
      var runs = [], r0 = 0;
      for (a = 1; a <= 4096; a++) if (a === 4096 || kinds[a] !== kinds[r0]) { runs.push({ a0: r0, a1: a - 1, kind: kinds[r0] }); r0 = a; }
      function line(pn) { return B && pn ? B.lines[pn.p][pn.n - 1] : null; }
      function code(t) { return '<code>' + SW.esc(String(t).replace(/\s+$/, '')) + '</code>'; }
      var syms = B ? Object.keys(B.sym).map(function (k) { return { name: k, s: B.sym[k] }; }).filter(function (x) { return x.s && x.s.defined !== false && (x.s.variable || (x.s.defs && x.s.defs.length)); }) : [];
      // A label names its address only if its own line puts a word there, or puts no word
      // anywhere (p, mtb: labels on reserved space); labels written relative to R
      // (the outline compiler's fuu, flo) carry offsets, not addresses.
      function placed(x) {
        if (!x.s.label) return true;
        var d = x.s.defs && x.s.defs[0];
        if (!d || !B.asm.byLine || !B.asm.byLine[d.file]) return true;
        var ws = B.asm.byLine[d.file][d.line];
        return !ws || !ws.length || ws.some(function (w) { return w.loc === x.s.val; });
      }
      function symsIn(a0, a1) { return syms.filter(function (x) { return x.s.val >= a0 && x.s.val <= a1 && placed(x); }).sort(function (x, y) { return x.s.val - y.s.val; }); }
      function defComment(x) {
        var d = x.s.defs && x.s.defs[0], L = d && B.lines[d.file] && B.lines[d.file][d.line - 1];
        var m = L && /(^|\s)\/\s*(.+)$/.exec(L.raw);   // a comment's slash follows a space; '. 200/' is not one
        return m ? m[2].trim() : '';
      }
      // the source's own lines between two words, non-blank, as written
      function linesBetween(pa, pb) {
        var out = [];
        if (!B || !pa) return out;
        var ls = B.lines[pa.p], end = pb && pb.p === pa.p ? pb.n - 1 : ls.length;
        for (var n = pa.n + 1; n <= end && out.length < 8; n++) { var t = (ls[n - 1].raw || '').trim(); if (t && !/^\/?$/.test(t)) out.push(t); }
        return out;
      }
      var GLOSS = [
        [/^\.\s*\d+\//, '<code>. n/</code> moves the location on by n words (octal) without putting anything in them, so the tape carries nothing there.'],
        [/^variables\b/, '<code>variables</code> gives each overlined variable a word here; the tape carries no values for them.'],
        [/^constants\b/, '<code>constants</code> puts the program’s literal constants here.'],
        [/^start\b/, '<code>start</code> ends the source and names the starting address.'],
        [/^[a-z0-9]+,\s*\.\s*\d+\//, 'A label followed by <code>. n/</code> names the first of n words left free.']
      ];
      var used = {};
      var loaderSeg = an && an.segs.filter(function (q) { return q.kind === 'loader'; })[0];
      runs.forEach(function (r) {
        if (r.kind === 'empty') return;
        r.f0 = Infinity; r.f1 = -1;
        for (var z = r.a0; z <= r.a1; z++) { var fz = rimAt[z] ? rimWhen[z] : when[z]; r.f0 = Math.min(r.f0, fz); r.f1 = Math.max(r.f1, fz); }
        if (r.kind === 'loader' && loaderSeg) { r.f0 = loaderSeg.f0; r.f1 = loaderSeg.f1; }
      });
      var rows = runs.map(function (r) {
        var n = r.a1 - r.a0 + 1, what = '', from = '';
        var range = SW.oct(r.a0, 4) + (n > 1 ? '–' + SW.oct(r.a1, 4) : '');
        if (r.kind === 'loader') {
          var rim = 0, work = [], rf0 = Infinity, rf1 = -1;
          for (var x = r.a0; x <= r.a1; x++) { if (rimAt[x]) { rim++; rf0 = Math.min(rf0, rimWhen[x]); rf1 = Math.max(rf1, rimWhen[x]); } else work.push(SW.oct(x, 4)); }
          var ls0 = an && an.segs.filter(function (q) { return q.kind === 'loader'; })[0];
          if (ls0) { rf0 = ls0.f0; rf1 = ls0.f1; }
          what = 'The loader. It is first on the tape (frames ' + Math.round(rf0).toLocaleString('en-GB') + '–' + Math.round(rf1).toLocaleString('en-GB') + ', after the leader) but goes to the top of core: each of its ' + rim + ' words is punched after a dio naming its address, and Read-In mode puts it there, above everything the program loads' + (work.length ? '. ' + work.join(' and ') + ' are the words it works in (the running sum and the end address of each block)' : '') + '.';
        } else if (r.kind === 'empty') {
          if (r.a0 === 0 && r.a1 >= 2) {
            what = 'Not on the tape. A sequence break stores the Accumulator in 0000, the Program Counter in 0001 and the In-Out register in 0002, then restarts the program at 0003 (DEC, PDP-1 Handbook, 1963, pp. 25–26)' + (r.a1 > 2 ? '; the rest is left empty too' : '') + '.';
            var L3 = line(B && B.srcOf(3));
            if (L3) from = code(L3.raw.trim()) + ' (line ' + B.srcOf(3).n + ', at 0003)';
          } else {
            what = 'Not on the tape' + (r.a1 === 4095 ? ', to the top of core' : '') + '.';
            var before = B && B.srcOf(r.a0 - 1), after = B && B.srcOf(r.a1 + 1), ls = linesBetween(before, after);
            if (ls.length) from = 'The source after the word at ' + SW.oct(r.a0 - 1, 4) + ': ' + ls.map(code).join(' ');
            ls.forEach(function (t) { GLOSS.forEach(function (gl, i) { if (gl[0].test(t)) used[i] = 1; }); });
            // labels and variables here; an assignment only after a label in the same stretch (nx1=mtb nob), since otherwise its value may be a plain number
            var ss = symsIn(r.a0, r.a1), vars = ss.filter(function (x) { return x.s.variable; }), labs = ss.filter(function (x) { return x.s.label; });
            var firstLab = labs.length ? labs[0].s.val : 4096;
            var named = ss.filter(function (x) { return !x.s.variable && (x.s.label || x.s.val >= firstLab); });
            var bits = [];
            if (vars.length) bits.push(vars.length + ' variable' + (vars.length > 1 ? 's' : '') + ' at ' + SW.oct(vars[0].s.val, 4) + (vars.length > 1 ? '–' + SW.oct(vars[vars.length - 1].s.val, 4) : '') + ' (filled as the program runs)');
            named.slice(0, 8).forEach(function (x) { var c = defComment(x); bits.push(x.name + ' = ' + SW.oct(x.s.val, 4) + (c ? ' “' + c + '”' : '')); });
            if (named.length > 8) bits.push('and ' + (named.length - 8) + ' more names');
            if (bits.length) what += ' Named here: ' + bits.join('; ') + '.';
            else if (r.a0 > 0 && r.a1 < 4095) what += ' No name in the source falls in this stretch.';
          }
        } else {
          var fa = B && B.srcOf(r.a0), fb = B && B.srcOf(r.a1), same = 0, total = 0;
          if (o.buildMem) for (var y = r.a0; y <= r.a1; y++) if (o.buildMem[y] != null) { total++; var bw = o.buildMem[y]; if (cpu.mem[y] === ((typeof bw === 'object' ? bw.val : bw) & M)) same++; }
          var ss2 = symsIn(r.a0, r.a1).filter(function (x) { return x.s.label; }).map(function (x) { return x.name; });
          var f0 = Infinity, f1 = -1;
          for (var z = r.a0; z <= r.a1; z++) { f0 = Math.min(f0, when[z]); f1 = Math.max(f1, when[z]); }
          var frames = 'frames ' + Math.round(f0).toLocaleString('en-GB') + '–' + Math.round(f1).toLocaleString('en-GB');
          what = (r.kind === 'twice' ? 'Loaded twice: words read later in the tape (' + frames + ') replaced what an earlier part had put here. ' : 'Loaded from the tape, ' + frames + '. ') +
            (total ? (same === n ? 'Every word as in the build.' : same + ' of ' + n + ' words as in the build.') : 'The build has nothing here.') +
            (ss2.length ? ' Labels: ' + ss2.slice(0, 8).join(', ') + (ss2.length > 8 ? ' and ' + (ss2.length - 8) + ' more' : '') + '.' : '');
          if (fa && fb && total) {
            var part = B.parts[fa.p], org = '';
            for (var k = fa.n - 1; k >= Math.max(1, fa.n - 6); k--) { var t = (B.lines[fa.p][k - 1].raw || '').trim(); if (/^[0-7]+\//.test(t)) { org = t; break; } }
            var only = fb.p === fa.p && fb.n === fa.n ? (B.lines[fa.p][fa.n - 1].raw || '').trim() : '';
            if (/^constants\b/.test(only)) { from = 'The program’s literal constants, gathered and placed by ' + code(only) + ' (' + SW.esc(part.src.split('/').pop()) + ', line ' + fa.n + ').'; used[2] = 1; }
            else from = (r.kind === 'twice' ? 'What the build has here (not what is here now): ' : '') + SW.esc(part.src.split('/').pop()) + ', lines ' + fa.n + (fb.p === fa.p ? '–' + fb.n : ' onwards') + (org ? '; the origin line ' + code(org) + ' puts it at ' + SW.oct(r.a0, 4) : '');
          }
        }
        var fr = r.kind === 'empty' ? '' : Math.round(r.f0).toLocaleString('en-GB') + '–' + Math.round(r.f1).toLocaleString('en-GB');
        var row = [{ html: '<span class="mono">' + range + '</span>', text: range, sort: r.a0 }, { html: fr || '<span class="faint">not on the tape</span>', text: fr || 'not on the tape', sort: r.kind === 'empty' ? 1e9 + r.a0 : r.f0 }, n, { html: SW.esc(r.kind === 'loaded' ? 'loaded' : r.kind === 'twice' ? 'loaded twice' : r.kind === 'loader' ? 'the loader' : 'empty'), text: r.kind }, { html: what, text: what }, { html: from, text: from.replace(/<[^>]+>/g, '') }];
        row.f0 = r.kind === 'empty' ? 1e9 + r.a0 : r.f0; row.a0 = r.a0;
        return row;
      });
      // by address in core, or in the order the tape was read (stretches not on the tape last)
      var order = SW.store.get('reader.order', 'tape');
      function ordered() { return rows.slice().sort(function (x, y) { return order === 'tape' ? x.f0 - y.f0 : x.a0 - y.a0; }); }
      var HEAD = ['Addresses', 'Frames on the tape', 'Words', 'Kind', 'What it is', 'From the source'];
      box.appendChild(SW.el('h3', {}, 'What is where in core'));
      box.appendChild(SW.el('p', { class: 'hint' }, 'Worked out from this tape as loaded (' + deposits.toLocaleString('en-GB') + ' words so far) and from ' + SW.esc(o.label || 'the version') + '’s source: each stretch of core, what put it there, or why nothing did. Where a stretch sits on the tape and where it goes in core are different things: the loader is read first but goes to the top of core.'));
      var ob = SW.el('label', { class: 'check' }, 'Order <select><option value="tape">as read from the tape</option><option value="core">by address in core</option></select>');
      var osel = SW.$('select', ob); osel.value = order;
      box.appendChild(ob);
      var holder = SW.el('div');
      box.appendChild(holder);
      function paint() { holder.innerHTML = ''; holder.appendChild(SW.table(HEAD, ordered(), { cls: ['mono', 'num', 'num', '', '', ''] })); }
      osel.onchange = function () { order = osel.value; SW.store.set('reader.order', order); paint(); };
      paint();
      var gl = Object.keys(used).map(function (i) { return '<li>' + GLOSS[i][1] + '</li>'; }).join('');
      if (gl) box.appendChild(SW.el('ul', { class: 'hint rd-gloss' }, gl));
      box.appendChild(SW.exportButtons(function () {
        return { title: 'What is where in core: ' + (o.name || 'tape'), meta: B ? SW.docMeta(B) : null, blocks: [SW.tableBlock('Core after loading ' + (o.name || 'the tape') + (order === 'tape' ? ', in the order read' : ', by address'), HEAD, ordered())] };
      }, (o.name || 'tape') + '-core'));
    }

    function update() {
      advance();
      var f = Math.min(N - 1, Math.floor(pos));
      if (print && tx && f !== shown) {
        shown = f;
        print.textContent = tx.text.slice(0, tx.idx[f]).split(/\n/).slice(-6).join('\n').replace(/\f/g, '↡');
      }
      var sg = segAt(f);
      status.textContent = outcome ? outcome.text + (pos < N && !outcome.halted ? ' The rest of the tape (' + Math.round(N - pos).toLocaleString('en-GB') + ' frames) runs out through the reader here; on the machine the reader stops once the loader stops asking for words.' : '') :
        'Frame ' + f.toLocaleString('en-GB') + ' of ' + N.toLocaleString('en-GB') + (sg ? ' · ' + sg.label : '') +
        (cpu ? ' · ' + (phase === 'readin' ? 'Read-In mode' : lamps.iohalt ? 'the loader waits for the reader' : 'the loader running') : '') +
        ' · ' + ((N - pos) / RATE).toFixed(1) + ' s of tape left at 400 lines a second';
      if ((pos >= N || (outcome && outcome.halted)) && !(outcome && outcome.checked) && (playing || pos >= N)) {
        if (!outcome) outcome = { end: true, text: tx ? 'The whole tape has been read: ' + tx.text.length.toLocaleString('en-GB') + ' characters of source.' : 'The tape has run through.' };
        if (!outcome.checked) {
          outcome.checked = true;
          if (chains.length) outcome.text = chains.map(function (c) { return 'At frame ' + c.f.toLocaleString('en-GB') + ' a jmp ' + SW.oct(c.to, 4) + ' sent the machine back into the loader, which read on.'; }).join(' ') + ' ' + outcome.text;
          var cc = outcome.halted ? { text: '', same: false } : coreCheck();
          outcome.text += cc.text;
          outcome.same = cc.same;
        }
        status.textContent = outcome.text;
        playing = false;
        SW.$('[data-a="play"]', dlg).textContent = '▶ Play';
        drawCore();
        if ((outcome.loaded || outcome.waiting) && outcome.same && o.onRun && !runBox.firstChild) runBox.appendChild(SW.el('button', { class: 'btn', title: 'Go to the Run view, where this version is run on the emulator', onclick: function () { close(); o.onRun(); } }, '▶ Run this version'));
      }
    }
    function tick(t) {
      if (last != null && playing) pos = Math.min(N, pos + (t - last) / 1000 * RATE * speed);
      last = t;
      update(); draw(); drawCore();
      raf = requestAnimationFrame(tick);
    }
    function close() { cancelAnimationFrame(raf); if (dlg.open) dlg.close(); dlg.remove(); }
    dlg.addEventListener('close', function () { cancelAnimationFrame(raf); dlg.remove(); });
    dlg.addEventListener('click', function (e) {
      var b = e.target.closest('[data-a]');
      if (!b) return;
      var a = b.dataset.a;
      if (a === 'close') close();
      else if (a === 'play') {
        if (outcome && outcome.checked) { reset(); playing = true; } else playing = !playing;
        b.textContent = playing ? '❚❚ Pause' : '▶ Play';
      } else if (a === 'restart') reset();
      else if (a === 'skip' && !(outcome && outcome.checked)) { playing = true; pos = N; }
      else if (a === 'dive') {
        var box = SW.$('.rd-dive', dlg);
        box.hidden = !box.hidden;
        b.textContent = box.hidden ? 'What is where in core ▸' : 'What is where in core ▾';
        if (!box.hidden) { deepDive(box); box.scrollIntoView({ block: 'nearest' }); }
      }
    });
    SW.$('[data-a="speed"]', dlg).onchange = function (e) { speed = +e.target.value; };
    dlg.addEventListener('keydown', function (e) {
      if (e.key === ' ' && e.target.tagName !== 'SELECT') { e.preventDefault(); SW.$('[data-a="play"]', dlg).click(); }
    });
    // Move on by some seconds of reading and draw (for testing without animation frames).
    dlg.advance = function (sec) { pos = Math.min(N, pos + sec * RATE * speed); update(); draw(); drawCore(); };
    reset();
    dlg.showModal();
    raf = requestAnimationFrame(tick);
  };
})(this);
