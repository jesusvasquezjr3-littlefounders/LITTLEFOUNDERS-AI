import { Art } from '../design/controls';
import type { Bucket } from './moneyHabitsApi';
import './pocketMark.css';

/*
 * The one pocket identity mark (Frontend Bible 02 §4.3: each pocket's meaning
 * is carried three ways at once, colour, icon and label). It draws the
 * pocket's own class B icon from the asset manifest (07 §1, §3: the jar, the
 * bag and the heart), so every Save / Spend / Share display on the Wallet,
 * the coin account, the teen wallet and the Tasks board shows the same art.
 * Decorative: the pocket's word always stands beside it (07 §8). `sm` is for
 * a history line, `md` for a pocket row, `lg` for the pockets summary.
 */
export function PocketMark({ pocket, size = 'md' }: { pocket: Bucket; size?: 'sm' | 'md' | 'lg' }) {
  return <span className={`lf-pocket-mark lf-pocket-mark--${size}`} data-pocket-mark={pocket} aria-hidden="true">
    <Art assetId={`pocket.${pocket}.icon`} />
  </span>;
}
