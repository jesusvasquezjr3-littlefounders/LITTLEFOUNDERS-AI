// story_scene art sizing (production incident 2026-08-14).
//
// coursegen commissions `payload.art.image_url` from Prism with the
// `scene_anchor` purpose — a WIDE ~16:9 establishing illustration. The renderer
// used to place it in a 128px square (`h-32 w-32 object-contain`), which
// letterboxed a panorama down to roughly 128×72: the setting the picture exists
// to establish was unreadable. The `icon` fallback is a single Material glyph
// and must keep its glyph size, so the two paths genuinely differ.

import { describe, expect, it, vi } from 'vitest'
import { render } from '@testing-library/react'
import { StoryScene } from './components'
import type { ExerciseProps } from '../../core/types'

vi.mock('../../player/narration', () => ({
  narrationUnitId: (id: string, part: string) => `${id}:${part}`,
  useNarration: () => ({ playSequence: () => undefined }),
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
