// Shared bilingual content module.
// Both the English page tree (src/pages/*) and the Chinese page tree
// (src/pages/zh/*) read from these staged JSON files so the two language
// versions never drift apart in structure.

import hero from '../content_data/hero.json';
import research from '../content_data/research.json';
import publications from '../content_data/publications.json';
import advisors from '../content_data/advisors.json';
import site from '../content_data/site.json';
import contact from '../content_data/contact.json';

export type Lang = 'en' | 'zh';

export { hero, research, publications, advisors, site, contact };

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

/**
 * 1-based position of a publication in publications.json item order. This is
 * the [n] number shown in the list and used by Research theme references, so
 * the two can never disagree. Order is language-independent.
 */
export function pubIndex(id: string): number {
  const i = publications.en.items.findIndex((item) => item.id === id);
  return i < 0 ? 0 : i + 1;
}

/** UI strings that aren't covered by the staged JSON, kept bilingual here. */
export const ui = {
  en: {
    backToBlog: '← Back to all posts',
    blogAll: 'All posts',
    noPosts: 'No posts yet.',
    publishedOn: 'Published',
    notFoundTitle: 'Page not found',
    notFoundBody: 'The page you are looking for does not exist or may have moved.',
    notFoundBodyZh: '页面未找到：你访问的页面不存在或已被移动。',
    notFoundCta: 'Back to home',
    skipToContent: 'Skip to content',
    home: 'Home',
    minRead: 'min read',
    onThisSite: 'On this site',
    pubCorresponding: 'corresponding',
    pubAbstract: 'Abstract and scale',
    pubLinks: { pdf: 'PDF', code: 'Code', doi: 'DOI' },
    themeLight: 'Theme: light',
    themeDark: 'Theme: dark',
    themeSystem: 'Theme: system',
  },
  zh: {
    backToBlog: '← 返回全部文章',
    blogAll: '全部文章',
    noPosts: '暂无文章。',
    publishedOn: '发布于',
    notFoundTitle: '页面未找到',
    notFoundBody: '你访问的页面不存在，或者可能已被移动。',
    notFoundBodyZh: '页面未找到：你访问的页面不存在或已被移动。',
    notFoundCta: '返回首页',
    skipToContent: '跳到正文',
    home: '首页',
    minRead: '分钟阅读',
    onThisSite: '本站导航',
    pubCorresponding: '通讯作者',
    pubAbstract: '摘要与规模',
    pubLinks: { pdf: 'PDF', code: '代码', doi: 'DOI' },
    themeLight: '主题：浅色',
    themeDark: '主题：深色',
    themeSystem: '主题：跟随系统',
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

const SITE_URL = 'https://beiciccc.github.io';
const KAGGLE_URL = 'https://www.kaggle.com/beicicc';

/** JSON-LD graph for the homepage: WebSite + Person. */
export function homeJsonLd(lang: Lang): Record<string, unknown>[] {
  const s = pick(site, lang);
  const url = lang === 'zh' ? `${SITE_URL}/zh/` : `${SITE_URL}/`;
  return [
    {
      '@type': 'WebSite',
      '@id': `${SITE_URL}/#website`,
      url,
      name: s.siteTitle,
      description: s.siteDescription,
      inLanguage: htmlLang(lang),
      publisher: { '@id': `${SITE_URL}/#person` },
    },
    {
      '@type': 'Person',
      '@id': `${SITE_URL}/#person`,
      name: 'Kun Zhang',
      alternateName: '张鲲',
      url: `${SITE_URL}/`,
      email: 'mailto:kunzhang0098@gmail.com',
      jobTitle: lang === 'zh' ? '博士申请人' : 'PhD applicant',
      affiliation: { '@type': 'CollegeOrUniversity', name: 'University of Leeds' },
      knowsAbout: [
        'Large language model post-training and alignment',
        'Evaluation validity and leakage control',
        'Mechanistic interpretability',
        'Causal attribution for post-training gains',
      ],
      sameAs: ['https://github.com/Beiciccc', KAGGLE_URL],
    },
  ];
}
