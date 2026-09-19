# CBE Management System — OTA Bundle Packaging (Phase 2)

## Overview

The OTA (Over-The-Air) Bundle Builder creates a deterministic, Capgo-compatible ZIP package from the React/Vite web application build. This package contains only the browser/WebView assets needed by Capacitor.

> **CRITICAL ARCHITECTURAL BOUNDARY:**  
> **This package is NOT automatically published or activated.**  
> Phase 2 provides artifact packaging and cryptographic validation only. Release management, server distribution, discovery, downloading, and user-safe staging belong to subsequent phases.

---

## 1. How to Generate an OTA Bundle Locally

Run the packaging command:

```bash
# Standard packaging (default bundle version: 1.0.0)
npm run build:ota

# Or specifying an explicit version:
npm run build:ota -- --version=1.0.1

# Or via environment variable:
OTA_BUNDLE_VERSION=1.0.1 npm run build:ota

# Alternative alias:
npm run ota:package
```

The script builds the web client into an isolated temporary staging directory (`.ota-staging/`), creates the archive, validates its structure and security boundaries, and cleans up temporary folders upon completion. The authoritative `dist/` directory used by Node/Docker is left untouched.

---

## 2. Where the Final Artifacts Are Produced

Output files are placed in `dist-ota/`:

- **`dist-ota/bundle.zip`**: The Capgo-compatible web asset archive.
- **`dist-ota/ota-bundle-metadata.json`**: Machine-readable metadata describing the bundle.

Example metadata output (`dist-ota/ota-bundle-metadata.json`):

```json
{
  "bundleVersion": "1.0.0",
  "fileName": "bundle.zip",
  "bundleSizeBytes": 1236296,
  "checksumSha256": "2b89f31847c6f676ebd844c2d26cbb3aacd5397f244d396b1417427e25c80900",
  "entryPoint": "index.html",
  "fileCount": 10,
  "builtAt": "2026-09-11T00:13:39.797Z"
}
```

---

## 3. What Files the Bundle Contains

Inside `dist-ota/bundle.zip`:

```text
bundle.zip
├── index.html       <-- Entry point at the root of the ZIP
└── assets/
    ├── index-*.js   <-- Application web bundles
    ├── index-*.css  <-- Compiled styles
    └── *.js         <-- Code-split web chunks
```

All files are structured so that when Capgo unpacks the archive into the native app's local web directory, Capacitor's WebView can immediately resolve `index.html` at the root.

---

## 4. What Files Are Deliberately Excluded

The archive builder enforces strict security and architectural isolation filters. The following are never packaged:

| Excluded Item | Reason for Exclusion |
| :--- | :--- |
| `server.cjs`, `server.cjs.map` | Node/Express backend server artifacts (must not run in WebView) |
| `*.map` | Source maps excluded from production OTA distribution |
| `.env`, `.env.*` | Environment secrets and local configurations |
| `node_modules/` | Development and server dependencies |
| `.git/` | Repository metadata |
| `android/`, `ios/` | Native platform projects |
| `src/` | TypeScript source files |
| `package.json`, `package-lock.json` | Node package manifests |
| `Dockerfile`, `docker-compose*` | Container build definitions |
| `*.test.ts`, `*.spec.ts` | Test suites |
| Keys, certificates, keystores | Private signing keys |

If any forbidden file is detected during staging or packaging, the builder immediately aborts with an error and deletes the invalid archive.

---

## 5. How SHA-256 Is Calculated

The checksum is computed directly on the **final written `bundle.zip` archive on disk** using Node.js `crypto`:

$$\text{SHA-256}(\text{bundle.zip}) \rightarrow \text{64-character lowercase hex string}$$

No pre-compression directories or temporary files are hashed. The hash represents the exact binary artifact that will be distributed.

Deterministic packaging is enforced by:
1. Sorting all file paths alphabetically before insertion.
2. Setting entry timestamps to a fixed date (`2026-01-01T00:00:00.000Z`).
3. Using maximum DEFLATE compression (`level: 9`).

Two builds from identical source files will yield the identical byte-for-byte checksum.

---

## 6. How to Independently Verify the Checksum

Run standard shell utilities against `dist-ota/bundle.zip`:

```bash
# On Linux / Cloud Run / CI:
sha256sum dist-ota/bundle.zip

# On macOS:
shasum -a 256 dist-ota/bundle.zip
```

Compare the 64-character hex output against `checksumSha256` in `dist-ota/ota-bundle-metadata.json`. They must match exactly.

---

## 7. What "bundleVersion" Means at This Stage

At Phase 2, `bundleVersion` is a **packaging parameter** identifying the build payload (e.g. `1.0.0`, `1.0.1`).

- It does **not** modify `package.json` version.
- It does **not** alter Android `versionCode` or `versionName` in `android/app/build.gradle`.
- It will eventually be supplied as the `version` property required by Capgo's `CapacitorUpdater.download({ version, url, checksum })`.

---

## 8. How Phase 3 Will Consume the Artifact

In Phase 3:
1. The validated `dist-ota/bundle.zip` will be uploaded to Supabase Storage (or distribution CDN).
2. The metadata (`bundleVersion`, `checksumSha256`, `bundleSizeBytes`, download URL) will be recorded in a Supabase release table.
3. The client application's Phase 1 foundation service (`otaUpdateService`) will discover the release, pass `checksumSha256` to `download()`, and stage the update safely with `next()` under `SessionUpdateLock` protection.
