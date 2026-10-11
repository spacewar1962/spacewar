/* config.js - this bench's settings for bench-kit (research/kit). Loaded after core.js, before the kit. */
(function (root) {
  'use strict';
  var SW = root.SW;
  SW.BENCH = {
    name: 'Spacewar!',
    title: 'Spacewar! Research Bench',
    slug: 'spacewar',
    store: 'swbench.',
    group: '',
    relation: 'Spacewar! ',
    topShare: true,
    figureNum: { print: '#9a5b00', paper: '#9a5b00', phosphor: '#ffce7a' },
    paratexts: { org: 'spacewar1962', repo: 'sw_paratexts', cache: 'sw-paratexts', tokenName: 'Spacewar research bench' },
    examples: { date: 'e.g. 1963-05-17, or 1963', archive: 'e.g. Computer History Museum', versions: 'e.g. 4.3, 4.4',
                refs: 'e.g. [REF: SW4.3L, 2.10–20]', publisher: 'e.g. Rolling Stone', finding: 'F33' },
    // 2a and 4.5 are lost, drawn between the versions around them; the star map is data, not a version of the game
    stemma: { root: '1', lostBetween: { '2a': ['1', '2b'], '4.5': ['4.4', '4.8'] }, skip: ['stars'], lostOnTrunk: false },
    edition: {
      source: function (p) { return p.tape ? ', punched tape' : ''; },
      built: function (b) {
        var V = root.SWVersions;
        return ['Assembled', V.DIALECTS[b.dialect].label + (b.asm ? '; ' + b.asm.words.length.toLocaleString('en-GB') + ' words, start ' + SW.oct(b.asm.start, 4) + (b.asm.errorCount ? '; ' + b.asm.errorCount + ' assembly errors' : '') : '')];
      },
      // a line set in columns, as Read shows it: labels, instruction, comment
      layout: function (raw, pad) {
        var p = SW.parseLine(raw);
        if (!p.code.trim() && !p.labels.length) return raw.replace(/\t/g, '    ');
        var head = (p.loc ? p.loc.trim() + ' ' : '') + (p.labels.length ? p.labels.join(', ') + ',' : '');
        var code = p.code.replace(/\t/g, ' ').replace(/\s+$/, '');
        return (p.comment ? pad(pad(head, 8) + code, 32) + p.comment.replace(/\t/g, ' ') : pad(head, 8) + code);
      },
      words: true,
      files: ['supplied tapes', 'Include the macro and star tapes supplied so the version assembles']
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
