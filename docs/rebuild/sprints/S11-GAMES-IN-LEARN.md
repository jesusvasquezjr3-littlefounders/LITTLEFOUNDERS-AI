# S11 Games in `/learn`: KartRush

Date: 6 October 2026
Owner decisions (5 and 6 October 2026): games are integrated inside `/learn`, finished and fun first, with concepts woven in afterwards; game mechanics are not altered; the game connects with the Mentor and teaches subtly; access is open, with a time cap like the Mentor's; LittleFounders canon is the law; progress is stored in the database; the AI line is built but stays off until its cost is measured; the owner authorized the production release for 06:00 on 6 October.

Design and contract: [KARTRUSH-INTEGRATION-DESIGN.md](../../games/KARTRUSH-INTEGRATION-DESIGN.md) and [KRV1-CONTRACT.md](../../games/KRV1-CONTRACT.md). The contract wins where they differ.

## Scope

- KartRush gets an embed profile (`?embed=1` inside a frame): an origin-checked `MessagePort` handshake, the closed `kr.v1` protocol, an in-frame Start gate, a host-supplied locale, mute and save, no menus, no unlock or celebration UI, blur and visibility pause, all four drivers open, and a passive Decision Lens.
- Core gets `/api/v1/learn/games/*`: sessions with daily and per-session caps, heartbeats, plausibility-checked run records, a compare-and-set save, guardian-lowerable limits, and the debrief endpoint.
- The database gets six tables with atomic session, run, save and limit functions (migrations `0259`, `0260`).
- Oracle gets a sealed one-shot debrief line, off by default.
- The SPA gets `/learn/play/:gameId` (Garage, pause, Mentor pit stop, soft break, closed card) and a "Play with {Mentor}" card on Learn home, in English, Spanish and Portuguese.

## What is deliberately not in this release

- **No XP, coins, streak credit or knowledge-component evidence from games.** Records only. Stage 2 (retrieval items that write KC evidence) needs a contract migration and is not built.
- **The AI debrief line is off** (`GAME_AI_DEBRIEF` unset in Core and Oracle). Its real cost per line is unmeasured. The line also needs the guardian consent practice `game_ai_debrief`, which no adult can give for themselves under the current registry.
- **The retention sweep is deferred** ([docs/games/deferred](../../games/deferred/README.md)). It is a contract migration; `gate-auto-apply` would refuse the whole push if it were included. No row can be 400 days old before 2027-11, so nothing is at risk; apply it by hand before then.
- **The Driving pose family is not added to the pose catalogue** (OD item). The game keeps its own seated kart poses on the real, decimated Mentor models.
- **Server-side ghosts are not stored.** Bests are on the server; ghosts stay on the device.
- **Guardian UI for the play limits is not built.** The endpoints exist (`GET`/`PUT /api/v1/family/play-limits/kids/:kidId`); the limits default to the platform ceiling.
- The Mentor governance gate protects `oracle/src/context/**` and `oracle/src/env.ts` (Tier 1). The game code was kept out of both so no human sign-off is bypassed.

## Verification evidence (local, on the final tree)

- **KartRush** (`81f1759`): typecheck, lint (0 errors), 141 test files and 1,666 tests, build, and the Chromium compatibility smoke for the default path and the opt-in embed journey.
- **Core:** 5,283 tests pass; type-check, lint and build clean. One earlier run showed two failures with `ENOBUFS` socket exhaustion; the same tree passed on the rerun.
- **Oracle:** 1,835 tests pass; the 14-field privacy contract test is untouched; the Mentor governance gate passes 28 of 28.
- **Frontend:** 4,624 tests; the one real failure (`designClasses`: games ids read as classes) was fixed and the file passes; type-check, lint and build clean; `i18n` parity, the Forge tone gate over 28,747 UI strings (no blocking finding), and the repository's UI, reward, dark-pattern, wallet-glossary and minor-safeguard checks pass.
- **Audits:** the games states (45 states x 3 locales x 2 themes): text-fit 4,320, proportion 1,080 and copy-budget 1,080 configurations, no findings, no JS errors. The whole Learn lane (62 states): no findings. Two lesson states reported Diorama errors because this worktree had no `public/scenes`; with the scenes present, no JS errors.
- **Database:** migrations `0259`/`0260` pass `check-migrations`, `check-migration-phase` and classify as additive in `gate-auto-apply`. The production ledger holds 258 receipts (0001 to 0258), so nothing else is pending. The PostgreSQL 17.6 verifier passes 24 checks over all 260 migrations on a throwaway cluster (atomic daily cap under concurrency, session reopen, idempotent runs, numeric-only metrics, compare-and-set saves, RLS, guardian limits, cascade).
- **Contract:** the game's parser, the SPA's parser and Core's zod schema agree on 29 shared samples and on the run report body; `games:parity` passes.
- **Real integration (Chromium):** the SPA served by Vite loaded the real game in the iframe with only Core simulated: handshake, host-supplied Start label ("Tap to start" / "Toca para empezar"), in-frame start, focus on the frame, heartbeats to Core, and a pause card from the host on focus loss, at 1280 px and in a landscape phone viewport, in English and Spanish, with no page errors.

## Limitations

- No real learner, device or Core was used: Core was simulated in the integration run, and a full race to the pit stop was verified only on the game side (the embed harness, 4:00 finish with `kr.runFinished`) and the SPA side (the stub), not end to end in one run.
- No physical phone, Firefox or Safari check. Software rendering made the race slow; frame rate on real hardware is unmeasured.
- The Spanish and Portuguese copy has had no native review (OD-11).
- The 29 contract samples and the cross-check scripts are ad hoc; only the manifest pin and the parity gate are committed.
- The custom domain `game-b2c.littlefounders.ai` is not created (owner DNS action); the game is served from its Railway address.
