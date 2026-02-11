
-- Allow admins to manage certifications
CREATE POLICY "Admins can manage certifications"
  ON certifications FOR ALL
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

-- Allow admins to manage certification milestones
CREATE POLICY "Admins can manage certification milestones"
  ON certification_milestones FOR ALL
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));
