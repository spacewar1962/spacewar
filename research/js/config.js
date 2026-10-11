/* config.js - this bench's settings for bench-kit (research/kit). Loaded after kit/base.js, before the rest of the kit and the bench's own scripts. */
(function (root) {
  'use strict';
  var SW = root.SW;
  SW.BENCH = {
    name: 'Spacewar!',
    title: 'Spacewar! Research Bench',
    slug: 'spacewar',
    store: 'swbench.',
    // references to the sources (kit/refs.js; the short names are SW.REF, in js/core.js): the tape
    // and lines, [REF: SW3.1L, 2.141]; a single tape, its lines alone; no lines, the text itself
    refs: { repo: 'https://github.com/spacewar1962/spacewar', dir: 'sources', supplied: /^(macro fio-dec system|Expensive Planetarium star table)/,
      refOf: function (vid, p, n0, n1, nparts) {
        var r = root.SW.REF[vid] || ('SW' + vid);
        if (p == null || (nparts <= 1 && n0 == null)) return r;   // a single tape, no lines: the text itself
        var tape = nparts > 1 ? (p + 1) + (n0 != null ? '.' : '') : '';
        return r + ', ' + tape + (n0 != null ? n0 + (n1 && n1 !== n0 ? '–' + n1 : '') : '');
      } },
    // the version picker's groups, and the version shown first (kit/shell.js)
    forks: [['early', '1961–62'], ['data', 'Data tapes'], ['ddp', '1963 · ddp fork (Preonas)'], ['dfw', '1963 · dfw fork'], ['later', 'Later']],
    start: '3.1',
    // the About box (kit/about.js); purpose, inside and sources are HTML
    about: {
      icon: '<img src="img/tape-icon.svg" alt="" width="40" height="40">',
      author: 'David M. Berry', citeAuthor: 'Berry, D. M.',
      purpose: 'A bench for the critical reading of the Spacewar! source code, made for the Spacewar! book project.',
      inside: 'The macro1 assembler (from SIMH) with the 1962–63 MACRO rules; a PDP-1 emulator with the Type 30 display; a FIO-DEC tape reader.',
      sources: 'Code by Russell, Samson, Edwards, Graetz, Kotok and others at MIT; later versions by Preonas (“ddp”), “dfw” and Morris; tapes from Russell’s box (bitsavers); transcriptions by Landsteiner and the Computer History Museum. Details under Version.',
      code: 'https://github.com/spacewar1962/spacewar',
      catalogue: { skip: ['stars'], held: 'assembled from source' }
    },
    // the default colour theme's name, and the accent of figures exported on black and on white
    theme: { label: 'Phosphor', note: 'blue-white on near black, after the PDP-1’s display (the default)' },
    accent: { dark: '#ffce7a', light: '#9a5b00' },
    // the people whose initials or names are written into the text (Analyse ▸ Hands and dates, Compare)
    hands: [
      { k: 'prs', who: 'Peter R. Samson', re: /\bprs\b/i, colour: '#2a9d6f' },
      { k: 'adams', who: 'Adams Associates', re: /\badams associates\b/i, colour: '#c0622d' },
      { k: 'ddp', who: 'D. D. “Monty” Preonas', re: /\bddp\b/i, colour: '#d99a1e' },
      { k: 'dfw', who: '“dfw” (not yet identified)', re: /\bdfw\b/i, colour: '#3f8fd0' },
      { k: 'jcm', who: 'Joe C. Morris', re: /\bjcm\b/i, colour: '#c05a93' },
      { k: 'dje', who: 'Dan Edwards', re: /\bdje\b/i, colour: '#8f7a1a' },
      { k: 'jmg', who: 'J. Martin Graetz', re: /\bjmg\b/i, colour: '#7d5a45' },
      { k: 'nl', who: 'Norbert Landsteiner (2014–21)', re: /\bn\.\s?l\.|\bnl\b|\blandsteiner\b/i, colour: '#8a7ae0' }
    ],
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
    lang: 'macro',   // the language of the texts, for Compare and Genealogy (kit/lang-macro.js)
    compare: { comment: '/', normalised: true, reading: 'Assembling',
               supplied: ['supplied tapes', 'Include the tapes supplied to make a version assemble (the macro definitions and the star table), not only the version’s own program text'] },
    comparePrefix: 'Spacewar! ',
    genealogy: { set: ['2b', '3.1', '4.0', '4.1', '4.0ts', '4.2', '4.3', '4.4', '4.8', '4.1f', '2015'], line: 'dfw', lineNames: { ddp: 'ddp line', dfw: 'dfw line', chm: 'CHM line' } },
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
