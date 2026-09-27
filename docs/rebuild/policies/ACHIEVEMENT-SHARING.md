# Achievement sharing policy

Status: implemented and locally verified in S08.4 (24 September 2026). Not accepted: the Appendix L Stage 3 review (Safety/Trust Lead), copy review and real-database/production evidence are open. See [the S08 sprint record](../sprints/S08-PROFILES-SOCIAL-AND-SHARING.md#s084-implementation-and-rationale).

Binding sources: Product `10` Block F (F.1 to F.6) and its Achievement Sharing Standard, Appendix K, Appendix L, and owner decision OD-20 (`13-OWNER-DECISION-LOG.md`, 24 September 2026). The brand position is `docs/product-audit/COSMIC_NARRATIVE.md` §5. `npm run sharing:check` (part of `spec:check`) keeps this document, the brand position and the code in step.

## 1. Architecture decision (F.1)

OD-20 resolves F.1's open decision point to the image architecture. The Product and Safety/Trust decision the requirement asks for is the owner's recorded decision.

- A share is a PNG rendered once, for the verified guardian who asked, and returned in that response. The parent sends it themselves: through the device share sheet when it accepts image files (Web Share API with files), otherwise as a download.
- Nothing about the image is persisted. There is no token, no `badge_shares` row, no stored Depot object, no company-hosted URL and no page. A stranger has nothing to open and a messaging app has nothing to preview from our servers.
- Legacy links issued before the cutover keep their F.2 controls (noindex, 30-day expiry, per-link revocation that also purges the image) until they expire. The public page route is then retired (section 5).

Flow: parent taps Share → `POST /api/v1/family/kids/:kidId/achievement-image` (Core) → family router gate (verified adult parent) → `guardKid` (verified guardian link for this kid) → achievement verified server-side → Depot `POST /api/v1/badges/render` (internal key, returns bytes, stores nothing) → `guardKid` again → one `achievement_share_initiations` row (kind + hand-off only) → PNG to the parent (`Cache-Control: no-store, private`) → share sheet or download on the device.

## 2. Standing constraints (F.6)

Any redesign of achievement sharing must keep all of these true. `backend/src/__tests__/achievementSharingConstraints.test.ts` is the release-gate suite for them (Appendix L 1.2, "Standing-Constraint Integrity": pass every release, no exceptions); `filebase/src/__tests__/badges.test.ts` covers the renderer side.

1. **Guardian-only initiation.** Only a currently ID-verified adult parent who holds a verified guardian link to the child can start a share. Refused by direct request, each pinned by a test: no session, parent-created under-13 kid, guest, independent teen (13 to 17), adult without the parent role, parent with no or revoked verification, verification by a method other than `local-ocr`, a minor holding a parent role, kid role that also holds parent, staff admin and superadmin (staff never initiate), and a verified parent who is not this child's guardian. A guardian link revoked during the request releases nothing.
2. **Server-side achievement verification.** The label is never client text. A course badge needs the course in the child's completed list; a goal must be this child's and `reached`; a streak is built from the stored stat and needs at least three days. Client-supplied `label`, `firstName`, `imageUrl` or `ageBand` fields are refused.
3. **First-name-only minimization.** The image carries the first name (first token of the display name, at most 40 characters), the server-derived achievement label, the achievement kind's line and the LittleFounders name. Depot's render body is `.strict()`: kind, label, first name and locale only. No surname, age or age band, photo, link or identifier. A reached goal's title is free text a family member typed, so it passes the E.13 profile-field classifier first (contact, link, handle, platform, school, place, birth year). A flagged title is left out and the label names the goal generically ("Saved 50 coins for a goal"), because a sent picture cannot be recalled (S08.8).
4. **No persistent public URL (OD-20).** No new `badge_shares` row can be created: Core has no insert path, and the `close_badge_share_links` migration makes the table refuse every INSERT from any role. Depot's retired compose-and-store endpoint answers 410 and writes nothing.
5. **No viewer reach (OD-20, Appendix L).** Nothing records who sees a shared image. `badge_link_click` is not a recordable event, the anonymous beacon drops it, and the legacy landing page tracks nothing.

The Standard's non-negotiable behavioural constraints still apply in full: no share by anyone other than a verified guardian; no artifact exposing more than first name, achievement label and image; no link both un-revocable and un-expiring; no Achievement Share field without a consuming flow.

## 3. Point-of-action disclosure (F.3)

Directly under each Share button, bound to it with `aria-describedby`, in the Mentor's plain voice and inside the Copy Budget:

| Locale | Line 1 | Line 2 |
|---|---|---|
| en-US | You get a picture with their first name. No link is made. | Anyone you send it to can keep it. It shows LittleFounders. |
| es-MX | Recibes una imagen con su nombre de pila. No se crea ningún enlace. | Quien la reciba puede conservarla. Muestra el nombre LittleFounders. |
| pt-BR | Você recebe uma imagem com o primeiro nome. Nenhum link é criado. | Quem receber pode guardá-la. Ela mostra o nome LittleFounders. |

It names what is created (a picture with the first name), what is not (a link), the part no one can undo (a sent picture stays with whoever received it; this replaces F.2's third-party caching caveat, which no longer applies to new shares) and the brand exposure (our name is on it). It does not mention expiry or revocation, because the image flow has neither. The legacy-link panel says those links stop working on their date.

Every screen that can start a share carries both lines beside each button and binds them with `aria-describedby`, so a screen reader hears the disclosure at the point of action too. `sharing:check` enforces it (Appendix L "Point-of-Share Disclosure": displayed on 100% of share actions): a screen that calls the image transport must render both lines and one description per share button, the rebuilt `AchievementShare` must bind its own, and both lines must exist in all three locales (S08.8).

## 4. Metrics (Appendix L under OD-20)

Appendix L counts shares initiated, never viewer reach. Staff with `view_analytics` read `GET /api/v1/admin/analytics/achievement-sharing?days=N`.

| Appendix L metric | Measured now | Target / state |
|---|---|---|
| Persistent Public URL Rate | `badge_shares` rows created after the cutover ÷ (those + shares initiated) in the window | 0, structurally (the table refuses inserts) |
| Shares initiated (OD-20) | `achievement_share_initiations` rows by hand-off (`share_sheet`, `download`) and kind | Diagnostic |
| Revocation Availability & Usage | Legacy links: total, live, revoked | 100% availability until retirement; usage diagnostic |
| Revocation Enforcement Completeness | Revoke purges the image at once; the daily sweep (`badge-link-retirement.yml`, audit action `badge_links.images_swept`) purges every dead link's image, including unvisited expired ones | 100%; a failure is reported per run |
| Share Link Lifespan | Bounded by construction: every legacy link ends by 24 October 2026 | Retired |
| Point-of-Share Disclosure display | Rendered beside every Share button; pinned by component, page and real-Chrome tests | 100% displayed; comprehension sampling is a human task |
| Search-Engine Indexing Rate | Legacy page: `noindex, nofollow` header on Core and the edge function; no new pages exist | 0; the external spot-check is open |
| Schema Field Utilization | The new flow has no entity; `achievement_share_initiations` has a producer (share route) and a consumer (metrics route) for every column | 100% |
| Brand-Narrative Coverage | `COSMIC_NARRATIVE.md` §5, checked by `sharing:check` | Present |
| Standing-Constraint Integrity | `achievementSharingConstraints.test.ts` | Pass every release |

`achievement_share_initiations` holds no user, kid, name, label or image reference, so it is an operational counter and needs no retention job. The `badge_generated` (server) and `badge_shared` (completed hand-off, consent-gated) product-analytics events continue.

## 5. Legacy links and their retirement

- Cutover: `2026-09-24T00:00:00.000Z`, OD-20's decision date (`backend/src/services/badgeLinkWindow.ts`). A link created at or after it is never served and its image is purged. Links issued before it keep their F.2 controls.
- Retirement: `2026-10-24T00:00:00.000Z` = cutover + the 30-day window, when every legacy link has expired. From then Core's `GET /api/v1/badges/:token` answers 410 without a database read, the Vercel edge function answers 410 without calling Core, the landing page shows its not-found state without calling Core, and the Family list returns no links. Revoke stays callable (idempotent) until the removal below.
- Images: revoke purges at once; any visit to a dead link purges lazily; the daily sweep purges every dead link's image. After retirement the sweep treats every link as dead.
- The three copies of the retirement date are hand-mirrored (no shared types across packages) and `sharing:check` fails if they drift.

### Dated removal (runbook, on or after 25 October 2026)

1. Confirm the sweep ran after the retirement with `failed: 0` and a complete pass (`GET /api/v1/admin/audit` for `badge_links.images_swept`, or the workflow log), and spot-check that a known legacy image URL answers 404.
2. Delete the legacy code in one change: `backend/src/routes/badgePublic.ts` (public read and sweep), the Family list and revoke routes and their data helpers, `frontend/api/badge/[token].ts` and its `vercel.json` rewrite, `BadgeLandingPage.tsx` and its route, the `/badge` entries in `frontend/scripts/seo/site.mjs` and `frontend/src/lib/analytics.tsx`, the `BadgeShares` panel and wrapper and their copy, `badgeLinkWindow.ts`, and `.github/workflows/badge-link-retirement.yml`. Update `sharing:check` to assert their absence.
3. Deploy that Core and frontend release.
4. Then apply a contract migration that drops `badge_shares` (with its trigger and `refuse_new_badge_share_link()`), which also retires the legacy `age_band` column (F.4), and narrows `learning_events_event_check` to remove `badge_link_click` (coordinate with any other pending change to that CHECK; `RETIRED_EVENTS` in `frontend/src/rebuild/staff/console/usageShared.ts` goes with it). Declare `@after-release` the release from step 3.
5. Record the evidence in the S08 sprint record and the F.1/F.2 rows of `docs/rebuild/REQUIREMENTS.md`.

## 6. Change pipeline (Appendix L Part 3)

Every change to persistence, indexability, revocability or the information content of a shared artifact is exposure-boundary: it needs the adversarial tests above (Stage 2), a Safety/Trust Lead review against Appendix K and `COSMIC_NARRATIVE.md` §5 (Stage 3), and its Part 1 metric instrumented at release (Stage 4). S08.4 is an exposure-boundary change; its Stage 3 review is open.

## 7. Owner and review items still open

- Stage 3 regulatory and brand review of S08.4, including the disclosure copy (Forge tone gate) and native review of the es-MX and pt-BR lines.
- The image art: the badge renderer still draws its legacy template (system-font emoji, gradient). Redrawing it as a house-style asset (Bible `07`) belongs with the wave-2 design system.
- Physical PostgreSQL evidence for both migrations, a production external indexing spot-check of the legacy page, and the first production readings of the metrics.
