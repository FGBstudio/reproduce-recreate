

# Migrate `level` → `cert_level` in Certifications Frontend

## Context
The `certifications` DB table has both `level` and `cert_level` columns. The data is stored in `cert_level` (as shown in the screenshot), but all frontend code reads from `level`. We need to switch every reference to use `cert_level`.

## Files to Update

### 1. `src/integrations/supabase/types.ts`
- Add `cert_level: string | null` to the certifications Row, Insert, and Update types (the `level` field can remain for backward compat or be removed)

### 2. `src/hooks/useCertifications.ts`
- Rename `level` → `cert_level` in the `Certification` interface

### 3. `src/components/dashboard/LEEDCertificationWidget.tsx`
- Change `leedCert?.level` → `leedCert?.cert_level`

### 4. `src/components/admin/CertificationsDialog.tsx`
- Read from `cert.cert_level` instead of `cert.level`
- Write to `cert_level` instead of `level` in insert/update payloads

### 5. `src/components/admin/LEEDCertificationsDialog.tsx`
- Read from `cert.cert_level` instead of `cert.level`
- Write to `cert_level` instead of `level` in the certPayload object

### 6. `src/components/dashboard/ProjectDetail.tsx`
- Change `leedCert?.level` and `wellCert?.level` and `cert?.level` → `?.cert_level`

## Not Changed
- `OverviewSection.tsx` — its `.level` refers to a status object, not certifications. No change needed.
- The `projects` table already uses `cert_level` correctly.

