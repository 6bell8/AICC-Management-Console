import { NextResponse, type NextRequest } from 'next/server';

const PUBLIC_PATHS = ['/login', '/signup', '/guest'];
const PUBLIC_API_PREFIXES = ['/api/auth/login', '/api/auth/signup', '/api/auth/guest', '/api/health'];

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname === '/icon.svg' ||
    PUBLIC_PATHS.some((path) => pathname === path) ||
    PUBLIC_API_PREFIXES.some((path) => pathname.startsWith(path))
  ) {
    return NextResponse.next();
  }

  const hasSession = Boolean(req.cookies.get('aicc_session')?.value);

  if (!hasSession && !pathname.startsWith('/api')) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  if (!hasSession && pathname.startsWith('/api')) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!.*\\..*).*)'],
};
