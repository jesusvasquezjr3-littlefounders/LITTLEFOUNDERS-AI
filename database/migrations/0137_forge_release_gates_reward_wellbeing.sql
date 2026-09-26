-- 0137_forge_release_gates_reward_wellbeing.sql — the S05.3e/S05.3f Forge
-- gates join the one release preflight.
-- @phase: contract
-- @after-release: the Forge verify:course that records forge.gate.17-19 in a
-- course's release attestation (coursegen gateManifest.ts with gates 17-19).
-- It narrows what unlocks a release: every course must be verified again, by
-- that Forge, before its next release. Nothing is removed. Apply by hand,
-- never by auto-apply.
--
-- *_forge_release_gate_manifest.sql made every Forge document gate a release
-- requirement and said a new gate is a new migration row. The learning-engine
-- lane added three document gates to runAllGates (coursegen
-- src/pipeline/gates.ts):
--   17  every reward is fixed, predictable and tied to an action (B.22;
--       rewardMechanicGate.ts);
--   18  shame, family-finance and manipulation language (B.26, B.27, B.25;
--       wellbeingGates.ts);
--   19  the age register (B.23; wellbeingGates.ts).
-- Without these rows release_course would release content those gates
-- refuse. Parity: agent/tools/check-forge-release-gate-parity.mjs.

insert into public.forge_release_gates (gate_id, gate_number, spec_refs, description) values
  ('forge.gate.17.reward-mechanics', 17, array['B.22'], 'Gate 17: rewards are fixed and predictable'),
  ('forge.gate.18.wellbeing-language', 18, array['B.25', 'B.26', 'B.27'], 'Gate 18: shame, family-finance and manipulation language'),
  ('forge.gate.19.age-register', 19, array['B.23'], 'Gate 19: age register')
on conflict (gate_id) do update
  set gate_number = excluded.gate_number,
      spec_refs = excluded.spec_refs,
      description = excluded.description;

SELECT 'migration_forge_release_gates_reward_wellbeing_ok' AS sentinel;
