import { isSupabaseConfigured, supabaseAdmin } from '../db/supabase';

interface RateLimitRecord {
  count: number;
  resetAt: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetInSec: number;
}

class MemoryRateLimiter {
  private records: Map<string, RateLimitRecord> = new Map();
  private maxEntries = 10000;
  private lastCleanup = Date.now();

  private pruneExpired(now: number) {
    for (const [key, record] of this.records.entries()) {
      if (now >= record.resetAt) {
        this.records.delete(key);
      }
    }
    if (this.records.size > this.maxEntries) {
      const keysToDelete = Array.from(this.records.keys()).slice(0, Math.floor(this.maxEntries * 0.2));
      for (const k of keysToDelete) {
        this.records.delete(k);
      }
    }
  }

  public check(key: string, maxRequests: number, windowSec: number): RateLimitResult {
    const now = Date.now();

    if (this.records.size > 2000 || now - this.lastCleanup > 60000) {
      this.pruneExpired(now);
      this.lastCleanup = now;
    }

    const windowMs = windowSec * 1000;
    const current = this.records.get(key);

    if (!current || now >= current.resetAt) {
      this.records.set(key, {
        count: 1,
        resetAt: now + windowMs,
      });
      return {
        allowed: true,
        remaining: maxRequests - 1,
        resetInSec: windowSec,
      };
    }

    if (current.count >= maxRequests) {
      const resetInSec = Math.ceil((current.resetAt - now) / 1000);
      return {
        allowed: false,
        remaining: 0,
        resetInSec,
      };
    }

    current.count += 1;
    const resetInSec = Math.ceil((current.resetAt - now) / 1000);
    return {
      allowed: true,
      remaining: maxRequests - current.count,
      resetInSec,
    };
  }

  public reset(key: string): void {
    this.records.delete(key);
  }

  public clearAll(): void {
    this.records.clear();
  }
}

export const rateLimiter = new MemoryRateLimiter();

async function checkSharedRateLimit(
  key: string,
  maxRequests: number,
  windowSec: number
): Promise<RateLimitResult | null> {
  const now = Date.now();
  const windowMs = windowSec * 1000;
  const { data, error } = await supabaseAdmin
    .from('rate_limits')
    .select('key, count, reset_at')
    .eq('key', key)
    .maybeSingle();

  if (error) return null;

  const resetAtMs = data?.reset_at ? new Date(data.reset_at).getTime() : 0;
  if (!data || resetAtMs <= now) {
    const resetAt = new Date(now + windowMs).toISOString();
    const { error: upsertError } = await supabaseAdmin.from('rate_limits').upsert({
      key,
      count: 1,
      reset_at: resetAt,
    });
    if (upsertError) return null;
    return { allowed: true, remaining: maxRequests - 1, resetInSec: windowSec };
  }

  if (data.count >= maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetInSec: Math.max(1, Math.ceil((resetAtMs - now) / 1000)),
    };
  }

  const { error: updateError } = await supabaseAdmin
    .from('rate_limits')
    .update({ count: data.count + 1 })
    .eq('key', key)
    .eq('count', data.count);

  if (updateError) return null;

  return {
    allowed: true,
    remaining: maxRequests - (data.count + 1),
    resetInSec: Math.max(1, Math.ceil((resetAtMs - now) / 1000)),
  };
}

/**
 * Shared limiter when Supabase is configured (survives Vercel instances).
 * Falls back to in-process memory for local/dev/tests.
 */
export async function checkRateLimit(
  key: string,
  maxRequests: number,
  windowSec: number
): Promise<RateLimitResult> {
  if (process.env.VITEST !== 'true' && isSupabaseConfigured()) {
    try {
      const shared = await checkSharedRateLimit(key, maxRequests, windowSec);
      if (shared) return shared;
    } catch {
      // Table missing or network — fail open to memory limiter
    }
  }
  return rateLimiter.check(key, maxRequests, windowSec);
}
