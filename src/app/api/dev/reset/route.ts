import { NextResponse } from 'next/server';
import { dataStore, UnifiedDataStore } from '@/lib/db/store';

export const dynamic = 'force-dynamic';

export async function POST() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Reset is disabled in production.' }, { status: 403 });
  }

  if (dataStore instanceof UnifiedDataStore) {
    dataStore.resetAndSeed();
    dataStore.persistToDisk();
  }

  return NextResponse.json({
    success: true,
    message: 'Demo data cleared. All accounts reset to Password123! with must_change_password=true.',
    accounts: [
      { username: 'admin', role: 'admin', defaultPassword: 'Password123!', mustChangePassword: true },
      { username: 'charith', role: 'admin', defaultPassword: 'Password123!', mustChangePassword: true },
      { username: 'niketh', role: 'admin', defaultPassword: 'Password123!', mustChangePassword: true },
      { username: 'pannagasai', role: 'admin', defaultPassword: 'Password123!', mustChangePassword: true },
      { username: 'harshith', role: 'admin', defaultPassword: 'Password123!', mustChangePassword: true },
      { username: 'nitheesh', role: 'admin', defaultPassword: 'Password123!', mustChangePassword: true },
    ],
    timestamp: new Date().toISOString(),
  });
}
