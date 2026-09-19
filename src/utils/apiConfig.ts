import { Capacitor } from '@capacitor/core';

// Obsolete/decommissioned backend URL identifier for legacy cache purge
const OBSOLETE_BACKEND_SUBSTRING = 'vjz5hjkvehacv2o4u33hs2';

/**
 * Returns true if the runtime is running in a native mobile/Capacitor environment.
 */
export function isNativeEnvironment(): boolean {
  if (typeof Capacitor !== 'undefined') {
    if (typeof Capacitor.isNativePlatform === 'function' && Capacitor.isNativePlatform()) {
      return true;
    }
    if (typeof Capacitor.getPlatform === 'function' && Capacitor.getPlatform() !== 'web') {
      return true;
    }
  }
  if (typeof window !== 'undefined' && window.location) {
    if (window.location.protocol === 'capacitor:' || window.location.protocol === 'file:') {
      return true;
    }
  }
  return false;
}

/**
 * Returns the base URL for Express backend API calls.
 * 
 * In standard web browser deployments (http: or https:):
 * - Always returns '' so all API calls use same-origin relative paths (/api/...),
 *   preventing cross-origin CORS preflight issues or redirection to stale preview containers.
 * 
 * In Capacitor Android / Native deployments or non-browser test environments:
 * - Returns VITE_API_BASE_URL if configured via build environment or settings.
 * - If VITE_API_BASE_URL is not configured, returns '' to allow same-origin or client SDK fallbacks.
 */
export function getApiBaseUrl(): string {
  // Purge obsolete backend URL from localStorage if present
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const stored = localStorage.getItem('cbe_api_base_url');
      if (stored && stored.includes(OBSOLETE_BACKEND_SUBSTRING)) {
        localStorage.removeItem('cbe_api_base_url');
      }
    }
  } catch {
    // Ignore localStorage access restrictions
  }

  // 1. In standard web browser environments (http: or https: without native Capacitor),
  // always use same-origin relative paths ('') to ensure API calls go directly to the serving origin.
  if (typeof window !== 'undefined' && window.location) {
    const isHttpProtocol = window.location.protocol === 'http:' || window.location.protocol === 'https:';
    if (isHttpProtocol && !isNativeEnvironment()) {
      return '';
    }
  }

  // 2. In Native Capacitor or non-browser/test environments, resolve configured API base URL:
  let envUrl = '';

  // Check Vite client-side environment
  try {
    if (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_API_BASE_URL) {
      envUrl = (import.meta as any).env.VITE_API_BASE_URL;
    }
  } catch {
    // Ignore error in environments without import.meta.env
  }

  // Check local storage if configured in settings (purging legacy/obsolete URLs if found)
  try {
    if (!envUrl && typeof window !== 'undefined' && window.localStorage) {
      const stored = localStorage.getItem('cbe_api_base_url');
      if (stored && !stored.includes(OBSOLETE_BACKEND_SUBSTRING)) {
        envUrl = stored;
      }
    }
  } catch {
    // Ignore localStorage access restrictions
  }

  // Check Node process.env (fallback for test/SSR environments)
  if (!envUrl && typeof process !== 'undefined' && process.env?.VITE_API_BASE_URL) {
    envUrl = process.env.VITE_API_BASE_URL;
  }

  if (typeof envUrl === 'string' && envUrl.trim().length > 0) {
    let sanitized = envUrl.trim();
    // Strip accidental leading variable assignment prefixes if pasted into settings
    if (sanitized.startsWith('VITE_API_BASE_URL=')) {
      sanitized = sanitized.substring('VITE_API_BASE_URL='.length).trim();
    } else if (sanitized.startsWith('API_BASE_URL=')) {
      sanitized = sanitized.substring('API_BASE_URL='.length).trim();
    }
    // Reject obsolete backend URL if present in envUrl
    if (sanitized.includes(OBSOLETE_BACKEND_SUBSTRING)) {
      return '';
    }
    return sanitized.replace(/\/+$/, '');
  }

  return '';
}

/**
 * Builds a complete API URL from a relative API path.
 * Ensures correct slash formatting between base and path.
 * 
 * Examples:
 * Web:
 *   buildApiUrl('/api/admin/update-teacher') -> '/api/admin/update-teacher'
 *   buildApiUrl('api/admin/update-teacher')  -> '/api/admin/update-teacher'
 * 
 * Native Android (VITE_API_BASE_URL="https://example-backend.run.app"):
 *   buildApiUrl('/api/admin/update-teacher') -> 'https://example-backend.run.app/api/admin/update-teacher'
 */
export function buildApiUrl(path: string): string {
  const base = getApiBaseUrl();
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  if (!base) {
    return normalizedPath;
  }
  return `${base}${normalizedPath}`;
}

