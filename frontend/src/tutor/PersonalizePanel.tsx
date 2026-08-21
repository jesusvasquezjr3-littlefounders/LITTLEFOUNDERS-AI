import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Card, Field } from '@/components/ui';
import { CharacterActor } from '@/components/characters/control/CharacterActor';
import type { CharacterId } from '@/components/characters/control/types';
import { cn } from '@/lib/utils';
import type { Adaptation, TutorCatalog, TutorPreferences } from './types';

/*
 * "Where are we, and who am I talking to?"
 *
 * THE CATALOG COMES FROM THE SERVER. There is no hard-coded list of characters
 * or dioramas in this file — Core serves them with the preferences, so
 * commissioning a third island is content work and not a frontend release
 * (/ORACLE.md §0 assumption 1).
 *
 * ALL FOUR CHARACTERS ARE SELECTABLE (owner decision 4), including the two
 * whose mouths do not move in 3D. The picker says so plainly rather than
 * hiding it: a learner who chooses Liruf and then wonders why his mouth is
 * still has been misled, and one who was told he "talks with his whole body"
 * has been given a choice.
 *
 * THE NICKNAME IS LOAD-BEARING, not decoration. It is the only name-shaped
 * value that ever reaches the model (/ORACLE.md §4.1), which is exactly why
 * the field explains that and why the server rejects anything that looks like
 * a real full name.
 */

export interface PersonalizePanelProps {
  preferences: TutorPreferences;
  catalog: TutorCatalog;
  saving: boolean;
  onSave: (patch: Partial<TutorPreferences>) => void;
  onDone: () => void;
}

export function PersonalizePanel({
  preferences,
  catalog,
  saving,
  onSave,
  onDone,
}: PersonalizePanelProps) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<TutorPreferences>(preferences);
  const [nicknameError, setNicknameError] = useState<string | null>(null);

  const set = <K extends keyof TutorPreferences>(key: K, value: TutorPreferences[K]) => {
    setDraft((prev) => {
      const next = { ...prev, [key]: value };
      // A companion that is also the lead would render the same character
      // twice on the island. Clearing it silently is kinder than an error the
      // learner has to go and fix.
      if (key === 'character' && next.companion === value) next.companion = null;
      return next;
    });
  };

  const toggleAdaptation = (adaptation: Adaptation) => {
    setDraft((prev) => ({
      ...prev,
      adaptations: prev.adaptations.includes(adaptation)
        ? prev.adaptations.filter((a) => a !== adaptation)
        : [...prev.adaptations, adaptation],
    }));
  };

  const submit = () => {
    const nickname = draft.nickname?.trim() ?? '';
    if (nickname !== '' && !/^[\p{L}\p{N}][\p{L}\p{N} '_-]*$/u.test(nickname)) {
      setNicknameError(t('tutor.personalize.nicknameInvalid'));
      return;
    }
    setNicknameError(null);
    onSave({ ...draft, nickname: nickname === '' ? null : nickname });
    onDone();
  };

  return (
    <div className="space-y-6">
      <section aria-labelledby="tutor-cast">
        <h2 id="tutor-cast" className="lf-headline mb-1 text-content">
          {t('tutor.personalize.whoTitle')}
        </h2>
        <p className="lf-body mb-3 text-content-muted">{t('tutor.personalize.whoHelp')}</p>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {catalog.characters.map((id) => (
            <CharacterChoice
              key={id}
              id={id}
              selected={draft.character === id}
              articulates={catalog.articulates.includes(id)}
              label={t(`tutor.character.${id}.name`)}
              note={
                catalog.articulates.includes(id)
                  ? t(`tutor.character.${id}.blurb`)
                  : t('tutor.personalize.bodyTalker')
              }
              onSelect={() => set('character', id)}
            />
          ))}
        </div>
      </section>

      <section aria-labelledby="tutor-companion">
        <h2 id="tutor-companion" className="lf-headline mb-1 text-content">
          {t('tutor.personalize.companionTitle')}
        </h2>
        <p className="lf-body mb-3 text-content-muted">{t('tutor.personalize.companionHelp')}</p>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <ChoiceTile
            selected={draft.companion === null}
            label={t('tutor.personalize.noCompanion')}
            onSelect={() => set('companion', null)}
          />
          {catalog.characters
            .filter((id) => id !== draft.character)
            .map((id) => (
              <ChoiceTile
                key={id}
                selected={draft.companion === id}
                label={t(`tutor.character.${id}.name`)}
                onSelect={() => set('companion', id)}
              />
            ))}
        </div>
      </section>

      <section aria-labelledby="tutor-place">
        <h2 id="tutor-place" className="lf-headline mb-1 text-content">
          {t('tutor.personalize.whereTitle')}
        </h2>
        <p className="lf-body mb-3 text-content-muted">{t('tutor.personalize.whereHelp')}</p>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {catalog.dioramas.map((id) => (
            <ChoiceTile
              key={id}
              selected={draft.diorama === id}
              label={t(`tutor.diorama.${id}`, { defaultValue: id })}
              onSelect={() => set('diorama', id)}
            />
          ))}
        </div>

        <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-5">
          {catalog.backdrops.map((id) => (
            <ChoiceTile
              key={id}
              selected={draft.backdrop === id}
              label={t(`tutor.backdrop.${id}`, { defaultValue: id })}
              onSelect={() => set('backdrop', id)}
            />
          ))}
        </div>
      </section>

      <section aria-labelledby="tutor-name">
        <h2 id="tutor-name" className="lf-headline mb-1 text-content">
          {t('tutor.personalize.nicknameTitle')}
        </h2>
        <Card className="p-4">
          <Field
            label={t('tutor.personalize.nicknameLabel')}
            hint={t('tutor.personalize.nicknameHint')}
            error={nicknameError ?? undefined}
            value={draft.nickname ?? ''}
            maxLength={24}
            onChange={(event) => set('nickname', event.target.value)}
          />
        </Card>
      </section>

      <section aria-labelledby="tutor-adapt">
        <h2 id="tutor-adapt" className="lf-headline mb-1 text-content">
          {t('tutor.personalize.adaptTitle')}
        </h2>
        {/*
          Framed as a preference the learner sets, never as a diagnosis
          (/ORACLE.md §11). Nothing here is inferred, nothing is written from
          telemetry, and the tutor may only OFFER to add one.
        */}
        <p className="lf-body mb-3 text-content-muted">{t('tutor.personalize.adaptHelp')}</p>

        <div className="grid gap-2 sm:grid-cols-2">
          {catalog.adaptations.map((adaptation) => (
            <label
              key={adaptation}
              className={cn(
                'flex cursor-pointer items-center gap-3 rounded-md border p-3 transition-colors',
                draft.adaptations.includes(adaptation)
                  ? 'border-primary bg-accent-soft'
                  : 'border-outline bg-surface hover:border-primary',
              )}
            >
              <input
                type="checkbox"
                className="h-5 w-5 accent-accent"
                checked={draft.adaptations.includes(adaptation)}
                onChange={() => toggleAdaptation(adaptation)}
              />
              <span className="lf-body text-content">{t(`tutor.adaptation.${adaptation}`)}</span>
            </label>
          ))}
        </div>
      </section>

      <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
        <Button variant="secondary" onClick={onDone} className="w-full sm:w-auto">
          {t('tutor.personalize.skip')}
        </Button>
        <Button onClick={submit} disabled={saving} className="w-full sm:w-auto">
          {saving ? t('tutor.personalize.saving') : t('tutor.personalize.save')}
        </Button>
      </div>
    </div>
  );
}

function CharacterChoice({
  id,
  selected,
  articulates,
  label,
  note,
  onSelect,
}: {
  id: CharacterId;
  selected: boolean;
  articulates: boolean;
  label: string;
  note: string;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        'flex flex-col items-center gap-2 rounded-lg border p-3 text-center transition-colors',
        selected ? 'border-primary bg-accent-soft' : 'border-outline bg-surface hover:border-primary',
      )}
    >
      <span className="h-20 w-20">
        <CharacterActor
          character={id}
          emotion={selected ? 'happy' : 'neutral'}
          action={selected ? 'wave' : 'idle'}
          size="fill"
          enableMouseTracking={false}
        />
      </span>
      <span className="lf-label text-content">{label}</span>
      <span className={cn('lf-caption', articulates ? 'text-content-muted' : 'text-content-muted')}>
        {note}
      </span>
    </button>
  );
}

function ChoiceTile({
  selected,
  label,
  onSelect,
}: {
  selected: boolean;
  label: string;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        // ≥44px tap target (DESIGN.md): this is used by six-year-olds on phones.
        'min-h-[44px] rounded-md border px-3 py-2.5 text-center transition-colors',
        selected ? 'border-primary bg-accent-soft' : 'border-outline bg-surface hover:border-primary',
      )}
    >
      <span className="lf-label text-content">{label}</span>
    </button>
  );
}
