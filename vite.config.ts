import fs from 'node:fs';
import path from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { defineConfig, loadEnv } from 'vite';

const devPfxPath = path.resolve(__dirname, './.cert/localhost-dev.pfx');

function getProtocol(value?: string): string | null {
  if (!value) return null;

  try {
    return new URL(value).protocol;
  } catch {
    return null;
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, __dirname, '');
  const supabaseProtocol = getProtocol(env.VITE_SUPABASE_URL);
  const canUseHttps = fs.existsSync(devPfxPath) && supabaseProtocol !== 'http:';
  const httpsConfig = canUseHttps
    ? {
        pfx: fs.readFileSync(devPfxPath),
        passphrase: 'faderzero-dev',
      }
    : undefined;

  if (fs.existsSync(devPfxPath) && supabaseProtocol === 'http:') {
    console.warn(
      'Vite HTTPS disabled because VITE_SUPABASE_URL uses HTTP. This avoids browser mixed-content blocking during local development.'
    );
  }

  return {
    server: {
      host: true,
      port: 5173,
      https: httpsConfig,
    },
    preview: {
      host: true,
      port: 4173,
      https: httpsConfig,
    },
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.svg'],
        manifest: {
          name: 'FaderZero PWA',
          short_name: 'FaderZero',
          description: 'Workspace offline-first pour morceaux, setlists et prompteur.',
          theme_color: '#151312',
          background_color: '#151312',
          display: 'fullscreen',
          start_url: '/',
          scope: '/',
          icons: [
            {
              src: '/favicon.svg',
              sizes: 'any',
              type: 'image/svg+xml',
              purpose: 'any',
            },
          ],
        },
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
  };
});
