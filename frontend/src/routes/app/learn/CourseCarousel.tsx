import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Icon, SectionHeading } from '@/components/ui';
import { CourseBadgeArtwork } from '@/components/course/CourseBadgeArtwork';
import { courseBadgeAsset } from '@/lib/courseBadges';

/*
 * The course carousel (/DESIGN.md §Tactile → Screen recipes → Learn).
 *
 * Replaces the old single hero card plus a grid of the same courses
 * underneath. Two lists of the same objects is one list too many: the grid
 * existed to let a learner reach a course the hero was not showing, and a
 * carousel does that in the space the hero already occupied.
 *
 * IT IS A SCROLLER, NOT A SLIDESHOW. The track is a real overflow container
 * with CSS scroll-snap, so a touch drag, a trackpad swipe, a Tab to an
 * offscreen card and a screen reader's own reading order all work with no
 * JavaScript involved. The arrows and dots below only call `scrollTo` — they
 * are a convenience over the scroller, never the mechanism. A slideshow that
 * mounts one card at a time gets all four of those wrong at once, and the
 * fourth (a card that exists only when its index is active) is invisible to
 * every gate we have.
 */

export interface CarouselCourse {
  id: string;
  slug: string;
  title: Record<string, string>;
  badgeAsset?: string | null;
  inProgress?: boolean;
  progress: { passed: number; total: number; pct: number };
}

interface CourseCarouselProps {
  courses: CarouselCourse[];
  locale: string;
  /** The course the page is showing a chapter for — gets the ACTIVE treatment. */
  activeSlug: string | null;
  /** 1-based lesson number to resume, when the active course has one. */
  resumeLessonNumber?: number | null;
}

function titleFor(course: CarouselCourse, locale: string): string {
  return course.title[locale] ?? course.title['en-US'] ?? course.slug;
}

export function CourseCarousel({ courses, locale, activeSlug, resumeLessonNumber }: CourseCarouselProps) {
  const { t } = useTranslation();
  const headingId = useId();
  const trackRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);

  /*
   * Which card is "current" is READ OFF THE SCROLLER rather than held as the
   * source of truth. The scroller can move without us — a finger, a trackpad,
   * a focus ring landing on an offscreen card — and a state variable that only
   * the arrows write goes out of phase with what is actually on screen the
   * first time a learner swipes.
   */
  const syncIndex = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;
    const cards = [...track.children] as HTMLElement[];
    if (!cards.length) return;
    /*
     * The LEADING card, not the centred one. The track is `snap-start` and on
     * a wide screen three cards are visible at once, so "nearest to the middle
     * of the viewport" reads card 2 as current while card 1 is flush against
     * the left edge — the dots then light the wrong one from the first paint,
     * before anybody has scrolled. What the snap axis actually aligns is the
     * left edge, so that is what is measured.
     */
    const start = track.scrollLeft + track.clientLeft;
    let leading = 0;
    let best = Infinity;
    cards.forEach((card, i) => {
      const d = Math.abs(card.offsetLeft - track.offsetLeft - start);
      if (d < best) {
        best = d;
        leading = i;
      }
    });
    setIndex(leading);
  }, []);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return undefined;
    track.addEventListener('scroll', syncIndex, { passive: true });
    syncIndex();
    return () => track.removeEventListener('scroll', syncIndex);
  }, [syncIndex, courses.length]);

  const scrollToCard = useCallback((i: number) => {
    const track = trackRef.current;
    const card = track?.children[i] as HTMLElement | undefined;
    if (!track || !card) return;
    track.scrollTo({ left: card.offsetLeft - track.offsetLeft, behavior: 'smooth' });
  }, []);

  if (courses.length === 0) return null;

  const atStart = index === 0;
  const atEnd = index >= courses.length - 1;

  return (
    <section aria-roledescription="carousel" aria-labelledby={headingId} className="flex flex-col gap-4">
      {/*
       * THE SECTION LOCKUP, and the arrows ride the same row (/DESIGN.md §The
       * study's component set). The heading NAMES the carousel — the section
       * used to carry the same string as a hidden `aria-label`, which is a
       * label nobody who can see the screen ever gets — and the tile is accent
       * because the card's own resume CTA and its ACTIVE eyebrow are accent.
       *
       * The arrows are a CONTROL, so they sit beside the lockup rather than in
       * its `meta` slot, which is for a count or a status and never a control.
       * They still appear only from `sm` up: on a phone the gesture is the
       * control and a pair of 44px targets would compete with the card they
       * scroll.
       */}
      <div className="flex items-center justify-between gap-3">
        <SectionHeading id={headingId} icon="school" tone="accent" className="min-w-0 flex-1">
          {t('learn.carousel.label')}
        </SectionHeading>
        {courses.length > 1 && (
          <div className="mb-3 hidden shrink-0 gap-2 sm:flex">
            {([['chevron_left', -1, atStart, 'prev'], ['chevron_right', 1, atEnd, 'next']] as const).map(
              ([icon, step, disabled, key]) => (
                <button
                  key={key}
                  type="button"
                  disabled={disabled}
                  onClick={() => scrollToCard(index + step)}
                  aria-label={t(`learn.carousel.${key}`)}
                  className="lf-tactile flex h-11 w-11 items-center justify-center rounded-full border border-outline bg-surface text-content-muted transition-colors hover:text-content disabled:pointer-events-none disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-base"
                >
                  <Icon name={icon} aria-hidden />
                </button>
              ),
            )}
          </div>
        )}
      </div>

      <div
        ref={trackRef}
        className="lf-scroll-x -mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0"
      >
        {courses.map((course, i) => {
          const isActive = course.slug === activeSlug;
          const started = course.progress.passed > 0;
          const done = course.progress.total > 0 && course.progress.passed === course.progress.total;
          const badge = courseBadgeAsset(course.badgeAsset, course.slug);

          return (
            <article
              key={course.id}
              aria-roledescription="slide"
              aria-label={t('learn.carousel.slide', { n: i + 1, total: courses.length })}
              className={`lf-panel lf-sheen flex w-[calc(100%-3rem)] shrink-0 snap-start flex-col gap-5 p-6 transition-shadow hover:shadow-pop sm:w-[26rem] sm:p-7 ${
                isActive ? '!border-accent/40' : ''
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex min-w-0 flex-col gap-2">
                  {/*
                    * An EYEBROW, not a pill. The study's lockup is wide-tracked
                    * small caps sitting directly above the tightly-tracked
                    * display line, and the only thing separating "active" from
                    * "next" is its colour — which is enough, and quieter than
                    * two different badges.
                    */}
                  <span className={`lf-eyebrow ${isActive ? 'text-accent' : 'text-content-faint'}`}>
                    {isActive ? t('learn.carousel.activeCourse') : t('learn.carousel.nextInPath')}
                  </span>
                  <h3 className="lf-display-lg text-content">{titleFor(course, locale)}</h3>
                </div>

                {/* Fixed box so a course with no artwork does not reflow the row. */}
                <div className="h-16 w-16 shrink-0 sm:h-20 sm:w-20">
                  <CourseBadgeArtwork asset={badge} slug={course.slug} size="compact" />
                </div>
              </div>

              {started ? (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-3">
                    <span className="lf-caption inline-flex items-center gap-1.5 text-content-muted">
                      <Icon name="trending_up" className="!text-[16px]" aria-hidden />
                      {t('learn.carousel.progressTotal')}
                    </span>
                    <span className="lf-chip lf-chip-accent lf-caption lf-number !px-2.5 !py-0.5">
                      {course.progress.pct}%
                    </span>
                  </div>
                  <div
                    className="lf-track"
                    role="progressbar"
                    aria-valuenow={course.progress.pct}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={t('dashboard.learn.progressLabel', {
                      passed: course.progress.passed,
                      total: course.progress.total,
                    })}
                  >
                    <div className="lf-track-fill" style={{ width: `${course.progress.pct}%` }} />
                  </div>
                </div>
              ) : (
                <p className="lf-caption text-content-faint">{t('learn.carousel.notStarted')}</p>
              )}

              {course.inProgress && (
                <span className="lf-caption inline-flex w-fit items-center gap-1.5 rounded-full bg-surface-sunken px-2.5 py-1 text-content-muted">
                  <Icon name="construction" className="!text-[16px]" aria-hidden />
                  {t('learn.courseInProgress.badge')}
                </span>
              )}

              <Link
                to={`/learn/${course.slug}`}
                className={`lf-tactile group mt-auto inline-flex min-h-12 items-center justify-center gap-2 rounded-full px-6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-base ${
                  started
                    ? 'lf-tactile-accent lf-sheen bg-accent text-on-accent hover:bg-accent-strong'
                    : 'border border-outline bg-surface text-content-muted hover:text-content'
                }`}
              >
                <span className="lf-label font-bold">
                  {done
                    ? t('dashboard.learn.reviewCourse')
                    : started
                      ? resumeLessonNumber && isActive
                        ? t('learn.carousel.continueLesson', { n: resumeLessonNumber })
                        : t('dashboard.learn.resumeCta')
                      : t('learn.carousel.explore')}
                </span>
                <Icon
                  name={started ? 'arrow_forward' : 'chevron_right'}
                  className="!text-[20px] transition-transform duration-200 motion-safe:group-hover:translate-x-0.5"
                  aria-hidden
                />
              </Link>
            </article>
          );
        })}
      </div>

      {courses.length > 1 && (
        <div className="flex justify-center gap-2" role="tablist" aria-label={t('learn.carousel.label')}>
          {courses.map((course, i) => (
            <button
              key={course.id}
              type="button"
              role="tab"
              aria-selected={i === index}
              aria-label={t('learn.carousel.goTo', { title: titleFor(course, locale) })}
              onClick={() => scrollToCard(i)}
              /*
               * The dot is 8px but the TARGET is 44 (§DESIGN Tap floor): the
               * padding is the control and the dot is only what it looks like.
               */
              className="flex h-11 w-6 items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-base"
            >
              <span
                className={`block h-2 rounded-full transition-all duration-200 ${
                  i === index ? 'w-6 bg-accent' : 'w-2 bg-outline'
                }`}
              />
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
