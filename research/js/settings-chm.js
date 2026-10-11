/*
 * settings-chm.js - this bench's own row in ⚙ Settings (Display): the Computer History Museum's
 * PDP-1 brightness for the builds made for it, added to bench-kit's Settings (kit/settings.js).
 */
(function (root) {
  'use strict';
  var SW = root.SW;
  SW.settings.add({
    tab: 'display',
    html: '<label class="check-row"><span><input type="checkbox" id="set-chmbright"> CHM brightness for the CHM builds</span><span class="hint">Show 4.1 CHM rev. d and 4.1f as the Computer History Museum’s PDP-1 draws them, for which they were made: its intensities 4 to 7 differ from DEC’s (under DEC’s their faintest star group is invisible).</span></label>',
    load: function () { SW.$('#set-chmbright').checked = SW.store.get('chmBright', true); },
    save: function () {
      if (SW.store.get('chmBright', true) !== SW.$('#set-chmbright').checked) { SW.store.set('chmBright', SW.$('#set-chmbright').checked); SW.forget('graphics'); if (SW.state.v === '4.1d' || SW.state.v === '4.1f') SW.toast('CHM brightness ' + (SW.$('#set-chmbright').checked ? 'on' : 'off') + ': Run shows it from the next Reset', 4000); }
    }
  });
})(typeof window !== 'undefined' ? window : globalThis);
