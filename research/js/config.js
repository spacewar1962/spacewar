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
    },
    // Help ▸ What you should read (kit/helppages.js): a short bibliography, every entry checked
    // against the project's Zotero library
    reading: {
      intro: 'Where to begin: on repairing old code, on reading code as a cultural text, and on Spacewar! itself. Links open in a new tab.',
      menu: 'A short bibliography: repairing old code, critical code studies, Spacewar!',
      groups: [
        ['Repairing old code', [
          'Berry, D. M. (2025) ‘Digital Ruins and Critical Code Studies: Towards an Ethics of Historical Software Reconstruction’, <i>Stunlaw: Philosophy and Critique for a Digital Age</i>. Available at: <a href="https://stunlaw.blogspot.com/2025/01/digital-ruins-and-critical-code-studies.html" target="_blank" rel="noopener noreferrer">https://stunlaw.blogspot.com/2025/01/digital-ruins-and-critical-code-studies.html</a>. <span class="faint">The approach behind the bench’s repair marks (gold, in Read) and its reconstruction cards.</span>']],
        ['Critical code studies', [
          'Marino, M. C. (2020) <i>Critical Code Studies</i>. Cambridge, MA: The MIT Press.',
          'Berry, D. M. and Marino, M. C. (2024) ‘Reading ELIZA: Critical Code Studies in Action’, <i>Electronic Book Review</i>. Available at: <a href="https://electronicbookreview.com/essay/reading-eliza-critical-code-studies-in-action/" target="_blank" rel="noopener noreferrer">https://electronicbookreview.com/essay/reading-eliza-critical-code-studies-in-action/</a>.',
          'Marino, M. C., Weil, P., Shrager, J., Schwarz, A., Hay, A., Ciston, S., Berry, D. M. and Millican, P. (2026) ‘Conversations about conversational code: on the collaborative critical code studies reading of ELIZA’, <i>AI &amp; Society</i>. <a href="https://doi.org/10.1007/s00146-026-03086-7" target="_blank" rel="noopener noreferrer">https://doi.org/10.1007/s00146-026-03086-7</a>.',
          'Montfort, N., Baudoin, P., Bell, J., Bogost, I., Douglass, J., Marino, M. C., Mateas, M., Reas, C., Sample, M. and Vawter, N. (2014) <i>10 PRINT CHR$(205.5+RND(1)); : GOTO 10</i>. Cambridge, MA: MIT Press.']],
        ['Spacewar!', [
          'Graetz, J. M. (1981) ‘The Origin of Spacewar’. Available at: <a href="https://www.masswerk.at/spacewar/SpacewarOrigin.html" target="_blank" rel="noopener noreferrer">https://www.masswerk.at/spacewar/SpacewarOrigin.html</a>.',
          'Monnens, D. and Goldberg, M. (2015) ‘Space Odyssey: The Long Journey of Spacewar! from MIT to Computer Labs Around the World’, <i>Kinephanos</i>. Available at: <a href="https://www.kinephanos.ca/2015/space-odyssey-the-long-journey-of-spacewar-from-mit-to-computer-labs-around-the-world/" target="_blank" rel="noopener noreferrer">https://www.kinephanos.ca/2015/space-odyssey-the-long-journey-of-spacewar-from-mit-to-computer-labs-around-the-world/</a>.',
          'Landsteiner, N. (n.d.) <i>Spacewar! – video games 60s style</i>. Available at: <a href="https://www.masswerk.at/spacewar/" target="_blank" rel="noopener noreferrer">https://www.masswerk.at/spacewar/</a>.']]
      ]
    },
    // Help ▸ Referencing and versions (kit/helppages.js); the ports are SW.PORTS, in js/core.js
    refHelp: {
      example: '[REF: SW3.1T, 2.141–146]',
      about: '<p>SW, then the version (<b>3.1</b>), then a letter for the witness, the particular surviving text of that version (<b>T</b>); then the tape (<b>2</b>, as the assembler read them in) and the lines (<b>141–146</b>).</p>',
      letters: [['T', 'machine-read from the punched source tape'], ['L', 'a transcription: typed text of a listing or a tape'], ['M', 'a modern reassembly or edited source'], ['R', 'a reconstruction'], ['B', 'an object tape (binary), cited by address only']],
      more: '<p>Shorter forms: the version and witness alone, <span class="mono">[REF: SW3.1T]</span>; a whole tape, <span class="mono">[REF: SW3.1T, 2]</span>. The tape is left out when a text has only one: <span class="mono">[REF: SW4.3M, 141]</span>. By core address, <span class="mono">[REF: SW3.1L, @0402–0407]</span>: an address holds across texts of a version that assemble to the same words, and is the only way to cite an object tape. Two texts of one version with the same letter take a lower-case qualifier: <span class="mono">SW4.4Mf</span>. A newly found text takes its version and the next letter or qualifier; a new version, its own number.</p><p>A port, a program for another machine, is not a text of any PDP-1 version and has a namespace of its own: <b>SWP</b>, the machine, the program, and its own version number, or its year when it has none: <span class="mono">[REF: SWP-PDP6-WAR44, 76]</span>. Several files of one program are its parts: <span class="mono">[REF: SWP-PDP10-SW71, 2.14]</span> is line 14 of SHIPS.SAI. A port has no witness letter unless it survives in more than one text.</p><p>A SWHID opens through Software Heritage’s resolver, <span class="mono">archive.softwareheritage.org/swh:1:cnt:…</span>, once the repository is archived there; the part after the first semicolon (origin, path, lines) qualifies it and is not a web address. For a link that works meanwhile, Copy citation also gives the file on GitHub at its last change, to the lines.</p><p>For the exact bytes of a file, cite its <a href="https://www.swhid.org/" target="_blank" rel="noopener">SWHID</a> (<a href="https://www.softwareheritage.org/software-hash-identifier-swhid/" target="_blank" rel="noopener">Software Heritage</a>, <a href="https://www.iso.org/standard/89985.html" target="_blank" rel="noopener">ISO/IEC 18670:2025</a>) alongside.</p>',
      form: 'Form: [REF: SW<version><witness>, <tape>.<lines>], e.g. [REF: SW3.1T, 2.141–146]. Ports: [REF: SWP-<machine>-<program><version or year>].',
      versions: { title: 'Source code versions', hint: 'The version’s date is the program’s; the text we hold may be later: a transcription, a reassembly, a reconstruction. Each version’s name opens its text on GitHub (a text in several files has a link for each further part); SWHIDs copy on a click (hover for the file), for the version’s own texts, not the macro tape and star table supplied to many builds.' },
      ports: { title: 'Ports', head: ['Reference', 'Program', 'Machine', 'Where and by whom', 'Date'], fold: true,
               hint: 'Named whether or not a text is held, so that a port can be cited as a program. A port takes a witness letter only when it survives in more than one text, or when the text held is not its own (SWP-CDC3100-SPACEWAR66R, a reconstruction). BBN’s copy of the PDP-1 program is a copy, not a port: found, it would be a witness of a PDP-1 version.' }
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
