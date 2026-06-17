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
  4.x, 4.8) is collated in the Source Variorum. *Source: Computer History Museum;
  archive.org/details/pdp1_spacewar. Confirmed (3-0).*

## 2. US institutional ports (documented; held in `sources/ports/`)

- **WAR 44** [US] — PDP-6, MIT, from Peter Samson's DECtape, c.1968.
- **MIT-AI ITS line: SPCWAR / NEWWAR / TVWAR** [US] — PDP-6/10 on ITS, MIT AI Lab, to
  1976 (maintainers Harrenstein/KLH, GMP, CBF; nine-bit consoles by Kevin Hunter, Apr
  1976). Name genealogy WAR -> SWAR -> SUPER -> STAR -> SPACE -> SPACE4 -> NSPACE ->
  SPCWAR. TVWAR is the Knight-TV (raster) variant.
- **Stanford SAIL: Gorin version** [US] — PDP-10/6, Ralph E. Gorin (Sept 1971, with R.
  Taylor Feb 1972), MACRO-10; plus `SHIPS.SAI`. The version run with up to five ships
  at the 1972 *Rolling Stone* Spacewar Olympics.
- **GT40 / PDP-11 vector line** [US]:
  - Eross — Botond G. Eross, Stanford AI Project, 1973, MACRO-11 (inspired by Gorin's PDP-10 version).
  - Bryant & Seiler — "Space War Version 5B," Larry Bryant & Bill Seiler, 21 Jul 1974 (DECUS 11-192; recovered from Seiler's printout by Mattis Lind, 2021).
  - Waters & Billmers — MIT AI Lab, c.1976 (depends on the GTROS minimal OS).
- **PDP-8 / LAB-8** [US] — Evan Suits, "Interplanetary Death and Destruction on your
  LAB-8," 11 Jan 1971, PAL.
- **LINC-8 / PDP-12** [US] — `SPCWAR v3`, D. E. Wrege & Assoc. at Georgia Tech, 1974
  (LAP6). Notable as an early *copyrighted, commercially distributed* Spacewar source
  ("Copyright (C) 1974 by D.E. Wrege & Assoc.").
- **CDC 3100** [US] — Albert Kuhfeld, University of Minnesota, 1967-68; a
  re-implementation on non-DEC hardware, described in *Analog Science Fiction and
  Fact*, 1971. *Source: Wikipedia (Kuhfeld); the Analog article is in `sources/reference/`.*

## 3. US commercial / arcade descendants (documented)

- **Galaxy Game** [US] — Bill Pitts & Hugh Tuck, Stanford (Tresidder Union), Sept 1971;
  coin-operated; PDP-11/20 with HP 1300A display; a faithful PDP-11 re-implementation
  of the Stanford PDP-10 version. *Source: infolab.stanford.edu/pub/voy/museum/galaxy.html. Confirmed (3-0).*
- **Computer Space** [US] — Nutting Associates (Nolan Bushnell & Ted Dabney), 1971;
  the first commercial coin-op video game; inspired by Spacewar!. *Source: standard video-game history; verify exact wording.*
- **Space Wars** [US] — Cinematronics (designer Larry Rosenthal, an MIT graduate
  familiar with the original), 1977; black-and-white vector graphics; based on
  Spacewar!. *Source: Wikipedia, Space_Wars. Confirmed (3-0).*

## 4. Foreign (non-US) — LEADS TO VERIFY (not confirmed)

None of the following is yet documented to the standard of sections 1-3. They are the
targets of the resumed verification pass.

- **USSR / Eastern bloc** [FOREIGN: USSR] — a Spacewar on the SM EVM (СМ ЭВМ), the
  Soviet PDP-11-compatible minicomputer line (1970s). Plausible given the SM EVM's
  PDP-11 lineage, but no source verified; the research queued and failed to confirm.
- **Germany** [FOREIGN: Germany] — a Space Wars (Cinematronics) distribution in
  Germany. Unverified.
- **Japan** [FOREIGN: Japan] — early Japanese arcade derivatives in the Space Wars
  lineage (post-1977). Not yet researched.
- **UK / continental Europe** [FOREIGN] — university/research-lab ports on PDP-1 or
  later minicomputers. Not yet researched. NB: the project site has a `cambridge.html`
  institution page; confirm whether it refers to Cambridge UK or Cambridge MA, as it
  may already bear on this section.

## Working note: the "it spread everywhere" problem

Much of the popular Spacewar literature asserts the game spread to "every PDP-1
installation" worldwide. This is plausible as folklore but thinly sourced, and the
material constraints (PDP-1: ~US$120,000, ~53 units built, a largely North American
installed base) make a wide *foreign* spread in the 1960s unlikely. Treat blanket
diffusion claims as apocryphal until a specific machine, site, and source are
identified. The documented evidence so far supports a near-exclusively US diffusion in
this period, which is a finding in its own right, but stated as such it is an
absence-of-evidence claim and needs the verification pass behind it.

## Sources and method

Compiled from: the repo's own `sources/ports/` archive (primary source files with
provenance); a deep-research web pass (5 search angles, source-fetch, 3-vote
adversarial verification) run 2026-06-17, partial (foreign pass incomplete);
Computer History Museum, Stanford InfoLab/SAILDART, Wikipedia, and the Analog and
Rolling Stone primary documents in `sources/reference/`. "Confirmed (n-0)" notes a
claim that survived adversarial verification. Entries without that note are from the
repo source files or single sources and should be treated as provisional pending the
same scrutiny.
