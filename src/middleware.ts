import { NextRequest, NextResponse } from 'next/server';
import { AUTH_COOKIE_NAME, verifySignedSessionJwt } from '@/lib/auth/jwt-edge';

const PUBLIC_PATHS = [
  '/login',
  '/api/auth/login',
  '/api/auth/forgot-password',
  '/api/health',
  '/api/dev/warmup',
  '/api/dev/reset',
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
  if (!cronSecret) return false;
  const validCronPaths = ['/api/mail/sync', '/api/compliance/check'];
  if (!validCronPaths.includes(pathname)) return false;
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

  // Allow background route pre-compilation during development
  if (
    process.env.NODE_ENV !== 'production' &&
    (req.headers.get('x-cruvels-warmup') === '1' || req.nextUrl.searchParams.get('_warmup') === '1')
  ) {
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

  // Enforce mandatory password update before accessing other application pages and protected APIs
  if (payload.user?.mustChangePassword) {
    const isAllowed =
      pathname.startsWith('/profile') ||
      pathname === '/api/profile' ||
      pathname === '/api/auth/logout' ||
      pathname === '/api/auth/me' ||
      pathname.startsWith('/api/notifications/stream') ||
      pathname.startsWith('/_next');

    if (!isAllowed) {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json(
          { error: 'Password change required before accessing portal resources.', mustChangePassword: true, success: false },
          { status: 403 }
        );
      }
      const profileUrl = req.nextUrl.clone();
      profileUrl.pathname = '/profile';
      profileUrl.searchParams.set('force', 'password');
      return NextResponse.redirect(profileUrl);
    }
  }

  // Edge Role-Based Access Control: Protect /admin and /api/admin from non-admin users
  if (pathname.startsWith('/admin') || pathname.startsWith('/api/admin')) {
    if (payload.user?.role !== 'admin') {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json(
          { error: 'Forbidden. Administrative privileges required.', success: false },
          { status: 403 }
        );
      }
      const dashboardUrl = req.nextUrl.clone();
      dashboardUrl.pathname = '/dashboard';
      dashboardUrl.searchParams.set('error', 'unauthorized');
      return NextResponse.redirect(dashboardUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image).*)'],
};
