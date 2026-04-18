-- Privacy hardening: clear all previously persisted translations from the
-- shared hackathons.desc_translated column. Translations are now handled
-- entirely client-side (per-browser localStorage) so this column must not
-- retain any per-user content.
--
-- Safe to re-run. After running, the column remains but is always NULL;
-- a future migration may drop it entirely once confirmed no code reads it.

UPDATE public.hackathons
SET desc_translated = NULL
WHERE desc_translated IS NOT NULL;

-- Optional (commented out until verified safe):
-- ALTER TABLE public.hackathons DROP COLUMN desc_translated;
