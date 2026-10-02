import type { HorizonteBoardProps } from '../boardTypes';
import { NetCompleteBoard } from './NetCompleteBoard';
import { NetLabelBoard } from './NetLabelBoard';
import { readNetPayload } from './rules.generated';

export default function CubeNetBoard({ segment, ...rest }: HorizonteBoardProps) {
  if (segment.type !== 'geometry.cube-net.v2') return null;
  const payload = readNetPayload(segment.payload);
  if (!payload) return null;
  return payload.mode === 'label'
    ? <NetLabelBoard segment={segment} payload={payload} {...rest} />
    : <NetCompleteBoard segment={segment} payload={payload} {...rest} />;
}
