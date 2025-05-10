import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { hashPassword, verifyPassword } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const { currentPassword, newPassword, adminSecret } = await request.json();
    
    // For admin reset (emergency password change)
    if (adminSecret) {
      if (adminSecret !== process.env.ADMIN_SECRET) {
        return NextResponse.json(
          { message: 'Invalid admin secret' },
          { status: 401 }
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
    }
    
    // Normal password update flow - require the current password
    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { message: 'Both current and new passwords are required' },
        { status: 400 }
      );
    }
    
    // Get the current password from the database
    const results = await sql`SELECT password_hash FROM shared_password WHERE id = 1`;
    
    if (!results || results.length === 0) {
      return NextResponse.json(
        { message: 'No password is set in the system' },
        { status: 404 }
      );
    }
    
    const storedPasswordHash = results[0].password_hash;
    
    // Verify the current password
    const passwordMatch = await verifyPassword(currentPassword, storedPasswordHash);
    
    if (!passwordMatch) {
      return NextResponse.json(
        { message: 'Current password is incorrect' },
        { status: 401 }
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
    
    // For security, invalidate all existing sessions except the current one
    try {
      const currentToken = request.cookies.get('auth_token')?.value;
      if (currentToken) {
        await sql`
          DELETE FROM sessions
          WHERE token != ${currentToken}
        `;
        console.log('Invalidated all other sessions after password change');
      }
    } catch (error) {
      console.error('Failed to invalidate sessions after password change:', error);
    }
    
    return NextResponse.json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error('Error updating password:', error);
    return NextResponse.json(
      { message: 'An error occurred while updating the password' },
      { status: 500 }
    );
  }
}
