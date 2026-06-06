import type { ActorType } from '../auth/auth-claims.js';

export interface AiActorLineage {
  actor_type: ActorType;
  tool_name?: string;
  mcp_session_id?: string;
  api_key_id?: string;
}

export interface AiChangeLineage {
  ai_assisted: true;
  actor: AiActorLineage;
  source_request_type?: 'prompt_generation' | 'ivr_ai_turn';
  source_request_id?: string;
  prompt_template_id?: string;
  prompt_summary?: string;
  normalized_input?: string;
  output_summary?: string;
  provider?: string;
  model?: string;
  risk_level?: 'low' | 'medium' | 'high';
  risk_summary?: string;
  requires_human_approval: true;
}

export function isAiLineageRecord(value: unknown): value is AiChangeLineage {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const record = value as Record<string, unknown>;
  const actor = record.actor;
  return record.ai_assisted === true
    && record.requires_human_approval === true
    && !!actor
    && typeof actor === 'object'
    && typeof (actor as Record<string, unknown>).actor_type === 'string';
}

export function readAiLineage(metadata: Record<string, unknown> | null | undefined): AiChangeLineage | null {
  if (!metadata) {
    return null;
  }

  const lineage = metadata.ai_lineage;
  return isAiLineageRecord(lineage) ? lineage : null;
}
