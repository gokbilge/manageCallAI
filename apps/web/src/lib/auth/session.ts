export type WorkspaceAccess = 'platform' | 'tenant';

export type SessionUser = {
  id: string;
  displayName: string;
  email: string;
  workspaces: WorkspaceAccess[];
  tenantName?: string;
};

export const demoSession: SessionUser = {
  id: 'user_demo_001',
  displayName: 'Demo Operator',
  email: 'owner@acme-demo.local',
  workspaces: ['platform', 'tenant'],
  tenantName: 'Acme Demo',
};
