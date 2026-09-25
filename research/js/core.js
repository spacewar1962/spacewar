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
  SW.toast = function (msg, ms) {
    var t = SW.$('#toast');
    t.textContent = msg;
    t.classList.add('on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('on'); }, ms || 2600);
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

  SW.current = function () { return SW.state.v ? SW.build(SW.state.v) : Promise.reject(new Error('no version')); };

  // Citation for a line range of a build.
  SW.cite = function (b, p, n0, n1) {
    var part = b.parts[p];
    var range = n1 && n1 !== n0 ? 'll. ' + n0 + '–' + n1 : 'l. ' + n0;
    return b.v.label + ' (' + b.v.date + '), ' + part.src + ', ' + range;
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
  document.addEventListener('click', function (e) {
    var d = e.target;
    if (d === downOnBackdrop && d.open && outside(d, e)) d.close();
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
  };
  SW.setCodeSize = function (n) {
    n = Math.max(9, Math.min(24, Math.round(n)));
    SW.store.set('codeSize', n);
    SW.applyCodeText();
    SW.toast('Code text ' + n + ' px');
  };

  // ---------- colour schemes for the genealogy figures ----------
  SW.PALETTES = [
    ['phosphor', 'Phosphor (default)'], ['okabe', 'Colour-blind safe (Okabe–Ito)'], ['tol', 'Colour-blind safe (Tol)'],
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
    var sel = SW.el('select', {}, SW.PALETTES.map(function (p) { return '<option value="' + p[0] + '"' + (p[0] === SW.palette() ? ' selected' : '') + '>' + SW.esc(p[1]) + '</option>'; }).join(''));
    sel.onchange = function (e) { e.stopPropagation(); SW.applyPalette(sel.value); if (onChange) onChange(); };
    l.appendChild(sel);
    return l;
  };

  // ---------- figures: on screen, a dark plate; in export, the chosen background ----------
  SW.FIGBG = { white: '#ffffff', paper: '#f4f1e8', black: '#04060b', transparent: null };
  SW.figBg = function () { var b = SW.store.get('figbg', 'white'); return b in SW.FIGBG ? b : 'white'; };

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
  // Figures on screen always sit on a dark plate, in both themes.
  SW.displaySVG = function (svg) { return SW.resolveVars(svg.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, ''), 'phosphor'); };
  // Palettes for figures that draw their own ground (sky, ships).
  SW.PLATE = { bg: '#02040a', ink: '#e6f4ff', ink2: '#8fc3d6', dim: '#7fa6c4', accent: '#ffce7a', dark: true };
  SW.exportPalette = function () {
    var k = SW.figBg(), dark = k === 'black';
    return { bg: SW.FIGBG[k], dark: dark, ink: dark ? '#e6f4ff' : '#1b1f23', ink2: dark ? '#8fc3d6' : '#0f6f86',
             dim: dark ? '#7fa6c4' : '#56606a', accent: dark ? '#ffce7a' : '#9a5b00' };
  };
  // An SVG for export: coloured for the chosen background, with that background laid under it.
  SW.exportSVG = function (svg) {
    var k = SW.figBg(), bg = SW.FIGBG[k];
    // XML 1.0 forbids most control characters; the sources carry form feeds.
    svg = svg.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, '');
    svg = SW.resolveVars(svg, k === 'black' ? 'phosphor' : 'paper');
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
      SW.figures.svgToPNG(SW.exportSVG(getSvg(SW.exportPalette())), 3, SW.FIGBG[SW.figBg()]).then(function (r) {
        root.SWExport.download(name + '.png', r.png, 'image/png');
      }, function () { SW.toast('The PNG could not be made from this figure; try SVG, or zoom out first.', 6000); });
    } }, '▣ PNG'));
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
    return wrap;
  };

  SW.docMeta = function (b) {
    return [
      ['Version', b.v.label], ['Date', b.v.date], ['Authors', b.v.authors],
      ['Sources', b.parts.map(function (p) { return p.src + (p.role !== 'program' ? ' (' + p.role + ')' : ''); }).join('; ')],
      ['Assembler', V.DIALECTS[b.dialect].label],
      ['Generated', SW.fmtDate(SW.today()) + ', Spacewar! research bench']
    ];
  };
})(this);
