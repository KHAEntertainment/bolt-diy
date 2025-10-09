import { createClient } from '@supabase/supabase-js';
import type { AppLoadContext } from '@remix-run/cloudflare';

// Cookie names for Supabase session tokens (HttpOnly on server responses)
export const ACCESS_TOKEN_COOKIE = 'sb-access-token';
export const REFRESH_TOKEN_COOKIE = 'sb-refresh-token';

export function getCookie(name: string, cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;
  const parts = cookieHeader.split(';').map((c) => c.trim());
  for (const part of parts) {
    const [n, ...rest] = part.split('=');
    if (n === name) {
      return decodeURIComponent(rest.join('='));
    }
  }
  return null;
}

export function createSupabaseServerClient(context: AppLoadContext) {
  const supabaseUrl = (context.cloudflare as any)?.env?.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = (context.cloudflare as any)?.env?.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase environment variables are not configured');
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export async function getCurrentUser(request: Request, context: AppLoadContext) {
  const cookieHeader = request.headers.get('Cookie');
  const access_token = getCookie(ACCESS_TOKEN_COOKIE, cookieHeader);

  if (!access_token) {
    return null;
  }

  const supabase = createSupabaseServerClient(context);
  const { data, error } = await supabase.auth.getUser(access_token);
  if (error) {
    return null;
  }
  return data.user ?? null;
}
