-- clean_slate_drop_removed_areas — drop every table, view, trigger and function of the family console, tasks and rewards, family wallet and teen wallet (3 of 3).
-- @phase: contract
-- @after-release: the clean-slate Core that removed the family console, tasks, family wallet and teen wallet
--
-- Apply after clean_slate_identity_functions and clean_slate_erasure_functions,
-- which leave no surviving function reading these objects. Before applying,
-- remove the unguarded step `SELECT public.purge_closed_learning_bridge_prompts(400);`
-- from .github/workflows/insights-maintenance.yml (its other family steps are
-- guarded by to_regprocedure and become no-ops).
--
-- No CASCADE: every dependency is dropped by name, so an object this file does
-- not know about fails the migration instead of disappearing with it.
-- Idempotent. Not dropped: guardian_links.invite_id (the column stays, only its
-- foreign key to guardian_invites goes), and the helpers surviving functions
-- still call (wallet_holder_kind, teen_wallet_holder, family_is_verified_guardian,
-- family_changed_columns, family_only_nulled, family_research_is_adult,
-- family_research_age_at, data_practice_set_consent, data_practice_state).

DROP TRIGGER IF EXISTS guardian_link_state_transition_audit ON public.guardian_links;
ALTER TABLE public.guardian_links DROP CONSTRAINT IF EXISTS guardian_links_invite_id_fkey;

DROP VIEW IF EXISTS public.insights_family_engagement;

-- The functions go in two passes around the tables. Some take or return a row
-- of a table dropped here, so they must go before it; others are the trigger,
-- policy and constraint functions of those tables and can only go after it.
-- The first pass skips whatever is still depended on; the second is strict.
CREATE FUNCTION pg_temp.clean_slate_drop_functions(p_strict boolean) RETURNS void LANGUAGE plpgsql AS $$
DECLARE
    v_fn record;
BEGIN
    FOR v_fn IN
        SELECT p.oid::regprocedure AS signature, p.prokind
        FROM pg_catalog.pg_proc p
        JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname = ANY (ARRAY[
            'accept_guardian_invite', 'act_on_learning_bridge_prompt',
            'allocate_pending_credit', 'allocate_task_reward', 'banking_movement_allowed',
            'cancel_learning_streak_pause', 'check_family_autonomy_change_applied',
            'check_family_decision_applied', 'check_share_gift_balanced',
            'check_wallet_guardian_action_balanced', 'check_wallet_self_action_balanced',
            'chore_tag_adoption', 'close_goal_next_step', 'coop_goal_guardian_goals',
            'coop_goal_guardian_view', 'decide_guardian_link', 'decide_redemption',
            'decide_social_connection', 'dismiss_learning_bridge_prompt',
            'emit_family_money_credit', 'emit_family_redemption_request',
            'family_analytics_admitted', 'family_autonomy_admits_reward',
            'family_autonomy_admits_task', 'family_autonomy_apply', 'family_autonomy_cap',
            'family_autonomy_decide_request', 'family_autonomy_eligibility',
            'family_autonomy_eligible_for', 'family_autonomy_level',
            'family_autonomy_progression', 'family_autonomy_record',
            'family_autonomy_request_level', 'family_autonomy_set',
            'family_autonomy_staff_lower', 'family_autonomy_status',
            'family_autonomy_step_down', 'family_autonomy_step_downs',
            'family_autonomy_threshold', 'family_child_age', 'family_child_in_family',
            'family_decide_redemption', 'family_decide_task', 'family_decision_followups',
            'family_decision_matches', 'family_decision_not_approved',
            'family_denial_actionability', 'family_denial_reason_sample',
            'family_engagement_insight', 'family_evidence_cleared', 'family_evidence_due',
            'family_money_credit_class', 'family_money_register',
            'family_money_register_distribution', 'family_post_goal_motivation',
            'family_reason_actionable', 'family_redemption_credit_timing',
            'family_request_redemption', 'family_request_role', 'family_research_admitted',
            'family_research_completeness', 'family_research_disclosure_version',
            'family_research_set_consent', 'family_research_state',
            'family_retention_compliance', 'family_retention_days',
            'family_retention_last_run', 'family_retention_sweep', 'family_review_decision',
            'family_save_contribution_persistence', 'family_score_denial_reason',
            'family_split_engagement', 'family_staff_may_support',
            'family_staff_may_view_analytics', 'family_state_integrity', 'family_talk_close',
            'family_talk_nudge_rate', 'family_talk_request', 'family_task_mark_done',
            'family_task_self_log', 'forbid_client_evidence_write', 'fulfill_redemption',
            'goal_next_step_decline', 'goal_next_step_seen', 'goal_progress_breakdown',
            'guard_banking_account_state', 'guard_chore_streak_day',
            'guard_chore_streak_pause', 'guard_family_autonomy_change',
            'guard_family_autonomy_level', 'guard_family_autonomy_request',
            'guard_family_decision', 'guard_family_money_event', 'guard_family_talk_nudge',
            'guard_frozen_redemption_request', 'guard_goal_next_step', 'guard_guardian_invite',
            'guard_learning_bridge_prompt_goal', 'guard_parent_coaching_delivery',
            'guard_personal_reward', 'guard_redemption_catalog', 'guard_redemption_state',
            'guard_savings_bonus_rule', 'guard_savings_goal_follows',
            'guard_savings_goal_state', 'guard_share_destination', 'guard_share_gift',
            'guard_task_completion_day', 'guard_task_state', 'guard_wallet_guardian_action',
            'guard_wallet_ledger_entry', 'guard_wallet_self_action',
            'guard_wallet_split_preference', 'guardian_adjust_wallet',
            'guardian_deletion_notices', 'guardian_end_chore_streak_pause',
            'guardian_end_social_connection', 'guardian_pause_chore_streak',
            'guardian_rename_flagged_child', 'guardian_withdraw_goal', 'money_bridge_eligible',
            'money_bridge_engagement', 'money_bridge_mark', 'money_bridge_state',
            'offer_learning_bridge_prompt', 'open_goal_next_step', 'parent_coaching_deliver',
            'parent_coaching_delivery_rate', 'parent_coaching_eligible',
            'parent_coaching_mark', 'parent_coaching_reflection_rate', 'parent_coaching_row',
            'probe_family_engagement_insight', 'prune_family_money_events',
            'purge_closed_learning_bridge_prompts', 'reach_goal_if_covered',
            'record_chore_streak_day', 'record_decision_reflection',
            'record_family_autonomy_eligibility', 'record_family_autonomy_eligibility_all',
            'record_family_evidence_purge', 'record_family_redemption_decision',
            'record_family_redemption_timing', 'record_family_research_snapshots',
            'record_family_state_transition', 'record_family_task_decision',
            'record_savings_bonus_explanation', 'record_staff_insight_check',
            'record_wallet_split', 'revoke_own_guardian_link', 'run_due_scheduled_credits',
            'savings_bonus_comprehension', 'savings_bonus_framing',
            'set_coop_goal_guardian_consent', 'set_learning_streak_pause',
            'set_wallet_usual_split', 'share_destination_archive', 'share_destination_create',
            'share_destination_steward', 'share_gift_completion', 'share_gift_pledge',
            'share_gift_settle', 'staff_insight_uptime', 'teen_archive_personal_reward',
            'teen_claim_personal_reward', 'teen_create_personal_reward',
            'teen_decide_guardian_link', 'teen_log_income', 'teen_release_goal',
            'teen_wallet_adoption', 'wallet_access', 'wallet_recommended_split',
            'wallet_split_coins', 'wallet_usual_split'
        ]::name[])
    LOOP
        BEGIN
            EXECUTE format('DROP %s %s', CASE v_fn.prokind WHEN 'p' THEN 'PROCEDURE' ELSE 'FUNCTION' END, v_fn.signature);
        EXCEPTION WHEN dependent_objects_still_exist THEN
            IF p_strict THEN
                RAISE;
            END IF;
        END;
    END LOOP;
END $$;

SELECT pg_temp.clean_slate_drop_functions(false);

DROP TABLE IF EXISTS
    public.wallet_ledger, public.wallet_guardian_actions, public.wallet_self_actions,
    public.wallet_split_preferences, public.pending_credits, public.banking_accounts,
    public.allowance_rules, public.spend_limits, public.savings_bonus_rules,
    public.savings_bonus_explanations, public.savings_goals, public.goal_next_steps,
    public.share_destinations, public.share_gifts, public.personal_rewards,
    public.money_bridge_progress, public.family_money_events, public.tasks,
    public.kid_task_streaks, public.chore_streak_days, public.chore_streak_pauses,
    public.redemption_catalog, public.redemptions, public.family_decisions,
    public.family_decision_reflections, public.family_denial_reason_scores,
    public.family_talk_nudges, public.family_autonomy_levels, public.family_autonomy_requests,
    public.family_autonomy_changes, public.family_autonomy_eligibility_log,
    public.family_state_audit, public.family_retention_runs, public.parent_coaching_deliveries,
    public.family_research_consents, public.family_research_participants,
    public.family_research_snapshots, public.learning_bridge_prompts, public.guardian_invites,
    public.achievement_share_initiations, public.staff_insight_checks;

SELECT pg_temp.clean_slate_drop_functions(true);
DROP FUNCTION pg_temp.clean_slate_drop_functions(boolean);
