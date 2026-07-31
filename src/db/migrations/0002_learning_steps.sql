-- Add the ts-fsrs short-term learning-step index to existing installs. Fresh
-- seeds already include this column (see 0001_init.sql); this migration only
-- upgrades a database created before short-term steps were enabled. New/
-- graduated cards default to 0, which is the correct starting value.
ALTER TABLE cards ADD COLUMN learning_steps INTEGER NOT NULL DEFAULT 0;
