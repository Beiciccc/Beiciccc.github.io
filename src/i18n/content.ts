// Shared bilingual content module.
// Both the English page tree (src/pages/*) and the Chinese page tree
// (src/pages/zh/*) read from these staged JSON files so the two language
// versions never drift apart in structure.

import hero from '../content_data/hero.json';
import research from '../content_data/research.json';
import projects from '../content_data/projects.json';
import site from '../content_data/site.json';
import contact from '../content_data/contact.json';

export type Lang = 'en' | 'zh';

export { hero, research, projects, site, contact };

/** Pick the language-keyed branch of a `{ en, zh }` content object. */
export function pick<T>(obj: { en: T; zh: T }, lang: Lang): T {
  return obj[lang];
}

/** Locale-aware path helper. EN is served at the root, ZH under /zh/. */
export function localePath(lang: Lang, path = '/'): string {
  const clean = path.startsWith('/') ? path : `/${path}`;
  if (lang === 'zh') {
    return clean === '/' ? '/zh/' : `/zh${clean}`;
  }
  return clean;
}

/**
 * Clean base slug for a blog entry, shared by both language versions.
 *
 * Astro 5's glob loader slugifies the `id` and strips the dots, so
 * `hello-bilingual-astro.en.md` becomes the id `hello-bilingual-astroen`,
 * which is NOT a usable slug. The entry's `filePath` keeps the true filename,
 * so we derive the slug from there: take the basename, drop the `.md`
 * extension and the `.en` / `.zh` language suffix.
 */
export function baseSlug(filePath: string | undefined): string {
  if (!filePath) return '';
  const base = filePath.split('/').pop() ?? filePath;
  return base.replace(/\.md$/i, '').replace(/\.(en|zh)$/i, '');
}

/** UI strings that aren't covered by the staged JSON, kept bilingual here. */
export const ui = {
  en: {
    backToBlog: '← Back to all posts',
    blogAll: 'All posts',
    publishedOn: 'Published',
    notFoundTitle: 'Page not found',
    notFoundBody: "The page you're looking for doesn't exist or may have moved.",
    notFoundCta: 'Back to home',
    skipToContent: 'Skip to content',
    home: 'Home',
    minRead: 'min read',
    onThisSite: 'On this site',
  },
  zh: {
    backToBlog: '← 返回全部文章',
    blogAll: '全部文章',
    publishedOn: '发布于',
    notFoundTitle: '页面未找到',
    notFoundBody: '你访问的页面不存在，或者可能已被移动。',
    notFoundCta: '返回首页',
    skipToContent: '跳到正文',
    home: '首页',
    minRead: '分钟阅读',
    onThisSite: '本站导航',
  },
} as const;

/** Locale tag for the <html lang> attribute. */
export function htmlLang(lang: Lang): string {
  return lang === 'zh' ? 'zh-Hans' : 'en';
}

/** Format a pubDate for display, locale-aware. */
export function formatDate(date: Date, lang: Lang): string {
  return new Intl.DateTimeFormat(lang === 'zh' ? 'zh-CN' : 'en-GB', {
    year: 'numeric',
    month: lang === 'zh' ? 'long' : 'short',
    day: 'numeric',
  }).format(date);
}
