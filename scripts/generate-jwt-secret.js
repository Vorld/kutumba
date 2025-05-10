#!/usr/bin/env node

/**
 * This script generates a secure random string to be used as JWT_SECRET
 * Usage: node scripts/generate-jwt-secret.js
 */

import crypto from 'crypto';

// Generate a secure random string of specified length
function generateSecureSecret(length = 64) {
  return crypto.randomBytes(length).toString('hex');
}

const secret = generateSecureSecret();
console.log('Generated JWT_SECRET for your .env file:');
console.log('JWT_SECRET=' + secret);
console.log('\nMake sure to add this to your .env file!');