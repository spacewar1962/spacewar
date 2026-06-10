<p align="center">
  <a href="https://spacewar1962.github.io/spacewar/">
    <img src="assets/social-preview.png" alt="Spacewar! A Critical Code Studies Reading" width="820">
  </a>
</p>

<h1 align="center">Spacewar! (1962): A Critical Code Studies Reading</h1>

<p align="center">
  <a href="https://spacewar1962.github.io/spacewar/"><img alt="Live site" src="https://img.shields.io/badge/live-spacewar1962.github.io-6cf2ff"></a>
  <a href="https://github.com/spacewar1962/spacewar/releases"><img alt="Release" src="https://img.shields.io/github/v/release/spacewar1962/spacewar"></a>
  <a href="LICENSE"><img alt="License" src="https://img.shields.io/badge/license-AGPL--3.0-blue"></a>
</p>

A critical code reading of **_Spacewar!_**, the space-combat game written for the DEC PDP-1 at MIT in 1961–62. We read the original MIDAS assembly source as a cultural text, in the tradition of Critical Code Studies: at once literature, mechanism, spatial form, and a repository of the social formation that produced it.

This repository holds the original source, a runnable PDP-1 emulator, and the project website, so the reading can move between the text and its execution. _Spacewar!_ sits at an origin point of computational culture: real-time interactive graphics, the hacker ethic, the demo, and the free circulation of code all condense in roughly two thousand words of macro-assembly. Reading about the origins of computing is not the same as reading the origin's code, and the aim here is the latter, to sit with the listing, the macros, the octal addresses, and the running artefact, and to ask what this code knows, what it assumes, and what its founding myth leaves out.

The project develops along several lines. Its principal output is a **monograph** that grows from the close reading, working through the source movement by movement and setting each fragment in its cultural constellation. Around the writing we treat programming as scholarship, using the emulator to run, modify, and port the program so that interpretation is tested against the artefact, and we read the visual register of the Type 30 display in conjunction with the code that produces it, binding critical code studies to a visual and media-archaeological analysis. Further threads include a variorum across the surviving versions and ports, a fuller account of the paratexts, and the political economy of the gift economy that circulated the source inside a Cold-War research budget.

The reading is a companion to _Inventing ELIZA: How the First Chatbot Shaped the Future of AI_ (MIT Press, 2026). They are two foundational programs of the long 1960s, read side by side: ELIZA teaches the machine to talk, _Spacewar!_ teaches it to play.

## Explore

- 🌐 **Project site:** <https://spacewar1962.github.io/spacewar/>
- ❓ **Why this project matters today:** <https://spacewar1962.github.io/spacewar/why.html>
- 🕹 **Play the 1962 original:** <https://spacewar1962.github.io/spacewar/play.html>
- 📚 **Bibliography:** <https://spacewar1962.github.io/spacewar/bibliography.html>
- 🖥 **Alternate front pages:** [text (1990s)](https://spacewar1962.github.io/spacewar/index-text.html) · [vector display](https://spacewar1962.github.io/spacewar/index-vector.html)
- ↯ **Easter egg:** type `minsky` on the front page to summon the [Minskytron](https://www.masswerk.at/minskytron/), the PDP-1 display hack that came before _Spacewar!_ (and gave it the hyperspace effect).

## The object

The primary text is the original MIDAS macro-assembly source, preserved here alongside its assembler listing, a provenance snapshot, and a working PDP-1 emulator, so that the reading can move between text and execution.

| File | What it is |
|------|------------|
| [`spacewar.mac`](spacewar.mac) | The original MIDAS macro-assembly source (~2,000 lines). The primary close-reading text. |
| [`spacewar.lst`](spacewar.lst) | The assembler listing: octal addresses and machine words beside each line. The program as it sits in core. |
| [`originsources.zip`](originsources.zip) | A dated upstream snapshot, tracing the source back through the Silverman / Gerasimov PDP-1 emulator. |
| `spacewar.js`, `spacewar.bin.js` | The PDP-1 emulator that runs the 1962 binary in the browser. |
| `index.html`, `why.html`, `play.html`, `bibliography.html` | The project website (served via GitHub Pages). |
| `index-text.html`, `index-vector.html` | Alternate front pages: a 1990s text-only version and a vector-display version. |
| `assets/`, `*.css` | Site styling and brand assets. |
| `bibliography.source.md`, `build-bibliography.py` | The bibliography and the generator that renders it. |
| [`docs/`](docs/) | Public reading notes: the reading log and close-reading memos. |
| [`code/`](code/) | Working space for programming as scholarship (modifications, variations, ports). For future use. |

## The reading

The study works across the registers of Critical Code Studies, pairing close technical explication of a code fragment with the cultural constellation that spirals out from it. Six movements: the machine that owns itself; the MIDAS macros as a small language for writing the game; the Expensive Planetarium and its real sky; gravity and the central star; hyperspace as designed contingency; and the demo as gift.

Alongside close reading, we treat programming as scholarship, using the emulator to run, modify, and port the program, so interpretation is tested against the artefact rather than asserted about it. _Spacewar!_ is also, immediately, an image, a vector drawing on the Type 30 display, so we read the visual register in conjunction with the code that produces it, binding critical code studies to a visual and media-archaeological analysis of the display itself.

## Running locally

The site is static. From a clone of this repository:

```sh
python3 -m http.server 8000
# then open http://localhost:8000/
```

The bibliography page is generated. Edit [`bibliography.source.md`](bibliography.source.md), then:

```sh
python3 build-bibliography.py    # rewrites bibliography.html
```

## Contributing

`main` is protected and always reflects the live site. Changes go through a branch and a pull request with one review. See [`CONTRIBUTING.md`](CONTRIBUTING.md) for the workflow. The `stable` branch and the version tags are restore points; please do not push to them.

## Project leads

- **Professor David M. Berry**, University of Sussex (d.m.berry@sussex.ac.uk)
- **Professor Mark C. Marino**, University of Southern California (mcmarino@usc.edu)

## Provenance and licence

_Spacewar!_ was created in 1961–62 by Steve Russell, Martin Graetz, Wayne Wiitanen, and others in the circle around MIT's Tech Model Railroad Club, with the Expensive Planetarium by Peter Samson, gravity by Dan Edwards, and control boxes by Alan Kotok and Bob Saunders. The source and emulator preserved here descend from the canonical PDP-1 emulator by Barry Silverman, Brian Silverman, and Vadim Gerasimov (`spacewar.oversigma.com`), forked into this organisation for the reading. The original game is in the public domain; the emulator and surrounding code are distributed under the **GNU Affero General Public License v3.0** (see [`LICENSE`](LICENSE)).

## Acknowledgements

This reading builds on the Critical Code Studies tradition developed by Mark C. Marino and David M. Berry, and on the work of the historians and preservationists who recovered and ran this code.
