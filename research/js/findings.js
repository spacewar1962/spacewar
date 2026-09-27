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
    { kind: 'Difference', title: 'The Expensive Planetarium makes its stars bright in two ways, and the versions switch between them',
      text: 'Every version draws the star table the same way (dislis: the stored X less fpr, a window of 1,024 units, 45 degrees of sky square on the scope), but brightness and drift differ. 2B draws each group at one intensity and makes the bright ones bright by redrawing them: group 1 twice a pass (jsp 1m at the start and end of bck), group 2 once, group 3 every second pass, group 4 every fourth; the sky drifts one unit every 32 passes (law i 40), sense switch 3 holds it, switch 4 speeds it to every 5 passes. From 3.1 (and in 4.0, 4.1, 4.8 and 2015) the groups are drawn together every second pass with intensities 3, 2, 1, 0 set into the display instruction (dislis 1j,1q,3 … 4j,4q,0; dpy-i+B), drifting every 16 star frames, still 32 passes; sense switch 4 turns the stars off. 4.0TS draws only groups 1 to 3. The ddp line (the Morris listings of 4.2, 4.3 and 4.4, and the masswerk 4.4) returns to redrawing, but drifts every 8 passes (law i 10), four times as fast. The masswerk 4.3 (“spacewar 4.3f … mod. nl 2/28/2015”) carries the 3.1 intensity scheme instead of its Morris listing’s, in lines not marked N.L. 2015. The CHM 4.1 revisions keep intensities but change them to 3, 1, 7, 4 (“intensities 7,6,5,4 would be dimmer; 3,2,1,0 brighter”), with the timings moved into the constants bkf and bks. See it run in The sky’s star map, “On the scope”.',
      ev: [{ v: '2b', re: /^1m,\s*dislis/, label: '2B: 1m, dislis 1j,1q' }, { v: '3.1', re: /dislis 1j,\s*1q,\s*3/, label: '3.1: dislis 1j,1q,3' }, { v: '4.3', re: /isp bkc/, label: 'Morris 4.3: isp bkc, law i 10' }, { v: '4.3m', re: /dislis 1j,\s*1q,\s*3/, label: 'masswerk 4.3: dislis 1j,1q,3' }, { v: '4.1f', re: /dislis 3j,\s*3q,\s*7/, label: 'CHM 4.1f: dislis 3j,3q,7' }] },
    { kind: 'Difference', title: 'The star capture radius grew a hundredfold between 3.1 and 4.0',
      text: 'The constant str (star capture radius) is 1 in 3.1 and 100 from 4.0 on.',
      ev: [{ v: '3.1', re: /^\s*str,/, label: 'str in 3.1' }, { v: '4.0', re: /^\s*str,/, label: 'str in 4.0' }] },
    { kind: 'Rebuild', title: 'The dfw 4.1 source rebuilds two authentic binaries, once ioh is 760000',
      text: 'With “ioh” defined as 760000, the dfw transcription and Russell’s punched source tape both rebuild spacewar4.1_2-20-63_dfw.bin and spacewar4.2a_sa4.bin exactly (2,364 words). The February 1963 macro system therefore defined ioh differently from the June 1963 macro tape that survives.',
      ev: [{ v: '4.1', tab: 'tape', label: 'witnesses in the Tape view' }, { tape: 'SteveRussell_box1/spacewar4.1_2-20-63_dfw.bin' }, { tape: 'bin-files/spacewar4.2a_sa4.bin' }] },
    { kind: 'Tape', title: 'The tape called sw4.2 is the 20 February 4.1, with one lost hole',
      text: 'SteveRussell_box1/sw4.2.bin differs from the 4.1 build in one word only (isp 3043 against 3042 at 2333, “count \\src,sq7”). Its own checksum shows why: the checksum punched after the block 2300 to 2400 is 7262, the same as on the dfw tape, but the block’s words sum to one less, so one hole (the lowest bit) was lost in punching or reading. It is the same assembly as the 20 February dfw tape, and its leader is punched “SPACEWAR 4.1 2/20/63 DFW”, the letters packed with no gaps, so the tape filed as 4.2 names itself as that 4.1.',
      ev: [{ v: '4.1', re: /count\s+[\\.~]src,\s*sq7/, label: 'count \\src,sq7' }, { tape: 'SteveRussell_box1/sw4.2.bin', from: 44 }] },
    { kind: 'Tape', title: 'Every block checksum on the object tapes checks, except one',
      text: 'Read block by block (Tape view, Anatomy), the object tapes carry 39 to 56 checksummed blocks each after the same 21-word read-in loader, and every checksum agrees with its words except block 2300 to 2400 on sw4.2.bin, off by one: run through the tape’s own loader (Load tape), that block stops the machine at the loader’s hlt. The 2B tape ends without a closing jump to a start address, so the loader is left waiting for the reader; the dfw 4.1 tape’s program ends with jmp 7751, back into the loader, which reads on into a second part (below).',
      ev: [{ tape: 'SteveRussell_box1/sw4.2.bin', from: 4039 }, { tape: 'bin-files/spacewar2B_2apr62.bin' }, { tape: 'SteveRussell_box1/spacewar4.1_2-20-63_dfw.bin' }] },
    { kind: 'Tape', title: 'The dfw object tape carries Spacewar! 4.1’s symbol table after “SPACEWAR SYMZ”',
      text: 'The program’s blocks on spacewar4.1_2-20-63_dfw.bin end with jmp 7751, which sends the machine back into the loader. After the punched letters “SPACEWAR SYMZ” (frames 7963–8039) the loader reads on: 12 more blocks, every checksum good, 719 words at 6432–7750, then jmp 1411. They are 359 pairs of name and value, and one last word at 7750, 206432 (lac 6432, the address of the table’s first word). Each name is three six-bit FIO-DEC concise characters, bit 040 flipped: in the first character when bit 020 is clear, in the second and third when it is set (1j is 414100, acx 612367, clc 634323). Decoded, the names run in alphabetical order (0 sorting after the letters). All 235 symbols of the 4.1 build are there with the build’s values (1j 6077, 1q 6117, 1sc 3024, acx 3035, col 1463, …), with 124 permanent symbols of MACRO: the instructions (add, dac, jmp, law, …), the in-out codes (dpy 730007, cks 720033, …), i (10000) and the shift counts 1s to 9s (1, 3, 7, … 777). Names are cut to three characters, as MACRO’s symbols were. This is the symbol table of the assembly, punched after the program, which fits the title “SYMZ”. Loaded through to its end, the tape overwrites the star table at 6432–7750 in core. Found by running the tape through its own loader (Tape view, Tape Load Simulator).',
      ev: [{ tape: 'SteveRussell_box1/spacewar4.1_2-20-63_dfw.bin', from: 7963 }, { v: '4.1', re: /^1j,/, label: '1j, the star table’s first label' }] },
    { kind: 'Transcription', title: 'The dfw transcription agrees with the punched tape in 1,135 of 1,138 lines',
      text: 'The three differences are the scan label “>>32<< 1”, a stray “_” at the end, and the tape’s overstruck “‾+” (±) in a comment, transcribed as “.+”.',
      ev: [{ v: '4.1t', label: 'the source tape, read' }, { v: '4.1', label: 'the transcription' }] },
    { kind: 'Difference', title: 'Spacewar! 4.4 uses swp, a PDP-1D instruction that exchanges AC and IO',
      text: 'Up to 4.3 the outline compiler (ocs) plants each exchange of AC and IO in the compiled ship code as two words, rcl 9s and rcl 9s. In 4.4 it plants one, swp, defined in the listing itself (“swp=opr 60”), and swp is used by hand elsewhere in 4.4. DEC’s PDP-1 Supplement (PDP-1D-45, 1964) lists 760060 swp (exchange AC and I/O) with 760020 lia (I/O from AC) and 760040 lai (AC from I/O). The 4.8 scorer uses lai after reading the control word (jsp cwg). The June 1963 macro tape defines none of the three. Until 1.14.9 the bench’s emulator did not implement them, and 4.4’s ships were drawn as flat lines.',
      ev: [{ v: '4.4', re: /swp=opr 60/, label: 'swp defined in 4.4' }, { v: '4.3', re: /lio \(rcl 9s/, label: 'rcl 9s in 4.3' }, { v: '4.8', re: /^\s*lai\s*$/, label: 'lai in the 4.8 scorer' }] },
    { kind: 'Transcription', title: 'Russell’s 3.1 tapes read “skp” and “marc” where the 3.1 transcription has “skip” and “mark”',
      text: 'In the integer square root (sqt) the pt 1 tape has “sma+sza-skp”; the 3.1 transcription has “sma+sza-skip”, as do the modern texts of 1 and 2B, while every text from 4.0 on has “skp”. On the tape’s evidence sqt is unchanged from 3.1 to 4.0. In the star table the pt 3 tape has “marc 1260, -283” (26 Erid), and so does stars.bin, where the transcription and the other star tables have “mark”. Neither changes the program: skip and skp are both 640000, and the assembler (as macro1 does) recognises a macro by its first three letters, so “marc” calls mark. The tapes rebuild the 3.1 binary exactly.',
      ev: [{ v: '3.1t', re: /sma\+sza-skp/, label: 'skp on the tape' }, { v: '3.1', re: /sma\+sza-skip/, label: 'skip in the transcription' }, { v: '3.1t', re: /marc 1260/, label: 'marc on the tape' }, { tape: 'SteveRussell_box1/spacewar3.1pt3_29sep62.bin' }, { tape: 'SteveRussell_box1/stars.bin' }] },
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
    if (at && !ev.tab) { SW.openAt(ev.v, { p: at.p, n0: at.n }); return; }
    if (ev.v !== SW.state.v) SW.select(ev.v);
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

  // Who added a finding, as a colour: the bench (its build logs) in the beam
  // colour, each person by their initials.
  function hueOf(by) { var h = 0; for (var i = 0; i < by.length; i++) h = (h * 31 + by.charCodeAt(i)) % 360; return (h + 200) % 360; }
  function colourOf(by) { return by === 'bench' ? 'var(--beam)' : 'hsl(' + hueOf(by) + ',62%,60%)'; }
  function legend(people) {
    var el = SW.$('.fd-legend', view);
    if (!el) return;
    el.innerHTML = '<span class="hint">Added by</span> <span class="fd-who"><i style="background:' + colourOf('bench') + '"></i>the bench (build logs)</span>' +
      people.map(function (p) { return ' <span class="fd-who"><i style="background:' + colourOf(p) + '"></i>' + SW.esc(p) + '</span>'; }).join('');
  }
  function mineButton(make, extra) {
    return SW.el('button', { class: 'btn ghost fd-mine', title: 'Put this finding in My notes (private)', onclick: function () { SW.tray.addDoc(make(), extra); } }, '＋ My notes');
  }
  // On a finding of one's own: edit it, move it to the bin, or take it back
  // into My notes (out of the group).
  var undo = [];   // this session: how to reverse each change to the group's findings
  function paintUndo() {
    var b = SW.$('#view-findings .fd-undo'); if (!b) return;
    b.hidden = !undo.length; b.title = undo.length ? 'Undo: ' + undo[undo.length - 1].label : '';
  }
  function did(label, fn) {
    undo.push({ label: label, fn: fn });
    paintUndo();
    SW.toast(label, 0, { label: 'Undo', fn: undoLast });
  }
  function undoLast() {
    var u = undo.pop(); paintUndo(); if (!u) return;
    Promise.resolve(u.fn()).then(function () { SW.toast('Undone'); }, function (err) { SW.toast(err.message, 5000); });
  }
  function ownActions(n, li) {
    var box = SW.el('span', { class: 'fd-own' });
    box.appendChild(SW.el('button', { class: 'btn ghost', title: 'Edit the text and tags', onclick: function () {
      if (SW.$('.fd-edit', li)) return;
      var ed = SW.el('div', { class: 'fd-edit' });
      var keep = (n.tags || []).filter(function (g) { return /^findings?$/i.test(g); });
      var c0 = catOf(n.text, n.tags), l0 = levelOf(n.tags);
      ed.innerHTML = '<textarea rows="4"></textarea><input placeholder="Tags, separated by commas">' +
        '<div class="toolbar" style="position:static;padding-left:0"><label class="check">Importance <select data-e2="lvl">' + LEVELS.map(function (l) { return '<option value="' + l[0] + '"' + (l[0] === l0 ? ' selected' : '') + '>' + l[2] + ' ' + l[1] + '</option>'; }).join('') + '</select></label>' +
        '<label class="check">Category <select data-e2="cat"><option value="">Found from the words (' + SW.esc(CATNAME[catOf(n.text, []).id]) + ')</option>' + CATS.concat([['other', 'Other']]).map(function (c) { return '<option value="' + c[0] + '"' + (!c0.auto && c0.id === c[0] ? ' selected' : '') + '>' + c[1] + '</option>'; }).join('') + '</select></label>' +
        '<button class="btn" data-e="save">Save</button><button class="btn ghost" data-e="cancel">Cancel</button></div>';
      SW.$('textarea', ed).value = n.text;
      SW.$('input', ed).value = (n.tags || []).filter(function (g) { return !/^findings?$/i.test(g) && !/^(cat|level):/.test(g); }).join(', ');
      ed.addEventListener('click', function (e) {
        var b = e.target.closest('[data-e]'); if (!b) return;
        if (b.dataset.e === 'cancel') { ed.remove(); return; }
        var text = SW.$('textarea', ed).value.trim(); if (!text) return;
        var tags = keep.concat(SW.$('input', ed).value.split(',').map(function (g) { return g.trim(); }).filter(function (g) { return g && !/^(cat|level):/.test(g); }));
        tags.push('level:' + SW.$('[data-e2="lvl"]', ed).value);
        if (SW.$('[data-e2="cat"]', ed).value) tags.push('cat:' + SW.$('[data-e2="cat"]', ed).value);
        b.disabled = true;
        var was = { text: n.text, tags: (n.tags || []).slice() };
        N.update(n, text, tags).then(function () { did('Finding edited', function () { return N.update(n, was.text, was.tags); }); }, function (err) { b.disabled = false; SW.toast(err.message, 5000); });
      });
      li.appendChild(ed);
      SW.$('textarea', ed).focus();
    } }, '✎ Edit'));
    box.appendChild(SW.el('button', { class: 'btn ghost', title: 'Take it out of the group’s Findings (to the bin, where it can be restored)', onclick: function () {
      if (!confirm('Delete this finding from the group? It goes to the bin, where it can be restored.')) return;
      N.bin(n).then(function () { did('Finding moved to the bin', function () { return N.restore(n); }); }, function (err) { SW.toast(err.message, 5000); });
    } }, '🗑 Delete'));
    box.appendChild(SW.el('button', { class: 'btn ghost', title: 'Take it out of the group and back into My notes, private', onclick: function () {
      if (!confirm('Take this finding out of the group and back into My notes?')) return;
      N.bin(n).then(function () { SW.tray.recall(n); did('Back in My notes', function () { SW.tray.undo(); return N.restore(n); }); }, function (err) { SW.toast(err.message, 5000); });
    } }, '↩ Recall to My notes'));
    return box;
  }
  // Annotations tagged "finding": cards in their author's colour; the first line is the title.
  function checkNotes(box, cached) {
    if (!cached || !live.notes) box.innerHTML = '<p class="hint">Gathering the group’s findings…</p>';
    return (cached && live.notes ? Promise.resolve(null) : N.whoami().catch(function () {}).then(function () { return N.listAll(); })).then(function (all) {
      var list = all ? all.filter(function (n) {
        return (n.tags || []).some(function (t) { return /^findings?$/i.test(t); });
      }).sort(function (a, b) { return String(a.date) < String(b.date) ? -1 : 1; }) : live.notes;
      live.notes = list;
      box.innerHTML = '';
      var people = []; list.forEach(function (n) { if (people.indexOf(n.by) < 0) people.push(n.by); });
      legend(people);
      var bySel = SW.$('#view-findings .fd-by');
      if (bySel) people.forEach(function (pp) { if (!SW.$$('option', bySel).some(function (o) { return o.value === pp; })) bySel.appendChild(SW.el('option', { value: pp }, SW.esc(pp))); });
      if (!list.length) {
        box.innerHTML = '<p class="hint">None from the group yet. Add one with ✎ Add a finding above, or ★ Finding on a selection in Read: it is shared with the group, signed and dated, and shown here in your colour.</p>';
        return;
      }
      var items = list.map(function (n, i) {
        var c = catOf(n.text, n.tags), lvl = levelOf(n.tags);
        return { by: n.by, cat: c, lvl: lvl, order: i, text: n.text + ' ' + (n.tags || []).join(' ') + ' ' + n.by, vids: [n.vid], card: function () { return groupCard(n, i, c, lvl); } };
      });
      grouped(box, items, 'None.');
    });
  }
  function groupCard(n, i, c, lvl) {
      {
        var lines = String(n.text).split(/\n/), title = lines[0].replace(/^#+\s*/, ''), rest = lines.slice(1).join('\n').trim();
        var where = vLabel(n.vid) + (n.anchor ? ', l. ' + n.anchor.n0 + (n.anchor.n1 !== n.anchor.n0 ? '–' + n.anchor.n1 : '') : ', the version');
        var li = SW.el('li', { class: 'fd', style: 'border-left-color:' + colourOf(n.by) });
        li.innerHTML = '<div class="fd-head"><span class="fd-no mono">G' + (i + 1) + '</span> <b>' + SW.esc(title) + '</b> <span class="badge" style="background:' + colourOf(n.by) + ';color:#000">' + SW.esc(n.by) + '</span>' + chips(c, lvl) + ' <span class="hint">' + SW.esc(SW.fmtDate(n.date)) + '</span></div>' +
          (rest ? '<p>' + SW.esc(rest) + '</p>' : '') + ((n.tags || []).filter(function (g) { return !/^findings?$/i.test(g) && !/^(cat|level):/.test(g); }).map(function (g) { return '<span class="fd-tag">' + SW.esc(g.replace(/^chapter:/, '')) + '</span>'; }).join(' ') || '') + '<div class="fd-ev"><span class="hint">Evidence </span><a href="#" class="fd-go">' + SW.esc(where) + '</a></div>';
        SW.$('.fd-go', li).onclick = function (e) {
          e.preventDefault();
          if (n.anchor) SW.state.sel = { p: n.anchor.p, n0: n.anchor.n0, n1: n.anchor.n1 };
          if (n.vid !== SW.state.v) SW.select(n.vid);
          SW.setTab(n.anchor ? 'read' : 'about');
        };
        if (N.mine(n)) li.appendChild(ownActions(n, li));
        li.appendChild(mineButton(function () { return { title: title, subtitle: n.by + ', ' + SW.fmtDate(n.date) + '; ' + where, blocks: rest ? [{ type: 'p', text: rest }] : [] }; }, { by: n.by, vid: n.vid, shared: { date: n.date }, tags: (n.tags || []).filter(function (g) { return !/^findings?$|^chapter:/i.test(g); }) }));
        return li;
      }
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
      blocks.push(SW.tableBlock('Annotations tagged “finding”', ['Date', 'By', 'Version', 'Where', 'Finding'], live.notes.map(function (n) {
        return [SW.fmtDate(n.date), n.by, vLabel(n.vid), n.anchor ? 'l. ' + n.anchor.n0 + (n.anchor.n1 !== n.anchor.n0 ? '–' + n.anchor.n1 : '') : 'version', n.text];
      })));
    }
    return { title: 'Spacewar! findings', subtitle: 'What the source, the tapes and the assembler show',
             meta: [['Generated', SW.fmtDate(SW.today()) + ', Spacewar! research bench v' + SW.VERSION]], blocks: blocks };
  }

  // ---------- view ----------
  // ---------- categories and importance ----------
  // A category is found from the words of a finding (the one with most
  // matches), unless a "cat:" tag sets it; importance from a "level:" tag, and
  // for the bench's own findings Notable until set otherwise.
  var CATS = [
    ['tape', 'Tapes and loading', /\b(tapes?|loader|read-?in|checksums?|punched|frames?|rim|blocks?|fio-?dec|parity)\b/gi],
    ['text', 'Transcription and text', /\b(transcriptions?|transcribed|typos?|scans?|overlin\w*|misread\w*|listings?|comments?|spellings?)\b/gi],
    ['display', 'Display and graphics', /\b(dpy|display\w*|screen|stars?|sun|outlines?|scope|type 30|plotted|phosphor|constellations?|planetarium)\b/gi],
    ['game', 'Game logic', /\b(hyperspace|torpedo(es)?|collisions?|gravity|controls?|scor(e|es|ing)|explo(de|des|sion)|fuel|thrust|rockets?)\b/gi],
    ['machine', 'Machine and timing', /\b(instructions?|cycles?|emulator|opr|swp|lai|lia|mdv|multipl\w*|divide|timing|memory|core|sequence break|iot|pdp-1d)\b/gi],
    ['versions', 'Versions and genealogy', /\b(versions?|forks?|dfw|ddp|masswerk|landsteiner|morris|russell|samson|preonas|genealogy|variants?|witness\w*)\b/gi]
  ];
  var CATNAME = { other: 'Other' }; CATS.forEach(function (c) { CATNAME[c[0]] = c[1]; });
  var LEVELS = [['key', 'Key', '★★★'], ['notable', 'Notable', '★★'], ['minor', 'Minor', '★']];
  function catOf(text, tags) {
    var t = (tags || []).filter(function (g) { return /^cat:/.test(g); })[0];
    if (t && CATNAME[t.slice(4)]) return { id: t.slice(4), auto: false };
    var best = 'other', bn = 0;
    CATS.forEach(function (c) { var m = (String(text).match(c[2]) || []).length; if (m > bn) { bn = m; best = c[0]; } });
    return { id: best, auto: true };
  }
  function levelOf(tags, dflt) {
    var t = (tags || []).filter(function (g) { return /^level:/.test(g); })[0], id = t ? t.slice(6) : '';
    return LEVELS.some(function (l) { return l[0] === id; }) ? id : (dflt || 'notable');
  }
  function chips(c, lvl) {
    var L = LEVELS.filter(function (l) { return l[0] === lvl; })[0];
    return ' <span class="fd-cat" title="' + (c.auto ? 'Category found from the words of the finding; a cat: tag sets it' : 'Category set by a cat: tag') + '">' + SW.esc(CATNAME[c.id]) + (c.auto ? '' : ' ✓') + '</span>' +
      ' <span class="fd-lvl fd-' + lvl + '" title="' + L[1] + '">' + L[2] + '</span>';
  }
  var FS = SW.store.get('fd.filt', {}) || {};
  function passes(it) {
    if (FS.cat && it.cat.id !== FS.cat) return false;
    if (FS.lvl === 'key' && it.lvl !== 'key') return false;
    if (FS.lvl === 'notable' && it.lvl === 'minor') return false;
    if (FS.v && it.vids.indexOf(FS.v) < 0) return false;
    if (FS.by && it.by !== FS.by) return false;
    if (FS.q && it.text.toLowerCase().indexOf(FS.q.toLowerCase()) < 0) return false;
    return true;
  }
  var LORD = { key: 0, notable: 1, minor: 2 };
  // items {cat, lvl, text, vids, card()} under category headings, most important first, minor ones folded
  function grouped(box, items, empty) {
    var shown = items.filter(passes);
    if (!shown.length) { box.appendChild(SW.el('p', { class: 'hint' }, items.length ? 'None with these filters.' : empty)); return; }
    CATS.map(function (c) { return c[0]; }).concat(['other']).forEach(function (id) {
      var g = shown.filter(function (it) { return it.cat.id === id; }); if (!g.length) return;
      g.sort(function (a, b) { return LORD[a.lvl] - LORD[b.lvl] || a.order - b.order; });
      var sec = SW.el('div', { class: 'fd-cgroup' });
      sec.appendChild(SW.el('h4', { class: 'fd-chead' }, SW.esc(CATNAME[id]) + ' <span class="faint">' + g.length + '</span>'));
      var ol = SW.el('ol', { class: 'fd-list' }), minor = g.filter(function (it) { return it.lvl === 'minor'; });
      g.filter(function (it) { return it.lvl !== 'minor'; }).forEach(function (it) { ol.appendChild(it.card()); });
      sec.appendChild(ol);
      if (minor.length) {
        var d = SW.el('details', { class: 'fd-minor' }, '<summary>' + minor.length + ' minor</summary>'), ol2 = SW.el('ol', { class: 'fd-list' });
        minor.forEach(function (it) { ol2.appendChild(it.card()); }); d.appendChild(ol2); sec.appendChild(d);
      }
      box.appendChild(sec);
    });
  }
  function filterBar(onChange) {
    var vs = V.VERSIONS.filter(function (v) { return v.build && v.id !== 'stars'; }).sort(function (a, b) { return a.sort - b.sort; });
    var bar = SW.el('div', { class: 'toolbar fd-filters', style: 'position:static;padding-left:0' });
    bar.innerHTML = '<label class="check">Category <select data-f="cat"><option value="">All</option>' + CATS.concat([['other', 'Other']]).map(function (c) { return '<option value="' + c[0] + '"' + (FS.cat === c[0] ? ' selected' : '') + '>' + c[1] + '</option>'; }).join('') + '</select></label>' +
      '<label class="check">Importance <select data-f="lvl"><option value="">All</option><option value="notable"' + (FS.lvl === 'notable' ? ' selected' : '') + '>Key and notable</option><option value="key"' + (FS.lvl === 'key' ? ' selected' : '') + '>Key only</option></select></label>' +
      '<label class="check">Version <select data-f="v"><option value="">All</option>' + vs.map(function (v) { return '<option value="' + v.id + '"' + (FS.v === v.id ? ' selected' : '') + '>' + SW.esc(v.label.replace(/^Spacewar! /, '')) + '</option>'; }).join('') + '</select></label>' +
      '<label class="check">By <select data-f="by" class="fd-by"><option value="">Anyone</option><option value="bench"' + (FS.by === 'bench' ? ' selected' : '') + '>the bench</option>' + (FS.by && FS.by !== 'bench' ? '<option value="' + SW.esc(FS.by) + '" selected>' + SW.esc(FS.by) + '</option>' : '') + '</select></label>' +
      '<input type="search" data-f="q" placeholder="Find in findings" value="' + SW.esc(FS.q || '') + '">';
    function set(e) { var f = e.target.dataset.f; if (!f) return; FS[f] = e.target.value; SW.store.set('fd.filt', FS); onChange(); }
    bar.addEventListener('change', set);
    bar.addEventListener('input', function (e) { if (e.target.dataset.f === 'q') { clearTimeout(bar._t); bar._t = setTimeout(function () { set(e); }, 250); } });
    return bar;
  }

  // The shared findings: the bench's and the group's. (My notes has its own tab.)
  var done = false;
  function render() {
    done = true;
    view.innerHTML = '';
    var pad = SW.el('div', { class: 'pad findings' });
    view.appendChild(pad);
    var tb = SW.el('div', { class: 'toolbar', style: 'position:static;padding-left:0' });
    tb.appendChild(SW.el('button', { class: 'btn', title: 'A finding on the version open, shared with the group, tagged “finding”; the first line is its title. (For lines, select them in Read and use ★ Finding.)', onclick: function () {
      var v = SW.state.v && V.byId(SW.state.v);
      if (!v) return;
      N.dialog({ vid: v.id, kind: 'version', anchor: null, tags: ['finding'], heading: 'Add a finding', anchorText: 'On ' + v.label + '. Shared with the group and listed under Findings; the first line is its title.' });
    } }, '✎ Add a finding'));
    // export and the rest in one ⋯ menu, as in My notes
    var more = SW.el('details', { class: 'menu exp-menu more-menu' });
    more.innerHTML = '<summary class="btn ghost" title="Export, or check again">⋯</summary>';
    var mb = SW.el('div', { class: 'menu-body' });
    SW.$$('button', SW.exportButtons(doc, 'spacewar-findings')).forEach(function (x) { x.classList.add('ghost'); mb.appendChild(x); });
    mb.appendChild(SW.el('button', { class: 'btn ghost', title: 'Read the tapes and compare the witnesses again, and fetch the group’s findings', onclick: function () { run(); } }, '↻ Check again'));
    var right = SW.el('span', { class: 'tb-right', style: 'display:inline-flex;gap:6px' });
    var ub = SW.el('button', { class: 'btn ghost fd-undo', onclick: undoLast }, '↶ Undo');
    ub.hidden = !undo.length; if (undo.length) ub.title = 'Undo: ' + undo[undo.length - 1].label;
    right.appendChild(ub);
    right.appendChild(SW.el('button', { class: 'btn ghost ov-binbtn', title: 'Open the bin: findings you deleted, to restore or delete for good', onclick: function (e) {
      var btn = e.currentTarget, hb = SW.$('.fd-bin', pad);
      if (hb) { hb.remove(); btn.classList.remove('on'); btn.title = 'Open the bin: findings you deleted, to restore or delete for good'; return; }
      hb = SW.el('div', { class: 'fd-bin' }); hb.binFilter = function (n) { return (n.tags || []).some(function (g) { return /^findings?$/i.test(g); }); };
      tb.after(hb); N.showBin(hb, { all: true }); btn.classList.add('on'); btn.title = 'Close the bin';
    } }, '🗑'));
    mb.addEventListener('click', function (e) { if (e.target.closest('button')) more.open = false; });
    more.appendChild(mb);
    right.appendChild(more);
    tb.appendChild(right);
    pad.insertAdjacentHTML('beforeend', '<h2>Findings</h2><p class="prose">What the bench and the group have established about the Spacewar! sources, each with its evidence one click away, coloured by who added it. The witness tapes and punched titles are checked afresh against the tapes each time this page opens.</p><div class="fd-legend"></div>');
    pad.appendChild(tb);
    legend([]);
    var fbar = filterBar(function () { paintBench(); checkNotes(nBox, true); });
    pad.appendChild(fbar);
    var list = SW.el('div', { class: 'fd-bench' });
    function benchCard(f, c, lvl) {
      var li = SW.el('li', { class: 'fd', style: 'border-left-color:' + colourOf('bench') });
      li.innerHTML = '<div class="fd-head"><span class="fd-no mono">' + f.no + '</span> <b>' + SW.esc(f.title) + '</b> <span class="badge">' + SW.esc(f.kind) + '</span>' + chips(c, lvl) + '</div><p>' + SW.esc(f.text) + '</p>';
      evidenceHTML(f, li);
      li.appendChild(mineButton(function () {
        return { title: f.no + '. ' + f.title, subtitle: 'Finding (the bench), ' + f.kind, blocks: [{ type: 'p', text: f.text }, { type: 'p', text: 'Evidence. ' + f.ev.map(function (e) { return e.tape ? e.tape + (e.from ? ' (from frame ' + e.from + ')' : '') : e.cite || (vLabel(e.v) + (e.label ? ', ' + e.label : '')); }).join('; ') + '.' }] };
      }));
      return li;
    }
    function paintBench() {
      list.innerHTML = '';
      grouped(list, FIND.map(function (f, n) {
        var c = catOf(f.title + ' ' + f.text + ' ' + f.kind, f.cat ? ['cat:' + f.cat] : []), lvl = f.level || 'notable';
        return { by: 'bench', cat: c, lvl: lvl, order: n, text: f.no + ' ' + f.title + ' ' + f.text + ' ' + f.kind, vids: f.ev.map(function (e) { return e.v; }).filter(Boolean), card: function () { return benchCard(f, c, lvl); } };
      }), 'None.');
    }
    pad.appendChild(SW.el('h3', {}, 'Established by the bench'));
    pad.appendChild(list);
    paintBench();
    pad.appendChild(SW.el('h3', {}, 'From the group'));
    var nBox = SW.el('div');
    pad.appendChild(nBox);
    pad.appendChild(SW.el('h3', {}, 'Witness tapes, checked now'));
    var wBox = SW.el('div');
    pad.appendChild(wBox);
    pad.appendChild(SW.el('h3', {}, 'Punched titles, read now'));
    var tBox = SW.el('div');
    pad.appendChild(tBox);
    function run() {
      checkTitles(tBox);
      checkNotes(nBox);
      checkWitnesses(wBox);
    }
    run();
  }
  SW.findings = { list: FIND, showMine: function () { SW.setTab('notes'); } };
  SW.on('notes', function () { if (done && SW.state.tab === 'findings') render(); });

  SW.views.findings = { show: function () { if (!done) render(); }, reset: function () { done = false; } };
})(this);
