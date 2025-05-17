import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { verifyToken } from '@/lib/auth';

// Helper to check authentication from cookies
async function isAuthenticated(request: NextRequest) {
  const token = request.cookies.get('auth_token')?.value;
  if (!token) return false;
  const result = await verifyToken(token);
  return result.valid;
}

// Edit a person
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  if (!(await isAuthenticated(request))) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }
  const id = params.id;
  const data = await request.json();
  try {
    await sql`
      UPDATE persons SET 
        name = ${data.name},
        nickname = ${data.nickname},
        birthday = ${data.birthday},
        gender = ${data.gender},
        date_of_death = ${data.date_of_death},
        location = ${data.location},
        updated_at = NOW(),
        flagged_for_deletion = ${data.flagged_for_deletion}
      WHERE id = ${id}
    `;
    return NextResponse.json({ message: 'Person updated' });
  } catch (error) {
    return NextResponse.json({ message: 'Error updating person', error }, { status: 500 });
  }
}

// Delete a person and all their relationships
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  if (!(await isAuthenticated(request))) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }
  const id = params.id;
  try {
    await sql`DELETE FROM relationships WHERE person1_id = ${id} OR person2_id = ${id}`;
    await sql`DELETE FROM persons WHERE id = ${id}`;
    return NextResponse.json({ message: 'Person and relationships deleted' });
  } catch (error) {
    return NextResponse.json({ message: 'Error deleting person', error }, { status: 500 });
  }
}
