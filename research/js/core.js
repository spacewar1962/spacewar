/*
 * core.js - this bench's own state and helpers: its texts fetched, assembled and indexed, its
 * references, repairs and reconstruction cards. The helpers every bench shares are in
 * bench-kit (kit/base.js, kit/md.js, kit/themes.js), loaded before this file.
 *
 * A "build" is one version fetched, normalised and assembled: the unit that
 * every view reads from. Builds are cached, so moving between views or
 * comparing versions never reassembles needlessly.
 */
(function (root) {
  'use strict';

  var A = root.PDP1Asm, C = root.PDP1CPU, V = root.SWVersions;
  var SW = root.SW;   // made by kit/base.js

  SW.BASE_URI = 'https://spacewar1962.github.io/spacewar/research/';
  SW.oct = function (n, w) { return n == null ? '' : C.oct(n, w || 6); };
  // Which bit of the control boxes (iot 11) does what, for which ship, in a
  // version: found by trying each of the 18 bits alone for 25 frames on the
  // emulator and seeing which ship turns (and which way), which speeds up,
  // and whose torpedoes are counted down. The versions differ: 4.4 and 4.8
  // rotate the word before reading it, and the Morris 4.2 and 4.3 parse it
  // their own way. Resolves with [{ccw, cw, rocket, torpedo}, {...}] (a bit
  // value, or 0 where none was found), kept for the session and in this browser.
  var CTL = {};
  SW.controlMap = function (vid) {
    if (CTL[vid]) return CTL[vid];
    var keyS = 'ctlmap.3.' + vid, kept = SW.store.get(keyS, null);
    if (kept) return (CTL[vid] = Promise.resolve(kept));
    return (CTL[vid] = SW.build(vid).then(function (b) {
      var S = b.sym, map = [{ ccw: 0, cw: 0, rocket: 0, torpedo: 0 }, { ccw: 0, cw: 0, rocket: 0, torpedo: 0 }];
      if (!b.asm || !S.ml0 || !S.nth || !S.ndx || !S.ndy) return map;
      function s18(v) { return v & 0o400000 ? -(v ^ 0o777777) : v; }
      var ntr = S.ntr ? S.ntr.val : null, pending = [];
      for (var bit = 1; bit <= 0o400000; bit *= 2) pending.push(bit);
      return new Promise(function (res) {
        (function next() {
          if (!pending.length) { SW.store.set(keyS, map); res(map); return; }
          var bit = pending.shift(), cpu = new root.PDP1CPU.PDP1(SW.cpuOpts(b.v)), mem = cpu.mem, n = 0, a0, t0;
          cpu.load(b.asm.memory, b.asm.start);
          while (n < 32 && !cpu.halted && cpu.cycles < 2000000) {
            if (cpu.pc === S.ml0.val) {
              n++;
              if (n === 4) { a0 = [s18(mem[S.nth.val]), s18(mem[S.nth.val + 1])]; t0 = ntr != null ? [s18(mem[ntr]), s18(mem[ntr + 1])] : null; }
              cpu.control = n >= 4 && n < 30 ? bit : 0;
              if (n === 30) {
                for (var k = 0; k < 2; k++) {
                  var da = s18(mem[S.nth.val + k]) - a0[k];
                  if (da > 51472) da -= 102944; if (da < -51472) da += 102944;   // angles wrap at 2 pi (311040 octal)
                  var sp = Math.hypot(s18(mem[S.ndx.val + k]), s18(mem[S.ndy.val + k]));
                  if (da > 2000 && !map[k].ccw) map[k].ccw = bit;
                  else if (da < -2000 && !map[k].cw) map[k].cw = bit;
                  if (t0 && s18(mem[ntr + k]) !== t0[k] && !map[k].torpedo) map[k].torpedo = bit;
                  if (!map[k].rocket && (map[k].sp0 == null)) map[k].sp0 = sp;
                  map[k]['sp' + bit] = sp;
                }
              }
            }
            cpu.step();
          }
          setTimeout(next, 0);
        })();
      }).then(function (m) {
        // the rocket: the bit after which a ship is going fastest, well above the rest
        [0, 1].forEach(function (k) {
          var best = 0, bv = 0, sum = 0, cnt = 0;
          Object.keys(m[k]).forEach(function (key) { if (/^sp\d+$/.test(key) && key !== 'sp0') { var v = m[k][key]; sum += v; cnt++; if (v > bv) { bv = v; best = +key.slice(2); } } });
          if (cnt && bv > (sum / cnt) * 1.5) m[k].rocket = best;
          Object.keys(m[k]).forEach(function (key) { if (/^sp/.test(key)) delete m[k][key]; });
        });
        SW.store.set(keyS, m);
        return m;
      });
    }));
  };
  // Displays a version draws on. 4.4 (the dual-console version) addresses a second
  // display with the instruction 720407 (dpy-i 400 in dj6): DEC's 1963 handbook
  // (F-15D) gives 720407 as dpp, display one point on the second CRT (Type 31),
  // beside dpy 720007 for the Type 30. Each of its frames goes to one of the two.
  SW.scopeCount = function (b) { return b && b.sym && b.sym.dj6 ? 2 : 1; };
  SW.scopeOf = function (b, md) { return SW.scopeCount(b) === 2 && md != null && (md & 0o777) === 0o407 ? 2 : 1; };

  // ---------- fetching and building ----------
  var textCache = {};
  SW.fetchText = function (path) {
    if (textCache[path]) return textCache[path];
    var url = V.SRC + path.split('/').map(encodeURIComponent).join('/');
    // revalidated, so a corrected transcription is not served from an old cache
    textCache[path] = fetch(url, { cache: 'no-cache' }).then(function (r) {
      if (!r.ok) throw new Error('Could not fetch ' + path + ' (' + r.status + ')');
      return r.text();
    });
    return textCache[path];
  };
  SW.fetchBytes = function (path) {
    var url = V.SRC + path.split('/').map(encodeURIComponent).join('/');
    return fetch(url).then(function (r) {
      if (!r.ok) throw new Error('Could not fetch ' + path);
      return r.arrayBuffer();
    }).then(function (b) { return new Uint8Array(b); });
  };

  // Parse one MACRO source line into label, code and comment fields.
  SW.parseLine = function (raw) {
    var s = raw.replace(/\n$/, '');
    var out = { labels: [], code: '', comment: '', loc: '' };
    // "6077/" at the start of a line sets the location; it is not a comment
    var m = /^(\s*[0-9a-z.+\-]+\/)/i.exec(s);
    if (m) { out.loc = m[1]; s = s.slice(m[1].length); }
    var ci = s.indexOf('/');
    var code = ci >= 0 ? s.slice(0, ci) : s;
    out.comment = ci >= 0 ? s.slice(ci) : '';
    while ((m = /^(\s*)([A-Za-z0-9\\~.]*[A-Za-z][A-Za-z0-9\\~.]*),/.exec(code))) {
      out.labels.push(m[2]);
      code = code.slice(m[0].length);
    }
    out.code = code;
    return out;
  };

  // Build = fetch + normalise + assemble + index. Cached per version/dialect.
  var buildCache = {};
  SW.build = function (id, dialect) {
    var v = V.byId(id);
    if (!v) return Promise.reject(new Error('Unknown version ' + id));
    dialect = dialect || v.dialect;
    var key = id + '|' + dialect;
    if (buildCache[key]) return buildCache[key];
    buildCache[key] = V.load(v, SW.fetchText, A.splitLines, SW.fetchBytes).then(function (L) {
      var t0 = performance.now();
      // the pass-1 tape (4.3, 4.4): read on pass 1 only, unless the dialect leaves it out
      var files = L.files.concat(v.pass1 && !V.DIALECTS[dialect].noPass1 ? [{ name: v.pass1.name, text: v.pass1.text, pass1Only: true }] : []);
      var asm = v.build ? A.assemble(files, V.DIALECTS[dialect].options) : null;
      var b = { v: v, dialect: dialect, parts: L.parts, asm: asm, ms: 0 };
      index(b);
      b.ms = Math.round(performance.now() - t0);
      return b;
    });
    buildCache[key].catch(function () { delete buildCache[key]; });
    return buildCache[key];
  };

  function index(b) {
    b.lines = b.parts.map(function (p, pi) {
      var raw = A.splitLines(p.raw), norm = A.splitLines(p.text);
      var end = p.end || raw.length;
      return raw.map(function (r, i) {
        var n = i + 1;
        return { p: pi, n: n, raw: r.replace(/\n$/, ''), norm: (norm[i] || '').replace(/\n$/, ''),
                 skipped: n < p.title || n > end, title: n === p.title };
      });
    });
    // When a tape is cut from a longer file (Landsteiner's 3.1, 4.0TS, the macro
    // lines of 3.1 supplied to 3.1t), its part still holds the whole file, so line
    // numbers stay the file's own. Lines that are not this tape's are marked
    // "away": the listing, search and exports leave them out. A tape keeps the
    // lines up to the next tape's start (or its own end), so a header before its
    // title stays with it.
    b.parts.forEach(function (p, pi) {
      var same = b.parts.map(function (q, qi) { return qi; }).filter(function (qi) { return b.parts[qi].src === p.src; });
      if (same.length < 2) {
        if (p.end) b.lines[pi].forEach(function (L) { if (L.n > p.end) L.away = true; });
        return;
      }
      var start = function (qi) { return b.parts[qi].title || 1; };
      same.sort(function (x, y) { return start(x) - start(y); });
      var at = same.indexOf(pi), prev = same[at - 1], next = same[at + 1];
      var from = prev == null ? 1 : (b.parts[prev].end || start(pi) - 1) + 1;
      var to = p.end || (next == null ? b.lines[pi].length : start(next) - 1);
      b.lines[pi].forEach(function (L) { if (L.n < from || L.n > to) L.away = true; });
    });
    b.sym = {};
    b.labelAt = {};
    b.errorsAt = {};
    if (!b.asm) return;
    b.asm.symbols.forEach(function (s) {
      b.sym[s.name] = s;
      if (s.label && s.defined && !(s.val in b.labelAt)) b.labelAt[s.val] = s.name;
    });
    b.asm.errors.forEach(function (e) {
      var k = e.file + ':' + e.line;
      (b.errorsAt[k] = b.errorsAt[k] || []).push(e);
    });
    b.macros = {};
    b.asm.macros.forEach(function (m) { b.macros[m.name] = m; });
    // What kind of line each is, for the colour marks in the Read view:
    // def (inside a define ... term), eq (a symbol set with "="), call (a macro used),
    // com (a line of comment only).
    b.kind = {};
    b.asm.macros.forEach(function (m) { for (var n = m.line; n <= (m.endLine || m.line); n++) b.kind[m.file + ':' + n] = 'def'; });
    b.lines.forEach(function (ls, pi) {
      ls.forEach(function (L) {
        var k = pi + ':' + L.n;
        if (b.kind[k] || L.skipped) return;
        var ws = (b.asm.byLine[pi] || [])[L.n];
        if (ws && ws.some(function (w) { return w.macro; })) b.kind[k] = 'call';
        else {
          var pl = SW.parseLine(L.norm);
          if (/^\s*[A-Za-z0-9\\~.]+\s*=/.test(pl.code)) b.kind[k] = 'eq';
          else if (!pl.labels.length && !pl.loc && !pl.code.trim() && pl.comment.replace(/^\/+/, '').trim()) b.kind[k] = 'com';
        }
      });
    });
    b.varRange = b.asm.variables;
    // address -> [part, line]
    b.srcOf = function (addr) {
      var w = b.asm.memory[addr];
      return w ? { p: w.file, n: w.line, word: w } : null;
    };
    b.symAt = function (a) {
      if (a in b.labelAt) return b.labelAt[a];
      // variables and nearest label + offset
      for (var d = 1; d < 8; d++) if ((a - d) in b.labelAt) return b.labelAt[a - d] + '+' + d;
      return null;
    };
  }

  // Open a version at a line range (or its notes page when there is none).
  SW.openAt = function (vid, a) {
    var same = !vid || vid === SW.state.v;
    if (!same) SW.select(vid);
    if (!a) { SW.setTab('about'); return; }
    SW.state.sel = { p: a.p, n0: a.n0, n1: a.n1 != null ? a.n1 : a.n0 };
    SW.setTab('read');   // draws Read at the selection if it was not yet showing this version
    if (same) SW.emit('goto', { p: a.p, n: a.n0, tab: 'read' });
  };
  SW.current = function () { return SW.state.v ? SW.build(SW.state.v) : Promise.reject(new Error('no version')); };

  // Citation for a line range of a build.
  // The bench's references to its sources (Help ▸ Referencing and versions): SW, the
  // version, and a letter for the witness, the particular surviving text:
  // T machine-read from the punched source tape, L a transcription, M a modern
  // reassembly or edited source, R a reconstruction (B: an object tape, by
  // address only). Then the tape and lines: [REF: SW3.1T, 2.141–146]; the tape
  // is left out when the text has only one; @0402 cites by core address.
  SW.REF = { '1': 'SW1R', 'stars': 'SWEPL', '2b-pre': 'SW2B-preL', '2b': 'SW2BR', '3.1': 'SW3.1L', '3.1t': 'SW3.1T',
    '4.0': 'SW4.0L', '4.0ts': 'SW4.0TSL', '4.1': 'SW4.1L', '4.1t': 'SW4.1T', '4.1d': 'SW4.1Md', '4.1f': 'SW4.1Mf', '4.2': 'SW4.2L',
    '4.3': 'SW4.3L', '4.3m': 'SW4.3M', '4.4': 'SW4.4L', '4.4m': 'SW4.4M', '4.4f': 'SW4.4Mf', '4.8': 'SW4.8L', '2015': 'SW2015M' };
  // Ports: programs for other machines, not texts of a PDP-1 version, so a
  // namespace of their own: SWP, the machine, the program, and its own version
  // number (or its year when it has none). Several files of one program are its parts.
  SW.PORTS = [   // [reference, program, machine, where and by whom, date, files held (under sources/), a catalogue entry held (image)]
    ['SWP-PDP4-SPACEWAR63', 'Spacewar', 'PDP-4', 'University of Michigan', '1963', ''],
    ['SWP-DDP224-SPACEWAR64', 'Spacewar', 'DDP-224', 'University of Michigan', '1964', ''],
    ['SWP-PDP6-SPACEWAR64', 'Spacewar', 'PDP-6', 'Stanford (Steve Russell)', '1964', ''],
    ['SWP-S360-SPACEWAR65', 'Spacewar', 'IBM System/360-65', 'MIT Computation Center (Edson Hendricks)', '1965', ''],
    ['SWP-PDP7-SPACEWAR65', 'Spacewar', 'PDP-7', 'University of Pittsburgh (Russell Randshaw)', '1965', ''],
    ['SWP-CDC3100-SPACEWAR66R', 'Spacewar, reconstructed', 'CDC 3100', 'University of Minnesota (A. W. Kuhfeld); reconstruction by Norbert Landsteiner, 2014', '1966–69', 'reference/minnesota-spacewar-landsteiner-2014.js'],
    ['SWP-PDP8-SPACEWAR71', 'Space War', 'LAB-8 (PDP-8)', 'Evan Suits (DECUS)', '1965–68; listing 1971', 'ports/spacewar-pdp8-labx8-suits-1971.txt'],
    ['SWP-PDP10-SW71', 'Space War (SW; part 1 SW.MAC, part 2 SHIPS.SAI)', 'PDP-10', 'Stanford AI Lab: Steve Russell, 1967; Ralph E. Gorin’s version with R. Taylor', '1971–72', 'ports/spacewar-pdp10-sail-gorin-1971.txt, ports/spacewar-pdp10-sail-gorin-1971-ships.txt'],
    ['SWP-PDP6-WAR44', 'WAR 44', 'PDP-6', 'MIT (Samson’s DECtape)', 'c. 1968', 'ports/spacewar-pdp6-mit-war44-1968.txt'],
    ['SWP-PDP7-DUEL68', 'Duel', 'PDP-7', 'Cambridge Univ. Maths Lab (M. S. Peterson, J. C. Viner; DECUS 7-40)', 'June 1968', '', ['DECUS 7-40', 'assets/images/Spacewar-cambridge-decus7-40-June1968.png']],
    ['SWP-LINC8-SPCWAR68', 'SPCWAR', 'LINC-8', 'University of Pennsylvania (E. Duffin; DECUS L-39)', '12 Aug 1968', '', ['DECUS L-39', 'assets/images/SPCWAR-DECUS-L-39.png']],
    ['SWP-NOVA-SPACEWAR68', 'Spacewar', 'Data General NOVA', 'Fall Joint Computer Conference', '1968', ''],
    ['SWP-PLATO-SPACEWAR69', 'Spacewar', 'PLATO / ILLIAC', 'University of Illinois (Richard W. Blomme)', '1969', ''],
    ['SWP-IBM1620-SPACEWAR69', 'Spacewar', 'IBM 1620', 'Jim Burroughs', 'c. 1969', ''],
    ['SWP-PDS1-SPACEWAR70', 'Spacewar', 'Imlac PDS-1', '', '1970', ''],
    ['SWP-GT40-SPCWAR73', 'SPCWAR', 'GT40 (PDP-11)', 'Stanford AI Lab (Botond G. Eross)', '1973', 'ports/spacewar-gt40-pdp11-stanford-eross-1973.txt'],
    ['SWP-GT40-DECUS11-192', 'SPCWAR (DECUS 11-192)', 'PDP-11/10', 'Larry Bryant and Bill Seiler', '1974', 'ports/spacewar-gt40-pdp11-bryant-seiler-1974.pdf'],
    ['SWP-PDP12-SPCWAR3', 'SPCWAR, version 3', 'LINC-8 / PDP-12', 'Georgia Tech (D. E. Wrege)', '1974', 'ports/spacewar-linc8-pdp12-gtech-wrege-1974.txt'],
    ['SWP-ITS-SPCWAR76', 'SPCWAR (log to version 163)', 'PDP-6/10, ITS', 'MIT AI Lab', '1976', 'ports/spacewar-pdp6-10-mit-its-spcwar.txt'],
    ['SWP-ITS-NEWWAR76', 'NEWWAR (log to version 163)', 'PDP-6/10, ITS', 'MIT AI Lab', '1976', 'ports/spacewar-pdp6-10-mit-its-newwar.txt'],
    ['SWP-ITS-TVWAR', 'TVWAR', 'Knight TV, ITS', 'MIT AI Lab', '', 'ports/spacewar-knighttv-mit-its-tvwar.txt'],
    ['SWP-GT40-MIT76', 'Spacewar (object tape)', 'GT40 (PDP-11)', 'MIT AI Lab (Richard C. Waters, Meyer A. Billmers)', 'c. 1976', 'ports/spacewar-gt40-pdp11-1976.pt']
  ];
  // When the text we hold was made, where it is not the version's own date.
  SW.MADE = { '1': 'reconstructed by Norbert Landsteiner, April 2016 (revised 2021); not an authentic program',
    '2b': 'reconstructed from the disassembled binary by Norbert Landsteiner, 2014',
    '2b-pre': 'a transcription of the 25 March 1962 listing (masswerk, 2014); the build supplies the June 1963 macro tape and the 13 March 1962 star table, not held for this version',
    '3.1': 'a text from bitsavers (SteveRussell_box1/_text), as compiled by masswerk',
    '3.1t': 'read by the bench from Russell’s source tapes of 29 September 1962',
    '4.1t': 'read by the bench from the dfw source tape',
    '4.3m': 'fixed by Norbert Landsteiner, 28 February 2015; not an authentic program', '4.4m': 'reassembled by Norbert Landsteiner', '4.4f': 'fixed by Norbert Landsteiner, 2015',
    '4.1d': 'reconstructed by Peter Samson, June 2005', '4.1f': 'reconstructed by Peter Samson, 2005 to 2008', '2015': 'written by Norbert Landsteiner, 2015' };
  // The options for a version's emulated PDP-1. The CHM builds of 4.1 (2005 to 2008)
  // were made for the Computer History Museum's PDP-1, which draws intensity codes 4
  // to 7 otherwise than DEC's PDP-35-2 (as Landsteiner's emulator maps them: 4 as 7,
  // 5 and 6 as 6, 7 as 0); shown so unless Settings says otherwise.
  var CHM_INTEN = [0, 1, 2, 3, 7, 6, 6, 0];
  SW.chmInten = function (v) { return (v.id === '4.1d' || v.id === '4.1f') && SW.store.get('chmBright', true) ? CHM_INTEN : null; };
  SW.cpuOpts = function (v) {
    return { mdv: v.mdv, ctlLoad: v.ctlLoad, intenMap: SW.chmInten(v) };
  };
  // The beam's brightness for a display intensity s (-4 to 3: DEC's order 4 5 6 7 0 1 2 3,
  // PDP-35-2): 4 is seen by a photomultiplier only, 7 barely, 0 is normal, 3 brightest.
  // As an opacity, 0 for s = -4; 0.62 for s = 0, as the bench drew normal points before.
  var BEAM = [0, 0.12, 0.22, 0.34, 0.62, 0.75, 0.88, 1];
  SW.beam = function (s) { s = s == null ? 0 : s; return BEAM[Math.max(-4, Math.min(3, s)) + 4]; };
  // ---------- assembly errors, explained (the badges in Read open this) ----------
  // MACRO's error codes, as DEC's manual gives them (F-36, 1962, pp. 26-28)
  var MACRO_ERR = { us: 'an undefined symbol (its value taken as zero)', mdt: 'a tag defined twice, differently', mdd: 'a multiple definition in a dimension statement', mdm: 'a macro defined twice', zpa: 'an illegal parameter assignment', mdv: 'a variable defined twice', ilp: 'a parity error (the character ignored)', ipi: 'an illegal pseudo-instruction', ilr: 'an illegal repeat', ids: 'an illegal dummy symbol', sce: 'storage capacity exceeded', ilf: 'an illegal format', tmc: 'too many constants', tmv: 'too many variables', tmp: 'too many parameters' };
  var MACRO_US = { a: 'in a pseudo-instruction argument', w: 'in a word', c: 'in a constant', p: 'in a parameter assignment', m: 'in a macro definition', l: 'in a location assignment', r: 'in a repeat count', s: 'in a start', d: 'in a dummy symbol assignment' };
  // what is known about particular errors: version, a pattern for the line, the note
  var ERR_NOTES = [
    ['4.4', /^\s*law a4\+\s*$/, 'The scan reads law a4+ (p. 29, checked 29 September 2026): the line ends in a plus sign. macro1 calls the tab after it an illegal character and assembles law a4. The listing’s pass log records no error for this line, so MACRO seems to have accepted it, most likely as a4 plus nothing, the same word. The masswerk texts and the Morris 4.3 have law a4+1. As assembled, leaving the score display this way goes back to a4, which is jmp fi1, the score display again, rather than to a4+1, where the program reads the test word.'],
    ['4.4', /^\s*law i1\b/, 'MACRO reported this one in 1963: the pass log at the end of the listing (scan p. 31) reads “usw 1362 a+13 count i1”, which in its error code is an undefined symbol (us) in a word (w), at 1362, a+13, after the pseudo-instruction count, the symbol i1. The line is law i1, without the space of law i 1. MACRO took the undefined i1 as zero and punched law 0, as the bench does, at the same address, 1362, which confirms that the bench lays the program out as MIT’s assembly did up to this point. The game count gct is set to 0 rather than −1. (The bench’s transcription read law i 1 until 29 September 2026.)'],
    ['4.8', /^\s*lai\b/, 'lai (760040, AC from IO) is an operate instruction of the upgraded PDP-1 (the PDP-1D), which the June 1963 macro tape does not define. The scorer, by Peter Samson, uses it, so it was assembled where lai was defined; the emulator runs the word the bench assembles here only if it is defined.']
  ];
  function decodeMacroErr(line) {
    var m = /^(us|mdt|mdd|mdm|zpa|mdv|ilp|ipi|ilr|ids|sce|ilf|tmc|tmv|tmp)([a-z]?)\s+([0-7]+)\s+(\S+)\s+(\S+)(?:\s+(\S+))?/.exec(line.trim());
    if (!m) return null;
    return (MACRO_ERR[m[1]] || m[1]) + (m[1] === 'us' && m[2] ? ' ' + (MACRO_US[m[2]] || m[2]) : '') + ', at ' + m[3] + ' (' + m[4] + '), after the pseudo-instruction ' + m[5] + (m[6] ? ', the symbol ' + m[6] : '');
  }
  SW.asmErrors = function (b) {
    if (!b || !b.asm) return;
    var V = root.SWVersions, errs = b.asm.errors || [], N = b.parts.length;
    var rows = errs.map(function (e) {
      var L = b.lines[e.file] && b.lines[e.file][e.line - 1], raw = L ? L.raw : '', w = e.loc != null ? b.asm.memory[e.loc] : null;
      var note = ERR_NOTES.filter(function (n) { return n[0] === b.v.id && n[1].test(raw); })[0];
      var col = Math.max(0, (e.col || 1) - 1), shown = raw.replace(/\t/g, '    ');
      var pre = raw.slice(0, col).replace(/\t/g, '    ').length;
      return '<section class="asmerr"><h4>' + SW.esc(e.message) + (e.symbol ? ': <span class="mono">' + SW.esc(e.symbol) + '</span>' : '') + ' ' + SW.refTag(b.v.id, e.file, e.line, e.line, N) + '</h4>' +
        '<pre class="mono asmerr-line">' + SW.esc(shown) + '\n' + ' '.repeat(pre) + '^</pre>' +
        '<p class="hint">' + (w ? 'Assembled at ' + SW.oct(e.loc, 4) + ' as ' + SW.oct(w.val, 6) + (root.PDP1CPU && root.PDP1CPU.disasm ? ' (' + SW.esc(root.PDP1CPU.disasm(w.val, b.symAt)) + ')' : '') + '. ' : '') +
        '<a href="#" data-go="' + e.file + ':' + e.line + '">Open in Read ▸</a></p>' + (note ? '<p>' + SW.esc(note[2]) + '</p>' : '') + '</section>';
    });
    var P = b.v.pass1, logErrs = P && P.log ? P.log.filter(function (l) { return decodeMacroErr(l); }) : [];
    var d = SW.el('dialog', { class: 'tray-big asmerrs' });
    d.innerHTML = '<div class="tray-bighead"><b>Assembly errors: ' + SW.esc(b.v.label) + '</b> ' + SW.refTag(b.v.id) + '<span class="refhelp-acts"><button class="icon-btn" data-x title="Close (Esc)">✕</button></span></div>' +
      '<p>The bench assembles each text with its own port of macro1, the modern cross-assembler (2003), set to follow MACRO as it behaved in 1962-63 where the two differ. These are the lines it could not assemble cleanly, with what it made of them.</p>' +
      rows.join('') +
      (logErrs.length ? '<section class="asmerr"><h4>In the listing’s own pass log (scan p. ' + P.page + ')</h4>' + logErrs.map(function (l) { return '<p><span class="mono">' + SW.esc(l) + '</span>: ' + SW.esc(decodeMacroErr(l)) + ' (MACRO’s error code, DEC manual F-36, pp. 26-28).</p>'; }).join('') + '<p class="hint">These are the errors MACRO typed when the program was assembled at MIT in 1963; a line it did not report there, it accepted.</p></section>' : '');
    document.body.appendChild(d);
    d.addEventListener('click', function (ev) {
      if (ev.target === d || ev.target.closest('[data-x]')) { d.close(); return; }
      var g = ev.target.closest('[data-go]'); if (!g) return;
      ev.preventDefault(); var pn = g.dataset.go.split(':'); d.close(); SW.openAt(b.v.id, { p: +pn[0], n0: +pn[1] });
    });
    d.addEventListener('close', function () { d.remove(); });
    d.showModal();
  };
  // ---------- Help ▸ What you should read ----------
  // A short bibliography, every entry checked against the project's Zotero library.
  SW.readingHelp = function () {
    function a(url, t) { return '<a href="' + url + '" target="_blank" rel="noopener noreferrer">' + (t || url) + '</a>'; }
    var groups = [
      ['Repairing old code', [
        'Berry, D. M. (2025) ‘Digital Ruins and Critical Code Studies: Towards an Ethics of Historical Software Reconstruction’, <i>Stunlaw: Philosophy and Critique for a Digital Age</i>. Available at: ' + a('https://stunlaw.blogspot.com/2025/01/digital-ruins-and-critical-code-studies.html') + '. <span class="rh-note">The approach behind the bench’s repair marks (gold, in Read) and its reconstruction cards.</span>']],
      ['Critical code studies', [
        'Marino, M. C. (2020) <i>Critical Code Studies</i>. Cambridge, MA: The MIT Press.',
        'Berry, D. M. and Marino, M. C. (2024) ‘Reading ELIZA: Critical Code Studies in Action’, <i>Electronic Book Review</i>. Available at: ' + a('https://electronicbookreview.com/essay/reading-eliza-critical-code-studies-in-action/') + '.',
        'Marino, M. C., Weil, P., Shrager, J., Schwarz, A., Hay, A., Ciston, S., Berry, D. M. and Millican, P. (2026) ‘Conversations about conversational code: on the collaborative critical code studies reading of ELIZA’, <i>AI &amp; Society</i>. ' + a('https://doi.org/10.1007/s00146-026-03086-7', 'https://doi.org/10.1007/s00146-026-03086-7') + '.',
        'Montfort, N., Baudoin, P., Bell, J., Bogost, I., Douglass, J., Marino, M. C., Mateas, M., Reas, C., Sample, M. and Vawter, N. (2014) <i>10 PRINT CHR$(205.5+RND(1)); : GOTO 10</i>. Cambridge, MA: MIT Press.']],
      ['Spacewar!', [
        'Graetz, J. M. (1981) ‘The Origin of Spacewar’. Available at: ' + a('https://www.masswerk.at/spacewar/SpacewarOrigin.html') + '.',
        'Monnens, D. and Goldberg, M. (2015) ‘Space Odyssey: The Long Journey of Spacewar! from MIT to Computer Labs Around the World’, <i>Kinephanos</i>. Available at: ' + a('https://www.kinephanos.ca/2015/space-odyssey-the-long-journey-of-spacewar-from-mit-to-computer-labs-around-the-world/') + '.',
        'Landsteiner, N. (n.d.) <i>Spacewar! – video games 60s style</i>. Available at: ' + a('https://www.masswerk.at/spacewar/') + '.']]
    ];
    var d = SW.el('dialog', { class: 'tray-big annohelp readhelp' });
    d.innerHTML = '<div class="tray-bighead"><b>What you should read</b><button class="icon-btn" data-x title="Close (Esc)">✕</button></div><div class="ah">' +
      '<p>Where to begin: on repairing old code, on reading code as a cultural text, and on Spacewar! itself. Links open in a new tab.</p>' +
      groups.map(function (g) { return '<h3>' + g[0] + '</h3><div class="rh-list">' + g[1].map(function (r) { return '<p class="rh-ref">' + r + '</p>'; }).join('') + '</div>'; }).join('') +
      '</div>';
    document.body.appendChild(d);
    d.showModal();
    d.addEventListener('click', function (e) { if (e.target === d || e.target.closest('[data-x]')) { d.close(); d.remove(); } });
    d.addEventListener('close', function () { d.remove(); });
  };

  // ---------- Reconstruction cards (as on the SHRDLU bench) ----------
  // A card per version the bench builds: every repair made to read and run it,
  // with its line, kind, evidence and author. Gold in Read; the held files are
  // never altered.
  function cardCode(x) { return String(x || '').replace(/\/.*$/, '').replace(/\s+/g, ' ').trim(); }
  var KCHIP = {
    fix: ['rp-m-hibi', 'Corrected', 'A reading corrected against the scan'],
    rebuilt: ['rp-m-kake', 'Remade', 'A line remade where no reading survives'],
    sup: ['rp-m-yobitsugi', 'Supplied', 'A tape supplied from another text'],
    rec: ['rp-m-yobitsugi', 'Reconstruction', 'The whole text is a reconstruction'],
    norm: ['rp-m-mount', 'For assembly', 'How the assembler reads the text, not the reading itself'],
    unc: ['rp-m-unc', 'Uncertain', 'A reading marked uncertain in the transcription, left as found']
  };
  function kchip(k) { var c = KCHIP[k]; return '<span class="rp-chip ' + c[0] + '" title="' + SW.esc(c[2]) + '">' + c[1] + '</span>'; }
  // the card as data: one row per repair, [where, kind, what, evidence, by]
  function cardRows(b) {
    var V = root.SWVersions, v = b.v, rows = [], n = b.parts.length;
    if (/R$/.test(SW.REF[v.id] || '')) rows.push([SW.refOf(v.id), 'rec', SW.MADE[v.id] || 'a reconstructed text', '', '']);
    b.parts.forEach(function (part, pi) {
      if (part.role && part.role !== 'program') rows.push([SW.refOf(v.id, pi, null, null, n), 'sup', part.src + ': ' + part.role, '', '']);
      ((V.REPAIRS || {})[part.src] || []).forEach(function (r) {
        rows.push([SW.refOf(v.id, pi, r.n, r.n, n), r.kind === 'rebuilt' ? 'rebuilt' : 'fix', (r.was ? '“' + r.was + '” → ' : '') + '“' + r.now + '”', r.ev, r.by + ', ' + r.date]);
      });
    });
    var norm = 0, unc = [];
    b.lines.forEach(function (ls, pi) { ls.forEach(function (L) {
      if (L.skipped) return;
      if (L.raw !== L.norm && cardCode(L.raw) !== cardCode(L.norm)) norm++;
      if (/\[\?/.test(L.raw) && cardCode(L.raw)) unc.push([pi, L]);
    }); });
    if (norm || (v.transforms || []).length) rows.push([SW.refOf(v.id), 'norm', (norm ? norm + ' line' + (norm === 1 ? '' : 's') + ' whose code the assembler reads in another form' : 'no line’s code changed') +
      ((v.transforms || []).length ? ': ' + v.transforms.map(function (k) { return V.TRANSFORMS[k].label; }).join('; ') : ''), 'the bench’s assembler', 'the bench']);
    unc.forEach(function (u) { rows.push([SW.refOf(v.id, u[0], u[1].n, u[1].n, n), 'unc', u[1].raw.trim(), 'the transcription', '']); });
    return rows;
  }
  SW.reconstructionCard = function (b) {
    var v = b.v, esc = SW.esc, rows = cardRows(b);
    return '<div class="kin-card"><h3>Reconstruction card: ' + esc(v.label) + ' <span class="swref-sm mono">' + esc(SW.refText(v.id)) + '</span></h3>' +
      (SW.MADE[v.id] ? '<p class="hint">This text: ' + esc(SW.MADE[v.id].replace(/read by the bench/, 'read by the project')) + '.</p>' : '') +
      (rows.length ? '<table class="ov-sub kin-t"><thead><tr><th>Where</th><th>Kind</th><th>What</th><th>Evidence</th><th>By</th></tr></thead><tbody>' +
        rows.map(function (r) { return '<tr><td class="mono">' + esc(r[0]) + '</td><td>' + kchip(r[1]) + '</td><td' + (r[1] === 'norm' || r[1] === 'rec' || r[1] === 'sup' ? '' : ' class="mono"') + '>' + esc(r[2]) + '</td><td class="faint">' + esc(r[3]) + '</td><td class="faint">' + esc(r[4]) + '</td></tr>'; }).join('') +
        '</tbody></table>' : '<p>No repairs: the text is read and assembled as held.</p>') + '</div>';
  };
  // for Copy, export and My notes
  SW.cardText = function (b) {
    var rows = cardRows(b);
    return 'Reconstruction card: ' + b.v.label + ' ' + SW.refText(b.v.id) + ' (Spacewar! Research Bench ' + SW.VERSION + ')\n' +
      (SW.MADE[b.v.id] ? 'This text: ' + SW.MADE[b.v.id] + '.\n' : '') +
      (rows.length ? rows.map(function (r) { return r[0] + '  ' + KCHIP[r[1]][1] + ': ' + r[2] + (r[3] ? '. Evidence: ' + r[3] : '') + (r[4] ? '. By ' + r[4] : '') + '.'; }).join('\n') : 'No repairs.');
  };
  function cardBlocks(b) {
    var rows = cardRows(b);
    return [{ type: 'h2', text: 'Reconstruction card: ' + b.v.label + ' ' + SW.refText(b.v.id) }]
      .concat(SW.MADE[b.v.id] ? [{ type: 'p', text: 'This text: ' + SW.MADE[b.v.id] + '.' }] : [])
      .concat(rows.length ? [{ type: 'table', head: ['Where', 'Kind', 'What', 'Evidence', 'By'], rows: rows.map(function (r) { return [r[0], KCHIP[r[1]][1], r[2], r[3], r[4]]; }) }] : [{ type: 'p', text: 'No repairs.' }]);
  }
  SW.cardDoc = function (bs) {
    return { title: bs.length === 1 ? 'Reconstruction card: ' + bs[0].v.label : 'Spacewar! reconstruction cards',
      subtitle: 'What was done to each surviving text to read and run it',
      meta: [['Generated', SW.fmtDate(SW.today()) + ', Spacewar! research bench v' + SW.VERSION], ['Bench', SW.BASE_URI]],
      blocks: [{ type: 'p', text: 'After the principles for repairing digital ruins (Berry 2025): minimum intervention, reversible, recorded, and marked in gold in Read. The held files are never altered.' }]
        .concat([].concat.apply([], bs.map(cardBlocks))) };
  };
  // One card at a time, chosen from a list of the versions the bench builds
  function cardDialog(id) {
    var V = root.SWVersions, vs = V.VERSIONS.filter(function (v) { return v.build; }).sort(function (a, b) { return a.sort - b.sort; });
    var cur = V.byId(id) && V.byId(id).build ? id : vs[0].id, esc = SW.esc;
    var d = SW.el('dialog', { class: 'tray-big annohelp cardshelp' });
    d.innerHTML = '<div class="tray-bighead"><b>Reconstruction cards</b><span class="refhelp-acts">' +
      '<button class="btn ghost" data-cx="copy" title="This card as plain text, with its references">⧉ Copy</button>' +
      '<details class="menu more-menu"><summary class="btn ghost" title="This card, or every card, as a file">⤓ Export ▾</summary><div class="menu-body">' +
      '<button class="btn ghost" data-cx="docx">⤓ This card, Word</button><button class="btn ghost" data-cx="md">⤓ This card, Markdown</button>' +
      '<button class="btn ghost" data-cx="docx-all">⤓ All cards, Word</button><button class="btn ghost" data-cx="md-all">⤓ All cards, Markdown</button></div></details>' +
      '<button class="btn ghost" data-cx="keep" title="Put this card in My notes (private), to gather with others for a chapter">＋ My notes</button>' +
      '<button class="icon-btn" data-x title="Close (Esc)">✕</button></span></div><div class="ah">' +
      '<p>What was done to each surviving text to read and run it, after the principles for repairing digital ruins (Berry 2025): minimum intervention, reversible, recorded, and marked in gold in Read. The held files are never altered.</p>' +
      '<div class="keylist kin-key">' + ['fix', 'rebuilt', 'sup', 'norm', 'unc'].map(function (k) { return '<div>' + kchip(k) + ' ' + KCHIP[k][2].charAt(0).toLowerCase() + KCHIP[k][2].slice(1) + '</div>'; }).join('') + '</div>' +
      '<div class="kin-pick"><button class="btn ghost" data-cx="prev" title="The previous version">‹</button><select aria-label="Version">' +
      vs.map(function (v) { return '<option value="' + esc(v.id) + '"' + (v.id === cur ? ' selected' : '') + '>' + esc(SW.refOf(v.id) + '  ' + v.label) + '</option>'; }).join('') +
      '</select><button class="btn ghost" data-cx="next" title="The next version">›</button></div><div class="kin-one"></div></div>';
    document.body.appendChild(d);
    var sel = d.querySelector('select'), box = d.querySelector('.kin-one');
    function show(vid) {
      cur = vid; sel.value = vid;
      box.innerHTML = '<div class="kin-card"><h3>Reconstruction card: ' + esc(V.byId(vid).label) + '</h3><p class="faint">…</p></div>';
      SW.build(vid).then(function (b) { if (cur === vid) box.innerHTML = SW.reconstructionCard(b); }, function () {});
    }
    function all() { return vs.reduce(function (p, v) { return p.then(function (acc) { return SW.build(v.id).then(function (b) { return acc.concat([b]); }, function () { return acc; }); }); }, Promise.resolve([])); }
    sel.addEventListener('change', function () { show(sel.value); });
    d.addEventListener('click', function (e) {
      var c = e.target.closest('[data-cx]');
      if (c) {
        var k = c.dataset.cx, m = c.closest('details'); if (m) m.open = false;
        var i = vs.findIndex(function (v) { return v.id === cur; });
        if (k === 'prev' || k === 'next') { show(vs[(i + (k === 'next' ? 1 : -1) + vs.length) % vs.length].id); return; }
        if (/-all$/.test(k)) { SW.toast('Assembling every version…'); all().then(function (bs) { SW.exportDoc(SW.cardDoc(bs), 'spacewar-reconstruction-cards', k.replace('-all', '')); }); return; }
        SW.build(cur).then(function (b) {
          if (k === 'copy') SW.copyText(SW.cardText(b), 'the reconstruction card');
          else if (k === 'keep') { if (SW.tray) SW.tray.addDoc(SW.cardDoc([b]), { vid: b.v.id, tags: ['repair', 'reconstruction card'] }); }
          else SW.exportDoc(SW.cardDoc([b]), 'reconstruction-card-' + SW.refOf(b.v.id), k);
        });
        return;
      }
      if (e.target === d || e.target.closest('[data-x]')) { d.close(); d.remove(); }
    });
    d.addEventListener('close', function () { d.remove(); });
    d.showModal();
    show(cur);
  }
  SW.cardsOne = function (id) { cardDialog(id); };
  // Help ▸ Reconstruction cards: opens on the version in view
  SW.cardsHelp = function () { cardDialog(SW.state && SW.state.v); };

  // Help ▸ Referencing and versions: the convention, and every source's reference
  SW.refHelp = function () {
    var V = root.SWVersions, vs = V.VERSIONS.filter(function (v) { return v.build; }).sort(function (a, b) { return a.sort - b.sort; });
    var d = SW.el('dialog', { class: 'tray-big refhelp' });
    d.innerHTML = '<div class="tray-bighead"><b>Referencing and versions</b><span class="refhelp-acts">' +
      '<button class="btn ghost" data-rx="copy" title="The references of every version and port, as plain text to paste into an email">⧉ Copy the list</button>' +
      '<details class="menu more-menu"><summary class="btn ghost" title="The convention and every reference, with SWHIDs, as a file to share">⤓ Export ▾</summary><div class="menu-body">' +
      '<button class="btn ghost" data-rx="docx">⤓ Word</button><button class="btn ghost" data-rx="md">⤓ Markdown</button></div></details>' +
      '<button class="icon-btn" data-x title="Close (Esc)">✕</button></span></div>' +
      '<p>The bench names each source text in one form, shown in small type beside its name across the bench, in citations and in exports:</p>' +
      '<p class="refhelp-ex mono">[REF: SW3.1T, 2.141–146]</p>' +
      '<p>SW, then the version (<b>3.1</b>), then a letter for the witness, the particular surviving text of that version (<b>T</b>); then the tape (<b>2</b>, as the assembler read them in) and the lines (<b>141–146</b>).</p>' +
      '<table class="ov-sub"><thead><tr><th>Letter</th><th>The witness</th></tr></thead><tbody>' +
      [['T', 'machine-read from the punched source tape'], ['L', 'a transcription: typed text of a listing or a tape'], ['M', 'a modern reassembly or edited source'], ['R', 'a reconstruction'], ['B', 'an object tape (binary), cited by address only']].map(function (r) { return '<tr><td class="mono">' + r[0] + '</td><td>' + r[1] + '</td></tr>'; }).join('') + '</tbody></table>' +
      '<p>Shorter forms: the version and witness alone, <span class="mono">[REF: SW3.1T]</span>; a whole tape, <span class="mono">[REF: SW3.1T, 2]</span>. The tape is left out when a text has only one: <span class="mono">[REF: SW4.3M, 141]</span>. By core address, <span class="mono">[REF: SW3.1L, @0402–0407]</span>: an address holds across texts of a version that assemble to the same words, and is the only way to cite an object tape. Two texts of one version with the same letter take a lower-case qualifier: <span class="mono">SW4.4Mf</span>. A newly found text takes its version and the next letter or qualifier; a new version, its own number.</p>' +
      '<p>A port, a program for another machine, is not a text of any PDP-1 version and has a namespace of its own: <b>SWP</b>, the machine, the program, and its own version number, or its year when it has none: <span class="mono">[REF: SWP-PDP6-WAR44, 76]</span>. Several files of one program are its parts: <span class="mono">[REF: SWP-PDP10-SW71, 2.14]</span> is line 14 of SHIPS.SAI. A port has no witness letter unless it survives in more than one text.</p>' +
      '<p>A SWHID opens through Software Heritage’s resolver, <span class="mono">archive.softwareheritage.org/swh:1:cnt:…</span>, once the repository is archived there; the part after the first semicolon (origin, path, lines) qualifies it and is not a web address. For a link that works meanwhile, Copy citation also gives the file on GitHub at its last change, to the lines.</p>' +
      '<p>For the exact bytes of a file, cite its <a href="https://www.swhid.org/" target="_blank" rel="noopener">SWHID</a> (<a href="https://www.softwareheritage.org/software-hash-identifier-swhid/" target="_blank" rel="noopener">Software Heritage</a>, <a href="https://www.iso.org/standard/89985.html" target="_blank" rel="noopener">ISO/IEC 18670:2025</a>) alongside.</p>' +
      '<h4>Source code versions</h4><p class="hint">The version’s date is the program’s; the text we hold may be later: a transcription, a reassembly, a reconstruction. Each version’s name opens its text on GitHub (a text in several files has a link for each further part); SWHIDs copy on a click (hover for the file), for the version’s own texts, not the macro tape and star table supplied to many builds.</p><table class="ov-sub refhelp-t"><thead><tr><th>No.</th><th>Reference</th><th>Version</th><th>Author</th><th>Version dated</th><th>This text</th><th>SWHID</th></tr></thead><tbody>' +
      vs.map(function (v, n) { var own = SW.ownFilesOf(v); return '<tr><td class="num">' + (n + 1) + '</td><td class="mono"><span class="swref-c" data-copy="' + SW.esc(SW.refText(v.id)) + '" title="Click to copy">' + SW.esc(SW.refOf(v.id)) + '</span></td><td>' + own.map(function (f, k) { var nm = f.split('/').pop(); return '<a href="' + SW.esc(SW.permalinkOf(f)) + '" target="_blank" rel="noopener" title="' + SW.esc(nm) + ' on GitHub, at its last change"' + (k ? ' class="ref-more"' : '') + '>' + (k ? 'part ' + (k + 1) : SW.esc(v.label)) + ' ↗</a>'; }).join(' ') +
        '</td><td>' + SW.esc(v.authors || '') + '</td><td>' + SW.esc(v.date || '') + '</td><td>' + SW.esc(SW.MADE[v.id] || (v.medium || '')) + '</td><td>' + SW.swhidTiny(own) + '</td></tr>'; }).join('') + '</tbody></table>' +
      '<details class="refhelp-ports"><summary><h4>Ports <span class="faint">' + SW.PORTS.length + '</span></h4></summary><table class="ov-sub refhelp-t"><thead><tr><th>No.</th><th>Reference</th><th>Program</th><th>Machine</th><th>Where and by whom</th><th>Date</th><th>SWHID</th></tr></thead><tbody>' +
      SW.PORTS.map(function (r, n) { return '<tr><td class="num">' + (n + 1) + '</td><td class="mono"><span class="swref-c" data-copy="[REF: ' + SW.esc(r[0]) + ']" title="Click to copy">' + SW.esc(r[0]) + '</span></td><td>' + (r[5] ? r[5].split(/,\s*/).map(function (f, k) { return '<a href="' + SW.esc(SW.permalinkOf(f)) + '" target="_blank" rel="noopener" title="' + SW.esc(f.split('/').pop()) + ' on GitHub, at its last change"' + (k ? ' class="ref-more"' : '') + '>' + (k ? 'part ' + (k + 1) : SW.esc(r[1])) + ' ↗</a>'; }).join(' ')
          : SW.esc(r[1]) + (r[6] ? ' <a class="ref-more" href="../' + SW.esc(r[6][1]) + '" target="_blank" rel="noopener" title="No source held; the catalogue entry">' + SW.esc(r[6][0]) + ' ↗</a>' : ' <span class="faint ref-more">none held</span>')) +
        '</td><td>' + SW.esc(r[2]) + '</td><td>' + SW.esc(r[3]) + '</td><td>' + SW.esc(r[4]) + '</td><td>' + (r[5] ? SW.swhidTiny(r[5].split(/,\s*/)) : '') + '</td></tr>'; }).join('') + '</tbody></table>' +
      '<p class="hint">Named whether or not a text is held, so that a port can be cited as a program. A port takes a witness letter only when it survives in more than one text, or when the text held is not its own (SWP-CDC3100-SPACEWAR66R, a reconstruction). BBN’s copy of the PDP-1 program is a copy, not a port: found, it would be a witness of a PDP-1 version.</p></details>';
    document.body.appendChild(d);
    d.addEventListener('click', function (e) {
      if (e.target === d || e.target.closest('[data-x]')) { d.close(); d.remove(); return; }
      var rx = e.target.closest('[data-rx]'); if (!rx) return;
      var dm = rx.closest('details'); if (dm) dm.open = false;
      if (rx.dataset.rx === 'copy') SW.copyText(SW.refList.text(), 'the list of references');
      else SW.exportDoc(SW.refList.doc(), 'spacewar-source-references', rx.dataset.rx);
    });
    d.addEventListener('close', function () { d.remove(); });
    d.showModal();
  };
  // Every version's and port's reference, for sharing: plain text to paste, or
  // a document (Word, Markdown) that adds the SWHIDs.
  SW.refList = {
    versions: function () { var V = root.SWVersions; return V.VERSIONS.filter(function (v) { return v.build; }).sort(function (a, b) { return a.sort - b.sort; }); },
    head: function () { return 'Spacewar! source references (Spacewar! Research Bench ' + SW.VERSION + ', ' + SW.fmtDate(SW.today()) + ')'; },
    text: function () {
      var L = [SW.refList.head(), '',
        'Form: [REF: SW<version><witness>, <tape>.<lines>], e.g. [REF: SW3.1T, 2.141–146]. Ports: [REF: SWP-<machine>-<program><version or year>].',
        'Witness letters: T punched source tape; L transcription; M modern reassembly or edited source; R reconstruction; B object tape (cited by address).', '',
        'Source code versions'];
      SW.refList.versions().forEach(function (v, n) { L.push((n + 1) + '. ' + SW.refOf(v.id) + '  ' + v.label + ' (' + (v.date || '') + ')' + (SW.MADE[v.id] ? '; this text: ' + SW.MADE[v.id] : '')); });
      L.push('', 'Ports');
      SW.PORTS.forEach(function (r, n) { L.push((n + 1) + '. ' + r[0] + '  ' + r[1] + ', ' + r[2] + '; ' + r[3] + ', ' + r[4]); });
      L.push('', 'Full table with SWHIDs: ' + SW.BASE_URI + ' (Help ▸ Referencing and versions)');
      return L.join('\n');
    },
    doc: function () {
      function ids(files) { return (files || []).map(function (f) { var h = SW.swhidOf(f); return f + (h ? ': ' + h : ''); }).join('; '); }
      return { title: 'Spacewar! source references', subtitle: 'The referencing convention of the Spacewar! Research Bench',
        meta: [['Generated', SW.fmtDate(SW.today()) + ', Spacewar! research bench v' + SW.VERSION], ['Bench', SW.BASE_URI]],
        blocks: [
          { type: 'p', text: 'Form: [REF: SW<version><witness>, <tape>.<lines>], e.g. [REF: SW3.1T, 2.141–146]: SW, the version, a letter for the witness (the surviving text), then the tape and the lines. Shorter forms: [REF: SW3.1T] (version and witness), [REF: SW3.1T, 2] (a whole tape); the tape is left out when a text has only one. By core address: [REF: SW3.1L, @0402–0407]. Ports: [REF: SWP-<machine>-<program><version or year>].' },
          { type: 'table', caption: 'Witness letters', head: ['Letter', 'The witness'], rows: [['T', 'machine-read from the punched source tape'], ['L', 'a transcription: typed text of a listing or a tape'], ['M', 'a modern reassembly or edited source'], ['R', 'a reconstruction'], ['B', 'an object tape (binary), cited by address only']] },
          { type: 'h2', text: 'Source code versions' },
          { type: 'table', head: ['No.', 'Reference', 'Version', 'Version dated', 'This text', 'SWHID of each file'],
            rows: SW.refList.versions().map(function (v, n) { return [String(n + 1), SW.refOf(v.id), v.label, v.date || '', SW.MADE[v.id] || v.medium || '', ids(SW.filesOf(v))]; }) },
          { type: 'h2', text: 'Ports' },
          { type: 'table', head: ['No.', 'Reference', 'Program', 'Machine', 'Where and by whom', 'Date', 'SWHID of each file'],
            rows: SW.PORTS.map(function (r, n) { return [String(n + 1), r[0], r[1], r[2], r[3], r[4], r[5] ? ids(r[5].split(/,\s*/)) : r[6] ? 'no source; catalogue entry only: ' + r[6][0] : 'none held']; }) }
        ] };
    }
  };

  // Instruction glosses (the project's PDP-1 instruction reference).
  SW.glosses = null;
  SW.loadGlosses = function () {
    if (SW.glossP) return SW.glossP;
    SW.glossP = fetch('../assets/pdp1-instructions.json').then(function (r) { return r.json(); })
      .then(function (j) { SW.glosses = j.entries || {}; return SW.glosses; })
      .catch(function () { SW.glosses = {}; return SW.glosses; });
    return SW.glossP;
  };

  // ---------- ghosts (kit/base.js, SW.ghostMatch) ----------
  // lines as keys: comments, spacing and case set aside; blank lines count for nothing
  SW.lineKey = function (t) { return String(t || '').replace(/\/.*$/, '').replace(/\s+/g, ' ').trim().toLowerCase(); };

  // A tag as a reader should see it: the bench's own marks (level:, note:, chapter:, cat:) in words
  SW.tagLabel = function (g) {
    g = String(g || '');
    var m;
    if ((m = /^level:(key|notable|minor)$/.exec(g))) return { key: '★★★ key', notable: '★★ notable', minor: '★ minor' }[m[1]];
    if ((m = /^note:(.+)$/.exec(g))) return 'from note ' + m[1];
    if ((m = /^chapter:(.+)$/.exec(g))) return 'Chapter: ' + m[1];
    if ((m = /^cat:(.+)$/.exec(g))) return 'Category: ' + m[1];
    return g;
  };

  SW.docMeta = function (b) {
    return [
      ['Version', b.v.label], ['Reference', SW.refText(b.v.id)], ['Date', b.v.date], ['Authors', b.v.authors],
      ['Sources', b.parts.map(function (p) { return p.src + (p.role !== 'program' ? ' (' + p.role + ')' : ''); }).join('; ')],
      ['Assembler', V.DIALECTS[b.dialect].label],
      ['Generated', SW.fmtDate(SW.today()) + ', Spacewar! research bench v' + SW.VERSION]
    ];
  };
})(this);
