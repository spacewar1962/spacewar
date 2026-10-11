/* config.js - this bench's settings for bench-kit (research/kit). Loaded after core.js, before the kit. */
(function (root) {
  'use strict';
  root.SW.BENCH = {
    name: 'Spacewar!',
    title: 'Spacewar! Research Bench',
    relation: 'Spacewar! ',
    topShare: true,
    paratexts: { org: 'spacewar1962', repo: 'sw_paratexts', cache: 'sw-paratexts', tokenName: 'Spacewar research bench' },
    examples: { date: 'e.g. 1963-05-17, or 1963', archive: 'e.g. Computer History Museum', versions: 'e.g. 4.3, 4.4',
                refs: 'e.g. [REF: SW4.3L, 2.10–20]', publisher: 'e.g. Rolling Stone', finding: 'F33' }
  };
})(typeof window !== 'undefined' ? window : globalThis);
