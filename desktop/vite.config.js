import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// The renderer has no network access of its own: all backend traffic goes through the
// Electron main process over IPC. Development additionally needs inline scripts (React
// Refresh preamble) and the Vite HMR websocket.
const PROD_CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-src 'none'",
].join('; ');

const DEV_CSP = PROD_CSP.replace("script-src 'self'", "script-src 'self' 'unsafe-inline'").replace(
  "connect-src 'self'",
  "connect-src 'self' ws://localhost:* ws://127.0.0.1:*",
);

function contentSecurityPolicy() {
  let csp = PROD_CSP;
  return {
    name: 'transformo-csp',
    configResolved(config) {
      csp = config.command === 'serve' ? DEV_CSP : PROD_CSP;
    },
    transformIndexHtml(html) {
      return html.replace(
        '<!-- CSP -->',
        `<meta http-equiv="Content-Security-Policy" content="${csp}" />`,
      );
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss(), contentSecurityPolicy()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'chrome140',
  },
  server: {
    host: '127.0.0.1',
    strictPort: false,
  },
});
