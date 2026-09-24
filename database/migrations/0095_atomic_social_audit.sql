-- @phase: expand
-- E.2: every committed graph mutation must have an append-only audit record.
-- Service-side cascades may have no JWT actor; preserve NULL rather than invent one.
CREATE OR REPLACE FUNCTION public.audit_social_graph_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
    actor uuid;
    previous_edge jsonb;
    current_edge jsonb;
    remove_action text;
    add_action text;
    target_key text;
BEGIN
    SELECT id INTO actor FROM auth.users WHERE id = auth.uid();
    IF TG_TABLE_NAME = 'follows' THEN
        remove_action := 'social.unfollow';
        add_action := 'social.follow';
        target_key := 'followed_id';
        IF TG_OP <> 'INSERT' THEN
            previous_edge := jsonb_build_object('follower_id', OLD.follower_id, 'followed_id', OLD.followed_id);
        END IF;
        IF TG_OP <> 'DELETE' THEN
            current_edge := jsonb_build_object('follower_id', NEW.follower_id, 'followed_id', NEW.followed_id);
        END IF;
    ELSE
        remove_action := 'social.unblock';
        add_action := 'social.block';
        target_key := 'blocked_id';
        IF TG_OP <> 'INSERT' THEN
            previous_edge := jsonb_build_object('blocker_id', OLD.blocker_id, 'blocked_id', OLD.blocked_id);
        END IF;
        IF TG_OP <> 'DELETE' THEN
            current_edge := jsonb_build_object('blocker_id', NEW.blocker_id, 'blocked_id', NEW.blocked_id);
        END IF;
    END IF;
    IF previous_edge IS NOT DISTINCT FROM current_edge THEN
        RETURN NULL;
    END IF;
    IF previous_edge IS NOT NULL THEN
        INSERT INTO public.audit_logs(actor_id, action, subject, detail)
        VALUES (actor, remove_action, previous_edge ->> target_key,
            previous_edge || jsonb_build_object('origin', 'database-trigger'));
    END IF;
    IF current_edge IS NOT NULL THEN
        INSERT INTO public.audit_logs(actor_id, action, subject, detail)
        VALUES (actor, add_action, current_edge ->> target_key,
            current_edge || jsonb_build_object('origin', 'database-trigger'));
    END IF;
    RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.audit_social_graph_change() FROM PUBLIC, anon, authenticated, service_role;
CREATE OR REPLACE TRIGGER social_follow_audit AFTER INSERT OR UPDATE OR DELETE ON public.follows
FOR EACH ROW EXECUTE FUNCTION public.audit_social_graph_change();
CREATE OR REPLACE TRIGGER social_block_audit AFTER INSERT OR UPDATE OR DELETE ON public.blocks
FOR EACH ROW EXECUTE FUNCTION public.audit_social_graph_change();
