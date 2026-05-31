import { useAuth } from '@/lib/auth/use-auth';
import { CAPABILITIES, hasCapability } from '@/lib/permissions/capabilities';

export type BuilderCapabilities = {
  canEdit: boolean;
  canValidate: boolean;
  canSimulate: boolean;
  canPublish: boolean;
  canRollback: boolean;
};

export function useBuilderCapability(): BuilderCapabilities {
  const { session } = useAuth();
  const role = session?.claims.role;

  return {
    canEdit: hasCapability(role, CAPABILITIES.TENANT_IVR_FLOWS_UPDATE),
    canValidate: hasCapability(role, CAPABILITIES.TENANT_IVR_FLOWS_VALIDATE),
    canSimulate: hasCapability(role, CAPABILITIES.TENANT_IVR_FLOWS_SIMULATE),
    canPublish: hasCapability(role, CAPABILITIES.TENANT_IVR_FLOWS_PUBLISH),
    canRollback: hasCapability(role, CAPABILITIES.TENANT_IVR_FLOWS_ROLLBACK),
  };
}
