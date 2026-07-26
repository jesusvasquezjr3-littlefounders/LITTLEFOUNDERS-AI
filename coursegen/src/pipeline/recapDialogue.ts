// Dual-persona recap dialogue — Learn Your Way's audio-lesson trick
// (2026-07-25 analysis), rebuilt on our stack: their best-rated representation
// was a teacher-student conversation where the STUDENT persona never sees the
// source material, so its questions are authentically naive instead of
// scripted Socratic theater. Those naive questions are exactly the
// misconception-surfacing the contentPlaybook chases.
//
// This is an AUTHORING technique, not a new engine type: the output is a
// plain `story_dialogue` segment appended to the lesson (before its final
// checkpoint, so the recap lands where a recap belongs). It then passes the
// same gates + judge as everything else — nothing here ships ungated.
//
// Opt-in per lesson via the blueprint flag `recap_dialogue: true`.

import { completeDeepSeek } from '../providers/deepseek.js';
import type { UsageLedger } from '../providers/usage.js';
import type { LessonDocumentParsed } from '../contract/schema.js';

/** Total dialogue lines (teacher opens, student asks, alternating). Capped: every line is a paid TTS unit ×3 locales. */
const RECAP_LINES = 5;
const MAX_LINE_CHARS = 220;
const CANON = ['dina', 'liruf', 'rho', 'zara'] as const;
type Canon = (typeof CANON)[number];

export interface RecapDeps {
  ledger?: UsageLedger;
  complete?: typeof completeDeepSeek;
}

/** Teacher = the document's most-used narrator (falls back to dina); student = a different canon character (prefers liruf — the resident naive asker). */
export function pickPersonas(document: LessonDocumentParsed): { teacher: Canon; student: Canon } {
  const counts = new Map<Canon, number>();
  for (const segment of document.segments as unknown as Array<{ narrator?: { character?: string } }>) {
    const c = segment.narrator?.character as Canon | undefined;
    if (c && (CANON as readonly string[]).includes(c)) counts.set(c, (counts.get(c) ?? 0) + 1);
  }
  const teacher = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'dina';
  const student: Canon = teacher === 'liruf' ? 'zara' : 'liruf';
  return { teacher, student };
}

/** Learner-facing lesson prose the TEACHER may ground in (the student NEVER receives this). */
function lessonBrief(document: LessonDocumentParsed): string {
  const parts: string[] = [`Título: ${document.meta.title}`, `Objetivos: ${document.meta.objectives.join('; ')}`];
  for (const segment of document.segments as unknown as Array<Record<string, unknown>>) {
    if (typeof segment.prompt_md === 'string') parts.push(segment.prompt_md);
    if (typeof segment.explanation_md === 'string') parts.push(segment.explanation_md);
  }
  return parts.join('\n').slice(0, 4000);
}

const SHARED_STYLE =
  'Estás grabando un diálogo corto para niños (es-MX, cálido, natural, frases de máximo 2 oraciones). ' +
  'Responde SOLO con la siguiente línea del diálogo — sin comillas, sin nombre de personaje, sin acotaciones. ' +
  'Sin emojis (a lo sumo UNO en todo el diálogo, solo si de verdad suma). Nada de groserías ni dobles sentidos.';

/*
 * Deterministic emoji budget for the WHOLE recap dialogue. The appended
 * segment is story_dialogue (an emoji-allowed surface), but gate 7 caps a
 * segment's visible emojis — five warm kid-dialogue lines at temp 0.6 can
 * easily exceed it, and a gate failure here discards the entire paid write
 * (caught by the 2026-07-26 adversarial review). The prompt asks; this
 * enforces: the first emoji sequence survives, the rest are stripped.
 */
const EMOJI_SEQ = /(?:\p{Regional_Indicator}{2}|[\u{1F3FB}-\u{1F3FF}\u{FE0F}\u{200D}\u{20E3}]|\p{Extended_Pictographic})+/gu;

function stripExcessEmojis(text: string, budget: number): { text: string; used: number } {
  let used = 0;
  const out = text
    .replace(EMOJI_SEQ, (match) => {
      if (used < budget) {
        used++;
        return match;
      }
      return '';
    })
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([,.;:!?])/g, '$1')
    .trim();
  return { text: out, used };
}

// Static-first message assembly (AGENTS.md "An identical prompt prefix is a
// 10x discount"): persona + style lead; the moving dialogue tail comes last.
function teacherMessages(teacher: Canon, student: Canon, brief: string, dialogue: string[]): { role: 'system' | 'user'; content: string }[] {
  return [
    {
      role: 'system',
      content:
        `Eres ${teacher}, y acabas de dar una lección. Vas a repasarla conversando con ${student}, que NO estuvo en la lección. ` +
        'Explica con ejemplos concretos de la lección, corrige sus ideas equivocadas con cariño, y nunca inventes datos nuevos. ' +
        SHARED_STYLE,
    },
    {
      role: 'user',
      content: `LECCIÓN (solo tú la conoces):\n${brief}\n\nDIÁLOGO HASTA AHORA:\n${dialogue.join('\n') || '(vas a abrir la conversación con un resumen de UNA idea clave)'}\n\nTu siguiente línea:`,
    },
  ];
}

function studentMessages(student: Canon, teacher: Canon, dialogue: string[]): { role: 'system' | 'user'; content: string }[] {
  return [
    {
      role: 'system',
      content:
        `Eres ${student}. NO estuviste en la lección y NO sabes de qué trató — solo escuchas lo que ${teacher} te va contando. ` +
        'Haz LA pregunta ingenua y curiosa que haría un niño real: pide un ejemplo, confiesa una confusión, o entiende algo mal para que te corrijan. Nunca resumas ni des cátedra. ' +
        SHARED_STYLE,
    },
    {
      role: 'user',
      content: `DIÁLOGO HASTA AHORA:\n${dialogue.join('\n')}\n\nTu siguiente línea (una pregunta o duda sincera):`,
    },
  ];
}

export interface RecapLine {
  character: Canon;
  text_md: string;
}

/**
 * Iterates the two personas into RECAP_LINES alternating lines. The student
 * calls NEVER include the lesson brief — that blindness is the whole point,
 * and the tests pin it.
 */
export async function generateRecapLines(
  document: LessonDocumentParsed,
  deps: RecapDeps = {},
): Promise<RecapLine[]> {
  const complete = deps.complete ?? completeDeepSeek;
  const { teacher, student } = pickPersonas(document);
  const brief = lessonBrief(document);
  const dialogue: string[] = [];
  const lines: RecapLine[] = [];

  let emojiBudget = 1; // whole-dialogue budget — see stripExcessEmojis
  for (let i = 0; i < RECAP_LINES; i++) {
    const isTeacher = i % 2 === 0;
    const messages = isTeacher ? teacherMessages(teacher, student, brief, dialogue) : studentMessages(student, teacher, dialogue);
    const result = await complete(
      { messages, temperature: 0.6, maxTokens: 400 },
      { operation: 'recap-dialogue', ledger: deps.ledger },
    );
    const raw = result.content.trim().replace(/^["“]|["”]$/g, '').slice(0, MAX_LINE_CHARS);
    const { text, used } = stripExcessEmojis(raw, emojiBudget);
    emojiBudget -= used;
    if (text.length === 0) throw new Error(`recap-dialogue: empty ${isTeacher ? 'teacher' : 'student'} line at turn ${i + 1}`);
    const character = isTeacher ? teacher : student;
    dialogue.push(`${character}: ${text}`);
    lines.push({ character, text_md: text });
  }
  return lines;
}

/**
 * Returns a copy of the document with the recap dialogue appended as a
 * story_dialogue segment — BEFORE the final checkpoint when one closes the
 * lesson (a recap belongs before "how did we do?"), else at the end. The
 * caller re-runs gates on the result; meta.cast is completed if the student
 * persona is new to the lesson (gate: cast must list every character used).
 */
export function appendRecapSegment(document: LessonDocumentParsed, lines: RecapLine[]): LessonDocumentParsed {
  const clone = structuredClone(document) as unknown as {
    meta: { cast: string[] };
    segments: Array<Record<string, unknown>>;
  };
  const segment = {
    id: 'recap-charla',
    type: 'story_dialogue',
    prompt_md: 'Antes de terminar, escucha este repaso rápido.',
    difficulty: 1,
    xp: 0,
    payload: { lines: lines.map((l) => ({ character: l.character, text_md: l.text_md })) },
  };
  for (const line of lines) {
    if (!clone.meta.cast.includes(line.character)) clone.meta.cast.push(line.character);
  }
  const last = clone.segments[clone.segments.length - 1];
  if (last && last.type === 'checkpoint') clone.segments.splice(clone.segments.length - 1, 0, segment);
  else clone.segments.push(segment);
  return clone as unknown as LessonDocumentParsed;
}
