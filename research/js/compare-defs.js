/*
 * compare-defs.js - this bench's second mode in Collate (bench-kit's kit/compare.js): the
 * "interesting and often changed constants", the macros, and the defined symbols that differ.
 */
(function (root) {
  'use strict';
  var SW = root.SW;
  // The "interesting and often changed constants": labelled, fixed-location
  // lines such as "tno, 6, law i 41 / number of torps + 1".
  function constantsTable(b, h) {
    var out = {};
    h.progLines(b, false).forEach(function (L) {
      var m = /^\s*([a-z0-9]+),\s*([0-7]+),\s*([^\/]*?)\s*(\/.*)?$/i.exec(L.raw);
      if (m) out[m[1]] = { loc: m[2], val: m[3].replace(/\s+/g, ' '), cm: (m[4] || '').replace(/^\/\s*/, ''), L: L };
    });
    return out;
  }

  function symbolsDiff(el, A, B, h) {
    var ca = constantsTable(A, h), cb = constantsTable(B, h), names = {};
    Object.keys(ca).concat(Object.keys(cb)).forEach(function (k) { names[k] = 1; });
    var crow = Object.keys(names).sort(function (x, y) { return parseInt((ca[x] || cb[x]).loc, 8) - parseInt((ca[y] || cb[y]).loc, 8); }).map(function (k) {
      var a = ca[k], b = cb[k], st = !a ? 'added' : !b ? 'removed' : a.val !== b.val ? 'changed' : '';
      return [k, (a || b).loc, a ? a.val : '', b ? b.val : '', st, (b || a).cm];
    });
    var ma = A.macros || {}, mb = B.macros || {}, mn = {};
    Object.keys(ma).concat(Object.keys(mb)).forEach(function (k) { mn[k] = 1; });
    var mrow = Object.keys(mn).sort().map(function (k) {
      var a = ma[k], b = mb[k];
      var ka = a ? a.body.replace(/\s+/g, ' ').trim() : null, kb = b ? b.body.replace(/\s+/g, ' ').trim() : null;
      return [k, a ? a.args.join(', ') : '', b ? b.args.join(', ') : '', !a ? 'added' : !b ? 'removed' : ka !== kb ? 'body changed' : 'same'];
    });
    var sa = {}, sb = {};
    (A.asm ? A.asm.symbols : []).forEach(function (s) { if (s.defined && !s.label && !s.variable) sa[s.name] = s; });
    (B.asm ? B.asm.symbols : []).forEach(function (s) { if (s.defined && !s.label && !s.variable) sb[s.name] = s; });
    var sn = {}; Object.keys(sa).concat(Object.keys(sb)).forEach(function (k) { sn[k] = 1; });
    var srow = Object.keys(sn).sort().filter(function (k) { return !sa[k] || !sb[k] || sa[k].val !== sb[k].val; }).map(function (k) {
      return [k, sa[k] ? SW.oct(sa[k].val) : '', sb[k] ? SW.oct(sb[k].val) : '', !sa[k] ? 'added' : !sb[k] ? 'removed' : 'changed'];
    });
    var lab = function (s) { return (A.asm ? A.asm.symbols : []).filter(function (x) { return x.label; }).length; };
    void lab;
    var pad = SW.el('div', { class: 'pad' });
    pad.innerHTML = '<h3>The “interesting and often changed constants”</h3><p class="hint">The parameter block at the head of the program: the rules of the game made adjustable, and the place where versions most often differ by a single value.</p>';
    pad.appendChild(SW.table(['Symbol', 'Loc', h.vl(A), h.vl(B), 'Change', 'Comment'], crow, { cls: ['mono', 'mono', 'mono', 'mono', '', ''] }));
    pad.insertAdjacentHTML('beforeend', '<h3 style="margin-top:20px">Macros</h3>');
    pad.appendChild(SW.table(['Macro', 'Dummies in A', 'Dummies in B', 'Status'], mrow, { cls: ['mono', 'mono', 'mono', ''] }));
    pad.insertAdjacentHTML('beforeend', '<h3 style="margin-top:20px">Defined symbols that differ</h3><p class="hint">Symbols set with “=”, not labels or variables (whose addresses shift whenever code moves).</p>');
    pad.appendChild(SW.table(['Symbol', h.vl(A), h.vl(B), 'Status'], srow, { cls: ['mono', 'mono', 'mono', ''] }));
    el.appendChild(pad);
    return { crow: crow, mrow: mrow, srow: srow };
  }

  SW.BENCH.compareDefs = {
    label: 'Constants & symbols',
    render: function (el, A, B, h) { return symbolsDiff(el, A, B, h); },
    doc: function (A, B, r, h) {
      return { title: A.v.label + ' and ' + B.v.label + ': constants, macros, symbols', blocks: [
            SW.tableBlock('The interesting and often changed constants', ['Symbol', 'Loc', h.vl(A), h.vl(B), 'Change', 'Comment'], r.crow),
            SW.tableBlock('Macros', ['Macro', 'Dummies in A', 'Dummies in B', 'Status'], r.mrow),
            SW.tableBlock('Defined symbols that differ', ['Symbol', h.vl(A), h.vl(B), 'Status'], r.srow)] };
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
