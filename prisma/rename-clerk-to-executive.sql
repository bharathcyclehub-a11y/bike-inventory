-- Migration: Rename INWARDS_CLERK → INWARDS_EXECUTIVE, OUTWARDS_CLERK → OUTWARDS_EXECUTIVE
-- Run this BEFORE deploying the code changes
-- Safe to run multiple times (idempotent)

-- Step 1: Add new enum values
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'INWARDS_EXECUTIVE';
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'OUTWARDS_EXECUTIVE';

-- Step 2: Update all user records (must be run in a separate transaction after Step 1)
-- PostgreSQL requires new enum values to be committed before they can be used in UPDATE
-- So run Step 1, then run Step 2 in a new transaction:

-- UPDATE "User" SET role = 'INWARDS_EXECUTIVE' WHERE role = 'INWARDS_CLERK';
-- UPDATE "User" SET role = 'OUTWARDS_EXECUTIVE' WHERE role = 'OUTWARDS_CLERK';

-- Step 3: Update any other tables that reference Role enum
-- UPDATE "Sop" SET ... WHERE roles contain old values (if applicable)

-- NOTE: PostgreSQL does not support removing enum values directly.
-- The old values (INWARDS_CLERK, OUTWARDS_CLERK) will remain in the enum but unused.
-- This is safe — no records will reference them after the UPDATE.
