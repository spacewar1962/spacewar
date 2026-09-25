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
  var opts = { words: SW.store.get('read.words', true), norm: false, tapes: 'all', heat: false };

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
      return { pi: pi, supplied: supplied, star: star, title: tapeTitle(b, pi).trim(), label: label + (supplied ? ' (supplied)' : '') };
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
      if (ex) heat = ' style="background:rgba(255,206,122,' + Math.min(0.5, 0.06 + Math.log10(1 + ex) / 12).toFixed(3) + ')"';
    }
    var title = '';
    if (b.errorsAt[k]) title = b.errorsAt[k].map(function (e) { return e.message + (e.symbol ? ' "' + e.symbol + '"' : ''); }).join('; ');
    else if (L.raw !== L.norm && !L.skipped) title = 'Normalised for assembly: ' + L.norm;
    else if (L.skipped) title = 'Not assembled (transcription header or outside this tape segment)';
    return '<div class="' + cls + '" id="L' + L.p + '-' + L.n + '" data-p="' + L.p + '" data-n="' + L.n + '"' +
      (title ? ' title="' + SW.esc(title) + '"' : '') + '>' +
      '<span class="n"' + heat + '>' + L.n + '</span><span class="a"' + (wTitle ? ' title="' + SW.esc(wTitle) + '"' : '') + '>' + a + '</span>' +
      '<span class="w"' + (wTitle ? ' title="' + SW.esc(wTitle) + '"' : '') + '>' + w + '</span>' +
      '<span class="t">' + (text ? hl(text, b) : ' ') + '</span><span class="mk">' + mk + '</span></div>';
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
      '<label class="check" title="Shade each line by how often it ran, from the profile collected in the Run view (run the program there first)"><input type="checkbox" id="rd-heat"' + (opts.heat ? ' checked' : '') + '> Run heat</label>' +
      '</div></details>';
    tb.appendChild(SW.el('button', { class: 'btn', title: 'What the colours and marks in the listing mean', onclick: function (e) {
      SW.pop(e.clientX, e.clientY, '<h4>Key</h4><div class="keylist">' +
        '<div><i class="kx kdef"></i>inside a macro definition (define … term)</div>' +
        '<div><i class="kx kcall"></i>a macro called here (hover the word column for how many words it made; “+5” means five more)</div>' +
        '<div><i class="kx keq"></i>a symbol set with “=”</div>' +
        '<div><i class="kx knorm"></i>normalised for assembly (hover the line to see how)</div>' +
        '<div><i class="kx knoted"></i>covered by a note (initials at the right; click them)</div>' +
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
      tb.appendChild(SW.el('span', { class: 'badge err', title: b.asm.words.length + ' words; start ' + SW.oct(b.asm.start, 4) },
        b.asm.errorCount + ' assembly error' + (b.asm.errorCount > 1 ? 's' : '')));
    } else if (!b.asm) tb.appendChild(SW.el('span', { class: 'hint' }, 'No source survives.'));
    tb.appendChild(SW.el('span', { class: 'sep' }));
    tb.appendChild(SW.exportButtons(function () { return listingDoc(b, null); }, function () { return 'spacewar-' + b.v.id + '-listing'; }));
    view.appendChild(tb);

    if (!b.v.build) {
      var lost = SW.el('div', { class: 'pad prose' });
      lost.innerHTML = '<h2>' + SW.esc(b.v.label) + '</h2><p>' + SW.esc(b.v.summary) + '</p><p class="muted">What is absent is also part of the record. Notes on this version can still be kept under “Version &amp; notes”.</p>';
      view.appendChild(lost);
      return;
    }
    view.appendChild(SW.el('div', { class: 'selbar', id: 'rd-selbar' }));
    renderListing();
    wireTb(tb);
  }

  // The listing alone, so choosing a tape keeps the toolbar (and a search) as it is.
  function renderListing() {
    var b = build, info = tapeInfo(b), bar = SW.$('#rd-selbar', view);
    SW.$$('.listing', view).forEach(function (x) { x.remove(); });
    var box = SW.el('div', { class: 'listing' + (opts.words ? '' : ' hide-words') });
    b.parts.forEach(function (part, pi) {
      if (!showsTape(pi)) return;
      var t = info[pi], sec = SW.el('div', { class: 'part' });
      var errs = b.asm.errors.filter(function (e) { return e.file === pi; }).length;
      var span = part.end ? 'lines ' + part.title + '–' + part.end : part.title > 1 ? 'from line ' + part.title : 'whole file';
      sec.innerHTML = '<div class="part-head" data-p="' + pi + '">' +
        '<div class="ph-main">' + (b.parts.length > 1 ? '<span class="ph-num">Tape ' + (pi + 1) + ' of ' + b.parts.length + '</span>' : '') +
        '<span class="ph-title">' + SW.esc(t.label) + '</span>' +
        (errs ? '<span class="badge err">' + errs + ' error' + (errs > 1 ? 's' : '') + '</span>' : '') + '</div>' +
        '<div class="ph-sub">' + SW.sourceLink(part.src, part.src.split('/').pop()) +
        ' · ' + (part.tape ? 'punched tape, decoded from FIO-DEC' : 'text file') + ' · ' + span +
        (t.title ? ' · tape title “' + SW.esc(t.title) + '”' : '') + '</div>' +
        '<div class="lncols"><span class="n" title="The line’s number in the source file">Line</span>' +
        '<span class="a" title="Where the line’s first word was placed in core memory, in octal (0000–7777)">Address</span>' +
        '<span class="w" title="The 18-bit machine word the line assembled to, in octal; “+N” means N more words followed (hover a row for the count)">Word</span>' +
        '<span class="t" title="The source as written (or as the assembler read it, with Normalised text on in View)">Source</span>' +
        '<span class="mk" title="Initials of anyone who has annotated the line; click them to read">Notes</span></div></div>';
      sec.insertAdjacentHTML('beforeend', b.lines[pi].map(function (L) { return rowHTML(b, L); }).join(''));
      box.appendChild(sec);
    });
    view.insertBefore(box, bar);
    wireBox(box);
    paintSel();
  }

  // ---------- selection ----------
  function paintSel() {
    SW.$$('.ln.sel', view).forEach(function (e) { e.classList.remove('sel'); });
    var s = SW.state.sel, bar = SW.$('#rd-selbar', view);
    if (!s || !bar) { if (bar) bar.classList.remove('on'); return; }
    for (var n = s.n0; n <= s.n1; n++) { var e = SW.$('#L' + s.p + '-' + n, view); if (e) e.classList.add('sel'); }
    bar.classList.add('on');
    bar.innerHTML = '';   // the version and file are in the page title and part header; Copy citation gives the full form
    var acts = [
      ['✎ Annotate', annotateSel], ['❝ Copy citation', copyCite], ['🔗 Copy link', copyLink],
      ['⤓ Word', function () { exportSel('docx'); }], ['⤓ Markdown', function () { exportSel('md'); }],
      ['▣ Figure', figureSel], ['● Breakpoint', bpSel], ['▶ Run to here', runToSel], ['✕', function () { SW.state.sel = null; paintSel(); SW.writeQuery(); }]
    ];
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
  function copy(text, msg) {
    (navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject())
      .then(function () { SW.toast(msg); }, function () { window.prompt('Copy:', text); });
  }
  function copyCite() { var s = SW.state.sel; copy(SW.cite(build, s.p, s.n0, s.n1), 'Citation copied'); }
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
  function listingDoc(b, s) {
    var lines = s ? b.lines[s.p].slice(s.n0 - 1, s.n1) : [].concat.apply([], b.lines.filter(function (x, pi) { return b.parts[pi].role === 'program'; }));
    return N.list(b.v.id).then(function (all) {
      var threads = N.threads(all);
      var byLine = {};
      threads.forEach(function (t) {
        if (!t.note.anchor) return;
        var k = t.note.anchor.p + ':' + t.note.anchor.n0;
        (byLine[k] = byLine[k] || []).push(t);
      });
      var blocks = [];
      if (!s) blocks.push({ type: 'p', text: b.v.summary });
      var cur = null;
      lines.forEach(function (L) {
        if (!cur || cur.p !== L.p) {
          cur = { type: 'code', caption: b.parts[L.p].src, lines: [], p: L.p };
          blocks.push(cur);
        }
        var ws = b.asm && (b.asm.byLine[L.p] || [])[L.n];
        cur.lines.push({
          n: L.n, addr: ws && ws.length ? SW.oct(ws[0].loc, 4) : '', word: ws && ws.length ? SW.oct(ws[0].val) : '',
          text: L.raw, mark: b.errorsAt[L.p + ':' + L.n] ? 'del' : undefined,
          notes: (byLine[L.p + ':' + L.n] || []).map(function (t) {
            var reps = [];
            (function walk(rs) { rs.forEach(function (r) { reps.push({ by: r.note.by, date: String(r.note.date).slice(0, 10), text: r.note.text }); walk(r.replies); }); })(t.replies);
            return { by: t.note.by, date: String(t.note.date).slice(0, 10), text: t.note.text, replies: reps };
          })
        });
      });
      var errs = b.asm ? b.asm.errors.filter(function (e) { return !s || (e.file === s.p && e.line >= s.n0 && e.line <= s.n1); }) : [];
      if (errs.length) {
        blocks.push({ type: 'h2', text: 'Assembly errors' });
        blocks.push({ type: 'table', head: ['File', 'Line', 'Message', 'Symbol'], rows: errs.map(function (e) {
          return [b.parts[e.file].src, String(e.line), e.message, e.symbol || ''];
        }) });
      }
      return {
        title: s ? SW.cite(b, s.p, s.n0, s.n1) : b.v.label + ': annotated listing',
        subtitle: s ? b.v.summary : b.v.date + ' · ' + b.v.authors,
        meta: SW.docMeta(b), blocks: blocks
      };
    });
  }
  R.listingDoc = listingDoc;

  // ---------- events ----------
  function wireBox(box) {
    box.addEventListener('click', function (e) {
      if (e.target.closest('.part-head')) return;   // tape headers only label (their source link opens GitHub)
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
      if (counts[k]) showNotesFor(k);
    });
  }

  function wireTb(tb) {
    SW.$('#rd-words', tb).onchange = function (e) {
      opts.words = e.target.checked; SW.store.set('read.words', opts.words);
      var box = SW.$('.listing', view);
      if (box) box.classList.toggle('hide-words', !opts.words);
    };
    SW.$('#rd-norm', tb).onchange = function (e) { opts.norm = e.target.checked; render(); };
    var tapeSel = SW.$('#rd-tape', tb);
    if (tapeSel) tapeSel.onchange = function () { opts.tapes = tapeSel.value; renderListing(); view.scrollTop = 0; };
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
      build.lines.forEach(function (ls, pi) { ls.forEach(function (L) { if (re.test(L.raw)) hits.push(L); }); });
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
        '<div class="refs"><a href="#" data-p="' + m.file + '" data-n="' + m.line + '">defined at ' + SW.esc(b.parts[m.file].src) + ':' + m.line + '</a></div>' +
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
    var pop = SW.pop(x, y, h);
    pop.addEventListener('click', function (e) {
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
    var html = '<p style="margin-top:0"><button class="btn" data-act="new">✎ Add a note on this line</button> ' +
      '<button class="btn" data-act="bin" title="Deleted notes on this version: restore them, or delete them for good">🗑 Bin</button></p>' +
      (ts.map(function (t) { return N.renderThread(t, null); }).join('') || '<p class="hint">No notes yet.</p>') +
      '<div class="panel-bin"' + (binInPanel ? '' : ' hidden') + '><h4>Deleted notes</h4><div></div></div>';
    var body = SW.drawer('Notes', html);
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
      if (openNotesKey && SW.$('#drawer-body').dataset.notes === openNotesKey) showNotesFor(openNotesKey, true);
    });
  }

  R.show = function (b) {
    if (build !== b) opts.tapes = 'all';
    build = b;
    R.build = b;
    SW.loadGlosses();
    render();
    refreshNotes();
    var s = SW.state.sel;
    if (s) setTimeout(function () { R.goto(s.p, s.n0, false); }, 0);
  };
  SW.on('notes', function (vid) { if (build && vid === build.v.id) refreshNotes(); });
  SW.on('goto', function (g) { if (build && g.tab === 'read') { SW.setTab('read'); setTimeout(function () { R.goto(g.p, g.n, true); }, 0); } });
  SW.on('profile', function () { if (opts.heat && build) render(); });
})(this);
