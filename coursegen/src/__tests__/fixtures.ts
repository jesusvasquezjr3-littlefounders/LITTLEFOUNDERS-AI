// Shared test fixtures — NOT a test file itself (vitest only picks up
// `*.test.ts`), just builders reused across the suite.

import type { LessonDocumentParsed } from '../contract/schema.js';
import type { TaxonomyFile, FactsFile } from '../catalog/schema.js';

export function baseSegments() {
  return [
    {
      id: 's1',
      type: 'story_scene' as const,
      prompt_md: 'Bienvenido a la aventura.',
      difficulty: 1 as const,
      xp: 0,
      payload: { backdrop: 'base' as const, body_md: 'Había una vez una isla llena de monedas.' },
    },
    {
      id: 's2',
      type: 'quiz_mcq' as const,
      prompt_md: '¿Cuánto es 2 más 2?',
      difficulty: 1 as const,
      xp: 10,
      payload: {
        options: [
          { id: 'o1', text_md: '4' },
          { id: 'o2', text_md: '5', rationale_md: 'Casi — revisa la suma otra vez.' },
        ],
      },
      answer: { correct_option_id: 'o1' },
    },
    {
      id: 's3',
      type: 'true_false' as const,
      prompt_md: 'El sol es una estrella.',
      difficulty: 1 as const,
      xp: 10,
      payload: { statement_md: 'El sol es una estrella.' },
      answer: { is_true: true },
    },
    {
      id: 's4',
      type: 'match_pairs' as const,
      prompt_md: 'Empareja las monedas con su valor.',
      difficulty: 2 as const,
      xp: 15,
      payload: {
        left: [
          { id: 'l1', text_md: 'Moneda de 1' },
          { id: 'l2', text_md: 'Moneda de 2' },
        ],
        right: [
          { id: 'r1', text_md: '$1' },
          { id: 'r2', text_md: '$2' },
        ],
      },
      answer: {
        pairs: [
          ['l1', 'r1'],
          ['l2', 'r2'],
        ],
      },
    },
    {
      id: 's5',
      type: 'needs_wants' as const,
      prompt_md: 'Clasifica lo que es necesidad.',
      difficulty: 2 as const,
      xp: 15,
      payload: {
        items: [
          { id: 'i1', text_md: 'Comida' },
          { id: 'i2', text_md: 'Juguete' },
          { id: 'i3', text_md: 'Agua' },
          { id: 'i4', text_md: 'Videojuego' },
        ],
      },
      answer: { needs_ids: ['i1', 'i3'] },
    },
    {
      id: 's6',
      type: 'sort_buckets' as const,
      prompt_md: 'Ordena los objetos.',
      difficulty: 2 as const,
      xp: 15,
      payload: {
        buckets: [
          { id: 'b1', label: 'Ahorrar' },
          { id: 'b2', label: 'Gastar' },
        ],
        items: [
          { id: 'i1', text_md: 'Alcancía' },
          { id: 'i2', text_md: 'Dulce' },
          { id: 'i3', text_md: 'Libro' },
          { id: 'i4', text_md: 'Paleta' },
        ],
      },
      answer: { assignments: { i1: 'b1', i2: 'b2', i3: 'b1', i4: 'b2' } },
    },
  ];
}

export function buildDocument(overrides: Partial<LessonDocumentParsed> = {}): LessonDocumentParsed {
  return {
    schema_version: 1,
    meta: {
      slug: 'test-lesson',
      title: 'Lección de prueba',
      locale: 'es-MX',
      subject: 'money',
      estimated_minutes: 5,
      objectives: ['Aprender a contar monedas'],
      cast: ['dina'],
    },
    scoring: {
      pass_threshold: 70,
      hint_penalty_pct: 10,
      max_attempts: 2,
      hearts: null,
    },
    segments: baseSegments(),
    ...overrides,
  } as LessonDocumentParsed;
}

export function buildTaxonomy(overrides: Partial<TaxonomyFile> = {}): TaxonomyFile {
  return {
    schema_version: 1,
    themes: ['archipelago', 'forest'],
    age_tiers: {
      tier1: {
        ages: '6-7',
        forbidden_vocabulary: {
          'es-MX': ['interés compuesto', 'préstamo'],
          'en-US': ['compound interest', 'loan'],
          'pt-BR': ['juros compostos', 'empréstimo'],
        },
      },
      tier2: {
        ages: '8-10',
        forbidden_vocabulary: {
          'es-MX': ['hipoteca'],
          'en-US': ['mortgage'],
          'pt-BR': ['hipoteca'],
        },
      },
    },
    families: ['story', 'choice', 'input', 'arrange', 'money', 'analyze', 'storyplay', 'maker'],
    family_allowlist_by_tier: {
      tier1: ['story', 'choice', 'input', 'arrange', 'money', 'storyplay'],
      tier2: ['story', 'choice', 'input', 'arrange', 'money', 'analyze', 'storyplay', 'maker'],
    },
    type_exceptions: {
      tier1_extra_allowed: ['pattern_complete', 'robot_path'],
      tier1_banned_types: ['confidence_quiz', 'interest_peek'],
    },
    ...overrides,
  };
}

export function buildFacts(overrides: Partial<FactsFile> = {}): FactsFile {
  return {
    schema_version: 1,
    facts: {
      'mxn.denominations.coins.tier1_subset': {
        value: [1, 2, 5, 10],
        unit: 'MXN',
        verified: true,
      },
      'mxn.denominations.bills.tier1_subset': {
        value: [20, 50, 100],
        unit: 'MXN',
        verified: true,
      },
      'mxn.reference_prices.paleta': {
        value: 15,
        range: [10, 20],
        unit: 'MXN',
        verified: false,
        enforce: false,
      },
      'characters.canon_ids': {
        value: ['dina', 'liruf', 'rho', 'zara'],
        unit: 'n/a',
        verified: true,
      },
      'characters.roles': {
        value: { dina: 'mentora', liruf: 'juguetón' },
        unit: 'n/a',
        verified: true,
      },
      ...overrides.facts,
    },
  };
}
