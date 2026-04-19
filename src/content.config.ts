import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { resumeStyleIds } from './lib/resume-style-catalog';

const resume = defineCollection({
  loader: glob({
    base: './src/content/resumes',
    pattern: '**/*.md',
  }),
  schema: z.discriminatedUnion('kind', [
    z.object({
      kind: z.literal('meta'),
      label: z.string(),
      kicker: z.string(),
      summary: z.string(),
      listed: z.boolean().default(true),
      isDefault: z.boolean().default(false),
      isMaster: z.boolean().default(false),
      styleId: z.enum(resumeStyleIds),
      hiddenSectionSlugs: z.array(z.string()).default([]),
      order: z.number(),
    }),
    z.object({
      title: z.string(),
      subtitle: z.string().optional(),
      summary: z.string().optional(),
      sectionSlug: z.string(),
      contacts: z
        .array(
          z.object({
            label: z.string().optional(),
            value: z.string().optional(),
            href: z.string().url().optional(),
          }),
        )
        .optional(),
      kind: z.literal('hero'),
      layout: z.enum(['full', 'compact']).default('full'),
      order: z.number(),
    }),
    z.object({
      title: z.string(),
      subtitle: z.string().optional(),
      summary: z.string().optional(),
      sectionSlug: z.string(),
      kind: z.literal('section'),
      hidden: z.boolean().default(false),
      layout: z.enum(['full', 'compact']).default('compact'),
      order: z.number(),
    }),
  ]),
});

export const collections = {
  resume,
};
