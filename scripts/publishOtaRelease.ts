import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { createClient } from '@supabase/supabase-js';
import { createOtaBundle } from './buildOtaBundle';

/**
 * CBE Management System — OTA Release Publisher (Phase 7)
 *
 * Automates the build, validation, and safe publication of verified OTA bundles
 * directly to the Supabase release authority and secure bucket.
 */

// Colors for logging
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';

/**
 * Checks for native changes by running git diff.
 */
export function checkForNativeChanges(): { hasChanges: boolean; files: string[] } {
  try {
    // Verify git is inside a work tree
    execSync('git rev-parse --is-inside-work-tree', { stdio: 'ignore' });

    // Determine base branch / commit to compare against
    const baseCommit = process.env.GITHUB_BASE_REF || 'origin/main';
    console.log(`[OTA Publisher] Running Git comparison against baseline: ${baseCommit}`);

    // Fetch changes to ensure origin/main exists in CI
    try {
      execSync('git fetch --depth=1 origin main', { stdio: 'ignore' });
    } catch {
      // Ignored if remote/branch not reachable or already up to date
    }

    const output = execSync(`git diff --name-only ${baseCommit}...HEAD`, { encoding: 'utf8' });
    const changedFiles = output.split('\n').map((f) => f.trim()).filter(Boolean);

    const nativeFiles = changedFiles.filter((file) => {
      if (file.startsWith('android/') || file.startsWith('ios/')) {
        return true;
      }
      if (file === 'capacitor.config.ts' || file === 'capacitor.config.json') {
        return true;
      }
      if (file === 'package.json') {
        // Inspect if package.json has Capacitor/native dependency changes
        return didCapacitorDependenciesChange(baseCommit);
      }
      return false;
    });

    return {
      hasChanges: nativeFiles.length > 0,
      files: nativeFiles,
    };
  } catch (err: any) {
    console.warn(`[OTA Publisher] Warning: Git comparison skipped or failed (${err?.message || err}). Assuming no native changes.`);
    return { hasChanges: false, files: [] };
  }
}

/**
 * Parses package.json changes to see if native/Capacitor dependencies changed.
 */
function didCapacitorDependenciesChange(baseCommit: string): boolean {
  try {
    const oldPackageJsonStr = execSync(`git show ${baseCommit}:package.json`, { encoding: 'utf8' });
    const oldPackage = JSON.parse(oldPackageJsonStr);
    const newPackage = JSON.parse(fs.readFileSync('package.json', 'utf8'));

    const oldDeps = { ...oldPackage.dependencies, ...oldPackage.devDependencies };
    const newDeps = { ...newPackage.dependencies, ...newPackage.devDependencies };

    const allKeys = Array.from(new Set([...Object.keys(oldDeps), ...Object.keys(newDeps)]));
    for (const key of allKeys) {
      if (key.includes('capacitor') || key === 'typescript') {
        if (oldDeps[key] !== newDeps[key]) {
          return true;
        }
      }
    }
  } catch {
    // Fallback to assuming changed if parsing or git show fails
    return true;
  }
  return false;
}

/**
 * Main publication runner.
 */
export async function runPublisher(): Promise<void> {
  console.log(`\n=== CBE Management System — Phase 7 OTA Release Publisher ===\n`);

  // 1. Resolve environment settings and validate secrets
  const supabaseUrl = process.env.SUPABASE_URL || '';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  const version = process.env.OTA_BUNDLE_VERSION || '';
  const channel = (process.env.OTA_RELEASE_CHANNEL || 'staging') as 'staging' | 'production';
  const status = (process.env.OTA_RELEASE_STATUS || 'PUBLISHED') as 'DRAFT' | 'TESTING' | 'PUBLISHED' | 'DISABLED';
  const minNativeCode = parseInt(process.env.MIN_NATIVE_VERSION_CODE || '1', 10);
  const maxNativeCode = process.env.MAX_NATIVE_VERSION_CODE ? parseInt(process.env.MAX_NATIVE_VERSION_CODE, 10) : null;
  const isMandatory = process.env.IS_MANDATORY === 'true';
  const releaseNotes = process.env.RELEASE_NOTES || `OTA release ${version} via Phase 7 publishing pipeline`;
  const forcePublish = process.env.FORCE_OTA_PUBLISH === 'true';

  if (!supabaseUrl) {
    console.error(`${RED}✖ Error: Missing required environment variable "SUPABASE_URL"${RESET}`);
    process.exit(1);
  }
  if (!serviceRoleKey) {
    console.error(`${RED}✖ Error: Missing required environment variable "SUPABASE_SERVICE_ROLE_KEY"${RESET}`);
    process.exit(1);
  }
  if (!version) {
    console.error(`${RED}✖ Error: Missing required environment variable "OTA_BUNDLE_VERSION"${RESET}`);
    process.exit(1);
  }

  // Validate version format
  if (!/^[a-zA-Z0-9]+([.-][a-zA-Z0-9]+)*$/.test(version)) {
    console.error(`${RED}✖ Error: Invalid version format: "${version}". Version must be alphanumeric/semver (e.g. "1.0.0")${RESET}`);
    process.exit(1);
  }

  console.log(`Target Version : ${version}`);
  console.log(`Target Channel : ${channel}`);
  console.log(`Release Status : ${status}`);
  console.log(`Min Native     : ${minNativeCode}`);
  console.log(`Max Native     : ${maxNativeCode ?? 'No limit'}`);
  console.log(`Mandatory      : ${isMandatory}`);
  console.log(`Release Notes  : ${releaseNotes}\n`);

  // 2. Native vs OTA Safety Gate Check
  console.log(`[OTA Publisher] Performing Native vs OTA Safety Gate Check...`);
  const nativeGate = checkForNativeChanges();
  if (nativeGate.hasChanges) {
    console.error(`${RED}✖ SAFETY GATE BLOCK: Native-incompatible changes detected!${RESET}`);
    console.error(`${RED}  Modified native files:${RESET}`);
    nativeGate.files.forEach((f) => console.error(`  - ${f}`));
    console.error(`${RED}  OTA release publishing is blocked to prevent crashing installed app containers.${RESET}`);

    if (forcePublish) {
      console.warn(`${YELLOW}⚠️ WARNING: FORCE_OTA_PUBLISH is enabled. Bypassing safety gate blocker!${RESET}`);
    } else {
      process.exit(1);
    }
  } else {
    console.log(`${GREEN}✔ Safety Gate Passed: No native-incompatible changes detected.${RESET}`);
  }

  // 3. Initialize Supabase client
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  // 4. Pre-check: Check if this version already exists in the requested channel
  console.log(`[OTA Publisher] Checking for pre-existing release record...`);
  const { data: existing, error: checkErr } = await supabase
    .from('app_releases')
    .select('id, status')
    .eq('channel', channel)
    .eq('bundle_version', version)
    .maybeSingle();

  if (checkErr) {
    console.error(`${RED}✖ Error querying database: ${checkErr.message}${RESET}`);
    process.exit(1);
  }

  if (existing) {
    console.error(`${RED}✖ Error: A release for version "${version}" on channel "${channel}" already exists (ID: ${existing.id}).${RESET}`);
    console.error(`${RED}  Overwriting existing published releases is strictly forbidden to protect clients.${RESET}`);
    process.exit(1);
  }
  console.log(`${GREEN}✔ No duplicate release record found.${RESET}`);

  // 5. Build and validate OTA bundle using Phase 2 tooling
  console.log(`[OTA Publisher] Building OTA bundle via buildOtaBundle script...`);
  let bundleResult;
  try {
    bundleResult = await createOtaBundle({
      bundleVersion: version,
      outDir: 'dist-ota',
    });
  } catch (err: any) {
    console.error(`${RED}✖ OTA Build failed: ${err?.message || err}${RESET}`);
    process.exit(1);
  }

  const { zipPath, metadata } = bundleResult;
  console.log(`${GREEN}✔ Bundle built successfully at: ${zipPath}${RESET}`);
  console.log(`  File size    : ${(metadata.bundleSizeBytes / 1024).toFixed(2)} KB`);
  console.log(`  Checksum     : ${metadata.checksumSha256}`);
  console.log(`  File count   : ${metadata.fileCount}\n`);

  // 6. Upload bundle package to private storage bucket
  const storagePath = `ota/${channel}/${version}/bundle.zip`;
  console.log(`[OTA Publisher] Uploading bundle to storage bucket "ota-releases" at path: "${storagePath}"...`);
  const fileBuffer = fs.readFileSync(zipPath);

  const { error: uploadErr } = await supabase.storage
    .from('ota-releases')
    .upload(storagePath, fileBuffer, {
      contentType: 'application/zip',
      upsert: true,
    });

  if (uploadErr) {
    console.error(`${RED}✖ Upload failed: ${uploadErr.message}${RESET}`);
    process.exit(1);
  }
  console.log(`${GREEN}✔ Storage upload completed successfully.${RESET}`);

  // 7. Insert metadata record into Supabase app_releases table
  console.log(`[OTA Publisher] Registering release metadata in Supabase...`);
  const payload = {
    bundle_version: version,
    channel,
    status,
    storage_bucket: 'ota-releases',
    storage_path: storagePath,
    checksum_sha256: metadata.checksumSha256,
    bundle_size_bytes: metadata.bundleSizeBytes,
    min_native_version_code: minNativeCode,
    max_native_version_code: maxNativeCode,
    is_mandatory: isMandatory,
    release_notes: releaseNotes,
    published_at: status === 'PUBLISHED' ? new Date().toISOString() : null,
  };

  const { data: newRelease, error: insertErr } = await supabase
    .from('app_releases')
    .insert(payload)
    .select()
    .single();

  if (insertErr) {
    console.error(`${RED}✖ Failed to register release record: ${insertErr.message}${RESET}`);
    process.exit(1);
  }

  console.log(`\n${GREEN}====================================================${RESET}`);
  console.log(`${GREEN}✔ PHASE 7 OTA RELEASE PUBLISHED SUCCESSFULLY!${RESET}`);
  console.log(`${GREEN}====================================================${RESET}`);
  console.log(`  Release ID     : ${newRelease.id}`);
  console.log(`  Bundle Version : ${newRelease.bundle_version}`);
  console.log(`  Channel        : ${newRelease.channel}`);
  console.log(`  Status         : ${newRelease.status}`);
  console.log(`  Storage Path   : ${newRelease.storage_path}`);
  console.log(`  Checksum SHA256: ${newRelease.checksum_sha256}`);
  console.log(`  Size Bytes     : ${newRelease.bundle_size_bytes}`);
  console.log(`  Min Native Code: ${newRelease.min_native_version_code}`);
  console.log(`  Max Native Code: ${newRelease.max_native_version_code ?? 'None'}`);
  console.log(`  Published At   : ${newRelease.published_at}\n`);
}

// Auto-run if executed as main CLI entry point
if (process.argv[1] && process.argv[1].endsWith('publishOtaRelease.ts')) {
  runPublisher().catch((err) => {
    console.error(`${RED}✖ Unhandled publication error:${RESET}`, err);
    process.exit(1);
  });
}
