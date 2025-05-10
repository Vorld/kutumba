// Helper functions for password hashing and verification
import bcryptjs from 'bcryptjs';
import { sql } from './db';

const SALT_ROUNDS = 10;

/**
 * Hash a password using bcrypt
 * @param password Plain text password
 * @returns Hashed password
 */
export async function hashPassword(password: string): Promise<string> {
  return await bcryptjs.hash(password, SALT_ROUNDS);
}

/**
 * Compare a plain text password with a hashed password
 * @param plainTextPassword The plain text password to compare
 * @param hashedPassword The hashed password to compare against
 * @returns True if the passwords match, false otherwise
 */
export async function verifyPassword(plainTextPassword: string, hashedPassword: string): Promise<boolean> {
  return await bcryptjs.compare(plainTextPassword, hashedPassword);
}

/**
 * Generate a secure authentication token
 * @returns A secure random token
 */
export function generateAuthToken(): string {
  // Create a new array to store random bytes
  const array = new Uint8Array(32);
  
  // Fill the array with cryptographically secure random values
  crypto.getRandomValues(array);
  
  // Convert the array to a hex string
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Create a new session in the database
 * @param userInfo Optional information about the user
 * @param expiryDays Number of days until the session expires
 * @returns The session token
 */
export async function createSession(userInfo: string = 'Anonymous', expiryDays: number = 30): Promise<string> {
  const token = generateAuthToken();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + expiryDays);
  
  await sql`
    INSERT INTO sessions (token, user_info, created_at, expires_at)
    VALUES (${token}, ${userInfo}, NOW(), ${expiresAt})
  `;
  
  return token;
}

/**
 * Verify if a session token is valid
 * @param token The token to verify
 * @returns True if the token is valid, false otherwise
 */
export async function verifySession(token: string): Promise<boolean> {
  if (!token) return false;
  
  try {
    const result = await sql`
      SELECT * FROM sessions
      WHERE token = ${token}
      AND expires_at > NOW()
    `;
    
    return result && result.length > 0;
  } catch (error) {
    console.error('Error verifying session token:', error);
    return false;
  }
}

/**
 * Delete expired sessions from the database
 * @returns Number of sessions deleted
 */
export async function cleanupExpiredSessions(): Promise<number> {
  try {
    const result = await sql`
      DELETE FROM sessions
      WHERE expires_at < NOW()
      RETURNING token
    `;
    
    return result.length;
  } catch (error) {
    console.error('Error cleaning up expired sessions:', error);
    return 0;
  }
}

/**
 * Delete a specific session by token
 * @param token The session token to delete
 */
export async function deleteSession(token: string): Promise<void> {
  try {
    await sql`
      DELETE FROM sessions
      WHERE token = ${token}
    `;
  } catch (error) {
    console.error('Error deleting session:', error);
  }
}
