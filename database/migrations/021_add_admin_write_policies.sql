-- Migration: Add admin write policies for holdings, brands, sites
-- Version: 021
-- Description: Allow authenticated admins to insert/update/delete hierarchy tables

-- =====================================================
-- HOLDINGS WRITE POLICIES
-- =====================================================

-- Drop existing restrictive policies if any
DROP POLICY IF EXISTS "Admin can manage holdings" ON holdings;

CREATE POLICY "Admin can manage holdings"
    ON holdings FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM user_roles
            WHERE user_id = auth.uid()
            AND role IN ('admin', 'superuser')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM user_roles
            WHERE user_id = auth.uid()
            AND role IN ('admin', 'superuser')
        )
    );

-- Service role full access
DROP POLICY IF EXISTS "Service role can manage holdings" ON holdings;
CREATE POLICY "Service role can manage holdings"
    ON holdings FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- =====================================================
-- BRANDS WRITE POLICIES
-- =====================================================

DROP POLICY IF EXISTS "Admin can manage brands" ON brands;

CREATE POLICY "Admin can manage brands"
    ON brands FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM user_roles
            WHERE user_id = auth.uid()
            AND role IN ('admin', 'superuser')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM user_roles
            WHERE user_id = auth.uid()
            AND role IN ('admin', 'superuser')
        )
    );

DROP POLICY IF EXISTS "Service role can manage brands" ON brands;
CREATE POLICY "Service role can manage brands"
    ON brands FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- =====================================================
-- SITES WRITE POLICIES
-- =====================================================

DROP POLICY IF EXISTS "Admin can manage sites" ON sites;

CREATE POLICY "Admin can manage sites"
    ON sites FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM user_roles
            WHERE user_id = auth.uid()
            AND role IN ('admin', 'superuser')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM user_roles
            WHERE user_id = auth.uid()
            AND role IN ('admin', 'superuser')
        )
    );

DROP POLICY IF EXISTS "Service role can manage sites" ON sites;
CREATE POLICY "Service role can manage sites"
    ON sites FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- =====================================================
-- DEVICES WRITE POLICIES FOR ADMIN
-- =====================================================

DROP POLICY IF EXISTS "Admin can manage devices" ON devices;

CREATE POLICY "Admin can manage devices"
    ON devices FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM user_roles
            WHERE user_id = auth.uid()
            AND role IN ('admin', 'superuser')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM user_roles
            WHERE user_id = auth.uid()
            AND role IN ('admin', 'superuser')
        )
    );

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON POLICY "Admin can manage holdings" ON holdings IS 'Allows admin/superuser to CRUD holdings';
COMMENT ON POLICY "Admin can manage brands" ON brands IS 'Allows admin/superuser to CRUD brands';
COMMENT ON POLICY "Admin can manage sites" ON sites IS 'Allows admin/superuser to CRUD sites';
COMMENT ON POLICY "Admin can manage devices" ON devices IS 'Allows admin/superuser to move devices between sites';
