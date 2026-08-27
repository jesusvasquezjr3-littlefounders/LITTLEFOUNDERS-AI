/*
 * Deterministic repair-op applier.
 *
 * Agents emit small, auditable EDIT OPS instead of whole rewritten documents.
 * This file turns (original 3-locale record + ops) into repaired documents and
 * runs them through the zero-TTS gate. Fields nobody named are copied through
 * untouched by construction, so an agent cannot silently mangle a document it
 * was only meant to nudge.
 */
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { checkRepair } from './gate.js';

const LOCALES = ['es-MX', 'en-US', 'pt-BR'] as const;
type Locale = (typeof LOCALES)[number];

export interface Op {
  op: string;
  segment_id?: string;
  path?: string;
  value?: unknown;
  values?: Partial<Record<Locale, unknown>>;
  order?: string[];
  icons?: Record<string, string>;
}

const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x));

/**
 * Resolve a dotted/indexed path like `payload.options[0].rationale_md`.
 *
 * Every PARENT on the path must already exist — an op may not invent structure.
 * The final key may be new, because adding a field that was simply absent (an
 * option with no `rationale_md` at all) is a legitimate free repair. Safety does
 * not rest on this check: the gate independently rejects any edit that ends up
 * introducing narrated text.
 */
function setPath(root: any, path: string, value: unknown): void {
  const parts = path.replace(/\[(\d+)\]/g, '.$1').split('.').filter(Boolean);
  let node = root;
  for (let i = 0; i < parts.length - 1; i++) {
    const k = parts[i];
    if (node[k] === undefined || node[k] === null) throw new Error(`path not found: ${path} (at "${k}")`);
    node = node[k];
  }
  const last = parts[parts.length - 1];
  if (node === undefined || node === null || typeof node !== 'object') throw new Error(`path not found: ${path}`);
  node[last] = value;
}

const segOf = (doc: any, id: string) => {
  const s = (doc.segments ?? []).find((x: any) => x.id === id);
  if (!s) throw new Error(`segment not found: ${id}`);
  return s;
};

export function applyOps(original: any, ops: Op[]): { locales: Record<string, any>; log: string[] } {
  const out: Record<string, any> = {};
  for (const l of LOCALES) {
    out[l] = {
      document: clone(original.locales?.[l]?.document),
      answer_keys: clone(original.locales?.[l]?.answer_keys ?? {}),
    };
    if (!out[l].document) throw new Error(`original missing locale ${l}`);
  }
  const log: string[] = [];

  for (const op of ops) {
    switch (op.op) {
      case 'delete_segment': {
        const id = op.segment_id!;
        for (const l of LOCALES) {
          const d = out[l].document;
          const before = d.segments.length;
          d.segments = d.segments.filter((s: any) => s.id !== id);
          if (d.segments.length === before) throw new Error(`delete_segment: ${id} not present in ${l}`);
          delete out[l].answer_keys[id];
        }
        log.push(`deleted ${id}`);
        break;
      }
      case 'reorder_segments': {
        const order = op.order!;
        for (const l of LOCALES) {
          const d = out[l].document;
          const byId = new Map(d.segments.map((s: any) => [s.id, s]));
          if (order.length !== d.segments.length) throw new Error('reorder_segments: order must list every remaining segment');
          const next = order.map((id) => { const s = byId.get(id); if (!s) throw new Error(`reorder: unknown ${id}`); return s; });
          d.segments = next;
        }
        log.push(`reordered ${order.length} segments`);
        break;
      }
      case 'set_answer_key': {
        // Usually one language-independent key (an option id). But typed-input
        // types (type_answer, fill_blank) key on ACCEPTED STRINGS, which are
        // necessarily different per locale — so `values` is supported too.
        const id = op.segment_id!;
        for (const l of LOCALES) {
          segOf(out[l].document, id);
          const v = op.values ? op.values[l] : op.value;
          if (v === undefined) throw new Error(`set_answer_key ${id}: no value for ${l}`);
          out[l].answer_keys[id] = clone(v);
        }
        log.push(`answer key ${id}`);
        break;
      }
      case 'set_icons': {
        // { segment_id, icons: { "<item id>": "icon_name", ... } } — applied to
        // items/options/cases by item id, in every locale.
        const id = op.segment_id!;
        for (const l of LOCALES) {
          const seg = segOf(out[l].document, id);
          const arrs = [seg.payload?.items, seg.payload?.options, seg.payload?.cases, seg.payload?.ideas, seg.payload?.cards].filter(Array.isArray);
          let hits = 0;
          for (const arr of arrs) for (const item of arr as any[]) {
            if (item && op.icons![item.id] !== undefined) { item.icon = op.icons![item.id]; hits++; }
          }
          // would_you_rather stores its two sides as payload.a / payload.b, not an array.
          for (const side of ['a', 'b'] as const) {
            const node = seg.payload?.[side];
            if (node && typeof node === 'object' && op.icons![side] !== undefined) { node.icon = op.icons![side]; hits++; }
          }
          if (hits === 0) throw new Error(`set_icons: no matching item ids in ${id} (${l})`);
        }
        log.push(`icons ${id}`);
        break;
      }
      case 'set_field': {
        // Locale-specific text: { segment_id, path, values: { "es-MX": …, "en-US": …, "pt-BR": … } }
        // Locale-independent value: { segment_id, path, value }
        const id = op.segment_id!;
        for (const l of LOCALES) {
          const seg = segOf(out[l].document, id);
          const v = op.values ? op.values[l] : op.value;
          if (v === undefined) throw new Error(`set_field ${id} ${op.path}: no value for ${l}`);
          setPath(seg, op.path!, v);
        }
        log.push(`set ${id}.${op.path}`);
        break;
      }
      case 'set_meta': {
        // { path, values|value } on document.meta
        for (const l of LOCALES) {
          const v = op.values ? op.values[l] : op.value;
          if (v === undefined) throw new Error(`set_meta ${op.path}: no value for ${l}`);
          setPath(out[l].document.meta, op.path!, v);
        }
        log.push(`meta ${op.path}`);
        break;
      }
      default:
        throw new Error(`unknown op: ${op.op}`);
    }
  }
  return { locales: out, log };
}

// ---------------- CLI ----------------
if (process.argv[1]?.endsWith('applyOps.ts')) {
  const [corpusDir, opsDir, outDir, reportPath] = process.argv.slice(2);
  mkdirSync(outDir, { recursive: true });
  const results: any[] = [];
  let pass = 0, failApply = 0, failGate = 0, escalated = 0;

  for (const name of readdirSync(opsDir).filter((n) => n.endsWith('.json'))) {
    const spec = JSON.parse(readFileSync(join(opsDir, name), 'utf8'));
    const id = spec.lesson_id ?? name.replace(/\.json$/, '');

    if (spec.escalate === 'CUT') {
      escalated++;
      results.push({ id, status: 'ESCALATED_CUT', reason: spec.reason ?? spec.notes ?? '' });
      continue;
    }

    let original: any;
    try { original = JSON.parse(readFileSync(join(corpusDir, 'docs', `${id}.json`), 'utf8')); }
    catch { failApply++; results.push({ id, status: 'NO_ORIGINAL' }); continue; }

    let built: any;
    try { built = applyOps(original, spec.ops ?? []); }
    catch (e) { failApply++; results.push({ id, status: 'APPLY_ERROR', error: (e as Error).message }); continue; }

    const repaired = { lesson_id: id, notes: spec.notes ?? '', applied: built.log, locales: built.locales };
    const findings = checkRepair(id, original, repaired);
    if (findings.length) {
      failGate++;
      results.push({ id, status: 'GATE_REJECTED', findings: findings.slice(0, 6) });
      continue;
    }
    writeFileSync(join(outDir, `${id}.json`), JSON.stringify(repaired, null, 2));
    pass++;
    results.push({ id, status: 'OK', ops: built.log.length });
  }

  const byStatus: Record<string, number> = {};
  for (const r of results) byStatus[r.status] = (byStatus[r.status] || 0) + 1;
  if (reportPath) writeFileSync(reportPath, JSON.stringify({ byStatus, results }, null, 2));
  console.log(JSON.stringify({ pass, failApply, failGate, escalated, byStatus }, null, 2));
  for (const r of results.filter((x) => x.status === 'GATE_REJECTED' || x.status === 'APPLY_ERROR').slice(0, 15)) {
    console.log(`\n${r.status} ${r.id}`);
    if (r.error) console.log(`  ${r.error}`);
    for (const f of r.findings ?? []) console.log(`  [${f.code}] ${f.detail}`);
  }
}
