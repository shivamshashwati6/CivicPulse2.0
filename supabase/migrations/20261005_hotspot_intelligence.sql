-- ============================================================================
-- CivicPulse 2.0 - Hotspot Detection & Smart Department Routing Schema
-- ============================================================================

-- 1. Create Hotspots Table
CREATE TABLE IF NOT EXISTS public.hotspots (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  area TEXT,
  center_lat DOUBLE PRECISION NOT NULL,
  center_lng DOUBLE PRECISION NOT NULL,
  location GEOGRAPHY(POINT, 4326),
  radius_meters DOUBLE PRECISION DEFAULT 500.0,
  risk_score INTEGER DEFAULT 0,
  risk_level TEXT DEFAULT 'Low',
  priority TEXT DEFAULT 'LOW',
  dominant_category TEXT,
  assigned_department TEXT,
  total_complaints INTEGER DEFAULT 0,
  unresolved_complaints INTEGER DEFAULT 0,
  critical_complaints INTEGER DEFAULT 0,
  oldest_complaint_at TIMESTAMPTZ,
  status TEXT DEFAULT 'Detected',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Spatial Index & Performance Indexes
CREATE INDEX IF NOT EXISTS idx_hotspots_location ON public.hotspots USING GIST(location);
CREATE INDEX IF NOT EXISTS idx_hotspots_risk_score ON public.hotspots(risk_score DESC);
CREATE INDEX IF NOT EXISTS idx_hotspots_department ON public.hotspots(assigned_department);
CREATE INDEX IF NOT EXISTS idx_hotspots_status ON public.hotspots(status);

-- 3. Automatic Location Sync Trigger for Hotspots
CREATE OR REPLACE FUNCTION public.sync_hotspot_location()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.center_lat IS NOT NULL AND NEW.center_lng IS NOT NULL AND NEW.location IS NULL THEN
    NEW.location := ST_SetSRID(ST_MakePoint(NEW.center_lng, NEW.center_lat), 4326)::geography;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_sync_hotspot_location ON public.hotspots;
CREATE TRIGGER trigger_sync_hotspot_location
  BEFORE INSERT OR UPDATE ON public.hotspots
  FOR EACH ROW EXECUTE FUNCTION public.sync_hotspot_location();

-- 4. Enable RLS with Permissive Policies
ALTER TABLE public.hotspots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow select hotspots for all" ON public.hotspots;
CREATE POLICY "Allow select hotspots for all" ON public.hotspots FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow insert hotspots" ON public.hotspots;
CREATE POLICY "Allow insert hotspots" ON public.hotspots FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow update hotspots" ON public.hotspots;
CREATE POLICY "Allow update hotspots" ON public.hotspots FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Allow delete hotspots" ON public.hotspots;
CREATE POLICY "Allow delete hotspots" ON public.hotspots FOR DELETE USING (true);
