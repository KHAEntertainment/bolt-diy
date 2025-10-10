import type { AppLoadContext } from '@remix-run/cloudflare';
import { createSupabaseUserClient } from '~/lib/auth/supabase.server';

export interface ProviderTokenRow {
  provider: string;
  token: string;
  username?: string | null;
  extra?: Record<string, unknown> | null;
}

export async function upsertUserFromAuth(context: AppLoadContext, request: Request) {
  const supabase = createSupabaseUserClient(request, context);
  const { data: userRes } = await supabase.auth.getUser();
  const user = userRes.user;
  if (!user) return null;
  const { error } = await supabase.from('users').upsert(
    {
      id: user.id,
      email: user.email,
      display_name: user.user_metadata?.name || null,
      avatar_url: user.user_metadata?.avatar_url || null,
    },
    { onConflict: 'id' },
  );
  if (error) {
    throw error;
  }
  return user;
}

export async function saveProviderToken(
  context: AppLoadContext,
  request: Request,
  provider: string,
  token: string,
  meta?: { username?: string | null; extra?: Record<string, unknown> | null },
) {
  const supabase = createSupabaseUserClient(request, context);
  const { data: userRes } = await supabase.auth.getUser();
  const user = userRes.user;
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('provider_tokens')
    .upsert(
      {
        user_id: user.id,
        provider,
        token,
        username: meta?.username ?? null,
        extra: meta?.extra ?? {},
      },
      { onConflict: 'user_id,provider' },
    );
  if (error) throw error;
}

export async function getProviderToken(context: AppLoadContext, request: Request, provider: string) {
  const supabase = createSupabaseUserClient(request, context);
  const { data: userRes } = await supabase.auth.getUser();
  const user = userRes.user;
  if (!user) return null;
  const { data, error } = await supabase
    .from('provider_tokens')
    .select('provider, token, username, extra')
    .eq('user_id', user.id)
    .eq('provider', provider)
    .maybeSingle();
  if (error && error.code !== 'PGRST116') throw error;
  return (data as ProviderTokenRow) ?? null;
}

export async function saveUserApiKey(context: AppLoadContext, request: Request, provider: string, apiKey: string) {
  const supabase = createSupabaseUserClient(request, context);
  const { data: userRes } = await supabase.auth.getUser();
  const user = userRes.user;
  if (!user) throw new Error('Not authenticated');
  const { error } = await supabase
    .from('user_api_keys')
    .upsert(
      {
        user_id: user.id,
        provider,
        api_key: apiKey,
      },
      { onConflict: 'user_id,provider' },
    );
  if (error) throw error;
}

export async function getUserApiKey(context: AppLoadContext, request: Request, provider: string) {
  const supabase = createSupabaseUserClient(request, context);
  const { data: userRes } = await supabase.auth.getUser();
  const user = userRes.user;
  if (!user) return null;
  const { data, error } = await supabase
    .from('user_api_keys')
    .select('provider, api_key')
    .eq('user_id', user.id)
    .eq('provider', provider)
    .maybeSingle();
  if (error && error.code !== 'PGRST116') throw error;
  return (data as { provider: string; api_key: string }) ?? null;
}

export async function saveUserPreferences(
  context: AppLoadContext,
  request: Request,
  prefs: Partial<{ selected_provider: string; selected_model: string; is_debug_enabled: boolean; default_prompt: string; theme: string }>,
) {
  const supabase = createSupabaseUserClient(request, context);
  const { data: userRes } = await supabase.auth.getUser();
  const user = userRes.user;
  if (!user) throw new Error('Not authenticated');
  const { error } = await supabase
    .from('user_preferences')
    .upsert({ user_id: user.id, ...prefs }, { onConflict: 'user_id' });
  if (error) throw error;
}

export async function getUserPreferences(context: AppLoadContext, request: Request) {
  const supabase = createSupabaseUserClient(request, context);
  const { data: userRes } = await supabase.auth.getUser();
  const user = userRes.user;
  if (!user) return null;
  const { data, error } = await supabase.from('user_preferences').select('*').eq('user_id', user.id).maybeSingle();
  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

export async function saveProviderSettings(
  context: AppLoadContext,
  request: Request,
  provider: string,
  settings: Record<string, unknown>,
) {
  const supabase = createSupabaseUserClient(request, context);
  const { data: userRes } = await supabase.auth.getUser();
  const user = userRes.user;
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('provider_settings')
    .upsert(
      {
        user_id: user.id,
        provider,
        settings,
      },
      { onConflict: 'user_id,provider' },
    );
  if (error) throw error;
}

export async function getProviderSettings(context: AppLoadContext, request: Request) {
  const supabase = createSupabaseUserClient(request, context);
  const { data: userRes } = await supabase.auth.getUser();
  const user = userRes.user;
  if (!user) return {} as Record<string, unknown>;
  const { data, error } = await supabase.from('provider_settings').select('provider, settings').eq('user_id', user.id);
  if (error) throw error;
  const map: Record<string, unknown> = {};
  for (const row of data as Array<{ provider: string; settings: unknown }>) {
    map[row.provider] = row.settings;
  }
  return map;
}

export async function updateUserProfile(
  context: AppLoadContext,
  request: Request,
  profile: { display_name?: string | null; bio?: string | null; avatar_url?: string | null },
) {
  const supabase = createSupabaseUserClient(request, context);
  const { data: userRes } = await supabase.auth.getUser();
  const user = userRes.user;
  if (!user) throw new Error('Not authenticated');
  const { error } = await supabase
    .from('users')
    .upsert({ id: user.id, email: user.email, ...profile }, { onConflict: 'id' });
  if (error) throw error;
}
