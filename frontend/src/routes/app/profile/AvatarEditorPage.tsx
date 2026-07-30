import { useState } from 'react';
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
import { Button, Card, Icon } from '@/components/ui';
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
          className="lf-label inline-flex min-h-11 items-center gap-1 rounded-full px-3 text-content-muted hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <Icon name="arrow_back" />
          {t('profile.avatarEditor.back')}
        </Link>
      </div>

      {errorCode && <div className="mt-4"><ErrorBanner code={errorCode} /></div>}

      <div className="mt-8 grid gap-6 lg:grid-cols-[320px_1fr]">
        {/* Live preview — sticky on desktop */}
        <div className="lg:sticky lg:top-10 lg:self-start">
          <Card className="flex flex-col items-center gap-5 py-8">
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
            <Card key={section.key} className="p-5">
              <div className="flex items-center justify-between gap-3">
                <h2 className="lf-label flex items-center gap-2 text-content">
                  <Icon name={section.icon} className="text-primary" />
                  {t(`profile.avatarEditor.sections.${section.key}`)}
                </h2>
                {section.probabilityKey && (
                  <button
                    type="button"
                    onClick={() => clearOptional(section)}
                    className={cn(
                      'lf-caption rounded-full px-3 py-1 font-bold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                      (options[section.probabilityKey] ?? 0) === 0
                        ? 'bg-primary-soft text-primary'
                        : 'bg-surface-sunken text-content-muted hover:text-content',
                    )}
                  >
                    {t('profile.avatarEditor.none')}
                  </button>
                )}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {AVATAR_CATALOG[section.key].map((value) =>
                  COLOR_KEYS.includes(section.key) ? (
                    <button
                      key={value}
                      type="button"
                      aria-label={value}
                      aria-pressed={isSelected(section, value)}
                      onClick={() => choose(section, value)}
                      className={cn(
                        'motion-safe-press h-10 w-10 rounded-full border border-outline/60 transition-transform duration-150 hover:-translate-y-0.5 active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                        isSelected(section, value) && 'ring-2 ring-primary ring-offset-2 ring-offset-base',
                      )}
                      style={{ backgroundColor: `#${value}` }}
                    />
                  ) : (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={isSelected(section, value)}
                      onClick={() => choose(section, value)}
                      className={cn(
                        'motion-safe-press rounded-full p-1 transition-transform duration-150 hover:-translate-y-0.5 active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                        isSelected(section, value) ? 'bg-primary-soft ring-2 ring-primary' : 'bg-surface-sunken hover:bg-outline/50',
                      )}
                    >
                      <Avatar
                        options={{ ...options, [section.key]: [value], ...(section.probabilityKey ? { [section.probabilityKey]: 100 } : {}) }}
                        seed={userId}
                        className="h-14 w-14 bg-transparent"
                      />
                    </button>
                  ),
                )}
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
