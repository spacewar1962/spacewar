/*
 * pdp1asm.js - a PDP-1 MACRO assembler for the browser (and Node).
 *
 * A line-by-line port of macro1.c (Gary Messenbrink, Bob Supnik, Phil Budne,
 * simh/simtools, v1.74 2003), the cross-assembler used to rebuild the
 * Spacewar! listings. The port keeps macro1's quirks deliberately, since the
 * point is to reproduce what the historical sources assemble to, and it is
 * checked word for word (and tape byte for tape byte) against the C original.
 *
 * What it adds for the research tool: a map from every assembled word back
 * to the source line (and macro) that produced it, a concordance of symbol
 * definitions and references, and the constants and variables blocks.
 *
 * Deviations from macro1.c:
 *  - CR and CRLF line endings are normalised to LF (macro1 would read a
 *    CR-only file as one long line);
 *  - lines are not split at 94 characters (macro1's fgets buffer);
 *  - a file may declare its title line (opts.title), so the explanatory
 *    header of a modern transcription is skipped rather than assembled;
 *  - an overlined (variable) name never resolves to a macro or pseudo-op
 *    by macro1's three-letter abbreviation rule (2B's \ran vs ranct);
 *  - a macro definition may be written on one line with tab-separated
 *    parts, as the MACRO manual (F-36) permits.
 */
(function (root) {
  'use strict';

  var UNDEFINED = 0, DEFINED = 1, FIXED = 2,
      LABEL = 0o10 | DEFINED, REDEFINED = 0o20 | DEFINED, DUPLICATE = 0o40 | DEFINED,
      PSEUDO = 0o100 | FIXED | DEFINED, EPSEUDO = 0o200 | FIXED | DEFINED,
      MACRO = 0o400 | DEFINED, DEFFIX = DEFINED | FIXED,
      NOTRDEF = (MACRO | PSEUDO | LABEL | FIXED) & ~DEFINED;

  var P_DECIMAL = 0, P_DEFINE = 1, P_FLEX = 2, P_CONSTANTS = 3, P_OCTAL = 4,
      P_REPEAT = 5, P_START = 6, P_CHAR = 7, P_VARIABLES = 8, P_TEXT = 9,
      P_NOINPUT = 10, P_EXPUNGE = 11;

  var SYMLEN = 7, MAC_MAX_ARGS = 20, MAX_CONSTANTS = 10, ADDRESS_FIELD = 0o7777;
  var DIO = 0o320000, JMP = 0o600000, CONCISE_LC = 0o72, CONCISE_UC = 0o74;
  var UC = 0o100, LC = 0o200, BC = LC | UC, BAD = 0o14, CHARBITS = 0o77;

  var PSEUDOS = [
    [PSEUDO, 'consta', P_CONSTANTS], [PSEUDO, 'define', P_DEFINE],
    [PSEUDO, 'repeat', P_REPEAT], [PSEUDO, 'start', P_START],
    [PSEUDO, 'variab', P_VARIABLES], [PSEUDO, 'text', P_TEXT],
    [PSEUDO, 'noinpu', P_NOINPUT], [PSEUDO, 'expung', P_EXPUNGE],
    [EPSEUDO, 'charac', P_CHAR], [EPSEUDO, 'decima', P_DECIMAL],
    [EPSEUDO, 'flexo', P_FLEX], [EPSEUDO, 'octal', P_OCTAL]
  ];

  var PERMANENT = [
    ['and', 0o020000], ['ior', 0o040000], ['xor', 0o060000], ['xct', 0o100000],
    ['lac', 0o200000], ['lio', 0o220000], ['dac', 0o240000], ['dap', 0o260000],
    ['dip', 0o300000], ['dio', 0o320000], ['dzm', 0o340000], ['add', 0o400000],
    ['sub', 0o420000], ['idx', 0o440000], ['isp', 0o460000], ['sad', 0o500000],
    ['sas', 0o520000], ['mul', 0o540000], ['mus', 0o540000], ['div', 0o560000],
    ['dis', 0o560000], ['jmp', 0o600000], ['jsp', 0o620000], ['skip', 0o640000],
    ['cal', 0o160000], ['jda', 0o170000], ['i', 0o010000], ['skp', 0o640000],
    ['law', 0o700000], ['iot', 0o720000], ['opr', 0o760000], ['nop', 0o760000],
    ['ral', 0o661000], ['ril', 0o662000], ['rcl', 0o663000], ['sal', 0o665000],
    ['sil', 0o666000], ['scl', 0o667000], ['rar', 0o671000], ['rir', 0o672000],
    ['rcr', 0o673000], ['sar', 0o675000], ['sir', 0o676000], ['scr', 0o677000],
    ['1s', 0o1], ['2s', 0o3], ['3s', 0o7], ['4s', 0o17], ['5s', 0o37], ['6s', 0o77],
    ['7s', 0o177], ['8s', 0o377], ['9s', 0o777],
    ['sza', 0o640100], ['spa', 0o640200], ['sma', 0o640400], ['szo', 0o641000],
    ['spi', 0o642000], ['szs', 0o640000], ['szf', 0o640000],
    ['clf', 0o760000], ['stf', 0o760010], ['cla', 0o760200], ['hlt', 0o760400],
    ['xx', 0o760400], ['cma', 0o761000], ['clc', 0o761200], ['lat', 0o762200],
    ['cli', 0o764000],
    ['rpa', 0o730001], ['rpb', 0o730002], ['rrb', 0o720030], ['ppa', 0o730005],
    ['ppb', 0o730006], ['tyo', 0o730003], ['tyi', 0o720004], ['dpy', 0o730007],
    ['lsm', 0o720054], ['esm', 0o720055], ['cbs', 0o720056], ['lem', 0o720074],
    ['eem', 0o724074], ['cks', 0o720033]
  ];

  var LOADERBASE = 0o7751;
  var LOADER = [
    0o730002, 0o320000 + LOADERBASE + 0o7, 0o100000 + LOADERBASE + 0o7,
    0o320000 + LOADERBASE + 0o25, 0o730002, 0o320000 + LOADERBASE + 0o26,
    0o730002, 0o000000, 0o210000 + LOADERBASE + 0o7, 0o400000 + LOADERBASE + 0o25,
    0o240000 + LOADERBASE + 0o25, 0o440000 + LOADERBASE + 0o7,
    0o520000 + LOADERBASE + 0o26, 0o600000 + LOADERBASE + 0o6,
    0o200000 + LOADERBASE + 0o25, 0o400000 + LOADERBASE + 0o26, 0o730002,
    0o320000 + LOADERBASE + 0o25, 0o520000 + LOADERBASE + 0o25, 0o760400,
    0o600000 + LOADERBASE
  ];

  var A2F = (function () {
    var t = [
      BAD, BAD, BAD, BAD, BAD, BAD, BAD, BAD,
      BC | 0o75, BC | 0o36, BAD, BAD, BAD, BC | 0o77, BAD, BAD,
      BAD, BAD, BAD, BAD, BAD, BAD, BAD, BAD,
      BAD, BAD, BAD, BAD, BAD, BAD, BAD, BAD,
      BC | 0o00, UC | 0o05, UC | 0o01, UC | 0o04, BAD, BAD, UC | 0o06, UC | 0o02,
      LC | 0o57, LC | 0o55, UC | 0o73, UC | 0o54, LC | 0o33, LC | 0o54, LC | 0o73, LC | 0o21,
      LC | 0o20, LC | 0o01, LC | 0o02, LC | 0o03, LC | 0o04, LC | 0o05, LC | 0o06, LC | 0o07,
      LC | 0o10, LC | 0o11, BAD, BAD, UC | 0o07, UC | 0o33, UC | 0o10, UC | 0o21,
      LC | 0o40, UC | 0o61, UC | 0o62, UC | 0o63, UC | 0o64, UC | 0o65, UC | 0o66, UC | 0o67,
      UC | 0o70, UC | 0o71, UC | 0o41, UC | 0o42, UC | 0o43, UC | 0o44, UC | 0o45, UC | 0o46,
      UC | 0o47, UC | 0o50, UC | 0o51, UC | 0o22, UC | 0o23, UC | 0o24, UC | 0o25, UC | 0o26,
      UC | 0o27, UC | 0o30, UC | 0o31, UC | 0o57, LC | 0o56, UC | 0o55, UC | 0o11, UC | 0o40,
      UC | 0o20, LC | 0o61, LC | 0o62, LC | 0o63, LC | 0o64, LC | 0o65, LC | 0o66, LC | 0o67,
      LC | 0o70, LC | 0o71, LC | 0o41, LC | 0o42, LC | 0o43, LC | 0o44, LC | 0o45, LC | 0o46,
      LC | 0o47, LC | 0o50, LC | 0o51, LC | 0o22, LC | 0o23, LC | 0o24, LC | 0o25, LC | 0o26,
      LC | 0o27, LC | 0o30, LC | 0o31, BAD, UC | 0o56, BAD, UC | 0o03, BC | 0o75
    ];
    return t;
  })();

  function isalpha(c) { return (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z'); }
  function isdigit(c) { return c >= '0' && c <= '9' && c.length === 1; }
  function isalnum(c) { return isalpha(c) || isdigit(c); }
  function ISBLANK(c) { return c === ' ' || c === '\f'; }
  function ISEND(c) { return c === '\0' || c === '\n' || c === '\t'; }
  function ISDONE(c) { return c === '/' || ISEND(c); }
  function ISOVERBAR(c) { return c === '\\' || c === '~'; }

  function splitLines(text) {
    text = text.replace(/\r\n?/g, '\n');
    var out = [], i = 0;
    while (i < text.length) {
      var j = text.indexOf('\n', i);
      if (j < 0) { out.push(text.slice(i) + '\n'); break; }
      out.push(text.slice(i, j + 1));
      i = j + 1;
    }
    return out;
  }

  /*
   * files: [{ name, text, title }] where title (optional, 1-based) is the
   * line holding the tape title; lines before it are skipped.
   */
  function assemble(files, options) {
    options = options || {};
    var inputs = files.map(function (f) {
      var ls = splitLines(f.text || '');
      return { name: f.name, lines: ls, title: f.title || 1, end: Math.min(f.end || ls.length, ls.length) };
    });

    // ---- global state (named as in macro1.c) ----
    var symtab = [];
    var mac_defs = [], mac_count = 0, curmacro = null, nrepeats = 0;
    var line = '', lineno = 0, cc = 0, clc = 0, maxcc = 0;
    var end_of_input = false, errors = 0, error_in_line = false;
    var lexstartprev = 0, lextermprev = 0, lexstart = 0, lexterm = 0, overbar = 0;
    var nconst = 0, lit_count = [], lit_loc = [], noinput = false;
    var nvars = 0, vars_addr = 0, vars_end = 0, nlit = 0, litter = [];
    var pass = 0, radix = 8, start_addr = 0, list_title_set = false;
    var filix = 0, fline = 0;
    var loaderbuf = [], loaderbufcount = 0, loaderbufstart = 0;
    var tape = [], tapeOpen = false;
    var symUndefined = { type: UNDEFINED, name: '', val: 0 };

    // ---- research outputs ----
    var srcFile = 0, srcLine = 0;          // current physical source line
    var words = [];                        // pass-2 punches in order
    var errorList = [];
    var titles = [];
    var xrefDefs = {}, xrefRefs = {};
    var macroInfo = [];                    // per macro index: {name, file, line, args}
    var constBlocks = [], varBlock = null, starts = [];
    var curMacroName = function () {
      return curmacro ? curmacro.defn.name : null;
    };

    function ch(i) { return i < line.length && i >= 0 ? line.charAt(i) : '\0'; }

    // ---- symbol table ----
    function lexemeToName(from, term) {
      var s = '';
      while (from < term && s.length < SYMLEN - 1) {
        var c = ch(from++);
        if (ISOVERBAR(c)) continue;
        s += c;
      }
      return s;
    }

    function lookup(name, type) {
      if (curmacro && curmacro.defn) {
        var a = curmacro.defn.args;
        for (var i = 0; i <= curmacro.defn.nargs; i++)
          if (a[i].name === name) return a[i];
      }
      var lx = 0, rx = symtab.length - 1, best = null, sym;
      while (lx <= rx) {
        var mx = (lx + rx) >> 1;
        sym = symtab[mx];
        if (name < sym.name) rx = mx - 1;
        else if (name > sym.name) lx = mx + 1;
        else {
          if (overbar && !((sym.type & DEFINED) === DEFINED) && pass === 2) {
            sym.type = DEFINED;
            sym.val = vars_addr++;
            sym.variable = true;
            nvars++;
          }
          return sym;
        }
        if (((sym.type & PSEUDO) === PSEUDO || (sym.type & EPSEUDO) === EPSEUDO ||
             (sym.type & MACRO) === MACRO) && name.slice(0, 3) === sym.name.slice(0, 3))
          best = sym;
      }
      // deviation: an overlined name is a variable, never a pseudo/macro abbreviation
      if (best && type === UNDEFINED && !overbar) return best;
      sym = { type: UNDEFINED, name: name, val: 0 };
      symtab.splice(lx, 0, sym);
      if (overbar) nvars++;
      return sym;
    }

    function here() { return { file: srcFile, line: srcLine }; }

    function defineSymbol(name, val, type, start) {
      if (name.length < 1) return symUndefined;
      var sym = lookup(name, type);
      if ((sym.type & DEFINED) === DEFINED && sym.val !== val && (sym.type & NOTRDEF) !== 0) {
        if (pass === 2) {
          errorSymbol('redefined symbol', sym.name, start);
          return sym;
        }
      }
      if (pass === 2 && !sym.dummy) {
        (xrefDefs[sym.name] = xrefDefs[sym.name] || []).push(here());
      }
      sym.val = val & 0o777777;
      sym.type = type;
      return sym;
    }

    function defineLexeme(start, term, val, type) {
      return defineSymbol(lexemeToName(start, term), val, type, start);
    }

    function evalSymbol() {
      var sym = lookup(lexemeToName(lexstart, lexterm), UNDEFINED);
      if (pass === 2 && !sym.dummy && sym.name)
        (xrefRefs[sym.name] = xrefRefs[sym.name] || []).push(here());
      return sym;
    }

    // ---- errors ----
    function record(msg, name, col) {
      if (pass === 2) {
        errors++;
        errorList.push({ file: srcFile, line: srcLine, col: col + 1, message: msg,
                         symbol: name, loc: clc, macro: curMacroName() });
      }
      error_in_line = true;
    }
    function errorSymbol(msg, name, col) { record(msg, name == null ? '' : name, col); }
    function errorLexeme(msg, col) { errorSymbol(msg, lexemeToName(lexstart, lexterm), col); }
    function errorMessage(msg, col) { record(msg, null, col); }

    // ---- lexer ----
    function next(op) {
      lexstartprev = lexstart;
      lextermprev = lexterm;
      var c = ch(cc);
      if (c === ' ') {
        do { c = ch(++cc); } while (c === ' ');
        if (op) cc--;
      }
      overbar = 0;
      lexstart = cc;
      c = ch(cc);
      if (isalnum(c) || ISOVERBAR(c)) {
        if (ISOVERBAR(c)) overbar = 1;
        do {
          c = ch(++cc);
          if (ISOVERBAR(c)) overbar = 1;
        } while (isalnum(c) || ISOVERBAR(c));
      } else if (!ISDONE(c) || c === '\t') {
        cc++;
      }
      lexterm = cc;
    }

    function isLexSymbol() {
      for (var ix = lexstart; ix < lexterm; ix++) if (isalpha(ch(ix))) return true;
      return false;
    }

    function moveToEndOfLine() {
      while (!ISEND(ch(cc))) cc++;
      lexstart = cc; lexterm = cc; lexstartprev = lexstart;
    }

    // ---- input ----
    function readLine() {
      error_in_line = false;
      if (curmacro && curmacro.ptr >= curmacro.defn.body.length) {
        line = curmacro.mac_line;
        cc = lexstartprev = curmacro.mac_cc;
        maxcc = line.length;
        curmacro = curmacro.prev;
        return;
      }
      cc = 0;
      lexstartprev = 0;
      if (curmacro) {
        var body = curmacro.defn.body, s = '', mc;
        do {
          mc = curmacro.ptr < body.length ? body.charAt(curmacro.ptr) : '\0';
          curmacro.ptr++;
          if (mc !== '\0') s += mc;
        } while (!ISEND(mc));
        line = s;
        maxcc = line.length;
        return;
      }
      lineno++;
      for (;;) {
        var inp = inputs[filix];
        if (inp && fline < inp.title - 1) { fline = inp.title - 1; }
        if (inp && fline < inp.end) {
          srcFile = filix; srcLine = fline + 1;
          line = inp.lines[fline++].replace(/\f/g, '');
          maxcc = line.length;
          return;
        }
        filix++;
        fline = 0;
        if (filix < inputs.length) { list_title_set = false; continue; }
        end_of_input = true;
        line = '';
        maxcc = 0;
        return;
      }
    }

    // ---- expressions ----
    function getExprs() {
      var sym = getExpr();
      if (sym.type === PSEUDO) errorMessage('value required', lexstart);
      return sym.val & 0o777777;
    }

    function copy(s) { return { type: s.type, name: s.name, val: s.val }; }

    function getExpr() {
      var sym = evalE();
      for (;;) {
        var space = false, c = ch(lexstart);
        switch (c) {
          case ' ':
            space = true;
            /* falls through */
          case '+':
            next(1);
            if (space && ISEND(ch(lexstart))) return sym;
            sym.val += evalE().val;
            sym.type = DEFINED;
            if (sym.val >= 0o1000000) sym.val = (sym.val + 1) & 0o777777;
            continue;
          case '-':
            next(1);
            sym.val += evalE().val ^ 0o777777;
            sym.type = DEFINED;
            if (sym.val >= 0o1000000) sym.val = (sym.val + 1) & 0o777777;
            continue;
          case '*':
            next(1);
            sym.val = (sym.val * evalE().val) | 0;
            sym.type = DEFINED;
            if (sym.val >= 0o1000000) sym.val = (sym.val + 1) & 0o777777;
            continue;
          case '&':
            next(1);
            sym.val &= evalE().val;
            sym.type = DEFINED;
            continue;
          case '!':
            next(1);
            sym.val |= evalE().val;
            sym.type = DEFINED;
            continue;
          case '/': case ')': case ']': case ':': case ',':
            break;
          case '=':
            errorMessage('illegal equals', lexstart);
            moveToEndOfLine();
            sym.val = 0;
            break;
          default:
            if (!ISEND(c)) {
              errorMessage('illegal expression', lexstart);
              moveToEndOfLine();
              sym.val = 0;
            }
        }
        break;
      }
      return sym;
    }

    function nextfiodec(st, delim) {
      var c;
      for (;;) {
        if (cc >= maxcc) {
          if (delim === -1) return -1;
          readLine();
          if (end_of_input) return -1;
        }
        c = ch(cc);
        if (c === '\n') c = '\r';
        break;
      }
      if (delim !== -1 && c === delim) {
        if (st.ccase === LC) { cc++; return -1; }
        st.ccase = LC;
        return CONCISE_LC;
      }
      var code = c.charCodeAt(0);
      if (code > 0o177) { errorMessage('illegal character', cc); code = 0o40; }
      code = A2F[code & 0o177];
      if (code === BAD) { errorMessage('illegal character', cc); code = 0; }
      if (!(code & st.ccase)) {
        st.ccase ^= BC;
        return st.ccase === LC ? CONCISE_LC : CONCISE_UC;
      }
      cc++;
      return code & CHARBITS;
    }

    function flex() {
      if (ch(lexstart) === ' ') next(0);
      var w = 0, ccase = LC;
      for (var shift = 12; shift >= 0; shift -= 6) {
        if (lexstart >= maxcc) break;
        var c = ch(lexstart), code;
        if (c === '\t' || c === '\n') {
          if (ccase === LC) break;
          code = CONCISE_LC;
        } else {
          code = c.charCodeAt(0);
          if (code > 0o177) { errorMessage('illegal character', lexstart); code = 0; }
          code = A2F[code & 0o177];
          if (code === BAD) { errorMessage('illegal character', lexstart); code = 0; }
          if (!(code & ccase)) {
            ccase ^= BC;
            code = ccase === LC ? CONCISE_LC : CONCISE_UC;
          } else {
            lexstart++;
          }
        }
        w |= (code & CHARBITS) << shift;
      }
      return w;
    }

    function getChar() {
      if (cc >= maxcc) return 0;
      var pos = ch(cc++);
      if (pos !== 'l' && pos !== 'm' && pos !== 'r') {
        errorMessage('illegal character', lexstart);
        return 0;
      }
      if (cc >= maxcc) return 0;
      var code = ch(cc++).charCodeAt(0);
      if (code > 0o177) { errorMessage('illegal character', lexstart); code = 0; }
      code = A2F[code];
      if (code === BAD) { errorMessage('illegal character', lexstart); code = 0; }
      if (!(code & LC)) { code = CONCISE_UC; cc--; }
      code &= CHARBITS;
      return pos === 'l' ? code << 12 : pos === 'm' ? code << 6 : code;
    }

    function eval2() {
      var ev = { type: DEFINED, name: '', val: 0 }, val = 0, sym;
      if (isLexSymbol()) {
        sym = evalSymbol();
        if ((sym.type & DEFINED) !== DEFINED) {
          if (pass === 2) errorSymbol('undefined symbol', sym.name, lexstart);
          next(1);
          return copy(sym);
        } else if ((sym.type & PSEUDO) === PSEUDO || (sym.type & EPSEUDO) === EPSEUDO) {
          switch (sym.val) {
            case P_DECIMAL: radix = 10; ev.type = PSEUDO; ev.val = 0; break;
            case P_OCTAL: radix = 8; ev.type = PSEUDO; ev.val = 0; break;
            case P_FLEX: next(1); ev.val = flex(); break;
            case P_CHAR: next(1); ev.val = getChar(); break;
            default:
              errorSymbol('value required', sym.name, lexstart);
              ev.type = sym.type; ev.val = 0;
          }
          next(1);
          return ev;
        } else if ((sym.type & MACRO) === MACRO) {
          if (pass === 2) errorSymbol('misplaced symbol', sym.name, lexstart);
          ev.type = sym.type; ev.val = 0;
          next(1);
          return ev;
        } else {
          next(1);
          return copy(sym);
        }
      } else if (isdigit(ch(lexstart))) {
        var from = lexstart;
        val = 0;
        while (from < lexterm) {
          if (isdigit(ch(from))) {
            var digit = ch(from++).charCodeAt(0) - 48;
            if (digit >= radix) { errorLexeme('number not in current radix', from - 1); val = 0; break; }
            val = val * radix + digit;
          } else {
            errorLexeme('numeric syntax of', lexstart);
            val = 0;
            break;
          }
        }
        next(1);
        ev.val = val;
        return ev;
      } else {
        switch (ch(lexstart)) {
          case '.':
            val = clc;
            next(1);
            break;
          case '(':
            next(1);
            val = getExprs();
            if (ch(lexstart) === ')') next(1);
            ev.val = literal(val);
            ev.literal = true;
            return ev;
          case '[':
            next(1);
            ev.val = getExprs();
            if (ch(lexstart) === ']') next(1);
            else errorMessage('illegal character', lexstart);
            return ev;
          default:
            if (ch(lexstart) === '=') { errorMessage('illegal equals', lexstart); moveToEndOfLine(); }
            else errorMessage('illegal character', lexstart);
            val = 0;
            next(1);
        }
      }
      ev.val = val;
      return ev;
    }

    function evalE() {
      var sym;
      switch (ch(lexstart)) {
        case '-':
          next(1);
          sym = eval2();
          sym.val ^= 0o777777;
          break;
        case '+':
          next(1);
          /* falls through */
        default:
          sym = eval2();
      }
      return sym;
    }

    function incrementClc() { clc = (clc + 1) & ADDRESS_FIELD; return clc; }

    // ---- output ----
    function punchObject(v) { if (tapeOpen) tape.push(v & 0o377); }
    function punchTriplet(v) {
      punchObject(((v >> 12) & 0o77) | 0o200);
      punchObject(((v >> 6) & 0o77) | 0o200);
      punchObject((v & 0o77) | 0o200);
    }
    function punchLeader(count) {
      count = count === 0 ? 240 : count;
      if (tapeOpen) for (var i = 0; i < count; i++) tape.push(0);
    }
    function punchLocObjectRIM(loc, val) { punchTriplet(DIO | loc); punchTriplet(val); }
    function punchLoader() {
      if (noinput) return;
      for (var i = 0; i < LOADER.length; i++) punchLocObjectRIM(LOADERBASE + i, LOADER[i]);
      punchTriplet(JMP | LOADERBASE);
    }
    function flushLoader() {
      if (loaderbufcount === 0) return;
      var sum = 0;
      function PW(x) { sum += x; punchTriplet(x); }
      PW(DIO | loaderbufstart);
      PW(DIO | (loaderbufstart + loaderbufcount));
      for (var i = 0; i < loaderbufcount; i++) PW(loaderbuf[i]);
      if (sum & ~0o777777) sum = (sum & 0o777777) + Math.floor(sum / 0o1000000);
      if (sum & 0o1000000) sum++;
      PW(sum);
      punchLeader(5);
      loaderbufcount = 0;
    }
    function punchLocObject(loc, val) {
      if (!options.rim) {
        if ((loc & 0o77) === 0 ||
            (loaderbufcount > 0 && loc !== loaderbufstart + loaderbufcount))
          flushLoader();
        if (loaderbufcount === 0) loaderbufstart = loc;
        loaderbuf[loaderbufcount++] = val;
      } else {
        punchLocObjectRIM(loc, val);
      }
    }
    var punchKind = null;
    function punchOutObject(loc, val) {
      if (pass === 2) {
        words.push({ loc: loc, val: val, file: srcFile, line: srcLine,
                     macro: curMacroName(), kind: punchKind });
      }
      punchLocObject(loc, val);
    }

    function literal(value) {
      if (nconst >= MAX_CONSTANTS) throw new Error('too many constants blocks');
      if (pass === 1) {
        lit_count[nconst] = (lit_count[nconst] || 0) + 1;
        return lit_count[nconst];
      }
      for (var i = 0; i < nlit; i++)
        if (litter[i] === value) return (lit_loc[nconst] || 0) + i;
      litter[nlit] = value;
      return (lit_loc[nconst] || 0) + nlit++;
    }

    // ---- macros ----
    function invokeMacro(index) {
      var mdp = mac_defs[index];
      if (!mdp || mdp.body.length === 0) return 0;
      while (ISBLANK(ch(lexstart))) next(0);
      mdp.args[0].val = clc;
      var jx;
      for (jx = 1; !ISDONE(ch(lexstart)) && jx <= MAC_MAX_ARGS;) {
        next(0);
        if (ISDONE(ch(lexstart))) break;
        if (ch(lexstart) === ',') next(0);
        while (ISBLANK(ch(lexstart))) next(0);
        if (ISDONE(ch(lexstart))) break;
        var val = getExprs();
        if (jx <= mdp.nargs) mdp.args[jx].val = val;
        jx++;
      }
      while (jx <= mdp.nargs) mdp.args[jx++].val = 0;
      curmacro = { mac_line: line, mac_cc: cc, ptr: 0, defn: mdp, prev: curmacro };
      return 1;
    }

    function defineMacro() {
      if (nrepeats) { errorLexeme('Define in a repeat', lexstartprev); return; }
      while (ch(lexstart) === ' ' || ch(lexstart) === '\t') next(0);
      if (ISEND(ch(lexstart))) {
        readLine();
        next(0);
        while (ch(lexstart) === ' ' || ch(lexstart) === '\t') next(0);
      }
      var count = 0, index = 0, error = false, lexstartsave = lexstart, args = [];
      var defAt = here(), value;
      while (!ISDONE(ch(lexstart)) && count < MAC_MAX_ARGS) {
        if (!isalnum(ch(lexstart)) && index === 0) index = lexstart;
        args[count++] = lexemeToName(lexstart, lexterm);
        if (ch(lexterm) === ',') next(0);
        next(0);
        if (ch(lexstart) === ' ') next(0);
      }
      if (count === 0) { errorMessage('No name following DEFINE', lexstartsave); error = true; }
      else if (index) { errorMessage('Bad dummy argument following DEFINE', index); error = true; }
      else {
        value = mac_count++;
        defineSymbol(args[0], value, MACRO, lexstartsave);
      }
      var body = '', closed = false;
      // deviation: MACRO (F-36) lets the parts of a definition be separated
      // by tabs on one line, e.g. "define mult Z<tab>jda mpy<tab>lac Z<tab>term"
      var segs = line.slice(lexstart).split('\t');
      for (var sg = 0; sg < segs.length && !error; sg++) {
        var seg = segs[sg].replace(/\n$/, '').replace(/^ +| +$/g, '');
        if (!seg) continue;
        if (seg.charAt(0) === '/') break;
        if (seg.slice(0, 4) === 'term') { closed = true; break; }
        body += '\t' + seg + '\n';
      }
      if (closed) { cc = maxcc = line.length; lexstart = lexterm = cc; }
      for (; !closed;) {
        readLine();
        if (end_of_input) break;
        next(0);
        while (ch(lexstart) === ' ' || ch(lexstart) === '\t') next(0);
        var termin = lexemeToName(lexstart, lexterm);
        if (termin.slice(0, 4) === 'term') break;
        if (!error) body += line;
      }
      if (error) return;
      if (options.defVars) {
        // MACRO (1962-63) allots an overlined variable when it first reads
        // it, which for a macro body is at definition, not at expansion.
        var saveOb = overbar, re = /[\\~]+([A-Za-z0-9\\~]+)|([A-Za-z0-9]+)[\\~]/g, mm;
        var dummies = args.slice(1);
        body.split('\n').forEach(function (bl) {
          bl = bl.replace(/\/.*$/, '');
          while ((mm = re.exec(bl))) {
            var nm = (mm[0]).replace(/[\\~]/g, '').slice(0, SYMLEN - 1);
            if (dummies.indexOf(nm) >= 0 || !isalpha(nm.replace(/[0-9]/g, '').charAt(0) || '0')) continue;
            overbar = 1;
            lookup(nm, UNDEFINED);
          }
        });
        overbar = saveOb;
      }
      var mdp = { body: body, nargs: count - 1, args: [], name: args[0] };
      mdp.args.push({ type: DEFINED, name: 'R', val: 0, dummy: true });
      for (var i = 1; i <= mdp.nargs; i++)
        mdp.args.push({ type: DEFINED, name: args[i], val: 0, dummy: true });
      mac_defs[value] = mdp;
      if (pass === 2) {
        macroInfo.push({ name: args[0], args: args.slice(1), file: defAt.file,
                         line: defAt.line, endLine: srcLine, body: body });
      }
    }

    function variables() {
      vars_addr = clc;
      vars_end = clc = (clc + nvars) & ADDRESS_FIELD;
      if (pass === 2) varBlock = { start: vars_addr, end: vars_end, file: srcFile, line: srcLine };
    }

    function text() {
      var delim;
      do {
        if (cc === maxcc) return;
        delim = ch(cc++);
      } while (delim === ' ');
      var w = 0, count = 0, st = { ccase: LC };
      punchKind = 'text';
      for (;;) {
        var c = nextfiodec(st, delim);
        if (c === -1) break;
        w |= c << ((2 - count) * 6);
        if (++count === 3) {
          punchOutObject(clc, w);
          incrementClc();
          count = w = 0;
        }
      }
      if (count > 0) { punchOutObject(clc, w); incrementClc(); }
      punchKind = null;
    }

    function constants() {
      if (pass === 1) {
        lit_loc[nconst] = clc;
        for (var i = 0; i < (lit_count[nconst] || 0); i++) incrementClc();
        nconst++;
        return;
      }
      var base = clc, n = lit_count[nconst] || 0;
      punchKind = 'constant';
      for (var j = 0; j < n; j++) {
        if (j < nlit) punchOutObject(clc, litter[j] & 0o777777);
        incrementClc();
      }
      punchKind = null;
      constBlocks.push({ start: base, count: n, used: Math.min(nlit, n), file: srcFile, line: srcLine });
      nconst++;
      nlit = 0;
    }

    function pseudo(val) {
      var count, repeatstart;
      switch (val) {
        case P_CONSTANTS: next(0); constants(); break;
        case P_VARIABLES: next(0); variables(); break;
        case P_DEFINE: next(0); defineMacro(); return false;
        case P_REPEAT:
          next(0);
          count = getExprs() & ADDRESS_FIELD;
          if (ch(lexstart) === ',') next(0);
          nrepeats++;
          repeatstart = lexstart;
          while (count-- > 0) {
            cc = repeatstart;
            processLine();
          }
          cc = maxcc;
          nrepeats--;
          return false;
        case P_START:
          next(0);
          flushLoader();
          if (!ISDONE(ch(lexstart))) {
            if (ch(lexstart) === ' ') next(0);
            start_addr = getExprs() & ADDRESS_FIELD;
            next(0);
            punchTriplet(JMP | start_addr);
            if (pass === 2) starts.push({ addr: start_addr, file: srcFile, line: srcLine });
          }
          list_title_set = false;
          return false;
        case P_TEXT: text(); break;
        case P_NOINPUT: next(0); noinput = true; break;
        case P_EXPUNGE:
          next(0);
          if (pass === 1) symtab = [];
          break;
      }
      return true;
    }

    // ---- line processing ----
    function processLine() {
      if (!list_title_set) {
        var t = line.replace(/\n.*$/, '');
        if (t.length) {
          list_title_set = true;
          if (pass === 2) titles.push({ file: srcFile, line: srcLine, text: t.replace(/\s+$/, '') });
        }
        return;
      }
      for (;;) {
        var jx, evalue;
        next(0);
        if (end_of_input) return;
        if (ISEND(ch(lexstart))) {
          if (ch(lexstart) !== '\t') return;
          continue;
        }
        if (ch(lexstart) === '/') return;

        for (jx = lexstart; jx < maxcc; jx++)
          if (ISBLANK(ch(jx)) || ISDONE(ch(jx))) break;
        if (ch(jx) === '/') {
          var newclc = getExprs();
          if (!error_in_line) clc = newclc;
          cc = jx + 1;
          next(0);
          continue;
        }

        switch (ch(lexterm)) {
          case ',':
            if (isLexSymbol()) {
              var lsym = lookup(lexemeToName(lexstart, lexterm), UNDEFINED);
              var lval = curmacro ? clc - curmacro.defn.args[0].val : clc;
              if ((lsym.type & DEFINED) === DEFINED) {
                if (lsym.val !== lval && pass === 2) errorSymbol('duplicate label', lsym.name, lexstart);
                lsym.type |= DUPLICATE;
              }
              defineLexeme(lexstart, lexterm, lval, LABEL);
            } else if (isdigit(ch(lexstart))) {
              var i, v = 0;
              for (i = lexstart; i < lexterm; i++) {
                if (isdigit(ch(i))) {
                  var d = ch(i).charCodeAt(0) - 48;
                  if (d >= radix) { errorLexeme('number not in current radix', i); v = 0; break; }
                  v = v * radix + d;
                } else {
                  errorLexeme('numeric syntax of', lexstart);
                  v = 0;
                  break;
                }
              }
              if (i === lexterm && clc !== v && pass === 2) errorLexeme('duplicate label', lexstart);
            } else {
              errorLexeme('label syntax', lexstart);
            }
            next(0);
            continue;
          case '=':
            if (isLexSymbol()) {
              var start = lexstart, term = lexterm;
              next(0);
              next(0);
              var dv = getExprs();
              defineLexeme(start, term, dv, DEFINED);
            } else {
              errorLexeme('symbol syntax', lexstartprev);
              next(0);
              next(0);
              getExprs();
            }
            continue;
        }

        if (isLexSymbol()) {
          var sym = evalSymbol();
          if ((sym.type & MACRO) === MACRO) {
            if (!invokeMacro(sym.val)) next(0);
            continue;
          } else if ((sym.type & PSEUDO) === PSEUDO) {
            pseudo(sym.val & 0o777777);
            continue;
          }
        }

        evalue = getExpr();
        if (evalue.type !== PSEUDO) {
          if (ch(lexstart) === ',') {
            if (evalue.val !== clc && pass === 2) errorLexeme('duplicate label', lexstart);
          } else if (ch(lexstart) === '/') {
            clc = evalue.val;
            next(0);
          } else {
            punchOutObject(clc, evalue.val & 0o777777);
            incrementClc();
          }
        }
      }
    }

    function onePass() {
      clc = 4; start_addr = 0; nconst = 0; nvars = 0;
      curmacro = null;
      mac_defs = []; mac_count = 0;
      lineno = 0; list_title_set = false; radix = 8;
      end_of_input = false; filix = 0; fline = 0;
      for (;;) {
        readLine();
        if (end_of_input) return;
        processLine();
      }
    }

    // ---- main ----
    pass = 0;
    PSEUDOS.forEach(function (p) { defineSymbol(p[1], p[2], p[0], 0); });
    PERMANENT.forEach(function (p) { defineSymbol(p[0], p[1], DEFFIX, 0); });
    pass = 1;
    onePass();
    var errorsPass1 = errors;
    tapeOpen = true;
    punchLeader(0);
    if (!options.rim) { punchLoader(); punchLeader(5); }
    errors = 0;
    pass = 2;
    onePass();
    punchLeader(1);

    // ---- results ----
    var memory = {};
    var byLine = inputs.map(function (inp) { return new Array(inp.lines.length + 1); });
    words.forEach(function (w) {
      memory[w.loc] = w;
      var l = byLine[w.file];
      (l[w.line] = l[w.line] || []).push(w);
    });
    var symbols = symtab.filter(function (s) {
      return !(s.type & FIXED) && !((s.type & MACRO) === MACRO) && s.name;
    }).map(function (s) {
      return { name: s.name, val: s.val, defined: (s.type & DEFINED) === DEFINED,
               label: (s.type & LABEL) === LABEL, variable: !!s.variable,
               defs: xrefDefs[s.name] || [], refs: xrefRefs[s.name] || [] };
    });
    var permanent = {};
    PERMANENT.forEach(function (p) { permanent[p[0]] = p[1]; });
    return {
      files: inputs.map(function (i) { return { name: i.name, lines: i.lines, title: i.title }; }),
      words: words,
      memory: memory,
      byLine: byLine,
      symbols: symbols,
      macros: macroInfo,
      errors: errorList,
      errorCount: errors,
      errorsPass1: errorsPass1,
      titles: titles,
      starts: starts,
      start: starts.length ? starts[starts.length - 1].addr : null,
      constants: constBlocks,
      variables: varBlock,
      tape: tape,
      permanent: permanent
    };
  }

  // Read a macro1 block-loader tape (or plain RIM) into a memory map.
  function readTape(bytes) {
    var p = 0, mem = {}, start = null;
    function getw() {
      var w = 0;
      for (var i = 0; i < 3;) {
        if (p >= bytes.length) return -1;
        var c = bytes[p++];
        if (c & 0o200) { w = (w << 6) | (c & 0o77); i++; }
      }
      return w;
    }
    // RIM section: dio/xct pairs until jmp
    var loaderMem = {};
    for (;;) {
      var w = getw();
      if (w === -1) return { memory: mem, start: start };
      if ((w & 0o760000) === JMP) { break; }
      if ((w & 0o760000) !== DIO) return { memory: mem, start: start, bad: true };
      loaderMem[w & 0o7777] = getw();
    }
    var usesLoader = loaderMem[LOADERBASE] === 0o730002;
    if (!usesLoader) {
      // pure RIM tape: the dio pairs are the program
      return { memory: loaderMem, start: null, rim: true };
    }
    for (;;) {
      var s = getw();
      if (s === -1) break;
      if ((s & 0o760000) === JMP) { start = s & 0o7777; break; }
      var e = getw();
      var a = s & 0o7777, b = e & 0o7777;
      for (; a < b; a++) mem[a] = getw();
      getw(); // checksum
    }
    return { memory: mem, start: start };
  }

  var api = { assemble: assemble, readTape: readTape, splitLines: splitLines };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PDP1Asm = api;
})(this);
