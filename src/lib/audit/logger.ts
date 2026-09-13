import { dataStore } from '../db/store';
import { NextRequest } from 'next/server';

export interface AuditEventParams {
  userId?: string | null;
  action: string;
  resourceType?: string;
  resourceId?: string;
  metadata?: Record<string, unknown>;
  req?: NextRequest | Request;
}

const REDACTED_KEYS = new Set([
  'password',
  'password_hash',
  'token',
  'session',
  'authorization',
  'secret',
  'refresh_token',
  'access_token',
  'cookie',
]);

function sanitizeMetadata(data?: Record<string, unknown>): Record<string, unknown> {
  if (!data) return {};
  const cleaned: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(data)) {
    if (REDACTED_KEYS.has(key.toLowerCase())) {
      cleaned[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      cleaned[key] = sanitizeMetadata(value as Record<string, unknown>);
    } else {
      cleaned[key] = value;
    }
  }

  return cleaned;
}

export async function logAuditEvent(params: AuditEventParams): Promise<void> {
  try {
    let ip = '127.0.0.1';
    let userAgent = 'unknown';

    if (params.req) {
      const headers = params.req.headers;
      ip =
        headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
        headers.get('x-real-ip') ||
        '127.0.0.1';
      userAgent = headers.get('user-agent') || 'unknown';
    }

    const safeMeta = sanitizeMetadata(params.metadata);

    await dataStore.createAuditLog({
      user_id: params.userId || null,
      action: params.action,
      resource_type: params.resourceType || null,
      resource_id: params.resourceId || null,
      metadata: safeMeta,
      ip_address: ip,
      user_agent: userAgent,
    });
  } catch (err) {
    console.error('[AUDIT LOGGING FAILURE]', err);
  }
}
