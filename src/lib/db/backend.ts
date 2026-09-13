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

/** JSON/file store is allowed for local dev, tests, and CI builds only. */
export function allowJsonFileStore(): boolean {
  if (process.env.VITEST === 'true') return true;
  if (process.env.NEXT_PHASE === 'phase-production-build') return true;
  if (process.env.CI === 'true' && process.env.DATA_BACKEND === 'memory') return true;
  if (process.env.NODE_ENV !== 'production') return true;
  return false;
}

export function assertProductionDataBackend(): void {
  if (isSupabaseBackendActive()) return;
  if (allowJsonFileStore()) return;
  throw new Error(
    'FATAL: production requires Supabase. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY. The JSON file store is local/dev only.'
  );
}
