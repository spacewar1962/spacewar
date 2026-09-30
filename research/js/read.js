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
      '<button class="btn kin-tog" id="rd-klist" aria-expanded="false" title="Repairs: where this text had to be changed to read or run (kintsugi). Click to show or hide the repairs bar">◆ <span class="kin-n"></span> <span class="kin-chev" aria-hidden="true">⌄</span></button>' +
      '<button class="btn" id="rd-knext" title="The next repair">›</button></span>';
    tb.appendChild(SW.el('button', { class: 'btn', title: 'What the colours and marks in the listing mean', onclick: function (e) {
      SW.pop(e.clientX, e.clientY, '<h4>Key</h4><div class="keylist">' +
        '<div><i class="kx kdef"></i>inside a macro definition (define … term)</div>' +
        '<div><i class="kx kcall"></i>a macro called here (hover the word column for how many words it made; “+5” means five more)</div>' +
        '<div><i class="kx keq"></i>a symbol set with “=”</div>' +
        '<div><i class="kx kcom"></i>a line of comment only</div>' +
        '<div><i class="kx knorm"></i>normalised for assembly (hover the line to see how)</div>' +
        '<div class="faint" style="margin-top:6px">Repairs, in gold (kintsugi; View ▸ Repairs):</div>' +
        '<div><span style="color:var(--kin)">●</span> <span class="rp-c rp-c-fix">srt</span> a reading corrected against the scan: the changed characters underlined (hover for what was there, and the evidence)</div>' +
        '<div><span style="color:var(--kin)">■</span> <span class="rp-c rp-c-kake">cma</span> a line remade where none can be read</div>' +
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
        '<div><span style="color:var(--kin)">●</span> <span class="rp-c rp-c-fix">srt</span> a reading corrected against the scan</div>' +
        '<div><span style="color:var(--kin)">■</span> <span class="rp-c rp-c-kake">cma</span> a line remade where none can be read</div>' +
        '<div><span class="rp-c rp-c-norm">~ssn</span> normalised for assembly: a change for running, not to the reading</div>' +
        '<div><span style="text-decoration:underline wavy var(--text-faint);text-underline-offset:4px">ior (4</span> an uncertain reading, left as found</div>' +
        '<div class="faint" style="margin-top:6px">After kintsugi, the mending of pottery with gold, which leaves the repair visible: see Help ▸ What you should read, and Help ▸ Reconstruction cards.</div></div>');
    }
  }
  function paintRepairs() {
    var reg = root.SWVersions.REPAIRS || {};
    build.parts.forEach(function (part, p) {
      (reg[part.src] || []).forEach(function (r) {
        var row = SW.$('#L' + p + '-' + r.n, view), t = row && row.querySelector('.t'); if (!t) return;
        var L = build.lines[p][r.n - 1], text = opts.norm ? L.norm : L.raw, at = text.indexOf(r.now);
        var why = 'Kintsugi · ' + (r.kind === 'rebuilt' ? 'Remade: no reading survives here. ' : 'Corrected: ') + (r.was ? 'the transcription had “' + r.was + '”; ' : r.kind === 'fix' ? 'missing from the transcription; ' : '') + 'now “' + r.now + '”. Evidence: ' + r.ev + '. By ' + r.by + ', ' + r.date + '.';
        row.classList.add(r.kind === 'rebuilt' ? 'rp-kake' : 'rp-fix');
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
          if (row) { row.classList.add('rp-unc'); var tu = row.querySelector('.t'); if (tu && !tu.title && !tu.querySelector('.rp-c')) tu.title = 'Kintsugi · Uncertain reading, left as found (not repaired): ' + L.raw.trim(); }
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
        (errs ? '<button class="badge err" data-asmerrs title="What the error' + (errs > 1 ? 's are' : ' is') + ', explained">' + errs + ' error' + (errs > 1 ? 's' : '') + '</button>' : '') + '</div>' +
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
        if (marginStale) { marginStale = false; paintMargin(); } else layoutMargin();
      });
      ro.observe(wrap);
    }
  }

  // ---------- notes in the margin ----------
  // Each thread as a card beside the line it starts on; cards that would
  // overlap are pushed down. Replies open under a card with its + button.
  var openCards = {}, marginTimer = null, ro = null, marginStale = false;
  // One thread: its first note, a + for its replies, the replies when open.
  // The same block is an inline note or a margin card (cls).
  function threadBlock(t, cls) {
    if (t.ghost) return ghostBlock(t, cls);
    var a = t.note.anchor, nrep = 0, open = !!openCards[t.note.id], h = '';
    (function walk(rs) { rs.forEach(function (r) { nrep++; walk(r.replies); }); })(t.replies);
    if (open) (function walk(rs) { rs.forEach(function (r) { h += N.renderNote(r.note, true, r.reactions); walk(r.replies); }); })(t.replies);
    var isBlock = a.n1 > a.n0 || a.c0 != null, shut = !!cardFold()[t.note.id];
    return '<div class="' + cls + (open ? ' open' : '') + (isBlock ? ' blockn' : '') + (shut ? ' nfold' : '') + (t.note.source === 'draft' ? ' draft' : '') + '" data-tid="' + SW.esc(t.note.id) + '" data-p="' + a.p + '" data-n0="' + a.n0 + '" data-n1="' + a.n1 + '">' +
      '<button type="button" class="card-fold" aria-expanded="' + !shut + '" title="' + (shut ? 'Unfold this annotation' : 'Fold this annotation away (for you; kept in this browser)') + '">' + (shut ? '▸' : '▾') + '</button>' +
      (N.mine(t.note) ? '<span class="mc-grip" draggable="true" title="Drag onto another line to move this annotation there">⠿</span>' : '') +
      '<div class="mc-where">' + (N.hasCode(t.note) ? '<button type="button" class="cf-tog" aria-expanded="' + !N.codeFolded(t.note.id) + '" title="Show or hide the code">' + (N.codeFolded(t.note.id) ? '▸' : '▾') + ' Code</button>' : 'Code') +
        ' · <button type="button" class="cf-lines" title="Select the lines">' + (a.n1 !== a.n0 ? 'lines ' + a.n0 + '–' + a.n1 : 'line ' + a.n0) + '</button></div>' +
      N.renderNote(t.note, false, t.reactions) +
      (nrep ? '<button class="mc-more" data-more="1" title="' + (open ? 'Hide the replies' : 'Show the replies') + '">' + (open ? '−' : '+') + ' ' + nrep + ' repl' + (nrep === 1 ? 'y' : 'ies') + '</button>' : '') +
      (open ? '<div class="mc-replies">' + h + '</div>' : '') + '</div>';
  }
  // The threads to show: anchored on a tape shown, on a line left by the notes filter.
  function shownThreads() {
    var keep = filtering() ? keptLines() : null;
    if (opts.show === 'none') return [];
    return N.threads(notes).concat(opts.ghosts ? ghosts : []).filter(function (t) {
      var a = t.note.anchor;
      if (!a || !showsTape(a.p)) return false;
      if (opts.show === 'mine' && !isMine(t.ghost ? t.note.ghostOf : t.note)) return false;
      if (opts.show === 'open' && (t.ghost || !N.isOpen(N.statusOf(t.reactions).state))) return false;
      if (keep && !keep[a.p + ':' + a.n0]) return false;
      return !!SW.$('#L' + a.p + '-' + a.n0, view);
    });
  }
  function paintNotes() { paintInline(); paintMargin(); paintBlocks(); }

  // ---------- ghosts: annotations from other versions, on the lines here that match ----------
  // Each annotated block of another version is looked for here by its lines' text
  // (spacing and comments ignored, blank lines not counted), with two lines either
  // side as context; it is placed where most of its lines match, in order. Shown
  // faint, read-only: Open goes to the original, Keep here copies it into this
  // version with a link back. A note already kept here is not shown as a ghost.
  var ghosts = [], ghostKey = '', keptNow = {};   // keptNow: kept this session, hidden while Hypothesis indexes the copy
  var lineKey = SW.lineKey;
  function flat(b) {
    var out = [];
    b.lines.forEach(function (ls, p) { ls.forEach(function (L) { out.push({ p: p, n: L.n, k: lineKey(L.norm || L.raw) }); }); });
    return out;
  }
  function placeHere(srcFlat, s0, s1, here, index) {
    var st = SW.ghostMatch(srcFlat, s0, s1, here, index);
    if (st < 0) return null;
    var a = here[st], z = here[st + s1 - s0];
    if (a.p !== z.p) return null;
    return { p: a.p, n0: a.n, n1: z.n, src: (build.parts[a.p] || {}).src || '' };
  }
  var ghostAt = 0;
  function loadGhosts(lazy) {
    if (!opts.ghosts || !build) { ghosts = []; ghostKey = ''; return Promise.resolve(); }
    var b0 = build;
    if (lazy && ghostKey === b0.v.id && Date.now() - ghostAt < 60000) return Promise.resolve();   // the regular refresh: at most once a minute
    ghostKey = b0.v.id; ghostAt = Date.now();
    return N.listAll().then(function (all) {
      var here = flat(b0), index = {};
      here.forEach(function (x, j) { if (x.k) (index[x.k] = index[x.k] || []).push(j); });
      var kept = {};
      all.forEach(function (n) { if (n.vid === b0.v.id) { var re = /[?&]a=([A-Za-z0-9_-]+)/g, m; while ((m = re.exec(String(n.text).replace(/\\([_\-])/g, '$1')))) kept[m[1]] = 1; } });
      var byV = {};
      all.forEach(function (n) {
        // a copy kept from a ghost (tagged carried) is never a ghost itself: its original stands for it
        if (n.vid === b0.v.id || !n.anchor || n.parent || n.source === 'buildlog' || N.isReaction(n) || kept[n.id] || keptNow[b0.v.id + ':' + n.id] || (n.tags || []).indexOf('carried') >= 0) return;
        (byV[n.vid] = byV[n.vid] || []).push(n);
      });
      var replies = {};
      all.forEach(function (n) { if (n.parent && !N.isReaction(n)) replies[n.parent] = (replies[n.parent] || 0) + 1; });
      return Promise.all(Object.keys(byV).map(function (vid) {
        return SW.build(vid).then(function (bv) {
          var src = flat(bv), at = {};
          src.forEach(function (x, j) { at[x.p + ':' + x.n] = j; });
          return byV[vid].map(function (n) {
            var a = n.anchor, s0 = at[a.p + ':' + a.n0], s1 = at[a.p + ':' + a.n1];
            if (s0 == null || s1 == null) return null;
            var pl = placeHere(src, s0, s1, here, index);
            if (!pl) return null;
            var g = Object.assign({}, n, { id: 'ghost-' + n.id, anchor: pl, source: 'ghost', ghostOf: n, nreplies: replies[n.id] || 0 });
            delete g.quote;
            return { note: g, replies: [], reactions: [], ghost: true };
          }).filter(Boolean);
        }, function () { return []; });
      })).then(function (lists) {
        if (build !== b0) return;
        ghosts = [].concat.apply([], lists);
      });
    });
  }
  function ghostBlock(t, cls) {
    var g = t.note, o = g.ghostOf, a = g.anchor, oa = o.anchor;
    var from = SW.refOf(o.vid, oa.p, oa.n0, oa.n1, SW.nparts(o.vid));
    return '<div class="' + cls + ' ghost" data-tid="' + SW.esc(g.id) + '" data-p="' + a.p + '" data-n0="' + a.n0 + '" data-n1="' + a.n1 + '">' +
      '<div class="mc-where">Code · ' + (a.n1 !== a.n0 ? 'lines ' + a.n0 + '–' + a.n1 : 'line ' + a.n0) + '</div>' +
      '<div class="note"><div class="by"><span class="ghost-tag" title="An annotation on another version, shown here on the matching lines">Ghost</span> <b>' + SW.esc(o.by) + '</b> · ' + SW.esc(SW.fmtDate(o.date)) + ' · from ' + SW.esc(from) + '</div>' +
      '<div class="nbody"><div class="body note-md">' + SW.md(SW.figpack.split(o.text).text) + '</div>' +
      (g.nreplies ? '<div class="hint">' + g.nreplies + ' repl' + (g.nreplies === 1 ? 'y' : 'ies') + ' there</div>' : '') + '</div>' +
      '<div class="acts"><a class="swlink" href="' + SW.esc(N.linkOf(o)) + '" title="Go to the original">Open in ' + SW.esc(SW.refOf(o.vid)) + '</a>' +
      '<span class="acts-right"><button data-keep-ghost="' + SW.esc(o.id) + '" title="Copy it into this version as an annotation of its own, on these lines, with a link back to the original">＋ Keep here</button></span></div></div></div>';
  }
  function keepGhost(id) {
    var t = ghosts.filter(function (x) { return x.note.ghostOf.id === id; })[0]; if (!t) return;
    var o = t.note.ghostOf, a = t.note.anchor, lines = build.lines[a.p].slice(a.n0 - 1, a.n1).map(function (L) { return L.raw; }).join('\n');
    N.create({ vid: build.v.id, kind: 'line', anchor: { p: a.p, n0: a.n0, n1: a.n1, src: a.src }, quote: lines,
               text: o.text + '\n\nCarried from ' + N.linkOf(o), tags: (o.tags || []).concat(['carried']) })
      .then(function () {
        keptNow[build.v.id + ':' + o.id] = true;
        ghosts = ghosts.filter(function (x) { return x !== t; });
        SW.toast('Kept here, with a link back to the original. ↶ Undo (⌘Z) takes it away.', 5000);
      }, function (e) { if (e.message !== 'no initials') SW.toast(e.message, 5000); });
  }


  // ---------- the code an annotation is attached to ----------
  // Its lines bracketed in the listing (a bar down the side, from the first line
  // to the last), and a span within them marked; both brighten while the pointer
  // is on the annotation. A span is not marked in the normalised view on lines
  // that normalising changed.
  function wrapSpan(t, s, e, tid) {
    var nodes = [], w = document.createTreeWalker(t, NodeFilter.SHOW_TEXT), x, pos = 0;
    while ((x = w.nextNode())) nodes.push(x);
    nodes.forEach(function (nd) {
      var len = nd.nodeValue.length, a = Math.max(s, pos), b = Math.min(e, pos + len);
      if (a < b) {
        var piece = nd;
        if (a > pos) piece = piece.splitText(a - pos);
        if (b - a < piece.nodeValue.length) piece.splitText(b - a);
        var mk = SW.el('mark', { class: 'frag', 'data-tid': tid });
        piece.parentNode.insertBefore(mk, piece); mk.appendChild(piece);
      }
      pos += len;
    });
  }
  function paintBlocks() {
    SW.$$('mark.frag', view).forEach(function (m) { var pa = m.parentNode; while (m.firstChild) pa.insertBefore(m.firstChild, m); m.remove(); pa.normalize(); });
    SW.$$('.ln.blk', view).forEach(function (r) { r.classList.remove('blk', 'blk-top', 'blk-end', 'blk-b'); });
    if (opts.notes === 'hide') return;
    shownThreads().forEach(function (th) {
      if (th.ghost) return;
      var a = th.note.anchor, isBlock = a.n1 > a.n0 || a.c0 != null;
      for (var n = a.n0; n <= a.n1; n++) {
        var row = SW.$('#L' + a.p + '-' + n, view); if (!row) continue;
        row.classList.add('blk'); if (isBlock) row.classList.add('blk-b'); if (n === a.n0) row.classList.add('blk-top'); if (n === a.n1) row.classList.add('blk-end');
        var L = build.lines[a.p][n - 1];
        if (a.c0 == null || !L || (opts.norm && L.norm !== L.raw)) continue;
        var s = n === a.n0 ? a.c0 : 0, e = n === a.n1 ? a.c1 : L.raw.length;
        if (e > s && (s > 0 || e < L.raw.length)) wrapSpan(row.querySelector('.t'), s, e, th.note.id);
      }
    });
  }

  // ---------- notes inline ----------
  // Each thread under the last line it covers, in the listing itself.
  function paintInline() {
    var box = SW.$('.listing', view);
    if (!box) return;
    // Keep what is being typed: a refresh waits while a reply or edit is open.
    if (box.querySelector('.inote .reply-box, .inote .edit-box')) return;
    SW.$$('.inote', box).forEach(function (x) { x.remove(); });
    var wrap = SW.$('.rd-body', view);
    if (wrap) { wrap.classList.toggle('with-inline', opts.notes === 'inline'); wrap.classList.toggle('notes-hidden', opts.notes === 'hide'); }
    if (opts.notes !== 'inline') return;
    var at = {}, order = [];
    shownThreads().forEach(function (t) {
      var a = t.note.anchor, row = SW.$('#L' + a.p + '-' + a.n1, view) || SW.$('#L' + a.p + '-' + a.n0, view);
      if (!at[row.id]) { at[row.id] = { row: row, ts: [] }; order.push(row.id); }
      at[row.id].ts.push(t);
    });
    order.forEach(function (id) {
      var g = at[id], el = SW.el('div', { class: 'inote' }), after = g.row;
      // cards ending on the same line: the narrower first, so a block's card comes last and closes it
      g.ts.sort(function (x, y) { return (y.note.anchor.n0 - x.note.anchor.n0) || String(x.note.date).localeCompare(String(y.note.date)); });
      el.innerHTML = g.ts.map(function (t) { return threadBlock(t, 'ithread'); }).join('');
      while (after.nextElementSibling && after.nextElementSibling.classList.contains('expansion')) after = after.nextElementSibling;
      after.insertAdjacentElement('afterend', el);
    });
    N.wire(box, build.v.id, notes);
  }

  // ---------- notes in the margin ----------
  function paintMargin() {
    var wrap = SW.$('.rd-body', view), margin = SW.$('.note-margin', view);
    if (!wrap || !margin) return;
    wrap.classList.toggle('with-margin', marginOn());
    if (!marginOn()) { margin.innerHTML = ''; return; }
    if (!wrap.getClientRects().length) { marginStale = true; return; }
    // Keep what is being typed: a refresh waits while a reply or edit is open.
    if (margin.querySelector('.reply-box, .edit-box')) return;
    var ts = shownThreads();
    var top0 = wrap.getBoundingClientRect().top;
    var items = ts.map(function (t) {
      var a = t.note.anchor, row = SW.$('#L' + a.p + '-' + a.n0, view);
      return { t: t, y: row.getBoundingClientRect().top - top0 };
    }).sort(function (x, y) { return x.y - y.y; });
    margin.innerHTML = items.map(function (it) { return threadBlock(it.t, 'mcard'); }).join('');
    layoutMargin(items.map(function (it) { return it.y; }));
    N.wire(margin, build.v.id, notes);
  }
  function layoutMargin(ys) {
    var margin = SW.$('.note-margin', view);
    if (!margin) return;
    var cards = SW.$$('.mcard', margin), bottom = 0;
    if (!ys) {
      var wrap = SW.$('.rd-body', view), top0 = wrap.getBoundingClientRect().top;
      ys = cards.map(function (c) { var row = SW.$('#L' + c.dataset.p + '-' + c.dataset.n0, view); return row ? row.getBoundingClientRect().top - top0 : 0; });
    }
    cards.forEach(function (c, i) {
      var y = Math.max(ys[i], bottom + 6);
      c.style.top = y + 'px';
      c.classList.toggle('pushed', y - ys[i] > 12);
      bottom = y + c.offsetHeight;
    });
    margin.style.minHeight = bottom + 'px';
  }
  function linesLit(c, on) {
    for (var n = +c.dataset.n0; n <= +c.dataset.n1; n++) {
      var r = SW.$('#L' + c.dataset.p + '-' + n, view);
      if (r) r.classList.toggle('mlit', on);
    }
    SW.$$('mark.frag[data-tid="' + c.dataset.tid + '"]', view).forEach(function (m) { m.classList.toggle('lit', on); });
  }
  // A click on a thread's + or its line reference (inline or card); true if handled.
  // cards folded away, by note, kept in this browser
  function cardFold() { return SW.store.get('read.cardFold', {}); }
  function threadClick(e) {
    var kg = e.target.closest('[data-keep-ghost]');
    if (kg) { keepGhost(kg.dataset.keepGhost); return true; }
    var cfb = e.target.closest('.card-fold');
    if (cfb) {
      var card = cfb.closest('.mcard, .ithread'), f = cardFold(), id = card.dataset.tid;
      if (f[id]) delete f[id]; else f[id] = true;
      SW.store.set('read.cardFold', f);
      card.classList.toggle('nfold', !!f[id]);
      cfb.textContent = f[id] ? '▸' : '▾'; cfb.setAttribute('aria-expanded', String(!f[id]));
      cfb.title = f[id] ? 'Unfold this annotation' : 'Fold this annotation away (for you; kept in this browser)';
      if (marginOn()) layoutMargin();
      return true;
    }
    var tog = e.target.closest('.cf-tog');
    if (tog) { var tc = tog.closest('.mcard, .ithread'); var shutNow = N.toggleCode(tc.dataset.tid); tog.textContent = (shutNow ? '▸' : '▾') + ' Code'; tog.setAttribute('aria-expanded', String(!shutNow)); if (marginOn()) layoutMargin(); return true; }
    var more = e.target.closest('[data-more]');
    if (more) {
      var c = more.closest('.mcard, .ithread');
      openCards[c.dataset.tid] = !openCards[c.dataset.tid];
      paintNotes();
      return true;
    }
    var w = e.target.closest('.mc-where');
    if (w) {
      var cw = w.closest('.mcard, .ithread');
      SW.state.sel = { p: +cw.dataset.p, n0: +cw.dataset.n0, n1: +cw.dataset.n1 };
      paintSel(); SW.writeQuery();
      return true;
    }
    return false;
  }
  function wireLit(el, sel) {
    el.addEventListener('mouseover', function (e) { var c = e.target.closest(sel); if (c) linesLit(c, true); });
    el.addEventListener('mouseout', function (e) { var c = e.target.closest(sel); if (c && !c.contains(e.relatedTarget)) linesLit(c, false); });
  }
  function wireMargin(margin) {
    margin.addEventListener('click', function (e) {
      threadClick(e);
      // a reply or edit box changes the card's height
      setTimeout(function () { layoutMargin(); }, 0);
    });
    margin.addEventListener('input', function () { layoutMargin(); });
    wireLit(margin, '.mcard');
  }
  // Clicking a noted line brings its note forward (inline or card) instead of the side panel.
  function threadFor(k) {
    var parts = k.split(':');
    return SW.$((marginOn() ? '.mcard' : '.ithread') + '[data-p="' + parts[0] + '"][data-n0="' + parts[1] + '"]', view);
  }

  // How notes show in Read, in the order the toolbar button cycles through them:
  // [mode, name, what it does, the button's icon].
  var MODES = [['inline', 'Under their lines', 'each annotation in the listing, under the last line it covers', '▤'],
               ['margin', 'Cards in the margin', 'beside the lines, in a column on the right (a window 900px wide or more)', '▥'],
               ['off', 'Initials only', 'at the line end; click them to read in the side panel', 'ᴬᴮ'],
               ['hide', 'Hidden', 'no annotations, initials or tint in the listing', '⊘']];
  function modeOf(m) { return MODES.filter(function (x) { return x[0] === m; })[0] || MODES[0]; }
  function setNotes(m) {
    opts.notes = m;
    SW.store.set('read.notes', m);
    paintNotes(); live(); modeBtn();
  }
  function modeBtn() {
    var b = SW.$('#rd-notes-mode', view);
    if (!b) return;
    var i = MODES.indexOf(modeOf(opts.notes)), cur = MODES[i], next = MODES[(i + 1) % MODES.length];
    b.textContent = cur[3];
    b.title = 'Annotations: ' + cur[1].toLowerCase() + '. Click for ' + next[1].toLowerCase() + '.';
    b.classList.toggle('on', opts.notes !== 'hide');
  }

  // The ▴ Notes button, on Read: how notes show, and every note in the side panel.
  R.notesMenu = function (x, y) {
    var modes = MODES;
    var pop = SW.pop(x, y, '<h4>Annotations in Read</h4><div class="notes-menu">' + modes.map(function (m) {
      return '<button data-m="' + m[0] + '"' + (opts.notes === m[0] ? ' class="on"' : '') + ' title="' + SW.esc(m[2]) + '">' + (opts.notes === m[0] ? '● ' : '○ ') + m[1] + '</button>';
    }).join('') + '<hr><button data-m="panel">All annotations on this version…</button></div>');
    pop.addEventListener('click', function (e) {
      var b = e.target.closest('button[data-m]');
      if (!b) return;
      SW.unpop();
      if (b.dataset.m === 'panel') { N.openPanel(build.v.id); return; }
      setNotes(b.dataset.m);
    });
  };
  // Live: while notes show (inline or cards), fetch the group's notes every 20 seconds.
  function live() {
    clearInterval(marginTimer);
    var on = opts.notes === 'inline' || opts.notes === 'margin';
    if (!on || !N.configured()) return;
    marginTimer = setInterval(function () {
      if (!build || SW.state.tab !== 'read' || document.hidden) return;
      if (SW.$('.rd-body .reply-box, .rd-body .edit-box', view)) return;
      N.invalidate(build.v.id);
    }, 20000);
  }

  // ---------- selection ----------
  function paintSel() {
    SW.$$('.ln.sel', view).forEach(function (e) { e.classList.remove('sel'); });
    if (opts.kinBar) setTimeout(kinBar, 0);   // the bar names the repair at or after the selection
    var s = SW.state.sel, bar = SW.$('#rd-selbar', view);
    if (!s || !bar) { if (bar) bar.classList.remove('on'); return; }
    for (var n = s.n0; n <= s.n1; n++) { var e = SW.$('#L' + s.p + '-' + n, view); if (e) e.classList.add('sel'); }
    bar.classList.add('on');
    bar.innerHTML = '';   // the version and file are in the page title and part header; Copy citation gives the full form
    var acts = [
      ['✎ Annotate', annotateSel], ['❝ Copy citation', copyCite], ['🔗 Copy link', copyLink],
      ['⤓ Word', function () { exportSel('docx'); }], ['⤓ Markdown', function () { exportSel('md'); }],
      ['▣ Figure', figureSel], ['★ Finding', findingSel], ['＋ My notes', function () { listingDoc(build, SW.state.sel).then(function (d) { d.title = SW.cite(build, SW.state.sel.p, SW.state.sel.n0, SW.state.sel.n1); var s = SW.state.sel; SW.tray.addDoc(d, { anchor: { p: s.p, n0: s.n0, n1: s.n1, src: build.parts[s.p].src }, quote: quote() }); }); }], ['● Breakpoint', bpSel], ['▶ Run to here', runToSel], ['✕', function () { SW.state.sel = null; paintSel(); SW.writeQuery(); }]
    ];
    var s0 = SW.state.sel;
    if (s0) bar.appendChild(SW.el('span', { class: 'selref' }, SW.refTag(build.v.id, s0.p, s0.n0, s0.n1, build.parts.length)));
    acts.forEach(function (a) { bar.appendChild(SW.el('button', { class: 'btn', onclick: a[1] }, a[0])); });
  }
  function selLines() {
    var s = SW.state.sel;
    return build.lines[s.p].slice(s.n0 - 1, s.n1);
  }
  function quote() { return selLines().map(function (L) { return L.raw; }).join('\n'); }
  function annotateSel() {
    var s = SW.state.sel;
    N.dialog({ vid: build.v.id, kind: 'line', anchor: { p: s.p, n0: s.n0, n1: s.n1, src: build.parts[s.p].src },
               quote: quote(), heading: 'Annotate', anchorText: SW.cite(build, s.p, s.n0, s.n1) });
  }
  // A finding: an annotation on these lines, tagged "finding", shown in Findings under your initials.
  function findingSel() {
    var s = SW.state.sel;
    N.dialog({ vid: build.v.id, kind: 'line', anchor: { p: s.p, n0: s.n0, n1: s.n1, src: build.parts[s.p].src }, tags: ['finding'],
               quote: quote(), heading: 'Add a finding', anchorText: SW.cite(build, s.p, s.n0, s.n1) + '. Shared with the group and listed under Findings; the first line is its title.' });
  }
  // A text selection in the listing: a small bar by the mouse to copy the
  // lines, put them in My notes, or make them Read's selection.
  var selPop = null;
  function hideSelPop() { if (selPop) { selPop.remove(); selPop = null; } }
  document.addEventListener('mousedown', function (e) { if (selPop && !selPop.contains(e.target)) hideSelPop(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') hideSelPop(); });
  window.addEventListener('scroll', hideSelPop, true);
  document.addEventListener('mouseup', function (e) {
    if (selPop && selPop.contains(e.target)) return;
    setTimeout(function () {
      var sel = window.getSelection();
      if (!build || !sel || sel.isCollapsed || !String(sel).trim()) return;
      function lnOf(nd) { var el0 = nd && (nd.nodeType === 1 ? nd : nd.parentElement); return el0 && el0.closest('#view-read .listing .ln'); }
      var rg = sel.getRangeAt(0), la = lnOf(rg.startContainer), lf = lnOf(rg.endContainer);
      if (!la || !lf || la.dataset.p !== lf.dataset.p) return;
      var p = +la.dataset.p, n0 = +la.dataset.n, n1 = +lf.dataset.n;
      if (n1 < n0) { var sw0 = n0; n0 = n1; n1 = sw0; }
      var lines = build.lines[p].slice(n0 - 1, n1), text = lines.map(function (L) { return L.raw; }).join('\n'), cite = SW.cite(build, p, n0, n1);
      // where in the lines the selection starts and ends (characters of the source text)
      function charIn(row, nd, off, end) {
        var t = row.querySelector('.t'), len = (build.lines[p][+row.dataset.n - 1] || { raw: '' }).raw.length;
        if (!t) return end ? len : 0;
        if (t.contains(nd)) { var r = document.createRange(); r.setStart(t, 0); r.setEnd(nd, off); return Math.min(len, r.toString().length); }
        return t.compareDocumentPosition(nd) & Node.DOCUMENT_POSITION_PRECEDING ? 0 : len;
      }
      var c0 = charIn(la, rg.startContainer, rg.startOffset, false), c1 = charIn(lf, rg.endContainer, rg.endOffset, true);
      if (n1 > n0 && c0 >= lines[0].raw.length) { n0++; c0 = 0; lines = lines.slice(1); }
      if (n1 > n0 && c1 === 0) { n1--; lines = lines.slice(0, -1); c1 = lines[lines.length - 1].raw.length; }
      var normed = opts.norm && lines.some(function (L) { return L.norm !== L.raw; });
      var span = !normed && (c0 > 0 || c1 < lines[lines.length - 1].raw.length) && (n1 > n0 || c1 > c0);
      var exact = span ? (n0 === n1 ? lines[0].raw.slice(c0, c1) : [lines[0].raw.slice(c0)].concat(lines.slice(1, -1).map(function (L) { return L.raw; }), [lines[lines.length - 1].raw.slice(0, c1)]).join('\n')) : lines.map(function (L) { return L.raw; }).join('\n');
      cite = SW.cite(build, p, n0, n1);
      function annotateHere(finding) {
        var an = { p: p, n0: n0, n1: n1, src: build.parts[p].src };
        if (span) { an.c0 = c0; an.c1 = c1; }
        window.getSelection().removeAllRanges(); hideSelPop();
        var q1 = exact.replace(/\s+/g, ' ').trim();
        N.dialog({ vid: build.v.id, kind: 'line', anchor: an, quote: exact, tags: finding ? ['finding'] : [],
                   heading: finding ? 'Add a finding' : 'Annotate',
                   anchorText: cite + (span ? ': “' + (q1.length > 70 ? q1.slice(0, 70) + '…' : q1) + '”' : '') + (finding ? '. Shared with the group and listed under Findings; the first line is its title.' : '') });
      }
      hideSelPop();
      selPop = SW.el('div', { class: 'selpop' });
      selPop.appendChild(SW.el('span', { class: 'hint' }, 'l. ' + n0 + (n1 > n0 ? '–' + n1 : '') + ' ' + SW.refTag(build.v.id, p, n0, n1, build.parts.length)));
      selPop.appendChild(SW.el('button', { class: 'btn', title: span ? 'Annotate the selected code: the annotation is attached to exactly this, and it is marked in the listing' : 'Annotate these lines', onclick: function () { annotateHere(false); } }, '✎ Annotate'));
      selPop.appendChild(SW.el('button', { class: 'btn ghost', title: 'A finding on the selected code, shared with the group and listed under Findings', onclick: function () { annotateHere(true); } }, '★ Finding'));
      selPop.appendChild(SW.el('button', { class: 'btn ghost', title: 'Copy these lines of source (without numbers or addresses)', onclick: function () { copy(text, (n1 - n0 + 1) + ' line' + (n1 > n0 ? 's' : '') + ' copied'); hideSelPop(); } }, 'Copy'));
      selPop.appendChild(SW.el('button', { class: 'btn ghost', title: 'Put these lines in My notes (private), with their citation', onclick: function () {
        var s0 = { p: p, n0: n0, n1: n1 };
        listingDoc(build, s0).then(function (d) { d.title = cite; SW.tray.addDoc(d, { anchor: { p: p, n0: n0, n1: n1, src: build.parts[p].src }, quote: text }); });
        hideSelPop();
      } }, '＋ My notes'));
      selPop.appendChild(SW.el('button', { class: 'btn ghost', title: 'Make these lines Read’s selection, for the bar with Annotate, Finding, Cite and the rest', onclick: function () {
        SW.state.sel = { p: p, n0: n0, n1: n1 }; window.getSelection().removeAllRanges(); paintSel(); SW.writeQuery(); hideSelPop();
      } }, 'Select lines'));
      document.body.appendChild(selPop);
      var x = Math.min(window.innerWidth - selPop.offsetWidth - 8, Math.max(8, e.clientX - 20)), y = e.clientY + 14;
      if (y + selPop.offsetHeight > window.innerHeight - 8) y = e.clientY - selPop.offsetHeight - 10;
      selPop.style.left = x + 'px'; selPop.style.top = y + 'px';
    }, 0);
  });
  function copy(text, msg) {
    (navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject())
      .then(function () { SW.toast(msg); }, function () { window.prompt('Copy:', text); });
  }
  function copyCite() {
    var s = SW.state.sel, part = build.parts[s.p];
    var sw = SW.swhidCite(part.src, part.tape ? null : s.n0, part.tape ? null : s.n1);   // a decoded tape's lines are not the file's
    var gh = SW.permalinkOf(part.src, part.tape ? null : s.n0, part.tape ? null : s.n1);
    copy(SW.cite(build, s.p, s.n0, s.n1) + (sw ? '\n' + sw : '') + (gh ? '\n' + gh : ''), 'Citation copied');
  }
  function copyLink() {
    var s = SW.state.sel;
    copy(SW.permalink({ v: build.v.id, l: s.p + ':' + s.n0 + (s.n1 !== s.n0 ? '-' + s.n1 : '') }), 'Link copied');
  }
  function exportSel(fmt) {
    var s = SW.state.sel;
    SW.exportDoc(listingDoc(build, s), 'spacewar-' + build.v.id + '-ll' + s.n0 + '-' + s.n1, fmt);
  }
  function figureSel() {
    var s = SW.state.sel;
    SW.figures.codeFigureDialog(build, selLines(), SW.cite(build, s.p, s.n0, s.n1));
  }
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

  // ---------- export model ----------
  function listingDoc(b, s, lopts) {
    lopts = lopts || {};
    // the whole listing follows the Tape menu: every tape, or the one shown
    var lines = s ? b.lines[s.p].slice(s.n0 - 1, s.n1)
      : [].concat.apply([], b.lines.filter(function (x, pi) { return showsTape(pi); })).filter(function (L) { return !L.away; });
    if (!s && filtering()) { var keep = keptLines(); lines = lines.filter(function (L) { return keep[L.p + ':' + L.n]; }); }
    return N.list(b.v.id).then(function (all) {
      var threads = N.threads(all);
      // each annotation goes after the last of its lines that is exported, so
      // one that begins above a selection is still included
      // the annotated lines only: the lines each annotation covers
      if (lopts.onlyNoted) {
        var cov = {};
        threads.forEach(function (t) { var a = t.note.anchor; if (!a) return; for (var n = a.n0; n <= (a.n1 || a.n0); n++) cov[a.p + ':' + n] = 1; });
        lines = lines.filter(function (L) { return cov[L.p + ':' + L.n]; });
      }
      var out = {}; lines.forEach(function (L) { out[L.p + ':' + L.n] = 1; });
      var byLine = {};
      threads.forEach(function (t) {
        var a = t.note.anchor; if (!a) return;
        for (var n = a.n1 || a.n0; n >= a.n0; n--) if (out[a.p + ':' + n]) { (byLine[a.p + ':' + n] = byLine[a.p + ':' + n] || []).push(t); break; }
      });
      var blocks = [];
      if (!s) blocks.push({ type: 'p', text: b.v.summary });
      var cur = null;
      lines.forEach(function (L) {
        if (!cur || cur.p !== L.p || (lopts.onlyNoted && cur.lines.length && cur.lines[cur.lines.length - 1].n !== L.n - 1)) {
          var ti0 = tapeInfo(b)[L.p];   // headed by its tape, as the Tape menu names it, then the file
          cur = { type: 'code', caption: (b.parts.length > 1 && ti0 ? 'Tape ' + (L.p + 1) + ' of ' + b.parts.length + ': ' + ti0.label + ' · ' : '') + b.parts[L.p].src, lines: [], p: L.p };
          blocks.push(cur);
        }
        var ws = b.asm && (b.asm.byLine[L.p] || [])[L.n];
        cur.lines.push({
          n: L.n, addr: ws && ws.length ? SW.oct(ws[0].loc, 4) : '', word: ws && ws.length ? SW.oct(ws[0].val) : '',
          text: L.raw, mark: b.errorsAt[L.p + ':' + L.n] ? 'del' : undefined,
          notes: (byLine[L.p + ':' + L.n] || []).map(function (t) {
            var reps = [];
            (function walk(rs) { rs.forEach(function (r) { reps.push({ by: r.note.by, date: String(r.note.date).slice(0, 10), text: r.note.text }); walk(r.replies); }); })(t.replies);
            var a = t.note.anchor;
            return { by: t.note.by, date: String(t.note.date).slice(0, 10), text: t.note.text, replies: reps, ref: a.n1 && a.n1 !== a.n0 ? 'll. ' + a.n0 + '–' + a.n1 : 'l. ' + a.n0 };
          })
        });
      });
      // each code block ends its caption with the reference to the lines it holds
      blocks.forEach(function (bl) { if (bl.type === 'code' && bl.lines.length) bl.caption += ' ' + SW.refText(b.v.id, bl.p, bl.lines[0].n, bl.lines[bl.lines.length - 1].n, b.parts.length); });
      var errs = b.asm ? b.asm.errors.filter(function (e) { return !s || (e.file === s.p && e.line >= s.n0 && e.line <= s.n1); }) : [];
      if (errs.length) {
        blocks.push({ type: 'h2', text: 'Assembly errors' });
        blocks.push({ type: 'table', head: ['Reference', 'File', 'Line', 'Message', 'Symbol'], rows: errs.map(function (e) {
          return [SW.refText(b.v.id, e.file, e.line, e.line, b.parts.length), b.parts[e.file].src, String(e.line), e.message, e.symbol || ''];
        }) });
      }
      return {
        title: s ? SW.cite(b, s.p, s.n0, s.n1) : b.v.label + ' ' + SW.refText(b.v.id) + (lopts.onlyNoted ? ': the annotations' : ': annotated listing'),
        subtitle: s ? b.v.summary : b.v.date + ' · ' + b.v.authors,
        meta: SW.docMeta(b), blocks: blocks
      };
    });
  }
  R.listingDoc = listingDoc;

  // ---------- events ----------
  // Moving an annotation: its card's ⠿ dragged onto a line; the same number of lines
  var dragNote = null;
  function clearDrop() { SW.$$('.ln.drop-at', view).forEach(function (r) { r.classList.remove('drop-at'); }); }
  document.addEventListener('dragstart', function (e) {
    var g = e.target.closest && e.target.closest('.mc-grip');
    if (!g) return;
    var card = g.closest('.mcard, .ithread');
    dragNote = notes.filter(function (n) { return n.id === card.dataset.tid; })[0] || null;
    if (!dragNote) return;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', SW.notes.linkOf ? SW.notes.linkOf(dragNote) : dragNote.id);
    try { e.dataTransfer.setDragImage(card, 12, 12); } catch (x) { /* not everywhere */ }
    document.body.classList.add('dragging-note');
  });
  document.addEventListener('dragend', function () { dragNote = null; clearDrop(); document.body.classList.remove('dragging-note'); });
  function wireBox(box) {
    wireLit(box, '.ithread');
    box.addEventListener('dragover', function (e) {
      if (!dragNote) return;
      var row = e.target.closest('.ln'); if (!row) return;
      e.preventDefault(); e.dataTransfer.dropEffect = 'move';
      var p = +row.dataset.p, n = +row.dataset.n, len = dragNote.anchor.n1 - dragNote.anchor.n0;
      clearDrop();
      for (var k = n; k <= n + len; k++) { var r = SW.$('#L' + p + '-' + k, view); if (r) r.classList.add('drop-at'); }
    });
    box.addEventListener('drop', function (e) {
      if (!dragNote) return;
      var row = e.target.closest('.ln'); if (!row) return;
      e.preventDefault();
      var note = dragNote, p = +row.dataset.p, n = +row.dataset.n, a = note.anchor, len = a.n1 - a.n0;
      dragNote = null; clearDrop();
      if (p === a.p && n === a.n0) return;
      N.reanchor(note, { p: p, n0: n, n1: n + len }).then(function (an) {
        SW.toast('Moved to ' + (an.n1 !== an.n0 ? 'lines ' + an.n0 + '–' + an.n1 : 'line ' + an.n0) + '. ↶ Undo (⌘Z) puts it back.', 5000);
      }, function (err) { SW.toast(err.message, 5000); });
    });
    box.addEventListener('click', function (e) {
      var cf = e.target.closest('[data-cf]');
      if (cf) { setWords(cf.dataset.cf === '1'); return; }
      if (e.target.closest('[data-ghosts]')) {
        opts.ghosts = !opts.ghosts; SW.store.set('read.ghosts', opts.ghosts);
        SW.$$('[data-ghosts]', view).forEach(function (b) { b.classList.toggle('on', opts.ghosts); b.setAttribute('aria-pressed', String(opts.ghosts)); });
        if (opts.ghosts) SW.toast('Looking for annotations on the other versions…', 2500);
        loadGhosts().then(function () {
          paintNotes();
          if (opts.ghosts) SW.toast(ghosts.length ? ghosts.length + ' ghost annotation' + (ghosts.length === 1 ? '' : 's') + ' from other versions' : 'No annotations on other versions match lines here', 3500);
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
      notes = all;
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
    build = b;
    R.build = b;
    SW.loadGlosses();
    render();
    refreshNotes();
    live();
    var s = SW.state.sel;
    if (s) setTimeout(function () { R.goto(s.p, s.n0, false); }, 0);
  };
  SW.on('notes', function (vid) { if (build && vid === build.v.id) refreshNotes(); });
  // a link to a reply: its thread opened, so the reply can be shown
  SW.on('reveal', function (r) { if (build && r.vid === build.v.id && r.root !== r.id && !openCards[r.root]) { openCards[r.root] = true; paintNotes(); } });
  SW.on('goto', function (g) { if (build && g.tab === 'read') { SW.setTab('read'); setTimeout(function () { R.goto(g.p, g.n, true); paintSel(); }, 0); } });
  SW.on('profile', function () { if (opts.heat && build) render(); });
  // Lines change height with the window or the code size: the cards follow.
  var relay = null;
  window.addEventListener('resize', function () { clearTimeout(relay); relay = setTimeout(function () { if (build && marginOn()) layoutMargin(); }, 120); });
  SW.on('codetext', function () { if (build && marginOn()) setTimeout(function () { layoutMargin(); }, 50); });
})(this);
