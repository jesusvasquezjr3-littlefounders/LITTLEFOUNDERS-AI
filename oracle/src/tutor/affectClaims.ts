/*
 * THE MENTOR NEVER DECLARES HOW THE LEARNER FEELS (Block C non-negotiable;
 * Appendix D §1.7).
 *
 * Affect detection from conversation is weak and biased evidence, and a
 * child told "you seem tired" or "you look frustrated" is being labelled by
 * a machine that cannot know. The session-end offer (C.8/C.12) is exactly the
 * turn where a helpful model reaches for that sentence, so the delivered text
 * is CHECKED rather than only instructed: a draft that attributes an
 * emotional or fatigue state to the learner is repaired once and never
 * delivered.
 *
 * NARROW BY DESIGN. It matches a second-person claim ("you seem/look/sound/
 * are/feel/get …", "I can tell you're …") followed by a state word within a
 * short span, in EN, es-MX and pt-BR. Questions are not claims — "are you
 * tired?" is not a declaration, and the humble check-in move (C.19) asks
 * exactly that kind of thing — and neither is talk about a third party or
 * about the Mentor itself ("I get tired too"). Anything it cannot read as a
 * claim is left alone: a false positive costs one repair of a good turn.
 */

const STATES_EN =
  '(tired|sleepy|exhausted|worn out|bored|frustrated|upset|annoyed|angry|mad|sad|stressed|anxious|nervous|worried|overwhelmed|confused|discouraged|fed up|unmotivated|distracted|lost interest|losing interest|done with this)';
const STATES_ES =
  '(cansad[oa]s?|agotad[oa]s?|aburrid[oa]s?|frustrad[oa]s?|molest[oa]s?|enojad[oa]s?|triste|estresad[oa]s?|ansios[oa]s?|nervios[oa]s?|preocupad[oa]s?|abrumad[oa]s?|confundid[oa]s?|desanimad[oa]s?|harto|harta|distraíd[oa]s?|distraid[oa]s?|con sueño|sin ganas)';
const STATES_PT =
  '(cansad[oa]s?|exaust[oa]s?|entediad[oa]s?|frustrad[oa]s?|chatead[oa]s?|irritad[oa]s?|brav[oa]|triste|estressad[oa]s?|ansios[oa]s?|nervos[oa]s?|preocupad[oa]s?|sobrecarregad[oa]s?|confus[oa]s?|desanimad[oa]s?|distraíd[oa]s?|distraid[oa]s?|com sono|sem vontade)';

const CLAIMS: RegExp[] = [
  // "you seem tired", "you're getting a bit bored", "you look really frustrated"
  new RegExp(
    `\\b(you|you're|you are|youre)\\s+(seem|seems|look|looks|sound|sounds|feel|feels|appear|appear to be|are|'re|must be|might be|may be|are getting|'re getting|getting|seem to be|look like you'?re)\\s+(a (little|bit|little bit)\\s+|kind of\\s+|pretty\\s+|really\\s+|so\\s+|very\\s+|quite\\s+)?${STATES_EN}\\b`,
    'i',
  ),
  new RegExp(`\\byou'?re\\s+(a (little|bit)\\s+|kind of\\s+|pretty\\s+|really\\s+|so\\s+|very\\s+|getting\\s+)?${STATES_EN}\\b`, 'i'),
  new RegExp(`\\bi can (tell|see|hear) (that )?you'?(re| are)\\s+(a (little|bit)\\s+|really\\s+|getting\\s+)?${STATES_EN}\\b`, 'i'),
  // "(te) ves/pareces/estás/te noto cansado", "se nota que estás aburrida"
  new RegExp(
    `\\b(te ves|pareces|estás|estas|te noto|te siento|te oigo|te escucho|se nota que estás|se nota que estas|creo que estás|creo que estas)\\s+(un poco\\s+|medio\\s+|muy\\s+|bastante\\s+|algo\\s+)?${STATES_ES}`,
    'i',
  ),
  // "você parece/está cansado", "percebo que você está entediada"
  new RegExp(
    `\\b(você parece|voce parece|você está|voce esta|você tá|voce ta|cê tá|ce ta|parece que você está|parece que voce esta|percebo que você está|percebo que voce esta|sinto que você está|sinto que voce esta)\\s+(um pouco\\s+|meio\\s+|muito\\s+|bem\\s+|bastante\\s+)?${STATES_PT}`,
    'i',
  ),
];

/** Splits into sentences, keeping the terminal punctuation so questions can be told apart. */
function sentences(text: string): string[] {
  return text.match(/[^.!?¡¿]*[.!?]+|[^.!?¡¿]+$/g)?.map((s) => s.trim()).filter(Boolean) ?? [];
}

/**
 * True when the text DECLARES an emotional or fatigue state of the learner.
 * A question ("are you tired?", "¿estás cansado?") is not a declaration.
 */
export function claimsLearnerAffect(text: string): boolean {
  for (const sentence of sentences(text.normalize('NFC'))) {
    if (sentence.endsWith('?')) continue;
    for (const pattern of CLAIMS) {
      const match = pattern.exec(sentence);
      if (!match) continue;
      // A conditional is not a claim: "if you're confused, that is okay",
      // "si estás cansado, paramos", "se você está cansado…".
      const before = sentence.slice(0, match.index).toLowerCase();
      if (/(^|\s)(if|when|whenever|in case|si|cuando|por si|se|quando|caso)\s+$/.test(before)) continue;
      return true;
    }
  }
  return false;
}
