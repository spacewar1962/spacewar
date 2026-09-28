/*
 * tours.js - a guided tour of the bench, for new members of the group: a
 * sequence of stops, each opening a version, a view and (where it helps) a
 * selection, with a line or two of commentary and a soft outline on the
 * control it is about. Played in a card in the bottom-left corner; Back and
 * Next (or the arrow keys), Esc to leave. Started from the Help menu,
 * Settings or the About box, a link ending ?tour=welcome, or the offer made on a first visit.
 */
(function (root) {
  'use strict';
  var SW = root.SW;
  var T = SW.tours = {};

  // A stop: title, text, and where to go: v (version), tab, find (a pattern
  // for the line to select in Read, so the tour survives renumbering), lens,
  // graphic, gen (genealogy view), tape ({path, mode}), b (Compare's other
  // version), focus (a selector to outline).
  T.TOURS = {
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
        text: 'Every version runs on the bench’s PDP-1 emulator, drawn on a model of the Type 30 display. Click the screen and play: W A S D for the Needle, I J K L for the Wedge. You can step, set breakpoints and profile where the time goes.' },
      { title: 'Text and Program', v: '3.1', lens: 14, focus: '#tabs [data-menu="text"]',
        text: 'The Text and Program menus open lenses on the code: comments, hands and dates, names, calls, instructions, memory, timing. Symbol histories, shown here, follows one name through every version, when it appears, changes and goes.' },
      { title: 'Compare two versions', v: '3.1', tab: 'compare', b: '4.0', focus: '#tabs [data-menu="versions"]',
        text: 'Compare sets two versions side by side, as text, as constants and symbols, or as a map of routines that you can zoom into the code. Here is 3.1 against 4.0. The Versions menu also holds each version’s record, the genealogy, the tapes and the gaps.' },
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

  var cur = null;   // { tour, i, card }

  function clearFocus() { SW.$$('.tour-focus').forEach(function (e) { e.classList.remove('tour-focus'); }); }
  function focusOn(sel) {
    clearFocus();
    if (!sel) return;
    var tries = 0;
    (function look() {
      var el = document.querySelector(sel);
      if (el && el.offsetParent !== null) { el.classList.add('tour-focus'); el.scrollIntoView({ block: 'nearest', inline: 'nearest' }); return; }
      if (++tries < 30) setTimeout(look, 150);
    })();
  }

  // Take the bench to a stop.
  function goTo(s) {
    if (SW.$('#dlg-settings').open) SW.$('#dlg-settings').close();
    if (SW.$('#dlg-about') && SW.$('#dlg-about').open) SW.$('#dlg-about').close();
    SW.closeDrawer && document.body.classList.contains('drawer-open') && SW.closeDrawer();
    if (s.v && s.v !== SW.state.v) SW.select(s.v);
    if (s.b) SW.state.b = s.b;
    if (s.tape) { SW.store.set('tape.mode', s.tape.mode || 'holes'); SW.state.tapeGo = { path: s.tape.path }; SW.forget('tape'); }
    if (s.lens) { SW.openLens(s.lens); return focusOn(s.focus); }
    if (s.graphic) { SW.openGraphic(s.graphic); return focusOn(s.focus); }
    if (s.gen) { SW.genealogyShow(s.gen); return focusOn(s.focus); }
    if (s.find) {
      SW.build(s.v || SW.state.v).then(function (b) {
        for (var p = 0; p < b.lines.length; p++) {
          if (b.parts[p].role !== 'program') continue;
          for (var i = 0; i < b.lines[p].length; i++) {
            var L = b.lines[p][i];
            if (!L.away && s.find.test(L.raw)) { SW.openAt(b.v.id, { p: p, n0: L.n }); return focusOn(s.focus); }
          }
        }
        SW.setTab('read'); focusOn(s.focus);
      });
      return;
    }
    if (s.tab) { if (s.tab === 'compare') SW.forget('compare'); SW.setTab(s.tab); }
    focusOn(s.focus);
  }

  function paint() {
    var t = cur.tour, s = t.stops[cur.i], n = t.stops.length;
    cur.card.innerHTML = '<div class="tour-top"><span class="tour-step">' + (cur.i + 1) + ' of ' + n + '</span><span class="tour-name">' + SW.esc(t.title) + '</span>' +
      '<button class="icon-btn tour-x" data-t="exit" title="Leave the tour (Esc)">✕</button></div>' +
      '<h3>' + SW.esc(s.title) + '</h3><p>' + SW.esc(s.text) + '</p>' +
      '<div class="tour-dots">' + t.stops.map(function (x, k) { return '<i class="' + (k === cur.i ? 'on' : k < cur.i ? 'done' : '') + '" data-t="go" data-k="' + k + '" title="' + SW.esc(x.title) + '"></i>'; }).join('') + '</div>' +
      '<div class="tour-nav"><button class="btn ghost" data-t="back"' + (cur.i ? '' : ' disabled') + '>← Back</button>' +
      (cur.i < n - 1 ? '<button class="btn" data-t="next">Next →</button>' : '<button class="btn" data-t="exit">Finish</button>') + '</div>';
    goTo(s);
  }
  function step(d) { if (!cur) return; var k = cur.i + d; if (k < 0 || k >= cur.tour.stops.length) return; cur.i = k; paint(); }
  function key(e) {
    if (!cur || e.target.closest('input, textarea, select, [contenteditable]')) return;
    if (e.key === 'ArrowRight') { e.preventDefault(); step(1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); step(-1); }
    else if (e.key === 'Escape') T.stop();
  }

  T.start = function (id) {
    var t = T.TOURS[id || 'welcome'];
    if (!t) return;
    T.stop();
    var card = SW.el('div', { class: 'tour-card', role: 'dialog', 'aria-label': t.title });
    document.body.appendChild(card);
    cur = { tour: t, i: 0, card: card };
    card.addEventListener('click', function (e) {
      var b = e.target.closest('[data-t]');
      if (!b) return;
      if (b.dataset.t === 'next') step(1);
      else if (b.dataset.t === 'back') step(-1);
      else if (b.dataset.t === 'go') { cur.i = +b.dataset.k; paint(); }
      else T.stop();
    });
    document.addEventListener('keydown', key);
    SW.store.set('tour.seen', true);
    paint();
  };
  T.stop = function () {
    if (!cur) return;
    cur.card.remove();
    cur = null;
    clearFocus();
    document.removeEventListener('keydown', key);
  };

  // On a first visit, a quiet offer in the tour's corner.
  T.offer = function () {
    if (SW.store.get('tour.seen', false) || cur) return;
    var card = SW.el('div', { class: 'tour-card tour-offer', role: 'dialog', 'aria-label': 'Welcome' });
    card.innerHTML = '<h3>New to the bench?</h3><p>A short tour shows how to read, run, compare and annotate the Spacewar! sources (twelve stops, about three minutes).</p>' +
      '<div class="tour-nav"><button class="btn ghost" data-o="no">Not now</button><button class="btn" data-o="yes">Take the tour</button></div>';
    document.body.appendChild(card);
    card.addEventListener('click', function (e) {
      var b = e.target.closest('[data-o]');
      if (!b) return;
      card.remove();
      SW.store.set('tour.seen', true);
      if (b.dataset.o === 'yes') T.start('welcome');
      else SW.toast('You can take the tour any time from the Help menu.', 5000);
    });
  };
})(this);
