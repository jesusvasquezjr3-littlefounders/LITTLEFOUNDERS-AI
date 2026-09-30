// story_scene art sizing (production incident 2026-08-14).
//
// coursegen commissions `payload.art.image_url` from Prism with the
// `scene_anchor` purpose — a WIDE ~16:9 establishing illustration. The renderer
// used to place it in a 128px square (`h-32 w-32 object-contain`), which
// letterboxed a panorama down to roughly 128×72: the setting the picture exists
// to establish was unreadable. The `icon` fallback is a single Material glyph
// and must keep its glyph size, so the two paths genuinely differ.

import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { Eavesdrop, StoryDialogue, StoryScene } from './components'
import type { CharacterCue, ExerciseProps } from '../../core/types'

vi.mock('../../player/narration', () => ({
  narrationUnitId: (id: string, part: string) => `${id}:${part}`,
  useNarration: () => ({ playSequence: () => undefined, play: () => undefined }),
}))

function sceneProps(art: Record<string, unknown> | undefined): ExerciseProps {
  return {
    segment: {
      id: 'ss1',
      type: 'story_scene',
      prompt_md: 'El puesto abre',
      difficulty: 1,
      xp: 0,
      payload: { backdrop: 'base', body_md: 'Amanece.', ...(art ? { art } : {}) },
    },
  } as unknown as ExerciseProps
}

describe('StoryScene art', () => {
  it('renders an AI illustration full-width, not as a 128px square', () => {
    const { container } = render(
      <StoryScene {...sceneProps({ icon: 'storefront', tint: 'accent', image_url: 'https://depot.test/scene.webp' })} />,
    )

    const img = container.querySelector('img')
    expect(img).not.toBeNull()
    expect(img!.getAttribute('src')).toBe('https://depot.test/scene.webp')
    const className = img!.getAttribute('class') ?? ''
    expect(className).toContain('w-full')
    // §1.11: capped at both breakpoints so it frames rather than dominates.
    expect(className).toContain('max-h-52')
    expect(className).toContain('sm:max-h-64')
    expect(className).not.toContain('h-32')
    expect(className).not.toContain('w-32')
  })

  it('keeps the icon fallback at glyph size when there is no illustration', () => {
    const { container } = render(<StoryScene {...sceneProps({ icon: 'storefront', tint: 'accent' })} />)

    expect(container.querySelector('img')).toBeNull()
    expect(container.innerHTML).toContain('text-[64px]')
  })

  it('renders no art slot at all when the segment has none', () => {
    const { container } = render(<StoryScene {...sceneProps(undefined)} />)
    expect(container.querySelector('img')).toBeNull()
  })
})

/*
 * THE STAGE CUE (LESSON_ENGINE.md §9.1, tutor-review-sweep-92, HIGH).
 *
 * `story_dialogue`, `story_scene` and `eavesdrop` are the only three types
 * that draw a `CharacterActor3D` directly in their own JSX (every other
 * segment either draws none, or is outside the `story` family entirely). On
 * the Tutor's live activity plate there is no `CharacterLayerProvider`
 * anywhere above these renderers (`LiveSegmentPanel.tsx`) — mounting one
 * there would need a second WebGL context or would render behind the
 * plate's own Lumen glass (see `CharacterCue`'s own doc comment). So a host
 * with nowhere honest to draw the character passes `onCharacterCue`, and
 * these three renderers MUST NOT fall back to the flat 2D rig when it is
 * present: they suppress their own `CharacterActor3D` entirely and hand the
 * character to the host instead.
 *
 * These tests pin BOTH halves at once — no `CharacterActor3D` output
 * anywhere in the render (`[data-character]`, the attribute every 2D-or-3D
 * character carries per `CharacterLayer.tsx`), AND the cue fired with the
 * right character — because either half alone is not the fix: suppressing
 * without firing is a silent hole where a character used to be, and firing
 * without suppressing is the ORIGINAL defect wearing a cue nobody reads.
 */
describe('story family renderers hand their character to a host with no character layer', () => {
  function dialogueProps(onCharacterCue?: (cue: CharacterCue | null) => void): ExerciseProps {
    return {
      segment: {
        id: 'sd1',
        type: 'story_dialogue',
        prompt_md: '',
        difficulty: 1,
        xp: 0,
        payload: {
          lines: [
            { character: 'rho', emotion: 'happy', action: 'wave', text_md: 'Line one.' },
            { character: 'zara', emotion: 'excited', action: 'point', text_md: 'Line two.' },
          ],
        },
      },
      value: undefined,
      onChange: () => undefined,
      disabled: false,
      onCharacterCue,
    } as unknown as ExerciseProps
  }

  it('story_dialogue: suppresses its own character and cues the host with each line, in order, then releases it', () => {
    const cue = vi.fn()
    render(<StoryDialogue {...dialogueProps(cue)} />)

    // No character rendered by this component at all — 2D or 3D.
    expect(screen.queryByText('Line one.')).toBeInTheDocument()
    expect(document.querySelector('[data-character]')).toBeNull()

    expect(cue).toHaveBeenCalledWith({
      character: 'rho',
      emotion: 'happy',
      action: 'wave',
      actionKey: 0,
      speaking: true,
    })

    cue.mockClear()
    fireEvent.click(screen.getByRole('button', { name: 'Tap to continue the story' }))

    // The FIRST line's cue is released (React's cleanup) before the second
    // line's is set — a host driving a single on-stage slot from this must
    // never hold two speakers' cues live at once.
    expect(cue.mock.calls[0]?.[0]).toBeNull()
    expect(cue).toHaveBeenLastCalledWith({
      character: 'zara',
      emotion: 'excited',
      action: 'point',
      actionKey: 1,
      speaking: true,
    })
    expect(document.querySelector('[data-character]')).toBeNull()

    cue.mockClear()
    fireEvent.click(screen.getByRole('button', { name: 'Tap to continue the story' }))
    // The dialogue finished: the stage is handed back and nothing new is cued.
    expect(cue).toHaveBeenCalledWith(null)
    expect(cue).not.toHaveBeenCalledWith(expect.objectContaining({ character: expect.anything() }))
  })

  it('story_dialogue: draws its own character exactly as before when no host cue is listening', () => {
    // The course player never passes `onCharacterCue` — this is its
    // unmodified path, proven unmodified. `CharacterLayerProvider` (course
    // player) is not mounted in this isolated render either, so the SAME still
    // fallback `CharacterLayer.test.tsx` already pins for that caller is the
    // right thing to see here too — the point of this test is that adding
    // `onCharacterCue` to `ExerciseProps` changed nothing for a caller that
    // does not pass it.
    const { container } = render(<StoryDialogue {...dialogueProps(undefined)} />)
    expect(container.querySelector('[data-character="rho"]')).not.toBeNull()
    expect(container.querySelector('[data-render="still"]')).not.toBeNull()
  })

  it('story_scene: cues the host once for its single character and suppresses its own', () => {
    const cue = vi.fn()
    const props = {
      segment: {
        id: 'ss2',
        type: 'story_scene',
        prompt_md: '',
        difficulty: 1,
        xp: 0,
        payload: {
          backdrop: 'base',
          body_md: 'Amanece.',
          character: 'dina',
          emotion: 'proud',
          action: 'bow',
        },
      },
      value: undefined,
      onChange: () => undefined,
      disabled: false,
      onCharacterCue: cue,
    } as unknown as ExerciseProps

    render(<StoryScene {...props} />)

    expect(document.querySelector('[data-character]')).toBeNull()
    expect(cue).toHaveBeenCalledWith({
      character: 'dina',
      emotion: 'proud',
      action: 'bow',
      actionKey: 0,
      speaking: true,
    })
  })

  function eavesdropProps(onCharacterCue?: (cue: CharacterCue | null) => void): ExerciseProps {
    return {
      segment: {
        id: 'ed1',
        type: 'eavesdrop',
        prompt_md: '',
        difficulty: 1,
        xp: 0,
        payload: {
          context_md: 'Two friends talk at the market.',
          lines: [
            { character: 'liruf', emotion: 'thinking', text_md: 'First line.' },
            { character: 'zara', emotion: 'happy', text_md: 'Second line.' },
          ],
        },
      },
      value: undefined,
      onChange: () => undefined,
      disabled: false,
      onCharacterCue,
    } as unknown as ExerciseProps
  }

  it('eavesdrop: cues only the CURRENTLY revealed speaker, and none of the past lines render their own character', () => {
    const cue = vi.fn()
    render(<Eavesdrop {...eavesdropProps(cue)} />)

    expect(document.querySelector('[data-character]')).toBeNull()
    expect(cue).toHaveBeenCalledWith({
      character: 'liruf',
      emotion: 'thinking',
      action: 'idle',
      actionKey: 1,
      speaking: true,
    })

    cue.mockClear()
    // Two lines total, one revealed: the footer button reads "Keep
    // listening" until the LAST line is up, then "Continue".
    fireEvent.click(screen.getByText('Keep listening'))

    expect(document.querySelector('[data-character]')).toBeNull()
    expect(cue.mock.calls[0]?.[0]).toBeNull()
    expect(cue).toHaveBeenLastCalledWith({
      character: 'zara',
      emotion: 'happy',
      action: 'idle',
      actionKey: 2,
      speaking: true,
    })
  })
})
