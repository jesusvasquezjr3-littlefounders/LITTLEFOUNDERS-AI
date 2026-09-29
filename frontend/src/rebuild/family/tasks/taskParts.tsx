import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Button, ButtonGroup, Chip, ChipGroup, CoinAmount, Dialog, InlineNotice, LoadingState, Pill, RewardChip, type StatusTone } from '../../design/controls';
import type { GlyphName } from '../../design/glyphs';
import type en from '../../../i18n/en-US/rebuild-family.json';
import { fill } from '../console/consoleParts';
import { PocketMark } from '../PocketMark';
import type { PhotoPort, Pockets, Task, TaskStatus } from './tasksApi';

/*
 * Shared pieces of the rebuilt Tasks and coin screens (W2F.2): the copy types
 * of their namespace groups, a chore's chips (status, kind, coins, repeat,
 * photo), the evidence photo viewer and picker, and the three pockets.
 *
 * Status is a glyph, a word and a hue together, never the hue alone
 * (02 rule 6). The pockets use their identity hues and our own pocket art
 * (02 §4.3: save = mint jar, spend = sky bag, share = berry heart), each with
 * its word.
 */

export type TutorTasksCopy = typeof en.familyTasks;
export type ChildTasksCopy = typeof en.childTasks;
export type TutorCoinsCopy = typeof en.familyCoins;
export type ChildCoinsCopy = typeof en.childCoins;
export type CoinCardCopy = typeof en.coinCard;
export type TeenWalletScreenCopy = typeof en.teenWalletScreen;

type StatusCopy = { statusOpen: string; statusDone: string; statusApproved?: string; statusCancelled?: string };
const STATUS: Record<TaskStatus, { tone: StatusTone; glyph: GlyphName; key: keyof StatusCopy }> = {
  open: { tone: 'sky', glyph: 'play', key: 'statusOpen' },
  done: { tone: 'warning', glyph: 'pause', key: 'statusDone' },
  approved: { tone: 'success', glyph: 'check', key: 'statusApproved' },
  cancelled: { tone: 'primary', glyph: 'cross', key: 'statusCancelled' },
};

/** "1 coin" / "N coins": the count as a reward chip (gold is coins, never a status). */
export function coinWord(copy: { coin: string; coins: string }, count: number) {
  return count === 1 ? copy.coin : fill(copy.coins, { count });
}

/** A chore's facts as chips: its status, its kind (D.10), its coins, whether it repeats and whether it needs a photo first. */
export function ChoreChips({ task, copy, showOpen = true }: {
  task: Task;
  /** False where an open chore's own "done" control already says it is to do. */
  showOpen?: boolean;
  copy: StatusCopy & { contribution: string; bonus: string; coin: string; coins: string; weekly: string; photoNeeded: string };
}) {
  const status = STATUS[task.status];
  return <ChipGroup>
    {showOpen || task.status !== 'open' ? <Chip tone={status.tone} glyph={status.glyph} role="option">{copy[status.key] ?? ''}</Chip> : null}
    <Pill tone={task.kind === 'bonus' ? 'reward' : 'inverse'} role="option">{task.kind === 'bonus' ? copy.bonus : copy.contribution}</Pill>
    {task.rewardCoins > 0 ? <RewardChip coin>{coinWord(copy, task.rewardCoins)}</RewardChip> : null}
    {task.recurrence === 'weekly' ? <Pill tone="inverse" role="option">{copy.weekly}</Pill> : null}
    {task.requiresEvidence && !task.hasEvidence ? <Chip tone="warning" glyph="info" role="option">{copy.photoNeeded}</Chip> : null}
  </ChipGroup>;
}

/**
 * "See photo": opens a dialog that fetches the picture through the port (the
 * authenticated proxy) and frees it when closed. A failure says so and offers
 * a retry; nothing is ever shown from a storage URL.
 */
export function PhotoView({ task, photos, copy }: {
  task: Pick<Task, 'id' | 'title'>;
  photos: PhotoPort;
  copy: { seePhoto: string; photoTitle: string; photoBody: string; photoLoading: string; failed: string; retry: string; close: string };
}) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<{ status: 'loading' } | { status: 'failed' } | { status: 'ready'; url: string }>({ status: 'loading' });
  const shown = useRef<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!open) return;
    let live = true;
    setState({ status: 'loading' });
    void photos.load(task.id).then((result) => {
      if (!live) { if (result.ok) photos.release(result.data); return; }
      if (!result.ok) { setState({ status: 'failed' }); return; }
      shown.current = result.data;
      setState({ status: 'ready', url: result.data });
    });
    return () => {
      live = false;
      if (shown.current) { photos.release(shown.current); shown.current = null; }
    };
  }, [open, attempt, photos, task.id]);

  return <>
    <Button size="sm" aria-haspopup="dialog" onClick={() => setOpen(true)}>{copy.seePhoto}</Button>
    <Dialog open={open} onClose={() => setOpen(false)} heading={copy.photoTitle} description={fill(copy.photoBody, { title: task.title })}
      actions={<Button onClick={() => setOpen(false)}>{copy.close}</Button>}>
      <div className="lf-money-photo" data-family-part="photo">
        {state.status === 'loading' ? <LoadingState label={copy.photoLoading} lines={2} /> : null}
        {state.status === 'failed' ? <>
          <InlineNotice tone="error" live>{copy.failed}</InlineNotice>
          <ButtonGroup><Button onClick={() => setAttempt((n) => n + 1)}>{copy.retry}</Button></ButtonGroup>
        </> : null}
        {state.status === 'ready' ? <img src={state.url} alt={fill(copy.photoBody, { title: task.title })} /> : null}
      </div>
    </Dialog>
  </>;
}

/** The child's photo for a chore: a real button that opens the platform's camera or file chooser (through the port), then uploads. */
export function PhotoPicker({ task, photos, copy, onUploaded }: {
  task: Pick<Task, 'id' | 'hasEvidence'>;
  photos: PhotoPort;
  copy: { addPhoto: string; newPhoto: string; savingPhoto: string; photoSaved: string; photoFailed: string; photoTooBig: string };
  onUploaded: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ text: string; error: boolean } | null>(null);

  async function chosen(file: File | undefined) {
    if (!file || busy) return;
    setBusy(true); setNotice(null);
    const result = await photos.upload(task.id, file);
    setBusy(false);
    if (!result.ok) {
      setNotice({ text: result.code === 'PAYLOAD_TOO_LARGE' ?copy.photoTooBig : copy.photoFailed, error: true });
      return;
    }
    setNotice({ text: copy.photoSaved, error: false });
    onUploaded();
  }

  return <>
    <Button size="sm" pending={busy} pendingLabel={copy.savingPhoto}
      onClick={() => void photos.pick().then((file) => chosen(file ?? undefined))}>{task.hasEvidence ? copy.newPhoto : copy.addPhoto}</Button>
    {notice ? <InlineNotice tone={notice.error ? 'error' : 'success'} live>{notice.text}</InlineNotice> : null}
  </>;
}

const POCKETS = ['save', 'spend', 'share'] as const;

/** The three pockets: our own pocket art, the word and the coins (02 §4.3: colour, icon and label together; the coin mark, 02 §9.5). */
export function PocketRow({ pockets, copy, heading, note, action }: {
  pockets: Pockets; copy: { save: string; spend: string; share: string; coin: string; coins: string }; heading: string; note?: string; action?: ReactNode;
}) {
  return <section className="lf-money-pockets" data-family-part="pockets" aria-label={heading}>
    <h2 data-copy-role="heading">{heading}</h2>
    {note ? <p className="lf-console-muted" data-copy-role="body">{note}</p> : null}
    <ul>
      {POCKETS.map((pocket) => <li key={pocket} data-pocket={pocket}>
        <PocketMark pocket={pocket} size="lg" />
        <span data-copy-role="option">{copy[pocket]}</span>
        <CoinAmount className="lf-money-pocket-amount">{coinWord(copy, pockets[pocket])}</CoinAmount>
      </li>)}
    </ul>
    {action}
  </section>;
}
