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

/** Short venue name for references: "LUHME 2026, workshop at EMNLP 2026" → "LUHME". */
export function venueShort(venue: string): string {
  return venue.split(/[,，]\s*/)[0].replace(/\s*\d{4}$/, '');
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
    notFoundCta: 'Back to home',
    notFoundAlt: 'Chinese site',
    skipToContent: 'Skip to content',
    home: 'Home',
    minRead: 'min read',
    onThisSite: 'On this site',
    pubCorresponding: 'corresponding',
    pubAbstract: 'Abstract',
    pubLinks: { pdf: 'PDF', code: 'Code', doi: 'DOI', request: 'PDF on request', requestSubject: 'PDF request: ' },
    themeLight: 'Theme: light',
    themeDark: 'Theme: dark',
    themeSystem: 'Theme: system',
    // Ornamental apparatus of the redesigned homepage (numerals, eyebrows, stats).
    eyebrow: {
      publications: 'First-author papers · 2026',
      research: 'Research',
      about: 'Education and service',
      contact: 'Get in touch',
    },
    stats: {
      accepted: 'First-author papers accepted in 2026',
      oral: 'Oral presentations',
      underReview: 'Under review · Phase 2',
      reviewer: 'Reviewer roles, 2026',
    },
    oral: 'Oral',
    oralSplit: (m: number, w: number) => `${m} conference · ${w} workshop`,
    relatedPapers: 'Papers',
    sealedTitle: 'Details withheld during anonymous review',
    colophon: 'Set in Cormorant, Source Serif 4 and Source Sans 3.',
    toTop: 'Back to top',
    crestAlt: 'University of Leeds',
    motionPause: 'Pause motion',
    motionResume: 'Resume motion',
  },
  zh: {
    backToBlog: '← 返回全部文章',
    blogAll: '全部文章',
    noPosts: '暂无文章。',
    publishedOn: '发布于',
    notFoundTitle: '页面未找到',
    notFoundBody: '你访问的页面不存在，或者可能已被移动。',
    notFoundCta: '返回首页',
    notFoundAlt: '英文站',
    skipToContent: '跳到正文',
    home: '首页',
    minRead: '分钟阅读',
    onThisSite: '本站导航',
    pubCorresponding: '通讯作者',
    pubAbstract: '摘要',
    pubLinks: { pdf: 'PDF', code: '代码', doi: 'DOI', request: '索取 PDF', requestSubject: '索取论文 PDF：' },
    themeLight: '主题：浅色',
    themeDark: '主题：深色',
    themeSystem: '主题：跟随系统',
    eyebrow: {
      publications: '第一作者论文 · 2026',
      research: '研究方向',
      about: '教育与学术服务',
      contact: '联系方式',
    },
    stats: {
      // No-break after the year, a break opportunity after 年 (keep-all labels).
      accepted: '2026\u00a0年\u200b第一作者论文录用',
      oral: '口头报告',
      underReview: '在投 · 第二阶段评审',
      reviewer: '2026\u00a0年审稿服务',
    },
    oral: '口头报告',
    oralSplit: (m: number, w: number) => `会议 ${m} · 研讨会 ${w}`,
    relatedPapers: '相关论文',
    sealedTitle: '匿名评审期间暂不公开细节',
    colophon: '西文字体 Cormorant、Source Serif 4 与 Source Sans 3；中文标题 Noto Serif SC，正文使用系统黑体。',
    toTop: '回到顶部',
    crestAlt: '利兹大学',
    motionPause: '暂停动效',
    motionResume: '恢复动效',
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
      // The Chinese name is declared from the Chinese page only: English
      // pages carry no Chinese script. Same @id, so crawlers merge the two.
      ...(lang === 'zh' ? { alternateName: '张鲲' } : {}),
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
