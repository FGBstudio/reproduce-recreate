-- Migration: Create profiles and user_roles tables for authentication
-- Version: 016
-- Description: User profiles with Supabase Auth integration and role-based access control

-- =============================================================================
-- App Role Enum
-- =============================================================================

CREATE TYPE public.app_role AS ENUM ('viewer', 'editor', 'admin', 'superuser');

-- =============================================================================
-- Profiles Table (extends auth.users)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    first_name TEXT,
    last_name TEXT,
    display_name TEXT,
    avatar_url TEXT,
    company TEXT,
    job_title TEXT,
    phone TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_profiles_email ON public.profiles(email);
CREATE INDEX idx_profiles_company ON public.profiles(company);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Trigger for updated_at
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- User Roles Table (separate from profiles for security)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL DEFAULT 'viewer',
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (user_id, role)
);

-- Index for fast role lookups
CREATE INDEX idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX idx_user_roles_role ON public.user_roles(role);

-- Enable RLS
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- User Memberships Table (hierarchical access control)
-- =============================================================================

CREATE TYPE public.scope_type AS ENUM ('project', 'site', 'brand', 'holding', 'region');
CREATE TYPE public.permission_level AS ENUM ('view', 'edit', 'admin');

CREATE TABLE IF NOT EXISTS public.user_memberships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    scope_type scope_type NOT NULL,
    scope_id TEXT NOT NULL,  -- UUID or region code (EU, AMER, etc.)
    permission permission_level NOT NULL DEFAULT 'view',
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (user_id, scope_type, scope_id)
);

-- Indexes
CREATE INDEX idx_user_memberships_user ON public.user_memberships(user_id);
CREATE INDEX idx_user_memberships_scope ON public.user_memberships(scope_type, scope_id);

-- Enable RLS
ALTER TABLE public.user_memberships ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- Security Definer Functions (avoid RLS recursion)
-- =============================================================================

-- Check if user has a specific role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.user_roles
        WHERE user_id = _user_id
          AND role = _role
    )
$$;

-- Check if user has admin or superuser role
CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.user_roles
        WHERE user_id = _user_id
          AND role IN ('admin', 'superuser')
    )
$$;

-- Get user's highest role
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT role
    FROM public.user_roles
    WHERE user_id = _user_id
    ORDER BY 
        CASE role 
            WHEN 'superuser' THEN 1 
            WHEN 'admin' THEN 2 
            WHEN 'editor' THEN 3 
            WHEN 'viewer' THEN 4 
        END
    LIMIT 1
$$;

-- Check if user has access to a specific scope
CREATE OR REPLACE FUNCTION public.has_scope_access(
    _user_id UUID, 
    _scope_type scope_type, 
    _scope_id TEXT,
    _required_permission permission_level DEFAULT 'view'
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.user_memberships
        WHERE user_id = _user_id
          AND scope_type = _scope_type
          AND scope_id = _scope_id
          AND (
              permission = _required_permission
              OR permission = 'admin'
              OR (permission = 'edit' AND _required_permission = 'view')
          )
    )
    OR public.is_admin(_user_id)  -- Admins have access to everything
$$;

-- =============================================================================
-- RLS Policies
-- =============================================================================

-- Profiles: Users can read their own profile
CREATE POLICY "Users can view own profile"
    ON public.profiles FOR SELECT
    USING (auth.uid() = id);

-- Profiles: Users can update their own profile
CREATE POLICY "Users can update own profile"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id);

-- Profiles: Admins can view all profiles
CREATE POLICY "Admins can view all profiles"
    ON public.profiles FOR SELECT
    USING (public.is_admin(auth.uid()));

-- User Roles: Only admins can manage roles
CREATE POLICY "Admins can manage user roles"
    ON public.user_roles FOR ALL
    USING (public.is_admin(auth.uid()));

-- User Roles: Users can view their own roles
CREATE POLICY "Users can view own roles"
    ON public.user_roles FOR SELECT
    USING (auth.uid() = user_id);

-- User Memberships: Users can view their own memberships
CREATE POLICY "Users can view own memberships"
    ON public.user_memberships FOR SELECT
    USING (auth.uid() = user_id);

-- User Memberships: Admins can manage all memberships
CREATE POLICY "Admins can manage memberships"
    ON public.user_memberships FOR ALL
    USING (public.is_admin(auth.uid()));

-- =============================================================================
-- Trigger: Auto-create profile on user signup
-- =============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Create profile
    INSERT INTO public.profiles (id, email, display_name)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1))
    );
    
    -- Assign default viewer role
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'viewer');
    
    RETURN NEW;
END;
$$;

-- Create trigger on auth.users
CREATE OR REPLACE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =============================================================================
-- Grant permissions
-- =============================================================================

GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT ON public.profiles TO anon, authenticated;
GRANT UPDATE ON public.profiles TO authenticated;
GRANT SELECT ON public.user_roles TO authenticated;
GRANT SELECT ON public.user_memberships TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_role TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_scope_access TO anon, authenticated;

COMMENT ON TABLE public.profiles IS 'User profiles extending Supabase auth.users';
COMMENT ON TABLE public.user_roles IS 'User roles for RBAC - separate table for security';
COMMENT ON TABLE public.user_memberships IS 'Hierarchical access control for holdings/brands/sites/projects';
COMMENT ON FUNCTION public.has_role IS 'Check if user has a specific role';
COMMENT ON FUNCTION public.is_admin IS 'Check if user has admin or superuser role';
COMMENT ON FUNCTION public.has_scope_access IS 'Check if user has access to a specific scope';
