import { describe, expect, it } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadCourseCatalog } from '../catalog/loader.js';
import { buildCompetencyGraph, checkCompetencyGraph, getCompetencyPromptContext, type CompetencyGraph } from '../catalog/competencyGraph.js';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

describe('Financial Education competency graph', () => {
  it('covers every topic with an acyclic, inspectable prerequisite/retrieval graph', () => {
    const load = loadCourseCatalog(path.join(packageRoot, 'curriculum', 'financial-education'));
    expect(load.issues.filter((issue) => issue.level === 'error')).toEqual([]);

    const graph = buildCompetencyGraph(load.course);
    expect(graph.nodes).toHaveLength(328);
    expect(graph.nodes.filter((node) => node.role === 'teaching')).toHaveLength(216);
    expect(graph.nodes.filter((node) => node.role === 'retrieval')).toHaveLength(112);
    expect(graph.edges.some((edge) => edge.kind === 'prerequisite')).toBe(true);
    expect(graph.edges.some((edge) => edge.kind === 'retrieval')).toBe(true);
    expect(checkCompetencyGraph(graph).filter((issue) => issue.level === 'error')).toEqual([]);
  });

  it.each(['financial-education', 'entrepreneurship', 'investing'])('covers every production course: %s', (slug) => {
    const load = loadCourseCatalog(path.join(packageRoot, 'curriculum', slug));
    expect(load.issues.filter((issue) => issue.level === 'error')).toEqual([]);
    const graph = buildCompetencyGraph(load.course);
    expect(graph.nodes.length).toBeGreaterThan(0);
    expect(graph.edges.length).toBeGreaterThan(graph.nodes.length);
    expect(graph.nodes.some((node) => node.role === 'teaching')).toBe(true);
    expect(graph.nodes.some((node) => node.role === 'retrieval')).toBe(true);
    expect(checkCompetencyGraph(graph).filter((issue) => issue.level === 'error')).toEqual([]);
    const firstTopic = graph.nodes[0]?.topicPath;
    expect(firstTopic).toBeDefined();
    expect(getCompetencyPromptContext(graph, firstTopic!).current.topicPath).toBe(firstTopic);
  });

  it('fails a cycle instead of allowing a circular competency path to reach generation', () => {
    const graph: CompetencyGraph = {
      courseSlug: 'test-course',
      nodes: [
        { id: 'a', topicPath: 'a', ageTier: 'tier1', role: 'teaching', titleEs: 'A', objective: 'Objetivo A', concept: 'A', vocabulary: ['a'], factRefs: [], evidence: 'graded_lesson_completion' },
        { id: 'b', topicPath: 'b', ageTier: 'tier1', role: 'teaching', titleEs: 'B', objective: 'Objetivo B', concept: 'B', vocabulary: ['b'], factRefs: [], evidence: 'graded_lesson_completion' },
      ],
      edges: [
        { from: 'a', to: 'b', kind: 'prerequisite', strength: 'hard', reason: 'A is required before B.' },
        { from: 'b', to: 'a', kind: 'prerequisite', strength: 'hard', reason: 'B is required before A.' },
      ],
    };
    expect(checkCompetencyGraph(graph).some((issue) => issue.code === 'competency-cycle')).toBe(true);
  });

  it('fails a review node that does not retrieve a declared source', () => {
    const graph: CompetencyGraph = {
      courseSlug: 'test-course',
      nodes: [
        { id: 'review', topicPath: 'review', ageTier: 'tier1', role: 'retrieval', titleEs: 'Repaso', objective: 'Recuperar', concept: 'Repaso', vocabulary: ['repaso'], factRefs: [], evidence: 'graded_lesson_completion' },
      ],
      edges: [],
    };
    expect(checkCompetencyGraph(graph).some((issue) => issue.code === 'competency-review-source')).toBe(true);
  });
});
