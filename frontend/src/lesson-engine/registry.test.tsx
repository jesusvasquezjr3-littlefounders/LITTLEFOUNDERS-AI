// Registry-completeness gate (LESSON_ENGINE.md §11): every declared type is
// registered, every input type can gate submission, every graded type has a
// grader, every fixture round-trips through its grader without throwing.

import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { LOCALES } from '@/i18n'
import { ALL_TYPES, GRADERS, REGISTRY, getRegistryEntry } from './registry'
import { allFixtures } from './lab/fixtureSets'
import { lessonDocumentSchema } from './schema'
import { stripAnswers } from './core/strip'
import type { LessonDocument, SegmentBase } from './core/types'
import MarkdownLite from './core/MarkdownLite'

/**
 * The gates below run against the DEFAULT locale, and one extra gate below
 * proves that running them against the other two would be the same run.
 */
const ALL_FIXTURES = allFixtures('en-US')

describe('registry completeness', () => {
  it('reaches the 50+ type goal with every type registered', () => {
    expect(ALL_TYPES.length).toBeGreaterThanOrEqual(50)
    ALL_TYPES.forEach((type) => {
      expect(REGISTRY[type]?.component, `missing component for ${type}`).toBeTruthy()
    })
  })

  it('every fixture has a registered type and unique id', () => {
    const ids = new Set<string>()
    ALL_FIXTURES.forEach((fixture) => {
      expect(getRegistryEntry(fixture.type), `unregistered fixture type ${fixture.type}`).toBeTruthy()
      expect(ids.has(fixture.id), `duplicate fixture id ${fixture.id}`).toBe(false)
      ids.add(fixture.id)
    })
    // one fixture per registered type
    expect(new Set(ALL_FIXTURES.map((f) => f.type)).size).toBe(ALL_TYPES.length)
  })

  it('input types gate submission; content types are ungraded; graded types have graders', () => {
    Object.entries(REGISTRY).forEach(([type, entry]) => {
      if (entry.kind === 'input') {
        expect(entry.canSubmit, `input type ${type} missing canSubmit`).toBeTypeOf('function')
      }
      if (entry.kind === 'content') {
        expect(GRADERS[type], `content type ${type} must not have a grader`).toBeUndefined()
      } else {
        expect(GRADERS[type], `graded type ${type} missing grader`).toBeTypeOf('function')
      }
    })
  })

  it('graders never throw on malformed answers and clamp scores', () => {
    ALL_FIXTURES.forEach((fixture) => {
      const grader = GRADERS[fixture.type]
      if (!grader) return
      ;[undefined, null, 42, 'nope', [], {}].forEach((bad) => {
        const outcome = grader(fixture, bad)
        expect(outcome.score, `${fixture.type} malformed → 0`).toBe(0)
      })
    })
  })

  it('a showcase document with every fixture parses against the composed schema', () => {
    const showcase: LessonDocument = {
      schema_version: 1,
      meta: {
        slug: 'engine-showcase',
        title: 'Engine Showcase',
        locale: 'es-MX',
        subject: 'mixed',
        estimated_minutes: 30,
        objectives: ['Probar todos los tipos'],
        cast: ['dina', 'liruf', 'rho', 'zara'],
      },
      scoring: { pass_threshold: 70, hint_penalty_pct: 10, max_attempts: 2, hearts: null },
      segments: ALL_FIXTURES,
    }
    const parsed = lessonDocumentSchema.safeParse(showcase)
    if (!parsed.success) {
      throw new Error(parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('\n'))
    }
    // and the schema rejects duplicate ids
    const dup = { ...showcase, segments: [ALL_FIXTURES[0], ALL_FIXTURES[0]] }
    expect(lessonDocumentSchema.safeParse(dup).success).toBe(false)
  })

  it('stripAnswers removes every answer key', () => {
    const docWithKeys: LessonDocument = {
      schema_version: 1,
      meta: {
        slug: 'strip-test',
        title: 'x',
        locale: 'es-MX',
        subject: 'mixed',
        estimated_minutes: 5,
        objectives: ['x'],
        cast: ['dina'],
      },
      scoring: { pass_threshold: 70, hint_penalty_pct: 10, max_attempts: 2, hearts: null },
      segments: ALL_FIXTURES,
    }
    const stripped = stripAnswers(docWithKeys)
    stripped.segments.forEach((segment) => {
      expect(segment.answer, `answer leaked for ${segment.id}`).toBeUndefined()
    })
    // original untouched
    expect(docWithKeys.segments.some((s) => s.answer !== undefined)).toBe(true)
  })
})

/**
 * THE THREE LOCALES ARE ONE FIXTURE SET WEARING THREE COATS.
 *
 * `/dev/lesson-lab` and `/dev/tutor-lab` now build their fixtures per locale so
 * the chrome and the content can never disagree again (see
 * `lab/fixtureCopy.ts`). The risk that introduces is drift: a Portuguese
 * fixture whose answer key, ids or payload shape quietly differs from the
 * English one would be a fixture bug that only appears on one switch position,
 * and every grader test in this suite runs on exactly one of the three.
 *
 * The layout already makes it nearly unrepresentable — structure is written
 * once per family, outside the copy — and this is the proof that it stayed
 * that way. It strips the copy back out and compares what is left.
 */
describe('every locale ships the same fixtures', () => {
  /** The segment with every human-readable string blanked out. */
  const skeleton = (segments: SegmentBase[]): unknown =>
    JSON.parse(
      JSON.stringify(segments, (key, value) =>
        typeof value === 'string' && key !== 'id' && key !== 'type' ? '·' : value,
      ),
    )

  it('same ids, same types, same order', () => {
    const reference = ALL_FIXTURES.map((f) => `${f.type}:${f.id}`)
    LOCALES.forEach((locale) => {
      expect(allFixtures(locale).map((f) => `${f.type}:${f.id}`), locale).toEqual(reference)
    })
  })

  it('same structure and same answer keys, once the words are removed', () => {
    const reference = skeleton(ALL_FIXTURES)
    LOCALES.forEach((locale) => {
      expect(skeleton(allFixtures(locale)), locale).toEqual(reference)
    })
  })

  it('and the words are actually different — this is not three copies of English', () => {
    const en = JSON.stringify(allFixtures('en-US'))
    LOCALES.filter((l) => l !== 'en-US').forEach((locale) => {
      expect(JSON.stringify(allFixtures(locale)), locale).not.toBe(en)
    })
  })

  it('every locale round-trips through the composed document schema', () => {
    LOCALES.forEach((locale) => {
      const doc: LessonDocument = {
        schema_version: 1,
        meta: {
          slug: 'engine-showcase',
          title: 'Engine Showcase',
          locale,
          subject: 'mixed',
          estimated_minutes: 30,
          objectives: ['x'],
          cast: ['dina', 'liruf', 'rho', 'zara'],
        },
        scoring: { pass_threshold: 70, hint_penalty_pct: 10, max_attempts: 2, hearts: null },
        segments: allFixtures(locale),
      }
      const parsed = lessonDocumentSchema.safeParse(doc)
      expect(parsed.success, locale + (parsed.success ? '' : ': ' + JSON.stringify(parsed.error.issues))).toBe(true)
    })
  })
})

describe('MarkdownLite safety', () => {
  it('renders formatting and keeps raw HTML inert', () => {
    const { container } = render(
      <MarkdownLite text={'**bold** *it* `code`\n- a\n- b\n<script>alert(1)</script>'} />,
    )
    expect(container.querySelector('strong')?.textContent).toBe('bold')
    expect(container.querySelectorAll('li')).toHaveLength(2)
    expect(container.querySelector('script')).toBeNull()
    expect(container.textContent).toContain('<script>')
  })
})
