import { Node, Edge } from '@xyflow/react';
import type { Person } from '../types'; // Corrected import path for Person

// Keep Relationship interface here if not defined in types/index.ts
// If it is, or will be, it should also be imported.
export interface Relationship {
  id: string;
  person1_id: string; 
  person2_id: string; 
  relationship_type: string; 
}

// Define a specific data structure for custom data within React Flow nodes
// Only include properties that are actually used by the node or for interactions.
export interface FamilyTreeNodeData extends Record<string, unknown> {
  label: string; // Used for person's name or marriage description
  id?: string; // Optional: Person ID for 'custom' nodes
  name?: string; // Optional: Person Name for 'custom' nodes
  nickname?: string | null;
  birthday?: string | null;
  gender?: Person['gender'];
  color?: string; // Optional: for marriage node color
  // Add other specific fields from Person if they are needed in the node data
  // For example: location?: string;
  // Add index signature to allow any other properties, satisfying Record<string, unknown>
  [key: string]: unknown;
}

// Define a custom node type that uses FamilyTreeNodeData
// The second type argument to Node is the node type string, e.g., 'custom' or 'marriage'
export type FamilyTreeCustomNode = Node<FamilyTreeNodeData, 'custom' | 'marriage'>; 

/**
 * Transforms a single person's data and their direct relationships into React Flow nodes and edges.
 *
 * @param person The data for the central person.
 * @param relationships An array of relationships involving this person.
 * @returns An object containing an array of React Flow nodes and an array of React Flow edges.
 */
export function transformDataForReactFlow(
  person: Person,
  relationships: Relationship[]
): { nodes: FamilyTreeCustomNode[]; edges: Edge[] } {
  
  const personNode: FamilyTreeCustomNode = {
    id: person.id,
    type: 'custom', // This must match a key in the nodeTypes object in FamilyTree.tsx
    data: {
      id: person.id,
      label: person.name, // Ensure label is set, typically to the person's name
      name: person.name,
      nickname: person.nickname,
      birthday: person.birthday,
      gender: person.gender,
      // location: person.location, // example if location was added to FamilyTreeNodeData
    },
    position: { x: Math.random() * 250, y: Math.random() * 150 }, 
  };

  const relationshipEdges: Edge[] = relationships.map((rel: Relationship): Edge => {
    const sourceId = rel.person1_id;
    const targetId = rel.person2_id;

    return {
      id: `edge-${rel.id}-${sourceId}-${targetId}`,
      source: sourceId,
      target: targetId,
      label: rel.relationship_type,
    };
  });

  return { nodes: [personNode], edges: relationshipEdges };
}
