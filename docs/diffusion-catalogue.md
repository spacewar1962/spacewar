# Spacewar! diffusion catalogue, 1961-1980

A working catalogue of versions, ports, re-implementations, and commercial
descendants of Spacewar! (Russell et al., MIT PDP-1, 1962), compiled for the
Critical Code Studies monograph. This is the *diffusion* complement to the Source
Variorum, which collates the original MIT source line (versions 1 through 4.8). The
variorum traces the code's internal evolution; this catalogue traces its external
spread.

**Scope:** broad (faithful ports, re-implementations, commercial/arcade descendants,
clones, inspired-by), international, US instances included and flagged. Each entry is
marked **[US]** or **[FOREIGN: country]**, with platform, people, relationship to the
original, and a source.

**Status (2026-06-17, foreign pass complete):** the documented foreign diffusion of
Spacewar! in 1961-1980 is **short and Japanese, and it runs through the commercial
arcade lineage, not the original game**: Taito's licensed *Space Wars* (Japan, Jul
1978) and Sega's *Space Ship* (Jun 1978), both descending from the US Cinematronics
*Space Wars* (1977). The original MIT game on its native PDP-1 stayed essentially North
American (the only documented non-US PDP-1 was a single Canadian unit, with no evidence
Spacewar! ran on it). No European, Japanese, or Soviet *original-game* port is
documented; the Soviet case is "not found in English-language sources," not a proven
absence (Russian archives unexamined). Caveat throughout: a foreign Spacewar need not be
a PDP-1 port — as the US case shows, most versions were re-implementations on local
hardware — so the negative findings for the USSR and Europe are absence-of-evidence in
English-language sources, not closure.

---

## 1. Origin (US, MIT)

- **Spacewar!** [US] — DEC PDP-1, Type 30 display, MIT EE Department, 1961-62.
  Conceived 1961 by Steve Russell, Martin Graetz, Wayne Wiitanen (the "Hingham
  Institute"); first running version by Russell, Feb 1962 (~200 hours); features
  added by Dan Edwards, Peter Samson, Graetz. The internal version line (1, 2b, 3.1,
  4.x, 4.8) is collated in the Source Variorum. Confirmed (3-0).
  - https://www.computerhistory.org/pdp-1/spacewar/
  - https://archive.org/details/pdp1_spacewar
  - https://www.computerhistory.org/pdp-1/d75ea65237b44f058484b1f799f9a6b9/ (on its spread as a PDP-1 demo program)

## 2. US institutional ports (documented; held in `sources/ports/`)

- **WAR 44** [US] — PDP-6, MIT, from Peter Samson's DECtape, c.1968.
  - https://github.com/PDP-10/Spacewar (`MIT/1968/war.44`)
- **MIT-AI ITS line: SPCWAR / NEWWAR / TVWAR** [US] — PDP-6/10 on ITS, MIT AI Lab, to
  1976 (maintainers Harrenstein/KLH, GMP, CBF; nine-bit consoles by Kevin Hunter, Apr
  1976). Name genealogy WAR -> SWAR -> SUPER -> STAR -> SPACE -> SPACE4 -> NSPACE ->
  SPCWAR. TVWAR is the Knight-TV (raster) variant.
  - https://github.com/PDP-10/Spacewar (`MIT/1976/extracted/`)
- **Stanford SAIL: Gorin version** [US] — PDP-10/6, Ralph E. Gorin (Sept 1971, with R.
  Taylor Feb 1972), MACRO-10; plus `SHIPS.SAI`. The version run with up to five ships
  at the 1972 *Rolling Stone* Spacewar Olympics.
  - https://www.saildart.org/ (`[SW,BGB]`)
  - https://github.com/PDP-10/Spacewar
- **GT40 / PDP-11 vector line** [US]:
  - Eross — Botond G. Eross, Stanford AI Project, 1973, MACRO-11 (inspired by Gorin's PDP-10 version). https://www.saildart.org/ (`SW.P11[11,BO]`)
  - Bryant & Seiler — "Space War Version 5B," Larry Bryant & Bill Seiler, 21 Jul 1974 (DECUS 11-192; recovered from Seiler's printout by Mattis Lind, 2021). https://github.com/MattisLind/SPACEWAR
  - Waters & Billmers — MIT AI Lab, c.1976 (depends on the GTROS minimal OS). https://github.com/pdp11/mit-gt40-spacewar
- **PDP-8 / LAB-8** [US] — Evan Suits, "Interplanetary Death and Destruction on your
  LAB-8," 11 Jan 1971, PAL. *(Source file in `sources/ports/`; upstream URL to confirm.)*
- **LINC-8 / PDP-12** [US] — `SPCWAR v3`, D. E. Wrege & Assoc. at Georgia Tech, 1974
  (LAP6). Notable as an early *copyrighted, commercially distributed* Spacewar source
  ("Copyright (C) 1974 by D.E. Wrege & Assoc."). *(Source file in `sources/`; upstream URL to confirm.)*
- **CDC 3100** [US] — Albert Kuhfeld, University of Minnesota, 1967-68; a
  re-implementation on non-DEC hardware, described in *Analog Science Fiction and
  Fact*, 1971. The Analog article is in `sources/reference/kuhfeld-spacewar-analog-1971.pdf`.
  - https://en.wikipedia.org/wiki/Spacewar! (Kuhfeld / CDC 3100)

## 3. US commercial / arcade descendants (documented)

- **Galaxy Game** [US] — Bill Pitts & Hugh Tuck, Stanford (Tresidder Union), Sept 1971;
  coin-operated; PDP-11/20 with HP 1300A display; a faithful PDP-11 re-implementation
  of the Stanford PDP-10 version. Confirmed (3-0).
  - http://infolab.stanford.edu/pub/voy/museum/galaxy.html
- **Computer Space** [US] — Nutting Associates (Nolan Bushnell & Ted Dabney), 1971;
  the first commercial coin-op video game; inspired by Spacewar!. *(Standard video-game history; verify exact wording.)*
  - https://en.wikipedia.org/wiki/Computer_Space
- **Space Wars** [US] — Cinematronics (designer Larry Rosenthal, an MIT graduate
  familiar with the original), 1977; black-and-white vector graphics; based on
  Spacewar!. Confirmed (3-0).
  - https://en.wikipedia.org/wiki/Space_Wars

## 4. Foreign (non-US)

Verified by the foreign-focused deep-research pass (task w4ci1btqn, 2026-06-17;
3-vote adversarial verification). **The headline result: the only firmly-documented
foreign diffusion in 1961-1980 is Japanese, and it runs through the commercial
vector-arcade lineage (descending from the US Cinematronics *Space Wars*, 1977), not
through the original MIT game.** The original Spacewar! on its native hardware stayed
essentially North American.

### 4a. Japan — documented (commercial arcade derivatives)

- **Space Wars (Taito, Japan)** [FOREIGN: Japan] — Taito licensed and released the
  Cinematronics *Space Wars* in Japan, July 1978; a 1978 Japan-region arcade flyer
  survives. Relationship: commercial derivative, one step down the lineage (MIT
  Spacewar! -> Cinematronics Space Wars 1977 -> Taito Japan 1978). Confirmed (3-0).
  - https://flyers.arcade-museum.com/videogames/show/5832
  - https://www.arcade-history.com/?n=space-wars&page=detail&id=2564
- **Space Ship / スペースシップ (Sega)** [FOREIGN: Japan] — Sega released its own
  two-player "space war" arcade game *Space Ship*, June 1978, reproducing core
  Spacewar! mechanics (central gravity well / sun, meteors, hyperspace teleport).
  Relationship: derivative / inspired-by. Confirmed (3-0).
  - https://www.sega.jp/history/arcade/product/8682/
- **EXCLUDE: Space War / スペースウォー (Konami / Leijac, 1979)** [Japan] — despite the
  name, this is a *Space Invaders* derivative (name collision), with **no MIT Spacewar!
  lineage**. Verified as a false lead (3-0). Recorded here so it is not mistakenly added.
  - https://arcade-museum.com/Videogame/space-war-leijac
  - https://ja.wikipedia.org/wiki/スペースウォー_(レジャック)

### 4b. Canada — one PDP-1, no game evidence

- **AECL Chalk River** [FOREIGN: Canada] — a single PDP-1C (serial 27) at Atomic
  Energy of Canada Limited, Chalk River, Ontario; the **only documented non-US PDP-1**
  in DEC's serial registry, the CHM customer list, and DEC's c.1963 brochure (later
  moved to Science North, then scrapped). **No evidence that Spacewar! ran on it** —
  this is a hardware datum, not a game instance. Confirmed (3-0).
  - https://www.bitsavers.org/pdf/dec/pdp1/PDP-1_SerialNumbers.pdf
  - https://en.wikipedia.org/wiki/PDP-1

### 4c. Not substantiated / negative findings

- **USSR / Eastern bloc** [FOREIGN: USSR] — **no documented Soviet Spacewar found.**
  No Soviet PDP-1 clone existed (Soviet PDP cloning was the PDP-11 ISA, 1801 series,
  early 1980s, plus a PDP-8-based system), so a faithful original-hardware port is ruled
  out; but a *re-implementation* on a Soviet PDP-11 clone is not, and the SM EVM line
  (1975-onward) shows no game in its English-language documentation. Standard English
  histories of Soviet computing name only Tetris (1984), outside the window and
  unrelated. **Honest status: not found in English-language sources, not "did not
  exist"** — Russian-language archives were not exhaustively searched and would be
  needed to close it. Confidence: medium.
  - https://en.wikipedia.org/wiki/SM_EVM
  - https://en.wikipedia.org/wiki/History_of_computing_in_the_Soviet_Union
  - https://www.new-east-archive.org/articles/show/3395/Russian-video-games-history
- **Germany** [FOREIGN: Germany] — a claimed German distribution/cloning of Cinematronics
  *Space Wars* **could not be substantiated**. Treat as rumoured.
  - http://www.andysarcade.de/spacewars_d.html (German Space Wars page; not corroborated as a German release)
- **UK / continental Europe** [FOREIGN] — no university/research-lab Spacewar port
  surfaced for this period. The Norway/Kjeller (NDRE) lead resolved to Norway building
  its *own* SAM minicomputers, not importing a PDP-1; the British Elliott 803 line was
  checked without a confirmed Spacewar. NB: the project site's `cambridge.html` should
  be checked for whether it is Cambridge UK or Cambridge MA. Status: nothing documented.
  - https://en.wikipedia.org/wiki/Elliott_803

### 4d. Refuted diffusion myth

- The popular claim that **DEC loaded Spacewar! onto every PDP-1 it shipped** was
  **refuted (0-3)** by the verification pass. This is the mechanism usually invoked for
  "it spread everywhere"; it does not hold as stated. (Graetz's own account of the
  spread, by contrast, was confirmed.)

## Working note: the "it spread everywhere" problem

Much of the popular Spacewar literature asserts the game spread to "every PDP-1
installation" worldwide. Two separate questions hide inside that claim, and they have
different answers.

1. *Faithful PDP-1 ports abroad.* These are tightly bounded: the PDP-1 was ~US$120,000
   with only ~53 units built and a largely North American installed base (the one
   documented non-US unit was Canadian). A wide *foreign* spread of the original on its
   native hardware is therefore unlikely, and blanket "it ran on every PDP-1" claims
   should be treated as apocryphal until a specific machine, site, and source appear.

2. *Re-implementations on other hardware.* This is the live question, and it is NOT
   bounded by PDP-1 exports. The documented US pattern is precisely re-implementation
   on whatever was to hand, PDP-6/8/10, GT40/PDP-11, a CDC 3100, so a foreign lab with
   a PDP-11 (or a Soviet SM EVM clone, or a British or Japanese minicomputer) could
   have produced its own Spacewar the same way. The catalogue must search for these on
   their own terms (local hardware, local authorship, possibly a local name), not look
   only for the MIT PDP-1 code abroad.

So the correct provisional reading is "no foreign version found in English-language
sources yet," not "no foreign version existed." The near-exclusively-US documented
record is itself a finding, but it is an absence-of-evidence claim and is especially
weak for the non-English archives (Russian, Japanese, German), which the current pass
can only partly reach.

## Sources and method

Compiled from: the repo's own `sources/ports/` archive (primary source files with
provenance); two deep-research web passes (5-6 search angles each, source-fetch, 3-vote
adversarial verification) run 2026-06-17 — a first general pass (US baseline, foreign
pass truncated by a session limit) and a second foreign-only pass (task w4ci1btqn,
complete); Computer History Museum, Stanford InfoLab/SAILDART, bitsavers DEC
serial-number registry, masswerk, arcade-museum / arcade-history flyer archives,
Sega's own corporate history, Japanese and Russian-language Wikipedia, and the Analog
and Rolling Stone primary documents in `sources/reference/`. "Confirmed (n-0)" / "(0-3)"
note claims that survived or failed adversarial verification. Entries without a vote are
from the repo source files or single sources and should be treated as provisional. The
foreign negatives are absence-of-evidence in (mainly) English-language sources, not
proven absences; non-English archives (Russian, fuller Japanese, German) remain the
obvious place to push further.
