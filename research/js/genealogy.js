/*
 * genealogy.js - software genealogy for the Spacewar! variorum.
 *
 * Tracks how MACRO source is retained, moved, lightly edited, added or
 * removed between versions, at three granularities (line, routine,
 * section), and renders the result as SVG strings (alluvial flow, block
 * map, similarity heatmap, dendrogram). Pure functions, no DOM, no deps;
 * works in the browser (window.SWGenealogy) and in Node (require).
 *
 * Pipeline:
 *   prepare(id, label, sort, parts)  -> text  (parsed program lines)
 *   units(text, granularity)         -> units (line / routine / section)
 *   compare(a, b, opts)              -> pairs + summary (b's ancestry in a)
 *   matrix(texts), tree(matrix)      -> similarity matrix, UPGMA dendrogram
 *   lineage(texts, target), flows(texts)
 *   svgAlluvial / svgBlockMap / svgMatrix / svgTree
 *
 * Matching (one-to-one, greedy, no Hungarian step):
 *   1. LCS over unit keys: identical units in common order = 'retained'.
 *   2. Identical keys outside the LCS = 'moved' (nearest relative position).
 *   3. Remaining units: candidates from an IDF-weighted inverted index
 *      (top-k) plus the unmatched A units lying in the same LCS "gap";
 *      similarity >= threshold, best-first = 'edited'.
 *   4. The rest: 'added' (B only) / 'removed' (A only).
 * The comparison is a heuristic reading aid, not a proof of descent.
 */
(function (root) {
  'use strict';

  var STATUSES = ['retained', 'moved', 'edited', 'added', 'removed'];
  var COLORS = {
    retained: 'var(--g-retained, #6cf2ff)',
    moved: 'var(--g-moved, #c77dff)',
    edited: 'var(--g-edited, #ffd166)',
    added: 'var(--g-added, #7bd88f)',
    removed: 'var(--g-removed, #ff6b6b)',
    text: 'var(--g-text, #cfd8dc)',
    muted: 'var(--g-muted, #78909c)',
    stroke: 'var(--g-stroke, #455a64)',
    box: 'var(--g-box, #263238)',
    heat: 'var(--g-heat, #6cf2ff)',
    line: 'var(--g-line, #90a4ae)'
  };
  var FONT = 'font-family="var(--g-font, ui-monospace, Menlo, Consolas, monospace)"';

  /* ------------------------------------------------------------------ */
  /* Parsing                                                             */
  /* ------------------------------------------------------------------ */

  function splitLines(text) {
    var s = String(text).replace(/\r\n?/g, '\n');
    if (s.length && s.charAt(s.length - 1) === '\n') s = s.slice(0, -1);
    return s.split('\n');
  }

  // Overbar marks (\x, ~x, leading .x before a letter) removed, lower case,
  // whitespace collapsed and dropped around commas.
  function normalize(s) {
    return String(s).toLowerCase()
      .replace(/[\\~]/g, '')
      .replace(/(^|[^a-z0-9.])\.([a-z])/g, '$1$2')
      .replace(/\s+/g, ' ')
      .replace(/ ?, ?/g, ',')
      .replace(/^ | $/g, '');
  }

  function normComment(s) {
    return String(s).toLowerCase().replace(/\s+/g, ' ').replace(/^ | $/g, '');
  }

  /*
   * parseLine(s) -> {labels, code, comment, kind}
   * A '/' directly after a non-blank character is a location assignment
   * ("3/", ". 20/"), part of the code; any other '/' starts the comment.
   * Labels are "name," tokens at the very start of the line (no indent),
   * possibly several ("tno,  6,").
   */
  function parseLine(s) {
    s = String(s).replace(/[\r\n]+$/, '');
    if (/^[\s\f\v]*$/.test(s)) return { labels: [], code: '', comment: '', kind: 'blank' };
    var ci = -1;
    for (var i = 0; i < s.length; i++) {
      if (s.charAt(i) !== '/') continue;
      if (i === 0 || /\s/.test(s.charAt(i - 1))) { ci = i; break; }
    }
    var codePart = ci < 0 ? s : s.slice(0, ci);
    var comment = ci < 0 ? '' : s.slice(ci + 1).replace(/^\s+|\s+$/g, '');
    var labels = [];
    var m, rest = codePart;
    if (!/^\s/.test(rest)) {
      while ((m = /^([A-Za-z0-9.~\\]+)[ \t]*,[ \t]*/.exec(rest))) {
        labels.push(m[1]);
        rest = rest.slice(m[0].length);
      }
    }
    var code = rest.replace(/^\s+|\s+$/g, '');
    var kind = (code || labels.length) ? 'code' : (comment || ci >= 0 ? 'comment' : 'blank');
    return { labels: labels, code: code, comment: comment, kind: kind };
  }

  var TITLE_RE = /^\s*(spacewar|scorer)\b/i;

  /*
   * prepare(versionId, label, sort, parts, opts) -> text
   * parts: loaded parts from SWVersions.load ({src, role, raw, text, title, end}).
   * Only role === 'program' parts unless opts.includeSupplied. Lines from
   * each part's title line to its end (inclusive); header lines skipped.
   * The (possibly normalised) .text is parsed, .raw is kept for display.
   */
  function prepare(versionId, label, sort, parts, opts) {
    opts = opts || {};
    var lines = [];
    (parts || []).forEach(function (part, pi) {
      if (part.role !== 'program' && !opts.includeSupplied) return;
      var tl = splitLines(part.text != null ? part.text : part.raw);
      var rl = splitLines(part.raw != null ? part.raw : part.text);
      var from = Math.max(1, part.title || 1), to = Math.min(tl.length, part.end || tl.length);
      var afterStart = false;
      for (var n = from; n <= to; n++) {
        var t = tl[n - 1];
        var p = parseLine(t);
        var isTitle = n === from || (TITLE_RE.test(t) && !/^\s*\//.test(t)) ||
                      (afterStart && p.kind !== 'blank');
        if (isTitle && p.kind !== 'blank') {
          p = { labels: [], code: t.replace(/^\s+|\s+$/g, ''), comment: '', kind: 'title' };
          afterStart = false;
        } else if (p.kind === 'code' && /^start\b/i.test(p.code)) afterStart = true;
        var lab = p.labels.join(', ');
        var norm = p.kind === 'title' ? '' :
          normalize((p.labels.length ? p.labels.join(',') + ',' : '') + p.code);
        lines.push({ file: part.src, part: pi, n: n, raw: (rl[n - 1] || '').replace(/\r$/, ''),
                     label: p.labels[0] || '', labels: p.labels, code: p.code,
                     comment: p.comment, norm: norm, cnorm: normComment(p.comment),
                     kind: p.kind });
      }
    });
    return { id: versionId, label: label || versionId, sort: sort || 0, lines: lines };
  }

  /* ------------------------------------------------------------------ */
  /* Units                                                               */
  /* ------------------------------------------------------------------ */

  function lineKey(l, withComments) {
    return withComments && l.cnorm ? l.norm + ' /' + l.cnorm : l.norm;
  }

  function tokenize(s) {
    return s.match(/[a-z0-9]+|[^a-z0-9 ]/g) || [];
  }

  function isDefine(l) { return l.kind === 'code' && /^defin[a-z]*( |$)/.test(l.norm); }
  function isTerm(l) { return l.kind === 'code' && /^term[a-z]*$/.test(l.norm); }
  function words(s, n) { return s.split(/\s+/).filter(Boolean).slice(0, n).join(' '); }

  // Macro name for a define line at index i.
  function macroName(lines, i) {
    var m = /^defin[a-z]* +([a-z0-9]+)/.exec(lines[i].norm);
    if (m) return m[1];
    for (var k = i + 1; k < lines.length && k < i + 4; k++) {
      if (lines[k].kind === 'code') return (lines[k].code.split(/\s+/)[0] || '').toLowerCase();
    }
    return '?';
  }

  // Build a unit from line range [s, e].
  function makeUnit(text, s, e, name, kind, o) {
    var L = text.lines, keys = [], idx = [], cks = [];
    for (var i = s; i <= e; i++) {
      var l = L[i];
      if (l.kind === 'code') { keys.push(lineKey(l, o.withComments)); idx.push(i); }
      else if (l.kind === 'comment' && l.cnorm) cks.push('/' + l.cnorm);
    }
    var codeLines = keys.length;
    if (!keys.length && cks.length) keys = cks; // comment-only unit: compare its words
    var header = '';
    for (i = s; i <= e; i++) if (L[i].kind === 'comment' && L[i].comment) { header = L[i].comment; break; }
    return { id: text.id + ':' + kind + ':' + s, name: name, kind: kind, start: s, end: e,
             file: L[s].file, n0: L[s].n, n1: L[e].n, lines: Math.max(1, codeLines),
             codeLines: codeLines, header: header, keys: keys, lineIdx: idx,
             codeKey: keys.join('\n'), tokens: null };
  }

  function lineUnits(text, o) {
    var out = [];
    text.lines.forEach(function (l, i) {
      if (l.kind === 'code' || (o.commentLines && l.kind === 'comment' && l.cnorm)) {
        var u = makeUnit(text, i, i, l.label || l.code || l.comment, 'line', o);
        u.tokens = tokenize(u.codeKey);
        out.push(u);
      }
    });
    return out;
  }

  // Build units from sorted start indices; each unit runs to the next start.
  function unitsFromStarts(text, starts, names, kind, o) {
    var L = text.lines, out = [];
    for (var k = 0; k < starts.length; k++) {
      var s = starts[k], e = (k + 1 < starts.length ? starts[k + 1] : L.length) - 1;
      while (e > s && L[e].kind === 'blank') e--;          // trim trailing blanks
      var u = makeUnit(text, s, e, names[k], kind, o);
      u.tokens = u.keys.slice();
      out.push(u);
    }
    return out;
  }

  // Walk back from a start line over blank/comment lines to include the
  // routine's comment header (not past `floor`), trimming leading blanks.
  function headerStart(L, s, floor) {
    var k = s - 1;
    while (k > floor && (L[k].kind === 'blank' || L[k].kind === 'comment')) k--;
    var b = k + 1;
    while (b < s && L[b].kind === 'blank') b++;
    return b;
  }

  /*
   * Routine: a labelled line after a comment-only line, or one the code above
   * cannot fall into (after a jmp, say), a `define`, a title or a new part
   * starts a routine; its comment header above (up to the previous code line)
   * belongs to it. Labels inside a macro body do not start routines.
   * Blank lines do not count: they are layout, and transcriptions of one
   * program differ in them (3.1 has a blank line inside sqt that the 4.0
   * listing lacks, which split the routine in one version and not the other).
   */
  function routineUnits(text, o) {
    var L = text.lines, starts = [], names = [], inDef = false, last = -1;
    for (var i = 0; i < L.length; i++) {
      var l = L[i], prev = i > 0 ? L[i - 1] : null, pnb = null;
      for (var q = i - 1; q >= 0 && L[q].part === l.part; q--) if (L[q].kind !== 'blank') { pnb = L[q]; break; }
      var name = null;
      if (l.kind === 'title' || !prev || prev.part !== l.part) name = l.kind === 'title' ? words(l.code, 4) : null;
      if (isDefine(l)) { name = 'define ' + macroName(L, i); inDef = true; }
      else if (!inDef && l.kind === 'code' && l.labels.length && prev &&
               ((pnb && pnb.kind === 'comment') ||
                (o.flowStarts !== false && flowStart(L, i)))) {
        name = l.labels.filter(function (x) { return !/^\d+$/.test(x); })[0] || l.labels[0];
      }
      if (inDef && isTerm(l)) inDef = false;
      var first = !prev || prev.part !== l.part || l.kind === 'title';
      if (name === null && !first && i !== 0) continue;
      var s = first ? i : headerStart(L, i, last);
      if (starts.length && s <= starts[starts.length - 1]) s = starts[starts.length - 1] + 1;
      if (s > i) s = i;
      if (name === null) name = firstWords(L, i);
      if (starts.length && starts[starts.length - 1] === s) continue;
      starts.push(s); names.push(name); last = i;
    }
    // Units without an explicit name: name from their first comment words.
    return unitsFromStarts(text, starts, names, 'routine', o).map(function (u) {
      if (!u.name) u.name = u.header ? words(u.header, 5) : '(unnamed)';
      return u;
    });
  }

  var SKIP_RE = /^(sza|spa|sma|szl|szo|szf|szs|spi|skp|sas|sad|isp|clo|spq|szm|sni|snl)\b/;
  // True if line i cannot be reached by falling through from the code line
  // above it: that line is a location assignment ("40/"), the end of a
  // macro definition, or an unconditional jmp not preceded by a skip.
  // A plain data word, such as `sq1, 0`: a routine's own storage.
  function isData(l) { return !!l && l.kind === 'code' && /^-?[0-7]+$/.test(String(l.code).replace(/\s+/g, '')); }
  // Where the flow of control begins a routine (a comment above also does, in
  // routineUnits). Storage after a routine's last jump stays with that routine
  // (sqt's sq1 and sq2). A switch from data back to code is not a boundary:
  // the constants table (tno … hd1) mixes instructions and numbers throughout.
  function flowStart(L, i) {
    return !isData(L[i]) && noFallThrough(L, i);
  }

  function noFallThrough(L, i) {
    var k = i - 1;
    while (k >= 0 && L[k].kind !== 'code' && L[k].kind !== 'title') k--;
    if (k < 0 || L[k].kind !== 'code') return true;
    var code = normalize(L[k].code);
    if (/\/$/.test(code) || /^term[a-z]*$/.test(code)) return true;
    if (!/^jmp\b/.test(code)) return false;
    var j = k - 1;
    while (j >= 0 && L[j].kind !== 'code') j--;
    return !(j >= 0 && SKIP_RE.test(normalize(L[j].code)));
  }

  function firstWords(L, i) {
    for (var k = i; k < L.length && k < i + 8; k++) {
      if (L[k].kind === 'comment' && L[k].comment) return words(L[k].comment, 5);
      if (L[k].kind === 'code') return L[k].label || words(L[k].code, 3);
    }
    return '';
  }

  /*
   * Section: coarser blocks. Boundaries at
   *   - each part / tape title (also the title after a `start`);
   *   - a comment-only line preceded by >= 2 blank lines (page breaks count
   *     as blank) or by a line of dashes; the section is named by it;
   *   - `constants` / `variables` pseudo-ops (the storage-allocation tail);
   *   - the first `define` of a run: consecutive macro definitions are
   *     grouped into one "macros" section (header boundaries suppressed),
   *     which ends at the first code line outside a definition.
   */
  function sectionUnits(text, o) {
    var L = text.lines, starts = [], names = [];
    var inMacros = false, inDef = false, blanks = 0, prevNB = null, lastCode = -1, macs = null;
    function push(s, name) {
      if (starts.length && starts[starts.length - 1] >= s) {
        if (starts[starts.length - 1] === s) names[names.length - 1] = name;
        return;
      }
      starts.push(s); names.push(name);
    }
    for (var i = 0; i < L.length; i++) {
      var l = L[i], prev = i > 0 ? L[i - 1] : null;
      if (l.kind === 'title' || !prev || prev.part !== l.part) {
        push(i, l.kind === 'title' ? words(l.code, 5) : '(part)');
        inMacros = false; inDef = false;
      } else if (isDefine(l)) {
        inDef = true;
        if (!inMacros) {
          inMacros = true; macs = [];
          push(headerStart(L, i, lastCode), 'macros');
        }
        macs.push(macroName(L, i));
        names[names.length - 1] = 'macros: ' + macs.slice(0, 3).join(', ') + (macs.length > 3 ? ', ...' : '');
      } else if (inDef) {
        if (isTerm(l)) inDef = false;
      } else if (inMacros && l.kind === 'code') {
        inMacros = false;
        push(headerStart(L, i, lastCode), l.label || firstWords(L, headerStart(L, i, lastCode)));
      } else if (!inMacros && l.kind === 'comment' &&
                 (blanks >= 2 || (prevNB && /^[\/\s]*-{4,}/.test(prevNB.raw)))) {
        push(i, words(l.comment, 6) || '(section)');
      } else if (!inMacros && l.kind === 'code' && /^(constants|variables)\b/.test(l.norm) &&
                 !(prevNB && prevNB.kind === 'code' && /^(constants|variables)\b/.test(prevNB.norm))) {
        push(i, l.norm);
      }
      if (l.kind === 'blank') blanks++;
      else { blanks = 0; prevNB = l; }
      if (l.kind === 'code') lastCode = i;
    }
    return unitsFromStarts(text, starts, names, 'section', o);
  }

  function optsKey(g, o) { return g + '|' + (o.withComments ? 1 : 0) + (o.commentLines ? 1 : 0); }

  /*
   * units(text, granularity = 'line', {withComments, commentLines})
   * Cached on the text object (non-enumerable).
   */
  function units(text, granularity, opts) {
    var g = granularity || 'line', o = opts || {};
    if (!text._cache) Object.defineProperty(text, '_cache', { value: {}, enumerable: false });
    var k = optsKey(g, o);
    if (text._cache[k]) return text._cache[k];
    var u = g === 'line' ? lineUnits(text, o) : g === 'routine' ? routineUnits(text, o) :
            g === 'section' ? sectionUnits(text, o) : null;
    if (!u) throw new Error('unknown granularity ' + g);
    u.forEach(function (x, i) { x.index = i; });
    text._cache[k] = u;
    return u;
  }

  /* ------------------------------------------------------------------ */
  /* Sequence tools                                                      */
  /* ------------------------------------------------------------------ */

  // Map string arrays to shared integer ids.
  function intern(a, b) {
    var map = Object.create(null), n = 0;
    function f(s) { var v = map[s]; if (v === undefined) v = map[s] = n++; return v; }
    return [a.map(f), b.map(f)];
  }

  // LCS matched index pairs [[i, j], ...] of two integer arrays.
  function lcsPairs(A, B) {
    var n = A.length, m = B.length, pre = 0, suf = 0, out = [];
    while (pre < n && pre < m && A[pre] === B[pre]) pre++;
    while (suf < n - pre && suf < m - pre && A[n - 1 - suf] === B[m - 1 - suf]) suf++;
    for (var p = 0; p < pre; p++) out.push([p, p]);
    var a0 = pre, a1 = n - suf, b0 = pre, b1 = m - suf, N = a1 - a0, M = b1 - b0;
    if (N > 0 && M > 0) {
      var W = M + 1, Arr = (N < 65535 && M < 65535) ? Uint16Array : Int32Array;
      var T = new Arr((N + 1) * W);
      for (var i = N - 1; i >= 0; i--) {
        var ai = A[a0 + i], r = i * W, r1 = r + W;
        for (var j = M - 1; j >= 0; j--) {
          T[r + j] = ai === B[b0 + j] ? T[r1 + j + 1] + 1 :
            (T[r1 + j] >= T[r + j + 1] ? T[r1 + j] : T[r + j + 1]);
        }
      }
      i = 0; j = 0;
      while (i < N && j < M) {
        if (A[a0 + i] === B[b0 + j]) { out.push([a0 + i, b0 + j]); i++; j++; }
        else if (T[(i + 1) * W + j] >= T[i * W + j + 1]) i++;
        else j++;
      }
    }
    for (p = 0; p < suf; p++) out.push([n - suf + p, m - suf + p]);
    return out;
  }

  // LCS length only (two rows), for small sequences.
  function lcsLength(A, B) {
    var n = A.length, m = B.length;
    if (!n || !m) return 0;
    var prev = new Int32Array(m + 1), cur = new Int32Array(m + 1);
    for (var i = 1; i <= n; i++) {
      var ai = A[i - 1];
      for (var j = 1; j <= m; j++) {
        cur[j] = ai === B[j - 1] ? prev[j - 1] + 1 : (prev[j] > cur[j - 1] ? prev[j] : cur[j - 1]);
      }
      var t = prev; prev = cur; cur = t;
    }
    return prev[m];
  }

  // Dice similarity over sequences: 2 * LCS / (|a| + |b|).
  function seqSimilarity(a, b) {
    if (!a.length && !b.length) return 1;
    var ab = intern(a, b);
    return 2 * lcsLength(ab[0], ab[1]) / (a.length + b.length);
  }

  // Similarity of two units: token level for single lines, line level otherwise.
  function unitSimilarity(ua, ub, g) {
    if (g === 'line') return seqSimilarity(ua.tokens, ub.tokens);
    return seqSimilarity(ua.keys, ub.keys);
  }

  /*
   * editScript(aKeys, bKeys, aIdx, bIdx) -> [{op, a, b}]
   * op: same | del | add | change (a del run followed by an add run is paired
   * into changes). a/b are line indices (aIdx/bIdx) or null.
   */
  function editScript(aKeys, bKeys, aIdx, bIdx) {
    aIdx = aIdx || aKeys.map(function (_, i) { return i; });
    bIdx = bIdx || bKeys.map(function (_, i) { return i; });
    var ab = intern(aKeys, bKeys), P = lcsPairs(ab[0], ab[1]), ops = [], i = 0, j = 0;
    function flush(ie, je) {
      var dels = [], adds = [];
      for (; i < ie; i++) dels.push(aIdx[i]);
      for (; j < je; j++) adds.push(bIdx[j]);
      var k = 0;
      for (; k < Math.min(dels.length, adds.length); k++) ops.push({ op: 'change', a: dels[k], b: adds[k] });
      for (var x = k; x < dels.length; x++) ops.push({ op: 'del', a: dels[x], b: null });
      for (x = k; x < adds.length; x++) ops.push({ op: 'add', a: null, b: adds[x] });
    }
    P.forEach(function (p) {
      flush(p[0], p[1]);
      ops.push({ op: 'same', a: aIdx[i], b: bIdx[j] }); i++; j++;
    });
    flush(aKeys.length, bKeys.length);
    return ops;
  }

  /* ------------------------------------------------------------------ */
  /* Compare                                                             */
  /* ------------------------------------------------------------------ */

  /*
   * compare(a, b, {granularity='line', threshold=0.6, withComments=false,
   *                commentLines=false, topK, script=true})
   * -> {granularity, a: a.id, b: b.id, unitsA, unitsB,
   *     pairs: [{a, b, status, similarity, inOrder?, script?}],
   *     summary: {retained, moved, edited, added, removed, similarity,
   *               linesA, linesB}}
   * pairs are listed in B order (removed A units inserted after their
   * nearest predecessor).
   */
  function compare(a, b, opts) {
    opts = opts || {};
    var g = opts.granularity || 'line';
    var thr = opts.threshold == null ? 0.6 : opts.threshold;
    var uo = { withComments: !!opts.withComments, commentLines: !!opts.commentLines };
    var UA = units(a, g, uo), UB = units(b, g, uo);
    var nA = UA.length, nB = UB.length;
    var matchA = new Int32Array(nA).fill(-1), matchB = new Int32Array(nB).fill(-1);
    var status = new Array(nB), sim = new Float64Array(nB);

    // 1. retained: LCS over unit keys
    var ids = intern(UA.map(function (u) { return u.codeKey; }), UB.map(function (u) { return u.codeKey; }));
    var P = lcsPairs(ids[0], ids[1]);
    P.forEach(function (p) {
      matchA[p[0]] = p[1]; matchB[p[1]] = p[0]; status[p[1]] = 'retained'; sim[p[1]] = 1;
    });
    // gap bounds: for each B unit, the A range between its LCS anchors
    var lo = new Int32Array(nB), hi = new Int32Array(nB), last = -1;
    for (var j = 0; j < nB; j++) { if (matchB[j] >= 0) last = matchB[j]; lo[j] = last + 1; }
    last = nA;
    for (j = nB - 1; j >= 0; j--) { if (matchB[j] >= 0) last = matchB[j]; hi[j] = last - 1; }

    // 2. moved: identical key, out of LCS order, nearest relative position
    var byKey = Object.create(null);
    for (var i = 0; i < nA; i++) if (matchA[i] < 0) (byKey[ids[0][i]] = byKey[ids[0][i]] || []).push(i);
    for (j = 0; j < nB; j++) {
      if (matchB[j] >= 0) continue;
      var list = byKey[ids[1][j]];
      if (!list) continue;
      var best = -1, bd = Infinity;
      for (var k = 0; k < list.length; k++) {
        if (matchA[list[k]] >= 0) continue;
        var d = Math.abs(list[k] / nA - j / nB);
        if (d < bd) { bd = d; best = list[k]; }
      }
      if (best >= 0) {
        matchA[best] = j; matchB[j] = best; sim[j] = 1;
        status[j] = (best >= lo[j] && best <= hi[j]) ? 'retained' : 'moved';
      }
    }

    // 3. edited: candidates via inverted index + LCS gap, greedy best-first
    var inv = Object.create(null), df = Object.create(null);
    for (i = 0; i < nA; i++) {
      if (matchA[i] >= 0) continue;
      var seen = Object.create(null);
      UA[i].tokens.forEach(function (t) {
        if (seen[t]) return; seen[t] = 1;
        (inv[t] = inv[t] || []).push(i);
      });
    }
    for (var t in inv) df[t] = inv[t].length;
    var topK = opts.topK || (g === 'line' ? 6 : 8), gapCap = g === 'line' ? 24 : 16;
    var cands = [];
    for (j = 0; j < nB; j++) {
      if (matchB[j] >= 0) continue;
      var score = Object.create(null), touched = [];
      var sb = Object.create(null);
      UB[j].tokens.forEach(function (tk) {
        if (sb[tk] || !inv[tk]) return; sb[tk] = 1;
        if (inv[tk].length > 200) return;                 // too common to discriminate
        var w = 1 / Math.log(2 + df[tk]);
        inv[tk].forEach(function (x) {
          if (score[x] === undefined) { score[x] = 0; touched.push(x); }
          score[x] += w;
        });
      });
      touched.sort(function (x, y) { return score[y] - score[x] || x - y; });
      var cs = touched.slice(0, topK), inCs = Object.create(null);
      cs.forEach(function (x) { inCs[x] = 1; });
      // unmatched A units in the same gap, nearest to the expected position first
      var gl = lo[j], gh = hi[j];
      if (gh >= gl) {
        var gapList = [];
        for (i = gl; i <= gh && gapList.length < 4 * gapCap; i++) if (matchA[i] < 0) gapList.push(i);
        if (gapList.length > gapCap) {
          var exp = gl + (gh - gl) * 0.5;
          gapList.sort(function (x, y) { return Math.abs(x - exp) - Math.abs(y - exp); });
          gapList = gapList.slice(0, gapCap);
        }
        gapList.forEach(function (x) { if (!inCs[x]) { inCs[x] = 1; cs.push(x); } });
      }
      cs.forEach(function (x) {
        var s = unitSimilarity(UA[x], UB[j], g);
        if (s >= thr) {
          var inGap = x >= gl && x <= gh;
          cands.push({ a: x, b: j, s: s, g: inGap ? 0 : 1, d: Math.abs(x / nA - j / nB) });
        }
      });
    }
    cands.sort(function (x, y) { return y.s - x.s || x.g - y.g || x.d - y.d || x.b - y.b; });
    cands.forEach(function (c) {
      if (matchA[c.a] >= 0 || matchB[c.b] >= 0) return;
      matchA[c.a] = c.b; matchB[c.b] = c.a; status[c.b] = 'edited'; sim[c.b] = c.s;
    });

    // 4. assemble pairs in B order, removed A units after their predecessor
    var pairs = [], la = 0, lb = 0, acc = 0, counts = { retained: 0, moved: 0, edited: 0, added: 0, removed: 0 };
    UA.forEach(function (u) { la += u.lines; });
    UB.forEach(function (u) { lb += u.lines; });
    var removedAfter = {};                   // A index -> list of removed A units following it
    var prevMatched = -1;
    for (i = 0; i < nA; i++) {
      if (matchA[i] >= 0) prevMatched = i;
      else (removedAfter[prevMatched] = removedAfter[prevMatched] || []).push(i);
    }
    function emitRemoved(ai) {
      (removedAfter[ai] || []).forEach(function (x) {
        pairs.push({ a: x, b: null, status: 'removed', similarity: 0 }); counts.removed++;
      });
      removedAfter[ai] = null;
    }
    emitRemoved(-1);
    for (j = 0; j < nB; j++) {
      var ai = matchB[j];
      if (ai < 0) { pairs.push({ a: null, b: j, status: 'added', similarity: 0 }); counts.added++; continue; }
      var pr = { a: ai, b: j, status: status[j], similarity: +sim[j].toFixed(4) };
      if (pr.status === 'edited') {
        pr.inOrder = ai >= lo[j] && ai <= hi[j];
        if (opts.script !== false) {
          pr.script = g === 'line' ? [{ op: 'change', a: UA[ai].start, b: UB[j].start }] :
            editScript(UA[ai].keys, UB[j].keys, UA[ai].lineIdx, UB[j].lineIdx);
        }
      }
      counts[pr.status]++;
      acc += (UA[ai].lines + UB[j].lines) * sim[j];
      pairs.push(pr);
      if (status[j] === 'retained') emitRemoved(ai);
    }
    for (var key in removedAfter) if (removedAfter[key]) emitRemoved(+key);
    counts.similarity = (la + lb) ? +(acc / (la + lb)).toFixed(4) : 1;
    counts.linesA = la; counts.linesB = lb;
    counts.unitsA = nA; counts.unitsB = nB;
    return { granularity: g, a: a.id, b: b.id, unitsA: UA, unitsB: UB, pairs: pairs, summary: counts };
  }

  /* ------------------------------------------------------------------ */
  /* Multi-version                                                       */
  /* ------------------------------------------------------------------ */

  /*
   * matrix(texts, opts) -> {ids, labels, sim: N x N}
   * Overall similarity = lines retained + moved + edited * similarity,
   * weighted over both versions' lines (a Dice score, hence symmetric);
   * computed once per pair (earlier text as A) and mirrored.
   */
  function matrix(texts, opts) {
    opts = Object.assign({ granularity: 'line', script: false }, opts || {});
    var n = texts.length, S = [];
    for (var i = 0; i < n; i++) { S.push(new Array(n)); S[i][i] = 1; }
    for (i = 0; i < n; i++) for (var j = i + 1; j < n; j++) {
      var v = compare(texts[i], texts[j], opts).summary.similarity;
      S[i][j] = S[j][i] = v;
    }
    return { ids: texts.map(function (t) { return t.id; }),
             labels: texts.map(function (t) { return t.label; }), sim: S,
             granularity: opts.granularity };
  }

  /*
   * tree(matrix) -> UPGMA dendrogram on distance 1 - similarity.
   * Leaf: {id, index, height: 0, size: 1}; node: {left, right, height, size}.
   * height is the cluster distance at the merge (half the UPGMA
   * branch-length convention is not applied: height = mean distance).
   */
  function tree(m) {
    var n = m.ids.length, D = [], nodes = [], active = [];
    for (var i = 0; i < n; i++) {
      D.push(m.sim[i].map(function (s) { return 1 - s; }));
      nodes.push({ id: m.ids[i], index: i, height: 0, size: 1 });
      active.push(i);
    }
    while (active.length > 1) {
      var bi = -1, bj = -1, bd = Infinity;
      for (var x = 0; x < active.length; x++) for (var y = x + 1; y < active.length; y++) {
        var d = D[active[x]][active[y]];
        if (d < bd - 1e-12) { bd = d; bi = x; bj = y; }
      }
      var p = active[bi], q = active[bj], np = nodes[p].size, nq = nodes[q].size;
      var node = { left: nodes[p], right: nodes[q], height: +bd.toFixed(4), size: np + nq };
      var k = nodes.length;
      nodes.push(node);
      D.push([]);
      active.forEach(function (r) {
        if (r === p || r === q) return;
        var v = (D[p][r] * np + D[q][r] * nq) / (np + nq);
        D[k][r] = v; D[r][k] = v;
      });
      D[k][k] = 0;
      active.splice(bj, 1); active.splice(bi, 1); active.push(k);
    }
    return nodes[active[0]];
  }

  /*
   * lineage(texts, targetIndex, opts) -> {target, granularity, rows: [
   *   {unit, index, status, firstSeen, firstSeenIndex,
   *    chain: [{versionId, index, unit, status, similarity, gap}]}]}
   * texts in chronological order. For each unit of the target the chain
   * follows ancestors backwards through consecutive versions. When a link
   * is missing (e.g. a fork that does not carry the code) and opts.bridge
   * (default true) is set, the unit is sought directly in older versions,
   * nearest first; such links carry gap: true. status is the unit's status
   * relative to its nearest ancestor ('added' when it has none);
   * firstSeen = the earliest version in the chain.
   */
  function lineage(texts, t, opts) {
    opts = Object.assign({ granularity: 'routine', bridge: true }, opts || {});
    var cache = {};
    function cmp(i, j) {             // ancestor map for units of j in i
      var k = i + ',' + j;
      if (!cache[k]) {
        var c = compare(texts[i], texts[j], Object.assign({}, opts, { script: false })), map = {};
        c.pairs.forEach(function (p) { if (p.b !== null && p.a !== null) map[p.b] = p; });
        cache[k] = map;
      }
      return cache[k];
    }
    var target = texts[t], U = units(target, opts.granularity, opts);
    var rows = U.map(function (u, ui) {
      var chain = [], cur = ui, v = t;
      while (v > 0) {
        var found = null, fv = -1;
        var lim = opts.bridge ? 0 : v - 1;
        for (var w = v - 1; w >= lim; w--) {
          var p = cmp(w, v)[cur];
          if (p) { found = p; fv = w; break; }
        }
        if (!found) break;
        var au = units(texts[fv], opts.granularity, opts)[found.a];
        chain.push({ versionId: texts[fv].id, index: fv, unit: found.a, name: au.name,
                     status: found.status, similarity: found.similarity, gap: fv !== v - 1 });
        cur = found.a; v = fv;
      }
      var fs = chain.length ? chain[chain.length - 1] : null;
      return { unit: u, index: ui, status: chain.length ? chain[0].status : 'added',
               firstSeen: fs ? fs.versionId : target.id, firstSeenIndex: fs ? fs.index : t,
               chain: chain };
    });
    return { target: target.id, granularity: opts.granularity, rows: rows };
  }

  /*
   * annotate(text, lineageResult) -> per line of the text:
   * {line, unit (index or -1), firstSeen, status}; lines outside any unit
   * (blank lines between line units) get unit -1 and nulls.
   */
  function annotate(text, lin) {
    var out = text.lines.map(function (l) { return { line: l, unit: -1, firstSeen: null, status: null }; });
    lin.rows.forEach(function (r) {
      for (var i = r.unit.start; i <= r.unit.end; i++) {
        out[i].unit = r.index; out[i].firstSeen = r.firstSeen; out[i].status = r.status;
      }
    });
    return out;
  }

  /*
   * flows(texts, opts) -> {ids, granularity, units: [units per text],
   *   steps: [{from, to, pairs, summary}]} for consecutive pairs.
   */
  function flows(texts, opts) {
    opts = Object.assign({ granularity: 'routine', script: false }, opts || {});
    var steps = [];
    for (var i = 0; i + 1 < texts.length; i++) {
      var c = compare(texts[i], texts[i + 1], opts);
      steps.push({ from: i, to: i + 1, pairs: c.pairs, summary: c.summary });
    }
    return { ids: texts.map(function (t) { return t.id; }), granularity: opts.granularity,
             units: texts.map(function (t) { return units(t, opts.granularity, opts); }), steps: steps };
  }

  /* ------------------------------------------------------------------ */
  /* SVG                                                                 */
  /* ------------------------------------------------------------------ */

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f￾￿]/g, '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
  }
  function f1(x) { return (Math.round(x * 10) / 10).toString(); }
  function pct(x) { return Math.round(x * 100) + '%'; }
  function trunc(s, n) { s = String(s || ''); return s.length > n ? s.slice(0, n - 1) + '…' : s; }

  function svgOpen(w, h, cls, title) {
    return '<svg xmlns="http://www.w3.org/2000/svg" class="' + cls + '" width="' + f1(w) +
      '" height="' + f1(h) + '" viewBox="0 0 ' + f1(w) + ' ' + f1(h) + '" ' + FONT +
      ' role="img"><title>' + esc(title) + '</title>';
  }

  // Curved band from (x0, y0a..y0b) to (x1, y1a..y1b).
  function band(x0, y0a, y0b, x1, y1a, y1b) {
    var mx = (x0 + x1) / 2;
    return 'M' + f1(x0) + ' ' + f1(y0a) + 'C' + f1(mx) + ' ' + f1(y0a) + ' ' + f1(mx) + ' ' + f1(y1a) +
      ' ' + f1(x1) + ' ' + f1(y1a) + 'L' + f1(x1) + ' ' + f1(y1b) + 'C' + f1(mx) + ' ' + f1(y1b) +
      ' ' + f1(mx) + ' ' + f1(y0b) + ' ' + f1(x0) + ' ' + f1(y0b) + 'Z';
  }

  function legend(x, y, list) {
    var s = '<g class="g-legend" font-size="10">';
    list.forEach(function (st, i) {
      s += '<rect x="' + f1(x + i * 84) + '" y="' + f1(y) + '" width="10" height="10" fill="' + COLORS[st] +
        '"/><text x="' + f1(x + i * 84 + 14) + '" y="' + f1(y + 9) + '" fill="' + COLORS.text + '">' + st + '</text>';
    });
    return s + '</g>';
  }

  // Merge runs of consecutive links with the same status (for rendering).
  function coalesce(pairs) {
    var runs = [], cur = null;
    pairs.forEach(function (p) {
      if (p.a === null || p.b === null) { runs.push({ a0: p.a, a1: p.a, b0: p.b, b1: p.b, status: p.status, n: 1, sim: p.similarity }); cur = null; return; }
      if (cur && cur.status === p.status && p.a === cur.a1 + 1 && p.b === cur.b1 + 1) {
        cur.a1 = p.a; cur.b1 = p.b; cur.n++; cur.sim += p.similarity; return;
      }
      cur = { a0: p.a, a1: p.a, b0: p.b, b1: p.b, status: p.status, n: 1, sim: p.similarity };
      runs.push(cur);
    });
    runs.forEach(function (r) { r.sim = r.sim / r.n; });
    return runs;
  }

  // Unit y-positions within a column: stacked, height proportional to lines.
  function layoutColumn(us, y0, scale, gap, full) {
    var y = y0, pos = [];
    us.forEach(function (u) {
      // full: every line of the unit (blank and comment lines too), so its code fits the box
      var h = (full ? u.end - u.start + 1 : u.lines) * scale;
      pos.push({ y: y, h: h });
      y += h + gap;
    });
    return { pos: pos, bottom: y };
  }

  /*
   * svgAlluvial(texts, flows, opts) -> SVG string.
   * opts: {height=560, colWidth=110, boxWidth=14, labels:[...], maxBoxes=400,
   *        title, perLine (pixels per source line, overrides height),
   *        names (write each unit's name in its box), code (write its lines)}
   */
  function svgAlluvial(texts, fl, opts) {
    opts = opts || {};
    var n = texts.length, cw = opts.colWidth || 110, bw = opts.boxWidth || 14;
    var top = opts.top || 96, H = opts.height || 560, left = 24, stub = Math.min(26, cw / 3);
    var W = left * 2 + (n - 1) * cw + bw + 60;
    var gap = fl.units.some(function (us) { return us.length > 300; }) ? 0 : 1;
    var maxTotal = 1;
    fl.units.forEach(function (us) {
      var t = 0; us.forEach(function (u) { t += u.lines; });
      maxTotal = Math.max(maxTotal, t + us.length * gap * 0);
    });
    var maxUnits = Math.max.apply(null, fl.units.map(function (us) { return us.length; }).concat([1]));
    var scale = opts.perLine || Math.max(0.05, (H - gap * maxUnits) / maxTotal);
    var labels = opts.labels || texts.map(function (t) { return t.label; });
    var cols = fl.units.map(function (us, i) { return layoutColumn(us, top, scale, gap, !!opts.code); });
    var totalH = Math.max.apply(null, cols.map(function (c) { return c.bottom; })) + 34 + (opts.extraLegend ? 18 : 0);
    var s = svgOpen(W, totalH, 'g-alluvial', opts.title || ('Genealogy flow (' + fl.granularity + ')'));
    // ribbons
    s += '<g class="g-ribbons" fill-opacity="0.55">';
    fl.steps.forEach(function (st, si) {
      var xa = left + st.from * cw + bw, xb = left + st.to * cw;
      var UA = fl.units[st.from], UB = fl.units[st.to], PA = cols[st.from].pos, PB = cols[st.to].pos;
      coalesce(st.pairs).forEach(function (r) {
        var col = COLORS[r.status], tip;
        // data-* attributes let a host page make the ribbons clickable
        var da = ' data-step="' + si + '" data-status="' + r.status + '" data-a0="' + (r.a0 === null ? '' : r.a0) +
          '" data-a1="' + (r.a1 === null ? '' : r.a1) + '" data-b0="' + (r.b0 === null ? '' : r.b0) + '" data-b1="' + (r.b1 === null ? '' : r.b1) + '"';
        if (r.a0 === null) {           // added: stub into B
          var pb = PB[r.b0];
          tip = texts[st.to].label + ': ' + UB[r.b0].name + ' added (' + UB[r.b0].lines + ' lines)';
          s += '<path d="' + band(xb - stub, pb.y + pb.h / 2, pb.y + pb.h / 2, xb, pb.y, pb.y + Math.max(pb.h, 0.5)) +
            '" fill="' + col + '"' + da + '><title>' + esc(tip) + '</title></path>';
          return;
        }
        if (r.b0 === null) {           // removed: stub out of A
          var pa = PA[r.a0];
          tip = texts[st.from].label + ': ' + UA[r.a0].name + ' removed (' + UA[r.a0].lines + ' lines)';
          s += '<path d="' + band(xa, pa.y, pa.y + Math.max(pa.h, 0.5), xa + stub, pa.y + pa.h / 2, pa.y + pa.h / 2) +
            '" fill="' + col + '"' + da + '><title>' + esc(tip) + '</title></path>';
          return;
        }
        var ya0 = PA[r.a0].y, ya1 = PA[r.a1].y + PA[r.a1].h, yb0 = PB[r.b0].y, yb1 = PB[r.b1].y + PB[r.b1].h;
        tip = texts[st.from].label + ' → ' + texts[st.to].label + ': ' + r.status + ' ' +
          (r.n > 1 ? r.n + ' units, ' + UA[r.a0].name + ' … ' + UA[r.a1].name : UA[r.a0].name +
           (UB[r.b0].name !== UA[r.a0].name ? ' → ' + UB[r.b0].name : '')) +
          (r.status === 'edited' ? ' (' + pct(r.sim) + ')' : '');
        s += '<path d="' + band(xa, ya0, Math.max(ya1, ya0 + 0.5), xb, yb0, Math.max(yb1, yb0 + 0.5)) +
          '" fill="' + COLORS[r.status] + '"' + (r.status === 'moved' ? ' fill-opacity="0.8"' : '') + da +
          '><title>' + esc(tip) + '</title></path>';
      });
    });
    s += '</g>';
    // columns
    var maxBoxes = opts.maxBoxes || 400;
    fl.units.forEach(function (us, i) {
      var x = left + i * cw, c = cols[i], t = 0;
      us.forEach(function (u) { t += u.lines; });
      s += '<g class="g-col">';
      s += '<rect x="' + f1(x) + '" y="' + top + '" width="' + bw + '" height="' + f1(Math.max(1, c.bottom - top - gap)) +
        '" fill="' + COLORS.box + '" stroke="' + COLORS.stroke + '" stroke-width="0.5"><title>' +
        esc(texts[i].label + ': ' + us.length + ' units, ' + t + ' lines') + '</title></rect>';
      if (us.length <= maxBoxes || opts.names || opts.code) {
        us.forEach(function (u, k) {
          var p = c.pos[k];
          var bf = opts.boxFill ? opts.boxFill(i, k) : null;
          s += '<rect x="' + f1(x) + '" y="' + f1(p.y) + '" width="' + bw + '" height="' + f1(Math.max(p.h, 0.5)) +
            '" fill="' + (bf || COLORS.box) + '" stroke="' + COLORS.stroke + '" stroke-width="0.4" data-col="' + i + '" data-u="' + k + '"><title>' +
            esc(texts[i].label + ' · ' + u.name + ' (' + u.file + ' ' + u.n0 + '–' + u.n1 + ', ' + u.lines + ' lines)' +
                (opts.boxTip ? opts.boxTip(i, k) : '')) +
            '</title></rect>';
        });
        // Zoomed in: the unit's name, then (further in) its code, clipped to the box.
        if (opts.names || opts.code) {
          var fs = opts.code ? Math.min(12, Math.max(6, scale - 1.5)) : 10, cpx = fs * 0.6, maxCh = Math.floor((bw - 8) / cpx);
          s += '<clipPath id="gclip' + i + '"><rect x="' + f1(x) + '" y="' + top + '" width="' + bw + '" height="' + f1(c.bottom - top) + '"/></clipPath>' +
            '<g clip-path="url(#gclip' + i + ')" pointer-events="none" font-size="' + f1(fs) + '" fill="' + COLORS.text + '">';
          us.forEach(function (u, k) {
            var p = c.pos[k];
            if (opts.code && texts[i].lines) {
              for (var j = u.start; j <= u.end; j++) {
                var L = texts[i].lines[j];
                if (!L) continue;
                var ty = p.y + (j - u.start + 0.8) * scale;
                s += '<text x="' + f1(x + 4) + '" y="' + f1(ty) + '" xml:space="preserve">' + esc(trunc(String(L.raw).replace(/\t/g, '  '), maxCh)) + '</text>';
              }
            } else if (p.h >= 11) {
              s += '<text x="' + f1(x + 4) + '" y="' + f1(p.y + Math.min(p.h / 2 + 3.5, 12)) + '">' + esc(trunc(u.name, maxCh)) + '</text>';
            }
          });
          s += '</g>';
        }
      }
      var lx = x + bw / 2, ly = top - 8;
      // class g-collabel: the bench pins these above the flow while it scrolls (compare.js)
      s += '<text class="g-collabel" x="' + f1(lx) + '" y="' + f1(ly) + '" font-size="11" fill="' + COLORS.text +
        '" transform="rotate(-40 ' + f1(lx) + ' ' + f1(ly) + ')"><title>' + esc(texts[i].label) + '</title>' +
        esc(trunc(labels[i], 22)) + '</text></g>';
    });
    s += legend(left, totalH - 20 - (opts.extraLegend ? 18 : 0), STATUSES);
    if (opts.extraLegend) {
      // a second key, for box colours (e.g. hands): [[colour, label], ...]
      var ex = left;
      s += '<g font-size="10">';
      opts.extraLegend.forEach(function (e) {
        s += '<rect x="' + f1(ex) + '" y="' + f1(totalH - 20) + '" width="10" height="10" fill="' + e[0] + '" stroke="' + COLORS.stroke + '" stroke-width="0.4"/>' +
          '<text x="' + f1(ex + 14) + '" y="' + f1(totalH - 11) + '" fill="' + COLORS.text + '">' + esc(e[1]) + '</text>';
        ex += 22 + e[1].length * 6;
      });
      s += '</g>';
    }
    return s + '</svg>';
  }

  /*
   * svgBlockMap(a, b, cmp, opts) -> SVG: A units left, B units right,
   * proportional heights, quadrilaterals for matches (moved ones cross).
   * opts: {height=700, width=640, barWidth=22}
   */
  function svgBlockMap(a, b, cmp, opts) {
    opts = opts || {};
    var W = opts.width || 640, H = opts.height || 700, bw = opts.barWidth || 22, top = 40;
    var UA = cmp.unitsA, UB = cmp.unitsB;
    var gap = Math.max(UA.length, UB.length) > 300 ? 0 : 1;
    var ta = 0, tb = 0;
    UA.forEach(function (u) { ta += u.lines; });
    UB.forEach(function (u) { tb += u.lines; });
    var scale = (H - Math.max(UA.length, UB.length) * gap) / Math.max(ta, tb, 1);
    var ca = layoutColumn(UA, top, scale, gap), cb = layoutColumn(UB, top, scale, gap);
    var xa = W * 0.3 - bw, xb = W * 0.7, totalH = Math.max(ca.bottom, cb.bottom) + 36;
    var s = svgOpen(W, totalH, 'g-blockmap', a.label + ' → ' + b.label + ' (' + cmp.granularity + ')');
    var stA = {}, stB = {};
    cmp.pairs.forEach(function (p) { if (p.a !== null) stA[p.a] = p; if (p.b !== null) stB[p.b] = p; });
    // links (moved/edited-out-of-order drawn last so crossings are visible)
    var order = cmp.pairs.filter(function (p) { return p.a !== null && p.b !== null; });
    order.sort(function (x, y) {
      var rx = x.status === 'moved' || x.inOrder === false ? 1 : 0, ry = y.status === 'moved' || y.inOrder === false ? 1 : 0;
      return rx - ry;
    });
    s += '<g class="g-links" fill-opacity="0.45">';
    order.forEach(function (p) {
      var pa = ca.pos[p.a], pb = cb.pos[p.b];
      var tip = UA[p.a].name + ' → ' + UB[p.b].name + ': ' + p.status +
        (p.status === 'edited' ? ' ' + pct(p.similarity) : '') + ' (' + a.id + ' ' + UA[p.a].n0 + ', ' + b.id + ' ' + UB[p.b].n0 + ')';
      s += '<path d="' + band(xa + bw, pa.y, pa.y + Math.max(pa.h, 0.5), xb, pb.y, pb.y + Math.max(pb.h, 0.5)) +
        '" fill="' + COLORS[p.status] + '"' + (p.status === 'moved' ? ' fill-opacity="0.85" stroke="' +
        COLORS.moved + '" stroke-width="0.5"' : '') + '><title>' + esc(tip) + '</title></path>';
    });
    s += '</g>';
    function bar(us, c, x, st, side, text) {
      var out = '<g class="g-bar">';
      us.forEach(function (u, k) {
        var p = c.pos[k], pr = st[k], status = pr ? pr.status : (side === 'a' ? 'removed' : 'added');
        var fill = status === 'removed' || status === 'added' ? COLORS[status] : COLORS.box;
        out += '<rect x="' + f1(x) + '" y="' + f1(p.y) + '" width="' + bw + '" height="' + f1(Math.max(p.h, 0.5)) +
          '" fill="' + fill + '" stroke="' + COLORS.stroke + '" stroke-width="0.4"><title>' +
          esc(text.label + ' · ' + u.name + ' · ' + status + ' (' + u.file + ' ' + u.n0 + '–' + u.n1 +
              ', ' + u.lines + ' lines)') + '</title></rect>';
        if (p.h >= 9 && us.length <= 400) {
          var tx = side === 'a' ? x - 4 : x + bw + 4;
          out += '<text x="' + f1(tx) + '" y="' + f1(p.y + Math.min(p.h, 18) / 2 + 3) + '" font-size="9" fill="' +
            COLORS.text + '" text-anchor="' + (side === 'a' ? 'end' : 'start') + '">' + esc(trunc(u.name, 24)) + '</text>';
        }
      });
      return out + '</g>';
    }
    s += bar(UA, ca, xa, stA, 'a', a) + bar(UB, cb, xb, stB, 'b', b);
    s += '<text x="' + f1(xa + bw / 2) + '" y="24" font-size="12" text-anchor="middle" fill="' + COLORS.text + '">' +
      esc(trunc(a.label, 30)) + '</text><text x="' + f1(xb + bw / 2) + '" y="24" font-size="12" text-anchor="middle" fill="' +
      COLORS.text + '">' + esc(trunc(b.label, 30)) + '</text>';
    s += '<text x="' + f1(W / 2) + '" y="24" font-size="11" text-anchor="middle" fill="' + COLORS.muted + '">' +
      esc('similarity ' + pct(cmp.summary.similarity)) + '</text>';
    s += legend(Math.max(4, W / 2 - 210), totalH - 20, STATUSES);
    return s + '</svg>';
  }

  /*
   * svgMatrix(matrix, opts) -> heatmap; cell opacity scaled between the
   * smallest off-diagonal value and 1. opts: {cell=34, labels}
   */
  function svgMatrix(m, opts) {
    opts = opts || {};
    var n = m.ids.length, c = opts.cell || 34, labels = opts.labels || m.labels || m.ids;
    var lw = 120, top = 110, W = lw + n * c + 10, H = top + n * c + 10;
    var lo = 1;
    for (var i = 0; i < n; i++) for (var j = 0; j < n; j++) if (i !== j) lo = Math.min(lo, m.sim[i][j]);
    var s = svgOpen(W, H, 'g-matrix', 'Similarity matrix (' + (m.granularity || 'line') + ')');
    for (i = 0; i < n; i++) {
      var ly = top + i * c + c / 2 + 4;
      s += '<text x="' + (lw - 6) + '" y="' + f1(ly) + '" font-size="11" text-anchor="end" fill="' + COLORS.text + '">' +
        '<title>' + esc(m.labels ? m.labels[i] : m.ids[i]) + '</title>' + esc(trunc(labels[i], 16)) + '</text>';
      var lx = lw + i * c + c / 2 + 4;
      s += '<text x="' + f1(lx) + '" y="' + (top - 6) + '" font-size="11" fill="' + COLORS.text +
        '" transform="rotate(-50 ' + f1(lx) + ' ' + (top - 6) + ')">' + esc(trunc(labels[i], 16)) + '</text>';
      for (j = 0; j < n; j++) {
        var v = m.sim[i][j], op = lo < 1 ? 0.08 + 0.92 * (v - lo) / (1 - lo) : 1;
        var x = lw + j * c, y = top + i * c;
        s += '<g><title>' + esc(labels[i] + ' / ' + labels[j] + ': ' + (v * 100).toFixed(1) + '%') + '</title>' +
          '<rect x="' + x + '" y="' + y + '" width="' + (c - 1) + '" height="' + (c - 1) + '" fill="' + COLORS.heat +
          '" fill-opacity="' + op.toFixed(3) + '"/>' +
          '<text x="' + f1(x + c / 2) + '" y="' + f1(y + c / 2 + 3) + '" font-size="9" text-anchor="middle" fill="' +
          (op > 0.55 ? 'var(--g-cell-dark, #102027)' : COLORS.text) + '">' + Math.round(v * 100) + '</text></g>';
      }
    }
    return s + '</svg>';
  }

  /*
   * svgTree(tree, labels, opts) -> horizontal dendrogram, root on the left,
   * leaves on the right; x proportional to merge height (distance).
   * labels: array indexed by leaf index, or map id -> label.
   */
  function svgTree(t, labels, opts) {
    opts = opts || {};
    var leaves = [];
    (function walk(nd) { if (nd.left) { walk(nd.left); walk(nd.right); } else leaves.push(nd); })(t);
    var rowH = opts.rowHeight || 22, left = 20, top = 20, plotW = opts.plotWidth || 420, lw = 190;
    var W = left + plotW + lw, H = top + leaves.length * rowH + 40;
    var maxH = t.height || 1;
    function X(h) { return left + plotW * (1 - h / maxH); }
    function lab(leaf) {
      if (!labels) return leaf.id;
      if (Array.isArray(labels)) return labels[leaf.index] != null ? labels[leaf.index] : leaf.id;
      return labels[leaf.id] != null ? labels[leaf.id] : leaf.id;
    }
    var yOf = new Map();
    leaves.forEach(function (lf, i) { yOf.set(lf, top + i * rowH + rowH / 2); });
    var s = svgOpen(W, H, 'g-tree', 'Dendrogram (UPGMA, distance = 1 - similarity)');
    s += '<g class="g-edges" stroke="' + COLORS.line + '" stroke-width="1.2" fill="none">';
    (function draw(nd) {
      if (!nd.left) return yOf.get(nd);
      var yl = draw(nd.left), yr = draw(nd.right), x = X(nd.height);
      var xl = X(nd.left.height || 0), xr = X(nd.right.height || 0);
      s += '<path d="M' + f1(xl) + ' ' + f1(yl) + 'H' + f1(x) + 'V' + f1(yr) + 'H' + f1(xr) + '"><title>' +
        esc('merge at distance ' + nd.height.toFixed(3) + ' (similarity ' + pct(1 - nd.height) + ')') + '</title></path>';
      var y = (yl + yr) / 2;
      yOf.set(nd, y);
      return y;
    })(t);
    s += '</g>';
    leaves.forEach(function (lf) {
      var y = yOf.get(lf);
      s += '<circle cx="' + f1(X(0)) + '" cy="' + f1(y) + '" r="2.5" fill="' + COLORS.retained + '"/>' +
        '<text x="' + f1(X(0) + 8) + '" y="' + f1(y + 4) + '" font-size="11" fill="' + COLORS.text + '"><title>' +
        esc(lf.id) + '</title>' + esc(trunc(lab(lf), 26)) + '</text>';
    });
    // distance axis
    var ay = top + leaves.length * rowH + 12;
    s += '<g font-size="9" fill="' + COLORS.muted + '"><path d="M' + f1(X(maxH)) + ' ' + ay + 'H' + f1(X(0)) +
      '" stroke="' + COLORS.muted + '" stroke-width="0.8"/>';
    for (var k = 0; k <= 4; k++) {
      var h = maxH * k / 4;
      s += '<path d="M' + f1(X(h)) + ' ' + ay + 'v4" stroke="' + COLORS.muted + '"/><text x="' + f1(X(h)) + '" y="' +
        (ay + 14) + '" text-anchor="middle">' + h.toFixed(2) + '</text>';
    }
    return s + '</g></svg>';
  }

  /*
   * attributeHands(texts, flows, handsIn) -> per column, per unit:
   *   {hand, how, line, from}
   * how: 'signed' (initials in the unit's own comments), 'inherited' (from
   * its ancestor in the previous column), 'tape' (new here, on a tape whose
   * title is signed), or null (unattributed). handsIn(text) -> [keys].
   */
  function attributeHands(texts, fl, handsIn) {
    var out = [];
    fl.units.forEach(function (us, i) {
      var t = texts[i], col = [], tapeHand = {};
      t.lines.forEach(function (L) {
        if (L.kind === 'title' && !(L.file in tapeHand)) { var th = handsIn(L.raw); if (th.length) tapeHand[L.file] = { hand: th[0], line: L }; }
      });
      var anc = {};
      if (i > 0) fl.steps[i - 1].pairs.forEach(function (p) { if (p.b != null && p.a != null) anc[p.b] = p; });
      us.forEach(function (u, k) {
        var own = null;
        for (var j = u.start; j <= u.end && !own; j++) {
          var L = t.lines[j];
          if (!L || L.kind === 'title' || !L.comment) continue;
          var hs = handsIn(L.comment);
          if (hs.length) own = { hand: hs[0], all: hs, how: 'signed', line: L };
        }
        if (own) { col.push(own); return; }
        var p = anc[k], prev = p && out[i - 1][p.a];
        if (prev && prev.hand) { col.push({ hand: prev.hand, how: 'inherited', from: prev, status: p.status }); return; }
        if (i > 0 && !p && tapeHand[u.file]) { col.push({ hand: tapeHand[u.file].hand, how: 'tape', line: tapeHand[u.file].line }); return; }
        col.push({ hand: null, how: null });
      });
      out.push(col);
    });
    return out;
  }

  var api = {
    attributeHands: attributeHands,
    STATUSES: STATUSES, COLORS: COLORS,
    parseLine: parseLine, normalize: normalize, prepare: prepare, units: units,
    compare: compare, editScript: editScript, similarity: seqSimilarity,
    matrix: matrix, tree: tree, lineage: lineage, annotate: annotate, flows: flows,
    svgAlluvial: svgAlluvial, svgBlockMap: svgBlockMap, svgMatrix: svgMatrix, svgTree: svgTree,
    escapeXml: esc
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.SWGenealogy = api;
})(this);
