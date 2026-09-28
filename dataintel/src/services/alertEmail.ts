/*
 * H.3: the internal email an alert trigger sends, in the body the
 * email-server's POST /api/v1/send accepts (email-server/src/app.ts SendBody:
 * `to`, a required `subject`, `text`, `templateType`). The email-server has no
 * template renderer, so the message is plain text written here.
 *
 * Contract: dataintel/src/__tests__/fixtures/alert-email-body.json is what
 * this function produces for a fixed trigger, and the email-server's copy of
 * the same fixture (email-server/src/__tests__/fixtures/alert-email-body.json)
 * must be byte-identical and must get a 202 from the real route. Change both.
 */

export interface AlertEmailTrigger {
  name: string;
  metric: string;
  condition: 'above' | 'below' | 'change_pct';
  threshold: number;
  value: number;
  triggeredAt: string;
}

export interface AlertEmailBody {
  to: string;
  subject: string;
  text: string;
  templateType: 'alert_notification';
}

const CONDITION: Record<AlertEmailTrigger['condition'], string> = {
  above: 'above',
  below: 'below',
  change_pct: 'changed by more than (%)',
};

export function alertEmailBody(to: string, trigger: AlertEmailTrigger): AlertEmailBody {
  return {
    to,
    subject: `[LittleFounders alert] ${trigger.name}`,
    text: [
      `Alert: ${trigger.name}`,
      `Metric: ${trigger.metric}`,
      `Condition: ${CONDITION[trigger.condition]} ${trigger.threshold}`,
      `Value: ${trigger.value}`,
      `Triggered at: ${trigger.triggeredAt}`,
      '',
      'Sent by the warehouse alert evaluator (dataintel). The trigger and this delivery are recorded in alert_history.',
    ].join('\n'),
    templateType: 'alert_notification',
  };
}
