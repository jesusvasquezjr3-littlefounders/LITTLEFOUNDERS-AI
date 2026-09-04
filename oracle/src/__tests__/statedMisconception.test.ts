import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  CLASSIFIABLE_MISCONCEPTIONS,
  classifyStatedMisconception,
} from '../tutor/statedMisconception.js';
import { skillCatalogue } from '../tutor/skills.js';

/*
 * THE RISK THIS FILE GOVERNS IS NOT MISSING A MISCONCEPTION.
 *
 * A miss costs one turn of ordinary teaching. A FALSE POSITIVE costs a child
 * being argued out of something they never said — the tutor spends its turn
 * repairing a belief the learner does not hold, which is worse than not
 * noticing. So the "must stay silent" block below is the important half, and
 * it is deliberately longer than the block that asserts detection.
 */

describe('reads a committed wrong idea out of what a child said', () => {
  const cases: [string, string][] = [
    ['tengo 14 canicas y somos 3, le toca 4 a cada quien y ya', 'ignores-remainder'],
    ['repartimos las 20 galletas entre 6 y no sobra nada', 'ignores-remainder'],
    ['si algo cuesta 7 y pago con 20, me tienen que devolver los 20', 'returns-payment'],
    ['le voy a poner 100 pesos al vaso de limonada, asi me hago rico', 'highest-price-wins'],
    [
      'me alcanza para la pelota, y tambien para el cuaderno, y tambien para los colores',
      'budget-is-per-item',
    ],
    ['un cuarto de pastel es mas que un medio porque cuatro es mas que dos', 'bigger-denominator-bigger-part'],
    ['esta moneda es mas grande entonces vale mas que la otra', 'bigger-coin-worth-more'],
    ['tengo 5 monedas entonces tengo 5 pesos', 'counts-coins-not-value'],
    ['de 3 no puedo quitar 7, no se puede restar asi', 'subtracts-smaller-from-larger-digitwise'],
    ['seguro me lo compran todos, voy a vender un monton', 'ignores-downside'],
  ];

  for (const [utterance, code] of cases) {
    it(`"${utterance.slice(0, 46)}…" → ${code}`, () => {
      expect(classifyStatedMisconception(utterance)).toBe(code);
    });
  }
});

describe('stays silent on everything that is not a committed claim', () => {
  const silent = [
    // Questions about the very same topics — the tutor should ANSWER these.
    '¿un cuarto es mas que un medio?',
    'oye y si no sobra nada que pasa?',
    '¿me devuelven los 20 o no?',
    '¿cuanto me alcanza con 50 pesos?',
    // Hedges: the child is unsure, which is not a belief to repair.
    'no se si le toca 4 a cada quien y ya',
    'creo que no, me equivoque en eso',
    // Correct statements that share the vocabulary.
    'reparti 12 entre 3 y le tocan 4 a cada quien, y sobran 0 porque es exacto',
    // Ordinary conversation.
    'hola, es mi primera vez aqui',
    'quiero ahorrar para una patineta',
    'no entiendo, me lo explicas otra vez?',
    'vendi limonada y me fue bien',
    'gracias, ya entendi',
    // Too short to carry a claim, and long enough to be a story.
    'y ya',
    'no sobra',
  ];

  for (const utterance of silent) {
    it(`silent on "${utterance.slice(0, 44)}"`, () => {
      expect(classifyStatedMisconception(utterance)).toBeNull();
    });
  }

  it('is silent on an empty or whitespace utterance', () => {
    expect(classifyStatedMisconception('')).toBeNull();
    expect(classifyStatedMisconception('     ')).toBeNull();
  });

  it('is silent on a long story that merely mentions the words', () => {
    const story = `${'ayer fui al mercado con mi mama y compramos muchas cosas '.repeat(8)} y ya`;
    expect(classifyStatedMisconception(story)).toBeNull();
  });
});

describe('the classifier and the rest of the catalogue agree', () => {
  it('every code it can produce is a real code in the KC graph', () => {
    const seed = JSON.parse(
      readFileSync(new URL('../../../database/seeds/kc_graph.v1.json', import.meta.url), 'utf8'),
    ) as unknown;
    const canonical = new Set<string>();
    const walk = (node: unknown): void => {
      if (Array.isArray(node)) return node.forEach(walk);
      if (node && typeof node === 'object') {
        const rec = node as Record<string, unknown>;
        if (typeof rec.code === 'string') canonical.add(rec.code);
        Object.values(rec).forEach(walk);
      }
    };
    walk(seed);
    for (const code of CLASSIFIABLE_MISCONCEPTIONS) {
      expect(canonical, `classifier can emit "${code}", which no KC declares`).toContain(code);
    }
  });

  it('every code it can produce has a move that repairs it — otherwise detection buys nothing', () => {
    /*
     * The whole point of detecting a stated misconception is to reach the move
     * that repairs it. A code with no move sets the controller to REMEDIATE
     * and then hands `selectSkill` nothing to select, which is a worse turn
     * than not detecting it at all: the strategy changed and the teaching did
     * not.
     */
    const repaired = new Set(skillCatalogue().flatMap((s) => s.misconceptions));
    for (const code of CLASSIFIABLE_MISCONCEPTIONS) {
      expect(repaired, `nothing repairs "${code}"`).toContain(code);
    }
  });
});
