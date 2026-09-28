/*
 * tray.js - My notes (once "the tray"): figures, code excerpts, tables, findings
 * and your own paragraphs gathered from anywhere in the bench, put in order,
 * captioned, and exported together as one Word or Markdown file with numbered
 * figures. Private: kept in this browser. Shown in its own tab, My notes.
 * Each note carries the version open when it was added, its author's
 * initials, a chapter and tags; Share sends it to the group's Findings as an
 * annotation tagged "finding", signed with those initials.
 */
(function (root) {
  'use strict';
  var SW = root.SW;
  var KEY = 'swbench.tray';
  var T = SW.tray = {};

  // Each note has a number given when it is made and never reused, with the
  // initials of whoever's notes these are (DMB-N12), so numbers from different
  // people stay distinct once shared. t.seq is the last given; notes from before
  // numbering get theirs once, in order.
  function refFor(n) { return SW.me().initials + '-N' + n; }
  function load() {
    var t; try { t = JSON.parse(localStorage.getItem(KEY) || '{"title":"","items":[]}'); } catch (e) { t = { title: '', items: [] }; }
    var all = (t.items || []).concat(t.bin || []), need = all.filter(function (it) { return !it.ref; });
    if (need.length && SW.me().initials) {   // numbered once initials are set
      need.sort(function (a, b) { return String(a.added) < String(b.added) ? -1 : 1; });
      t.seq = Math.max(t.seq || 0, all.reduce(function (m, it) { var mm = /N(\d+)$/.exec(String(it.ref || '')); return Math.max(m, mm ? +mm[1] : 0); }, 0));
      need.forEach(function (it) { it.ref = refFor(++t.seq); });
      try { localStorage.setItem(KEY, JSON.stringify(t)); } catch (e) {}
    }
    return t;
  }
  function save(t, quiet) {
    try { localStorage.setItem(KEY, JSON.stringify(t)); if (!quiet) scheduleSync(); return true; }
    catch (e) { SW.toast('My notes are full (this browser’s storage). Export them, then remove some figures.', 6000); return false; }
  }

  // ---------- kept on Hypothesis too ----------
  // The copy here is the working copy; each note is also kept as a private
  // annotation (N.mynotes), saved a few seconds after a change, and fetched once
  // a session, which rebuilds My notes in a new or cleared browser.
  var sync = { state: 'off', msg: '', at: null }, syncT = null, pulled = false, busy = false;
  function strip(it) { var o = Object.assign({}, it); delete o.hid; delete o.shash; delete o.syncErr; return o; }
  function hashOf(it) { var js = JSON.stringify(strip(it)), h = 5381; for (var i = 0; i < js.length; i++) h = ((h * 33) ^ js.charCodeAt(i)) >>> 0; return h.toString(36) + ':' + js.length; }
  function setSync(state, msg) { sync.state = state; sync.msg = msg || ''; if (state === 'ok') sync.at = new Date(); var el = host && SW.$('.tray-sync', host); if (el) el.outerHTML = syncHTML(); }
  function syncHTML() {
    var t = { off: 'In this browser only. Add a Hypothesis token (⚙) to keep a private copy there.', busy: 'Saving to Hypothesis…', ok: 'Kept privately on Hypothesis too' + (sync.at ? ', saved ' + sync.at.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : ''), err: 'Not saved to Hypothesis: ' + sync.msg }[sync.state];
    return '<span class="tray-sync sync-' + sync.state + '" title="My notes are private whichever way they are kept">' + (sync.state === 'ok' ? '☁ ' : sync.state === 'err' ? '⚠ ' : '') + SW.esc(t) + '</span>';
  }
  function scheduleSync() { clearTimeout(syncT); syncT = setTimeout(runSync, 2500); }
  function runSync() {
    if (busy) { scheduleSync(); return; }
    if (!SW.notes || !SW.notes.configured() || !SW.me().initials) { setSync('off'); return; }
    busy = true; setSync('busy');
    SW.notes.mynotes.ready().then(function (ok) {
      if (!ok) throw new Error('the token was not accepted');
      return (pulled ? Promise.resolve() : pull()).then(function () {
        var t = load(), all = t.items.concat(t.bin || []), todo = all.filter(function (it) { return it.shash !== hashOf(it); });
        var gone = (t.gone || []).slice();
        return todo.reduce(function (pr, it) {
          return pr.then(function () {
            return SW.notes.mynotes.push(it).then(function (hid) {
              var x = load(), y = x.items.concat(x.bin || []).filter(function (z) { return z.id === it.id; })[0];
              if (y) { y.hid = hid; y.shash = hashOf(y); delete y.syncErr; save(x, true); }
            }, function (e) {
              var x = load(), y = x.items.concat(x.bin || []).filter(function (z) { return z.id === it.id; })[0];
              if (y) { y.syncErr = /Hypothesis (400|413)/.test(e.message) ? 'too large for Hypothesis; kept here only' : e.message; save(x, true); }
            });
          });
        }, Promise.resolve()).then(function () {
          return gone.reduce(function (pr, hid) { return pr.then(function () { return SW.notes.mynotes.remove(hid); }); }, Promise.resolve()).then(function () {
            var x = load(); x.gone = (x.gone || []).filter(function (h) { return gone.indexOf(h) < 0; }); save(x, true);
          });
        });
      });
    }).then(function () { busy = false; setSync('ok'); paint(); }, function (e) { busy = false; setSync('err', e.message); });
  }
  // What is on Hypothesis and not here (a new browser, another machine) comes
  // in; a note changed elsewhere and not here since is taken from there.
  function pull() {
    return SW.notes.mynotes.pull().then(function (remote) {
      pulled = true;
      var t = load(), here = {}, goneIds = {};
      t.items.concat(t.bin || []).forEach(function (it) { here[it.id] = it; });
      (t.gone || []).forEach(function (h) { goneIds[h] = 1; });
      var added = 0;
      remote.forEach(function (r) {
        if (goneIds[r.hid]) return;
        var loc = here[r.id];
        if (!loc) { r.shash = hashOf(r); (r.binned ? (t.bin = t.bin || []) : t.items).push(r); added++; return; }
        if (!loc.hid) loc.hid = r.hid;
        if (loc.shash === hashOf(loc) && hashOf(r) !== loc.shash) {   // unchanged here, changed there
          var list = loc.binned ? t.bin : t.items, k = list.indexOf(loc); r.shash = hashOf(r); list[k] = r;
        }
      });
      var mx = t.items.concat(t.bin || []).reduce(function (m, it) { var mm = /N(\d+)$/.exec(String(it.ref || '')); return Math.max(m, mm ? +mm[1] : 0); }, 0);
      t.seq = Math.max(t.seq || 0, mx);
      save(t, true);
      if (added) SW.toast(added + ' note' + (added === 1 ? '' : 's') + ' brought back from Hypothesis');
    });
  }
  T.sync = function () { pulled = false; runSync(); };
  function where() {
    var v = SW.state.v && root.SWVersions.byId(SW.state.v);
    return (v ? v.label.replace(/^Spacewar! /, '') + ' · ' : '') + ({ read: 'Read', run: 'Run', analyse: SW.anLensName ? SW.anLensName() : 'Analyse', compare: 'Compare', genealogy: 'Genealogy', tape: 'Tape', graphics: 'Graphics', about: 'Versions', notes: 'My notes', findings: 'Findings' }[SW.state.tab] || SW.state.tab);
  }
  // Undo: the whole of My notes as it was before each change, this session.
  var undoStack = [];
  function snap() { try { undoStack.push(localStorage.getItem(KEY) || '{"title":"","items":[]}'); } catch (e) {} if (undoStack.length > 40) undoStack.shift(); }
  T.undo = function () {
    if (!undoStack.length) return false;
    try { localStorage.setItem(KEY, undoStack.pop()); } catch (e) { return false; }
    paint(); SW.toast('Undone');
    return true;
  };
  var undoAct = { label: 'Undo', fn: function () { T.undo(); } };
  // The bin: removed notes, kept with the date removed until restored or emptied.
  function toBin(x, idx) {
    var now = new Date().toISOString();
    idx.slice().sort(function (a, b) { return b - a; }).forEach(function (i) { var g = x.items.splice(i, 1)[0]; g.binned = now; x.bin = (x.bin || []).concat([g]); });
  }
  var binOpen = false;
  // No note without initials: its number carries them, and it is signed with them.
  function needInitials() {
    if (SW.me().initials) return false;
    SW.toast('Set your initials first (⚙): notes are numbered and signed with them.', 5000);
    var st = SW.$('#btn-settings'); if (st) st.click();
    return true;
  }
  T.needInitials = needInitials;
  function add(item, extra) {
    if (needInitials()) return;
    snap();
    var t = load();
    Object.assign(item, extra || {});
    item.id = 't' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
    t.seq = (t.seq || 0) + 1; item.ref = refFor(t.seq);
    item.added = new Date().toISOString();
    item.from = item.from || where();
    item.vid = item.vid || SW.state.v || '';
    item.by = item.by || SW.me().initials || '';
    item.tags = item.tags || [];
    if (item.chapter == null) item.chapter = t.chapter && t.chapter !== '*' ? t.chapter : '';
    t.items.push(item);
    if (save(t)) { paint(); SW.toast('Added to My notes (' + t.items.length + ')'); }
  }
  // A figure: the SVG as drawn (colours resolved at export, for the chosen background).
  T.addFigure = function (svg, name) {
    add({ kind: 'figure', svg: svg.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, ''), caption: String(name || 'Figure').replace(/^spacewar-/, '').replace(/-/g, ' ') });
  };
  // Anything the bench exports as a document: its blocks, less embedded images.
  T.addDoc = function (doc, extra) {
    var blocks = (doc.blocks || []).map(function (b) {
      if (b.type !== 'figure') return b;
      return { type: 'figure', caption: b.caption, svg: b.svg || null };
    });
    add({ kind: 'doc', caption: doc.title || 'Excerpt', subtitle: doc.subtitle || '', blocks: blocks }, extra);
  };
  T.addText = function () { add({ kind: 'text', caption: '', text: '' }); };

  // A group finding of one's own, back into My notes: into the note it was
  // shared from if that is still here (no longer marked shared), else as a new
  // paragraph with its version, initials, tags and chapter.
  T.recall = function (n) {
    snap();
    var t = load(), tags = (n.tags || []).filter(function (g) { return !/^findings?$/i.test(g) && !/^chapter:/.test(g); });
    var ch = (n.tags || []).filter(function (g) { return /^chapter:/.test(g); }).map(function (g) { return g.slice(8); })[0] || '';
    var it = t.items.filter(function (z) { return z.shared && z.shared.id && z.shared.id === n.id; })[0];
    if (it) {
      delete it.shared;
      if (it.kind === 'text') it.text = n.text;
      it.tags = tags; it.chapter = ch;
      save(t); paint();
      SW.toast('Back in My notes');
      return;
    }
    var sp = SW.figpack.split(n.text), extra = { vid: n.vid, by: n.by, tags: tags, chapter: ch, anchor: n.anchor || null, quote: n.quote || '' };
    if (sp.b64) { SW.figpack.unpack(sp.b64).then(function (svg) { var ls = sp.text.split('\n'); add({ kind: 'figure', svg: svg, caption: ls[0], note: ls.slice(1).join('\n').trim() }, extra); }); return; }
    add({ kind: 'text', caption: '', text: n.text, from: '' }, extra);
  };
  // Notes from an exported file (or a backup) come in beside those here; a note
  // already here (the same id) is left as it is.
  T.merge = function (data) {
    var src = data && (data.notes || data.myNotes) || data; if (!src || !src.items) throw new Error('No notes in this file.');
    snap();
    var t = load(), have = {}, n = 0;
    t.items.concat(t.bin || []).forEach(function (it) { have[it.id] = 1; });
    src.items.concat(src.bin || []).forEach(function (it) { if (have[it.id]) return; delete it.hid; delete it.shash; (it.binned ? (t.bin = t.bin || []) : t.items).push(it); n++; });
    var mx = t.items.concat(t.bin || []).reduce(function (m, it) { var mm = /N(\d+)$/.exec(String(it.ref || '')); return Math.max(m, mm ? +mm[1] : 0); }, 0);
    t.seq = Math.max(t.seq || 0, src.seq || 0, mx);
    save(t); paint();
    return n;
  };
  T.importFile = function () {
    var inp = SW.el('input', { type: 'file', accept: '.json,application/json' });
    inp.onchange = function () {
      var f = inp.files[0]; if (!f) return;
      f.text().then(function (txt) { var n = T.merge(JSON.parse(txt)); SW.toast(n ? n + ' note' + (n === 1 ? '' : 's') + ' added' : 'No new notes in that file'); }).catch(function (e) { SW.toast('Could not read it: ' + e.message, 5000); });
    };
    inp.click();
  };
  T.data = function () { return load(); };
  T.count = function () { return load().items.length; };
  var host = null;   // where My notes are shown (its tab)
  function paint() {
    SW.$$('.mine-n').forEach(function (n) { n.textContent = T.count() || ''; });
    if (host && host.isConnected) T.render(host);
  }

  function preview(it) {
    if (it.kind === 'figure') return '<div class="tray-fig">' + SW.displaySVG(it.svg) + '</div>';
    if (it.kind === 'text') return '<textarea class="tray-text" rows="4" placeholder="A paragraph of your own, to sit between the figures">' + SW.esc(it.text || '') + '</textarea>';
    // an excerpt: a line saying what it holds, opening to all of it
    var bl = it.blocks || [], n = function (t) { return bl.filter(function (b) { return b.type === t; }); };
    var parts = [], tabs = n('table'), codes = n('code'), paras = n('p').filter(function (b) { return b.text; }), figs = n('figure');
    if (tabs.length) parts.push(tabs.length === 1 ? 'a table (' + tabs[0].rows.length + ' rows)' : tabs.length + ' tables');
    if (codes.length) {
      var nNotes = codes.reduce(function (a, c) { return a + c.lines.reduce(function (a2, l) { return a2 + (l.notes || []).length; }, 0); }, 0);
      parts.push('code (' + codes.reduce(function (a, c) { return a + c.lines.length; }, 0) + ' lines)' + (nNotes ? ' with ' + nNotes + (nNotes === 1 ? ' annotation' : ' annotations') : ''));
    }
    if (paras.length) parts.push(paras.length === 1 ? 'a paragraph' : paras.length + ' paragraphs');
    if (figs.length) parts.push(figs.length === 1 ? 'a figure' : figs.length + ' figures');
    return '<details class="tray-doc" data-doc="' + SW.esc(it.id) + '"' + (openDocs[it.id] ? ' open' : '') + '><summary>' + SW.esc(parts.join(' · ') || bl.length + ' blocks') + '</summary><div class="tray-body">' + blocksHTML(bl) + '</div></details>';
  }
  var openDocs = {};   // excerpts left open, this session
  // a note in a large window: a figure at full size, an excerpt all open
  function bigView(it) {
    if (!it) return;
    var d = SW.el('dialog', { class: 'tray-big' });
    var body = it.kind === 'figure' ? '<div class="tray-fig">' + SW.displaySVG(it.svg) + '</div>'
      : it.kind === 'text' ? '<p class="tray-para">' + SW.esc(it.text || '').replace(/\n/g, '<br>') + '</p>'
      : (it.subtitle ? '<p class="hint">' + SW.esc(it.subtitle) + '</p>' : '') + '<div class="tray-body">' + blocksHTML(it.blocks || []) + '</div>';
    d.innerHTML = '<div class="tray-bighead"><b>' + SW.esc(it.caption || (it.kind === 'text' ? 'Paragraph' : 'Note')) + '</b> <span class="faint">' + SW.esc([it.by, it.from || vShort(it.vid)].filter(Boolean).join(' · ')) + '</span><button class="icon-btn" data-x title="Close (Esc)">✕</button></div>' +
      body + (it.note ? '<p class="tray-para"><i>' + SW.esc(it.note) + '</i></p>' : '');
    document.body.appendChild(d);
    function shut() { d.close(); d.remove(); }
    d.addEventListener('click', function (e) { if (e.target === d || e.target.closest('[data-x]')) shut(); });
    d.addEventListener('close', function () { d.remove(); });
    d.showModal();
  }
  // an annotation under its lines: the name in the person's colour, as in Findings
  function personHue(by) { var h = 0; by = String(by || ''); for (var i = 0; i < by.length; i++) h = (h * 31 + by.charCodeAt(i)) % 360; return (h + 200) % 360; }
  function noteHTML(n) {
    var col = 'hsl(' + personHue(n.by) + ',62%,60%)';
    return '<div class="tray-anno" style="border-right-color:' + col + '"><b style="color:' + col + '">' + SW.esc(n.by || '') + '</b> <span class="faint">' + SW.esc([n.date, n.ref].filter(Boolean).join(' · ')) + '</span><div>' + SW.esc(n.text || '') + '</div>' +
      (n.replies || []).map(function (r) { return '<div class="tray-anno-r">↳ <b style="color:hsl(' + personHue(r.by) + ',62%,60%)">' + SW.esc(r.by || '') + '</b> ' + SW.esc(r.text || '') + '</div>'; }).join('') + '</div>';
  }
  function cellText(c) { return c == null ? '' : typeof c === 'object' ? (c.text != null ? c.text : '') : String(c); }
  function blocksHTML(bl) {
    return bl.map(function (b) {
      if (b.type === 'h2' || b.type === 'h3') return '<p class="tray-h"><b>' + SW.esc(b.text || '') + '</b></p>';
      if (b.type === 'p') return b.text ? '<p class="tray-para">' + SW.esc(b.text) + '</p>' : '';
      if (b.type === 'note') return '<p class="tray-para"><b>' + SW.esc(b.by || '') + '</b> ' + SW.esc(b.text || '') + '</p>';
      if (b.type === 'figure') return b.svg ? '<div class="tray-fig">' + SW.displaySVG(b.svg) + '</div>' : '<p class="hint">' + SW.esc(b.caption || 'Figure') + '</p>';
      if (b.type === 'code') return (b.caption ? '<p class="hint">' + SW.esc(b.caption) + '</p>' : '') + '<div class="mono tray-code tray-full">' + b.lines.map(function (l) {
        return '<div class="tl">' + SW.esc((l.n != null ? String(l.n).padStart(4) + '  ' : '') + l.text) + '</div>' + (l.notes || []).map(function (n) { return noteHTML(n); }).join('');
      }).join('') + '</div>';
      if (b.type === 'table') return (b.caption ? '<p class="hint">' + SW.esc(b.caption) + '</p>' : '') + '<div class="tray-tblwrap"><table class="tray-tbl">' +
        (b.head && b.head.length ? '<thead><tr>' + b.head.map(function (h) { return '<th>' + SW.esc(cellText(h)) + '</th>'; }).join('') + '</tr></thead>' : '') +
        '<tbody>' + b.rows.map(function (r) { return '<tr>' + r.map(function (c) { return '<td>' + SW.esc(cellText(c)) + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table></div>';
      return '';
    }).join('');
  }

  // My notes, drawn into an element (its own tab); T.show goes there.
  var CHAPTERS = ['Introduction', 'Chapter 1', 'Chapter 2', 'Chapter 3', 'Chapter 4', 'Chapter 5', 'Chapter 6', 'Chapter 7', 'Chapter 8', 'Conclusion', 'Appendix'];
  function vShort(id) { var v = id && root.SWVersions.byId(id); return v ? v.label.replace(/^Spacewar! /, '') : ''; }
  function uniq(a) { return a.filter(function (x, i) { return x && a.indexOf(x) === i; }); }
  function shown(t) {   // the items the filters let through, with their places in the list
    var f = t.filter || {}, out = [];
    t.items.forEach(function (it, i) {
      if (t.chapter && t.chapter !== '*' && (it.chapter || '') !== (t.chapter === '-' ? '' : t.chapter)) return;
      if (f.v && it.vid !== f.v) return;
      if (f.tag && (it.tags || []).indexOf(f.tag) < 0) return;
      if (f.lvl && (it.level || 'notable') !== f.lvl) return;
      if (f.by && (it.by || '') !== f.by) return;
      if (f.q && [it.ref, it.caption, it.text, it.note, (it.tags || []).join(' ')].join(' ').toLowerCase().indexOf(f.q.toLowerCase()) < 0) return;
      out.push(i);
    });
    return out;
  }
  T.show = function () { SW.setTab('notes'); };
  // the My notes tab
  SW.views.notes = { show: function () {
    var v = SW.$('#view-notes'); v.innerHTML = '';
    var pad = SW.el('div', { class: 'pad findings' });
    pad.appendChild(SW.el('h2', {}, 'My notes'));
    var m = SW.el('div', { class: 'fd-mine-box' });
    pad.appendChild(m); v.appendChild(pad);
    T.render(m);
  } };
  T.render = function (el) {
    host = el;
    var t = load();
    t.chapter = t.chapter || '*'; t.filter = t.filter || {};
    el.innerHTML = '';
    var chs = uniq(CHAPTERS.concat(t.items.map(function (it) { return it.chapter; }))), used = uniq(t.items.map(function (it) { return it.chapter; }));
    var vids = uniq(t.items.map(function (it) { return it.vid; })), tags = uniq([].concat.apply([], t.items.map(function (it) { return it.tags || []; }))).sort(), bys = uniq(t.items.map(function (it) { return it.by; })).sort();
    function opt(v, label, cur) { return '<option value="' + SW.esc(v) + '"' + (v === cur ? ' selected' : '') + '>' + SW.esc(label) + '</option>'; }
    var head = SW.el('div', { class: 'tray-head' });
    head.innerHTML = '<datalist id="tray-chs">' + chs.map(function (c) { return '<option value="' + SW.esc(c) + '">'; }).join('') + '</datalist>' +
      '<div class="toolbar tray-filters" style="position:static;padding-left:0">' +
      '<label>Chapter <select data-f="chapter">' + opt('*', 'All', t.chapter) + chs.filter(function (c) { return used.indexOf(c) >= 0 || c === t.chapter; }).map(function (c) { return opt(c, c, t.chapter); }).join('') + opt('-', 'None given', t.chapter) + '<option value="+">New…</option></select></label>' +
      '<label>Version <select data-f="v">' + opt('', 'All', t.filter.v || '') + vids.map(function (v) { return opt(v, vShort(v), t.filter.v); }).join('') + '</select></label>' +
      '<label>Tag <select data-f="tag">' + opt('', 'All', t.filter.tag || '') + tags.map(function (g) { return opt(g, g, t.filter.tag); }).join('') + '</select></label>' +
      '<label>Importance <select data-f="lvl">' + opt('', 'All', t.filter.lvl || '') + opt('key', '★★★ Key', t.filter.lvl) + opt('notable', '★★ Notable', t.filter.lvl) + opt('minor', '★ Minor', t.filter.lvl) + '</select></label>' +
      '<label>By <select data-f="by">' + opt('', 'Anyone', t.filter.by || '') + bys.map(function (x) { return opt(x, x, t.filter.by); }).join('') + '</select></label>' +
      '<input type="search" data-f="q" class="tray-q" placeholder="Find (number or words)" value="' + SW.esc(t.filter.q || '') + '"></div>' +
      '<p class="hint">Private. A note takes the version open and the chapter chosen here; Share sends it to the group’s Findings, signed with its initials. ' + syncHTML() + '</p>';
    el.appendChild(head);
    var vis = shown(t), tb = SW.$('.tray-filters', head);
    tb.appendChild(SW.el('button', { class: 'btn ghost tb-right', onclick: function () { T.addText(); } }, '＋ Paragraph'));
    var more = SW.el('details', { class: 'menu exp-menu more-menu' });
    more.innerHTML = '<summary class="btn ghost" title="Export or remove the notes shown">⋯</summary>';
    var mb = SW.el('div', { class: 'menu-body' });
    mb.appendChild(SW.el('button', { class: 'btn ghost', title: 'The notes shown, in order, as one Word document', onclick: function () { more.open = false; exportTray('docx'); } }, '⤓ Word'));
    mb.appendChild(SW.el('button', { class: 'btn ghost', title: 'The notes shown as Markdown, with the figures saved beside it as PNG', onclick: function () { more.open = false; exportTray('md'); } }, '⤓ Markdown'));
    mb.appendChild(SW.el('button', { class: 'btn ghost', title: 'Every note, and the bin, as a file to keep', onclick: function () {
      more.open = false;
      root.SWExport.download('spacewar-my-notes-' + (SW.me().initials || '') + '-' + SW.today() + '.json', JSON.stringify({ kind: 'spacewar-bench-my-notes', bench: SW.VERSION, exported: new Date().toISOString(), notes: load() }, null, 1), 'application/json');
    } }, '⤓ Export all (file)'));
    mb.appendChild(SW.el('button', { class: 'btn ghost', title: 'Add notes from an exported file (notes already here are kept)', onclick: function () { more.open = false; T.importFile(); } }, '⤒ Import from a file…'));
    mb.appendChild(SW.el('button', { class: 'btn ghost', title: 'To the bin', onclick: function () {
      more.open = false;
      if (!vis.length || !confirm('Move ' + vis.length + ' note' + (vis.length === 1 ? '' : 's') + ' to the bin?')) return;
      snap(); var x = load(); toBin(x, vis); save(x); paint(); SW.toast('Moved to the bin', 0, undoAct);
    } }, 'Remove the notes shown'));
    more.appendChild(mb);
    var ub = SW.el('button', { class: 'btn ghost', title: 'Undo (⌘Z / Ctrl+Z)', onclick: function () { T.undo(); } }, '↶ Undo');
    ub.disabled = !undoStack.length;
    tb.appendChild(ub);
    var binB = SW.el('button', { class: 'btn ghost ov-binbtn' + (binOpen ? ' on' : ''), title: (binOpen ? 'Close the bin' : 'Open the bin') + ' (' + (t.bin || []).length + ')', onclick: function () { binOpen = !binOpen; paint(); } }, '🗑' + ((t.bin || []).length ? '<sup>' + t.bin.length + '</sup>' : ''));
    tb.appendChild(binB);
    tb.appendChild(more);
    head.addEventListener('change', function (e) {
      var f = e.target.dataset.f, x = load(), val = e.target.value;
      x.filter = x.filter || {};
      if (f === 'chapter') { if (val === '+') { val = (prompt('Chapter or section, e.g. Chapter 3: The Expensive Planetarium') || '').trim() || '*'; } x.chapter = val; }
      else x.filter[f] = val;
      save(x); paint();
    });
    // the search box filters as you type, keeping its place
    head.addEventListener('input', function (e) {
      if (!e.target.classList.contains('tray-q')) return;
      clearTimeout(T._qt);
      T._qt = setTimeout(function () {
        var x = load(); x.filter = x.filter || {}; x.filter.q = e.target.value; save(x); paint();
        var q = SW.$('.tray-q', host); if (q) { q.focus(); q.setSelectionRange(q.value.length, q.value.length); }
      }, 300);
    });
    if (binOpen) el.appendChild(binView(t));
    if (!vis.length) { el.insertAdjacentHTML('beforeend', '<p class="hint">' + (t.items.length ? 'None with these filters.' : 'Nothing here yet. Add with ＋ My notes on any figure, export, finding, or selection in Read.') + '</p>'); return; }
    var fig = 0, list = SW.el('ol', { class: 'tray-list' });
    vis.forEach(function (i, k) {
      var it = t.items[i];
      var lab = it.kind === 'figure' ? 'Figure ' + (++fig) : it.kind === 'text' ? 'Paragraph' : 'Excerpt';
      var li = SW.el('li', { class: 'tray-item', 'data-i': i });
      li.innerHTML = '<div class="tray-row"><span class="tray-ref mono" title="Its number, which does not change">' + SW.esc(it.ref || '') + '</span><b>' + lab + '</b>' +
        (it.vid ? ' <span class="tray-v mono">' + SW.esc(vShort(it.vid)) + '</span>' : '') +
        ' <span class="badge tray-by" title="Signed">' + SW.esc(it.by || '?') + '</span>' + (it.syncErr ? ' <span class="tray-local" title="' + SW.esc(it.syncErr) + '">⚠ this browser only</span>' : '') +
        ' <span class="faint">' + SW.esc(String(it.from || '').replace(/^[^·]*·\s*/, '')) + '</span>' +
        '<span class="tray-acts"><button class="icon-btn" data-a="big" title="Open larger">⤢</button><button class="icon-btn" data-a="up" title="Move up"' + (k ? '' : ' disabled') + '>↑</button><button class="icon-btn" data-a="down" title="Move down"' + (k < vis.length - 1 ? '' : ' disabled') + '>↓</button><button class="icon-btn" data-a="del" title="Remove">✕</button></span></div>' +
        (it.kind !== 'text' ? '<input class="tray-cap" placeholder="Caption" value="' + SW.esc(it.caption || '') + '">' : '') + preview(it) +
        (it.kind !== 'text' ? '<textarea class="tray-note" rows="2" placeholder="Your note">' + SW.esc(it.note || '') + '</textarea>' : '') +
        '<div class="tray-meta"><label>Chapter <input class="tray-ch" list="tray-chs" value="' + SW.esc(it.chapter || '') + '" placeholder="none"></label>' +
        '<label>Tags <input class="tray-tags" value="' + SW.esc((it.tags || []).join(', ')) + '" placeholder="comma separated"></label>' +
        '<label title="Carried to Findings when shared">Importance <select class="tray-lvl">' + [['key', '★★★ Key'], ['notable', '★★ Notable'], ['minor', '★ Minor']].map(function (l) { return '<option value="' + l[0] + '"' + ((it.level || 'notable') === l[0] ? ' selected' : '') + '>' + l[1] + '</option>'; }).join('') + '</select></label>' +
        (it.shared ? '<span class="hint tray-shared">In Findings' + (it.shared.date ? ', ' + SW.esc(SW.fmtDate(it.shared.date)) : '') + (it.shared.draft ? ' (draft)' : '') + '</span>'
                   : '<button class="btn ghost" data-a="share" title="Send to the group’s Findings, signed ' + SW.esc(it.by || SW.me().initials || '') + '">↗ Share to Findings</button>') + '</div>';
      list.appendChild(li);
    });
    el.appendChild(list);
    list.addEventListener('click', function (e) {
      var fg = e.target.closest('.tray-item > .tray-fig');
      if (fg) { bigView(load().items[+fg.closest('.tray-item').dataset.i]); return; }
      var b = e.target.closest('[data-a]');
      if (!b) return;
      var i = +b.closest('.tray-item').dataset.i, x = load();
      if (b.dataset.a === 'share') { share(i); return; }
      if (b.dataset.a === 'big') { bigView(x.items[i]); return; }
      snap();
      if (b.dataset.a === 'del') { toBin(x, [i]); save(x); paint(); SW.toast('Moved to the bin', 0, undoAct); return; }
      var k = vis.indexOf(i), j = vis[b.dataset.a === 'up' ? k - 1 : k + 1]; var tmp = x.items[i]; x.items[i] = x.items[j]; x.items[j] = tmp;
      save(x); paint();
    });
    // one undo step for each stretch of typing in a field
    var armed = false;
    list.addEventListener('focusin', function () { armed = true; });
    list.addEventListener('toggle', function (e) { var d = e.target; if (d.dataset && d.dataset.doc) openDocs[d.dataset.doc] = d.open; }, true);
    list.addEventListener('input', function (e) {
      var li = e.target.closest('.tray-item');
      if (!li) return;
      if (armed) { snap(); armed = false; }
      var x = load(), it = x.items[+li.dataset.i], c = e.target.classList;
      if (c.contains('tray-cap')) it.caption = e.target.value;
      if (c.contains('tray-text')) it.text = e.target.value;
      if (c.contains('tray-note')) it.note = e.target.value;
      if (c.contains('tray-ch')) it.chapter = e.target.value.trim();
      if (c.contains('tray-tags')) it.tags = e.target.value.split(',').map(function (g) { return g.trim(); }).filter(Boolean);
      if (c.contains('tray-lvl')) it.level = e.target.value;
      save(x);
    });
    // chapter and tag changes redraw the filters once editing is done
    list.addEventListener('change', function (e) { if (e.target.matches('.tray-ch, .tray-tags')) paint(); });
  };

  function binView(t) {
    var box = SW.el('div', { class: 'tray-bin' }), bin = t.bin || [];
    box.innerHTML = '<h3>Bin</h3>' + (bin.length ? '' : '<p class="hint">Empty.</p>');
    bin.slice().reverse().forEach(function (it, r) {
      var i = bin.length - 1 - r, txt = it.kind === 'text' ? it.text : (it.caption || it.kind);
      box.insertAdjacentHTML('beforeend', '<div class="tray-binned" data-b="' + i + '"><span class="faint">' + SW.esc(SW.fmtDate(it.binned)) + '</span> ' + SW.esc(String(txt || '').split('\n')[0].slice(0, 90)) +
        ' <button class="btn ghost" data-r="restore">Restore</button> <button class="btn ghost" data-r="kill">Delete for good</button></div>');
    });
    if (bin.length) box.insertAdjacentHTML('beforeend', '<p><button class="btn ghost" data-r="empty">Empty the bin (' + bin.length + ')</button></p>');
    box.addEventListener('click', function (e) {
      var b = e.target.closest('[data-r]'); if (!b) return;
      var x = load(); x.bin = x.bin || [];
      if (b.dataset.r === 'empty') { if (!confirm('Delete everything in the bin for good?')) return; snap(); x.gone = (x.gone || []).concat(x.bin.map(function (g) { return g.hid; }).filter(Boolean)); x.bin = []; }
      else {
        var i = +b.closest('[data-b]').dataset.b; snap();
        var g = x.bin.splice(i, 1)[0];
        if (b.dataset.r === 'restore') { delete g.binned; x.items.push(g); }
        else if (g.hid) x.gone = (x.gone || []).concat([g.hid]);
      }
      save(x); paint();
    });
    return box;
  }
  document.addEventListener('keydown', function (e) {
    if (!(e.metaKey || e.ctrlKey) || e.shiftKey || e.key.toLowerCase() !== 'z') return;
    if (!host || !host.isConnected || !host.offsetParent || /^(INPUT|TEXTAREA|SELECT)$/.test((document.activeElement || {}).tagName || '')) return;
    if (T.undo()) e.preventDefault();
  });

  // A note as a finding: the first line its title, then the note, then an
  // excerpt of what it holds; tagged finding, its tags, and its chapter.
  function share(i) {
    var x = load(), it = x.items[i], me = SW.me();
    var by = it.by || me.initials;
    if (!by) { SW.toast('Please set your initials first (⚙).', 4000); return; }
    var vid = it.vid || SW.state.v;
    var title = it.kind === 'text' ? '' : (it.caption || 'Excerpt');
    var body = [title, it.kind === 'text' ? it.text : it.note].filter(function (z) { return z && String(z).trim(); }).join('\n\n');
    var code = (it.blocks || []).filter(function (b) { return b.type === 'code'; })[0];
    if (code) body += '\n\n' + code.lines.slice(0, 12).map(function (l) { return (l.n != null ? l.n + '  ' : '') + l.text; }).join('\n');
    if (!body.trim()) { SW.toast('Write something first: the first line is the finding’s title.', 4000); return; }
    if (!confirm('Share with the group’s Findings, signed ' + by + ', on ' + (vShort(vid) || 'the version open') + '?')) return;
    var tags = ['finding'].concat(it.tags || []).concat(it.chapter ? ['chapter:' + it.chapter] : []).concat(['level:' + (it.level || 'notable')]).concat(it.ref ? ['note:' + it.ref] : []);
    // a figure goes with it, packed into the text (see SW.figpack)
    (it.kind === 'figure' && it.svg ? SW.figpack.pack(SW.exportSVG(it.svg)) : Promise.resolve('')).then(function (fig) {
      return SW.notes.create({ vid: vid, kind: it.anchor ? 'line' : 'version', anchor: it.anchor || null, quote: it.quote || '', text: body + fig, tags: tags, by: by });
    })
      .then(function (made) {
        var y = load(), j = -1; y.items.forEach(function (z, n) { if (z.id === it.id) j = n; });
        if (j >= 0) { y.items[j].shared = { date: new Date().toISOString(), draft: !SW.notes.configured(), id: made && made.id }; y.items[j].by = by; save(y); }
        paint();
      }, function (e) { if (e.message !== 'no initials') SW.toast(e.message, 5000); });
  }

  function exportTray(fmt) {
    var t0 = load(), t = { title: t0.chapter && t0.chapter !== '*' && t0.chapter !== '-' ? t0.chapter : '', items: shown(t0).map(function (i) { return t0.items[i]; }) };
    if (!t.items.length) { SW.toast('Nothing to export'); return; }
    SW.toast('Preparing ' + t.items.length + ' items…');
    var bg = SW.figBgColour();
    Promise.all(t.items.map(function (it) {
      if (it.kind !== 'figure') return Promise.resolve(null);
      var svg = SW.exportSVG(it.svg);
      return SW.figures.svgToPNG(svg, 2, bg).then(function (r) { return { png: r.png, width: r.width / 2, height: r.height / 2, svg: svg }; }, function () { return { svg: svg }; });
    })).then(function (imgs) {
      var blocks = [];
      t.items.forEach(function (it, i) {
        var src = it.from ? ' (Source: Spacewar! research bench, ' + it.from + '.)' : '';
        if (it.kind === 'figure') blocks.push({ type: 'figure', caption: (it.caption || '') + src, png: imgs[i].png, width: imgs[i].width, height: imgs[i].height });
        else if (it.kind === 'text') { if (it.text) String(it.text).split(/\n{2,}/).forEach(function (p) { blocks.push({ type: 'p', text: p.trim() }); }); }
        else {
          blocks.push({ type: 'h2', text: it.caption || 'Excerpt' });
          if (it.subtitle) blocks.push({ type: 'p', text: it.subtitle });
          blocks = blocks.concat(it.blocks || []);
          if (it.from) blocks.push({ type: 'p', text: 'Source: Spacewar! research bench, ' + it.from + '.' });
        }
        if (it.kind !== 'text' && it.note) String(it.note).split(/\n{2,}/).forEach(function (p) { blocks.push({ type: 'p', text: p.trim() }); });
      });
      SW.exportDoc({ title: t.title || 'Spacewar! chapter materials', subtitle: t.items.length + ' items gathered on the research bench',
                     meta: [['Generated', SW.fmtDate(SW.today()) + ', Spacewar! research bench v' + SW.VERSION]], blocks: blocks },
                   'spacewar-my-notes-' + (t.title || 'chapter'), fmt);
    });
  }

  // ---------- one file with everything ----------
  // My notes (and their bin), drafts, the settings kept in this browser (never
  // the Hypothesis token), and a copy of the group's annotations and findings
  // with their replies and reactions, as they stood when the file was made.
  SW.backup = {
    save: function () {
      SW.toast('Gathering everything…');
      var settings = {};
      try {
        for (var i = 0; i < localStorage.length; i++) {
          var k = localStorage.key(i);
          if (k.indexOf('swbench.') !== 0 || k === 'swbench.token' || k === 'swbench.tray' || k === 'swbench.drafts') continue;
          settings[k.slice(8)] = localStorage.getItem(k);
        }
      } catch (e) {}
      var group = SW.notes && SW.notes.configured() ? SW.notes.listAll({ reactions: true }) : Promise.resolve([]);
      return group.then(function (all) {
        var shared = all.filter(function (n) { return n.source === 'hypothesis'; });
        var out = { kind: 'spacewar-bench-backup', bench: SW.VERSION, made: new Date().toISOString(), by: SW.me().initials || '',
                    group: SW.store.get('group', ''), myNotes: load(), drafts: SW.store.get('drafts', []), settings: settings,
                    groupAnnotations: shared };
        root.SWExport.download('spacewar-bench-backup-' + (SW.me().initials || 'bench') + '-' + SW.today() + '.json', JSON.stringify(out, null, 1), 'application/json');
        SW.toast('Backed up: ' + out.myNotes.items.length + ' of my notes, ' + out.drafts.length + ' drafts, ' + shared.length + ' group annotations', 5000);
      });
    },
    // My notes and drafts come back beside what is here; settings only where
    // none is set; the group's annotations stay in the file (they are on Hypothesis).
    restore: function () {
      var inp = SW.el('input', { type: 'file', accept: '.json,application/json' });
      inp.onchange = function () {
        var f = inp.files[0]; if (!f) return;
        f.text().then(function (txt) {
          var b = JSON.parse(txt);
          if (b.kind !== 'spacewar-bench-backup') { if (b.kind === 'spacewar-bench-my-notes') { var m = T.merge(b); SW.toast(m + ' notes added'); return; } throw new Error('not a bench backup'); }
          var n = b.myNotes ? T.merge(b.myNotes) : 0;
          var d = SW.store.get('drafts', []), have = {}, nd = 0;
          d.forEach(function (x) { have[x.id] = 1; });
          (b.drafts || []).forEach(function (x) { if (!have[x.id]) { d.push(x); nd++; } });
          if (nd) SW.store.set('drafts', d);
          var ns = 0;
          Object.keys(b.settings || {}).forEach(function (k) { if (k !== 'token' && localStorage.getItem('swbench.' + k) == null) { localStorage.setItem('swbench.' + k, b.settings[k]); ns++; } });
          SW.toast('Restored ' + n + ' note' + (n === 1 ? '' : 's') + ', ' + nd + ' draft' + (nd === 1 ? '' : 's') + ', ' + ns + ' setting' + (ns === 1 ? '' : 's') + '. Reload to see them everywhere.', 7000);
        }).catch(function (e) { SW.toast('Could not restore it: ' + e.message, 5000); });
      };
      inp.click();
    }
  };

  T.init = function () { paint(); if (SW.notes && SW.notes.configured() && SW.me().initials) setTimeout(runSync, 1500); };
})(this);
