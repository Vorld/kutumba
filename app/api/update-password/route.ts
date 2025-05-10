import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { hashPassword } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const { newPassword, adminSecret } = await request.json();
    
    // Only allow password changes via admin secret
    if (!adminSecret) {
      return NextResponse.json(
        { message: 'Admin access required to change password' },
        { status: 403 }
      );
    }

    
    // TODO: Make this more secure
    if (adminSecret !== process.env.ADMIN_SECRET) {
      return NextResponse.json(
        { message: 'Invalid admin secret' },
        { status: 401 }
      );
    }
    
    if (!newPassword) {
      return NextResponse.json(
        { message: 'New password is required' },
        { status: 400 }
      );
    }
    
    // Hash the new password
    const hashedPassword = await hashPassword(newPassword);
    
    // Update the password in the database
    await sql`
      UPDATE shared_password
      SET password_hash = ${hashedPassword}, updated_at = NOW()
      WHERE id = 1
    `;
    
    // With JWT-based auth, we don't need to delete sessions from a database
    // Users will continue to have access until their tokens expire
    // If you need immediate invalidation, you would need to implement a token blacklist
    // or consider updating the JWT signing secret, which would invalidate all tokens
    
    return NextResponse.json({ 
      message: 'Password updated successfully via admin reset',
      note: 'With JWT-based auth, existing sessions will remain valid until they expire'
    });
  } catch (error) {
    console.error('Password update error:', error);
    return NextResponse.json(
      { message: 'An error occurred during password update' },
      { status: 500 }
    );
  }
}
