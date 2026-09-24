# UX State Failures

**Scope & method.** Static review of every form/mutation/interactive component reachable from the authenticated app (auth, family, tasks, banking, profile, onboarding, lesson player) for three explicit states: a visible loading/busy indicator while a request is in flight, a visible error message on failure, and — where relevant — a visible success confirmation. Mobile/responsive gaps were found by grepping Tailwind classes for fixed-width and fixed-column-count patterns with no responsive breakpoint override, across the same component set plus the admin analytics dashboards. Findings are cited to `file:line`.

---

## Missing Feedback

1. **`frontend/src/routes/app/tasks/ParentTaskBoard.tsx:119-123`** (`onToggleCatalog`) — no busy state on the triggering button, and the success path is gated on `if (res.data)` only — on `res.error` the function returns having done nothing visible. A parent toggling a reward item that fails to save sees no indication the tap registered and no explanation of the failure.

2. **`frontend/src/routes/app/tasks/KidTaskBoard.tsx:156-163`** (`onArchiveGoal`) — the triggering `ConfirmButton` is not disabled while the request is in flight, and on `res.error` nothing is rendered. A kid tapping "Archive" during a failing request sees no busy state and no error.

3. **`frontend/src/routes/app/tasks/KidTaskBoard.tsx:165-171`** (`onRedeem`) — `busyRedemption` does disable/relabel the button while in flight, but on `res.error` the button simply returns to its normal state with no message explaining why the redemption did not go through.

4. **`frontend/src/routes/app/banking/KidBankingHome.tsx:139-148`** (`onToggleFreeze`, kid view) — state only updates `if (res.data)`; on error the freeze toggle silently reverts with no error message, despite `freezeBusy` already being tracked and available to gate a message.

5. **`frontend/src/routes/app/banking/KidBankingHome.tsx:170-177`** (`onArchiveGoal`) — same shape as finding 2: no busy indicator on the trigger, no error shown on failure.

6. **`frontend/src/routes/app/banking/KidBankingHome.tsx:450-457`** (`CardDialog.onSave`) — the `await api(...)` result is not destructured for `error` at all. A failed nickname/card-design save still closes the dialog and calls `onSaved()`, telling the parent the save succeeded when it may not have. There is no error path in this function.

7. **`frontend/src/routes/app/banking/ParentBankingControlPanel.tsx:115-122`** (`onOpenAccount`) — no busy/error state at the handler level; the child `OpenAccountCard`'s local `submitting` flag covers the button visually, but on `res.error` (no `res.data`) nothing is displayed — the button stops spinning with the account never opened and no explanation given.

8. **`frontend/src/routes/app/banking/ParentBankingControlPanel.tsx:124-131`** (`onToggleFreeze`, parent view) — unlike the kid-side equivalent, there is no busy flag at all, so the toggle can be double-clicked mid-request; on error, nothing is shown — an identical silent no-op to finding 4.

9. **`frontend/src/routes/app/banking/ParentBankingControlPanel.tsx:133-140`** (`onDecideRedemption`) — no per-row busy/disabled state on the Approve/Deny buttons (contrast with `ParentTaskBoard`'s `busyRedemption`), so both remain clickable during the request; `if (!res.error)` silently swallows failure with no message to the parent.

10. **`frontend/src/routes/app/family/ManageKidPanel.tsx:156-158`** — the Rename submit button is `disabled={busy || ...}` but its label never changes to a "renaming…" state, unlike the rotate/remove flows in the same file which do vary their label. A slow rename request looks visually identical to an inert button.

11. **`frontend/src/routes/app/family/FamilyPage.tsx:177-193,216`** — the per-kid analytics-consent switch disables itself while `busyKid === kid.userId`, with no spinner distinct from plain "disabled," and `consentError` is rendered once at the bottom of the entire kid list rather than next to the specific row that failed — a slow request and a silently failed request look the same until (and unless) the user notices an error message unassociated with any particular row.

12. **`frontend/src/components/ui/Button.tsx:50-63`** — the shared `Button` component has no built-in `loading` prop or spinner slot. Call sites that want a spinner hand-roll one (`frontend/src/routes/app/profile/SettingsPage.tsx:349,428-431`, `ProfilePage.tsx:179`: `<Icon name="progress_activity" className="animate-spin" />` next to manually swapped text), while most other call sites (all of `ParentTaskBoard.tsx`, `KidTaskBoard.tsx`, `ManageKidPanel.tsx`, `KidBankingHome.tsx`, `ParentBankingControlPanel.tsx`) only swap text or do nothing. The loading affordance is inconsistent across the app because there is no shared component pattern enforcing one.

---

## Repetitive Friction

1. **`frontend/src/routes/onboarding/OnboardingPage.tsx:53-58`** — `displayName`, `birthDate`, and `discoveryChannel` are held in plain `useState` with no persistence layer (no localStorage/sessionStorage draft, unlike the lesson player's own checkpoint mechanism at `frontend/src/lesson-engine/player/checkpoint.ts`). A refresh, an accidental back-navigation, or a closed tab at any of the five onboarding steps discards everything typed so far, and the flow restarts from `step === 0`.

2. **`frontend/src/routes/onboarding/OnboardingPage.tsx:97-120`** — if the final `complete()` call fails, `submitting` resets and the user can retry from that same last step — but this is the *only* step with retry-without-redo semantics, precisely because it's the only step that persists anything (a single call at the very end). Any interruption before reaching the final step forces re-entering every answer given up to that point, per finding 1.

---

## Mobile/Responsive Gaps

1. **`frontend/src/routes/app/tasks/ParentTaskBoard.tsx:176`** and **`frontend/src/routes/app/tasks/KidTaskBoard.tsx:227`** — `grid grid-cols-3 gap-3 sm:gap-4` for the three `StatCard` tiles has no column-count breakpoint (only the gap spacing changes at `sm:`). All three stat tiles (icon + number + label, with `line-clamp-2` on the label) stay forced side-by-side at 320–375px widths, with no `grid-cols-1 sm:grid-cols-3` fallback for the narrowest phones.

2. **`frontend/src/routes/app/banking/KidBankingHome.tsx:256`** — an identical fixed `grid-cols-3` stat row (Save/Spend/Share) with the same no-breakpoint pattern as finding 1.

3. **`frontend/src/routes/app/banking/KidBankingHome.tsx:361`** — the monthly statement view's `grid grid-cols-3 gap-2 text-center` (earned/spent/saved) has no responsive fallback, inside a `Card` with no minimum-width guard of its own.

4. **`frontend/src/routes/admin/analytics/AudienceSection.tsx:208`** — the acquisition summary's `grid grid-cols-3 gap-4` (Visitors / Converted / Conversion rate, each at `text-2xl`) has no `sm:`/`md:` column-count override — notably inconsistent with the `RankedList` grid two lines below it in the same component, which does use `grid gap-5 sm:grid-cols-2 lg:grid-cols-4`.

5. **`frontend/src/routes/admin/analytics/ProductUsageSection.tsx:147`** — the session-depth summary's `grid grid-cols-3 gap-4` (median/p90/multi-surface, `text-2xl` numbers) repeats the same fixed 3-column, no-breakpoint pattern as finding 4.
