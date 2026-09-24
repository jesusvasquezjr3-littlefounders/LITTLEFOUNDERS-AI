-- @phase: expand
-- H.1: admission and preference changes serialize on the same account row.
-- This affects optional learning_events only, never progress or safety logs.
CREATE OR REPLACE FUNCTION public.guard_optional_learning_event()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE guest boolean; age_band text;
BEGIN
    IF NEW.user_id IS NULL THEN RETURN NEW; END IF;
    SELECT is_anonymous INTO guest FROM auth.users WHERE id = NEW.user_id FOR UPDATE;
    IF NOT FOUND OR guest IS TRUE THEN RETURN NULL; END IF;
    IF EXISTS (SELECT 1 FROM public.account_safety_origins WHERE user_id = NEW.user_id AND under13_origin) THEN RETURN NULL; END IF;
    SELECT declared_age_band INTO age_band FROM public.account_age_declarations WHERE user_id = NEW.user_id;
    IF age_band IS NULL OR NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = NEW.user_id) THEN RETURN NULL; END IF;
    IF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = NEW.user_id AND role = 'kid') THEN
        IF NOT EXISTS (SELECT 1 FROM public.analytics_consents WHERE kid_user_id = NEW.user_id AND revoked_at IS NULL) THEN RETURN NULL; END IF;
    ELSIF age_band = '13_to_17' THEN
        IF NOT EXISTS (SELECT 1 FROM public.teen_analytics_preferences WHERE user_id = NEW.user_id AND enabled AND disclosure_version = 1) THEN RETURN NULL; END IF;
    ELSIF age_band <> 'adult' THEN
        RETURN NULL;
    END IF;
    RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_optional_learning_event() FROM PUBLIC, anon, authenticated, service_role;
CREATE OR REPLACE TRIGGER optional_learning_event_admission
BEFORE INSERT ON public.learning_events
FOR EACH ROW EXECUTE FUNCTION public.guard_optional_learning_event();
