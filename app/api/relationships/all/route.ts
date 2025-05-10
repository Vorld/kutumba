import { sql } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const rows = await sql`SELECT * FROM relationships;`;
    return NextResponse.json(rows, { status: 200 });
  } catch (error) {
    console.error('Failed to fetch all relationships:', error);
    return NextResponse.json({ error: 'Internal Server Error fetching all relationships' }, { status: 500 });
  }
}
