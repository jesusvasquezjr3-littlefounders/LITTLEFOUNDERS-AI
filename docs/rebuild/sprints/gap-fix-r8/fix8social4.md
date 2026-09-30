# Gap-fix round 8: social (fix8social4)

Branch `codex/spec-fix8social4`. One audited gap, checked in the code first:
it was real. Nothing here is accepted or released; statuses follow the ledger
(implementation, local verification, acceptance and release are separate). No
migration.

## Gap 1: a follower without a @username could not be removed, reported or blocked

SPEC: E.3 (a report action on a profile or a followers/following-list entry);
E.8 (mutual-consent connections the teen can self-manage); Block E Standard
component 2; Appendix J 2.1 criterion 2 (enforced on every path).

Verified first:

- `handle_new_user` (migration 0003) inserts only `display_name`, and
  `profiles.username` is nullable (0005), so every new account starts without
  a handle.
- `POST /profiles/:username/connection-request` checked only the subject; the
  requester could be handle-less, and `request_teen_connection` (0119) checks
  only `profile_fields_flagged`. The teen's queue card showed `username: null`.
- After acceptance, every self-management and safety action was keyed by the
  other person's username: `DELETE /profile/followers/:username`,
  `POST|DELETE /profiles/:username/block`, `POST /profiles/:username/report`,
  `DELETE /profiles/:username/follow`. The queue's by-id report and block work
  only while the request is pending or closed without a connection.
- The UI matched: `teenConnectionsClient.getFollowers` dropped handle-less rows
  ("cannot be addressed for removal; it is not listed"), and `PeopleList`
  rendered them as a plain span with no link and no action
  (`action && person.username`), so the row never reached the profile where
  Report and Block live.
- The Tutor path was not affected (`/family/kids/:kidId/social/connections/:userId`
  is keyed by user id).

| What was built | Where |
|---|---|
| `readOwnConnection(session, other)`: follower edge, following edge, accepted teen consent either way; four strict reads, null on any failure (a failed read never becomes "connected") | `backend/src/services/socialTier.ts` |
| Id routes on the session's own connections: `DELETE /profile/followers/id/:userId` (needs the follower edge; `remove_social_follower`), `DELETE /profile/following/id/:userId` (needs the following edge; `withdraw_social_connection` with the session's token; `unfollow` protection event kept), `POST /profile/connections/:userId/report` (same bounded body and `submit_social_report`, the session as reporter) and `/block` (the session's own audited block write). Any other id, the session's own included, is the same 404 the username routes give, with no write; malformed ids, query fields and unknown body fields are 400 | `backend/src/routes/profile.ts` (`ownProfileRouter`) |
| Source closed for the teen path: a requester without a @username asking a teen to connect gets 409 `USERNAME_REQUIRED` before `request_teen_connection` is called (the function is service-role only, so Core is its enforcing boundary) | `backend/src/routes/profile.ts` (`POST /profiles/:username/connection-request`) |
| Client: followers keep every row (a row without a valid user id is a malformed answer, never a dropped person); remove, report, block and unfollow by user id, each confirmed only by a receipt naming the same id | `frontend/src/rebuild/social/teenConnectionsClient.ts` |
| Teen panel: each follower row, handle-less included, has Remove, Report (the bounded dialog) and Block (behind the confirmation) | `frontend/src/rebuild/social/TeenConnections.tsx`, `frontend/src/routes/app/profile/TeenConnectionsPanel.tsx` |
| P4/P5 on the real routes: every row of the viewer's own lists carries Report and Block; unfollow (P5) and the teen's Remove (P4) now go by user id, so handle-less rows are actionable too; another person's lists (P7/P8) stay read-only | `frontend/src/rebuild/social/PeopleList.tsx`, `frontend/src/routes/app/profile/PeopleListRoute.tsx`, `people.css` |
| P6: `USERNAME_REQUIRED` reads "Choose a @username in Settings first." | `frontend/src/rebuild/social/PublicProfile.tsx`, `PublicProfileRoute.tsx` |
| Copy in en-US, es-MX, pt-BR: `peopleList.report/reported/block/blockTitle/blockBody/blockKeep/blockConfirm/blocking/blocked/blockFailed`, `publicProfile.askHandle` (the same wording as P6's existing Report and Block) | `frontend/src/i18n/*/rebuild-profile.json` |
| Previews: a handle-less follower in the teen panel and people-list fixtures; own lists show Report and Block | `SocialTiersPreview.tsx`, `SocialScreensPreview.tsx`, `ProfileScreensPreview.tsx` |

## Verified (locally)

- Core: `socialConnectionsById.test.ts` (17 tests). Adversarial: a handle-less
  adult cannot ask a teen (409, no transaction); a legacy accepted edge is
  listed with its user id and `username: null`; the teen reports, blocks and
  removes it by id (exact RPC bodies, the session's token on the block); an
  accepted consent without a follow edge admits report and block, not remove;
  an adult unfollows, reports and blocks a handle-less account it follows
  (the session's JWT on the withdrawal, the `unfollow` event). Refused
  populations, each with every write uncalled: a stranger id (404 on all four
  routes), another person's connection, a declined/removed/withdrawn/pending
  teen request, the session's own id, anonymous callers, malformed ids, query
  fields, unknown body fields, an unreadable graph (502).
- Existing suites still green: `socialTiers`, `socialRequestReports`,
  `profile`, `socialProtection`, `socialGovernance`, `profileFieldSafety`
  (212 tests).
- Frontend: client, component and route tests (a handle-less follower is
  listed and actionable on the teen panel and on P4; a receipt naming another
  id is a failure; P6 shows the handle message), `src/rebuild/social`,
  copy-budget, glossary and gallery contracts.
- `npm run type-check` and `npm run lint` in backend and frontend;
  `bash agent/tools/check-i18n.sh`; `npm run secrets:check`; `npm run spec:check`.
- Not run here (orchestrator's final gate): browser audits (text fit,
  proportion, copy budget) of the new P4/P5 row actions and teen follower rows.

## Open

- Another person's lists (P7/P8): a handle-less entry still has no report
  path, because the id routes admit only the session's own connections.
  Admitting "any row the viewer can currently see on a list" needs a
  visibility re-check per row; left for a later lane.
- The open follow between adults still admits a handle-less follower (the
  id routes make it manageable). See owner question 1.
- The browser audits of the new row actions run at the round's final gate.

## Owner questions (conservative default implemented)

1. Should every follow and every connection request (not only a request to a
   teen) require the requester to have chosen a @username? Default here: only
   the teen path refuses (a minor decides about someone it can identify); the
   adult-to-adult follow and the Tutor-decided child request are unchanged,
   and every existing edge is manageable by id.
