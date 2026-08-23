import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const blog = defineCollection({
  loader: glob({ base: './src/content/blog', pattern: '**/*.md' }),
  schema: z.object({
    title: z.string(),
    /**
     * A shorter title for the <title> tag and the browser tab, for posts whose
     * headline is longer than a search result can show. The headline on the
     * page is always `title`; this only changes what a crawler is handed.
     */
    seoTitle: z.string().max(62).optional(),
    description: z.string().max(165),
    date: z.coerce.date(),
    /**
     * The canonical URL, carried over verbatim from the Jekyll site so that no
     * published address ever changes. Always begins and ends with a slash.
     */
    permalink: z
      .string()
      .regex(/^\/posts\/\d{4}\/\d{2}\/[a-z0-9-]+\/$/, 'permalink must look like /posts/YYYY/MM/slug/'),
    /**
     * The language this file is written in. English files sit in the collection
     * root and carry no prefix in their URL; a translation sits in a folder
     * named after its language and is served under `/<lang>` + the same
     * permalink, so the two versions of a post are always one prefix apart.
     */
    lang: z.enum(['en', 'bn', 'ar']).default('en'),
    tags: z.array(z.string()).default([]),
    /** Multi-part runs are grouped and cross-linked by these two fields. */
    series: z.string().optional(),
    seriesOrder: z.number().int().positive().optional(),
    /** Loads the KaTeX stylesheet only on the pages that contain maths. */
    math: z.boolean().default(false),
    draft: z.boolean().default(false),
  }),
});

export const collections = { blog };
