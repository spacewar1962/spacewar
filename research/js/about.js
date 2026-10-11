/*
 * about.js - this bench's rows on Versions ▸ This version (bench-kit's kit/version.js): the fork,
 * the sources and scans, the witness and source tapes, normalisations and patches, how the version
 * is assembled and on what machine, its tape titles, and where the text held was made.
 */
(function (root) {
  'use strict';
  var SW = root.SW, V = root.SWVersions;
  SW.BENCH.version = {
    notesHint: 'A shared space for provenance, corrections and general discussion of the version as a whole. The build log records every correction, supplied tape and gap met in rebuilding it. Annotations on lines are made in the Read view.',
    rows: function (b) {
      var v = b.v, a = b.asm;
      return [
        ['Fork', v.fork],
        ['Sources', b.parts.map(function (p) {
          return '<a href="../sources/' + SW.esc(p.src) + '" target="_blank" rel="noopener">' + SW.esc(p.src) + '</a>' +
            (p.role !== 'program' ? ' <span class="faint">(supplied: ' + SW.esc(p.role) + ')</span>' : '') +
            (p.title > 1 || p.end ? ' <span class="faint">lines ' + p.title + (p.end ? '–' + p.end : '–') + '</span>' : '');
        }).join('<br>') || 'none'],
        ['Scans', (v.scans || []).map(function (s) { return '<a href="../sources/' + SW.esc(s) + '" target="_blank" rel="noopener">' + SW.esc(s) + '</a>'; }).join('<br>') || 'none'],
        ['Witness tapes', (v.witnesses || []).map(function (t) { return SW.sourceLink(t); }).join('<br>') || 'none'],
        ['Source tapes', (v.sourceTapes || []).map(function (t) { return SW.sourceLink(t); }).join('<br>') || 'none'],
        ['Normalisations', (v.transforms || []).map(function (k) { return SW.esc(V.TRANSFORMS[k].label); }).join('<br>') || 'none'],
        ['Patches to supplied tapes', b.parts.filter(function (p) { return p.patch; }).map(function (p) {
          return SW.esc(p.src) + ': ' + p.patch.map(function (x) { return '<span class="mono">' + SW.esc(x[0]) + '</span> → <span class="mono">' + SW.esc(x[1]) + '</span>'; }).join(', ');
        }).join('<br>') || 'none'],
        ['Read from source tape', b.parts.filter(function (p) { return p.tape; }).map(function (p) { return SW.sourceLink(p.src) + ' (FIO-DEC, decoded in the browser)'; }).join('<br>') || 'no'],
        ['Assembler', SW.esc(V.DIALECTS[b.dialect].label)],
        ['Machine', v.runnable ? (v.mdv ? 'PDP-1 with automatic multiply/divide (mul, div)' : 'PDP-1 without multiply/divide (mus, dis steps)') : 'not runnable'],
        ['Assembly', a ? a.words.length + ' words; ' + (a.errorCount ? a.errorCount + ' errors' : 'no errors') + '; start ' + SW.oct(a.start, 4) +
          '; constants ' + a.constants.map(function (c) { return SW.oct(c.start, 4) + ' (' + c.count + ')'; }).join(', ') +
          (a.variables ? '; variables ' + SW.oct(a.variables.start, 4) + '–' + SW.oct(a.variables.end - 1, 4) : '') +
          '; ' + a.symbols.length + ' symbols; ' + a.macros.length + ' macros' : 'none'],
        ['Tape titles', a ? a.titles.map(function (t) { return '<span class="mono">' + SW.esc(t.text.trim()) + '</span>'; }).join('<br>') : 'none'],
        ['This text', SW.esc(SW.MADE[v.id] || (v.medium || ''))]
      ];
    }
  };
})(this);
