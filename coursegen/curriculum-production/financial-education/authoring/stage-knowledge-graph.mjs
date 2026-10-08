import { readFileSync, writeFileSync } from 'node:fs';
import { collectProduction } from './collect-production.mjs';

// Stage complete authored competencies locally. Activation remains a separate,
// post-release operation proving a published teaching bridge for every skill.
const source = collectProduction();
if (source.missingLessons.length || source.missingTranslations.length) throw Error('Finish every lesson and localized objective before staging the course graph.');
const graphFile = new URL('../../../../database/seeds/kc_graph.v1.json', import.meta.url);
const mapFile = new URL('../../../../database/seeds/kc_topic_map.v1.json', import.meta.url);
const graph = JSON.parse(readFileSync(graphFile, 'utf8'));
const mapText = readFileSync(mapFile, 'utf8');
const map = JSON.parse(mapText);
graph.kcs.push(...source.proposedNodes);
const keys = new Set(graph.kcs.map(row => row.key));
const edges = new Set(graph.edges.map(edge => JSON.stringify(edge)));
// Reused shared competencies retain their established prerequisites. The
// production blueprint separately enforces its additional course preparation.
for (const skill of source.blueprint.skills.filter(row => row.knowledge_component_id.startsWith('finance.prod.'))) for (const prior of skill.prerequisites) {
  const edge = [`finance.${prior}`, skill.knowledge_component_id];
  if (edge.some(key => !keys.has(key))) throw Error(`Unknown prerequisite ${edge}`);
  if (!edges.has(JSON.stringify(edge))) { graph.edges.push(edge); edges.add(JSON.stringify(edge)); }
}
const gaps = new Set(map.content_gaps.map(row => row.kc));
const additions = source.proposedNodes.filter(row => !gaps.has(row.key)).map(row => ({
  kc: row.key,
  reason: 'The complete production V2 source authors this competency and generates its topic bridge. It remains draft until replacement publication and bridge verification; this legacy curriculum map is retained for historical content.',
}));
if (!process.argv.includes('--write')) {
  console.log(JSON.stringify({ draftNodesToAdd: source.proposedNodes.length, totalNodes: graph.kcs.length, totalEdges: graph.edges.length, publication: false }));
} else {
  writeFileSync(graphFile, `${JSON.stringify(graph, null, 2)}\n`);
  if (additions.length) {
    // Preserve the compact historical map rather than reformatting its 882 rows.
    const end = mapText.lastIndexOf('\n  ]');
    if (end < 0) throw Error('Unexpected topic-map serialization');
    writeFileSync(mapFile, `${mapText.slice(0, end)},\n${additions.map(row => `    ${JSON.stringify(row)}`).join(',\n')}${mapText.slice(end)}`);
  }
  console.log(JSON.stringify({ stagedDraftNodes: source.proposedNodes.length, totalNodes: graph.kcs.length, totalEdges: graph.edges.length, publication: false }));
}
