import { sql } from '@/lib/db';
import { NextResponse, NextRequest } from 'next/server';
import { verifyToken } from '@/lib/auth';

export async function GET() {
  try {
    const rows = await sql`SELECT * FROM persons;`; 
    return NextResponse.json(rows, { status: 200 });
  } catch (error) {
    console.error('Failed to fetch all persons:', error);
    return NextResponse.json({ error: 'Internal Server Error fetching all persons' }, { status: 500 });
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
  // data: { person: Person, relationshipType: 'A'|'B'|'C'|'D', relatedIds: string[] }
  const { person, relationshipType, relatedIds } = data;
  try {
    // Insert person
    const [newPerson] = await sql`
      INSERT INTO persons (id, name, nickname, birthday, gender, date_of_death, location, created_at, updated_at)
      VALUES (${person.id}, ${person.name}, ${person.nickname}, ${person.birthday}, ${person.gender}, ${person.date_of_death}, ${person.location}, NOW(), NOW())
      RETURNING *;
    `;
    // Relationship logic
    if (relationshipType === 'B') {
      // Spouse of someone
      const spouseId = relatedIds[0];
      await sql`
        INSERT INTO relationships (id, person1_id, person2_id, relationship_type)
        VALUES (gen_random_uuid(), ${person.id}, ${spouseId}, 'spouse'),
               (gen_random_uuid(), ${spouseId}, ${person.id}, 'spouse');
      `;
    } else if (relationshipType === 'C') {
      // Child of two people (must be spouses)
      const [parent1, parent2] = relatedIds;
      const spouses = await sql`
        SELECT * FROM relationships WHERE relationship_type = 'spouse' AND ((person1_id = ${parent1} AND person2_id = ${parent2}) OR (person1_id = ${parent2} AND person2_id = ${parent1}))
      `;
      if (!spouses.length) {
        return NextResponse.json({ message: 'Selected parents are not spouses.' }, { status: 400 });
      }
      await sql`
        INSERT INTO relationships (id, person1_id, person2_id, relationship_type)
        VALUES (gen_random_uuid(), ${parent1}, ${person.id}, 'parent'),
               (gen_random_uuid(), ${parent2}, ${person.id}, 'parent');
      `;
    } else if (relationshipType === 'D') {
      // Parent of someone (must be married)
      const childId = relatedIds[0];
      // Find spouse of this new person
      const spouseId = person.spouse_id;
      if (!spouseId) {
        return NextResponse.json({ message: 'Parent must have a spouse to add as parent.' }, { status: 400 });
      }
      // Check if they are spouses
      const spouses = await sql`
        SELECT * FROM relationships WHERE relationship_type = 'spouse' AND ((person1_id = ${person.id} AND person2_id = ${spouseId}) OR (person1_id = ${spouseId} AND person2_id = ${person.id}))
      `;
      if (!spouses.length) {
        return NextResponse.json({ message: 'Parent and their spouse are not married.' }, { status: 400 });
      }
      await sql`
        INSERT INTO relationships (id, person1_id, person2_id, relationship_type)
        VALUES (gen_random_uuid(), ${person.id}, ${childId}, 'parent'),
               (gen_random_uuid(), ${spouseId}, ${childId}, 'parent');
      `;
    }
    // A: Unrelated, do nothing
    return NextResponse.json({ message: 'Person created', person: newPerson });
  } catch (error) {
    return NextResponse.json({ message: 'Error creating person', error }, { status: 500 });
  }
}
