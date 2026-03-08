
-- Access Requests table for registration workflow
CREATE TABLE IF NOT EXISTS public.access_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    company TEXT NOT NULL,
    job_title TEXT,
    message TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    reviewed_by UUID REFERENCES auth.users(id),
    reviewed_at TIMESTAMPTZ,
    review_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_access_requests_email ON public.access_requests(email);
CREATE INDEX idx_access_requests_status ON public.access_requests(status);

-- Enable RLS
ALTER TABLE public.access_requests ENABLE ROW LEVEL SECURITY;

-- Anyone can insert a request (anon)
CREATE POLICY "Anyone can submit access request"
    ON public.access_requests FOR INSERT
    TO anon, authenticated
    WITH CHECK (true);

-- Only admins can view all requests
CREATE POLICY "Admins can view all requests"
    ON public.access_requests FOR SELECT
    USING (public.is_admin(auth.uid()));

-- Only admins can update requests (approve/reject)
CREATE POLICY "Admins can update requests"
    ON public.access_requests FOR UPDATE
    USING (public.is_admin(auth.uid()));

-- Trigger for updated_at
CREATE TRIGGER update_access_requests_updated_at
    BEFORE UPDATE ON public.access_requests
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE public.access_requests IS 'Pending access requests from users wanting to join the platform';
