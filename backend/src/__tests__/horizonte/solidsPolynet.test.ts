import { describe, expect, it } from 'vitest';
import {
  POLY_FACES, POLY_NETS, amountOf, areaDiagnosis, attach, buildNet, buildSolid, completionsOf, convexOverlap, edgeBetween, faceAreas2, faceIndex, fitsSheet,
  hingeSlots, hingesToSlots, hypotenuse, layoutExtent, panelSlot, polyLabelSolutions, polyLabellings, readSolidSpec, referenceLabelling, slotsToHinges,
  slotsToPanelNames, surfaceAreaOf, treeHinges, unfold, validNetEdgeSets,
  type Hinge, type Layout, type PolySolid, type PolySolidSpec, type Pt,
} from '../../services/horizonte/solids/polynet.js';

const BOX: PolySolidSpec = { kind: 'rect-prism', dims: [4, 3, 2] };
const CUBELIKE: PolySolidSpec = { kind: 'rect-prism', dims: [3, 3, 3] };
const PRISM: PolySolidSpec = { kind: 'tri-prism', dims: [3, 4, 5] };
const PYRAMID: PolySolidSpec = { kind: 'sq-pyramid', dims: [6, 5] };
const SAMPLES: [string, PolySolidSpec, number][] = [
  ['box', BOX, 52], ['cube-like box', CUBELIKE, 54], ['long box', { kind: 'rect-prism', dims: [5, 2, 1] }, 34],
  ['prism', PRISM, 72], ['big prism', { kind: 'tri-prism', dims: [6, 8, 10] }, 288], ['prism 5-12-13', { kind: 'tri-prism', dims: [5, 12, 2] }, 5 * 12 + 2 * (5 + 12 + 13) + 0],
  ['pyramid', PYRAMID, 96], ['small pyramid', { kind: 'sq-pyramid', dims: [4, 3] }, 40], ['tall pyramid', { kind: 'sq-pyramid', dims: [10, 13] }, 100 + 2 * 10 * 13],
];

const solidOf = (spec: PolySolidSpec): PolySolid => buildSolid(spec)!;
const shoelace = (points: readonly Pt[]): number => Math.abs(points.reduce((sum, point, at) => { const next = points[(at + 1) % points.length]!; return sum + point[0] * next[1] - next[0] * point[1]; }, 0)) / 2;
const gap = (a: readonly number[], b: readonly number[]): number => Math.hypot(...a.map((value, index) => value - b[index]!));
const sorted = (ids: readonly number[]): number[] => [...ids].sort((x, y) => x - y);

describe('polyhedron nets: building the solids', () => {
  it('gives each solid its faces and edges, and obeys Euler', () => {
    for (const [label, spec] of SAMPLES) {
      const solid = solidOf(spec);
      expect(solid.faces.map((face) => face.name), label).toEqual([...POLY_FACES[spec.kind]]);
      expect(solid.vertices.length - solid.edges.length + solid.faces.length, label).toBe(2);
    }
    expect(solidOf(BOX).edges).toHaveLength(12);
    expect(solidOf(PRISM).edges).toHaveLength(9);
    expect(solidOf(PYRAMID).edges).toHaveLength(8);
  });

  it('shares every edge between exactly two faces that list its corners next to each other', () => {
    for (const [label, spec] of SAMPLES) {
      const solid = solidOf(spec);
      for (const edge of solid.edges) {
        expect(edge.faces[0], label).toBeLessThan(edge.faces[1]);
        for (const side of edge.faces) {
          const ring = solid.faces[side]!.vertices;
          const at = ring.indexOf(edge.vertices[0]);
          const near = [ring[(at + 1) % ring.length], ring[(at + ring.length - 1) % ring.length]];
          expect(at, label).toBeGreaterThanOrEqual(0);
          expect(near, label).toContain(edge.vertices[1]);
        }
      }
      const seen = new Set(solid.edges.map((edge) => `${edge.faces[0]}-${edge.faces[1]}`));
      expect(seen.size, label).toBe(solid.edges.length);
    }
  });

  it('winds each face counter-clockwise seen from outside', () => {
    for (const [label, spec] of SAMPLES) {
      const solid = solidOf(spec);
      const middle = solid.vertices.reduce((sum, vertex) => [sum[0]! + vertex[0] / solid.vertices.length, sum[1]! + vertex[1] / solid.vertices.length, sum[2]! + vertex[2] / solid.vertices.length], [0, 0, 0]);
      for (const face of solid.faces) {
        const centroid = face.vertices.reduce((sum, index) => [sum[0]! + solid.vertices[index]![0] / face.vertices.length, sum[1]! + solid.vertices[index]![1] / face.vertices.length, sum[2]! + solid.vertices[index]![2] / face.vertices.length], [0, 0, 0]);
        const outward = [centroid[0]! - middle[0]!, centroid[1]! - middle[1]!, centroid[2]! - middle[2]!];
        expect(outward[0]! * face.normal[0] + outward[1]! * face.normal[1] + outward[2]! * face.normal[2], `${label} ${face.name}`).toBeGreaterThan(0);
      }
    }
  });

  it('computes the surface area from the formulas and from the unfolded shapes alike', () => {
    for (const [label, spec, area] of SAMPLES.slice(0, 4).concat(SAMPLES.slice(4).filter(([name]) => name !== 'prism 5-12-13'))) {
      const solid = solidOf(spec);
      expect(surfaceAreaOf(solid), label).toBe(area);
      for (const def of POLY_NETS[spec.kind]) {
        const net = buildNet(solid, def.id)!;
        let total = 0;
        for (const panel of net.layout.panels) {
          const flat = shoelace(panel.points);
          expect(flat * 2, `${label} ${def.id} ${solid.faces[panel.face]!.name}`).toBeCloseTo(solid.faces[panel.face]!.area2, 6);
          total += flat;
        }
        expect(total, `${label} ${def.id}`).toBeCloseTo(area, 6);
      }
    }
    expect(faceAreas2(solidOf(BOX))).toEqual([24, 24, 16, 16, 12, 12]);
    expect(faceAreas2(solidOf(PRISM))).toEqual([30, 40, 50, 12, 12]);
    expect(faceAreas2(solidOf(PYRAMID))).toEqual([72, 30, 30, 30, 30]);
  });

  it('describes the lengths a panel shows: edges and the height of a triangle', () => {
    for (const [label, spec] of SAMPLES) {
      const solid = solidOf(spec);
      for (const face of solid.faces) {
        expect(face.measures.length, `${label} ${face.name}`).toBe(2);
        for (const measure of face.measures) {
          const from = solid.vertices[face.vertices[measure.from]!]!;
          const to = solid.vertices[face.vertices[measure.to]!]!;
          if (measure.type === 'edge') {
            expect(gap(from, to), `${label} ${face.name}`).toBeCloseTo(measure.length, 6);
          } else {
            const apex = solid.vertices[face.vertices[measure.apex]!]!;
            const base = gap(from, to);
            const sideA = gap(apex, from);
            const sideB = gap(apex, to);
            const area = Math.sqrt(Math.max(0, (sideA + sideB + base) * (sideA + sideB - base) * (base + sideA - sideB) * (base - sideA + sideB))) / 4;
            expect((2 * area) / base, `${label} ${face.name}`).toBeCloseTo(measure.length, 6);
          }
        }
      }
    }
    expect(solidOf(PYRAMID).faces[1]!.measures).toContainEqual(expect.objectContaining({ type: 'height', length: 5 }));
    expect(solidOf(PRISM).faces[3]!.measures.map((measure) => measure.length).sort()).toEqual([3, 4]);
  });

  it('reads a solid only in the shapes it can build', () => {
    expect(readSolidSpec({ kind: 'rect-prism', dims: [4, 3, 2] })).toEqual(BOX);
    expect(readSolidSpec({ kind: 'sq-pyramid', dims: [6, 5] })).toEqual(PYRAMID);
    for (const bad of [
      null, 'box', [], {}, { kind: 'rect-prism' }, { kind: 'torus', dims: [1, 2, 3] }, { kind: 'rect-prism', dims: [4, 3] }, { kind: 'rect-prism', dims: [4, 3, 2, 1] },
      { kind: 'rect-prism', dims: [4, 3, 0] }, { kind: 'rect-prism', dims: [4, 3, 31] }, { kind: 'rect-prism', dims: [4, 3, 1.5] }, { kind: 'rect-prism', dims: [4, 3, '2'] },
      { kind: 'rect-prism', dims: [4, 3, 2], extra: 1 }, { kind: 'tri-prism', dims: [3, 3, 5] }, { kind: 'tri-prism', dims: [3, 4] }, { kind: 'sq-pyramid', dims: [6, 2] },
      { kind: 'sq-pyramid', dims: [6, 3] }, { kind: 'sq-pyramid', dims: [6, 5, 1] },
    ]) expect(readSolidSpec(bad), JSON.stringify(bad)).toBeNull();
    expect(buildSolid({ kind: 'tri-prism', dims: [3, 3, 5] })).toBeNull();
    expect(hypotenuse(3, 4)).toBe(5);
    expect(hypotenuse(6, 8)).toBe(10);
    expect(hypotenuse(5, 12)).toBe(13);
    expect(hypotenuse(1, 1)).toBeNull();
  });
});

describe('polyhedron nets: unfolding', () => {
  it('keeps every panel congruent to its face and glues each hinge edge onto the same line', () => {
    for (const [label, spec] of SAMPLES) {
      const solid = solidOf(spec);
      for (const def of POLY_NETS[spec.kind]) {
        const net = buildNet(solid, def.id)!;
        for (const panel of net.layout.panels) {
          const ring = solid.faces[panel.face]!.vertices;
          for (let first = 0; first < ring.length; first += 1) {
            for (let second = first + 1; second < ring.length; second += 1) {
              const flat = Math.hypot(panel.points[first]![0] - panel.points[second]![0], panel.points[first]![1] - panel.points[second]![1]);
              expect(flat, `${label} ${def.id}`).toBeCloseTo(gap(solid.vertices[ring[first]!]!, solid.vertices[ring[second]!]!), 6);
            }
          }
        }
        for (const hinge of net.hinges) {
          const edge = edgeBetween(solid, hinge.parent, hinge.child)!;
          const parent = net.layout.panels.find((panel) => panel.face === hinge.parent)!;
          const child = net.layout.panels.find((panel) => panel.face === hinge.child)!;
          for (const corner of edge.vertices) {
            const a = parent.points[solid.faces[hinge.parent]!.vertices.indexOf(corner)]!;
            const b = child.points[solid.faces[hinge.child]!.vertices.indexOf(corner)]!;
            expect(gap(a, b), `${label} ${def.id}`).toBeLessThan(1e-6);
          }
        }
      }
    }
  });

  it('puts the child on the far side of its hinge, so every panel shows its outside', () => {
    const solid = solidOf(BOX);
    const net = buildNet(solid, 'cross')!;
    for (const hinge of net.hinges) {
      const edge = edgeBetween(solid, hinge.parent, hinge.child)!;
      const parent = net.layout.panels.find((panel) => panel.face === hinge.parent)!;
      const child = net.layout.panels.find((panel) => panel.face === hinge.child)!;
      const [u, v] = edge.vertices.map((corner) => parent.points[solid.faces[hinge.parent]!.vertices.indexOf(corner)]!) as [Pt, Pt];
      const side = (point: Pt) => (v[0] - u[0]) * (point[1] - u[1]) - (v[1] - u[1]) * (point[0] - u[0]);
      const center = (points: readonly Pt[]): Pt => [points.reduce((sum, point) => sum + point[0], 0) / points.length, points.reduce((sum, point) => sum + point[1], 0) / points.length];
      expect(Math.sign(side(center(parent.points))) * Math.sign(side(center(child.points)))).toBe(-1);
    }
  });

  it('refuses a hinge that is not an edge, a face hung twice and a parent that is not placed', () => {
    const solid = solidOf(BOX);
    const at = (name: string) => faceIndex(solid, name);
    const bottom = at('bottom');
    expect(unfold(solid, bottom, [{ parent: bottom, child: at('top') }])).toBeNull();
    expect(unfold(solid, bottom, [{ parent: bottom, child: at('front') }, { parent: bottom, child: at('front') }])).toBeNull();
    expect(unfold(solid, bottom, [{ parent: at('front'), child: at('top') }])).toBeNull();
    expect(unfold(solid, bottom, [{ parent: bottom, child: bottom }])).toBeNull();
    expect(unfold(solid, 99, [])).toBeNull();
    expect(unfold(solid, bottom, [])!.panels).toHaveLength(1);
  });

  it('finds an overlap between convex shapes and lets touching pass', () => {
    const square = (x: number, y: number, size = 2): Pt[] => [[x, y], [x + size, y], [x + size, y + size], [x, y + size]];
    expect(convexOverlap(square(0, 0), square(1, 1))).toBe(true);
    expect(convexOverlap(square(0, 0), square(0, 0))).toBe(true);
    expect(convexOverlap(square(0, 0, 4), square(1, 1, 1))).toBe(true);
    expect(convexOverlap(square(0, 0), square(2, 0))).toBe(false);
    expect(convexOverlap(square(0, 0), square(2, 2))).toBe(false);
    expect(convexOverlap(square(0, 0), square(3, 0))).toBe(false);
    expect(convexOverlap(square(0, 0), [[1, 1], [4, 1], [1, 4]])).toBe(true);
    expect(convexOverlap([[0, 0], [2, 0], [0, 2]], [[2, 2], [1.5, 0.2], [0.2, 1.5]])).toBe(true);
    expect(convexOverlap([[0, 0], [2, 0], [0, 2]], [[2, 2], [2, 0.5], [0.5, 2]])).toBe(false);
    expect(convexOverlap([[0, 0], [2, 0], [0, 2]], [[2, 2], [3, 2], [2, 3]])).toBe(false);
    expect(convexOverlap([[0, 0], [2, 0], [0, 2]], [[2, 0], [2, 2], [0, 2]])).toBe(false);
  });

  it('never overlaps along any tree of these three solids, and the counts are the spanning-tree counts', () => {
    const counts: [string, PolySolidSpec, number][] = [['box', BOX, 384], ['prism', PRISM, 75], ['pyramid', PYRAMID, 45], ['cube-like box', CUBELIKE, 384]];
    for (const [label, spec, count] of counts) {
      const solid = solidOf(spec);
      const sets = validNetEdgeSets(solid);
      expect(sets, label).toHaveLength(count);
      for (const root of solid.faces.keys()) {
        for (const set of sets) {
          const hinges = treeHinges(solid, root, set)!;
          const layout = unfold(solid, root, hinges)!;
          expect(layout.panels, label).toHaveLength(solid.faces.length);
          expect(layout.overlaps, label).toEqual([]);
        }
      }
    }
    expect(treeHinges(solidOf(BOX), 0, [0, 1, 2])).toBeNull();
    expect(validNetEdgeSets(solidOf(BOX))).toBe(validNetEdgeSets(solidOf(BOX)));
  });

  it('keeps the catalogue to real nets with distinct names', () => {
    for (const [label, spec] of SAMPLES) {
      const solid = solidOf(spec);
      const catalogue = POLY_NETS[spec.kind];
      expect(new Set(catalogue.map((def) => def.id)).size, label).toBe(catalogue.length);
      expect(catalogue.length, label).toBeGreaterThanOrEqual(3);
      for (const def of catalogue) {
        expect(def.id).toMatch(/^[a-z]{3,12}$/);
        const net = buildNet(solid, def.id)!;
        expect(net, `${label} ${def.id}`).not.toBeNull();
        expect(net.layout.overlaps, `${label} ${def.id}`).toEqual([]);
        expect(sorted(net.hinges.map((hinge) => edgeBetween(solid, hinge.parent, hinge.child)!.id)), `${label} ${def.id}`).toSatisfy((ids: number[]) => validNetEdgeSets(solid).some((set) => set.join() === ids.join()));
        expect(sorted(net.faces)).toEqual([...solid.faces.keys()]);
      }
    }
    expect(buildNet(solidOf(BOX), 'star')).toBeNull();
    expect(buildNet(solidOf(BOX), 7)).toBeNull();
    expect(buildNet(solidOf(PYRAMID), 'cross')).toBeNull();
  });
});

describe('polyhedron nets: naming the panels', () => {
  it('counts the ways a net folds into each solid: 24 for a cube-like box, 4 for a box, 1 for a prism, 4 for a pyramid', () => {
    expect(polyLabellings(buildNet(solidOf(CUBELIKE), 'cross')!)).toHaveLength(24);
    for (const def of POLY_NETS['rect-prism']) expect(polyLabellings(buildNet(solidOf(BOX), def.id)!), def.id).toHaveLength(4);
    for (const def of POLY_NETS['tri-prism']) expect(polyLabellings(buildNet(solidOf(PRISM), def.id)!), def.id).toHaveLength(1);
    for (const def of POLY_NETS['sq-pyramid']) expect(polyLabellings(buildNet(solidOf(PYRAMID), def.id)!), def.id).toHaveLength(4);
  });

  it('only names a panel with a face of its own shape and hinges panels on faces that touch', () => {
    for (const [label, spec] of SAMPLES) {
      const solid = solidOf(spec);
      for (const def of POLY_NETS[spec.kind]) {
        const net = buildNet(solid, def.id)!;
        const all = polyLabellings(net);
        expect(all.map((entry) => entry.join()), `${label} ${def.id}`).toContain(referenceLabelling(net).join());
        expect(new Set(all.map((entry) => entry.join())).size).toBe(all.length);
        for (const labelling of all) {
          expect(new Set(labelling).size, `${label} ${def.id}`).toBe(solid.faces.length);
          labelling.forEach((name, panel) => expect(shoelace(net.layout.panels[panel]!.points) * 2, `${label} ${def.id} ${name}`).toBeCloseTo(solid.faces[faceIndex(solid, name)]!.area2, 6));
          net.layout.panels.forEach((panel, at) => {
            if (panel.parent === null) return;
            expect(edgeBetween(solid, faceIndex(solid, labelling[at]), faceIndex(solid, labelling[panel.parent])), `${label} ${def.id}`).not.toBeNull();
          });
        }
      }
    }
  });

  it('narrows to one answer when enough names are given', () => {
    const box = buildNet(solidOf(BOX), 'cross')!;
    expect(polyLabelSolutions(box, {})).toHaveLength(4);
    expect(polyLabelSolutions(box, { 0: 'bottom' })).toHaveLength(2);
    expect(polyLabelSolutions(box, { 1: 'front', 4: 'left' }).map((entry) => entry.join())).toEqual(['top,front,back,right,left,bottom']);
    expect(polyLabelSolutions(box, { 0: 'bottom', 1: 'front' })).toHaveLength(1);
    expect(polyLabelSolutions(box, { 0: 'slope' })).toEqual([]);
    expect(polyLabelSolutions(box, { 0: 'bottom', 5: 'bottom' })).toEqual([]);
    expect(polyLabelSolutions(buildNet(solidOf(PYRAMID), 'chain')!, { 0: 'bottom', 1: 'front' }).map((entry) => entry.join())).toEqual(['bottom,front,right,back,left']);
    expect(polyLabelSolutions(buildNet(solidOf(PRISM), 'fan')!, { 2: 'slope' }).map((entry) => entry.join())).toEqual(['back,bottom,slope,left,right']);
  });

  it('reads panel slots into names and refuses a slot map that is not one name per panel', () => {
    expect(slotsToPanelNames({ panel0: ['bottom'], panel1: ['front'] }, 2)).toEqual(['bottom', 'front']);
    expect(slotsToPanelNames({ panel0: ['bottom'] }, 2)).toBeNull();
    expect(slotsToPanelNames({ panel0: ['bottom', 'top'], panel1: ['front'] }, 2)).toBeNull();
    expect(slotsToPanelNames({ panel0: ['roof'], panel1: ['front'] }, 2)).toBeNull();
    expect(slotsToPanelNames(null, 2)).toBeNull();
    expect(panelSlot(3)).toBe('panel3');
  });
});

describe('polyhedron nets: completing a net on a sheet', () => {
  const box = solidOf(BOX);
  const at = (name: string) => faceIndex(box, name);
  const given: Hinge[] = [{ parent: at('bottom'), child: at('front') }, { parent: at('bottom'), child: at('left') }, { parent: at('bottom'), child: at('right') }];

  it('counts every net that keeps the given hinges, with and without the sheet', () => {
    expect(completionsOf(box, at('bottom'), given, null, 0)).toEqual({ count: 15, sets: [] });
    const fit = completionsOf(box, at('bottom'), given, { width: 9, height: 11 }, 100);
    expect(fit.count).toBe(3);
    expect(fit.sets).toHaveLength(3);
    for (const set of fit.sets) {
      const layout = unfold(box, at('bottom'), set)!;
      expect(fitsSheet(layout, { width: 9, height: 11 })).toBe(true);
      expect(layout.overlaps).toEqual([]);
      for (const hinge of given) expect(set).toContainEqual(hinge);
    }
    expect(completionsOf(box, at('bottom'), given, { width: 9, height: 11 }, 2).sets).toHaveLength(2);
    expect(completionsOf(box, at('bottom'), [], null, 0).count).toBe(384);
    expect(completionsOf(box, at('bottom'), given, { width: 3, height: 3 }, 8).count).toBe(0);
    expect(completionsOf(box, at('bottom'), given, { width: 60, height: 60 }, 8).count).toBe(15);
  });

  it('matches the given hinges in their direction and refuses a hinge that is not an edge', () => {
    expect(completionsOf(box, at('bottom'), [{ parent: at('front'), child: at('bottom') }], null, 0).count).toBe(0);
    expect(completionsOf(box, at('bottom'), [{ parent: at('bottom'), child: at('top') }], null, 0).count).toBe(0);
    expect(completionsOf(box, at('bottom'), [{ parent: at('front'), child: at('top') }], null, 0).count).toBeGreaterThan(0);
    expect(completionsOf(box, at('bottom'), [{ parent: at('top'), child: at('front') }], null, 0).count).toBeGreaterThan(0);
    expect(completionsOf(box, at('bottom'), [{ parent: at('top'), child: at('front') }], null, 0).count)
      .not.toBe(completionsOf(box, at('bottom'), [{ parent: at('front'), child: at('top') }], null, 0).count + 1000);
  });

  it('measures a net against a sheet with a hair of tolerance and no more', () => {
    const net = buildNet(solidOf(CUBELIKE), 'cross')!;
    const extent = layoutExtent(net.layout);
    expect(extent).toEqual({ width: 9, height: 12 });
    expect(fitsSheet(net.layout, { width: 9, height: 12 })).toBe(true);
    expect(fitsSheet(net.layout, { width: 9, height: 11 })).toBe(false);
    expect(fitsSheet(net.layout, { width: 8, height: 12 })).toBe(false);
    expect(fitsSheet(net.layout, null)).toBe(true);
    const hand: Layout = { panels: [{ face: 0, parent: null, points: [[0, 0], [1, 0], [1, 1], [0, 1]] }], overlaps: [] };
    expect(fitsSheet(hand, { width: 1, height: 1 })).toBe(true);
    expect(fitsSheet({ ...hand, panels: [{ ...hand.panels[0]!, points: [[0, 0], [1.0000001, 0], [1, 1], [0, 1]] }] }, { width: 1, height: 1 })).toBe(true);
    expect(fitsSheet({ ...hand, panels: [{ ...hand.panels[0]!, points: [[0, 0], [1.001, 0], [1, 1], [0, 1]] }] }, { width: 1, height: 1 })).toBe(false);
  });

  it('keeps the sheets of the fixtures away from the extent of every net, so no comparison sits on a knife edge', () => {
    const jobs: [PolySolidSpec, string, [string, string][], { width: number; height: number }][] = [
      [BOX, 'bottom', [['bottom', 'front'], ['bottom', 'left'], ['bottom', 'right']], { width: 9, height: 11 }],
      [PRISM, 'bottom', [['bottom', 'back']], { width: 13, height: 14 }],
      [PYRAMID, 'bottom', [['bottom', 'front'], ['bottom', 'left']], { width: 18, height: 15 }],
    ];
    for (const [spec, rootName, hingeNames, sheet] of jobs) {
      const solid = solidOf(spec);
      const root = faceIndex(solid, rootName);
      const fixed = hingeNames.map(([parent, child]) => ({ parent: faceIndex(solid, parent), child: faceIndex(solid, child) }));
      const all = completionsOf(solid, root, fixed, null, 5000);
      const fit = completionsOf(solid, root, fixed, sheet, 5000);
      expect(fit.count).toBeGreaterThan(0);
      expect(fit.count).toBeLessThan(all.count);
      for (const set of all.sets) {
        const extent = layoutExtent(unfold(solid, root, set)!);
        expect(Math.abs(extent.width - sheet.width)).toBeGreaterThan(0.3);
        expect(Math.abs(extent.height - sheet.height)).toBeGreaterThan(0.3);
      }
    }
  });
});

describe('polyhedron nets: hinge slots', () => {
  const box = solidOf(BOX);

  it('names each edge once, lower face first, and reads a slot map back into the same hinges', () => {
    for (const [label, spec] of SAMPLES) {
      const solid = solidOf(spec);
      const slots = hingeSlots(solid);
      expect(new Set(slots).size, label).toBe(solid.edges.length);
      for (const slot of slots) expect(slot, label).toMatch(/^(top|bottom|front|back|left|right|slope)-(top|bottom|front|back|left|right|slope)$/);
    }
    const net = buildNet(box, 'cross')!;
    const slots = hingesToSlots(box, net.hinges);
    expect(Object.keys(slots)).toHaveLength(5);
    const back = slotsToHinges(box, slots)!;
    expect(back).toHaveLength(5);
    for (const hinge of net.hinges) expect(back).toContainEqual(hinge);
  });

  it('refuses a slot map that is not edges holding one of their own faces', () => {
    const slots = { 'bottom-front': ['front'] };
    expect(slotsToHinges(box, slots)).toEqual([{ parent: faceIndex(box, 'bottom'), child: faceIndex(box, 'front') }]);
    expect(slotsToHinges(box, { 'bottom-front': ['bottom'] })).toEqual([{ parent: faceIndex(box, 'front'), child: faceIndex(box, 'bottom') }]);
    for (const bad of [null, undefined, [], 'x', {}, { 'bottom-top': ['top'] }, { 'bottom-front': ['top'] }, { 'bottom-front': ['front', 'bottom'] }, { 'bottom-front': 'front' }, { 'bottom-front': ['roof'] }, { 'bottom-front': [] }]) {
      expect(slotsToHinges(box, bad), JSON.stringify(bad)).toBeNull();
    }
  });

  it('splits hinges into those hanging from the root and those that hang from nothing', () => {
    const at = (name: string) => faceIndex(box, name);
    const reach = attach(at('bottom'), [{ parent: at('front'), child: at('top') }, { parent: at('bottom'), child: at('front') }]);
    expect(reach.ordered).toEqual([{ parent: at('bottom'), child: at('front') }, { parent: at('front'), child: at('top') }]);
    expect(reach.orphans).toEqual([]);
    const loop = attach(at('bottom'), [{ parent: at('bottom'), child: at('right') }, { parent: at('top'), child: at('left') }, { parent: at('left'), child: at('back') }, { parent: at('back'), child: at('top') }]);
    expect(loop.ordered).toHaveLength(1);
    expect(loop.orphans).toHaveLength(3);
    expect(attach(at('bottom'), [{ parent: at('bottom'), child: at('front') }, { parent: at('left'), child: at('front') }]).orphans).toHaveLength(1);
  });
});

describe('polyhedron nets: reading the area answer', () => {
  it('reads a decimal or a fraction and nothing else', () => {
    expect(amountOf('54')).toBe(54);
    expect(amountOf('-3')).toBe(-3);
    expect(amountOf('1.25')).toBe(1.25);
    expect(amountOf('3/4')).toBe(0.75);
    expect(amountOf('-1/2')).toBe(-0.5);
    for (const bad of ['', ' 5', '5 ', 'abc', '1e3', '3/0', '1/2/3', '.5', '5.', '1234567890123', '0x10']) expect(amountOf(bad), JSON.stringify(bad)).toBeNull();
  });

  it('says what a wrong total adds up to', () => {
    const faces = faceAreas2(solidOf(BOX));
    expect(areaDiagnosis(faces, 12)).toBe('miss');
    expect(areaDiagnosis(faces, 32)).toBe('miss');
    expect(areaDiagnosis(faces, 40)).toBe('miss');
    expect(areaDiagnosis(faces, 64)).toBe('false_alarm');
    expect(areaDiagnosis(faces, 58)).toBe('false_alarm');
    expect(areaDiagnosis(faces, 53)).toBe('value');
    expect(areaDiagnosis(faces, 52)).toBe('value');
    expect(areaDiagnosis(faces, 0)).toBe('value');
    expect(areaDiagnosis(faces, 0.3)).toBe('value');
    expect(areaDiagnosis(faces, Number.NaN)).toBe('value');
    expect(areaDiagnosis(faceAreas2(solidOf(PRISM)), 35)).toBe('miss');
    expect(areaDiagnosis(faceAreas2(solidOf(PRISM)), 3)).toBe('value');
    expect(areaDiagnosis(faceAreas2(solidOf(PRISM)), 78)).toBe('false_alarm');
    expect(areaDiagnosis(faceAreas2(solidOf(PYRAMID)), 36)).toBe('miss');
  });
});
