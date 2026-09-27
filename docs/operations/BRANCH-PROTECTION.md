# Branch protection for the governed Mentor code

**Status:** prepared by Engineering on 27 September 2026 for owner decision OD-28 (owner review O-01, Product 10 C.22). Nothing here is applied: repository configuration is the owner's, and no agent calls the GitHub API to change it. The owner applies it with the command in §3.

## 1. What it enforces

The C.22 governance gate (`npm run governance:check`, `docs/rebuild/mentor/SELF-IMPROVEMENT-GOVERNANCE-POLICY.md`) proves that every Mentor file is classified, that every Tier 1 change has a change-record row, and that no automated commit touches Tier 1. It cannot stop someone from pushing past it. The ruleset below closes that gap on `main`:

| Rule | Effect |
|---|---|
| Pull request required | Every change reaches `main` through a pull request. A direct `git push origin main` is refused. |
| Code-owner review | A pull request that changes a path listed in [`.github/CODEOWNERS`](../../.github/CODEOWNERS) (the governed Mentor roots, the Tier 1 and live-content files outside them, and the governance model) needs an approving review from a code owner. Other pull requests need no approval (`required_approving_review_count: 0`). A new push dismisses an earlier approval. |
| Required check | The `repo-gates.yml` job **Mentor self-improvement governance (C.22)** must pass. That workflow has no `paths:` filter, so the check reports on every pull request and never blocks one by being absent. |
| Bypass | The repository admin role (`actor_id: 5`) may bypass, only through a pull request (`bypass_mode: pull_request`). GitHub records each bypass on the pull request. |

`.github/CODEOWNERS` mirrors the registry (`docs/rebuild/mentor/governance/registry.json`): the six governed roots, the six component files outside them, and the governance model's own files. `agent/tools/codeowners-governance.test.mjs` (in `npm run tools:test`) fails when the registry names a path CODEOWNERS does not cover, and when the ruleset's required check no longer matches the job's name in `repo-gates.yml`.

## 2. What changes for the people who push

- **Merge instead of push.** Today a push to `main` is a deploy (`CLAUDE.md`, "What a push to `main` actually does"). After the ruleset, the deploy happens when a pull request is merged: the merge is a push to `main`, so the per-service CI and the CI-chained CD run exactly as before. Agents and people open a pull request (`gh pr create`) instead of pushing.
- **A sole author cannot approve their own pull request.** GitHub does not count the author's own approval. While the project leader is the only code owner and writes (or has agents write under their account) most changes, a pull request that touches governed paths is merged with the admin bypass, which GitHub records. That record, the required check, and the Tier 1 change record with both leads' signatures are the controls. When a second code owner exists (for example the Pedagogical Reviewer or the Safety/Trust Lead with a GitHub account), add them to CODEOWNERS and the approval becomes a real second pair of eyes.
- **If direct pushes must keep working**, change `bypass_mode` to `always` before applying. The rules then bind every other collaborator and every app (including automated proposal pipelines), and the admin's own pushes skip them. This is weaker; the gate in CI still reports.

## 3. Applying it (owner only)

Requirements: the GitHub CLI signed in as the repository owner (`gh auth status`). Rulesets on a private repository owned by a personal account need GitHub Pro; on a free plan the API answers 403, and branch protection has to wait for the plan.

Check first that the required check has run at least once on a pull request, so GitHub knows its name:

```bash
gh api repos/jesusvasquezjr3-littlefounders/LITTLEFOUNDERS-AI/commits/main/check-runs \
  --jq '.check_runs[].name' | grep -F 'Mentor self-improvement governance (C.22)'
```

Create the ruleset from the checked-in JSON ([`mentor-governance-ruleset.json`](mentor-governance-ruleset.json)):

```bash
gh api --method POST \
  -H "Accept: application/vnd.github+json" \
  -H "X-GitHub-Api-Version: 2022-11-28" \
  repos/jesusvasquezjr3-littlefounders/LITTLEFOUNDERS-AI/rulesets \
  --input docs/operations/mentor-governance-ruleset.json
```

Verify it:

```bash
gh api repos/jesusvasquezjr3-littlefounders/LITTLEFOUNDERS-AI/rulesets --jq '.[] | {id, name, enforcement}'
gh api repos/jesusvasquezjr3-littlefounders/LITTLEFOUNDERS-AI/rules/branches/main --jq '.[].type'
```

The second command should list `pull_request` and `required_status_checks`.

The ruleset JSON as checked in:

```json
{
  "name": "main: Mentor governance (C.22, OD-28)",
  "target": "branch",
  "enforcement": "active",
  "conditions": { "ref_name": { "include": ["~DEFAULT_BRANCH"], "exclude": [] } },
  "bypass_actors": [{ "actor_id": 5, "actor_type": "RepositoryRole", "bypass_mode": "pull_request" }],
  "rules": [
    {
      "type": "pull_request",
      "parameters": {
        "required_approving_review_count": 0,
        "dismiss_stale_reviews_on_push": true,
        "require_code_owner_review": true,
        "require_last_push_approval": false,
        "required_review_thread_resolution": false
      }
    },
    {
      "type": "required_status_checks",
      "parameters": {
        "strict_required_status_checks_policy": false,
        "required_status_checks": [{ "context": "Mentor self-improvement governance (C.22)", "integration_id": 15368 }]
      }
    }
  ]
}
```

`integration_id` 15368 is the GitHub Actions app, so only a check reported by Actions satisfies the rule.

## 4. Rolling it back

```bash
gh api repos/jesusvasquezjr3-littlefounders/LITTLEFOUNDERS-AI/rulesets --jq '.[] | select(.name | startswith("main: Mentor governance")) | .id'
gh api --method DELETE repos/jesusvasquezjr3-littlefounders/LITTLEFOUNDERS-AI/rulesets/<id>
```

To pause it without deleting it, `PUT` the same JSON with `"enforcement": "disabled"` to `.../rulesets/<id>`.

## 5. Keeping it true

- A new governed root, or a new component file outside the roots, needs a CODEOWNERS line in the same change; the tools test enforces it.
- Renaming the `mentor-governance` job in `repo-gates.yml` needs the same rename in `mentor-governance-ruleset.json` and a re-applied ruleset (a `PUT` to `.../rulesets/<id>`); otherwise every pull request waits for a check that never reports. The tools test catches the file drift; only the owner can re-apply.
