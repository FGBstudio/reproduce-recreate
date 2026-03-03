
-- Add module_bill_analysis_enabled to sites table
ALTER TABLE sites ADD COLUMN IF NOT EXISTS module_bill_analysis_enabled BOOLEAN DEFAULT false;

-- Create bills table (site-scoped)
CREATE TABLE IF NOT EXISTS public.bills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    company_name TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'analyzing', 'completed', 'error')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create bill_data table (extracted data from AI analysis)
CREATE TABLE IF NOT EXISTS public.bill_data (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bill_id UUID NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
    billing_period_start DATE,
    billing_period_end DATE,
    energy_consumption_kwh NUMERIC,
    energy_cost_per_kwh NUMERIC,
    total_energy_cost NUMERIC,
    peak_power_kw NUMERIC,
    off_peak_consumption_kwh NUMERIC,
    peak_consumption_kwh NUMERIC,
    reactive_energy_kvarh NUMERIC,
    power_factor NUMERIC,
    fixed_charges NUMERIC,
    taxes NUMERIC,
    total_amount NUMERIC,
    currency TEXT DEFAULT 'EUR',
    additional_data JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_bills_site_id ON bills(site_id);
CREATE INDEX idx_bills_status ON bills(status);
CREATE INDEX idx_bill_data_bill_id ON bill_data(bill_id);

-- Updated_at trigger for bills
CREATE TRIGGER update_bills_updated_at
    BEFORE UPDATE ON bills
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE bill_data ENABLE ROW LEVEL SECURITY;

-- Bills RLS policies
CREATE POLICY "Bills viewable by authenticated users"
    ON bills FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Admins can manage bills"
    ON bills FOR ALL
    TO authenticated
    USING (is_admin(auth.uid()))
    WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Authenticated users can insert bills"
    ON bills FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = uploaded_by);

CREATE POLICY "Users can delete own bills"
    ON bills FOR DELETE
    TO authenticated
    USING (auth.uid() = uploaded_by OR is_admin(auth.uid()));

CREATE POLICY "Service role can manage bills"
    ON bills FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Bill data RLS policies
CREATE POLICY "Bill data viewable by authenticated users"
    ON bill_data FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Service role can manage bill data"
    ON bill_data FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Create storage bucket for bills
INSERT INTO storage.buckets (id, name, public, file_size_limit) 
VALUES ('bills', 'bills', false, 10485760)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for bills bucket
CREATE POLICY "Authenticated users can upload bills"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (bucket_id = 'bills');

CREATE POLICY "Authenticated users can view bills"
    ON storage.objects FOR SELECT
    TO authenticated
    USING (bucket_id = 'bills');

CREATE POLICY "Users can delete own bill files"
    ON storage.objects FOR DELETE
    TO authenticated
    USING (bucket_id = 'bills');

CREATE POLICY "Service role full access to bills bucket"
    ON storage.objects FOR ALL
    TO service_role
    USING (bucket_id = 'bills')
    WITH CHECK (bucket_id = 'bills');
