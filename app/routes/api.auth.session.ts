import { json } from '@remix-run/cloudflare';
import type { ActionFunctionArgs } from '@remix-run/cloudflare';
import { withSecurity } from '~/lib/security';
import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE, createSupabaseServerClient } from '~/lib/auth/supabase.server';

function buildCookie(name: string, value: string, maxAgeSeconds?: number) {
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    'Path=/',
    'HttpOnly',
    process.env.NODE_ENV === 'production' ? 'Secure' : '',
    'SameSite=Lax',
    maxAgeSeconds ? `Max-Age=${maxAgeSeconds}` : '',
  ].filter(Boolean);
  return parts.join('; ');
}

async function action({ request, context }: ActionFunctionArgs) {
  const url = new URL(request.url);

  if (request.method === 'DELETE') {
    return new Response(null, {
      status: 204,
      headers: {
        'Set-Cookie': [
          buildCookie(ACCESS_TOKEN_COOKIE, '', 0),
          buildCookie(REFRESH_TOKEN_COOKIE, '', 0),
        ].join(', '),
      },
    });
  }

  // Expect JSON body with { access_token, refresh_token, expires_in }
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, { status: 405 });
  }

  const { access_token, refresh_token, expires_in } = (await request.json().catch(() => ({}))) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
  };

  if (!access_token || !refresh_token) {
    return json({ error: 'Missing tokens' }, { status: 400 });
  }

  // Registration lock enforcement
  try {
    // @ts-expect-error Cloudflare env in Remix context
    const env = (context as any)?.cloudflare?.env ?? process.env;
    const registrationEnabled = String(env.USER_REGISTRATION_ENABLED ?? 'true').toLowerCase() !== 'false';
    const primaryAdmins = String(env.PRIMARY_ADMINS ?? '')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);

    const supabase = createSupabaseServerClient(context as any);
    const { data, error } = await supabase.auth.getUser(access_token);

    if (error || !data?.user) {
      return json({ error: 'Invalid Supabase access token' }, { status: 401 });
    }

    const email = (data.user.email || '').toLowerCase();

    if (!registrationEnabled) {
      // When locked, only allow primary admins to log in
      if (!email || !primaryAdmins.includes(email)) {
        return json({ error: 'Registration disabled' }, { status: 401 });
      }
    }
  } catch (err) {
    return json({ error: 'Auth verification failed' }, { status: 401 });
  }

  const headers = new Headers();
  headers.append('Set-Cookie', buildCookie(ACCESS_TOKEN_COOKIE, access_token, expires_in ?? 3600));
  headers.append('Set-Cookie', buildCookie(REFRESH_TOKEN_COOKIE, refresh_token, 60 * 60 * 24 * 30));

  return new Response(null, { status: 204, headers });
}

export const actionHandler = withSecurity(action as any, { allowedMethods: ['POST', 'DELETE'], rateLimit: true });

export { actionHandler as action };
