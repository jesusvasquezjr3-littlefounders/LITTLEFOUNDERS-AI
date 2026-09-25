// /dev/lesson-lab — the visual QA surface and living authoring contract
// (LESSON_ENGINE.md §10). Dev-gated in App.tsx; never ships to production nav.
//
// THE INSTRUMENT IS IN ENGLISH; THE PRODUCT INSIDE IT IS NOT — and until this
// pass those two facts were not being kept in step. The page's own chrome runs
// through i18n (it is real product chrome: the player and the
// theme toggle), while the FIXTURES were pinned to Spanish, so every screenshot
// ever taken of this page showed English chrome around Spanish content and read
// as a product full of hardcoded strings. It is not: a lesson document is
// single-locale by design (LESSON_ENGINE.md §3) and production documents arrive
// from Forge already written in the learner's language. `/dev/tutor-lab` had the
// identical defect and fixed it the identical way; the switch below is the same
// switch, moving `i18n.changeLanguage` and the fixture set together so the two
// can never disagree. See `./fixtureCopy.ts`.
//
// It is also the only way to LOOK at the locale swing on a lesson: the same
// prompt runs to noticeably different lengths across the three, and a card,
// a chip row or an answer bar sized in English is a defect nobody can see in
// English.

import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Badge, Button, Card, Icon, ThemeToggle } from '@/components/ui'
import { cn } from '@/lib/utils'
import { LOCALES, type Locale } from '@/i18n'
import type { LessonDocument, SegmentBase } from '../core/types'
import { stripAnswers } from '../core/strip'
import { GRADED_TYPES, ALL_TYPES } from '../registry'
import { fixturesByFamily } from './fixtureSets'
import { DEFAULT_FIXTURE_LOCALE, fixtureLocaleOf } from './fixtureCopy'
import { createLocalGrader } from './localGrader'
import LessonPlayer from '../player/LessonPlayer'
import type { CharacterId } from '@/components/characters/control/types'

/** Titles the lab gives its own throwaway documents, per locale. */
const LAB_TITLES: Record<Locale, { showcase: string; family: (name: string) => string; objective: string }> = {
  'en-US': {
    showcase: 'Engine Showcase',
    family: (name) => `Family: ${name}`,
    objective: 'Try out the lesson engine',
  },
  'es-MX': {
    showcase: 'Muestrario del motor',
    family: (name) => `Familia: ${name}`,
    objective: 'Probar el motor de lecciones',
  },
  'pt-BR': {
    showcase: 'Mostruário do motor',
    family: (name) => `Família: ${name}`,
    objective: 'Testar o motor de lições',
  },
}

function makeLabDocument(
  segments: SegmentBase[],
  title: string,
  locale: Locale,
): LessonDocument {
  const cast = Array.from(
    new Set(segments.map((s) => s.narrator?.character).filter((c): c is CharacterId => Boolean(c))),
  )
  return {
    schema_version: 1,
    meta: {
      slug: 'lesson-lab',
      title,
      // The document declares the locale it is WRITTEN in, which is now true
      // rather than a constant that happened to be right one third of the time.
      locale,
      subject: 'mixed',
      estimated_minutes: Math.max(1, Math.min(30, segments.length)),
      objectives: [LAB_TITLES[locale].objective],
      cast: cast.length > 0 ? cast : ['dina'],
    },
    // OD-1: no lives, so the lab no longer offers a lives toggle.
    scoring: { pass_threshold: 70, hint_penalty_pct: 10, max_attempts: 2, hearts: null },
    segments,
  }
}

/** The lab's own switch. Dev chrome, so its label is the locale tag itself. */
function LabSwitch({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={cn(
        'flex min-h-12 shrink-0 items-center whitespace-nowrap rounded-sm px-3 lf-label transition-colors',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
        on ? 'bg-primary text-on-primary' : 'lf-answer text-content',
      )}
    >
      {children}
    </button>
  )
}

export function LessonLabPage() {
  const { t, i18n } = useTranslation()
  const [active, setActive] = useState<LessonDocument | null>(null)

  /**
   * ONE SWITCH FOR BOTH HALVES. Seeded from whatever i18next already resolved,
   * so arriving on the page does not silently change the app's language; from
   * the first press the switch is the authority, and `changeLanguage` persists
   * through the detector exactly as the real language picker does.
   */
  const [locale, setLocale] = useState<Locale>(() => fixtureLocaleOf(i18n.language ?? DEFAULT_FIXTURE_LOCALE))
  useEffect(() => {
    if (fixtureLocaleOf(i18n.language ?? DEFAULT_FIXTURE_LOCALE) !== locale) void i18n.changeLanguage(locale)
  }, [i18n, locale])

  const families = useMemo(() => Object.entries(fixturesByFamily(locale)), [locale])
  const allFixtures = useMemo(() => families.flatMap(([, fixtures]) => fixtures), [families])
  const titles = LAB_TITLES[locale]

  if (active) {
    return (
      <LessonPlayer
        // Keyed on the locale so switching while a lesson is open rebuilds it
        // in the new language instead of leaving a stale document mounted.
        key={active.meta.locale}
        document={stripAnswers(active)}
        grader={createLocalGrader(active)}
        onExit={() => setActive(null)}
        onComplete={(r) => {
          // Dev harness: log only. Production XP flows through Core (§7).
          console.info('[lesson-lab] complete', r)
        }}
      />
    )
  }

  return (
    <div className="min-h-screen bg-base">
      <div className="mx-auto max-w-container px-5 py-10 md:px-8">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="lf-display-lg text-content">{t('lesson.lab.title')}</h1>
            <p className="lf-body text-content-muted">
              {t('lesson.lab.subtitle', { types: ALL_TYPES.length, graded: GRADED_TYPES.length })}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {/* Standalone route (no app shell) — the lab applies the theme itself. */}
            <ThemeToggle />
            {/*
              THE LOCALE SWITCH, and it is one switch rather than two because
              the two halves it moves may never be set separately. Pressing
              `pt-BR` changes the app's language AND the fixture set, so the
              prompt, the options, the feedback and the chrome around them are
              always one language.
            */}
            <div className="flex max-w-full gap-1 overflow-x-auto">
              {LOCALES.map((id) => (
                <LabSwitch key={id} on={locale === id} onClick={() => setLocale(id)}>
                  {id}
                </LabSwitch>
              ))}
            </div>
            <Button
              variant="primary"
              onClick={() => setActive(makeLabDocument(allFixtures, titles.showcase, locale))}
            >
              <Icon name="play_arrow" className="mr-1" />
              {t('lesson.lab.showcase')}
            </Button>
          </div>
        </div>

        {families.map(([family, fixtures]) => (
          <section key={family} className="mb-10">
            <div className="mb-4 flex items-center gap-3">
              <h2 className="lf-headline text-content">{family}</h2>
              <Badge>{fixtures.length}</Badge>
              <Button
                variant="secondary"
                onClick={() => setActive(makeLabDocument(fixtures, titles.family(family), locale))}
              >
                {t('lesson.lab.playFamily')}
              </Button>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {fixtures.map((fixture) => (
                <Card key={fixture.id}>
                  <button
                    type="button"
                    onClick={() => setActive(makeLabDocument([fixture], fixture.type, locale))}
                    className="flex w-full items-start justify-between gap-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
                  >
                    <div className="min-w-0">
                      <p className="lf-title text-content">{fixture.type}</p>
                      <p className="lf-caption truncate text-content-muted">{fixture.prompt_md}</p>
                      <div className="mt-2 flex items-center gap-2">
                        <Badge>{`XP ${fixture.xp}`}</Badge>
                        <Badge>{`D${fixture.difficulty}`}</Badge>
                        {fixture.narrator ? <Badge>{fixture.narrator.character}</Badge> : null}
                      </div>
                    </div>
                    <Icon name="play_circle" className="shrink-0 text-[28px] text-accent" />
                  </button>
                </Card>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}

export default LessonLabPage
