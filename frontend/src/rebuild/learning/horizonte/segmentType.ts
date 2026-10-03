import type { z } from 'zod';
import type { golden } from './golden/index';
import type { numA } from './num-a/index';
import type { numB } from './num-b/index';
import type { balance } from './balance/index';
import type { stats1 } from './stats1/index';
import type { plane1 } from './plane1/index';
import type { fin1 } from './fin1/index';
import type { fin2 } from './fin2/index';
import type { alg1 } from './alg1/index';
import type { alg2 } from './alg2/index';
import type { geom2 } from './geom2/index';
import type { prob } from './prob/index';
import type { com } from './com/index';
import type { sim1 } from './sim1/index';
import type { sim2 } from './sim2/index';
import type { solids } from './solids/index';
import type { space1 } from './space1/index';
import type { space2 } from './space2/index';

type PackSegmentSchema = (typeof golden)['segments'][number] | (typeof numA)['segments'][number] | (typeof numB)['segments'][number]
  | (typeof balance)['segments'][number] | (typeof stats1)['segments'][number] | (typeof plane1)['segments'][number] | (typeof fin1)['segments'][number]
  | (typeof fin2)['segments'][number] | (typeof alg1)['segments'][number] | (typeof alg2)['segments'][number] | (typeof geom2)['segments'][number]
  | (typeof prob)['segments'][number] | (typeof com)['segments'][number] | (typeof sim1)['segments'][number] | (typeof sim2)['segments'][number]
  | (typeof solids)['segments'][number] | (typeof space1)['segments'][number] | (typeof space2)['segments'][number];

/** Types only: this file is never imported for a value, so no pack code reaches the player through it. */
export type HorizonteSegment = z.infer<PackSegmentSchema>;
