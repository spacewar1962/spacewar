/*
 * tray.js - a tray for a chapter: figures, code excerpts, tables and your own
 * paragraphs gathered from anywhere in the bench, put in order, captioned,
 * and exported together as one Word or Markdown file with numbered figures.
 * Kept in this browser.
 */
(function (root) {
  'use strict';
  var SW = root.SW;
  var KEY = 'swbench.tray';
  var T = SW.tray = {};

  function load() { try { return JSON.parse(localStorage.getItem(KEY) || '{"title":"","items":[]}'); } catch (e) { return { title: '', items: [] }; } }
  function save(t) {
    try { localStorage.setItem(KEY, JSON.stringify(t)); return true; }
    catch (e) { SW.toast('The tray is full (this browser’s storage). Export it, then remove some figures.', 6000); return false; }
  }
  function where() {
    var v = SW.state.v && root.SWVersions.byId(SW.state.v);
    return (v ? v.label.replace(/^Spacewar! /, '') + ' · ' : '') + ({ read: 'Read', run: 'Run', analyse: 'Analyse', compare: 'Compare', genealogy: 'Genealogy', tape: 'Tape', about: 'Version & notes', findings: 'Findings' }[SW.state.tab] || SW.state.tab);
  }
  function add(item) {
    var t = load();
    item.id = 't' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
    item.added = new Date().toISOString();
    item.from = item.from || where();
    t.items.push(item);
    if (save(t)) { paint(); SW.toast('Added to the tray (' + t.items.length + ')'); }
  }
  // A figure: the SVG as drawn (colours resolved at export, for the chosen background).
  T.addFigure = function (svg, name) {
    add({ kind: 'figure', svg: svg.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, ''), caption: String(name || 'Figure').replace(/^spacewar-/, '').replace(/-/g, ' ') });
  };
  // Anything the bench exports as a document: its blocks, less embedded images.
  T.addDoc = function (doc) {
    var blocks = (doc.blocks || []).map(function (b) {
      if (b.type !== 'figure') return b;
      return { type: 'figure', caption: b.caption, svg: b.svg || null };
    });
    add({ kind: 'doc', caption: doc.title || 'Excerpt', subtitle: doc.subtitle || '', blocks: blocks });
  };
  T.addText = function () { add({ kind: 'text', caption: '', text: '' }); };

  T.count = function () { return load().items.length; };
  function paint() {
    var n = SW.$('#tray-n'), b = SW.$('#btn-tray');
    if (n) n.textContent = T.count() || '';
    if (b) b.title = T.count() ? 'The tray: ' + T.count() + ' item' + (T.count() === 1 ? '' : 's') + ' for a chapter' : 'The tray: gather figures and excerpts for a chapter (＋ Tray on any figure or export)';
    if (document.body.classList.contains('drawer-open') && SW.$('#drawer-body').dataset.panel === 'tray') T.show();
  }

  function preview(it) {
    if (it.kind === 'figure') return '<div class="tray-fig">' + SW.displaySVG(it.svg) + '</div>';
    if (it.kind === 'text') return '<textarea class="tray-text" rows="4" placeholder="A paragraph of your own, to sit between the figures">' + SW.esc(it.text || '') + '</textarea>';
    var code = (it.blocks || []).filter(function (b) { return b.type === 'code'; })[0];
    var tab = (it.blocks || []).filter(function (b) { return b.type === 'table'; })[0];
    if (code) return '<pre class="mono tray-code">' + SW.esc(code.lines.slice(0, 8).map(function (l) { return (l.n != null ? String(l.n).padStart(4) + '  ' : '') + l.text; }).join('\n')) + (code.lines.length > 8 ? '\n…' : '') + '</pre>';
    if (tab) return '<div class="hint">Table: ' + SW.esc(tab.caption || '') + ' (' + tab.rows.length + ' rows)</div>';
    return '<div class="hint">' + (it.blocks || []).length + ' blocks</div>';
  }

  T.show = function () {
    var t = load();
    var body = SW.drawer('Tray', '');
    body.dataset.panel = 'tray';
    document.body.classList.add('drawer-wide');
    var head = SW.el('div', { class: 'tray-head' });
    head.innerHTML = '<label>Chapter or section <input id="tray-title" placeholder="e.g. Chapter 3: The Expensive Planetarium" value="' + SW.esc(t.title || '') + '"></label>' +
      '<p class="hint">Figures are numbered in the order below. Captions are yours to write; the source is added after each. Add from any ▣ figure (＋ Tray), any Word/Markdown export (＋ Tray), or a selection in Read.</p>';
    body.appendChild(head);
    var bar = SW.el('div', { class: 'toolbar', style: 'position:static;padding-left:0' });
    bar.appendChild(SW.el('button', { class: 'btn', title: 'All items, in order, as one Word document', onclick: function () { exportTray('docx'); } }, '⤓ Word'));
    bar.appendChild(SW.el('button', { class: 'btn', title: 'All items as Markdown, with the figures saved beside it as PNG', onclick: function () { exportTray('md'); } }, '⤓ Markdown'));
    bar.appendChild(SW.el('button', { class: 'btn ghost', onclick: function () { T.addText(); } }, '＋ Paragraph'));
    bar.appendChild(SW.el('button', { class: 'btn ghost tb-right', title: 'Empty the tray', onclick: function () {
      if (!t.items.length || !confirm('Empty the tray (' + t.items.length + ' items)?')) return;
      t.items = []; save(t); paint(); T.show();
    } }, 'Empty'));
    body.appendChild(bar);
    SW.$('#tray-title', head).addEventListener('input', function (e) { var x = load(); x.title = e.target.value; save(x); });
    if (!t.items.length) { body.insertAdjacentHTML('beforeend', '<p>The tray is empty.</p>'); return; }
    var fig = 0, list = SW.el('ol', { class: 'tray-list' });
    t.items.forEach(function (it, i) {
      var lab = it.kind === 'figure' ? 'Figure ' + (++fig) : it.kind === 'text' ? 'Paragraph' : 'Excerpt';
      var li = SW.el('li', { class: 'tray-item', 'data-i': i });
      li.innerHTML = '<div class="tray-row"><b>' + lab + '</b> <span class="faint">' + SW.esc(it.from || '') + '</span>' +
        '<span class="tray-acts"><button class="icon-btn" data-a="up" title="Move up"' + (i ? '' : ' disabled') + '>↑</button><button class="icon-btn" data-a="down" title="Move down"' + (i < t.items.length - 1 ? '' : ' disabled') + '>↓</button><button class="icon-btn" data-a="del" title="Remove">✕</button></span></div>' +
        (it.kind !== 'text' ? '<input class="tray-cap" placeholder="Caption" value="' + SW.esc(it.caption || '') + '">' : '') + preview(it);
      list.appendChild(li);
    });
    body.appendChild(list);
    list.addEventListener('click', function (e) {
      var b = e.target.closest('[data-a]');
      if (!b) return;
      var i = +b.closest('.tray-item').dataset.i, x = load();
      if (b.dataset.a === 'del') x.items.splice(i, 1);
      else { var j = b.dataset.a === 'up' ? i - 1 : i + 1; var tmp = x.items[i]; x.items[i] = x.items[j]; x.items[j] = tmp; }
      save(x); paint(); T.show();
    });
    list.addEventListener('input', function (e) {
      var li = e.target.closest('.tray-item');
      if (!li) return;
      var x = load(), it = x.items[+li.dataset.i];
      if (e.target.classList.contains('tray-cap')) it.caption = e.target.value;
      if (e.target.classList.contains('tray-text')) it.text = e.target.value;
      save(x);
    });
  };

  function exportTray(fmt) {
    var t = load();
    if (!t.items.length) { SW.toast('The tray is empty'); return; }
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
      });
      SW.exportDoc({ title: t.title || 'Spacewar! chapter materials', subtitle: t.items.length + ' items gathered on the research bench',
                     meta: [['Generated', SW.fmtDate(SW.today()) + ', Spacewar! research bench v' + SW.VERSION]], blocks: blocks },
                   'spacewar-tray-' + (t.title || 'chapter'), fmt);
    });
  }

  T.init = function () {
    var b = SW.$('#btn-tray');
    if (b) b.onclick = T.show;
    paint();
  };
})(this);
