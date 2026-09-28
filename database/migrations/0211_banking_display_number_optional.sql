-- banking_display_number_optional — D.7 (no unbacked real-card guarantee),
-- F1-family part 1 of 2 (expand). Core stops minting and storing the
-- card-shaped practice number (`LF-1234-5678`) on the family Wallet's coin
-- card, and no longer serves it (`displayNumber` is gone from the account
-- routes). The column keeps existing for the Core that is still running, but
-- a new account no longer needs a value: the NOT NULL is lifted here. There
-- was never a default. banking_display_number_drop (part 2, contract) drops
-- the column once the Core release that stopped writing it is live.
-- @phase: expand
--
-- Evidence: docs/operations/NO-UNBACKED-GUARANTEE.md (the pre-audit's open
-- line), docs/rebuild/sprints/GAP-FIX-R1.md (F1-family.3).

-- Guarded so a replay of the chain after the contract part (the column gone)
-- is a no-op rather than an error.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_schema = 'public' AND table_name = 'banking_accounts' AND column_name = 'display_number') THEN
        ALTER TABLE public.banking_accounts ALTER COLUMN display_number DROP NOT NULL;
    END IF;
END $$;

SELECT 'migration_banking_display_number_optional_ok' AS sentinel;
