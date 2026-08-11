import { Circle, Line, makeScene2D } from '@revideo/2d';
import { all, createRef, waitFor } from '@revideo/core';

type Tone = '#818cf8' | '#a78bfa' | '#34d399' | '#f472b6';
type GraphNode = { x: number; y: number; radius: number; tone: Tone; stage: number; row: number };
type GraphLink = { from: number; to: number; bridge: boolean };

const STAGE_X = [-500, -250, 0, 250, 500];
const ROW_Y = [-250, -125, 0, 125, 250];
const STAGE_TONES: Tone[] = ['#f472b6', '#818cf8', '#34d399', '#a78bfa', '#818cf8'];
const nodes: GraphNode[] = Array.from({ length: 25 }, (_, index) => {
  const stage = Math.floor(index / 5);
  const row = index % 5;
  return { x: STAGE_X[stage]!, y: ROW_Y[row]!, radius: row === 2 ? 13 : 9, tone: STAGE_TONES[stage]!, stage, row };
});

const links: GraphLink[] = [];
for (let stage = 0; stage < 5; stage += 1) {
  for (let row = 0; row < 4; row += 1) links.push({ from: stage * 5 + row, to: stage * 5 + row + 1, bridge: false });
  if (stage < 4) for (let row = 0; row < 5; row += 1) links.push({ from: stage * 5 + row, to: (stage + 1) * 5 + row, bridge: true });
}

/** Cinematic, privacy-safe rendering of the same public 25-concept atlas used by the UI. */
export default makeScene2D('knowledge-graph', function* (view) {
  view.fill('#080b16');
  view.add(<Circle size={1180} fill={'#312e81'} opacity={0.2} blur={150} />);
  view.add(<Circle size={900} stroke={'#818cf8'} lineWidth={1} opacity={0.08} />);
  view.add(<Circle size={660} stroke={'#34d399'} lineWidth={1} opacity={0.06} />);

  const linkRefs = links.map(() => createRef<Line>());
  links.forEach((link, index) => {
    const a = nodes[link.from]!;
    const b = nodes[link.to]!;
    view.add(
      <Line
        ref={linkRefs[index]}
        points={[[a.x, a.y], [b.x, b.y]]}
        stroke={link.bridge ? '#34d399' : a.tone}
        lineWidth={link.bridge ? 2.1 : 1.15}
        opacity={link.bridge ? 0.52 : 0.3}
        end={0}
      />,
    );
  });

  const nodeRefs = nodes.map(() => createRef<Circle>());
  nodes.forEach((node, index) => {
    view.add(<Circle ref={nodeRefs[index]} position={[node.x, node.y]} size={node.radius * 2} fill={node.tone} opacity={0.82} shadowColor={node.tone} shadowBlur={18} />);
  });

  yield* all(...linkRefs.map((ref, index) => ref().end(1, 0.22 + (index % 12) * 0.018)));
  yield* all(...nodeRefs.map((ref, index) => ref().scale(index % 5 === 2 ? 1.22 : 1.08, 0.28 + (index % 5) * 0.03)));
  yield* all(...nodeRefs.map((ref) => ref().scale(1, 0.34)));
  yield* all(...nodeRefs.map((ref, index) => ref().scale(index % 3 === 0 ? 1.14 : 1.04, 0.24 + (index % 4) * 0.025)));
  yield* all(...nodeRefs.map((ref) => ref().scale(1, 0.3)));
  yield* waitFor(0.4);
});
