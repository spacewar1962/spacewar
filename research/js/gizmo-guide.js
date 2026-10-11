/*
 * gizmo-guide.js - the Help guide to Art's Dynamic Profile Gizmo (?help=gizmo), this bench's own,
 * added to bench-kit's guides (kit/guides.js).
 */
(function (root) {
  'use strict';
  var SW = root.SW;
  function ul(items) { return '<ul class="ah-steps">' + items.filter(Boolean).map(function (t) { return '<li>' + t + '</li>'; }).join('') + '</ul>'; }
  function k(t) { return '<kbd>' + t + '</kbd>'; }
  SW.guideAdd('gizmo', ['Art’s Dynamic Profile Gizmo', [
      ['What it is', '<p>Program ▸ The machine ▸ Art’s Dynamic Profile Gizmo, after Art Schwarz: the code as a graph of blocks, each a run of instructions between branches, joined by the branches taken. Three modes, in the bar: <b>Profile</b>, <b>⇄ Compare</b> and <b>☰ Across the versions</b>.</p>'],
      ['Profile', ul([
        '<b>▶ Sample run</b> runs the version here for 5 to 60 s of machine time, averaged over 1, 3 or 5 runs, with both ships flown by Lensman AI (a style for each), or with no one at the controls. Or play the game in Run and come back for the profile of your run.',
        'Each box is a block, shaded by its share of the time, with its time in milliseconds; edges are branches, thicker for more often. <b>Show</b> keeps the busiest blocks that make up 80% to 100% of the time.',
        'Click a box for its figures (time, per entry, times entered, instructions run, length, branches), its source with <b>Read in context ↗</b>, the instructions it ran, and where it comes from and goes to.'])],
      ['Compare', ul([
        'Two versions side by side, routine by routine, a routine in the same place on both sides, from their code and a 5 s sample run of each. <b>⇄ Swap</b> turns them round; <b>🔗 Link</b> copies a link to the comparison. The version compared with is remembered for each version.',
        'Outlines: violet altered, green inserted, red removed; an empty dashed box has no counterpart on that side. <b>Split the main loop</b> draws the largest routine as its labelled parts.',
        'Click a routine for its figures in both versions and its blocks side by side; <b>Blocks | Code</b> switches to its code in both, with ‹ › through its blocks.'])],
      ['Across the versions', '<p>Every version against the one it was made from, a row for each routine and a column for each version: ● the same, ◐ altered, ↪ moved, ＋ new, × gone. Click a cell for that comparison, the routine open.</p>'],
      ['Naming and marking', ul([
        'In a block’s or routine’s box, give it a <b>Name</b>. The graph shows your name, with its own label beneath (the box’s heading shows it in grey brackets). Names are kept in this browser, per version; a routine’s name in Compare goes on both versions.',
        'Mark it in a colour for tracing: the swatches beside the name (orange, blue, pink, teal, brown) put a bar down the box’s left edge; ✕ takes it off.',
        k('⇧') + '-click a box in the graph to mark it in the last colour chosen, or to take its mark off, without opening it. <b>Clear marks</b> in the bar takes them all off (it asks first).'])],
      ['Sharing a tracing', ul([
        '<b>⑂ Tracings</b> in the bar (Profile and Compare): give your names and marks for the versions shown a title and a note, and <b>Share with the crew</b>. They go to the annotation group, so everyone in it can open them.',
        'The same list holds the crew’s tracings, those for the versions shown first. Opening one shows its names and marks in place of yours, read-only, with a chip in the bar: <b>Keep as mine</b> copies them into yours, the share button sends a link that opens it, ✕ closes it.',
        'You can delete your own tracings from the list.'])],
      ['Keeping it', '<p>Each graph saves as SVG or PNG; the tables export to Word and Markdown (Export, top right); a block or routine goes into My notes with its name, figures and code.</p>']
    ]]);
})(typeof window !== 'undefined' ? window : globalThis);
