# Profile and social-layer tone gate

Appendix J Part 3 Stage 4 applies to any change to profile display or social-layer copy: it "extends the existing Forge tone gate (established in Block B/D) to any new social-layer copy". F.3 names the same gate. Law 2 sets the standard: speak like a mentor, never like a bank or a rulebook.

Before GAP-FIX-R4 the only copy tone gate was the D.8 Family Hub gate ([FAMILY-COPY-TONE-GATE.md](FAMILY-COPY-TONE-GATE.md)). Its scope named the Family groups only, so the profile screens, the people lists, the report copy and the goals-together copy (OD-27 (1)) were never read. The copy-budget tests check length and dashes, not register.

## What the gate checks

`node agent/tools/check-social-copy-tone.mjs [--report <path>]` runs the D.8 engine (`agent/tools/check-family-copy-tone.mjs`) with a second scope file, `agent/tools/social-copy-tone.lexicon.json`. It runs in `spec:check` and in the unfiltered repo gates; its self-tests run in `npm run tools:test`.

**Scope, all three locales:**
- every group of `rebuild-profile.json`. The scope is `complete`: a new group in that file fails until it is listed;
- `rebuild-learn.json` `together` (the `/learn/together` page) and the learner-home card's `home.togetherTitle`, `home.together` and `home.togetherAsked`;
- the Family connection groups of `rebuild-family.json`: `socialGraph`, `socialHistory`, `socialRequests`, `socialNotices`, `socialConnectionActions`, `familyCoopGoals`, `badgeShares` and `achievementShare`. The D.8 gate also reads these under its own lexicon.

**Surfaces:** `frontend/src/rebuild/social`, `frontend/src/rebuild/account`, `frontend/src/routes/app/profile`, `frontend/src/app-routes/TogetherRoute.tsx`, `frontend/src/rebuild/learning/TogetherView.tsx` and `together.ts`.

**Coverage.** The gate fails when:
- a surface names a `rebuild-profile` or `rebuild-family` group that is not in scope;
- a surface reads a `rebuild-learn` group through `learnCopy[locale].<group>` that is not in scope;
- a surface loads an i18next namespace that is not in scope;
- a surface renders a raw Core `error.message`. Comparing the message, as the offline probe does, is not rendering it.

| Category | Why | Examples caught |
|---|---|---|
| `guarantee` | D.7 and Block E: no safety, privacy or protection promise the system does not enforce | safe, secure, protected, guaranteed, always private; seguro, protegido, garantiza; seguro, protegida, garantia |
| `messaging` | E.10: there is no messaging between accounts | chat, message, inbox, DM, reply to, comment; chat, mensaje, bandeja de entrada; chat, mensagem, caixa de entrada |
| `glossary` | Owner log §5 | guardian or legal guardian (the verified parent is the Tutor); AI tutor, bot, assistant (the AI is the Mentor); money |
| `bank_register` | Law 2 | funds, transaction, fee, balance, declined, denied; saldo, comisión; saldo, tarifa |
| `legal_register` | Law 2, Block E: a report or a removal is explained plainly | violates, terms of service, penalty, sanction, prohibited, liability; infracción, sanción; violação, sanção |
| `shouting` | A mentor never shouts | "!!", words in capitals, raw error codes |
| `b14_ui` | B.14's UI tone lexicon, shared with Forge and D.8 | act now, last chance |

## Exceptions

An exception names the key, the category and a reason a reviewer can check. A stale exception fails. The first run's reviewed exceptions fall into three groups:
- **The safety team and safety labels in es-MX and pt-BR.** "Equipo de seguridad" / "equipe de segurança" names who reads a report. "Avisos de seguridad" names a list. "Seguridad" is the label over the report and block controls. None of them promises anything.
- **Statements that messaging does not exist.** "No chat" on goals together and on the Tutor's card; "nobody can message you" on the discoverable profile. E.10 enforces both. The analytics disclosure also lists "message text" among the data events never carry.
- **A person saying no.** The teen's "Declined" and the Tutor's "Request denied" are decisions about a person, not transactions. The D.8 gate holds the same exception.

## Stage 4 human spot-check

The review step in [FAMILY-COPY-TONE-GATE.md](FAMILY-COPY-TONE-GATE.md#stage-4-human-spot-check) applies here unchanged. A reviewer who did not write the copy reads each new or changed social string in context and asks three questions:
- Would a mentor say this to a teen?
- Does it promise anything the system does not enforce?
- Does it keep the glossary?

Any new pattern the reviewer finds is added to the lexicon.

## Recorded runs

| Date | Strings | First run | After fixes | Notes |
|---|---|---|---|---|
| 2026-09-29 | 1,992 first, then 1,998 | 1,959 of 1,992 pass (98.3%) and 1 raw-message finding | 1,998 of 1,998 (100%), 14 reviewed exceptions | GAP-FIX-R4. One key was reworded in all three locales: `accountDeletion.reauth` said "for your safety" and now says "to confirm it is you". The raw-message rule stopped flagging a comparison (`profileRouteKit.ts`, the offline probe). The learner-home together keys then joined the scope, and the audit pass shortened the together intro, rules and invitation copy. |
