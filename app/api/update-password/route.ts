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
    
    // For security reasons, invalidate ALL sessions when admin resets the password
    try {
      await sql`DELETE FROM sessions`;
      console.log('Invalidated all sessions after admin password reset');
    } catch (error) {
      console.error('Failed to invalidate sessions after admin password reset:', error);
    }
    
    return NextResponse.json({ message: 'Password updated successfully via admin reset' });
  } catch (error) {
    console.error('Error updating password:', error);
    return NextResponse.json(
      { message: 'An error occurred while updating the password' },
      { status: 500 }
    );
  }
}
