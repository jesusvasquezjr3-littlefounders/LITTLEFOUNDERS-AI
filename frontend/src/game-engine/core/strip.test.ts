import { stripValidation } from './strip'
import type { GameDocument, GameValidation } from './types'

/** A minimal but complete client document. Mechanic-specific `config`/`content`
 *  extras are deliberately thin: the stripper is mechanic-agnostic. */
const cleanDocument: GameDocument = {
  schema_version: 1,
  meta: {
    slug: 'market-sorter',
    title: 'Ordena el mercado',
    locale: 'es-MX',
    mechanic: 'sorter',
    concept: {
      topic_path: 'mi-primer-negocio/precios/costo-vs-precio',
      recap_md: 'Un **costo** es lo que pagas; un **precio** es lo que cobras.',
    },
    tier: 2,
    estimated_minutes: 3,
    cast: ['dina'],
  },
  skin: {
    palette: 'navy-papaya',
    sprites: { crate: 'https://depot.example/sprites/crate.webp' },
    sfx: { pick: 'collect' },
  },
  config: { rounds: 3 },
  content: {
    items: [{ id: 'apple', label_md: 'Manzana', category: 'cost', image_slot: 'crate' }],
    categories: [{ id: 'cost', label_md: 'Costo' }],
    feedback: {
      correct_md: ['¡Va!'],
      incorrect_md: ['Casi. Mira el precio otra vez.'],
      results_md: 'Ya distingues costo de precio.',
    },
  },
  scoring: { mode: 'arcade', xp_max: 10, pass_score: 70, lives: 3 },
}

const sidecar: GameValidation = {
  max_score: 100,
  min_duration_seconds: 20,
  max_events: 400,
  item_values: { apple: 12 },
}

describe('stripValidation', () => {
  it('removes a validation sidecar that leaked onto the document', () => {
    const leaked = { ...cleanDocument, validation: sidecar }

    const stripped = stripValidation(leaked)

    expect('validation' in stripped).toBe(false)
    expect(Object.keys(stripped)).not.toContain('validation')
    expect(JSON.stringify(stripped)).not.toContain('max_events')
    // Everything else survives untouched.
    expect(stripped).toEqual(cleanDocument)
  })

  it('does not mutate the document it was given', () => {
    const leaked: GameDocument & { validation?: unknown } = {
      ...cleanDocument,
      validation: sidecar,
    }

    stripValidation(leaked)

    expect(leaked.validation).toEqual(sidecar)
  })

  it('returns an already-clean document unchanged and structurally equal', () => {
    const stripped = stripValidation(cleanDocument)

    expect(stripped).toEqual(cleanDocument)
    expect(Object.keys(stripped)).toEqual(Object.keys(cleanDocument))
    // A copy, never the same reference — callers may serialize it independently.
    expect(stripped).not.toBe(cleanDocument)
  })
})
