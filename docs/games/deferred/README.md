# Deferred migrations

`0261_game_records_retention.sql` is the COPPA written-retention sweep for the game tables
(sessions and runs 400 days, saves and bests 24 months after the last play). It is classified as a
**contract** migration (its function body contains `DELETE`), so `database-cd`'s `gate-auto-apply`
would refuse an entire push that contained it. It is therefore kept out of `database/migrations/`
and out of the release push.

Nothing can be eligible for deletion before 400 days after launch, so this is safe to defer. Apply it
by hand (owner) well before day 400, renumbering to the next free migration number, and add the daily
caller following `learning-retention.yml`. `database/scripts/verify-game-records-postgres.py` runs its
sweep checks automatically when the file is present in the chain.
