import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { verifyToken } from '@/lib/auth';

// PUT /api/persons/update
export async function PUT(req: NextRequest) {
  try {
    // Check authentication from JWT token in cookie
    const token = req.cookies.get('auth_token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    
    const { valid } = await verifyToken(token);
    if (!valid) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
    }

    // Parse request body
    const body = await req.json();
    const { id, name, nickname, birthday, gender } = body;

    // Validate required fields
    if (!id) {
      return NextResponse.json({ error: 'Person ID is required' }, { status: 400 });
    }

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    // Update the person in the database
    await sql`
      UPDATE persons
      SET name = ${name}, nickname = ${nickname}, birthday = ${birthday}, gender = ${gender}
      WHERE id = ${id}
    `;

    return NextResponse.json({
      success: true,
      person: {
        id,
        name,
        nickname,
        birthday,
        gender
      }
    });
    
  } catch (error) {
    console.error('Error updating person:', error);
    return NextResponse.json({ error: 'Failed to update person' }, { status: 500 });
  }
}
