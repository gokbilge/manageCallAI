import type { Pool } from 'pg';
import type { ArtifactSearchFilter } from './supervisor-artifact-search.types.js';

export interface RawRecordingArtifactRow {
  call_id: string;
  artifact_id: string;
  recorded_at: Date | null;
  transcript_text: string | null;
  summary_text: string | null;
}

export interface RawNoteRow {
  call_id: string;
  artifact_id: string;
  recorded_at: Date | null;
  content: string;
}

export interface RawDispositionRow {
  call_id: string;
  artifact_id: string;
  recorded_at: Date | null;
  code: string;
  label: string;
  note: string | null;
}

export class SupervisorArtifactSearchRepository {
  constructor(private readonly db: Pool) {}

  async searchRecordings(
    tenantId: string,
    query: string,
    filter: ArtifactSearchFilter,
    limit: number,
  ): Promise<RawRecordingArtifactRow[]> {
    const conditions = [`r.tenant_id = $1`, `r.status != 'deleted'`];
    const params: unknown[] = [tenantId, limit];
    let idx = 3;
    if (filter.from_date) { conditions.push(`r.recorded_at >= $${idx}`); params.push(filter.from_date); idx++; }
    if (filter.to_date)   { conditions.push(`r.recorded_at <= $${idx}`); params.push(filter.to_date);   idx++; }
    if (filter.call_id)   { conditions.push(`r.call_id = $${idx}`);      params.push(filter.call_id);   idx++; }

    const likePattern = `%${query.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_')}%`;
    params.push(likePattern);
    const likeIdx = idx;

    const result = await this.db.query<RawRecordingArtifactRow>(
      `SELECT r.call_id, r.id AS artifact_id, r.recorded_at, ra.transcript_text, ra.summary_text
       FROM call_recordings r
       JOIN recording_analysis_requests ra
         ON ra.recording_id = r.id AND ra.tenant_id = r.tenant_id AND ra.status = 'completed'
       WHERE ${conditions.join(' AND ')}
         AND (ra.transcript_text ILIKE $${likeIdx} OR ra.summary_text ILIKE $${likeIdx})
       ORDER BY r.recorded_at DESC
       LIMIT $2`,
      params,
    );
    return result.rows;
  }

  async searchNotes(
    tenantId: string,
    query: string,
    filter: ArtifactSearchFilter,
    limit: number,
  ): Promise<RawNoteRow[]> {
    const conditions = [`cn.tenant_id = $1`];
    const params: unknown[] = [tenantId, limit];
    let idx = 3;
    if (filter.call_id)   { conditions.push(`cn.call_id = $${idx}`);       params.push(filter.call_id);   idx++; }
    if (filter.from_date) { conditions.push(`cn.created_at >= $${idx}`);   params.push(filter.from_date); idx++; }
    if (filter.to_date)   { conditions.push(`cn.created_at <= $${idx}`);   params.push(filter.to_date);   idx++; }

    const likePattern = `%${query.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_')}%`;
    params.push(likePattern);
    const likeIdx = idx;

    const result = await this.db.query<RawNoteRow>(
      `SELECT cn.call_id, cn.id AS artifact_id, cn.created_at AS recorded_at, cn.content
       FROM call_notes cn
       WHERE ${conditions.join(' AND ')} AND cn.content ILIKE $${likeIdx}
       ORDER BY cn.created_at DESC
       LIMIT $2`,
      params,
    );
    return result.rows;
  }

  async searchDispositions(
    tenantId: string,
    query: string,
    filter: ArtifactSearchFilter,
    limit: number,
  ): Promise<RawDispositionRow[]> {
    const conditions = [`cd.tenant_id = $1`];
    const params: unknown[] = [tenantId, limit];
    let idx = 3;
    if (filter.call_id)   { conditions.push(`cd.call_id = $${idx}`);       params.push(filter.call_id);   idx++; }
    if (filter.from_date) { conditions.push(`cd.created_at >= $${idx}`);   params.push(filter.from_date); idx++; }
    if (filter.to_date)   { conditions.push(`cd.created_at <= $${idx}`);   params.push(filter.to_date);   idx++; }

    const likePattern = `%${query.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_')}%`;
    params.push(likePattern);
    const likeIdx = idx;

    const result = await this.db.query<RawDispositionRow>(
      `SELECT cd.call_id, cd.id AS artifact_id, cd.created_at AS recorded_at,
              dc.code, dc.label, cd.note
       FROM call_dispositions cd
       JOIN disposition_codes dc ON dc.id = cd.disposition_code_id
       WHERE ${conditions.join(' AND ')}
         AND (dc.code ILIKE $${likeIdx} OR dc.label ILIKE $${likeIdx} OR cd.note ILIKE $${likeIdx})
       ORDER BY cd.created_at DESC
       LIMIT $2`,
      params,
    );
    return result.rows;
  }
}
