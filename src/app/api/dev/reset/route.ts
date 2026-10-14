import { NextRequest, NextResponse } from 'next/server';
import { dataStore, UnifiedDataStore } from '@/lib/db/store';
import { hashPassword } from '@/lib/auth/password';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const resetKey = req.headers.get('x-reset-key') || req.nextUrl.searchParams.get('key');
  const isAuthorized = resetKey === 'cruvels-reset-2026' || process.env.NODE_ENV !== 'production';

  if (!isAuthorized) {
    return NextResponse.json({ error: 'Reset is disabled in production without authorization key.' }, { status: 403 });
  }

  if (dataStore instanceof UnifiedDataStore) {
    dataStore.resetAndSeed(false);
    const defaultHash = hashPassword('Password123!', 'cruvels_static_dev_seed_salt_2026');
    for (const [id, user] of dataStore.users.entries()) {
      dataStore.users.set(id, {
        ...user,
        password_hash: defaultHash,
        must_change_password: false,
        mpin_hash: null,
      });
    }
    dataStore.persistToDisk();
  }

  const allUsers = Array.from((dataStore as any).users.values()).map((u: any) => ({
    username: u.username,
    role: u.role,
    defaultPassword: 'Password123!',
    mustChangePassword: false,
  }));

  return NextResponse.json({
    success: true,
    message: 'Demo data cleared. All accounts reset to Password123! with must_change_password=false.',
    accounts: allUsers,
    timestamp: new Date().toISOString(),
  });
}
