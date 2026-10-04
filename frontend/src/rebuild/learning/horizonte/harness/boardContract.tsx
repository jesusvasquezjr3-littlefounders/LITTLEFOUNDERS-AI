import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect } from 'vitest';
import { checkCopy, type AgeBand, type CopyRole, type Locale } from '../../../design/copyBudget';
import { LessonDocumentView } from '../../LessonDocumentView';
import type { HorizonteCopy, IcapLevel } from '../boardTypes';
import { horizontePackIdOf, loadHorizontePacks } from '../contract';
import { HORIZONTE_BOARDS } from '../registry';
import { horizonteFixture, horizonteFixtureDocument, horizonteFixtureSeeds } from '../previewDocument';

export const HZ_LOCALES: readonly Locale[] = ['en-US', 'es-MX', 'pt-BR'];
export const HZ_MIN_HIT_PX = 64;
export const HZ_MAX_CHUNK_KB = 60;
const ICAP: readonly IcapLevel[] = ['passive', 'active', 'constructive', 'interactive'];
const ROLES: readonly CopyRole[] = ['action', 'heading', 'body', 'prompt', 'option', 'mentor', 'narrative', 'data', 'brand', 'legal'];
const FOCUSABLE = 'button, a[href], input, select, textarea, summary, [role="button"], [role="menuitem"], [role="slider"], [tabindex]';
const horizonteDir = resolve(__dirname, '..');

export interface BoardContractOptions {
  pack: string;
  /** The pack fixture the board is rendered with. */
  fixtureId: string;
  /** The pack's copy module (its single `*_COPY` export). */
  copy: HorizonteCopy;
  /** CSS files the board loads, relative to the horizonte folder, in addition to horizonte.css. */
  css?: readonly string[];
  /** Locales to render; every one of the three by default. */
  locales?: readonly Locale[];
  /** A board with no drag handle still passes; one with handles must offer the Move to menu. */
  grade?: () => 'met' | 'review' | 'invalid';
}

export interface CssProblem { rule: string; problem: string }

/** Every transition and animation sits inside a no-preference media query, runs at most 250 ms and uses no spring or bezier overshoot. */
export function motionProblems(css: string): CssProblem[] {
  const text = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const problems: CssProblem[] = [];
  const preludes: string[] = [];
  let buffer = '';
  const declare = (declaration: string) => {
    const match = /^\s*(transition|animation)(?:-[a-z-]+)?\s*:\s*([^;]+)/.exec(declaration);
    if (!match) return;
    const rule = declaration.trim();
    if (!preludes.some((prelude) => /prefers-reduced-motion:\s*no-preference/.test(prelude))) problems.push({ rule, problem: 'motion outside @media (prefers-reduced-motion: no-preference)' });
    if (/spring|cubic-bezier|linear\(/.test(match[2]!)) problems.push({ rule, problem: 'a spring or bezier curve (use var(--ease-standard))' });
    for (const [, amount, unit] of match[2]!.matchAll(/(\d*\.?\d+)(ms|s)\b/g)) {
      if ((unit === 's' ? Number(amount) * 1000 : Number(amount)) > 250) problems.push({ rule, problem: 'longer than 250 ms (use var(--dur-component))' });
    }
  };
  for (const char of text) {
    if (char === '{') { preludes.push(buffer.trim()); buffer = ''; }
    else if (char === '}') { if (buffer.trim()) declare(buffer); buffer = ''; preludes.pop(); }
    else if (char === ';') { declare(buffer); buffer = ''; }
    else buffer += char;
  }
  return problems;
}

/** The shared 64 px handle rule: horizonte.css sizes `.lf-hz-handle` from `--hz-hit`, and `--hz-hit` is at least 64 px. */
export function handleRuleProblems(css: string): string[] {
  const problems: string[] = [];
  const hit = /--hz-hit:\s*(\d+)px/.exec(css);
  if (!hit || Number(hit[1]) < HZ_MIN_HIT_PX) problems.push(`--hz-hit must be at least ${HZ_MIN_HIT_PX}px`);
  if (!/\.lf-hz-handle[^{]*\{[^}]*min-inline-size:\s*var\(--hz-hit\)[^}]*min-block-size:\s*var\(--hz-hit\)/.test(css)) problems.push('.lf-hz-handle must set min-inline-size and min-block-size from var(--hz-hit)');
  return problems;
}

/** The smallest side a tap target inside a drawing may render at: `target-base` in tokens.css. */
export const HZ_MIN_TAP_PX = 56;
const TARGET_BASE_PX = 56;
const MIN_SIZE_PROPERTIES = /^(?:min-inline-size|min-block-size|min-width|min-height|grid-template-columns)$/;

/** The shared `.lf-hz-hit-sized` rule keeps an SVG board between `target-base` and `target-lg` for its smallest hit, from `--hz-hit-span`. */
export function hitSizedRuleProblems(css: string): string[] {
  const rule = /\.lf-hz-hit-sized\s*\{([^}]*)\}/.exec(css.replace(/\/\*[\s\S]*?\*\//g, ''))?.[1] ?? '';
  const problems: string[] = [];
  if (!/min-inline-size:\s*calc\(\s*var\(--hz-hit-span\)\s*\*\s*var\(--target-base\)\s*\)/.test(rule)) problems.push('.lf-hz-hit-sized must set min-inline-size from var(--hz-hit-span) * var(--target-base)');
  if (!/max-inline-size:\s*calc\(\s*var\(--hz-hit-span\)\s*\*\s*var\(--target-lg\)\s*\)/.test(rule)) problems.push('.lf-hz-hit-sized must set max-inline-size from var(--hz-hit-span) * var(--target-lg)');
  return problems;
}

/**
 * An SVG board whose taps are drawn shapes (a bead, a cell) is `.lf-hz-hit-sized` and declares `--hz-hit-span`, its viewBox width over the
 * shorter side of its smallest hit rect. At the narrowest width the stylesheet allows, every `role="button"` hit rect renders at least
 * `target-base` on its short side; `[data-hz-handle]` never sees these shapes.
 */
export function svgHitProblems(svg: Element, minPx: number = HZ_MIN_TAP_PX): string[] {
  const span = Number(/--hz-hit-span:\s*([\d.]+)/.exec(svg.getAttribute('style') ?? '')?.[1]);
  const width = Number((svg.getAttribute('viewBox') ?? '').split(/[\s,]+/)[2]);
  if (!svg.classList.contains('lf-hz-hit-sized') || !(span > 0) || !(width > 0)) return ['the drawing is not .lf-hz-hit-sized with a --hz-hit-span and a viewBox'];
  const pxPerUnit = (span * TARGET_BASE_PX) / width;
  const problems: string[] = [];
  for (const target of svg.querySelectorAll('[role="button"]')) {
    const hit = target.matches('rect') ? target : target.querySelector('rect');
    if (!hit) { problems.push(`${target.getAttribute('aria-label') ?? 'a tap target'} has no hit rect`); continue; }
    const side = Math.min(Number(hit.getAttribute('width')), Number(hit.getAttribute('height')));
    if (side * pxPerUnit < minPx - 0.01) problems.push(`${target.getAttribute('aria-label') ?? 'a tap target'} renders ${(side * pxPerUnit).toFixed(1)} px`);
  }
  return problems;
}

/** Literal lengths below `minPx` in the minimum sizes and columns of the named interactive selectors; a token (`var(--target-base)`) is never flagged. */
export function tapTargetCssProblems(css: string, selectors: readonly string[], minPx: number = HZ_MIN_TAP_PX): CssProblem[] {
  const problems: CssProblem[] = [];
  const text = css.replace(/\/\*[\s\S]*?\*\//g, '');
  for (const [, prelude, body] of text.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const named = prelude!.split(',').map((selector) => selector.trim()).filter((selector) => selectors.includes(selector));
    if (named.length === 0) continue;
    for (const declaration of body!.split(';')) {
      const [property, ...rest] = declaration.split(':');
      if (!MIN_SIZE_PROPERTIES.test(property!.trim())) continue;
      for (const [, amount, unit] of rest.join(':').matchAll(/(\d*\.?\d+)(rem|px)\b/g)) {
        const px = unit === 'rem' ? Number(amount) * 16 : Number(amount);
        if (px < minPx) problems.push({ rule: `${named.join(', ')} { ${declaration.trim()} }`, problem: `${amount}${unit} is under ${minPx} px (use var(--target-base))` });
      }
    }
  }
  return problems;
}

function accessibleName(element: Element): string {
  const labelled = element.getAttribute('aria-labelledby');
  const byId = labelled ? labelled.split(/\s+/).map((id) => element.ownerDocument.getElementById(id)?.textContent ?? '').join(' ') : '';
  const native = [...((element as HTMLInputElement).labels ?? [])].map((label) => label.textContent ?? '').join(' ');
  return (element.getAttribute('aria-label') ?? byId ?? '').trim() || native.trim() || (element.textContent ?? '').trim() || (element.getAttribute('title') ?? '').trim();
}

const ownText = (element: Element) => [...element.childNodes].filter((node) => node.nodeType === 3).map((node) => node.textContent ?? '').join('').trim();

/** The copy module itself: a role per string, three native versions, the Copy Budget at the entry's age band. */
export function assertCopyContract(copy: HorizonteCopy): void {
  for (const [key, entry] of Object.entries(copy)) {
    expect(ROLES, `${key}: data-copy-role`).toContain(entry.role);
    for (const locale of HZ_LOCALES) {
      const text = entry[locale];
      expect(typeof text === 'string' && text.trim().length > 0, `${key}: ${locale} text`).toBe(true);
      expect(checkCopy(text, entry.role, { locale, ageBand: entry.band ?? '6-9', surface: 'app' }), `${key} (${locale}) Copy Budget`).toEqual([]);
    }
  }
}

/**
 * The frontend contract every Horizonte board meets (RECIPE.md "Definition of done"). In each locale it renders the fixture
 * through the real lesson player and checks: a declared ICAP level and chunk budget; every interactive element focusable and
 * named; every drag handle 64 px (declared and in CSS) with a Move to menu beside it; a table or text equivalent that opens;
 * motion only under no-preference and within the motion tokens; and a data-copy-role on every string, within budget.
 */
export async function assertBoardContract(options: BoardContractOptions): Promise<void> {
  const fixture = horizonteFixture(options.pack, options.fixtureId);
  expect(fixture, `${options.pack}/${options.fixtureId}: no such fixture`).not.toBeNull();
  const type = String(fixture!.segment('en-US').type);
  // A piece's pack loads when a document names it; the harness stands in for the player and loads it first.
  const packId = horizontePackIdOf(type);
  expect(packId, `${type}: no pack serves this type`).toBeTruthy();
  await loadHorizontePacks([packId!]);
  const entry = HORIZONTE_BOARDS[type];
  expect(entry, `${type}: no board registered`).toBeTruthy();
  expect(ICAP, `${type}: declared ICAP level`).toContain(entry!.icap);
  expect(Number.isInteger(entry!.chunkBudgetKb) && entry!.chunkBudgetKb > 0 && entry!.chunkBudgetKb <= HZ_MAX_CHUNK_KB, `${type}: chunkBudgetKb is a whole number of KB from 1 to ${HZ_MAX_CHUNK_KB}`).toBe(true);
  assertCopyContract(options.copy);

  const files = ['horizonte.css', ...(options.css ?? [])];
  const sources = files.map((file) => [file, readFileSync(resolve(horizonteDir, file), 'utf8')] as const);
  expect(handleRuleProblems(sources[0]![1])).toEqual([]);
  for (const [file, css] of sources) expect(motionProblems(css), `${file}: motion`).toEqual([]);

  for (const locale of options.locales ?? HZ_LOCALES) {
    const raw = horizonteFixtureDocument(options.pack, options.fixtureId, locale);
    const ageBand = fixture!.ageBand as AgeBand;
    const { container } = render(<LessonDocumentView raw={raw} locale={locale} ageBand={ageBand} onBack={() => {}}
      attemptSeeds={horizonteFixtureSeeds(options.pack, options.fixtureId, locale)} onGradeAny={() => ({ verdict: options.grade?.() ?? 'review' })} />);
    await waitFor(() => expect(container.querySelector('.lf-learning-board'), `${type} (${locale}): the board renders`).not.toBeNull(), { timeout: 5000 });
    const at = `${type} (${locale})`;

    for (const element of container.querySelectorAll(FOCUSABLE)) {
      const tabindex = element.getAttribute('tabindex');
      const off = element.hasAttribute('disabled') || element.getAttribute('aria-disabled') === 'true';
      if (tabindex !== null && Number(tabindex) < 0 && !off && !element.hasAttribute('data-hz-roving')) throw new Error(`${at}: ${element.outerHTML.slice(0, 120)} is not keyboard reachable`);
      expect(accessibleName(element), `${at}: ${element.outerHTML.slice(0, 120)} has no accessible name`).not.toBe('');
    }
    expect(container.querySelector('[draggable="true"]'), `${at}: native HTML5 drag is not keyboard operable; use useDragPlace`).toBeNull();

    const handles = [...container.querySelectorAll('[data-hz-handle]')];
    for (const handle of handles) {
      expect(Number(handle.getAttribute('data-hz-hit')), `${at}: a handle declares its hit size`).toBeGreaterThanOrEqual(HZ_MIN_HIT_PX);
      expect(handle.classList.contains('lf-hz-handle'), `${at}: a handle carries .lf-hz-handle (the 64 px rule)`).toBe(true);
      expect(handle.querySelector(FOCUSABLE) ?? (handle.matches(FOCUSABLE) ? handle : null), `${at}: a handle is focusable`).not.toBeNull();
    }
    if (handles.length > 0) expect(container.querySelector('.lf-move-to button'), `${at}: handles need the Move to menu (V4)`).not.toBeNull();

    const toggle = container.querySelector<HTMLElement>('[data-hz-table-toggle]');
    const equivalent = container.querySelector('table, [data-hz-text-equivalent], [data-hz-table]');
    expect(toggle !== null || equivalent !== null, `${at}: no table or text equivalent`).toBe(true);
    if (toggle && !container.querySelector('table, [data-hz-table]')) {
      fireEvent.click(toggle);
      expect(container.querySelector('table, [data-hz-table]'), `${at}: the table toggle opens a table`).not.toBeNull();
    }

    for (const element of container.querySelectorAll('*')) {
      const text = ownText(element);
      if (!text) continue;
      const owner = element.closest('[data-copy-role]');
      expect(owner, `${at}: "${text.slice(0, 40)}" has no data-copy-role`).not.toBeNull();
      const role = owner!.getAttribute('data-copy-role') as CopyRole;
      expect(ROLES, `${at}: "${text.slice(0, 40)}" carries an unknown role`).toContain(role);
      if (owner === element) expect(checkCopy(text, role, { locale, ageBand, surface: 'app' }), `${at}: "${text.slice(0, 40)}" Copy Budget`).toEqual([]);
    }
    cleanup();
  }
}
