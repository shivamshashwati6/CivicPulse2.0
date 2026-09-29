-- Migration: Ensure complaints to profiles relationship and permissive admin RLS policies
DO $$
BEGIN
  -- 1. Ensure foreign key constraint for PostgREST automatic joins (complaints -> profiles)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name='fk_complaints_profiles'
  ) THEN
    ALTER TABLE public.complaints 
    ADD CONSTRAINT fk_complaints_profiles 
    FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 2. Ensure Row Level Security (RLS) policies permit viewing and updating complaints
ALTER TABLE public.complaints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow select complaints for all" ON public.complaints;
CREATE POLICY "Allow select complaints for all" ON public.complaints FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow update complaints for all" ON public.complaints;
CREATE POLICY "Allow update complaints for all" ON public.complaints FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Allow insert complaints for all" ON public.complaints;
CREATE POLICY "Allow insert complaints for all" ON public.complaints FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow delete complaints for all" ON public.complaints;
CREATE POLICY "Allow delete complaints for all" ON public.complaints FOR DELETE USING (true);
