-- Migration: Add recommended_department column to complaints table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema='public' AND table_name='complaints' AND column_name='recommended_department'
  ) THEN
    ALTER TABLE public.complaints ADD COLUMN recommended_department TEXT DEFAULT 'Review Required';
  END IF;
END $$;

-- Backfill existing complaint records according to their issue category
UPDATE public.complaints
SET recommended_department = CASE
  WHEN LOWER(category) IN ('pothole', 'damaged_road', 'damaged road') THEN 'Public Works Department'
  WHEN LOWER(category) IN ('garbage', 'garbage & waste', 'waste') THEN 'Waste Management Department'
  WHEN LOWER(category) IN ('streetlight', 'street lighting', 'broken streetlight') THEN 'Electrical / Street Lighting Department'
  WHEN LOWER(category) IN ('water_leakage', 'water leakage', 'water') THEN 'Water & Sewerage Department'
  ELSE 'Review Required'
END
WHERE recommended_department IS NULL OR recommended_department = 'Review Required';
