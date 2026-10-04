import { Art } from './controls';
import './applicationArt.css';

const scenes = {
  learning: { assetId: 'scene.application-learning' },
  family: { assetId: 'scene.application-family' },
  wallet: { assetId: 'scene.application-wallet' },
} as const;

/** Decorative editorial art; never represents an amount, progress or a Mentor. */
export function ApplicationArt({ scene }: { scene: keyof typeof scenes }) {
  return <span className="lf-application-art" aria-hidden="true" data-application-art={scene}>
    <Art assetId={scenes[scene].assetId} />
  </span>;
}
