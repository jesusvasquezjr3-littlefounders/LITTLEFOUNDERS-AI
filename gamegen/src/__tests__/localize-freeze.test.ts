// THE LOCALIZE STRING FREEZE, proved as a ROUND TRIP through the real stage.
//
// `illustrate` runs on the es-MX document BEFORE `localize` (GAME_ENGINE.md §9), so
// the Prism/Depot sprite URLs are already sitting in `skin.sprites` when the
// translator runs — and they are copied verbatim into en-US and pt-BR. ONE IMAGE
// SERVES THREE LOCALES, a 3x cut in the dominant cost of mass generation.
//
// That saving is entirely load-bearing on the freeze, and the freeze is what
// `nonVisibleKeys.ts` skips WITH ITS WHOLE SUBTREE (`sprites`, `config`, `sfx`,
// `props`…), because sprite slots are arbitrary Record keys that a coursegen-style
// field-name list cannot enumerate. `pipeline/nonVisibleKeys.test.ts` proves the key
// SET is complete against every mechanic schema; this file proves the STAGE actually
// honors it end to end: numbers and URLs identical, prose different, and a translator
// that "helpfully" restructures the document REFUSED rather than published.
//
// The DeepSeek boundary is injected (`deps.translate`) — no key is read, no socket
// is opened, nothing is billed.

import { describe, expect, it, vi } from 'vitest';

import { localizeGame, type GameTargetLocale } from '../pipeline/localize.js';
import { parseGameDocumentSync } from '../contract/core/schema.js';
import type { GameDocument } from '../contract/core/types.js';

/** Depot URLs the illustrate stage already paid for. If these are ever handed to a
 *  translator the run pays 3x and, worse, may get back a *different valid-looking*
 *  URL that silently ships three locales of broken art. */
const SPRITES = {
  bin_1: 'https://depot.littlefounders.ai/files/aaaaaaaaaaaa1111.webp',
  bin_2: 'https://depot.littlefounders.ai/files/bbbbbbbbbbbb2222.webp',
  item_1: 'https://depot.littlefounders.ai/files/cccccccccccc3333.webp',
} as const;
const BACKGROUND = 'https://depot.littlefounders.ai/files/dddddddddddd4444.webp';

/** A schema-valid, ALREADY ILLUSTRATED es-MX sorter — the exact state `localize`
 *  receives it in. Adapted from `frontend/src/game-engine/mechanics/sorter/fixtures.ts`
 *  via `simulateGate.test.ts`. Content is curriculum, never a child (§1.9). */
function illustratedSorter(): GameDocument {
  return {
    schema_version: 1,
    meta: {
      slug: 'necesito-o-quiero',
      title: 'Necesito o quiero',
      locale: 'es-MX',
      mechanic: 'sorter',
      concept: {
        topic_path: 'mi-primer-dinero/decidir-con-calma/necesidades-y-deseos',
        recap_md:
          'Aprendiste que una **necesidad** es algo sin lo que no puedes estar bien, y un **deseo** es algo que te gusta pero puede esperar.',
      },
      tier: 1,
      estimated_minutes: 3,
      cast: ['dina'],
    },
    skin: {
      palette: 'forest-pear',
      background_url: BACKGROUND,
      sprites: { ...SPRITES },
      sfx: { correct: 'correct', wrong: 'tryagain', place: 'drop', combo: 'streak' },
      bgm: 'arcade-calm',
    },
    config: {
      mode: 'static',
      category_count: 2,
      field: { width: 900, height: 540, lanes: 3, item_size: 132 },
      ladder: [
        {
          spawn_interval_ticks: 2,
          fall_speed: 0,
          speed_variance: 0,
          max_active: 6,
          item_tiers: [1],
          points_per_correct: 5,
        },
        {
          spawn_interval_ticks: 2,
          fall_speed: 0,
          speed_variance: 0,
          max_active: 6,
          item_tiers: [1, 2],
          points_per_correct: 7,
        },
      ],
      level_up: { correct_per_level: 6 },
      combo: { step: 3, max: 3 },
      penalty: {
        wrong_drop: { score_pct: 4, lives: 0, combo_reset: true, return_item: true },
        miss: { score_pct: 0, lives: 0, combo_reset: false },
      },
      trash_zone: true,
      repeat_items: false,
      initial_fill: 6,
      round: { target_correct: 10, target_points: 90, tick_budget: 2400 },
      score_weights: { accuracy: 0.5, progress: 0.3, points: 0.2 },
    },
    content: {
      categories: [
        { id: 'necesito', label_md: 'Necesito', image_slot: 'bin_1' },
        { id: 'quiero', label_md: 'Quiero', image_slot: 'bin_2' },
      ],
      items: [
        { id: 'agua', label_md: 'Agua para tomar', category: 'necesito', icon: 'water_drop', image_slot: 'item_1', tier: 1 },
        { id: 'lonche', label_md: 'El lonche de la escuela', category: 'necesito', icon: 'restaurant', tier: 1 },
        { id: 'medicina', label_md: 'La medicina del doctor', category: 'necesito', icon: 'medical_services', tier: 1 },
        { id: 'pasaje', label_md: 'El pasaje del camion', category: 'necesito', icon: 'directions_bus', tier: 1 },
        { id: 'cuaderno', label_md: 'Un cuaderno para la tarea', category: 'necesito', icon: 'menu_book', tier: 1 },
        {
          id: 'internet-tarea',
          label_md: 'Internet para hacer la tarea',
          category: 'necesito',
          icon: 'router',
          tier: 2,
          misconception_md: 'Suena a lujo, pero si la tarea se entrega en linea, es una necesidad.',
        },
        { id: 'videojuego', label_md: 'Un videojuego nuevo', category: 'quiero', icon: 'videogame_asset', tier: 1 },
        { id: 'dulces', label_md: 'Dulces de la tiendita', category: 'quiero', icon: 'cake', tier: 1 },
        { id: 'juguete', label_md: 'Otro juguete igual al que tengo', category: 'quiero', icon: 'toys', tier: 1 },
        { id: 'cine', label_md: 'Un boleto para el cine', category: 'quiero', icon: 'movie', tier: 1 },
        {
          id: 'tenis-marca',
          label_md: 'Tenis de la marca de moda',
          category: 'quiero',
          icon: 'checkroom',
          tier: 2,
          misconception_md: 'Unos tenis si son necesidad; que sean de esa marca ya es un gusto.',
        },
        { id: 'audifonos', label_md: 'Audifonos que brillan', category: 'quiero', icon: 'headphones', tier: 2 },
        {
          id: 'dia-soleado',
          label_md: 'Un dia soleado',
          icon: 'sunny',
          tier: 1,
          misconception_md: 'No se compra ni se paga, asi que no cabe en ninguna de las dos cajas.',
        },
        {
          id: 'abrazo',
          label_md: 'Un abrazo de tu familia',
          icon: 'volunteer_activism',
          tier: 1,
          misconception_md: 'Es gratis y no se vende: no es un gasto, es algo que ya tienes.',
        },
      ],
      feedback: {
        correct_md: ['Esa va justo ahi.', 'Lo pensaste bien.', 'Sigue asi.'],
        incorrect_md: ['Casi. Piensa que pasa si no lo tienes.', 'Otra vuelta: puedes esperar?'],
        results_md: 'Separar lo que necesito de lo que quiero es el primer paso para decidir mi dinero.',
      },
    },
    scoring: { mode: 'cheer', xp_max: 10, pass_score: 60, lives: null, target: 10 },
  };
}

/** A translator stub that behaves: same keys, every value visibly rewritten. */
function goodTranslator(prefix: string) {
  return vi.fn(async (req: { messages: { role: string; content: string }[] }) => {
    const last = req.messages[req.messages.length - 1]?.content ?? '';
    const payload = last.slice(last.indexOf('{'));
    const map = JSON.parse(payload) as Record<string, string>;
    const out: Record<string, string> = {};
    for (const [key, value] of Object.entries(map)) out[key] = `${prefix}${value}`;
    return { content: JSON.stringify(out), promptTokens: 100, completionTokens: 100, cachedPromptTokens: 0 };
  });
}

const enUS: GameTargetLocale = 'en-US';

describe('localizeGame — the freeze', () => {
  it('carries sprite URLs, background, palette and every config number across UNCHANGED', async () => {
    const source = illustratedSorter();
    const translate = goodTranslator('EN ');

    const { document } = await localizeGame(source, enUS, { translate });

    // The 3x saving, asserted literally.
    expect(document.skin.sprites).toEqual(SPRITES);
    expect(document.skin.background_url).toBe(BACKGROUND);
    expect(document.skin.palette).toBe('forest-pear');
    expect(document.skin.sfx).toEqual(source.skin.sfx);
    expect(document.skin.bgm).toBe('arcade-calm');

    // The mechanic's whole config tree — thresholds, enums, ladders — byte-identical.
    // A translated `mode: "static"` or a drifted `tick_budget` is an unplayable game.
    expect(document.config).toEqual(source.config);

    // Scoring/identity numbers are mechanics, not prose.
    expect(document.scoring).toEqual(source.scoring);
    expect(document.meta.slug).toBe(source.meta.slug);
    expect(document.meta.tier).toBe(source.meta.tier);
    expect(document.meta.estimated_minutes).toBe(source.meta.estimated_minutes);
    expect(document.meta.concept.topic_path).toBe(source.meta.concept.topic_path);
    expect(document.meta.cast).toEqual(['dina']);
    expect(document.schema_version).toBe(1);
  });

  it('rewrites every learner-visible string and only those', async () => {
    const source = illustratedSorter();
    const { document } = await localizeGame(source, enUS, { translate: goodTranslator('EN ') });

    expect(document.meta.locale).toBe('en-US');
    expect(document.meta.title).toBe('EN Necesito o quiero');
    expect(document.meta.concept.recap_md.startsWith('EN ')).toBe(true);
    expect(document.content.feedback.results_md.startsWith('EN ')).toBe(true);
    for (const line of document.content.feedback.correct_md) expect(line.startsWith('EN ')).toBe(true);
    for (const line of document.content.feedback.incorrect_md) expect(line.startsWith('EN ')).toBe(true);

    for (const [index, item] of document.content.items.entries()) {
      const before = source.content.items[index];
      expect(item.label_md).toBe(`EN ${before?.label_md ?? ''}`);
      // ids and Material Symbols ligatures are NOT prose: a translated "cookie"
      // renders nothing at all.
      expect(item.id).toBe(before?.id);
      expect(item.icon).toBe(before?.icon);
      expect(item.image_slot).toBe(before?.image_slot);
      expect(item.category).toBe(before?.category);
      expect(item.tier).toBe(before?.tier);
    }
    for (const [index, category] of (document.content.categories ?? []).entries()) {
      const before = source.content.categories?.[index];
      expect(category.label_md).toBe(`EN ${before?.label_md ?? ''}`);
      expect(category.id).toBe(before?.id);
      expect(category.image_slot).toBe(before?.image_slot);
    }
  });

  it('produces a document that still satisfies the contract, and never mutates the source', async () => {
    const source = illustratedSorter();
    const before = JSON.stringify(source);

    const { document } = await localizeGame(source, 'pt-BR', { translate: goodTranslator('PT ') });

    expect(parseGameDocumentSync(document).ok).toBe(true);
    expect(JSON.stringify(source)).toBe(before); // the es-MX original is untouched
    expect(document.skin.sprites).toEqual(SPRITES); // …and pt-BR reuses the same art
  });

  it('REFUSES a translation that drops keys, and feeds the gap back as a corrective retry', async () => {
    let attempt = 0;
    const translate = vi.fn(async (req: { messages: { role: string; content: string }[] }) => {
      attempt += 1;
      const first = req.messages[1]?.content ?? '';
      const map = JSON.parse(first.slice(first.indexOf('{'))) as Record<string, string>;
      const out: Record<string, string> = {};
      for (const [key, value] of Object.entries(map)) out[key] = `EN ${value}`;
      // Attempt 1 "helpfully" omits a key. The stage must not accept a document with
      // an es-MX string left in it.
      if (attempt === 1) delete out['0'];
      return { content: JSON.stringify(out), promptTokens: 10, completionTokens: 10, cachedPromptTokens: 0 };
    });

    const { document, attempts } = await localizeGame(illustratedSorter(), enUS, { translate });

    expect(attempts).toBe(2);
    expect(translate).toHaveBeenCalledTimes(2);
    expect(document.meta.title.startsWith('EN ')).toBe(true);
    // The corrective feedback is APPENDED after the original messages, so attempts
    // 2..N re-send an identical leading prompt and bill the cached rate.
    const retryMessages = translate.mock.calls[1]?.[0].messages ?? [];
    const firstMessages = translate.mock.calls[0]?.[0].messages ?? [];
    expect(retryMessages.length).toBe(firstMessages.length + 1);
    expect(retryMessages.slice(0, firstMessages.length)).toEqual(firstMessages);
  });

  it('refuses to pay for a no-op translation into the source locale', async () => {
    const translate = goodTranslator('EN ');
    await expect(localizeGame(illustratedSorter(), 'es-MX' as GameTargetLocale, { translate })).rejects.toThrow(
      /already es-MX/,
    );
    expect(translate).not.toHaveBeenCalled();
  });

  it('propagates a target-locale vocabulary re-gate failure instead of publishing it', async () => {
    await expect(
      localizeGame(illustratedSorter(), enUS, {
        translate: goodTranslator('EN '),
        regate: () => [{ message: 'forbidden vocabulary for tier1 en-US: "loan"' }],
      }),
    ).rejects.toThrow(/forbidden-vocabulary hit/);
  });
});
