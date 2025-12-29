import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';

// NOTE:
// - We intentionally create the client from this file (instead of the auto-generated one)
//   to prevent a hard crash if env vars are temporarily unavailable in a preview build.
// - Values below are publishable (not secrets). They act as a safe fallback.

const ENV_URL = (import.meta.env.VITE_SUPABASE_URL as string | undefined) || undefined;
const ENV_KEY = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) || undefined;

const FALLBACK_URL = 'https://kglmzurhiiuhxmzykkqv.supabase.co';
const FALLBACK_PUBLISHABLE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtnbG16dXJoaWl1aHhtenlra3F2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY4MjYxNjYsImV4cCI6MjA4MjQwMjE2Nn0.IRvieBBinUcoqE8B26UuuxO7EedRMZRKWGV2tOVkD8s';

export const backendUrl = ENV_URL || FALLBACK_URL;
export const publishableKey = ENV_KEY || FALLBACK_PUBLISHABLE_KEY;
export const isBackendConfigured = Boolean(backendUrl && publishableKey);

export const supabase = createClient<Database>(backendUrl, publishableKey, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  },
});
