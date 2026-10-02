import { isSupabaseConfigured } from './supabase';

export function isSupabaseBackendActive(): boolean {
  if (process.env.VITEST === 'true') return false;
  if (process.env.DATA_BACKEND === 'memory') return false;
  if (process.env.DATA_BACKEND === 'supabase') return isSupabaseConfigured();
  return isSupabaseConfigured();
}

export const useSupabaseBackend = isSupabaseBackendActive;

export function isMailWorkerPrimary(): boolean {
  return process.env.EMAIL_SYNC_ON_READ !== 'true';
}

/** JSON/file store is allowed for local dev, tests, CI builds, and local offline runs. */
export function allowJsonFileStore(): boolean {
  if (process.env.VITEST === 'true') return true;
  if (process.env.NEXT_PHASE === 'phase-production-build') return true;
  if (process.env.CI === 'true' && process.env.DATA_BACKEND === 'memory') return true;
  if (process.env.DATA_BACKEND === 'memory' || process.env.DATA_BACKEND === 'json') return true;
  if (process.env.ALLOW_JSON_FILE_STORE === 'true') return true;
  if (process.env.NODE_ENV !== 'production') return true;
  // If not deployed on cloud infrastructure (Vercel/Render) and Supabase is not configured, allow local JSON store
  if (!process.env.VERCEL && !process.env.RENDER && !isSupabaseConfigured()) return true;
  return false;
}

export function assertProductionDataBackend(): void {
  if (isSupabaseBackendActive()) return;
  if (allowJsonFileStore()) return;
  throw new Error(
    'FATAL: production requires Supabase. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY. The JSON file store is local/dev only.'
  );
}
