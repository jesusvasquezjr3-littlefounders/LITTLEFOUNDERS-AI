/*
 * ZERO-TTS REPAIR GATE.
 *
 * A repaired lesson document is ACCEPTED only if every narratable unit of text
 * it contains ALREADY EXISTED in the original document. `speech_assets.speech_hash`
 * is sha256 over the narration TEXT (migration 0015), so an unchanged text is a
 * guaranteed cache hit and costs nothing; a single new narrated sentence is a
 * paid DashScope call. The definition of "narratable" is imported from Echo's
 * own production extractor — never reimplemented here, so the two cannot drift.
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, basename } from 'node:path';
// Echo's PRODUCTION extractor, imported rather than reimplemented so the gate's
// idea of "narrated" can never drift from what actually gets synthesised.
import { extractNarratables } from '../../../audiogen/src/narrate/extractNarratables.js';

const LOCALES = ['es-MX', 'en-US', 'pt-BR'] as const;
const MIN_SEGMENTS = 5;
const MIN_GRADED = 2;

/*
 * Segment types whose grader dereferences `segment.answer` — derived from Core's
 * own family graders, not hand-listed. The complement (coin_count, savings_goal,
 * order_steps, budget_fit, …) computes the correct answer from the payload, so an
 * absent key there is CORRECT and must not be reported as a defect.
 */
const NEEDS_ANSWER_KEY = new Set([
  'best_decision','cause_effect','code_order','compare_table','confidence_quiz','count_objects',
  'debug_hunt','dialogue_choice','equation_builder','estimate_slider','evidence_hunt','fact_opinion',
  'fair_trade','fill_blank','flash_match','group_sets','interest_peek','lightning_round','machine_io',
  'match_pairs','measure_read','needs_wants','number_input','number_line','odd_one_out','pattern_complete',
  'picture_choice','piggy_split','price_compare','quiz_mcq','read_chart','red_flags','sort_buckets',
  'speed_tap','spot_error','story_branch','true_false','type_answer','would_you_rather','yes_no_cases',
]);

type Doc = { meta?: { objectives?: unknown[]; locale?: string }; segments?: any[] };

export interface GateFinding { code: string; detail: string }

function narrationTexts(doc: Doc): string[] {
  // extractNarratables applies stripMarkdown + normalizeForSpeech — the exact
  // text Echo hashes into speech_assets.
  return extractNarratables(doc as never).map((u) => u.text);
}

export function checkRepair(lessonId: string, original: any, repaired: any): GateFinding[] {
  const f: GateFinding[] = [];

  for (const locale of LOCALES) {
    const orig = original.locales?.[locale]?.document as Doc | undefined;
    const rep = repaired.locales?.[locale]?.document as Doc | undefined;

    if (!orig) { f.push({ code: 'ORIGINAL_LOCALE_MISSING', detail: locale }); continue; }
    if (!rep) { f.push({ code: 'LOCALE_MISSING', detail: `${locale} absent — all three locales are required (§1.8)` }); continue; }

    // --- THE MONEY RULE: no narrated text may be new ---
    let origTexts: string[]; let repTexts: string[];
    try { origTexts = narrationTexts(orig); repTexts = narrationTexts(rep); }
    catch (e) { f.push({ code: 'NARRATION_EXTRACT_FAILED', detail: `${locale}: ${(e as Error).message}` }); continue; }

    const origSet = new Set(origTexts);
    const introduced = [...new Set(repTexts)].filter((t) => !origSet.has(t));
    for (const t of introduced.slice(0, 5)) {
      f.push({ code: 'NEW_NARRATED_TEXT', detail: `${locale}: would require paid TTS → "${t.slice(0, 110)}"` });
    }
    if (introduced.length > 5) {
      f.push({ code: 'NEW_NARRATED_TEXT', detail: `${locale}: +${introduced.length - 5} more new narrated strings` });
    }

    // --- segment identity: removal allowed, rename/addition not (keeps the
    //     lesson_documents.audio manifest addressable without re-narration) ---
    const origIds = new Set((orig.segments ?? []).map((s: any) => s.id));
    const repIds = (rep.segments ?? []).map((s: any) => s.id);
    for (const id of repIds) {
      if (!origIds.has(id)) f.push({ code: 'NEW_SEGMENT_ID', detail: `${locale}: "${id}" — segments may be removed or reordered, never added or renamed` });
    }
    if (new Set(repIds).size !== repIds.length) f.push({ code: 'DUPLICATE_SEGMENT_ID', detail: locale });

    // --- structural floor ---
    const segs = rep.segments ?? [];
    if (segs.length < MIN_SEGMENTS) f.push({ code: 'TOO_FEW_SEGMENTS', detail: `${locale}: ${segs.length} < ${MIN_SEGMENTS}` });
    const graded = segs.filter((s: any) => (s.xp || 0) > 0);
    if (graded.length < MIN_GRADED) f.push({ code: 'TOO_FEW_GRADED', detail: `${locale}: ${graded.length} graded < ${MIN_GRADED}` });
    if (!(rep.meta?.objectives ?? []).length) f.push({ code: 'NO_OBJECTIVES', detail: locale });
    if (rep.meta?.locale !== locale) f.push({ code: 'LOCALE_META_MISMATCH', detail: `${locale}: meta.locale = ${String(rep.meta?.locale)}` });
    for (const s of segs) {
      if (!s.id || !s.type || s.payload === undefined) f.push({ code: 'MALFORMED_SEGMENT', detail: `${locale}: ${String(s.id ?? '(no id)')}` });
    }

    // --- answer keys must cover every KEY-DEPENDENT graded segment ---
    // Only flag a segment the repair is responsible for: a key that was already
    // absent before the repair is pre-existing state, not damage this patch did.
    const keys = repaired.locales[locale].answer_keys ?? original.locales[locale].answer_keys ?? {};
    const origKeys = original.locales?.[locale]?.answer_keys ?? {};
    for (const s of graded) {
      if (!NEEDS_ANSWER_KEY.has(s.type)) continue;
      if (!(s.id in keys) && s.id in origKeys) {
        f.push({ code: 'ANSWER_KEY_DROPPED', detail: `${locale}: graded segment "${s.id}" (${s.type}) lost the answer key it used to have` });
      }
    }
  }

  // --- cross-locale parity: the same lesson in three languages ---
  const idsPerLocale = LOCALES.map((l) => (repaired.locales?.[l]?.document?.segments ?? []).map((s: any) => s.id).join('|'));
  if (new Set(idsPerLocale).size > 1) {
    f.push({ code: 'LOCALE_SEGMENT_DRIFT', detail: 'the three locales do not contain the same segments in the same order' });
  }

  return f;
}

// ---------- CLI ----------
if (process.argv[1]?.endsWith('gate.ts')) {
  const [corpusDir, repairsDir, outPath] = process.argv.slice(2);
  const files = readdirSync(repairsDir).filter((n) => n.endsWith('.json'));
  const results: any[] = [];
  let pass = 0, fail = 0;

  for (const name of files) {
    const repaired = JSON.parse(readFileSync(join(repairsDir, name), 'utf8'));
    const lessonId = repaired.lesson_id ?? basename(name, '.json');
    let original: any;
    try { original = JSON.parse(readFileSync(join(corpusDir, 'docs', `${lessonId}.json`), 'utf8')); }
    catch { results.push({ lessonId, file: name, ok: false, findings: [{ code: 'ORIGINAL_NOT_FOUND', detail: lessonId }] }); fail++; continue; }

    const findings = checkRepair(lessonId, original, repaired);
    const ok = findings.length === 0;
    ok ? pass++ : fail++;
    results.push({ lessonId, file: name, ok, findings });
  }

  const byCode: Record<string, number> = {};
  for (const r of results) for (const x of r.findings) byCode[x.code] = (byCode[x.code] || 0) + 1;

  const summary = { checked: results.length, pass, fail, findings_by_code: byCode, results };
  if (outPath) writeFileSync(outPath, JSON.stringify(summary, null, 2));
  console.log(JSON.stringify({ checked: results.length, pass, fail, findings_by_code: byCode }, null, 2));
  for (const r of results.filter((x) => !x.ok).slice(0, 20)) {
    console.log(`\nFAIL ${r.lessonId}`);
    for (const x of r.findings.slice(0, 6)) console.log(`  [${x.code}] ${x.detail}`);
  }
  process.exit(fail > 0 ? 1 : 0);
}
