import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from './lib/auth';


export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Get authentication status first, as we'll need it for multiple checks
  const isAuthenticated = await checkAuthentication(request);
  
  // Handle login page specially - redirect to home if already logged in
  if (pathname.startsWith('/login')) {
    if (isAuthenticated) {
      // User is already logged in, redirect to home page
      // If there's a redirect parameter, use that instead
      const redirectParam = request.nextUrl.searchParams.get('redirect');
      const redirectPath = redirectParam || '/';
      return NextResponse.redirect(new URL(redirectPath, request.url));
    }
    // Not authenticated, allow access to login page
    return NextResponse.next();
  }
  
  // Allow access to API routes without authentication
  if (pathname.startsWith('/api/')) {
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
  
  // Check if the user is authenticated for all other routes
  if (isAuthenticated) {
    return NextResponse.next();
  }
  
  // Not authenticated, redirect to login with the redirect URL
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
  
  // Verify the JWT token - updated for the new return type
  const result = await verifyToken(token);
  return result.valid;
}

// Configure which routes use this middleware
export const config = {
  matcher: '/((?!_next/static|_next/image|favicon.ico).*)',
};
