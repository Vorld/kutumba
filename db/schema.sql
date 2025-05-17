-- Database schema for Kutumba
-- Use this script to create the necessary tables and indexes
-- in your PostgreSQL database.

-- Shared password table (single row)
CREATE TABLE IF NOT EXISTS shared_password (
  id INTEGER PRIMARY KEY,
  password_hash TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insert default password if it doesn't exist
-- Replace 'default-password' with your actual default password
INSERT INTO shared_password (id, password_hash, updated_at)
VALUES (1, 'default-password', NOW())
ON CONFLICT (id) DO NOTHING;

-- Persons table
CREATE TABLE IF NOT EXISTS persons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  nickname TEXT,
  birthday DATE,
  gender TEXT CHECK (gender IN ('male', 'female')),
  date_of_death DATE,
  location TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  flagged_for_deletion BOOLEAN DEFAULT FALSE
);

-- Relationships table
CREATE TABLE IF NOT EXISTS relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  person1_id UUID NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
  person2_id UUID NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
  relationship_type TEXT NOT NULL CHECK (relationship_type IN ('parent', 'spouse')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (person_id, person2_id, relationship_type)
);

-- Version history table
CREATE TABLE IF NOT EXISTS version_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id UUID REFERENCES persons(id) ON DELETE SET NULL,
  change_type TEXT NOT NULL CHECK (change_type IN ('create', 'update', 'delete')),
  previous_data JSONB,
  new_data JSONB,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  changed_by TEXT
);

-- User logins for optional contact info
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT,
  phone TEXT,
  login_time TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_persons_name ON persons(name);
CREATE INDEX IF NOT EXISTS idx_relationships_person_id ON relationships(person_id);
CREATE INDEX IF NOT EXISTS idx_relationships_related_person_id ON relationships(related_person_id);
CREATE INDEX IF NOT EXISTS idx_version_history_person_id ON version_history(person_id);
