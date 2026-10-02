import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const WARMUP_ROUTES = [
  '/dashboard',
  '/employees',
  '/attendance',
  '/mail',
  '/tasks',
  '/schedule',
  '/leaves',
  '/notices',
  '/notes',
  '/profile',
  '/departments',
  '/admin',
];

export async function GET() {
  return NextResponse.json({
    enabled: process.env.NODE_ENV !== 'production',
    routes: WARMUP_ROUTES,
    timestamp: new Date().toISOString(),
  });
}
