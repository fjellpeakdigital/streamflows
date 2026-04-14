import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-pathname', request.nextUrl.pathname);
  return NextResponse.next({
    request: { headers: requestHeaders },
  });
}

export const config = {
  // Exclude API routes, Next internals, auth callbacks, and any file with an extension
  matcher: ['/((?!api/|_next/|auth/|.*\\..*).*)'],
};
