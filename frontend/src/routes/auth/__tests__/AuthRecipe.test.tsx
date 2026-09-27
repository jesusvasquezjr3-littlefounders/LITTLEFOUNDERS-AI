import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/*
 * THE SIGN-IN RECIPE, PINNED (W2S.2).
 *
 * The legacy rule this file used to pin (one legacy card shell for every auth
 * page, because a second shell had taken over half of them once and every gate
 * stayed green) is kept in its rebuilt form: every sign-in screen renders
 * inside the ONE sign-in shell (the design system's AuthShell, mounted by
 * app-shell AuthLayout), is a rebuilt surface from rebuild/identity, and
 * imports no legacy UI (OD-15, 02 rules 22–23). These assertions read the
 * SOURCE: what must hold is a property of the files, not of one mounted tree.
 */

const SRC = join(process.cwd(), 'src');
const AUTH_DIR = join(SRC, 'routes', 'auth');
const read = (...path: string[]) => readFileSync(join(SRC, ...path), 'utf8');

function authPages(): { name: string; source: string }[] {
  return readdirSync(AUTH_DIR).filter((f) => f.endsWith('Page.tsx')).map((name) => ({ name, source: readFileSync(join(AUTH_DIR, name), 'utf8') }));
}

describe('Sign-in recipe (A1–A7)', () => {
  it('every sign-in page renders a rebuilt screen and no legacy component', () => {
    const pages = authPages();
    expect(pages.map((page) => page.name).sort()).toEqual([
      'AuthCallbackPage.tsx', 'ForgotPasswordPage.tsx', 'LoginPage.tsx', 'ResetPasswordPage.tsx', 'SignupPage.tsx', 'UpgradeAccountPage.tsx', 'VerifyParentPage.tsx',
    ]);
    for (const { name, source } of pages) {
      expect(source, `${name} renders a rebuilt screen`).toMatch(/from '@\/rebuild\/identity\//);
      expect(source, `${name} imports legacy UI`).not.toMatch(/@\/components\/(ui|characters)|\.\/AuthShell|\.\/ErrorBanner|\.\/SocialAuth|guided-voice/);
      expect(source, `${name} draws its own shell`).not.toMatch(/<AuthShell\b|<SingleStateScreen\b|<main\b/);
    }
  });

  it('no sign-in page or screen names a colour: tokens only', () => {
    const identity = readdirSync(join(SRC, 'rebuild', 'identity')).filter((f) => /\.(tsx|css)$/.test(f)).map((name) => ({ name, source: read('rebuild', 'identity', name) }));
    for (const { name, source } of [...authPages(), ...identity]) {
      const arbitrary = source.match(/(?:text|bg|border|ring)-\[#[0-9a-fA-F]{3,8}\]|#[0-9a-fA-F]{6}\b/g);
      expect(arbitrary, `${name} carries an arbitrary colour: ${arbitrary?.join(', ')}`).toBeNull();
    }
  });

  it('the legacy card shell and its Google button are gone', () => {
    expect(existsSync(join(AUTH_DIR, 'AuthShell.tsx'))).toBe(false);
    expect(existsSync(join(AUTH_DIR, 'SocialAuth.tsx'))).toBe(false);
  });

  it('every sign-in route mounts inside the one sign-in shell, with no legacy body around it', () => {
    const routes = read('app-routes', 'site.tsx');
    const inShell = routes.slice(routes.indexOf('export const siteAuthRoutes'), routes.indexOf('export const siteStandaloneRoutes'));
    for (const path of ['login', 'signup', 'forgot-password', 'reset-password', 'auth/callback', 'verify-parent', 'upgrade-account']) {
      expect(inShell, `${path} is a sign-in shell route`).toContain(`path="${path}"`);
    }
    const app = read('App.tsx');
    expect(app).toMatch(/<Route element=\{<AuthLayout \/>\}>\s*\{siteAuthRoutes\}\s*\{siteAccountRoutes\}/);
    const layout = read('app-shell', 'PublicLayouts.tsx');
    const authLayout = layout.slice(layout.indexOf('export function AuthLayout'));
    expect(authLayout).toMatch(/<AuthShell\b/);
    expect(authLayout).not.toMatch(/LegacyBody/);
  });

  it('the sign-in shell carries the theme control at EVERY width', () => {
    // The legacy row shipped `hidden sm:inline-flex`, so a phone lost the only theme control: nothing may hide it by width.
    const layout = read('app-shell', 'PublicLayouts.tsx');
    const authLayout = layout.slice(layout.indexOf('export function AuthLayout'));
    expect(authLayout).toMatch(/footer=\{<Preferences \/>\}/);
    const preferences = layout.slice(layout.indexOf('function Preferences'), layout.indexOf('function SiteFooter'));
    expect(preferences).toMatch(/<SegmentedControl<ThemeChoice>/);
    expect(preferences).not.toMatch(/hidden/);
    expect(layout).not.toMatch(/auth-bg/);
  });
});
