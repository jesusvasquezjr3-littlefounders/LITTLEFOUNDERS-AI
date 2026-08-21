import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Card, Icon } from '@/components/ui';
import { cn } from '@/lib/utils';
import type { StartSessionInput } from './tutorApi';
import type { TutorOffers } from './types';

/*
 * How a session starts (/ORACLE.md §9.2).
 *
 * A CLOSED SET, ALWAYS. Four ways in — a course topic, a skill the system
 * flagged, a curated question, or open conversation — and the first three are
 * ids, never text. Only the fourth is free-form, and it is the one every
 * defence in /ORACLE.md §5 exists for.
 *
 * THE "STRUGGLING WITH" CARD IS AN OFFER AND NEVER A VERDICT. The copy asks
 * rather than tells, declining costs nothing and is not recorded as a fact
 * about anyone, and the card is only rendered when the evidence is actually
 * strong enough (Core filters on evidenceCount and uncertainty before it gets
 * here). A tutor that opens with "you are behind on this" is a tutor a child
 * stops opening.
 *
 * COLD START IS THE NORMAL CASE at the moment: the courses sit in `review`, so
 * most learners have no evidence at all. When there is nothing to offer, this
 * says so honestly and starts a short diagnostic instead of inventing a
 * weakness.
 */

export interface OfferPanelProps {
  offers: TutorOffers;
  voiceAvailable: boolean;
  microphoneBlockedBy: string | null;
  starting: boolean;
  onStart: (input: StartSessionInput) => void;
}

export function OfferPanel({
  offers,
  voiceAvailable,
  microphoneBlockedBy,
  starting,
  onStart,
}: OfferPanelProps) {
  const { t } = useTranslation();
  const [wantsVoice, setWantsVoice] = useState(voiceAvailable && microphoneBlockedBy === null);

  const start = (input: Omit<StartSessionInput, 'wantsVoice'>) =>
    onStart({ ...input, wantsVoice: wantsVoice && voiceAvailable && microphoneBlockedBy === null });

  const hasWeakSkills = offers.weakSkills.length > 0;

  return (
    <div className="space-y-4">
      {offers.intelDegraded && (
        <p className="lf-body rounded-md bg-warning-soft px-3 py-2 text-content" role="status">
          {t('tutor.offers.intelDegraded')}
        </p>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        <OfferCard
          icon="school"
          title={t('tutor.offers.courseTopic.title')}
          body={t('tutor.offers.courseTopic.body')}
          disabled={starting}
          onSelect={() => start({ intent: 'course_topic' })}
        />

        {hasWeakSkills ? (
          offers.weakSkills.map((skill) => (
            <OfferCard
              key={skill.skillKey}
              icon="lightbulb"
              title={t('tutor.offers.weakSkill.title')}
              // Phrased as an invitation. The skill key is shown as a readable
              // topic name, never as a score and never as a judgement.
              body={t('tutor.offers.weakSkill.body', { topic: readableSkill(skill.skillKey) })}
              disabled={starting}
              onSelect={() =>
                start({
                  intent: 'weak_skill',
                  skillKey: skill.skillKey,
                  courseId: skill.courseId,
                  topicId: skill.topicId,
                })
              }
            />
          ))
        ) : (
          <OfferCard
            icon="explore"
            title={t('tutor.offers.diagnostic.title')}
            body={t('tutor.offers.diagnostic.body')}
            disabled={starting}
            onSelect={() => start({ intent: 'diagnostic' })}
          />
        )}

        {offers.faqIds.slice(0, 2).map((faqId) => (
          <OfferCard
            key={faqId}
            icon="help"
            title={t(`tutor.faq.${faqId}`)}
            body={t('tutor.offers.faq.body')}
            disabled={starting}
            onSelect={() => start({ intent: 'faq', skillKey: faqId })}
          />
        ))}

        {offers.canAskOpen && (
          <OfferCard
            icon="chat"
            title={t('tutor.offers.open.title')}
            body={t('tutor.offers.open.body')}
            disabled={starting}
            onSelect={() => start({ intent: 'open' })}
          />
        )}
      </div>

      <Card className="flex flex-col gap-2 p-4">
        {voiceAvailable && microphoneBlockedBy === null ? (
          <label className="flex min-h-[44px] cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              className="h-5 w-5 accent-accent"
              checked={wantsVoice}
              onChange={(event) => setWantsVoice(event.target.checked)}
            />
            <span className="lf-body text-content">{t('tutor.offers.useVoice')}</span>
          </label>
        ) : (
          /*
           * Explaining a silent session beats letting it look broken. The
           * three reasons are genuinely different and the learner deserves to
           * know which one applies: no consent yet, no provider configured, or
           * a device that cannot record.
           */
          <p className="lf-body text-content-muted">
            {microphoneBlockedBy === 'CONSENT_REQUIRED'
              ? t('tutor.offers.voiceNeedsConsent')
              : t('tutor.offers.voiceUnavailable')}
          </p>
        )}
      </Card>
    </div>
  );
}

function OfferCard({
  icon,
  title,
  body,
  disabled,
  onSelect,
}: {
  icon: string;
  title: string;
  body: string;
  disabled: boolean;
  onSelect: () => void;
}) {
  return (
    <Card interactive className="flex h-full flex-col gap-2 p-4">
      <span className="flex items-center gap-2">
        <Icon name={icon} className="text-primary" />
        <span className="lf-title text-content">{title}</span>
      </span>
      <p className="lf-body flex-1 text-content-muted">{body}</p>
      <Button onClick={onSelect} disabled={disabled} className={cn('w-full')}>
        {title}
      </Button>
    </Card>
  );
}

/**
 * `course-slug/topic-slug` → something a child can read.
 *
 * A skill key is an internal identifier and showing it raw ("investing/riesgo
 * -y-rendimiento") makes the tutor look like a database. Titles would be
 * better and are a Core change; this is the honest interim rather than
 * pretending the key is a title.
 */
function readableSkill(skillKey: string): string {
  const topic = skillKey.includes('/') ? skillKey.slice(skillKey.indexOf('/') + 1) : skillKey;
  return topic.replace(/[-_]/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
}
