/*
 * findings.js - what the bench has established, in one citable place: the
 * discoveries recorded in the build logs, each with its evidence (lines in
 * the source, tapes in sources/), the witness tapes and punched titles
 * checked afresh on every visit, and the group's own notes tagged "finding".
 */
(function (root) {
  'use strict';
  var SW = root.SW, V = root.SWVersions, N = SW.notes;
  var view = SW.$('#view-findings');

  // Evidence is either a line, found by pattern in a version's assembled
  // source (so it survives renumbering), or a tape image in sources/.
  var FINDINGS = [
    { kind: 'Rebuild', title: 'The reconstructed 2B source rebuilds the April 1962 binary exactly',
      text: 'Landsteiner’s 2014 reconstruction of the 2B source, assembled with the 1962–63 MACRO rules, reproduces bin-files/spacewar2B_2apr62.bin word for word (2,297 words); with macro1’s rule 174 words differ, all variable addresses. The tape’s own punched title reads “SPACEWAR 2B 2 APR 62”.',
      ev: [{ v: '2b', tab: 'tape', label: 'witness in the Tape view' }, { tape: 'bin-files/spacewar2B_2apr62.bin' }] },
    { kind: 'Assembler', title: 'MACRO allotted overlined variables when a macro was defined',
      text: 'The 3.1 source rebuilds newSpacewar_4-30-60.bin exactly only if variables are allotted as they first occur in macro definitions (\\ssn and \\scn in xincr and yincr come first). With macro1’s own rule 62 words differ, every one a variable address. The bench’s “1962–63” dialect follows the tapes.',
      ev: [{ v: '3.1', re: /^xincr\b/, label: 'the xincr macro' }, { tape: 'bin-files/newSpacewar_4-30-60.bin' }] },
    { kind: 'Assembler', title: 'MACRO read a macro line whole, tab and all',
      text: 'The dispt macro writes “repeat 6<tab>B=B+B”. Cut at the tab, as macro1 does, the display instructions come out wrong in two words; read whole, as the dfw tapes show MACRO did, they match.',
      ev: [{ v: '4.1', re: /repeat 6\s+B=B\+B/, label: 'repeat 6 B=B+B' }] },
    { kind: 'Rebuild', title: 'Russell’s punched 3.1 source tapes rebuild the 3.1 binary',
      text: 'Decoded from FIO-DEC with every frame passing the parity check, the three 3.1 source tapes (program in two parts, star table) rebuild newSpacewar_4-30-60.bin exactly, with no transcription in between.',
      ev: [{ v: '3.1t', tab: 'tape', label: 'source tapes in the Tape view' }, { tape: 'SteveRussell_box1/spacewar3.1pt1_29sep62.bin' }] },
    { kind: 'Tape', title: 'The 3.1 source tapes are titled 24 September, filed as 29 September',
      text: 'The tapes carry the title line “spacewar 3.1 24 sep 62” though the files are named 29sep62.',
      ev: [{ v: '3.1t', re: /spacewar 3\.1/i, label: 'the title line' }] },
    { kind: 'Tape', title: 'A mis-punch on the 3.1 pt 1 tape',
      text: 'In a comment, “calling s?quence” has code 035 where “e” (065) belongs, one hole short. Parity is still odd, so the fault is in the punching, not the reading.',
      ev: [{ v: '3.1t', re: /calling s.quence/, label: 'the line' }, { tape: 'SteveRussell_box1/spacewar3.1pt1_29sep62.bin' }] },
    { kind: 'Difference', title: 'Russell’s 3.1 object tape carries a different star table',
      text: 'Against spacewar3.1_24-sep-62.bin the 3.1 source differs in 27 words, all in the star table, and the tape is four words shorter. The second word for 91 Aqar differs (652375 against 622377), 6 Pisc is absent so the following stars sit two words lower, and the table ends before 2 Ceti. The program code is identical.',
      ev: [{ v: '3.1', re: /\/\s*6 Pisc/, label: '6 Pisc' }, { v: '3.1', re: /\/91 Aqar/, label: '91 Aqar' }, { tape: 'SteveRussell_box1/spacewar3.1_24-sep-62.bin' }] },
    { kind: 'Difference', title: 'The star capture radius grew a hundredfold between 3.1 and 4.0',
      text: 'The constant str (star capture radius) is 1 in 3.1 and 100 from 4.0 on.',
      ev: [{ v: '3.1', re: /^\s*str,/, label: 'str in 3.1' }, { v: '4.0', re: /^\s*str,/, label: 'str in 4.0' }] },
    { kind: 'Rebuild', title: 'The dfw 4.1 source rebuilds two authentic binaries, once ioh is 760000',
      text: 'With “ioh” defined as 760000, the dfw transcription and Russell’s punched source tape both rebuild spacewar4.1_2-20-63_dfw.bin and spacewar4.2a_sa4.bin exactly (2,364 words). The February 1963 macro system therefore defined ioh differently from the June 1963 macro tape that survives.',
      ev: [{ v: '4.1', tab: 'tape', label: 'witnesses in the Tape view' }, { tape: 'SteveRussell_box1/spacewar4.1_2-20-63_dfw.bin' }, { tape: 'bin-files/spacewar4.2a_sa4.bin' }] },
    { kind: 'Tape', title: 'The tape called sw4.2 is titled 4.1, 2/20/63, dfw',
      text: 'SteveRussell_box1/sw4.2.bin differs from the 4.1 build in one word only (isp 3043 against 3042 at 2333, “count \\src,sq7”), a different assembly one variable apart. Its leader is punched “SPACEWAR 4.1 2/20/63 DFW”, the letters packed with no gaps between them, so the tape names itself as the 20 February 4.1, not 4.2.',
      ev: [{ v: '4.1', re: /count\s+[\\.~]src,\s*sq7/, label: 'count \\src,sq7' }, { tape: 'SteveRussell_box1/sw4.2.bin', from: 44 }] },
    { kind: 'Tape', title: 'The dfw object tape ends with its name',
      text: 'After the last block, spacewar4.1_2-20-63_dfw.bin carries the punched letters “SPACEWAR SYMZ” (frames 7963–8039). What “SYMZ” stands for is not yet known; a symbol punch is one guess.',
      ev: [{ tape: 'SteveRussell_box1/spacewar4.1_2-20-63_dfw.bin', from: 7963 }] },
    { kind: 'Transcription', title: 'The dfw transcription agrees with the punched tape in 1,135 of 1,138 lines',
      text: 'The three differences are the scan label “>>32<< 1”, a stray “_” at the end, and the tape’s overstruck “‾+” (±) in a comment, transcribed as “.+”.',
      ev: [{ v: '4.1t', label: 'the source tape, read' }, { v: '4.1', label: 'the transcription' }] },
    { kind: 'Transcription', title: 'The Morris 4.3 listing has a comment the masswerk text lacks, and masswerk has sixteen lines of 2015',
      text: 'Line “/ the score-display digit encoder” in the Morris listing has no counterpart in the masswerk 4.3, which in turn has sixteen lines marked “N.L. 2015”, Norbert Landsteiner’s changes for simple input and scoring.',
      ev: [{ v: '4.3', re: /score-display digit encoder/, label: 'Morris' }, { v: '4.3m', re: /N\.L\. 2015/, label: 'first N.L. 2015 line' }] },
    { kind: 'Anomaly', title: 'All three 4.4 texts execute a reserved opcode',
      text: 'The line “4<tab>szf 4” assembles as a data word 000004 in the path of execution. Opcode 00 is reserved on the PDP-1; the bench’s emulator reports it rather than guessing what the machine did.',
      ev: [{ v: '4.4', re: /^4\tszf 4/, label: '4.4 Morris' }, { v: '4.4m', re: /^4\tszf 4/, label: 'masswerk' }, { v: '4.4f', re: /^4\tszf 4/, label: 'variant f' }] },
    { kind: 'Difference', title: 'Angular acceleration quadrupled in 4.8',
      text: 'The constant maa (spaceship angular acceleration) is 40 in 4.8 and 10 in every other version.',
      ev: [{ v: '4.8', re: /^\s*maa,\s*13,\s*40/, label: 'maa in 4.8' }, { v: '4.1', re: /^\s*maa,/, label: 'maa in 4.1' }] },
    { kind: 'Difference', title: 'The CHM 4.1 revisions have lost a star',
      text: 'The Computer History Museum’s 4.1d and 4.1f have 468 stars against the 469 of 4.1; “26 Erid” (mark 1260, −283) is missing.',
      ev: [{ v: '4.1', re: /26 Erid/, label: '26 Erid in 4.1' }, { tape: 'spacewar-4.1-chm-2008f.rim' }] },
    { kind: 'Tape', title: 'Every object tape opens with the same read-in loader',
      text: 'The first 128 punched frames of the object tapes are one and the same RIM loader, the program the PDP-1 read in to load the blocks that follow. It is not part of Spacewar!, and differences between tapes begin after it.',
      ev: [{ tape: 'bin-files/newSpacewar_4-30-60.bin' }] }
  ];
  var FIND = FINDINGS.map(function (f, i) { f.no = 'F' + (i + 1); return f; });

  function vLabel(id) { var v = V.byId(id); return v ? v.label.replace(/^Spacewar! /, '') : id; }

  // The line a pattern finds, in the assembled parts of a version.
  function locate(ev) {
    if (!ev.re) return Promise.resolve(null);
    return SW.build(ev.v).then(function (b) {
      for (var p = 0; p < b.lines.length; p++) {
        var ls = b.lines[p];
        for (var i = 0; i < ls.length; i++) if (!ls[i].away && ev.re.test(ls[i].raw)) return { b: b, p: p, n: ls[i].n };
      }
      return null;
    }).catch(function () { return null; });
  }

  function go(ev, at) {
    if (ev.tape) {
      var owner = ev.v || (SW.tape.allTapes().filter(function (t) { return t.path === ev.tape; })[0] || {}).versions;
      var vid = typeof owner === 'string' ? owner : owner && owner[0];
      if (!vid) { window.open(SW.sourceURL(ev.tape), '_blank', 'noopener'); return; }
      SW.state.tapeGo = { path: ev.tape, from: ev.from };
      if (vid !== SW.state.v) SW.select(vid);
      SW.setTab('tape');
      return;
    }
    if (ev.v !== SW.state.v) SW.select(ev.v);   // choosing a version clears the selection, so select first
    if (at) SW.state.sel = { p: at.p, n0: at.n, n1: at.n };
    SW.setTab(ev.tab || 'read');
  }

  function evidenceHTML(f, el) {
    var wrap = SW.el('div', { class: 'fd-ev' });
    wrap.appendChild(SW.el('span', { class: 'hint' }, 'Evidence '));
    f.ev.forEach(function (ev) {
      if (ev.tape) {
        var a = SW.el('button', { class: 'btn ghost mono', title: 'Show this tape in the Tape view' + (ev.from ? ', from frame ' + ev.from : '') }, '▤ ' + ev.tape.split('/').pop());
        a.onclick = function () { go(ev); };
        wrap.appendChild(a);
        wrap.insertAdjacentHTML('beforeend', '<span class="fd-gh"><a href="' + SW.esc(SW.sourceURL(ev.tape)) + '" target="_blank" rel="noopener" title="Open ' + SW.esc(ev.tape) + ' on GitHub in a new tab">↗</a></span>');
        return;
      }
      var btn = SW.el('button', { class: 'btn ghost', title: 'Open in ' + vLabel(ev.v) }, vLabel(ev.v) + (ev.label ? ', ' + ev.label : ''));
      var at = null;
      btn.onclick = function () { go(ev, at); };
      wrap.appendChild(btn);
      locate(ev).then(function (r) {
        if (!r) return;
        at = r;
        btn.textContent = vLabel(ev.v) + ', l. ' + r.n + (ev.label ? ' (' + ev.label + ')' : '');
        btn.title = SW.cite(r.b, r.p, r.n, r.n);
        ev.cite = SW.cite(r.b, r.p, r.n, r.n);
      });
    });
    el.appendChild(wrap);
  }

  // ---------- live checks ----------
  var live = { witness: null, titles: null };

  function checkWitnesses(box) {
    box.innerHTML = '<p class="hint">Assembling every version with a witness tape and comparing it word by word…</p>';
    var vs = V.VERSIONS.filter(function (v) { return (v.witnesses || []).length && v.build; }).sort(function (a, b) { return a.sort - b.sort; });
    var rows = [];
    return vs.reduce(function (pr, v) {
      return pr.then(function () {
        return SW.build(v.id).then(function (b) {
          if (!b.asm) return;
          return SW.tape.witnesses(b).then(function (rs) {
            rs.forEach(function (r) {
              var same = r.differ === 0 && r.missing === 0 && r.extra === 0;
              rows.push([vLabel(v.id), { html: SW.sourceLink(r.tape, r.tape.split('/').pop()), text: r.tape, sort: r.tape },
                         r.words, r.differ, r.missing, r.extra,
                         { html: same ? '<span class="badge ok">identical</span>' : '<span class="badge">' + r.differ + ' differ</span>', text: same ? 'identical' : r.differ + ' words differ', sort: same ? 0 : 1 }, v.id]);
            });
          });
        }).catch(function () {});
      });
    }, Promise.resolve()).then(function () {
      live.witness = rows;
      box.innerHTML = '<p class="hint">' + rows.filter(function (r) { return r[6].sort === 0; }).length + ' of ' + rows.length + ' comparisons are identical. Checked ' + SW.fmtDate(SW.today()) + '. Click a row for the word-by-word differences.</p>';
      box.appendChild(SW.table(['Version', 'Tape', 'Words on tape', 'Differ', 'Only in source', 'Only on tape', 'Result'],
        rows.map(function (r) { return r.slice(0, 7); }),
        { cls: ['', 'mono', 'num', 'num', 'num', 'num', ''], onRow: function (r) {
          var hit = rows.filter(function (x) { return x[1] === r[1] && x[0] === r[0]; })[0];
          if (hit) go({ v: hit[7], tab: 'tape' });
        } }));
    });
  }

  function checkTitles(box) {
    box.innerHTML = '<p class="hint">Reading every tape…</p>';
    var tapes = SW.tape.allTapes(), rows = [];
    return Promise.all(tapes.map(function (t) {
      return SW.fetchBytes(t.path).then(function (bytes) {
        SW.tape.titles(bytes).forEach(function (ti) {
          rows.push({ tape: t, t: ti, svg: SW.tape.titleSVG(bytes, ti) });
        });
        return bytes.length;
      }).catch(function () { return 0; });
    })).then(function () {
      live.titles = rows;
      box.innerHTML = '<p class="hint">' + tapes.length + ' tape images read; ' + rows.length + ' punched title' + (rows.length === 1 ? '' : 's') + ' found. The reading matches each five-column letter against the shapes seen on these tapes; “?” marks one not yet known.</p>';
      rows.forEach(function (r) {
        var d = SW.el('div', { class: 'tape-title' });
        d.innerHTML = '<div class="tape-title-img">' + r.svg + '</div><div><b class="mono">“' + SW.esc(r.t.text) + '”</b><br><span class="hint mono">' +
          SW.sourceLink(r.tape.path) + ', frames ' + r.t.from + '–' + r.t.to + (r.tape.versions.length ? ' · ' + r.tape.versions.map(vLabel).join(', ') : '') + '</span></div>';
        var b = SW.el('button', { class: 'btn ghost' }, 'Show on tape');
        b.onclick = function () { go({ tape: r.tape.path, from: r.t.from, v: r.tape.versions[0] }); };
        d.appendChild(b);
        box.appendChild(d);
      });
    });
  }

  function checkNotes(box) {
    box.innerHTML = '<p class="hint">Gathering notes…</p>';
    return N.listAll().then(function (all) {
      var list = all.filter(function (n) {
        return (n.tags || []).some(function (t) { return /^findings?$/i.test(t); });
      }).sort(function (a, b) { return String(a.date) < String(b.date) ? -1 : 1; });
      live.notes = list;
      box.innerHTML = '';
      if (!list.length) {
        box.innerHTML = '<p class="hint">None yet. Tag a note “finding” (in Read, or under Version &amp; notes) and it appears here, signed and dated.</p>';
        return;
      }
      var byRow = new Map();
      var rows = list.map(function (n) {
        var r = [{ html: SW.esc(SW.fmtDate(n.date)), sort: String(n.date), text: SW.fmtDate(n.date) }, n.by, vLabel(n.vid),
                 n.anchor ? 'l. ' + n.anchor.n0 + (n.anchor.n1 !== n.anchor.n0 ? '–' + n.anchor.n1 : '') : 'version', n.text];
        byRow.set(r, n);
        return r;
      });
      box.appendChild(SW.table(['Date', 'By', 'Version', 'Where', 'Finding'], rows, { cls: ['mono', 'mono', '', 'mono', ''], onRow: function (r) {
        var n = byRow.get(r);
        if (!n) return;
        if (n.anchor) SW.state.sel = { p: n.anchor.p, n0: n.anchor.n0, n1: n.anchor.n1 };
        if (n.vid !== SW.state.v) SW.select(n.vid);
        SW.setTab(n.anchor ? 'read' : 'about');
      } }));
    });
  }

  // ---------- export ----------
  function doc() {
    var blocks = [{ type: 'h2', text: 'Established by the bench' }];
    FIND.forEach(function (f) {
      blocks.push({ type: 'h3', text: f.no + '. ' + f.title });
      blocks.push({ type: 'p', text: f.text });
      var ev = f.ev.map(function (e) {
        return e.tape ? e.tape + (e.from ? ' (from frame ' + e.from + ')' : '') : e.cite || (vLabel(e.v) + (e.label ? ', ' + e.label : ''));
      });
      blocks.push({ type: 'p', text: 'Evidence. ' + ev.join('; ') + '.' });
    });
    if (live.witness) {
      blocks.push({ type: 'h2', text: 'Witness tapes' });
      blocks.push(SW.tableBlock('Builds compared with surviving object tapes, ' + SW.fmtDate(SW.today()), ['Version', 'Tape', 'Words on tape', 'Differ', 'Only in source', 'Only on tape', 'Result'],
        live.witness.map(function (r) { return r.slice(0, 7); })));
    }
    if (live.titles) {
      blocks.push({ type: 'h2', text: 'Punched titles' });
      blocks.push(SW.tableBlock('Titles punched into the tapes, as read by the bench', ['Tape', 'Frames', 'Reading', 'Versions'],
        live.titles.map(function (r) { return [r.tape.path, r.t.from + '–' + r.t.to, r.t.text, r.tape.versions.map(vLabel).join(', ')]; })));
    }
    if (live.notes && live.notes.length) {
      blocks.push({ type: 'h2', text: 'Findings from the group' });
      blocks.push(SW.tableBlock('Notes tagged “finding”', ['Date', 'By', 'Version', 'Where', 'Finding'], live.notes.map(function (n) {
        return [SW.fmtDate(n.date), n.by, vLabel(n.vid), n.anchor ? 'l. ' + n.anchor.n0 + (n.anchor.n1 !== n.anchor.n0 ? '–' + n.anchor.n1 : '') : 'version', n.text];
      })));
    }
    return { title: 'Spacewar! findings', subtitle: 'What the source, the tapes and the assembler show',
             meta: [['Generated', SW.fmtDate(SW.today()) + ', Spacewar! research bench v' + SW.VERSION]], blocks: blocks };
  }

  // ---------- view ----------
  var done = false;
  function render() {
    done = true;
    view.innerHTML = '';
    var pad = SW.el('div', { class: 'pad findings' });
    var tb = SW.el('div', { class: 'toolbar', style: 'position:static;padding-left:0' });
    tb.appendChild(SW.exportButtons(doc, 'spacewar-findings'));
    tb.appendChild(SW.el('button', { class: 'btn ghost', title: 'Read the tapes and compare the witnesses again, and fetch the group’s notes', onclick: function () { run(); } }, '↻ Check again'));
    pad.innerHTML = '<h2>Findings</h2><p class="prose">What the bench has established about the Spacewar! sources, gathered from the build logs so each can be cited, with its evidence one click away. The witness tapes and punched titles below are not copied from anywhere; they are checked afresh against the tapes every time this page opens. Notes tagged “finding” by the group are added at the end.</p>';
    pad.appendChild(tb);
    var list = SW.el('ol', { class: 'fd-list' });
    FIND.forEach(function (f) {
      var li = SW.el('li', { class: 'fd' });
      li.innerHTML = '<div class="fd-head"><span class="fd-no mono">' + f.no + '</span> <b>' + SW.esc(f.title) + '</b> <span class="badge">' + SW.esc(f.kind) + '</span></div><p>' + SW.esc(f.text) + '</p>';
      evidenceHTML(f, li);
      list.appendChild(li);
    });
    pad.appendChild(list);
    pad.appendChild(SW.el('h3', {}, 'Witness tapes, checked now'));
    var wBox = SW.el('div');
    pad.appendChild(wBox);
    pad.appendChild(SW.el('h3', {}, 'Punched titles, read now'));
    var tBox = SW.el('div');
    pad.appendChild(tBox);
    pad.appendChild(SW.el('h3', {}, 'From the group: notes tagged “finding”'));
    var nBox = SW.el('div');
    pad.appendChild(nBox);
    view.appendChild(pad);
    function run() {
      checkTitles(tBox);
      checkNotes(nBox);
      checkWitnesses(wBox);
    }
    run();
  }

  SW.views.findings = { show: function () { if (!done) render(); } };
  SW.findings = { list: FIND };
})(this);
