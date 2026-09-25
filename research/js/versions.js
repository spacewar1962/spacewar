/*
 * versions.js - the Spacewar! variorum as the research tool sees it.
 *
 * Catalogue data follow the project's own version table (code.html) and
 * sources/README.md. Each recipe says which files, in which order, are
 * assembled to rebuild a version, and which transcription conventions are
 * normalised first. Transforms never change the number of lines, so the
 * reader always shows the source exactly as it is held in sources/, while
 * the assembler reads the normalised text. Every transform is listed in the
 * version's metadata so that a reconstruction is never mistaken for a
 * reading of the original.
 */
(function (root) {
  'use strict';

  var SRC = '../sources/';

  // Named, documented normalisations.
  var TRANSFORMS = {
    slashComments: {
      label: 'modern "//" editorial comments read as MACRO "/" comments',
      fn: function (t) { return t.replace(/[ \t]*\/\/(.*)$/gm, '\t/$1'); }
    },
    dotOverbar: {
      label: 'a leading "." marking an overlined (variable) name read as "~"',
      fn: function (t) { return t.replace(/(^|[\s(,+\-])\.([0-9]*[a-z][a-z0-9]*)/gm, '$1~$2'); }
    },
    blankWhitespace: {
      label: 'whitespace-only lines (page breaks in the transcription) read as blank',
      fn: function (t) { return t.replace(/^[ \t\f]+$/gm, ''); }
    }
  };

  var MACROS = { src: 'spacewar-4.3-17may1963.txt', end: 61,
                 role: 'macro fio-dec system (June 1963), from the masswerk 4.3 build' };
  var STARS = { src: 'spacewar-2b-stars-prs-13mar1962.txt',
                role: 'Expensive Planetarium star table (prs, 13 Mar 1962)' };

  // status: recovered | reconstructed | lost
  var VERSIONS = [
    { id: '1', label: 'Spacewar! 1', date: '1961 / early 1962', sort: 19620101,
      authors: 'Russell, with the Hingham Institute group', fork: 'early',
      status: 'reconstructed', medium: 'Reconstruction',
      summary: 'First playable: two ships and torpedoes, no gravity or hyperspace. The original is lost; this is Norbert Landsteiner\'s reconstruction (2016/2021), explicitly "not an authentic program".',
      build: [{ src: 'spacewar-1-1962-reconstructed.txt' }],
      transforms: ['slashComments'] },
    { id: '2a', label: 'Spacewar! 2A', date: 'Mar 1962?', sort: 19620315,
      authors: 'Russell, Edwards, Samson', fork: 'early', status: 'lost',
      summary: 'Inferred: the March 1962 integration stage before 2B, where gravity (Edwards) came together. No source known.' },
    { id: 'stars', label: 'Expensive Planetarium', date: '13 Mar 1962', sort: 19620313,
      authors: 'Peter Samson ("prs")', fork: 'data', status: 'recovered', medium: 'Source listing',
      summary: 'Samson\'s star table, "stars by prs for s/w 2b": the real night sky as data, loaded at 6077 by every version with the planetarium.',
      build: [{ src: 'spacewar-2b-stars-prs-13mar1962.txt' }],
      witnesses: [] },
    { id: '2b-pre', label: 'Spacewar! 2B (pre-release)', date: '25 Mar 1962', sort: 19620325,
      authors: 'Russell, Samson, Graetz, et al.', fork: 'early', status: 'reconstructed',
      medium: 'Reconstruction',
      summary: 'The earliest dated pre-2B build (masswerk).',
      build: [MACROS, { src: 'spacewar-2b-25mar1962.txt' }, STARS],
      transforms: ['slashComments'] },
    { id: '2b', label: 'Spacewar! 2B', date: '2 Apr 1962', sort: 19620402,
      authors: 'Russell, Samson, Graetz, et al.', fork: 'early', status: 'recovered',
      medium: 'Paper tape',
      summary: 'First complete version, shown at MIT Parents\' Weekend: Expensive Planetarium, Minskytron hyperspace, single-shot torpedoes. Source reconstructed from disassembly of the tape (Landsteiner 2014).',
      build: [{ src: 'spacewar-2b-2apr1962.txt' }],
      transforms: ['slashComments'],
      witnesses: ['bin-files/spacewar2B_2apr62.bin'] },
    { id: '3.1', label: 'Spacewar! 3.1', date: '24 Sep 1962', sort: 19620924,
      authors: 'Russell', fork: 'early', status: 'recovered', medium: 'Paper tape',
      summary: 'The standard version, patches consolidated; the most widely preserved and emulated. The first in which fuel is really burned.',
      build: [{ src: 'spacewar-3.1-24sep1962.txt' }],
      witnesses: ['SteveRussell_box1/spacewar3.1_24-sep-62.bin', 'bin-files/newSpacewar_4-30-60.bin'] },
    { id: '4.0', label: 'Spacewar! 4.0', date: '2 Feb 1963', sort: 19630202,
      authors: 'Monty Preonas ("ddp")', fork: 'ddp', status: 'recovered', medium: 'Source listing',
      summary: 'Base of the whole 4.x family: hardware multiply/divide and floating-point gravity, no score display. Extracted from the Morris scan by the CCS team.',
      build: [MACROS, { src: 'spacewar-4.0-2feb1963-(Morris).txt', titleMatch: true }, STARS],
      scans: ['spacewar-4.0-2feb1963-(Morris).pdf'] },
    { id: '4.1', label: 'Spacewar! 4.1 / 4.2a (dfw)', date: '20 / 22 Feb 1963', sort: 19630220,
      authors: '"dfw"', fork: 'dfw', status: 'recovered', medium: 'Listing + tape',
      summary: 'The dfw fork, built on Preonas\'s 4.0: dotted central sun, major code reorganisation. The clean original from Steve Russell\'s tape box: pt 1 is 4.1 (2/20/63), pt 2 is 4.2a (2/22/63).',
      build: [MACROS, { src: 'spacewar-4.1-4.2a-feb1963-dfw-(Russell).txt', titleMatch: true }, STARS],
      transforms: ['dotOverbar', 'blankWhitespace'],
      witnesses: ['SteveRussell_box1/spacewar4.1pt1and2.bin', 'SteveRussell_box1/spacewar4.1_2-20-63_dfw.bin',
                  'bin-files/spacewar4.2a_sa4.bin', 'SteveRussell_box1/sw4.2.bin'] },
    { id: '4.0ts', label: 'Spacewar! 4.0TS', date: '4 May 1963', sort: 19630504,
      authors: 'Monty Preonas ("ddp")', fork: 'ddp', status: 'recovered', medium: 'Source listing',
      summary: 'A "Twin Star" variant of 4.0: simplified starfield (4th-magnitude stars removed) and a random hyperspace spin. Recovered by the CCS team. The simplified star tape is transcribed in the same file.',
      build: [MACROS, { src: 'spacewar-4.0ts-4may1963.txt', title: 53, end: 1191 },
              { src: 'spacewar-4.0ts-4may1963.txt', title: 1202, role: 'simplified star tape (Twin Star)' }],
      scans: ['spacewar-4.0ts-4may1963.pdf'] },
    { id: '4.2', label: 'Spacewar! 4.2 (ddp)', date: '11 May 1963', sort: 19630511,
      authors: 'Monty Preonas ("ddp")', fork: 'ddp', status: 'recovered', medium: 'Source listing',
      summary: 'Restored Expensive Planetarium; the first on-screen score display; complex input parsing via iot 111. Symbol table assembled by Joe Morris ("jcm") on 23 May 1963.',
      build: [MACROS, { src: 'spacewar-4.2-11may1963-(Morris).txt', titleMatch: true }, STARS],
      scans: ['spacewar-4.2-11may1963-(Morris).pdf'] },
    { id: '4.3', label: 'Spacewar! 4.3 (ddp, Morris listing)', date: '17 May 1963', sort: 19630517,
      authors: 'Monty Preonas ("ddp")', fork: 'ddp', status: 'recovered', medium: 'Source listing',
      summary: '4.2 plus a Twin Star subjective view on sense switch 2: the display recentres on the Needle. The scanned original keeps the period code, including the active score-display encoder.',
      build: [MACROS, { src: 'spacewar-4.3-17may1963-(Morris).txt', titleMatch: true }, STARS],
      scans: ['spacewar-4.3-17may1963-(Morris).pdf'] },
    { id: '4.3m', label: 'Spacewar! 4.3 (masswerk)', date: '17 May 1963; mod. 2015', sort: 19630518,
      authors: 'Monty Preonas ("ddp"); reassembled by Landsteiner', fork: 'ddp', status: 'reconstructed',
      medium: 'Reassembly',
      summary: 'The masswerk reassembly: a later modified variant that swapped some 1963 code for 4.0-style code. Read it against the Morris listing.',
      build: [{ src: 'spacewar-4.3-17may1963.txt' }] },
    { id: '4.4', label: 'Spacewar! 4.4 (ddp, Morris listing)', date: '17 / 21 May 1963', sort: 19630521,
      authors: 'Monty Preonas ("ddp") & Joe Morris', fork: 'ddp', status: 'recovered', medium: 'Source listing',
      summary: 'Dual-console version: alternate frames go to a second scope so each pilot\'s ship holds the centre. Preonas numbers it 4.3.',
      build: [MACROS, { src: 'spacewar-4.4-21may1963-(Morris).txt', titleMatch: true }, STARS],
      scans: ['spacewar-4.4-21may1963-(Morris).pdf'] },
    { id: '4.4m', label: 'Spacewar! 4.4 (masswerk)', date: '21 May 1963', sort: 19630522,
      authors: 'Preonas & Morris; reassembled by Landsteiner', fork: 'ddp', status: 'reconstructed',
      medium: 'Reassembly', summary: 'The masswerk reassembly of 4.4.',
      build: [{ src: 'spacewar-4.4-21may1963.txt' }] },
    { id: '4.4f', label: 'Spacewar! 4.4 (variant f)', date: '21 May 1963', sort: 19630523,
      authors: 'Preonas & Morris; reassembled by Landsteiner', fork: 'ddp', status: 'reconstructed',
      medium: 'Reassembly', summary: 'An alternate masswerk reassembly of 4.4.',
      build: [{ src: 'spacewar-4.4f-21may1963.txt' }] },
    { id: '4.5', label: 'Spacewar! 4.5 / 4.6 / 4.7', date: 'May to Jul 1963', sort: 19630601,
      authors: 'unknown', fork: 'dfw', status: 'lost',
      summary: 'Lost. Three versions between the 4.4 experiment and the stable 4.8; a comment in 4.8 shows one carried dual thrust/velocity controls. No source survives.' },
    { id: '4.8', label: 'Spacewar! 4.8', date: '24 Jul 1963', sort: 19630724,
      authors: '"dfw"; scorer reworked by Samson', fork: 'dfw', status: 'recovered', medium: 'Source listing',
      summary: 'The last classic MIT version, with the score display reworked by Samson. The identity of "dfw" has never been established.',
      build: [MACROS, { src: 'spacewar-4.8-pt1-24jul1963.txt', titleMatch: true },
              { src: 'spacewar-4.8-pt2-24jul1963.txt', titleMatch: true },
              { src: 'spacewar-4.8-scorer-24jul1963.txt' }, STARS],
      transforms: ['dotOverbar', 'blankWhitespace'],
      scans: ['spacewar-4.8-pt1-24jul1963.pdf', 'spacewar-4.8-pt2-24jul1963.pdf', 'spacewar-4.8-scorer-24jul1963.pdf'] },
    { id: '4.1d', label: 'Spacewar! 4.1 CHM rev. d', date: 'base 20 Feb 1963; mod. Jun 2005', sort: 20050601,
      authors: '"dfw"; reconstructed by Peter Samson', fork: 'dfw', status: 'reconstructed',
      medium: 'Source + tape',
      summary: 'Samson\'s Computer History Museum port, June 2005 checkpoint.',
      build: [{ src: 'spacewar-4.1-chm-2005d.txt' }],
      dialect: 'macro1',
      witnesses: ['spacewar-4.1-chm-2005d.rim'] },
    { id: '4.1f', label: 'Spacewar! 4.1f (CHM)', date: 'base 20 Feb 1963; mod. 2005 to 2008', sort: 20080822,
      authors: '"dfw"; reconstructed by Peter Samson', fork: 'dfw', status: 'reconstructed',
      medium: 'Source + tape',
      summary: 'The version the CHM\'s restored PDP-1 plays: a 4.1 base with the 4.8 score display grafted on and star intensities remapped, adjusted as late as 2008.',
      build: [{ src: 'spacewar-4.1-chm-2008f.txt' }],
      dialect: 'macro1',
      witnesses: ['spacewar-4.1-chm-2008f.rim'] },
    { id: '2015', label: 'Spacewar! 2015', date: '2015', sort: 20150101,
      authors: 'Norbert Landsteiner', fork: 'later', status: 'reconstructed', medium: 'Source + tape',
      summary: 'Landsteiner\'s new PDP-1 program reviving the Minskytron hyperspace signature and a working subjective view.',
      build: [{ src: 'spacewar-2015-landsteiner.txt' }],
      dialect: 'macro1',
      witnesses: ['spacewar-2015-landsteiner.rim'] }
  ];

  // Assembler dialects: 'macro1963' allots overlined variables when a macro
  // is defined (as the 1962-63 MACRO did, which reproduces the authentic 2B
  // and 3.1 tapes); 'macro1' is the 2003 cross-assembler used for the
  // modern CHM and 2015 builds.
  var DIALECTS = {
    macro1963: { label: 'MACRO (1962-63 behaviour)', options: { defVars: true } },
    macro1: { label: 'macro1 (simh, 2003)', options: {} }
  };

  // Programs that assume the automatic multiply/divide option (mul/div);
  // the 1962 programs use the step instructions mus/dis on the same opcodes.
  var NO_MDV = { '1': 1, '2b-pre': 1, '2b': 1, '3.1': 1 };

  VERSIONS.forEach(function (v) {
    v.dialect = v.dialect || 'macro1963';
    if (v.mdv === undefined) v.mdv = !NO_MDV[v.id];
    if (v.runnable === undefined) v.runnable = !!v.build && v.id !== 'stars';
    v.url = function () { return '#v=' + encodeURIComponent(v.id); };
  });

  function byId(id) {
    for (var i = 0; i < VERSIONS.length; i++) if (VERSIONS[i].id === id) return VERSIONS[i];
    return null;
  }

  // Find the "spacewar ..." title line of a modern transcription.
  function findTitle(lines) {
    for (var i = 0; i < lines.length; i++) {
      if (/^\s*(spacewar|\/?scorer)\b/i.test(lines[i]) && !/^\s*\//.test(lines[i])) return i + 1;
    }
    return 1;
  }

  /*
   * fetchText(path) -> Promise<string>. Returns a Promise of
   * { version, parts: [{src, role, text, title, end}], files: [...for assembler] }.
   */
  function load(v, fetchText, splitLines) {
    if (!v.build) return Promise.resolve({ version: v, parts: [], files: [] });
    return Promise.all(v.build.map(function (b) { return fetchText(b.src); })).then(function (texts) {
      var parts = v.build.map(function (b, i) {
        var raw = texts[i];
        var norm = raw;
        (v.transforms || []).forEach(function (k) { norm = TRANSFORMS[k].fn(norm); });
        var title = b.title;
        if (!title && b.titleMatch) title = findTitle(splitLines(raw));
        return { src: b.src, role: b.role || 'program', raw: raw, text: norm,
                 title: title || 1, end: b.end || null };
      });
      var files = parts.map(function (p) {
        return { name: p.src, text: p.text, title: p.title, end: p.end };
      });
      return { version: v, parts: parts, files: files };
    });
  }

  var api = { VERSIONS: VERSIONS, TRANSFORMS: TRANSFORMS, DIALECTS: DIALECTS, byId: byId, load: load,
              findTitle: findTitle, SRC: SRC };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.SWVersions = api;
})(this);
