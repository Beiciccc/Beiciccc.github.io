import type { Lang } from './content';

/**
 * Split running text into display words for staggered or scroll-lit type.
 *
 * Whitespace comes back as ' ' tokens, to be rendered as plain spaces
 * between the word spans, so line breaking and copy-paste are unchanged.
 * Chinese has no spaces: it is segmented with Intl.Segmenter, and
 * punctuation is glued to its neighbour (closing marks to the word before,
 * opening marks to the word after) so no line can start with a closing mark.
 */
export function splitWords(text: string, lang: Lang): string[] {
  if (lang !== 'zh') {
    return text
      .split(/(\s+)/)
      .filter(Boolean)
      .map((tok) => (/^\s+$/.test(tok) ? ' ' : tok));
  }

  const parts: { segment: string; isWordLike?: boolean }[] =
    typeof Intl.Segmenter === 'function'
      ? Array.from(new Intl.Segmenter('zh-Hans', { granularity: 'word' }).segment(text))
      : Array.from(text, (ch) => ({ segment: ch, isWordLike: /[\p{L}\p{N}]/u.test(ch) }));

  const out: string[] = [];
  let opening = '';
  for (const { segment, isWordLike } of parts) {
    if (/^\s+$/.test(segment)) {
      out.push(' ');
      continue;
    }
    if (!isWordLike && /^[「『（(“‘《〈【]+$/.test(segment)) {
      opening += segment;
      continue;
    }
    const prev = out.length ? out[out.length - 1] : ' ';
    if (!isWordLike && prev !== ' ') {
      out[out.length - 1] = prev + segment;
    } else {
      out.push(opening + segment);
      opening = '';
    }
  }
  if (opening) out.push(opening);
  return out;
}
