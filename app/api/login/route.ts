import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { verifyPassword, createJWT } from '@/lib/auth';
import bcryptjs from 'bcryptjs';

export async function POST(request: NextRequest) {
  try {
    const { password, name, phone } = await request.json();

    if (!password) {
      return NextResponse.json(
        { message: 'Password is required' },
        { status: 400 }
      );
    }

    // Get the current password from the database
    const results = await sql`SELECT password_hash FROM shared_password WHERE id = 1`;
    
    // Get the password hash from DB or initialize it if needed
    let storedPasswordHash = null;
    
    if (results && results.length > 0) {
      storedPasswordHash = results[0].password_hash;
    }
    // If no password in DB but we have an env variable, use that (hash it first)
    else if (process.env.APP_SHARED_PASSWORD) {
      const hashedPassword = await bcryptjs.hash(process.env.APP_SHARED_PASSWORD, 10);
      
      await sql`
        INSERT INTO shared_password (id, password_hash, updated_at)
        VALUES (1, ${hashedPassword}, NOW())
        ON CONFLICT (id) DO UPDATE SET password_hash = ${hashedPassword}
      `;
      
      storedPasswordHash = hashedPassword;
    }
    
    if (!storedPasswordHash) {
      console.error('No password set in the database or environment variables');
      return NextResponse.json(
        { message: 'Authentication system error' },
        { status: 500 }
      );
    }

    // Compare the password using bcrypt
    const passwordMatch = await verifyPassword(password, storedPasswordHash);

    if (!passwordMatch) {
      return NextResponse.json(
        { message: 'Invalid password' },
        { status: 401 }
      );
    }

    // Create user info string and JWT token
    const userInfo = name ? name : (phone ? phone : 'Anonymous user');
    const authToken = await createJWT(userInfo, 7); // 7 days session
    
    // Create a response with the success message
    const response = NextResponse.json({ 
      message: 'Login successful',
      user: name || 'Anonymous'
    });
    
    // Set the JWT token in a cookie
    response.cookies.set({
      name: 'auth_token',
      value: authToken,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      // 7 day expiry
      maxAge: 7 * 24 * 60 * 60
    });
    
    return response;
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { message: 'An error occurred during login' },
      { status: 500 }
    );
  }
}
