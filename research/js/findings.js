/*
 * findings.js - what the bench has established, in one citable place: the
 * discoveries recorded in the build logs, each with its evidence (lines in
 * the source, tapes in sources/), the witness tapes and punched titles
 * checked afresh on every visit, and the group's own notes tagged "finding".
 */
(function (root) {
  'use strict';
  var SW = root.SW, V = root.SWVersions, N = SW.notes;
  var view = SW.$('#view-findings');

  // Evidence is either a line, found by pattern in a version's assembled
  // source (so it survives renumbering), or a tape image in sources/.
  var FINDINGS = [
    { no: 'F1', kind: 'Rebuild', title: 'The reconstructed 2B source rebuilds the April 1962 binary exactly',
      text: 'Landsteiner’s 2014 reconstruction of the 2B source, assembled with the 1962–63 MACRO rules, reproduces bin-files/spacewar2B_2apr62.bin word for word (2,297 words); with macro1’s rule 174 words differ, all variable addresses. The tape’s own punched title reads “SPACEWAR 2B 2 APR 62”.',
      ev: [{ v: '2b', tab: 'tape', label: 'witness in the Tape view' }, { tape: 'bin-files/spacewar2B_2apr62.bin' }] },
    { no: 'F2', kind: 'Assembler', title: 'MACRO allotted overlined variables when a macro was defined',
      text: 'The 3.1 source rebuilds newSpacewar_4-30-60.bin exactly only if variables are allotted as they first occur in macro definitions (\\ssn and \\scn in xincr and yincr come first). With macro1’s own rule 62 words differ, every one a variable address. The bench’s “1962–63” dialect follows the tapes.',
      ev: [{ v: '3.1', re: /^xincr\b/, label: 'the xincr macro' }, { tape: 'bin-files/newSpacewar_4-30-60.bin' }] },
    { no: 'F3', kind: 'Assembler', title: 'MACRO read a macro line whole, tab and all',
      text: 'The dispt macro writes “repeat 6<tab>B=B+B”. Cut at the tab, as macro1 does, the display instructions come out wrong in two words; read whole, as the dfw tapes show MACRO did, they match.',
      ev: [{ v: '4.1', re: /repeat 6\s+B=B\+B/, label: 'repeat 6 B=B+B' }] },
    { no: 'F4', kind: 'Rebuild', title: 'Russell’s punched 3.1 source tapes rebuild the 3.1 binary',
      text: 'Decoded from FIO-DEC with every frame passing the parity check, the three 3.1 source tapes (program in two parts, star table) rebuild newSpacewar_4-30-60.bin exactly, with no transcription in between.',
      ev: [{ v: '3.1t', tab: 'tape', label: 'source tapes in the Tape view' }, { tape: 'SteveRussell_box1/spacewar3.1pt1_29sep62.bin' }] },
    { no: 'F5', kind: 'Tape', title: 'The 3.1 source tapes are titled 24 September, filed as 29 September',
      text: 'The tapes carry the title line “spacewar 3.1 24 sep 62” though the files are named 29sep62.',
      ev: [{ v: '3.1t', re: /spacewar 3\.1/i, label: 'the title line' }] },
    { no: 'F6', kind: 'Tape', title: 'A mis-punch on the 3.1 pt 1 tape',
      text: 'In a comment, “calling s?quence” has code 035 where “e” (065) belongs, one hole short. Parity is still odd, so the fault is in the punching, not the reading.',
      ev: [{ v: '3.1t', re: /calling s.quence/, label: 'the line' }, { tape: 'SteveRussell_box1/spacewar3.1pt1_29sep62.bin' }] },
    { no: 'F7', kind: 'Difference', title: 'Russell’s 3.1 object tape carries a different star table',
      text: 'Against spacewar3.1_24-sep-62.bin the 3.1 source differs in 27 words, all in the star table, and the tape is four words shorter. The second word for 91 Aqar differs (652375 against 622377), 6 Pisc is absent so the following stars sit two words lower, and the table ends before 2 Ceti. The program code is identical.',
      ev: [{ v: '3.1', re: /\/\s*6 Pisc/, label: '6 Pisc' }, { v: '3.1', re: /\/91 Aqar/, label: '91 Aqar' }, { tape: 'SteveRussell_box1/spacewar3.1_24-sep-62.bin' }] },
    { no: 'F8', kind: 'Difference', title: 'The Expensive Planetarium makes its stars bright in two ways, and the versions switch between them',
      text: 'Every version draws the star table the same way (dislis: the stored X less fpr, a window of 1,024 units, 45 degrees of sky square on the scope), but brightness and drift differ. 2B draws each group at one intensity and makes the bright ones bright by redrawing them: group 1 twice a pass (jsp 1m at the start and end of bck), group 2 once, group 3 every second pass, group 4 every fourth; the sky drifts one unit every 32 passes (law i 40), sense switch 3 holds it, switch 4 speeds it to every 5 passes. That is the 2 April tape; the 25 March listing tests switches 3 and 4 the other way round (szs i 30, szs 40), so with every switch off it draws no stars, and the sky moves only with switch 3 on. From 3.1 (and in 4.0, 4.1, 4.8 and 2015) the groups are drawn together every second pass with intensities 3, 2, 1, 0 set into the display instruction (dislis 1j,1q,3 … 4j,4q,0; dpy-i+B), drifting every 16 star frames, still 32 passes; sense switch 4 turns the stars off. 4.0TS draws only groups 1 to 3. The ddp line (the Morris listings of 4.2, 4.3 and 4.4, and the masswerk 4.4) returns to redrawing, but drifts every 8 passes (law i 10), four times as fast. The masswerk 4.3 is Landsteiner’s fixed version (“spacewar 4.3f … mod. nl 2/28/2015”): it replaces 4.3’s star display with 3.1’s, among changes marked with // comments (“background as in spacewar 3.1, 4.0, and versions by dfw”), and keeps the original loop commented out. The CHM 4.1 revisions keep intensities but change them to 3, 1, 7, 4 (“intensities 7,6,5,4 would be dimmer; 3,2,1,0 brighter”), with the timings moved into the constants bkf and bks. See it run in The sky’s star map, “On the scope”.',
      ev: [{ v: '2b', re: /^1m,\s*dislis/, label: '2B: 1m, dislis 1j,1q' }, { v: '3.1', re: /dislis 1j,\s*1q,\s*3/, label: '3.1: dislis 1j,1q,3' }, { v: '4.3', re: /isp bkc/, label: 'Morris 4.3: isp bkc, law i 10' }, { v: '4.3m', re: /dislis 1j,\s*1q,\s*3/, label: 'masswerk 4.3: dislis 1j,1q,3' }, { v: '4.1f', re: /dislis 3j,\s*3q,\s*7/, label: 'CHM 4.1f: dislis 3j,3q,7' }] },
    { no: 'F9', kind: 'Difference', cat: 'game', title: 'The gravity computation changed between 3.1 and 4.0, and the star capture radius with it',
      text: 'The constant str (star capture radius) is 1 in 3.1 and 100 from 4.0 on. MACRO reads numbers in octal, so 100 is 64. The two values are not on one scale. str is subtracted from the squared distance to the star: 3.1 works that out from x and y shifted right eleven bits and squared by the BBN subroutine imp (“returns low 17 bits”), 4.0 from the full coordinates squared by the hardware multiply (mul), part of Preonas’s reworking of the gravity for the automatic multiply/divide. Norbert Landsteiner (28 Sep 2026) reads the new value as following from that change; in Inside Spacewar! part 6 he reads 4.0’s 100 as 3.1’s 1 shifted six places, the same test. The reach agrees, but not the shape: measured on the emulator, 3.1’s capture region is not round: a ship at rest is captured nearer than 16 screen points along the x axis but only nearer than about 11.5 along the diagonal, the shape of a plus sign, since the coordinates are cut to eighths before squaring (caught when one is under 16 and the other under 8); 4.0 captures nearer than about 16 in both directions (Graphics ▸ Gravity). The emulator reproduces Norbert Landsteiner’s table of bx and by for 3.1 and 4.x exactly. See also F22.',
      ev: [{ v: '3.1', re: /^\s*str,/, label: 'str in 3.1' }, { v: '3.1', re: /^\s*sub str/, label: 'sub str in 3.1' }, { v: '4.0', re: /^\s*str,/, label: 'str in 4.0' }, { v: '4.0', re: /^\s*sub str/, label: 'sub str in 4.0' }] },
    { no: 'F10', kind: 'Rebuild', title: 'The dfw 4.1 source rebuilds two authentic binaries, once ioh is 760000',
      text: 'With “ioh” defined as 760000, the dfw transcription and Russell’s punched source tape both rebuild spacewar4.1_2-20-63_dfw.bin and spacewar4.2a_sa4.bin exactly (2,364 words). The February 1963 macro system therefore defined ioh differently from the June 1963 macro tape that survives.',
      ev: [{ v: '4.1', tab: 'tape', label: 'witnesses in the Tape view' }, { tape: 'SteveRussell_box1/spacewar4.1_2-20-63_dfw.bin' }, { tape: 'bin-files/spacewar4.2a_sa4.bin' }] },
    { no: 'F11', kind: 'Tape', title: 'The tape called sw4.2 is the 20 February 4.1, with one lost hole',
      text: 'SteveRussell_box1/sw4.2.bin differs from the 4.1 build in one word only (isp 3043 against 3042 at 2333, “count \\src,sq7”). Its own checksum shows why: the checksum punched after the block 2300 to 2400 is 7262, the same as on the dfw tape, but the block’s words sum to one less, so one hole (the lowest bit) was lost in punching or reading. It is the same assembly as the 20 February dfw tape, and its leader is punched “SPACEWAR 4.1 2/20/63 DFW”, the letters packed with no gaps, so the tape filed as 4.2 names itself as that 4.1.',
      ev: [{ v: '4.1', re: /count\s+[\\.~]src,\s*sq7/, label: 'count \\src,sq7' }, { tape: 'SteveRussell_box1/sw4.2.bin', from: 44 }] },
    { no: 'F12', kind: 'Tape', title: 'Every block checksum on the object tapes checks, except one',
      text: 'Read block by block (Tape view, Anatomy), the object tapes carry 39 to 56 checksummed blocks each after the same 21-word read-in loader, and every checksum agrees with its words except block 2300 to 2400 on sw4.2.bin, off by one: run through the tape’s own loader (Load tape), that block stops the machine at the loader’s hlt. The 2B tape ends without a closing jump to a start address, so the loader is left waiting for the reader; the dfw 4.1 tape’s program ends with jmp 7751, back into the loader, which reads on into a second part (below).',
      ev: [{ tape: 'SteveRussell_box1/sw4.2.bin', from: 4039 }, { tape: 'bin-files/spacewar2B_2apr62.bin' }, { tape: 'SteveRussell_box1/spacewar4.1_2-20-63_dfw.bin' }] },
    { no: 'F13', kind: 'Tape', title: 'The dfw object tape carries Spacewar! 4.1’s symbol table after “SPACEWAR SYMZ”',
      text: 'The program’s blocks on spacewar4.1_2-20-63_dfw.bin end with jmp 7751, which sends the machine back into the loader. After the punched letters “SPACEWAR SYMZ” (frames 7963–8039) the loader reads on: 12 more blocks, every checksum good, 719 words at 6432–7750, then jmp 1411. They are 359 pairs of name and value, and one last word at 7750, 206432 (lac 6432, the address of the table’s first word). Each name is three six-bit FIO-DEC concise characters, bit 040 flipped: in the first character when bit 020 is clear, in the second and third when it is set (1j is 414100, acx 612367, clc 634323). Decoded, the names run in alphabetical order (0 sorting after the letters). All 235 symbols of the 4.1 build are there with the build’s values (1j 6077, 1q 6117, 1sc 3024, acx 3035, col 1463, …), with 124 permanent symbols of MACRO: the instructions (add, dac, jmp, law, …), the in-out codes (dpy 730007, cks 720033, …), i (10000) and the shift counts 1s to 9s (1, 3, 7, … 777). Names are cut to three characters, as MACRO’s symbols were. This is the symbol table of the assembly, punched after the program, which fits the title “SYMZ”. Loaded through to its end, the tape overwrites the star table at 6432–7750 in core. Found by running the tape through its own loader (Tape view, Tape Load Simulator).',
      ev: [{ tape: 'SteveRussell_box1/spacewar4.1_2-20-63_dfw.bin', from: 7963 }, { v: '4.1', re: /^1j,/, label: '1j, the star table’s first label' }] },
    { no: 'F14', kind: 'Transcription', title: 'The dfw transcription agrees with the punched tape in 1,135 of 1,138 lines',
      text: 'The three differences are the scan label “>>32<< 1”, a stray “_” at the end, and the tape’s overstruck “‾+” (±) in a comment, transcribed as “.+”.',
      ev: [{ v: '4.1t', label: 'the source tape, read' }, { v: '4.1', label: 'the transcription' }] },
    { no: 'F15', kind: 'Difference', title: 'Spacewar! 4.4 uses swp, a PDP-1D instruction that exchanges AC and IO',
      text: 'Up to 4.3 the outline compiler (ocs) plants each exchange of AC and IO in the compiled ship code as two words, rcl 9s and rcl 9s. In 4.4 it plants one, swp, defined in the listing itself (“swp=opr 60”), and swp is used by hand elsewhere in 4.4. DEC’s PDP-1 Supplement (PDP-1D-45, 1964) lists 760060 swp (exchange AC and I/O) with 760020 lia (I/O from AC) and 760040 lai (AC from I/O). The 4.8 scorer uses lai after reading the control word (jsp cwg). The June 1963 macro tape defines none of the three. Until 1.14.9 the bench’s emulator did not implement them, and 4.4’s ships were drawn as flat lines.',
      ev: [{ v: '4.4', re: /swp=opr 60/, label: 'swp defined in 4.4' }, { v: '4.3', re: /lio \(rcl 9s/, label: 'rcl 9s in 4.3' }, { v: '4.8', re: /^\s*lai\s*$/, label: 'lai in the 4.8 scorer' }] },
    { no: 'F16', kind: 'Transcription', title: 'Russell’s 3.1 tapes read “skp” and “marc” where the 3.1 transcription has “skip” and “mark”',
      text: 'In the integer square root (sqt) the pt 1 tape has “sma+sza-skp”; the 3.1 transcription has “sma+sza-skip”, as do the modern texts of 1 and 2B, while every text from 4.0 on has “skp”. On the tape’s evidence sqt is unchanged from 3.1 to 4.0. In the star table the pt 3 tape has “marc 1260, -283” (26 Erid), and so does stars.bin, where the transcription and the other star tables have “mark”. Neither changes the program: skip and skp are both 640000, and the assembler (as macro1 does) recognises a macro by its first three letters, so “marc” calls mark. The tapes rebuild the 3.1 binary exactly.',
      ev: [{ v: '3.1t', re: /sma\+sza-skp/, label: 'skp on the tape' }, { v: '3.1', re: /sma\+sza-skip/, label: 'skip in the transcription' }, { v: '3.1t', re: /marc 1260/, label: 'marc on the tape' }, { tape: 'SteveRussell_box1/spacewar3.1pt3_29sep62.bin' }, { tape: 'SteveRussell_box1/stars.bin' }] },
    { no: 'F17', kind: 'Transcription', title: 'The masswerk 4.3 is Landsteiner’s fixed version of 2015, not a second reading of the Morris listing',
      text: 'Its title line reads “spacewar 4.3f 5/17/63 ddp; mod. nl 2/28/2015”, and Landsteiner publishes it as not an authentic program. Of its 69 lines with // comments, 18 name him and 2015 (16 as “N.L. 2015”). The changes repair the Needle’s subjective view on sense switch 2 (ddispt, ox1 and oy1, bpy, torpedo positions), replace 4.3’s star display with 3.1’s (the original loop kept, commented out), and simplify how the scorer reads the controls. The Morris listing’s line “/ the score-display digit encoder” has no counterpart in it. The bench showed it as a reading of 4.3 until 29 September 2026; it is now 4.3f, a later version descended from 4.3.',
      ev: [{ v: '4.3', re: /score-display digit encoder/, label: 'Morris' }, { v: '4.3m', re: /N\.L\. 2015/, label: 'first N.L. 2015 line' }] },
    { no: 'F18', kind: 'Anomaly', title: 'All three 4.4 texts execute a reserved opcode',
      text: 'The line “4<tab>szf 4” assembles as a data word 000004 in the path of execution. Opcode 00 is reserved on the PDP-1; the bench’s emulator reports it rather than guessing what the machine did.',
      ev: [{ v: '4.4', re: /^4\tszf 4/, label: '4.4 Morris' }, { v: '4.4m', re: /^4\tszf 4/, label: 'masswerk' }, { v: '4.4f', re: /^4\tszf 4/, label: 'variant f' }] },
    { no: 'F19', kind: 'Difference', title: 'Angular acceleration quadrupled in 4.8',
      text: 'The constant maa (spaceship angular acceleration) is 40 in 4.8 and 10 in every other version.',
      ev: [{ v: '4.8', re: /^\s*maa,\s*13,\s*40/, label: 'maa in 4.8' }, { v: '4.1', re: /^\s*maa,/, label: 'maa in 4.1' }] },
    { no: 'F20', kind: 'Difference', title: 'The CHM 4.1 revisions have lost a star',
      text: 'The Computer History Museum’s 4.1d and 4.1f have 468 stars against the 469 of 4.1; “26 Erid” (mark 1260, −283) is missing.',
      ev: [{ v: '4.1', re: /26 Erid/, label: '26 Erid in 4.1' }, { tape: 'spacewar-4.1-chm-2008f.rim' }] },
    { no: 'F21', kind: 'Tape', title: 'Every object tape opens with the same read-in loader',
      text: 'The first 128 punched frames of the object tapes are one and the same RIM loader, the program the PDP-1 read in to load the blocks that follow. It is not part of Spacewar!, and differences between tapes begin after it.',
      ev: [{ tape: 'bin-files/newSpacewar_4-30-60.bin' }] },
    { no: 'F22', kind: 'Difference', cat: 'game', title: 'Left alone, the ships collide at the centre in 3.1 and at the corner from 4.0',
      text: 'Run in the emulator with no controls and the sense switches off, 3.1’s two ships fall toward the star and collide with each other near the centre, on the 334th frame, about 14.8 seconds in. From 4.0 on (4.0, 4.0TS, 4.1, 4.2, 4.3, 4.8, CHM 4.1f and 2015 alike) the star captures both first, on the 353rd frame, 11.4 to 14.0 seconds in (4.0 and 4.0TS, with the shorter frame budget, soonest; times measured again on 29 September 2026, after the emulator’s display timing was corrected and the 4.0 transcription’s jmp srt restored): pof sets each ship’s x and y to 377777, the corner at 511, 511, where the two now coincide and explode. The pof code is the same in both. Norbert Landsteiner explains the rest, and the emulator bears it out: on the diagonal, the path the ships fall along, 3.1’s pull is zero nearer than about 22.5 screen points (its f(x, y) rounds to zero), so the ships coast in and collide before they reach its capture radius of about 11.5; in 4.x the pull continues, the capture radius is about 16 (F9), and the ships are captured before their collision boxes overlap. With sense switch 5 on, a captured ship explodes where it is. Norbert Landsteiner describes the 4.x explosion as appearing at the four corners, and found no value of str that gives both a collision at the centre and a capture radius close to the size of the sun.',
      ev: [{ v: '3.1', re: /^pof,/, label: 'pof in 3.1' }, { v: '4.0', re: /^pof,/, label: 'pof in 4.0' }, { v: '4.0', re: /^\s*str,/, label: 'str in 4.0' }] },
    { no: 'F23', kind: 'Difference', cat: 'machine', title: 'Landsteiner’s 4.4f runs about 14% slower, because it draws every star on every frame',
      text: 'Left alone, the ships of 4.4 and of 4.4f fall identically frame by frame and explode on the same frame, the 351st. On the emulator a frame of 4.4f takes 9,242 machine cycles against 8,082 (21.6 frames a second against 24.7), and the background star display (bck) accounts for almost all of the difference. (Measured again on 29 September 2026, after the emulator’s display timing was corrected; before, 11,007 against 9,594.) Landsteiner’s 2015 fix comments out the lines that drew the fainter star groups only on alternate passes (idx bcc … and bcc), to “show all magnitudes each frame”. The game’s speed follows the length of its frames, so a change to the display changes its tempo. See Graphics ▸ Gravity, The ships falling.',
      ev: [{ v: '4.4m', re: /^\s*idx bcc/, label: 'idx bcc in 4.4 (masswerk)' }, { v: '4.4f', re: /^\/\s*idx bcc/, label: 'idx bcc commented out in 4.4 (variant f)' }] },
    { no: 'F24', kind: 'Difference', cat: 'game', title: 'Torpedoes fly straight: the warpage term is written in but set to nothing',
      text: 'Every frame the torpedo routine (tc1) adds to a torpedo’s dy its x, and to its dx its y, each shifted right 9 places and then by the constant the. In 3.1 and every 4.x version the is sar 9s, so the term is shifted 18 places in an 18-bit word and comes to nothing: on the emulator a torpedo’s track is straight to within rounding. Measured on the emulator with the changed in core, sar 8s still gives the same track; from sar 7s the term acts, a torpedo fired from the Needle’s start ending 2 points short, and from sar 6s it bends the track (a tenth of a point over a torpedo’s life; 0.7 at sar 4s; 20 at sar 1s, which also slows it by a third). dy gains the torpedo’s x and dx its y, with the same sign, so the field is a saddle, not a circle: it pushes torpedoes out along the diagonal x = y and draws them in along x = −y. (A circle, as in Minsky’s algorithm, to which Landsteiner likens the term in Inside Spacewar! part 7, needs opposite signs.) He gives Levy’s “Winds of Space” as a variant made through this constant. 2B has no warpage term. The star does not pull torpedoes in any version. See Graphics ▸ Torpedoes.',
      ev: [{ v: '3.1', re: /^the,/, label: 'the in 3.1' }, { v: '3.1', re: /^tc1,/, label: 'the torpedo routine, 3.1' }] },
    { no: 'F25', kind: 'Rebuild', cat: 'machine', title: 'The Morris 4.0 listing carries a patch to record and replay a game',
      text: 'After the program, the Morris listing of 4.0 has a “spacewar game saver patch”. At 40 its control routine (cwr), with the test word positive, reads the control boxes and punches each control word on paper tape (ppa); with the test word negative it reads the control words back from the tape reader (rrb) instead. A new start at 6000 (go) either punches the random-number word ran on tape or reads it back into ran and starts the game. Since the program is otherwise deterministic, the starting word and the control words are enough to play a game again exactly. Read from the code; the bench’s emulator has no punch or reader, so the patch has not been run.',
      ev: [{ v: '4.0', re: /game saver patch/, label: 'the patch, 4.0' }, { v: '4.0', re: /^cwr,\s*dap cwx/, label: 'cwr, the control routine' }, { v: '4.0', re: /^\s*dio ran/, label: 'dio ran' }] },
    { no: 'F26', kind: 'Difference', cat: 'game', title: '2B’s random numbers differ from 3.1’s, and 2B does not set where they start',
      text: 'The random macro rotates ran right one place, then exclusive-ors and adds a constant: 335671 in 2B, 355670 from 3.1 on. Run on the emulator over all 262,144 words, 3.1’s generator has 8 cycles, one of them 261,652 long, which the sequence from 0 joins after two numbers; 2B’s has 12, the longest 144,758 and 103,861. From 3.1 on ran is in the constants table, punched on the tape as 0; in 2B it is a variable with no value punched (the bench rebuilds the 2B tape exactly), so 2B started from whatever the core held. Landsteiner counts the same 261,654 values from 0 and finds a fixed point, 225241, which the emulator confirms; the macro comes from the TX-0 memo M-5001-19-1, “Some Useful Micro- and Macro-Instructions” (23 August 1961), as Samson pointed out to him (Now Go Bang!, “Anatomy of a Random Number Generator”, 2018). See Graphics ▸ Random numbers.',
      ev: [{ v: '2b', re: /xor \(335671/, label: 'xor (335671 in 2B' }, { v: '3.1', re: /xor \(355670/, label: 'xor (355670 in 3.1' }, { v: '3.1', re: /^ran,/, label: 'ran in 3.1' }] },
    { no: 'F27', kind: 'Difference', cat: 'machine', title: 'The control word is laid out differently from version to version',
      text: 'Found on the emulator by holding each of the 18 control bits in turn. In 2B, 3.1, 4.0, 4.0TS, the 4.1 texts (with the CHM revisions), the masswerk 4.3 and 2015 the first ship (the Needle) takes the high four bits (ccw 400000, cw 200000, rocket 100000, torpedo 040000) and the second the low four. All three 4.4 texts and 4.8 rotate the word right four places after iot 11 (rir 4s in mg1), so the Needle takes the low four bits and the Wedge bits 200 to 20. The Morris 4.2 and 4.3 read two words, iot 11 and iot 111, and parse each, without clearing IO first; the emulator gives both the same word, so there every bit moves both ships. That hardware was not the standard boxes: Landsteiner quotes Joe Morris’s note that the 4.2 listing came with notes on which buttons of a surplus drone controller set which bits, and Dan Edwards identified it as a Bomarc missile console arm panel (Inside Spacewar! part 5). Since the routine does not clear IO, the bench has this hardware load IO, where the standard boxes are ORed into it. The bench now fits its keys to each version.',
      ev: [{ v: '3.1', re: /^mg1,/, label: 'mg1 in 3.1' }, { v: '4.8', re: /^mg1,/, label: 'mg1 in 4.8' }, { v: '4.2', re: /^\s*iot 111/, label: 'iot 111 in 4.2' }] },
    { no: 'F28', kind: 'Anomaly', cat: 'display', title: 'Every ship plots a stray point at the centre of the screen, every frame',
      text: 'Just before a ship’s outline is drawn, the ship routine clears both registers and issues a display instruction: cla cli-opr, then dpy-4000, then the jump into the compiled outline (sp5), which returns to sq6, ioh. The point lands at (0, 0), the centre of the screen, once for each ship in every frame, in every version from 2B on (the 4.4 texts do it through xct db2, their two-scope display, and relocate it first: see below); the Spacewar! 1 reconstruction does not. It normally hides under the star. With sense switch 6 on, which turns the star off, the star’s points near the centre fall from 281 to 5 in ten frames on the emulator, and the stray point stays, twice a frame. It is there to start the display: the outline plots each point with dpy-4000, which does not wait but asks for the display’s completion pulse, and the next ioh waits for that pulse, so the first ioh needs a plot before it. DEC’s preliminary in-out manual (FP-25, Table I and its sample loop) documents the pairing, and Landsteiner gives this reading (Inside Spacewar! part 2, “The Ominous dpy-4000 Instruction”; Now Go Bang!, “Spacewar 1”, 2021), adding that the dot may have given rise to the central star; the sun routine opens with the same pattern. In 4.4, and in 4.3 with sense switch 2 on, the point goes through kcb (cla cli-opr, jda kcb), which subtracts the centred ship’s place, so it lands where the star is drawn; on 4.4’s Needle’s console the kcb fault (F33) leaves it at the centre. The bench’s Orbits animation showed it as dots flying out of the star when it moved the ship’s outline with the ship; the bench now leaves the point out of ship outlines.',
      ev: [{ v: '3.1', re: /^sp5,/, label: 'sp5, with cla cli-opr and dpy-4000 just before it, 3.1' }, { v: '4.4', re: /^mot,\s*sp5,/, label: 'mot, sp5, with xct db2 just before it, 4.4' }] },
    { no: 'F29', kind: 'Difference', cat: 'game', title: 'In 2B objects collide from further away: its collision area is 1.8 times 3.1’s',
      text: 'The collision test (col) calls a hit when |dx| and |dy| are each under me1 and |dx| + |dy| is under me1 + me2: an octagon. Measured on the emulator, with the Wedge set at every offset up to 30 screen points from the Needle for one frame, 469 of 3,721 offsets collide in 3.1, 4.0 and 4.8 (me1 6000, me2 3000: 12 and 6 points), and 849 in 2B (me1 10000, me2 4000: 16 and 8 points). The measured shape fills the octagon the constants give. The same test serves torpedoes. See Graphics ▸ Collision shape.',
      ev: [{ v: '2b', re: /^me1,/, label: 'me1 in 2B' }, { v: '3.1', re: /^me1,/, label: 'me1 in 3.1' }, { v: '3.1', re: /^me2,/, label: 'me2 in 3.1' }] },
    { no: 'F30', kind: 'Difference', cat: 'game', title: 'Hyperspace is roulette: each breakout adds an eighth to the chance of exploding',
      text: 'At each breakout (hp3) the ship’s uncertainty mh4 grows by hur (40000 octal, an eighth of the range of the random numbers); a random number with its sign bit set is added, and if the sum comes out positive the ship explodes. So the chance at the nth breakout is about n in 8, and mhs (law i 10) allows 8 jumps. In 120 trials on the emulator in 3.1 (and identically in 4.0) the measured chances were 10%, 24%, 41%, 58% at the first four breakouts, and every ship had exploded by its eighth. The bench cut the waits short and put the ship back after each jump; the odds are the program’s. See Graphics ▸ Hyperspace roulette.',
      ev: [{ v: '3.1', re: /^hur,/, label: 'hur in 3.1' }, { v: '3.1', re: /^hp3,/, label: 'hp3, the breakout, 3.1' }, { v: '3.1', re: /^mhs,/, label: 'mhs in 3.1' }] },
    { no: 'F31', kind: 'Difference', cat: 'display', title: '4.4 draws on two displays: its second is addressed as DEC’s second CRT',
      text: '4.4 toggles sense flag 4 each frame and sets its display instruction from dj5 (dpy-i, 720007) or dj6 (dpy-i 400, 720407); the kcb routine subtracts the chosen ship’s position, so each frame is centred on one ship. DEC’s PDP-1 Handbook of October 1963 (F-15D, In-Out Transfer Group) lists dpy 720007, display one point, for the Precision CRT Display Type 30, and dpp 720407, display one point on the Ultra-Precision CRT, for the Type 31, a separate five-inch display with 4,096 points a side (its own address, 0407). So 4.4’s alternate frames are addressed to a second display, not drawn more faintly on the first; on the emulator frames with 720007 are centred on the Wedge and those with 720407 on the Needle. Which display MIT used as the second console is not recorded in the handbook. Monty Preonas, writing to Landsteiner (Inside Spacewar! part 10), recalls a new PDP-1-compatible oscilloscope available for three or four months, first used only as a second pilot’s console; the game “worked very well”, but they were left with a double “twin” star because of the every-other-frame arrangement, and ran out of time to fix it. He says his annotated listing went to the New Mexico Museum of Natural History & Science in Albuquerque. A later DEC manual (PDP-35-2, 1971) reads the same bits of dpy as brightness (4, visible to photomultiplier tubes only). The bench’s Run view shows 4.4 on two scopes. Run on the emulator with every sense switch setting, only the three 4.4 texts use a second display; every other version uses the Type 30’s own addresses (0007, 4007 and brightness variants). The CHM 4.1f also plots with 0407, but as brightness 4 for its dimmest stars, on the one display of the restored machine; 4.3’s subjective view (sense switch 2) recentres its one display on the Needle.',
      ev: [{ v: '4.4', re: /^dj5,/, label: 'dj5, dpy-i' }, { v: '4.4', re: /^dj6,/, label: 'dj6, dpy-i 400' }] },
    { no: 'F32', kind: 'Transcription', cat: 'text', title: 'The Morris 4.2 and 4.3 transcriptions misread dpy-i as dpy-1, and so drew no stars',
      text: 'In the star-display macro (dislis) of both Morris transcriptions the plotting instruction read dpy-1: dpy less one, 730006, an instruction for device 06 rather than the display (07). Run, the background stars were computed every frame and never shown. The scans (page 10 of each) read dpy-i, the display instruction without the wait, as 3.1 has it; corrected on 28 September 2026, the two now draw their stars (175 points in ten frames on the emulator). The fault was found by listing every display address each version uses.',
      ev: [{ v: '4.2', re: /scan p\. 10 reads dpy-i/, label: 'dpy-i in 4.2’s dislis' }, { v: '4.3', re: /scan p\. 10 reads dpy-i/, label: 'dpy-i in 4.3’s dislis' }] },
    { no: 'F33', kind: 'Anomaly', cat: 'display', title: '4.3 and 4.4 place the sun correctly only with the short tape fed in after pass 1; 4.4’s kcb misplaces the Needle’s stars',
      text: 'Norbert Landsteiner described these display faults in 2015 (Inside Spacewar!, part 9 on 4.3’s “split star” and part 10, “Spacewar 4.4, A Twofold Stand”, masswerk.at), and his 4.4f fixes them. (1) The sun routine (bjl in 4.4, the ego-view branch of bpt in 4.3) subtracts nx1 and ny1 before the assignment nx1=mtb nob, and mtb is defined only at the end of the program. Assembled from the listing alone, pass 2 uses what pass 1 left: in macro1, 30 and 60. The Wedge’s console in 4.4 then places the sun from locations 31 and 61 (ran, the random number, and tyi, 720004), so it jumps along one line 95 points above the centre; the Needle’s console places it from 30 (hur, 40000) and 60 (0). The pass logs at the end of both Morris listings (scan p. 31) show what MIT did. After pass 1 of the program and the star tape, a short tape was read on pass 1 only: in 4.4 “foo”, with nx1=mtb nob, ny1=nx1 nob and start; in 4.3 “f”, with a first try assigning nx1 alone and then both. Pass 2 therefore had the final values (3452 and 3502 in 4.4), and the sun was placed correctly. The bench assembles 4.3, 4.4 and the masswerk 4.4 text with that tape; Run’s “Fix Sun Rendering Bug” box, unticked, leaves it out. The tape changes those words only (four in 4.4, two in 4.3). DEC’s MACRO manual (F-36, 1962, pp. 7 and 9) gives an undefined symbol the value minus zero and says an assignment whose expression is undefined takes no action, so MACRO without the tape would not have given 30 and 60 as macro1 does. (2) In kcb, jmp . 6 counts the swap macro as one instruction, but it assembles as two (rcl 9s, rcl 9s). With flag 4 set, the Needle’s frames, the jump lands on the second rcl 9s of the second swap and returns: the ship’s place is not subtracted, and a single rcl 9s turns the AC:IO pair half round, so each coordinate is made from the other’s low bits. On that console the background stars, torpedoes and explosions are scattered (Landsteiner: “erratic positions”). swap is defined outside the listing; the only definition that survives, two rcl 9s, is on the June 1963 macro tape, later than 4.4. Landsteiner argues it was two words in May 1963 too, since 4.4 defines swp=opr 60 for the one-word exchange and uses both. (3) The background-star loop shows only some magnitudes each frame (counter bcc), so each console shows fewer stars. Landsteiner’s 4.4f (“spacewar 4.4f 5/12/2015 nl”) defines ox1 and oy1 before the sun routine, uses swp in kcb, shows every star each frame, and restores 4.2’s low-gravity switch.',
      ev: [{ v: '4.4', re: /^bjl,/, label: 'bjl, the sun’s relocation' }, { v: '4.4', re: /^nx1=/, label: 'nx1=mtb nob, assigned later' }, { v: '4.4', re: /^kcb,/, label: 'kcb and its jmp . 6' }, { v: '4.4f', re: /^ox1=/, label: 'ox1, Landsteiner’s fix' }] },
    { no: 'F34', kind: 'Difference', cat: 'game', title: 'Sense switch 3 (single shot) does nothing in 3.1, 4.0 and 4.0TS',
      text: 'The torpedo routine is meant to fire once per press with sense switch 3 on: it compares the control word with the previous one, kept in the object’s mco. In 2B the ship routine stores the word there (move \\scw, i mco) and there is no switch: every press fires one torpedo. 3.1, 4.0 and 4.0TS test switch 3 but never store mco, so it stays 0 and holding the button fires a salvo either way. dfw’s 4.1 stores it (dac i mco), and from then on the switch works; 4.2, 4.3, 4.4, 4.8 and the CHM builds have the store. On the emulator, holding the Needle’s fire button for 200 frames launches 13 torpedoes in 3.1, 4.0 and 4.0TS with the switch off or on, 13 or 1 in 4.1, 4.4 and 4.8, and one in 2B. Landsteiner noted it for 3.1 (Inside Spacewar! parts 5 and 6; his sense-switch notes, 2014), placing the fix in version 4; the ddp 4.0 and 4.0TS still lack it.',
      ev: [{ v: '2b', re: /move .scw, i mco/, label: '2B stores the word' }, { v: '3.1', re: /ior i mco/, label: '3.1 reads mco, never stored' }, { v: '4.1', re: /dac i mco/, label: '4.1 stores it' }] },
    { no: 'F35', kind: 'Difference', cat: 'machine', title: 'dfw’s 4.1 lengthened the frame: 4.0 and 4.0TS run faster than 3.1 and 4.1',
      text: 'Each frame the main loop waits out a fixed count, \\mtc: load \\mtc, -4000 in Spacewar! 1, 2B, 3.1, 4.0 and 4.0TS; setup \\mtc, 5000 from 4.1 on (4.2, 4.3, 4.4, 4.8, the CHM builds, 2015). 4.0 already used the multiply/divide hardware, so its frames are the shortest: on the emulator 30.7 and 37.8 ms, alternating, against 40.6 and 47.5 in 3.1 and 35 and 42 in 4.1 and 4.8 (2B about 45; 4.4 about 40). Landsteiner reads the larger count as 4.1 slowing the game back after the hardware arithmetic (Inside Spacewar! part 9); the game’s speed follows the frame, so 4.0 ran about 12% more frames a second than 4.1 and nearly 30% more than 3.1. Measured on 29 September 2026, with the display timing corrected (F22).',
      ev: [{ v: '3.1', re: /load .mtc, -4000/, label: '3.1: -4000' }, { v: '4.0', re: /load .mtc, -4000/, label: '4.0: -4000' }, { v: '4.1', re: /setup .mtc, ?5000/, label: '4.1: 5000' }] },
    { no: 'F36', kind: 'Anomaly', cat: 'game', title: 'The explosion’s size test never fires, in any version',
      text: 'An explosion scatters particles by a shift chosen at msh: mst normally (scr 1s in 3.1 and after; scl 5s in 2B), the next word (scr 3s; scl 2s) for a large explosion. The test at ms1 subtracts 140 (500 in 2B) from \\mxc, which already holds the particle count made negative (cma, sar 3s), so the result is always negative, sma always skips, and idx msh never runs. On the emulator ms1 runs at every explosion and idx msh never, in 2B, 3.1, 4.0, 4.1, 4.4 and 4.8. Landsteiner pointed it out (Inside Spacewar! part 7). 2B’s shift, scl 5s, spreads its particles into a box, Landsteiner’s “crock” explosion, which The Tech of 25 April 1962 describes as “a large luminescent square where your ship was”.',
      ev: [{ v: '3.1', re: /^ms1,/, label: 'ms1, the test, 3.1' }, { v: '3.1', re: /^\s*idx msh/, label: 'idx msh, never reached' }, { v: '2b', re: /^ms1,/, label: 'ms1 in 2B' }] },
    { no: 'F37', kind: 'Difference', cat: 'game', title: '2B’s torpedoes are half as fast, live twice as long and reload half as often as 3.1’s',
      text: 'In 2B a torpedo’s speed is the ship’s heading shifted sar 5s, its life law i 300 and the reload law i 40; 3.1 moved them into the table of constants at 6 to 11 as sar 4s, law i 140 and law i 20. So 3.1’s torpedoes fly twice as fast for half as long, covering about the same range, and fire twice as often. The supply is law i 40 in 2B and law i 41 (“number of torps + 1”) in 3.1: on the emulator 31 torpedoes a ship against 32 (4.1 also 32). The DECUS paper of 1962 says 31. Landsteiner compares the constants (Inside Spacewar! part 7).',
      ev: [{ v: '2b', re: /^trf,\s*law i 300/, label: '2B: life 300' }, { v: '3.1', re: /^tvl,/, label: '3.1: tvl' }, { v: '3.1', re: /^tlf,/, label: '3.1: tlf' }] },
    { no: 'F38', kind: 'Difference', cat: 'game', title: 'What the star does to a ship it catches changes three times in 1962',
      text: 'In the 25 March 2B listing a captured ship is put at the centre and held there, caught again every frame, unless sense switch 5 is on (“switch five gets you out of star”), when it is put at the corner (377777). The 2 April tape reverses the switch (szs i 50): the corner by default, held at the centre with 5 on, as The Tech reported on 25 April 1962 (“if you fall in, you reappear at the corner”); its reconstructed source comments the corner move “now go bang”, though the code only moves the ship. 3.1 makes the corner the default and, with switch 5 on, sets the ship exploding (lac (mex 400000). In every version the short delay pof seems meant to spend (count \\ssn, .) runs once: \\ssn is set from the ship’s positive instruction count, so isp skips at once.',
      ev: [{ v: '2b-pre', re: /switch five gets you out of star/, label: '25 March: szs 50' }, { v: '2b', re: /^po1,.*now go bang/, label: '2 April: po1, corner only' }, { v: '3.1', re: /^po1,/, label: '3.1: po1 explodes' }] },
    { no: 'F39', kind: 'Anomaly', cat: 'game', title: '4.3’s subjective view also misplaces the torpedoes',
      text: 'With sense switch 2 on, 4.3’s ship routine subtracts the Needle’s position (szs 20, sub nx1) from the ship’s place before computing where a torpedo starts, and the torpedo is stored there, in the game’s coordinates, not only drawn there. On the emulator, with switch 2 off the Wedge’s torpedo starts just ahead of it, at (−254, −218) with the Wedge at (−254, −254); with switch 2 on it starts at (−509, −473), displaced by the Needle’s position. 4.4 adds the position back before storing (swp, add nx1); Landsteiner’s 4.3f repairs it too. Landsteiner describes it (Inside Spacewar! parts 9 and 10).',
      ev: [{ v: '4.3', re: /^\s*sub ~ssn$/, label: '4.3: after szs 20, sub nx1, the torpedo’s start' }, { v: '4.4', re: /^\s*add nx1 1$/, label: '4.4 adds it back' }] },
    { no: 'F40', kind: 'Anomaly', cat: 'game', title: '3.1’s hyperspace was meant to need a fresh press of both turn buttons',
      text: 'In 3.1 and 4.0 the trigger is lac \\scw, cma, ior i mco, and (600000: it fires only if both rotate bits are set now and were clear in the previous word, held in mco. Since mco is never stored (F34), holding both buttons is enough. dfw’s 4.1 stores mco but drops it from the test (and (600000, xor (600000). Graetz’s 2B hyperspace patch, not held, fires when both bits are released instead (Landsteiner, Inside Spacewar! part 8).',
      ev: [{ v: '3.1', re: /ior i mco/, label: '3.1: ior i mco' }, { v: '4.1', re: /xor \(600000/, label: '4.1: and, xor 600000' }] },
    { no: 'F41', kind: 'Difference', cat: 'game', title: 'A full torpedo table halts the machine, and Continue does different things',
      text: 'To fire, the program looks for a free object slot. 3.1 and 4.0 search upward from mtb; with none free they halt (hlt, jmp .-1), and pressing Continue halts again at once. From 4.1 the search runs downward, and the halt is followed by jmp sr5, so Continue drops the shot and the game goes on. The bench’s Run continues after a halt, so this can be tried. Landsteiner describes the two (Inside Spacewar! part 5).',
      ev: [{ v: '3.1', re: /^sr1,/, label: 'sr1, 3.1' }, { v: '4.1', re: /sas \(lac mtb-1/, label: '4.1 searches down' }] },
    { no: 'F42', kind: 'Difference', cat: 'game', title: 'Each dot of exhaust burns fuel, and until 4.1 each dot was scaled again',
      text: 'From 3.1 the exhaust loop spends one unit of fuel (count i \\mfu) for every dot of flame; 2B’s loop never touches \\mfu, so 2B burns no fuel. In 3.1, 4.0 and 4.0TS the loop returns to sq7, which scales the ship’s sine and cosine (scale \\sn, 8s …) again for every dot; dfw’s 4.1 moves sq7 below the two scale instructions, so they run once. Landsteiner noted it (Inside Spacewar! part 5).',
      ev: [{ v: '3.1', re: /^sq7,\s*scale/, label: '3.1: sq7 rescales' }, { v: '4.1', re: /^sq7,\s*count i .?mfu/, label: '4.1: sq7 moved' }] },
    { no: 'F43', kind: 'Anomaly', cat: 'game', title: 'Starting at 4 does not clear the scores',
      text: 'Started at 4, the usual start, 3.1 jumps to a6 (a40, jmp a6), two lines after dzm \\1sc and dzm \\2sc, so the score counts keep whatever they held; only a start at 5 (test-word control, a1) goes through a and clears them. Landsteiner reports a handwritten note on a 3.1 listing moving a6 up two lines (Inside Spacewar! part 3). No later version fixes it; the 4.4 texts make the scores assembled words (1sc, 0), so reloading the tape clears them.',
      ev: [{ v: '3.1', re: /^a40,/, label: 'a40: jmp a6' }, { v: '3.1', re: /^a6,/, label: 'a6, after the clearing' }] },
    { no: 'F44', kind: 'Anomaly', cat: 'machine', title: '3.1 and 4.0 still step two properties no longer used, left from 2B',
      text: 'The main loop advances a pointer for every property of the object table. In 3.1 and 4.0 it includes idx \\moc and idx \\mas, which nothing else reads: \\mas is 2B’s “acceleration scale”, a real property there, and \\moc has no use in any text (Landsteiner guesses a leftover or a place kept for a patch, Inside Spacewar! part 3). Both are gone from 4.1.',
      ev: [{ v: '3.1', re: /idx .moc/, label: '3.1: idx moc' }, { v: '3.1', re: /idx .mas/, label: '3.1: idx mas' }, { v: '2b', re: /acceleration scale/, label: '2B: mas used' }] },
    { no: 'F45', kind: 'Difference', cat: 'display', title: 'Making ioh a no-op in 1963 cost nothing: no point comes within 50 µs of the last',
      text: 'The outlines and the sun plot with dpy-4000 and wait with ioh for the display to finish, 50 µs a point (FP-25). In 1963 two texts stop waiting: 4.0TS defines ioh=xct (nop (“delay for dpy’s”), and dfw’s 4.1 tapes were assembled with ioh as 760000, a no-op (F10). On the emulator, with the display timed as DEC documents, no point in 3.1, 4.0, 4.0TS, 4.1, 4.2, 4.4, 4.8 or CHM 4.1f follows the one before within 50 µs: the code between points takes longer than the display, so the wait never held anything up.',
      ev: [{ v: '4.0ts', re: /ioh=xct/, label: '4.0TS: ioh=xct (nop' }] },
    { no: 'F46', kind: 'Difference', cat: 'display', title: 'The Type 30 has two zeros a side, too close together to see',
      text: 'DEC’s handbook (F-15D, 1963) gives the Type 30 “1024 by 1024 addressable locations” and “ones complement binary arithmetic”, with “512 points along each axis” discernible. Ten bits in ones’ complement hold 1,023 values, with +0 and −0 equal, so 1,024 locations means the two zeros are separate places, side by side at the centre: as Landsteiner’s emulator plots them (the ten bits with the sign inverted). The bench plots the value, folding the two zeros together, so a point at −0 appears one place from where the Type 30 put it. Adjacent locations are finer than the 512 the tube could show, so the difference could not be seen.',
      ev: [] },
    { no: 'F47', kind: 'Difference', cat: 'display', title: 'Set ddd to 0 and both ships are Wedges',
      text: 'The constant ddd (at 20, “0 to save space for ddt”) is −0 in every version from 3.1. At start-up the program tests it (lio ddd, spi i): at −0 it compiles the Needle’s outline and then the Wedge’s; at 0 it skips the Needle’s, and both ships are drawn from the Wedge’s compiled code, leaving the Needle’s space free for the debugger DDT. 2B has no such switch. Landsteiner describes it (Inside Spacewar! part 3). Run has a box to try it (“Both ships as Wedges”), for the versions that have ddd.',
      ev: [{ v: '3.1', re: /^ddd,/, label: 'ddd, 3.1' }, { v: '3.1', re: /^\s*lio ddd/, label: 'lio ddd, spi i' }] }
  ];
  // Each finding's number is its own, written above and never changed: a new
  // finding takes the next number, wherever it is placed in the list.
  var FIND = FINDINGS;

  function vLabel(id) { var v = V.byId(id); return v ? v.label.replace(/^Spacewar! /, '') : id; }

  // The line a pattern finds, in the assembled parts of a version.
  function locate(ev) {
    if (!ev.re) return Promise.resolve(null);
    return SW.build(ev.v).then(function (b) {
      for (var p = 0; p < b.lines.length; p++) {
        var ls = b.lines[p];
        for (var i = 0; i < ls.length; i++) if (!ls[i].away && ev.re.test(ls[i].raw)) return { b: b, p: p, n: ls[i].n };
      }
      return null;
    }).catch(function () { return null; });
  }

  function go(ev, at) {
    if (ev.tape) {
      var owner = ev.v || (SW.tape.allTapes().filter(function (t) { return t.path === ev.tape; })[0] || {}).versions;
      var vid = typeof owner === 'string' ? owner : owner && owner[0];
      if (!vid) { window.open(SW.sourceURL(ev.tape), '_blank', 'noopener'); return; }
      SW.state.tapeGo = { path: ev.tape, from: ev.from };
      if (vid !== SW.state.v) SW.select(vid);
      SW.setTab('tape');
      return;
    }
    if (at && !ev.tab) { SW.openAt(ev.v, { p: at.p, n0: at.n }); return; }
    if (ev.v !== SW.state.v) SW.select(ev.v);
    SW.setTab(ev.tab || 'read');
  }

  function evidenceHTML(f, el) {
    var wrap = SW.el('div', { class: 'fd-ev' });
    wrap.appendChild(SW.el('span', { class: 'hint' }, 'Evidence '));
    f.ev.forEach(function (ev) {
      if (ev.tape) {
        var a = SW.el('button', { class: 'btn ghost mono', title: 'Show this tape in the Tape view' + (ev.from ? ', from frame ' + ev.from : '') }, '▤ ' + ev.tape.split('/').pop());
        a.onclick = function () { go(ev); };
        wrap.appendChild(a);
        wrap.insertAdjacentHTML('beforeend', '<span class="fd-gh"><a href="' + SW.esc(SW.sourceURL(ev.tape)) + '" target="_blank" rel="noopener" title="Open ' + SW.esc(ev.tape) + ' on GitHub in a new tab">↗</a></span>');
        return;
      }
      var btn = SW.el('button', { class: 'btn ghost', title: 'Open in ' + vLabel(ev.v) }, vLabel(ev.v) + (ev.label ? ', ' + ev.label : ''));
      var at = null;
      btn.onclick = function () { go(ev, at); };
      wrap.appendChild(btn);
      locate(ev).then(function (r) {
        if (!r) return;
        at = r;
        btn.innerHTML = SW.esc(vLabel(ev.v) + ', l. ' + r.n + (ev.label ? ' (' + ev.label + ')' : '')) + ' ' + SW.refTag(r.b.v.id, r.p, r.n, r.n, r.b.parts.length);
        btn.title = SW.cite(r.b, r.p, r.n, r.n);
        ev.cite = SW.cite(r.b, r.p, r.n, r.n);
      });
    });
    el.appendChild(wrap);
  }

  // ---------- live checks ----------
  var live = { witness: null, titles: null };

  function checkWitnesses(box) {
    box.innerHTML = '<p class="hint">Assembling every version with a witness tape and comparing it word by word…</p>';
    var vs = V.VERSIONS.filter(function (v) { return (v.witnesses || []).length && v.build; }).sort(function (a, b) { return a.sort - b.sort; });
    var rows = [];
    return vs.reduce(function (pr, v) {
      return pr.then(function () {
        return SW.build(v.id).then(function (b) {
          if (!b.asm) return;
          return SW.tape.witnesses(b).then(function (rs) {
            rs.forEach(function (r) {
              var same = r.differ === 0 && r.missing === 0 && r.extra === 0;
              rows.push([vLabel(v.id), { html: SW.sourceLink(r.tape, r.tape.split('/').pop()), text: r.tape, sort: r.tape },
                         r.words, r.differ, r.missing, r.extra,
                         { html: same ? '<span class="badge ok">identical</span>' : '<span class="badge">' + r.differ + ' differ</span>', text: same ? 'identical' : r.differ + ' words differ', sort: same ? 0 : 1 }, v.id]);
            });
          });
        }).catch(function () {});
      });
    }, Promise.resolve()).then(function () {
      live.witness = rows;
      box.innerHTML = '<p class="hint">' + rows.filter(function (r) { return r[6].sort === 0; }).length + ' of ' + rows.length + ' comparisons are identical. Checked ' + SW.fmtDate(SW.today()) + '. Click a row for the word-by-word differences.</p>';
      box.appendChild(SW.table(['Version', 'Tape', 'Words on tape', 'Differ', 'Only in source', 'Only on tape', 'Result'],
        rows.map(function (r) { return r.slice(0, 7); }),
        { cls: ['', 'mono', 'num', 'num', 'num', 'num', ''], onRow: function (r) {
          var hit = rows.filter(function (x) { return x[1] === r[1] && x[0] === r[0]; })[0];
          if (hit) go({ v: hit[7], tab: 'tape' });
        } }));
    });
  }

  function checkTitles(box) {
    box.innerHTML = '<p class="hint">Reading every tape…</p>';
    var tapes = SW.tape.allTapes(), rows = [];
    return Promise.all(tapes.map(function (t) {
      return SW.fetchBytes(t.path).then(function (bytes) {
        SW.tape.titles(bytes).forEach(function (ti) {
          rows.push({ tape: t, t: ti, svg: SW.tape.titleSVG(bytes, ti) });
        });
        return bytes.length;
      }).catch(function () { return 0; });
    })).then(function () {
      live.titles = rows;
      box.innerHTML = '<p class="hint">' + tapes.length + ' tape images read; ' + rows.length + ' punched title' + (rows.length === 1 ? '' : 's') + ' found. The reading matches each five-column letter against the shapes seen on these tapes; “?” marks one not yet known.</p>';
      rows.forEach(function (r) {
        var d = SW.el('div', { class: 'tape-title' });
        d.innerHTML = '<div class="tape-title-img">' + r.svg + '</div><div><b class="mono">“' + SW.esc(r.t.text) + '”</b><br><span class="hint mono">' +
          SW.sourceLink(r.tape.path) + ', frames ' + r.t.from + '–' + r.t.to + (r.tape.versions.length ? ' · ' + r.tape.versions.map(vLabel).join(', ') : '') + '</span></div>';
        var b = SW.el('button', { class: 'btn ghost' }, 'Show on tape');
        b.onclick = function () { go({ tape: r.tape.path, from: r.t.from, v: r.tape.versions[0] }); };
        d.appendChild(b);
        box.appendChild(d);
      });
    });
  }

  // Who added a finding, as a colour: the bench (its build logs) in the beam
  // colour, each person by their initials.
  function hueOf(by) { var h = 0; for (var i = 0; i < by.length; i++) h = (h * 31 + by.charCodeAt(i)) % 360; return (h + 200) % 360; }
  function colourOf(by) { return by === 'bench' ? 'var(--beam)' : 'hsl(' + hueOf(by) + ',62%,60%)'; }
  function legend(people) {
    var el = SW.$('.fd-legend', view);
    if (!el) return;
    el.innerHTML = '<span class="hint">Added by</span> <span class="fd-who"><i style="background:' + colourOf('bench') + '"></i>the bench (build logs)</span>' +
      people.map(function (p) { return ' <span class="fd-who"><i style="background:' + colourOf(p) + '"></i>' + SW.esc(p) + '</span>'; }).join('');
  }
  function mineButton(make, extra) {
    return SW.el('button', { class: 'btn ghost fd-mine', title: 'Put this finding in My notes (private)', onclick: function () { SW.tray.addDoc(make(), extra); } }, '＋ My notes');
  }
  // On a finding of one's own: edit it, move it to the bin, or take it back
  // into My notes (out of the group).
  var undo = [];   // this session: how to reverse each change to the group's findings
  function paintUndo() {
    var b = SW.$('#view-findings .fd-undo'); if (!b) return;
    b.hidden = !undo.length; b.title = undo.length ? 'Undo: ' + undo[undo.length - 1].label : '';
  }
  function did(label, fn) {
    undo.push({ label: label, fn: fn });
    paintUndo();
    SW.toast(label, 0, { label: 'Undo', fn: undoLast });
  }
  function undoLast() {
    var u = undo.pop(); paintUndo(); if (!u) return;
    Promise.resolve(u.fn()).then(function () { SW.toast('Undone'); }, function (err) { SW.toast(err.message, 5000); });
  }
  function ownActions(n, li) {
    var box = SW.el('span', { class: 'fd-own' });
    box.appendChild(SW.el('button', { class: 'btn ghost', title: 'Edit the text and tags', onclick: function () {
      if (SW.$('.fd-edit', li)) return;
      var ed = SW.el('div', { class: 'fd-edit' });
      var keep = (n.tags || []).filter(function (g) { return /^findings?$/i.test(g); });
      var c0 = catOf(n.text, n.tags), l0 = levelOf(n.tags);
      ed.innerHTML = '<textarea rows="4"></textarea><input placeholder="Tags, separated by commas">' +
        '<div class="toolbar" style="position:static;padding-left:0"><label class="check">Importance <select data-e2="lvl">' + LEVELS.map(function (l) { return '<option value="' + l[0] + '"' + (l[0] === l0 ? ' selected' : '') + '>' + l[2] + ' ' + l[1] + '</option>'; }).join('') + '</select></label>' +
        '<label class="check">Category <select data-e2="cat"><option value="">Found from the words (' + SW.esc(CATNAME[catOf(n.text, []).id]) + ')</option>' + CATS.concat([['other', 'Other']]).map(function (c) { return '<option value="' + c[0] + '"' + (!c0.auto && c0.id === c[0] ? ' selected' : '') + '>' + c[1] + '</option>'; }).join('') + '</select></label>' +
        '<button class="btn" data-e="save">Save</button><button class="btn ghost" data-e="cancel">Cancel</button></div>';
      var fpe = SW.figpack.split(n.text);
      SW.$('textarea', ed).value = fpe.text;
      SW.$('input', ed).value = (n.tags || []).filter(function (g) { return !/^findings?$/i.test(g) && !/^(cat|level):/.test(g); }).join(', ');
      ed.addEventListener('click', function (e) {
        var b = e.target.closest('[data-e]'); if (!b) return;
        if (b.dataset.e === 'cancel') { ed.remove(); return; }
        var text = SW.$('textarea', ed).value.trim(); if (!text) return;
        var fpk = SW.figpack.split(n.text); if (fpk.b64) text += '\n\n<!-- sw:fig:gz ' + fpk.b64 + ' -->';
        var tags = keep.concat(SW.$('input', ed).value.split(',').map(function (g) { return g.trim(); }).filter(function (g) { return g && !/^(cat|level):/.test(g); }));
        tags.push('level:' + SW.$('[data-e2="lvl"]', ed).value);
        if (SW.$('[data-e2="cat"]', ed).value) tags.push('cat:' + SW.$('[data-e2="cat"]', ed).value);
        b.disabled = true;
        var was = { text: n.text, tags: (n.tags || []).slice() };
        N.update(n, text, tags).then(function () { did('Finding edited', function () { return N.update(n, was.text, was.tags); }); }, function (err) { b.disabled = false; SW.toast(err.message, 5000); });
      });
      li.appendChild(ed);
      SW.$('textarea', ed).focus();
    } }, '✎ Edit'));
    box.appendChild(SW.el('button', { class: 'btn ghost', title: 'Take it out of the group’s Findings (to the bin, where it can be restored)', onclick: function () {
      if (!confirm('Delete this finding from the group? It goes to the bin, where it can be restored.')) return;
      N.bin(n).then(function () { did('Finding moved to the bin', function () { return N.restore(n); }); }, function (err) { SW.toast(err.message, 5000); });
    } }, '🗑 Delete'));
    box.appendChild(SW.el('button', { class: 'btn ghost', title: 'Take it out of the group and back into My notes, private', onclick: function () {
      if (!confirm('Take this finding out of the group and back into My notes?')) return;
      N.bin(n).then(function () { SW.tray.recall(n); did('Back in My notes', function () { SW.tray.undo(); return N.restore(n); }); }, function (err) { SW.toast(err.message, 5000); });
    } }, '↩ Recall to My notes'));
    return box;
  }
  // Annotations tagged "finding": cards in their author's colour; the first line is the title.
  function checkNotes(box, cached) {
    live.box = box;
    if (!cached || !live.notes) box.innerHTML = '<p class="hint">Gathering the group’s findings…</p>';
    return (cached && live.notes ? Promise.resolve(null) : N.whoami().catch(function () {}).then(function () { return N.listAll({ reactions: true }); })).then(function (all) {
      if (all) live.threads = N.threads(all.filter(function (x) { return x.source !== 'buildlog'; }));
      var list = all ? all.filter(function (n) {
        return !n.parent && (n.tags || []).some(function (t) { return /^findings?$/i.test(t); });
      }).sort(function (a, b) { return String(a.date) < String(b.date) ? -1 : 1; }) : live.notes;
      live.notes = list;
      box.innerHTML = '';
      var people = []; list.forEach(function (n) { if (people.indexOf(n.by) < 0) people.push(n.by); });
      legend(people);
      var mem = SW.$('#view-findings .fd-members');
      if (mem) {
        var cnt = {}; list.forEach(function (n) { cnt[n.by] = (cnt[n.by] || 0) + 1; });
        mem.innerHTML = '<button class="btn ghost' + (!FS.by ? ' on' : '') + '" data-by="">All <span class="faint">' + list.length + '</span></button>' +
          people.map(function (pp) { return '<button class="btn ghost' + (FS.by === pp ? ' on' : '') + '" data-by="' + SW.esc(pp) + '"><i class="fd-dot" style="background:' + colourOf(pp) + '"></i>' + SW.esc(pp) + ' <span class="faint">' + cnt[pp] + '</span></button>'; }).join('');
        mem.onclick = function (e) { var b = e.target.closest('[data-by]'); if (!b) return; FS.by = b.dataset.by; SW.store.set('fd.filt', FS); checkNotes(box, true); };
      }
      if (!list.length) {
        box.innerHTML = '<p class="hint">None from the group yet. Add one with ✎ Add a finding above, or ★ Finding on a selection in Read: it is shared with the group, signed and dated, and shown here in your colour.</p>';
        return;
      }
      var items = list.map(function (n, i) {
        var c = catOf(n.text, n.tags), lvl = levelOf(n.tags);
        return { key: 'n:' + n.id, by: n.by, cat: c, lvl: lvl, order: i, text: refOf(n) + ' ' + n.text + ' ' + (n.tags || []).join(' ') + ' ' + n.by, vids: [n.vid], card: function () { return groupCard(n, i, c, lvl); } };
      });
      grouped(box, items, 'None.');
    });
  }
  // Reactions and ratings on a finding: an emoji, or a rating of one to three
  // stars (a reaction "★1".."★3", one per person), each signed and removable.
  var RATE = /^★([123])$/;
  function emojiOf(t) { return t ? t.reactions.filter(function (r) { return !RATE.test(r.text); }) : []; }
  function ratingOf(t) {
    var rs = t ? t.reactions.filter(function (r) { return RATE.test(r.text); }) : [];
    if (!rs.length) return null;
    var sum = rs.reduce(function (a, r) { return a + +RATE.exec(r.text)[1]; }, 0), mine = rs.filter(function (r) { return N.myReaction(r); })[0];
    return { n: rs.length, avg: sum / rs.length, mine: mine ? +RATE.exec(mine.text)[1] : 0, who: rs.map(function (r) { return r.by + ' ' + r.text; }) };
  }
  function rxBar(t) {
    var by = {}, mineE = {}; emojiOf(t).forEach(function (r) { (by[r.text] = by[r.text] || []).push(r.by); if (N.myReaction(r)) mineE[r.text] = 1; });
    var R = ratingOf(t);
    return '<div class="fd-rxbar"><span class="fd-rate" title="Your rating (one to three stars); the crew’s average beside it">' + [1, 2, 3].map(function (k) { return '<button data-rate="' + k + '" class="' + (R && R.mine >= k ? 'on' : '') + '">★</button>'; }).join('') +
      (R ? ' <span class="hint" title="' + SW.esc(R.who.join('; ')) + '">' + (Math.round(R.avg * 10) / 10) + ' from ' + R.n + '</span>' : '') + '</span>' +
      N.EMOJI.map(function (e) { return '<button class="fd-emo' + (mineE[e] ? ' on' : '') + '" data-emoji="' + e + '" title="' + SW.esc((by[e] || []).join(', ') || 'React') + '">' + e + (by[e] ? '<sup>' + by[e].length + '</sup>' : '') + '</button>'; }).join('') + '</div>';
  }
  function refreshThreads() {
    return N.listAll({ reactions: true }).then(function (all) { live.threads = N.threads(all.filter(function (x) { return x.source !== 'buildlog'; })); if (live.box) checkNotes(live.box, true); });
  }
  function react(n, emoji) {
    var t = threadOf(n), mine = t && t.reactions.filter(function (r) { return r.text === emoji && N.myReaction(r); })[0];
    return (mine ? N.remove(mine, true) : N.create({ vid: n.vid, parent: n.id, kind: 'reaction', anchor: n.anchor, text: emoji, tags: [], quiet: true })).then(refreshThreads);
  }
  function rate(n, k) {
    var t = threadOf(n), mine = t ? t.reactions.filter(function (r) { return RATE.test(r.text) && N.myReaction(r); }) : [], same = mine.some(function (r) { return r.text === '★' + k; });
    return mine.reduce(function (p, r) { return p.then(function () { return N.remove(r, true); }); }, Promise.resolve())
      .then(function () { return same ? null : N.create({ vid: n.vid, parent: n.id, kind: 'reaction', anchor: n.anchor, text: '★' + k, tags: [], quiet: true }); }).then(refreshThreads);
  }
  // A crew finding's reference: from its annotation's id, so it is the same for
  // everyone and never changes (a finding shared again is a new annotation, with a new one)
  function refOf(n) { var h = 5381, id = String(n.id); for (var k = 0; k < id.length; k++) h = ((h * 33) ^ id.charCodeAt(k)) >>> 0; return 'C-' + h.toString(36).toUpperCase().slice(-5).padStart(5, '0'); }
  function threadOf(n) { return (live.threads || []).filter(function (t) { return t.note.id === n.id; })[0] || null; }
  function countReplies(t) { return t.replies.reduce(function (a, r) { return a + 1 + countReplies(r); }, 0); }
  // A finding in a large window: its whole text and figure, its tags, and
  // what others have added (replies and reactions), with a reply box.
  function openFinding(n, i, title, fp, c, lvl, where) {
    var d = SW.el('dialog', { class: 'tray-big fd-big' });
    var rest = fp.text.split('\n').slice(1).join('\n').trim();
    var tags = (n.tags || []).filter(function (g) { return !/^findings?$/i.test(g) && !/^(cat|level):/.test(g); });
    function rx(t) {
      var by = {}; t.reactions.forEach(function (r) { (by[r.text] = by[r.text] || []).push(r.by); });
      return Object.keys(by).map(function (k) { return '<span class="fd-rx">' + SW.esc(k) + ' ' + SW.esc(by[k].join(', ')) + '</span>'; }).join(' ');
    }
    function replies(t, depth) {
      return t.replies.map(function (r) {
        return '<div class="fd-reply" style="margin-left:' + (depth * 16) + 'px;border-left-color:' + colourOf(r.note.by) + '"><div class="fd-rhead"><span class="badge" style="background:' + colourOf(r.note.by) + ';color:#000">' + SW.esc(r.note.by) + '</span> <span class="hint">' + SW.esc(SW.fmtDate(r.note.date)) + '</span></div>' +
          '<div class="fd-rtext">' + SW.esc(r.note.text) + '</div>' + (r.reactions.length ? '<div>' + rx(r) + '</div>' : '') + '</div>' + replies(r, depth + 1);
      }).join('');
    }
    function paint() {
      var t = threadOf(n);
      d.innerHTML = '<div class="tray-bighead"><span class="fd-no fd-ref mono">' + refOf(n) + '</span> <b>' + SW.esc(title) + '</b> <span class="badge" style="background:' + colourOf(n.by) + ';color:#000">' + SW.esc(n.by) + '</span>' + chips(c, lvl) +
        ' <span class="hint">' + SW.esc(SW.fmtDate(n.date)) + '</span><button class="icon-btn" data-x title="Close (Esc)">✕</button></div>' +
        (rest ? '<div class="fd-rtext">' + SW.esc(rest) + '</div>' : '') + '<div class="fd-bigfig"></div>' +
        (tags.length ? '<p>' + tags.map(function (g) { return '<span class="fd-tag">' + SW.esc(g.replace(/^chapter:/, '')) + '</span>'; }).join(' ') + '</p>' : '') +
        '<p class="hint">Evidence: ' + SW.esc(where) + '</p>' + rxBar(t) +
        '<h4 class="fd-rh">Replies' + (t ? ' <span class="faint">' + countReplies(t) + '</span>' : '') + '</h4>' + (t && t.replies.length ? replies(t, 0) : '<p class="hint">None yet.</p>') +
        '<div class="fd-replybox"><textarea rows="3" placeholder="Reply, signed with your initials"></textarea><button class="btn" data-reply>Reply</button></div>';
      if (fp.b64) SW.figpack.unpack(fp.b64).then(function (svg) { var fb = SW.$('.fd-bigfig', d); if (fb) fb.innerHTML = '<div class="tray-fig">' + SW.figpack.img(svg, 'fig-full') + '</div>'; });
    }
    paint();
    document.body.appendChild(d);
    d.addEventListener('click', function (e) {
      if (e.target === d || e.target.closest('[data-x]')) { d.close(); d.remove(); return; }
      var eb = e.target.closest('[data-emoji], [data-rate]');
      if (eb) { eb.disabled = true; (eb.dataset.emoji ? react(n, eb.dataset.emoji) : rate(n, +eb.dataset.rate)).then(paint, function (err) { eb.disabled = false; if (err.message !== 'no initials') SW.toast(err.message, 5000); }); return; }
      var rb = e.target.closest('[data-reply]');
      if (rb) {
        var ta = SW.$('.fd-replybox textarea', d), text = ta.value.trim(); if (!text) return;
        rb.disabled = true;
        N.create({ vid: n.vid, parent: n.id, kind: n.kind, anchor: n.anchor, text: text, tags: [] }).then(function () {
          return N.listAll({ reactions: true });
        }).then(function (all) { live.threads = N.threads(all.filter(function (x) { return x.source !== 'buildlog'; })); paint(); }, function (err) { rb.disabled = false; if (err.message !== 'no initials') SW.toast(err.message, 5000); });
      }
    });
    d.addEventListener('close', function () { d.remove(); });
    d.showModal();
  }
  function groupCard(n, i, c, lvl) {
      {
        var fp = SW.figpack.split(n.text);
        var lines = fp.text.split(/\n/), title = lines[0].replace(/^#+\s*/, ''), rest = lines.slice(1).join('\n').trim();
        var where = vLabel(n.vid) + (n.anchor ? ', l. ' + n.anchor.n0 + (n.anchor.n1 !== n.anchor.n0 ? '–' + n.anchor.n1 : '') : ', the version');
        var li = SW.el('li', { class: 'fd', style: 'border-left-color:' + colourOf(n.by) });
        var th = threadOf(n), nrep = th ? countReplies(th) : 0, nrx = emojiOf(th).length, R0 = ratingOf(th);
        li.innerHTML = '<div class="fd-head"><button class="icon-btn fd-open" title="Open: the whole finding, replies and reactions">⤢</button><span class="fd-no fd-ref mono" title="Its reference, which does not change">' + refOf(n) + '</span> <b class="fd-title">' + SW.esc(title) + '</b> <span class="badge" style="background:' + colourOf(n.by) + ';color:#000">' + SW.esc(n.by) + '</span>' + chips(c, lvl) + ' <span class="hint">' + SW.esc(SW.fmtDate(n.date)) + '</span></div>' +
          (rest ? '<p>' + SW.esc(rest) + '</p>' : '') + ((n.tags || []).filter(function (g) { return !/^findings?$/i.test(g) && !/^(cat|level):/.test(g); }).map(function (g) { return /^note:/.test(g) ? '<span class="fd-tag fd-noteref mono" title="The note in its author’s My notes that this was shared from">from ' + SW.esc(g.slice(5)) + '</span>' : '<span class="fd-tag">' + SW.esc(g.replace(/^chapter:/, '')) + '</span>'; }).join(' ') || '') + '<div class="fd-ev"><span class="hint">Evidence </span><a href="#" class="fd-go">' + SW.esc(where) + '</a></div>';
        if (nrep || nrx || R0) SW.$('.fd-ev', li).insertAdjacentHTML('beforeend', ' <a href="#" class="fd-replies">' + [nrep ? nrep + (nrep === 1 ? ' reply' : ' replies') : '', nrx ? emojiOf(th).map(function (r) { return r.text; }).join('') : '', R0 ? 'crew ' + (Math.round(R0.avg * 10) / 10) + '★ (' + R0.n + ')' : ''].filter(Boolean).join(' · ') + '</a>');
        li.addEventListener('click', function (e) { if (e.target.closest('.fd-open, .fd-title, .fd-replies')) { e.preventDefault(); openFinding(n, i, title, fp, c, lvl, where); } });
        SW.$('.fd-go', li).onclick = function (e) {
          e.preventDefault();
          if (n.anchor) SW.state.sel = { p: n.anchor.p, n0: n.anchor.n0, n1: n.anchor.n1 };
          if (n.vid !== SW.state.v) SW.select(n.vid);
          SW.setTab(n.anchor ? 'read' : 'about');
        };
        if (fp.b64) {   // the figure shared with it
          var fbox = SW.el('div', { class: 'fd-fig' }, '<p class="hint">Opening the figure…</p>');
          li.insertBefore(fbox, SW.$('.fd-ev', li));
          SW.figpack.unpack(fp.b64).then(function (svg) {
            fbox.innerHTML = SW.figpack.img(svg, 'fd-thumb') + '<button class="icon-btn fd-expand" title="Open larger">⤢</button>';
            fbox.onclick = function () { SW.figpack.big(svg, title); };
            fbox._svg = svg;
          }, function (e) { fbox.innerHTML = '<p class="hint">' + SW.esc(e.message) + '</p>'; });
        }
        if (N.mine(n)) li.appendChild(ownActions(n, li));
        if (fp.b64) li.appendChild(SW.el('button', { class: 'btn ghost fd-mine', title: 'Put this finding’s figure in My notes (private)', onclick: function () { var fb = SW.$('.fd-fig', li); if (fb && fb._svg) SW.tray.addFigure(fb._svg, title); } }, '＋ My notes'));
        else li.appendChild(mineButton(function () { return { title: title, subtitle: n.by + ', ' + SW.fmtDate(n.date) + '; ' + where, blocks: rest ? [{ type: 'p', text: rest }] : [] }; }, { by: n.by, vid: n.vid, shared: { date: n.date }, tags: (n.tags || []).filter(function (g) { return !/^findings?$|^chapter:/i.test(g); }) }));
        return li;
      }
  }

  // ---------- export ----------
  function doc() {
    var blocks = [{ type: 'h2', text: 'Established by the bench' }];
    FIND.forEach(function (f) {
      blocks.push({ type: 'h3', text: f.no + '. ' + f.title });
      blocks.push({ type: 'p', text: f.text });
      var ev = f.ev.map(function (e) {
        return e.tape ? e.tape + (e.from ? ' (from frame ' + e.from + ')' : '') : e.cite || (vLabel(e.v) + (e.label ? ', ' + e.label : ''));
      });
      blocks.push({ type: 'p', text: 'Evidence. ' + ev.join('; ') + '.' });
    });
    if (live.witness) {
      blocks.push({ type: 'h2', text: 'Witness tapes' });
      blocks.push(SW.tableBlock('Builds compared with surviving object tapes, ' + SW.fmtDate(SW.today()), ['Version', 'Tape', 'Words on tape', 'Differ', 'Only in source', 'Only on tape', 'Result'],
        live.witness.map(function (r) { return r.slice(0, 7); })));
    }
    if (live.titles) {
      blocks.push({ type: 'h2', text: 'Punched titles' });
      blocks.push(SW.tableBlock('Titles punched into the tapes, as read by the bench', ['Tape', 'Frames', 'Reading', 'Versions'],
        live.titles.map(function (r) { return [r.tape.path, r.t.from + '–' + r.t.to, r.t.text, r.tape.versions.map(vLabel).join(', ')]; })));
    }
    if (live.notes && live.notes.length) {
      blocks.push({ type: 'h2', text: 'Findings from the group' });
      blocks.push(SW.tableBlock('Annotations tagged “finding”', ['Ref', 'Date', 'By', 'Version', 'Where', 'Finding'], live.notes.map(function (n) {
        return [refOf(n), SW.fmtDate(n.date), n.by, vLabel(n.vid), n.anchor ? 'l. ' + n.anchor.n0 + (n.anchor.n1 !== n.anchor.n0 ? '–' + n.anchor.n1 : '') : 'version', SW.figpack.split(n.text).text + (SW.figpack.split(n.text).b64 ? ' [with a figure]' : '')];
      })));
    }
    return { title: 'Spacewar! findings', subtitle: 'What the source, the tapes and the assembler show',
             meta: [['Generated', SW.fmtDate(SW.today()) + ', Spacewar! research bench v' + SW.VERSION]], blocks: blocks };
  }

  // ---------- view ----------
  // ---------- categories and importance ----------
  // A category is found from the words of a finding (the one with most
  // matches), unless a "cat:" tag sets it; importance from a "level:" tag, and
  // for the bench's own findings Notable until set otherwise.
  var CATS = [
    ['tape', 'Tapes and loading', /\b(tapes?|loader|read-?in|checksums?|punched|frames?|rim|blocks?|fio-?dec|parity)\b/gi],
    ['text', 'Transcription and text', /\b(transcriptions?|transcribed|typos?|scans?|overlin\w*|misread\w*|listings?|comments?|spellings?)\b/gi],
    ['display', 'Display and graphics', /\b(dpy|display\w*|screen|stars?|sun|outlines?|scope|type 30|plotted|phosphor|constellations?|planetarium)\b/gi],
    ['game', 'Game logic', /\b(hyperspace|torpedo(es)?|collisions?|gravity|controls?|scor(e|es|ing)|explo(de|des|sion)|fuel|thrust|rockets?)\b/gi],
    ['machine', 'Machine and timing', /\b(instructions?|cycles?|emulator|opr|swp|lai|lia|mdv|multipl\w*|divide|timing|memory|core|sequence break|iot|pdp-1d)\b/gi],
    ['versions', 'Versions and genealogy', /\b(versions?|forks?|dfw|ddp|masswerk|landsteiner|morris|russell|samson|preonas|genealogy|variants?|witness\w*)\b/gi]
  ];
  var CATNAME = { other: 'Other' }; CATS.forEach(function (c) { CATNAME[c[0]] = c[1]; });
  var LEVELS = [['key', 'Key', '★★★'], ['notable', 'Notable', '★★'], ['minor', 'Minor', '★']];
  function catOf(text, tags) {
    var t = (tags || []).filter(function (g) { return /^cat:/.test(g); })[0];
    if (t && CATNAME[t.slice(4)]) return { id: t.slice(4), auto: false };
    var best = 'other', bn = 0;
    CATS.forEach(function (c) { var m = (String(text).match(c[2]) || []).length; if (m > bn) { bn = m; best = c[0]; } });
    return { id: best, auto: true };
  }
  function levelOf(tags, dflt) {
    var t = (tags || []).filter(function (g) { return /^level:/.test(g); })[0], id = t ? t.slice(6) : '';
    return LEVELS.some(function (l) { return l[0] === id; }) ? id : (dflt || 'notable');
  }
  function chips(c, lvl) {
    var L = LEVELS.filter(function (l) { return l[0] === lvl; })[0];
    return ' <span class="fd-cat" title="' + (c.auto ? 'Category found from the words of the finding; a cat: tag sets it' : 'Category set by a cat: tag') + '">' + SW.esc(CATNAME[c.id]) + (c.auto ? '' : ' ✓') + '</span>' +
      ' <span class="fd-lvl fd-' + lvl + '" title="' + L[1] + '">' + L[2] + '</span>';
  }
  var FS = SW.store.get('fd.filt', {}) || {};
  function passes(it) {
    if (FS.cat && it.cat.id !== FS.cat) return false;
    if (FS.lvl === 'key' && it.lvl !== 'key') return false;
    if (FS.lvl === 'notable' && it.lvl === 'minor') return false;
    if (FS.v && it.vids.indexOf(FS.v) < 0) return false;
    if (FS.by && it.by !== 'bench' && it.by !== FS.by) return false;
    if (FS.q && it.text.toLowerCase().indexOf(FS.q.toLowerCase()) < 0) return false;
    return true;
  }
  var LORD = { key: 0, notable: 1, minor: 2 };
  // items {cat, lvl, text, vids, card()} under category headings, most important first, minor ones folded
  // Folding: a category or a single finding folded down to its heading, remembered.
  function folds() { return SW.store.get('fd.fold', {}) || {}; }
  function setFold(k, on) { var F = folds(); if (on) F[k] = 1; else delete F[k]; SW.store.set('fd.fold', F); }
  function chevron(el, k, on) {
    var b = SW.el('button', { class: 'fd-fold', type: 'button', title: on ? 'Open' : 'Fold away', 'aria-expanded': String(!on) }, on ? '▸' : '▾');
    b.addEventListener('click', function (e) {
      e.stopPropagation();
      var f = !el.classList.contains('folded'); el.classList.toggle('folded', f); setFold(k, f);
      b.textContent = f ? '▸' : '▾'; b.title = f ? 'Open' : 'Fold away'; b.setAttribute('aria-expanded', String(!f));
    });
    return b;
  }
  function foldCard(li, k) {
    var head = SW.$('.fd-head', li); if (!head || !k) return li;
    var on = !!folds()['f:' + k]; li.classList.toggle('folded', on);
    head.insertBefore(chevron(li, 'f:' + k, on), head.firstChild);
    return li;
  }
  function grouped(box, items, empty) {
    var shown = items.filter(passes);
    if (!shown.length) { box.appendChild(SW.el('p', { class: 'hint' }, items.length ? 'None with these filters.' : empty)); return; }
    CATS.map(function (c) { return c[0]; }).concat(['other']).forEach(function (id) {
      var g = shown.filter(function (it) { return it.cat.id === id; }); if (!g.length) return;
      g.sort(function (a, b) { return LORD[a.lvl] - LORD[b.lvl] || a.order - b.order; });
      var sec = SW.el('div', { class: 'fd-cgroup' }), con = !!folds()['c:' + id], h = SW.el('h4', { class: 'fd-chead' }, SW.esc(CATNAME[id]) + ' <span class="faint">' + g.length + '</span>');
      sec.classList.toggle('folded', con);
      h.insertBefore(chevron(sec, 'c:' + id, con), h.firstChild);
      sec.appendChild(h);
      var ol = SW.el('ol', { class: 'fd-list' }), minor = g.filter(function (it) { return it.lvl === 'minor'; });
      g.filter(function (it) { return it.lvl !== 'minor'; }).forEach(function (it) { ol.appendChild(foldCard(it.card(), it.key)); });
      sec.appendChild(ol);
      if (minor.length) {
        var d = SW.el('details', { class: 'fd-minor' }, '<summary>' + minor.length + ' minor</summary>'), ol2 = SW.el('ol', { class: 'fd-list' });
        minor.forEach(function (it) { ol2.appendChild(foldCard(it.card(), it.key)); }); d.appendChild(ol2); sec.appendChild(d);
      }
      box.appendChild(sec);
    });
  }
  function filterBar(onChange) {
    var vs = V.VERSIONS.filter(function (v) { return v.build && v.id !== 'stars'; }).sort(function (a, b) { return a.sort - b.sort; });
    var bar = SW.el('div', { class: 'toolbar fd-filters', style: 'position:static;padding-left:0' });
    bar.innerHTML = '<label class="check">Category <select data-f="cat"><option value="">All</option>' + CATS.concat([['other', 'Other']]).map(function (c) { return '<option value="' + c[0] + '"' + (FS.cat === c[0] ? ' selected' : '') + '>' + c[1] + '</option>'; }).join('') + '</select></label>' +
      '<label class="check">Importance <select data-f="lvl"><option value="">All</option><option value="notable"' + (FS.lvl === 'notable' ? ' selected' : '') + '>Key and notable</option><option value="key"' + (FS.lvl === 'key' ? ' selected' : '') + '>Key only</option></select></label>' +
      '<label class="check">Version <select data-f="v"><option value="">All</option>' + vs.map(function (v) { return '<option value="' + v.id + '"' + (FS.v === v.id ? ' selected' : '') + '>' + SW.esc(v.label.replace(/^Spacewar! /, '')) + '</option>'; }).join('') + '</select></label>' +
      '<input type="search" data-f="q" placeholder="Find in findings" value="' + SW.esc(FS.q || '') + '">' +
      '<button class="btn ghost" type="button" data-fold="all" title="Fold every finding down to its heading">Fold all</button><button class="btn ghost" type="button" data-fold="none" title="Open every finding and category">Open all</button>';
    function set(e) { var f = e.target.dataset.f; if (!f) return; FS[f] = e.target.value; SW.store.set('fd.filt', FS); onChange(); }
    bar.addEventListener('click', function (e) {
      var t = e.target.closest('[data-fold]'); if (!t) return;
      var all = t.dataset.fold === 'all', box = bar.parentNode || document;
      SW.$$('li.fd', box).forEach(function (li) { var b = SW.$('.fd-fold', li); if (b && li.classList.contains('folded') !== all) b.click(); });
      if (!all) SW.$$('.fd-cgroup.folded', box).forEach(function (sec) { var b = SW.$('.fd-chead .fd-fold', sec); if (b) b.click(); });
    });
    bar.addEventListener('change', set);
    bar.addEventListener('input', function (e) { if (e.target.dataset.f === 'q') { clearTimeout(bar._t); bar._t = setTimeout(function () { set(e); }, 250); } });
    return bar;
  }

  // The shared findings: the bench's and the group's. (My notes has its own tab.)
  var done = false;
  function render() {
    done = true;
    view.innerHTML = '';
    var pad = SW.el('div', { class: 'pad findings' });
    view.appendChild(pad);
    var tb = SW.el('div', { class: 'toolbar', style: 'position:static;padding-left:0' });
    tb.appendChild(SW.el('button', { class: 'btn', title: 'A finding on the version open, shared with the group, tagged “finding”; the first line is its title. (For lines, select them in Read and use ★ Finding.)', onclick: function () {
      var v = SW.state.v && V.byId(SW.state.v);
      if (!v) return;
      N.dialog({ vid: v.id, kind: 'version', anchor: null, tags: ['finding'], heading: 'Add a finding', anchorText: 'On ' + v.label + '. Shared with the group and listed under Findings; the first line is its title.' });
    } }, '✎ Add a finding'));
    // export and the rest in one ⋯ menu, as in My notes
    var more = SW.el('details', { class: 'menu exp-menu more-menu' });
    more.innerHTML = '<summary class="btn ghost" title="Export, or check again">⋯</summary>';
    var mb = SW.el('div', { class: 'menu-body' });
    SW.$$('button', SW.exportButtons(doc, 'spacewar-findings')).forEach(function (x) { x.classList.add('ghost'); mb.appendChild(x); });
    mb.appendChild(SW.el('button', { class: 'btn ghost', title: 'Read the tapes and compare the witnesses again, and fetch the group’s findings', onclick: function () { run(); } }, '↻ Check again'));
    var right = SW.el('span', { class: 'tb-right', style: 'display:inline-flex;gap:6px' });
    var ub = SW.el('button', { class: 'btn ghost fd-undo', onclick: undoLast }, '↶ Undo');
    ub.hidden = !undo.length; if (undo.length) ub.title = 'Undo: ' + undo[undo.length - 1].label;
    right.appendChild(ub);
    right.appendChild(SW.el('button', { class: 'btn ghost ov-binbtn', title: 'Open the bin: findings you deleted, to restore or delete for good', onclick: function (e) {
      var btn = e.currentTarget, hb = SW.$('.fd-bin', pad);
      if (hb) { hb.remove(); btn.classList.remove('on'); btn.title = 'Open the bin: findings you deleted, to restore or delete for good'; return; }
      hb = SW.el('div', { class: 'fd-bin' }); hb.binFilter = function (n) { return (n.tags || []).some(function (g) { return /^findings?$/i.test(g); }); };
      tb.after(hb); N.showBin(hb, { all: true }); btn.classList.add('on'); btn.title = 'Close the bin';
    } }, '🗑'));
    mb.addEventListener('click', function (e) { if (e.target.closest('button')) more.open = false; });
    more.appendChild(mb);
    right.appendChild(more);
    tb.appendChild(right);
    pad.insertAdjacentHTML('beforeend', '<h2>Findings</h2><p class="prose">What the crew and the bench have established about the Spacewar! sources, each with its evidence one click away. Crew: the group’s findings, by member. Bench: the bench’s own, with the witness tapes and punched titles checked afresh.</p>');
    pad.appendChild(tb);
    legend([]);
    // Crew (the group's findings, by member) | Bench (the bench's own, and its checks)
    var side = SW.store.get('fd.side', 'crew');
    var seg = SW.el('div', { class: 'seg-btns fd-side' }, '<button class="btn' + (side === 'crew' ? ' on' : '') + '" data-side="crew" title="The group’s findings">Crew</button><button class="btn' + (side === 'bench' ? ' on' : '') + '" data-side="bench" title="What the bench has established, and its checks of the tapes">Bench</button>');
    seg.addEventListener('click', function (e) { var b = e.target.closest('[data-side]'); if (b && b.dataset.side !== side) { SW.store.set('fd.side', b.dataset.side); render(); } });
    pad.appendChild(seg);
    var fbar = filterBar(function () { if (side === 'bench') paintBench(); else checkNotes(nBox, true); });
    pad.appendChild(fbar);
    var list = SW.el('div', { class: 'fd-bench' });
    function benchCard(f, c, lvl) {
      var li = SW.el('li', { class: 'fd', style: 'border-left-color:' + colourOf('bench') });
      li.innerHTML = '<div class="fd-head"><span class="fd-no mono">' + f.no + '</span> <b>' + SW.esc(f.title) + '</b> <span class="badge">' + SW.esc(f.kind) + '</span>' + chips(c, lvl) + '</div><p>' + SW.esc(f.text) + '</p>';
      evidenceHTML(f, li);
      li.appendChild(mineButton(function () {
        return { title: f.no + '. ' + f.title, subtitle: 'Finding (the bench), ' + f.kind, blocks: [{ type: 'p', text: f.text }, { type: 'p', text: 'Evidence. ' + f.ev.map(function (e) { return e.tape ? e.tape + (e.from ? ' (from frame ' + e.from + ')' : '') : e.cite || (vLabel(e.v) + (e.label ? ', ' + e.label : '')); }).join('; ') + '.' }] };
      }));
      return li;
    }
    function paintBench() {
      list.innerHTML = '';
      grouped(list, FIND.map(function (f, n) {
        var c = catOf(f.title + ' ' + f.text + ' ' + f.kind, f.cat ? ['cat:' + f.cat] : []), lvl = f.level || 'notable';
        return { key: 'b:' + f.no, by: 'bench', cat: c, lvl: lvl, order: n, text: f.no + ' ' + f.title + ' ' + f.text + ' ' + f.kind, vids: f.ev.map(function (e) { return e.v; }).filter(Boolean), card: function () { return benchCard(f, c, lvl); } };
      }), 'None.');
    }
    var nBox = SW.el('div'), wBox = SW.el('div'), tBox = SW.el('div');
    if (side === 'bench') {
      pad.appendChild(list);
      paintBench();
      pad.appendChild(SW.el('h3', {}, 'Witness tapes, checked now'));
      pad.appendChild(wBox);
      pad.appendChild(SW.el('h3', {}, 'Punched titles, read now'));
      pad.appendChild(tBox);
    } else {
      pad.appendChild(SW.el('div', { class: 'toolbar fd-members', style: 'position:static;padding-left:0' }));
      pad.appendChild(nBox);
    }
    function run() {
      if (side === 'bench') { checkTitles(tBox); checkWitnesses(wBox); }
      else checkNotes(nBox);
    }
    run();
  }
  SW.findings = { list: FIND, showMine: function () { SW.setTab('notes'); } };
  SW.on('notes', function () { if (done && SW.state.tab === 'findings') render(); });

  SW.views.findings = { show: function () { if (!done) render(); }, reset: function () { done = false; } };
})(this);
