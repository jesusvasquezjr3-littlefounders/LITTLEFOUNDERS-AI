#!/usr/bin/env -S npx tsx
// v2-open-types: the Horizonte segment kinds open to one age band, by Core's own scope check.
// coursegen's `v2:brief --types` shells out to this because a Horizonte kind's age scope lives
// in its pack here, and packages share no code (a second copy would drift).
//
//   npx tsx scripts/v2-open-types.ts <age-band> <minimum-age> <maximum-age>
//
// Prints one JSON object: { open: string[], closed: string[] }.

import { HORIZONTE_CAPABILITIES, horizonteScopeProblem } from '../src/services/horizonte/index.js';

const [band, low, high] = process.argv.slice(2);
const minimum_age = Number(low);
const maximum_age = Number(high);
if (!band || !Number.isInteger(minimum_age) || !Number.isInteger(maximum_age)) {
  console.error('usage: tsx scripts/v2-open-types.ts <age-band> <minimum-age> <maximum-age>');
  process.exit(2);
}
const open: string[] = [];
const closed: string[] = [];
for (const type of Object.keys(HORIZONTE_CAPABILITIES).sort()) {
  (horizonteScopeProblem({ type }, { age_band: band, eligibility: { minimum_age, maximum_age } }) === null ? open : closed).push(type);
}
console.log(JSON.stringify({ open, closed }));
