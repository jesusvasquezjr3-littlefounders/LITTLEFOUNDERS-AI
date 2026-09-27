import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { childPathFixture } from './coursePathFixtures';
import type { CourseState } from './course';
import type { LearnLinks } from './learnCopy';
import { featuredCourse, fetchShelf, shelfOrder, shelfSchema } from './learnHome';
import { childShelf, childTree, homePreviewShelf, teenShelf, youngPathwayShelf } from './learnHomeFixtures';
import { LearnHomeView, type LearnHomeProps } from './LearnHomeView';
import { rhythmPreviewStates } from './motivationFixtures';
import { selfBridgesFixture } from './narrativeFixtures';

/* W2L.1 (L1): the learner home, its states and the server rules it must reflect (B.3, B.6, B.9, B.13, B.21, B.24). */

const links: LearnLinks = {
  home: '/learn', course: (slug) => `/learn/${slug}`, lesson: (id) => `/learn/lesson/${id}`, placement: (slug) => `/learn/${slug}/placement`,
  territory: (slug) => `/learn/${slug}/territory`, rhythm: '/learn/rhythm', journal: '/learn/journal',
};
const linear = (placement = false): { slug: string; state: CourseState } =>
  ({ slug: 'financial-education', state: { status: 'ready', detail: { engine: 'linear', tree: childTree(placement) } } });

function home(extra: Partial<LearnHomeProps> = {}) {
  const props: LearnHomeProps = {
    locale: 'en-US', dark: false, ageBand: '6-9', name: 'Sofía', shelf: homePreviewShelf('child'), featured: linear(),
    rhythm: rhythmPreviewStates.open!, bridges: [], links, onNavigate: vi.fn(), onRetry: vi.fn(), onBridge: vi.fn(async () => 'done' as const), ...extra,
  };
  return { ...render(<LearnHomeView {...props} />), props };
}

describe('learner home data', () => {
  it('validates the shelf and treats a malformed one as unavailable, never partly shown', async () => {
    expect(shelfSchema.safeParse(childShelf()).success).toBe(true);
    expect(shelfSchema.safeParse(teenShelf()).success).toBe(true);
    expect(await fetchShelf(vi.fn(async () => ({ data: { courses: [{ slug: 'x' }] }, error: null })))).toEqual({ status: 'error' });
    expect(await fetchShelf(vi.fn(async () => ({ data: null, error: { code: 'NETWORK' } })))).toEqual({ status: 'offline' });
    expect(await fetchShelf(vi.fn(async () => ({ data: null, error: { code: 'FORBIDDEN' } })))).toEqual({ status: 'refused' });
    expect(await fetchShelf(vi.fn(async () => { throw new Error('down'); }))).toEqual({ status: 'offline' });
  });

  it('features the course in progress, never one the age safeguard closes, and leads the shelf with it', () => {
    const courses = childShelf().courses;
    expect(featuredCourse(courses)?.slug).toBe('financial-education');
    expect(shelfOrder(courses, featuredCourse(courses)).map((c) => c.slug)[0]).toBe('financial-education');
    const young = youngPathwayShelf().courses;
    expect(featuredCourse([young[1]!])).toBeNull();
    expect(featuredCourse(young)?.slug).toBe('financial-education');
  });
});

describe('learner home', () => {
  it('leads with the featured course next step and opens that lesson directly, with the course to return to', () => {
    const { props } = home();
    expect(screen.getByRole('heading', { level: 1, name: 'Hi, Sofía' })).toBeTruthy();
    const hero = screen.getByRole('region', { name: 'Needs and wants' });
    expect(within(hero).getByText('Money basics')).toBeTruthy();
    const start = within(hero).getByRole('link', { name: 'Continue' });
    expect(start.getAttribute('href')).toBe('/learn/lesson/l-needs-1');
    fireEvent.click(start);
    expect(props.onNavigate).toHaveBeenCalledWith('/learn/lesson/l-needs-1', { courseSlug: 'financial-education' });
    // One call to action colour on the page (02 §4.2).
    expect(document.querySelectorAll('.lf-button--accent')).toHaveLength(1);
  });

  it('says each course once, told apart by hue, icon and title, with one way in', () => {
    home();
    const shelf = screen.getByRole('region', { name: 'Your courses' });
    const cards = within(shelf).getAllByRole('article');
    expect(cards).toHaveLength(4);
    const money = within(shelf).getByRole('article', { name: 'Money basics' });
    expect(money.className).toContain('lf-card--mint');
    expect(money.querySelector('[data-asset-id="course.money-basics.icon"]')).not.toBeNull();
    expect(within(money).getByText('6/14')).toBeTruthy();
    expect(within(money).getByRole('link', { name: 'Continue' }).getAttribute('href')).toBe('/learn/financial-education');
    expect(within(shelf).getByRole('article', { name: 'My first lemonade stand' }).textContent).toContain('Review');
    expect(within(shelf).getByRole('article', { name: 'Start a business' }).textContent).toContain('10 lessons');
    expect(within(shelf).getByRole('article', { name: 'Smart investing' }).textContent).toContain('Still being built');
  });

  it('offers the placement first when a course owes one (B.15 framing)', () => {
    home({ featured: linear(true) });
    const hero = screen.getByRole('region', { name: 'Find your start' });
    expect(within(hero).getByRole('link', { name: 'Start' }).getAttribute('href')).toBe('/learn/financial-education/placement');
  });

  it('opens the B.6 recommendation even when the course read failed', () => {
    home({ shelf: homePreviewShelf('teen'), featured: { slug: 'financial-education', state: { status: 'error' } } });
    const hero = document.querySelector<HTMLElement>('.lf-learn-hero')!;
    expect(within(hero).getByText('Next step')).toBeTruthy();
    expect(within(hero).getByRole('link', { name: 'Continue' }).getAttribute('href')).toBe('/learn/lesson/l-1');
  });

  it('uses the pathway frontier as the next step when that engine is on', () => {
    home({ shelf: homePreviewShelf('teen'), featured: { slug: 'financial-education', state: { status: 'ready', detail: { engine: 'pathway', path: childPathFixture() } } } });
    expect(screen.getByRole('region', { name: 'Counting coins' })).toBeTruthy();
  });

  it('never reads another course answer as the featured course next step', () => {
    home({ featured: { slug: 'investing', state: { status: 'ready', detail: { engine: 'linear', tree: childTree() } } } });
    expect(screen.queryByRole('region', { name: 'Needs and wants' })).toBeNull();
    expect(screen.getByRole('link', { name: 'Open course' }).getAttribute('href')).toBe('/learn/financial-education');
  });

  it('lists a course closed by age and never offers it (OD-16)', () => {
    home({ shelf: homePreviewShelf('young'), featured: null });
    const closed = screen.getByRole('article', { name: 'Smart investing' });
    expect(within(closed).getByText('Opens when you are older.')).toBeTruthy();
    expect(within(closed).queryByRole('link')).toBeNull();
    expect(closed.className).not.toContain('lf-card--sky');
  });

  it('says when the featured course could not load instead of silently dropping it (B.3), with a retry', () => {
    const { props } = home({ shelf: homePreviewShelf('unavailable'), featured: null });
    const notice = screen.getByRole('status');
    expect(notice.textContent).toContain('Money basics is not loading right now.');
    fireEvent.click(within(notice).getByRole('button', { name: 'Try again' }));
    expect(props.onRetry).toHaveBeenCalledOnce();
  });

  it('shows the streak with its rest days and links the learner pace, and never a loss (B.21, B.24)', () => {
    const { rerender, props } = home();
    const streak = screen.getByRole('region', { name: 'Streak' });
    expect(within(streak).getByText('Rest days left: 1')).toBeTruthy();
    // The pace (B.24) is on the rhythm, one press away: the home's first view stays within the Copy Budget.
    expect(within(streak).queryByText(/Today/)).toBeNull();
    expect(within(streak).getByRole('link', { name: 'Your rhythm' }).getAttribute('href')).toBe('/learn/rhythm');
    rerender(<LearnHomeView {...props} rhythm={rhythmPreviewStates.resting!} />);
    const resting = screen.getByRole('region', { name: 'Streak resting' });
    expect(within(resting).getByText('Your best stays.')).toBeTruthy();
    // 02 §9.6: the best streak stays in view while the streak rests.
    expect(within(resting).getByText('Best')).toBeTruthy();
    expect(within(resting).getByText('12')).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/lost|freeze|missed|broke/i);
    rerender(<LearnHomeView {...props} rhythm={{ status: 'error' }} />);
    expect(screen.getByRole('link', { name: 'Your rhythm' })).toBeTruthy();
  });

  it('links the learner journal, and shows an independent teen prompts where they are (B.9, B.13)', async () => {
    const onBridge = vi.fn(async () => 'done' as const);
    home({ bridges: selfBridgesFixture(), onBridge, shelf: homePreviewShelf('teen'), ageBand: '13-17' });
    expect(screen.getByRole('link', { name: 'My decisions' }).getAttribute('href')).toBe('/learn/journal');
    expect(screen.getAllByRole('article', { name: 'Try it for real' }).length).toBeGreaterThan(0);
  });

  it('has a state for loading, a failure, no connection, a refusal and an empty shelf', () => {
    const { rerender, props } = home({ shelf: { status: 'loading' } });
    expect(screen.getByRole('status').textContent).toContain('Loading your courses');
    rerender(<LearnHomeView {...props} shelf={{ status: 'error' }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(props.onRetry).toHaveBeenCalledOnce();
    rerender(<LearnHomeView {...props} shelf={{ status: 'offline' }} />);
    expect(screen.getByRole('heading', { name: 'You are offline' })).toBeTruthy();
    rerender(<LearnHomeView {...props} shelf={{ status: 'refused' }} />);
    expect(screen.getByRole('heading', { name: 'Courses are not open' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull();
    rerender(<LearnHomeView {...props} shelf={homePreviewShelf('empty')} />);
    expect(screen.getByRole('heading', { name: 'No courses yet' })).toBeTruthy();
  });

  it('declares a copy role on every text, keeps one h1 and leaves <main> to the shell, in every locale and state', () => {
    for (const locale of ['en-US', 'es-MX', 'pt-BR'] as const) {
      for (const key of ['child', 'teen', 'young', 'unavailable', 'loading', 'error', 'offline', 'refused', 'empty']) {
        const { container, unmount } = render(<LearnHomeView locale={locale} dark ageBand="6-9" name={null} shelf={homePreviewShelf(key)} featured={linear()}
          rhythm={rhythmPreviewStates.open!} bridges={selfBridgesFixture()} links={links} onNavigate={vi.fn()} onRetry={vi.fn()} onBridge={vi.fn(async () => 'done' as const)} />);
        const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
        for (let node = walker.nextNode(); node; node = walker.nextNode()) {
          if (!node.textContent?.trim()) continue;
          expect(node.parentElement?.closest('[data-copy-role]'), `"${node.textContent}" in ${locale} ${key}`).not.toBeNull();
        }
        expect(container.querySelectorAll('h1')).toHaveLength(1);
        expect(container.querySelector('main')).toBeNull();
        expect(container.textContent).not.toMatch(/\bTutor\b|\bbot\b|\blives?\b|\bvidas?\b|—/);
        unmount();
      }
    }
  });
});

describe('OD-25 on the shelf', () => {
  it('a course with no chapter for this age is still offered when mastery can open a chapter one stage early', async () => {
    const { isClosedByAge } = await import('./learnHome');
    const course = { id: 'c', slug: 'investing', title: {}, lessonCount: 3, progress: { passed: 0, total: 3, pct: 0 },
      pathway: { learnerStage: 'tween' as const, pathwayStage: null, basis: 'unavailable' as const, recommendedLessonId: null } };
    expect(isClosedByAge(course)).toBe(true);
    expect(isClosedByAge({ ...course, pathway: { ...course.pathway, earlyAccess: true } })).toBe(false);
    expect(isClosedByAge({ ...course, pathway: { ...course.pathway, basis: 'own-stage' as const } })).toBe(false);
  });
});
