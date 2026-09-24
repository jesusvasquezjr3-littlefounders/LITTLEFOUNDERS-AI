-- @phase: expand
-- E.4: profile dates cannot be rewritten by browser identities, including
-- direct PostgREST requests. Guardian/service workflows remain separate.
CREATE OR REPLACE FUNCTION public.guard_profile_birth_date()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
    IF current_user IN ('anon', 'authenticated') THEN
        IF TG_OP = 'INSERT' THEN
            IF NEW.birth_date IS NOT NULL THEN
                RAISE EXCEPTION 'Birth dates require a reviewed identity workflow' USING ERRCODE = '42501';
            END IF;
        ELSIF NEW.birth_date IS DISTINCT FROM OLD.birth_date THEN
            RAISE EXCEPTION 'Birth dates require a reviewed identity workflow' USING ERRCODE = '42501';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS profiles_birth_date_guard ON public.profiles;
CREATE TRIGGER profiles_birth_date_guard
BEFORE INSERT OR UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.guard_profile_birth_date();
