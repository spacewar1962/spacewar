# Changelog: the research bench

Changes to the _Spacewar!_ research bench (`research/`). The bench keeps its own version numbers, raised by 0.0.1 with each change; this file records the minor versions. The website's changes are in the `CHANGELOG.md` at the root of the repository.

## 1.19.53 (2026-10-19)

- The legal Type now comes from the kit (0.63.0); the bench's own entry for it is removed.

## 1.19.0 (2026-10-12)

Everything from 1.18.1 to 1.18.95.

### Paratexts

- **The crew's archive.** Scans, clippings, photographs, recordings and documents, kept in the private `sw_paratexts` repository and read and written through GitHub with each member's own token. Collections, grid and list views, selection, accession dates, ratings in gold, and a safer Withdraw kept in a submenu.
- **Catalogued.** Archive fields (Held at, Archive ref, Source ↗) and Dublin Core (type, publisher, contributors, language, coverage, identifiers, extent), exported as Dublin Core XML, CSL-JSON and RIS for Zotero. Files cached in the browser once fetched.
- **Media.** Audio and video play in place; linked items from YouTube, Vimeo, the Internet Archive or a web page.
- **Reading them.** Pictures and PDF pages zoom, drag and page through alike (PDFs drawn by PDF.js); two paratexts side by side, moving together.
- **In annotations.** A paratext's code (P-…) in an annotation reads as Paratext: and its title, and opens the paratext read-only where you are. Cited in on each paratext lists the annotations that cite it.
- **Joining.** Invitation links set the annotation group; the joining guide is a form; Share buttons give a link to the current view.

### Dynamic Profile (Program ▸ The machine)

Art's Dynamic Profile Gizmo, renamed.

- **One definition of a routine**, shared with the Functional overview: a routine begins at the start address, at what a jsp or jda calls, at an address called through a word set by law (cwr), and at what is stored in the objects' table the main loop runs (ss1, ss2, mex, tcr, hp1, hp3). Each version now gives the same routines in both views.
- **Compare** matches blocks by like code before place, matches macros by their operations, and counts a block matched into another routine as moved out or in. Checked by `tests/compare.html` (20 checks on pairs whose changes are known).
- **☰ Across the versions**: every routine followed from parent to child through the descent.
- **Names, marks and tracings.** A named block keeps its own label beside it; shift-click marks a box in a colour; tracings are shared with the crew through the annotation group.
- The state of the view is in the address, with a Link button; sample runs are repeated and averaged.

### Functional overview

- **Read from the source**, beside the recorded run: the program from its start address, the routines each tape holds and what it assembles to, read from the assembled words without running.

### Findings and notes

- **F49–F52.** Sense switch 2 and the star's pull (heavy or light by default, and none in 4.3 and 4.4); explosions that collide in Spacewar! 1 and 2B; 4.1's jump dispatch and per-object collision test; the torpedo's `dispt i`, misread in 4.0, 4.0TS and 4.2.
- My notes as cards, coloured by kind; codes (#, ?code=) go to an annotation, reply, finding or note.

### Annotations

- Unsaved annotations, replies and edits are kept through Esc, Cancel and leaving the page.
- A box asks for your initials when they are needed, and the action carries on once they are saved.

### Genealogy

- Flow ribbons drawn from the lines themselves, forking and joining where code was re-cut, with a Detail control.

### bench-kit

- The bench shares its frame and most of its views with the SHRDLU bench through `research/kit` (critical-code-studies/bench-kit, now 0.32.0): the shell and menus, Read and its repairs, annotations, paratexts, Findings, Compare and Genealogy, the Analyse and Graphics frames, builds, the version list, themes and styles, Help pages, tests (94) and the release and site-map tools. The bench keeps its own lenses, pictures, emulator, assembler and the Spacewar! texts.
- Licence: GPL-3.0, with the oversigma emulator files, the assembler (macro1.c's terms) and the multiply and divide (simh) credited under their own terms.

### Fixes

- The bench drew no torpedoes in 4.0, 4.0TS and 4.2: the transcriptions read `dispt 1` where the scans read `dispt i` (F52).
- Compare follows a skip return after a call, and leaves out 4.1's `.x` variable marks.
- Error badges in Read sized and worded as the toolbar's.
- Phones: the tape strip gives way in the header, and the tab row fades where there is more to scroll.

## 1.18.0 (2026-10-05)

Everything from 1.17.1 to 1.17.40.

### Repairs, after kintsugi

- **The repairs register.** Every correction made to a transcription to read or run it is recorded with the reading it replaced, the reading now, the evidence (the scan and its page), who made it and when. Lines remade where no reading survives are recorded the same way. After Berry, "Digital Ruins and Critical Code Studies" (2025).
- **Gold in Read.** A corrected or remade line has a gold squiggle under its code and comment, as under a misspelt word, with the changed characters shaded; a gold dot (corrected) or square (remade) by the line number. Lines normalised for the assembler have a pale dotted underline where their code changes; uncertain readings, marked [?] in the transcription, a grey squiggle. Each mark's hover begins "Kintsugi ·" and gives what was there, the evidence and who made it. Supplied tapes and reconstructions carry a chip on their heading. View ▸ Repairs turns the gold on and off.
- **‹ ◆ n ›** in the Read toolbar steps through a text's repairs. The ◆ folds down a repairs bar: the list of repairs, the repair at or after the selection, only the repaired lines, normalisations, the scan at the page the evidence names, the repair to My notes, all the repairs copied for citing, the reconstruction cards, and what the marks mean.
- **Reconstruction cards.** A card per version: every repair made to read and run it, with its kind (corrected, remade, supplied, reconstruction, for assembly, uncertain), what changed, the evidence and who made it. One card at a time, chosen by version, from Help ▸ Reconstruction cards or the repairs bar; copy, export (this card or all) and My notes.
- **Gold is kept for repairs.** The bench's accent colour (annotations, addresses and numbers in code, highlights) moved from amber to rose in the dark, paper, white, sepia and high-contrast themes.
- Help ▸ What you should read: a reading list behind the bench, checked against Zotero.
- The language of the text shown (MACRO), in small type in the top bar on Read and Run, linked to DEC's MACRO manual.

### Art's Dynamic Profile Gizmo (Program ▸ The machine)

After Art Schwarz: a profile in the professional sense.

- **Profile.** The run drawn as a graph: each node a block of sequential code (a block begins where a branch arrives, or at the first instruction run, and ends at an instruction that branched, or at the last), each edge a branch taken, shaded and sized by the machine time spent and the times taken. The emulator now records the instructions stepped and cycles spent at each address and every transfer of control.
- **▶ Sample run.** The version run on its own for 5 to 60 s of machine time, both ships flown by Lensman AI (a style for each ship), or with no one at the controls; or the profile of your own run in Run.
- **⇄ Compare.** Two versions side by side, by the structure of their code: blocks between branches read from the assembled code (comments, spacing and the transcriptions' marks for a variable left out; the jumps the code does not name taken from a sample run), matched by their code, their label and their place between matched blocks. The two versions' flows are drawn routine by routine in one layout, a routine in the same place on both sides, shaded by its time in each version's run, with altered, moved, inserted and removed routines outlined. The main loop can be split into its labelled parts. ⇄ Swap turns the comparison round.
- **Boxes.** Clicking a block or routine opens its figures (time in ms with the share in brackets, per entry, times entered, instructions run, size, what it calls and what reaches it), its blocks side by side, and its code in both versions (Blocks | Code, with ‹ › through its blocks), with links into Read. A block or routine can be named (kept in the browser, shown in the graph) and put in My notes.
- The graphs save as SVG or PNG; the tables export to Word and Markdown.

### Graphics ▸ Hyperspace

- 3.1's and the 4.x versions' hyperspace are named as one effect, the re-entry spot (hp6, `dispt i, i my1, 2`), after a note from Norbert Landsteiner. 4.3's two spots are both ships sent into hyperspace together by the bench's test; in 4.4 the spot stays where it is, but each console is drawn relative to a ship (kcb, "relocate for center display"), so on the scope that follows the other ship it slides.

### Annotations

- **Ghosts.** A copy kept from a ghost is tracked by the annotation it came from, so deleting the copy, or undoing Keep here, brings the ghost back at once; a plain link to an annotation no longer hides its ghost; each ghost folds, like any annotation.

### Fixes

- Run: the code panel no longer shakes while the game plays (the machine-time clock wrapped the toolbar as its digits changed).
- Links from Program into Read work before Read has been opened.
- PNG export: within Safari's canvas limit, with fallbacks when a browser refuses an image or a canvas; the gizmo's SVG is valid standalone.
