import { sql } from '@/lib/db';
import { NextResponse, NextRequest } from 'next/server';
import { verifyToken } from '@/lib/auth';

export async function GET() {
  try {
    const rows = await sql`SELECT * FROM relationships;`;
    return NextResponse.json(rows, { status: 200 });
  } catch (error) {
    console.error('Failed to fetch all relationships:', error);
    return NextResponse.json({ error: 'Internal Server Error fetching all relationships' }, { status: 500 });
  }
}

// Helper to check authentication from cookies
async function isAuthenticated(request: NextRequest) {
  const token = request.cookies.get('auth_token')?.value;
  if (!token) return false;
  const result = await verifyToken(token);
  return result.valid;
}

export async function POST(request: NextRequest) {
  if (!(await isAuthenticated(request))) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }
  const data = await request.json();
  // { person1_id, person2_id, relationship_type }
  try {
    const [rel] = await sql`
      INSERT INTO relationships (id, person1_id, person2_id, relationship_type)
      VALUES (gen_random_uuid(), ${data.person1_id}, ${data.person2_id}, ${data.relationship_type})
      RETURNING *;
    `;
    return NextResponse.json(rel, { status: 201 });
  } catch (error) {
    return NextResponse.json({ message: 'Error creating relationship', error }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  if (!(await isAuthenticated(request))) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ message: 'Missing id' }, { status: 400 });
  const data = await request.json();
  try {
    await sql`
      UPDATE relationships SET
        person1_id = COALESCE(${data.person1_id}, person1_id),
        person2_id = COALESCE(${data.person2_id}, person2_id),
        relationship_type = COALESCE(${data.relationship_type}, relationship_type)
      WHERE id = ${id}
    `;
    return NextResponse.json({ message: 'Relationship updated' });
  } catch (error) {
    return NextResponse.json({ message: 'Error updating relationship', error }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  if (!(await isAuthenticated(request))) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ message: 'Missing id' }, { status: 400 });
  try {
    await sql`DELETE FROM relationships WHERE id = ${id}`;
    return NextResponse.json({ message: 'Relationship deleted' });
  } catch (error) {
    return NextResponse.json({ message: 'Error deleting relationship', error }, { status: 500 });
  }
}
