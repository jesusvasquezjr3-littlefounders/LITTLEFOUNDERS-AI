# E2E Navigation Bugs

**Scope & method.** This is a static trace of the SPA's route tree (`frontend/src/App.tsx`), its guards (`frontend/src/auth/RequireAuth.tsx`, `RequireGuest.tsx`, `RequireOnboarded.tsx`, `RequireRole.tsx`), its layouts (`AppLayout.tsx`, `MarketingLayout.tsx`, `AuthLayout.tsx`), and every page component it renders — not a live browser click-through. Every finding below cites the file and line it was read from. Where a route tree analysis is not enough to prove a claim (e.g. actual render output), that limit is stated inline.

No assumption is made about why a given flow was built the way it was; a flow is reported as broken if a user can reach a state with no route back into the product, regardless of whether that appears to have been a deliberate simplification.

---

## Dead Ends

1. **`frontend/src/routes/app/learn/PlacementPage.tsx:243`** — `PLACEMENT_ROUTE_PATH` is mounted directly under the root `<Routes>` (`App.tsx:348-357`) as its own fullscreen layer with no `AppLayout` chrome (no sidebar, no header). If the initial `GET /placement/:courseSlug/intake` call fails, the component returns a bare `<ErrorBanner code={loadError} />` with no `onRetry` prop and no home/back link. Every *other* error path in the same file (the `answer`/`commit` failures at lines 174-177 and 234-238) stays inside `GuidedStage`, which keeps back/replay controls live — only this one, the initial-load failure, bypasses `GuidedStage` entirely. A learner who hits this on a flaky connection has no in-app control to retry or leave; the browser's own Back button is the only exit.

2. **Bare, retry-less error states inside the authenticated app shell**, all rendering `<ErrorBanner code={state.code} />` with no `onRetry` and no navigation affordance:
   - `frontend/src/routes/app/learn/CoursePage.tsx:114`
   - `frontend/src/routes/app/learn/TerritoryPage.tsx:156`
   - `frontend/src/routes/app/family/FamilyPage.tsx:105`
   - `frontend/src/routes/app/family/KidTutorPage.tsx:203`
   - `frontend/src/routes/app/family/KidTerritoryPage.tsx:161`
   - `frontend/src/routes/app/profile/ProfilePage.tsx:97`
   - `frontend/src/routes/app/profile/PublicProfilePage.tsx:98`
   - `frontend/src/routes/app/LearnPage.tsx:225`

   These sit inside `AppLayout` (`App.tsx:360-368`), so the sidebar/mobile tab bar stays on screen — the user isn't fully stranded, they can navigate to a different section. But the failed content pane itself has no way to recover short of navigating away and back (which re-triggers the same request). Contrast with the banking and tasks screens, which do pass `onRetry` to the same `ErrorBanner` component (`frontend/src/routes/app/banking/ParentBankingControlPanel.tsx:142,189`, `KidBankingHome.tsx:180`, `frontend/src/routes/app/tasks/ParentTaskBoard.tsx:144`, `KidTaskBoard.tsx:174`) — the retry affordance exists in the codebase and is simply not applied uniformly.

---

## Context Breaks

1. **`frontend/src/App.tsx:279-286`** — `/verify-parent` is wrapped only in `RequireAuth`, not `RequireOnboarded`. Every other one-time gated flow that assumes a completed profile — `/tutor` (`App.tsx:479-486`) and the placement quiz (`App.tsx:348-357`) — explicitly stacks `RequireOnboarded` on top of `RequireAuth` for that reason (see the comment at `App.tsx:474-475`: "an un-onboarded learner has no nickname and no preferences"). An unfinished guest can deep-link straight to `/verify-parent` before ever completing `/onboarding`, a state the rest of the app's UI does not appear to plan for (the "Become a Tutor"/parent-verification entry points live inside `AppLayout`'s nav, which the same guest cannot reach until onboarded — `frontend/src/routes/app/AppLayout.tsx:40,104,267` — so this deep-link path reaches a screen with no corresponding organic entry point).

2. **`frontend/src/routes/admin/AdminInsightsPage.tsx:8`** — `/admin/insights` (registered live at `App.tsx:431`) immediately fires `<Navigate to="/admin/intel?focus=learning" replace />`. It is absent from `frontend/src/routes/admin/adminNav.ts`'s `ADMIN_SECTIONS` list, and no `Link to=`/`navigate(` call in the codebase targets `/admin/insights`. The route is orphaned from current navigation — reachable only by a stale bookmark or a typed URL — and its only behavior is a silent bounce to a different page.

3. **`frontend/src/routes/marketing/Families.tsx:87`** — the public marketing page's hero CTA (`<Link to="/family" data-cta="families-hero">`) points at a route gated `RequireRole role="parent"` (`App.tsx:389-395`). An anonymous visitor clicking it hits `RequireAuth` (`App.tsx:360-367`) and is bounced to `/login` with `from: "/family"` preserved (`RequireAuth.tsx:11`). If they then log into a non-parent account, `LoginPage.tsx:52` sends them back to `/family` per the preserved `from`, where `RequireRole` immediately bounces them a second time to `APP_HOME` (`/learn`, `RequireRole.tsx:17`). The net effect for any non-parent account is a marketing CTA that silently resolves into a double redirect and lands the visitor on a screen unrelated to what the CTA advertised, with no message explaining why `/family` never appeared.

4. **Self-contradicting intent for "public" profiles.** `App.tsx:438` comments the `:handle` route group as `/@username — public profiles`, but that route group (`:handle`, `:handle/followers`, `:handle/following` at `App.tsx:439-441`) is nested inside the `RequireAuth` + `RequireOnboarded` + `AppLayout` wrapper that starts at `App.tsx:360-367` — meaning an unauthenticated visitor opening a shared profile link is redirected to `/login`, not shown the profile. This is corroborated on the backend: `backend/src/routes/profile.ts:223` applies a second `router.use(requireAuth)` specifically to `publicProfilesRouter`'s own routes (`/:username`, `/:username/followers`, `/:username/following` at lines 239, 263, 270), so the API backing these pages also refuses unauthenticated callers. Separately, the comment on the shareable-badge route (`App.tsx:444-449`) states it is *"the ONE route in this app a stranger opens with no account and no session"* — a claim that is only true if the `:handle` profile routes are **not** actually public, directly contradicting their own "public profiles" label three routes above. Functionally the two mechanisms agree (both require login), so the behavior is at least internally consistent — but the navigation intent as documented in the code is self-contradictory, and the practical effect is that any out-of-app share of a profile link (e.g. on social media, as the follower/following pages' existence implies is expected) dead-ends a logged-out recipient at the login screen instead of showing the profile it purports to link to.

---

## Infinite Loops

A full trace of every guard-to-guard redirect target was performed: `RequireAuth` → `/login` (`RequireGuest`) → `RequireOnboarded` → `/onboarding` → `RequireRole` → `APP_HOME` (`/learn`). Every redirect target is either unguarded or guarded by a condition that is strictly narrower than the one that triggered the redirect (e.g. `RequireRole`'s failure path always lands on `/learn`, which itself carries no `RequireRole`). **No live infinite-redirect cycle exists in the route tree as written.**

One related-but-distinct issue was found while tracing this: `RequireAuth.tsx:10`, `RequireOnboarded.tsx:15`, and `RequireRole.tsx:15` all `return null` — an unstyled blank screen, not a loading spinner — while their respective async state (`session === undefined`, `!meLoaded`) is still resolving. Because `AppLayout` itself sits behind `RequireAuth` + `RequireOnboarded` (`App.tsx:360-367`), every route under it (`/learn`, `/tasks`, `/banking`, `/family`, `/profile/*`, `/admin/*`) renders a fully blank `#root` for the duration of the initial `/auth/me` round trip after any fresh login, signup, OAuth callback, or guest start. This does not loop and always resolves, but it is structurally the same failure mode — an empty, unstyled `#root` with no visual feedback — as the back/forward-cache bug `frontend/src/main.tsx:18-41` was written to patch (see that file's own comment block for the prior incident). The existing `pageshow`/`event.persisted` fix does not cover this window, since a fresh navigation never sets `event.persisted`.
