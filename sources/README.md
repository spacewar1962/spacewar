# Spacewar! source archive

Locally hosted copies of every surviving Spacewar! source listing and tape image,
mirrored here to guard the project against external link-rot. Files keep a uniform
`spacewar-<version>-<date>` naming scheme; this table maps each back to its version
and its upstream origin.

Spacewar! is in the public domain. These are MIT-era listings and community
reconstructions, preserved by Norbert Landsteiner (masswerk.at) and bitsavers.org.

## Folder layout

- **top level** — the canonical PDP-1 version lineage (1 / 2B / 3.1 / the 4.x
  generation / later PDP-1 reconstructions), in the `spacewar-<version>-<date>`
  scheme. Documented in the version-lineage table below.
- **`ports/`** — Spacewar! on machines *other than* the PDP-1: the port and clone
  sources (PDP-6/10, PDP-8, LINC-8/PDP-12, GT40/PDP-11, Knight TV, etc.), named
  `spacewar-<machine>-<lab/author>-<year>`. See that folder's own README and the
  "long journey" census on the `code.html` page.
- **`reference/`** — secondary and contextual documents, *not* Spacewar! source:
  magazine articles (Kuhfeld's 1971 *Analog*, the 1972 *Rolling Stone* excerpt),
  hardware manuals (the DEC PDP-11 Paper Tape Software Handbook), pseudocode
  (Alan Kay's *Rolling Stone* listing), and third-party reconstructions in other
  languages (Landsteiner's 2014 Minnesota JavaScript).
- **`SteveRussell_box1/`, `bin-files/`, `pdp1-programs/`, `sw/`** — specialised
  archives (authentic tapes, loose binaries, kindred PDP-1 programs); each has its
  own README.

`.txt` files are the human-readable PDP-1 MACRO source (tab-aligned columns,
`/`-delimited comments); `.rim` files are RIM-format paper-tape images (binary,
for loading into an emulator); `.pdf` files are scans of the original printed
source listings (the material artifact behind the transcription).

Files marked **`(Morris)`** were extracted by David M. Berry from the single
156-page Joe Morris scan (`spacewar-4.x-morris-listing.pdf`); the unmarked
reconstructions come from masswerk/bitsavers. Where both exist for a version (4.3,
4.4), the masswerk `.txt` is a community reassembly and the `(Morris)` files are
the original "ddp" listing as scanned.

## The version lineage

| Version | Date | File | Origin |
|---------|------|------|--------|
| 1 | early 1962 | `spacewar-1-1962-reconstructed.txt` | masswerk reconstruction (Landsteiner 2016/2021); not an authentic program |
| 2B (pre-release) | 25 Mar 1962 | `spacewar-2b-25mar1962.txt` | masswerk; earliest dated pre-2B build |
| 2B | 2 Apr 1962 | `spacewar-2b-2apr1962.txt` | masswerk; reconstructed from disassembly (Landsteiner 2014) |
| - (Expensive Planetarium) | 13 Mar 1962 | `spacewar-2b-stars-prs-13mar1962.txt` | masswerk; Samson's ("prs") star-field data for 2B |
| 3.1 | 24 Sep 1962 | `spacewar-3.1-24sep1962.txt` | masswerk; the standard, most-emulated version |
| 4.0 | 2 Feb 1963 | `spacewar-4.0-2feb1963-(Morris).pdf` + `.txt` (normalised) | "spacewar 4.0 2/2/63 ddp"; Preonas's listing, extracted from the Morris scan. The only surviving source for 4.0. The `.txt` is a page-by-page verified transcription |
| 4.0TS | 4 May 1963 | `spacewar-4.0ts-4may1963.pdf` + `.txt` | "spacewar 4.0ts 5/4/63 ddp"; a Twin Star variant of 4.0 (simplified starfield, random hyperspace spin), recovered by the CCS team. Verified transcription |
| 4.2 | 11 May 1963 | `spacewar-4.2-11may1963-(Morris).pdf` + `.txt` (normalised) | "spacewar 4.2 5/11/63 ddp"; extracted from the Morris scan. The only surviving source for Preonas's 4.2, the first with an on-screen score display. The `.txt` is a verified transcription (the score-display routine is on low-contrast pages, marked where uncertain) |
| 4.1 / 4.2a (original dfw) | 20 / 22 Feb 1963 | `spacewar-4.1-4.2a-feb1963-dfw-(Russell).txt`; `SteveRussell_box1/` | **The clean original 1963 dfw source**, located by the CCS team in Steve Russell's tape box (bitsavers papertapeImages). pt 1 = 4.1 (2/20/63 dfw), pt 2 = 4.2a (2/22/63 dfw); no CHM modifications |
| 4.1 (CHM, rev. d) | base 20 Feb 1963; mod. Jun 2005 | `spacewar-4.1-chm-2005d.txt` / `.rim` | bitsavers; Samson's Computer History Museum port, June 2005 checkpoint |
| 4.1 (CHM, rev. f) | base 20 Feb 1963; mod. Nov 2005, Aug 2008 | `spacewar-4.1-chm-2008f.txt` / `.rim` | bitsavers (`from_peter_samson/sw41f`); the final CHM revision the restored PDP-1 runs |
| 4.3 | 17 May 1963 | `spacewar-4.3-17may1963.txt` (masswerk) + `spacewar-4.3-17may1963-(Morris).pdf` | masswerk reassembly (what we had) + the original "spacewar 4.3 5/17/63 ddp" listing from the Morris scan, with `-(Morris).txt` the verified transcription. The masswerk reassembly is a later modified variant; the scan keeps the period code |
| 4.4 | 21 May 1963 | `spacewar-4.4-21may1963.txt` (masswerk) + `spacewar-4.4-21may1963-(Morris).pdf` + `.txt` | masswerk reassembly (what we had) + the original "spacewar 4.4 5/17/63 ddp" listing from the Morris scan (pt 1 dated 5/17, pt 2 5/21), with `-(Morris).txt` the verified transcription; dual-console subjective view |
| 4.4 (variant f) | 21 May 1963 | `spacewar-4.4f-21may1963.txt` | masswerk; alternate reassembly of 4.4 |
| 4.8 part 1 | 24 Jul 1963 | `spacewar-4.8-pt1-24jul1963.txt` (+ `.pdf` scan) | bitsavers; the last MIT version, "dfw" |
| 4.8 part 2 | 24 Jul 1963 | `spacewar-4.8-pt2-24jul1963.txt` (+ `.pdf` scan) | bitsavers; second half of the 4.8 listing |
| 4.8 scorer | 24 Jul 1963 | `spacewar-4.8-scorer-24jul1963.txt` (+ `.pdf` scan) | bitsavers; the score-display routine (Preonas's, reworked by Samson) |
| 2015 | 2015 | `spacewar-2015-landsteiner.txt` / `.rim` | masswerk; Landsteiner's new PDP-1 program reviving the Minskytron hyperspace and subjective view |

The full as-scanned compilation `spacewar-4.x-morris-listing.pdf` (bitsavers
`spacewar_Ver4.X.pdf`, 156 pp.) is retained as the source artifact: it bundles the
2B star table and the 4.0 / 4.2 / 4.3 / 4.4 "ddp" listings, from which the
per-version PDFs above were extracted.

## Other machines and authentic tapes

- `ports/` - all the ports to **other machines** (PDP-8, PDP-6/10, LINC-8/PDP-12,
  GT40/PDP-11, Knight TV, etc.). For example `ports/spacewar-pdp8-labx8-suits-1971.txt`
  is Evan Suits's 1971 LAB-8 (PDP-8) port; `ports/spacewar-gt40-pdp11-bryant-seiler-1974.pdf`
  and `ports/spacewar-gt40-pdp11-stanford-eross-1973.txt` are the two GT40/PDP-11
  versions. See the "long journey" ports table on the code page for the wider census
  of Spacewar! beyond the PDP-1.
- `SteveRussell_box1/` - authentic PDP-1 paper tapes from Steve Russell's box
  (bitsavers, 2003): the original dfw 4.1/4.2a, 3.1, sw4.2, and the star data. See
  its README.
- `bin-files/` - loose tape images: the authentic 4.2a tape, 2B, and a relabelled
  3.1. See its README.

## What does not survive

No source exists for **2A** (the March 1962 integration stage) or the lost
**4.5 / 4.6 / 4.7** (between the 4.4 experiment and 4.8).

The original **4.1** and **4.2a** (20 and 22 February 1963, dfw) were once thought
lost in clean form, surviving only inside Samson's CHM reconstruction. They were
subsequently located by the CCS team in Steve Russell's tape box (see above), so
the 1963 originals can now be set beside the museum reconstruction.

The `d` and `f` suffixes on the CHM files are Samson's own revision letters for that
single 2005–2008 reconstruction, not historical release numbers: `d` is the June
2005 checkpoint, `f` adds further work to November 2005 plus a score-display-delay
fix dated 22 August 2008.

## Related PDP-1 programs

`pdp1-programs/` holds other programs from the same machine and milieu (Samson's
display hacks including Munching Squares, his Harmony Compiler and PDP-1 Music, and
a PDP-1 Game of Life). These are Spacewar!'s kin, not versions of it; see that
folder's own README.

## Upstream sources

- masswerk.at/spacewar/sources/ - Norbert Landsteiner's reconstructions and the emulator they drive
- bitsavers.org/pdf/mit/rle_pdp1/spacewar/ - scanned MIT/RLE listings
- bitsavers.org/bits/DEC/pdp1/from_peter_samson/ - Peter Samson's CHM files
