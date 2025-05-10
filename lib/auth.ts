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
 * @param userInfo Optional information about the user. Can be:
 *                 - A simple name (e.g., "John Doe")
 *                 - A formatted string with name and phone ("John Doe (+1234567890)")
 *                 - Just a phone number ("+1234567890")
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
    let name = userInfo;
    let phone = null;
    
    // Check if userInfo is in the format "Name (phone)"
    // TODO: Better validation for phone number (different countries, etc.)
    const namePhoneMatch = userInfo.match(/^(.+?) \((\+[0-9\s\-()]+)\)$/);
    if (namePhoneMatch) {
      name = namePhoneMatch[1];
      phone = namePhoneMatch[2].replace(/[^+0-9]/g, ''); // Normalize phone format
    } else {
      // Check if userInfo is just a phone number
      const phoneRegex = /^\+?[0-9\s\-()]+$/;
      if (phoneRegex.test(userInfo)) {
        phone = userInfo.replace(/[^+0-9]/g, ''); // Normalize phone format
        name = 'Anonymous';
      }
    }
    
    // If we have a phone number, check if it already exists before inserting
    if (phone) {
      // Check if this phone number already exists
      const existingUser = await sql`
        SELECT id FROM users WHERE phone = ${phone} LIMIT 1
      `;
      
      if (existingUser && existingUser.length > 0) {
        // Update the existing record instead of creating a new one
        await sql`
          UPDATE users 
          SET name = ${name}, login_time = NOW()
          WHERE phone = ${phone}
        `;
      } else {
        // Insert new record
        await sql`
          INSERT INTO users (name, phone, login_time)
          VALUES (${name}, ${phone}, NOW())
        `;
      }
    } else {
      // No phone number, just log the login with name
      await sql`
        INSERT INTO users (name, login_time)
        VALUES (${name}, NOW())
      `;
    }
  } catch (error) {
    // Log but don't fail if this fails
    console.error('Failed to log user authentication:', error);
  }
  
  return jwt;
}


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