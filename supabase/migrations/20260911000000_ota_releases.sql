-- ==============================================================================
-- Migration: 20260911000000_ota_releases.sql
-- Description: Phase 3 — Supabase OTA Release Authority & Storage Foundation
-- CBE Management System
-- ==============================================================================

-- 1. Create app_releases table
CREATE TABLE IF NOT EXISTS public.app_releases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bundle_version TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'production' CHECK (channel IN ('production', 'staging')),
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'TESTING', 'PUBLISHED', 'DISABLED')),
  storage_bucket TEXT NOT NULL DEFAULT 'ota-releases' CHECK (length(trim(storage_bucket)) > 0),
  storage_path TEXT NOT NULL CHECK (length(trim(storage_path)) > 0),
  checksum_sha256 TEXT NOT NULL CHECK (checksum_sha256 ~ '^[0-9a-f]{64}$'),
  bundle_size_bytes BIGINT NOT NULL CHECK (bundle_size_bytes > 0),
  min_native_version_code INTEGER NOT NULL DEFAULT 1 CHECK (min_native_version_code >= 1),
  max_native_version_code INTEGER CHECK (max_native_version_code IS NULL OR max_native_version_code >= min_native_version_code),
  is_mandatory BOOLEAN NOT NULL DEFAULT false,
  release_notes TEXT,
  published_at TIMESTAMP WITH TIME ZONE,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  CONSTRAINT check_bundle_version_nonempty CHECK (length(trim(bundle_version)) > 0),
  CONSTRAINT app_releases_channel_version_unique UNIQUE (channel, bundle_version),
  CONSTRAINT check_published_metadata CHECK (
    status != 'PUBLISHED' OR (
      published_at IS NOT NULL AND
      length(trim(checksum_sha256)) = 64 AND
      bundle_size_bytes > 0 AND
      length(trim(storage_path)) > 0
    )
  )
);

-- 2. Performance & lookup indexes
CREATE INDEX IF NOT EXISTS idx_app_releases_channel_status ON public.app_releases(channel, status);
CREATE INDEX IF NOT EXISTS idx_app_releases_bundle_version ON public.app_releases(bundle_version);
CREATE INDEX IF NOT EXISTS idx_app_releases_created_at ON public.app_releases(created_at DESC);

-- 3. Automatic timestamp trigger
CREATE OR REPLACE FUNCTION public.set_app_releases_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_app_releases_updated_at ON public.app_releases;
CREATE TRIGGER trg_app_releases_updated_at
  BEFORE UPDATE ON public.app_releases
  FOR EACH ROW
  EXECUTE FUNCTION public.set_app_releases_updated_at();

-- 4. Enable Row Level Security
ALTER TABLE public.app_releases ENABLE ROW LEVEL SECURITY;

-- 5. Revoke public/anonymous access
REVOKE ALL ON public.app_releases FROM PUBLIC, anon;

-- 6. Grant SELECT to authenticated, ALL to service_role
GRANT SELECT ON public.app_releases TO authenticated;
GRANT ALL ON public.app_releases TO service_role;

-- 7. RLS Policies on app_releases
DROP POLICY IF EXISTS "Authenticated read app_releases" ON public.app_releases;
CREATE POLICY "Authenticated read app_releases" ON public.app_releases
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Admin write app_releases" ON public.app_releases;
CREATE POLICY "Admin write app_releases" ON public.app_releases
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- 8. Storage bucket definition (ota-releases)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'ota-releases',
  'ota-releases',
  false,
  104857600,
  ARRAY['application/zip', 'application/x-zip-compressed', 'application/octet-stream']
)
ON CONFLICT (id) DO UPDATE SET
  public = false;

-- 9. Storage object RLS policies
DROP POLICY IF EXISTS "Authenticated read ota-releases" ON storage.objects;
CREATE POLICY "Authenticated read ota-releases" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'ota-releases');

DROP POLICY IF EXISTS "Admin write ota-releases" ON storage.objects;
CREATE POLICY "Admin write ota-releases" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'ota-releases' AND public.is_admin())
  WITH CHECK (bucket_id = 'ota-releases' AND public.is_admin());

-- 10. Notify PostgREST to refresh schema cache
NOTIFY pgrst, 'reload schema';
