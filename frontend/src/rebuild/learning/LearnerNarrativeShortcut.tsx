import type { Locale } from '../design/copyBudget';
import { Button } from '../design/controls';
import '../design/tokens.css';
import '../design/system.css';
import './narrative.css';
import { SelfBridgeList, decisionJournalCopy } from './DecisionJournalView';
import type { BridgeOutcome, SelfBridge } from './narrative';

/*
 * B.9 / B.13 (S05.3c) — the learner's way in to their own story, placed on
 * the learning home by its host. It shows an independent teen's open "try it
 * for real" prompts where they already are (a prompt nobody sees bridges
 * nothing), then one quiet link to the decision journal. Core sends prompts
 * only to an independent teen (Option B), so for every other learner this is
 * the link alone. No counter, no badge, no reminder copy (B.25).
 *
 * Presentation only: the host owns transport and navigation.
 */
export function LearnerNarrativeShortcut({ bridges, locale, dark, onOpenJournal, onBridge, fixture = false }: {
  bridges: SelfBridge[];
  locale: Locale;
  dark: boolean;
  onOpenJournal: () => void;
  onBridge: (id: string, answer: 'act' | 'dismiss') => Promise<BridgeOutcome>;
  fixture?: boolean;
}) {
  const t = decisionJournalCopy[locale];
  return <section className="lf-rebuild lf-learner-shortcut" data-theme={dark ? 'dark' : 'light'} lang={locale} data-surface="app"
    data-screen={fixture ? 'learner-shortcut-preview' : 'learner-shortcut'} aria-label={t.title}>
    <SelfBridgeList bridges={bridges} locale={locale} onBridge={onBridge} />
    <div className="lf-learner-shortcut-link">
      <Button onClick={onOpenJournal}>{t.title}</Button>
    </div>
  </section>;
}
