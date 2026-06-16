// lib/marinas.js
// Central registry for every Bowline marina with fuel operations.
//
// To add a marina:
//   1. Add an entry below (URL, outlet(s), fuels, vendor, target margin).
//   2. Set its two secret keys in .env.local AND Vercel:
//        SHARPER_REPORT_<SLUG>   and   SHARPER_USER_<SLUG>
//      (Lake Oconee keeps its existing *_API names — see reportEnv/userEnv.)
//
// Only the two keys are secret. URL, outlet, and fuel info are NOT secret,
// so they live here in the repo.

export const MARINAS = [
  {
    slug: 'lakeoconee',
    name: 'Lake Oconee',
    dbName: 'lake-oconee',   // ← add this: the existing DB key (hyphenated)
    state: 'GA',
    apiUrl: 'https://lakeoconee-api.sharpermms.com/api/v1/web-data-source',
    fuels: {
      gas: { outlet: '2', productMatch: ['gas', 'unleaded', 'rec', 'regular'] },
      // diesel: { outlet: '2', productMatch: ['diesel', 'dyed'] },  // uncomment if this marina sells diesel
    },
    vendor: 'Rossee Oil Co',
    targetMargin: 0.20,            // TODO: set the real target margin
    reportEnv: 'SHARPER_REPORT_API', // existing env var name (don't rename — keeps live build working)
    userEnv: 'SHARPER_USER_API',
    live: true,
  },

  {
    slug: 'shemcreek',
    name: 'Shem Creek',
    state: 'SC',                 // best guess — correct if wrong
    apiUrl: 'https://shemcreek-api.sharpermms.com/api/v1/web-data-source',
    fuels: {
      gas: { outlet: '1', productMatch: [] },   // outlet is a guess; we'll confirm in the smoke test
    },
    vendor: '',
    targetMargin: 0.20,
    live: true,
  },

  {
    slug: 'southshore',
    name: 'South Shore',
    state: '',                  // fill if you know it
    apiUrl: 'https://southshore-api.sharpermms.com/api/v1/web-data-source',
    fuels: {
      gas: { outlet: '1', productMatch: [] },
    },
    vendor: '',
    targetMargin: 0.20,
    live: true,
  },

  {
    slug: 'baypines',
    name: 'Bay Pines',
    state: 'FL',                // best guess — confirm
    apiUrl: 'https://baypines-api.sharpermms.com/api/v1/web-data-source',
    fuels: {
      gas: { outlet: '1', productMatch: [] },
    },
    vendor: '',
    targetMargin: 0.20,
    live: true,
  },

  {
    slug: 'lakemurray',
    name: 'Lake Murray',
    state: 'SC',                // best guess — confirm
    apiUrl: 'https://lakemurray-api.sharpermms.com/api/v1/web-data-source',
    fuels: {
      gas: { outlet: '1', productMatch: [] },
    },
    vendor: '',
    targetMargin: 0.20,
    live: true,
  },

  {
    slug: 'waterwaysmarina',
    name: 'Waterways Marina',
    state: '',
    apiUrl: 'https://waterwaysmarina-api.sharpermms.com/api/v1/web-data-source',
    fuels: {
      gas:    { outlet: '1', productMatch: ['gas'] },
      diesel: { outlet: '1', productMatch: ['diesel'] },
    },
    vendor: '',
    targetMargin: 0.20,
    live: true,
  },

  {
    slug: 'wilmingtonisland',
    name: 'Wilmington Island',
    state: 'GA',                // best guess — confirm
    apiUrl: 'https://wilmingtonisland-api.sharpermms.com/api/v1/web-data-source',
    fuels: {
      gas:    { outlet: '1', productMatch: ['gas'] },
      diesel: { outlet: '1', productMatch: ['diesel'] },
    },
    vendor: '',
    targetMargin: 0.20,
    live: true,
  },

  {
    slug: 'northwestcreek',
    name: 'Northwest Creek',
    state: 'NC',                // best guess — confirm
    apiUrl: 'https://northwestcreek-api.sharpermms.com/api/v1/web-data-source',
    fuels: {
      gas:    { outlet: '1', productMatch: ['gas'] },
      diesel: { outlet: '1', productMatch: ['diesel'] },
    },
    vendor: '',
    targetMargin: 0.20,
    live: true,
  },

  {
    slug: 'dauphinisland',
    name: 'Dauphin Island',
    state: 'AL',
    apiUrl: 'https://dauphinisland-api.sharpermms.com/api/v1/web-data-source',
    fuels: {
      gas:    { outlet: '1', productMatch: ['dock fuel'] },
      diesel: { outlet: '1', productMatch: ['dock diesel', 'charter fuel'] },
    },
    vendor: '',
    targetMargin: 0.20,
    live: true,
  },



  // ---- Fill these from your per-marina notes (name, state, fuels, outlet, vendor) ----
  // Copy this block per marina. Slug = lowercase, no spaces (used for env var names + URL).
  //
  // {
  //   slug: 'marinatwo',
  //   name: 'Marina Two',
  //   state: 'FL',
  //   apiUrl: 'https://marinatwo-api.sharpermms.com/api/v1/web-data-source',
  //   fuels: {
  //     gas:    { outlet: '?', productMatch: ['gas', 'unleaded', 'rec'] },
  //     diesel: { outlet: '?', productMatch: ['diesel', 'dyed'] },   // remove if gas-only
  //   },
  //   vendor: 'McMullen Oil',
  //   targetMargin: 0.20,
  //   live: false,            // flip to true once the feed is verified
  // },
];

export function getMarina(slug) {
  return MARINAS.find((m) => m.slug === slug) || null;
}

// Resolve a marina's secret keys from env, using the per-marina names if set,
// otherwise the SHARPER_REPORT_<SLUG> / SHARPER_USER_<SLUG> convention.
export function marinaCreds(marina) {
  const up = marina.slug.toUpperCase();
  return {
    reportKey: process.env[marina.reportEnv || `SHARPER_REPORT_${up}`],
    userKey: process.env[marina.userEnv || `SHARPER_USER_${up}`],
  };
}

// List of fuel types a marina sells, e.g. ['gas', 'diesel'].
export function fuelTypes(marina) {
  return Object.keys(marina.fuels || {});
}