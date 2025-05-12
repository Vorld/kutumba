import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { verifyToken } from '@/lib/auth';

// DELETE /api/persons/delete
export async function DELETE(req: NextRequest) {
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

    // Get the person ID from the URL params
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Person ID is required' }, { status: 400 });
    }

    // First delete all relationships involving this person
    await sql`
      DELETE FROM relationships
      WHERE person1_id = ${id} OR person2_id = ${id}
    `;

    // Then delete the person
    await sql`
      DELETE FROM persons
      WHERE id = ${id}
    `;

    return NextResponse.json({
      success: true,
      message: 'Person successfully deleted'
    });
    
  } catch (error) {
    console.error('Error deleting person:', error);
    return NextResponse.json({ error: 'Failed to delete person' }, { status: 500 });
  }
}
