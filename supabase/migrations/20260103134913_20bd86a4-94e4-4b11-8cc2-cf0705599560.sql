
-- Add new values to existing enum
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'soc_tier_1';
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'soc_tier_2';
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'soc_tier_3';
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'soc_manager';
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'grc_engineer';
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'ciso';
