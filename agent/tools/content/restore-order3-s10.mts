import { readFile, writeFile } from 'node:fs/promises';
import { applyOps } from './applyOps.ts';
import { checkRepair } from './gate.ts';

const currentPath = process.argv[2];
const backupPath = process.argv[3];
const outPath = process.argv[4];
if (!currentPath || !backupPath || !outPath) throw new Error('usage: restore-order3-s10.mts <current-doc> <original-backup-doc> <release-out>');

const current = JSON.parse(await readFile(currentPath, 'utf8'));
const backup = JSON.parse(await readFile(backupPath, 'utf8'));
const seeded = JSON.parse(JSON.stringify(current));
for (const locale of ['es-MX', 'en-US', 'pt-BR']) {
  const source = backup.locales[locale].document.segments.find((segment: any) => segment.id === 's10-order-2');
  if (!source) throw new Error(`backup missing s10-order-2 in ${locale}`);
  seeded.locales[locale].document.segments.push(JSON.parse(JSON.stringify(source)));
  seeded.locales[locale].answer_keys['s10-order-2'] = JSON.parse(JSON.stringify(backup.locales[locale].answer_keys['s10-order-2']));
}

const book = 'https://media-b2c.littlefounders.ai/files/lesson-images/272b6553d40abfae2184e93440031d6d34fbef1a8449be1565ec235893b418f4.webp';
const iceCream = 'https://media-b2c.littlefounders.ai/files/lesson-images/df14f241dbc3d3b2fa6447af0a0b88f16f2c58815b3f1804920438bbfc42fb8a.webp';
const bicycle = 'https://media-b2c.littlefounders.ai/files/lesson-images/27729fe7a104b792641c59e35ee22ed10f0b7dbe71e007d5172fe8a478ad86b6.webp';
const ops = [
  { op: 'set_field', segment_id: 's10-order-2', path: 'payload.items[0].image_url', value: book },
  { op: 'set_field', segment_id: 's10-order-2', path: 'payload.items[1].image_url', value: iceCream },
  { op: 'set_field', segment_id: 's10-order-2', path: 'payload.items[2].image_url', value: bicycle },
  { op: 'set_answer_key', segment_id: 's10-order-2', value: backup.locales['es-MX'].answer_keys['s10-order-2'] },
];
const built = applyOps(seeded, ops);
const repaired = { lesson_id: current.lesson_id, notes: 'Restored s10-order-2 from the 2026-08-16 original backup; replaced its three images.', applied: built.log, locales: built.locales };
const findings = checkRepair(current.lesson_id, backup, repaired);
if (findings.length) throw new Error(`gate rejected: ${JSON.stringify(findings)}`);
await writeFile(outPath, `${JSON.stringify(repaired, null, 2)}\n`);
console.log(JSON.stringify({ lesson_id: current.lesson_id, restored_segment: 's10-order-2', images: 3, gate: 'pass', output: outPath }));
