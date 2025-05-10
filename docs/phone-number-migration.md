# Phone Number Migration Guide

This document explains how to apply the phone number standardization and validation to your database.

## Overview

We've updated the handling of phone numbers in the Kutumba application to:

1. Store phone numbers in the E.164 international format
2. Prevent duplicate phone numbers in the database
3. Add proper validation
4. Fix issues with name and phone storage

## Running the Migration

To apply the migration to your database:

```bash
# Connect to your database
psql your_database_name

# Run the migration script
\i db/migrations/001-unique-phone.sql
```

Or you can run it directly from the command line:

```bash
psql your_database_name -f db/migrations/001-unique-phone.sql
```

## What the Migration Does

1. Normalizes existing phone numbers to E.164 format
2. Removes duplicate phone numbers (keeping only the most recent login)
3. Adds a unique constraint to the phone column
4. Adds validation to ensure phone numbers follow the E.164 format
5. Creates an index for faster phone number lookups

## E.164 Format

The E.164 format is the international standard for phone numbers and includes:
- A plus sign (+)
- Country code (1-3 digits)
- Subscriber number (up to 12 digits)
- No spaces, dashes or other characters
- Maximum total length of 15 digits (including country code)

Examples:
- +14155552671 (United States)
- +447911123456 (United Kingdom)
- +911234567890 (India)
