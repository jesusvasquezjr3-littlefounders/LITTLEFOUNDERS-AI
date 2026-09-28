// /dev/lesson-view — DEV-ONLY viewer for REAL generated lessons (not the
// hand-written lab fixtures). It loads documents exported from the DB into
// `public/dev-lessons/` and plays each through the SAME LessonPlayer the
// production learn route uses, so a reviewer sees exactly what a child sees.
// Dev-gated in App.tsx; never ships to production.

import { useEffect, useMemo, useState } from 'react'
import { Badge, Button, Card } from '@/components/ui'
import type { LessonDocument } from '../core/types'
import { stripAnswers } from '../core/strip'
import { createLocalGrader } from './localGrader'
import LessonPlayer from '../player/LessonPlayer'
import type { AudioManifest } from '../player/narration'
// Development lab: it renders with the legacy global sheet, which the product entry no longer loads.
import '@/index.css';

interface IndexEntry {
  slug: string
  title: string
  locale: string
  types: string[]
}
interface LoadedLesson {
  document: LessonDocument
  audio?: AudioManifest
}

export function LessonViewPage() {
  const [index, setIndex] = useState<IndexEntry[] | null>(null)
  const [active, setActive] = useState<LoadedLesson | null>(null)
  const [locale, setLocale] = useState('es-MX')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void fetch('/dev-lessons/index.json')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`index ${r.status}`))))
      .then(setIndex)
      .catch((e) => setError(String(e)))
  }, [])

  const byLocale = useMemo(() => (index ?? []).filter((e) => e.locale === locale), [index, locale])
  const locales = useMemo(() => Array.from(new Set((index ?? []).map((e) => e.locale))), [index])

  async function open(slug: string) {
    setError(null)
    try {
      const res = await fetch(`/dev-lessons/${slug}.${locale}.json`)
      if (!res.ok) throw new Error(`lesson ${res.status}`)
      const data = (await res.json()) as LoadedLesson
      setActive(data)
    } catch (e) {
      setError(String(e))
    }
  }

  if (active) {
    return (
      <LessonPlayer
        document={stripAnswers(active.document)}
        grader={createLocalGrader(active.document)}
        audio={active.audio ?? {}}
        onExit={() => setActive(null)}
        onComplete={(r) => console.info('[lesson-view] complete', r)}
      />
    )
  }

  return (
    <div className="min-h-screen bg-base">
      <div className="mx-auto max-w-container px-5 py-10 md:px-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="lf-display-lg text-content">Generated Lessons</h1>
            <p className="lf-body text-content-muted">Real DB content rendered in the production player · {byLocale.length} lessons</p>
          </div>
          <div className="flex items-center gap-2">
            {locales.map((l) => (
              <Button key={l} variant={l === locale ? 'primary' : 'secondary'} onClick={() => setLocale(l)}>
                {l}
              </Button>
            ))}
          </div>
        </div>
        {error ? <p className="mb-4 lf-body text-error-strong">Error: {error}. Run the dev-lessons export first.</p> : null}
        {!index ? <p className="lf-body text-content-muted">Loading…</p> : null}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {byLocale.map((e) => (
            <Card key={e.slug}>
              <button
                type="button"
                onClick={() => void open(e.slug)}
                className="flex w-full flex-col items-start gap-2 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
              >
                <p className="lf-title text-content">{e.slug}</p>
                <p className="lf-caption text-content-muted">{e.title}</p>
                <div className="flex flex-wrap gap-1">
                  {e.types.map((t) => (
                    <Badge key={t}>{t}</Badge>
                  ))}
                </div>
              </button>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}

export default LessonViewPage
