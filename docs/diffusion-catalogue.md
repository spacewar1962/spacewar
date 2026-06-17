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

**Status (2026-06-17):** the firmly-documented record for 1961-1980 is, so far,
*entirely US*. The foreign instances below are leads, not confirmed cases; a
verification pass was cut short by a research session limit and is to be resumed. Do
not assert the foreign cases, or the absence of foreign cases, in the book until the
verification is complete.

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

## 4. Foreign (non-US) — LEADS TO VERIFY (not confirmed)

None of the following is yet documented to the standard of sections 1-3. They are the
targets of an in-progress verification pass (deep-research task w4ci1btqn, launched
2026-06-17). **Confirmed foreign cases will be appended here with their source URLs;**
the items below are background pointers and search starting points, NOT confirmations
of a Spacewar port.

- **USSR / Eastern bloc** [FOREIGN: USSR] — **Preliminary finding (research in
  progress, 2026-06-17): no documented Soviet Spacewar found yet, but the lead is NOT
  closed.** Method note: a foreign Spacewar need not be on a PDP-1. As the US diffusion
  shows, most "versions" were re-implementations on whatever hardware was locally
  available (PDP-6/8/10, GT40/PDP-11, CDC 3100), not faithful PDP-1 ports. So the
  relevant question for the USSR is a *re-implementation on Soviet hardware*, which the
  PDP-1-export facts do not bound.
  - The PDP-1 facts rule out only a *faithful original-hardware port*: no Soviet PDP-1
    clone existed (Soviet PDP cloning was of the PDP-11 ISA, 1801 series, early 1980s,
    plus a PDP-8-based ASVT system). This does NOT rule out a Soviet re-implementation
    on a PDP-11 clone or other machine.
  - **SM EVM remains the live lead.** The SM EVM line (Soviet PDP-11/VAX clones,
    1975-onward) could in principle host a re-implementation; its English-language
    documentation names no Spacewar or any game, but that is thin evidence either way.
    Needs Russian-language sources (DECUS-equivalent listings, university archives,
    period magazines) to confirm or refute. https://en.wikipedia.org/wiki/SM_EVM
  - Standard (English) histories of Soviet computing name exactly one video game,
    Tetris (Pajitnov, 1984, Elektronika 60 / DVK PDP-11 clone) — later than the window
    and by independent invention, not a Spacewar lineage. Suggestive of a thin Soviet
    game-culture record before the 1980s, but English-language coverage is itself thin.
    https://en.wikipedia.org/wiki/History_of_computing_in_the_Soviet_Union
  - PDP-1 export bound (applies to faithful PDP-1 ports only): ~53 units at ~US$120,000;
    the one identified non-US installation was in **Canada** (AECL, later Science North;
    since scrapped) — no European, Soviet, or Japanese PDP-1 site documented.
    https://en.wikipedia.org/wiki/PDP-1
  - *(Subject to the workflow's final pass; the honest status is "not found in
    English-language sources," not "did not exist.")*
- **Germany** [FOREIGN: Germany] — a Space Wars (Cinematronics) distribution in
  Germany. Unverified.
- **Japan** [FOREIGN: Japan] — early Japanese arcade derivatives in the Space Wars
  lineage (post-1977). Under research.
- **UK / continental Europe** [FOREIGN] — university/research-lab ports on PDP-1 or
  later minicomputers. Under research. NB: the project site has a `cambridge.html`
  institution page; confirm whether it refers to Cambridge UK or Cambridge MA, as it
  may already bear on this section.

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
provenance); a deep-research web pass (5 search angles, source-fetch, 3-vote
adversarial verification) run 2026-06-17, partial (foreign pass incomplete);
Computer History Museum, Stanford InfoLab/SAILDART, Wikipedia, and the Analog and
Rolling Stone primary documents in `sources/reference/`. "Confirmed (n-0)" notes a
claim that survived adversarial verification. Entries without that note are from the
repo source files or single sources and should be treated as provisional pending the
same scrutiny.
