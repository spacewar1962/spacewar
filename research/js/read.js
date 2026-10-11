/*
 * read.js - Read for Spacewar!: bench-kit's Read view (kit/read.js) with what is this bench's:
 * PDP-1 MACRO highlighting, the tapes a version is assembled from, the addresses and words each
 * line became (with their disassembly), normalised text and run heat, breakpoints from the
 * selection, the Key, the pop-up on a symbol (with the instruction glosses), and the repairs in
 * gold (kintsugi).
 */
(function (root) {
  'use strict';
  var SW = root.SW;
  var ctx = null, view = null, opts = null, build = null;
  // the Read view's own, from bench-kit (set once SW.readView has made it)
  function paintSel() { ctx.paintSel(); }
  function applyFilter() { ctx.applyFilter(); }
  function listingDoc(b, sel, o) { return ctx.listingDoc(b, sel, o); }
  function selLines() { return ctx.selLines(); }
  function render() { ctx.render(); }

  // ---------- the tapes a version is read from ----------
  // A version is assembled from its tapes read one after another as one
  // program: the program (sometimes in parts), a star table, and "supplied"
  // tapes taken from another build so that it assembles. Plain labels for each.
  function tapeTitle(b, pi) { return ((b.asm && b.asm.titles.filter(function (t) { return t.file === pi; })[0]) || {}).text || ''; }
  function isStars(b, pi) {
    var part = b.parts[pi];
    return /star/i.test(part.role) || /\bstars\b/i.test(tapeTitle(b, pi)) || /stars/i.test(part.src.split('/').pop());
  }
  function tapeInfo(b) {
    var progs = b.parts.filter(function (p, i) { return p.role === 'program' && !isStars(b, i); }).length, k = 0;
    return b.parts.map(function (part, pi) {
      var supplied = part.role !== 'program', star = isStars(b, pi);
      var label = star ? 'Star table' : supplied ? (/macro/i.test(part.role) ? 'Macro definitions' : part.role.charAt(0).toUpperCase() + part.role.slice(1))
        : progs > 1 ? 'Program, part ' + (++k) : 'Program';
      // A supplied tape's own date, from its title ("… june 1963"), so a later tape is seen as later.
      var d = /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(19\d\d)\b/i.exec(tapeTitle(b, pi));
      var when = d ? ', ' + ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][
        ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'].indexOf(d[1].toLowerCase())] + ' ' + d[2] : '';
      return { pi: pi, supplied: supplied, star: star, title: tapeTitle(b, pi).trim(), label: label + (supplied ? ' (supplied' + when + ')' : '') };
    });
  }
  // The hover explanation on the Tape menu: why one version has several files.
  function tapeHelp(info) {
    var progParts = info.filter(function (t) { return !t.supplied && !t.star; }).length;
    var h = 'Why ' + info.length + ' files? The PDP-1 assembler read paper tapes one after another as a single program, so a version can come in pieces. ' +
      'These are parts of one version, not copies or different versions:\n' + info.map(function (t) { return '  ' + (t.pi + 1) + '. ' + t.label; }).join('\n');
    if (progParts > 1) h += '\nThe program itself comes in ' + progParts + ' parts.';
    if (info.some(function (t) { return t.star; })) h += '\nThe star table, Peter Samson’s catalogue of the night sky, is read in with it.';
    if (info.some(function (t) { return t.supplied; })) h += '\n“Supplied” tapes are not in this version’s surviving source; they come from another build so that it assembles.';
    return h + '\nChoose All to read them in order, or one tape on its own.';
  }

  var PSEUDO = { define: 1, term: 1, terminate: 1, repeat: 1, constants: 1, variables: 1, start: 1,
                 text: 1, decimal: 1, octal: 1, flexo: 1, 'char': 1, character: 1, noinput: 1, expunge: 1 };

  // ---------- highlighting ----------
  function hl(raw, b) {
    var p = SW.parseLine(raw), h = '';
    if (p.loc) h += '<span class="num">' + SW.esc(p.loc) + '</span>';
    var lead = /^\s*/.exec(raw.slice(p.loc.length))[0];
    var code = raw.slice(p.loc.length, raw.length - p.comment.length);
    // labels
    var rest = code, m;
    while ((m = /^(\s*)([A-Za-z0-9\\~.]*[A-Za-z][A-Za-z0-9\\~.]*)(,)/.exec(rest))) {
      h += SW.esc(m[1]) + '<span class="lab sym" data-s="' + SW.esc(m[2].replace(/[\\~.]/g, '')) + '">' + SW.esc(m[2]) + '</span>,';
      rest = rest.slice(m[0].length);
    }
    var first = true;
    h += rest.replace(/[A-Za-z0-9\\~.]+|[^A-Za-z0-9\\~.]+/g, function (tok) {
      if (!/[A-Za-z0-9]/.test(tok)) return SW.esc(tok);
      var name = tok.replace(/[\\~]/g, '').replace(/^\.(?=[a-z0-9])/i, ''), cls = 'sym';
      var over = /[\\~]/.test(tok) || (/^\.[a-z0-9]/i.test(tok) && b.parts.length && tok.length > 1);
      var isOp = first && /[a-z]/i.test(tok);
      var key = name.slice(0, 6);
      if (/^[0-9]+$/.test(tok)) cls = 'num';
      else if (PSEUDO[name]) cls = 'ps';
      else if (b.macros && b.macros[key]) cls = 'mac sym';
      else if (b.asm && b.asm.permanent && b.asm.permanent[key] !== undefined) cls = 'op sym';
      else if (tok === '.') cls = 'num';
      if (/[a-z]/i.test(tok)) first = false;
      if (over) cls += ' var';
      void isOp;
      return '<span class="' + cls + '" data-s="' + SW.esc(key) + '">' + SW.esc(tok) + '</span>';
    });
    if (p.comment) h += '<span class="cm">' + SW.esc(p.comment) + '</span>';
    void lead;
    return h;
  }

  // ---------- repairs, in gold (kintsugi) ----------
  // Where the text had to be changed to read or run: a reading corrected against
  // the scan (gold), a line remade where none can be read (a gold wash), a line
  // normalised for the assembler (paler gold: a change for running, not to the
  // evidence), an uncertain reading left as found (a grey wavy line). The changed
  // characters are underlined; hover for what was there, and why. The bar, the stepping and the
  // squiggle are bench-kit's kintsugi.js; which lines are repaired, and how, is this bench's.
  var K = SW.kintsugi, kinNorm = SW.store.get('read.kinNorm', false);
  // a line's code, without its comment or spacing: a normalisation that leaves this as it
  // was (a page break read as a blank line, a // comment read as /) is not marked
  function codeOf(x) { return String(x || '').replace(/\/.*$/, '').replace(/\s+/g, ' ').trim(); }
  // the repairs in order through the text, for ◆ ‹ ›: corrected, remade and uncertain lines, and the
  // lines normalised for the assembler when they are counted (otherwise left to the pale marks)
  function kinRows() { return SW.$$('.listing .ln.rp-fix, .listing .ln.rp-kake, .listing .ln.rp-unc' + (kinNorm ? ', .listing .ln.rp-norm' : ''), view); }
  function kinWhat(r) {
    var m = r.querySelector('.rp-c[title]');
    return m ? m.title.replace(/^Kintsugi · /, '') : r.classList.contains('rp-unc') ? 'Uncertain reading, left as found: ' + (build.lines[+r.dataset.p][+r.dataset.n - 1] || { raw: '' }).raw.trim() : '';
  }
  function stops() {
    return kinRows().map(function (r) {
      var p = +r.dataset.p, n = +r.dataset.n, w = kinWhat(r);
      var kind = r.classList.contains('rp-kake') ? 'remade' : r.classList.contains('rp-fix') ? 'corrected' : r.classList.contains('rp-unc') ? 'uncertain' : 'normalised';
      return { p: p, n0: n, n1: n, chip: { cls: 'kin-' + kind, label: kind }, short: w, what: w, toast: w,
               name: w.replace(/^(Corrected|Remade[^.]*\.|Uncertain reading, left as found): ?/, ''),
               note: w || 'Normalised for assembly: the assembler reads “' + (build.lines[p][n - 1] || { norm: '' }).norm.trim() + '”' };
    });
  }
  function kinScan(r) {   // the scanned listing, and the page the evidence names
    if (!r) return null;
    var p = +r.dataset.p, n = +r.dataset.n, src = build.parts[p].src, pdf = src.replace(/\.txt$/, '.pdf');
    if (!SW.SWHID || !SW.SWHID[pdf]) return null;
    var reg = ((root.SWVersions.REPAIRS || {})[src] || []).filter(function (x) { return x.n === n; })[0];
    var m = reg && /scan pp?\.\s*(\d+)/.exec(reg.ev);
    return { url: '../sources/' + pdf + (m ? '#page=' + m[1] : ''), page: m ? m[1] : '' };
  }
  var X = SW.kintsugi({
    stops: stops,
    paint: function () { paintRepairs(); },
    // the lines normalised for the assembler, counted or not, and the scan the evidence names
    extras: function (cur, ui) {
      var nn = SW.$$('.listing .ln.rp-norm', view).length, sc = kinScan(cur && SW.$('#L' + cur.p + '-' + cur.n0, view));
      return ui.tg('norm', kinNorm, 'Count the ' + nn + ' line' + (nn === 1 ? '' : 's') + ' normalised for the assembler among the repairs (paler gold)', String(nn)) +
        ui.b('scan', sc ? 'The scanned listing' + (sc.page ? ' at p. ' + sc.page : '') + ', the evidence, in a new tab' : 'No scan held for this text, or no page named', sc ? '' : ' disabled', sc && sc.page ? 'p. ' + sc.page : '');
    },
    act: function (k, cur, el, on) {
      if (k === 'norm') { kinNorm = on; SW.store.set('read.kinNorm', kinNorm); if (opts.onlyRepaired) applyFilter(); X.paintNav(); return true; }
      if (k === 'scan') { var sc = kinScan(cur && SW.$('#L' + cur.p + '-' + cur.n0, view)); if (sc) root.open(sc.url, '_blank', 'noopener'); return true; }
      return false;
    },
    copyLines: function () {
      return kinRows().map(function (r) { var w = kinWhat(r); return SW.refText(build.v.id, +r.dataset.p, +r.dataset.n, +r.dataset.n, build.parts.length) + '  ' + (w || (r.classList.contains('rp-norm') ? 'normalised for assembly' : '')); });
    },
    about: function () {
      return '<h4>The repair marks</h4><div class="keylist">' +
        '<div><span style="color:var(--kin)">●</span> <span class="rp-line">jmp <span class="rp-c rp-c-fix">srt</span></span> a reading corrected against the scan (the changed characters shaded)</div>' +
        '<div><span style="color:var(--kin)">■</span> <span class="rp-line"><span class="rp-c rp-c-kake">cma</span></span> a line remade where none can be read</div>' +
        '<div><span class="rp-c rp-c-norm">~ssn</span> normalised for assembly: a change for running, not to the reading</div>' +
        '<div><span style="text-decoration:underline wavy var(--text-faint);text-underline-offset:4px">ior (4</span> an uncertain reading, left as found</div>' +
        '<div class="faint" style="margin-top:6px">After kintsugi, the mending of pottery with gold, which leaves the repair visible: see Help ▸ What you should read, and Help ▸ Reconstruction cards.</div></div>';
    },
    titles: {
      tog: 'Repairs: where this text had to be changed to read or run (kintsugi). Click to show or hide the repairs bar',
      view: 'Mark in gold where the text had to be changed to read or run (kintsugi): readings corrected against the scan, lines remade, lines normalised for the assembler (paler), uncertain readings (grey). Hover a mark for what was there and why.',
      list: function (n) { return 'Every repair in this text (' + n + '), to jump to'; },
      keep: function (ref) { return 'Add this repair to My notes (' + ref + '), cited, with the line'; },
      copy: 'Copy every repair in this text, with references, as plain text'
    }
  });
  function paintRepairs() {
    var reg = root.SWVersions.REPAIRS || {};
    build.parts.forEach(function (part, p) {
      (reg[part.src] || []).forEach(function (r) {
        var row = SW.$('#L' + p + '-' + r.n, view), t = row && row.querySelector('.t'); if (!t) return;
        var L = build.lines[p][r.n - 1], text = opts.norm ? L.norm : L.raw, at = text.indexOf(r.now);
        var why = 'Kintsugi · ' + (r.kind === 'rebuilt' ? 'Remade: no reading survives here. ' : 'Corrected: ') + (r.was ? 'the transcription had “' + r.was + '”; ' : r.kind === 'fix' ? 'missing from the transcription; ' : '') + 'now “' + r.now + '”. Evidence: ' + r.ev + '. By ' + r.by + ', ' + r.date + '.';
        row.classList.add(r.kind === 'rebuilt' ? 'rp-kake' : 'rp-fix');
        // the line's code and comment, with a gold squiggle under them
        var c1 = text.replace(/\s+$/, '').length, c0 = text.search(/\S/);
        if (c0 >= 0 && c1 > c0) { K.wrapChars(t, c0, c1, 'rp-line', why); row.classList.add('rp-sq'); }
        if (at < 0) return;
        var d = r.was ? K.diffSpan(r.was, r.now) : [0, r.now.length];
        if (d[1] <= d[0]) d = [0, r.now.length];
        K.wrapChars(t, at + d[0], at + d[1], r.kind === 'rebuilt' ? 'rp-c rp-c-kake' : 'rp-c rp-c-fix', why);
      });
      build.lines[p].forEach(function (L) {
        if (L.skipped) return;
        var row = null;
        if (L.raw !== L.norm && codeOf(L.raw) !== codeOf(L.norm)) {
          row = SW.$('#L' + p + '-' + L.n, view); var t = row && row.querySelector('.t');
          if (t && !row.classList.contains('rp-fix')) {
            row.classList.add('rp-norm');
            var shown = opts.norm ? L.norm : L.raw, other = opts.norm ? L.raw : L.norm, d = K.diffSpan(other, shown);
            if (d[1] > d[0]) K.wrapChars(t, d[0], d[1], 'rp-c rp-c-norm', 'Kintsugi · Normalised for assembly (a change for running, not to the reading): the assembler reads “' + L.norm.trim() + '”');
          }
        }
        if (/\[\?/.test(L.raw) && codeOf(L.raw)) {
          row = row || SW.$('#L' + p + '-' + L.n, view);
          if (row) {
            row.classList.add('rp-unc');
            var tu = row.querySelector('.t'), sh = opts.norm ? L.norm : L.raw, u0 = sh.search(/\S/), u1 = sh.replace(/\s+$/, '').length;
            if (tu && !row.classList.contains('rp-sq') && u0 >= 0 && u1 > u0) { K.wrapChars(tu, u0, u1, 'rp-line', 'Kintsugi · Uncertain reading, left as found (not repaired): ' + L.raw.trim()); row.classList.add('rp-sq', 'rp-sq-unc'); }
          }
        }
      });
    });
  }

  // ---------- the selection: the assembler's (on the bar, with the kit's) ----------
  function bpSel() {
    var ws = [];
    selLines().forEach(function (L) { ((build.asm.byLine[L.p] || [])[L.n] || []).forEach(function (w) { ws.push(w.loc); }); });
    if (!ws.length) { SW.toast('No assembled words on these lines'); return; }
    SW.breakpoints = SW.breakpoints || {};
    var on = !SW.breakpoints[ws[0]];
    SW.breakpoints[ws[0]] = on;
    if (!on) delete SW.breakpoints[ws[0]];
    SW.emit('breakpoints');
    SW.toast((on ? 'Breakpoint set at ' : 'Breakpoint cleared at ') + SW.oct(ws[0], 4));
    render();
  }
  function runToSel() {
    var L = selLines().filter(function (x) { return (build.asm.byLine[x.p] || [])[x.n]; })[0];
    if (!L) { SW.toast('No assembled words on these lines'); return; }
    SW.emit('runTo', build.asm.byLine[L.p][L.n][0].loc);
  }

  // ---------- the pop-up on a symbol ----------
  function symbol(name, b) {
    var s = b.sym[name];
    var g = SW.glosses && SW.glosses[name];
    var h = '<h4>' + SW.esc(name) + '</h4>';
    if (g) {
      h += '<div><b>' + SW.esc(g.name) + '</b> <span class="faint">' + SW.esc(g.params || '') + ' · opcode ' + SW.esc(g.octal || '') + '</span></div>' +
        '<div style="margin-top:4px;font-family:var(--serif);font-size:14px">' + SW.esc(g.description) + '</div>';
    }
    if (b.macros[name]) {
      var m = b.macros[name];
      h += '<div>Macro, dummies: <span class="mono">' + SW.esc(m.args.join(', ') || '(none)') + '</span></div>' +
        '<div class="refs"><a href="#" data-p="' + m.file + '" data-n="' + m.line + '">defined at ' + SW.esc(b.parts[m.file].src) + ':' + m.line + '</a> ' + SW.refTag(b.v.id, m.file, m.line, m.line, b.parts.length) + '</div>' +
        '<pre class="mono" style="max-height:160px;overflow:auto;margin:6px 0 0">' + SW.esc(m.body) + '</pre>';
    }
    if (s) {
      h += '<div>' + (s.variable ? 'Variable' : s.label ? 'Label' : 'Symbol') + ' = <span class="num mono">' + SW.oct(s.val) + '</span>' +
        (!s.defined ? ' <span class="badge err">undefined</span>' : '') + '</div>';
      var list = s.defs.map(function (d) { return ['def', d]; }).concat(s.refs.map(function (r) { return ['ref', r]; }));
      h += '<div class="refs">' + list.slice(0, 200).map(function (x) {
        var L = b.lines[x[1].file][x[1].line - 1];
        return '<a href="#" data-p="' + x[1].file + '" data-n="' + x[1].line + '">' + (x[0] === 'def' ? '◆ ' : '· ') +
          x[1].line + '  ' + SW.esc((L ? L.raw : '').trim().slice(0, 44)) + '</a>';
      }).join('') + '</div><div class="faint">' + s.defs.length + ' definition(s), ' + s.refs.length + ' reference(s)</div>';
    }
    if (!g && !s && !b.macros[name]) h += '<div class="faint">No symbol of this name in this build.</div>';
    else if (s || b.macros[name]) h += '<div style="margin-top:6px"><a href="#" data-bio="' + SW.esc(name) + '" title="Follow this name through every version: when it appears, changes and goes (Text ▾ Symbol histories)">Its history across the versions →</a></div>';
    return h;
  }

  ctx = SW.readView({
    hl: hl,
    mark: function (html) { return html.replace(/\f/g, '<span class="pgbrk" title="Page break: a stop code on the tape, or a form feed in the listing">↡</span>'); },
    files: {
      word: 'Tape', info: tapeInfo, help: tapeHelp, jump: 'all',
      chips: function (b, pi) { var part = b.parts[pi]; return (part.role && part.role !== 'program' ? ' <span class="rp-chip rp-sup" title="Kintsugi · Supplied (yobitsugi): this tape is not part of this version’s surviving text. It comes from another: ' + SW.esc(part.role) + '. Like a piece from another vessel set into a mended bowl (yobitsugi).">supplied</span>' :
         /R$/.test(SW.REF[b.v.id] || '') ? ' <span class="rp-chip rp-rec" title="Kintsugi · A reconstruction: this text was rebuilt, not transcribed from a surviving listing or tape (the R of its reference). ' + SW.esc(SW.MADE[b.v.id] || '') + '">reconstruction</span>' : ''); },
      sub: function (b, pi, t) {
        var part = b.parts[pi], span = part.end ? 'lines ' + part.title + '–' + part.end : part.title > 1 ? 'from line ' + part.title : 'whole file';
        return '' + SW.sourceLink(part.src, part.src.split('/').pop()) +
        ' · ' + (part.tape ? 'punched tape, decoded from FIO-DEC' : 'text file') + ' · ' + span +
        (t.title ? ' · <span title="The tape’s own title line">“' + SW.esc(t.title) + '”</span>' : '');
      }
    },
    errors: { word: 'assembly error', title: function (b) { return 'What the error' + (b.asm.errorCount > 1 ? 's are' : ' is') + ', explained (' + b.asm.words.length + ' words; start ' + SW.oct(b.asm.start, 4) + ')'; } },
    words: function (b, L) { return b.asm && b.asm.byLine[L.p] && b.asm.byLine[L.p][L.n]; },
    expand: function (b, p, n) {
      var ws = (b.asm.byLine[p] || [])[n]; if (!ws) return '';
      return ws.map(function (w) {
        var ex = SW.profile && SW.profile.build === b ? SW.profile.exec[w.loc] : null;
        return SW.oct(w.loc, 4) + '  ' + SW.oct(w.val) + '  ' + SW.esc(root.PDP1CPU.disasm(w.val, b.symAt)) +
          (w.macro ? '  <span class="faint">(macro ' + SW.esc(w.macro) + ')</span>' : '') +
          (w.kind ? '  <span class="faint">(' + w.kind + ')</span>' : '') +
          (ex ? '  <span class="num">×' + ex + '</span>' : '');
      }).join('\n');
    },
    norm: true, heat: true,
    titles: { words: 'Show the address each line was assembled to (octal) and the 18-bit word it became; click either to see every word a line made, with its disassembly', norm: 'Normalised: the text as the assembler read it, after the documented normalisations for this version (for example a transcription&#39;s &quot;.sx1&quot; read as the overlined variable &quot;~sx1&quot;, or modern &quot;//&quot; comments read as MACRO comments). Unticked: the source exactly as held in sources/. Normalised lines are marked with a violet rule by their line numbers.' , address: 'Where the line’s first word was placed in core memory, in octal (0000–7777)', word: 'The 18-bit machine word the line assembled to, in octal; “+N” means N more words followed (hover a row for the count)', source: 'The source as written (or as the assembler read it, with Normalised text on in View)' },
    rowTitle: function (b, L, k, title) {
      if (title) return title;
      if (L.raw !== L.norm && !L.skipped) return 'Normalised for assembly: ' + L.norm;
      if (L.skipped) return 'Not assembled (transcription header or outside this tape segment)';
      return '';
    },
    key: function () {
      return '<h4>Key</h4><div class="keylist">' +
        '<div><i class="kx kdef"></i>inside a macro definition (define … term)</div>' +
        '<div><i class="kx kcall"></i>a macro called here (hover the word column for how many words it made; “+5” means five more)</div>' +
        '<div><i class="kx keq"></i>a symbol set with “=”</div>' +
        '<div><i class="kx kcom"></i>a line of comment only</div>' +
        '<div><i class="kx knorm"></i>normalised for assembly (hover the line to see how)</div>' +
        '<div class="faint" style="margin-top:6px">Repairs, in gold (kintsugi; View ▸ Repairs):</div>' +
        '<div><span style="color:var(--kin)">●</span> <span class="rp-line">jmp <span class="rp-c rp-c-fix">srt</span></span> a reading corrected against the scan: the line’s code underlined in gold, the changed characters shaded (hover for what was there, and the evidence)</div>' +
        '<div><span style="color:var(--kin)">■</span> <span class="rp-line"><span class="rp-c rp-c-kake">cma</span></span> a line remade where none can be read</div>' +
        '<div><span class="rp-c rp-c-norm">~ssn</span> normalised for assembly, in paler gold: a change for running, not to the reading</div>' +
        '<div><span style="text-decoration:underline wavy var(--text-faint);text-underline-offset:4px">ior (4</span> an uncertain reading, left as found</div>' +
        '<div><span class="rp-chip rp-sup">supplied</span> a tape from another text; <span class="rp-chip rp-rec">reconstruction</span> a text rebuilt, not transcribed</div>' +
        '<div><i class="kx knoted"></i>covered by an annotation (initials at the right; click them)</div>' +
        '<div><span class="errs">lac x</span> an assembly error (hover for the message)</div>' +
        '<div><span style="color:var(--red)">●</span> a breakpoint (set from the selection bar)</div>' +
        '<div><span class="faint"><i>italic grey</i></span> not assembled (a transcription header, or outside this tape segment)</div>' +
        '<div class="faint flow" style="margin-top:6px">Text: <span class="lab">labels</span>, <b>instructions</b>, <span class="mac">macros</span>, <span class="ps">pseudo-instructions</span>, <span class="num">numbers</span>, <span class="cm">comments</span>.</div></div>';
    },
    symbol: symbol,
    selActs: function () { return [['● Breakpoint', bpSel], ['▶ Run to here', runToSel]]; },
    lost: 'What is absent is also part of the record. Annotations on this version can still be kept under “Versions”.',
    repairs: X,
    onShow: function (b) { build = b; }
  });
  view = ctx.view; opts = ctx.opts;
})(this);
