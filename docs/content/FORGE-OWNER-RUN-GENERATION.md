# Forge owner-run generation runbook

Status: updated 1 October 2026 for the v2-only lesson runtime and OD-31 legacy retirement.

This document does not authorize generation. OD-17 requires owner acceptance of the Lesson Engine before catalog regeneration; OD-23 requires an approved ceiling before paid model, image or voice calls. No paid generation is part of the UI polish and content reset session.

## Supported workflow

Use [Forge v2 release runbook](FORGE-V2-RELEASE.md) for the complete authoring, emission, contract, gate, reviewed-publication and staff-release sequence. The v1 `generate`, `generate:track` and `author-publish` commands refuse before configuration, provider calls or Vault writes, including dry runs. Historical v1 implementation and measured July 2026 costs are not a supported generation path or a v2 cost estimate.

1. Record the approved course, skeletons and USD ceiling in the owner decision or sprint record. Verify the required migrations, provider configuration and release gates using README.
2. Run the v2 zero-spend authoring and publication rehearsals in the release runbook. `npm run release:readiness -- <course>` includes the current v2 chain; it performs no publication or paid calls.
3. Run a small paid `v2:author` pilot with the approved `--max-usd` ceiling, then review its usage ledger and per-market first-submission gate log before expanding the batch. The ceiling only lowers the configured run limit.
4. Follow the v2 publication chain. Resolve every Stage 3 review flag, including mentor misjudgment, regional adaptation and differentiated narration. Staff release requires the current course attestation and pedagogical review; publication of an immutable version alone does not release it to learners.
5. Record measured spend, retries, per-gate results, review decisions and any threshold recalibration in the sprint record. Treat escaped defects as both content fixes and gate review items.

Provider keys belong only in the operator's local environment. Never manually write release attestations or published statuses, bypass a failed gate, increase a budget without an owner decision, or perform paid generation from CI. The one-time OD-31 catalog reset does not waive safeguards for future content.

## Media tools

`images:backfill` and Echo's `narrate:all` retain OD-28's explicit `--max-usd` requirement for paid runs, enforced by the mirrored spend guard. Dry runs make no paid calls. Echo also requires the configured provider price per 1,000 characters rather than a guessed default. These tools do not replace the v2 authoring/publication workflow: any resulting media must pass the v2 differentiated-narration and reviewed-release checks described in the release runbook.
