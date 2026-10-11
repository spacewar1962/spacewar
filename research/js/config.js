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
    settings: {
      tour: 'Twelve stops through reading, running, comparing and annotating; about three minutes.',
      groupHint: 'Annotations are shared through a private Hypothesis group. Paste the group’s link (hypothes.is/groups/<b>ID</b>/…) or just its ID, and a personal API token (hypothes.is/account/developer). Without them, annotations are kept as drafts in this browser and can be exported or published later.',
      groupPlaceholder: 'https://hypothes.is/groups/Ab12Cd34/name',
      themeHint: 'The colours of the whole bench: listings, annotations, figures and tapes. The ◐ button in the top bar switches between your last light and dark themes. The scope in Run keeps the PDP-1’s own phosphor.'
    },
    tag: 'sw:',   // the prefix of this bench's tags in Hypothesis before bench-kit 0.5.0 (sw:v:3.1 …): still read; new tags are bk:
    // the worked examples in Help ▸ Advanced annotation
    annoHelp: {
      manual: 'https://bitsavers.org/pdf/dec/pdp1/F36_MACRO_Nov62.pdf', manualName: 'MACRO manual',
      start: 'The gravity calculation starts here', search: 'gravity',
      refA: 'CD, SW3.1L, 2.141–146', refB: 'EF, SW4.1L, 1.120–134',
      noteA: 'A note on the gravity calculation…', noteB: 'The same calculation in 4.1…', quoteA: 'A note on the gravity…',
      boxA: 'Version 3.1, lines 141–146', boxB: 'Version 4.1, lines 120–134',
      tryText: 'The **sun** is placed from `nx1` and `ny1`', code: '`lac nx1`',
      caption: 'A link from an annotation on 4.1 to one on 3.1. The 3.1 annotation lists it under Linked from'
    },
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
