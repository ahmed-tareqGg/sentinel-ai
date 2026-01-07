-- Expand incident update permissions to match UI roles
ALTER POLICY "Admin and analysts can update incidents"
ON public.incidents
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'soc_analyst'::app_role)
  OR has_role(auth.uid(), 'soc_tier_1'::app_role)
  OR has_role(auth.uid(), 'soc_tier_2'::app_role)
  OR has_role(auth.uid(), 'soc_tier_3'::app_role)
  OR has_role(auth.uid(), 'soc_manager'::app_role)
  OR has_role(auth.uid(), 'ciso'::app_role)
);

-- Allow the same set of roles to append timeline entries (used by manual status changes)
ALTER POLICY "Admin and analysts can create timeline entries"
ON public.incident_timeline
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'soc_analyst'::app_role)
  OR has_role(auth.uid(), 'soc_tier_1'::app_role)
  OR has_role(auth.uid(), 'soc_tier_2'::app_role)
  OR has_role(auth.uid(), 'soc_tier_3'::app_role)
  OR has_role(auth.uid(), 'soc_manager'::app_role)
  OR has_role(auth.uid(), 'ciso'::app_role)
);