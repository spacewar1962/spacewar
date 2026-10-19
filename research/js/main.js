/*
 * main.js - this bench's parts of the frame (bench-kit's kit/shell.js, loaded after it is set):
 * its views in the order of the tabs, the language and assembler shown beside the picker, the
 * window's title naming the version, the tape strip drawn for each version, the links that open
 * Art's gizmo as left (a lens and a graphic are the kit's), and its own Help items. The picker's groups and the
 * version shown first are in js/config.js (forks, start).
 */
(function (root) {
  'use strict';
  var SW = root.SW;
  SW.BENCH.shell = {
    views: ['read', 'run', 'analyse', 'compare', 'genealogy', 'tape', 'graphics', 'about', 'findings', 'notes', 'paratexts', 'implementations'],
    alias: { sky: 'graphics' },   // the Star map tab became Graphics
    redraw: ['analyse', 'compare', 'genealogy', 'tape', 'findings'],
    versionTitle: true,
    // the language, and the variant that matters: the assembler, and the machine option
    lang: function (vv) {
      var modern = vv.dialect === 'macro1';
      return { text: 'MACRO · PDP-1 · ' + (modern ? 'macro1 (2003)' : '1962–63') + ' · ' + (vv.mdv ? 'mul/div' : 'mus/dis'),
        title: 'Language: MACRO, DEC’s assembly language for the PDP-1 (manual F-36, 1962). ' +
          (modern ? 'This text was prepared for macro1, the 2003 cross-assembler (simh), and is assembled with it. ' : 'Assembled as MACRO behaved in 1962–63 (variables allotted as macros are defined). ') +
          (vv.mdv ? 'Machine: needs the PDP-1’s automatic multiply/divide option (mul, div).' : 'Machine: uses the step instructions mus and dis, without the multiply/divide option, as the 1962 programs did.') + ' Click for the MACRO manual (bitsavers, opens in a new tab).' };
    },
    onSelect: function (b) { if (SW.tape) SW.tape.strip(b); },
    onTheme: function () { if (SW.tape && SW.state.v) SW.build(SW.state.v).then(function (b) { SW.tape.strip(b); }).catch(function () {}); },
    query: function (q) {
      // Art's gizmo as a link left it: its mode, the version compared with, the split, a routine to open
      if (q.gz === 'profile' || q.gz === 'compare' || q.gz === 'across') SW.store.set('an.gizmoMode', q.gz);
      if (q.cmp && q.v) { var cb = SW.store.get('an.gizmoCmpBy', {}) || {}; cb[q.v] = q.cmp; SW.store.set('an.gizmoCmpBy', cb); }
      if (q.gz === 'compare') SW.store.set('an.gizmoSplit', q.split === '1');
      if (q.rt) SW.state.gzRoutine = q.rt;
    },
    help: { gizmo: function () { SW.guide('gizmo'); } }
  };
})(this);
