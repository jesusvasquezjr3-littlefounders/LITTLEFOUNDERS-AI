import type { GateProblem } from '../../pipeline/gates.js';
import type { V2DocumentLike } from '../gates.js';

/** Authoring guidance for one segment type: short lines appended to the author prompt when a skeleton uses the type. */
export interface ForgeGuidance { type: string; lines: readonly string[] }

/** One Horizonte pack as Forge consumes it. `capabilities` is parity-checked against Core and the browser. */
export interface ForgeHorizontePack {
  id: string;
  capabilities: Readonly<Record<string, readonly string[]>>;
  guidance: readonly ForgeGuidance[];
  /** Piece gates over one document and, when the caller holds them, its private keys. */
  gates: (document: V2DocumentLike, answerKeys?: Record<string, unknown>) => GateProblem[];
}
