import { NextRequest, NextResponse } from 'next/server';
import { AUTH_COOKIE_NAME, verifySignedSessionJwt } from '@/lib/auth/jwt-edge';

const PUBLIC_PATHS = [
  '/login',
  '/api/auth/login',
  '/api/health',
  '/sw.js',
  '/manifest.webmanifest',
  '/favicon.ico',
  '/robots.txt',
];

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_PATHS.includes(pathname)) return true;
  if (pathname.startsWith('/_next')) return true;
  if (pathname.startsWith('/api/auth/login')) return true;
  if (pathname.match(/\.(png|jpg|jpeg|svg|ico|webp|css|js|map)$/)) return true;
  return false;
}

function isCronSync(req: NextRequest, pathname: string): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || pathname !== '/api/mail/sync') return false;
  const auth = req.headers.get('authorization') || '';
  return auth === `Bearer ${cronSecret}`;
}

function unauthenticated(req: NextRequest): NextResponse {
  if (req.nextUrl.pathname.startsWith('/api/')) {
    return NextResponse.json(
      { error: 'Authentication required. Please log in.', success: false },
      { status: 401 }
    );
  }
  const loginUrl = req.nextUrl.clone();
  loginUrl.pathname = '/login';
  loginUrl.searchParams.set('next', req.nextUrl.pathname);
  return NextResponse.redirect(loginUrl);
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  if (isCronSync(req, pathname)) {
    return NextResponse.next();
  }

  const token = req.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (!token) {
    return unauthenticated(req);
  }

  const payload = await verifySignedSessionJwt(token);
  if (!payload?.user?.id || payload.user.status === 'disabled' || payload.user.status === 'suspended') {
    const res = unauthenticated(req);
    res.cookies.set({
      name: AUTH_COOKIE_NAME,
      value: '',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    });
    return res;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image).*)'],
};
