import { createHash } from 'node:crypto';
import react from '@vitejs/plugin-react';
import { loadEnv, type Plugin } from 'vite';
import { defineConfig } from 'vitest/config';

const MOOD_API = 'https://moodforecastai-production.up.railway.app';

/**
 * A Content-Security-Policy for the built page. GitHub Pages cannot send headers,
 * so it goes in a meta tag. Build only: the dev server's React preamble is an
 * inline script, which this policy would block.
 */
function contentSecurityPolicy(moodApi: string): Plugin {
  return {
    name: 'content-security-policy',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(html) {
        // The first-paint styles in index.html are allowed by their hashes, not by 'unsafe-inline'
        const styles = [...html.matchAll(/<style>([\s\S]*?)<\/style>/g)].map(
          ([, css]) => `'sha256-${createHash('sha256').update(css).digest('base64')}'`,
        );
        const policy = [
          "default-src 'none'",
          "script-src 'self'",
          `style-src 'self' ${styles.join(' ')}`,
          "font-src 'self' data:",
          "img-src 'self' data:",
          // The mood command's live calls
          `connect-src 'self' ${new URL(moodApi).origin}`,
          "object-src 'none'",
          "base-uri 'self'",
          "form-action 'none'",
          "require-trusted-types-for 'script'",
        ].join('; ');
        return html.replace('<meta charset="UTF-8" />', `$&\n    <meta http-equiv="Content-Security-Policy" content="${policy}" />`);
      },
    },
  };
}

export default defineConfig(({ mode }) => ({
  // Relative asset paths, so the same build works on GitHub Pages
  // (served from /KathFK1234/) and on a root domain.
  base: './',
  plugins: [react(), contentSecurityPolicy(loadEnv(mode, process.cwd(), 'VITE_').VITE_MOOD_API || MOOD_API)],
  test: {
    environment: 'node',
  },
}));
