/*
 * Lane 3 (mentor): the Mentor stage (Bible 08) and its session surfaces.
 * No audited state yet: add this lane's preview screens and real routes here
 * (./helpers.mjs builds them; ./core.mjs and ./learn.mjs are worked examples).
 *
 *   states     the states this lane adds to the audit matrix
 *   scenarios  synthetic-Core scenarios its authenticated states sign in as
 *              ({ population, guest, ageBand, roles?, adminPermissions?, ... })
 *   respond    answers for the Core endpoints only this lane's routes call;
 *              return undefined to leave a request to the shared answers
 */
export const lane = 'mentor';

export const states = [];

export const scenarios = {};

export function respond() {
  return undefined;
}
