/*
 * main.js - start-up, version picker, tabs, settings, theme.
 */
(function (root) {
  'use strict';
  var SW = root.SW, V = root.SWVersions;

  var ORDER = ['read', 'run', 'analyse', 'compare', 'genealogy', 'tape', 'about', 'findings'];

  function fillPicker() {
    var sel = SW.$('#pick-a');
    var groups = [['early', '1961–62'], ['data', 'Data tapes'], ['ddp', '1963 · ddp fork (Preonas)'],
                  ['dfw', '1963 · dfw fork'], ['later', 'Later']];
    sel.innerHTML = groups.map(function (g) {
      var vs = V.VERSIONS.filter(function (v) { return v.fork === g[0]; })
        .sort(function (a, b) { return a.sort - b.sort; });
      if (!vs.length) return '';
      return '<optgroup label="' + SW.esc(g[1]) + '">' + vs.map(function (v) {
        return '<option value="' + SW.esc(v.id) + '">' + SW.esc(v.label + ' · ' + v.date) +
          (v.status === 'lost' ? ' (lost)' : v.status === 'reconstructed' ? ' (reconstruction)' : '') + '</option>';
      }).join('') + '</optgroup>';
    }).join('');
    sel.onchange = function () { select(sel.value); };
  }

  SW.setTab = function (tab) {
    if (ORDER.indexOf(tab) < 0) tab = 'read';
    var prev = SW.state.tab;
    if (prev !== tab && SW.views[prev] && SW.views[prev].hide) SW.views[prev].hide();
    SW.state.tab = tab;
    SW.$$('#tabs button').forEach(function (b) { b.classList.toggle('on', b.dataset.tab === tab); });
    SW.$$('.view').forEach(function (v) { v.classList.toggle('on', v.id === 'view-' + tab); });
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
    }).catch(function (e) {
      SW.$('#view-' + tab).innerHTML = '<div class="pad"><p class="badge err">Could not load</p> ' + SW.esc(e.message) + '</div>';
    });
  }

  function select(id) {
    if (!V.byId(id)) id = '3.1';
    if (SW.state.v && SW.state.v !== id) SW.state.sel = null;
    SW.state.v = id;
    SW.$('#pick-a').value = id;
    shown = {};
    SW.build(id).then(function (b) {
      if (SW.tape) SW.tape.strip(b);
      document.title = b.v.label + ' · Spacewar! Research Bench';
    }).catch(function (e) { SW.toast(e.message, 5000); });
    SW.writeQuery();
    showCurrent();
  }
  SW.select = select;

  function settings() {
    var dlg = SW.$('#dlg-settings');
    SW.$('#set-initials').value = SW.store.get('initials', '');
    SW.$('#set-name').value = SW.store.get('name', '');
    var grp = SW.$('#set-group'), tok = SW.$('#set-token'), show = SW.$('#set-token-show');
    grp.value = SW.notes.groupId(SW.store.get('group', ''));
    tok.value = SW.store.get('token', '');
    tok.type = 'password'; show.textContent = 'Show'; show.setAttribute('aria-pressed', 'false');
    SW.$('#set-check').textContent = '';
    dlg.returnValue = '';
    dlg.showModal();
    // A pasted group link is reduced to its ID, so what is stored is visible.
    grp.onchange = function () { grp.value = SW.notes.groupId(grp.value); };
    show.onclick = function () {
      var hidden = tok.type === 'password';
      tok.type = hidden ? 'text' : 'password';
      show.textContent = hidden ? 'Hide' : 'Show';
      show.setAttribute('aria-pressed', String(hidden));
    };
    SW.$('#set-test').onclick = function () {
      SW.store.set('group', SW.notes.groupId(grp.value));
      SW.store.set('token', tok.value.trim());
      SW.$('#set-check').textContent = 'Checking…';
      SW.notes.test().then(function (r) {
        SW.$('#set-check').textContent = 'Connected as ' + r.user + (r.group ? '; group “' + r.group + '” found.' : '; but that group was not found for this account.');
      }, function (e) { SW.$('#set-check').textContent = e.message; });
    };
    // Colour theme: previewed live, put back on Cancel.
    var themeSel = SW.$('#set-theme'), wasTheme = SW.theme();
    themeSel.innerHTML = ['Dark', 'Light'].map(function (g) {
      return '<optgroup label="' + g + '">' + SW.THEMES.filter(function (t) { return t.dark === (g === 'Dark'); }).map(function (t) {
        return '<option value="' + t.id + '"' + (t.id === wasTheme ? ' selected' : '') + ' title="' + SW.esc(t.note) + '">' + SW.esc(t.label) + '</option>';
      }).join('') + '</optgroup>';
    }).join('');
    function swatches() {
      var t = SW.themeInfo(themeSel.value), sw = SW.$('#set-theme-sw');
      sw.innerHTML = '<span class="hint">' + SW.esc(t.note) + '</span>' + ['--bg', '--surface', '--text', '--beam', '--amber', '--green', '--violet', '--red', '--g-retained', '--g-edited'].map(function (n) {
        return '<i style="background:' + SW.cssVar(n) + '" title="' + n.slice(2) + '"></i>';
      }).join('');
    }
    themeSel.onchange = function () { theme(themeSel.value); swatches(); };
    swatches();
    SW.$('#set-figbg').value = SW.figBg();
    SW.$('#set-noteshade').checked = SW.store.get('noteShade', true);
    var fontSel = SW.$('#set-font'), size = SW.$('#set-size'), sizeOut = SW.$('#set-size-out');
    var was = { font: SW.codeFont(), size: SW.codeSize() };
    fontSel.value = was.font; size.value = was.size; sizeOut.textContent = was.size + ' px';
    // Preview live; Cancel puts them back.
    fontSel.onchange = function () { SW.store.set('codeFont', fontSel.value); SW.applyCodeText(); };
    size.oninput = function () { sizeOut.textContent = size.value + ' px'; SW.store.set('codeSize', +size.value); SW.applyCodeText(); };
    dlg.onclose = function () {
      if (dlg.returnValue !== 'save') { SW.store.set('codeFont', was.font); SW.store.set('codeSize', was.size); SW.applyCodeText(); if (SW.theme() !== wasTheme) theme(wasTheme); return; }
      SW.store.set('figbg', SW.$('#set-figbg').value);
      SW.store.set('noteShade', SW.$('#set-noteshade').checked);
      SW.applyNoteShade();
      SW.store.set('initials', SW.$('#set-initials').value.trim().toUpperCase());
      SW.store.set('name', SW.$('#set-name').value.trim());
      SW.store.set('group', SW.notes.groupId(grp.value));
      SW.store.set('token', tok.value.trim());
      SW.notes.forget();
      SW.notes.invalidate(SW.state.v);
      SW.toast('Saved');
    };
  }

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

  function init() {
    theme(SW.store.get('theme', 'phosphor'));
    fillPicker();
    SW.$('#tabs').addEventListener('click', function (e) {
      var b = e.target.closest('button[data-tab]');
      if (b) SW.setTab(b.dataset.tab);
    });
    SW.$('#btn-settings').onclick = settings;
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
    var q = SW.readQuery();
    if (q.l) {
      var m = /^(\d+):(\d+)(?:-(\d+))?$/.exec(q.l);
      if (m) SW.state.sel = { p: +m[1], n0: +m[2], n1: +(m[3] || m[2]) };
    }
    if (q.b) SW.state.b = q.b;
    SW.state.tab = ORDER.indexOf(q.tab) >= 0 ? q.tab : 'read';
    SW.$$('#tabs button').forEach(function (b) { b.classList.toggle('on', b.dataset.tab === SW.state.tab); });
    SW.$$('.view').forEach(function (v) { v.classList.toggle('on', v.id === 'view-' + SW.state.tab); });
    select(q.v || '3.1');
    if (!SW.store.get('initials', '')) setTimeout(function () { SW.toast('Welcome. Set your initials (⚙) so your notes are signed.', 5000); }, 800);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})(this);
