-- ============================================================================
-- CivicPulse Migration: Add Urban Impact Score Column to Complaints Table
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name='complaints' AND column_name='urban_impact_score'
  ) THEN
    ALTER TABLE public.complaints ADD COLUMN urban_impact_score INTEGER DEFAULT 25;
  END IF;
END $$;

-- Index for fast priority sorting by Urban Impact Score
CREATE INDEX IF NOT EXISTS idx_complaints_urban_impact_score ON public.complaints(urban_impact_score DESC);
