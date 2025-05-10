#!/usr/bin/env node

/**
 * This script generates a new JWT secret and updates the .env file
 * Usage: node scripts/update-jwt-secret.js
 */

import fs from 'fs/promises';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ENV_FILE_PATH = path.join(__dirname, '..', '.env');

// Generate a secure random string
function generateSecureSecret(length = 64) {
  return crypto.randomBytes(length).toString('hex');
}

async function updateJwtSecret() {
  try {
    // Generate new secret
    const newSecret = generateSecureSecret();
    console.log('Generated new JWT secret');
    
    // Read the current .env file
    let envContent;
    try {
      envContent = await fs.readFile(ENV_FILE_PATH, 'utf8');
    } catch (error) {
      console.error('Error reading .env file:', error.message);
      console.log('Creating new .env file with JWT secret');
      envContent = '# Environment variables\n';
    }
    
    // Check if JWT_SECRET already exists
    const jwtSecretExists = /^JWT_SECRET=/m.test(envContent);
    
    if (jwtSecretExists) {
      // Replace existing JWT_SECRET
      envContent = envContent.replace(
        /^JWT_SECRET=.*/m,
        `JWT_SECRET=${newSecret}`
      );
      console.log('JWT_SECRET in .env file updated');
    } else {
      // Add new JWT_SECRET
      envContent += `\n# JWT Secret for authentication\nJWT_SECRET=${newSecret}\n`;
      console.log('JWT_SECRET added to .env file');
    }
    
    // Write the updated content back to the .env file
    await fs.writeFile(ENV_FILE_PATH, envContent);
    
    console.log('\nJWT secret has been successfully updated');
    console.log('Note: This will invalidate all existing tokens, requiring users to log in again');
  } catch (error) {
    console.error('Error updating JWT secret:', error);
  }
}

updateJwtSecret();