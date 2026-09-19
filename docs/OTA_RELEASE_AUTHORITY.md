# CBE Management System — Supabase OTA Release Authority (Phase 3)

## Architectural Role

Phase 3 establishes **Supabase as the single authoritative source of truth** for OTA release metadata and bundle storage in the CBE Management System.

> **CRITICAL ARCHITECTURAL BOUNDARY:**  
> **Phase 3 does NOT automatically check for, download, stage, or activate OTA updates.**  
> Native plugin operations (`CapacitorUpdater.download()`, `CapacitorUpdater.next()`, `CapacitorUpdater.set()`, `CapacitorUpdater.reload()`) are strictly forbidden in this phase.  
> The application boot path, session update lock (`SessionUpdateLock`), marks entry, reports, and native APK versions remain completely unchanged.

---

## 1. Database Schema (`public.app_releases`)

The canonical release metadata table in Supabase:

| Column | Type | Constraints / Invariants | Purpose |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | Primary Key, default `gen_random_uuid()` | Immutable unique identifier for the release record |
| `bundle_version` | `TEXT` | `NOT NULL`, non-empty | Semantic version of the web asset bundle (e.g. `1.0.0`) |
| `channel` | `TEXT` | `NOT NULL DEFAULT 'production'`, `CHECK (channel IN ('production', 'staging'))` | Release channel isolation |
| `status` | `TEXT` | `NOT NULL DEFAULT 'DRAFT'`, `CHECK (status IN ('DRAFT', 'TESTING', 'PUBLISHED', 'DISABLED'))` | Release lifecycle status |
| `storage_bucket` | `TEXT` | `NOT NULL DEFAULT 'ota-releases'`, non-empty | Supabase Storage bucket hosting the bundle |
| `storage_path` | `TEXT` | `NOT NULL`, non-empty, ends in `.zip` | Relative path to the immutable archive within the bucket |
| `checksum_sha256` | `TEXT` | `NOT NULL`, `CHECK (checksum_sha256 ~ '^[0-9a-f]{64}$')` | Exact 64-character lowercase hex SHA-256 of the ZIP |
| `bundle_size_bytes`| `BIGINT`| `NOT NULL`, `CHECK (bundle_size_bytes > 0)` | Exact byte size of the bundle ZIP file |
| `min_native_version_code` | `INTEGER` | `NOT NULL DEFAULT 1`, `CHECK (min_native_version_code >= 1)` | Minimum Android `versionCode` required to run this bundle |
| `max_native_version_code` | `INTEGER` | `CHECK (max_native_version_code IS NULL OR max_native_version_code >= min_native_version_code)` | Optional maximum Android `versionCode` supported |
| `is_mandatory` | `BOOLEAN` | `NOT NULL DEFAULT false` | Flag indicating if this release must be accepted |
| `release_notes` | `TEXT` | Nullable | Human-readable changelog / release description |
| `published_at` | `TIMESTAMPTZ`| Required when `status = 'PUBLISHED'` | Exact UTC timestamp of publication |
| `created_by` | `UUID` | Nullable | User ID of the administrator who created the release |
| `created_at` | `TIMESTAMPTZ`| `DEFAULT timezone('utc', now()) NOT NULL` | Creation timestamp |
| `updated_at` | `TIMESTAMPTZ`| `DEFAULT timezone('utc', now()) NOT NULL` | Last update timestamp (auto-updated by trigger) |

### Table Invariants & Constraints

1. **Uniqueness per Channel**: `CONSTRAINT app_releases_channel_version_unique UNIQUE (channel, bundle_version)`  
   Ensures that only one release definition can exist for a given version on a channel.
2. **Publication Invariant**:  
   `CONSTRAINT check_published_metadata CHECK (status != 'PUBLISHED' OR (published_at IS NOT NULL AND length(trim(checksum_sha256)) = 64 AND bundle_size_bytes > 0 AND length(trim(storage_path)) > 0))`  
   A release can never enter `PUBLISHED` status unless a publication timestamp and valid artifact metadata are supplied.
3. **Indexes**:
   - `idx_app_releases_channel_status ON (channel, status)` for high-performance discovery queries.
   - `idx_app_releases_bundle_version ON (bundle_version)` for version lookups.
   - `idx_app_releases_created_at ON (created_at DESC)` for chronological listing.

---

## 2. Release Lifecycle States

```text
[ DRAFT ] ────────► [ TESTING ] ────────► [ PUBLISHED ] ────────► [ DISABLED ]
(Artifact created)   (Internal QA)         (Authoritative active)   (Rollback/Revoked)
```

- **`DRAFT`**: Release metadata is registered; artifact is being generated, uploaded, or verified. Ineligible for client discovery.
- **`TESTING`**: Release is available only for explicit staging QA validation on the `staging` channel.
- **`PUBLISHED`**: Authoritatively published. Represents the active, discoverable release for compatible clients.
- **`DISABLED`**: Revoked or rolled-back release. The record remains intact in Supabase for cryptographic provenance and audit trails, but clients will never discover or apply it.

---

## 3. Supabase Storage Architecture

### Private Bucket: `ota-releases`

- **Privacy**: `public = false`. Public anonymous access is completely disabled.
- **Object Naming Convention**:
  ```text
  ota/<channel>/<bundle_version>/bundle.zip
  ```
  Example: `ota/production/1.0.0/bundle.zip`
- **Immutability Principle**: A bundle at a specific version path is **never overwritten**. If fixes are required, a new `bundle_version` (e.g. `1.0.1`) must be generated and published.
- **Retrieval**: Authorized clients retrieve artifacts using authenticated Supabase Storage requests or short-lived signed URLs (`createSignedUrl`). Arbitrary external download URLs are rejected.

---

## 4. Security & Row Level Security (RLS)

### Client Security Boundary

- **Service-Role Key Isolation**: The `SUPABASE_SERVICE_ROLE_KEY` is **never** sent or bundled into the browser or mobile client. All client operations use the standard public anonymous or authenticated client.
- **Anonymous Access**: All permissions (`SELECT`, `INSERT`, `UPDATE`, `DELETE`) on `public.app_releases` are explicitly **REVOKED** from `PUBLIC` and `anon`.
- **Authenticated Access**: Authenticated school users (`class_teacher`, `subject_teacher`, `learner`, `admin`) are granted read access (`FOR SELECT TO authenticated USING (true)`).
- **Administrative Write Access**: Only confirmed administrators (`public.is_admin()`) or server-side automated release pipelines (`service_role`) can insert, update, publish, or disable releases:
  ```sql
  CREATE POLICY "Admin write app_releases" ON public.app_releases
    FOR ALL TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());
  ```
- **Storage Object Security**:
  - `storage.objects` for bucket `ota-releases` permits `SELECT` to `authenticated` users only.
  - Upload, replace, and delete operations require `public.is_admin()`.

---

## 5. Phase 2 Artifact Verification Against Phase 3 Schema

The real package produced by the Phase 2 builder was verified against the Phase 3 schema:

- **Artifact File**: `dist-ota/bundle.zip`
- **File Size**: `1236296` bytes
- **SHA-256 Checksum**: `d20ce1fa8fead7654c485a22c99d4744c5a50c76c7bcaa41fcf0bd42714663a7`
- **Bundle Version**: `1.0.0`
- **Target Storage Path**: `ota/production/1.0.0/bundle.zip`
- **Minimum Native Code**: `1` (matches Android `versionCode` 1)
- **Validation**:
  - Checksum matches exact 64-char lowercase hex regex.
  - Byte size is positive and finite.
  - Deterministic storage path matches `ota/<channel>/<version>/bundle.zip`.
  - Stored in private bucket `ota-releases`.
