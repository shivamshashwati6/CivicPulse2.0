-- ============================================================================
-- CivicPulse Migration: Complaint Upvotes Tracking & Safe Voting Function
-- ============================================================================

-- 1. Complaint Upvotes Tracking Table (1 Vote Per User Per Complaint)
CREATE TABLE IF NOT EXISTS public.complaint_upvotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  complaint_id UUID NOT NULL REFERENCES public.complaints(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_complaint_user_upvote UNIQUE (complaint_id, user_id)
);

-- 2. Index for Fast Upvote Lookups
CREATE INDEX IF NOT EXISTS idx_complaint_upvotes_user ON public.complaint_upvotes(user_id);
CREATE INDEX IF NOT EXISTS idx_complaint_upvotes_complaint ON public.complaint_upvotes(complaint_id);

-- 3. Row Level Security Policies
ALTER TABLE public.complaint_upvotes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow select complaint upvotes for all" ON public.complaint_upvotes;
CREATE POLICY "Allow select complaint upvotes for all" ON public.complaint_upvotes FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow insert complaint upvotes for authenticated users" ON public.complaint_upvotes;
CREATE POLICY "Allow insert complaint upvotes for authenticated users" ON public.complaint_upvotes FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow delete complaint upvotes for authenticated users" ON public.complaint_upvotes;
CREATE POLICY "Allow delete complaint upvotes for authenticated users" ON public.complaint_upvotes FOR DELETE USING (true);

-- 4. PL/pgSQL Function: Upvote a complaint safely preventing duplicate votes per user
CREATE OR REPLACE FUNCTION public.upvote_complaint(
  target_complaint_id UUID,
  voting_user_id UUID
)
RETURNS JSONB AS $$
DECLARE
  already_voted BOOLEAN;
  new_count INT;
BEGIN
  -- Check if user already upvoted this complaint
  SELECT EXISTS (
    SELECT 1 FROM public.complaint_upvotes
    WHERE complaint_id = target_complaint_id AND user_id = voting_user_id
  ) INTO already_voted;

  IF already_voted THEN
    SELECT upvotes INTO new_count FROM public.complaints WHERE id = target_complaint_id;
    RETURN jsonb_build_object(
      'success', false,
      'already_voted', true,
      'upvotes', COALESCE(new_count, 1),
      'message', 'You have already supported this issue ("I Face This Too").'
    );
  END IF;

  -- Record vote in tracking table
  INSERT INTO public.complaint_upvotes (complaint_id, user_id)
  VALUES (target_complaint_id, voting_user_id)
  ON CONFLICT (complaint_id, user_id) DO NOTHING;

  -- Increment upvote count on complaints table
  UPDATE public.complaints
  SET upvotes = COALESCE(upvotes, 0) + 1,
      updated_at = NOW()
  WHERE id = target_complaint_id
  RETURNING upvotes INTO new_count;

  RETURN jsonb_build_object(
    'success', true,
    'already_voted', false,
    'upvotes', COALESCE(new_count, 1),
    'message', 'Thank you for supporting this issue!'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
