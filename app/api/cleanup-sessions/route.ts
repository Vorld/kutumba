import { NextRequest, NextResponse } from 'next/server';
import { cleanupExpiredSessions } from '@/lib/auth';

// Set this to nodejs runtime as it's not critical to run on the edge
export const runtime = 'nodejs';

/**
 * API route to clean up expired sessions
 * Can be triggered by a cron job or manually
 * 
 * Secure this endpoint in production by requiring an API key
 */
export async function GET(request: NextRequest) {
  try {
    // Optional: Add authentication check
    const apiKey = request.nextUrl.searchParams.get('key');
    if (process.env.SESSION_CLEANUP_KEY && apiKey !== process.env.SESSION_CLEANUP_KEY) {
      return NextResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Perform the cleanup
    const deletedCount = await cleanupExpiredSessions();
    
    return NextResponse.json({
      success: true,
      message: `Successfully cleaned up ${deletedCount} expired sessions`,
      deletedCount
    });
  } catch (error) {
    console.error('Session cleanup error:', error);
    return NextResponse.json(
      { message: 'An error occurred during session cleanup' },
      { status: 500 }
    );
  }
}

// Also allow POST requests for webhook compatibility
export const POST = GET;
