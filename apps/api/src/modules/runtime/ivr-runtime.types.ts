export type RuntimeSessionStatus = 'running' | 'completed' | 'failed';

export interface IvrRuntimeSession {
  id: string;
  tenant_id: string;
  flow_id: string;
  flow_version_id: string;
  call_id: string;
  status: RuntimeSessionStatus;
  current_node_id: string | null;
  caller_number: string | null;
  destination_number: string | null;
  last_digits: string | null;
  variables_json: Record<string, string>;
  last_action_json: Record<string, unknown> | null;
  completed_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface StartIvrRuntimeSessionInput {
  call_id: string;
  flow_id: string;
  caller_number?: string;
  destination_number?: string;
  variables?: Record<string, string>;
}

export interface AdvanceIvrRuntimeSessionInput {
  node_id: string;
  outcome: 'completed' | 'digits' | 'timeout' | 'invalid';
  digits?: string;
  variables?: Record<string, string>;
}

export type IvrRuntimeAction =
  | {
      action: 'play_prompt';
      node_id: string;
      prompt_id: string;
      prompt_uri: string;
    }
  | {
      action: 'play_collect';
      node_id: string;
      prompt_id: string;
      prompt_uri: string;
      max_digits: number;
      timeout_ms: number;
      retries: number;
    }
  | {
      action: 'transfer';
      node_id: string;
      target_type: 'extension';
      target: string;
      domain: string | null;
    }
  | {
      action: 'hangup';
      node_id: string;
    };

export interface IvrRuntimeSessionResult {
  session: IvrRuntimeSession;
  action: IvrRuntimeAction | null;
}
