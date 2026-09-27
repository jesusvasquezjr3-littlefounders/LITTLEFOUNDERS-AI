import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { fetchCourse, nextStep, parseCourseTree } from './course';
import { localizedText, parseCoursePath } from './coursePath';
import { adultPathFixture, childPathFixture, completePathFixture, coursePathPreviewStates, placementPathFixture } from './coursePathFixtures';
import { CourseView, type CourseViewProps } from './CourseView';
import type { LearnLinks } from './learnCopy';
import { childTree, coursePreviewStates } from './learnHomeFixtures';

/*
 * W2L.1 (L2): the one course screen, under both course engines. The S05.3b
 * course path tests are kept (now under the pathway engine) and the linear
 * engine's tree, the refusals and the engine switch are added.
 */

const links: LearnLinks = {
  home: '/learn', course: (slug) => `/learn/${slug}`, lesson: (id) => `/learn/lesson/${id}`, placement: (slug) => `/learn/${slug}/placement`,
  territory: (slug) => `/learn/${slug}/territory`, rhythm: '/learn/rhythm', journal: '/learn/journal',
};

function view(state: CourseViewProps['state'], extra: Partial<CourseViewProps> = {}) {
  const onNavigate = vi.fn();
  const utils = render(<CourseView state={state} slug="financial-education" locale="en-US" dark={false} links={links} onNavigate={onNavigate} {...extra} />);
  return { ...utils, onNavigate };
}

type Reply = { data: unknown; error: { code: string; missingPrerequisites?: string[] } | null };
const replies = (answers: Record<string, Reply>) => vi.fn(async (path: string) => answers[path] ?? { data: null, error: { code: 'NOT_FOUND' } });

describe('course client (both engines)', () => {
  it('accepts every fixture as the server shape and rejects anything malformed', () => {
    for (const state of Object.values(coursePathPreviewStates)) if (state.status === 'ready' && state.detail.engine === 'pathway') expect(parseCoursePath(state.detail.path)).not.toBeNull();
    expect(parseCourseTree(childTree())).not.toBeNull();
    const bad = childPathFixture() as unknown as Record<string, unknown>;
    expect(parseCoursePath({ ...bad, items: [{ lessonId: 'x' }] })).toBeNull();
    expect(parseCoursePath({ ...bad, pathway: { ...(bad.pathway as object), basis: 'guess' } })).toBeNull();
    expect(parseCourseTree({ ...childTree(), adventures: [{ id: 'a' }] })).toBeNull();
  });

  it('reads the pathway when that engine is on, and never asks for the tree', async () => {
    const request = replies({ '/learn/courses/a%20b/path': { data: childPathFixture(), error: null } });
    const state = await fetchCourse('a b', request);
    expect(state.status === 'ready' && state.detail.engine).toBe('pathway');
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('falls back to the tree only when Core says the pathway engine is off', async () => {
    const request = replies({
      '/learn/courses/money/path': { data: null, error: { code: 'PATHWAY_ENGINE_DISABLED' } },
      '/learn/courses/money/tree': { data: childTree(), error: null },
    });
    const state = await fetchCourse('money', request);
    expect(state.status === 'ready' && state.detail.engine).toBe('linear');
    expect(request.mock.calls.map(([path]) => path)).toEqual(['/learn/courses/money/path', '/learn/courses/money/tree']);
  });

  it('maps every Core refusal to its own state, on either engine, and never guesses on a malformed answer', async () => {
    const one = (reply: Reply) => vi.fn(async () => reply);
    expect(await fetchCourse('money', one({ data: null, error: { code: 'COURSE_AGE_RESTRICTED' } }))).toEqual({ status: 'age-restricted' });
    expect(await fetchCourse('money', one({ data: null, error: { code: 'COURSE_PREREQUISITE_REQUIRED', missingPrerequisites: ['entre'] } }))).toEqual({ status: 'prerequisite', missing: ['entre'] });
    expect(await fetchCourse('money', one({ data: null, error: { code: 'NOT_FOUND' } }))).toEqual({ status: 'not-found' });
    expect(await fetchCourse('money', one({ data: null, error: { code: 'FORBIDDEN' } }))).toEqual({ status: 'refused' });
    expect(await fetchCourse('money', one({ data: null, error: { code: 'NETWORK' } }))).toEqual({ status: 'offline' });
    expect(await fetchCourse('money', one({ data: { nope: true }, error: null }))).toEqual({ status: 'error' });
    expect(await fetchCourse('money', vi.fn(async () => { throw new Error('offline'); }))).toEqual({ status: 'offline' });
    // B.2 under the linear engine: the tree refuses with the missing prerequisites (S05.2ba).
    const linear = replies({
      '/learn/courses/money/path': { data: null, error: { code: 'PATHWAY_ENGINE_DISABLED' } },
      '/learn/courses/money/tree': { data: null, error: { code: 'COURSE_PREREQUISITE_REQUIRED', missingPrerequisites: ['first-lemonade-stand'] } },
    });
    expect(await fetchCourse('money', linear)).toEqual({ status: 'prerequisite', missing: ['first-lemonade-stand'] });
  });

  it('derives the next step from what Core computed, for both engines', () => {
    expect(nextStep({ engine: 'pathway', path: childPathFixture() })).toMatchObject({ kind: 'lesson', lessonId: 'l-1' });
    expect(nextStep({ engine: 'pathway', path: placementPathFixture() })).toEqual({ kind: 'placement' });
    expect(nextStep({ engine: 'pathway', path: completePathFixture() })).toEqual({ kind: 'done' });
    expect(nextStep({ engine: 'linear', tree: childTree() })).toMatchObject({ kind: 'lesson', lessonId: 'l-needs-1', minutes: 5 });
    expect(nextStep({ engine: 'linear', tree: childTree(true) })).toEqual({ kind: 'placement' });
  });

  it('picks the learner locale, then the authoring locale, then any title', () => {
    expect(localizedText({ 'en-US': 'Hi', 'es-MX': 'Hola' }, 'pt-BR')).toBe('Hola');
    expect(localizedText({ fr: 'Salut' }, 'en-US')).toBe('Salut');
    expect(localizedText({}, 'en-US')).toBe('');
  });
});

describe('course screen under the pathway engine (B.6)', () => {
  it('leads with the recommended lesson, offers the other open lessons as real choices, and opens the one chosen', () => {
    const { onNavigate } = view(coursePathPreviewStates.child!);
    expect(screen.getByRole('heading', { level: 1, name: 'Money basics' })).toBeTruthy();
    fireEvent.click(screen.getByRole('link', { name: 'Start' }));
    expect(onNavigate).toHaveBeenLastCalledWith('/learn/lesson/l-1', { courseSlug: 'financial-education' });
    const more = screen.getByRole('region', { name: 'More to open' });
    // A child sees two further choices first; the rest are one tap away (layering).
    expect(within(more).queryByRole('button', { name: /Saving a little/ })).toBeNull();
    fireEvent.click(within(more).getByRole('button', { name: 'Show more' }));
    expect(within(more).getByRole('button', { name: 'Show less' }).getAttribute('aria-expanded')).toBe('true');
    fireEvent.click(within(more).getByRole('button', { name: /Saving a little/ }));
    expect(onNavigate).toHaveBeenLastCalledWith('/learn/lesson/l-4', { courseSlug: 'financial-education' });
    expect(within(more).getByText('You know this')).toBeTruthy();
    expect(screen.getByText('1 more open as you learn.')).toBeTruthy();
    expect(screen.getByText('Shown with your Mentor')).toBeTruthy();
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('43');
    // A child sees older chapters as closed, never as a lesson to open.
    expect(screen.getByText('2 chapters for older learners')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Household money/ })).toBeNull();
  });

  it('marks optional chapters as extras for an adult and never counts them as the path', () => {
    const { container } = render(<CourseView state={{ status: 'ready', detail: { engine: 'pathway', path: adultPathFixture() } }} slug="money" locale="es-MX" dark
      links={links} onNavigate={vi.fn()} />);
    expect(screen.getByText('Tu ruta')).toBeTruthy();
    expect(screen.getAllByText('Extra').length).toBeGreaterThan(0);
    expect(screen.getByRole('progressbar', { name: '1 de 6 lecciones hechas' })).toBeTruthy();
    expect(screen.getAllByText('1/6')).toHaveLength(2); // the path total and its one pathway chapter
    expect(container.firstElementChild?.getAttribute('data-theme')).toBe('dark');
  });

  it('puts placement first when the stage has no entry placement, with no lesson to start', () => {
    const { onNavigate } = view(coursePathPreviewStates.placement!, { locale: 'pt-BR' });
    const hero = screen.getByRole('region', { name: 'Encontre seu início' });
    fireEvent.click(within(hero).getByRole('link', { name: 'Começar' }));
    expect(onNavigate).toHaveBeenCalledWith('/learn/financial-education/placement', undefined);
    // The one call to action is the placement: no lesson link anywhere before it.
    expect(document.querySelectorAll('a[href^="/learn/lesson/"]')).toHaveLength(0);
    expect(screen.queryByRole('region', { name: 'Mais para abrir' })).toBeNull();
  });

  it('states a finished path and its badge plainly, without a celebration effect', () => {
    const { container } = view(coursePathPreviewStates.complete!);
    expect(screen.getByRole('heading', { name: 'Path complete' })).toBeTruthy();
    expect(screen.getByText('Badge earned')).toBeTruthy();
    expect(container.querySelector('[class*="confetti"], [class*="celebrat"]')).toBeNull();
  });
});

describe('course screen under the linear engine', () => {
  it('W2L.3: shows the course badge on a finished course, with its own course icon and no celebration', () => {
    const tree = childTree();
    const done = { ...tree, course: { ...tree.course, progress: { passed: 14, total: 14, pct: 100 } }, nextLessonId: null };
    const { container } = view({ status: 'ready', detail: { engine: 'linear', tree: done } });
    const earned = screen.getByText('Badge earned');
    expect(earned.querySelector('[data-asset-id="course.badge.frame"]')).not.toBeNull();
    expect(earned.querySelector('[data-asset-id="course.money-basics.icon"]')).not.toBeNull();
    expect(earned.querySelector('[aria-hidden="true"]')).not.toBeNull();
    expect(container.querySelector('[data-celebrate], [class*="celebrat"]')).toBeNull();
  });

  it('lists the chapters closed, and opens one to its lessons in the state Core gave each', () => {
    const { onNavigate } = view(coursePreviewStates.linear!);
    expect(screen.getByRole('heading', { level: 1, name: 'Money basics' })).toBeTruthy();
    const toggle = screen.getByRole('button', { name: 'Lessons' });
    // Every chapter starts closed: the next lesson is the hero's, and the first view stays within the Copy Budget.
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByRole('list', { name: 'Coins and counting' })).toBeNull();
    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    // The toggle is described by its chapter's title; an open chapter carries no tag, done and later do.
    expect(document.getElementById(toggle.getAttribute('aria-describedby')!)?.textContent).toBe('Coins and counting');
    expect(screen.getByText('Later')).toBeTruthy();
    const lessons = screen.getByRole('list', { name: 'Coins and counting' });
    expect(within(lessons).getByRole('button', { name: /Coins in a jar/ }).textContent).toContain('Best: 90%');
    // Credited by the placement quiz: done, but never a score the learner did not play for.
    expect(within(lessons).getByRole('button', { name: /Count by fives/ }).textContent).not.toContain('%');
    expect(within(lessons).getByRole('button', { name: /What do we need/ }).textContent).toContain('Next step');
    // A locked lesson is text, not a control.
    expect(within(lessons).queryByRole('button', { name: /Wants can wait/ })).toBeNull();
    expect(within(lessons).getByText('Wants can wait')).toBeTruthy();
    fireEvent.click(within(lessons).getByRole('button', { name: /What do we need/ }));
    expect(onNavigate).toHaveBeenLastCalledWith('/learn/lesson/l-needs-1', { courseSlug: 'financial-education' });
    // The hero opens the same next lesson, by id (never a slug, paths.ts).
    expect(screen.getByRole('link', { name: 'Start' }).getAttribute('href')).toBe('/learn/lesson/l-needs-1');
    // A locked chapter cannot be opened.
    expect(screen.getAllByRole('button', { name: 'Lessons' })).toHaveLength(1);
    fireEvent.click(toggle);
    expect(screen.queryByRole('list', { name: 'Coins and counting' })).toBeNull();
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
  });

  it('offers the placement instead of redirecting into it, and opens no lesson before it (B.15)', () => {
    view(coursePreviewStates['linear-placement']!);
    expect(screen.getByRole('link', { name: 'Start' }).getAttribute('href')).toBe('/learn/financial-education/placement');
    expect(screen.getByText('A few questions show where you begin.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Lessons' })).toBeNull();
  });

  it('keeps the way to the territory map and says when a course is still being built', () => {
    view(coursePreviewStates.linear!, { inProgress: true });
    expect(screen.getByRole('link', { name: 'Map' }).getAttribute('href')).toBe('/learn/financial-education/territory');
    expect(screen.getByText('Voices and pictures coming soon.')).toBeTruthy();
  });

  it('shows an empty course as empty, not broken', () => {
    view(coursePreviewStates.empty!);
    expect(screen.getByRole('heading', { name: 'No lessons yet' })).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Start' })).toBeNull();
  });
});

describe('course screen refusals', () => {
  it('gives every refusal its own screen with a way back, and a retry only where retrying can help', () => {
    const onRetry = vi.fn();
    const { rerender } = view({ status: 'age-restricted' }, { onRetry });
    expect(screen.getByRole('heading', { name: 'Not open yet' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Courses' }).getAttribute('href')).toBe('/learn');
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull();
    for (const [status, heading] of [['not-found', 'Course not found'], ['refused', 'Course not open']] as const) {
      rerender(<CourseView state={{ status }} slug="money" locale="en-US" dark={false} links={links} onNavigate={vi.fn()} onRetry={onRetry} />);
      expect(screen.getByRole('heading', { name: heading })).toBeTruthy();
      expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull();
    }
    for (const [status, heading] of [['error', 'Path unavailable'], ['offline', 'You are offline']] as const) {
      rerender(<CourseView state={{ status }} slug="money" locale="en-US" dark={false} links={links} onNavigate={vi.fn()} onRetry={onRetry} />);
      expect(screen.getByRole('heading', { name: heading })).toBeTruthy();
    }
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('names each unfinished prerequisite course and opens it (B.2)', () => {
    const { onNavigate } = view({ status: 'prerequisite', missing: ['entrepreneurship', 'unknown-course'] }, { courseTitles: { entrepreneurship: 'Start a business' } });
    expect(screen.getByRole('heading', { name: 'One step first' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Start a business/ }));
    expect(onNavigate).toHaveBeenCalledWith('/learn/entrepreneurship');
    // A title the shelf does not know falls back to the slug, never to nothing.
    expect(screen.getByRole('button', { name: /unknown-course/ })).toBeTruthy();
  });

  it('declares a copy role on every text element it renders, in every state and engine', () => {
    for (const state of [...Object.values(coursePathPreviewStates), ...Object.values(coursePreviewStates)]) {
      const { container, unmount } = render(<CourseView state={state} slug="money" locale="en-US" dark={false} links={links} onNavigate={vi.fn()} onRetry={vi.fn()} inProgress />);
      const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        if (!node.textContent?.trim()) continue;
        expect(node.parentElement?.closest('[data-copy-role]'), `"${node.textContent}" in ${state.status}`).not.toBeNull();
      }
      expect(container.querySelectorAll('h1'), state.status).toHaveLength(1);
      // Inside the learner shell: the shell owns the one <main>.
      expect(container.querySelector('main')).toBeNull();
      unmount();
    }
  });
});

describe('OD-25: the learner answers the one-stage-early and the Mentor-mastery offers', () => {
  const offers = coursePathPreviewStates.offers!;

  it('asks both questions; nothing is sent until the learner says yes, and each yes names its offer', async () => {
    const onOpenEarly = vi.fn(async () => 'done' as const);
    const onAcceptMastery = vi.fn(async () => 'done' as const);
    view(offers, { onOpenEarly, onAcceptMastery });
    const early = screen.getByRole('region', { name: 'Ready for more' });
    expect(within(early).getByText('You mastered what Budgets that work needs. Open it early?')).toBeTruthy();
    const mastery = screen.getByRole('region', { name: 'Shown with your Mentor' });
    expect(within(mastery).getByText('You showed Save for later. Unlock the next step?')).toBeTruthy();
    expect(onOpenEarly).not.toHaveBeenCalled();
    fireEvent.click(within(early).getByRole('button', { name: 'Open it' }));
    expect(await within(early).findByText('Open. It is an extra, at your pace.')).toBeTruthy();
    expect(onOpenEarly).toHaveBeenCalledWith('ch-teens');
    fireEvent.click(within(mastery).getByRole('button', { name: 'Yes, unlock' }));
    expect(await within(mastery).findByText('Done. The next step is open.')).toBeTruthy();
    expect(onAcceptMastery).toHaveBeenCalledWith('topic-l-4');
  });

  it('"Not now" only hides the question; a failure is said and can be retried; a refused offer disappears', async () => {
    const onOpenEarly = vi.fn(async () => 'error' as const);
    const onAcceptMastery = vi.fn(async () => 'refused' as const);
    view(offers, { onOpenEarly, onAcceptMastery });
    const early = screen.getByRole('region', { name: 'Ready for more' });
    fireEvent.click(within(early).getByRole('button', { name: 'Open it' }));
    expect(await within(early).findByText('Could not save it. Try again.')).toBeTruthy();
    fireEvent.click(within(early).getByRole('button', { name: 'Not now' }));
    expect(screen.queryByRole('region', { name: 'Ready for more' })).toBeNull();
    fireEvent.click(within(screen.getByRole('region', { name: 'Shown with your Mentor' })).getByRole('button', { name: 'Yes, unlock' }));
    await vi.waitFor(() => expect(screen.queryByRole('region', { name: 'Shown with your Mentor' })).toBeNull());
  });

  it('without handlers (an older host) and without offers, nothing is asked', () => {
    const { unmount } = view(offers);
    expect(screen.queryByRole('region', { name: 'Ready for more' })).toBeNull();
    unmount();
    view(coursePathPreviewStates.child!, { onOpenEarly: vi.fn(), onAcceptMastery: vi.fn() });
    expect(screen.queryByRole('region', { name: 'Shown with your Mentor' })).toBeNull();
  });

  it('posts each confirmation to Core and maps its answers', async () => {
    const { acceptMasteryCredit, openChapterEarly } = await import('./course');
    const ok = vi.fn(async () => ({ data: { status: 'opened' }, error: null }));
    expect(await openChapterEarly(ok, 'money basics', 'ch-1')).toBe('done');
    expect(ok).toHaveBeenLastCalledWith('/learn/courses/money%20basics/early-access', { method: 'POST', body: { chapterId: 'ch-1' } });
    expect(await acceptMasteryCredit(ok, 'money', 't-1')).toBe('done');
    expect(ok).toHaveBeenLastCalledWith('/learn/courses/money/mastery-credit', { method: 'POST', body: { topicId: 't-1' } });
    const answer = (code: string) => vi.fn(async () => ({ data: null, error: { code } }));
    expect(await openChapterEarly(answer('EARLY_ACCESS_NOT_ELIGIBLE'), 'money', 'c')).toBe('refused');
    expect(await acceptMasteryCredit(answer('MASTERY_CREDIT_NOT_ELIGIBLE'), 'money', 't')).toBe('refused');
    expect(await acceptMasteryCredit(answer('NETWORK'), 'money', 't')).toBe('offline');
    expect(await acceptMasteryCredit(answer('DATA_UNAVAILABLE'), 'money', 't')).toBe('error');
    expect(await openChapterEarly(vi.fn(async () => { throw new Error('offline'); }), 'money', 'c')).toBe('offline');
  });
});
