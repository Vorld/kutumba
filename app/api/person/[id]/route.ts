import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db'; // Assuming your database utility is here

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = params.id;
    // Corrected Neon query
    const result = await sql`SELECT * FROM persons WHERE id = ${id}`;
    const person = result.length > 0 ? result[0] : null;

    if (!person) {
      return NextResponse.json({ error: 'Person not found' }, { status: 404 });
    }

    return NextResponse.json(person);
  } catch (error) {
    console.error('Error fetching person:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
