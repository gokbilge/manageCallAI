import type { Pool } from 'pg';
import type { RecordingSearchFilter } from './recording-search.types.js';

export interface RawSearchRow {
  recording_id: string;
  call_id: string;
  recorded_at: Date;
  duration_secs: number | null;
  transcript_text: string | null;
  summary_text: string | null;
  transcript_rank: number;
  summary_rank: number;
  transcript_headline: string | null;
  summary_headline: string | null;
}

export interface RawLexicalRow {
  recording_id: string;
  call_id: string;
  recorded_at: Date;
  duration_secs: number | null;
  transcript_text: string | null;
  summary_text: string | null;
}

export class RecordingSearchRepository {
  constructor(private readonly db: Pool) {}

  async searchFts(
    tenantId: string,
    query: string,
    filter: RecordingSearchFilter,
    limit: number,
  ): Promise<RawSearchRow[]> {
    const conditions: string[] = ['r.tenant_id = $1', 'r.status != \'deleted\''];
    const params: unknown[] = [tenantId, query, limit];
    let idx = 4;

    if (filter.from_date) { conditions.push(`r.recorded_at >= $${idx}`); params.push(filter.from_date); idx++; }
    if (filter.to_date)   { conditions.push(`r.recorded_at <= $${idx}`); params.push(filter.to_date);   idx++; }
    if (filter.call_id)   { conditions.push(`r.call_id = $${idx}`);      params.push(filter.call_id);   idx++; }

    const whereClause = conditions.join(' AND ');
    const ftsCondition = `(
      to_tsvector('english', coalesce(ra.transcript_text, '')) @@ plainto_tsquery('english', $2)
      OR
      to_tsvector('english', coalesce(ra.summary_text, '')) @@ plainto_tsquery('english', $2)
    )`;

    const result = await this.db.query<RawSearchRow>(
      `SELECT
         r.id AS recording_id,
         r.call_id,
         r.recorded_at,
         r.duration_secs,
         ra.transcript_text,
         ra.summary_text,
         ts_rank_cd(to_tsvector('english', coalesce(ra.transcript_text, '')), plainto_tsquery('english', $2)) AS transcript_rank,
         ts_rank_cd(to_tsvector('english', coalesce(ra.summary_text, '')), plainto_tsquery('english', $2)) AS summary_rank,
         ts_headline('english', coalesce(ra.transcript_text, ''), plainto_tsquery('english', $2),
           'MaxFragments=1,MaxWords=20,MinWords=5,StartSel=<<,StopSel=>>') AS transcript_headline,
         ts_headline('english', coalesce(ra.summary_text, ''), plainto_tsquery('english', $2),
           'MaxFragments=1,MaxWords=20,MinWords=5,StartSel=<<,StopSel=>>') AS summary_headline
       FROM call_recordings r
       JOIN recording_analysis_requests ra
         ON ra.recording_id = r.id AND ra.tenant_id = r.tenant_id AND ra.status = 'completed'
       WHERE ${whereClause} AND ${ftsCondition}
       ORDER BY GREATEST(
         ts_rank_cd(to_tsvector('english', coalesce(ra.transcript_text, '')), plainto_tsquery('english', $2)),
         ts_rank_cd(to_tsvector('english', coalesce(ra.summary_text, '')), plainto_tsquery('english', $2))
       ) DESC
       LIMIT $3`,
      params,
    );
    return result.rows;
  }

  async searchLexical(
    tenantId: string,
    query: string,
    filter: RecordingSearchFilter,
    limit: number,
  ): Promise<RawLexicalRow[]> {
    const likePattern = `%${query.replace(/%/g, '\\%').replace(/_/g, '\\_')}%`;
    const conditions: string[] = ['r.tenant_id = $1', 'r.status != \'deleted\''];
    const params: unknown[] = [tenantId, likePattern, limit];
    let idx = 4;

    if (filter.from_date) { conditions.push(`r.recorded_at >= $${idx}`); params.push(filter.from_date); idx++; }
    if (filter.to_date)   { conditions.push(`r.recorded_at <= $${idx}`); params.push(filter.to_date);   idx++; }
    if (filter.call_id)   { conditions.push(`r.call_id = $${idx}`);      params.push(filter.call_id);   idx++; }

    const whereClause = conditions.join(' AND ');

    const result = await this.db.query<RawLexicalRow>(
      `SELECT
         r.id AS recording_id,
         r.call_id,
         r.recorded_at,
         r.duration_secs,
         ra.transcript_text,
         ra.summary_text
       FROM call_recordings r
       JOIN recording_analysis_requests ra
         ON ra.recording_id = r.id AND ra.tenant_id = r.tenant_id AND ra.status = 'completed'
       WHERE ${whereClause}
         AND (ra.transcript_text ILIKE $2 OR ra.summary_text ILIKE $2)
       ORDER BY r.recorded_at DESC
       LIMIT $3`,
      params,
    );
    return result.rows;
  }
}
