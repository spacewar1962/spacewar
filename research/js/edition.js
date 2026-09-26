/*
 * edition.js - a reading edition of one version: a title page with the
 * provenance (sources, tapes, witnesses, descent, the build log), then the
 * listing in numbered pages, each with the group's notes on its lines as
 * footnotes. Opens as a page of its own to read or print (A4), or goes to
 * Word.
 */
(function (root) {
  'use strict';
  var SW = root.SW, V = root.SWVersions, N = SW.notes;
  var E = SW.edition = {};

  function short(v) { return v ? v.label.replace(/^Spacewar! /, '') : ''; }
  var SUP = ['⁰', '¹', '²', '³', '⁴', '⁵', '⁶', '⁷', '⁸', '⁹'];
  function sup(n) { return String(n).split('').map(function (d) { return SUP[+d]; }).join(''); }

  // What the edition says of the version before its text.
  function provenance(b) {
    var v = b.v, rows = [['Version', v.label], ['Date', v.date], ['Authors', v.authors || ''], ['Status', v.status + (v.medium ? ', ' + v.medium : '')]];
    var anc = V.ancestry(v.id);
    if (anc.length > 1) rows.push(['Descent', anc.map(function (id) { return short(V.byId(id)); }).join(' → ')]);
    if (v.witnessOf) rows.push(['A reading of', short(V.byId(v.witnessOf))]);
    rows.push(['Sources', b.parts.map(function (p) { return p.src + (p.role !== 'program' ? ' (' + p.role + ')' : '') + (p.tape ? ', punched tape' : ''); }).join('; ')]);
    if ((v.witnesses || []).length) rows.push(['Object tapes', v.witnesses.join('; ')]);
    if ((v.sourceTapes || []).length) rows.push(['Source tapes', v.sourceTapes.join('; ')]);
    rows.push(['Assembled', V.DIALECTS[b.dialect].label + (b.asm ? '; ' + b.asm.words.length.toLocaleString('en-GB') + ' words, start ' + SW.oct(b.asm.start, 4) + (b.asm.errorCount ? '; ' + b.asm.errorCount + ' assembly errors' : '') : '')]);
    return rows;
  }

  // The lines of the edition, in order, with the notes that start on each.
  function gather(b, opts, notes) {
    var threads = N.threads(notes).filter(function (t) { return t.note.anchor; });
    var at = {};
    threads.forEach(function (t) { var k = t.note.anchor.p + ':' + t.note.anchor.n0; (at[k] = at[k] || []).push(t); });
    var lines = [];
    b.parts.forEach(function (part, pi) {
      if (part.role !== 'program' && !opts.supplied) return;
      b.lines[pi].forEach(function (L) {
        if (L.away) return;
        lines.push({ L: L, part: pi, notes: at[pi + ':' + L.n] || [] });
      });
    });
    return lines;
  }
  function flat(t) {
    var out = [{ by: t.note.by, date: String(t.note.date).slice(0, 10), text: t.note.text, reply: false }];
    (function walk(rs) { rs.forEach(function (r) { out.push({ by: r.note.by, date: String(r.note.date).slice(0, 10), text: r.note.text, reply: true }); walk(r.replies); }); })(t.replies || []);
    return out;
  }

  // A line set in columns, as Read shows it: labels, instruction, comment.
  function pad(t, n) { t = String(t); return t.length >= n ? t + ' ' : t + new Array(n - t.length + 1).join(' '); }
  function layout(raw) {
    var p = SW.parseLine(raw);
    if (!p.code.trim() && !p.labels.length) return raw.replace(/\t/g, '    ');
    var head = (p.loc ? p.loc.trim() + ' ' : '') + (p.labels.length ? p.labels.join(', ') + ',' : '');
    var code = p.code.replace(/\t/g, ' ').replace(/\s+$/, '');
    return (p.comment ? pad(pad(head, 8) + code, 32) + p.comment.replace(/\t/g, ' ') : pad(head, 8) + code);
  }

  // ---------- the page to read or print ----------
  function html(b, opts, notes) {
    var v = b.v, lines = gather(b, opts, notes), per = opts.perPage || 56;
    var pages = [], cur = null, lastPart = -1, fn = 0;
    lines.forEach(function (x) {
      if (!cur || cur.lines.length >= per || x.part !== lastPart) { cur = { lines: [], part: x.part, notes: [] }; pages.push(cur); lastPart = x.part; }
      var marks = x.notes.map(function (t) { fn++; cur.notes.push({ n: fn, t: t, L: x.L }); return fn; });
      cur.lines.push({ x: x, marks: marks });
    });
    var contents = [], seen = {};
    pages.forEach(function (pg, i) { if (!seen[pg.part]) { seen[pg.part] = 1; contents.push([b.parts[pg.part].src + (b.parts[pg.part].role !== 'program' ? ' (' + b.parts[pg.part].role + ')' : ''), i + 1]); } });
    var esc = SW.esc;
    var o = ['<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><title>' + esc(v.label) + ': reading edition</title><style>',
      '@page { size: A4; margin: 16mm 14mm 16mm 18mm; }',
      'body { font-family: Georgia, "Times New Roman", serif; color: #111; background: #e9e6de; margin: 0; }',
      '.sheet { background: #fff; width: 178mm; min-height: 262mm; margin: 10mm auto; padding: 14mm 14mm 12mm 16mm; box-shadow: 0 1px 6px rgba(0,0,0,.2); box-sizing: content-box; position: relative; }',
      '@media print { body { background: #fff; } .sheet { box-shadow: none; margin: 0; padding: 0; width: auto; min-height: 0; page-break-after: always; } .noprint { display: none; } }',
      'h1 { font-size: 26pt; margin: 30mm 0 4mm; font-weight: normal; } h2 { font-size: 13pt; margin: 8mm 0 3mm; }',
      '.sub { font-size: 12pt; color: #444; } .meta { border-collapse: collapse; font-size: 9.5pt; margin-top: 8mm; width: 100%; }',
      '.meta td { border-top: 1px solid #ddd; padding: 4px 6px; vertical-align: top; } .meta td:first-child { width: 28mm; color: #555; }',
      '.log p { font-size: 9.5pt; line-height: 1.45; margin: 0 0 6px; } .toc { font-size: 10pt; } .toc div { display: flex; } .toc span { flex: 1; border-bottom: 1px dotted #aaa; margin: 0 6px 4px; }',
      '.head { font: 8pt ui-monospace, Menlo, Consolas, monospace; color: #666; border-bottom: 1px solid #ccc; padding-bottom: 2mm; margin-bottom: 3mm; display: flex; justify-content: space-between; }',
      '.code { font: ' + (opts.size || 8.6) + 'pt/1.32 ui-monospace, Menlo, Consolas, monospace; white-space: pre-wrap; margin: 0; }',
      '.code .n { color: #888; display: inline-block; width: 3.2em; text-align: right; margin-right: 1.2em; } .code .aw { color: #777; display: inline-block; width: 10.5em; }',
      '.code .m { color: #8a1c1c; font-family: Georgia, serif; font-size: 1.05em; } .code .er { background: #fbe3e3; }',
      '.fn { border-top: 1px solid #bbb; margin-top: 4mm; padding-top: 2mm; font-size: 8.4pt; line-height: 1.35; } .fn p { margin: 0 0 3px; } .fn .r { margin-left: 1.2em; color: #333; }',
      '.pno { position: absolute; bottom: 6mm; right: 14mm; font-size: 8pt; color: #666; } @media print { .pno { position: static; text-align: right; margin-top: 3mm; } }',
      '.bar { position: sticky; top: 0; background: #1d2327; color: #eee; padding: 8px 14px; font: 13px system-ui, sans-serif; display: flex; gap: 12px; align-items: center; z-index: 2; }',
      '.bar button { font: inherit; padding: 4px 10px; cursor: pointer; }',
      '</style></head><body>',
      '<div class="bar noprint"><b>' + esc(v.label) + '</b> · reading edition · ' + pages.length + ' pages of text · ' + fn + ' notes<span style="flex:1"></span><button onclick="window.print()">Print or save as PDF</button></div>'];
    // title page
    o.push('<div class="sheet"><h1>' + esc(v.label) + '</h1><div class="sub">' + esc(v.date) + ' · ' + esc(v.authors || '') + '</div>' +
      '<p style="font-size:11pt;line-height:1.5;margin-top:8mm">' + esc(v.summary || '') + '</p>' +
      '<table class="meta">' + provenance(b).map(function (r) { return '<tr><td>' + esc(r[0]) + '</td><td>' + esc(r[1]) + '</td></tr>'; }).join('') + '</table>' +
      '<p style="font-size:8.5pt;color:#666;margin-top:12mm">A reading edition made on the Spacewar! research bench v' + esc(SW.VERSION) + ', ' + esc(SW.fmtDate(SW.today())) + '. Line numbers are those of the source files in sources/; notes are the research group’s, signed and dated. ' +
      'Cite as: ' + esc(v.label) + ' (' + esc(v.date) + '), ' + esc(SW.versionURI(v.id)) + '.</p><div class="pno">i</div></div>');
    // provenance and contents
    o.push('<div class="sheet"><h2>The text and its record</h2><div class="log">' + (v.buildNotes || []).map(function (n) { return '<p>' + esc(typeof n === 'string' ? n : n.text) + '</p>'; }).join('') + '</div>');
    var vnotes = N.threads(notes).filter(function (t) { return !t.note.anchor; });
    if (vnotes.length) o.push('<h2>Notes on the version</h2><div class="log">' + vnotes.map(function (t) {
      return flat(t).map(function (f) { return '<p' + (f.reply ? ' style="margin-left:1.2em"' : '') + '><b>' + esc(f.by) + '</b>, ' + esc(SW.fmtDate(f.date)) + ': ' + esc(f.text) + '</p>'; }).join('');
    }).join('') + '</div>');
    o.push('<h2>Contents</h2><div class="toc">' + contents.map(function (c) { return '<div>' + esc(c[0]) + '<span></span>' + c[1] + '</div>'; }).join('') + '</div><div class="pno">ii</div></div>');
    // pages
    pages.forEach(function (pg, i) {
      var part = b.parts[pg.part], L0 = pg.lines[0].x.L, L1 = pg.lines[pg.lines.length - 1].x.L;
      o.push('<div class="sheet"><div class="head"><span>' + esc(short(v)) + ' · ' + esc(part.src) + '</span><span>ll. ' + L0.n + '–' + L1.n + '</span></div><pre class="code">');
      pg.lines.forEach(function (row) {
        var L = row.x.L, ws = opts.words && b.asm && (b.asm.byLine[L.p] || [])[L.n], err = b.errorsAt[L.p + ':' + L.n];
        var text = layout((L.raw || '').replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, ''));
        o.push('<span class="n">' + L.n + '</span>' + (opts.words ? '<span class="aw">' + (ws && ws.length ? SW.oct(ws[0].loc, 4) + ' ' + SW.oct(ws[0].val) : '') + '</span>' : '') +
          (err ? '<span class="er">' + esc(text) + '</span>' : esc(text)) + (row.marks.length ? ' <span class="m">' + row.marks.map(sup).join(' ') + '</span>' : '') + '\n');
      });
      o.push('</pre>');
      if (pg.notes.length) {
        o.push('<div class="fn">' + pg.notes.map(function (f) {
          var a = f.t.note.anchor, parts = flat(f.t);
          return '<p><span class="m">' + sup(f.n) + '</span> l. ' + a.n0 + (a.n1 !== a.n0 ? '–' + a.n1 : '') + '. ' + parts.map(function (x, k) {
            return (k ? '<span class="r">↳ ' : '') + '<b>' + esc(x.by) + '</b>, ' + esc(SW.fmtDate(x.date)) + ': ' + esc(x.text) + (k ? '</span>' : '');
          }).join(' ') + '</p>';
        }).join('') + '</div>');
      }
      o.push('<div class="pno">' + (i + 1) + '</div></div>');
    });
    o.push('</body></html>');
    return o.join('');
  }

  // Open the edition in a page of its own (from a click, so it is not blocked).
  E.open = function (b, opts) {
    var w = window.open('', '_blank');
    if (!w) { SW.toast('The edition could not open: allow pop-ups for this page.', 6000); return; }
    w.document.write('<p style="font:14px system-ui;padding:20px">Preparing the edition of ' + SW.esc(b.v.label) + '…</p>');
    N.list(b.v.id).then(function (notes) { return notes; }, function () { return []; }).then(function (notes) {
      w.document.open();
      w.document.write(html(b, opts, notes.filter(function (n) { return !N.isReaction(n); })));
      w.document.close();
    });
  };

  // The same edition for Word: the provenance up front, then the annotated listing.
  E.doc = function (b, opts) {
    var read = SW.views.read;
    return read.listingDoc(b, null).then(function (d) {
      var pre = [{ type: 'h2', text: 'The text and its record' }].concat((b.v.buildNotes || []).map(function (n) { return { type: 'p', text: typeof n === 'string' ? n : n.text }; }));
      d.title = b.v.label + ': reading edition';
      d.meta = provenance(b).concat([['Generated', SW.fmtDate(SW.today()) + ', Spacewar! research bench v' + SW.VERSION]]);
      d.blocks = pre.concat([{ type: 'pagebreak' }], d.blocks);
      return d;
    });
  };

  // The menu in Read's toolbar.
  E.menu = function (getBuild) {
    var m = SW.el('details', { class: 'menu' });
    var o = { words: SW.store.get('ed.words', false), supplied: SW.store.get('ed.supplied', false), perPage: +SW.store.get('ed.per', 56) };
    m.innerHTML = '<summary class="btn" title="A reading edition of this version: title page with provenance and the build log, then the listing in numbered pages with the group’s notes as footnotes">Edition ▾</summary>' +
      '<div class="menu-body">' +
      '<label class="check"><input type="checkbox" data-o="words"' + (o.words ? ' checked' : '') + '> addresses &amp; words</label>' +
      '<label class="check" title="Include the macro and star tapes supplied so the version assembles"><input type="checkbox" data-o="supplied"' + (o.supplied ? ' checked' : '') + '> supplied tapes</label>' +
      '<label class="check">Lines per page <select data-o="perPage">' + [48, 56, 64].map(function (n) { return '<option' + (n === o.perPage ? ' selected' : '') + '>' + n + '</option>'; }).join('') + '</select></label>' +
      '<button class="btn" data-go="open" title="Open the edition in a new tab, to read or print (A4, or save as PDF)">📖 Open to read or print</button>' +
      '<button class="btn ghost" data-go="docx" title="The same edition as a Word document">⤓ Word</button></div>';
    m.addEventListener('change', function (e) {
      var k = e.target.dataset.o;
      if (!k) return;
      o[k] = e.target.type === 'checkbox' ? e.target.checked : +e.target.value;
      SW.store.set('ed.' + (k === 'perPage' ? 'per' : k), o[k]);
    });
    m.addEventListener('click', function (e) {
      var g = e.target.closest('[data-go]');
      if (!g) return;
      m.open = false;
      var b = getBuild();
      if (g.dataset.go === 'open') E.open(b, o);
      else E.doc(b, o).then(function (d) { SW.exportDoc(d, 'spacewar-' + b.v.id + '-edition', 'docx'); });
    });
    return m;
  };
})(this);
