// /dev/lesson-lab — the visual QA surface and living authoring contract
// (LESSON_ENGINE.md §10). Dev-gated in App.tsx; never ships to production nav.

import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Badge, Button, Card, Icon, ThemeToggle } from '@/components/ui'
import type { LessonDocument, SegmentBase } from '../core/types'
import { stripAnswers } from '../core/strip'
import { FIXTURES_BY_FAMILY, GRADED_TYPES, ALL_TYPES } from '../registry'
import { createLocalGrader } from './localGrader'
import LessonPlayer from '../player/LessonPlayer'
import type { CharacterId } from '@/components/characters/control/types'

function makeLabDocument(segments: SegmentBase[], title: string, hearts: number | null): LessonDocument {
  const cast = Array.from(
    new Set(segments.map((s) => s.narrator?.character).filter((c): c is CharacterId => Boolean(c))),
  )
  return {
    schema_version: 1,
    meta: {
      slug: 'lesson-lab',
      title,
      locale: 'es-MX',
      subject: 'mixed',
      estimated_minutes: Math.max(1, Math.min(30, segments.length)),
      objectives: ['Probar el motor de lecciones'],
      cast: cast.length > 0 ? cast : ['dina'],
    },
    scoring: { pass_threshold: 70, hint_penalty_pct: 10, max_attempts: 2, hearts },
    segments,
  }
}

export function LessonLabPage() {
  const { t } = useTranslation()
  const [active, setActive] = useState<LessonDocument | null>(null)
  const [hearts, setHearts] = useState<number | null>(null)

  const families = useMemo(() => Object.entries(FIXTURES_BY_FAMILY), [])
  const allFixtures = useMemo(() => families.flatMap(([, fixtures]) => fixtures), [families])

  if (active) {
    return (
      <LessonPlayer
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
          <div className="flex items-center gap-3">
            {/* Standalone route (no app shell) — the lab applies the theme itself. */}
            <ThemeToggle />
            <button
              type="button"
              onClick={() => setHearts((h) => (h === null ? 3 : null))}
              aria-pressed={hearts !== null}
              className="flex min-h-11 items-center gap-2 rounded-full border-2 border-outline/70 bg-surface px-4 lf-label text-content transition-colors hover:border-primary/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
            >
              <Icon name="favorite" fill className={hearts !== null ? 'text-error-strong' : 'text-content-faint'} />
              {hearts !== null ? t('lesson.lab.heartsOn') : t('lesson.lab.heartsOff')}
            </button>
            <Button
              variant="primary"
              onClick={() => setActive(makeLabDocument(allFixtures, 'Engine Showcase', hearts))}
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
                onClick={() =>
                  setActive(makeLabDocument(fixtures, `Familia: ${family}`, hearts))
                }
              >
                {t('lesson.lab.playFamily')}
              </Button>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {fixtures.map((fixture) => (
                <Card key={fixture.id}>
                  <button
                    type="button"
                    onClick={() => setActive(makeLabDocument([fixture], fixture.type, hearts))}
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
