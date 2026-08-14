// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// USER/ORG GitHub Pages site served at the domain ROOT.
// Repo: Beiciccc/Beiciccc.github.io  ->  https://beiciccc.github.io
// GitHub Pages always serves at the all-lowercase host, so `site` must be
// lowercase to keep canonical/og/hreflang URLs byte-consistent.
// Because it is served at the root, do NOT set `base`; it stays '/'.
export default defineConfig({
  site: 'https://beiciccc.github.io',
  integrations: [sitemap()],
  i18n: {
    defaultLocale: 'en',
    locales: ['en', 'zh'],
    routing: {
      // English is the default locale and is served with no prefix (/).
      // Chinese lives under /zh/.
      prefixDefaultLocale: false,
    },
  },
});
