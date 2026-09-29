// The learner register policy (Product 10 B.23, with B.25, B.26 and B.27;
// S05.3f). Written policy: docs/rebuild/LEARNER-REGISTER-AND-WELLBEING-POLICY.md.
//
// CANONICAL FILE. Core owns it. Verbatim copies are generated for the places
// that must read the same rules (no shared package exists, by design):
//   frontend/src/rebuild/design/learnerRegisterPolicy.generated.ts  (the UI)
//   coursegen/src/pipeline/learnerRegisterPolicy.generated.ts       (Forge gates 18 and 19)
// Regenerate with `node agent/tools/sync-learner-register-policy.mjs`;
// `npm run spec:check` fails when a copy drifts. The repository gate
// (agent/tools/check-dark-patterns.mjs) imports this file directly.
//
// Keep this file self-contained and erasable (no imports, no enums, no
// namespaces): Node imports it with type stripping, and three packages with
// different compiler settings compile the same bytes.
//
// One design system for every band (OD-4). A register changes the words, the
// Mentor character's presence and voice, the reward framing and the social
// mechanics allowed. It never changes tokens, components or shapes.

export const LEARNER_REGISTER_POLICY_VERSION = '2026-09-29.1';

export type LearnerRegister = 'young' | 'transition' | 'teen' | 'adult';
export type RegisterCopyBand = '6-9' | '10-12' | '13-17' | 'adult';

export const LEARNER_REGISTERS: readonly LearnerRegister[] = ['young', 'transition', 'teen', 'adult'];

export type LexiconId =
  | 'self-global'
  | 'person-praise'
  | 'family-finance-moralizing'
  | 'loss-mechanic'
  | 'time-pressure'
  | 'parasocial-pressure'
  | 'purchase-lure'
  | 'social-pressure'
  | 'childish-framing';

export interface RegisterSpec {
  register: LearnerRegister;
  /** Inclusive age range; `max` is null for the open adult band. */
  ages: { min: number; max: number | null };
  /** The Copy Budget band (Frontend Bible 06) this register reads with. */
  copyBand: RegisterCopyBand;
  tone: {
    /** What praise names (Appendix B §1.8, §2.9): never the learner's traits. */
    praiseTarget: 'process' | 'skill' | 'capability' | 'utility';
    /** A bare "Great job!" with nothing named: allowed only while praise is still taken at face value. */
    genericPraise: boolean;
    /** Exclamation marks allowed in one string. */
    exclamations: number;
    /** Lexicons this register forbids on top of the universal list. */
    forbids: readonly LexiconId[];
  };
  mentor: {
    presence: 'high' | 'reduced' | 'minimal';
    /** Phone band height of the compact lesson stage, in CSS px (Bible 08 §11 caps it at 30/25/15% of the height). */
    stageBandPx: number;
    /** Reply chips first, chips and field equal, or the text field first (Bible 08 §9). */
    replyFirst: 'chips' | 'equal' | 'text';
    /** Idle and reaction animation level for the character. */
    animation: 'lively' | 'moderate' | 'calm';
    /** How the character reacts to a miss: always encouraging, never sad or disappointed (B.26). */
    missReaction: 'encouraging';
    /** How the character reacts to a met answer (never a celebration: OD-7). */
    metReaction: 'happy' | 'nod';
  };
  reward: {
    framing: 'concrete' | 'mastery' | 'identity' | 'utility';
    /** The recognition line the result leads with. */
    recognition: 'worked-out' | 'showed' | 'built' | 'skill';
    /** Where coins and XP sit: a small tally, secondary, or plain data. */
    currency: 'sparing' | 'secondary' | 'data';
    /** Whether the result shows the medal illustration (the milestone motion needs it). */
    medal: boolean;
  };
  social: {
    /** Comparison is always with the learner's own history, never with other people. */
    comparison: 'own-history';
    leaderboards: 'none';
    /** Whether a peer can see this learner's progress, mistakes or rank. */
    peerVisibleProgress: false;
  };
  /** The autonomy mechanism this band leads with (B.24). */
  autonomy: 'topic' | 'approach' | 'path-pace' | 'full';
}

/**
 * The four registers (Product 10, Block B "Age-band registers"; Appendix B
 * §2.9). The adult register serves adult learners and the Family Hub.
 */
export const REGISTERS: Readonly<Record<LearnerRegister, RegisterSpec>> = {
  young: {
    register: 'young', ages: { min: 0, max: 9 }, copyBand: '6-9',
    tone: { praiseTarget: 'process', genericPraise: true, exclamations: 1, forbids: [] },
    mentor: { presence: 'high', stageBandPx: 110, replyFirst: 'chips', animation: 'lively', missReaction: 'encouraging', metReaction: 'happy' },
    reward: { framing: 'concrete', recognition: 'worked-out', currency: 'sparing', medal: true },
    social: { comparison: 'own-history', leaderboards: 'none', peerVisibleProgress: false },
    autonomy: 'topic',
  },
  transition: {
    register: 'transition', ages: { min: 10, max: 12 }, copyBand: '10-12',
    tone: { praiseTarget: 'skill', genericPraise: false, exclamations: 1, forbids: [] },
    mentor: { presence: 'reduced', stageBandPx: 96, replyFirst: 'equal', animation: 'moderate', missReaction: 'encouraging', metReaction: 'happy' },
    reward: { framing: 'mastery', recognition: 'showed', currency: 'secondary', medal: true },
    social: { comparison: 'own-history', leaderboards: 'none', peerVisibleProgress: false },
    autonomy: 'approach',
  },
  teen: {
    register: 'teen', ages: { min: 13, max: 17 }, copyBand: '13-17',
    tone: { praiseTarget: 'capability', genericPraise: false, exclamations: 0, forbids: ['childish-framing'] },
    mentor: { presence: 'minimal', stageBandPx: 80, replyFirst: 'text', animation: 'calm', missReaction: 'encouraging', metReaction: 'nod' },
    reward: { framing: 'identity', recognition: 'built', currency: 'data', medal: false },
    social: { comparison: 'own-history', leaderboards: 'none', peerVisibleProgress: false },
    autonomy: 'path-pace',
  },
  adult: {
    register: 'adult', ages: { min: 18, max: null }, copyBand: 'adult',
    tone: { praiseTarget: 'utility', genericPraise: false, exclamations: 0, forbids: ['childish-framing'] },
    mentor: { presence: 'minimal', stageBandPx: 80, replyFirst: 'text', animation: 'calm', missReaction: 'encouraging', metReaction: 'nod' },
    reward: { framing: 'utility', recognition: 'skill', currency: 'data', medal: false },
    social: { comparison: 'own-history', leaderboards: 'none', peerVisibleProgress: false },
    autonomy: 'full',
  },
};

/**
 * The register for a known age. An unknown age reads as the youngest
 * register: the smallest text budgets and the most protective framing, never
 * a guess upward.
 */
export function registerForAge(age: number | null): LearnerRegister {
  if (age === null || !Number.isFinite(age) || age < 10) return 'young';
  if (age < 13) return 'transition';
  if (age < 18) return 'teen';
  return 'adult';
}

export function registerForCopyBand(band: RegisterCopyBand): LearnerRegister {
  return LEARNER_REGISTERS.find((register) => REGISTERS[register].copyBand === band) ?? 'young';
}

/**
 * B.24 / Product 10 Block B "Age-band registers", autonomy column (GAP-FIX-R5):
 * which levers each register's autonomy mechanism OFFERS. Core serves the
 * choices and the course screen shows them from this table only.
 *   topic      (6-9)   simple binary choices: which of two recommended topics next;
 *   approach   (10-12) choice of approach or strategy, not just topic order, with the open path;
 *   path-pace  (13-17) real path and pacing choice, and optional depth/enrichment tracks (with approach);
 *   full       (adult) every lever.
 * Mentor choice and the learner's daily pace plan stay open to every band: they
 * were the release-1 levers for everyone, and a younger learner keeps a
 * stopping point they chose (the owner may narrow this; see GAP-FIX-R5).
 */
export type AutonomyLever = 'path' | 'approach' | 'enrichment' | 'mentor' | 'pace';
export interface AutonomyOffer { path: 'binary' | 'open'; approach: boolean; enrichment: boolean; mentor: true; pace: true }
export const AUTONOMY_OFFERS: Readonly<Record<RegisterSpec['autonomy'], AutonomyOffer>> = {
  topic: { path: 'binary', approach: false, enrichment: false, mentor: true, pace: true },
  approach: { path: 'open', approach: true, enrichment: false, mentor: true, pace: true },
  'path-pace': { path: 'open', approach: true, enrichment: true, mentor: true, pace: true },
  full: { path: 'open', approach: true, enrichment: true, mentor: true, pace: true },
};

/** The levers a register offers, read from its own `autonomy` mechanism. */
export function autonomyOffer(register: LearnerRegister): AutonomyOffer {
  return AUTONOMY_OFFERS[REGISTERS[register].autonomy];
}

/** The levers a v2 document's age band offers (the approach choice opens at 10). */
export function autonomyOfferForBand(band: RegisterCopyBand): AutonomyOffer {
  return autonomyOffer(registerForCopyBand(band));
}

/** Every register an inclusive age range touches (a Forge tier such as "8-10" spans two). */
export function registersForAgeRange(min: number, max: number | null): LearnerRegister[] {
  return LEARNER_REGISTERS.filter((register) => {
    const ages = REGISTERS[register].ages;
    const upper = ages.max ?? Number.POSITIVE_INFINITY;
    return min <= upper && (max === null || max >= ages.min);
  });
}

/** Parses a Forge tier's `ages` string ("6-7", "12-18", "18+"). Null when it cannot. */
export function parseAgeRange(text: string): { min: number; max: number | null } | null {
  const range = /^\s*(\d{1,2})\s*[-–]\s*(\d{1,2})\s*$/.exec(text);
  if (range) {
    const min = Number(range[1]);
    const max = Number(range[2]);
    return min <= max ? { min, max } : null;
  }
  const open = /^\s*(\d{1,2})\s*\+\s*$/.exec(text);
  return open ? { min: Number(open[1]), max: null } : null;
}

/**
 * The graduation moments (B.23: around ages 10 to 12, when children begin
 * discounting simplistic praise). A graduation is shown once, only to a
 * learner who actually used a younger register first; it is informational,
 * never a celebration (OD-7's closed list does not include it).
 */
export const GRADUATIONS: ReadonlyArray<{ from: LearnerRegister; to: LearnerRegister; atAge: number }> = [
  { from: 'young', to: 'transition', atAge: 10 },
  { from: 'transition', to: 'teen', atAge: 13 },
];

export function registerRank(register: LearnerRegister): number {
  return LEARNER_REGISTERS.indexOf(register);
}

/** The graduation into `current` owed to a learner who has seen `seen`, or null. */
export function graduationInto(seen: readonly LearnerRegister[], current: LearnerRegister): { from: LearnerRegister; to: LearnerRegister } | null {
  const step = GRADUATIONS.find((graduation) => graduation.to === current);
  if (!step) return null;
  const younger = seen.filter((register) => registerRank(register) < registerRank(current));
  if (younger.length === 0) return null;
  const from = younger.reduce((a, b) => (registerRank(a) > registerRank(b) ? a : b));
  return { from, to: current };
}

/**
 * B.26 and OD-1: after this many consecutive misses on the same skill, the
 * learner's Mentor offers a guided review of that skill. An offer the learner
 * can decline, never a penalty or a lock. Proposed value; owned by the
 * Pedagogical Lead and recalibrated through Appendix C's threshold log.
 */
export const GUIDED_REVIEW_MISS_THRESHOLD = 3;

/** The offer repeats at every further multiple of the threshold, up to this many misses in a row. */
export const GUIDED_REVIEW_MAX_TRACKED = 12;

/** True when a run of `misses` consecutive misses should carry the offer. */
export function offersGuidedReview(misses: number): boolean {
  return Number.isInteger(misses) && misses >= GUIDED_REVIEW_MISS_THRESHOLD
    && misses <= GUIDED_REVIEW_MAX_TRACKED && misses % GUIDED_REVIEW_MISS_THRESHOLD === 0;
}

// ---- Lexicons ---------------------------------------------------------------
//
// One pattern list per rule, in English, Spanish and Portuguese. Word edges are
// Unicode-aware (accented letters count as letters). Patterns are deliberately
// specific: they name a verdict on a person, a moral judgement about a
// family's money, or a manipulation, not a topic. A lesson may teach about
// debt, low income or saving; it may not call anyone bad for it.

// No lookbehind: the UI reads this file too, and older Safari has none. The
// edge is a consumed prefix instead, and the phrase is capture group 1.
function word(source: string): RegExp {
  return new RegExp(`(?:^|[^\\p{L}\\p{N}])(${source})(?![\\p{L}\\p{N}])`, 'iu');
}

export const LEXICONS: Readonly<Record<LexiconId, readonly RegExp[]>> = {
  // A verdict on who the learner is (Appendix B §2.8, Tangney): shame, not guilt.
  'self-global': [
    word("you(?:'re| are) (?:so |such an? |just )?(?:bad|terrible|awful|hopeless|useless|stupid|dumb|lazy|careless|slow|a failure|a loser|a disappointment)(?: at| with)?"),
    word("you(?:'re| are) not (?:an? )?(?:saver|money person|math person|numbers person|good (?:at|with) (?:money|saving|math|numbers|this))"),
    word('not a (?:money|math|numbers) person'),
    word('you (?:always|never) (?:get (?:it|this) (?:wrong|right)|mess (?:it|this) up|make (?:the same )?mistakes)'),
    word('you failed'),
    word('(?:wrong|failed|mistake) again'),
    word('shame on you'),
    word("what(?:'s| is) wrong with you"),
    word('you should (?:already )?(?:know|have known) (?:this|that|better)'),
    word('even (?:a baby|little kids|a child) (?:can|could|knows?)'),
    word('(?:disappointed|disappointing) (?:in|with) you'),
    word('you let (?:me|us|your \\p{L}+) down'),
    word('eres (?:un |una )?(?:mal[oa]|pésim[oa]|terrible|inútil|tont[oa]|flojo|floja|lent[oa]|descuidad[oa]|un fracaso|una decepción)(?: para| con)?'),
    word('no eres (?:bueno|buena|ahorrador|ahorradora|de números|para (?:el dinero|los números|las matemáticas))'),
    word('(?:siempre|nunca) (?:te equivocas|lo haces bien|entiendes)'),
    word('(?:fallaste|reprobaste)'),
    word('otra vez (?:mal|te equivocaste)'),
    word('qué vergüenza'),
    word('(?:estoy|está|estamos) (?:muy )?decepcionad[oa]s? (?:de ti|contigo)'),
    word('deberías (?:ya )?saber(?:lo)?'),
    word('hasta un (?:bebé|niño pequeño) (?:puede|sabe)'),
    word('você é (?:ruim|péssim[oa]|terrível|inútil|burr[oa]|preguiços[oa]|lent[oa]|descuidad[oa]|um fracasso|uma decepção)(?: com| em)?'),
    word('você não é (?:bom|boa|poupador|poupadora|de números)'),
    word('você (?:sempre|nunca) (?:erra|acerta|entende)'),
    word('você falhou'),
    word('errou de novo'),
    word('que vergonha'),
    word('(?:estou|está|estamos) (?:muito )?decepcionad[oa]s? com você'),
    word('você (?:já )?deveria saber'),
    word('até um (?:bebê|criancinha) (?:consegue|sabe)'),
  ],
  // Praise aimed at a fixed trait (Kluger and DeNisi; Appendix B §1.8).
  'person-praise': [
    word("you(?:'re| are) (?:so |such an? |really )?(?:smart|clever|gifted|genius|a genius|a natural|brilliant)"),
    word('(?:good|smart) (?:boy|girl)'),
    word('eres (?:tan |muy |todo un |toda una |un |una )?(?:inteligente|list[oa]|genio|brillante|superdotad[oa])'),
    word('(?:buen|buena) (?:niño|niña)'),
    word('você é (?:tão |muito |um |uma )?(?:inteligente|esperto|esperta|gênio|brilhante|superdotad[oa])'),
    word('(?:bom|boa) (?:menino|menina)'),
  ],
  // A family's real money as a moral failing (B.27; Appendix B §2.7).
  'family-finance-moralizing': [
    word('(?:poor|low[- ]income|broke) (?:families|people|parents|kids) (?:are|just) (?:lazy|bad|irresponsible|careless|wasteful|to blame|lesser|worse)'),
    word("(?:poor|low[- ]income|broke) (?:families|people|parents|kids) (?:never|don't|can't) (?:save|try|work hard|plan|care)"),
    word('(?:bad|terrible|irresponsible|lazy|careless|hopeless) with money'),
    word('(?:your|their|his|her) (?:parents|family|mom|dad|mother|father) (?:waste|wastes|wasted|are bad|is bad|should be ashamed)'),
    word('only (?:lazy|irresponsible|careless|foolish) people'),
    word('rich (?:people|families|kids) are (?:better|smarter|nicer|good)'),
    word('(?:being|to be) poor is (?:a |your )?(?:fault|shame|choice|failure)'),
    word('(?:ashamed|embarrassed) (?:of|about) (?:your|their|being) (?:family|parents|poor|debt|money)'),
    word("(?:your|a) family(?:'s)? (?:fault|failure)"),
    word('(?:familias|personas|gente|niños|papás) pobres son (?:flojas?|flojos|malas?|malos|irresponsables|descuidad[oa]s|culpables|menos)'),
    word('(?:familias|personas|gente|niños|papás) pobres (?:no|nunca) (?:ahorran|se esfuerzan|trabajan|planean)'),
    word('(?:malo|mala|malos|malas|irresponsables?|flojos?|flojas?|descuidad[oa]s?) con el dinero'),
    word('(?:tus|sus) (?:papás|padres|familia|mamá|papá) (?:desperdician|malgastan|desperdicia|malgasta|deberían avergonzarse)'),
    word('solo (?:la gente|las personas) (?:floja|irresponsable|descuidada)'),
    word('(?:los|las) (?:ricos|ricas|personas ricas|familias ricas) son (?:mejores|más listas|más inteligentes)'),
    word('ser pobre es (?:una |tu )?(?:culpa|vergüenza|decisión|fracaso)'),
    word('vergüenza (?:de|por) (?:tu|su) familia'),
    word('(?:famílias|pessoas|gente|crianças|pais) pobres são (?:preguiços[oa]s|ruins|irresponsáveis|descuidad[oa]s|culpad[oa]s|menos)'),
    word('(?:famílias|pessoas|gente|crianças|pais) pobres (?:não|nunca) (?:poupam|se esforçam|trabalham|planejam)'),
    word('(?:ruim|ruins|irresponsáve(?:l|is)|preguiços[oa]s?|descuidad[oa]s?) com (?:o )?dinheiro'),
    word('(?:seus|teus) (?:pais|família|mãe|pai) (?:desperdiçam|desperdiça|gastam mal|gasta mal|deveriam ter vergonha)'),
    word('só (?:gente|pessoas) (?:preguiçosa|irresponsável|irresponsáveis|descuidada)'),
    word('(?:os|as) (?:ricos|ricas|pessoas ricas|famílias ricas) são (?:melhores|mais espertas|mais inteligentes)'),
    word('ser pobre é (?:uma |sua )?(?:culpa|vergonha|escolha|fracasso)'),
    word('vergonha d[aoe] (?:sua|tua) família'),
  ],
  // OD-1: nothing is spent by a wrong answer, and no counter of it is shown.
  'loss-mechanic': [
    word('(?:\\d+|no|zero|out of|lose an?|lost an?|extra|more) (?:lives|hearts|energy)'),
    word('(?:lives|hearts) (?:left|remaining)'),
    word('lost a (?:life|heart)'),
    word('(?:\\d+|sin|cero|pierdes una|perdiste una|te quedan|más) (?:vidas|corazones)'),
    word('(?:vidas|corazones) restantes'),
    word('perdiste (?:una vida|un corazón)'),
    word('(?:\\d+|sem|zero|perde uma|perdeu uma|restam|mais) (?:vidas|corações)'),
    word('(?:vidas|corações) restantes'),
    word('perdeu (?:uma vida|um coração)'),
  ],
  // Radesky et al. 2022, fabricated time pressure.
  'time-pressure': [
    word('hurry up'),
    word('hurry(?=\\s*[!,])'),
    word('only \\d+ (?:left|minutes? left|hours? left|seconds? left)'),
    word('last chance'),
    // An honest expiry notice ("the link expires in 30 days") is a disclosure, not pressure.
    word('(?:ends|expires|disappears) (?:soon|today|tonight|in \\d+ (?:seconds?|minutes?|hours?))'),
    word("before it(?:'s| is) gone"),
    word('limited[- ]time'),
    word("don't miss (?:out|it)"),
    word('(?:date prisa|apúrate|apresúrate)'),
    word('última oportunidad'),
    word('(?:termina|expira|vence|desaparece) (?:pronto|hoy|esta noche|en \\d+ (?:segundos?|minutos?|horas?))'),
    word('(?:tiempo limitado|por tiempo limitado)'),
    word('no te lo pierdas'),
    word('(?:apresse-se|se apresse)'),
    word('corra(?=\\s*[!,])'),
    word('última chance'),
    word('(?:termina|expira|acaba|desaparece) (?:logo|hoje|hoje à noite|em \\d+ (?:segundos?|minutos?|horas?))'),
    word('(?:tempo limitado|por tempo limitado)'),
    word('não perca'),
  ],
  // Radesky et al. 2022, parasocial relationship pressure: the character guilts the child.
  'parasocial-pressure': [
    word("(?:i|we|\\p{L}+) (?:will|'ll) (?:be|feel) (?:so )?(?:sad|lonely|upset|disappointed) (?:if|when) you (?:leave|go|stop|quit)"),
    word("don't (?:leave|go|abandon) (?:me|us)"),
    word('(?:i|we) (?:miss|missed) you'),
    word('(?:come back|return),? (?:i|we) (?:miss|need)'),
    word('(?:dina|zara|liruf|rho|dr\\.? rho|your mentor) (?:is|was|will be|feels) (?:sad|disappointed|crying|upset|lonely)'),
    word('(?:me|nos) (?:pondré|pondremos|voy a poner|vamos a poner) (?:muy )?trist[e]s? si (?:te vas|sales|paras)'),
    word('no (?:me|nos) (?:dejes|abandones)'),
    word('te (?:extraño|extrañamos|extrañé)'),
    word('(?:dina|zara|liruf|rho|dr\\.? rho|tu mentor) (?:está|estará|se siente) (?:trist[e]|decepcionad[oa]|sol[oa])'),
    word('(?:vou|vamos) ficar (?:muito )?trist[e]s? se você (?:sair|for|parar)'),
    word('não (?:me|nos) (?:deixe|abandone)'),
    word('(?:sinto|sentimos|senti) (?:sua|tua) falta'),
    word('(?:dina|zara|liruf|rho|dr\\.? rho|seu mentor) (?:está|estará|se sente|fica) (?:trist[e]|decepcionad[oa]|sozinh[oa])'),
  ],
  // Radesky et al. 2022, lures to purchase or to watch advertising (OD-5: no paywall exists).
  'purchase-lure': [
    word('buy now(?=\\s*[!.]|$)'),
    word('upgrade (?:now|to (?:premium|pro|plus))'),
    word('(?:go|get) (?:premium|pro|plus)'),
    word('unlock (?:now|instantly|with (?:coins|gems|premium|money))'),
    word('watch (?:an? )?(?:ad|video) (?:to|for)'),
    word('in-app purchases?'),
    word('subscribe (?:now|today)'),
    word('compra (?:ahora|ya)(?=\\s*[!.]|$)'),
    word('(?:mejora|pásate) a (?:premium|pro|plus)'),
    word('desbloquea (?:ahora|ya|al instante|con (?:monedas|gemas|premium|dinero))'),
    word('mira un (?:anuncio|video) (?:para|y)'),
    word('suscríbete (?:ahora|hoy|ya)'),
    word('compre (?:agora|já)(?=\\s*[!.]|$)'),
    word('(?:assine|mude para) (?:o )?(?:premium|pro|plus)'),
    word('desbloqueie (?:agora|já|na hora|com (?:moedas|gemas|premium|dinheiro))'),
    word('(?:veja|assista) (?:a )?um anúncio'),
  ],
  // Radesky et al. 2022, social pressure: comparison with other people.
  'social-pressure': [
    word('(?:all|most|\\d+) (?:of )?(?:your )?(?:friends|classmates|players|kids) (?:already|have already|are ahead)'),
    word('everyone (?:else )?(?:is|has) (?:ahead|already|finished|done)'),
    word("you(?:'re| are) (?:falling )?behind (?:your|other|everyone|the others)"),
    word('(?:your )?(?:rank|ranking|place) (?:dropped|fell|went down)'),
    word('(?:todos )?tus amigos ya'),
    word('todos (?:van|están|ya) (?:adelante|adelantados|terminaron)'),
    word('te estás quedando atrás'),
    word('(?:bajaste|caíste) (?:de|en el) (?:ranking|lugar)'),
    word('(?:todos )?(?:os )?seus amigos já'),
    word('todo mundo já (?:terminou|passou|está)'),
    word('você está ficando para trás'),
    word('(?:caiu|desceu) no ranking'),
  ],
  // B.23: babyish framing a teen or an adult reads as "for little kids" (Appendix B §2.9).
  'childish-framing': [
    word('kiddo'),
    word('little (?:ones?|buddy|champ|genius|learner|friend)'),
    word('sweetie'),
    word('big (?:boy|girl|kid)'),
    word('yay+'),
    word('super[- ]?duper'),
    word('wowee'),
    word('smarty(?:[- ]?pants)?'),
    word('(?:pequeñ[oa]|chiquit[oa]) (?:amig[oa]|campeón|campeona|genio)'),
    word('campeoncit[oa]'),
    word('niñ[oa] grande'),
    word('yupi'),
    word('peque(?:s)?'),
    word('(?:pequen[oa]|pequenin[oa]) (?:amig[oa]|campeão|campeã|gênio)'),
    word('campeãozinho'),
    word('criancinhas?'),
    word('oba+'),
    word('iupi'),
  ],
};

/** Every register forbids these, in every surface and every lesson. */
export const UNIVERSAL_FORBIDDEN: readonly LexiconId[] = [
  'self-global', 'person-praise', 'family-finance-moralizing', 'loss-mechanic',
  'time-pressure', 'parasocial-pressure', 'purchase-lure', 'social-pressure',
];

/** The lexicons a register forbids: the universal list plus its own. */
export function forbiddenLexicons(register: LearnerRegister): LexiconId[] {
  return [...UNIVERSAL_FORBIDDEN, ...REGISTERS[register].tone.forbids];
}

export interface LexiconMatch { lexicon: LexiconId; match: string }

/** Every forbidden phrase in `text`, at most one per lexicon. */
export function findLexicons(text: string, lexicons: readonly LexiconId[]): LexiconMatch[] {
  const found: LexiconMatch[] = [];
  for (const lexicon of lexicons) {
    for (const pattern of LEXICONS[lexicon]) {
      const match = pattern.exec(text);
      if (match) {
        found.push({ lexicon, match: match[1] ?? match[0].trim() });
        break;
      }
    }
  }
  return found;
}

/**
 * Feedback that praises with nothing named ("Great job!", "¡Excelente!").
 * Past the young register, praise must name the step or skill (B.20, B.23).
 */
const GENERIC_PRAISE = /^[\s¡!¿]*(?:(?:great|good|nice|awesome|amazing|perfect|excellent|fantastic|wonderful|super)(?: (?:job|work))?|well done|way to go|you did it|(?:muy )?bien(?: hecho)?|excelente|genial|perfecto|increíble|fantástico|lo lograste|muito bem|parabéns|ótimo|excelente|perfeito|incrível|mandou bem|conseguiu)[\s.!]*$/iu;

export function isGenericPraise(text: string): boolean {
  return GENERIC_PRAISE.test(text.trim());
}

/** Exclamations in one string (a Spanish "¡...!" pair counts once). */
export function exclamationCount(text: string): number {
  return (text.match(/!/g) ?? []).length;
}
