/*
 * pdp1cpu.js - a PDP-1 for close reading.
 *
 * Instruction semantics follow the project's existing emulator (spacewar.js,
 * after Silverman & Gerasimov) and, for the optional automatic multiply and
 * divide, simh's pdp1_cpu.c (Bob Supnik). The 1962 programs use the step
 * instructions mus/dis; the 1963 "4.x" line assumes the hardware option,
 * which shares their opcodes. Which one a build gets is a machine setting,
 * chosen from the source's own mnemonics.
 *
 * Timing is by memory cycle (5 microseconds). Instruction costs follow the
 * PDP-1 handbook (F-15D) in round numbers; multiply, divide and the display
 * wait are approximations, noted as such in the tool.
 *
 * For research it records how often each word is executed, read and
 * written, which instruction last wrote each word, and a rolling trace.
 */
(function (root) {
  'use strict';

  var M = 0o777777, SIGN = 0o400000;

  var MRI = ['', 'and', 'ior', 'xor', 'xct', '', '', 'jda', 'lac', 'lio', 'dac', 'dap', 'dip',
             'dio', 'dzm', '', 'add', 'sub', 'idx', 'isp', 'sad', 'sas', 'mul', 'div', 'jmp',
             'jsp', 'skp', 'sft', 'law', 'iot', '', 'opr'];

  function PDP1(opts) {
    opts = opts || {};
    this.mdv = !!opts.mdv;
    this.strictOps = !!opts.strictOps;
    this.mem = new Int32Array(4096);
    this.execCount = new Uint32Array(4096);
    this.readCount = new Uint32Array(4096);
    this.writeCount = new Uint32Array(4096);
    this.lastWriter = new Int32Array(4096).fill(-1);
    this.trace = [];
    this.traceMax = opts.traceMax || 4000;
    this.tracing = false;
    this.breakpoints = {};
    this.onDisplay = null;
    this.sense = [false, false, false, false, false, false, false];
    this.tw = 0;           // console test word
    this.control = 0;      // iot 11 control boxes
    this.reset();
  }

  PDP1.prototype.reset = function () {
    this.ac = 0; this.io = 0; this.pc = 4; this.ov = 0;
    this.flag = [false, false, false, false, false, false, false];
    this.halted = false;
    this.cycles = 0;
    this.instructions = 0;
    this.lastPC = 4;
    this.mb = 0;
    this.execCount.fill(0); this.readCount.fill(0); this.writeCount.fill(0);
    this.lastWriter.fill(-1);
    this.trace = [];
    this.anomalies = [];
    this.fault = null;
  };

  PDP1.prototype.load = function (memory, start) {
    this.mem.fill(0);
    for (var k in memory) {
      var w = memory[k];
      this.mem[+k & 0o7777] = (typeof w === 'object' ? w.val : w) & M;
    }
    this.reset();
    this.pc = start == null ? 4 : start;
    this.start = this.pc;
  };

  PDP1.prototype.rd = function (a) { this.readCount[a]++; return this.mem[a]; };
  PDP1.prototype.wr = function (a, v) {
    this.writeCount[a]++;
    this.lastWriter[a] = this.curPC;
    this.mem[a] = v & M;
  };

  // one's complement helpers
  function abs(x) { return (x & SIGN) ? x ^ M : x; }
  function add1(a, b) {
    var s = a + b;
    if (s > M) s = (s + 1) & M;
    return s;
  }

  // Execute one instruction. Returns the number of memory cycles used.
  PDP1.prototype.step = function () {
    if (this.halted) return 0;
    var pc0 = this.pc;
    this.curPC = pc0;
    this.lastPC = pc0;
    this.execCount[pc0]++;
    var md = this.mem[pc0];
    this.pc = (this.pc + 1) & 0o7777;
    var before = this.tracing ? { ac: this.ac, io: this.io } : null;
    var c = this.dispatch(md, 1);
    this.cycles += c;
    this.instructions++;
    if (this.tracing) {
      this.trace.push({ pc: pc0, md: md, ac: this.ac, io: this.io, ov: this.ov,
                        acBefore: before.ac, ioBefore: before.io, t: this.cycles });
      if (this.trace.length > this.traceMax) this.trace.shift();
    }
    return c;
  };

  PDP1.prototype.ea = function (y, ib) {
    var extra = 0;
    while (ib) {
      var w = this.rd(y);
      ib = (w >> 12) & 1;
      y = w & 0o7777;
      extra++;
      if (extra > 64) break;
    }
    this.eaExtra = extra;
    return y;
  };

  PDP1.prototype.dispatch = function (md, depth) {
    var op = md >> 13, ib = (md >> 12) & 1, y = md & 0o7777, t, v, i, sign;
    var cyc = 1;
    switch (op) {
      case 0o01: y = this.ea(y, ib); this.ac &= this.rd(y); cyc = 2; break;
      case 0o02: y = this.ea(y, ib); this.ac |= this.rd(y); cyc = 2; break;
      case 0o03: y = this.ea(y, ib); this.ac ^= this.rd(y); cyc = 2; break;
      case 0o04:
        y = this.ea(y, ib);
        this.execCount[y]++;
        cyc = 1 + (depth < 32 ? this.dispatch(this.rd(y), depth + 1) : 0);
        break;
      case 0o07: // cal / jda
        t = ib ? y : 0o100;
        this.wr(t, this.ac);
        this.ac = (this.ov << 17) | this.pc;
        this.pc = (t + 1) & 0o7777;
        cyc = 2;
        break;
      case 0o10: y = this.ea(y, ib); this.ac = this.rd(y); cyc = 2; break;
      case 0o11: y = this.ea(y, ib); this.io = this.rd(y); cyc = 2; break;
      case 0o12: y = this.ea(y, ib); this.wr(y, this.ac); cyc = 2; break;
      case 0o13: y = this.ea(y, ib); this.wr(y, (this.rd(y) & 0o770000) | (this.ac & 0o7777)); cyc = 2; break;
      case 0o14: y = this.ea(y, ib); this.wr(y, (this.rd(y) & 0o7777) | (this.ac & 0o770000)); cyc = 2; break;
      case 0o15: y = this.ea(y, ib); this.wr(y, this.io); cyc = 2; break;
      case 0o16: y = this.ea(y, ib); this.wr(y, 0); cyc = 2; break;
      case 0o20:
        y = this.ea(y, ib); v = this.rd(y);
        t = this.ac + v;
        if (t > M) t = (t + 1) & M;
        if (((~this.ac ^ v) & (this.ac ^ t)) & SIGN) this.ov = 1;
        this.ac = t === M ? 0 : t;
        cyc = 2;
        break;
      case 0o21:
        y = this.ea(y, ib); v = this.rd(y);
        t = this.ac + (v ^ M);
        if (t > M) t = (t + 1) & M;
        if (((this.ac ^ v) & (this.ac ^ t)) & SIGN) this.ov = 1;
        this.ac = t === M ? 0 : t;
        cyc = 2;
        break;
      case 0o22:
        y = this.ea(y, ib);
        t = add1(this.rd(y), 1); if (t === M) t = 0;
        this.ac = t; this.wr(y, t); cyc = 2;
        break;
      case 0o23:
        y = this.ea(y, ib);
        t = add1(this.rd(y), 1); if (t === M) t = 0;
        this.ac = t; this.wr(y, t);
        if (!(t & SIGN)) this.pc = (this.pc + 1) & 0o7777;
        cyc = 2;
        break;
      case 0o24: y = this.ea(y, ib); if (this.ac !== this.rd(y)) this.pc = (this.pc + 1) & 0o7777; cyc = 2; break;
      case 0o25: y = this.ea(y, ib); if (this.ac === this.rd(y)) this.pc = (this.pc + 1) & 0o7777; cyc = 2; break;
      case 0o26:
        y = this.ea(y, ib); v = this.rd(y);
        if (this.mdv) {
          sign = this.ac ^ v;
          this.io = abs(this.ac);
          v = abs(v);
          this.ac = 0;
          for (i = 0; i < 17; i++) {
            if (this.io & 1) this.ac = this.ac + v;
            this.io = (this.io >> 1) | ((this.ac & 1) << 17);
            this.ac = this.ac >> 1;
          }
          if ((sign & SIGN) && (this.ac | this.io)) { this.ac ^= M; this.io ^= M; }
          cyc = 4;
        } else { // mus: multiply step
          if (this.io & 1) {
            t = this.ac + v;
            t = (t + (t >> 18)) & M;
            if (t === M) t = 0;
            this.ac = t;
          }
          this.io = ((this.io >> 1) | (this.ac << 17)) & M;
          this.ac >>= 1;
          cyc = 2;
        }
        break;
      case 0o27:
        y = this.ea(y, ib); v = this.rd(y);
        if (this.mdv) {
          sign = this.ac ^ v;
          var signd = this.ac;
          if (this.ac & SIGN) { this.ac ^= M; this.io ^= M; }
          v = abs(v);
          if (this.ac >= v) { cyc = 2; break; }       // overflow: no skip
          for (i = t = 0; i < 18; i++) {
            if (t) this.ac = (this.ac + v) & M;
            else this.ac = (this.ac - v) & M;
            if (this.ac < 0) this.ac += M + 1;
            t = this.ac >> 17;
            if (i !== 17) this.ac = ((this.ac << 1) | (this.io >> 17)) & M;
            this.io = ((this.io << 1) | (t ^ 1)) & M;
          }
          if (t) this.ac = (this.ac + v) & M;
          t = ((signd & SIGN) && this.ac) ? this.ac ^ M : this.ac;
          this.ac = ((sign & SIGN) && this.io) ? this.io ^ M : this.io;
          this.io = t;
          this.pc = (this.pc + 1) & 0o7777;
          cyc = 8;
        } else { // dis: divide step
          var acl = this.ac >> 17;
          this.ac = ((this.ac << 1) | (this.io >> 17)) & M;
          this.io = (((this.io << 1) | acl) & M) ^ 1;
          if (this.io & 1) { t = this.ac + (v ^ M); this.ac = (t + (t >> 18)) & M; }
          else { t = this.ac + 1 + v; this.ac = (t + (t >> 18)) & M; }
          if (this.ac === M) this.ac = 0;
          cyc = 2;
        }
        break;
      case 0o30: y = this.ea(y, ib); this.pc = y; cyc = 1 + this.eaExtra; break;
      case 0o31: y = this.ea(y, ib); this.ac = (this.ov << 17) | this.pc; this.pc = y; cyc = 1 + this.eaExtra; break;
      case 0o32: {
        var cond =
          ((y & 0o100) && this.ac === 0) ||
          ((y & 0o200) && !(this.ac & SIGN)) ||
          ((y & 0o400) && (this.ac & SIGN)) ||
          ((y & 0o1000) && this.ov === 0) ||
          ((y & 0o2000) && !(this.io & SIGN));
        var fl = y & 7, sw = (y >> 3) & 7;
        if (fl) cond = cond || (fl === 7 ? !this.flag.slice(1).some(Boolean) : !this.flag[fl]);
        if (sw) cond = cond || (sw === 7 ? !this.sense.slice(1).some(Boolean) : !this.sense[sw]);
        if (ib) cond = !cond;
        if (cond) this.pc = (this.pc + 1) & 0o7777;
        if (y & 0o1000) this.ov = 0;
        break;
      }
      case 0o33: {
        var n = 0, mask = md & 0o777;
        while (mask) { n += mask & 1; mask >>= 1; }
        this.shift((md >> 9) & 0o17, n);
        break;
      }
      case 0o34: this.ac = ib ? y ^ M : y; break;
      case 0o35: cyc = this.iot(md, y); break;
      case 0o37:
        if (y & 0o200) this.ac = 0;
        if (y & 0o4000) this.io = 0;
        if (y & 0o2000) this.ac |= this.tw;
        if (y & 0o1000) this.ac ^= M;
        if (y & 0o100) this.ac |= (this.ov << 17) | this.pc;
        if (y & 0o400) { this.halted = true; }
        var nf = y & 7;
        if (nf) {
          var st = !!(y & 0o10);
          if (nf === 7) for (i = 1; i < 7; i++) this.flag[i] = st;
          else this.flag[nf] = st;
        }
        break;
      default:
        // Reserved opcode. The PDP-1 manuals leave this undefined; some
        // emulators stop, others carry on. Either way it is logged.
        this.anomalies.push({ pc: this.curPC, md: md, t: this.cycles });
        if (this.anomalies.length > 200) this.anomalies.shift();
        if (this.strictOps) {
          this.halted = true;
          this.fault = 'reserved instruction ' + md.toString(8) + ' at ' + this.curPC.toString(8);
        }
    }
    return cyc;
  };

  PDP1.prototype.shift = function (kind, n) {
    var i, ac = this.ac, io = this.io, both;
    for (i = 0; i < n; i++) {
      switch (kind) {
        case 1: ac = ((ac << 1) | (ac >> 17)) & M; break;                                   // ral
        case 2: io = ((io << 1) | (io >> 17)) & M; break;                                   // ril
        case 3: both = ac >> 17; ac = ((ac << 1) | (io >> 17)) & M; io = ((io << 1) | both) & M; break; // rcl
        case 5: ac = (((ac << 1) | (ac >> 17)) & 0o377777) | (ac & SIGN); break;             // sal
        case 6: io = (((io << 1) | (io >> 17)) & 0o377777) | (io & SIGN); break;             // sil
        case 7: both = ac & SIGN; ac = (((ac << 1) | (io >> 17)) & 0o377777) | both;
                io = (((io << 1) | (both >> 17)) & M); break;                                // scl
        case 9: ac = ((ac >> 1) | ((ac & 1) << 17)) & M; break;                             // rar
        case 10: io = ((io >> 1) | ((io & 1) << 17)) & M; break;                            // rir
        case 11: both = ac & 1; ac = ((ac >> 1) | ((io & 1) << 17)) & M; io = ((io >> 1) | (both << 17)) & M; break; // rcr
        case 13: ac = (ac >> 1) | (ac & SIGN); break;                                       // sar
        case 14: io = (io >> 1) | (io & SIGN); break;                                       // sir
        case 15: both = ac & 1; ac = (ac >> 1) | (ac & SIGN); io = (io >> 1) | (both << 17); break; // scr
      }
    }
    this.ac = ac; this.io = io;
  };

  PDP1.prototype.iot = function (md, y) {
    var dev = y & 0o77;
    if (dev === 0o07) {                     // Type 30 display
      var x = this.ac >> 8, yy = this.io >> 8;
      if (x & 0o1000) x = -(x ^ 0o1777);    // ones' complement 10 bits
      if (yy & 0o1000) yy = -(yy ^ 0o1777);
      var inten = (md >> 6) & 7;
      var s = inten & 4 ? -(inten ^ 7) : inten;   // ones' complement 3 bits
      if (this.onDisplay) this.onDisplay(x, yy, s, this.cycles, this.curPC);
      return 10;                             // ~50 us including the wait
    }
    if (dev === 0o11) { this.io = this.control; return 1; }   // control boxes
    if (dev === 0o04) { this.io = 0; return 1; }              // tyi: nothing typed
    return 1;
  };

  // Run until `cycles` have elapsed, a breakpoint is reached, or a halt.
  PDP1.prototype.run = function (cycles) {
    var end = this.cycles + cycles;
    while (this.cycles < end && !this.halted) {
      if (this.breakpoints[this.pc] && this.pc !== this.resumeFrom) { this.hitBreak = this.pc; return 'break'; }
      this.resumeFrom = -1;
      this.step();
    }
    return this.halted ? 'halt' : 'ok';
  };

  // ---- disassembly ----
  var SKIPS = [[0o100, 'sza'], [0o200, 'spa'], [0o400, 'sma'], [0o1000, 'szo'], [0o2000, 'spi']];
  var SHIFTS = { 1: 'ral', 2: 'ril', 3: 'rcl', 5: 'sal', 6: 'sil', 7: 'scl', 9: 'rar', 10: 'rir',
                 11: 'rcr', 13: 'sar', 14: 'sir', 15: 'scr' };

  function oct(n, w) { var s = (n >>> 0).toString(8); while (s.length < (w || 6)) s = '0' + s; return s; }

  // symAt(addr) -> symbolic name or null
  function disasm(md, symAt) {
    var op = md >> 13, ib = (md >> 12) & 1, y = md & 0o7777, i;
    function addr(a) {
      var s = symAt && symAt(a);
      return s || oct(a, 4);
    }
    var I = ib ? ' i' : '';
    switch (op) {
      case 0o07: return ib ? 'jda ' + addr(y) : 'cal ' + oct(y, 4);
      case 0o32: {
        var parts = [];
        SKIPS.forEach(function (s) { if (y & s[0]) parts.push(s[1]); });
        if (y & 7) parts.push('szf ' + (y & 7));
        if ((y >> 3) & 7) parts.push('szs ' + (((y >> 3) & 7) * 10).toString(8).replace(/^0+/, ''));
        if (!parts.length) parts.push('skp');
        return parts.join(' ') + I;
      }
      case 0o33: {
        var n = 0, m = md & 0o777; while (m) { n += m & 1; m >>= 1; }
        return (SHIFTS[(md >> 9) & 0o17] || 'sft') + ' ' + n + 's';
      }
      case 0o34: return 'law' + I + ' ' + oct(y, 4);
      case 0o35:
        if ((y & 0o77) === 0o07) return 'dpy' + (ib ? '-i' : '') + (((md >> 6) & 7) ? ' ' + oct(md & 0o700, 3) : '');
        return 'iot' + I + ' ' + oct(y, 4);
      case 0o37: {
        var o = [];
        if (y & 0o200 && y & 0o1000) o.push('clc');
        else { if (y & 0o200) o.push('cla'); if (y & 0o1000) o.push('cma'); }
        if (y & 0o4000) o.push('cli');
        if (y & 0o2000) o.push('lat');
        if (y & 0o400) o.push('hlt');
        if (y & 0o100) o.push('lap');
        if (y & 7) o.push((y & 0o10 ? 'stf ' : 'clf ') + (y & 7));
        return o.length ? o.join(' ') : 'nop';
      }
      default:
        if (MRI[op]) return MRI[op] + I + ' ' + addr(y);
        return oct(md);
    }
  }

  var api = { PDP1: PDP1, disasm: disasm, oct: oct };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PDP1CPU = api;
})(this);
