// `story` family — one demo segment per type for /dev/lesson-lab (es-MX content).
// Fixtures are dev data, not UI strings; lesson documents are single-locale (§3).
// Content types are ungraded and carry xp: 0 (LESSON_ENGINE.md §3, §5.1).

import type { SegmentBase } from '../../core/types'

export const storyFixtures: SegmentBase[] = [
  {
    id: 'fx-story-dialogue',
    type: 'story_dialogue',
    prompt_md: 'La gran idea de la limonada',
    difficulty: 1,
    xp: 0,
    narrator: { character: 'dina', emotion: 'happy' },
    payload: {
      lines: [
        {
          character: 'liruf',
          emotion: 'excited',
          action: 'jump',
          text_md: '¡Dina, Dina! Encontré **$20** limpiando mi cuarto. ¡Voy a comprar dulces AHORA!',
        },
        {
          character: 'dina',
          emotion: 'encouraging',
          action: 'wave',
          text_md:
            'Espera, Liruf… ¿y si esos $20 trabajaran **para ti**? Con ellos podrías empezar un negocito.',
        },
        {
          character: 'liruf',
          emotion: 'thinking',
          action: 'think',
          text_md: '¿Un negocio con $20? Mmm… ¿como cuál?',
        },
        {
          character: 'rho',
          emotion: 'thinking',
          action: 'point',
          text_md:
            'Según mis mapas, con $20 compras limones y azúcar para **20 vasos** de limonada. Si vendes cada vaso a $5… haz la cuenta.',
        },
        {
          character: 'zara',
          emotion: 'excited',
          action: 'celebrate',
          text_md:
            '¡Serían **$100**! Eso se llama *invertir*: usar tu dinero para ganar más. ¡Manos a la obra!',
        },
      ],
    },
  },
  {
    id: 'fx-story-scene',
    type: 'story_scene',
    prompt_md: 'El puesto abre sus puertas',
    difficulty: 1,
    xp: 0,
    payload: {
      backdrop: 'band',
      character: 'liruf',
      emotion: 'proud',
      action: 'bow',
      body_md:
        'Sábado por la mañana. Liruf cuelga su cartel: **Limonada Liruf — $5 el vaso**.\nSu primera clienta ya viene caminando con una moneda brillante…',
      art: { icon: 'storefront', tint: 'accent' },
    },
  },
  {
    id: 'fx-key-ideas',
    type: 'key_ideas',
    prompt_md: 'Lo que nos enseñó el puesto de limonada',
    difficulty: 1,
    xp: 0,
    narrator: { character: 'rho', emotion: 'happy' },
    payload: {
      ideas: [
        {
          icon: 'savings',
          title: 'Invertir',
          body_md:
            'Usar tu dinero para **ganar más** después, como comprar limones para vender limonada.',
        },
        {
          icon: 'payments',
          title: 'Costo',
          body_md: 'Lo que pagas para empezar: los **$20** de limones y azúcar.',
        },
        {
          icon: 'trending_up',
          title: 'Ganancia',
          body_md: 'Lo que te queda después de pagar tus costos: **$100 − $20 = $80**.',
        },
      ],
    },
  },
  {
    id: 'fx-concept-reveal',
    type: 'concept_reveal',
    prompt_md: 'Toca cada tarjeta para descubrir su secreto',
    difficulty: 2,
    xp: 0,
    narrator: { character: 'zara', emotion: 'thinking' },
    payload: {
      cards: [
        {
          icon: 'lightbulb',
          front_md: '¿Qué es un **emprendedor**?',
          back_md:
            'Alguien que ve un problema y crea una **idea** para resolverlo… ¡como vender limonada en un día de calor!',
        },
        {
          icon: 'sell',
          front_md: '¿Qué es el **precio**?',
          back_md:
            'El dinero que pides por tu producto. Muy alto y nadie compra; muy bajo y no ganas.',
        },
        {
          icon: 'group',
          front_md: '¿Quiénes son los **clientes**?',
          back_md: 'Las personas que compran lo que vendes. ¡Cuídalos y volverán por más!',
        },
      ],
    },
  },
  {
    id: 'fx-checkpoint',
    type: 'checkpoint',
    prompt_md: 'Respira hondo, socio. ¿Cómo vamos?',
    difficulty: 1,
    xp: 0,
    narrator: { character: 'dina', emotion: 'encouraging' },
    payload: {
      recap_md:
        'Hasta ahora:\n- **Invertimos** $20 en limones y azúcar.\n- Vendimos 20 vasos a **$5** cada uno.\n- Nuestra **ganancia** fue de $80.',
      mood_prompt_md: '¿Seguimos con la aventura o repasamos la parte de la limonada?',
    },
  },
]
