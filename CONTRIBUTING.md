# Contributing

Welcome. This repository holds the **_Spacewar!_ (1962): A Critical Code Studies Reading** — the original PDP-1 MIDAS source, a runnable emulator, and the project website. The project is led by David M. Berry (University of Sussex) and Mark C. Marino (University of Southern California).

## Branch model

`main` is **protected**: it is always the live, deployed site (published via GitHub Pages at <https://spacewar1962.github.io/spacewar/>). You cannot push to `main` directly. All changes go through a pull request with one review.

`stable` and the version tags (`v1.0`, …) are **restore points**. Please do not push to them; they exist so a broken `main` can be rolled back.

## Making a change

```sh
git clone https://github.com/spacewar1962/spacewar.git
cd spacewar
git checkout -b your-branch-name      # e.g. reading-hyperspace, fix-typo

# ... make your changes ...

git add -A
git commit -m "Short description of the change"
git push -u origin your-branch-name
```

Then open a pull request against `main` on GitHub. One of the project leads will review and merge. If the PR touches the website, GitHub Pages redeploys automatically on merge.

## Running the site locally

The site is static. From a clone:

```sh
python3 -m http.server 8000
# open http://localhost:8000/
```

- `index.html` — the project front door
- `play.html` — the PDP-1 emulator
- `bibliography.html` — **generated**, do not edit by hand

## Editing the bibliography

`bibliography.html` is built from a source file. Edit the source, then regenerate:

```sh
# edit bibliography.source.md
python3 build-bibliography.py    # rewrites bibliography.html
```

Commit both the source and the regenerated `bibliography.html`. Any reference that enters the reading is verified against the project's Zotero library first.

## House style (prose)

- British spelling.
- Avoid em dashes; use commas or restructure the sentence.
- Cite from Zotero; never invent a reference.

## Questions

Open an issue, or email the project leads: David M. Berry (d.m.berry@sussex.ac.uk), Mark C. Marino (mcmarino@usc.edu).
