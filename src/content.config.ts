import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { resumeStyleIds } from './lib/resume-style-catalog';

const resumeSummarySchema = z.preprocess((value) => {
  if (value == null) {
    return undefined;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }

  if (Array.isArray(value)) {
    return value
      .filter((item): item is string => typeof item === 'string')
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  }

  return value;
}, z.union([z.string(), z.array(z.string())]).optional());

const resumeKickerSchema = z.preprocess((value) => {
  if (value == null) {
    return undefined;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }

  return value;
}, z.string().optional());

const resume = defineCollection({
  loader: glob({
    base: './src/content/resumes',
    pattern: '**/*.md',
  }),
  schema: z.discriminatedUnion('kind', [
    z.object({
      kind: z.literal('meta'),
      label: z.string(),
      kicker: resumeKickerSchema,
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
      summary: resumeSummarySchema,
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
      summary: resumeSummarySchema,
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
