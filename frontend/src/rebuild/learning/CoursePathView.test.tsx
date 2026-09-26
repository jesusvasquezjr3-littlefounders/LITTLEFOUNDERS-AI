import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { checkCopy, type CopyRole, type Locale } from '../design/copyBudget';
import { fetchCoursePath, localizedText, parseCoursePath } from './coursePath';
import { adultPathFixture, childPathFixture, completePathFixture, coursePathPreviewStates, placementPathFixture } from './coursePathFixtures';
import { CoursePathView, coursePathCopy } from './CoursePathView';

const locales: Locale[] = ['en-US', 'es-MX', 'pt-BR'];
const noop = () => {};

/** The role each string is rendered with in CoursePathView.tsx. */
const roleOf = (key: string): CopyRole => {
  if (['start', 'placementAction', 'showMore', 'showLess', 'back', 'retry'].includes(key)) return 'action';
  if (['placementTitle', 'completeTitle', 'moreTitle', 'skillsTitle', 'chaptersTitle', 'loading', 'ageTitle', 'prereqTitle', 'disabledTitle', 'errorTitle'].includes(key)) return 'heading';
  if (key === 'minutes') return 'data';
  return 'body';
};

describe('course path copy', () => {
  it.each(locales)('every string meets the youngest (6–9) Copy Budget in %s, with no em dash and the controlled glossary', (locale) => {
    const copy = coursePathCopy[locale];
    const strings: Array<[string, string]> = [];
    for (const [key, value] of Object.entries(copy)) {
      if (typeof value === 'function') strings.push([key, (value as (a: number, b: number) => string)(12, 34)]);
      else if (typeof value === 'string') strings.push([key, value]);
      else for (const [sub, text] of Object.entries(value as Record<string, string>)) strings.push([`${key}.${sub}`, text]);
    }
    for (const [key, text] of strings) {
      expect(checkCopy(text, roleOf(key.split('.')[0]!), { locale, ageBand: '6-9', surface: 'app' }), `${locale} ${key}: ${text}`).toEqual([]);
      // "Tutor" is only the verified parent; the AI is the Mentor. Coins are never money.
      expect(text, `${key}`).not.toMatch(/\bTutor\b|\bbot\b|assistant|asistente|assistente|\blives?\b|\bvidas?\b/i);
    }
  });
});

describe('course path client', () => {
  it('accepts every fixture as the server shape and rejects anything malformed', () => {
    for (const state of Object.values(coursePathPreviewStates)) if (state.status === 'ready') expect(parseCoursePath(state.path)).not.toBeNull();
    const bad = childPathFixture() as unknown as Record<string, unknown>;
    expect(parseCoursePath({ ...bad, items: [{ lessonId: 'x' }] })).toBeNull();
    expect(parseCoursePath({ ...bad, pathway: { ...(bad.pathway as object), basis: 'guess' } })).toBeNull();
  });

  it('maps every Core refusal to its own state and never guesses on a malformed answer', async () => {
    const reply = (value: Awaited<ReturnType<Parameters<typeof fetchCoursePath>[1]>>) => vi.fn(async () => value);
    expect(await fetchCoursePath('money', reply({ data: null, error: { code: 'COURSE_AGE_RESTRICTED' } }))).toEqual({ status: 'age-restricted' });
    expect(await fetchCoursePath('money', reply({ data: null, error: { code: 'COURSE_PREREQUISITE_REQUIRED', missingPrerequisites: ['entre'] } }))).toEqual({ status: 'prerequisite', missing: ['entre'] });
    expect(await fetchCoursePath('money', reply({ data: null, error: { code: 'PATHWAY_ENGINE_DISABLED' } }))).toEqual({ status: 'disabled' });
    expect(await fetchCoursePath('money', reply({ data: { nope: true }, error: null }))).toEqual({ status: 'error' });
    expect(await fetchCoursePath('money', vi.fn(async () => { throw new Error('offline'); }))).toEqual({ status: 'error' });
    const ok = reply({ data: childPathFixture(), error: null });
    expect((await fetchCoursePath('a b', ok)).status).toBe('ready');
    expect(ok).toHaveBeenCalledWith('/learn/courses/a%20b/path');
  });

  it('picks the learner locale, then the authoring locale, then any title', () => {
    expect(localizedText({ 'en-US': 'Hi', 'es-MX': 'Hola' }, 'pt-BR')).toBe('Hola');
    expect(localizedText({ fr: 'Salut' }, 'en-US')).toBe('Salut');
    expect(localizedText({}, 'en-US')).toBe('');
  });
});

describe('course path view', () => {
  it('leads with the recommended lesson, offers the other open lessons as real choices, and opens the one chosen', () => {
    const onOpen = vi.fn();
    render(<CoursePathView state={{ status: 'ready', path: childPathFixture() }} locale="en-US" dark={false} onOpenLesson={onOpen} onPlacement={noop} onBack={noop} />);
    expect(screen.getByRole('heading', { level: 1, name: 'Money basics' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Start' }));
    expect(onOpen).toHaveBeenLastCalledWith('l-1');
    const more = screen.getByRole('region', { name: 'More to open' });
    // A child sees two further choices first; the rest are one tap away (layering).
    expect(within(more).queryByRole('button', { name: /Saving a little/ })).toBeNull();
    fireEvent.click(within(more).getByRole('button', { name: 'Show more' }));
    expect(within(more).getByRole('button', { name: 'Show less' }).getAttribute('aria-expanded')).toBe('true');
    fireEvent.click(within(more).getByRole('button', { name: /Saving a little/ }));
    expect(onOpen).toHaveBeenLastCalledWith('l-4');
    expect(within(more).getByText('You know this')).toBeTruthy();
    expect(screen.getByText('1 more open as you learn.')).toBeTruthy();
    expect(screen.getByText('Shown with your Mentor')).toBeTruthy();
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('43');
    // A child sees older chapters as closed, never as a lesson to open.
    expect(screen.getByText('2 chapters for older learners')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Household money/ })).toBeNull();
  });

  it('marks optional chapters as extras for an adult and never counts them as the path', () => {
    render(<CoursePathView state={{ status: 'ready', path: adultPathFixture() }} locale="es-MX" dark onOpenLesson={noop} onPlacement={noop} onBack={noop} />);
    expect(screen.getByText('Tu ruta')).toBeTruthy();
    expect(screen.getAllByText('Extra').length).toBeGreaterThan(0);
    expect(screen.getByRole('progressbar', { name: '1 de 6 lecciones hechas' })).toBeTruthy();
    expect(screen.getAllByText('1/6')).toHaveLength(2); // the path total and its one pathway chapter
    expect(screen.getByRole('main').getAttribute('data-theme')).toBe('dark');
  });

  it('puts placement first when the stage has no entry placement, with no lesson to start', () => {
    const onPlacement = vi.fn();
    render(<CoursePathView state={{ status: 'ready', path: placementPathFixture() }} locale="pt-BR" dark={false} onOpenLesson={noop} onPlacement={onPlacement} onBack={noop} />);
    fireEvent.click(screen.getByRole('button', { name: 'Achar meu início' }));
    expect(onPlacement).toHaveBeenCalledOnce();
    expect(screen.queryByRole('button', { name: 'Começar' })).toBeNull();
    expect(screen.queryByRole('region', { name: 'Mais para abrir' })).toBeNull();
  });

  it('states a finished path and its badge plainly, without a celebration effect', () => {
    const { container } = render(<CoursePathView state={{ status: 'ready', path: completePathFixture() }} locale="en-US" dark={false} onOpenLesson={noop} onPlacement={noop} onBack={noop} />);
    expect(screen.getByRole('heading', { name: 'Path complete' })).toBeTruthy();
    expect(screen.getByText('Badge earned')).toBeTruthy();
    expect(container.querySelector('[class*="confetti"], [class*="celebrat"]')).toBeNull();
  });

  it('gives every refusal its own screen with a way back, and a retry only where retrying can help', () => {
    const onRetry = vi.fn();
    const { rerender } = render(<CoursePathView state={{ status: 'age-restricted' }} locale="en-US" dark={false} onOpenLesson={noop} onPlacement={noop} onBack={noop} onRetry={onRetry} />);
    expect(screen.getByRole('heading', { name: 'Not open yet' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull();
    rerender(<CoursePathView state={{ status: 'prerequisite', missing: ['entre'] }} missingTitles={['Entrepreneurship']} locale="en-US" dark={false} onOpenLesson={noop} onPlacement={noop} onBack={noop} />);
    expect(screen.getByText('Entrepreneurship')).toBeTruthy();
    rerender(<CoursePathView state={{ status: 'error' }} locale="en-US" dark={false} onOpenLesson={noop} onPlacement={noop} onBack={noop} onRetry={onRetry} />);
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('declares a copy role on every text element it renders', () => {
    for (const state of Object.values(coursePathPreviewStates)) {
      const { container, unmount } = render(<CoursePathView state={state} locale="en-US" dark={false} onOpenLesson={noop} onPlacement={noop} onBack={noop} onRetry={noop} />);
      const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        if (!node.textContent?.trim()) continue;
        expect(node.parentElement?.closest('[data-copy-role]'), `"${node.textContent}" in ${state.status}`).not.toBeNull();
      }
      unmount();
    }
  });
});
