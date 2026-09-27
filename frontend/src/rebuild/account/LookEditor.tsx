import { useId } from 'react';
import { Button, ErrorState, InlineNotice, LoadingState, PictureChoice, type PictureOption } from '../design/controls';
import { CartoonAvatar, CoverArt } from './avatar/CartoonAvatar';
import {
  AVATAR_PARTS, COLOUR_PARTS, COVER_IDS, EDITOR_PARTS, OPTIONAL_PARTS, withPart,
  type AvatarLook, type AvatarPart, type CoverId,
} from './avatar/avatarKit';
import { BackLink } from './navLink';
import '../design/tokens.css';
import '../design/system.css';
import './account.css';

/*
 * P2, THE LOOK EDITOR (E.12, B.24; Frontend Bible 02 §4.4, §8, 07).
 *
 * The person picks their cartoon avatar part by part, and one of the ten
 * cover presets. Nothing here is a photo, a URL or free text: every choice
 * is one value of the closed set Core and the database accept (E.12), drawn
 * from our own sprites. Each part is one radio group, so the keyboard moves
 * through a part with the arrow keys and Tab jumps to the next part; every
 * option has a translated name (no raw option identifiers reach a screen
 * reader). The selected option carries a ring and a check, never colour
 * alone (02 rule 6).
 *
 * B.24: this is cosmetic personalisation. The copy never presents it as a
 * choice about learning, and nothing is earned, unlocked or rewarded here.
 * "Random look" draws a cosmetic look (the route draws it; the draw is on the
 * B.22 allowlist as a non-reward purpose).
 */

/** The value of the "None" option of an optional part (a stored option value is never empty). */
const NONE = '';
/** Parts shown as a close-up of the face, so a small thumbnail still tells the options apart. */
const FACE_PARTS: readonly AvatarPart[] = ['eyes', 'eyebrows', 'mouth', 'facialHair', 'accessories'];

type OptionNames = { [P in AvatarPart]: Record<string, string> } & { cover: Record<CoverId, string> };

export interface LookEditorCopy {
  title: string; intro: string; back: string; loading: string; failedTitle: string; failedBody: string; offlineTitle: string; offlineBody: string;
  retry: string; retrying: string; previewLabel: string; random: string; save: string; saving: string; saveFailed: string; offlineSave: string;
  none: string; parts: Record<AvatarPart | 'cover', string>; options: OptionNames;
}

export type LookEditorView =
  | { kind: 'loading' }
  | { kind: 'failed'; offline: boolean; retrying: boolean }
  | { kind: 'ready'; look: AvatarLook; cover: CoverId; saving: boolean; error: 'failed' | 'offline' | null };

export function LookEditor({ copy, locale, dark, ageBand, view, onChange, onCover, onRandom, onSave, onRetry, onNavigate }: {
  copy: LookEditorCopy;
  locale: string;
  dark: boolean;
  ageBand?: '6-9';
  view: LookEditorView;
  onChange: (look: AvatarLook) => void;
  onCover: (cover: CoverId) => void;
  onRandom: () => void;
  onSave: () => void;
  onRetry: () => void;
  onNavigate: (href: string) => void;
}) {
  const header = <header className="lf-account-header">
    <BackLink href="/profile" label={copy.back} onNavigate={onNavigate} />
    <h1 data-copy-role="heading">{copy.title}</h1>
    <p className="lf-account-muted" data-copy-role="body">{copy.intro}</p>
  </header>;
  return <div className="lf-rebuild lf-account-screen" data-screen="look-editor" data-theme={dark ? 'dark' : 'light'} lang={locale}
    data-age-band={ageBand} aria-busy={view.kind === 'loading'}>
    {header}
    {view.kind === 'loading' ? <LoadingState label={copy.loading} lines={4} />
      : view.kind === 'failed' ? <ErrorState heading={view.offline ? copy.offlineTitle : copy.failedTitle} body={view.offline ? copy.offlineBody : copy.failedBody}
        retryLabel={copy.retry} retryingLabel={copy.retrying} retrying={view.retrying} onRetry={onRetry} />
        : <div className="lf-look-layout">
          <section className="lf-look-preview" aria-label={copy.previewLabel}>
            <div className="lf-look-preview-cover"><CoverArt cover={view.cover} /></div>
            <span className="lf-look-preview-avatar"><CartoonAvatar look={view.look} size="xl" label={copy.previewLabel} /></span>
            <div className="lf-look-preview-actions">
              <Button onClick={onRandom} disabled={view.saving}>{copy.random}</Button>
              <Button variant="accent" pending={view.saving} pendingLabel={copy.saving} onClick={onSave}>{copy.save}</Button>
              <div className="lf-account-live" aria-live="assertive">
                {view.error ? <InlineNotice tone="error">{view.error === 'offline' ? copy.offlineSave : copy.saveFailed}</InlineNotice> : null}
              </div>
            </div>
          </section>
          <div className="lf-look-parts">
            {EDITOR_PARTS.map((part) => <PartPicker key={part} part={part} copy={copy} look={view.look} disabled={view.saving}
              onPick={(value) => onChange(withPart(view.look, part, value))} />)}
            <CoverPicker copy={copy} cover={view.cover} disabled={view.saving} onPick={onCover} />
          </div>
        </div>}
  </div>;
}

function PartPicker({ part, copy, look, disabled, onPick }: {
  part: AvatarPart; copy: LookEditorCopy; look: AvatarLook; disabled: boolean; onPick: (value: string | null) => void;
}) {
  const name = `lf-look-${part}-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const colour = COLOUR_PARTS.includes(part);
  const values = AVATAR_PARTS[part] as readonly string[];
  const options: PictureOption<string>[] = [
    // "None" is an option of the part itself, so the part stays one radio group.
    ...(part in OPTIONAL_PARTS ? [{ value: NONE, label: copy.none }] : []),
    ...values.map((value) => ({
      value, label: copy.options[part][value] ?? value,
      ...(colour ? { swatch: `#${value}` }
        : { picture: <CartoonAvatar look={withPart(look, part, value)} size="sm" framing={FACE_PARTS.includes(part) ? 'face' : 'bust'} /> }),
    })),
  ];
  return <div className="lf-look-part" data-part={part}>
    <PictureChoice legend={copy.parts[part]} legendRole="heading" name={name} options={options} value={look[part] ?? NONE} disabled={disabled}
      onValueChange={(value) => onPick(value === NONE ? null : value)} />
  </div>;
}

function CoverPicker({ copy, cover, disabled, onPick }: { copy: LookEditorCopy; cover: CoverId; disabled: boolean; onPick: (cover: CoverId) => void }) {
  const name = `lf-look-cover-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const options: PictureOption<CoverId>[] = COVER_IDS.map((id) => ({
    value: id, label: copy.options.cover[id], picture: <span className="lf-look-cover-thumb"><CoverArt cover={id} /></span>,
  }));
  return <div className="lf-look-part" data-part="cover">
    <PictureChoice legend={copy.parts.cover} legendRole="heading" name={name} options={options} value={cover} disabled={disabled} onValueChange={onPick} />
  </div>;
}
