export type CallbackStatus = 'pending' | 'scheduled' | 'calling' | 'reached' | 'cancelled' | 'expired';

export interface QueueCallback {
  id: string;
  tenant_id: string;
  queue_id: string;
  caller_phone: string;
  caller_name: string | null;
  scheduled_at: string | null;
  retry_count: number;
  max_retries: number;
  status: CallbackStatus;
  created_at: Date;
  updated_at: Date;
}

export interface CreateQueueCallbackInput {
  tenant_id: string;
  queue_id: string;
  caller_phone: string;
  caller_name?: string | null;
  scheduled_at?: string | null;
  max_retries?: number;
}

export interface UpdateQueueCallbackInput {
  status?: CallbackStatus;
  scheduled_at?: string | null;
  caller_name?: string | null;
}

// Terminal statuses — no transitions out.
const TERMINAL: readonly CallbackStatus[] = ['reached', 'cancelled', 'expired'];

const VALID_TRANSITIONS: Record<CallbackStatus, CallbackStatus[]> = {
  pending: ['scheduled', 'calling', 'cancelled'],
  scheduled: ['calling', 'cancelled', 'expired'],
  calling: ['reached', 'pending', 'expired'],
  reached: [],
  cancelled: [],
  expired: [],
};

export function isValidCallbackTransition(from: CallbackStatus, to: CallbackStatus): boolean {
  return VALID_TRANSITIONS[from].includes(to);
}

export function isTerminalCallbackStatus(status: CallbackStatus): boolean {
  return (TERMINAL as CallbackStatus[]).includes(status);
}
