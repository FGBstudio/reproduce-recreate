-- Migration: Update RLS policies for multi-tenant access
-- Version: 017
-- Description: Replace simple SELECT policies with user_memberships-based access control

-- =============================================================================
-- Helper function: Check hierarchical access
-- =============================================================================

-- Check if user has access to a holding (directly or via region)
CREATE OR REPLACE FUNCTION public.can_access_holding(_user_id UUID, _holding_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT 
        -- Direct holding membership
        EXISTS (
            SELECT 1 FROM public.user_memberships
            WHERE user_id = _user_id
              AND scope_type = 'holding'
              AND scope_id = _holding_id::TEXT
        )
        -- Or is admin/superuser (access everything)
        OR public.is_admin(_user_id)
$$;

-- Check if user has access to a brand (directly, via holding, or via region)
CREATE OR REPLACE FUNCTION public.can_access_brand(_user_id UUID, _brand_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT 
        -- Direct brand membership
        EXISTS (
            SELECT 1 FROM public.user_memberships
            WHERE user_id = _user_id
              AND scope_type = 'brand'
              AND scope_id = _brand_id::TEXT
        )
        -- Or via holding
        OR EXISTS (
            SELECT 1 FROM public.brands b
            WHERE b.id = _brand_id
              AND public.can_access_holding(_user_id, b.holding_id)
        )
        -- Or is admin
        OR public.is_admin(_user_id)
$$;

-- Check if user has access to a site (directly, via brand, holding, or region)
CREATE OR REPLACE FUNCTION public.can_access_site(_user_id UUID, _site_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT 
        -- Direct site membership
        EXISTS (
            SELECT 1 FROM public.user_memberships
            WHERE user_id = _user_id
              AND scope_type = 'site'
              AND scope_id = _site_id::TEXT
        )
        -- Or via brand
        OR EXISTS (
            SELECT 1 FROM public.sites s
            WHERE s.id = _site_id
              AND public.can_access_brand(_user_id, s.brand_id)
        )
        -- Or via region
        OR EXISTS (
            SELECT 1 FROM public.sites s
            JOIN public.user_memberships um ON um.user_id = _user_id
            WHERE s.id = _site_id
              AND um.scope_type = 'region'
              AND um.scope_id = s.region
        )
        -- Or is admin
        OR public.is_admin(_user_id)
$$;

-- =============================================================================
-- Drop old permissive policies
-- =============================================================================

DROP POLICY IF EXISTS "Holdings are viewable by everyone" ON public.holdings;
DROP POLICY IF EXISTS "Brands are viewable by everyone" ON public.brands;
DROP POLICY IF EXISTS "Sites are viewable by everyone" ON public.sites;

-- =============================================================================
-- New multi-tenant SELECT policies
-- =============================================================================

-- Holdings: Only visible if user has direct membership or is admin
CREATE POLICY "Holdings visible to members"
    ON public.holdings FOR SELECT
    TO authenticated
    USING (public.can_access_holding(auth.uid(), id));

-- Brands: Visible if user has direct membership or holding membership
CREATE POLICY "Brands visible to members"
    ON public.brands FOR SELECT
    TO authenticated
    USING (public.can_access_brand(auth.uid(), id));

-- Sites: Visible if user has direct, brand, holding, or region membership
CREATE POLICY "Sites visible to members"
    ON public.sites FOR SELECT
    TO authenticated
    USING (public.can_access_site(auth.uid(), id));

-- =============================================================================
-- INSERT/UPDATE/DELETE policies (admin only)
-- =============================================================================

-- Holdings: Only admins can modify
CREATE POLICY "Admins can manage holdings"
    ON public.holdings FOR ALL
    TO authenticated
    USING (public.is_admin(auth.uid()))
    WITH CHECK (public.is_admin(auth.uid()));

-- Brands: Only admins can modify
CREATE POLICY "Admins can manage brands"
    ON public.brands FOR ALL
    TO authenticated
    USING (public.is_admin(auth.uid()))
    WITH CHECK (public.is_admin(auth.uid()));

-- Sites: Only admins can modify
CREATE POLICY "Admins can manage sites"
    ON public.sites FOR ALL
    TO authenticated
    USING (public.is_admin(auth.uid()))
    WITH CHECK (public.is_admin(auth.uid()));

-- =============================================================================
-- Update devices and telemetry tables to respect site access
-- =============================================================================

-- Devices: Visible only if user can access the site
DROP POLICY IF EXISTS "Devices are viewable by everyone" ON public.devices;
CREATE POLICY "Devices visible to site members"
    ON public.devices FOR SELECT
    TO authenticated
    USING (public.can_access_site(auth.uid(), site_id));

CREATE POLICY "Admins can manage devices"
    ON public.devices FOR ALL
    TO authenticated
    USING (public.is_admin(auth.uid()))
    WITH CHECK (public.is_admin(auth.uid()));

-- Telemetry latest: Visible only via device's site access
DROP POLICY IF EXISTS "Telemetry latest viewable by everyone" ON public.telemetry_latest;
CREATE POLICY "Telemetry visible to site members"
    ON public.telemetry_latest FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.devices d
            WHERE d.id = telemetry_latest.device_id
              AND public.can_access_site(auth.uid(), d.site_id)
        )
    );

-- Site KPIs: Visible only if user can access the site
DROP POLICY IF EXISTS "Site KPIs viewable by everyone" ON public.site_kpis;
CREATE POLICY "Site KPIs visible to site members"
    ON public.site_kpis FOR SELECT
    TO authenticated
    USING (public.can_access_site(auth.uid(), site_id));

-- =============================================================================
-- Anonymous access (public dashboard fallback)
-- =============================================================================

-- Allow anonymous users to see limited data for demo purposes
-- This can be removed or restricted in production

CREATE POLICY "Anon can view holdings (demo)"
    ON public.holdings FOR SELECT
    TO anon
    USING (true);

CREATE POLICY "Anon can view brands (demo)"
    ON public.brands FOR SELECT
    TO anon
    USING (true);

CREATE POLICY "Anon can view sites (demo)"
    ON public.sites FOR SELECT
    TO anon
    USING (true);

-- =============================================================================
-- Grant execute permissions
-- =============================================================================

GRANT EXECUTE ON FUNCTION public.can_access_holding TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_brand TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_site TO authenticated;

COMMENT ON FUNCTION public.can_access_holding IS 'Check if user has access to a holding';
COMMENT ON FUNCTION public.can_access_brand IS 'Check if user has access to a brand (directly or via holding)';
COMMENT ON FUNCTION public.can_access_site IS 'Check if user has access to a site (via site, brand, holding, or region membership)';
