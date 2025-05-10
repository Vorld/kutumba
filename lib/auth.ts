// Helper functions for password hashing and verification
import bcryptjs from 'bcryptjs';
import { sql } from './db';
import * as jose from 'jose';

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
 * Get the secret key for JWT operations
 * @returns The secret key as Uint8Array
 */
export function getSecretKey(): Uint8Array {
  // Get the JWT secret from environment variables
  const envSecret = process.env.JWT_SECRET;
  
  // Check if JWT_SECRET is set
  if (!envSecret) {
    throw new Error('JWT_SECRET environment variable is not set. Please check your .env file.');
  }
  
  // Convert the secret to a Uint8Array for use with jose
  return new TextEncoder().encode(envSecret);
}

/**
 * Create a JWT token for the user
 * @param userInfo Optional information about the user
 * @param expiryDays Number of days until the token expires
 * @returns The JWT token as string
 */
export async function createJWT(userInfo: string = 'Anonymous', expiryDays: number = 30): Promise<string> {
  const secretKey = getSecretKey();
  
  // Calculate expiry date
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + expiryDays);
  
  // Create JWT with claims
  const jwt = await new jose.SignJWT({ 
    userInfo,
    createdAt: new Date().toISOString()
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(expiresAt)
    .setNotBefore(new Date())
    .setSubject('auth')
    .sign(secretKey);
  
  // Log user authentication for audit purposes
  try {
    await sql`
      INSERT INTO users (name, login_time)
      VALUES (${userInfo}, NOW())
    `;
  } catch (error) {
    // Log but don't fail if this fails
    console.error('Failed to log user authentication:', error);
  }
  
  return jwt;
}

/**
 * Alias for createJWT to maintain backward compatibility
 * @deprecated Use createJWT instead
 */
export const createSession = createJWT;

/**
 * Verify if a JWT token is valid
 * @param token The JWT token to verify
 * @returns An object with validity and payload information
 */
export async function verifyToken(token: string): Promise<{ valid: boolean; payload?: jose.JWTPayload }> {
  if (!token) return { valid: false };
  
  try {
    const secretKey = getSecretKey();
    const { payload } = await jose.jwtVerify(token, secretKey);
    return { valid: true, payload };
  } catch (error) {
    console.error('Error verifying JWT token:', error);
    return { valid: false };
  }
}

/**
 * Alias for verifyToken to maintain backward compatibility
 * @deprecated Use verifyToken instead
 */
export const verifySession = verifyToken;
