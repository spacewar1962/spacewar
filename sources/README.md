# Spacewar! source archive

Locally hosted copies of every surviving Spacewar! source listing and tape image,
mirrored here to guard the project against external link-rot. Files keep a uniform
`spacewar-<version>-<date>` naming scheme; this table maps each back to its version
and its upstream origin.

Spacewar! is in the public domain. These are MIT-era listings and community
reconstructions, preserved by Norbert Landsteiner (masswerk.at) and bitsavers.org.

`.txt` files are the human-readable PDP-1 MACRO source (tab-aligned columns,
`/`-delimited comments); `.rim` files are RIM-format paper-tape images (binary,
for loading into an emulator); `.pdf` files are scans of the original printed
source listings (the material artifact behind the transcription).

## The version lineage

| Version | Date | File | Origin |
|---------|------|------|--------|
| 1 | early 1962 | `spacewar-1-1962-reconstructed.txt` | masswerk reconstruction (Landsteiner 2016/2021); not an authentic program |
| 2B (pre-release) | 25 Mar 1962 | `spacewar-2b-25mar1962.txt` | masswerk; earliest dated pre-2B build |
| 2B | 2 Apr 1962 | `spacewar-2b-2apr1962.txt` | masswerk; reconstructed from disassembly (Landsteiner 2014) |
| — (Expensive Planetarium) | 13 Mar 1962 | `spacewar-2b-stars-prs-13mar1962.txt` | masswerk; Samson's ("prs") star-field data for 2B |
| 3.1 | 24 Sep 1962 | `spacewar-3.1-24sep1962.txt` | masswerk; the standard, most-emulated version |
| 4.0 & 4.2 | 2 Feb / 11 May 1963 | `spacewar-4.x-morris-listing.pdf` | bitsavers; scan of the "ddp" (Preonas) listings held by Joe Morris. The only surviving source for 4.0 and Preonas's 4.2 |
| 4.1 (CHM, rev. d) | base 20 Feb 1963; mod. Jun 2005 | `spacewar-4.1-chm-2005d.txt` / `.rim` | bitsavers; Samson's Computer History Museum port, June 2005 checkpoint |
| 4.1 (CHM, rev. f) | base 20 Feb 1963; mod. Nov 2005, Aug 2008 | `spacewar-4.1-chm-2008f.txt` / `.rim` | bitsavers (`from_peter_samson/sw41f`); the final CHM revision the restored PDP-1 runs |
| 4.3 | 17 May 1963 | `spacewar-4.3-17may1963.txt` | masswerk; Preonas's Twin Star subjective view, reassembled |
| 4.4 | 21 May 1963 | `spacewar-4.4-21may1963.txt` | masswerk; dual-console subjective view |
| 4.4 (variant f) | 21 May 1963 | `spacewar-4.4f-21may1963.txt` | masswerk; alternate reassembly of 4.4 |
| 4.8 part 1 | 24 Jul 1963 | `spacewar-4.8-pt1-24jul1963.txt` (+ `.pdf` scan) | bitsavers; the last MIT version, "dfw" |
| 4.8 part 2 | 24 Jul 1963 | `spacewar-4.8-pt2-24jul1963.txt` (+ `.pdf` scan) | bitsavers; second half of the 4.8 listing |
| 4.8 scorer | 24 Jul 1963 | `spacewar-4.8-scorer-24jul1963.txt` (+ `.pdf` scan) | bitsavers; the score-display routine (Preonas's, reworked by Samson) |
| 2015 | 2015 | `spacewar-2015-landsteiner.txt` / `.rim` | masswerk; Landsteiner's new PDP-1 program reviving the Minskytron hyperspace and subjective view |

## What does not survive

No source exists for **2A** (March 1962 integration stage), **4.1 in its clean
pre-museum form**, **4.2a**, or the lost **4.5 / 4.6 / 4.7**. The genuine February
1963 "spacewar 4.1 2/20/63 dfw" survives only as the base layer braided inside
Samson's CHM reconstruction (which also folds in the 4.2 dfw material and the 4.8
score display); there is no independent 1963 tape to set beside it.

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

- masswerk.at/spacewar/sources/ — Norbert Landsteiner's reconstructions and the emulator they drive
- bitsavers.org/pdf/mit/rle_pdp1/spacewar/ — scanned MIT/RLE listings
- bitsavers.org/bits/DEC/pdp1/from_peter_samson/ — Peter Samson's CHM files
