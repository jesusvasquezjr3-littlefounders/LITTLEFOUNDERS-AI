import type { Locale } from '../context/schema.js';
import { stripInvisible } from './untrusted.js';

/*
 * Layer 4 of the injection/safety stack (/ORACLE.md §5): classify the
 * learner's utterance BEFORE the model sees it.
 *
 * This is a deterministic first pass, on purpose. A model-based classifier is
 * better at nuance and worse at three things that matter more here: it costs a
 * round trip on every turn, it can itself be talked out of a verdict by the
 * text it is classifying, and it is unavailable exactly when the network is
 * having a bad day. So the cheap pass runs always and fails CLOSED into a
 * scripted response; a model pass may be layered on top later without moving
 * this file.
 *
 * Two things this deliberately does NOT try to be:
 *
 * - A profanity filter. A child swearing at a tutor is a conversation to have,
 *   not an incident to log, and a swear list in three locales is a maintenance
 *   sink that catches nothing dangerous.
 * - Complete. Pattern matching cannot enumerate distress. The value is that
 *   the OBVIOUS cases never reach a language model and never get a generated
 *   reply — a child who says they want to hurt themselves must hear something
 *   a human wrote, every time, not something a model improvised.
 */

export const SAFETY_CATEGORIES = [
  'self_harm',
  'abuse_disclosure',
  'adult_content',
  'grooming_pattern',
  'personal_data',
  'injection_attempt',
] as const;

export type SafetyCategory = (typeof SAFETY_CATEGORIES)[number];
export type Severity = 'low' | 'medium' | 'high';

export interface Classification {
  category: SafetyCategory | null;
  severity: Severity;
  /** What the runtime must do about it. */
  action: 'allow' | 'scripted_response' | 'turn_blocked' | 'session_stopped';
}

const ALLOWED: Classification = { category: null, severity: 'low', action: 'allow' };

interface Rule {
  category: SafetyCategory;
  severity: Severity;
  action: Classification['action'];
  patterns: RegExp[];
}

/*
 * Patterns are written per meaning, across all three locales in one rule, so a
 * category cannot be protected in Spanish and open in Portuguese — which is
 * exactly what happens when locale files drift apart.
 *
 * They are intentionally loose. A false positive costs a scripted, kind reply
 * and a guardian-visible flag. A false negative costs a generated reply to a
 * child in distress. Those are not comparable, so the threshold is not set in
 * the middle.
 */
const RULES: Rule[] = [
  {
    category: 'self_harm',
    severity: 'high',
    action: 'session_stopped',
    patterns: [
      /\b(kill|hurt|cut)\s+(my\s?self|me)\b/i,
      /\bi\s+(want|wanna)\s+to\s+die\b/i,
      /\b(suicide|suicidal)\b/i,
      /\bno\s+quiero\s+(vivir|seguir)\b/i,
      /\b(matarme|lastimarme|hacerme\s+da[ñn]o)\b/i,
      /\bquiero\s+morir(me)?\b/i,
      /\b(me\s+matar|me\s+machucar|suic[íi]dio)\b/i,
      /\bn[ãa]o\s+quero\s+(viver|mais\s+viver)\b/i,
    ],
  },
  {
    category: 'abuse_disclosure',
    severity: 'high',
    action: 'session_stopped',
    patterns: [
      /\b(someone|somebody|he|she|they)\s+(hits|hit|beats|beat|touches|touched)\s+me\b/i,
      /\bi\s+am\s+(scared|afraid)\s+of\s+(my|him|her|them)\b/i,
      /\bme\s+(pega|peg[óo]|golpea|golpe[óo]|toca|toc[óo])\b/i,
      /\btengo\s+miedo\s+de\s+mi\s+(pap[áa]|mam[áa]|t[íi]o|t[íi]a|hermano|hermana)\b/i,
      /\bme\s+(bate|bateu|machuca|machucou|toca|tocou)\b/i,
      /\btenho\s+medo\s+d[oa]\s+meu?\b/i,
    ],
  },
  {
    category: 'adult_content',
    severity: 'medium',
    action: 'scripted_response',
    patterns: [
      /\b(sex|sexual|porn|nude|naked)\b/i,
      /\b(sexo|sexual|porno|desnud[oa])\b/i,
      /\b(pelad[oa]|nu[az]|pornografia)\b/i,
    ],
  },
  {
    category: 'grooming_pattern',
    severity: 'high',
    action: 'session_stopped',
    patterns: [
      /\b(don'?t|do\s+not)\s+tell\s+(your|my)\s+(mom|dad|parents|mum)\b/i,
      /\b(meet|see)\s+me\s+(alone|in\s+person)\b/i,
      /\bno\s+le\s+digas\s+a\s+(tu|mi)s?\s+(pap[áa]|mam[áa]|padres)\b/i,
      /\bn[ãa]o\s+conte\s+(pro|para\s+o|pra)\s+seu\s+(pai|m[ãa]e)\b/i,
    ],
  },
  {
    /*
     * A child volunteering their address or phone number is the failure mode
     * §1.9 exists for. The turn is BLOCKED rather than merely flagged: the
     * text must not reach the model at all, because once it is in the context
     * window it is already at a third party.
     */
    category: 'personal_data',
    severity: 'medium',
    action: 'turn_blocked',
    patterns: [
      /\b\d{1,5}\s+[A-Za-zÀ-ÿ]+\s+(street|st|avenue|ave|road|rd|calle|avenida|rua)\b/i,
      /\b(\+?\d[\d\s().-]{7,})\b/,
      /\b[\w.+-]+@[\w-]+\.[\w.]{2,}\b/i,
      /\bmy\s+(address|phone\s?number|school)\s+is\b/i,
      /\bmi\s+(direcci[óo]n|tel[ée]fono|escuela)\s+es\b/i,
      /\bmeu\s+(endere[çc]o|telefone|col[ée]gio|escola)\s+[ée]\b/i,
    ],
  },
  {
    /*
     * Injection attempts. Blocked rather than stopped: a curious ten year old
     * typing "ignore your instructions" is playing, not attacking, and ending
     * their session over it would be both rude and useless. The turn simply
     * does not reach the model and the tutor answers in character.
     */
    category: 'injection_attempt',
    severity: 'low',
    action: 'turn_blocked',
    patterns: [
      /\bignore\s+(all\s+)?(previous|prior|above|your)\s+(instructions?|prompts?|rules?)\b/i,
      /\b(system|developer)\s+(prompt|message|instruction)\b/i,
      /\byou\s+are\s+now\s+(a|an)\b/i,
      /\b(reveal|show|print|repeat)\s+(your|the)\s+(prompt|instructions?|rules?|system)\b/i,
      /\bact\s+as\s+(if\s+you\s+are\s+)?(a|an)\s+\w+\s+(with\s+no|without)\s+(rules?|restrictions?|filters?)\b/i,
      /\b(jailbreak|DAN\s+mode|developer\s+mode)\b/i,
      /\bignora\s+(todas\s+)?(las\s+)?instrucciones\b/i,
      /\b(mu[ée]strame|dime|repite|rep[íi]teme)\s+(tus?|el|las)\s+(prompt|instrucciones|sistema|reglas)\b/i,
      /\bignore\s+(todas\s+)?(as\s+)?instru[çc][õo]es\b/i,
      /\b(mostre|diga|repita)\s+(suas?|seu|o|as)\s+(prompt|instru[çc][õo]es|sistema|regras)\b/i,
      /<\|?(im_start|im_end|system|endoftext)\|?>/i,
      /\[\s*(system|assistant|developer)\s*\]/i,
    ],
  },
];

/**
 * Classifies one learner utterance.
 *
 * `locale` is accepted but deliberately unused for matching: every rule
 * already spans all three languages, and gating a category on the UI locale
 * would leave a bilingual child's Spanish disclosure unmatched in an English
 * session. It stays in the signature because a future model-backed pass will
 * need it.
 */
export function classifyLearnerInput(text: string, _locale: Locale): Classification {
  /*
   * MUST strip invisible codepoints before matching, not just normalize.
   *
   * Found by an adversarial review, 2026-08-29: a single zero-width space
   * inserted inside a trigger word — a one-paste evasion, not a novel attack —
   * breaks every regex's word-boundary/literal match here, while
   * `fenceUntrusted`'s `stripInvisible` (this same function) reconstructs the
   * exact, fully legible phrase before it reaches the model. `text.normalize`
   * alone does nothing about it: NFC does not touch zero-width or bidi
   * codepoints. The result was that the ONE universal, always-on gate this
   * file exists to be could be defeated on the self-harm and prompt-injection
   * rules by anyone who knows to pad a word with an invisible character —
   * while the model still received the clean, readable phrase, since fencing
   * happens downstream of this call and strips the same characters anyway.
   */
  const normalized = stripInvisible(text);
  // Highest-severity match wins, so "I want to die" is not downgraded by also
  // tripping a lower-severity rule later in the list.
  let worst: Classification | null = null;
  const rank: Record<Severity, number> = { low: 0, medium: 1, high: 2 };

  for (const rule of RULES) {
    if (!rule.patterns.some((p) => p.test(normalized))) continue;
    const candidate: Classification = {
      category: rule.category,
      severity: rule.severity,
      action: rule.action,
    };
    if (!worst || rank[candidate.severity] > rank[worst.severity]) worst = candidate;
  }

  return worst ?? ALLOWED;
}
