# Mentor change proposals

One JSON file per change that goes through the Appendix F Part 3 pipeline, named `<id>.json`, where the id is `P-YYYY-MM-DD-<slug>`. `npm run governance:check` validates every file here. Policy: [self-improvement governance policy §4](../../SELF-IMPROVEMENT-GOVERNANCE-POLICY.md#4-the-pipeline-per-tier-appendix-f-part-3).

There are no proposals yet: no automated proposal generator exists (C.22 was built first).

## Format (`mentor-change-proposal`)

```json
{
  "kind": "mentor-change-proposal",
  "id": "P-2026-10-01-latency-z",
  "title": "Telemetry latency threshold 1.5 to 1.7",
  "origin": "automated",
  "paths": ["oracle/src/tutor/behavioralTelemetry.ts"],
  "declaredTier": "tier_2",
  "status": "canary",
  "stage0": { "pedagogicalLead": "<name>", "safetyTrustLead": "<name>", "date": "2026-10-01" },
  "stage2": {
    "date": "2026-10-01",
    "reportSha256": "<SHA-256 of `npm --prefix oracle run gym:pedagogy -- --json`>",
    "personas": { "frustrated": "pass", "disengaging": "pass", "gaming": "pass", "reactant_teen": "pass", "masking": "pass" },
    "failures": []
  },
  "stage3": {
    "judgeId": "transcript_judge",
    "calibrationId": "<mentor_judge_calibration id>",
    "judgeModel": "<model>",
    "judgePromptHash": "<64 hex>",
    "scoredAt": "2026-10-02T10:00:00Z",
    "criteria": ["emotion_label"],
    "verdict": "pass",
    "verifiedWith": "npm --prefix backend run tutor:judge-calibration -- --verify-proposal=<this file>"
  },
  "stage4": null,
  "parameterChanges": { "telemetry.latencyZ": 1.7 },
  "stage5": { "experimentId": "<the mentor.canary experiment's uuid, listed in ../canaries.json>" },
  "stage6": null
}
```

## Rules the gate enforces

- **Tier.** The tier is computed from `paths`. `declaredTier` may be stricter, never weaker.
- **Origin.** An `automated` proposal may never touch a Tier 1 or live-content file.
- **Stage 2.** Every Appendix F persona is listed. A failure lists an itemized report in `failures`, and the change returns to Stage 1.
- **Tier 1 and live-content changes.** They never carry `stage3`. They need `stage4`: two different reviewers, a date, and `addresses` (at least 40 characters on the specific risk).
- **Tier 2 changes.** They need `stage3` with `verdict: "pass"`, or `stage4`.
- **Parameter changes.** `parameterChanges` names registered Tier 2 parameters (`tier2Parameters` in the registry) and their new values, inside the approved bounds, in a file listed in `paths`.
- **Canary delivery.** From `canary` on, `stage5.experimentId` must name a `mentor.canary` canary in [`../canaries.json`](../canaries.json) whose `overrides` equal `parameterChanges` exactly and whose `proposalId` is this record; in `canary` it must be `running`. A proposal with no `parameterChanges` has no canary path. See [policy §4.1](../../SELF-IMPROVEMENT-GOVERNANCE-POLICY.md#41-stage-5-the-canary-delivery-path).
- **Canary reading.** `released` and `rolled_back` need `stage5`: `experimentId`, `reader`, `date`, `transcriptsRead` of at least 20 (`npm --prefix backend run tutor:canary-report -- --proposal=<id> --sample=20` draws them), and `outcome` of `clear` or `rolled_back`.
- **Release.** `released` needs `stage6`: `releasedAt` and the Appendix F `metrics` it ships with.
- **Automated commits.** An automated commit cites its record with the trailer `Mentor-Proposal: <id>`.
