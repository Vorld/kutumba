import { NextRequest, NextResponse } from 'next/server';
import { verifySession } from './lib/auth';


export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Allow access to login page and API routes without authentication
  if (pathname.startsWith('/login') || pathname.startsWith('/api/')) {
    return NextResponse.next();
  }
  
  // Allow access to static files
  if (
    pathname.startsWith('/_next/') || 
    pathname.startsWith('/favicon.ico') ||
    pathname.startsWith('/images/')
  ) {
    return NextResponse.next();
  }
  
  // Check if the user is authenticated
  const isAuthenticated = await checkAuthentication(request);
  
  if (isAuthenticated) {
    return NextResponse.next();
  }
  
  // Redirect to login with the redirect URL
  const redirectUrl = new URL('/login', request.url);
  redirectUrl.searchParams.set('redirect', pathname);
  return NextResponse.redirect(redirectUrl);
}

async function checkAuthentication(request: NextRequest): Promise<boolean> {
  // Get the token from cookies
  const token = request.cookies.get('auth_token')?.value;
  
  if (!token) {
    return false;
  }
  
  // Verify the session token against the database
  return await verifySession(token);
}

// Configure which routes use this middleware
export const config = {
  matcher: '/((?!_next/static|_next/image|favicon.ico).*)',
};
