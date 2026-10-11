/*
 * main.js - start-up, version picker, tabs, settings, theme.
 */
(function (root) {
  'use strict';
  var SW = root.SW, V = root.SWVersions;

  var ORDER = ['read', 'run', 'analyse', 'compare', 'genealogy', 'tape', 'graphics', 'about', 'findings', 'notes', 'paratexts'];

  function fillPicker() {
    var sel = SW.$('#pick-a');
    var groups = [['early', '1961–62'], ['data', 'Data tapes'], ['ddp', '1963 · ddp fork (Preonas)'],
                  ['dfw', '1963 · dfw fork'], ['later', 'Later']];
    sel.innerHTML = groups.map(function (g) {
      var vs = V.VERSIONS.filter(function (v) { return v.fork === g[0]; })
        .sort(function (a, b) { return a.sort - b.sort; });
      if (!vs.length) return '';
      return '<optgroup label="' + SW.esc(g[1]) + '">' + vs.map(function (v) {
        return '<option value="' + SW.esc(v.id) + '">' + SW.esc((v.build ? '[' + SW.refOf(v.id) + '] ' : '') + v.label + ' · ' + v.date) +
          (v.status === 'lost' ? ' (lost)' : v.status === 'reconstructed' ? ' (reconstruction)' : '') + '</option>';
      }).join('') + '</optgroup>';
    }).join('');
    sel.onchange = function () { select(sel.value); };
  }

  // A menu in the tab row is lit when the view open is one of its items
  // (data-tabs; for the analyse view, data-lenses too).
  SW.markTabs = function () {
    var tab = SW.state.tab, lens = String(SW.anLens ? SW.anLens() : '');
    SW.$$('#tabs button').forEach(function (b) {
      var on = b.dataset.tabs ? b.dataset.tabs.split(' ').indexOf(tab) >= 0 && (tab !== 'analyse' || (b.dataset.lenses || '').split(' ').indexOf(lens) >= 0) : b.dataset.tab === tab;
      b.classList.toggle('on', on);
    });
  };
  SW.setTab = function (tab) {
    if (tab === 'sky') tab = 'graphics';   // the Star map tab became Graphics
    if (ORDER.indexOf(tab) < 0) tab = 'read';
    var prev = SW.state.tab;
    if (prev !== tab && SW.views[prev] && SW.views[prev].hide) SW.views[prev].hide();
    SW.state.tab = tab;
    SW.markTabs();
    SW.$$('.view').forEach(function (v) { v.classList.toggle('on', v.id === 'view-' + tab); });
    document.body.dataset.tab = tab;   // the language label shows on Read and Run
    SW.writeQuery();
    showCurrent();
  };

  var shown = {};
  // Drop a view's cached rendering so the next visit draws it afresh.
  SW.forget = function (tab) { delete shown[tab]; };
  function showCurrent() {
    var tab = SW.state.tab, id = SW.state.v;
    if (!id) return;
    SW.build(id).then(function (b) {
      if (SW.state.v !== id) return;
      var view = SW.views[tab];
      if (!view) {
        SW.$('#view-' + tab).innerHTML = '<div class="pad hint">This view is being built and will arrive in the next update.</div>';
        return;
      }
      if (shown[tab] !== b || tab === 'about' || tab === 'run' || (tab === 'tape' && SW.state.tapeGo)) { shown[tab] = b; view.show(b); }
      else if (view.enter) view.enter(b);   // a view already drawn, opened again
    }).catch(function (e) {
      SW.$('#view-' + tab).innerHTML = '<div class="pad"><p class="badge err">Could not load</p> ' + SW.esc(e.message) + '</div>';
    });
  }

  function select(id) {
    if (!V.byId(id)) id = '3.1';
    if (SW.state.v && SW.state.v !== id) SW.state.sel = null;
    SW.state.v = id;
    SW.$('#pick-a').value = id;
    // the language, and the variant that matters: the assembler, and the machine option
    var vl = SW.$('#vlang'), vv = V.byId(id);
    if (vl) {
      var modern = vv && vv.dialect === 'macro1';
      vl.textContent = vv && vv.build ? 'MACRO · PDP-1 · ' + (modern ? 'macro1 (2003)' : '1962–63') + ' · ' + (vv.mdv ? 'mul/div' : 'mus/dis') : '';
      vl.title = vv && vv.build ? 'Language: MACRO, DEC’s assembly language for the PDP-1 (manual F-36, 1962). ' +
        (modern ? 'This text was prepared for macro1, the 2003 cross-assembler (simh), and is assembled with it. ' : 'Assembled as MACRO behaved in 1962–63 (variables allotted as macros are defined). ') +
        (vv.mdv ? 'Machine: needs the PDP-1’s automatic multiply/divide option (mul, div).' : 'Machine: uses the step instructions mus and dis, without the multiply/divide option, as the 1962 programs did.') + ' Click for the MACRO manual (bitsavers, opens in a new tab).' : '';
    }
    var vr = SW.$('#vref'); if (vr) { vr.textContent = V.byId(id) && V.byId(id).build ? SW.refText(id) : ''; vr.dataset.copy = vr.textContent; vr.title = 'Click to copy. The bench’s reference to this source (Help ▸ Referencing and versions)'; }
    shown = {};
    SW.build(id).then(function (b) {
      if (SW.tape) SW.tape.strip(b);
      document.title = b.v.label + ' · Spacewar! Research Bench';
    }).catch(function (e) { SW.toast(e.message, 5000); });
    SW.writeQuery();
    showCurrent();
  }
  SW.select = select;


  // The About box: author, version and date, what it holds, how to cite it.
  function about() {
    var dm = document.querySelector('meta[name="bench-date"]'), date = dm ? dm.content : '';
    var url = SW.BASE_URI || location.href.split('?')[0];
    var vs = V.VERSIONS.filter(function (v) { return v.id !== 'stars'; });
    SW.$('#about-v').textContent = SW.VERSION;
    SW.$('#about-date').textContent = date ? SW.fmtDate(date) : '';
    SW.$('#about-ver').textContent = 'Version ' + SW.VERSION + (date ? ', ' + SW.fmtDate(date) : '');
    SW.$('#about-cat').textContent = vs.length + ' versions: ' + vs.filter(function (v) { return v.build; }).length + ' assembled from source, ' + vs.filter(function (v) { return v.status === 'lost'; }).length + ' lost.';
    var cite = 'Berry, D. M. (' + (date ? date.slice(0, 4) : new Date().getFullYear()) + ') Spacewar! Research Bench (version ' + SW.VERSION + '). Available at: ' + url + ' (Accessed: ' + SW.fmtDate(SW.today()) + ').';
    SW.$('#about-cite').textContent = cite;
    SW.$('#about-copy').onclick = function () {
      (navigator.clipboard ? navigator.clipboard.writeText(cite) : Promise.reject()).then(function () { SW.toast('Citation copied'); }, function () { window.prompt('Copy:', cite); });
    };
    SW.$('#dlg-about').showModal();
  }

  function theme(t) {
    t = SW.themeInfo(t).id;   // an unknown or retired name falls back to phosphor
    document.documentElement.setAttribute('data-theme', t);
    SW.store.set('theme', t);
    SW.store.set(SW.themeInfo(t).dark ? 'theme.dark' : 'theme.light', t);   // for the ◐ switch
    SW.emit('theme', t);
    // Figures and tapes are coloured for the theme when drawn, so draw them again.
    if (SW.state.v) {
      ['analyse', 'compare', 'genealogy', 'tape', 'findings'].forEach(function (k) { delete shown[k]; });
      if (SW.views.findings && SW.views.findings.reset) SW.views.findings.reset();
      if (['analyse', 'compare', 'genealogy', 'tape', 'findings'].indexOf(SW.state.tab) >= 0) showCurrent();
      if (SW.tape) SW.build(SW.state.v).then(function (b) { SW.tape.strip(b); }).catch(function () {});
    }
  }
  SW.setTheme = theme;   // for the kit's Settings

  function init() {
    theme(SW.store.get('theme', 'phosphor'));
    fillPicker();
    SW.$('#tabs').addEventListener('click', function (e) {
      var b = e.target.closest('button[data-tab]');
      if (b) SW.setTab(b.dataset.tab);
    });
    SW.$('#btn-settings').onclick = function () { SW.settings.open(); };
    SW.$('#btn-about').onclick = about;
    SW.$('.brand').addEventListener('click', function (e) { e.preventDefault(); about(); });
    // The side panel opens below the top bar, so the bar's buttons stay in reach.
    function barH() { document.documentElement.style.setProperty('--bar-h', SW.$('header.bar').offsetHeight + 'px'); }
    barH();
    window.addEventListener('resize', barH);
    SW.notes.initNews();
    // A drop-down menu near the right edge opens leftwards, so it stays on screen.
    document.addEventListener('toggle', function (e) {
      var d = e.target;
      if (!d.classList || !d.classList.contains('menu') || !d.open) return;
      var body = d.querySelector('.menu-body');
      if (!body) return;
      body.style.left = ''; body.style.right = '';
      var r = body.getBoundingClientRect();
      if (r.right > document.documentElement.clientWidth - 4) { body.style.left = 'auto'; body.style.right = '0'; }
    }, true);
    SW.tray.init();
    SW.applyCodeText();
    SW.applyNoteShade();
    SW.applyPalette();
    SW.$('#btn-smaller').onclick = function () { SW.setCodeSize(SW.codeSize() - 1); };
    SW.$('#btn-larger').onclick = function () { SW.setCodeSize(SW.codeSize() + 1); };
    // ◐: to the last light theme from a dark one, and back.
    SW.$('#btn-theme').onclick = function () {
      theme(SW.themeInfo().dark ? SW.store.get('theme.light', 'paper') : SW.store.get('theme.dark', 'phosphor'));
    };
    SW.$('#drawer-close').onclick = SW.closeDrawer;
    // the tab row, scrolled sideways on a narrow screen: a fade while more lies to the right
    var tabsRow = SW.$('.tabs');
    function tabsFade() { if (tabsRow) tabsRow.classList.toggle('more-right', tabsRow.scrollLeft + tabsRow.clientWidth < tabsRow.scrollWidth - 4); }
    if (tabsRow) { tabsRow.addEventListener('scroll', tabsFade, { passive: true }); window.addEventListener('resize', tabsFade); setTimeout(tabsFade, 0); }
    var q = SW.readQuery();
    // an invitation (join.html#ID → ?join=ID): the group set, the ID taken out of the address, the guide opened
    if (q.join) { SW.notes.join(q.join); delete q.join; q.help = 'join'; try { history.replaceState(null, '', location.pathname + location.search.replace(/([?&])join=[^&]*&?/, '$1').replace(/[?&]$/, '')); } catch (e) { /* file: urls */ } }
    if (q.l) {
      var m = /^(\d+):(\d+)(?:-(\d+))?$/.exec(q.l);
      if (m) SW.state.sel = { p: +m[1], n0: +m[2], n1: +(m[3] || m[2]) };
    }
    if (q.b) SW.state.b = q.b;
    if (q.tab === 'sky') q.tab = 'graphics';   // the Star map tab became Graphics
    // a view named in the link (the site map links to each): its lens or graphic
    if (q.lens) { SW.setLens(q.lens); if (!q.tab) q.tab = 'analyse'; }
    // Art's gizmo as a link left it: its mode, the version compared with, the split, a routine to open
    if (q.gz === 'profile' || q.gz === 'compare' || q.gz === 'across') SW.store.set('an.gizmoMode', q.gz);
    if (q.cmp && q.v) { var cb = SW.store.get('an.gizmoCmpBy', {}) || {}; cb[q.v] = q.cmp; SW.store.set('an.gizmoCmpBy', cb); }
    if (q.gz === 'compare') SW.store.set('an.gizmoSplit', q.split === '1');
    if (q.rt) SW.state.gzRoutine = q.rt;
    if (q.tr) SW.state.gzTrace = q.tr;
    if (q.g) { SW.setGraphic(q.g); if (!q.tab) q.tab = 'graphics'; }
    SW.state.tab = ORDER.indexOf(q.tab) >= 0 ? q.tab : 'read';
    document.body.dataset.tab = SW.state.tab;
    SW.markTabs();
    SW.$$('.view').forEach(function (v) { v.classList.toggle('on', v.id === 'view-' + SW.state.tab); });
    select(q.v || '3.1');
    // a link to an annotation: to it, once the version is up
    if (q.a && q.v) setTimeout(function () { SW.notes.follow(q); }, 900);
    // a link to a code (?code=A-MLKH5): to what it names
    if (q.code) setTimeout(function () { SW.notes.goCode(q.code); }, 1000);
    var shb = SW.$('#btn-share'); if (shb) { shb.innerHTML = SW.SHARE_ICON; shb.onclick = function () { SW.share({ title: document.title }); }; }
    SW.$('#btn-code').onclick = function (e) {
      var r = e.currentTarget.getBoundingClientRect();
      SW.pop(r.left - 180, r.bottom + 6, '<h4>Go to a code</h4><input type="text" class="code-in mono" placeholder="A-MLKH5, C-FT1A7, P-U1J8Q, F33, DMB-N14" autocomplete="off"><p class="hint">An annotation or reply (A-, R-), a group finding (C-), the bench’s (F), or a note in My notes (initials-N). A link can carry one: ?code=…</p>');
      var inp = SW.$('.pop .code-in'); if (!inp) return;
      inp.focus();
      inp.addEventListener('keydown', function (k) { if (k.key === 'Enter' && inp.value.trim()) { SW.unpop(); SW.notes.goCode(inp.value); } });
    };
    // The welcome tour: from a link (?tour=welcome), from Settings or About, or offered on a first visit.
    SW.$('#about-tour').onclick = function () { SW.$('#dlg-about').close(); SW.tours.start('welcome'); };
    // a Help item named in the link
    var HELP = { codes: function () { SW.guide('codes'); }, paratexts: function () { SW.guide('paratexts'); }, gizmo: function () { SW.guide('gizmo'); }, refs: function () { SW.refHelp(); }, anno: function () { SW.notes.help(); }, join: function () { SW.notes.joinHelp(); }, reading: function () { SW.readingHelp(); }, cards: function () { SW.cardsHelp(); }, about: about, settings: function () { SW.settings.open(); } };
    if (HELP[q.help]) setTimeout(HELP[q.help], 700);
    if (q.tour) setTimeout(function () { SW.tours.start(q.tour); }, 900);
    else if (!SW.store.get('tour.seen', false)) setTimeout(SW.tours.offer, 1200);
    else if (!SW.store.get('initials', '') && Date.now() - (+SW.store.get('ini.later', 0) || 0) > 7 * 864e5) setTimeout(function () { if (!document.querySelector('dialog[open]')) SW.askInitials('Welcome. Annotations, notes and findings are signed with your initials.'); }, 1200);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})(this);
