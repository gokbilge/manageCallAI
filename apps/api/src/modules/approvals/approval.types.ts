export interface ApprovalRequest {
  id: string;
  tenant_id: string;
  object_type: string;
  object_id: string;
  version_id: string | null;
  requested_by: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  created_at: Date;
}

export interface ApprovalRequestWithDetails extends ApprovalRequest {
  flow_name: string | null;
  action_type: 'publish' | 'rollback' | null;
}

export interface PendingPublishRecord {
  id: string;
  object_id: string;
  version_id: string;
  action_type: 'publish' | 'rollback';
}

export interface Policy {
  id: string;
  tenant_id: string;
  policy_type: string;
  status: string;
  rules: Record<string, unknown>;
  created_at: Date;
}

export interface ApprovalDecisionResult {
  approval_request: ApprovalRequestWithDetails;
  action_type: 'publish' | 'rollback';
  publish_result?: 'success';
}
