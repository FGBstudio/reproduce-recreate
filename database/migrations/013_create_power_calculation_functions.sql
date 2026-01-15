-- Migration: Create power calculation functions
-- Version: 013
-- Description: DB-side power calculation with WYE/DELTA logic

-- Placeholder value detection (e.g., -555555)
CREATE OR REPLACE FUNCTION is_valid_measurement(val DOUBLE PRECISION)
RETURNS BOOLEAN AS $$
BEGIN
    IF val IS NULL THEN RETURN FALSE; END IF;
    IF val < -100000 OR val > 100000000 THEN RETURN FALSE; END IF;  -- Placeholder detection
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Get panel config for a device/site with fallbacks
CREATE OR REPLACE FUNCTION get_panel_config(
    p_device_id UUID,
    p_site_id UUID
) RETURNS TABLE (
    wiring_type TEXT,
    pf_default DOUBLE PRECISION,
    vln_default DOUBLE PRECISION,
    vll_default DOUBLE PRECISION,
    use_measured_voltage BOOLEAN,
    use_measured_pf BOOLEAN
) AS $$
BEGIN
    -- Try device-specific config first, then site default
    RETURN QUERY
    SELECT 
        pc.wiring_type::TEXT,
        COALESCE(pc.pf_default, 0.95),
        COALESCE(pc.vln_default, 230.0),
        COALESCE(pc.vll_default, 400.0),
        COALESCE(pc.use_measured_voltage, TRUE),
        COALESCE(pc.use_measured_pf, TRUE)
    FROM panel_config pc
    WHERE (pc.device_id = p_device_id OR (pc.device_id IS NULL AND pc.site_id = p_site_id))
    ORDER BY pc.device_id NULLS LAST  -- Device-specific first
    LIMIT 1;
    
    -- Return defaults if no config found
    IF NOT FOUND THEN
        RETURN QUERY SELECT 'WYE'::TEXT, 0.95::DOUBLE PRECISION, 230.0::DOUBLE PRECISION, 
                            400.0::DOUBLE PRECISION, TRUE::BOOLEAN, TRUE::BOOLEAN;
    END IF;
END;
$$ LANGUAGE plpgsql STABLE;

-- Calculate three-phase power from I/V measurements
-- Implements WYE sum: P = Σ(PF_i × I_i × V_i) for each phase
CREATE OR REPLACE FUNCTION compute_power_w(
    p_i1 DOUBLE PRECISION,
    p_i2 DOUBLE PRECISION,
    p_i3 DOUBLE PRECISION,
    p_v1 DOUBLE PRECISION,
    p_v2 DOUBLE PRECISION,
    p_v3 DOUBLE PRECISION,
    p_pf1 DOUBLE PRECISION DEFAULT NULL,
    p_pf2 DOUBLE PRECISION DEFAULT NULL,
    p_pf3 DOUBLE PRECISION DEFAULT NULL,
    p_wiring_type TEXT DEFAULT 'WYE',
    p_pf_default DOUBLE PRECISION DEFAULT 0.95,
    p_vln_default DOUBLE PRECISION DEFAULT 230.0,
    p_vll_default DOUBLE PRECISION DEFAULT 400.0
) RETURNS TABLE (
    power_w DOUBLE PRECISION,
    power_source TEXT,          -- 'measured' | 'partial_default' | 'full_default'
    calc_method TEXT            -- 'WYE_SUM' | 'DELTA'
) AS $$
DECLARE
    v_i1 DOUBLE PRECISION;
    v_i2 DOUBLE PRECISION;
    v_i3 DOUBLE PRECISION;
    v_v1 DOUBLE PRECISION;
    v_v2 DOUBLE PRECISION;
    v_v3 DOUBLE PRECISION;
    v_pf1 DOUBLE PRECISION;
    v_pf2 DOUBLE PRECISION;
    v_pf3 DOUBLE PRECISION;
    v_power DOUBLE PRECISION := 0;
    v_source TEXT := 'measured';
    v_method TEXT;
    v_phases_with_default INT := 0;
BEGIN
    -- Validate and clean current values
    v_i1 := CASE WHEN is_valid_measurement(p_i1) THEN p_i1 ELSE NULL END;
    v_i2 := CASE WHEN is_valid_measurement(p_i2) THEN p_i2 ELSE NULL END;
    v_i3 := CASE WHEN is_valid_measurement(p_i3) THEN p_i3 ELSE NULL END;
    
    -- If no valid currents, cannot calculate power
    IF v_i1 IS NULL AND v_i2 IS NULL AND v_i3 IS NULL THEN
        RETURN QUERY SELECT NULL::DOUBLE PRECISION, 'no_current'::TEXT, NULL::TEXT;
        RETURN;
    END IF;
    
    -- Apply voltage defaults where needed
    IF is_valid_measurement(p_v1) THEN v_v1 := p_v1; ELSE v_v1 := p_vln_default; v_phases_with_default := v_phases_with_default + 1; END IF;
    IF is_valid_measurement(p_v2) THEN v_v2 := p_v2; ELSE v_v2 := p_vln_default; v_phases_with_default := v_phases_with_default + 1; END IF;
    IF is_valid_measurement(p_v3) THEN v_v3 := p_v3; ELSE v_v3 := p_vln_default; v_phases_with_default := v_phases_with_default + 1; END IF;
    
    -- Apply power factor defaults where needed
    v_pf1 := COALESCE(p_pf1, p_pf_default);
    v_pf2 := COALESCE(p_pf2, p_pf_default);
    v_pf3 := COALESCE(p_pf3, p_pf_default);
    
    -- Determine source quality
    IF v_phases_with_default > 0 OR p_pf1 IS NULL OR p_pf2 IS NULL OR p_pf3 IS NULL THEN
        IF v_phases_with_default = 3 AND p_pf1 IS NULL AND p_pf2 IS NULL AND p_pf3 IS NULL THEN
            v_source := 'full_default';
        ELSE
            v_source := 'partial_default';
        END IF;
    END IF;
    
    -- Calculate power based on wiring type
    -- For both WYE and DELTA, we calculate as sum per phase (Panoramic style)
    -- DELTA: Could use P = √3 × V_LL × I × PF, but we prefer phase-sum for consistency
    v_method := 'WYE_SUM';
    
    -- Sum power for each phase where current is available
    IF v_i1 IS NOT NULL THEN
        v_power := v_power + (v_pf1 * v_i1 * v_v1);
    END IF;
    IF v_i2 IS NOT NULL THEN
        v_power := v_power + (v_pf2 * v_i2 * v_v2);
    END IF;
    IF v_i3 IS NOT NULL THEN
        v_power := v_power + (v_pf3 * v_i3 * v_v3);
    END IF;
    
    RETURN QUERY SELECT v_power, v_source, v_method;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Single-phase power calculation (for PAN12 etc.)
CREATE OR REPLACE FUNCTION compute_power_w_single(
    p_current_a DOUBLE PRECISION,
    p_voltage_v DOUBLE PRECISION DEFAULT NULL,
    p_pf DOUBLE PRECISION DEFAULT NULL,
    p_vln_default DOUBLE PRECISION DEFAULT 230.0,
    p_pf_default DOUBLE PRECISION DEFAULT 0.95
) RETURNS TABLE (
    power_w DOUBLE PRECISION,
    power_source TEXT
) AS $$
DECLARE
    v_voltage DOUBLE PRECISION;
    v_pf DOUBLE PRECISION;
    v_source TEXT := 'measured';
BEGIN
    IF NOT is_valid_measurement(p_current_a) THEN
        RETURN QUERY SELECT NULL::DOUBLE PRECISION, 'no_current'::TEXT;
        RETURN;
    END IF;
    
    IF is_valid_measurement(p_voltage_v) THEN
        v_voltage := p_voltage_v;
    ELSE
        v_voltage := p_vln_default;
        v_source := 'voltage_default';
    END IF;
    
    v_pf := COALESCE(p_pf, p_pf_default);
    IF p_pf IS NULL THEN
        v_source := CASE WHEN v_source = 'measured' THEN 'pf_default' ELSE 'full_default' END;
    END IF;
    
    RETURN QUERY SELECT (v_pf * p_current_a * v_voltage), v_source;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION is_valid_measurement TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_panel_config TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION compute_power_w TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION compute_power_w_single TO anon, authenticated, service_role;

COMMENT ON FUNCTION compute_power_w IS 'Calculate 3-phase power (W) with WYE sum method and default fallbacks';
COMMENT ON FUNCTION compute_power_w_single IS 'Calculate single-phase power (W) with default fallbacks';
