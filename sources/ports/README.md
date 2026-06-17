# Spacewar! beyond the PDP-1 - source archive

Preservation copies of Spacewar! sources for machines *other* than the original
PDP-1, supporting the "long journey" ports table on the code page. `.txt` files are
the source as archived (viewable in the browser); `.pt` is a binary paper-tape
image; `.ini` is a SIMH emulator config.

These are 1960s–1970s historical computing artifacts gathered from public
preservation archives. **Provenance and attribution are given per file below; links
point to the upstream homes.** Where an upstream repository carries no explicit
licence, these copies are mirrored for scholarship and preservation, not as a claim
of rights; please honour the originators' wishes and cite the upstream.

## Stanford AI Lab - PDP-10 / PDP-6 (the SAIL line)

| File | What it is |
|------|-----------|
| `spacewar-pdp10-sail-gorin-1971.txt` | "SW - SPACE WAR PROGRAM FOR STANFORD A.I. PROJECT." Ralph E. Gorin (5 Sept 1971), with R. Taylor (Feb 1972). MACRO-10, with separate "PDP-10 Space War module" and "PDP-6 Space War module." This is **Gorin's version**, the one run up to 5 ships at the 1972 *Rolling Stone* Spacewar Olympics. Extracted and cleaned from the SAILDART page-dump (`[SW,BGB]`): the per-line record markers were stripped to leave the source as listed. |
| `spacewar-pdp10-sail-gorin-1971-ships.txt` | `SHIPS.SAI`, the ship-shape definitions module (SAIL language), same provenance and cleaning. (A few non-ASCII SAIL operator glyphs were dropped in the byte-cleaning; the structure is intact.) |

Upstream: saildart.org ; also github.com/PDP-10/Spacewar (`MIT/.../SW.MAC`).

## MIT AI Lab - PDP-6 / PDP-10 on ITS (the MIT line)

| File | What it is |
|------|-----------|
| `spacewar-pdp6-10-mit-its-spcwar.txt` | **`SPCWAR`** - "MIT-AI PDP-6/10 Space-War" (MACRO-10), as preserved from the ITS filesystem. Its header records the name genealogy `WAR → SWAR → SUPER → STAR → SPACE → SPACE4 → NSPACE → SPCWAR`, the 1976 maintainers (Harrenstein / KLH, GMP, CBF), the new nine-bit consoles built by Kevin Hunter (9 Apr 1976), and a dated modification log. |
| `spacewar-pdp6-10-mit-its-newwar.txt` | `NEWWAR`, a later MIT-AI variant from the same ITS archive. |
| `spacewar-knighttv-mit-its-tvwar.txt` | `TVWAR`, the version for the Knight TV (raster) displays. |
| `spacewar-pdp6-10-mit-its-people.txt` | `SPCWAR PEOPLE`, the in-archive credits/people file. |
| `spacewar-pdp6-mit-war44-1968.txt` | `WAR 44`, the PDP-6 version from Peter Samson's DECtape, c.1968. |

Upstream: github.com/PDP-10/Spacewar (`MIT/1976/extracted/`, `MIT/1968/war.44`).

## GT40 - PDP-11 vector display

| File | What it is |
|------|-----------|
| `spacewar-gt40-pdp11-stanford-eross-1973.txt` | **`SPCWAR`** - Botond G. Eross's GT40/PDP-11 version (MACRO-11), copyright 1973 at the Stanford AI Project; with mines and a "wild variable". Recovered from the Stanford SAILDART archive (`SW.P11[11,BO]`, filed 1975); SailDart wrapper and page-index stripped, HTML entities unescaped. |
| `spacewar-gt40-pdp11-bryant-seiler-1974.pdf` | Scan of Larry Bryant & Bill Seiler's 1974 PDP-11/GT40 Spacewar listing (DECUS **11-192**); lost when DECUS discarded its sources, recovered from Seiler's saved printout by Mattis Lind in 2021. See `pdp11.html`. Upstream: github.com/MattisLind/SPACEWAR. |
| `spacewar-gt40-pdp11-1976.pt` | The runnable paper-tape image of the GT40 Spacewar by Richard C. Waters & Meyer A. Billmers (MIT AI Lab, c.1976; MACRO-11; depends on the GTROS minimal OS). |
| `spacewar-gt40-pdp11-1976-simh.ini` | The SIMH PDP-11 config to run it. |

Upstream for the MIT version: github.com/pdp11/mit-gt40-spacewar (full MACRO-11
source + AI Lab working papers 64/165/166). Licences unspecified upstream; mirrored
here for preservation.

## PDP-8 / LINC-8 / PDP-12

| File | What it is |
|------|-----------|
| `spacewar-pdp8-labx8-suits-1971.txt` | Evan Suits's **PDP-8** (LAB-8) port, 11 Jan 1971: "Interplanetary death and destruction on your LAB-8." A different machine entirely. |
| `spacewar-linc8-pdp12-gtech-wrege-1974.txt` | `SPCWAR v3`, D. E. Wrege & Assoc. at Georgia Tech (1974, LAP6 on the LINC-8 / PDP-12); a continuation of the SPCWAR line. |
