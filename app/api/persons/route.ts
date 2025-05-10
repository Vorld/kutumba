import { sql } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const rows = await sql`SELECT * FROM persons;`; 
    return NextResponse.json(rows, { status: 200 });
  } catch (error) {
    console.error('Failed to fetch all persons:', error);
    return NextResponse.json({ error: 'Internal Server Error fetching all persons' }, { status: 500 });
  }
}
