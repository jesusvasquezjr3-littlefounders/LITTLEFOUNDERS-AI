import { Art } from '../../design/controls';
import type { Bucket } from './buckets';
import './pocketMark.css';

export function PocketMark({ pocket, size = 'md' }: { pocket: Bucket; size?: 'sm' | 'md' | 'lg' }) {
  return <span className={`lf-pocket-mark lf-pocket-mark--${size}`} data-pocket-mark={pocket} aria-hidden="true">
    <Art assetId={`pocket.${pocket}.icon`} />
  </span>;
}
