import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Badge, Card, Icon } from "@/components/ui";
import { SunkenWell } from "@/lesson-engine/core/primitives";

/*
 * The transcript and the memory note below are both invented for this page —
 * no real child's conversation is ever shown here or anywhere marketing-
 * facing. What is NOT invented is the mechanic: a Tutor memory note never
 * applies until a Tutor approves it (migration 0068), and this is the one
 * exchange on the exchange itself, not a summary of it — the distinction the
 * whole block exists to make. Approving here is local state, never a write.
 */
export function TutorVisibilityDemo() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [memoryDecision, setMemoryDecision] = useState<"pending" | "approved">("pending");

  return (
    <Card hero className="mx-auto w-full max-w-xl p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <h3 className="lf-title text-content">{t("marketing.families.tutor.cardTitle")}</h3>
        <Badge>{t("marketing.families.panel.disclaimer")}</Badge>
      </div>

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="lf-press lf-label mt-4 flex min-h-11 w-full items-center justify-between gap-2 rounded-md border border-outline bg-base px-4 py-2.5 text-content transition-colors duration-150 hover:bg-surface-sunken/50"
      >
        {open ? t("marketing.families.tutor.hide") : t("marketing.families.tutor.reveal")}
        <Icon name={open ? "expand_less" : "expand_more"} aria-hidden />
      </button>

      {open && (
        <div className="mt-4 flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <SunkenWell>
              <p className="lf-caption font-semibold text-content-faint">{t("marketing.families.tutor.kidLabel")}</p>
              <p className="lf-body text-content">{t("marketing.families.tutor.kidLine")}</p>
            </SunkenWell>
            <div className="rounded-lg border border-primary/30 bg-primary-soft/40 p-3">
              <p className="lf-caption font-semibold text-primary">{t("marketing.families.tutor.tutorLabel")}</p>
              <p className="lf-body text-content">{t("marketing.families.tutor.tutorLine")}</p>
            </div>
          </div>

          <div className="rounded-lg border border-outline bg-surface-sunken/40 p-3.5">
            <div className="flex items-start gap-2.5">
              <Icon name="psychology" className="mt-0.5 shrink-0 text-content-faint" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="lf-caption font-semibold text-content">{t("marketing.families.tutor.memoryPrompt")}</p>
                <p className="lf-caption mt-1 text-content-muted">“{t("marketing.families.tutor.memoryNote")}”</p>
              </div>
            </div>
            {memoryDecision === "pending" ? (
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => setMemoryDecision("approved")}
                  className="lf-caption lf-press rounded-full bg-success px-3 py-1.5 font-bold text-on-success"
                >
                  {t("marketing.families.tutor.approveMemory")}
                </button>
                <button
                  type="button"
                  className="lf-caption lf-press rounded-full bg-surface-sunken px-3 py-1.5 font-bold text-content-muted"
                >
                  {t("marketing.families.tutor.declineMemory")}
                </button>
              </div>
            ) : (
              <p className="lf-caption mt-3 flex items-center gap-1.5 font-bold text-success-strong">
                <Icon name="check_circle" className="text-[15px]" aria-hidden />
                {t("marketing.families.tutor.memoryApproved")}
              </p>
            )}
          </div>

          <p className="lf-caption flex items-center gap-2 text-content-faint">
            <Icon name="mic_off" className="text-[16px]" aria-hidden />
            {t("marketing.families.tutor.micNote")}
          </p>
        </div>
      )}
    </Card>
  );
}
