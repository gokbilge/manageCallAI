export interface SetupCompleteBody {
  tenantName?: string;
  tenantSlug?: string;
  adminEmail: string;
  adminPassword: string;
  jwtSecret?: string;
  runtimeApiToken?: string;
  sipSecretMasterKey?: string;
  freeswitch?: {
    eslHost: string;
    eslPort: number;
    eslPassword: string;
  };
}

export interface SetupValidateBody {
  type: 'db' | 'esl';
  eslHost?: string;
  eslPort?: number;
  eslPassword?: string;
}

export interface SetupStatus {
  isComplete: boolean;
  pendingMigrations: number;
}

export interface HeadlessBootstrapVars {
  tenantName: string;
  tenantSlug: string;
  adminEmail: string;
  adminPassword: string;
}

export interface SetupCompletionResult {
  tenantId: string;
  tenantSlug: string;
  adminEmail: string;
}
