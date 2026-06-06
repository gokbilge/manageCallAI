import { z } from '../registry.js';

export const ArtifactTypeSchema = z.enum(['recording', 'note', 'disposition']);
export type ArtifactType = z.infer<typeof ArtifactTypeSchema>;

export const ArtifactSearchResultSchema = z.object({
  artifact_type: ArtifactTypeSchema,
  call_id: z.string(),
  artifact_id: z.string().uuid(),
  recorded_at: z.string().datetime().nullable(),
  match_context: z.string(),
  match_score: z.number(),
  is_advisory: z.literal(true),
}).openapi('ArtifactSearchResult');
export type ArtifactSearchResult = z.infer<typeof ArtifactSearchResultSchema>;

export const ArtifactSearchBodySchema = z.object({
  query: z.string().min(1).max(500),
  filter: z.object({
    from_date: z.string().datetime().optional(),
    to_date: z.string().datetime().optional(),
    call_id: z.string().optional(),
    artifact_types: z.array(ArtifactTypeSchema).optional(),
  }).optional(),
  limit: z.number().int().min(1).max(100).optional(),
}).openapi('ArtifactSearchBody');
export type ArtifactSearchBody = z.infer<typeof ArtifactSearchBodySchema>;
