# Gap-fix round 2

Lane records for the second gap-fix round of the SPEC migration. Each lane
appends its own section. Statuses follow the ledger: implementation, local
verification, acceptance and release are separate, and nothing here is
accepted or released.

## F2-family

Branch `codex/spec-fix2family`. Four audited SPEC gaps in the Family Hub,
Wallet and account area. Each gap was checked in the code first.

### 1. The tone gate reads the rebuilt Family, Tasks and Wallet copy (D.8; Appendix H 1.3; Part 3 Stage 4)

**Gap confirmed.** `agent/tools/family-copy-tone.lexicon.json` scoped only the
i18next namespaces and `common:family`. The screens mounted on `/family`,
`/tasks`, `/family-wallet` and `/wallet` render `rebuild-family.json`, which the
gate never read. Running the gate's own `findings()` over those groups found 37
hits (invite "Accept", "Rejected"/"Rechazar"/"Recusar" on memory notes,
"seguridad"/"segurança" labels, a "guardian" pending label, friend-request
"Deny").

**Built.**
- Scope: 20 `rebuild-family:<group>` subtrees (the 14 Family, Tasks and Wallet
  groups named by the audit, plus `badgeShares`, `achievementShare` and the
  four `social*` panels mounted in the Family Hub). 4,620 strings in three
  locales, 100% pass.
- Reworded in EN/es-MX/pt-BR: the invite's "Accept" is "Join" / "Unirme" /
  "Entrar" (the glossary keeps "accept" away from a Tutor's approval); the
  memory note's "Reject" is "Discard" / "Descartar"; the social pending label
  names the Tutor instead of a "guardian".
- 7 reviewed exceptions: the console's "Privacy and safety" section label, the
  two Mentor safety-review event labels, the two friend-request refusals and
  the two "safety notices" labels. None is about coins.
- Coverage rule in the gate: a surface under `scope.surfaces` that names a
  `rebuild-family.json` group, or loads an i18next namespace, outside the
  scope fails the gate.
- B.14's UI lexicon (`coursegen/src/contentGates/tone.ts` `TONE_LEXICON`,
  parsed from source, folded matching) runs as a fifth category, `b14_ui`.
  It finds nothing today.

**Where.** `agent/tools/check-family-copy-tone.mjs` (+ test),
`agent/tools/family-copy-tone.lexicon.json`,
`frontend/src/i18n/*/rebuild-family.json`,
`docs/operations/FAMILY-COPY-TONE-GATE.md`.

**Verified.** `node --test agent/tools/check-family-copy-tone.test.mjs` (27,
including the coverage refusals); the gate CLI; i18n gate; copy-budget and the
touched panel tests.

**Remains.** The Stage 4 human spot-check and native copy review of the
reworded keys.
