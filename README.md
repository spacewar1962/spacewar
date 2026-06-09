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

A critical code reading of **_Spacewar!_**, the space-combat game written for the DEC PDP-1 at MIT in 1961–62. We read the original MIDAS assembly source as a cultural text, in the tradition of Critical Code Studies: at once literature, mechanism, spatial form, and a repository of the social formation that produced it. This repository holds the source, a runnable emulator, and the project website. It is a companion to _Inventing ELIZA: How the First Chatbot Shaped the Future of AI_ (MIT Press, 2026).

## Explore

- 🌐 **Project site:** <https://spacewar1962.github.io/spacewar/>
- 🕹 **Play the 1962 original:** <https://spacewar1962.github.io/spacewar/play.html>
- 📚 **Bibliography:** <https://spacewar1962.github.io/spacewar/bibliography.html>

## The object

The primary text is the original MIDAS macro-assembly source, preserved here alongside its assembler listing, a provenance snapshot, and a working PDP-1 emulator, so that the reading can move between text and execution.

| File | What it is |
|------|------------|
| [`spacewar.mac`](spacewar.mac) | The original MIDAS macro-assembly source (~2,000 lines). The primary close-reading text. |
| [`spacewar.lst`](spacewar.lst) | The assembler listing: octal addresses and machine words beside each line. The program as it sits in core. |
| [`originsources.zip`](originsources.zip) | A dated upstream snapshot, tracing the source back through the Silverman / Gerasimov PDP-1 emulator. |
| `spacewar.js`, `spacewar.bin.js` | The PDP-1 emulator that runs the 1962 binary in the browser. |
| `index.html`, `play.html`, `bibliography.html` | The project website (served via GitHub Pages). |
| `assets/`, `*.css` | Site styling and brand assets. |
| `bibliography.source.md`, `build-bibliography.py` | The bibliography and the generator that renders it. |

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

This reading builds on the Critical Code Studies tradition established by Mark C. Marino and developed in David M. Berry's materialist-phenomenological method, and on the work of the historians and preservationists who recovered and ran this code.
