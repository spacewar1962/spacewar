/*
 * core.js - shared state and helpers for the research bench.
 *
 * A "build" is one version fetched, normalised and assembled: the unit that
 * every view reads from. Builds are cached, so moving between views or
 * comparing versions never reassembles needlessly.
 */
(function (root) {
  'use strict';

  var A = root.PDP1Asm, C = root.PDP1CPU, V = root.SWVersions;
  var SW = root.SW = {};

  SW.BASE_URI = 'https://spacewar1962.github.io/spacewar/research/';
  SW.state = { v: null, tab: 'read', sel: null, b: null };
  SW.views = {};
  // The bench's version: the ?v= on this script's own tag in index.html (the
  // one place it is set), shown beside the title and recorded in exports.
  SW.VERSION = ((document.currentScript && /[?&]v=([^&#]+)/.exec(document.currentScript.src)) || [])[1] || 'dev';
  var verEl = document.getElementById('bench-ver');
  if (verEl) { verEl.textContent = 'v' + SW.VERSION; verEl.title = 'Research bench version ' + SW.VERSION; }

  // ---------- small helpers ----------
  SW.$ = function (sel, el) { return (el || document).querySelector(sel); };
  SW.$$ = function (sel, el) { return Array.prototype.slice.call((el || document).querySelectorAll(sel)); };
  SW.esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  SW.oct = function (n, w) { return n == null ? '' : C.oct(n, w || 6); };
  SW.el = function (tag, attrs, html) {
    var e = document.createElement(tag);
    if (attrs) for (var k in attrs) {
      if (k === 'class') e.className = attrs[k];
      else if (k.slice(0, 2) === 'on') e.addEventListener(k.slice(2), attrs[k]);
      else e.setAttribute(k, attrs[k]);
    }
    if (html != null) e.innerHTML = html;
    return e;
  };
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  SW.fmtDate = function (iso) {
    if (!iso) return '';
    var d = new Date(iso);
    if (isNaN(d)) return iso;
    return d.getDate() + ' ' + MONTHS[d.getMonth()] + ' ' + d.getFullYear();
  };
  SW.today = function () { return new Date().toISOString().slice(0, 10); };
  SW.slug = function (s) { return String(s).toLowerCase().replace(/[^a-z0-9.]+/g, '-').replace(/^-|-$/g, ''); };

  // ---------- storage (always guarded) ----------
  SW.store = {
    get: function (k, d) {
      try { var v = localStorage.getItem('swbench.' + k); return v == null ? d : JSON.parse(v); }
      catch (e) { return d; }
    },
    set: function (k, v) {
      try { localStorage.setItem('swbench.' + k, JSON.stringify(v)); } catch (e) { /* ignore */ }
    }
  };
  SW.me = function () {
    return { initials: SW.store.get('initials', ''), name: SW.store.get('name', '') };
  };

  // ---------- events ----------
  var handlers = {};
  SW.on = function (ev, fn) { (handlers[ev] = handlers[ev] || []).push(fn); };
  SW.emit = function (ev, data) { (handlers[ev] || []).forEach(function (fn) { fn(data); }); };

  // ---------- toast / status ----------
  var toastTimer;
  // act: {label, fn}, a button in the toast (Undo)
  SW.toast = function (msg, ms, act) {
    var t = SW.$('#toast');
    t.textContent = msg;
    t.classList.toggle('act', !!act);
    if (act) {
      var b = SW.el('button', { class: 'btn ghost toast-act' }, SW.esc(act.label));
      b.onclick = function () { t.classList.remove('on'); act.fn(); };
      t.appendChild(b);
    }
    t.classList.add('on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('on'); }, ms || (act ? 6000 : 2600));
  };
  SW.status = function (msg) { SW.$('#status').textContent = msg || ''; };

  // ---------- fetching and building ----------
  var textCache = {};
  SW.fetchText = function (path) {
    if (textCache[path]) return textCache[path];
    var url = V.SRC + path.split('/').map(encodeURIComponent).join('/');
    textCache[path] = fetch(url).then(function (r) {
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
      var asm = v.build ? A.assemble(L.files, V.DIALECTS[dialect].options) : null;
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
  SW.PORTS = [   // [reference, program, machine, where and by whom, date, files held (under sources/)]
    ['SWP-PDP4-SPACEWAR63', 'Spacewar', 'PDP-4', 'University of Michigan', '1963', ''],
    ['SWP-DDP224-SPACEWAR64', 'Spacewar', 'DDP-224', 'University of Michigan', '1964', ''],
    ['SWP-PDP6-SPACEWAR64', 'Spacewar', 'PDP-6', 'Stanford (Steve Russell)', '1964', ''],
    ['SWP-S360-SPACEWAR65', 'Spacewar', 'IBM System/360-65', 'MIT Computation Center (Edson Hendricks)', '1965', ''],
    ['SWP-PDP7-SPACEWAR65', 'Spacewar', 'PDP-7', 'University of Pittsburgh (Russell Randshaw)', '1965', ''],
    ['SWP-CDC3100-SPACEWAR66R', 'Spacewar, reconstructed', 'CDC 3100', 'University of Minnesota (A. W. Kuhfeld); reconstruction by Norbert Landsteiner, 2014', '1966–69', 'reference/minnesota-spacewar-landsteiner-2014.js'],
    ['SWP-PDP8-SPACEWAR71', 'Space War', 'LAB-8 (PDP-8)', 'Evan Suits (DECUS)', '1965–68; listing 1971', 'ports/spacewar-pdp8-labx8-suits-1971.txt'],
    ['SWP-PDP10-SW71', 'Space War (SW; part 1 SW.MAC, part 2 SHIPS.SAI)', 'PDP-10', 'Stanford AI Lab: Steve Russell, 1967; Ralph E. Gorin’s version with R. Taylor', '1971–72', 'ports/spacewar-pdp10-sail-gorin-1971.txt, ports/spacewar-pdp10-sail-gorin-1971-ships.txt'],
    ['SWP-PDP6-WAR44', 'WAR 44', 'PDP-6', 'MIT (Samson’s DECtape)', 'c. 1968', 'ports/spacewar-pdp6-mit-war44-1968.txt'],
    ['SWP-PDP7-DUEL68', 'Duel', 'PDP-7', 'Cambridge Univ. Maths Lab (M. S. Peterson, J. C. Viner; DECUS 7-40)', 'June 1968', ''],
    ['SWP-LINC8-SPCWAR68', 'SPCWAR', 'LINC-8', 'University of Pennsylvania (E. Duffin; DECUS L-39)', '12 Aug 1968', ''],
    ['SWP-NOVA-SPACEWAR68', 'Spacewar', 'Data General NOVA', 'Fall Joint Computer Conference', '1968', ''],
    ['SWP-PLATO-SPACEWAR69', 'Spacewar', 'PLATO / ILLIAC', 'University of Illinois (Richard W. Blomme)', '1969', ''],
    ['SWP-IBM1620-SPACEWAR69', 'Spacewar', 'IBM 1620', 'Jim Burroughs', 'c. 1969', ''],
    ['SWP-PDS1-SPACEWAR70', 'Spacewar', 'Imlac PDS-1', '', '1970', ''],
    ['SWP-GT40-SPCWAR73', 'SPCWAR', 'GT40 (PDP-11)', 'Stanford AI Lab (Botond G. Eross)', '1973', 'ports/spacewar-gt40-pdp11-stanford-eross-1973.txt'],
    ['SWP-GT40-DECUS11-192', 'SPCWAR (DECUS 11-192)', 'GT40 (PDP-11)', 'Larry Bryant and Bill Seiler', '1974', 'ports/spacewar-gt40-pdp11-bryant-seiler-1974.pdf'],
    ['SWP-PDP12-SPCWAR3', 'SPCWAR, version 3', 'LINC-8 / PDP-12', 'Georgia Tech (D. E. Wrege)', '1974', 'ports/spacewar-linc8-pdp12-gtech-wrege-1974.txt'],
    ['SWP-ITS-SPCWAR76', 'SPCWAR (log to version 163)', 'PDP-6/10, ITS', 'MIT AI Lab', '1976', 'ports/spacewar-pdp6-10-mit-its-spcwar.txt'],
    ['SWP-ITS-NEWWAR76', 'NEWWAR (log to version 163)', 'PDP-6/10, ITS', 'MIT AI Lab', '1976', 'ports/spacewar-pdp6-10-mit-its-newwar.txt'],
    ['SWP-ITS-TVWAR', 'TVWAR', 'Knight TV, ITS', 'MIT AI Lab', '', 'ports/spacewar-knighttv-mit-its-tvwar.txt'],
    ['SWP-GT40-MIT76', 'Spacewar (object tape)', 'GT40 (PDP-11)', 'MIT AI Lab (Richard C. Waters, Meyer A. Billmers)', 'c. 1976', 'ports/spacewar-gt40-pdp11-1976.pt']
  ];
  // When the text we hold was made, where it is not the version's own date.
  SW.MADE = { '1': 'reconstructed by Norbert Landsteiner, April 2016 (revised 2021); not an authentic program',
    '2b': 'reconstructed from the disassembled binary by Norbert Landsteiner, 2014',
    '2b-pre': 'a transcription (masswerk); the build supplies the June 1963 macro tape and the 13 March 1962 star table, not held for this version',
    '3.1': 'a text from bitsavers (SteveRussell_box1/_text), as compiled by masswerk',
    '3.1t': 'read by the bench from Russell’s source tapes of 29 September 1962',
    '4.1t': 'read by the bench from the dfw source tape',
    '4.3m': 'reassembled by Norbert Landsteiner, modified 2015', '4.4m': 'reassembled by Norbert Landsteiner', '4.4f': 'reassembled by Norbert Landsteiner (variant f)',
    '4.1d': 'reconstructed by Peter Samson, June 2005', '4.1f': 'reconstructed by Peter Samson, 2005 to 2008', '2015': 'written by Norbert Landsteiner, 2015' };
  // A source file's SWHID (swh:1:cnt:, its git blob hash; js/swhid.js); with the
  // repository as origin, its path, and lines where they are lines of the file.
  SW.SWHID_ORIGIN = 'https://github.com/spacewar1962/spacewar';
  SW.swhidOf = function (path) { var h = SW.SWHID && SW.SWHID[path]; return h ? 'swh:1:cnt:' + h[0] : ''; };
  // a link that works now: GitHub, at the last commit that changed the file, to the lines
  SW.permalinkOf = function (path, n0, n1) {
    var h = SW.SWHID && SW.SWHID[path]; if (!h) return '';
    return SW.SWHID_ORIGIN + '/blob/' + h[1] + '/sources/' + path.split('/').map(encodeURIComponent).join('/') + (n0 != null ? '#L' + n0 + (n1 && n1 !== n0 ? '-L' + n1 : '') : '');
  };
  SW.swhidURL = function (id) { return 'https://archive.softwareheritage.org/' + id; };
  SW.swhidCite = function (path, n0, n1) {
    var id = SW.swhidOf(path); if (!id) return '';
    return id + ';origin=' + SW.SWHID_ORIGIN + ';path=/sources/' + path + (n0 != null ? ';lines=' + n0 + (n1 && n1 !== n0 ? '-' + n1 : '') : '');
  };
  SW.filesOf = function (v) { var seen = {}, out = []; (v.build || []).forEach(function (b) { var f = b.src || b.tape; if (f && !seen[f]) { seen[f] = 1; out.push(f); } }); return out; };
  SW.swhidList = function (files) {
    return files.map(function (f) { var id = SW.swhidOf(f); return '<div class="swhid-row"><a class="mono" href="' + SW.esc(SW.permalinkOf(f)) + '" target="_blank" rel="noopener" title="The file on GitHub, at its last change">' + SW.esc(f.split('/').pop()) + '</a> ' + (id ? '<button class="swhid mono" title="Copy ' + SW.esc(id) + '" data-copy="' + SW.esc(id) + '">' + SW.esc(id.slice(0, 17)) + '…</button> <a class="swhid-go" href="' + SW.esc(SW.swhidURL(id)) + '" target="_blank" rel="noopener" title="Open in the Software Heritage archive (once the repository is archived there)">↗</a>' : '<span class="faint">no SWHID (not in the repository)</span>') + '</div>'; }).join('');
  };
  document.addEventListener('click', function (e) {
    var c = e.target.closest('[data-copy]'); if (!c) return;
    var t = c.dataset.copy;
    (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(function () { SW.toast('Copied ' + t); }, function () { window.prompt('Copy:', t); });
  });
  SW.refOf = function (vid, p, n0, n1, nparts) {
    var r = SW.REF[vid] || ('SW' + vid);
    if (p == null) return r;
    var tape = nparts > 1 ? (p + 1) + (n0 != null ? '.' : '') : '';
    return r + ', ' + tape + (n0 != null ? n0 + (n1 && n1 !== n0 ? '–' + n1 : '') : '');
  };
  // Help ▸ Referencing and versions: the convention, and every source's reference
  SW.refHelp = function () {
    var V = root.SWVersions, vs = V.VERSIONS.filter(function (v) { return v.build; }).sort(function (a, b) { return a.sort - b.sort; });
    var d = SW.el('dialog', { class: 'tray-big refhelp' });
    d.innerHTML = '<div class="tray-bighead"><b>Referencing and versions</b><button class="icon-btn" data-x title="Close (Esc)">✕</button></div>' +
      '<p>The bench names each source text in one form, shown in small type beside its name across the bench, in citations and in exports:</p>' +
      '<p class="refhelp-ex mono">[REF: SW3.1T, 2.141–146]</p>' +
      '<p>SW, then the version (<b>3.1</b>), then a letter for the witness, the particular surviving text of that version (<b>T</b>); then the tape (<b>2</b>, as the assembler read them in) and the lines (<b>141–146</b>).</p>' +
      '<table class="ov-sub"><thead><tr><th>Letter</th><th>The witness</th></tr></thead><tbody>' +
      [['T', 'machine-read from the punched source tape'], ['L', 'a transcription: typed text of a listing or a tape'], ['M', 'a modern reassembly or edited source'], ['R', 'a reconstruction'], ['B', 'an object tape (binary), cited by address only']].map(function (r) { return '<tr><td class="mono">' + r[0] + '</td><td>' + r[1] + '</td></tr>'; }).join('') + '</tbody></table>' +
      '<p>Shorter forms: the version and witness alone, <span class="mono">[REF: SW3.1T]</span>; a whole tape, <span class="mono">[REF: SW3.1T, 2]</span>. The tape is left out when a text has only one: <span class="mono">[REF: SW4.3M, 141]</span>. By core address, <span class="mono">[REF: SW3.1L, @0402–0407]</span>: an address holds across texts of a version that assemble to the same words, and is the only way to cite an object tape. Two texts of one version with the same letter take a lower-case qualifier: <span class="mono">SW4.4Mf</span>. A newly found text takes its version and the next letter or qualifier; a new version, its own number.</p>' +
      '<p>A port, a program for another machine, is not a text of any PDP-1 version and has a namespace of its own: <b>SWP</b>, the machine, the program, and its own version number, or its year when it has none: <span class="mono">[REF: SWP-PDP6-WAR44, 76]</span>. Several files of one program are its parts: <span class="mono">[REF: SWP-PDP10-SW71, 2.14]</span> is line 14 of SHIPS.SAI. A port has no witness letter unless it survives in more than one text.</p>' +
      '<p>A SWHID opens through Software Heritage’s resolver, <span class="mono">archive.softwareheritage.org/swh:1:cnt:…</span>, once the repository is archived there; the part after the first semicolon (origin, path, lines) qualifies it and is not a web address. For a link that works meanwhile, Copy citation also gives the file on GitHub at its last change, to the lines.</p>' +
      '<p>For the exact bytes of a file, cite its <a href="https://www.swhid.org/" target="_blank" rel="noopener">SWHID</a> (<a href="https://www.softwareheritage.org/software-hash-identifier-swhid/" target="_blank" rel="noopener">Software Heritage</a>, <a href="https://www.iso.org/standard/89985.html" target="_blank" rel="noopener">ISO/IEC 18670:2025</a>) alongside.</p>' +
      '<h4>Source code versions</h4><p class="hint">The version’s date is the program’s; the text we hold may be later: a transcription, a reassembly, a reconstruction. SWHIDs copy on a click.</p><table class="ov-sub refhelp-t"><thead><tr><th>No.</th><th>Reference</th><th>Version</th><th>Version dated</th><th>This text</th><th>SWHID of each file</th></tr></thead><tbody>' +
      vs.map(function (v, n) { return '<tr><td class="num">' + (n + 1) + '</td><td class="mono">' + SW.esc(SW.refOf(v.id)) + '</td><td>' + SW.esc(v.label) + '</td><td>' + SW.esc(v.date || '') + '</td><td>' + SW.esc(SW.MADE[v.id] || (v.medium || '')) + '</td><td>' + SW.swhidList(SW.filesOf(v)) + '</td></tr>'; }).join('') + '</tbody></table>' +
      '<h4>Ports</h4><table class="ov-sub refhelp-t"><thead><tr><th>No.</th><th>Reference</th><th>Program</th><th>Machine</th><th>Where and by whom</th><th>Date</th><th>Held (SWHID of each file)</th></tr></thead><tbody>' +
      SW.PORTS.map(function (r, n) { return '<tr><td class="num">' + (n + 1) + '</td><td class="mono">' + SW.esc(r[0]) + '</td><td>' + SW.esc(r[1]) + '</td><td>' + SW.esc(r[2]) + '</td><td>' + SW.esc(r[3]) + '</td><td>' + SW.esc(r[4]) + '</td><td>' + (r[5] ? SW.swhidList(r[5].split(/,\s*/)) : '<span class="faint">none held</span>') + '</td></tr>'; }).join('') + '</tbody></table>' +
      '<p class="hint">Named whether or not a text is held, so that a port can be cited as a program. A port takes a witness letter only when it survives in more than one text, or when the text held is not its own (SWP-CDC3100-SPACEWAR66R, a reconstruction). BBN’s copy of the PDP-1 program is a copy, not a port: found, it would be a witness of a PDP-1 version.</p>';
    document.body.appendChild(d);
    d.addEventListener('click', function (e) { if (e.target === d || e.target.closest('[data-x]')) { d.close(); d.remove(); } });
    d.addEventListener('close', function () { d.remove(); });
    d.showModal();
  };
  SW.refText = function (vid, p, n0, n1, nparts) { return '[REF: ' + SW.refOf(vid, p, n0, n1, nparts) + ']'; };
  SW.refTag = function (vid, p, n0, n1, nparts) { return '<span class="swref" title="The bench’s reference to this source (Help ▸ Referencing and versions)">' + SW.esc(SW.refText(vid, p, n0, n1, nparts)) + '</span>'; };
  SW.cite = function (b, p, n0, n1) {
    var part = b.parts[p];
    var range = n1 && n1 !== n0 ? 'll. ' + n0 + '–' + n1 : 'l. ' + n0;
    return b.v.label + ' (' + b.v.date + '), ' + part.src + ', ' + range + ' ' + SW.refText(b.v.id, p, n0, n1, b.parts.length);
  };
  SW.permalink = function (params) {
    var q = [];
    for (var k in params) if (params[k] != null && params[k] !== '') q.push(k + '=' + encodeURIComponent(params[k]));
    return SW.BASE_URI + (q.length ? '?' + q.join('&') : '');
  };
  // A file in sources/, opened in a new tab on GitHub (tape images are binary,
  // so the browser cannot show them itself; GitHub shows size, history, raw).
  SW.REPO = 'https://github.com/spacewar1962/spacewar/blob/main/sources/';
  SW.sourceURL = function (path) { return SW.REPO + path.split('/').map(encodeURIComponent).join('/'); };
  SW.sourceLink = function (path, text) {
    return '<a href="' + SW.esc(SW.sourceURL(path)) + '" target="_blank" rel="noopener" title="Open ' + SW.esc(path) + ' in a new tab">' + SW.esc(text || path) + ' ↗</a>';
  };
  SW.versionURI = function (id) { return SW.BASE_URI + '?v=' + encodeURIComponent(id); };

  // ---------- routing ----------
  SW.readQuery = function () {
    var q = {};
    location.search.replace(/^\?/, '').split('&').forEach(function (kv) {
      if (!kv) return;
      var i = kv.indexOf('=');
      q[decodeURIComponent(i < 0 ? kv : kv.slice(0, i))] = i < 0 ? '' : decodeURIComponent(kv.slice(i + 1));
    });
    return q;
  };
  SW.writeQuery = function (extra) {
    var s = SW.state, q = { v: s.v, tab: s.tab !== 'read' ? s.tab : null };
    if (s.b && (s.tab === 'compare')) q.b = s.b;
    if (s.sel && s.tab === 'read') q.l = s.sel.p + ':' + s.sel.n0 + (s.sel.n1 !== s.sel.n0 ? '-' + s.sel.n1 : '');
    for (var k in extra || {}) q[k] = extra[k];
    var parts = [];
    for (var k2 in q) if (q[k2] != null && q[k2] !== '') parts.push(k2 + '=' + encodeURIComponent(q[k2]));
    try { history.replaceState(null, '', '?' + parts.join('&')); } catch (e) { /* file: urls */ }
  };

  // ---------- drawer and popover ----------
  // The side panel. Closing it minimises it to a tab at the foot of the screen,
  // which brings it back with its contents as they were.
  SW.drawer = function (title, html) {
    document.body.classList.remove('drawer-wide');
    delete SW.$('#drawer-body').dataset.notes;
    delete SW.$('#drawer-body').dataset.panel;
    SW.$('#drawer-title').textContent = title;
    var body = SW.$('#drawer-body');
    if (typeof html === 'string') body.innerHTML = html; else { body.innerHTML = ''; body.appendChild(html); }
    document.body.classList.add('drawer-open');
    var dk = SW.$('#drawer-dock');
    if (dk) dk.classList.remove('on');
    return body;
  };
  SW.closeDrawer = function () {
    var wide = document.body.classList.contains('drawer-wide');
    document.body.classList.remove('drawer-open', 'drawer-wide');
    // An annotations panel is reopened from the Annotations tab (notes.js), which is always there.
    if (SW.$('#drawer-title').textContent === 'Annotations') { var d0 = SW.$('#drawer-dock'); if (d0) d0.classList.remove('on'); return; }
    var dock = SW.$('#drawer-dock');
    if (!dock) {
      dock = SW.el('button', { id: 'drawer-dock', class: 'drawer-dock', title: 'Show the side panel again' });
      document.body.appendChild(dock);
      dock.onclick = function () {
        document.body.classList.add('drawer-open');
        if (dock.dataset.wide === '1') document.body.classList.add('drawer-wide');
        dock.classList.remove('on');
      };
    }
    dock.dataset.wide = wide ? '1' : '';
    dock.textContent = '▴ ' + (SW.$('#drawer-title').textContent || 'Side panel');
    dock.classList.add('on');
  };

  var popEl = null;
  SW.pop = function (x, y, html) {
    SW.unpop();
    popEl = SW.el('div', { class: 'pop' }, html);
    document.body.appendChild(popEl);
    var r = popEl.getBoundingClientRect();
    var left = Math.min(x, window.innerWidth - r.width - 10), top = y + 14;
    if (top + r.height > window.innerHeight - 10) top = Math.max(10, y - r.height - 10);
    popEl.style.left = Math.max(10, left) + 'px';
    popEl.style.top = top + 'px';
    return popEl;
  };
  SW.unpop = function () { if (popEl) { popEl.remove(); popEl = null; } };
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') SW.unpop(); });
  document.addEventListener('mousedown', function (e) { if (popEl && !popEl.contains(e.target)) SW.unpop(); });
  // Toolbar drop-down menus (<details class="menu">) close on a click elsewhere.
  document.addEventListener('mousedown', function (e) {
    SW.$$('details.menu[open]').forEach(function (d) { if (!d.contains(e.target)) d.open = false; });
  });

  // A click on a modal's backdrop closes it. Both ends of the click must fall
  // outside the box, so a text selection dragged out of a field does not.
  function outside(d, e) {
    var r = d.getBoundingClientRect();
    return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
  }
  var downOnBackdrop = null;
  document.addEventListener('mousedown', function (e) {
    downOnBackdrop = e.target.tagName === 'DIALOG' && e.target.open && outside(e.target, e) ? e.target : null;
  });
  // A dialog marked data-keep (the note) stays open while it holds text: the
  // click shakes it and shows its .keep-hint instead.
  document.addEventListener('click', function (e) {
    var d = e.target;
    if (d === downOnBackdrop && d.open && outside(d, e)) {
      var held = d.hasAttribute('data-keep') &&
        SW.$$('textarea, input:not([type]), input[type="text"]', d).some(function (x) { return x.value.trim(); });
      if (!held) d.close();
      else {
        d.classList.remove('nudge'); void d.offsetWidth; d.classList.add('nudge');
        var k = SW.$('.keep-hint', d); if (k) k.hidden = false;
        var f = SW.$('textarea', d); if (f) f.focus();
      }
    }
    downOnBackdrop = null;
  });

  // Instruction glosses (the project's PDP-1 instruction reference).
  SW.glosses = null;
  SW.loadGlosses = function () {
    if (SW.glossP) return SW.glossP;
    SW.glossP = fetch('../assets/pdp1-instructions.json').then(function (r) { return r.json(); })
      .then(function (j) { SW.glosses = j.entries || {}; return SW.glosses; })
      .catch(function () { SW.glosses = {}; return SW.glosses; });
    return SW.glossP;
  };

  // A table (array of rows) sorted by clicking headers.
  SW.table = function (head, rows, opts) {
    opts = opts || {};
    var t = SW.el('table', { class: 'data' });
    var sortCol = -1, asc = true;
    function render() {
      var h = '<thead><tr>' + head.map(function (c, i) {
        return '<th data-i="' + i + '">' + SW.esc(c) + (i === sortCol ? (asc ? ' ▲' : ' ▼') : '') + '</th>';
      }).join('') + '</tr></thead><tbody>';
      h += rows.map(function (r, ri) {
        return '<tr data-r="' + ri + '">' + r.map(function (c, i) {
          var cls = (opts.cls && opts.cls[i]) || '';
          var v = c && typeof c === 'object' && 'html' in c ? c.html : SW.esc(c);
          return '<td class="' + cls + '">' + v + '</td>';
        }).join('') + '</tr>';
      }).join('') + '</tbody>';
      t.innerHTML = h;
    }
    t.addEventListener('click', function (e) {
      var th = e.target.closest('th');
      if (th) {
        var i = +th.dataset.i;
        asc = sortCol === i ? !asc : true;
        sortCol = i;
        rows.sort(function (a, b) {
          var x = a[i], y = b[i];
          if (x && typeof x === 'object') x = x.sort != null ? x.sort : x.html;
          if (y && typeof y === 'object') y = y.sort != null ? y.sort : y.html;
          if (typeof x === 'number' && typeof y === 'number') return asc ? x - y : y - x;
          return asc ? String(x).localeCompare(String(y)) : String(y).localeCompare(String(x));
        });
        render();
        return;
      }
      var tr = e.target.closest('tr[data-r]');
      if (tr && opts.onRow) opts.onRow(rows[+tr.dataset.r], e);
    });
    render();
    t.getRows = function () { return rows; };
    return t;
  };

  // Plain text of a table for export.
  SW.tableBlock = function (caption, head, rows) {
    return { type: 'table', caption: caption, head: head, rows: rows.map(function (r) {
      return r.map(function (c) {
        if (c && typeof c === 'object') return c.text != null ? String(c.text) : String(c.html).replace(/<[^>]+>/g, '');
        return String(c == null ? '' : c);
      });
    }) };
  };

  // ---------- code text: font and size, for reading ----------
  var WEBFONTS = { 'JetBrains Mono': 1, 'IBM Plex Mono': 1, 'Source Code Pro': 1, 'Fira Code': 1, 'Courier Prime': 1 };
  SW.codeFont = function () { return SW.store.get('codeFont', 'system'); };
  SW.codeSize = function () { var n = +SW.store.get('codeSize', 13); return n >= 9 && n <= 24 ? n : 13; };
  // A faint ground on annotated lines, unless turned off in Settings.
  SW.applyNoteShade = function () {
    document.documentElement.classList.toggle('no-note-shade', !SW.store.get('noteShade', true));
  };
  SW.applyCodeText = function () {
    var f = SW.codeFont(), de = document.documentElement;
    if (WEBFONTS[f] && !document.getElementById('font-' + SW.slug(f))) {
      var l = document.createElement('link');
      l.rel = 'stylesheet'; l.id = 'font-' + SW.slug(f);
      l.href = 'https://fonts.googleapis.com/css2?family=' + encodeURIComponent(f).replace(/%20/g, '+') + ':wght@400;700&display=swap';
      document.head.appendChild(l);
    }
    de.style.setProperty('--code-font', f === 'system' ? 'var(--mono)' : '"' + f + '", var(--mono)');
    de.style.setProperty('--code-size', SW.codeSize() + 'px');
    SW.emit('codetext');
  };
  SW.setCodeSize = function (n) {
    n = Math.max(9, Math.min(24, Math.round(n)));
    SW.store.set('codeSize', n);
    SW.applyCodeText();
    SW.toast('Code text ' + n + ' px');
  };

  // ---------- hands: the people whose initials or names are written into the text ----------
  // Colours read on both the dark plate and white.
  SW.HANDS = [
    { k: 'prs', who: 'Peter R. Samson', re: /\bprs\b/i, colour: '#2a9d6f' },
    { k: 'adams', who: 'Adams Associates', re: /\badams associates\b/i, colour: '#c0622d' },
    { k: 'ddp', who: 'D. D. “Monty” Preonas', re: /\bddp\b/i, colour: '#d99a1e' },
    { k: 'dfw', who: '“dfw” (not yet identified)', re: /\bdfw\b/i, colour: '#3f8fd0' },
    { k: 'jcm', who: 'Joe C. Morris', re: /\bjcm\b/i, colour: '#c05a93' },
    { k: 'dje', who: 'Dan Edwards', re: /\bdje\b/i, colour: '#8f7a1a' },
    { k: 'jmg', who: 'J. Martin Graetz', re: /\bjmg\b/i, colour: '#7d5a45' },
    { k: 'nl', who: 'Norbert Landsteiner (2014–21)', re: /\bn\.\s?l\.|\bnl\b|\blandsteiner\b/i, colour: '#8a7ae0' }
  ];
  SW.handOf = function (k) { return SW.HANDS.filter(function (h) { return h.k === k; })[0] || null; };
  // The hands named in a piece of text, in the order of SW.HANDS.
  SW.handsIn = function (text) {
    return SW.HANDS.filter(function (h) { return h.re.test(text || ''); }).map(function (h) { return h.k; });
  };

  // ---------- colour schemes for the genealogy figures ----------
  SW.PALETTES = [
    ['phosphor', 'Theme colours (default)'], ['okabe', 'Colour-blind safe (Okabe–Ito)'], ['tol', 'Colour-blind safe (Tol)'],
    ['muted', 'Muted (print)'], ['bold', 'Bold, high contrast'], ['warm', 'Warm'], ['grey', 'Greyscale']
  ];
  SW.palette = function () { return SW.store.get('gen.palette', 'phosphor'); };
  SW.applyPalette = function (k) {
    if (k) SW.store.set('gen.palette', k);
    k = SW.palette();
    if (k === 'phosphor') document.documentElement.removeAttribute('data-gpal');
    else document.documentElement.setAttribute('data-gpal', k);
  };
  // A select for choosing a scheme; onChange re-renders the caller's figure.
  SW.paletteSelect = function (onChange) {
    var l = SW.el('label', { class: 'check', title: 'Colours for retained, moved, edited, added and removed, on screen and in exported figures' }, 'Colours ');
    l.classList.add('pal-pick');
    var sel = SW.el('select', {}, SW.PALETTES.map(function (p) { return '<option value="' + p[0] + '"' + (p[0] === SW.palette() ? ' selected' : '') + '>' + SW.esc(p[1]) + '</option>'; }).join(''));
    sel.onchange = function (e) { e.stopPropagation(); SW.applyPalette(sel.value); if (onChange) onChange(); };
    l.appendChild(sel);
    return l;
  };

  // ---------- colour themes ----------
  // Each is a set of CSS custom properties (css/research.css, :root[data-theme]).
  // 'dark' says whether its ground is dark, for figures that draw their own.
  SW.THEMES = [
    { id: 'phosphor', label: 'Phosphor', dark: true, note: 'blue-white on near black, after the PDP-1’s display (the default)' },
    { id: 'green', label: 'Terminal, green', dark: true, note: 'green phosphor on black' },
    { id: 'amber', label: 'Terminal, amber', dark: true, note: 'amber phosphor on black' },
    { id: 'contrast', label: 'High contrast', dark: true, note: 'white and bright colours on black' },
    { id: 'paper', label: 'Listing paper', dark: false, note: 'dark ink on the cream of a printed listing' },
    { id: 'white', label: 'Paper', dark: false, note: 'black on white' },
    { id: 'sepia', label: 'Sepia', dark: false, note: 'brown ink on warm paper, for long reading' }
  ];
  SW.themeInfo = function (id) {
    id = id || document.documentElement.getAttribute('data-theme') || 'phosphor';
    return SW.THEMES.filter(function (t) { return t.id === id; })[0] || SW.THEMES[0];
  };
  SW.theme = function () { return SW.themeInfo().id; };
  // A custom property as the current theme (or a given one) sets it.
  SW.cssVar = function (name, theme) { return SW.resolveVars('var(' + name + ')', theme); };

  // ---------- figures: on screen in the theme's colours; in export, the chosen background ----------
  // 'theme' exports in the colours of the theme in use, on its own figure plate.
  SW.FIGBG = { white: '#ffffff', paper: '#f4f1e8', black: '#04060b', transparent: null, theme: 'theme' };
  SW.figBg = function () { var b = SW.store.get('figbg', 'white'); return b in SW.FIGBG ? b : 'white'; };
  // The theme whose colours an export uses, and the colour laid under it.
  var FIGBG_THEME = { white: 'white', paper: 'paper', black: 'phosphor', transparent: 'white' };
  SW.figTheme = function () { var k = SW.figBg(); return k === 'theme' ? SW.theme() : FIGBG_THEME[k]; };
  SW.figBgColour = function () { var k = SW.figBg(); return k === 'theme' ? SW.cssVar('--plate') : SW.FIGBG[k]; };

  // Resolve CSS custom properties in an SVG against a given theme, so the
  // figure stands alone. The theme attribute is switched and restored
  // synchronously, which reads the other palette without a repaint.
  SW.resolveVars = function (svg, theme) {
    var de = document.documentElement, was = de.getAttribute('data-theme');
    if (theme) de.setAttribute('data-theme', theme);
    var cs = getComputedStyle(de), cache = {};
    function val(name, fb) {
      if (!(name in cache)) cache[name] = cs.getPropertyValue(name).trim();
      return cache[name] || (fb || '#888').trim();
    }
    var out = svg.replace(/var\((--[\w-]+)\s*(?:,\s*([^)]+))?\)/g, function (m, name, fb) { return val(name, fb); });
    if (theme) { if (was == null) de.removeAttribute('data-theme'); else de.setAttribute('data-theme', was); }
    return out;
  };
  // Figures on screen take the colours of the theme in use, on its figure plate.
  SW.lightTheme = function () { return !SW.themeInfo().dark; };
  // A figure carried in an annotation's text: the SVG gzipped and base64'd on
  // one closing line, <!-- sw:fig:gz ... -->. Shown as an <img>, so markup
  // from someone else's finding is never run.
  SW.figpack = {
    RE: /\n*<!-- sw:fig:gz ([A-Za-z0-9+\/=]+) -->\s*$/,
    pack: function (svg) {
      var bytes = new TextEncoder().encode(svg);
      if (!root.CompressionStream) return Promise.resolve('');
      var cs = new Blob([bytes]).stream().pipeThrough(new CompressionStream('gzip'));
      return new Response(cs).arrayBuffer().then(function (buf) {
        var b = new Uint8Array(buf), bin = '';
        for (var i = 0; i < b.length; i += 0x8000) bin += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000));
        return '\n\n<!-- sw:fig:gz ' + btoa(bin) + ' -->';
      });
    },
    split: function (text) { var m = SW.figpack.RE.exec(String(text || '')); return m ? { text: String(text).slice(0, m.index), b64: m[1] } : { text: String(text || ''), b64: null }; },
    unpack: function (b64) {
      if (!root.DecompressionStream) return Promise.reject(new Error('This browser cannot open the figure.'));
      var bin = atob(b64), b = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) b[i] = bin.charCodeAt(i);
      return new Response(new Blob([b]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
    },
    img: function (svg, cls) { return '<img class="' + (cls || '') + '" alt="Figure" src="data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg) + '">'; },
    big: function (svg, title) {
      var d = SW.el('dialog', { class: 'tray-big' });
      d.innerHTML = '<div class="tray-bighead"><b>' + SW.esc(title || 'Figure') + '</b><button class="icon-btn" data-x title="Close (Esc)">✕</button></div><div class="tray-fig">' + SW.figpack.img(svg, 'fig-full') + '</div>';
      document.body.appendChild(d);
      d.addEventListener('click', function (e) { if (e.target === d || e.target.closest('[data-x]')) { d.close(); d.remove(); } });
      d.addEventListener('close', function () { d.remove(); });
      d.showModal();
    }
  };
  SW.displaySVG = function (svg) { return SW.resolveVars(svg.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, '')); };
  // Palettes for figures that draw their own ground (sky, ships).
  SW.PLATE = { bg: '#02040a', ink: '#e6f4ff', ink2: '#8fc3d6', dim: '#7fa6c4', accent: '#ffce7a', dark: true };
  SW.exportPalette = function () {
    var k = SW.figBg();
    if (k === 'theme') {
      var t = SW.themeInfo();
      return { bg: SW.cssVar('--plate'), dark: t.dark, ink: SW.cssVar('--g-text'), ink2: SW.cssVar('--beam'), dim: SW.cssVar('--g-muted'), accent: SW.cssVar('--amber') };
    }
    var dark = k === 'black';
    return { bg: SW.FIGBG[k], dark: dark, ink: dark ? '#e6f4ff' : '#1b1f23', ink2: dark ? '#8fc3d6' : '#0f6f86',
             dim: dark ? '#7fa6c4' : '#56606a', accent: dark ? '#ffce7a' : '#9a5b00' };
  };
  // An SVG for export: coloured for the chosen background, with that background laid under it.
  SW.exportSVG = function (svg) {
    var bg = SW.figBgColour();
    // XML 1.0 forbids most control characters; the sources carry form feeds.
    svg = svg.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, '');
    svg = SW.resolveVars(svg, SW.figTheme());
    if (bg) svg = svg.replace(/(<svg\b[^>]*>)/, '$1<rect x="0" y="0" width="100%" height="100%" fill="' + bg + '"/>');
    return svg;
  };
  // SVG and PNG buttons for a figure. getSvg(palette) returns the markup.
  SW.figureButtons = function (getSvg, name) {
    var w = SW.el('span');
    w.appendChild(SW.el('button', { class: 'btn', title: 'Save as SVG (background: ' + SW.figBg() + '; change under ⚙)', onclick: function () {
      root.SWExport.download(name + '.svg', SW.exportSVG(getSvg(SW.exportPalette())), 'image/svg+xml');
    } }, '▣ SVG'));
    w.appendChild(document.createTextNode(' '));
    w.appendChild(SW.el('button', { class: 'btn', title: 'Save as PNG at three times screen size (background: ' + SW.figBg() + '; change under ⚙)', onclick: function () {
      SW.toast('Rendering PNG…');
      SW.figures.svgToPNG(SW.exportSVG(getSvg(SW.exportPalette())), 3, SW.figBgColour()).then(function (r) {
        root.SWExport.download(name + '.png', r.png, 'image/png');
      }, function () { SW.toast('The PNG could not be made from this figure; try SVG, or zoom out first.', 6000); });
    } }, '▣ PNG'));
    w.appendChild(document.createTextNode(' '));
    w.appendChild(SW.el('button', { class: 'btn ghost', title: 'Put this figure in My notes (private), to gather with others for a chapter', onclick: function () {
      if (SW.tray) SW.tray.addFigure(getSvg(SW.exportPalette()), name);
    } }, '＋ My notes'));
    return w;
  };

  // Export a document model as .docx or .md.
  SW.exportDoc = function (doc, base, fmt) {
    var E = root.SWExport;
    if (!E) { SW.toast('Export library not loaded'); return; }
    var name = SW.slug(base || doc.title || 'spacewar');
    if (fmt === 'md') {
      E.download(name + '.md', E.markdown(doc), 'text/markdown');
      (E.markdownAssets ? E.markdownAssets(doc) : []).forEach(function (a) {
        E.download(name + '-' + a.name, a.data, 'image/png');
      });
    } else {
      E.download(name + '.docx', E.docx(doc),
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    }
    SW.toast('Exported ' + name + (fmt === 'md' ? '.md' : '.docx'));
  };
  SW.exportButtons = function (makeDoc, base) {
    var wrap = SW.el('span');
    wrap.appendChild(SW.el('button', { class: 'btn', title: 'Export to Word', onclick: function () {
      Promise.resolve(makeDoc()).then(function (d) { SW.exportDoc(d, typeof base === 'function' ? base() : base, 'docx'); });
    } }, '⤓ Word'));
    wrap.appendChild(document.createTextNode(' '));
    wrap.appendChild(SW.el('button', { class: 'btn', title: 'Export to Markdown', onclick: function () {
      Promise.resolve(makeDoc()).then(function (d) { SW.exportDoc(d, typeof base === 'function' ? base() : base, 'md'); });
    } }, '⤓ Markdown'));
    wrap.appendChild(document.createTextNode(' '));
    wrap.appendChild(SW.el('button', { class: 'btn ghost', title: 'Put this (as it would export) in My notes (private), to gather with others for a chapter', onclick: function () {
      Promise.resolve(makeDoc()).then(function (d) { if (SW.tray) SW.tray.addDoc(d); });
    } }, '＋ My notes'));
    return wrap;
  };

  SW.docMeta = function (b) {
    return [
      ['Version', b.v.label], ['Date', b.v.date], ['Authors', b.v.authors],
      ['Sources', b.parts.map(function (p) { return p.src + (p.role !== 'program' ? ' (' + p.role + ')' : ''); }).join('; ')],
      ['Assembler', V.DIALECTS[b.dialect].label],
      ['Generated', SW.fmtDate(SW.today()) + ', Spacewar! research bench v' + SW.VERSION]
    ];
  };
})(this);
