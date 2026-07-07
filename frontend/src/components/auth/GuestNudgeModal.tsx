import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Sparkles, UserPlus } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { getGuestProfile, isGuest } from "@/lib/guestProfile";

/**
 * GuestNudgeModal — gentle, Duolingo-style reminder for guests to create an
 * account so their progress becomes permanent. Low-friction by design:
 *  - Only for guests with no real account (stops automatically once registered).
 *  - At most once per browser session, and never more often than every 4 hours.
 *  - Appears a few seconds AFTER entering the app (never blocks the first paint).
 * The always-visible amber GuestBanner is the persistent reminder; this is the
 * occasional one.
 */
const LAST_KEY = "lf_guest_nudge_last";
const SESSION_KEY = "lf_guest_nudge_session";
const MIN_INTERVAL_MS = 4 * 60 * 60 * 1000; // 4 hours between nudges
const SHOW_DELAY_MS = 12000; // appear 12s after entering — unobtrusive

export function GuestNudgeModal() {
  const { t } = useTranslation("dashboard");
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const guest = getGuestProfile();

  useEffect(() => {
    // Only nudge guests who have not created a real account yet.
    if (!isGuest() || localStorage.getItem("user")) return;
    if (sessionStorage.getItem(SESSION_KEY)) return; // already nudged this session
    const last = Number(localStorage.getItem(LAST_KEY) || 0);
    if (Date.now() - last < MIN_INTERVAL_MS) return;

    const timer = setTimeout(() => {
      setOpen(true);
      sessionStorage.setItem(SESSION_KEY, "1");
      localStorage.setItem(LAST_KEY, String(Date.now()));
    }, SHOW_DELAY_MS);
    return () => clearTimeout(timer);
  }, []);

  if (!guest) return null;

  const handleCreate = () => {
    setOpen(false);
    navigate("/signup");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="corp corp-dialog rounded-3xl sm:max-w-md p-0 overflow-hidden">
        <div className="p-7 text-center">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-amber-100 dark:bg-amber-500/15 border border-amber-200 dark:border-amber-500/30 flex items-center justify-center mb-5">
            <Sparkles className="w-7 h-7 text-amber-500 dark:text-amber-400" />
          </div>
          <DialogTitle className="corp-h3">
            {t("guest.nudge_title", { name: guest.name })}
          </DialogTitle>
          <DialogDescription className="corp-body mt-3">
            {t("guest.nudge_body", { xp: guest.xp, streak: guest.current_streak })}
          </DialogDescription>
          <div className="mt-7 flex flex-col gap-2">
            <button
              type="button"
              onClick={handleCreate}
              className="corp-btn-primary w-full h-11 rounded-xl corp-body-sm font-semibold inline-flex items-center justify-center gap-2"
            >
              <UserPlus className="w-4 h-4" />
              {t("guest.nudge_cta")}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="w-full h-10 rounded-xl corp-body-sm hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
            >
              {t("guest.nudge_later")}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default GuestNudgeModal;
