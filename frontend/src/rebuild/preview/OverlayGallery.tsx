import { useEffect, useState } from 'react';
import type en from '../../i18n/en-US/rebuild-core.json';
import {
  Button, ButtonGroup, Card, ConfirmDialog, DestructiveAction, Dialog, IconButton, List, ListRow, Menu, Popover, Sheet, Tooltip, useAnnounce, useToast,
} from '../design/controls';
import './gallery.css';

export type GalleryCopy = typeof en.designGallery;
export type SystemCopy = typeof en.designSystem;

/**
 * Preview-only catalogue of every overlay and out-of-flow feedback state
 * (S03.2). The page is deliberately long, so the matrix can open each overlay
 * after scrolling and prove it is fixed to the viewport and that the page does
 * not move (02 rules 12 and 13).
 */
export function OverlayGallery({ t, s, onBack }: { t: GalleryCopy; s: SystemCopy; onBack: () => void }) {
  const toast = useToast();
  const announce = useAnnounce();
  const [dialog, setDialog] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [sheetConfirm, setSheetConfirm] = useState(false);
  // Audit hook (preview only): lets the browser matrix raise a toast while a dialog is open, to prove the 02 §9.8 order (toast 70 above scrim 65).
  useEffect(() => {
    const hook = window as unknown as { __lfGalleryToast?: (message: string) => void };
    hook.__lfGalleryToast = (message) => { toast.show({ tone: 'info', message }); };
    return () => { delete hook.__lfGalleryToast; };
  }, [toast]);
  const goals = [t.goalBike, t.goalBook, t.goalGift, t.goalGame, t.goalBike, t.goalBook, t.goalGift, t.goalGame];
  const remove = () => {
    setRemoving(true);
    window.setTimeout(() => { setRemoving(false); setConfirm(false); toast.show({ tone: 'success', message: t.removed }); }, 400);
  };
  return <main className="lf-preview lf-preview--gallery" data-surface="app" data-screen="overlays">
    <div className="lf-preview-content lf-gallery">
      <Button onClick={onBack}>{t.allComponents}</Button>
      <h1 data-copy-role="heading">{t.overlays}</h1>

      <section className="lf-gallery-section" aria-labelledby="gallery-dialogs">
        <h2 id="gallery-dialogs" data-copy-role="heading">{t.dialogs}</h2>
        <ButtonGroup>
          <Button variant="brand" data-open="dialog" onClick={() => setDialog(true)}>{t.openGoal}</Button>
          <Button variant="danger" data-open="confirm" aria-haspopup="dialog" onClick={() => setConfirm(true)}>{t.removeGoal}</Button>
        </ButtonGroup>
        <div data-open="destructive">
          <DestructiveAction label={t.removeGoal} confirm={{ heading: t.confirmHeading, consequence: t.confirmBody, keepLabel: t.keepGoal,
            confirmLabel: t.removeGoal, pendingLabel: t.removing }}
            onConfirm={() => new Promise<void>((done) => window.setTimeout(() => { toast.show({ tone: 'success', message: t.removed }); done(); }, 400))} />
        </div>
      </section>

      <section className="lf-gallery-section" aria-labelledby="gallery-panels">
        <h2 id="gallery-panels" data-copy-role="heading">{t.panels}</h2>
        <Button variant="sky" data-open="sheet" onClick={() => setSheet(true)}>{s.details}</Button>
      </section>

      <section className="lf-gallery-section" aria-labelledby="gallery-tips">
        <h2 id="gallery-tips" data-copy-role="heading">{t.tips}</h2>
        <div className="lf-gallery-row">
          <Popover label={t.why} trigger={(props) => <Button size="sm" data-open="popover" {...props}>{t.why}</Button>}>
            <p data-copy-role="body">{t.whyBody}</p>
          </Popover>
          <Menu label={t.moreActions} items={[
            { id: 'edit', label: t.editGoal, onSelect: () => toast.show({ tone: 'info', message: t.menuDone }) },
            { id: 'pause', label: t.pauseGoal, onSelect: () => toast.show({ tone: 'info', message: t.menuDone }) },
            { id: 'archive', label: t.archiveGoal, onSelect: () => undefined, disabled: true },
            { id: 'share', label: t.shareGoal, onSelect: () => toast.show({ tone: 'info', message: t.menuDone }) },
          ]} trigger={(props) => <Button size="sm" data-open="menu" {...props}>{t.moreActions}</Button>} />
          <Tooltip content={t.tipBody}>
            {(props) => <IconButton glyph="info" label={t.aboutCoins} variant="soft" data-open="tooltip" {...props} />}
          </Tooltip>
        </div>
      </section>

      <section className="lf-gallery-section" aria-labelledby="gallery-messages">
        <h2 id="gallery-messages" data-copy-role="heading">{t.messages}</h2>
        <ButtonGroup>
          <Button variant="success" data-open="toast" onClick={() => toast.show({ tone: 'success', message: t.saved, action: { label: t.undo, onPress: () => announce(t.menuDone) } })}>{t.saveGoal}</Button>
          <Button data-open="toast-error" onClick={() => toast.show({ tone: 'error', message: s.error })}>{t.showError}</Button>
        </ButtonGroup>
      </section>

      <section className="lf-gallery-section" aria-labelledby="gallery-more">
        <h2 id="gallery-more" data-copy-role="heading">{t.moreGoals}</h2>
        <List label={t.moreGoals}>
          {goals.map((goal, index) => <ListRow key={index} title={goal} supporting={t.goalLeft} />)}
        </List>
        <Card heading={s.cardTitle} headingLevel={3}>
          <p data-copy-role="body">{t.goalBody}</p>
          <Button variant="brand" data-open="dialog-bottom" onClick={() => setDialog(true)}>{t.openGoal}</Button>
        </Card>
      </section>
    </div>

    <Dialog open={dialog} onClose={() => setDialog(false)} heading={s.cardTitle} description={t.goalBody}
      actions={<Button variant="accent" onClick={() => setDialog(false)}>{t.done}</Button>} />
    <ConfirmDialog open={confirm} destructive heading={t.confirmHeading} consequence={t.confirmBody} keepLabel={t.keepGoal} confirmLabel={t.removeGoal}
      pendingLabel={t.removing} pending={removing} onKeep={() => setConfirm(false)} onConfirm={remove} />
    <Sheet open={sheet} onClose={() => setSheet(false)} heading={t.sheetHeading} closeLabel={s.close}
      footer={<Button variant="danger" data-open="sheet-confirm" aria-haspopup="dialog" onClick={() => setSheetConfirm(true)}>{t.removeGoal}</Button>}>
      <p data-copy-role="body">{t.sheetBody}</p>
    </Sheet>
    <ConfirmDialog open={sheetConfirm} destructive heading={t.confirmHeading} consequence={t.confirmBody} keepLabel={t.keepGoal} confirmLabel={t.removeGoal}
      onKeep={() => setSheetConfirm(false)} onConfirm={() => { setSheetConfirm(false); setSheet(false); toast.show({ tone: 'success', message: t.removed }); }} />
  </main>;
}
