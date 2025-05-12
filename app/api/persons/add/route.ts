import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { sql } from '@/lib/db';
// Import verifyToken when enabling authentication
import { verifyToken } from '@/lib/auth';

// POST /api/persons/add
export async function POST(req: NextRequest) {
  try {
    // For production, uncomment these lines to enable authentication
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
    const { person, relationshipType, relatedPersonId } = body;

    // Validate required fields
    if (!person || !person.name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    // Create a new unique ID for the person
    const personId = uuidv4();

    // Insert the person into the database
    await sql`
      INSERT INTO persons (id, name, nickname, birthday, gender) 
      VALUES (${personId}, ${person.name}, ${person.nickname}, ${person.birthday}, ${person.gender})
    `;

    // Handle relationships if specified
    if (relationshipType !== 'none' && relatedPersonId) {
      const relationshipId = uuidv4();

      if (relationshipType === 'spouse') {
        // Add spouse relationship
        await sql`
          INSERT INTO relationships (id, person1_id, person2_id, relationship_type) 
          VALUES (${relationshipId}, ${relatedPersonId}, ${personId}, 'spouse')
        `;
      }
      else if (relationshipType === 'parent') {
        // Add parent relationship (the new person is a parent of the selected person)
        await sql`
          INSERT INTO relationships (id, person1_id, person2_id, relationship_type) 
          VALUES (${relationshipId}, ${personId}, ${relatedPersonId}, 'parent')
        `;
        
        // Check if the child already has another parent
        const existingParentsQuery = await sql`
          SELECT p.id, p.gender, r.person1_id
          FROM relationships r
          JOIN persons p ON p.id = r.person1_id
          WHERE r.relationship_type = 'parent' AND r.person2_id = ${relatedPersonId} AND r.person1_id != ${personId}
        `;
        
        // If there's an existing parent with a different gender, and the new parent has a gender
        // we might want to create a spouse relationship between the parents
        if (existingParentsQuery && existingParentsQuery.length > 0) {
          const existingParent = existingParentsQuery[0];
          const newPersonGender = person.gender;
          
          // If we have gender info and the genders are different, create spouse relationship
          if (existingParent.gender && newPersonGender && existingParent.gender !== newPersonGender) {
            const spouseRelationshipId = uuidv4();
            await sql`
              INSERT INTO relationships (id, person1_id, person2_id, relationship_type) 
              VALUES (${spouseRelationshipId}, ${existingParent.id}, ${personId}, 'spouse')
            `;
          }
        }
      } 
      else if (relationshipType === 'child') {
        // Get parent information (might be a single parent or part of a couple)
        const relatedPerson = await sql`
          SELECT * FROM persons WHERE id = ${relatedPersonId}
        `;
        
        if (!relatedPerson || relatedPerson.length === 0) {
          return NextResponse.json({ error: 'Parent not found' }, { status: 404 });
        }
        
        // Add parent-child relationship for the selected parent
        await sql`
          INSERT INTO relationships (id, person1_id, person2_id, relationship_type) 
          VALUES (${relationshipId}, ${relatedPersonId}, ${personId}, 'parent')
        `;
        
        // Check if the parent has a spouse
        const spouseQuery = await sql`
          SELECT person1_id, person2_id FROM relationships 
          WHERE relationship_type = 'spouse' AND (person1_id = ${relatedPersonId} OR person2_id = ${relatedPersonId})
        `;
        
        // If parent has a spouse, add second parent relationship
        if (spouseQuery && spouseQuery.length > 0) {
          const spouseRel = spouseQuery[0];
          const otherParentId = spouseRel.person1_id === relatedPersonId ? 
                               spouseRel.person2_id : spouseRel.person1_id;
          
          // Add parent relationship for the spouse as well
          const secondRelationshipId = uuidv4();
          await sql`
            INSERT INTO relationships (id, person1_id, person2_id, relationship_type) 
            VALUES (${secondRelationshipId}, ${otherParentId}, ${personId}, 'parent')
          `;
        }
      }
    }

    // Return the newly created person with their ID
    return NextResponse.json({
      success: true,
      person: {
        id: personId,
        ...person
      }
    });
    
  } catch (error) {
    console.error('Error adding person:', error);
    return NextResponse.json({ error: 'Failed to add person' }, { status: 500 });
  }
}
