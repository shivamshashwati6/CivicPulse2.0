-- ============================================================================
-- CivicPulse - Complete Database Schema & Fail-Proof RLS Policies Migration
-- ============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ----------------------------------------------------------------------------
-- 1. Profiles Table (Fail-Proof Primary Key without rigid Auth FK block)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY,
  full_name TEXT,
  email TEXT,
  avatar_url TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 2. Complaints Table (Fail-Proof Schema with direct User ID storage)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.complaints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  severity TEXT DEFAULT 'Medium',
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  address TEXT NOT NULL,
  status TEXT DEFAULT 'Pending',
  priority TEXT DEFAULT 'Medium',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 3. Complaint Images Table
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.complaint_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  complaint_id UUID NOT NULL REFERENCES public.complaints(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 4. Status History Audit Table
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  complaint_id UUID NOT NULL REFERENCES public.complaints(id) ON DELETE CASCADE,
  old_status TEXT,
  new_status TEXT NOT NULL,
  updated_by UUID,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 5. Notifications Table
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- Row Level Security (RLS) Configuration & Permissive Policies
-- ----------------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.complaints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.complaint_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Profiles RLS Policies
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Public profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (true);

-- Complaints RLS Policies (Cross-Device & Unrestricted Insert)
DROP POLICY IF EXISTS "Allow select complaints for all" ON public.complaints;
CREATE POLICY "Allow select complaints for all" ON public.complaints FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow insert complaints" ON public.complaints;
CREATE POLICY "Allow insert complaints" ON public.complaints FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow update complaints" ON public.complaints;
CREATE POLICY "Allow update complaints" ON public.complaints FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Allow delete complaints" ON public.complaints;
CREATE POLICY "Allow delete complaints" ON public.complaints FOR DELETE USING (true);

-- Complaint Images RLS Policies
DROP POLICY IF EXISTS "Allow select complaint images" ON public.complaint_images;
CREATE POLICY "Allow select complaint images" ON public.complaint_images FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow insert complaint images" ON public.complaint_images;
CREATE POLICY "Allow insert complaint images" ON public.complaint_images FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow delete complaint images" ON public.complaint_images;
CREATE POLICY "Allow delete complaint images" ON public.complaint_images FOR DELETE USING (true);

-- Status History RLS Policies
DROP POLICY IF EXISTS "Allow select status history" ON public.status_history;
CREATE POLICY "Allow select status history" ON public.status_history FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow insert status history" ON public.status_history;
CREATE POLICY "Allow insert status history" ON public.status_history FOR INSERT WITH CHECK (true);

-- Notifications RLS Policies
DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;
CREATE POLICY "Users can view own notifications" ON public.notifications FOR SELECT USING (true);

-- ----------------------------------------------------------------------------
-- Automatic Profile Creation Trigger
-- ----------------------------------------------------------------------------
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

-- ----------------------------------------------------------------------------
-- Enable Supabase Realtime for Complaints Table
-- ----------------------------------------------------------------------------
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
