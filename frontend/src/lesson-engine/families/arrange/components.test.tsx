// sort_buckets group buttons — accessible name (production incident 2026-09-01).
//
// Live-testing found the two/three group boxes in the Tutor's drag-and-drop
// sorting activity carried neither `aria-label` nor `title`, confirmed by
// `document.querySelectorAll('button')` + `getAttribute` checks that came
// back null on every one. A screen-reader user tabbing onto a bucket heard
// nothing that said which group it was. `zone.label` is real, non-empty
// text (Zod's `idLabel` enforces `min(1)`), so the browser's name-from-
// content rule was never actually silent — the accessible name WAS the bare
// category word ("Save", "Spend"...). That is thinner than it looks: out of
// context, "Save, button" does not say this is a place you PUT something,
// the way the grid of boxes and the on-screen instruction do for a sighted
// learner. This asserts the richer, data-sourced label a screen reader
// actually needs, not merely that SOME name exists.

import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SortBuckets } from './components'
import type { ExerciseProps } from '../../core/types'

function segmentWithBuckets(buckets: Array<{ id: string; label: string }>): ExerciseProps {
  return {
    segment: {
      id: 'fx-sort-buckets-a11y',
      type: 'sort_buckets',
      prompt_md: 'Sort each one.',
      difficulty: 2,
      xp: 15,
      payload: {
        buckets,
        items: [
          { id: 'i1', text_md: 'Drop coins in the piggy bank' },
          { id: 'i2', text_md: 'Give $5 to the dog shelter' },
        ],
      },
    },
    value: undefined,
    onChange: vi.fn(),
    disabled: false,
    verdict: null,
  } as unknown as ExerciseProps
}

describe('SortBuckets group buttons', () => {
  it('gives every group button an accessible name sourced from the segment, not hardcoded English', () => {
    // Spanish labels, on purpose: an aria-label that happened to be a
    // hardcoded English string would still "pass" a naive presence check
    // while lying to a Spanish-speaking learner about which group is which.
    render(<SortBuckets {...segmentWithBuckets([
      { id: 'ahorro', label: 'Ahorrar' },
      { id: 'gasto', label: 'Gastar' },
      { id: 'donar', label: 'Donar' },
    ])} />)

    for (const label of ['Ahorrar', 'Gastar', 'Donar']) {
      // `Group: {{label}}` (en-US chrome) around the segment's OWN word —
      // getByRole with a RegExp anchors on that word rather than demanding
      // the whole composed string, so this would catch the word going
      // missing without being coupled to the exact chrome phrasing.
      const button = screen.getByRole('button', { name: new RegExp(label) })
      expect(button).toBeInTheDocument()
    }
  })

  it('keeps the aria-label in sync when the button also shows a visible "place here" hint', () => {
    render(<SortBuckets {...segmentWithBuckets([
      { id: 'ahorro', label: 'Save' },
      { id: 'gasto', label: 'Spend' },
    ])} />)

    // Select an item first — this is the state that used to grow the extra
    // "Place here" text INSIDE the button's content, which the accessible
    // name is no longer built from (aria-label overrides content once set).
    screen.getByText('Drop coins in the piggy bank').click()

    const saveButton = screen.getByRole('button', { name: /Save/ })
    expect(saveButton.getAttribute('aria-label')).toBe('Group: Save')
  })

  it('has no accessible-name gap on any group button — the exact defect live-testing reported', () => {
    render(<SortBuckets {...segmentWithBuckets([
      { id: 'ahorro', label: 'Save' },
      { id: 'gasto', label: 'Spend' },
    ])} />)

    for (const zone of document.querySelectorAll('[data-dropzone] button')) {
      const ariaLabel = zone.getAttribute('aria-label')
      const title = zone.getAttribute('title')
      const text = zone.textContent?.trim() ?? ''
      // The reported defect was all three of these empty at once. Any ONE
      // of them being real content is a real accessible name; this fails
      // only in the exact all-null shape that was live-tested.
      expect(Boolean(ariaLabel) || Boolean(title) || text.length > 0).toBe(true)
      // The richer requirement this fix actually adds: a real aria-label,
      // not merely a fallback to the bare visible word.
      expect(ariaLabel).toBeTruthy()
    }
  })
})
