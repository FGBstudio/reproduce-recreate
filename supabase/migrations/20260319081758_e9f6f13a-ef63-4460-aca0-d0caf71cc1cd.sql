
-- Fix site_thresholds INSERT/UPDATE policies to enforce site membership
-- Drop overly permissive policies and replace with site-scoped ones

DROP POLICY IF EXISTS "Authenticated users can insert thresholds" ON public.site_thresholds;
DROP POLICY IF EXISTS "Authenticated users can update thresholds" ON public.site_thresholds;

CREATE POLICY "Members can insert thresholds" ON public.site_thresholds
  FOR INSERT TO authenticated
  WITH CHECK (can_access_site(auth.uid(), site_id));

CREATE POLICY "Members can update thresholds" ON public.site_thresholds
  FOR UPDATE TO authenticated
  USING (can_access_site(auth.uid(), site_id))
  WITH CHECK (can_access_site(auth.uid(), site_id));
