import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db'; // Assuming your database utility is here

export async function GET(
  request: NextRequest,
  { params }: { params: { personId: string } }
) {
  try {
    const personId = params.personId;
    // Corrected Neon query
    const relationships = await sql`SELECT * FROM relationships WHERE person1_id = ${personId} OR person2_id = ${personId}`;

    return NextResponse.json(relationships);
  } catch (error) {
    console.error('Error fetching relationships:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
