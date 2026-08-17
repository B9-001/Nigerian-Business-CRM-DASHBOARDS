-- Extensions used across the platform.
create extension if not exists pgcrypto;      -- gen_random_uuid()
create extension if not exists pg_trgm;        -- fuzzy/full-text search helpers
create extension if not exists vector;         -- embeddings for company knowledge (pgvector)
