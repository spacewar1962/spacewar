/*
 * tour.js - this bench's guided tour: its stops, and the offer made on a first visit. The
 * tour itself is bench-kit's (kit/tours.js), which reads them from SW.BENCH. A stop: title,
 * text, and where to go: v (version), tab, find (a pattern for the line to select in Read),
 * lens, graphic, gen (genealogy view), tape ({path, mode}), b (Compare's other version),
 * focus (a selector to outline).
 */
(function (root) {
  'use strict';
  var B = root.SW.BENCH;
  B.tourOffer = 'A short tour shows how to read, run, compare and annotate the Spacewar! sources (twelve stops, about three minutes).';
  B.tours = {
    welcome: { title: 'Welcome to the bench', stops: [
      { title: 'Welcome to the bench', v: '3.1', tab: 'read', focus: '#pick-a',
        text: 'The bench holds every surviving version of Spacewar!, from the 1962 tapes to modern reassemblies, each assembled from its source so that it can be read, run and compared. Choose a version here. The tour starts with 3.1, the standard version of September 1962.' },
      { title: 'Reading a listing', v: '3.1', tab: 'read', find: /^\s*str,/, focus: '.ln.sel',
        text: 'Each line shows its number in the source file, the address it was assembled to and the word it became, then the source. This is str, the capture radius of the central star. Key in the toolbar explains the colours and marks. Click a symbol to see where it is defined and used.' },
      { title: 'Annotating together', v: '3.1', tab: 'read', find: /^\s*str,/, focus: '#rd-selbar',
        text: 'Select a line (shift-click for a range) and choose Annotate. Annotations are signed with your initials and dated, and they are shared with the group through Hypothesis, so everyone sees them as they are written. Set your initials and the group in Settings (⚙) before you start.' },
      { title: 'How annotations show', v: '3.1', tab: 'read', focus: '#rd-notes-mode',
        text: 'This button changes how annotations appear in the listing: under their lines, as cards in the margin, as initials only, or hidden. Replies, reactions, edits and deletions all work where the annotation is shown.' },
      { title: 'Run it', v: '3.1', tab: 'run', focus: '#view-run .scope-wrap',
        text: 'Every version runs on the bench’s PDP-1 emulator, drawn on a model of the Type 30 display. Click the screen and play: W A S D for the Needle, I J K L for the Wedge (W and I fire, S and K the rocket, A and J turn left, D and L turn right). You can step, set breakpoints and profile where the time goes.' },
      { title: 'Text and Program', v: '3.1', lens: 14, focus: '#tabs [data-menu="text"]',
        text: 'The Text and Program menus open lenses on the code: comments, hands and dates, names, calls, instructions, memory, timing. Symbol histories, shown here, follows one name through every version, when it appears, changes and goes.' },
      { title: 'Collate two versions', v: '3.1', tab: 'compare', b: '4.0', focus: '#tabs [data-menu="versions"]',
        text: 'Collate sets two versions side by side, as text, as constants and symbols, or as a map of routines that you can zoom into the code. Here is 3.1 against 4.0. The Versions menu also holds each version’s record, the genealogy, the tapes and the gaps.' },
      { title: 'How the versions descend', v: '4.1', gen: 'stemma',
        text: 'The stemma places every version under the one it was made from, with its similarity to that parent. Other readings of a version sit beside it; lost versions are dashed. Flow traces each routine through a line of descent, and can be zoomed until the code shows.' },
      { title: 'The paper tapes', v: '4.1', tab: 'tape', tape: { path: 'SteveRussell_box1/sw4.2.bin', mode: 'anatomy' },
        text: 'The surviving tapes are read frame by frame. Anatomy shows each tape’s leader and punched title, the loader, every block with its checksum, and the closing jump. This tape’s one failing checksum showed that it is the 20 February 4.1 with one lost hole, not a different build.' },
      { title: 'Graphics', v: '3.1', graphic: 'sky', focus: '#tabs [data-menu="graphics"]',
        text: 'The Graphics menu draws what the program draws and does, each worked out by the version’s own code on the emulator: Peter Samson’s star map and the scope, the ships, the sun and hyperspace slowed down, the pull of the star and its well, orbits, and plates of the ships’ movements.' },
      { title: 'Findings and My notes', v: '3.1', tab: 'findings', focus: '#tabs [data-tab="notes"]',
        text: 'Findings gathers what the group and the bench have established, each with its evidence a click away. Add one with ✎ Add a finding, or ★ Finding on a selection in Read. My notes is your own tray for writing: figures, excerpts and paragraphs, exported together to Word. Read’s Edition menu makes a printable edition of any version.' },
      { title: 'Help and settings', v: '3.1', tab: 'read', focus: '#tabs [data-menu="help"]',
        text: 'Help holds this tour, referencing, a site map with every view as a plain link, Settings (initials, group, colour theme, code font), a backup of your notes and findings, and About. You can take the tour again from Help at any time. Welcome to the group.' }
    ] }
  };
})(typeof window !== 'undefined' ? window : globalThis);
