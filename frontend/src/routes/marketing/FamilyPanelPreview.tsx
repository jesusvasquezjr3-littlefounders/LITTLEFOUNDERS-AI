import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Badge, Card, CountUp, Icon, LottieIcon } from "@/components/ui";
import { cn } from "@/lib/utils";

/*
 * A clickable stand-in for /family (FamilyPage.tsx), not a screenshot of it.
 * Two illustrative kids, entirely client-side state — no auth, no API call,
 * nothing persisted. Every number is fixed and labelled as a preview, the
 * same honesty rule /how-it-works' Lottie trio already follows for its
 * illustrative streak/lesson/coin values: a visitor must never read this as a
 * real family's data.
 *
 * The pending-approval chip and the insights switch are the two real
 * FamilyPage affordances worth feeling rather than reading about — approving
 * a redemption and toggling a child's analytics consent are both one tap on
 * the real page, so they are one tap here too.
 */

interface DemoKid {
  id: string;
  nameKey: string;
  usernameKey: string;
  coins: number;
  streakDays: number;
  hasPending: boolean;
}

const DEMO_KIDS: DemoKid[] = [
  { id: "sofia", nameKey: "sofiaName", usernameKey: "sofiaUsername", coins: 84, streakDays: 12, hasPending: false },
  { id: "mateo", nameKey: "mateoName", usernameKey: "mateoUsername", coins: 31, streakDays: 4, hasPending: true },
];

function KidRow({ kid }: { kid: DemoKid }) {
  const { t } = useTranslation();
  const [pendingResolved, setPendingResolved] = useState(false);
  const [pendingOpen, setPendingOpen] = useState(false);
  const [consent, setConsent] = useState(false);

  const name = t(`marketing.families.panel.${kid.nameKey}`);
  const username = t(`marketing.families.panel.${kid.usernameKey}`);

  return (
    <li className="rounded-lg border border-outline/70 bg-surface shadow-glass-sm">
      <div className="flex min-h-14 items-center gap-4 px-4 py-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary-soft lf-title font-bold text-primary">
          {name.charAt(0).toUpperCase()}
        </span>
        <span className="min-w-0 flex-1">
          <span className="lf-label block truncate text-content">{name}</span>
          <span className="lf-caption block truncate text-content-faint">@{username}</span>
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-outline/50 px-4 py-2.5">
        {/* Coin/streak Lotties, decorative-only per the "Marketing /
            decorative preview use" exception (streak, lesson, gold-coin
            only) — same trio HowItWorks' account block already reuses.
            `activated` because a preview kid's stats are never zero-state. */}
        <span className="lf-caption flex items-center gap-1 rounded-full bg-success-soft py-1 pl-1 pr-2.5 font-bold text-success-strong">
          <LottieIcon name="gold-coin" value={kid.coins} activated className="h-5 w-5" />
          <CountUp value={kid.coins} from="zero" />
          {" "}
          {t("marketing.families.panel.coinsLabel")}
        </span>
        {kid.streakDays > 0 && (
          <span className="lf-caption flex items-center gap-1 rounded-full bg-warning-soft py-1 pl-1 pr-2.5 font-bold text-warning-strong">
            <LottieIcon name="streak" value={kid.streakDays} activated className="h-5 w-5" />
            <CountUp value={kid.streakDays} from="zero" />
            {t("marketing.families.panel.streakLabel")}
          </span>
        )}
        {kid.hasPending && !pendingResolved && (
          <button
            type="button"
            onClick={() => setPendingOpen((open) => !open)}
            aria-expanded={pendingOpen}
            className="lf-caption lf-press flex items-center gap-1.5 rounded-full bg-accent-soft px-2.5 py-1 font-bold text-accent transition-colors duration-150 hover:bg-accent/20"
          >
            <Icon name="pending_actions" className="text-[15px]" aria-hidden />
            {t("marketing.families.panel.pendingChip")}
          </button>
        )}
        {kid.hasPending && pendingResolved && (
          <span className="lf-caption flex items-center gap-1.5 rounded-full bg-success-soft px-2.5 py-1 font-bold text-success-strong">
            <Icon name="check_circle" className="text-[15px]" aria-hidden />
            {t("marketing.families.panel.pendingApproved")}
          </span>
        )}
      </div>

      {kid.hasPending && pendingOpen && !pendingResolved && (
        <div className="border-t border-outline/50 bg-accent-soft/40 px-4 py-3">
          <p className="lf-caption text-content">{t("marketing.families.panel.pendingDetail")}</p>
          <div className="mt-2.5 flex gap-2">
            <button
              type="button"
              onClick={() => setPendingResolved(true)}
              className="lf-caption lf-press rounded-full bg-success px-3 py-1.5 font-bold text-on-success"
            >
              {t("marketing.families.panel.approve")}
            </button>
            <button
              type="button"
              onClick={() => setPendingOpen(false)}
              className="lf-caption lf-press rounded-full bg-surface-sunken px-3 py-1.5 font-bold text-content-muted"
            >
              {t("marketing.families.panel.notYet")}
            </button>
          </div>
        </div>
      )}

      <div className="flex items-center gap-3 border-t border-outline/50 px-4 py-2.5">
        <Icon name="query_stats" className="shrink-0 text-[18px] text-content-faint" aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="lf-caption block text-content">{t("marketing.families.panel.consentLabel")}</span>
          <span className="lf-caption block text-content-faint">
            {consent ? t("marketing.families.panel.consentOnHint") : t("marketing.families.panel.consentOffHint")}
          </span>
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={consent}
          aria-label={t("marketing.families.panel.consentLabel")}
          onClick={() => setConsent((c) => !c)}
          className={cn(
            "relative h-6 w-11 shrink-0 rounded-full transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
            consent ? "bg-primary" : "bg-outline",
          )}
        >
          <span
            className={cn(
              "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-[left] duration-150",
              consent ? "left-[22px]" : "left-0.5",
            )}
          />
        </button>
      </div>
    </li>
  );
}

export function FamilyPanelPreview() {
  const { t } = useTranslation();

  return (
    <Card hero className="mx-auto w-full max-w-xl p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <h3 className="lf-title text-content">{t("marketing.families.panel.cardTitle")}</h3>
        <Badge>{t("marketing.families.panel.disclaimer")}</Badge>
      </div>
      <ul className="mt-4 flex flex-col gap-3">
        {DEMO_KIDS.map((kid) => (
          <KidRow key={kid.id} kid={kid} />
        ))}
      </ul>
    </Card>
  );
}
