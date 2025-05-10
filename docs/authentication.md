# Authentication System

This document explains the authentication system used in the Kutumba application.

## Overview

The application uses a JWT (JSON Web Token) based authentication system. We use the `jose` library to handle JWT operations.

## Setup

1. Create a `.env` file in the root directory of the project (use `.env.example` as a template)
2. Generate a secure JWT secret using the provided script:
   ```bash
   node scripts/generate-jwt-secret.js // TODO: Recreate this script
   ```
3. Add the generated secret to your `.env` file:
   ```
   JWT_SECRET=your_generated_secret
   ```

## How it works

### Login Process
1. User enters the shared password (and optionally name/phone)
2. The server verifies the password against the stored hash
3. If valid, the server generates a JWT token containing user info
4. The JWT is sent to the client as an HTTP-only cookie

### Authentication
1. The middleware intercepts requests to protected routes
2. It extracts the JWT from the cookies
3. It verifies the token using the JWT_SECRET
4. If valid, the user is allowed to access the route
5. If invalid, the user is redirected to the login page

### Logout
1. The client sends a logout request
2. The server responds with a header that clears the auth cookie
3. Since we're using stateless JWTs, the token itself can't be invalidated server-side
4. The token will automatically expire based on its expiry time

## Environment Variables

- `JWT_SECRET`: Secret key used for signing and verifying JWTs
- `APP_SHARED_PASSWORD`: Default shared password (will be hashed in DB)
- `ADMIN_SECRET`: Secret for admin operations like changing the shared password

## Token Security

- Tokens are HTTP-only (not accessible via JavaScript)
- Tokens have a configurable expiration time (default: 7 days)
- Tokens are secured with modern cryptographic standards via the jose library

