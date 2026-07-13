// Registry-completeness gate (LESSON_ENGINE.md §11): every declared type is
// registered, every input type can gate submission, every graded type has a
// grader, every fixture round-trips through its grader without throwing.

import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { ALL_TYPES, FIXTURES_BY_FAMILY, GRADERS, REGISTRY, getRegistryEntry } from './registry'
import { lessonDocumentSchema } from './schema'
import { stripAnswers } from './core/strip'
import type { LessonDocument } from './core/types'
import MarkdownLite from './core/MarkdownLite'

const ALL_FIXTURES = Object.values(FIXTURES_BY_FAMILY).flat()

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
