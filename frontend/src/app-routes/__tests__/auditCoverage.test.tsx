import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { ReactNode } from 'react';
import { createRoutesFromChildren, matchRoutes, type RouteObject } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { notFoundRoute, standaloneStateRoutes } from '../core';
import { familyShellRoutes } from '../family';
import { learnShellRoutes, learnStandaloneRoutes } from '../learn';
import { mentorStandaloneRoutes } from '../mentor';
import { profileShellRoutes } from '../profile';
import { siteAccountRoutes, siteAuthRoutes, sitePageRoutes, siteStandaloneRoutes } from '../site';
import { staffShellRoutes } from '../staff';

/*
 * GAP-FIX-R4 (Bible 02 §7 item 10, 06 §7, 03 §5; CLAUDE.md: text fit, proportion
 * and copy budget before merging UI changes): no mounted screen escapes the three
 * audits. Every route the application mounts must be reached by at least one
 * real-route state in scripts/audits/lanes/*.mjs (the only list `audit:rebuild`
 * visits), or carry a written reason here. The routes are read from the same
 * fragments App.tsx composes, and react-router decides which route each audited
 * address lands on, so a new route, or a state that lands somewhere else, fails
 * this test instead of going unmeasured (as /learn/together, /admin/age-corrections,
 * /account-deletion and /badge/:token once did).
 */
const frontend = resolve(__dirname, '../../..');

/** The fragments App.tsx mounts (devRoutes are development-only labs, never shipped). */
const FRAGMENTS: Record<string, ReactNode> = {
  sitePageRoutes, siteAuthRoutes, siteAccountRoutes, siteStandaloneRoutes, standaloneStateRoutes, learnStandaloneRoutes,
  mentorStandaloneRoutes, learnShellRoutes, familyShellRoutes, profileShellRoutes, staffShellRoutes, notFoundRoute,
};

/** Routes that render no screen of their own, with the reason. */
const NO_SCREEN: Record<string, string> = {
  'learn/:courseSlug/path': 'redirects to the course screen (CoursePathRedirect)',
  'admin/insights': 'redirects to Learning intel (STAFF_ROUTE_GRANTS redirectTo)',
  banking: "the family Wallet's retired path, redirects to /family-wallet (LegacyWalletRedirect)",
};

function flatten(routes: RouteObject[], parent = ''): string[] {
  return routes.flatMap((route) => {
    const own = route.index ? parent : route.path === undefined ? parent : [parent, route.path].filter(Boolean).join('/').replace(/^\//, '');
    return [...(route.path !== undefined || route.index ? [own || '/'] : []), ...flatten(route.children ?? [], own)];
  });
}

const routes = createRoutesFromChildren(<>{Object.values(FRAGMENTS)}</>);
const mounted = [...new Set(flatten(routes))];

type AuditState = { id: string; entry: string; path?: string; pushState?: { path: string } };
function laneStates(): AuditState[] {
  // The lane files resolve fixtures by file URL, so they load in Node itself, as the audit driver loads them.
  const script = "const m = await import('./scripts/audits/lanes/index.mjs'); console.log(JSON.stringify(m.LANE_STATES));";
  return JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', script], { cwd: frontend, encoding: 'utf8' })) as AuditState[];
}

/** The route pattern an address lands on, as the router matches it. */
function landsOn(address: string): string | null {
  const pathname = new URL(address, 'http://audit.test').pathname;
  const match = matchRoutes(routes, pathname);
  const leaf = match?.[match.length - 1];
  if (!leaf) return null;
  const pattern = match!.map((entry) => entry.route.path).filter((path): path is string => Boolean(path)).join('/').replace(/^\//, '');
  return leaf.route.index ? pattern || '/' : pattern;
}

describe('every mounted route is in the rebuilt-app audits', () => {
  it('reads the same route fragments App.tsx mounts', () => {
    const app = readFileSync(resolve(frontend, 'src/App.tsx'), 'utf8');
    const composed = [...app.matchAll(/\{(\w+Routes?)\}/g)].map((m) => m[1]).filter((name) => name !== 'devRoutes');
    expect(new Set(composed)).toEqual(new Set(Object.keys(FRAGMENTS)));
    expect(mounted.length).toBeGreaterThan(30);
  });

  it('has an audit state landing on each route, or a written reason it renders no screen', () => {
    const covered = new Set(laneStates().filter((state) => state.entry === 'app').map((state) => landsOn(state.pushState?.path ?? state.path!)));
    const missing = mounted.filter((route) => !covered.has(route) && !NO_SCREEN[route]);
    expect(missing).toEqual([]);
  });

  it('keeps each exemption pointing at a route that exists and is not audited', () => {
    for (const route of Object.keys(NO_SCREEN)) expect(mounted).toContain(route);
  });
});
