-- Execute this migration to add phone number management for users

-- Update the database schema for better phone number handling
-- This follows the E.164 international phone number format

-- First, normalize existing phone numbers to E.164 format
UPDATE users 
SET phone = regexp_replace(phone, '[^+0-9]', '', 'g') 
WHERE phone IS NOT NULL AND phone != '';

-- Cleanup existing duplicate phone numbers keeping only the most recent login
WITH ranked_users AS (
  SELECT 
    id, 
    phone,
    ROW_NUMBER() OVER(PARTITION BY phone ORDER BY login_time DESC) as rn
  FROM users
  WHERE phone IS NOT NULL AND phone != ''
)
DELETE FROM users
WHERE id IN (
  SELECT id FROM ranked_users WHERE rn > 1
);

-- Now add the constraint that phone must be unique
ALTER TABLE users 
  ADD CONSTRAINT unique_phone UNIQUE (phone);

-- Add phone validation check (must be in E.164 format)
ALTER TABLE users
  ADD CONSTRAINT phone_format CHECK (
    phone IS NULL OR 
    phone = '' OR 
    phone ~ '^\+[1-9][0-9]{1,14}$'  -- E.164 format
  );

-- Create index for faster lookups by phone
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);

-- Add comment to explain E.164 format for developers
COMMENT ON COLUMN users.phone IS 'Phone number in E.164 format (e.g., +14155552671)';

-- Add documentation
COMMENT ON TABLE users IS 'Stores user login information including unique phone numbers in E.164 format';
