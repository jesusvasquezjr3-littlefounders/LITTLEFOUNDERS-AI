/**
 * ANSWER SURFACES — the guards for /DESIGN.md §Answer surfaces.
 *
 * Three of these are behavioural and the fourth is a SOURCE scan, and the
 * source scan is the one that matters most. The defect this material replaced
 * was not a bug in one component: it was one Tailwind recipe
 * (`border-2 border-outline/70 bg-surface`) copied by hand into about forty
 * places across eight families, which is exactly the shape of thing that comes
 * back one renderer at a time. A rule that lives only in a document is a rule
 * the next author re-derives; this one fails the build.
 */

import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { render } from '@testing-library/react'
import {
  AnswerMark,
  OptionCard,
  TokenChip,
  VerdictGlyph,
  optionStateClasses,
  type OptionVisualState,
} from './primitives'

// `..` from core/ — the whole lesson engine. `fileURLToPath` rather than
// `URL.pathname`, which on Windows yields `/C:/…` and scans a drive that is not
// there (and then passes, because a scan over zero files always does).
const ENGINE = resolve(dirname(fileURLToPath(import.meta.url)), '..')

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) return sources(full)
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [full] : []
  })
}

describe('the material is the only way to draw an answer', () => {
  const files = sources(ENGINE)

  it('finds the engine sources at all (a scan over zero files always passes)', () => {
    expect(files.length).toBeGreaterThan(20)
  })

  /**
   * The form-field recipe, in the two halves that produced it: an outline token
   * used as a visible border, and an opaque `surface`/`surface-sunken` fill
   * standing in for an object. Both come from the material now.
   */
  it('no renderer writes its own outline or its own opaque object fill', () => {
    const offenders: string[] = []
    for (const file of files) {
      readFileSync(file, 'utf8')
        .split('\n')
        .forEach((line, i) => {
          if (line.trimStart().startsWith('*') || line.trimStart().startsWith('//')) return
          if (/border-outline|\bbg-surface\b|bg-surface-sunken/.test(line)) {
            offenders.push(`${file.slice(ENGINE.length)}:${i + 1}  ${line.trim().slice(0, 100)}`)
          }
        })
    }
    expect(
      offenders,
      `these draw their own surface instead of using .lf-answer/.lf-slab/.lf-well:\n${offenders.join('\n')}`,
    ).toEqual([])
  })

  /**
   * LESSON_ENGINE.md §1 P3, in one line: "No red WRONG." The shared option card
   * painted `border-error bg-error-soft` on the learner's own pick for the
   * whole life of the primitives, on the most looked-at control in the product.
   */
  it('never paints a learner mistake in the error colour', () => {
    const offenders: string[] = []
    for (const file of files) {
      // `lab/` is the dev harness. A red line there is a FETCH that failed,
      // which is a real error and not a child's answer.
      if (/[\\/]lab[\\/]/.test(file)) continue
      readFileSync(file, 'utf8')
        .split('\n')
        .forEach((line, i) => {
          if (line.trimStart().startsWith('*') || line.trimStart().startsWith('//')) return
          // A heart is red because it is a heart. It counts lives remaining and
          // says nothing about whether the last answer was right.
          if (/hearts|favorite/.test(line)) return
          if (/\berror-soft\b|\bborder-error\b|\btext-error-strong\b/.test(line)) {
            offenders.push(`${file.slice(ENGINE.length)}:${i + 1}  ${line.trim().slice(0, 100)}`)
          }
        })
    }
    expect(offenders, `P3 forbids a red "wrong":\n${offenders.join('\n')}`).toEqual([])
  })

  it('every visual state resolves to the shared material', () => {
    const states: OptionVisualState[] = ['idle', 'selected', 'correct', 'wrong', 'dimmed']
    states.forEach((state) => expect(optionStateClasses(state)).toContain('lf-answer'))
    expect(optionStateClasses('selected')).toContain('lf-answer-selected')
    expect(optionStateClasses('correct')).toContain('lf-answer-correct')
    expect(optionStateClasses('wrong')).toContain('lf-answer-wrong')
  })
})

/**
 * THE OVERRIDE THAT CANNOT WIN.
 *
 * `cn()` concatenates; it is not `tailwind-merge`. So a class passed down to a
 * component whose base already sets that property is decided by CSS SOURCE
 * ORDER, and Tailwind emits `rounded-full` after `rounded-md`, `justify-center`
 * after `justify-start`, `min-h-12` after `min-h-9`. Three call sites had been
 * passing exactly those, and all three were silently dropped on the floor — one
 * of them visibly, as a capsule sitting where a square slot piece belonged.
 *
 * Nothing warns about this. A `className` that does nothing type-checks, lints,
 * passes every behavioural test, and reads in review as the thing it is not
 * doing. So the scan is the warning.
 */
describe('no renderer hands a shared control a class it cannot win with', () => {
  // The properties the shared controls set on themselves. A caller who needs a
  // different value needs a PROP (see `TokenShape`), never a class.
  const OWNED = /\b(rounded-(?:none|sm|md|lg|xl|2xl|3xl|full)|justify-(?:start|center|end|between)|min-h-\d+|text-(?:left|center|right))\b/
  const SHARED = ['TokenChip', 'OptionCard']

  it('every className handed to TokenChip / OptionCard can actually take effect', () => {
    const offenders: string[] = []
    for (const file of sources(ENGINE)) {
      const src = readFileSync(file, 'utf8')
      for (const tag of SHARED) {
        // Each JSX element opening, up to its `>`. Non-greedy, and `[^>]` keeps
        // it inside the one element.
        const re = new RegExp(`<${tag}\\b[^>]*>`, 'g')
        for (const m of src.matchAll(re)) {
          const attrs = m[0]
          const cls = /className=(?:"([^"]*)"|\{`([^`]*)`\}|\{'([^']*)'\})/.exec(attrs)
          const value = cls?.[1] ?? cls?.[2] ?? cls?.[3]
          if (!value) continue
          const hit = OWNED.exec(value)
          if (hit) {
            const line = src.slice(0, m.index).split('\n').length
            offenders.push(`${file.slice(ENGINE.length)}:${line}  <${tag} className="…${hit[1]}…">`)
          }
        }
      }
    }
    expect(
      offenders,
      `cn() is not tailwind-merge — these classes lose to the component's own base and do nothing.\n` +
        `Add a prop to the component instead:\n${offenders.join('\n')}`,
    ).toEqual([])
  })
})

describe('a chip seated in a slot is shaped like the slot', () => {
  it('the slot shape is square and left-aligned, and the pill is neither', () => {
    const { container: slot } = render(
      <TokenChip state="idle" shape="slot">
        step
      </TokenChip>,
    )
    const { container: pill } = render(<TokenChip state="idle">coin</TokenChip>)
    const slotClass = slot.querySelector('button')?.className ?? ''
    const pillClass = pill.querySelector('button')?.className ?? ''
    expect(slotClass).toContain('rounded-md')
    expect(slotClass).toContain('justify-start')
    expect(slotClass).not.toContain('rounded-full')
    expect(pillClass).toContain('rounded-full')
    expect(pillClass).not.toContain('rounded-md')
    // Both keep the floor whichever shape they take.
    expect(slotClass).toContain('min-h-12')
    expect(pillClass).toContain('min-h-12')
  })

  /**
   * The floor is on the TARGET, so it has two sides. A single-character chip
   * ("5", "+", "×") is padding around a 9 px glyph and measured 41 px across on
   * `equation_builder` and `balance_scale` — the two exercises made entirely of
   * single-character chips.
   */
  it('a one-character chip is still 48px wide', () => {
    const { container } = render(<TokenChip state="idle">5</TokenChip>)
    expect(container.querySelector('button')?.className).toContain('min-w-12')
  })
})

describe('state is never colour alone', () => {
  /**
   * A verdict a learner can only perceive as a hue is a verdict a colour-blind
   * child, a greyscale print and a phone in sunlight all miss. Every stated
   * option carries a SHAPE (the mark's glyph) and, on the two verdicts, a word
   * a screen reader will read out.
   */
  it('correct and wrong each carry a distinct glyph', () => {
    const { container: right } = render(<AnswerMark state="correct" />)
    const { container: wrong } = render(<AnswerMark state="wrong" />)
    expect(right.textContent).toContain('check')
    expect(wrong.textContent).toContain('close')
    expect(right.textContent).not.toBe(wrong.textContent)
  })

  it('correct and wrong each carry a word, and selected deliberately does not', () => {
    const { container: right } = render(<AnswerMark state="correct" />)
    const { container: wrong } = render(<AnswerMark state="wrong" />)
    const rightWord = right.querySelector('.sr-only')?.textContent ?? ''
    const wrongWord = wrong.querySelector('.sr-only')?.textContent ?? ''
    expect(rightWord.length).toBeGreaterThan(0)
    expect(wrongWord.length).toBeGreaterThan(0)
    expect(rightWord).not.toBe(wrongWord)
    // `aria-checked` already announces selection; a second word would make a
    // screen reader say it twice.
    const { container } = render(<AnswerMark state="selected" />)
    expect(container.querySelector('.sr-only')).toBeNull()
  })

  it('the compact glyph says the same two things', () => {
    const { container: right } = render(<VerdictGlyph state="correct" />)
    const { container: wrong } = render(<VerdictGlyph state="wrong" />)
    const { container: idle } = render(<VerdictGlyph state="idle" />)
    expect(right.textContent).toContain('check_circle')
    expect(wrong.textContent).toContain('cancel')
    expect(idle.textContent).toBe('')
  })

  it('a real choice prints a mark and a plain button does not', () => {
    const { container: radio } = render(
      <OptionCard role="radio" ariaChecked state="selected">
        x
      </OptionCard>,
    )
    const { container: plain } = render(<OptionCard state="selected">x</OptionCard>)
    expect(radio.querySelector('.lf-answer-mark-empty, .bg-primary')).not.toBeNull()
    expect(plain.querySelector('.lf-answer-mark-empty, .bg-primary')).toBeNull()
  })
})

describe('the tap floor', () => {
  /**
   * 48 px authored, not 44. /DESIGN.md §Answer surfaces: an answer option is
   * the control a child mis-taps most, and 44 is the floor rather than the
   * target — the same reasoning §Lumen applies to an anchored HUD plate, whose
   * depth scale shrinks it further still.
   */
  it('an option card is authored at 48px', () => {
    const { container } = render(<OptionCard state="idle">x</OptionCard>)
    expect(container.querySelector('button')?.className).toContain('min-h-12')
  })

  it('no renderer authors an interactive answer at the bare 44px floor', () => {
    const offenders: string[] = []
    for (const file of sources(ENGINE)) {
      readFileSync(file, 'utf8')
        .split('\n')
        .forEach((line, i) => {
          if (line.trimStart().startsWith('*') || line.trimStart().startsWith('//')) return
          if (/min-h-11\b/.test(line)) offenders.push(`${file.slice(ENGINE.length)}:${i + 1}  ${line.trim().slice(0, 100)}`)
        })
    }
    expect(offenders, `these author an answer at 44px:\n${offenders.join('\n')}`).toEqual([])
  })
})
