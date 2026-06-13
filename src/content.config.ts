import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

// Astro 5 content collections: the glob loader reads Markdown files from disk.
// `base` is the directory the pattern is resolved against; `pattern` selects files.
const blog = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/blog' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.coerce.date(),
    lang: z.enum(['en', 'zh']),
    tags: z.array(z.string()).optional(),
    draft: z.boolean().optional().default(false),
  }),
});

export const collections = { blog };
