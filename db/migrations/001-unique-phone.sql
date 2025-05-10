-- Add unique constraint on phone column
-- First, clean up existing duplicate phone numbers by keeping only the most recent login
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

-- Add phone validation check (must start with + and contain valid characters)
ALTER TABLE users
  ADD CONSTRAINT phone_format CHECK (
    phone IS NULL OR phone = '' OR phone ~ '^\+[0-9\s\-()]{5,20}$'
  );

-- Create index for faster lookups by phone
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);