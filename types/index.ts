// Data model interfaces for Kutumba

/**
 * Interface for a person in the family tree
 */


export interface Person {
  id: string;           // UUID
  name: string;         // Full name
  nickname?: string | null;    // Optional nickname
  birthday?: string | null;    // Date in ISO format (YYYY-MM-DD)
  gender?: 'male' | 'female' | null;
  date_of_death?: string | null; // Date in ISO format (YYYY-MM-DD)
  location?: string | null;    // Current or last known location
  created_at: string;   // Timestamp
  updated_at: string;   // Timestamp
  
  // Family relationships
  parent_ids?: string[] | null;  // List of parent IDs
  spouse_id?: string | null;     // ID of the spouse
  
  // Admin fields
  flagged_for_deletion?: boolean | null; // Whether this person is flagged for deletion
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
