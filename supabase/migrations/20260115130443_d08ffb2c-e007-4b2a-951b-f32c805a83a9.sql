-- Enable pgcrypto for secure key generation (gen_random_bytes, crypt, gen_salt)
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;