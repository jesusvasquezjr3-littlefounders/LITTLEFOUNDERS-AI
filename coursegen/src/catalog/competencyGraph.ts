/*
 * competencyGraph.ts — the course's inspectable learning graph.
 *
 * The curriculum YAML remains the sole authored source. This module derives a
 * stable graph from its topics, explicit prerequisites, review citations and
 * ordered teaching path so a 1,000-lesson run can be checked as a learning
 * system before a provider receives a prompt. It deliberately does not infer
 * a child's ability or create a personalised path.
 */

import type { CourseCatalog } from './loader.js';

export type CompetencyRole = 'teaching' | 'retrieval';
export type CompetencyEdgeKind = 'sequence' | 'prerequisite' | 'retrieval';

export interface CompetencyNode {
  /** Stable while the topic path remains stable; rename rules preserve learner rows separately. */
  id: string;
  topicPath: string;
  ageTier: string;
  role: CompetencyRole;
  titleEs: string;
  objective: string;
  concept: string;
  vocabulary: string[];
  factRefs: string[];
  /** The evidence a reviewer can inspect without collecting extra child data. */
  evidence: 'graded_lesson_completion' | 'guardian_check';
  guardianCheck?: string;
}

export interface CompetencyEdge {
  from: string;
  to: string;
  kind: CompetencyEdgeKind;
  strength: 'hard' | 'soft';
  reason: string;
}

export interface CompetencyGraph {
  courseSlug: string;
  nodes: CompetencyNode[];
  edges: CompetencyEdge[];
}

export interface CompetencyGraphIssue {
  level: 'error' | 'warning';
  code: string;
  message: string;
}

/**
 * The small, deterministic slice of the derived graph that Forge may send to
 * an authoring prompt for one topic. Keeping this separate from the complete
 * graph prevents a full-curriculum dump while still making prerequisites and
 * retrieval edges operational inputs to PLAN/WRITE.
 */
export interface CompetencyPromptContext {
  current: Pick<CompetencyNode, 'topicPath' | 'role' | 'objective' | 'concept' | 'vocabulary' | 'evidence'>;
  incoming: Array<{
    kind: CompetencyEdgeKind;
    strength: 'hard' | 'soft';
    reason: string;
    source: Pick<CompetencyNode, 'topicPath' | 'role' | 'objective' | 'concept' | 'vocabulary'>;
  }>;
}

interface TopicRecord {
  path: string;
  sagaPath: string;
  node: CompetencyNode;
  prerequisites: Array<{ path: string; strength: 'hard' | 'soft'; reason: string }>;
  reviewOf: string[];
}

const byPosition = <T extends { position: number }>(a: T, b: T) => a.position - b.position;

function nodeId(courseSlug: string, topicPath: string): string {
  return `${courseSlug}:${topicPath}`;
}

/**
 * Builds nodes for every topic. Teaching nodes form the guaranteed cold-start
 * sequence; review nodes point back to the material they retrieve. Explicit
 * prerequisite declarations enrich rather than replace that safe default.
 */
export function buildCompetencyGraph(course: CourseCatalog): CompetencyGraph {
  const courseSlug = course.catalog?.course.slug ?? 'unknown-course';
  const records: TopicRecord[] = [];
  const topicPathsBySaga = new Map<string, string[]>();

  for (const adventure of [...course.adventures].sort((a, b) => a.data.adventure.position - b.data.adventure.position)) {
    const { data } = adventure;
    for (const saga of [...data.sagas].sort(byPosition)) {
      const sagaPath = `${data.adventure.slug}/${saga.slug}`;
      const sagaTopics: string[] = [];
      for (const topic of [...saga.topics].sort(byPosition)) {
        const path = `${sagaPath}/${topic.slug}`;
        sagaTopics.push(path);
        const role: CompetencyRole = saga.kind === 'review' || topic.kind !== 'teaching' ? 'retrieval' : 'teaching';
        records.push({
          path,
          sagaPath,
          node: {
            id: nodeId(courseSlug, path),
            topicPath: path,
            ageTier: data.adventure.age_tier,
            role,
            titleEs: topic.title_es,
            objective: topic.learning_objective,
            concept: topic.concept,
            vocabulary: [...topic.key_vocabulary],
            factRefs: [...topic.fact_refs],
            evidence: topic.parent_check ? 'guardian_check' : 'graded_lesson_completion',
            guardianCheck: topic.parent_check,
          },
          prerequisites: [...(topic.prerequisites ?? [])],
          reviewOf: [...(topic.review_of ?? [])],
        });
      }
      topicPathsBySaga.set(sagaPath, sagaTopics);
    }
  }

  const idByPath = new Map(records.map((record) => [record.path, record.node.id]));
  const edges: CompetencyEdge[] = [];
  const addEdge = (fromPath: string, toPath: string, kind: CompetencyEdgeKind, strength: 'hard' | 'soft', reason: string) => {
    const from = idByPath.get(fromPath);
    const to = idByPath.get(toPath);
    if (from && to && from !== to) edges.push({ from, to, kind, strength, reason });
  };

  let previousTeachingPath: string | undefined;
  for (const record of records) {
    if (record.node.role === 'teaching') {
      if (previousTeachingPath) {
        addEdge(previousTeachingPath, record.path, 'sequence', 'hard', 'The learner-facing course order introduces this topic after the previous teaching topic.');
      }
      previousTeachingPath = record.path;
    }

    for (const prerequisite of record.prerequisites) {
      const sources = topicPathsBySaga.get(prerequisite.path) ?? [prerequisite.path];
      for (const source of sources) addEdge(source, record.path, 'prerequisite', prerequisite.strength, prerequisite.reason);
    }

    for (const sourceRef of record.reviewOf) {
      const sources = topicPathsBySaga.get(sourceRef) ?? [sourceRef];
      for (const source of sources) {
        addEdge(source, record.path, 'retrieval', 'soft', 'This review deliberately retrieves the cited earlier material.');
      }
    }
  }

  const uniqueEdges = new Map<string, CompetencyEdge>();
  for (const edge of edges) uniqueEdges.set(`${edge.from}|${edge.to}|${edge.kind}|${edge.strength}`, edge);
  return { courseSlug, nodes: records.map((record) => record.node), edges: [...uniqueEdges.values()] };
}

/**
 * Returns only the validated incoming edges for a topic. The plan/write stages
 * use this as a compact grounding contract: hard prerequisites must be
 * respected, sequence edges preserve the authored progression, and retrieval
 * edges force review lessons to revisit the cited competencies.
 */
export function getCompetencyPromptContext(graph: CompetencyGraph, topicPath: string): CompetencyPromptContext | undefined {
  const currentNode = graph.nodes.find((node) => node.topicPath === topicPath);
  if (!currentNode) return undefined;
  const byId = new Map(graph.nodes.map((node) => [node.id, node]));
  const incoming = graph.edges
    .filter((edge) => edge.to === currentNode.id)
    .map((edge) => {
      const source = byId.get(edge.from);
      if (!source) return undefined;
      return {
        kind: edge.kind,
        strength: edge.strength,
        reason: edge.reason,
        source: {
          topicPath: source.topicPath,
          role: source.role,
          objective: source.objective,
          concept: source.concept,
          vocabulary: [...source.vocabulary],
        },
      };
    })
    .filter((edge): edge is NonNullable<typeof edge> => edge !== undefined);
  return {
    current: {
      topicPath: currentNode.topicPath,
      role: currentNode.role,
      objective: currentNode.objective,
      concept: currentNode.concept,
      vocabulary: [...currentNode.vocabulary],
      evidence: currentNode.evidence,
    },
    incoming,
  };
}

/** Free structural proof that the derived learning graph is complete and acyclic. */
export function checkCompetencyGraph(graph: CompetencyGraph): CompetencyGraphIssue[] {
  const issues: CompetencyGraphIssue[] = [];
  if (graph.nodes.length === 0) {
    issues.push({ level: 'error', code: 'competency-empty', message: 'the competency graph has no topic nodes' });
    return issues;
  }

  const nodeIds = new Set<string>();
  for (const node of graph.nodes) {
    if (nodeIds.has(node.id)) issues.push({ level: 'error', code: 'competency-duplicate', message: `duplicate competency node "${node.id}"` });
    nodeIds.add(node.id);
    if (node.role === 'teaching' && (node.objective.trim().length === 0 || node.vocabulary.length === 0)) {
      issues.push({ level: 'error', code: 'competency-evidence', message: `teaching competency "${node.topicPath}" lacks an objective or vocabulary evidence` });
    }
  }

  const incoming = new Map<string, number>(graph.nodes.map((node) => [node.id, 0]));
  const outgoing = new Map<string, string[]>(graph.nodes.map((node) => [node.id, []]));
  for (const edge of graph.edges) {
    if (!nodeIds.has(edge.from) || !nodeIds.has(edge.to)) {
      issues.push({ level: 'error', code: 'competency-reference', message: `graph edge "${edge.kind}" references a missing competency` });
      continue;
    }
    incoming.set(edge.to, (incoming.get(edge.to) ?? 0) + 1);
    outgoing.get(edge.from)?.push(edge.to);
  }

  const queue = graph.nodes.filter((node) => (incoming.get(node.id) ?? 0) === 0).map((node) => node.id);
  let visited = 0;
  while (queue.length > 0) {
    const id = queue.shift();
    if (!id) continue;
    visited++;
    for (const next of outgoing.get(id) ?? []) {
      const remaining = (incoming.get(next) ?? 0) - 1;
      incoming.set(next, remaining);
      if (remaining === 0) queue.push(next);
    }
  }
  if (visited !== graph.nodes.length) {
    issues.push({ level: 'error', code: 'competency-cycle', message: 'competency prerequisites/retrieval contain a cycle' });
  }

  const retrieval = graph.nodes.filter((node) => node.role === 'retrieval');
  const retrievalTargets = new Set(graph.edges.filter((edge) => edge.kind === 'retrieval').map((edge) => edge.to));
  for (const node of retrieval) {
    if (!retrievalTargets.has(node.id)) {
      issues.push({ level: 'error', code: 'competency-review-source', message: `retrieval competency "${node.topicPath}" does not cite source material` });
    }
  }

  return issues;
}
