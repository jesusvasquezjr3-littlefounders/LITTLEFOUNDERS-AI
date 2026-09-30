-- v2_manifest_age_register_gate — a v2 publication requires Forge gate 19,
-- the age register (Appendix C Part 3 Stage 2; B.23; Product G.2 "no
-- structurally exempt path").
-- @phase: contract
-- @after-release: the Forge release whose v2 manifests attest forge.gate.19.age-register (coursegen src/v2/release.ts V2_MANIFEST_GATES, which gained gate 19 when gate 19 started running on v2 documents). An older Forge manifest omits it, so a publication it sends is refused until Forge is updated; no learner-facing path depends on publish_v2_lesson_version.
--
-- Forge gate 19 now runs on v2 documents (from age 10 every graded step needs
-- feedback.met, generic praise blocks, feedback shows no number its step does
-- not show) and Forge's v2 manifest attests it. publish_v2_lesson_version
-- requires the gates listed in public.forge_v2_manifest_gates
-- (v2_manifest_carried_gates), and that list stopped at gate 18, so a v2
-- lesson version could publish without the age-register attestation. This
-- adds the row; the function reads the rows, so it is unchanged.
-- agent/tools/check-forge-release-gate-parity.mjs keeps these rows equal to
-- Forge's V2_MANIFEST_GATES. forge.gate.19.age-register has been a
-- forge_release_gates row since forge_release_gates_reward_wellbeing.

INSERT INTO public.forge_v2_manifest_gates (gate_id) VALUES
    ('forge.gate.19.age-register')
ON CONFLICT (gate_id) DO NOTHING;

SELECT 'migration_v2_manifest_age_register_gate_ok' AS sentinel;
