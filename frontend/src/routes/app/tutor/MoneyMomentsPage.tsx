import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/auth/AuthContext';
import { api } from '@/lib/api';
import { Button, Card, Icon, LoadingOverlay } from '@/components/ui';
import { cn } from '@/lib/utils';
import { ErrorBanner } from '@/routes/auth/ErrorBanner';
import MarkdownLite from '@/lesson-engine/core/MarkdownLite';
import { localizedText, type Json } from '@/routes/app/learn/types';

/*
 * /tutor — Oracle v1: Money Moments (Little Language Lessons' Tiny Lesson
 * pattern, §1.9-safe by construction): the kid picks a real money SITUATION
 * from a curated set — never free text — and gets a pre-generated,
 * human-published micro-pack: key words in kid language, what you could say
 * or do, and one quick check. Zero runtime AI; Core serves from the
 * pre-gated pool.
 */

interface Situation {
  id: string;
  icon: string;
  title: Json;
  description: Json;
  available: boolean;
}

interface Pack {
  terms: { term: string; kid_definition: string }[];
  phrases: { say_md: string; why_md: string }[];
  quick_check: {
    question_md: string;
    options: { id: string; text_md: string; correct: boolean; rationale_md: string }[];
  };
}

type ListState = { status: 'loading' } | { status: 'error'; code: string } | { status: 'ready'; situations: Situation[] };
type PackState =
  | { status: 'idle' }
  | { status: 'loading'; situation: Situation }
  | { status: 'pending'; situation: Situation }
  | { status: 'ready'; situation: Situation; pack: Pack };

export function MoneyMomentsPage() {
  const { t, i18n } = useTranslation();
  const { getToken } = useAuth();
  const [list, setList] = useState<ListState>({ status: 'loading' });
  const [packState, setPackState] = useState<PackState>({ status: 'idle' });
  const [picked, setPicked] = useState<string | null>(null);
  const locale = i18n.resolvedLanguage ?? 'en-US';

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const token = await getToken();
      if (!token || cancelled) return;
      const { data, error } = await api<{ situations: Situation[] }>('/tutor/situations', { token });
      if (cancelled) return;
      setList(error ? { status: 'error', code: error.code } : { status: 'ready', situations: data.situations });
    })();
    return () => {
      cancelled = true;
    };
  }, [getToken]);

  async function openSituation(situation: Situation) {
    setPicked(null);
    setPackState({ status: 'loading', situation });
    const token = await getToken();
    if (!token) return;
    const { data, error } = await api<{ pack: Pack }>(`/tutor/situations/${situation.id}/pack`, { token });
    if (error) {
      // Not generated/published yet — an honest, friendly pending state.
      setPackState({ status: 'pending', situation });
      return;
    }
    setPackState({ status: 'ready', situation, pack: data.pack });
  }

  if (list.status === 'loading') return <LoadingOverlay label={t('tutor.loading')} />;
  if (list.status === 'error') return <ErrorBanner code={list.code} />;

  const showingPack = packState.status === 'ready' || packState.status === 'pending' || packState.status === 'loading';

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 py-6 md:px-6">
      {!showingPack ? (
        <>
          <header>
            <h1 className="lf-display text-content">{t('tutor.title')}</h1>
            <p className="lf-body text-content-muted">{t('tutor.subtitle')}</p>
          </header>
          <ul className="grid gap-3 sm:grid-cols-2">
            {list.situations.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => void openSituation(s)}
                  className={cn(
                    'flex min-h-14 w-full items-center gap-3 rounded-lg border border-outline/70 bg-surface px-4 py-3 text-left shadow-glass-sm',
                    'transition-[border-color,transform] duration-150 hover:border-primary/60 active:translate-y-px',
                    'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
                  )}
                >
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary-soft">
                    <Icon name={s.icon} className="text-[22px] text-primary" aria-hidden />
                  </span>
                  <span className="min-w-0">
                    <span className="lf-label block text-content">{localizedText(s.title, locale)}</span>
                    <span className="lf-caption block text-content-muted">{localizedText(s.description, locale)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <>
          <header>
            <button
              type="button"
              onClick={() => setPackState({ status: 'idle' })}
              className="lf-caption flex min-h-11 items-center gap-1 font-bold text-primary hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <Icon name="arrow_back" className="text-[16px]" aria-hidden /> {t('tutor.back')}
            </button>
            <h1 className="lf-display mt-1 text-content">{localizedText(packState.situation.title, locale)}</h1>
            <p className="lf-body text-content-muted">{localizedText(packState.situation.description, locale)}</p>
          </header>

          {packState.status === 'loading' ? (
            <LoadingOverlay label={t('tutor.packLoading')} />
          ) : packState.status === 'pending' ? (
            <Card className="flex flex-col items-center gap-3 p-8 text-center">
              <Icon name="hourglass_top" className="text-[40px] text-content-faint" aria-hidden />
              <h2 className="lf-title text-content">{t('tutor.pendingTitle')}</h2>
              <p className="lf-body max-w-md text-content-muted">{t('tutor.pendingBody')}</p>
            </Card>
          ) : (
            <>
              <Card className="flex flex-col gap-3 p-5">
                <h2 className="lf-title text-content">{t('tutor.termsTitle')}</h2>
                <ul className="flex flex-col divide-y divide-outline/50">
                  {packState.pack.terms.map((term) => (
                    <li key={term.term} className="py-2.5">
                      <p className="lf-label font-bold text-primary">{term.term}</p>
                      <MarkdownLite text={term.kid_definition} className="lf-body text-content" />
                    </li>
                  ))}
                </ul>
              </Card>

              <Card className="flex flex-col gap-3 p-5">
                <h2 className="lf-title text-content">{t('tutor.phrasesTitle')}</h2>
                <ul className="flex flex-col gap-3">
                  {packState.pack.phrases.map((phrase, i) => (
                    <li key={i} className="rounded-lg bg-surface-sunken p-3">
                      <MarkdownLite text={phrase.say_md} className="lf-body font-semibold text-content" />
                      <MarkdownLite text={phrase.why_md} className="lf-body-sm mt-1 text-content-muted" />
                    </li>
                  ))}
                </ul>
              </Card>

              <Card className="flex flex-col gap-3 p-5">
                <h2 className="lf-title text-content">{t('tutor.quickCheckTitle')}</h2>
                <MarkdownLite text={packState.pack.quick_check.question_md} className="lf-body text-content" />
                <ul className="flex flex-col gap-2">
                  {packState.pack.quick_check.options.map((option) => {
                    const revealed = picked !== null;
                    const isPicked = picked === option.id;
                    return (
                      <li key={option.id}>
                        <button
                          type="button"
                          disabled={revealed}
                          onClick={() => setPicked(option.id)}
                          className={cn(
                            'w-full rounded-lg border-2 px-4 py-3 text-left transition-colors duration-150 min-h-11',
                            'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
                            !revealed && 'border-outline/70 bg-surface hover:border-primary/60',
                            revealed && option.correct && 'border-success bg-success-soft/40',
                            revealed && !option.correct && isPicked && 'border-error bg-error-soft/40',
                            revealed && !option.correct && !isPicked && 'border-outline/40 bg-surface opacity-70',
                          )}
                        >
                          <MarkdownLite text={option.text_md} className="lf-body text-content" as="span" />
                          {revealed && (option.correct || isPicked) ? (
                            <MarkdownLite text={option.rationale_md} className="lf-body-sm mt-1.5 text-content-muted" />
                          ) : null}
                        </button>
                      </li>
                    );
                  })}
                </ul>
                {picked !== null ? (
                  <div className="text-center">
                    <Button variant="secondary" onClick={() => setPicked(null)}>
                      {t('tutor.tryAgain')}
                    </Button>
                  </div>
                ) : null}
              </Card>
            </>
          )}
        </>
      )}
    </div>
  );
}

export default MoneyMomentsPage;
