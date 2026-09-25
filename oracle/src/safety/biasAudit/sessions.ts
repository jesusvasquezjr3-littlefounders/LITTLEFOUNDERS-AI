import type { Locale } from '../../context/schema.js';
import type { VariantGroup } from './fixtures.js';

/*
 * C.20 — FUSED-OUTPUT PARITY: the same learner behaviour, written in
 * different dialects and as speech-to-text output, must produce the same
 * Behavioral Telemetry Layer decisions (the same check-ins, on the same
 * turns). Component-level parity (`fixtures.ts`) is necessary but not
 * sufficient: a small difference in each lexical reader can still add up to
 * a different decision about the child, and the DECISION is what reaches
 * them. Timing and graded results are identical across renderings; only the
 * words change.
 */

export interface SessionTurn {
  latencyMs: number;
  graded?: { correct: boolean; pCorrect: number };
  /** Null for an activity grade (no words). */
  text: ({ standard: string } & Partial<Record<Exclude<VariantGroup, 'standard'>, string>>) | null;
}

export interface SessionParityCase {
  id: string;
  locale: Locale;
  context: string;
  turns: SessionTurn[];
}

const TOPIC_EN = 'Saving for a goal: the bike costs 60 dollars and you save 5 each week. How many weeks until you can buy it?';
const TOPIC_ES = 'Ahorrar para una meta: la bici cuesta 60 pesos y ahorras 5 cada semana. ¿Cuántas semanas hasta comprarla?';
const TOPIC_PT = 'Poupar para uma meta: a bicicleta custa 60 reais e você guarda 5 por semana. Quantas semanas até comprar?';

const t = (latencyMs: number, text: SessionTurn['text'], graded?: SessionTurn['graded']): SessionTurn => ({
  latencyMs,
  text,
  ...(graded ? { graded } : {}),
});

export const SESSION_CASES: SessionParityCase[] = [
  {
    id: 'en-US:disengaging',
    locale: 'en-US',
    context: TOPIC_EN,
    turns: [
      t(5_000, {
        standard: 'I want to save money for a new bike this summer',
        regional: "I'm fixin' to save money for a new bike this summer",
        vernacular: 'I been wanting to save money for a new bike this summer',
        asr: 'i want to save money for a new bike this summer',
      }),
      t(6_000, {
        standard: 'It costs sixty dollars at the store near my house',
        regional: "It costs sixty dollars down at the store by my house",
        vernacular: 'it cost sixty dollars at the store by my house',
        asr: 'it costs sixty dollars at the store near my house',
      }),
      t(7_000, { standard: '12', regional: 'twelve', vernacular: 'it twelve', asr: 'twelve' }, { correct: true, pCorrect: 0.5 }),
      t(6_500, {
        standard: 'Because five times twelve is sixty so twelve weeks',
        regional: "Cause five times twelve is sixty so it's twelve weeks",
        vernacular: 'cause five times twelve is sixty so it twelve weeks',
        asr: 'because five times twelve is sixty so twelve weeks',
      }),
      t(20_000, { standard: 'Okay.', regional: 'alright', vernacular: 'bet', asr: 'okay' }),
      t(25_000, {
        standard: 'I played football with my cousin all night yesterday',
        regional: "Me and my cousin played football all night yesterday",
        vernacular: 'me and my cousin was playing football all night yesterday',
        asr: 'i played football with my cousin all night yesterday',
      }),
      t(30_000, { standard: 'Okay.', regional: 'alright', vernacular: 'bet', asr: 'okay' }),
      t(40_000, { standard: '3', regional: 'three', vernacular: 'it three', asr: 'three' }, { correct: false, pCorrect: 0.5 }),
      t(28_000, { standard: 'Whatever.', regional: 'whatever', vernacular: 'whatever', asr: 'whatever' }),
      t(35_000, {
        standard: 'My dog chased a squirrel around the yard today',
        regional: "My dog chased a squirrel all 'round the yard today",
        vernacular: 'my dog was chasing a squirrel round the yard today',
        asr: 'my dog chased a squirrel around the yard today',
      }),
    ],
  },
  {
    id: 'en-US:steady',
    locale: 'en-US',
    context: TOPIC_EN,
    turns: [
      t(5_000, {
        standard: 'I want to save money for a new bike this summer',
        regional: "I'm fixin' to save money for a new bike this summer",
        vernacular: 'I been wanting to save money for a new bike this summer',
        asr: 'i want to save money for a new bike this summer',
      }),
      t(6_000, {
        standard: 'I would put five dollars in my piggy bank every week',
        regional: "I'd put five dollars in my piggy bank every week",
        vernacular: 'I be putting five dollars in my piggy bank every week',
        asr: 'i would put five dollars in my piggy bank every week',
      }),
      t(7_000, { standard: '12', regional: 'twelve', vernacular: 'it twelve', asr: 'twelve' }, { correct: true, pCorrect: 0.5 }),
      t(6_500, {
        standard: 'If I do chores I can earn more money each week',
        regional: "If I do my chores I can earn more money each week",
        vernacular: 'if I do chores I could earn more money every week',
        asr: 'if i do chores i can earn more money each week',
      }),
      t(6_000, {
        standard: 'Then the bike takes fewer weeks because I save more',
        regional: "Then that bike takes fewer weeks 'cause I save more",
        vernacular: 'then the bike take less weeks cause I be saving more',
        asr: 'then the bike takes fewer weeks because i save more',
      }),
      t(7_500, { standard: '6', regional: 'six', vernacular: 'it six', asr: 'six' }, { correct: true, pCorrect: 0.6 }),
      t(6_200, {
        standard: 'Spending less on snacks leaves more money for my goal',
        regional: 'Spending less on snacks leaves more money for my goal',
        vernacular: 'spending less on snacks leave more money for my goal',
        asr: 'spending less on snacks leaves more money for my goal',
      }),
      t(5_800, {
        standard: 'I think saving first is better than spending now',
        regional: 'I reckon saving first beats spending now',
        vernacular: 'saving first is better than spending now fr',
        asr: 'i think saving first is better than spending now',
      }),
      t(7_000, { standard: '4', regional: 'four', vernacular: 'it four', asr: 'four' }, { correct: true, pCorrect: 0.7 }),
      t(6_400, {
        standard: 'Fifteen dollars a week means four weeks for the bike',
        regional: "Fifteen dollars a week means it's four weeks for the bike",
        vernacular: 'fifteen dollars a week mean four weeks for the bike',
        asr: 'fifteen dollars a week means four weeks for the bike',
      }),
    ],
  },
  {
    id: 'es-MX:frustrated',
    locale: 'es-MX',
    context: TOPIC_ES,
    turns: [
      t(5_000, {
        standard: 'Quiero ahorrar dinero para comprar una bici nueva',
        vernacular: 'quiero juntar lana pa comprarme una bici nueva',
        child_spelling: 'kiero aorrar dinero para comprar una bisi nueva',
        asr: 'quiero ahorrar dinero para comprar una bici nueva',
      }),
      t(6_000, {
        standard: 'Cuesta sesenta pesos en la tienda de la esquina',
        vernacular: 'cuesta sesenta varos en la tiendita de la esquina',
        child_spelling: 'cuesta sesenta pesos en la tienda de la eskina',
        asr: 'cuesta sesenta pesos en la tienda de la esquina',
      }),
      t(7_000, { standard: '12', vernacular: 'doce', child_spelling: '12', asr: 'doce' }, { correct: true, pCorrect: 0.5 }),
      t(6_500, {
        standard: 'Porque cinco por doce son sesenta entonces doce semanas',
        vernacular: 'pos cinco por doce son sesenta, entonces doce semanas',
        child_spelling: 'porke sinco por doce son sesenta entonses doce semanas',
        asr: 'porque cinco por doce son sesenta entonces doce semanas',
      }),
      t(9_000, { standard: '20', vernacular: 'veinte', child_spelling: '20', asr: 'veinte' }, { correct: false, pCorrect: 0.5 }),
      t(8_000, {
        standard: 'No sé, no entiendo esto',
        vernacular: 'neta no sé, no le entiendo',
        child_spelling: 'nose no entiendo esto',
        asr: 'no se no entiendo esto',
      }),
      t(9_500, { standard: '20', vernacular: 'veinte', child_spelling: 'beinte', asr: 'veinte' }, { correct: false, pCorrect: 0.5 }),
      t(8_000, {
        standard: 'No tiene sentido, creo que son veinte',
        vernacular: 'no tiene sentido, igual y son veinte',
        child_spelling: 'no tiene sentido creo ke son 20',
        asr: 'no tiene sentido creo que son veinte',
      }),
      t(10_000, { standard: '20', vernacular: 'veinte', child_spelling: '20', asr: 'veinte' }, { correct: false, pCorrect: 0.5 }),
      t(9_000, { standard: 'Ni idea', vernacular: 'ni idea, wey', child_spelling: 'ni idea', asr: 'ni idea' }),
    ],
  },
  {
    id: 'es-MX:steady',
    locale: 'es-MX',
    context: TOPIC_ES,
    turns: [
      t(5_000, {
        standard: 'Quiero ahorrar dinero para comprar una bici nueva',
        vernacular: 'quiero juntar lana pa comprarme una bici nueva',
        child_spelling: 'kiero aorrar dinero para comprar una bisi nueva',
        asr: 'quiero ahorrar dinero para comprar una bici nueva',
      }),
      t(6_000, {
        standard: 'Pondría cinco pesos en mi alcancía cada semana',
        vernacular: 'le echaría cinco varos a mi cochinito cada semana',
        child_spelling: 'pondria sinco pesos en mi alcansia cada semana',
        asr: 'pondria cinco pesos en mi alcancia cada semana',
      }),
      t(7_000, { standard: '12', vernacular: 'doce', child_spelling: '12', asr: 'doce' }, { correct: true, pCorrect: 0.5 }),
      t(6_500, {
        standard: 'Si hago quehaceres puedo ganar más dinero cada semana',
        vernacular: 'si le ayudo a mi jefa puedo sacar más lana cada semana',
        child_spelling: 'si ago keaseres puedo ganar mas dinero cada semana',
        asr: 'si hago quehaceres puedo ganar mas dinero cada semana',
      }),
      t(6_000, {
        standard: 'Entonces la bici tarda menos semanas si ahorro más',
        vernacular: 'entonces la bici sale en menos semanas si ahorro más',
        child_spelling: 'entonses la bisi tarda menos semanas si aorro mas',
        asr: 'entonces la bici tarda menos semanas si ahorro mas',
      }),
      t(7_500, { standard: '6', vernacular: 'seis', child_spelling: '6', asr: 'seis' }, { correct: true, pCorrect: 0.6 }),
      t(6_200, {
        standard: 'Gastar menos en dulces deja más dinero para mi meta',
        vernacular: 'gastar menos en dulces deja más lana pa mi meta',
        child_spelling: 'gastar menos en dulses deja mas dinero para mi meta',
        asr: 'gastar menos en dulces deja mas dinero para mi meta',
      }),
      t(5_800, {
        standard: 'Creo que ahorrar primero es mejor que gastar ahora',
        vernacular: 'creo que ahorrar primero está mejor que gastar ahorita',
        child_spelling: 'creo ke aorrar primero es mejor que gastar aora',
        asr: 'creo que ahorrar primero es mejor que gastar ahora',
      }),
      t(7_000, { standard: '4', vernacular: 'cuatro', child_spelling: '4', asr: 'cuatro' }, { correct: true, pCorrect: 0.7 }),
      t(6_400, {
        standard: 'Quince pesos por semana son cuatro semanas para la bici',
        vernacular: 'quince varos por semana son cuatro semanas pa la bici',
        child_spelling: 'kinse pesos por semana son cuatro semanas para la bisi',
        asr: 'quince pesos por semana son cuatro semanas para la bici',
      }),
    ],
  },
  {
    id: 'pt-BR:disengaging',
    locale: 'pt-BR',
    context: TOPIC_PT,
    turns: [
      t(5_000, {
        standard: 'Eu quero juntar dinheiro para comprar uma bicicleta nova',
        regional: 'Oxe, eu quero juntar dinheiro pra comprar uma bicicleta nova',
        vernacular: 'tô querendo juntar grana pra comprar uma bike nova',
        asr: 'eu quero juntar dinheiro para comprar uma bicicleta nova',
      }),
      t(6_000, {
        standard: 'Ela custa sessenta reais na loja perto de casa',
        regional: 'Ela custa sessenta reais na loja pertinho de casa, visse',
        vernacular: 'ela custa sessenta conto na loja perto de casa',
        asr: 'ela custa sessenta reais na loja perto de casa',
      }),
      t(7_000, { standard: '12', regional: 'doze', vernacular: 'é doze', asr: 'doze' }, { correct: true, pCorrect: 0.5 }),
      t(6_500, {
        standard: 'Porque cinco vezes doze dá sessenta então doze semanas',
        regional: 'Porque cinco vezes doze dá sessenta, então doze semanas, visse',
        vernacular: 'pq cinco vezes doze dá sessenta, então doze semanas',
        asr: 'porque cinco vezes doze da sessenta entao doze semanas',
      }),
      t(20_000, { standard: 'Tá bom.', regional: 'tá bom', vernacular: 'blz', asr: 'ta bom' }),
      t(25_000, {
        standard: 'Ontem eu joguei videogame com meu primo a noite toda',
        regional: 'Ontem eu joguei videogame com meu primo a noite todinha',
        vernacular: 'ontem joguei vídeo game com meu primo a noite toda, mano',
        asr: 'ontem eu joguei videogame com meu primo a noite toda',
      }),
      t(30_000, { standard: 'Tá bom.', regional: 'tá bom', vernacular: 'blz', asr: 'ta bom' }),
      t(40_000, { standard: '3', regional: 'três', vernacular: 'é três', asr: 'tres' }, { correct: false, pCorrect: 0.5 }),
      t(28_000, { standard: 'Tanto faz.', regional: 'tanto faz', vernacular: 'tanto faz', asr: 'tanto faz' }),
      t(35_000, {
        standard: 'Meu cachorro correu atrás de um gato no quintal hoje',
        regional: 'Meu cachorro correu atrás de um gato lá no quintal hoje',
        vernacular: 'meu cachorro correu atrás de um gato no quintal hoje, mano',
        asr: 'meu cachorro correu atras de um gato no quintal hoje',
      }),
    ],
  },
];
