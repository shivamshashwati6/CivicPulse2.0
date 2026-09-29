-- ============================================================================
-- CivicPulse - Complete Database Schema & PostGIS Duplicate Merge Migration
-- ============================================================================

-- 1. Enable Required Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS postgis;

-- 2. Profiles Table
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY,
  full_name TEXT,
  email TEXT,
  avatar_url TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Complaints Table (With PostGIS Geography Point & Upvotes)
CREATE TABLE IF NOT EXISTS public.complaints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  citizen_id UUID,
  user_id UUID,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  severity_score TEXT DEFAULT 'Medium',
  severity TEXT DEFAULT 'Medium',
  priority TEXT DEFAULT 'Medium',
  summary TEXT,
  status TEXT DEFAULT 'Pending',
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  address TEXT,
  location GEOGRAPHY(POINT, 4326),
  image_url TEXT,
  upvotes INTEGER DEFAULT 1,
  ai_category TEXT,
  ai_severity TEXT,
  ai_priority TEXT,
  ai_summary TEXT,
  ai_confidence INTEGER,
  ai_processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add missing columns dynamically if migrating existing table
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='complaints' AND column_name='citizen_id') THEN
    ALTER TABLE public.complaints ADD COLUMN citizen_id UUID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='complaints' AND column_name='severity_score') THEN
    ALTER TABLE public.complaints ADD COLUMN severity_score TEXT DEFAULT 'Medium';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='complaints' AND column_name='summary') THEN
    ALTER TABLE public.complaints ADD COLUMN summary TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='complaints' AND column_name='location') THEN
    ALTER TABLE public.complaints ADD COLUMN location GEOGRAPHY(POINT, 4326);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='complaints' AND column_name='image_url') THEN
    ALTER TABLE public.complaints ADD COLUMN image_url TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='complaints' AND column_name='upvotes') THEN
    ALTER TABLE public.complaints ADD COLUMN upvotes INTEGER DEFAULT 1;
  END IF;
END $$;

-- 4. Spatial GIST Index for High-Performance PostGIS Proximity Queries
CREATE INDEX IF NOT EXISTS idx_complaints_location ON public.complaints USING GIST(location);
CREATE INDEX IF NOT EXISTS idx_complaints_category_status ON public.complaints(category, status);

-- 5. Complaint Images Table
CREATE TABLE IF NOT EXISTS public.complaint_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  complaint_id UUID NOT NULL REFERENCES public.complaints(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Status History Audit Table
CREATE TABLE IF NOT EXISTS public.status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  complaint_id UUID NOT NULL REFERENCES public.complaints(id) ON DELETE CASCADE,
  old_status TEXT,
  new_status TEXT NOT NULL,
  updated_by UUID,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Notifications Table
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. PL/pgSQL Function: Check and Merge Duplicate Complaints via PostGIS
CREATE OR REPLACE FUNCTION public.check_and_merge_duplicate_complaint(
  new_lat DOUBLE PRECISION,
  new_lng DOUBLE PRECISION,
  cat TEXT,
  radius_meters DOUBLE PRECISION DEFAULT 100.0
)
RETURNS UUID AS $$
DECLARE
  matched_complaint_id UUID;
  new_point GEOGRAPHY;
BEGIN
  -- Construct WGS84 geography point (longitude, latitude)
  new_point := ST_SetSRID(ST_MakePoint(new_lng, new_lat), 4326)::geography;

  -- Search for the closest active/open complaint in the same category within radius_meters
  SELECT id INTO matched_complaint_id
  FROM public.complaints
  WHERE LOWER(category) = LOWER(cat)
    AND LOWER(status) NOT IN ('resolved', 'closed')
    AND location IS NOT NULL
    AND ST_DWithin(location, new_point, radius_meters)
  ORDER BY ST_Distance(location, new_point) ASC
  LIMIT 1;

  -- If a duplicate match exists, increment upvotes count and return existing record ID
  IF matched_complaint_id IS NOT NULL THEN
    UPDATE public.complaints
    SET upvotes = COALESCE(upvotes, 1) + 1,
        updated_at = NOW()
    WHERE id = matched_complaint_id;

    RETURN matched_complaint_id;
  END IF;

  -- If no duplicate match exists, return NULL
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. Automatic Sync Trigger for Location Geography & User ID
CREATE OR REPLACE FUNCTION public.sync_complaint_location()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.latitude IS NOT NULL AND NEW.longitude IS NOT NULL AND NEW.location IS NULL THEN
    NEW.location := ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326)::geography;
  ELSIF NEW.location IS NOT NULL THEN
    NEW.longitude := ST_X(NEW.location::geometry);
    NEW.latitude := ST_Y(NEW.location::geometry);
  END IF;

  IF NEW.citizen_id IS NULL AND NEW.user_id IS NOT NULL THEN
    NEW.citizen_id := NEW.user_id;
  ELSIF NEW.user_id IS NULL AND NEW.citizen_id IS NOT NULL THEN
    NEW.user_id := NEW.citizen_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_sync_complaint_location ON public.complaints;
CREATE TRIGGER trigger_sync_complaint_location
  BEFORE INSERT OR UPDATE ON public.complaints
  FOR EACH ROW EXECUTE FUNCTION public.sync_complaint_location();

-- 10. Enable Row Level Security (RLS) & Permissive Policies
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.complaints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.complaint_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Public profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Allow select complaints for all" ON public.complaints;
CREATE POLICY "Allow select complaints for all" ON public.complaints FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow insert complaints" ON public.complaints;
CREATE POLICY "Allow insert complaints" ON public.complaints FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Allow update complaints" ON public.complaints;
CREATE POLICY "Allow update complaints" ON public.complaints FOR UPDATE USING (true);
DROP POLICY IF EXISTS "Allow delete complaints" ON public.complaints;
CREATE POLICY "Allow delete complaints" ON public.complaints FOR DELETE USING (true);

DROP POLICY IF EXISTS "Allow select complaint images" ON public.complaint_images;
CREATE POLICY "Allow select complaint images" ON public.complaint_images FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow insert complaint images" ON public.complaint_images;
CREATE POLICY "Allow insert complaint images" ON public.complaint_images FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Allow delete complaint images" ON public.complaint_images;
CREATE POLICY "Allow delete complaint images" ON public.complaint_images FOR DELETE USING (true);

DROP POLICY IF EXISTS "Allow select status history" ON public.status_history;
CREATE POLICY "Allow select status history" ON public.status_history FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow insert status history" ON public.status_history;
CREATE POLICY "Allow insert status history" ON public.status_history FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;
CREATE POLICY "Users can view own notifications" ON public.notifications FOR SELECT USING (true);

-- 11. Automatic Profile Sync Trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', '')
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    email = EXCLUDED.email;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 12. Enable Supabase Realtime for Complaints Table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'complaints'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.complaints;
  END IF;
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;
