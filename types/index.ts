// Data model interfaces for Kutumba

/**
 * Interface for a person in the family tree
 */


// export interface Person {
//   id: string;           // UUID
//   name: string;         // Full name
//   nickname?: string;    // Optional nickname
//   birthday?: string;    // Date in ISO format (YYYY-MM-DD)
//   gender?: 'male' | 'female' | 'other' | 'prefer_not_to_say';
//   date_of_death?: string; // Date in ISO format (YYYY-MM-DD)
//   location?: string;    // Current or last known location
//   created_at: string;   // Timestamp
//   updated_at: string;   // Timestamp
  
//   // Family relationships
//   parent_ids?: string[];  // List of parent IDs
//   spouse_id?: string;     // ID of the spouse
  
//   // Admin fields
//   flagged_for_deletion?: boolean; // Whether this person is flagged for deletion
// }

/* ─────────── shared/types.ts ─────────── */

// export type Gender =
//   | 'male'
//   | 'female'
//   | 'other'
//   | 'prefer_not_to_say';

/** Mirrors the `persons` table */
export interface Person {
  /** UUID primary key */
  id: string;

  /** Full legal name */
  name: string;

  /** Optional nickname or preferred short name */
  nickname?: string | null;

  /** ISO-8601 date string (YYYY-MM-DD) */
  birthday?: string | null;

  gender?: string | null;

  /** ISO-8601 date string when deceased, else null */
  date_of_death?: string | null;

  /** Free-text location (city / country) */
  location?: string | null;

  /** Timestamps (optional on the client) */
  created_at?: string;   // 2025-05-12T10:23:45.123Z
  updated_at?: string;
  flagged_for_deletion?: boolean;
}

/** Relationship rows flowing exactly as stored in the DB */
export type RelationshipType = 'parent' | 'child' | 'spouse';

export interface Relationship {
  /** UUID primary key */
  id: string;

  /** First person in the dyad (direction depends on `relationship_type`) */
  person1_id: string;

  /** Second person in the dyad */
  person2_id: string;

  /**
   *  • 'parent'  – person1 is **parent** of person2  
   *  • 'child'   – person1 is **child**  of person2  
   *  • 'spouse'  – unordered marriage link
   */
  relationship_type: RelationshipType;

  /** Timestamps (optional on the client) */
  created_at?: string;
}


/**
 * Interface for storing shared password
 */
export interface SharedPassword {
  id: number;          // Should be a single row with id=1
  password_hash: string; // Hashed version of the shared password
  updated_at: string;  // Last time the password was updated
}

/**
 * Interface for version history
 */
export interface VersionHistory {
  id: string;           // UUID
  person_id: string;    // Related person ID
  change_type: 'create' | 'update' | 'delete'; // Type of change
  previous_data?: Partial<Person>; // Previous state (for updates and deletes)
  new_data?: Partial<Person>;      // New state (for creates and updates)
  changed_at: string;   // When the change occurred
  changed_by?: string;  // Who made the change (if collected)
}

/**
 * Interface for login form data
 */
export interface LoginFormData {
  password: string;
  name?: string;      // Optional name for tracking who's logged in
  phone?: string;     // Optional phone for notifications about password changes
}
