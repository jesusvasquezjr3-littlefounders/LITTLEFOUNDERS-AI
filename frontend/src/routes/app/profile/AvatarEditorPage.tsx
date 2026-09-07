import { useId, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/auth/AuthContext';
import { api } from '@/lib/api';
import { trackInsight } from '@/lib/insights';
import {
  AVATAR_CATALOG,
  defaultAvatarOptions,
  randomAvatarOptions,
  type AvatarOptions,
  type CatalogKey,
} from '@/lib/avatarOptions';
import { Avatar } from '@/components/Avatar';
import { Button, Card, Icon, SectionHeading } from '@/components/ui';
import { ErrorBanner } from '@/routes/auth/ErrorBanner';
import { cn } from '@/lib/utils';

/*
 * /profile/avatar — the Avataaars dress-up room. Everything renders live and
 * locally; saving stores the option set (jsonb) — never an image.
 */

const COLOR_KEYS: CatalogKey[] = ['skinColor', 'hairColor', 'clothesColor'];

interface Section {
  key: CatalogKey;
  icon: string;
  /** toggles a probability field between 0 and 100 alongside the choice */
  probabilityKey?: 'facialHairProbability' | 'accessoriesProbability';
}

const SECTIONS: Section[] = [
  { key: 'skinColor', icon: 'face' },
  { key: 'top', icon: 'face_retouching_natural' },
  { key: 'hairColor', icon: 'palette' },
  { key: 'eyes', icon: 'visibility' },
  { key: 'eyebrows', icon: 'expand_less' },
  { key: 'mouth', icon: 'sentiment_satisfied' },
  { key: 'facialHair', icon: 'face_6', probabilityKey: 'facialHairProbability' },
  { key: 'clothing', icon: 'apparel' },
  { key: 'clothesColor', icon: 'format_color_fill' },
  { key: 'accessories', icon: 'eyeglasses', probabilityKey: 'accessoriesProbability' },
];

export function AvatarEditorPage() {
  const { t } = useTranslation();
  const { session, avatarOptions, getToken, refreshMe } = useAuth();
  const navigate = useNavigate();
  const userId = session?.user.id ?? 'littlefounder';

  const [options, setOptions] = useState<AvatarOptions & { seed?: string }>(() =>
    Object.keys(avatarOptions).length > 0 ? (avatarOptions as AvatarOptions) : defaultAvatarOptions(userId),
  );
  const [saving, setSaving] = useState(false);
  const [errorCode, setErrorCode] = useState<string | null>(null);

  function choose(section: Section, value: string) {
    setOptions((o) => ({
      ...o,
      [section.key]: [value],
      ...(section.probabilityKey ? { [section.probabilityKey]: 100 } : {}),
    }));
  }

  function clearOptional(section: Section) {
    if (!section.probabilityKey) return;
    setOptions((o) => ({ ...o, [section.probabilityKey!]: 0 }));
  }

  async function save() {
    setSaving(true);
    setErrorCode(null);
    const token = await getToken();
    const { error } = await api('/profile/avatar', { method: 'PUT', body: { options }, token });
    if (!error) trackInsight('avatar_edit', { routeClass: 'profile' });
    setSaving(false);
    if (error) {
      setErrorCode(error.code);
      return;
    }
    await refreshMe();
    navigate('/profile');
  }

  function isSelected(section: Section, value: string): boolean {
    const current = options[section.key]?.[0];
    if (section.probabilityKey && (options[section.probabilityKey] ?? 0) === 0) return false;
    return current === value;
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="lf-display-lg text-content">{t('profile.avatarEditor.title')}</h1>
          <p className="lf-body-lg mt-1 text-content-muted">{t('profile.avatarEditor.subtitle')}</p>
        </div>
        <Link
          to="/profile"
          className="lf-press lf-label inline-flex min-h-11 items-center gap-1 rounded-full px-3 text-content-muted hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <Icon name="arrow_back" />
          {t('profile.avatarEditor.back')}
        </Link>
      </div>

      {errorCode && <div className="mt-4"><ErrorBanner code={errorCode} /></div>}

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        {/* Live preview — sticky on desktop */}
        <div className="lg:sticky lg:top-10 lg:self-start">
          <Card hero className="relative flex flex-col items-center gap-5 overflow-hidden py-8">
            <div className="absolute inset-x-0 top-0 h-24 bg-primary-soft/60" aria-hidden="true" />
            <div className="relative flex flex-col items-center gap-3">
              {/* The study's icon well, in the hue this page's cards select in. */}
              <span className="lf-tile h-12 w-12 text-accent">
                <Icon name="visibility" />
              </span>
              <p className="lf-label text-content">{t('profile.avatarEditor.preview')}</p>
            </div>
            <Avatar options={options} seed={userId} className="h-44 w-44 bg-surface-sunken" />
            <Button variant="secondary" className="gap-2 px-5 py-2.5" onClick={() => setOptions((o) => ({ seed: o.seed ?? userId, ...randomAvatarOptions() }))}>
              <Icon name="casino" />
              {t('profile.avatarEditor.randomize')}
            </Button>
            <Button onClick={() => void save()} disabled={saving} className="w-full gap-2">
              <Icon name={saving ? 'progress_activity' : 'check'} className={saving ? 'animate-spin' : undefined} />
              {saving ? t('profile.avatarEditor.saving') : t('profile.avatarEditor.save')}
            </Button>
          </Card>
        </div>

        {/* Option sections */}
        <div className="flex flex-col gap-6">
          {SECTIONS.map((section) => (
            <OptionSection
              key={section.key}
              section={section}
              options={options}
              userId={userId}
              isSelected={isSelected}
              onChoose={choose}
              onClearOptional={clearOptional}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * ONE DRESS-UP SECTION — the study's lockup over a grid of pick cards.
 *
 * A component of its own because the lockup owns the id that NAMES its own
 * radio-ish group, and `useId` cannot be called inside a `.map`. The tone is
 * `accent` on every section for one reason: `.lf-pick-card-on` fills, borders
 * and glows in `--lf-accent`, so accent is what these cards actually select
 * in, and a tile in any other hue would be the section teaching the wrong
 * thing about its own colour (/DESIGN.md §The section heading is a lockup).
 *
 * The "None" chip stays OUTSIDE the lockup's `meta` slot: meta is a count, a
 * status or a reward, and never a control.
 */
function OptionSection({
  section,
  options,
  userId,
  isSelected,
  onChoose,
  onClearOptional,
}: {
  section: Section;
  options: AvatarOptions & { seed?: string };
  userId: string;
  isSelected: (section: Section, value: string) => boolean;
  onChoose: (section: Section, value: string) => void;
  onClearOptional: (section: Section) => void;
}) {
  const { t } = useTranslation();
  const headingId = useId();
  const isColor = COLOR_KEYS.includes(section.key);
  const cleared = section.probabilityKey ? (options[section.probabilityKey] ?? 0) === 0 : false;

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between gap-3">
        <SectionHeading
          id={headingId}
          icon={section.icon}
          tone="accent"
          className="min-w-0 flex-1"
        >
          {t(`profile.avatarEditor.sections.${section.key}`)}
        </SectionHeading>
        {section.probabilityKey && (
          <button
            type="button"
            onClick={() => onClearOptional(section)}
            aria-pressed={cleared}
            className={cn(
              // A chip, so `rounded-full`, and 44px tall like every other tap
              // target on the page (§Shape, §Tap floor).
              'lf-caption mb-3 inline-flex min-h-11 shrink-0 items-center rounded-full px-4 font-bold transition-colors duration-150 lf-press focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
              cleared ? 'bg-accent text-on-accent' : 'bg-surface-sunken text-content-muted hover:text-content',
            )}
          >
            {t('profile.avatarEditor.none')}
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-2" role="group" aria-labelledby={headingId}>
        {AVATAR_CATALOG[section.key].map((value) => {
          const selected = isSelected(section, value);
          return (
            <button
              key={value}
              type="button"
              aria-label={value}
              aria-pressed={selected}
              onClick={() => onChoose(section, value)}
              className={cn(
                'lf-pick-card motion-safe-press lf-press focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                /*
                 * A COLOUR SWATCH IS A DISC, so it keeps `rounded-full` and
                 * takes its fill from an inline style that beats the class's
                 * own background — the 2px border, the glow and the corner
                 * disc are what carry selection. It was 40px, which is under
                 * the 44px tap floor; 48 clears it and still fits five across
                 * a 375px viewport.
                 */
                isColor ? 'h-12 w-12 !rounded-full' : 'p-1',
                selected && 'lf-pick-card-on',
              )}
              style={isColor ? { backgroundColor: `#${value}` } : undefined}
            >
              {selected && (
                <span className="lf-pick-check" aria-hidden>
                  <Icon name="check" className="!text-[12px]" />
                </span>
              )}
              {!isColor && (
                <Avatar
                  options={{ ...options, [section.key]: [value], ...(section.probabilityKey ? { [section.probabilityKey]: 100 } : {}) }}
                  seed={userId}
                  className="h-14 w-14 bg-transparent"
                />
              )}
            </button>
          );
        })}
      </div>
    </Card>
  );
}
