import { useStore } from '@nanostores/react';
import type { LinksFunction } from '@remix-run/cloudflare';
import { Links, Meta, Outlet, Scripts, ScrollRestoration } from '@remix-run/react';
import tailwindReset from '@unocss/reset/tailwind-compat.css?url';
import { themeStore } from './lib/stores/theme';
import { stripIndents } from './utils/stripIndent';
import { createHead } from 'remix-island';
import { useEffect } from 'react';
import { supabase } from '~/lib/auth/supabase.client';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { ClientOnly } from 'remix-utils/client-only';

import reactToastifyStyles from 'react-toastify/dist/ReactToastify.css?url';
import globalStyles from './styles/index.scss?url';
import xtermStyles from '@xterm/xterm/css/xterm.css?url';

import 'virtual:uno.css';

export const links: LinksFunction = () => [
  {
    rel: 'icon',
    href: '/favicon.svg',
    type: 'image/svg+xml',
  },
  { rel: 'stylesheet', href: reactToastifyStyles },
  { rel: 'stylesheet', href: tailwindReset },
  { rel: 'stylesheet', href: globalStyles },
  { rel: 'stylesheet', href: xtermStyles },
  {
    rel: 'preconnect',
    href: 'https://fonts.googleapis.com',
  },
  {
    rel: 'preconnect',
    href: 'https://fonts.gstatic.com',
    crossOrigin: 'anonymous',
  },
  {
    rel: 'stylesheet',
    href: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap',
  },
];

const inlineThemeCode = stripIndents`
  setTutorialKitTheme();

  function setTutorialKitTheme() {
    let theme = localStorage.getItem('bolt_theme');

    if (!theme) {
      theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }

    document.querySelector('html')?.setAttribute('data-theme', theme);
  }
`;

export const Head = createHead(() => (
  <>
    <meta charSet="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <Meta />
    <Links />
    <script dangerouslySetInnerHTML={{ __html: inlineThemeCode }} />
  </>
));

export function Layout({ children }: { children: React.ReactNode }) {
  const theme = useStore(themeStore);

  useEffect(() => {
    document.querySelector('html')?.setAttribute('data-theme', theme);
  }, [theme]);

  return (
    <>
      <ClientOnly>{() => <DndProvider backend={HTML5Backend}>{children}</DndProvider>}</ClientOnly>
      <ScrollRestoration />
      <Scripts />
    </>
  );
}

import { logStore } from './lib/stores/logs';

export default function App() {
  const theme = useStore(themeStore);

  useEffect(() => {
    logStore.logSystem('Application initialized', {
      theme,
      platform: navigator.platform,
      userAgent: navigator.userAgent,
      timestamp: new Date().toISOString(),
    });

    // Initialize debug logging with improved error handling
    import('./utils/debugLogger')
      .then(({ debugLogger }) => {
        /*
         * The debug logger initializes itself and starts disabled by default
         * It will only start capturing when enableDebugMode() is called
         */
        const status = debugLogger.getStatus();
        logStore.logSystem('Debug logging ready', {
          initialized: status.initialized,
          capturing: status.capturing,
          enabled: status.enabled,
        });
      })
      .catch((error) => {
        logStore.logError('Failed to initialize debug logging', error);
      });
  }, []);

  // Sync Supabase auth state to server HttpOnly cookies
  useEffect(() => {
    const { data: subscription } = supabase.auth.onAuthStateChange(async (event, session) => {
      try {
        if (session?.access_token && session?.refresh_token) {
          const res = await fetch('/api/auth/session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              access_token: session.access_token,
              refresh_token: session.refresh_token,
              expires_in: session.expires_in ?? 3600,
            }),
          });
          if (!res.ok) {
            // Server rejected (e.g., registration locked): sign out client
            await supabase.auth.signOut();
          } else {
            // Trigger one-time legacy migration if not already done
            try {
              const migratedFlag = localStorage.getItem('legacy_migrated');
              if (!migratedFlag) {
                const legacy = collectLegacyState();
                await fetch('/api/migrate-legacy', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(legacy),
                });
                clearLegacyState();
                localStorage.setItem('legacy_migrated', 'true');
              }
            } catch (e) {
              console.warn('Legacy migration skipped/failed:', e);
            }
          }
        } else if (event === 'SIGNED_OUT') {
          await fetch('/api/auth/session', { method: 'DELETE' });
        }
      } catch (error) {
        console.error('Failed to sync auth session:', error);
      }
    });

    return () => {
      subscription.subscription.unsubscribe();
    };
  }, []);

  function collectLegacyState() {
    const payload: any = {};
    try {
      // Cookies to map
      const cookieMap: Record<string, string> = {};
      document.cookie.split(';').forEach((c) => {
        const [k, ...rest] = c.trim().split('=');
        if (k) cookieMap[k] = decodeURIComponent(rest.join('='));
      });
      if (cookieMap.apiKeys) payload.apiKeys = JSON.parse(cookieMap.apiKeys);
      if (cookieMap.providers) payload.providerSettings = JSON.parse(cookieMap.providers);
      if (cookieMap.selectedProvider) payload.selectedProvider = cookieMap.selectedProvider;
      if (cookieMap.selectedModel) payload.selectedModel = cookieMap.selectedModel;
      if (cookieMap.isDebugEnabled) payload.isDebugEnabled = cookieMap.isDebugEnabled === 'true';
      if (cookieMap.cachedPrompt) payload.defaultPrompt = cookieMap.cachedPrompt;

      const providerTokens: Array<{ provider: string; token: string; username?: string; extra?: any }> = [];
      if (cookieMap.githubToken)
        providerTokens.push({ provider: 'github', token: cookieMap.githubToken, username: cookieMap.githubUsername });
      if (cookieMap['git:github.com'])
        providerTokens.push({ provider: 'github', token: cookieMap['git:github.com'], extra: { raw: cookieMap['git:github.com'] } });
      if (cookieMap.gitlabToken)
        providerTokens.push({ provider: 'gitlab', token: cookieMap.gitlabToken, extra: { url: cookieMap.gitlabUrl } });
      if (cookieMap.VITE_VERCEL_ACCESS_TOKEN)
        providerTokens.push({ provider: 'vercel', token: cookieMap.VITE_VERCEL_ACCESS_TOKEN });
      if (cookieMap.netlifyToken) providerTokens.push({ provider: 'netlify', token: cookieMap.netlifyToken });
      if (providerTokens.length) payload.providerTokens = providerTokens;

      // localStorage profile
      const boltProfile = localStorage.getItem('bolt_profile');
      if (boltProfile) {
        const p = JSON.parse(boltProfile);
        payload.profile = { display_name: p.username || null, bio: p.bio || null, avatar_url: p.avatar || null };
      }
    } catch {}
    return payload;
  }

  function clearLegacyState() {
    try {
      const toClear = [
        'apiKeys',
        'providers',
        'selectedProvider',
        'selectedModel',
        'isDebugEnabled',
        'cachedPrompt',
        'githubToken',
        'githubUsername',
        'git:github.com',
        'gitlabToken',
        'gitlabUrl',
        'VITE_VERCEL_ACCESS_TOKEN',
        'netlifyToken',
      ];
      toClear.forEach((k) => {
        document.cookie = `${k}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
      });
      localStorage.removeItem('bolt_profile');
    } catch {}
  }

  return (
    <Layout>
      <Outlet />
    </Layout>
  );
}
