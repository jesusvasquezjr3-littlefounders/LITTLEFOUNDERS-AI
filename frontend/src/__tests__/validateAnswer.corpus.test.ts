import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { validateAnswer, extractCorrectId } from '@/components/lessons/engine/hooks/useLessonState';

/**
 * Corpus-driven regression guard.
 *
 * For the exercise types whose CORRECT answer can be synthesized deterministically
 * from the real lesson JSON, we feed that synthesized correct answer to validateAnswer
 * and assert it is accepted. This catches any regression that would turn a genuinely
 * correct answer into a false negative (the bug class this work fixes) across the
 * entire production corpus — not just hand-picked samples.
 *
 * If the corpus is not present (e.g. CI without the backend checked out), the suite
 * is skipped rather than failing.
 */
const CORPUS = join(process.cwd(), '..', 'backend', 'lesson_engine', 'littlefounders_lessons');

function walk(dir: string): string[] {
    const out: string[] = [];
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const p = join(dir, entry.name);
        if (entry.isDirectory()) out.push(...walk(p));
        else if (entry.name.endsWith('.json')) out.push(p);
    }
    return out;
}

const hasCorpus = existsSync(CORPUS);

(hasCorpus ? describe : describe.skip)('validateAnswer — real corpus regression', () => {
    const files = hasCorpus ? walk(CORPUS) : [];
    const exercises: any[] = [];
    for (const f of files) {
        try {
            const d = JSON.parse(readFileSync(f, 'utf8'));
            for (const ex of (d.content_es || [])) {
                if (ex && typeof ex === 'object') exercises.push({ ...ex, _file: f });
            }
        } catch { /* skip malformed */ }
    }

    it('loaded a substantial corpus', () => {
        expect(exercises.length).toBeGreaterThan(10000);
    });

    // ── multiple_choice: correct = correctOptionId / correctOptionIds ──
    it('multiple_choice: synthesized correct answer is accepted', () => {
        const fails: string[] = [];
        let checked = 0;
        for (const ex of exercises.filter(e => e.type === 'multiple_choice')) {
            const ca = ex.correct_answer || {};
            if (Array.isArray(ca.correctOptionIds)) {
                checked++;
                if (!validateAnswer(ex, ca.correctOptionIds)) fails.push(ex._file);
            } else if (ca.correctOptionId != null) {
                checked++;
                if (!validateAnswer(ex, String(ca.correctOptionId))) fails.push(ex._file);
            }
        }
        expect(checked).toBeGreaterThan(1000);
        expect(fails.slice(0, 10)).toEqual([]);
    });

    // ── true_false: correct = isTrue boolean ──
    it('true_false: the true isTrue boolean is accepted', () => {
        const fails: string[] = [];
        let checked = 0;
        for (const ex of exercises.filter(e => e.type === 'true_false')) {
            const isTrue = ex.correct_answer?.isTrue;
            if (typeof isTrue === 'boolean') {
                checked++;
                if (!validateAnswer(ex, isTrue)) fails.push(ex._file);
                if (validateAnswer(ex, !isTrue)) fails.push(ex._file + ' (wrong accepted)');
            }
        }
        expect(checked).toBeGreaterThan(1000);
        expect(fails.slice(0, 10)).toEqual([]);
    });

    // ── sequencing: correct = sequence array ──
    it('sequencing: the correct sequence is accepted', () => {
        const fails: string[] = [];
        let checked = 0;
        for (const ex of exercises.filter(e => e.type === 'sequencing')) {
            const seq = ex.correct_answer?.sequence;
            if (Array.isArray(seq) && seq.length > 0) {
                checked++;
                if (!validateAnswer(ex, seq.map(String))) fails.push(ex._file);
            }
        }
        expect(checked).toBeGreaterThan(500);
        expect(fails.slice(0, 10)).toEqual([]);
    });

    // ── tap_action: correct = items with isTarget, else correct_answer.targetIds ──
    it('tap_action: tapping exactly the targets is accepted', () => {
        const fails: string[] = [];
        let checked = 0;
        for (const ex of exercises.filter(e => e.type === 'tap_action')) {
            const items = ex.content?.items || [];
            let targets = items.filter((i: any) => i.isTarget === true).map((i: any) => String(i.id));
            if (targets.length === 0 && Array.isArray(ex.correct_answer?.targetIds)) {
                targets = ex.correct_answer.targetIds.map(String);
            }
            if (targets.length > 0) {
                checked++;
                if (!validateAnswer(ex, targets)) fails.push(ex._file);
            }
        }
        expect(checked).toBeGreaterThan(100);
        expect(fails.slice(0, 10)).toEqual([]);
    });

    // ── spot_trap: synthesize the correct selection for id-based shapes ──
    it('spot_trap: synthesized correct selection is accepted (id shapes)', () => {
        const fails: string[] = [];
        let checked = 0;
        for (const ex of exercises.filter(e => e.type === 'spot_trap')) {
            const ca = ex.correct_answer || {};
            let want: string[] | null = null;
            const arr = ca.trapIds ?? ca.correctTrapIds ?? ca.correctTraps ?? ca.targetIds ?? ca.correctOptionIds;
            const single = ca.correctOptionId ?? ca.trapId ?? ca.correctTrapId ?? ca.targetId
                ?? ca.incorrectStatementId ?? ca.incorrectPlanId ?? ca.incorrectOptionId
                ?? ca.correctStatementId ?? ca.trapStepId ?? ca.trapSegmentId ?? ca.correctPlanId;
            if (Array.isArray(arr) && arr.length > 0) want = arr.map(String);
            else if (single != null) want = [String(single)];
            if (want) {
                checked++;
                if (!validateAnswer(ex, want)) fails.push(`${ex._file} :: ${JSON.stringify(ca)}`);
            }
        }
        expect(checked).toBeGreaterThan(800);
        expect(fails.slice(0, 10)).toEqual([]);
    });

    // ── comparison / case / decision (now renderable): the resolved correct id is accepted ──
    it('comparison/case/decision: extracted correct id is accepted', () => {
        const TYPES = ['comparison', 'compare', 'comparison_chart', 'comparison_table',
            'comparison_slider', 'comparison_matrix', 'comparison_challenge',
            'case_study', 'case_real', 'decision_challenge', 'decision_matrix'];
        const fails: string[] = [];
        let checked = 0;
        for (const exr of exercises.filter(e => TYPES.includes(e.type))) {
            const id = extractCorrectId(exr.correct_answer);
            if (id !== undefined) {
                checked++;
                if (!validateAnswer(exr, String(id))) fails.push(`${exr._file} :: ${JSON.stringify(exr.correct_answer)}`);
            }
        }
        expect(checked).toBeGreaterThan(150);
        expect(fails.slice(0, 10)).toEqual([]);
    });

    // ── classification: synthesize the user map independently, assert accepted ──
    it('classification: synthesized correct map is accepted (common shapes)', () => {
        const fails: string[] = [];
        let checked = 0;
        for (const ex of exercises.filter(e => e.type === 'classification')) {
            const ca = ex.correct_answer;
            const cats = ex.content?.categories;
            // Independent name->id resolver (mirrors intent, not implementation)
            const nameToId: Record<string, string> = {};
            if (Array.isArray(cats)) cats.forEach((c: any) => {
                const id = c?.id ?? c?.value;
                if (id == null) return;
                nameToId[String(id).toLowerCase()] = String(id);
                [c?.name, c?.label, c?.title].forEach((n: any) => { if (n != null) nameToId[String(n).toLowerCase()] = String(id); });
            });
            const res = (k: any) => nameToId[String(k).toLowerCase()] ?? String(k);

            // Build {itemId: catId} from the most common shapes only.
            let unwrap = ca;
            for (const w of ['classifications', 'classification', 'categoryAssignments', 'matches', 'mapping', 'itemCategoryMap', 'mappings']) {
                if (unwrap && typeof unwrap === 'object' && !Array.isArray(unwrap) && unwrap[w] != null && typeof unwrap[w] === 'object') { unwrap = unwrap[w]; break; }
            }
            let map: Record<string, string> | null = null;
            if (Array.isArray(unwrap)) {
                map = {};
                unwrap.forEach((el: any) => { if (el?.itemId != null && el?.categoryId != null) map![String(el.itemId)] = res(el.categoryId); });
            } else if (unwrap && typeof unwrap === 'object') {
                const keys = Object.keys(unwrap);
                if (keys.length) {
                    const first = (unwrap as any)[keys[0]];
                    if (Array.isArray(first)) { // inverted
                        map = {};
                        keys.forEach(catKey => (unwrap as any)[catKey].forEach((iid: any) => { map![String(iid)] = res(catKey); }));
                    } else if (typeof first === 'string') { // direct
                        map = {};
                        keys.forEach(iid => { map![String(iid)] = res((unwrap as any)[iid]); });
                    }
                }
            }
            // Only assert when we can synthesize AND every content item is covered.
            const items = ex.content?.items;
            if (map && Array.isArray(items) && items.length > 0 && items.every((it: any) => map![String(it.id)] != null)) {
                checked++;
                if (!validateAnswer(ex, map)) fails.push(`${ex._file} :: ${JSON.stringify(ca)}`);
            }
        }
        expect(checked).toBeGreaterThan(500);
        expect(fails.slice(0, 10)).toEqual([]);
    });
});
