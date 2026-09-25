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
  // The dfw tapes of February 1963 were assembled with "ioh" as 760000 (opr):
  // with that one change the dfw source rebuilds both authentic dfw tapes.
  var MACROS_FEB63 = { src: 'spacewar-4.3-17may1963.txt', end: 61, patch: [['ioh=iot i', 'ioh=760000']],
                       role: 'macro fio-dec system (June 1963, masswerk 4.3 build) with ioh=760000, as the February 1963 dfw tapes require' };
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
      buildNotes: ["A data tape, not a program: it assembles (938 words at 6077) but does not run by itself. It is supplied after the main program for the 4.x listings, which call it but do not contain it."],
      summary: 'Samson\'s star table, "stars by prs for s/w 2b": the real night sky as data, loaded at 6077 by every version with the planetarium.',
      build: [{ src: 'spacewar-2b-stars-prs-13mar1962.txt' }],
      witnesses: [] },
    { id: '2b-pre', label: 'Spacewar! 2B (pre-release)', date: '25 Mar 1962', sort: 19620325,
      authors: 'Russell, Samson, Graetz, et al.', fork: 'early', status: 'reconstructed',
      medium: 'Reconstruction',
      buildNotes: ["The file carries no macro definitions of its own (swap, count, setup, ioh are used but not defined), so the June 1963 'macro fio-dec system' from the masswerk 4.3 build is supplied in front, with Samson's 13 March 1962 star table after. Both are stand-ins for tapes that are not held.", "Its one-line macro definition 'define mult Z<tab>jda mpy<tab>lac Z<tab>term' is valid MACRO (F-36) but not accepted by macro1; the assembler here accepts it."],
      summary: 'The earliest dated pre-2B build (masswerk).',
      build: [MACROS, { src: 'spacewar-2b-25mar1962.txt' }, STARS],
      transforms: ['slashComments'] },
    { id: '2b', label: 'Spacewar! 2B', date: '2 Apr 1962', sort: 19620402,
      authors: 'Russell, Samson, Graetz, et al.', fork: 'early', status: 'recovered',
      medium: 'Paper tape',
      buildNotes: ["Assembled with the 1962-63 MACRO variable rule, Landsteiner's reconstruction (2014) rebuilds bin-files/spacewar2B_2apr62.bin exactly (2,297 words). With macro1's rule it differs in 174 words, all variable addresses.", "Normalised for assembly: the transcription's modern '//' editorial comments are read as MACRO comments (tab then '/'). The reader shows the file as held."],
      summary: 'First complete version, shown at MIT Parents\' Weekend: Expensive Planetarium, Minskytron hyperspace, single-shot torpedoes. Source reconstructed from disassembly of the tape (Landsteiner 2014).',
      build: [{ src: 'spacewar-2b-2apr1962.txt' }],
      transforms: ['slashComments'],
      witnesses: ['bin-files/spacewar2B_2apr62.bin'] },
    { id: '3.1', label: 'Spacewar! 3.1', date: '24 Sep 1962', sort: 19620924,
      authors: 'Russell', fork: 'early', status: 'recovered', medium: 'Paper tape',
      buildNotes: ["Assembled with the 1962-63 MACRO variable rule, the source rebuilds bin-files/newSpacewar_4-30-60.bin exactly (2,514 words). With macro1's own rule it differs in 62 words, all addresses of overlined variables: \\\\ssn and \\\\scn are allotted first on the tapes because they occur in the bodies of the xincr/yincr macros defined at the head of the program.", "Against Steve Russell's tape spacewar3.1_24-sep-62.bin the source differs in 27 words, all in the star table, and the tape is 4 words shorter. From 7712 the tables diverge: the tape's second word for '91 Aqar' differs (652375 against 622377), '6 Pisc' (mark 7919, 62) is absent so that the following stars sit two words lower, and the table ends before '2 Ceti' (4q). The program code itself is identical.", "Confirmed: Landsteiner's spacewar3.1_complete.txt is a modern composite of four tapes (June 1963 macros, Russell's 1962 program in two parts, and Samson's star table), used because it's the only surviving macro tape and it still rebuilds the original 3.1 binary exactly."],
      summary: 'The standard version, patches consolidated; the most widely preserved and emulated. The first in which fuel is really burned.',
      // Landsteiner's file joins four tapes; read as such, so the June 1963
      // macro tape shows as supplied rather than as part of the 1962 program.
      build: [{ src: 'spacewar-3.1-24sep1962.txt', end: 64, role: 'macro fio-dec system, the June 1963 macro tape joined in front of the program in Landsteiner’s composite file' },
              { src: 'spacewar-3.1-24sep1962.txt', title: 65, end: 658 },
              { src: 'spacewar-3.1-24sep1962.txt', title: 659, end: 1370 },
              { src: 'spacewar-3.1-24sep1962.txt', title: 1371 }],
      witnesses: ['SteveRussell_box1/spacewar3.1_24-sep-62.bin', 'bin-files/newSpacewar_4-30-60.bin'] },
    { id: '3.1t', label: 'Spacewar! 3.1 (source tapes)', date: '24 Sep 1962; tapes 29 Sep 1962', sort: 19620929,
      authors: 'Russell', fork: 'early', status: 'recovered', medium: 'Source tape (FIO-DEC)',
      buildNotes: ["Read from SteveRussell_box1/spacewar3.1pt1_29sep62.bin, pt2 and pt3 (the star table), decoded from FIO-DEC: every frame passes the odd-parity check. The tapes carry the title 'spacewar 3.1 24 sep 62' though filed as 29 Sep 62.", "One character is mis-punched on the pt 1 tape, in a comment: 'calling s?quence' has code 035 where 'e' (065) belongs, one hole short; parity is still odd, so the fault is in the punching, not the reading.", "The macro definitions are not on these tapes; the 'macro fio-dec system' lines of the masswerk 3.1 file are supplied in front.", "Assembled in the 1962-63 dialect, the tapes rebuild bin-files/newSpacewar_4-30-60.bin exactly (2,514 words). The source tape's dispt macro reads 'repeat 6<tab>B=B+B' where the masswerk text has 'repeat 6, B=B+B'; the 1962-63 dialect reads both alike. Against spacewar3.1_24-sep-62.bin the result differs only in the star table (27 words, 4 fewer on that tape), as for the masswerk text."],
      summary: 'Spacewar! 3.1 read directly from Steve Russell\'s own punched source tapes (pt. 1, pt. 2, and the star table as pt. 3), decoded from FIO-DEC with no transcription in between.',
      build: [{ src: 'spacewar-3.1-24sep1962.txt', end: 64, role: 'macro fio-dec system, from the masswerk 3.1 build' },
              { tape: 'SteveRussell_box1/spacewar3.1pt1_29sep62.bin', titleMatch: true },
              { tape: 'SteveRussell_box1/spacewar3.1pt2_29sep62.bin', titleMatch: true },
              { tape: 'SteveRussell_box1/spacewar3.1pt3_29sep62.bin' }],
      witnesses: ['SteveRussell_box1/spacewar3.1_24-sep-62.bin', 'bin-files/newSpacewar_4-30-60.bin'] },
    { id: '4.0', label: 'Spacewar! 4.0', date: '2 Feb 1963', sort: 19630202,
      authors: 'Monty Preonas ("ddp")', fork: 'ddp', status: 'recovered', medium: 'Source listing',
      buildNotes: ["The ddp listing calls macros (setup, count, init, swap...) from a separate macro tape and the star table from Samson's tape. Neither is in the Morris scan; the June 1963 macro tape (from the masswerk 4.3 build) and the 13 March 1962 star table are supplied. With them the listing assembles without error (2,478 words).", "The explanatory header of the transcription is skipped: assembly starts at the tape title 'spacewar 4.0 2/2/63 ddp'."],
      summary: 'Base of the whole 4.x family: hardware multiply/divide and floating-point gravity, no score display. Extracted from the Morris scan by the CCS team.',
      build: [MACROS, { src: 'spacewar-4.0-2feb1963-(Morris).txt', titleMatch: true }, STARS],
      scans: ['spacewar-4.0-2feb1963-(Morris).pdf'] },
    { id: '4.1', label: 'Spacewar! 4.1 / 4.2a (dfw)', date: '20 / 22 Feb 1963', sort: 19630220,
      authors: '"dfw"', fork: 'dfw', status: 'recovered', medium: 'Listing + tape',
      buildNotes: ["Normalised for assembly: the transcription marks overlined (variable) names with a leading '.' (e.g. '.sx1', '.1sc'); these are read as '~'. Whitespace-only lines (page breaks) are read as blank, so the pt 2 title line is recognised.", "With the June 1963 macro tape as found, the build differs from the authentic dfw tapes in 13 words: ten are 'ioh' (730000 against 760000 on the tapes) and two are the display iot codes in 'dispt i, i my1, 1/2'. The second pair is an assembler matter: the 1963 source writes 'repeat 6<tab>B=B+B' in the dispt macro, which macro1 cuts at the tab; the 1962-63 dialect here reads the whole line, as the tapes show MACRO did.", "With 'ioh' defined as 760000 (opr) in the supplied macro tape, the build is identical to both spacewar4.1_2-20-63_dfw.bin and spacewar4.2a_sa4.bin (2,364 words, no differences). The February 1963 macro system therefore defined ioh differently from the June 1963 tape we hold. SteveRussell_box1/sw4.2.bin differs in one word only (isp 3043 against 3042 at 2333, 'count \\\\src,sq7'): a different build, one variable apart.", "The transcription agrees with Russell's punched source tape (see '4.1 / 4.2a (dfw, source tape)') in 1,135 of 1,138 lines; the differences are the scan label '>>32<< 1', a stray '_' at the end, and the tape's overstruck '\u203e+' (\u00b1) in a comment, transcribed as '.+'."],
      summary: 'The dfw fork, built on Preonas\'s 4.0: dotted central sun, major code reorganisation. The clean original from Steve Russell\'s tape box: pt 1 is 4.1 (2/20/63), pt 2 is 4.2a (2/22/63).',
      build: [MACROS_FEB63, { src: 'spacewar-4.1-4.2a-feb1963-dfw-(Russell).txt', titleMatch: true }, STARS],
      transforms: ['dotOverbar', 'blankWhitespace'],
      sourceTapes: ['SteveRussell_box1/spacewar4.1pt1and2.bin'],
      witnesses: ['SteveRussell_box1/spacewar4.1_2-20-63_dfw.bin',
                  'bin-files/spacewar4.2a_sa4.bin', 'SteveRussell_box1/sw4.2.bin'] },
    { id: '4.1t', label: 'Spacewar! 4.1 / 4.2a (dfw, source tape)', date: '20 / 22 Feb 1963', sort: 19630221,
      authors: '"dfw"', fork: 'dfw', status: 'recovered', medium: 'Source tape (FIO-DEC)',
      buildNotes: ["Read from SteveRussell_box1/spacewar4.1pt1and2.bin, the dfw source punched in FIO-DEC: 15,389 frames, every one passing the odd-parity check, 26 stop codes (page breaks).", "Assembled with the June 1963 macro tape patched to 'ioh=760000', the tape rebuilds spacewar4.1_2-20-63_dfw.bin and spacewar4.2a_sa4.bin exactly: an authentic source reproducing authentic binaries. sw4.2.bin differs by one variable address.", "Overlined variables are punched with the non-spacing overbar (lower-case 056), read as '\\\\'; the one overstrike, '\u203e+' (\u00b1), is in a comment."],
      summary: 'The dfw 4.1 (pt 1) and 4.2a (pt 2) read directly from Steve Russell\'s punched source tape, decoded from FIO-DEC with no transcription in between.',
      build: [MACROS_FEB63, { tape: 'SteveRussell_box1/spacewar4.1pt1and2.bin', titleMatch: true }, STARS],
      transforms: ['blankWhitespace'],
      witnesses: ['SteveRussell_box1/spacewar4.1_2-20-63_dfw.bin', 'bin-files/spacewar4.2a_sa4.bin', 'SteveRussell_box1/sw4.2.bin'] },
    { id: '4.0ts', label: 'Spacewar! 4.0TS', date: '4 May 1963', sort: 19630504,
      authors: 'Monty Preonas ("ddp")', fork: 'ddp', status: 'recovered', medium: 'Source listing',
      buildNotes: ["Assembled as two tape segments from the one transcription: the program (title at line 53, to 'start 4' at line 1191) and the simplified Twin Star star tape (title at line 1202). Macro tape supplied as for 4.0. Assembles without error."],
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
      buildNotes: ["One assembly error: 'law a4+' (line 1351) is incomplete in the transcription.", "All three 4.4 texts (Morris, masswerk, variant f) contain the line '4<tab>szf 4', which MACRO assembles as a data word 000004 in the path of execution. Opcode 00 is reserved on the PDP-1. The emulator carries on past it by default and logs each execution as an anomaly; set 'reserved opcodes halt' to stop instead."],
      summary: 'Dual-console version: alternate frames go to a second scope so each pilot\'s ship holds the centre. Preonas numbers it 4.3.',
      build: [MACROS, { src: 'spacewar-4.4-21may1963-(Morris).txt', titleMatch: true }, STARS],
      scans: ['spacewar-4.4-21may1963-(Morris).pdf'] },
    { id: '4.4m', label: 'Spacewar! 4.4 (masswerk)', date: '21 May 1963', sort: 19630522,
      authors: 'Preonas & Morris; reassembled by Landsteiner', fork: 'ddp', status: 'reconstructed',
      medium: 'Reassembly', buildNotes: ["Contains the same '4<tab>szf 4' word as the Morris listing; see 4.4."],
      summary: 'The masswerk reassembly of 4.4.',
      build: [{ src: 'spacewar-4.4-21may1963.txt' }] },
    { id: '4.4f', label: 'Spacewar! 4.4 (variant f)', date: '21 May 1963', sort: 19630523,
      authors: 'Preonas & Morris; reassembled by Landsteiner', fork: 'ddp', status: 'reconstructed',
      medium: 'Reassembly', buildNotes: ["Contains the same '4<tab>szf 4' word as the Morris listing; see 4.4."],
      summary: 'An alternate masswerk reassembly of 4.4.',
      build: [{ src: 'spacewar-4.4f-21may1963.txt' }] },
    { id: '4.5', label: 'Spacewar! 4.5 / 4.6 / 4.7', date: 'May to Jul 1963', sort: 19630601,
      authors: 'unknown', fork: 'dfw', status: 'lost',
      summary: 'Lost. Three versions between the 4.4 experiment and the stable 4.8; a comment in 4.8 shows one carried dual thrust/velocity controls. No source survives.' },
    { id: '4.8', label: 'Spacewar! 4.8', date: '24 Jul 1963', sort: 19630724,
      authors: '"dfw"; scorer reworked by Samson', fork: 'dfw', status: 'recovered', medium: 'Source listing',
      buildNotes: ["Assembled from pt 1, pt 2 and the scorer, with the June 1963 macro tape and the star table supplied; '.' overbar marks read as '~' as for 4.1.", "Five errors remain, all in the scorer transcription: '( jmpscc 1' (line 12), and 'isc', 'is', 'lai', '2sc' undefined (lines 24, 38, 68, 79). These look like readings of overlined or damaged characters in the scan and should be checked against spacewar-4.8-scorer-24jul1963.pdf."],
      summary: 'The last classic MIT version, with the score display reworked by Samson. The identity of "dfw" has never been established.',
      build: [MACROS, { src: 'spacewar-4.8-pt1-24jul1963.txt', titleMatch: true },
              { src: 'spacewar-4.8-pt2-24jul1963.txt', titleMatch: true },
              { src: 'spacewar-4.8-scorer-24jul1963.txt' }, STARS],
      transforms: ['dotOverbar', 'blankWhitespace'],
      scans: ['spacewar-4.8-pt1-24jul1963.pdf', 'spacewar-4.8-pt2-24jul1963.pdf', 'spacewar-4.8-scorer-24jul1963.pdf'] },
    { id: '4.1d', label: 'Spacewar! 4.1 CHM rev. d', date: 'base 20 Feb 1963; mod. Jun 2005', sort: 20050601,
      authors: '"dfw"; reconstructed by Peter Samson', fork: 'dfw', status: 'reconstructed',
      medium: 'Source + tape',
      buildNotes: ["Assembled in the macro1 dialect (the CHM build was made with macro1); rebuilds spacewar-4.1-chm-2005d.rim exactly. The file has CR line endings, normalised on reading."],
      summary: 'Samson\'s Computer History Museum port, June 2005 checkpoint.',
      build: [{ src: 'spacewar-4.1-chm-2005d.txt' }],
      dialect: 'macro1',
      witnesses: ['spacewar-4.1-chm-2005d.rim'] },
    { id: '4.1f', label: 'Spacewar! 4.1f (CHM)', date: 'base 20 Feb 1963; mod. 2005 to 2008', sort: 20080822,
      authors: '"dfw"; reconstructed by Peter Samson', fork: 'dfw', status: 'reconstructed',
      medium: 'Source + tape',
      buildNotes: ["Assembled in the macro1 dialect; rebuilds spacewar-4.1-chm-2008f.rim exactly. CR line endings normalised on reading."],
      summary: 'The version the CHM\'s restored PDP-1 plays: a 4.1 base with the 4.8 score display grafted on and star intensities remapped, adjusted as late as 2008.',
      build: [{ src: 'spacewar-4.1-chm-2008f.txt' }],
      dialect: 'macro1',
      witnesses: ['spacewar-4.1-chm-2008f.rim'] },
    { id: '2015', label: 'Spacewar! 2015', date: '2015', sort: 20150101,
      authors: 'Norbert Landsteiner', fork: 'later', status: 'reconstructed', medium: 'Source + tape',
      buildNotes: ["Assembled in the macro1 dialect; rebuilds spacewar-2015-landsteiner.rim exactly."],
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
    macro1963: { label: 'MACRO (1962-63 behaviour)', options: { defVars: true, wholeMacroLines: true } },
    macro1: { label: 'macro1 (simh, 2003)', options: {} }
  };

  // Programs that assume the automatic multiply/divide option (mul/div);
  // the 1962 programs use the step instructions mus/dis on the same opcodes.
  var NO_MDV = { '1': 1, '2b-pre': 1, '2b': 1, '3.1': 1, '3.1t': 1 };

  VERSIONS.forEach(function (v) {
    v.dialect = v.dialect || 'macro1963';
    if (v.mdv === undefined) v.mdv = !NO_MDV[v.id];
    v.buildNotes = (v.buildNotes || []).map(function (t) {
      // Signed 'log', not initials: 'CC' read as a team member's.
      return { by: 'log', who: 'Claude Code (build log)', date: '2026-09-25', text: t };
    });
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
  function load(v, fetchText, splitLines, fetchBytes) {
    if (!v.build) return Promise.resolve({ version: v, parts: [], files: [] });
    var F = root.SWFiodec || (typeof require === 'function' ? require('./fiodec.js') : null);
    return Promise.all(v.build.map(function (b) {
      if (!b.tape) return fetchText(b.src);
      return fetchBytes(b.tape).then(function (bytes) { return F.decode(bytes).text; });
    })).then(function (texts) {
      var parts = v.build.map(function (b, i) {
        var raw = texts[i];
        var norm = raw;
        (v.transforms || []).forEach(function (k) { norm = TRANSFORMS[k].fn(norm); });
        (b.patch || []).forEach(function (pp) { norm = norm.split(pp[0]).join(pp[1]); });
        var title = b.title;
        if (!title && b.titleMatch) title = findTitle(splitLines(raw));
        return { src: b.src || b.tape, tape: !!b.tape, role: b.role || 'program', raw: raw, text: norm, patch: b.patch || null,
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
