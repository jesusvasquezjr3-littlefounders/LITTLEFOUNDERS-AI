import { useState, type FormEvent } from 'react';
import type en from '../../i18n/en-US/rebuild.json';
import {
  Banner, Button, ButtonGroup, Card, Celebration, celebrationPart, Checkbox, Chip, ChipGroup, ChoiceChip, CountUp, EmptyState, ErrorState,
  IconButton, InlineNotice, List, ListRow, LoadingState, MentorAvatar, Pill, ProgressBar, RadioGroup, RewardChip, SegmentedControl,
  SelectField, Slider, Stepper, Switch, TextField,
} from '../design/controls';
import './systemGallery.css';

export type SystemGalleryCopy = typeof en.designSystem;

/**
 * Preview-only catalogue of the shared control set in every state (S03.1).
 * It exists so the browser matrix can measure each control in three locales,
 * both modes and every width. It is not a product screen: its first-view word
 * count is not budgeted, every individual string is.
 */
export function SystemGallery({ t, theme, onBack }: { t: SystemGalleryCopy; theme: 'light' | 'dark'; onBack: () => void }) {
  const [goal, setGoal] = useState('');
  const [goalError, setGoalError] = useState(false);
  const [coins, setCoins] = useState('12');
  const [passphrase, setPassphrase] = useState('blue-river-42');
  const [date, setDate] = useState('2026-09-24');
  const [pocket, setPocket] = useState('save');
  const [remind, setRemind] = useState(true);
  const [often, setOften] = useState<'daily' | 'weekly' | null>('weekly');
  const [sounds, setSounds] = useState(false);
  const [view, setView] = useState<'chart' | 'table'>('chart');
  const [amount, setAmount] = useState(15);
  const [share, setShare] = useState(2);
  const [chips, setChips] = useState<Record<'save' | 'spend' | 'share', boolean>>({ save: true, spend: false, share: false });
  const [retrying, setRetrying] = useState(false);
  const [planChecked, setPlanChecked] = useState(false);
  const [moment, setMoment] = useState(1);
  // A moment celebrates once per session (sessionStorage); each visit to the catalogue is a new demonstration moment.
  const [visit] = useState(() => Date.now().toString(36));
  const coinsText = (n: number) => t.coinsValue.replace('{n}', String(n));
  const submit = (event: FormEvent) => { event.preventDefault(); setGoalError(!goal.trim()); };
  const pockets = [{ value: 'save', label: t.pocketSave }, { value: 'spend', label: t.pocketSpend }, { value: 'share', label: t.pocketShare }] as const;

  return <main className="lf-preview lf-preview--system" data-surface="app" data-screen="system">
    <div className="lf-preview-content lf-system-gallery">
      <Button onClick={onBack}>{t.close}</Button>
      <h1 data-copy-role="heading">{t.title}</h1>

      <section className="lf-system-section" aria-labelledby="system-buttons">
        <h2 id="system-buttons" data-copy-role="heading">{t.buttons}</h2>
        <ButtonGroup>
          <Button variant="accent">{t.continue}</Button>
          <Button variant="brand">{t.open}</Button>
          <Button variant="success">{t.approve}</Button>
          <Button variant="reward">{t.claim}</Button>
          <Button variant="sky">{t.help}</Button>
          <Button variant="mint">{t.saveCoins}</Button>
          <Button variant="berry">{t.share}</Button>
          <Button variant="danger">{t.remove}</Button>
          <Button>{t.cancel}</Button>
        </ButtonGroup>
        <ButtonGroup>
          <Button size="sm">{t.cancel}</Button>
          <Button variant="brand" size="lg">{t.open}</Button>
          <Button variant="accent" disabled>{t.continue}</Button>
          <Button variant="success" pending pendingLabel={t.saving}>{t.approve}</Button>
        </ButtonGroup>
        <div className="lf-system-row">
          <IconButton glyph="close" label={t.close} />
          <IconButton glyph="menu" label={t.menu} variant="soft" />
          <IconButton glyph="close" label={t.close} disabled />
        </div>
        <Card tone="primary" heading={t.cardTitle} headingLevel={3}>
          <Pill tone="inverse">{t.simulation}</Pill>
          <p data-copy-role="body">{t.cardBody}</p>
          <div className="lf-system-row">
            <Button variant="inverse">{t.details}</Button>
            <IconButton glyph="close" label={t.close} variant="inverse" />
          </div>
        </Card>
      </section>

      <section className="lf-system-section" aria-labelledby="system-fields">
        <h2 id="system-fields" data-copy-role="heading">{t.fields}</h2>
        <form className="lf-system-form" noValidate onSubmit={submit}>
          <TextField label={t.goal} help={t.goalHelp} error={goalError ? t.goalError : undefined} value={goal}
            onChange={(event) => { setGoal(event.target.value); setGoalError(false); }} />
          <Button variant="brand" type="submit">{t.continue}</Button>
        </form>
        <TextField type="number" label={t.coins} inputMode="numeric" min={0} value={coins} onChange={(event) => setCoins(event.target.value)} />
        <TextField type="password" label={t.passphrase} revealLabels={{ show: t.show, hide: t.hide }} autoComplete="off"
          value={passphrase} onChange={(event) => setPassphrase(event.target.value)} />
        <TextField type="date" label={t.date} value={date} onChange={(event) => setDate(event.target.value)} />
        <TextField label={t.goal} value={t.cardTitle} disabled readOnly />
        <SelectField label={t.pocket} options={pockets} value={pocket} onChange={(event) => setPocket(event.target.value)} />
        <Checkbox label={t.remind} checked={remind} onChange={(event) => setRemind(event.target.checked)} />
        <Checkbox label={t.remind} checked disabled readOnly />
      </section>

      <section className="lf-system-section" aria-labelledby="system-choices">
        <h2 id="system-choices" data-copy-role="heading">{t.choices}</h2>
        <RadioGroup legend={t.often} name="system-often" value={often} onValueChange={setOften}
          options={[{ value: 'daily', label: t.daily }, { value: 'weekly', label: t.weekly }]} />
        <Switch label={t.sounds} checked={sounds} onCheckedChange={setSounds} stateLabels={{ on: t.on, off: t.off }} />
        <Switch label={t.remind} checked disabled onCheckedChange={() => undefined} stateLabels={{ on: t.on, off: t.off }} />
        <SegmentedControl legend={t.view} name="system-view" value={view} onValueChange={setView}
          options={[{ value: 'chart', label: t.chart }, { value: 'table', label: t.table }]} />
        <Slider label={t.amount} valueText={coinsText(amount)} min={0} max={50} step={5} value={amount} onValueChange={setAmount} />
        <Stepper label={t.share} value={share} valueText={coinsText(share)} min={0} max={5} onValueChange={setShare} labels={{ decrease: t.less, increase: t.more }} />
        <ChipGroup label={t.pocket}>
          {pockets.map((item) => <ChoiceChip key={item.value} selected={chips[item.value]}
            onToggle={() => setChips((current) => ({ ...current, [item.value]: !current[item.value] }))}>{item.label}</ChoiceChip>)}
        </ChipGroup>
      </section>

      <section className="lf-system-section" aria-labelledby="system-status">
        <h2 id="system-status" data-copy-role="heading">{t.status}</h2>
        <ChipGroup>
          <Chip tone="success" glyph="check">{t.approved}</Chip>
          <Chip tone="warning" glyph="info">{t.waiting}</Chip>
          <Chip tone="error" glyph="warning">{t.notSent}</Chip>
          <Chip tone="sky" glyph="info">{t.new}</Chip>
          <Chip tone="primary" glyph="info">{t.simulation}</Chip>
          <RewardChip>{coinsText(40)}</RewardChip>
        </ChipGroup>
        <ChipGroup>
          <Pill tone="primary">{t.new}</Pill>
          <Pill tone="success">{t.approved}</Pill>
          <Pill tone="reward" role="data">{coinsText(40)}</Pill>
          <Pill tone="sky">{t.pocketSpend}</Pill>
          <Pill tone="mint">{t.pocketSave}</Pill>
          <Pill tone="berry">{t.pocketShare}</Pill>
        </ChipGroup>
      </section>

      <section className="lf-system-section" aria-labelledby="system-cards">
        <h2 id="system-cards" data-copy-role="heading">{t.cards}</h2>
        <Card heading={t.cardTitle} headingLevel={3}>
          <p data-copy-role="body">{t.cardBody}</p>
          <ProgressBar label={t.progress} value={3} max={5} valueText={t.progressValue} />
        </Card>
        <Card tone="mint" heading={t.courseTitle} headingLevel={3}><p data-copy-role="body">{t.courseBody}</p></Card>
        <List label={t.cards}>
          <ListRow title={t.rowLesson} supporting={t.rowLessonInfo} onPress={() => undefined} />
          <ListRow title={t.rowTask} supporting={t.rowTaskInfo} trailing={<Chip tone="warning" glyph="info">{t.waiting}</Chip>} />
          <ListRow title={t.mentorName} titleRole="data" leading={<MentorAvatar renderId={`mentor.dina.avatar.${theme}`} label={null} size="sm" />}
            trailing={<RewardChip>{coinsText(40)}</RewardChip>} />
        </List>
      </section>

      <section className="lf-system-section" aria-labelledby="system-feedback">
        <h2 id="system-feedback" data-copy-role="heading">{t.feedback}</h2>
        <Banner tone="success">{t.correct}</Banner>
        <Banner tone="retry">{t.retry}</Banner>
        <Banner tone="info">{t.info}</Banner>
        <Banner tone="error">{t.error}</Banner>
        <InlineNotice tone="info">{t.notice}</InlineNotice>
        <InlineNotice tone="success">{t.info}</InlineNotice>
        <InlineNotice tone="retry">{t.retry}</InlineNotice>
        <ProgressBar label={t.progress} value={3} max={5} valueText={t.progressValue} tone="mint" />
        <LoadingState label={t.loading} />
        <EmptyState heading={t.empty} body={t.emptyBody} action={<Button variant="brand">{t.open}</Button>} />
        <ErrorState heading={t.failed} body={t.failedBody} retryLabel={t.retryAction} retryingLabel={t.retrying} retrying={retrying}
          onRetry={() => setRetrying(true)} />
      </section>

      <section className="lf-system-section" aria-labelledby="system-motion">
        <h2 id="system-motion" data-copy-role="heading">{t.motion}</h2>
        {/* Armed: the call to action bumps once when the checkbox makes it usable (02 §9.1). */}
        <Checkbox label={t.armLabel} checked={planChecked} onChange={(event) => setPlanChecked(event.target.checked)} />
        <ButtonGroup>
          <Button variant="success" disabled={!planChecked}>{t.approve}</Button>
          {/* The one breathing call to action of this screen (02 §9.4). */}
          <Button variant="accent" breathing>{t.continue}</Button>
        </ButtonGroup>
        {/* A milestone on the OD-7 list celebrates once per moment; reduced motion shows this settled frame. */}
        <Celebration key={moment} milestone="badge-earned" momentId={`gallery-${visit}-${moment}`}>
          <Card heading={t.badgeEarned} headingLevel={3}>
            <div className="lf-system-row">
              <img src="/rebuild/art/lesson-medal.svg" alt="" className={`lf-system-medal ${celebrationPart('pop').className}`} />
              <p className={celebrationPart('rise', 1).className} style={celebrationPart('rise', 1).style} data-copy-role="data">
                <CountUp value={40} format={(value) => `+${value}`} /> {t.xpEarned}</p>
            </div>
            <Button onClick={() => setMoment((value) => value + 1)}>{t.replay}</Button>
          </Card>
        </Celebration>
      </section>

      <section className="lf-system-section" aria-labelledby="system-mentor">
        <h2 id="system-mentor" data-copy-role="heading">{t.mentor}</h2>
        <div className="lf-system-row">
          <MentorAvatar renderId={`mentor.dina.avatar.${theme}`} label={t.mentorName} size="lg" />
          <MentorAvatar renderId={`mentor.dina.avatar.${theme}`} label={t.mentorName} size="md" />
          <MentorAvatar renderId={`mentor.dina.avatar.${theme}`} label={t.mentorName} size="sm" />
        </div>
      </section>
    </div>
  </main>;
}
