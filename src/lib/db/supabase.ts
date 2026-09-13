import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://mock-instance.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'mock-anon-key';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'mock-service-key';

export const isSupabaseConfigured = (): boolean => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  return (
    url.startsWith('https://') &&
    !url.includes('mock-instance') &&
    key.length > 20 &&
    !key.includes('mock-service')
  );
};

// Public client (for browser / anon access)
export const supabasePublic = createClient(supabaseUrl, supabaseAnonKey);

// Admin / Service Role client (SERVER-SIDE ONLY - NEVER EXPOSE TO BROWSER)
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});
