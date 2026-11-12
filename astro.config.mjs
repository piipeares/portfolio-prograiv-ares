import { defineConfig } from 'astro/config';
import react from '@astrojs/react';

// Sitio estático: no requiere adapter. Deploy directo en Vercel / Netlify.
export default defineConfig({
  site: 'https://portfolio-prograiv-ares.vercel.app',
  integrations: [react()],
  build: {
    inlineStylesheets: 'auto',
  },
});
