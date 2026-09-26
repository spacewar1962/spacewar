/*
 * figures.js - illustrations at print resolution: code excerpts and the
 * Type 30 scope, as SVG (resolution-independent) or PNG (up to 4096 px).
 */
(function (root) {
  'use strict';
  var SW = root.SW;
  var F = SW.figures = {};

  var THEMES = {
    print: { bg: '#ffffff', text: '#1b1f23', dim: '#6b7280', num: '#9a5b00', cm: '#4b5563', rule: '#d1d5db' },
    paper: { bg: '#f4f1e8', text: '#1d2327', dim: '#8a9096', num: '#9a5b00', cm: '#56606a', rule: '#d6d0bf' },
    phosphor: { bg: '#04060b', text: '#bfe4ff', dim: '#5d7086', num: '#ffce7a', cm: '#7fa6c4', rule: '#1a2638' }
  };

  // The colours of the theme in use (⚙ Settings), for a figure in that style.
  function themeColours() {
    function v(n) { return SW.cssVar(n); }
    return { bg: v('--surface'), text: v('--text'), dim: v('--text-faint'), num: v('--amber'), cm: v('--text-dim'), rule: v('--line') };
  }

  function expandTabs(s) {
    var out = '';
    for (var i = 0; i < s.length; i++) {
      var c = s.charAt(i);
      if (c === '\t') { do { out += ' '; } while (out.length % 8); } else out += c;
    }
    return out;
  }

  // lines: [{n, raw}] from a build; returns an SVG string.
  F.codeSVG = function (b, lines, caption, theme, withWords) {
    var t = theme === 'theme' ? themeColours() : THEMES[theme] || THEMES.print, fs = 13, lh = 18, cw = fs * 0.6;
    var rows = lines.map(function (L) {
      var ws = b.asm && (b.asm.byLine[L.p] || [])[L.n];
      var gut = String(L.n).padStart(5) + (withWords ? '  ' + (ws && ws.length ? SW.oct(ws[0].loc, 4) + ' ' + SW.oct(ws[0].val) : '           ') : '');
      var p = SW.parseLine(L.raw), txt = expandTabs(L.raw);
      var ci = p.comment ? txt.lastIndexOf(expandTabs(p.comment).trim().charAt(0) === '/' ? '/' : '') : -1;
      if (p.comment) ci = txt.length - expandTabs(p.comment).length;
      return { gut: gut, code: ci >= 0 ? txt.slice(0, ci) : txt, cm: ci >= 0 ? txt.slice(ci) : '' };
    });
    var gw = (withWords ? 19 : 6) * cw + 12;
    var maxLen = rows.reduce(function (m, r) { return Math.max(m, r.code.length + r.cm.length); }, 20);
    var w = Math.ceil(gw + maxLen * cw + 24), capH = caption ? 30 : 0, h = rows.length * lh + 20 + capH;
    var o = ['<svg xmlns="http://www.w3.org/2000/svg" width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '">',
             '<rect width="' + w + '" height="' + h + '" fill="' + t.bg + '"/>',
             '<g font-family="Courier New, Courier, monospace" font-size="' + fs + '" xml:space="preserve">'];
    rows.forEach(function (r, i) {
      var y = 14 + (i + 1) * lh - 5;
      o.push('<text x="8" y="' + y + '" fill="' + t.dim + '">' + SW.esc(r.gut) + '</text>');
      o.push('<text x="' + gw + '" y="' + y + '"><tspan fill="' + t.text + '">' + SW.esc(r.code) + '</tspan><tspan fill="' + t.cm + '" font-style="italic">' + SW.esc(r.cm) + '</tspan></text>');
    });
    o.push('</g>');
    o.push('<line x1="' + (gw - 6) + '" y1="8" x2="' + (gw - 6) + '" y2="' + (h - capH - 4) + '" stroke="' + t.rule + '"/>');
    if (caption) o.push('<text x="8" y="' + (h - 10) + '" font-family="Georgia, serif" font-size="13" fill="' + t.dim + '">' + SW.esc(caption) + '</text>');
    o.push('</svg>');
    return o.join('');
  };

  F.svgToPNG = function (svg, scale, bg) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      var url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
      img.onload = function () {
        // Stay within the browser's canvas limits (32,767 px a side, ~250 megapixels).
        scale = Math.min(scale, 32000 / img.height, 32000 / img.width, Math.sqrt(2.4e8 / (img.width * img.height)));
        var c = document.createElement('canvas');
        c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
        var g = c.getContext('2d');
        if (bg) { g.fillStyle = bg; g.fillRect(0, 0, c.width, c.height); }
        g.scale(scale, scale);
        g.drawImage(img, 0, 0);
        URL.revokeObjectURL(url);
        c.toBlob(function (bl) { bl.arrayBuffer().then(function (a) { resolve({ png: new Uint8Array(a), width: c.width, height: c.height }); }); }, 'image/png');
      };
      img.onerror = reject;
      img.src = url;
    });
  };

  function dialog(title, body, actions) {
    var d = SW.el('dialog');
    d.innerHTML = '<form method="dialog" class="settings"><h2>' + SW.esc(title) + '</h2><div class="fig-body"></div><div class="row"></div></form>';
    d.querySelector('.fig-body').appendChild(body);
    var row = d.querySelector('.row');
    actions.forEach(function (a) { row.appendChild(SW.el('button', { type: 'button', class: 'btn', onclick: function () { a[1](d); } }, a[0])); });
    row.appendChild(SW.el('button', { class: 'btn ghost', value: 'close' }, 'Close'));
    document.body.appendChild(d);
    d.addEventListener('close', function () { d.remove(); });
    d.showModal();
    return d;
  }

  F.codeFigureDialog = function (b, lines, caption) {
    var body = SW.el('div');
    body.innerHTML = '<label class="check" title="The look of the figure: black on white for print, the cream of listing paper, or the phosphor of the screen">Style <select id="fg-theme"><option value="print">Print (white)</option><option value="paper">Listing paper</option><option value="phosphor">Phosphor</option><option value="theme">The current colour theme</option></select></label> ' +
      '<label class="check" title="Include the octal address and assembled word beside each line"><input type="checkbox" id="fg-words"> addresses and words</label>' +
      '<label>Caption <input id="fg-cap" value="' + SW.esc(caption) + '"></label><div class="svgbox" id="fg-prev" style="max-height:50vh"></div>';
    function svg() { return F.codeSVG(b, lines, SW.$('#fg-cap').value, SW.$('#fg-theme').value, SW.$('#fg-words').checked); }
    var d = dialog('Code figure', body, [
      ['▣ SVG', function () { root.SWExport.download('spacewar-' + b.v.id + '-ll' + lines[0].n + '.svg', svg(), 'image/svg+xml'); }],
      ['▣ PNG (300 dpi)', function () {
        F.svgToPNG(svg(), 3.125).then(function (r) { root.SWExport.download('spacewar-' + b.v.id + '-ll' + lines[0].n + '.png', r.png, 'image/png'); });
      }]
    ]);
    function prev() { SW.$('#fg-prev', d).innerHTML = svg(); }
    body.addEventListener('input', prev);
    body.addEventListener('change', prev);
    prev();
  };

  // ---------- scope ----------
  // pts: [{x, y, s, t}] with t in machine cycles; now = current cycle count.
  F.scopeCanvas = function (pts, now, size, opts) {
    opts = opts || {};
    var persist = (opts.persist || 0.12) * 200000;   // cycles
    var c = document.createElement('canvas');
    c.width = c.height = size;
    var g = c.getContext('2d');
    g.fillStyle = opts.bg || '#000';
    g.fillRect(0, 0, size, size);
    if (opts.round) { g.beginPath(); g.arc(size / 2, size / 2, size / 2, 0, 6.2832); g.clip(); }
    var k = size / 1024, dot = Math.max(1.2, 2.2 * k);
    g.globalCompositeOperation = opts.bg === '#fff' ? 'source-over' : 'lighter';
    pts.forEach(function (p) {
      var age = now - p.t;
      if (age > persist * 5) return;
      var a = Math.exp(-age / persist) * Math.max(0.25, Math.min(1, 0.62 + 0.13 * p.s));
      if (a < 0.01) return;
      var x = (p.x + 512) * k, y = (511 - p.y) * k;
      if (opts.bg === '#fff') g.fillStyle = 'rgba(0,0,0,' + a.toFixed(3) + ')';
      else {
        var grd = g.createRadialGradient(x, y, 0, x, y, dot * 2.2);
        grd.addColorStop(0, 'rgba(225,245,255,' + a.toFixed(3) + ')');
        grd.addColorStop(0.45, 'rgba(150,215,255,' + (a * 0.55).toFixed(3) + ')');
        grd.addColorStop(1, 'rgba(90,170,255,0)');
        g.fillStyle = grd;
        g.beginPath(); g.arc(x, y, dot * 2.2, 0, 6.2832); g.fill();
        return;
      }
      g.beginPath(); g.arc(x, y, dot, 0, 6.2832); g.fill();
    });
    return c;
  };

  F.scopeSVG = function (pts, now, opts) {
    opts = opts || {};
    var persist = (opts.persist || 0.12) * 200000, ink = opts.ink || 'dark';
    var o = ['<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">',
             '<rect width="1024" height="1024" fill="' + (ink === 'dark' ? '#000' : '#fff') + '"/><g fill="' + (ink === 'dark' ? '#d8f0ff' : '#000') + '">'];
    pts.forEach(function (p) {
      var age = now - p.t;
      if (age > persist * 4) return;
      var a = Math.exp(-age / persist) * Math.max(0.25, Math.min(1, 0.62 + 0.13 * p.s));
      if (a < 0.02) return;
      o.push('<circle cx="' + (p.x + 512) + '" cy="' + (511 - p.y) + '" r="1.6" opacity="' + a.toFixed(2) + '"/>');
    });
    o.push('</g></svg>');
    return o.join('');
  };

  F.scopeFigureDialog = function (pts, now, b) {
    pts = pts.slice();
    var body = SW.el('div');
    body.innerHTML = '<p class="hint">The display as it stood when you pressed the button, re-rendered from the plotted points, not grabbed from the screen.</p>' +
      '<label class="check" title="Width and height of the PNG in pixels (4096 is enough for a full-page plate at 300 dpi)">Size <select id="sf-size"><option>2048</option><option selected>4096</option><option>1024</option></select></label> ' +
      '<label class="check" title="How long each plotted point glows: the P7 phosphor faded over a fraction of a second; a long exposure shows motion as trails">Persistence <select id="sf-pers"><option value="0.05">short</option><option value="0.12" selected>P7 (default)</option><option value="0.4">long exposure</option><option value="2">very long</option></select></label> ' +
      '<label class="check" title="Light points on black, as the screen was; or black points on white, for print">Ink <select id="sf-ink"><option value="dark">phosphor on black</option><option value="light">black on white (print)</option></select></label> ' +
      '<label class="check" title="Crop to the round face of the Type 30 tube, or keep the square raster"><input type="checkbox" id="sf-round" checked> round tube</label>' +
      '<div id="sf-prev" style="margin-top:8px;text-align:center"></div>';
    function opts() {
      var light = SW.$('#sf-ink').value === 'light';
      return { persist: +SW.$('#sf-pers').value, bg: light ? '#fff' : '#000', round: SW.$('#sf-round').checked, ink: light ? 'light' : 'dark' };
    }
    function prev() {
      var c = F.scopeCanvas(pts, now, 512, opts());
      c.style.width = '320px'; c.style.borderRadius = SW.$('#sf-round').checked ? '50%' : '0';
      var p = SW.$('#sf-prev'); p.innerHTML = ''; p.appendChild(c);
    }
    var name = 'spacewar-' + b.v.id + '-scope-' + (now / 200000).toFixed(2).replace('.', '_') + 's';
    dialog('Scope screenshot', body, [
      ['▣ PNG', function () {
        var c = F.scopeCanvas(pts, now, +SW.$('#sf-size').value, opts());
        c.toBlob(function (bl) { bl.arrayBuffer().then(function (a) { root.SWExport.download(name + '.png', new Uint8Array(a), 'image/png'); }); }, 'image/png');
      }],
      ['▣ SVG', function () { root.SWExport.download(name + '.svg', F.scopeSVG(pts, now, opts()), 'image/svg+xml'); }]
    ]);
    body.addEventListener('change', prev);
    prev();
  };
})(this);
