/*
 * read.js - the listing: source as held, with what the assembler made of it.
 */
(function (root) {
  'use strict';
  var SW = root.SW, N = SW.notes;
  var view = SW.$('#view-read');
  var R = SW.views.read = {};
  var build = null, notes = [], counts = {}, noted = {}, anchorSel = null;
  // tapes: which of the version's tapes to show: 'all', or a single tape's index.
  var opts = { words: SW.store.get('read.words', true), norm: false, tapes: 'all', heat: false, onlyNoted: false, by: '', notes: SW.store.get('read.notes', 'inline'), onlyRepaired: false, kinNorm: SW.store.get('read.kinNorm', false), kinBar: SW.store.get('read.kinBar', false), show: SW.store.get('read.show', 'all'), ghosts: SW.store.get('read.ghosts', true), repairs: SW.store.get('read.repairs', true) };
  // show: whose annotations Read shows: 'all', 'mine' (those you started) or 'none';
  // cycled from the chevron on the Annotations heading.
  var SHOW = { all: '▾ All', mine: '▾ Mine', open: '▾ Open', none: '▸ None' }, SHOW_NEXT = { all: 'mine', mine: 'open', open: 'none', none: 'all' };
  function isMine(n) { var me = SW.me().initials; return N.mine(n) || (!!me && n.by === me); }
  // notes: 'inline' (each thread under its lines, the default), 'margin' (cards
  // beside the lines) or 'off' (initials at the line end); chosen from the ▴ Notes button.
  function marginOn() { return opts.notes === 'margin'; }

  // Annotations in Read (threads, ghosts, the margin, the selection, export): bench-kit's readnotes.js
  var K = SW.readNotes({ view: view, R: R, opts: opts, isMine: isMine, showsTape: showsTape, filtering: filtering,
    keptLines: keptLines, tapeInfo: tapeInfo, kinBar: kinBar, selActs: function () { return [['● Breakpoint', bpSel], ['▶ Run to here', runToSel]]; } });
  var paintNotes = K.paintNotes, paintMargin = K.paintMargin, layoutMargin = K.layoutMargin, wireMargin = K.wireMargin,
    threadClick = K.threadClick, threadFor = K.threadFor, loadGhosts = K.loadGhosts, MODES = K.MODES, modeOf = K.modeOf,
    setNotes = K.setNotes, modeBtn = K.modeBtn, live = K.live, paintSel = K.paintSel, annotateSel = K.annotateSel,
    selLines = K.selLines, copy = K.copy, listingDoc = K.listingDoc, ro = null;

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
  function showsTape(pi) { return opts.tapes === 'all' || +opts.tapes === pi; }
  function tapeOptions(b, info) {
    var o = [['all', 'All ' + info.length + ' tapes']].concat(info.map(function (t) { return [String(t.pi), (t.pi + 1) + '. ' + t.label]; }));
    return o.map(function (x) { return '<option value="' + x[0] + '"' + (x[0] === String(opts.tapes) ? ' selected' : '') + '>' + SW.esc(x[1]) + '</option>'; }).join('');
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
  SW.hlLine = function (raw, b) { return hl(raw, b); };   // also used by the Functional overview
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

  // ---------- rendering ----------
  function rowHTML(b, L) {
    var k = L.p + ':' + L.n, cls = 'ln';
    var words = b.asm && b.asm.byLine[L.p] && b.asm.byLine[L.p][L.n];
    if (L.skipped) cls += ' skip';
    if (b.errorsAt[k]) cls += ' err';
    if (L.raw !== L.norm && !L.skipped) cls += ' norm';
    if (b.kind && b.kind[k]) cls += ' k' + b.kind[k];
    if (SW.breakpoints && words && words.some(function (w) { return SW.breakpoints[w.loc]; })) cls += ' bp';
    var a = '', w = '', wTitle = '';
    if (words && words.length) {
      a = SW.oct(words[0].loc, 4);
      w = SW.oct(words[0].val) + (words.length > 1 ? ' <span class="faint">+' + (words.length - 1) + '</span>' : '');
      var last = words[words.length - 1].loc;
      wTitle = words.length === 1 ? '1 word, at ' + a
        : words.length + ' words, at ' + (last - words[0].loc === words.length - 1 ? a + '–' + SW.oct(last, 4) : words.map(function (x) { return SW.oct(x.loc, 4); }).join(', ')) +
          (b.kind && b.kind[k] === 'call' ? ' (the macro expanded)' : '');
      wTitle += words.length === 1 ? '. Click to see it.' : '. Click to see them all.';
    }
    var text = opts.norm ? L.norm : L.raw;
    var mk = N.marginMark(k, counts[k]);
    if (noted[k]) cls += ' noted';
    var heat = '';
    if (opts.heat && SW.profile && SW.profile.build === b && words) {
      var ex = 0;
      words.forEach(function (x) { ex += SW.profile.exec[x.loc] || 0; });
      if (ex) heat = 'background:color-mix(in srgb, var(--amber) ' + (100 * Math.min(0.5, 0.06 + Math.log10(1 + ex) / 12)).toFixed(1) + '%, transparent)';
    }
    var title = '';
    if (b.errorsAt[k]) title = b.errorsAt[k].map(function (e) { return e.message + (e.symbol ? ' "' + e.symbol + '"' : ''); }).join('; ');
    else if (L.raw !== L.norm && !L.skipped) title = 'Normalised for assembly: ' + L.norm;
    else if (L.skipped) title = 'Not assembled (transcription header or outside this tape segment)';
    return '<div class="' + cls + '" id="L' + L.p + '-' + L.n + '" data-p="' + L.p + '" data-n="' + L.n + '"' +
      (title ? ' title="' + SW.esc(title) + '"' : '') + '>' +
      '<span class="n" style="--d:' + String(L.n).length + ';' + heat + '"><button class="qa" tabindex="-1" title="Annotate this">+A</button>' + L.n + '</span><span class="a"' + (wTitle ? ' title="' + SW.esc(wTitle) + '"' : '') + '>' + a + '</span>' +
      '<span class="w"' + (wTitle ? ' title="' + SW.esc(wTitle) + '"' : '') + '>' + w + '</span>' +
      '<span class="t">' + (text ? hl(text, b).replace(/\f/g, '<span class="pgbrk" title="Page break: a stop code on the tape, or a form feed in the listing">↡</span>') : ' ') + '</span><span class="mk">' + mk + '</span></div>';
  }

  function render() {
    var b = build;
    view.innerHTML = '';
    var tb = SW.el('div', { class: 'toolbar' });
    tb.innerHTML =
      '<input type="search" id="rd-find" placeholder="Find text or /regex/ …">' +
      '<button class="btn" id="rd-prev" title="Previous match">↑</button><button class="btn" id="rd-next" title="Next match">↓</button>' +
      '<span class="hint" id="rd-hits"></span><span class="sep"></span>' +
      '<details class="menu"><summary class="btn" title="What the listing shows">View ▾</summary><div class="menu-body">' +
      '<label class="check" title="Show the address each line was assembled to (octal) and the 18-bit word it became; click either to see every word a line made, with its disassembly"><input type="checkbox" id="rd-words"' + (opts.words ? ' checked' : '') + '> Addresses &amp; words</label>' +
      '<label class="check" title="Normalised: the text as the assembler read it, after the documented normalisations for this version (for example a transcription&#39;s &quot;.sx1&quot; read as the overlined variable &quot;~sx1&quot;, or modern &quot;//&quot; comments read as MACRO comments). Unticked: the source exactly as held in sources/. Normalised lines are marked with a violet rule by their line numbers."><input type="checkbox" id="rd-norm"' + (opts.norm ? ' checked' : '') + '> Normalised text</label>' +
      '<label class="check" title="Hide every line that no annotation covers, so the listing reads as the discussion so far. A dashed rule marks where lines are left out. Exports of the whole listing follow the filter."><input type="checkbox" id="rd-noted"' + (opts.onlyNoted ? ' checked' : '') + '> Only annotated lines</label>' +
      '<label class="check" title="Show only annotations (and the lines they cover) in which these initials take part, as author or in a reply">Annotations by <select id="rd-by"><option value="">anyone</option></select></label>' +
      '<label class="check" title="Shade each line by how often it ran, from the profile collected in the Run view (run the program there first)"><input type="checkbox" id="rd-heat"' + (opts.heat ? ' checked' : '') + '> Run heat</label>' +
      '<label class="check" title="Mark in gold where the text had to be changed to read or run (kintsugi): readings corrected against the scan, lines remade, lines normalised for the assembler (paler), uncertain readings (grey). Hover a mark for what was there and why."><input type="checkbox" id="rd-repairs"' + (opts.repairs ? ' checked' : '') + '> Repairs (gold)</label>' +
      '</div></details><span class="hint" id="rd-nf"></span>' +
      '<span class="undo-pair"><button class="btn" id="rd-undo" disabled title="Undo">↶</button><button class="btn" id="rd-redo" disabled title="Redo">↷</button></span>' +
      '<span class="kin-nav" hidden><button class="btn" id="rd-kprev" title="The previous repair">‹</button>' +
      '<button class="btn kin-tog" id="rd-klist" aria-expanded="false" title="Repairs: where this text had to be changed to read or run (kintsugi). Click to show or hide the repairs bar"><span class="kin-dia">◆</span> <span class="kin-n"></span> <span class="kin-chev" aria-hidden="true">⌄</span></button>' +
      '<button class="btn" id="rd-knext" title="The next repair">›</button></span>';
    tb.appendChild(SW.el('button', { class: 'btn', title: 'What the colours and marks in the listing mean', onclick: function (e) {
      SW.pop(e.clientX, e.clientY, '<h4>Key</h4><div class="keylist">' +
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
        '<div class="faint flow" style="margin-top:6px">Text: <span class="lab">labels</span>, <b>instructions</b>, <span class="mac">macros</span>, <span class="ps">pseudo-instructions</span>, <span class="num">numbers</span>, <span class="cm">comments</span>.</div></div>');
    } }, 'Key'));
    if (b.v.build && b.parts.length > 1) {
      var ti = tapeInfo(b);
      tb.appendChild(SW.el('label', { class: 'check tape-pick', title: tapeHelp(ti) },
        'Tape <select id="rd-tape">' + tapeOptions(b, ti) + '</select> <span class="help-dot">?</span>'));
    }
    // Only assembly errors are flagged here; the word count and start address
    // are on the Version & notes page.
    if (b.asm && b.asm.errorCount) {
      var eb = SW.el('button', { class: 'badge err', title: 'What the error' + (b.asm.errorCount > 1 ? 's are' : ' is') + ', explained (' + b.asm.words.length + ' words; start ' + SW.oct(b.asm.start, 4) + ')' },
        b.asm.errorCount + ' assembly error' + (b.asm.errorCount > 1 ? 's' : ''));
      eb.onclick = function () { SW.asmErrors(b); };
      tb.appendChild(eb);
    } else if (!b.asm) tb.appendChild(SW.el('span', { class: 'hint' }, 'No source survives.'));
    tb.appendChild(SW.el('span', { class: 'sep' }));
    if (b.v.build && SW.edition) tb.appendChild(SW.edition.menu(function () { return build; }));
    // one Export menu: the listing (as shown, or the annotated lines only) to Word or
    // Markdown, or the annotations with their lines into My notes
    var exm = SW.el('details', { class: 'menu more-menu' });
    exm.innerHTML = '<summary class="btn" title="Export this version’s listing, or put its annotations in My notes">⤓ Export ▾</summary><div class="menu-body">' +
      '<p class="hint">The listing, as shown</p><button class="btn ghost" data-ex="all:docx">⤓ Word</button><button class="btn ghost" data-ex="all:md">⤓ Markdown</button>' +
      '<p class="hint">The annotated lines only</p><button class="btn ghost" data-ex="noted:docx">⤓ Word</button><button class="btn ghost" data-ex="noted:md">⤓ Markdown</button>' +
      '<p class="hint">Private</p><button class="btn ghost" data-ex="noted:tray" title="Each annotation with the lines it covers, as one excerpt in My notes">＋ My notes: the annotations</button></div>';
    exm.addEventListener('click', function (e) {
      var x = e.target.closest('[data-ex]'); if (!x) return;
      exm.open = false;
      var k = x.dataset.ex.split(':'), noted = k[0] === 'noted';
      var dp = listingDoc(b, null, { onlyNoted: noted });
      if (k[1] === 'tray') { dp.then(function (d) { if (!d.blocks.some(function (bl) { return bl.type === 'code'; })) { SW.toast('No annotations on this version yet.'); return; } SW.tray.addDoc(d); }); return; }
      Promise.resolve(dp).then(function (d) { SW.exportDoc(d, 'spacewar-' + b.v.id + (noted ? '-annotations' : '-listing'), k[1]); });
    });
    tb.appendChild(exm);
    tb.appendChild(SW.el('button', { class: 'btn notes-mode', id: 'rd-notes-mode', onclick: function () {
      var i = MODES.indexOf(modeOf(opts.notes));
      setNotes(MODES[(i + 1) % MODES.length][0]);
    } }));
    view.appendChild(tb);

    if (!b.v.build) {
      var lost = SW.el('div', { class: 'pad prose' });
      lost.innerHTML = '<h2>' + SW.esc(b.v.label) + '</h2><p>' + SW.esc(b.v.summary) + '</p><p class="muted">What is absent is also part of the record. Annotations on this version can still be kept under “Versions”.</p>';
      view.appendChild(lost);
      return;
    }
    view.appendChild(SW.el('div', { class: 'selbar', id: 'rd-selbar' }));
    renderListing();
    wireTb(tb);
    modeBtn();
  }

  // ---------- repairs, in gold (kintsugi) ----------
  // Where the text had to be changed to read or run: a reading corrected against
  // the scan (gold), a line remade where none can be read (a gold wash), a line
  // normalised for the assembler (paler gold: a change for running, not to the
  // evidence), an uncertain reading left as found (a grey wavy line). The changed
  // characters are underlined; hover for what was there, and why.
  function diffSpan(a, b) {   // where b differs from a: [start, end) in b
    var i = 0, j = 0;
    while (i < a.length && i < b.length && a[i] === b[i]) i++;
    while (j < a.length - i && j < b.length - i && a[a.length - 1 - j] === b[b.length - 1 - j]) j++;
    return [i, Math.max(i, b.length - j)];
  }
  function wrapChars(t, s, e, cls, title) {
    var nodes = [], w = document.createTreeWalker(t, NodeFilter.SHOW_TEXT), x, pos = 0;
    while ((x = w.nextNode())) nodes.push(x);
    nodes.forEach(function (nd) {
      var len = nd.nodeValue.length, a = Math.max(s, pos), b = Math.min(e, pos + len);
      if (a < b) {
        var piece = nd;
        if (a > pos) piece = piece.splitText(a - pos);
        if (b - a < piece.nodeValue.length) piece.splitText(b - a);
        var sp = SW.el('span', { class: cls, title: title });
        piece.parentNode.insertBefore(sp, piece); sp.appendChild(piece);
      }
      pos += len;
    });
  }
  // a line's code, without its comment or spacing: a normalisation that leaves this as it
  // was (a page break read as a blank line, a // comment read as /) is not marked
  function codeOf(x) { return String(x || '').replace(/\/.*$/, '').replace(/\s+/g, ' ').trim(); }
  // The repairs in order through the text, for ◆ ‹ › in the toolbar: corrected,
  // remade and uncertain lines (normalisations are left to the pale marks)
  var kinAt = -1;
  function kinRows(all) { return SW.$$('.listing .ln.rp-fix, .listing .ln.rp-kake, .listing .ln.rp-unc' + (opts.kinNorm ? ', .listing .ln.rp-norm' : ''), view).filter(function (r) { return all || r.offsetParent; }); }
  function kinWhat(r) {
    var m = r.querySelector('.rp-c[title]');
    return m ? m.title.replace(/^Kintsugi · /, '') : r.classList.contains('rp-unc') ? 'Uncertain reading, left as found: ' + (build.lines[+r.dataset.p][+r.dataset.n - 1] || { raw: '' }).raw.trim() : '';
  }
  function kinPaint() {
    var nav = SW.$('.kin-nav', view); if (!nav) return;
    var n = opts.repairs ? kinRows().length : 0;
    nav.hidden = !n;
    SW.$('.kin-n', nav).textContent = n;
    kinBar();
  }
  function kinGo(r) {
    var p = +r.dataset.p, n = +r.dataset.n;
    SW.state.sel = { p: p, n0: n, n1: n }; paintSel(); SW.writeQuery();
    r.scrollIntoView({ block: 'center' });
    r.classList.remove('kin-flash'); void r.offsetWidth; r.classList.add('kin-flash');
    var w = kinWhat(r); if (w) SW.toast(w, 6000);
  }
  function kinStep(dir) {
    var rows = kinRows(); if (!rows.length) return;
    var s = SW.state.sel, cur = -1;
    if (s) rows.forEach(function (r, i) { var p = +r.dataset.p, n = +r.dataset.n; if (p < s.p || (p === s.p && n <= s.n0)) cur = i; });
    var i = dir > 0 ? (s && cur >= 0 && +rows[cur].dataset.p === s.p && +rows[cur].dataset.n === s.n0 ? cur + 1 : cur + 1) : (s && cur >= 0 && +rows[cur].dataset.p === s.p && +rows[cur].dataset.n === s.n0 ? cur - 1 : cur);
    i = (i + rows.length) % rows.length;
    kinGo(rows[i]);
  }
  function kinList(btn) {
    var rows = kinRows(), r0 = btn.getBoundingClientRect();
    SW.pop(r0.left, r0.bottom + 4, '<h4>Repairs in this text (' + rows.length + ')</h4><div class="kin-list">' + rows.map(function (r, i) {
      var kind = r.classList.contains('rp-kake') ? 'remade' : r.classList.contains('rp-fix') ? 'corrected' : 'uncertain';
      return '<a href="#" data-k="' + i + '"><span class="kin-k kin-' + kind + '">' + kind + '</span> <span class="mono">' + SW.esc(SW.refText(build.v.id, +r.dataset.p, +r.dataset.n, +r.dataset.n, build.parts.length)) + '</span><span class="kin-w">' + SW.esc(kinWhat(r).replace(/^(Corrected|Remade[^.]*\.|Uncertain reading, left as found): ?/, '')) + '</span></a>';
    }).join('') + '</div>');
    var pop = SW.$('.pop');
    if (pop) pop.addEventListener('click', function (e) { var a = e.target.closest('[data-k]'); if (!a) return; e.preventDefault(); SW.unpop(); kinGo(rows[+a.dataset.k]); });
  }
  // ◆ ▾: the repairs menu (built each time it opens, so it shows the state as it is)
  function kinCurrent() {   // the selected line if it is a repair, else the next one after it
    var rows = kinRows(), s = SW.state.sel;
    if (!rows.length) return null;
    if (s) { var hit = rows.filter(function (r) { return +r.dataset.p === s.p && +r.dataset.n >= s.n0 && +r.dataset.n <= s.n1; })[0]; if (hit) return hit;
             var nx = rows.filter(function (r) { return +r.dataset.p > s.p || (+r.dataset.p === s.p && +r.dataset.n > s.n1); })[0]; if (nx) return nx; }
    return rows[0];
  }
  function kinScan(r) {   // the scanned listing, and the page the evidence names
    if (!r) return null;
    var p = +r.dataset.p, n = +r.dataset.n, src = build.parts[p].src, pdf = src.replace(/\.txt$/, '.pdf');
    if (!SW.SWHID || !SW.SWHID[pdf]) return null;
    var reg = ((root.SWVersions.REPAIRS || {})[src] || []).filter(function (x) { return x.n === n; })[0];
    var m = reg && /scan pp?\.\s*(\d+)/.exec(reg.ev);
    return { url: '../sources/' + pdf + (m ? '#page=' + m[1] : ''), page: m ? m[1] : '' };
  }
  // ◆ ⌄: the repairs bar, folded down under the toolbar (redrawn as the selection and settings change)
  // small line icons for the repairs bar (currentColor, 14px)
  var KI = {
    list: '<path d="M2 4h10M2 7h10M2 10h10"/>',
    only: '<path d="M2 3h10L8.2 7.6V11L5.8 12V7.6z"/>',
    norm: '<path d="M2 6c1.5-1.6 3-1.6 5 0s3.5 1.6 5 0M2 9.5c1.5-1.6 3-1.6 5 0s3.5 1.6 5 0"/>',
    scan: '<path d="M3.5 1.5h5l2.5 2.5v8.5h-7.5z M8.5 1.5V4H11 M5.5 7h3.5M5.5 9.5h3.5"/>',
    keep: '<path d="M3.5 1.5h7v11L7 10l-3.5 2.5z M7 4v4M5 6h4"/>',
    copy: '<path d="M4.5 4.5h7v7h-7z M2.5 9.5v-7h7"/>',
    card: '<path d="M1.5 3.5h11v7h-11z M3.5 6h7M3.5 8h4.5"/>',
    cards: '<path d="M3.5 5.5h9v6.5h-9z M1.5 8.5V3.5h9 M5.5 8h5"/>',
    about: '<path d="M7 1.5a5.5 5.5 0 1 0 0 11a5.5 5.5 0 1 0 0-11z M7 6.2v3.8 M7 4.2v.1"/>'
  };
  function kic(k) { return '<svg class="ki" viewBox="0 0 14 14" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + KI[k] + '</svg>'; }
  // ◆ ⌄: the repairs bar, folded down under the toolbar (redrawn as the selection and settings change)
  function kinBar() {
    var bar = SW.$('.kin-bar', view), tog = SW.$('#rd-klist', view); if (!bar) return;
    var n = opts.repairs ? kinRows().length : 0, on = opts.kinBar && !!n;
    bar.hidden = !on;
    if (tog) { tog.setAttribute('aria-expanded', on ? 'true' : 'false'); tog.classList.toggle('open', on); }
    if (!on) return;
    var nn = SW.$$('.listing .ln.rp-norm', view).length, cur = kinCurrent(), sc = kinScan(cur);
    var ref = cur ? SW.refText(build.v.id, +cur.dataset.p, +cur.dataset.n, +cur.dataset.n, build.parts.length) : '';
    var s = SW.state.sel, here = cur && s && +cur.dataset.p === s.p && +cur.dataset.n >= s.n0 && +cur.dataset.n <= s.n1;
    function b(k, title, extra, lab) { return '<button class="kb" data-km="' + k + '" title="' + SW.esc(title) + '"' + (extra || '') + '>' + (KI[k] ? kic(k) : '') + (lab ? '<span>' + lab + '</span>' : '') + '</button>'; }
    function tg(k, on, title, lab) { return b(k, title, ' aria-pressed="' + (on ? 'true' : 'false') + '"', lab); }
    bar.innerHTML =
      '<button class="kb" data-km="prev" title="The previous repair">‹</button><button class="kb" data-km="next" title="The next repair">›</button>' +
      b('list', 'Every repair in this text (' + n + '), to jump to', '', String(n)) +
      (cur ? '<button class="kin-cur" data-km="go" title="' + SW.esc((here ? 'This repair' : 'The next repair after the selection') + ': ' + ref + ' ' + kinWhat(cur)) + '"><span class="mono">' + SW.esc(ref.replace(/^\[REF: |\]$/g, '')) + '</span> ' + SW.esc(kinWhat(cur)) + '</button>' : '') +
      '<span class="kbs"></span>' +
      tg('only', opts.onlyRepaired, 'Only the repaired lines, with two either side') +
      tg('norm', opts.kinNorm, 'Count the ' + nn + ' line' + (nn === 1 ? '' : 's') + ' normalised for the assembler among the repairs (paler gold)', String(nn)) +
      b('scan', sc ? 'The scanned listing' + (sc.page ? ' at p. ' + sc.page : '') + ', the evidence, in a new tab' : 'No scan held for this text, or no page named', sc ? '' : ' disabled', sc && sc.page ? 'p. ' + sc.page : '') +
      '<span class="kbs"></span>' +
      b('keep', cur ? 'Add this repair to My notes (' + ref + '), cited, with the line' : 'No repair selected', cur ? '' : ' disabled') +
      b('copy', 'Copy every repair in this text, with references, as plain text') +
      '<span class="kbs"></span>' +
      b('card', 'This version’s reconstruction card') +
      b('cards', 'All reconstruction cards') +
      b('about', 'What the gold marks mean') +
      '<button class="kb kb-x" data-km="close" title="Fold the repairs bar away">✕</button>';
  }
  function kinAct(k, el) {
    var on = el && el.getAttribute && el.hasAttribute('aria-pressed') ? el.getAttribute('aria-pressed') !== 'true' : el && el.checked;
    if (k === 'prev') kinStep(-1);
    else if (k === 'next') kinStep(1);
    else if (k === 'list') kinList(el || SW.$('#rd-klist', view));
    else if (k === 'go') { var g = kinCurrent(); if (g) kinGo(g); }
    else if (k === 'close') { opts.kinBar = false; SW.store.set('read.kinBar', false); kinBar(); }
    else if (k === 'scan') { var sc = kinScan(kinCurrent()); if (sc) root.open(sc.url, '_blank', 'noopener'); }
    else if (k === 'only') { opts.onlyRepaired = on; applyFilter(); var f = kinRows()[0]; if (f && opts.onlyRepaired) f.scrollIntoView({ block: 'center' }); }
    else if (k === 'norm') { opts.kinNorm = on; SW.store.set('read.kinNorm', opts.kinNorm); if (opts.onlyRepaired) applyFilter(); kinPaint(); }
    else if (k === 'marks') { var cb = SW.$('#rd-repairs', view); if (cb) { cb.checked = on; cb.dispatchEvent(new Event('change')); } }
    else if (k === 'copy') {
      var lines = kinRows(true).map(function (r) { var w = kinWhat(r); return SW.refText(build.v.id, +r.dataset.p, +r.dataset.n, +r.dataset.n, build.parts.length) + '  ' + (w || (r.classList.contains('rp-norm') ? 'normalised for assembly' : '')); });
      var text = 'Repairs in ' + build.v.label + ' ' + SW.refText(build.v.id) + ':\n' + lines.join('\n');
      (navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject()).then(function () { SW.toast(lines.length + ' repairs copied'); }, function () { root.prompt('Copy:', text); });
    }
    else if (k === 'keep') {   // the line, cited, with what was done to it, into My notes
      var r = kinCurrent(); if (!r || !SW.tray) return;
      var p = +r.dataset.p, n = +r.dataset.n, L = build.lines[p][n - 1], ref = SW.refText(build.v.id, p, n, n, build.parts.length);
      listingDoc(build, { p: p, n0: n, n1: n }).then(function (d) {
        d.title = 'Repair ' + ref;
        d.blocks.push({ type: 'p', text: kinWhat(r) || 'Normalised for assembly: the assembler reads “' + L.norm.trim() + '”' });
        SW.tray.addDoc(d, { anchor: { p: p, n0: n, n1: n, src: build.parts[p].src }, quote: L.raw, tags: ['repair'] });
      });
    }
    else if (k === 'card') SW.cardsOne(build.v.id);
    else if (k === 'cards') SW.cardsHelp();
    else if (k === 'about') {
      var r0 = (el || SW.$('#rd-klist', view)).getBoundingClientRect();
      SW.pop(r0.left, r0.bottom + 4, '<h4>The repair marks</h4><div class="keylist">' +
        '<div><span style="color:var(--kin)">●</span> <span class="rp-line">jmp <span class="rp-c rp-c-fix">srt</span></span> a reading corrected against the scan (the changed characters shaded)</div>' +
        '<div><span style="color:var(--kin)">■</span> <span class="rp-line"><span class="rp-c rp-c-kake">cma</span></span> a line remade where none can be read</div>' +
        '<div><span class="rp-c rp-c-norm">~ssn</span> normalised for assembly: a change for running, not to the reading</div>' +
        '<div><span style="text-decoration:underline wavy var(--text-faint);text-underline-offset:4px">ior (4</span> an uncertain reading, left as found</div>' +
        '<div class="faint" style="margin-top:6px">After kintsugi, the mending of pottery with gold, which leaves the repair visible: see Help ▸ What you should read, and Help ▸ Reconstruction cards.</div></div>');
    }
  }
  // The squiggle under a repaired (gold) or uncertain (grey) line, its code and comment:
  // measured once drawn, in em so it follows the text size
  function kinMeasure() {
    SW.$$('.listing .ln.rp-sq', view).forEach(function (row) {
      var rl = row.querySelectorAll('.rp-line'), first = rl[0], last = rl[rl.length - 1];
      if (!last) return;
      var r0 = row.getBoundingClientRect(), fs = parseFloat(getComputedStyle(row).fontSize) || 13;
      var tt = row.querySelector('.t'), a = first.getBoundingClientRect().left - r0.left, z = Math.min(last.getBoundingClientRect().right, tt ? tt.getBoundingClientRect().right : Infinity) - r0.left;   // not past a comment cut short
      if (!r0.width || z <= a) return;
      row.style.setProperty('--k0', (a / fs).toFixed(2) + 'em');
      row.style.setProperty('--kw', ((z - a) / fs).toFixed(2) + 'em');
    });
  }
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
        if (c0 >= 0 && c1 > c0) { wrapChars(t, c0, c1, 'rp-line', why); row.classList.add('rp-sq'); }
        if (at < 0) return;
        var d = r.was ? diffSpan(r.was, r.now) : [0, r.now.length];
        if (d[1] <= d[0]) d = [0, r.now.length];
        wrapChars(t, at + d[0], at + d[1], r.kind === 'rebuilt' ? 'rp-c rp-c-kake' : 'rp-c rp-c-fix', why);
      });
      build.lines[p].forEach(function (L) {
        if (L.skipped) return;
        var row = null;
        if (L.raw !== L.norm && codeOf(L.raw) !== codeOf(L.norm)) {
          row = SW.$('#L' + p + '-' + L.n, view); var t = row && row.querySelector('.t');
          if (t && !row.classList.contains('rp-fix')) {
            row.classList.add('rp-norm');
            var shown = opts.norm ? L.norm : L.raw, other = opts.norm ? L.raw : L.norm, d = diffSpan(other, shown);
            if (d[1] > d[0]) wrapChars(t, d[0], d[1], 'rp-c rp-c-norm', 'Kintsugi · Normalised for assembly (a change for running, not to the reading): the assembler reads “' + L.norm.trim() + '”');
          }
        }
        if (/\[\?/.test(L.raw) && codeOf(L.raw)) {
          row = row || SW.$('#L' + p + '-' + L.n, view);
          if (row) {
            row.classList.add('rp-unc');
            var tu = row.querySelector('.t'), sh = opts.norm ? L.norm : L.raw, u0 = sh.search(/\S/), u1 = sh.replace(/\s+$/, '').length;
            if (tu && !row.classList.contains('rp-sq') && u0 >= 0 && u1 > u0) { wrapChars(tu, u0, u1, 'rp-line', 'Kintsugi · Uncertain reading, left as found (not repaired): ' + L.raw.trim()); row.classList.add('rp-sq', 'rp-sq-unc'); }
          }
        }
      });
    });
  }

  // The listing alone, so choosing a tape keeps the toolbar (and a search) as it is.
  function renderListing() {
    var b = build, info = tapeInfo(b), bar = SW.$('#rd-selbar', view);
    SW.$$('.rd-body', view).forEach(function (x) { x.remove(); });
    var wrap = SW.el('div', { class: 'rd-body' + (marginOn() ? ' with-margin' : '') });
    var box = SW.el('div', { class: 'listing' + (opts.words ? '' : ' hide-words') });
    var margin = SW.el('div', { class: 'note-margin', 'aria-label': 'Annotations' });
    wrap.addEventListener('click', function (e) { if (e.target.closest('[data-asmerrs]')) { e.stopPropagation(); SW.asmErrors(b); } });
    b.parts.forEach(function (part, pi) {
      if (!showsTape(pi)) return;
      var t = info[pi], sec = SW.el('div', { class: 'part' });
      var errs = b.asm.errors.filter(function (e) { return e.file === pi; }).length;
      var span = part.end ? 'lines ' + part.title + '–' + part.end : part.title > 1 ? 'from line ' + part.title : 'whole file';
      sec.innerHTML = '<div class="part-head" data-p="' + pi + '">' +
        '<div class="ph-main">' + (b.parts.length > 1 ? '<span class="ph-num">Tape ' + (pi + 1) + ' of ' + b.parts.length + '</span>' : '') +
        '<span class="ph-title">' + SW.esc(t.label) + '</span> ' + SW.refTag(b.v.id, pi, null, null, b.parts.length) +
        (part.role && part.role !== 'program' ? ' <span class="rp-chip rp-sup" title="Kintsugi · Supplied (yobitsugi): this tape is not part of this version’s surviving text. It comes from another: ' + SW.esc(part.role) + '. Like a piece from another vessel set into a mended bowl (yobitsugi).">supplied</span>' :
         /R$/.test(SW.REF[b.v.id] || '') ? ' <span class="rp-chip rp-rec" title="Kintsugi · A reconstruction: this text was rebuilt, not transcribed from a surviving listing or tape (the R of its reference). ' + SW.esc(SW.MADE[b.v.id] || '') + '">reconstruction</span>' : '') +
        (errs ? '<button class="badge err" data-asmerrs title="What the error' + (errs > 1 ? 's are' : ' is') + ', explained">' + errs + ' assembly error' + (errs > 1 ? 's' : '') + '</button>' : '') + '</div>' +
        '<div class="ph-sub">' + SW.sourceLink(part.src, part.src.split('/').pop()) +
        ' · ' + (part.tape ? 'punched tape, decoded from FIO-DEC' : 'text file') + ' · ' + span +
        (t.title ? ' · <span title="The tape’s own title line">“' + SW.esc(t.title) + '”</span>' : '') + '</div>' +
        '<div class="lncols"><span class="n" title="The line’s number in the source file">Line</span>' +
        '<span class="a" title="Where the line’s first word was placed in core memory, in octal (0000–7777)">Address</span>' +
        '<span class="w" title="The 18-bit machine word the line assembled to, in octal; “+N” means N more words followed (hover a row for the count)">Word <button class="colfold" data-cf="0" title="Fold away Address and Word, for more room (View ▸ Addresses &amp; words brings them back too)">‹</button></span>' +
        '<span class="t" title="The source as written (or as the assembler read it, with Normalised text on in View)"><button class="colfold cf-show" data-cf="1" title="Show Address and Word">›</button>Source</span>' +
        '<span class="mk" title="Initials of anyone who has annotated the line; click them to read">Annotations<button class="ann-cyc" data-ann title="Show all annotations, only yours, only open questions, or none (click to change)">' + SHOW[opts.show] + '</button><button class="ann-cyc ghost-sw' + (opts.ghosts ? ' on' : '') + '" data-ghosts aria-pressed="' + !!opts.ghosts + '" title="Ghosts: annotations made on other versions, shown faintly on the lines here that match">Ghosts</button></span></div></div>';
      sec.insertAdjacentHTML('beforeend', b.lines[pi].filter(function (L) { return !L.away; }).map(function (L) { return rowHTML(b, L); }).join(''));
      box.appendChild(sec);
    });
    wrap.appendChild(box);
    wrap.appendChild(margin);
    view.insertBefore(wrap, bar);
    paintRepairs();
    kinMeasure();
    if (root.ResizeObserver && SW.$('.ln.rp-sq', box)) new ResizeObserver(function () { kinMeasure(); }).observe(box);   // measured again once shown (Read opened from another tab)
    box.classList.toggle('no-repairs', !opts.repairs);
    setTimeout(kinPaint, 0);
    wireBox(box);
    wireMargin(margin);
    applyFilter();
    paintSel();
    // Cards placed while Read was hidden all measure 0: place them again when it shows.
    if (ro) ro.disconnect();
    if (root.ResizeObserver) {
      ro = new ResizeObserver(function () {
        if (!marginOn() || !wrap.getClientRects().length) return;
        K.refit();
      });
      ro.observe(wrap);
    }
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

  function wireBox(box) {
    K.wireLit(box, '.ithread'); K.wireDrop(box);
    box.addEventListener('click', function (e) {
      var cf = e.target.closest('[data-cf]');
      if (cf) { setWords(cf.dataset.cf === '1'); return; }
      if (e.target.closest('[data-ghosts]')) {
        opts.ghosts = !opts.ghosts; SW.store.set('read.ghosts', opts.ghosts);
        SW.$$('[data-ghosts]', view).forEach(function (b) { b.classList.toggle('on', opts.ghosts); b.setAttribute('aria-pressed', String(opts.ghosts)); });
        if (opts.ghosts) SW.toast('Looking for annotations on the other versions…', 2500);
        loadGhosts().then(function () {
          paintNotes();
          if (opts.ghosts) SW.toast(K.ghostCount() ? K.ghostCount() + ' ghost annotation' + (K.ghostCount() === 1 ? '' : 's') + ' from other versions' : 'No annotations on other versions match lines here', 3500);
        });
        return;
      }
      if (e.target.closest('[data-ann]')) {
        opts.show = SHOW_NEXT[opts.show] || 'all'; SW.store.set('read.show', opts.show);
        SW.$$('[data-ann]', view).forEach(function (b) { b.textContent = SHOW[opts.show]; });
        paintNotes();
        SW.toast(opts.show === 'all' ? 'Showing all annotations' : opts.show === 'mine' ? 'Showing only your annotations' : opts.show === 'open' ? 'Showing only open questions' : 'Annotations hidden', 2500);
        return;
      }
      if (e.target.closest('.part-head')) return;   // tape headers only label (their source link opens GitHub)
      if (e.target.closest('.inote')) { threadClick(e); return; }   // note buttons are wired by N.wire
      // +A by a line number: a quick annotation on that line, or on the selection it is in
      var qa = e.target.closest('.qa');
      if (qa) {
        var qr = qa.closest('.ln'), qp = +qr.dataset.p, qn = +qr.dataset.n, s0 = SW.state.sel;
        var r0 = s0 && s0.p === qp && qn >= s0.n0 && qn <= s0.n1 ? s0 : { p: qp, n0: qn, n1: qn };
        SW.state.sel = r0; paintSel(); SW.writeQuery();
        annotateSel();
        return;
      }
      var dot = e.target.closest('.note-dot');
      if (dot) { showNotesFor(dot.dataset.k); return; }
      var sym = e.target.closest('.sym');
      if (sym) { symbolPop(sym.dataset.s, e.clientX, e.clientY); return; }
      var row = e.target.closest('.ln');
      if (!row) return;
      var p = +row.dataset.p, n = +row.dataset.n;
      if (e.target.closest('.a') || e.target.closest('.w')) { toggleExpansion(row, p, n); return; }
      if (e.shiftKey && anchorSel && anchorSel.p === p) {
        SW.state.sel = { p: p, n0: Math.min(anchorSel.n, n), n1: Math.max(anchorSel.n, n) };
      } else {
        anchorSel = { p: p, n: n };
        SW.state.sel = { p: p, n0: n, n1: n };
      }
      paintSel();
      SW.writeQuery();
      var k = p + ':' + n;
      if (counts[k] && opts.notes !== 'hide') {
        var card = opts.notes !== 'off' && threadFor(k);
        if (card) { card.scrollIntoView({ block: 'nearest' }); card.classList.add('flash'); setTimeout(function () { card.classList.remove('flash'); }, 900); }
        else showNotesFor(k);
      }
    });
  }

  // Address and Word shown or folded away: from View, or the chevron in the column headings
  function setWords(on) {
    opts.words = on; SW.store.set('read.words', on);
    var box = SW.$('.listing', view), cb = SW.$('#rd-words', view);
    if (box) box.classList.toggle('hide-words', !on);
    if (cb) cb.checked = on;
    kinMeasure();
    if (build && SW.$('.rd-body', view)) paintNotes();
  }
  // ↶ ↷: undo and redo what was done to annotations (notes.js keeps the steps)
  function paintUndo() {
    var u = SW.$('#rd-undo', view), r = SW.$('#rd-redo', view); if (!u) return;
    var h = N.history();
    u.disabled = !h.undo || h.busy; r.disabled = !h.redo || h.busy;
    u.title = h.undo ? 'Undo ' + h.undo + ' (⌘Z)' : 'Undo: nothing to undo yet';
    r.title = h.redo ? 'Redo ' + h.redo + ' (⇧⌘Z)' : 'Redo: nothing to redo';
  }
  SW.on('notes-history', paintUndo);
  function wireTb(tb) {
    SW.$('#rd-repairs', tb).onchange = function (e) { opts.repairs = e.target.checked; SW.store.set('read.repairs', opts.repairs); var bx = SW.$('.listing', view); if (bx) bx.classList.toggle('no-repairs', !opts.repairs); kinPaint(); };
    SW.$('#rd-kprev', tb).onclick = function () { kinStep(-1); };
    SW.$('#rd-knext', tb).onclick = function () { kinStep(1); };
    var kb = SW.el('div', { class: 'kin-bar', role: 'toolbar', 'aria-label': 'Repairs' }); kb.hidden = true;
    tb.appendChild(kb);
    SW.$('#rd-klist', tb).onclick = function () { opts.kinBar = !opts.kinBar; SW.store.set('read.kinBar', opts.kinBar); kinBar(); };
    kb.addEventListener('click', function (e) { var b = e.target.closest('[data-km]'); if (b && b.tagName !== 'INPUT' && !b.disabled) { e.preventDefault(); kinAct(b.dataset.km, b); if (!/^(close|list|about|card|cards)$/.test(b.dataset.km)) kinBar(); } });
    kb.addEventListener('change', function (e) { var b = e.target.closest('[data-km]'); if (b) { kinAct(b.dataset.km, b); kinBar(); } });
    SW.$('#rd-undo', tb).onclick = function () { N.undo(); };
    SW.$('#rd-redo', tb).onclick = function () { N.redo(); };
    setTimeout(paintUndo, 0);
    SW.$('#rd-words', tb).onchange = function (e) { setWords(e.target.checked); };
    SW.$('#rd-norm', tb).onchange = function (e) { opts.norm = e.target.checked; render(); };
    var tapeSel = SW.$('#rd-tape', tb);
    if (tapeSel) tapeSel.onchange = function () { opts.tapes = tapeSel.value; renderListing(); view.scrollTop = 0; };
    SW.$('#rd-noted', tb).onchange = function (e) { opts.onlyNoted = e.target.checked; applyFilter(); view.scrollTop = 0; };
    SW.$('#rd-by', tb).onchange = function (e) { opts.by = e.target.value; applyFilter(); view.scrollTop = 0; };
    fillBy();
    SW.$('#rd-heat', tb).onchange = function (e) {
      opts.heat = e.target.checked;
      if (opts.heat && !(SW.profile && SW.profile.build === build)) SW.toast('Run the program in the Run view to collect a profile.');
      render();
    };
    var find = SW.$('#rd-find', tb), hits = [], hi = -1;
    function search() {
      SW.$$('.ln.cur', view).forEach(function (e) { e.classList.remove('cur'); });
      hits = [];
      var q = find.value;
      if (!q) { SW.$('#rd-hits', tb).textContent = ''; return; }
      var re;
      try { re = /^\/.*\/$/.test(q) ? new RegExp(q.slice(1, -1), 'i') : new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'); }
      catch (err) { SW.$('#rd-hits', tb).textContent = 'bad pattern'; return; }
      var keep = filtering() ? keptLines() : null;
      build.lines.forEach(function (ls, pi) { ls.forEach(function (L) { if (!L.away && re.test(L.raw) && (!keep || keep[L.p + ':' + L.n])) hits.push(L); }); });
      SW.$('#rd-hits', tb).textContent = hits.length + ' match' + (hits.length === 1 ? '' : 'es');
      hi = -1; step(1);
    }
    function step(d) {
      if (!hits.length) return;
      hi = (hi + d + hits.length) % hits.length;
      R.goto(hits[hi].p, hits[hi].n, true);
    }
    find.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.shiftKey ? step(-1) : (hits.length && find.dataset.q === find.value ? step(1) : (find.dataset.q = find.value, search())); } });
    SW.$('#rd-next', tb).onclick = function () { if (find.dataset.q !== find.value) { find.dataset.q = find.value; search(); } else step(1); };
    SW.$('#rd-prev', tb).onclick = function () { step(-1); };
  }

  function toggleExpansion(row, p, n) {
    var nx = row.nextElementSibling;
    if (nx && nx.classList.contains('expansion')) { nx.remove(); return; }
    var ws = (build.asm.byLine[p] || [])[n];
    if (!ws) return;
    var h = ws.map(function (w) {
      var ex = SW.profile && SW.profile.build === build ? SW.profile.exec[w.loc] : null;
      return SW.oct(w.loc, 4) + '  ' + SW.oct(w.val) + '  ' + SW.esc(root.PDP1CPU.disasm(w.val, build.symAt)) +
        (w.macro ? '  <span class="faint">(macro ' + SW.esc(w.macro) + ')</span>' : '') +
        (w.kind ? '  <span class="faint">(' + w.kind + ')</span>' : '') +
        (ex ? '  <span class="num">×' + ex + '</span>' : '');
    }).join('\n');
    var d = SW.el('div', { class: 'expansion' }, h);
    d.style.whiteSpace = 'pre';
    row.insertAdjacentElement('afterend', d);
  }

  function symbolPop(name, x, y) {
    var b = build, s = b.sym[name];
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
    var pop = SW.pop(x, y, h);
    pop.addEventListener('click', function (e) {
      var bio = e.target.closest('a[data-bio]');
      if (bio) { e.preventDefault(); SW.unpop(); SW.biography(bio.dataset.bio); return; }
      var a = e.target.closest('a[data-n]');
      if (!a) return;
      e.preventDefault();
      SW.unpop();
      R.goto(+a.dataset.p, +a.dataset.n, true);
    });
  }

  var openNotesKey = null, binInPanel = false;
  function showNotesFor(k, quiet) {
    var parts = k.split(':'), p = +parts[0], n = +parts[1];
    var ts = N.threads(notes).filter(function (t) { return t.note.anchor && t.note.anchor.p === p && t.note.anchor.n0 === n; });
    var c = counts[k], n1 = c ? c.n1 : n;
    // No citation here: the version and file are in the page title and part
    // header, and every thread in this panel is on the line just clicked.
    void n1;
    var html = '<p style="margin-top:0"><button class="btn" data-act="new">✎ Annotate this line</button> ' +
      '<button class="btn" data-act="bin" title="Deleted annotations on this version: restore them, or delete them for good">🗑 Bin</button></p>' +
      (ts.map(function (t) { return N.renderThread(t, null); }).join('') || '<p class="hint">No annotations yet.</p>') +
      '<div class="panel-bin"' + (binInPanel ? '' : ' hidden') + '><h4>Deleted annotations</h4><div></div></div>';
    var body = SW.drawer('Annotations', html);
    body.dataset.notes = k;
    openNotesKey = k;
    N.wire(body, build.v.id, notes);
    var pb = body.querySelector('.panel-bin'), binBtn = body.querySelector('[data-act="bin"]');
    function openBin() { N.showBin(pb.lastChild, { vid: build.v.id }); }
    if (binInPanel) openBin();
    binBtn.classList.toggle('on', binInPanel);
    binBtn.onclick = function (e) {
      e.stopPropagation();
      binInPanel = pb.hidden;
      pb.hidden = !binInPanel;
      binBtn.classList.toggle('on', binInPanel);
      if (binInPanel) { openBin(); pb.scrollIntoView({ block: 'nearest' }); }
    };
    body.querySelector('[data-act="new"]').onclick = function () {
      var L = build.lines[p][n - 1];
      N.dialog({ vid: build.v.id, kind: 'line', anchor: { p: p, n0: n, n1: n, src: build.parts[p].src }, quote: L ? L.raw : '',
                 heading: 'Annotate', anchorText: SW.cite(build, p, n, n) });
    };
    void quiet;
  }

  R.goto = function (p, n, flash) {
    // A line on a tape not shown (a search hit, a note, a link): show every tape.
    if (build.parts[p] && !showsTape(p)) {
      opts.tapes = 'all';
      var ts = SW.$('#rd-tape', view);
      if (ts) ts.value = 'all';
      renderListing();
    }
    var el = SW.$('#L' + p + '-' + n, view);
    if (!el) return;
    el.scrollIntoView({ block: 'center' });
    if (flash) {
      SW.$$('.ln.cur', view).forEach(function (e) { e.classList.remove('cur'); });
      el.classList.add('cur');
    }
  };

  // ---------- notes filter ----------
  // Lines covered by notes, limited to those in which the chosen initials take part.
  function keptLines() {
    var keep = {};
    if (opts.onlyRepaired) {
      kinRows(true).forEach(function (r) { var p = +r.dataset.p, n = +r.dataset.n; for (var k = n - 2; k <= n + 2; k++) keep[p + ':' + k] = true; });
      return keep;
    }
    Object.keys(counts).forEach(function (k) {
      var c = counts[k];
      if (opts.by && c.by.indexOf(opts.by) < 0) return;
      for (var n = c.n0; n <= c.n1; n++) keep[c.p + ':' + n] = true;
    });
    return keep;
  }
  function filtering() { return opts.onlyNoted || !!opts.by || opts.onlyRepaired; }
  function fillBy() {
    var sel = SW.$('#rd-by', view);
    if (!sel) return;
    var who = {};
    Object.keys(counts).forEach(function (k) { counts[k].by.forEach(function (x) { who[x] = 1; }); });
    if (opts.by) who[opts.by] = 1;
    sel.innerHTML = '<option value="">anyone</option>' + Object.keys(who).sort().map(function (x) {
      return '<option value="' + SW.esc(x) + '"' + (x === opts.by ? ' selected' : '') + '>' + SW.esc(x) + '</option>';
    }).join('');
  }
  function applyFilter() {
    var on = filtering(), keep = on ? keptLines() : null, shown = 0, gap = false;
    SW.$$('.listing .ln', view).forEach(function (row) {
      var k = row.dataset.p + ':' + row.dataset.n, hide = on && !keep[k];
      row.classList.toggle('nf-hide', hide);
      row.classList.toggle('nf-jump', on && !hide && gap);
      if (hide) gap = true; else { gap = false; shown++; }
    });
    SW.$$('.listing .part', view).forEach(function (sec) {
      sec.classList.toggle('nf-empty', on && !SW.$('.ln:not(.nf-hide)', sec));
    });
    var out = SW.$('#rd-nf', view);
    if (out) out.textContent = !on ? '' : opts.onlyRepaired ? shown + ' lines: the repairs, two either side' : shown + ' annotated line' + (shown === 1 ? '' : 's') + (opts.by ? ' with ' + opts.by : '');
    var box = SW.$('.listing', view);
    if (box) {
      var none = SW.$('.nf-none', box);
      if (on && !shown && !none) box.insertBefore(SW.el('p', { class: 'hint nf-none pad' }, opts.by ? 'No annotations by ' + opts.by + ' on this version' + (opts.tapes === 'all' ? '' : ' and tape') + '.' : 'No annotated lines on this version' + (opts.tapes === 'all' ? '' : ' and tape') + ' yet.'), box.firstChild);
      else if ((!on || shown) && none) none.remove();
    }
    if (build && SW.$('.rd-body', view)) paintNotes();   // the notes follow the lines left showing
  }

  function refreshNotes() {
    if (!build) return;
    N.list(build.v.id).then(function (all) {
      notes = all; K.set({ notes: all });
      counts = N.countsByLine(all);
      noted = {};
      Object.keys(counts).forEach(function (k) {
        var c = counts[k];
        for (var n = c.n0; n <= c.n1; n++) noted[c.p + ':' + n] = true;
      });
      SW.$$('.ln', view).forEach(function (row) {
        var k = row.dataset.p + ':' + row.dataset.n, mk = row.querySelector('.mk');
        if (mk) mk.innerHTML = N.marginMark(k, counts[k]);
        row.classList.toggle('noted', !!noted[k]);
      });
      fillBy();
      applyFilter();
      if (opts.ghosts) loadGhosts(true).then(paintNotes);
      // keep an open panel current; a closed one stays closed (the refresh runs every 20 seconds)
      if (openNotesKey && SW.$('#drawer-body').dataset.notes === openNotesKey && document.body.classList.contains('drawer-open')) showNotesFor(openNotesKey, true);
    });
  }

  R.show = function (b) {
    if (build !== b) opts.tapes = 'all';
    build = b; K.set({ build: b });
    R.build = b;
    SW.loadGlosses();
    render();
    refreshNotes();
    live();
    var s = SW.state.sel;
    if (s) setTimeout(function () { R.goto(s.p, s.n0, false); }, 0);
  };
  // a note added, edited or binned: look again (ghosts too), now if Read is open, else when it is next opened
  var readStale = false;
  SW.on('notes', function (vid) { if (build && vid === build.v.id) { if (SW.state.tab === 'read') refreshNotes(); else readStale = true; } });
  R.enter = function () { if (readStale && build) { readStale = false; refreshNotes(); } };
  SW.on('goto', function (g) {
    if (g.tab !== 'read') return;
    // Read not drawn yet this visit: opening it goes to the selection (R.show)
    if (!build) { var s = SW.state.sel; if (!s || s.p !== g.p || s.n0 !== g.n) SW.state.sel = { p: g.p, n0: g.n, n1: g.n }; SW.setTab('read'); return; }
    SW.setTab('read'); setTimeout(function () { R.goto(g.p, g.n, true); paintSel(); }, 0);
  });
  SW.on('profile', function () { if (opts.heat && build) render(); });
  // Lines change height with the window or the code size: the cards follow.
  var relay = null;
  window.addEventListener('resize', function () { clearTimeout(relay); relay = setTimeout(function () { if (build && marginOn()) layoutMargin(); }, 120); });
  SW.on('codetext', function () { if (build && marginOn()) setTimeout(function () { layoutMargin(); }, 50); });
})(this);
