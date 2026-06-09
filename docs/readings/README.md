# Close-reading memos

One memo per code fragment, keyed to a line range in [`../../spacewar.mac`](../../spacewar.mac) and the corresponding octal block in [`../../spacewar.lst`](../../spacewar.lst). Copy the template below into a new file named for the fragment (e.g. `macro-defines.md`).

## Template

```markdown
# <slug> — <short title>

**Source:** spacewar.mac L<start>–L<end> · **Listing:** spacewar.lst octal <addr>–<addr>

## The fragment
<verbatim excerpt>

## Technical explication
What it does: the instructions, the MIDAS macros invoked, how it runs.

## Interpretive analysis
The extra-functional significance; the constellation it opens.

## Spirals out to
Cultural formations, theory, other fragments.

## Open threads
Questions still live; references to verify against Zotero.
```

## Index

_(none yet)_

Candidates, in rough reading order:

- `macro-defines` — the MIDAS `define` block at the head of the source.
- `outline-compiler` — the spaceship-outline drawing scheme.
- `expensive-planetarium` — Samson's star background.
- `gravity` — Edwards's central-star gravity.
- `hyperspace` — the random-jump panic button.
