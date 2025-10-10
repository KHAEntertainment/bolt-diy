import { json } from '@remix-run/cloudflare';
import type { ActionFunctionArgs } from '@remix-run/cloudflare';
import { withSecurity } from '~/lib/security';
import { saveProviderToken, saveUserApiKey, saveUserPreferences, upsertUserFromAuth } from '~/lib/db/userData.server';

interface LegacyPayload {
  apiKeys?: Record<string, string>;
  providerSettings?: Record<string, any>;
  selectedProvider?: string;
  selectedModel?: string;
  isDebugEnabled?: boolean;
  defaultPrompt?: string;
  providerTokens?: Array<{ provider: string; token: string; username?: string; extra?: Record<string, unknown> }>;
  profile?: { display_name?: string; bio?: string; avatar_url?: string };
}

async function action({ request, context }: ActionFunctionArgs) {
  try {
    const payload = (await request.json()) as LegacyPayload;

    // Ensure user row exists
    await upsertUserFromAuth(context, request);

    // Save preferences
    await saveUserPreferences(context, request, {
      selected_provider: payload.selectedProvider,
      selected_model: payload.selectedModel,
      is_debug_enabled: payload.isDebugEnabled,
      default_prompt: payload.defaultPrompt,
    });

    // Save API keys
    if (payload.apiKeys) {
      for (const [provider, key] of Object.entries(payload.apiKeys)) {
        if (key) await saveUserApiKey(context, request, provider, key);
      }
    }

    // Save provider tokens
    if (payload.providerTokens) {
      for (const t of payload.providerTokens) {
        if (t.token) await saveProviderToken(context, request, t.provider, t.token, { username: t.username, extra: t.extra });
      }
    }

    return json({ migrated: true });
  } catch (error) {
    console.error('Migration failed:', error);
    return json({ error: 'Migration failed' }, { status: 500 });
  }
}

export const actionHandler = withSecurity(action as any, { allowedMethods: ['POST'], requireAuth: true, rateLimit: true });
export { actionHandler as action };
